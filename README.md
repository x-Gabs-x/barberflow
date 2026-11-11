# BarberFlow

Aplicação para apoiar a gestão de barbearias, com recursos para organizar atendimentos e rotinas administrativas.

> Projeto acadêmico em desenvolvimento.

## Componentes

- `app/`: aplicativo web e mobile desenvolvido com Expo, React Native e TypeScript.
- `api/`: serviço backend desenvolvido com Node.js e Express.
- Persistência e autenticação: Supabase.

## Requisitos

- Node.js LTS e npm.

## Executar localmente

### API

```powershell
cd api
npm install
```

Crie `api/.env` localmente e configure as credenciais do Supabase (`SUPABASE_URL` e `SUPABASE_SECRET_KEY`). Não compartilhe nem adicione esse arquivo ao Git.

Inicie o serviço:

```powershell
npm run dev
```

A API usa a porta `3000` por padrão. Para verificar a conexão local, acesse `http://localhost:3000/saude`.

### Aplicativo

Em outro terminal:

```powershell
cd app
npm install
npm run web
```

Para apontar o aplicativo a uma API em outro endereço, configure `EXPO_PUBLIC_API_URL` no ambiente local.

## Segurança

- Mantenha credenciais, tokens e dados de acesso fora do repositório.
- Não inclua arquivos `.env` nem valores secretos em documentação, código ou capturas de tela.
- Se uma credencial for exposta, solicite sua revogação e substituição ao responsável pelo serviço.
