# Tenant Client Auth And Access Design

## Context

O TapLink hoje possui:

- backend Node e Express
- frontend React
- MongoDB
- painel admin interno com auth proprio
- tenants e businesses multi-tenant
- segmentos e modulos por tenant
- catalogo, pedidos, agendamentos, profissionais e servicos
- seed e bootstrap de usuario admin por variavel de ambiente

Atualmente o sistema e operado apenas internamente. O objetivo desta etapa e liberar acesso controlado para clientes e equipe operacional, mantendo compatibilidade com o login admin atual e sem perder o bootstrap do dono do sistema.

## Goals

- introduzir autenticacao e sessao para usuarios internos e clientes no mesmo modelo `User`
- tornar `roleLevel` a fonte canonica de permissao
- manter o login admin atual funcionando, agora formalizado como `nivel 0`
- criar gestao de clientes no painel interno
- criar painel do cliente limitado por nivel, plano, billing, modulos e tenant vinculado
- centralizar permissao em helpers reutilizaveis
- manter plano e billing como fonte de verdade no nivel do tenant

## Non-Goals

- cobranca automatica real
- Stripe, Mercado Pago ou recorrencia real
- multiempresa por usuario
- permissao customizada por usuario alem de `roleLevel`
- reescrever o painel inteiro
- remover o auth admin legado nesta etapa

## Constraints

- nao quebrar `requireAdminAuth`
- nao quebrar `dashboard` atual
- nao quebrar o bootstrap admin existente
- o usuario atual do sistema deve virar `nivel 0`
- `plan` e `billingStatus` nao devem ser persistidos no usuario como fonte de verdade
- usuarios `2-5` sempre operam dentro do proprio `businessId`

## Canonical Roles

Existem 6 niveis totais:

- `0` Super Admin
- `1` Admin Operacional
- `2` Cliente Dono
- `3` Gerente
- `4` Operador
- `5` Visualizador

### Level 0

- acesso total
- cria e gerencia qualquer usuario
- unico nivel que cria `nivel 1`
- controla plano, billing e configuracoes sensiveis
- acessa qualquer tenant

### Level 1

- equipe interna operacional
- pode criar e editar usuarios `2-5`
- pode resetar senha e bloquear ou desbloquear usuarios `2-5`
- pode vincular usuarios a tenants
- nao cria `nivel 0`
- nao cria `nivel 1`
- nao altera plano
- nao altera billing
- nao altera configuracoes globais criticas
- nao altera o proprio nivel

### Level 2

- dono do tenant
- acesso ao proprio tenant
- pode ver e operar pedidos e agendamentos
- pode gerenciar catalogo, servicos e profissionais quando modulo e plano permitirem
- pode editar configuracoes basicas do tenant quando plano permitir
- pode ver plano e billing resolvidos no frontend
- nao altera plano, billing, modulos, segmento ou configuracoes sensiveis

### Level 3

- gerente do tenant
- acesso ao proprio tenant
- pode ver e operar pedidos e agendamentos
- pode gerenciar catalogo, servicos e profissionais quando modulo e plano permitirem
- pode editar apenas configuracoes operacionais simples, quando permitido
- nao altera plano, billing, segmento, modulos ou configuracoes sensiveis

### Level 4

- operador
- acesso ao proprio tenant
- pode ver pedidos e agendamentos
- pode alterar status de pedidos e agendamentos
- nao edita catalogo, servicos, profissionais nem dados principais do tenant

### Level 5

- visualizador
- acesso apenas leitura ao proprio tenant
- nao altera status
- nao edita nada
- nunca ve analytics

## Source Of Truth For Plan And Billing

Plano e billing sao propriedades do tenant no nivel de `businessId`, nao do usuario.

Fonte de verdade:

- `Plan`
- `Subscription`

O usuario herda pelo `businessId`:

- plano contratado
- status financeiro
- modulos permitidos
- escopo de analytics
- limites operacionais

A API de sessao pode devolver esses dados resolvidos e denormalizados para o frontend, mas sem duplicar isso no model `User` como verdade principal.

## Billing Rules

### Paid and trial

- acesso normal conforme `roleLevel`, plano, modulos e ownership

### Overdue

