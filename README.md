# BarberFlow

Sistema de gestão para barbearias.

## O problema

Barbeiros parceiros atendem clientes e o controle de pagamentos e comissões costuma ser manual. O BarberFlow organiza esse fluxo:

1. O **barbeiro** registra cada atendimento (cliente, serviços, valor, forma de pagamento e comprovante).
2. A **recepção** confere e valida os atendimentos do dia. Sem comprovante, não valida.
3. O **dono** valida o fechamento do dia e vê o repasse de cada barbeiro (escote) e o valor da barbearia.

## Perfis

- **Dono:** cria a barbearia (pode ter filiais), aprova a equipe, define os escotes e os serviços e confirma o fechamento.
- **Parceiro (barbeiro):** registra os atendimentos e envia comprovantes.
- **Recepção:** valida os atendimentos do dia.

## Tecnologias

- App: React Native com Expo (celular e web)
- API: Node.js com Express
- Banco, login e arquivos: Supabase (PostgreSQL, Auth e Storage)

## Estrutura

- `api/`: API com as regras de negócio
- `app/`: aplicativo (em construção)

## Como rodar a API

1. Entre em `api/` e instale as dependências: `npm install`
2. Crie o arquivo `api/.env` com `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `PORT=3000`
3. Rode `npm run dev` e abra http://localhost:3000/saude

## Equipe

Gabriel, Georgio, Lucas Vinícius, Arruda e Zac.
