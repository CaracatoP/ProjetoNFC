# Catalog Search And Fixed Back Design

## Goal
Deixar o catalogo publico mais amigavel com busca local de produtos e um botao fixed de voltar para a landing, alem de adicionar busca local de produtos na aba de catalogo do editor compartilhado.

## Scope
- Manter `/site/:slug` como landing principal e `/site/:slug/catalog` como pagina dedicada.
- Trocar o CTA textual de voltar por um botao fixed com seta para tras.
- Preservar `preview=1` e `t=...` no retorno para a landing.
- Adicionar busca local no catalogo publico sem novo backend.
- Adicionar busca local de produtos no editor compartilhado do catalogo para admin e cliente.
- Nao tocar em backend, auth, billing, carrinho, calculos, localStorage ou payload do pedido.

## Public Catalog
- `PublicCatalogPage.jsx` ganha um botao fixed de voltar no topo da viewport.
- O botao usa apenas um simbolo de seta e `aria-label` claro.
- `BusinessCatalogSection.jsx` recebe um campo de busca amigavel e filtra produtos por:
  - nome
  - categoria
  - descricao
- Grupos/categorias sem resultados nao renderizam.
- Se a busca nao encontrar nada, a pagina mostra um estado amigavel de vazio.

## Catalog Management Panel
- `TenantModuleManagementSection.jsx` ganha um campo `Buscar produto`.
- A filtragem acontece localmente sobre `editingProducts`.
- O campo deve ajudar tanto no `mode="client"` quanto no fluxo admin, sem mudar permissao nem CRUD.
- Quando a busca nao encontrar produtos, mostrar mensagem amigavel no lugar da lista.

## UX Notes
- O botao fixed de voltar precisa ficar visivel sem competir com o botao do carrinho.
- O campo de busca publico deve parecer parte do catalogo dedicado, com placeholder amigavel.
- O campo de busca no painel deve ficar perto do topo da aba de catalogo, antes da lista de produtos.

## Testing
- Landing/catalogo existente continua funcionando.
- `/site/:slug/catalog` permite buscar produto e esconder categorias sem match.
- O botao de voltar preserva query params de preview.
- A busca do painel encontra produtos por nome/categoria/descricao.
- Estado vazio de busca aparece quando nao ha match.
