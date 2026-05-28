# Tenant Live Refresh and Order Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admin, client panel, public page, preview, and order/appointment inboxes reflect the newest persisted tenant state automatically, without manual F5.

**Architecture:** Reuse the existing tenant SSE channel as a lightweight invalidation signal, enrich it with `kind`, and refetch authoritative data after each relevant event. Keep public cache, but make it explicitly invalidatable. Add only light session polling in `AuthContext` for role/plan/billing/business changes.

**Tech Stack:** Node.js, Express, MongoDB/Mongoose, React, Vite, SSE (`EventSource`), existing local cache helpers and service-layer fetch/mutation functions.

---

### Task 1: Publish `tenant_updated` with `kind` from all visible backend mutations

**Files:**
- Modify: [backend/src/services/tenantRealtimeService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/tenantRealtimeService.js)
- Modify: [backend/src/services/moduleService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/moduleService.js)
- Modify: [backend/src/services/adminBusinessService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/adminBusinessService.js)
- Modify: [backend/src/services/adminClientService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/adminClientService.js)
- Test: [backend/src/routes/adminRoutes.test.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/routes/adminRoutes.test.js)
- Test: [backend/src/routes/publicRoutes.test.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/routes/publicRoutes.test.js)
- Test: [backend/src/routes/clientPanelRoutes.test.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/routes/clientPanelRoutes.test.js)

- [ ] Extend realtime payload builder to include `kind`, defaulting to a safe fallback such as `tenant_updated`.
- [ ] Publish `tenant_updated` with specific `kind` from:
  - tenant create/update/status/delete
  - product create/update/delete
  - professional create/update/delete
  - appointment service create/update/delete
  - public order create
  - order status update
  - public appointment request create
  - appointment status update
  - billing update
  - plan update
- [ ] Keep SSE payload minimal: `businessId`, `slug`, `kind`, `status`, `publicUrl`, `domains`, `previousSlug`, `previousDomains`, `emittedAt`.
- [ ] Confirm no sensitive data is added to the event payload.
- [ ] Run focused backend tests for public orders/appointments and admin/client mutations.

**Verification:**
- Run: `npm --prefix backend run test -- src/routes/publicRoutes.test.js src/routes/adminRoutes.test.js src/routes/clientPanelRoutes.test.js`
- Expected: all targeted tests pass and event assertions match the new `kind` payload.

### Task 2: Invalidate public cache and refetch authoritatively on SSE

**Files:**
- Modify: [frontend/src/services/publicSiteService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/services/publicSiteService.js)
- Modify: [frontend/src/hooks/useBusinessSite.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/hooks/useBusinessSite.js)
- Modify: [frontend/src/pages/public/PublicSitePage.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/public/PublicSitePage.jsx)
- Test: [frontend/src/services/publicSiteService.test.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/services/publicSiteService.test.js)
- Test: [frontend/src/pages/public/PublicSitePage.test.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/public/PublicSitePage.test.jsx)

- [ ] Add an explicit invalidation helper to the public site cache service so the page can evict cache entries by slug/host when a realtime event arrives.
- [ ] On `tenant_updated`, invalidate cached public-site entries before calling `reload`.
- [ ] Ensure event-driven refetch always uses:
  - `bypassCache: true`
  - `cacheBust: Date.now()`
- [ ] Preserve normal short cache behavior for passive browsing when no event occurs.
- [ ] Confirm POST success for public order/appointment still depends on real backend confirmation before showing success in the public UI.

**Verification:**
- Run: `npm --prefix frontend run test -- src/services/publicSiteService.test.js src/pages/public/PublicSitePage.test.jsx`
- Expected: tests prove cache invalidation on SSE, no stale payload reuse after event, and no duplicate order behavior.

### Task 3: Refresh admin dashboard state from SSE for the selected tenant

**Files:**
- Modify: [frontend/src/pages/dashboard/DashboardHomePage.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/dashboard/DashboardHomePage.jsx)
- Test: [frontend/src/pages/dashboard/DashboardHomePage.test.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/dashboard/DashboardHomePage.test.jsx)

- [ ] Subscribe to tenant realtime updates for the currently selected tenant only.
- [ ] On relevant `kind`, refetch:
  - editor snapshot via `getAdminBusiness`
  - overview/list when counts, orders, appointments, billing, plan, or status can change
