# Client Panel Collapsible Sections And Order Delete Design

## Context

O painel do cliente ficou funcional, mas algumas areas operacionais ainda estao pesadas para uso diario:

- `Configuracoes basicas` ocupa muito espaco vertical mesmo quando o cliente nao quer editar esses dados naquele momento.
- Em `Catalogo`, a lista de produtos ja criados cresce bastante e atrapalha a navegacao do formulario e da lista.
- Em `Pedidos`, todos os grupos de status ficam expandidos ao mesmo tempo, o que gera scroll desnecessario.
- Ainda nao existe uma acao de exclusao de pedido no painel cliente.

O objetivo deste ajuste e melhorar a operacao diaria sem reescrever o painel, sem mexer em auth/billing e sem alterar a logica de pedidos existente.

## Goals

- Permitir minimizar `Configuracoes basicas` no painel cliente.
- Permitir minimizar a lista de produtos ja criados no `Catalogo` do painel cliente.
- Permitir minimizar cada grupo de status em `Pedidos` no painel cliente.
- Adicionar exclusao de pedido com dupla confirmacao no painel cliente.
- Manter o admin interno praticamente intacto.

## Non-Goals

- Nao alterar auth, billing, plano ou permissoes base.
- Nao reestruturar o fluxo de pedidos.
- Nao alterar calculo, payload ou criacao publica de pedidos.
- Nao transformar o painel inteiro em accordion.
- Nao mexer no backend alem do minimo necessario para exclusao segura do pedido.

## Recommended Approach

Aplicar colapso leve preferencialmente em `mode="client"`:

- `BasicSettingsCard` passa a suportar estado minimizado, aberto por padrao no cliente.
- A aba `Catalogo` ganha uma secao colapsavel para `Produtos ja cadastrados`, separada do formulario de criacao.
- A aba `Pedidos` ganha estado de colapso por grupo de status (`received`, `preparing`, `ready`, `delivered`, `cancelled`).
- A exclusao de pedido entra no painel cliente com rota dedicada e dupla confirmacao inline no card do pedido.

Essa abordagem reduz risco porque reaproveita os componentes existentes e evita criar modais ou fluxos novos grandes.

## UX Design

### 1. Configuracoes basicas

No painel cliente, o card `Configuracoes basicas` ganha um botao simples de `Minimizar` / `Expandir`.

- Estado inicial: expandido.
- Quando minimizado:
  - mostra apenas cabecalho, texto curto e acao para expandir.
  - esconde o formulario inteiro.
- No admin interno:
  - comportamento atual permanece.

### 2. Catalogo

Na aba `Catalogo`, a lista de produtos ja existentes deixa de ficar sempre completamente aberta no cliente.

- O formulario `Adicionar produto` continua com o comportamento ja compacto e colapsavel implementado antes.
- A lista de produtos existentes passa a ficar dentro de uma secao `Produtos cadastrados`.
- Estado inicial:
  - expandido se houver poucos produtos
  - ainda aberto por padrao nesta primeira versao para evitar estranheza, mas com controle facil para fechar
- Quando minimizada:
  - mostra apenas titulo, contador e botao para expandir.

### 3. Pedidos

Cada grupo de pedidos por status passa a ser independentemente minimizavel no cliente.

Exemplos:

- `Recebidos (3)` aberto
- `Entregues (12)` fechado
- `Cancelados (4)` fechado

Comportamento:

- grupos com itens aparecem com cabecalho clicavel ou botao claro de minimizar/expandir
- estado inicial:
  - `received` aberto
  - demais grupos fechados no cliente
- no admin interno, manter lista expandida como hoje para nao alterar demais a UX interna

### 4. Exclusao de pedidos

Adicionar botao `Excluir pedido` somente para quem pode gerenciar pedidos no painel cliente.

Dupla confirmacao inline:

1. Primeiro clique revela bloco de confirmacao no proprio card.
2. Segundo clique confirma a exclusao com texto claro:
   - `Deseja excluir mesmo este pedido?`
3. Acoes disponiveis:
   - `Confirmar exclusao`
   - `Cancelar`

Ao concluir:

- remover o pedido da lista apos refresh
- mostrar feedback de sucesso
- manter bloqueio por permissao no backend e no frontend

## Backend Changes

Adicionar somente o necessario para exclusao segura no painel cliente:

- rota `DELETE /api/panel/orders/:id`
- controller dedicada no `clientPanelController`
- service dedicada no `clientPanelService`
- repository helper para excluir pedido por `businessId`

Regras:

- validar sessao autenticada
- validar permissao de gerenciamento de pedidos
- validar ownership por `businessId`
- impedir exclusao cross-tenant por id direto

## Frontend Changes

### ClientPanelPage

- `BasicSettingsCard` recebe estado local de colapso no modo cliente
- manter header e informacao principal visiveis mesmo quando minimizado

### TenantModuleManagementSection

- adicionar estados locais de colapso para:
  - `catalogProductsCollapsed`
  - grupos de status de pedido no modo cliente
  - confirmacao de exclusao por pedido
- exibir acao `Excluir pedido` apenas quando `canManageOrders`
- integrar com `moduleActions.deleteOrder`

### clientPanelService

- adicionar `deleteClientPanelOrder`

## Data And State Rules

- todos os estados de colapso podem ficar apenas em memoria local do componente
- nao persistir preferencias no banco agora
- ao trocar de aba ou recarregar, o estado volta para o default definido
- a confirmacao de exclusao vale para um pedido por vez

## Testing

Adicionar ou ajustar testes para:

- painel cliente mostra `Configuracoes basicas` e permite minimizar/expandir
- aba `Catalogo` permite minimizar/expandir `Produtos cadastrados`
- aba `Pedidos` permite minimizar/expandir grupos por status no cliente
- grupo `Recebidos` inicia aberto e grupos secundarios iniciam fechados no cliente
- admin interno nao perde o comportamento atual
- `Excluir pedido` aparece apenas para quem pode gerenciar pedidos
- primeiro clique abre confirmacao
- confirmar exclui pedido e atualiza a lista
- cancelar fecha confirmacao sem excluir
- backend bloqueia exclusao cross-tenant
- backend bloqueia exclusao para nivel sem permissao

## Risks

- Como `TenantModuleManagementSection` e compartilhado entre admin e cliente, o principal risco e vazar comportamento de colapso para o admin interno. A implementacao deve condicionar essas mudancas principalmente a `mode === 'client'`.
- A exclusao de pedido muda o conjunto de acoes do painel cliente, entao ownership e permissao precisam ser cobertos por teste antes de considerar a entrega concluida.

## Rollout

Entrega pequena e incremental:

1. adicionar testes de UX para colapso e confirmacao de exclusao
2. adicionar suporte backend de exclusao segura de pedido
3. implementar colapso no painel cliente
4. conectar exclusao com dupla confirmacao
5. rodar testes frontend/backend e build frontend
