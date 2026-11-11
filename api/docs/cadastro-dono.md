# Cadastro do dono — Etapa 1

## Escopo e contrato

`POST /auth/cadastro/dono` usa Supabase Auth e as tabelas `usuario`,
`estabelecimento` e `vinculo`. O arquivo `esquema-barberflow.sql`, fornecido pelo
responsável pelo banco, já foi conferido: colunas, tipos, chaves estrangeiras,
restrições UNIQUE, índice parcial de equipe, defaults, cascatas e políticas RLS
correspondem ao uso feito pelo cadastro. O SQL não contém trigger de criação
automática de `usuario`. A API usa o cliente administrativo exclusivamente no
backend; as políticas RLS descritas no arquivo não concedem escrita ao cliente
comum. Nenhum SQL foi executado ou alterado durante a revisão/correção.

A única validação pendente desta correção é o teste de integração com Supabase
real. A revisão do arquivo SQL e os testes locais não comprovam o comportamento
do ambiente remoto.

Não há alterações de esquema, frontend, login, cadastro da equipe ou recuperação
de senha. As validações existentes e o contrato de sucesso foram preservados.

## Fluxo

1. O middleware Zod valida o corpo, normaliza CPF e telefone e exige o aceite.
2. Consulta o CPF; se existir, retorna `409` sem alterar a conta existente.
3. Cria uma conta com `auth.admin.createUser`, senha e `email_confirm: true`.
   Não envia código de confirmação nem estabelece sessão de login.
4. Insere `usuario` com o UUID retornado pelo Auth, dados pessoais e o aceite:
   horário UTC atual e `VERSAO_TERMOS` importada de `src/termos.js`.
5. Insere `estabelecimento`, omitindo telefone e cidade quando não informados.
   O código tem oito caracteres escolhidos com `crypto.randomInt` no alfabeto
   `A-Z0-9`, separados no formato `BRB-XXXX-XXXX`.
6. Confirma o UUID devolvido pelo banco e insere o vínculo como `dono` e `ativo`.
7. Somente após todas as operações, retorna `201`:
   `{ "ok": true, "mensagem": "Cadastro realizado." }`.

O UUID do estabelecimento é gerado com `crypto.randomUUID` antes da inserção,
na coluna `id` já existente. Isso permite identificar a tentativa mesmo se a
resposta da inserção se perder. Não utiliza IDs fictícios nem depende de uma
consulta pelo nome da barbearia.

## Erros e compensação

| Situação | HTTP e comportamento |
| --- | --- |
| Validação inválida | `400`, com `campos` no formato existente |
| CPF existente | `409`, `cpf_duplicado` |
| UNIQUE ao inserir usuário, com CPF concorrente confirmado | Compensa a conta nova e retorna `409` |
| E-mail recusado pelo Auth como existente | `409`, `email_duplicado`, com indicação da pendência RN13 |
| UNIQUE ao inserir estabelecimento, com colisão de código confirmada | Repete a geração, até cinco inserções no total |
| Outra falha conhecida | Compensa os registros novos e retorna `500`, `cadastro_falhou` |
| Falha na compensação ou resultado remoto incerto | `500`, `cadastro_limpeza_pendente`, com protocolo |

O código não pressupõe nomes de constraints: após `23505`, verifica a existência
do CPF ou do código correspondente. A restrição UNIQUE do banco continua sendo
a proteção contra concorrência. Não usa upsert nem sobrescreve registros.

A classificação de rejeição definitiva da inserção usa somente estes códigos:

| SQLSTATE | Motivo da rejeição da instrução |
| --- | --- |
| `23502` | Campo obrigatório nulo |
| `23503` | Violação de chave estrangeira |
| `23505` | Violação de unicidade |
| `23514` | Violação de CHECK |
| `23P01` | Violação de restrição de exclusão |

Essas violações de integridade impedem a inserção da linha. Somente nesses casos
o UUID reservado para um estabelecimento cuja inserção foi rejeitada é descartado.
O tamanho ou formato do código não é usado para inferir que a gravação falhou.

`08007` (`transaction_resolution_unknown`), `40003`
(`statement_completion_unknown`), exceções de rede, erros de comunicação do SDK
e códigos não reconhecidos são tratados conservadoramente como resultados
incertos. O UUID reservado é preservado para a compensação e para o log. Não há
nova tentativa automática de inserir após resultado incerto.

A compensação tenta excluir o estabelecimento da tentativa primeiro e o usuário
Auth depois, mesmo se a primeira exclusão falhar. A segunda exclusão depende dos
cascades documentados para remover `usuario` e `vinculo`. Toda exclusão usa UUID;
não se exclui por CPF, e-mail ou código. UUIDs de registros encontrados nas
consultas de duplicidade nunca são usados na compensação.

Cada exclusão é tentada uma única vez. Para o estabelecimento, a confirmação
exige resposta HTTP 2xx do PostgREST com `error: null`. Para o Auth, exige
`error: null` e o UUID esperado no usuário devolvido pelo SDK; o código
`user_not_found` também confirma que a conta alvo está ausente. Erros,
resultados incertos ou respostas incompletas mantêm a pendência de exclusão.
Não há loops de compensação ou exclusão de outro UUID devolvido inesperadamente.

Se a gravação original teve resultado incerto, a pendência
`verificar_resultado_da_gravacao` permanece mesmo quando as duas exclusões
respondem com sucesso: a gravação original pode ainda estar em andamento e
terminar depois da exclusão. O sistema não declara essa situação resolvida.

