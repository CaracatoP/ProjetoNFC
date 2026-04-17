# NFC Linktree SaaS

Base refatorada para páginas NFC multi-tenant, preparada para operar como SaaS white-label com frontend componentizado, backend em camadas e contratos compartilhados.

## Estrutura

```text
frontend/
backend/
shared/
.env
.env.example
README.md
```

## Frontend

- `React + Vite`
- rotas públicas em `/site/:slug`
- scaffolds prontos para `/auth/*` e `/dashboard/*`
- renderização orientada por dados via `section.type`

## Backend

- `Express + MongoDB + Mongoose`
- fluxo `route -> controller -> service -> repository`
- middlewares de tenant, validação, logging e erro global
- seed inicial derivado da barbearia original

## Endpoints ativos

- `GET /api/health`
- `GET /api/public/site/:slug`
- `GET /api/public/tags/:tagCode/resolve`
- `POST /api/public/analytics/events`

## Variáveis de ambiente

Use `.env.example` como base. Nesta fase o `.env` guarda apenas infraestrutura e runtime; PIX, Wi-Fi, branding, links e conteúdo pertencem ao tenant seedado no banco.

## Execução esperada

Em um ambiente Node com `npm` disponível:

```bash
npm install
```

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Ou, se preferir por pasta:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Importante: o frontend não deve ser aberto diretamente pelo `index.html` nem servido por um file server simples. Como a app usa `React + Vite`, ela precisa rodar pelo Vite dentro de `frontend/`.

## Próximos passos

- autenticação real e proteção de rotas
- CRUD administrativo de negócios, seções, links e tema
- analytics visual por tenant
- billing, planos e assinatura
- editor visual de seções e white-label por domínio

## Demo no Netlify

Você já pode publicar o frontend no Netlify para mostrar o tenant de exemplo.

- o slug de demo `/site/barbearia-estilo-vivo` funciona mesmo sem backend público
- isso acontece porque o frontend usa um fallback local quando a API não responde para o tenant demo
- o dashboard `/auth` e `/dashboard` não é o melhor fluxo para demonstração pública sem um backend online

O projeto já está preparado com `netlify.toml` na raiz. No Netlify, use:

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`

Depois do deploy, a URL ideal para mostrar é:

```text
https://seu-site.netlify.app/site/barbearia-estilo-vivo
```
