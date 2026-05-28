# Public Catalog Cart UX Hardening Design

## Context

The dedicated public catalog route at `/site/:slug/catalog` already works, but the cart shell feels improvised:

- the desktop panel looks misaligned
- the mobile drawer feels visually broken
- spacing and hierarchy are weak
- the cart button and badge do not feel commercial enough

The cart logic itself is already correct and must stay intact:

- localStorage by slug
- measurement-unit support
- fractional quantity handling
- subtotal and total calculations
- order submission
- cart cleanup after success

## Goal

Refine the public catalog cart into a polished commercial experience without changing backend behavior or cart logic.

## Non-Goals

- No backend changes
- No auth, billing, or client-panel changes
- No checkout/payment rewrite
- No cart logic rewrite
- No localStorage contract changes
- No order payload changes

## UX Direction

### Desktop

The cart opens as a centered modal with:

- soft backdrop
- controlled width
- sticky header
- scrollable body
- sticky footer with total and primary CTA

This replaces the current visually awkward floating panel.

### Mobile

The cart opens as a bottom sheet with:

- top-safe rounded sheet
- internal scrolling
- safe-area aware spacing
- sticky footer with total and CTA
- layout that remains usable when the keyboard opens

## Visual Structure

### Header

- cart icon
- `Seu pedido`
- item count
- clear close button

### Body

- improved empty state
- better-spaced item list
- product thumbnail when available
- product name and supporting quantity/unit text
- per-item subtotal with stronger emphasis
- aligned quantity editor and remove action
- checkout fields below the item list

### Footer

- subtotal/total summary
- strong `Finalizar pedido` button
- loading state kept, but visually improved

## Empty State

When there are no items, show:

- friendly icon block
- title `Seu carrinho esta vazio`
- short supporting copy
- CTA `Adicionar produtos` that closes the cart

## Cart Trigger

The fixed cart trigger remains the entry point, but gets:

- better spacing from viewport edges
- stronger shadow
- improved badge sizing and alignment
- clearer hover/focus/active states

Desktop keeps the trigger near the upper-right of the catalog page. Mobile keeps it as a floating action near the lower-right area.

## Technical Strategy

Keep `BusinessCatalogSection` as the single source of truth and only reshape its cart shell.

Changes stay focused on:

- cart modal markup grouping
- empty-state markup
- item row hierarchy markup
- responsive CSS for modal/sheet behavior
- overflow, z-index, and sticky region handling

No calculation, submission, or persistence logic should change.

## Testing

Update frontend tests to confirm:

- cart dialog still opens and closes
- empty state renders in the dedicated cart
- cart badge still updates
- checkout still submits through the cart shell
- fractional quantity flow still works
- cart remains usable with multiple items and internal scrolling hooks present in markup

Run frontend tests and a production build after the UI refactor.