- [ ] Keep preview refresh aligned with real backend state by bumping preview refresh keys only after authoritative refetch completes.
- [ ] Ensure order and appointment inboxes update automatically when new public submissions arrive.
- [ ] Clean up the `EventSource` subscription on tenant switch and unmount.

**Verification:**
- Run: `npm --prefix frontend run test -- src/pages/dashboard/DashboardHomePage.test.jsx`
- Expected: dashboard test proves refetch on SSE, selected tenant scope only, and no reload loop.

### Task 4: Refresh client panel state from SSE for the authenticated tenant

**Files:**
- Modify: [frontend/src/pages/panel/ClientPanelPage.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/panel/ClientPanelPage.jsx)
- Test: [frontend/src/pages/panel/ClientPanelPage.test.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/panel/ClientPanelPage.test.jsx)

- [ ] Subscribe to SSE using the authenticated tenant `businessId`, with `slug` fallback when useful.
- [ ] On relevant `kind`, refetch:
  - business/editor snapshot
  - analytics when the event can affect metrics
- [ ] Keep existing local mutation flow backend-confirmed first, then refetch authoritative state.
- [ ] Make sure incoming public orders and appointments appear in the open client panel without manual refresh.
- [ ] Clean up the `EventSource` on unmount and on access changes.

**Verification:**
- Run: `npm --prefix frontend run test -- src/pages/panel/ClientPanelPage.test.jsx`
- Expected: panel test proves SSE-driven refetch and cleanup.

### Task 5: Add lightweight session refresh in `AuthContext`

**Files:**
- Modify: [frontend/src/context/AuthContext.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/context/AuthContext.jsx)
- Create or Modify: `frontend/src/context/AuthContext.test.jsx`

- [ ] Add a controlled session refresh timer for authenticated users only.
- [ ] Use an interval in the `60s-120s` range; prefer a single concrete value such as `90s`.
- [ ] Pause refresh while the tab is hidden, and resume when visibility returns.
- [ ] Ensure `refreshSession` updates `roleLevel`, `business`, `subscription`, `access`, and derived flags without triggering reload loops.
- [ ] Keep suspended/cancelled handling unchanged, but ensure those state changes propagate without manual F5.

**Verification:**
- Run: `npm --prefix frontend run test -- src/context/AuthContext.test.jsx src/components/layout/RequireAuth.test.jsx src/components/layout/RootRedirect.test.jsx`
- Expected: tests prove controlled refresh, hidden-tab pause, and no breakage to auth guards.

### Task 6: Regression and security coverage

**Files:**
- Modify tests only where needed:
  - [backend/src/routes/publicRoutes.test.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/routes/publicRoutes.test.js)
  - [backend/src/routes/adminRoutes.test.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/routes/adminRoutes.test.js)
  - [backend/src/routes/clientPanelRoutes.test.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/routes/clientPanelRoutes.test.js)
  - [frontend/src/pages/public/PublicSitePage.test.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/public/PublicSitePage.test.jsx)
  - [frontend/src/pages/dashboard/DashboardHomePage.test.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/dashboard/DashboardHomePage.test.jsx)
  - [frontend/src/pages/panel/ClientPanelPage.test.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/panel/ClientPanelPage.test.jsx)

- [ ] Add backend assertions for new `kind` values on:
  - public order creation
  - public appointment creation
  - admin/client status updates
  - billing/plan updates
- [ ] Add frontend assertions for:
  - cache invalidation after SSE
  - dashboard refetch after SSE
  - client panel refetch after SSE
  - EventSource cleanup on unmount
  - no cross-tenant listener leakage
- [ ] Keep tests focused on signals and refetch behavior, not full end-to-end browser orchestration.

**Verification:**
- Run: `npm --prefix frontend run test`
- Run: `npm --prefix backend run test`
- Expected: full suites pass with no auth, preview, or public-page regression.

### Task 7: Final build and manual QA guidance

**Files:**
- No required code changes beyond previous tasks

- [ ] Build the frontend to confirm lazy routes, SSE-related edits, and cache invalidation changes do not break production bundling.
- [ ] Record the exact list of `kind` events added.
- [ ] Prepare manual QA steps for:
  - admin changes reflected on public page
  - admin changes reflected on client panel
  - public order appearing in admin/client without F5
  - public appointment appearing in admin/client without F5
  - role/plan/billing changes reflected after session refresh

**Verification:**
- Run: `npm --prefix frontend run build`
- Expected: build succeeds and the final report includes manual validation guidance and any remaining risks.