Comportamento hibrido:

- pode logar
- pode visualizar painel
- pode continuar recebendo pedidos e agendamentos
- ve banner forte de vencimento
- perde acoes criticas

Acoes criticas bloqueadas em overdue:

- editar configuracoes do tenant
- uploads novos
- alteracoes operacionais importantes
- edicao massiva de catalogo

### Suspended and cancelled

- bloqueio real do painel do cliente
- tela dedicada de acesso suspenso
- `nivel 0` continua acessando tudo
- `nivel 1` continua podendo operar suporte interno, sem mexer em billing ou plano

## Plan And Analytics Granularity

Analytics nao deve ser apenas booleano. O sistema precisa resolver um escopo final a partir de plano e nivel.

### Plan capabilities

`starter`

- sem analytics

`pro`

- analytics basico
- visitas
- cliques
- pedidos
- agendamentos

`premium`

- analytics avancado
- recorrencia
- top produtos
- horarios de pico
- performance por modulo

`enterprise`

- tudo liberado

### Final analytics resolution

Criar helper central:

- `resolveAnalyticsScope(user, businessContext)`

Possiveis retornos:

- `none`
- `summary`
- `basic`
- `advanced`
- `full`

Regras alvo:

- nivel 5: `none`
- nivel 4: no maximo `summary`
- nivel 3: no maximo `basic`
- nivel 2: tudo que o plano permitir
- nivel 1 e 0: conforme necessidade interna, podendo acessar visoes amplas

O helper resolve a menor permissao entre o que o plano permite e o que o nivel permite.

## Tenant Settings By Criticality

As configuracoes do tenant nao devem ser tratadas como um bloco unico.

### Basic settings

Editaveis por `nivel 2`, conforme plano:

- nome
- descricao
- telefone
- WhatsApp
- endereco
- horarios
- links sociais
- logo e banner, se o plano permitir uploads basicos

### Operational settings

Editaveis por `nivel 3` em escopo limitado, quando modulo e plano permitirem:

- catalogo
- servicos
- profissionais
- horarios operacionais

`nivel 2` tambem pode editar isso quando permitido.

### Sensitive settings

Somente `nivel 0` e `nivel 1`:

- slug publico
- dominio
- segmento
- modulos
- plano
- billing
- duplicacao
- exclusao
- configuracoes globais

Helpers obrigatorios:

- `canEditTenantBasics()`
- `canEditOperationalSettings()`
- `canEditTenantSensitiveSettings()`

## Proposed Architecture

### 1. Keep a single User model

Evoluir o model `User` atual para suportar:

- `roleLevel`
- `businessId` opcional
- `active`
- `lastLoginAt`
- possivel `deletedAt` ou soft-delete, se necessario

Manter `roles` temporariamente como legado tecnico de compatibilidade com o auth admin atual.

`roleLevel` passa a ser o campo canonico.

### 2. Unified auth with legacy compatibility

Introduzir auth unificado sem remover o legado de uma vez.

Novas rotas canonicas:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Compatibilidade mantida:

- `POST /api/admin/auth/login`
- `GET /api/admin/auth/session`
- `POST /api/admin/auth/logout`

Na pratica:

- o frontend novo usa `/api/auth/*`
- o fluxo admin atual continua aceitando `/api/admin/auth/*`
- ambos resolvem para a mesma sessao e o mesmo `User`

### 3. Session payload

O token deve carregar apenas o minimo necessario:

- `sub`
- `roleLevel`
- `businessId` quando houver
- marcadores basicos de sessao

Dados de plano, billing, modulos e analytics devem ser resolvidos no backend ao montar `/api/auth/me`, nao hardcoded no token.

### 4. Permission layer

Criar camada central de permissionamento para backend e frontend seguirem a mesma logica conceitual.

Helpers necessarios:

