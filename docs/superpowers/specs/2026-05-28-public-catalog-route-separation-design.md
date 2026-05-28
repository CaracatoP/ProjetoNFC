# Public Catalog Route Separation Design

## Context

Today the tenant public page at `/site/:slug` mixes the Linktree-style landing page with the full catalog and cart flow. This makes the page long, blends navigation with shopping, and weakens the public experience for tenants that use catalog, cart, or order modules.

The existing public catalog implementation already supports:

- category grouping
- localStorage cart by slug
- fractional quantities for supported measurement units
- order submission from the public page

The goal of this change is to separate the shopping flow without rewriting the catalog system or breaking public URLs that already exist.

## Goals

- Keep `/site/:slug` as the main public landing page.
- Add a dedicated public catalog route at `/site/:slug/catalog`.
- Remove the full inline catalog and cart from the main landing page.
- Reuse the current catalog and cart logic instead of duplicating it.
- Preserve current cart behavior, localStorage persistence, measurement-unit logic, order submission, and success/error feedback.
- Keep preview compatibility by preserving `preview=1` and `t=...` query params in catalog links.

## Non-Goals

- No backend rewrite or new catalog API shape.
- No auth, billing, or client-panel changes.
- No checkout, payment, or stock features.
- No redesign of the full public site visual language.
- No removal of `/site/:slug`.

## Routing

### Existing route

- `/site/:slug` remains the public tenant landing page.

### New route

- `/site/:slug/catalog` becomes the dedicated catalog page for that tenant.

This route must consume the same public tenant payload already used by `/site/:slug` so preview mode, public caching, and theme application remain consistent.

## Main Landing Page Behavior

The main public page keeps:

- business summary and theme
- quick links and CTA sections
- WhatsApp/social/contact/basic information
- non-catalog public modules that still belong to the landing flow

The main public page no longer renders:

- full product catalog
- inline cart
- inline order checkout form

When any of these modules are active:

- `catalog`
- `cart`
- `orders`

the page should show a clear CTA pointing to `/site/:slug/catalog`.

### CTA behavior

- Preferred label: `Ver catalogo`
- Alternate label when needed by segment copy: `Fazer pedido`
- The CTA should live naturally in the quick-access flow instead of creating a brand-new editor surface.
- In preview mode, the CTA must preserve `preview=1` and `t=...` so the dedicated catalog preview loads fresh tenant data.

## Dedicated Catalog Page

Create a new frontend page component:

- `frontend/src/pages/public/PublicCatalogPage.jsx`

This page should:

- load the same tenant payload by slug
- apply the tenant theme
- render a compact branded header
- include a clear back action to `/site/:slug`
- render the catalog grouped by category
- expose the dedicated cart UI

### Required states

If the tenant does not have catalog-related modules active:

- show `Catalogo indisponivel no momento`

If catalog modules are active but there are no products:

- show `Nenhum produto cadastrado ainda`

These states should still use the tenant theme and public layout.

## Catalog Component Strategy

The current `BusinessCatalogSection` remains the single source of truth for:

- product grouping
- quantity rules
- measurement-unit display
- fractional quantity handling
- subtotal and total calculation
- localStorage cart persistence by slug
- order submission payload
- cart cleanup after a successful order

The component should be refactored to support a dedicated-page mode instead of being duplicated.

### Responsibilities after refactor

`BusinessCatalogSection` should be able to:

- render the product grid in catalog-page mode
- expose a fixed cart trigger with badge
- open/close the dedicated cart UI
- keep the checkout form and order submission inside that dedicated cart UI

## Cart UX

The cart must appear only in the dedicated catalog page.

### Desktop

- fixed trigger in the upper-right area
- click opens a floating card, dropdown, or side panel anchored near the trigger

### Mobile

- bottom sheet, drawer, or modal-style panel
- must stay usable on small screens without clipping the checkout form

### Cart contents

The cart UI must allow:

- viewing cart items
- viewing quantity and unit labels
- viewing item subtotal
- changing quantity
- removing items
- filling customer name
- filling customer phone
- selecting pickup or delivery if already supported
- filling address when delivery is selected
- order notes
- finishing the order
- seeing success or error feedback

## Preview and Admin Compatibility

No new admin editor is required.

The preview/admin flow should continue to work through public routes:

- main preview continues using `/site/:slug?preview=1&t=...`
- catalog preview should use `/site/:slug/catalog?preview=1&t=...`

Any `Ver catalogo` CTA rendered in preview mode must resolve to the preview-aware route, not the production-only route.

## Testing Strategy

Add or update frontend tests to cover:

- landing page shows the catalog CTA when catalog/cart/orders is active
- landing page no longer renders the full inline catalog/cart
- `/site/:slug/catalog` loads the dedicated catalog page
- back button returns to `/site/:slug`
- cart trigger renders with badge
- badge updates when items are added
- cart panel opens and closes
- order can be finalized through the dedicated cart UI
- localStorage cart behavior remains scoped by slug
- tenant without catalog modules shows the friendly unavailable state
- tenant with no products shows the friendly empty state

Build verification should confirm the new route does not break the existing public route or preview route.

## Implementation Notes

- Prefer `/site/:slug/catalog` over `/catalog/:slug` because it fits the existing public routing structure and preview logic.
- Keep the existing public payload and order endpoints unchanged unless an implementation bug forces a narrowly scoped backend adjustment.
- Avoid changing panel or auth code while implementing this feature.