O log operacional contém somente evento, protocolo, etapa, UUIDs e nomes fixos
das pendências. Não inclui o erro original, payload, CPF, e-mail, senha ou chaves.
A resposta pública contém apenas `erro`, `mensagem` e `protocolo`; os UUIDs
internos e os detalhes do banco não são enviados ao cliente.

Quando houver `cadastro_limpeza_pendente`, o responsável pelo Supabase deve:

1. Localizar o evento `cadastro_dono_falhou` pelo `operacao_id` igual ao protocolo.
2. Consultar os UUIDs registrados e confirmar o resultado final das requisições
   originais antes de intervir. O estado observado logo após um timeout pode
   mudar se ainda houver uma operação em andamento.
3. Conferir a origem e os relacionamentos dos registros. As pendências
   `excluir_estabelecimento` e `excluir_auth` indicam exclusões não confirmadas;
   não significam que os registros necessariamente continuam existindo.
4. Se for necessária limpeza manual, limitar a intervenção aos recursos
   comprovadamente pertencentes à tentativa: estabelecimento primeiro, conta
   Auth depois. Nunca substituir os identificadores por uma busca destrutiva
   baseada em CPF, e-mail ou nome da barbearia.
5. Confirmar o estado final de Auth, `usuario`, `vinculo` e `estabelecimento`
   antes de registrar a resolução do protocolo ou orientar nova tentativa.

Se o Auth não devolver um UUID, `verificar_criacao_auth` exige investigação dos
registros operacionais pelo responsável. O código não tenta descobrir e apagar
uma conta por e-mail, pois pode ser preexistente. Na ausência de evidência
suficiente, a pendência deve continuar aberta, sem exclusão por suposição.

**Limite:** compensação não equivale a uma transação. Uma queda do processo ou
uma resposta de rede perdida pode deixar registros pendentes. A resposta de erro
explicita os resultados incertos detectados, mesmo que as exclusões respondam com
sucesso. Não há garantia absoluta de atomicidade entre serviços.

Uma futura RPC transacional poderia inserir as três tabelas públicas em uma
única transação; a criação no Auth ainda precisaria de compensação/reconciliação.
Não foi criada nenhuma função SQL. Para tolerar também quedas do processo, será
necessário um mecanismo durável de reconciliação, a ser projetado separadamente.

CPF já cadastrado não cria outra conta nem outra barbearia por esta rota pública.
O fluxo autenticado de adicionar filiais permanece fora desta etapa; não foi
adicionada restrição que limite donos a uma barbearia. A definição da RN13 e
eventuais alterações legais ficam fora do escopo desta correção: permanece o
tratamento do e-mail duplicado sem aliases ou e-mails fictícios. Os textos legais
ainda mencionam confirmação de e-mail e foram preservados conforme solicitado.

## Testes locais

Na pasta `api`, execute `npm test`. Usa o runner nativo do Node, sem dependência
nova. Os testes unitários cobrem sucesso, termos, duplicidades, concorrência
simulada, colisões limitadas, falhas de gravação, compensação e logs sanitizados.

Os testes de regressão simulam gravações efetivadas em memória seguidas de
`08007`, `40003` ou falha de rede. Verificam preservação dos UUIDs, ordem das
exclusões, proteção de registros preexistentes e protocolo público sem UUIDs.
Também cobrem exclusão incerta (efetivada ou não), respostas incompletas,
falha do Auth e ausência de repetição ilimitada da compensação.

O teste HTTP monta o router real em uma porta local temporária, mas substitui o
cliente Supabase por um mock **antes** de carregá-lo. Verifica validações Zod,
normalização e contrato. Nenhum teste carrega `.env`, acessa Supabase ou comprova
persistência real. Falta somente executar a integração em ambiente autorizado
para verificar permissões efetivas, persistência e cascatas no Supabase real.

## Testar com Postman

1. Configure localmente as variáveis de backend já previstas no README:
   `SUPABASE_URL` e `SUPABASE_SECRET_KEY`. Não envie essas chaves no Postman.
2. Na pasta `api`, execute `npm run dev`.
3. Envie `POST http://localhost:3000/auth/cadastro/dono`, sem Authorization,
   com `Content-Type: application/json` e Body → raw → JSON:

```json
{
  "nome_completo": "Pessoa de Teste",
  "cpf": "529.982.247-25",
  "email": "cadastro-teste@example.com",
  "telefone": "(83) 99999-0000",
  "senha": "SenhaTeste123",
  "aceite_termos": true,
  "barbearia": {
    "nome": "Barbearia de Teste",
    "data_inicio": "2026-11-08",
    "cidade": "Campina Grande"
  }
}
```

Use dados de teste autorizados e ainda não cadastrados. Omita campos opcionais
vazios: `"telefone": ""` ou `"cidade": ""` continuam inválidos pelo Zod existente.

4. Espere `201` com o contrato acima. Confira no painel: uma conta Auth, um
   `usuario` com o mesmo UUID e termos, um estabelecimento com código BRB e um
   vínculo ativo de dono ligando os UUIDs. A senha não deve estar nas tabelas públicas.
5. Repita o corpo: espere `409` por CPF. Não deve surgir outro registro.
6. Com outro CPF de teste válido e o mesmo e-mail, espere `409` por e-mail/RN13.
7. Envie `aceite_termos: false`: espere `400`, sem novas gravações.

O limite de requisições já existente em `index.js` também se aplica. Falhas
parciais e colisões são simuladas pelos testes; não altere tabelas compartilhadas
para induzir esses erros manualmente.

Referências consultadas: [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
e [códigos de erro do Auth](https://supabase.com/docs/guides/auth/debugging/error-codes).
A classificação SQLSTATE foi conferida na
[referência do PostgreSQL](https://www.postgresql.org/docs/current/errcodes-appendix.html).