- `canAccessBusiness(user, businessId)`
- `canManageUsers(user)`
- `canManageBilling(user)`
- `canManagePlans(user)`
- `canViewOrders(user, businessContext)`
- `canManageOrders(user, businessContext)`
- `canViewAppointments(user, businessContext)`
- `canManageAppointments(user, businessContext)`
- `canViewAnalytics(user, businessContext)`
- `resolveAnalyticsScope(user, businessContext)`
- `canEditTenantBasics(user, businessContext)`
- `canEditTenantSensitiveSettings(user, businessContext)`
- `canEditOperationalSettings(user, businessContext)`
- `canEditCatalog(user, businessContext)`
- `canEditServices(user, businessContext)`
- `canEditProfessionals(user, businessContext)`
- `canManageClientUsers(user, targetUser)`

O backend e a fonte final de bloqueio. O frontend usa esses conceitos para UX, mas nunca substitui o backend.

### 5. Business context resolver

Criar um resolvedor central de contexto do tenant para autorizacao, com dados como:

- `businessId`
- `segment`
- `modules`
- `subscription`
- `plan`
- `billingStatus`

Isso evita duplicar logica em controllers.

## Backend Design

### User model evolution

O model `User` atual sera expandido em vez de substituido.

Campos finais desejados:

- `name`
- `email`
- `passwordHash`
- `roleLevel`
- `businessId` opcional
- `active`
- `lastLoginAt`
- `roles` legado temporario
- timestamps atuais

`plan` e `billingStatus` nao entram como fonte principal no usuario.

### Bootstrap level 0

O bootstrap atual por env continua existindo.

Novas regras:

- se o usuario bootstrap nao existir, criar com `roleLevel: 0`
- se existir e ainda nao tiver `roleLevel`, migrar para `0`
- manter `roles` legado coerente para nao quebrar `requireAdminAuth`
- nunca permitir criacao de `nivel 0` por rotas comuns

### Middleware strategy

Manter:

- `requireAdminAuth` legado para rotas internas

Adicionar:

- `requireSessionAuth`
- `requireRoleLevel(...)`
- `requireBusinessScope(...)`
- `requireActiveAccess(...)`

Rollout:

- `requireAdminAuth` continua protegendo o dashboard interno
- rotas novas usam o auth unificado
- migracoes internas de middleware acontecem gradualmente e com cobertura de teste

### Admin and client management routes

Rotas de auth:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Compatibilidade admin:

- manter `/api/admin/auth/*`

Rotas de usuarios admin:

