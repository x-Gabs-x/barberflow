# BarberFlow

Aplicação para apoiar a gestão de barbearias, com recursos para organizar atendimentos e rotinas administrativas.

> Projeto acadêmico em desenvolvimento.

## Componentes

- `app/`: aplicativo web e mobile desenvolvido com Expo, React Native e TypeScript.
- `api/`: serviço backend desenvolvido com Node.js e Express.
- Persistência e autenticação: Supabase.

## Requisitos

- Node.js LTS e npm instalados.
- Acesso à internet para instalar as dependências.
- Projeto Supabase configurado com as tabelas e funções SQL usadas pela aplicação.

## Executar localmente

O backend e o aplicativo são processos separados. Para desenvolver, abra **dois terminais** na raiz do repositório: deixe a API rodando em um e inicie o Expo no outro.

### 1. Configurar e iniciar a API

No primeiro terminal, entre na pasta `api`:

```powershell
cd .\api
npm install
```

Crie o arquivo `api/.env` localmente, com as credenciais do seu projeto Supabase:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SECRET_KEY=sua-chave-secreta-do-supabase
PORT=3000
```

Substitua os valores de exemplo pelas credenciais do ambiente de desenvolvimento. **Nunca compartilhe a chave secreta, publique-a no repositório ou a coloque em variáveis `EXPO_PUBLIC_*`.** O arquivo `.env` é local e ignorado pelo Git.

Ainda dentro de `api`, inicie o backend:

```powershell
npm run dev
```

A mensagem `API rodando em http://localhost:3000` indica que o servidor iniciou. Acesse `http://localhost:3000/saude` para verificar a conexão com o Supabase; a resposta esperada é `{"ok":true,"banco":"conectado"}`.

Mantenha esse terminal aberto. Se a porta padrão estiver ocupada, defina outra porta na variável `PORT` do `api/.env`.

### 2. Instalar e iniciar o aplicativo Expo

Abra um **segundo terminal** na raiz do repositório e entre na pasta `app`:

```powershell
cd .\app
npm install
npx expo start
```

O terminal do Expo exibirá um QR code e atalhos:

- **Navegador:** pressione `w` para abrir a versão Web.
- **Celular com Expo Go:** instale o Expo Go, conecte o celular e o computador à mesma rede Wi-Fi e leia o QR code.
- **Emulador Android/iOS:** inicie o emulador e use o atalho indicado pelo Expo.

Mantenha também o terminal do Expo aberto. Para encerrar qualquer um dos processos, use `Ctrl+C no terminal correspondente`.

#### Endereço da API no aplicativo

Por padrão, o app usa a porta `3000` no computador que iniciou o Expo. Na Web, `localhost` normalmente funciona. Em um celular físico, o `localhost` do aparelho não é o computador: se a API não for encontrada, configure `EXPO_PUBLIC_API_URL` **no terminal do Expo**, usando o endereço IPv4 do computador na rede local:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.10:3000"
npx expo start
```

Troque `192.168.1.10` pelo IPv4 real do computador e confirme que o firewall permite a conexão à porta da API. Essa variável contém apenas o endereço do backend; **não coloque credenciais ou chaves nela**. O valor definido dessa forma vale somente para aquele terminal.

### Testes da API

Para executar a suíte de testes do backend, use outro terminal:

```powershell
cd .\api
npm test
```

## Segurança

- Mantenha credenciais, tokens e dados de acesso fora do repositório.
- Não inclua arquivos `.env` nem valores secretos em documentação, código ou capturas de tela.
- Se uma credencial for exposta, solicite sua revogação e substituição ao responsável pelo serviço.
