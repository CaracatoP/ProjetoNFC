# Tenant Live Refresh and Order Sync Design

Date: 2026-05-28

## Context

TapLink already persists tenant, client, module, order, and appointment changes correctly, but several surfaces keep showing stale data until a manual refresh:

- admin dashboard/editor
- client panel
- tenant public page
- order and appointment inboxes
- session-derived access state after admin-side changes

The current architecture already has three ingredients we can reuse:

- SSE endpoint at `/api/public/realtime/tenant`
- public-page cache with local in-memory TTL and HTTP cache headers
- explicit fetch/mutation services in admin and client panel

The inconsistency comes from gaps between persistence and invalidation:

- `tenant_updated` is not emitted for many visible mutations
- admin and client panel do not subscribe broadly enough to live tenant updates
- public page cache is invalidated only partially
- session changes such as role, billing, plan, and tenant binding depend on manual refresh

## Goals

- reflect saved changes automatically without requiring manual F5
- keep success feedback only after real backend persistence
- update order and appointment inboxes automatically after public submissions
- preserve current auth, billing, preview, duplication, and public-site behavior
- use SSE + refetch/invalidation as the primary mechanism
- keep session refresh lightweight and controlled

## Non-Goals

- no migration to React Query or SWR
- no new WebSocket stack
- no `window.location.reload()` as the primary fix
- no rewrite of auth, billing, or module architecture
- no removal of caching altogether

## Root Cause

### Backend

`tenant_updated` is currently emitted mainly for business-level mutations in `adminBusinessService`. Many mutations that visibly change tenant state do not emit any event:

- product CRUD
- professional CRUD
- appointment service CRUD
- public order creation
- order status updates
- public appointment request creation
- appointment status updates
- client plan and billing changes

That means open pages and panels have no signal to invalidate stale local state.

### Frontend

- `PublicSitePage` subscribes to SSE and refetches, but its cache invalidation path must be hardened so event-driven refetch always bypasses stale cached payload.
- `DashboardHomePage` does not subscribe to live tenant updates for the selected tenant, so new orders and appointments only appear after manual refresh.
- `ClientPanelPage` does not subscribe to SSE for its own tenant and does not refresh its own business snapshot when external changes happen.
- `AuthContext` only refreshes session on login/boot/manual call, so access changes like `roleLevel`, `businessId`, `plan`, or `billingStatus` can stay stale for long periods.

## Design

### 1. Backend event publishing

Keep `tenant_updated` as the SSE event name, but enrich the payload with a lightweight invalidation signal:

```json
{
  "operation": "updated",
  "kind": "order_created",
  "businessId": "...",
  "slug": "...",
  "previousSlug": "",
  "status": "active",
  "publicUrl": "...",
  "domains": {
    "subdomain": "",
    "customDomain": ""
  },
  "previousDomains": {
    "subdomain": "",
    "customDomain": ""
  },
  "emittedAt": "2026-05-28T12:00:00.000Z"
}
```

Add `kind` publication to all visible mutations:

- tenant create/update/status/delete/duplicate
- product create/update/delete
- professional create/update/delete
- appointment service create/update/delete
- public order create
- admin/client order status update
- public appointment request create
- admin/client appointment status update
- client plan update
- client billing update

Optional kinds for clarity:

- `tenant_updated`
- `tenant_status_updated`
- `product_created`
- `product_updated`
- `product_deleted`
- `professional_created`
- `professional_updated`
- `professional_deleted`
- `appointment_service_created`
- `appointment_service_updated`
- `appointment_service_deleted`
- `order_created`
- `order_status_updated`
- `appointment_created`
- `appointment_status_updated`
- `plan_updated`
- `billing_updated`

The event remains a signal only. No sensitive payload or full entity data will be streamed.

### 2. Public cache invalidation

Keep the public local cache and HTTP cache, but ensure they are invalidatable immediately on real tenant events.

Changes:

- add cache invalidation helpers to the public-site service by slug/host/business signal
- when SSE event arrives, clear affected cache entries before refetch
- event-driven refetch must always use:
  - `bypassCache: true`
  - `cacheBust: Date.now()`
- keep preview requests on `no-store`
- preserve normal cache for passive browsing when no event occurs

Result: public pages still benefit from short cache in normal reads, but live edits and order-related changes break through stale state immediately.

### 3. Admin dashboard live refresh

`DashboardHomePage` should subscribe to live updates for the selected tenant and react according to event kind:

- refetch selected editor snapshot after:
  - tenant changes
  - product/professional/service changes
  - order changes
  - appointment changes
- refetch overview when event affects metrics or operational counts:
  - order/appointment create or status update
  - tenant status/billing/plan changes

This keeps:

- order inbox current
- appointment inbox current
- module lists current
- preview refresh keys aligned with actual saved state

No aggressive polling is needed for admin tenant content.

### 4. Client panel live refresh

`ClientPanelPage` should subscribe to SSE for its own `businessId` and:

- refetch business snapshot after tenant/module/order/appointment changes
- refetch analytics after kinds that affect analytics or counts
- continue refetching after local mutations, but only after backend success

This ensures:

- product/service/professional edits from admin show up automatically in client panel
- public orders and appointments show up in the open client panel without F5
- local save flows stay backend-confirmed first, not optimistic-only

### 5. Session refresh

Use lightweight controlled polling only for session/access state, not for full panel data.

`AuthContext` should:

- call `refreshSession()` every 60-120 seconds when authenticated
- skip refresh when tab is hidden, if simple via `document.visibilityState`
- restart on visibility regain

This covers delayed propagation of:

- `roleLevel`
- `businessId`
- `plan`
- `billingStatus`
- capability changes derived from them

Billing-specific behavior remains unchanged:

- `overdue` may still log in with restrictions
- `suspended/cancelled` remains blocked in panel

### 6. Order flow specifics

When a public order is created successfully:

- backend saves order
- backend emits `tenant_updated` with `kind: order_created`
- public page keeps its own success feedback only after POST success
- admin dashboard refetches selected tenant snapshot/overview if listening to same tenant
- client panel refetches business/orders if listening to same tenant

No duplicate order should appear because UI updates will come from authoritative refetch, not from locally pushing duplicate items into inbox arrays.

The same pattern applies to public appointment requests.

## Security and scope

- SSE payload must remain scoped to target matching already enforced by `subscribeToTenantUpdates`
- no sensitive field values in event payload
- client panel only listens to its own tenant
- admin listens only to selected tenant
- EventSource must be cleaned on unmount
- no aggressive reconnect loops beyond EventSource default retry

## Testing

Add or adjust tests for:

- backend publishes event on:
  - public order create
  - public appointment request create
  - product/professional/service CRUD
  - order status update
  - appointment status update
  - billing/plan update
- `PublicSitePage` invalidates cache and refetches on SSE event
- `DashboardHomePage` refetches selected tenant data on SSE event
- `ClientPanelPage` refetches on SSE event
- `AuthContext` performs controlled refresh while authenticated
- EventSource cleanup on unmount
- cross-tenant listener matching stays scoped

## Manual validation

1. Open admin dashboard on a tenant.
2. Open client panel for the same tenant in another tab.
3. Open public page for the same tenant in a third tab.
4. Save tenant/config/catalog changes in admin.
5. Confirm client panel and public page update automatically.
6. Send a public order.
7. Confirm the order appears in admin and client panel without F5.
8. Send a public appointment request.
9. Confirm the appointment appears in admin and client panel without F5.
10. Change client billing/plan/role in admin.
11. Confirm the client session reflects it after controlled session refresh, without infinite reload.