- `POST /api/admin/users`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PUT /api/admin/users/:id`
- `PATCH /api/admin/users/:id/status`
- `PATCH /api/admin/users/:id/password`
- `DELETE /api/admin/users/:id` ou soft delete

Rotas de clientes:

- `GET /api/admin/clients`
- `POST /api/admin/clients`
- `GET /api/admin/clients/:id`
- `PUT /api/admin/clients/:id`
- `PATCH /api/admin/clients/:id/billing-status`
- `PATCH /api/admin/clients/:id/plan`
- `PATCH /api/admin/clients/:id/access-level`
- `PATCH /api/admin/clients/:id/reset-password`
- `PATCH /api/admin/clients/:id/block`
- `PATCH /api/admin/clients/:id/unblock`

Regra:

- `nivel 0` pode criar `nivel 1-5`
- `nivel 1` pode criar `nivel 2-5`
- `nivel 1` nao cria `nivel 1`
- `nivel 1` nao toca em billing ou plano
- `nivel 0` e o unico com poder total sobre nivel maximo e financeiro

### Multi-tenant enforcement

Usuarios `2-5`:

- acessam apenas o proprio `businessId`
- qualquer query relevante filtra por `businessId`
- acesso por ID direto a outro tenant retorna `403`

Usuarios `0-1`:

- podem operar tenants com escopo interno
- `nivel 1` ainda respeita restricoes sensiveis

### Privilege escalation prevention

Regras obrigatorias:

- ignorar ou rejeitar tentativa de elevar `roleLevel` acima do permitido
- validar `targetUser.roleLevel` e `actor.roleLevel`
- impedir alteracao do proprio nivel
- impedir que `nivel 1` toque em `nivel 0` ou `nivel 1`
- impedir update manual de `businessId` para tenant fora do escopo, quando aplicavel
- nunca confiar em campos vindos do frontend para permissao final

## Frontend Design

### Session context

Evoluir `AuthContext` atual para um contexto de sessao geral.

Sessao deve expor:

- `user`
- `roleLevel`
- `businessId`
- `accessScope`
- `resolvedPlan`
- `resolvedBillingStatus`
- `resolvedModules`
- `resolvedAnalyticsScope`

### Login screen

Reaproveitar a tela atual de login como entrada geral do painel.

Redirecionamento:

- `0/1` -> dashboard interno
- `2/3/4/5` -> painel do cliente

### Client panel

Criar rota separada para o painel do cliente, reaproveitando componentes existentes quando possivel.

Capacidades por nivel:

- `2`: tenant basics, catalogo, pedidos, agendamentos, profissionais, servicos, plano e billing somente leitura, analytics conforme plano
- `3`: pedidos, agendamentos, catalogo e servicos ou profissionais se permitido, analytics basico se permitido
- `4`: pedidos e agendamentos com atualizacao de status
- `5`: leitura apenas

### Suspended access screen

Usuarios `suspended` ou `cancelled` nao entram no painel principal. Devem cair em tela dedicada com mensagem de bloqueio e orientacao de contato.

### Overdue experience

Usuarios overdue entram no painel, mas:

- veem banner forte
- recebem bloqueio visual de acoes criticas
- backend tambem bloqueia essas mesmas acoes

### Admin clients area

No dashboard interno de `nivel 0`, criar secao `Clientes`.

No `nivel 1`, a secao pode existir em modo limitado, sem billing e sem plano.

Funcionalidades:

- listar clientes
- buscar por nome, email e tenant
- filtrar por plano
- filtrar por billing
- filtrar por nivel
- criar cliente
- editar cliente
- resetar senha
- bloquear ou desbloquear

Somente `nivel 0`:

- altera plano
- altera billing
- cria `nivel 1`

## Migration Strategy

### Phase 1: Compatibility first

- expandir o model `User`
- manter `requireAdminAuth`
- manter `/api/admin/auth/*`
- bootstrap atual passa a garantir `roleLevel: 0`

### Phase 2: Unified auth introduction

- adicionar `/api/auth/*`
- evoluir `AuthContext`
- permitir login unico para admin e cliente

### Phase 3: Client panel and admin clients

- habilitar painel do cliente
- habilitar gestao de clientes no admin

### Phase 4: Gradual internal adoption

- migrar partes do frontend para usar a sessao unificada
- manter camada de compatibilidade enquanto necessario

## Login Risk And Rollback

### Main risks

- quebrar o bootstrap do admin atual
- quebrar `requireAdminAuth`
- emitir token incompativel com o dashboard atual
- migrar `User` sem fallback seguro

### Rollback strategy

- manter `roles` legado no model durante a transicao
- manter `requireAdminAuth` intacto na primeira etapa
- manter `/api/admin/auth/*`
- se algo falhar, o bootstrap admin por env deve continuar recriando ou corrigindo o usuario `nivel 0`
- nao remover rotas antigas antes de cobertura completa por testes

## Testing Strategy

### Backend

Cobrir:

- login valido e invalido
- senha com hash
- bootstrap e migracao do usuario nivel 0
- `nivel 0` acessa tudo
- `nivel 1` cria e gerencia apenas usuarios `2-5`
- `nivel 1` nao cria `nivel 1`
- `nivel 1` nao altera billing ou plano
- `nivel 2` acessa apenas o proprio tenant
- `nivel 3`, `4` e `5` respeitam limites
- overdue pode logar mas perde acoes criticas
- suspended e cancelled nao acessam painel do cliente
- tentativa de acessar outro tenant retorna `403`
- tentativa de privilege escalation retorna `403`

### Frontend

Cobrir:

- login
- restauracao de sessao
- redirecionamento por `roleLevel`
- renderizacao condicional de botoes
- secao de clientes para `nivel 0`
- restricoes visuais para `nivel 1`
- tela de acesso suspenso
- banner de overdue
- `nivel 5` nao consegue editar
- analytics oculto ou limitado conforme nivel e plano

## Expected Deliverable

Ao final, o TapLink deve suportar acesso interno e acesso do cliente no mesmo ecossistema de auth, preservando o login atual do dono, centralizando permissao e respeitando nivel, tenant, plano, billing e modulos sem quebrar o fluxo administrativo existente.

