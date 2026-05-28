# Client Panel Product Form UX Compaction Design

## Context

The client panel currently reuses the same module management surface as the internal admin. In the `Catalogo` tab, the product creation form is always open and the edit cards for existing products are vertically tall, which creates excessive scrolling for tenant users on notebooks and mobile devices.

The catalog logic itself is already correct and must remain unchanged:

- backend payloads
- product schema
- upload flow
- measurement units
- order/cart logic
- permissions

## Goal

Compact the catalog product form UX in the client panel so adding or editing a product feels lighter and requires less scrolling.

## Non-Goals

- No backend changes
- No product schema or validation changes
- No upload logic changes
- No pricing, cart, or order logic changes
- No permission changes

## UX Direction

Apply the compaction primarily to `mode="client"` inside `TenantModuleManagementSection`.

### New product form

- In client mode, `Adicionar produto` stays collapsed by default
- Clicking `Adicionar produto` reveals the form
- `Cancelar` closes the form without saving
- After a successful create, reset the draft and collapse the form again

### Layout

Desktop:

- use compact two-column rows where possible
- `Produto` + `Preco`
- `Categoria` + `Unidade de venda`
- image/upload in a smaller bounded block
- smaller description textarea

Mobile:

- keep one column
- reduce gaps and vertical spacing
- keep save/cancel actions near the form footer

### Existing product cards

- keep inline editing
- make cards denser in client mode
- surface actions close to the edited fields
- keep controls readable without turning them into modals

## Technical Strategy

Keep all logic in `TenantModuleManagementSection` and only add:

- a client-mode toggle state for the new product form
- compact layout classes for client-mode product forms and cards
- smaller textarea rows and tighter spacing in client mode

The internal admin should keep the current behavior as much as possible.

## Testing

Update frontend tests to confirm:

- client-mode catalog starts with the add form collapsed
- clicking `Adicionar produto` opens the form
- `Cancelar` closes it without saving
- saving still calls the create flow
- editing existing products still works
- read-only client levels still cannot edit the catalog
