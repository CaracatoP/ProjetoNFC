# Public Catalog Route Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `/site/:slug` as a clean public landing page and move the catalog/cart checkout flow into a dedicated `/site/:slug/catalog` route without duplicating cart logic.

**Architecture:** Reuse the existing public tenant payload and `BusinessCatalogSection` as the single source of truth for product grouping, cart state, quantity rules, and order submission. Introduce a dedicated catalog page and route, remove inline catalog rendering from the landing page, and add a preview-aware CTA that links the two experiences.

**Tech Stack:** React, React Router, Vitest, Testing Library, existing public-site services/hooks/components.

---

### Task 1: Add the dedicated public catalog route

**Files:**
- Create: `frontend/src/pages/public/PublicCatalogPage.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/pages/public/PublicSitePage.test.jsx`

- [ ] **Step 1: Write the failing route test**

Add a test that mounts both `/site/:slug` and `/site/:slug/catalog` routes and expects the catalog route to render a dedicated heading or back action that does not exist yet.

- [ ] **Step 2: Run the focused test to confirm the route fails**

Run: `npm --prefix frontend run test -- src/pages/public/PublicSitePage.test.jsx`
Expected: FAIL because `/site/:slug/catalog` has no route/component yet.

- [ ] **Step 3: Add the new route and page**

Create `frontend/src/pages/public/PublicCatalogPage.jsx` using the same `useBusinessSite`, tenant theme, order submission, and analytics hooks already used by `PublicSitePage`. Add the new route in `frontend/src/App.jsx` as `/site/:slug/catalog`.

- [ ] **Step 4: Re-run the focused test**

Run: `npm --prefix frontend run test -- src/pages/public/PublicSitePage.test.jsx`
Expected: PASS for the new route test.

### Task 2: Remove inline catalog from landing and add the catalog CTA

**Files:**
- Modify: `frontend/src/pages/public/PublicSitePage.jsx`
- Modify: `frontend/src/components/business/SectionRenderer.jsx` only if needed for CTA handling
- Test: `frontend/src/pages/public/PublicSitePage.test.jsx`

- [ ] **Step 1: Write the failing landing-page behavior tests**

Add tests that assert:
- `/site/:slug` shows `Ver catalogo` or `Fazer pedido` when `catalog/cart/orders` is active
- `/site/:slug` no longer renders the full inline catalog/cart checkout
- preview mode preserves `preview=1&t=...` in the CTA target

- [ ] **Step 2: Run the focused test to confirm behavior fails**

Run: `npm --prefix frontend run test -- src/pages/public/PublicSitePage.test.jsx`
Expected: FAIL because the landing page still renders the catalog inline and has no dedicated CTA.

- [ ] **Step 3: Implement the landing-page separation**

Update `PublicSitePage.jsx` to stop rendering `BusinessCatalogSection` inline, keep the rest of the landing intact, and inject a preview-aware CTA to `/site/:slug/catalog`. Reuse existing quick-access patterns instead of creating a new admin/editor surface.

- [ ] **Step 4: Re-run the focused test**

Run: `npm --prefix frontend run test -- src/pages/public/PublicSitePage.test.jsx`
Expected: PASS for the landing CTA and no-inline-catalog assertions.

### Task 3: Refactor the catalog component for dedicated-page mode with fixed cart

**Files:**
- Modify: `frontend/src/components/business/BusinessCatalogSection.jsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/components/business/BusinessCatalogSection.test.jsx`

- [ ] **Step 1: Write the failing dedicated-cart tests**

Add tests that assert:
- the dedicated catalog page renders a fixed cart trigger with badge
- opening and closing the cart works
- badge updates when adding an item
- order submission still uses the same localStorage/cart logic
- inactive catalog and empty product states are rendered cleanly

- [ ] **Step 2: Run the focused component test to confirm failure**

Run: `npm --prefix frontend run test -- src/components/business/BusinessCatalogSection.test.jsx`
Expected: FAIL because the component still renders the full checkout inline and has no fixed cart UI.

- [ ] **Step 3: Refactor `BusinessCatalogSection` minimally**

Keep all existing cart math, measurement-unit rules, fractional quantity behavior, and order payload generation in the same component. Move checkout rendering into a dedicated cart panel/drawer and expose a fixed trigger with badge for dedicated-page mode.

- [ ] **Step 4: Add responsive styling**

Update `frontend/src/styles/global.css` for:
- compact catalog header spacing
- fixed cart trigger positioning on desktop
- responsive drawer/modal treatment on mobile

- [ ] **Step 5: Re-run the focused component test**

Run: `npm --prefix frontend run test -- src/components/business/BusinessCatalogSection.test.jsx`
Expected: PASS for cart trigger, open/close, badge, and checkout flow assertions.

### Task 4: Polish dedicated catalog UX and validate compatibility

**Files:**
- Modify: `frontend/src/pages/public/PublicCatalogPage.jsx`
- Modify: `frontend/src/pages/public/PublicSitePage.test.jsx`
- Modify: `frontend/src/components/business/BusinessCatalogSection.test.jsx`
- Modify: `frontend/src/pages/dashboard/DashboardHomePage.jsx` only if a preview link tweak is actually required

- [ ] **Step 1: Add failing tests for dedicated-page states**

Cover:
- back button returns to `/site/:slug`
- tenant without catalog modules shows `Catalogo indisponivel no momento`
- tenant with no products shows `Nenhum produto cadastrado ainda`
- preview catalog route keeps `preview=1&t=...`

- [ ] **Step 2: Run the focused public-page tests**

Run: `npm --prefix frontend run test -- src/pages/public/PublicSitePage.test.jsx src/components/business/BusinessCatalogSection.test.jsx`
Expected: FAIL until the dedicated page states and navigation are implemented.

- [ ] **Step 3: Implement the remaining UX states and preview-safe navigation**

Finish `PublicCatalogPage.jsx` with:
- compact business header
- back button
- friendly unavailable/empty states
- consistent public-site theming

Only touch `DashboardHomePage.jsx` if preview navigation needs an explicit helper or link update for the catalog route.

- [ ] **Step 4: Re-run the focused public-page tests**

Run: `npm --prefix frontend run test -- src/pages/public/PublicSitePage.test.jsx src/components/business/BusinessCatalogSection.test.jsx`
Expected: PASS.

### Task 5: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run the relevant frontend suite**

Run: `npm --prefix frontend run test -- src/pages/public/PublicSitePage.test.jsx src/components/business/BusinessCatalogSection.test.jsx`
Expected: PASS

- [ ] **Step 2: Run the full frontend suite**

Run: `npm --prefix frontend run test`
Expected: PASS

- [ ] **Step 3: Run the frontend production build**

Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 4: Prepare manual validation notes**

Document how to validate on the açougue tenant:
- open `/site/:slug`
- confirm CTA and clean landing
- open `/site/:slug/catalog`
- add weighted and unit products
- open cart drawer
- submit order
- verify preview route still works
