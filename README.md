# TapLink

TapLink e uma base SaaS multi-tenant para paginas NFC white-label. O projeto tem painel administrativo interno, site publico por tenant, uploads via Cloudinary, backend Express em camadas e contratos compartilhados entre frontend e backend.

## Estrutura

```text
frontend/   React + Vite
backend/    Node.js + Express + MongoDB/Mongoose
shared/     constantes e schemas Zod compartilhados
```

## Fluxos principais

- `/auth`: login do administrador interno.
- `/dashboard`: criacao, edicao, duplicacao, ativacao/inativacao e preview dos tenants.
- `/site/:slug`: pagina publica do tenant por slug.
- `GET /api/public/site?host=...`: resolucao preparada para subdominio/dominio customizado.
- Uploads de logo, banner, favicon, galeria e servicos passam pelo backend e sao enviados ao Cloudinary.

## Ambiente

Use `.env.example` como base. Segredos reais nunca devem ser commitados.

Variaveis essenciais:

- `MONGODB_URI`
- `FRONTEND_ORIGIN`
- `PUBLIC_SITE_BASE_URL`
- `API_PUBLIC_BASE_URL`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_TOKEN_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `VITE_API_BASE_URL`

## Desenvolvimento

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Tambem e possivel rodar por pasta:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

## Deploy

- Backend: Railway, expondo a API publica.
- Frontend: Vercel, com SPA routing preservado.
- Banco: MongoDB Atlas.
- Midia: Cloudinary.

No frontend em producao, configure `VITE_API_BASE_URL` apontando para o backend publico com `/api` no final.

Exemplo:

```text
VITE_API_BASE_URL=https://seu-backend.railway.app/api
PUBLIC_SITE_BASE_URL=https://taplinkapp.vercel.app
FRONTEND_ORIGIN=https://taplinkapp.vercel.app
```

## Testes

```bash
npm --prefix backend test -- --run
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

## Observacoes

- O seed demo e opcional e deve ficar desabilitado em producao (`ENABLE_DEMO_SEED=false`).
- Tenants `inactive` nao carregam o site publico normal; o frontend exibe uma mensagem neutra.
- Arquivos locais em `/uploads` sao legado e devem permanecer fora do Git. O fluxo oficial de midia e Cloudinary.
