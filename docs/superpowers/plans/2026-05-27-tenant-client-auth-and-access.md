# Tenant Client Auth And Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unified user authentication, role-based access control, tenant-scoped client access, business-level plan and billing enforcement, and a limited client panel without breaking the current admin login, dashboard, or bootstrap flow.

**Architecture:** Keep a single `User` model, make `roleLevel` canonical, preserve the current admin auth flow as a compatibility layer, and resolve plan, billing, module, and analytics capability from `businessId` plus `Subscription` at request time. Centralize authorization in shared access helpers so backend and frontend hide and block the same actions, with backend remaining the final source of truth.

**Tech Stack:** Node.js, Express, MongoDB/Mongoose, React, React Router, JWT, bcryptjs, Vitest, existing TapLink admin/auth/billing infrastructure.

---

## File Structure Map

### Shared

- Modify: `shared/constants/admin.js`
  - Extend status and role primitives if needed for `roleLevel` compatibility helpers.
- Modify: `shared/constants/plans.js`
  - Add commercial plan variants and plan capability metadata references.
- Create: `shared/constants/access.js`
  - Canonical role levels, billing states, analytics scopes, and UI label helpers.
- Create: `shared/utils/access.js`
  - Pure helpers for permission resolution and analytics scope decisions.

### Backend auth and access

- Modify: `backend/src/models/User.js`
  - Add `roleLevel`, `businessId`, `active`, and compatibility-safe defaults.
- Modify: `backend/src/repositories/userRepository.js`
  - Add list/find/update helpers for scoped user and client management.
- Modify: `backend/src/services/systemBootstrapService.js`
  - Guarantee bootstrap admin becomes or remains `roleLevel: 0`.
- Modify: `backend/src/services/adminAuthService.js`
  - Delegate to unified session auth while preserving admin route behavior.
- Modify: `backend/src/utils/adminAuth.js`
  - Extend token payload compatibility safely.
- Modify: `backend/src/middlewares/requireAdminAuth.js`
  - Keep legacy semantics while accepting canonical `roleLevel`.
- Create: `backend/src/services/sessionAuthService.js`
  - Unified login, me, logout, session resolution, and access-state resolution.
- Create: `backend/src/utils/sessionAccess.js`
  - Backend-side business-context access helpers and privilege-escalation guards.
- Create: `backend/src/middlewares/requireSessionAuth.js`
  - JWT auth for unified panel access.
- Create: `backend/src/middlewares/requireRoleLevel.js`
  - Role-level gate for routes.
- Create: `backend/src/middlewares/requireBusinessScope.js`
  - Tenant ownership enforcement for client users.
- Create: `backend/src/middlewares/requireBillingAccess.js`
  - Allow `overdue` read access but block critical mutations; deny `suspended/cancelled`.

### Backend routes, controllers, validators

- Create: `backend/src/controllers/sessionAuthController.js`
- Create: `backend/src/routes/authRoutes.js`
- Create: `backend/src/validators/sessionAuthValidators.js`
- Create: `backend/src/controllers/adminClientController.js`
- Create: `backend/src/routes/adminClientRoutes.js`
- Create: `backend/src/validators/adminClientValidators.js`
- Modify: `backend/src/routes/index.js`
  - Mount unified auth and client management routes.
- Modify: `backend/src/routes/adminAuthRoutes.js`
  - Keep compatibility behavior untouched while delegating internally.

### Backend business and billing resolution

- Modify: `backend/src/models/Plan.js`
  - Support `premium` and optional capability metadata if needed.
- Modify: `backend/src/models/Subscription.js`
  - Normalize business-level billing states for client access.
- Modify: `backend/src/repositories/billingRepository.js`
  - Add fetch helpers that resolve plan + subscription by `businessId`.
- Modify: `backend/src/services/billingService.js`
  - Seed commercial plans and map billing status semantics.

### Frontend auth and routing

- Modify: `frontend/src/services/authService.js`
  - Add unified `/api/auth/*` calls and keep admin compatibility helpers.
- Modify: `frontend/src/context/AuthContext.jsx`
  - Resolve unified session shape with `roleLevel`, `businessId`, plan, billing, modules, and analytics scope.
- Modify: `frontend/src/components/layout/RootRedirect.jsx`
  - Redirect by `roleLevel` instead of binary admin/guest.
- Modify: `frontend/src/components/layout/RequireAuth.jsx`
  - Support unified authenticated access and suspended state handling.
- Create: `frontend/src/components/layout/RequireRoleAccess.jsx`
  - Route guard for panel sections.
- Create: `frontend/src/components/auth/SuspendedAccessState.jsx`
  - Dedicated screen for `suspended/cancelled`.
- Create: `frontend/src/components/auth/BillingAccessBanner.jsx`
  - Banner for `overdue`.
- Modify: `frontend/src/App.jsx`
  - Add client panel routes and keep current admin routes intact.
- Modify: `frontend/src/pages/auth/AuthLandingPage.jsx`
  - Reframe login as general panel access without losing admin UX.

### Frontend admin and client experiences

- Modify: `frontend/src/pages/dashboard/DashboardHomePage.jsx`
  - Keep current admin workspace but gate sections by `roleLevel`.
- Create: `frontend/src/components/clients/AdminClientsSection.jsx`
  - Level-0 full client management and level-1 limited client management.
- Extend or create: `frontend/src/services/adminService.js`
  - Add client management endpoints.
- Create: `frontend/src/pages/client/ClientPanelPage.jsx`
  - Limited tenant panel for levels `2-5`.
- Create: `frontend/src/components/client/ClientPanelShell.jsx`
  - Shared layout for client-only access.
- Create: `frontend/src/components/client/ClientOverviewSection.jsx`
  - Basic tenant summary and billing/plan visibility.
- Reuse/modify current module components
  - Apply permission gates to catalog, orders, appointments, services, professionals, analytics, and tenant basics editing.

### Tests

- Create: `backend/src/routes/authRoutes.test.js`
- Create: `backend/src/routes/adminClientRoutes.test.js`
- Modify: `backend/src/routes/adminRoutes.test.js`
  - Preserve current admin auth compatibility coverage.
- Modify or create: `frontend/src/context/AuthContext.test.jsx`
- Modify: `frontend/src/pages/auth/AuthLandingPage.test.jsx`
- Modify: `frontend/src/components/layout/RootRedirect.test.jsx`
- Create: `frontend/src/pages/client/ClientPanelPage.test.jsx`
- Modify: `frontend/src/pages/dashboard/DashboardHomePage.test.jsx`

---

## Phase 1: Expand User + Safe Level-0 Bootstrap

**Files:**
- Modify: `backend/src/models/User.js`
- Modify: `backend/src/repositories/userRepository.js`
- Modify: `backend/src/services/systemBootstrapService.js`
- Test: `backend/src/routes/adminRoutes.test.js`

- [ ] Add failing backend tests that prove the bootstrap admin remains accessible and is normalized to `roleLevel: 0`.
- [ ] Expand the `User` model with `roleLevel`, optional `businessId`, and `active` while keeping `roles` legacy-compatible.
- [ ] Update bootstrap logic so an existing admin user is migrated safely to `roleLevel: 0` without losing the current login.
- [ ] Verify that no public or admin route can create `roleLevel: 0` through normal payloads.
- [ ] Re-run admin auth compatibility tests before moving on.

**Compatibility guardrails:**
- Keep `roles` until the end of the rollout.
- Never remove `requireAdminAuth` in this phase.
- Bootstrap remains the rollback path if migration logic misbehaves.

## Phase 2: Centralized Permission Helpers

**Files:**
- Create: `shared/constants/access.js`
- Create: `shared/utils/access.js`
- Create: `backend/src/utils/sessionAccess.js`
- Modify: `shared/constants/plans.js`
- Modify: `backend/src/services/billingService.js`
- Test: backend and frontend permission-focused suites

- [ ] Introduce canonical access constants for `roleLevel`, billing states, analytics scopes, and label maps.
- [ ] Implement pure access helpers that combine `roleLevel`, `billingStatus`, plan capability, modules, and tenant ownership.
- [ ] Add `resolveAnalyticsScope(user, businessContext)` returning `none`, `summary`, `basic`, `advanced`, or `full`.
- [ ] Add helper families for business ownership, analytics, tenant basics, operational settings, sensitive settings, catalog, services, professionals, orders, and appointments.
- [ ] Add tests covering privilege escalation attempts, overdue write limits, suspended access denial, and cross-tenant access denial.

**Privilege-escalation controls to lock here:**
- Actor cannot raise their own level.
- Actor cannot create or update a user above their allowed ceiling.
- Actor cannot move a user to another tenant outside allowed scope.

## Phase 3: Introduce Unified Auth Without Breaking `/api/admin/auth/*`

**Files:**
- Create: `backend/src/services/sessionAuthService.js`
- Create: `backend/src/controllers/sessionAuthController.js`
- Create: `backend/src/routes/authRoutes.js`
- Create: `backend/src/validators/sessionAuthValidators.js`
- Modify: `backend/src/services/adminAuthService.js`
- Modify: `backend/src/utils/adminAuth.js`
- Modify: `backend/src/middlewares/requireAdminAuth.js`
- Modify: `backend/src/routes/adminAuthRoutes.js`
- Modify: `backend/src/routes/index.js`
- Test: `backend/src/routes/authRoutes.test.js`, `backend/src/routes/adminRoutes.test.js`

- [ ] Add failing tests for `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout`.
- [ ] Implement unified session login that resolves user identity, password hash, active state, business subscription context, modules, billing state, and analytics scope.
- [ ] Preserve `/api/admin/auth/login`, `/api/admin/auth/session`, and `/api/admin/auth/logout` as compatibility routes that still work for levels `0-1`.
- [ ] Extend the token payload minimally with `roleLevel` and `businessId`, without forcing the legacy dashboard to change immediately.
- [ ] Ensure `/api/auth/me` returns denormalized session data for frontend routing and permission UI.
- [ ] Re-run current admin login tests to prove no regression.

**Rollback notes:**
- If unified auth fails, admin can still authenticate through the bootstrap-corrected level-0 account and the preserved `/api/admin/auth/*` routes.

## Phase 4: Create Client Endpoints

**Files:**
- Create: `backend/src/controllers/adminClientController.js`
- Create: `backend/src/routes/adminClientRoutes.js`
- Create: `backend/src/validators/adminClientValidators.js`
- Modify: `backend/src/repositories/userRepository.js`
- Modify: `backend/src/repositories/billingRepository.js`
- Modify: `backend/src/routes/index.js`
- Test: `backend/src/routes/adminClientRoutes.test.js`

- [ ] Add failing tests for list, create, read, update, password reset, block/unblock, plan update, billing update, and access-level update.
- [ ] Implement `clients` as `User` records with `roleLevel >= 2`, plus a limited operational path for level `1`.
- [ ] Enforce that only level `0` can create level `1`, change plan, or change billing.
- [ ] Enforce that level `1` can create and manage only levels `2-5`.
- [ ] Resolve plan and billing from `businessId` on client management responses instead of storing them in `User`.
- [ ] Add query filters by name, email, tenant, plan, billing, and level.

**Security gates to prove here:**
- Level `1` cannot touch `0` or `1`.
- Level `1` cannot mutate plan or billing routes.
- Level `2-5` cannot reach admin client routes at all.

## Phase 5: Create Limited Client Panel

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/services/authService.js`
- Modify: `frontend/src/components/layout/RootRedirect.jsx`
- Modify: `frontend/src/components/layout/RequireAuth.jsx`
- Create: `frontend/src/components/layout/RequireRoleAccess.jsx`
- Create: `frontend/src/pages/client/ClientPanelPage.jsx`
- Create: `frontend/src/components/client/ClientPanelShell.jsx`
- Create: `frontend/src/components/auth/SuspendedAccessState.jsx`
- Create: `frontend/src/components/auth/BillingAccessBanner.jsx`
- Test: `frontend/src/context/AuthContext.test.jsx`, `frontend/src/pages/client/ClientPanelPage.test.jsx`

- [ ] Add failing frontend tests for login redirect by `roleLevel`, suspended access screen, overdue banner, and client panel route gating.
- [ ] Evolve the current auth context into a unified session context that preserves current admin behavior while supporting client access.
- [ ] Route levels `0-1` to `/dashboard` and levels `2-5` to `/panel`.
- [ ] Render dedicated blocked access for `suspended/cancelled`.
- [ ] Render overdue banner plus disabled critical actions for `overdue`.
- [ ] Expose resolved session capability flags to downstream client/admin components.

## Phase 6: Create Admin “Clientes” Area

**Files:**
- Create: `frontend/src/components/clients/AdminClientsSection.jsx`
- Modify: `frontend/src/pages/dashboard/DashboardHomePage.jsx`
- Modify: `frontend/src/services/adminService.js`
- Test: `frontend/src/pages/dashboard/DashboardHomePage.test.jsx`

- [ ] Add failing tests for level-0 client management visibility and level-1 limited client management visibility.
- [ ] Add a `Clientes` section to the admin dashboard without breaking the current tenant workspace flow.
- [ ] Support search, filters, create, edit, reset password, and block/unblock in the UI.
- [ ] Show plan, billing, tenant, and role badges resolved from backend responses.
- [ ] Hide or disable plan/billing and level-1 creation controls for level `1`.
- [ ] Keep all sensitive write attempts backend-protected even if a button is hidden correctly in the UI.

## Phase 7: Apply Billing/Status Blocks

**Files:**
- Modify: `backend/src/middlewares/requireBillingAccess.js`
- Modify: relevant backend business/module routes to use the billing gate
- Modify: `frontend/src/pages/client/ClientPanelPage.jsx`
- Modify: client-facing action components reused in the panel
- Test: backend auth/client route suites, frontend client panel suite

- [ ] Add failing tests for overdue read-allowed/write-blocked behavior.
- [ ] Add failing tests for suspended and cancelled blocked access.
- [ ] Apply backend billing/status middleware to critical client mutations.
- [ ] Apply frontend visual gating so overdue users see the panel but lose critical action affordances.
- [ ] Ensure passive operational intake still works where intended, such as viewing incoming orders/agendamentos.

**Critical-action block list to enforce:**
- tenant basics editing in blocked states
- uploads
- mass catalog changes
- sensitive or operational configuration changes beyond read-only access

## Phase 8: Backend And Frontend Permission Tests

**Files:**
- Create/modify all auth and panel test files listed above

- [ ] Add backend coverage for valid/invalid login, password hashing, bootstrap migration, access ceilings, cross-tenant denial, billing restrictions, and privilege-escalation attempts.
- [ ] Add frontend coverage for login, redirect, visibility of controls by level, suspended screen, overdue banner, analytics visibility, and non-editable level-5 behavior.
- [ ] Re-run current admin regression suites to confirm the legacy dashboard still works.

**Minimum backend permission matrix to cover:**
- Level `0` full access
- Level `1` user-ops only for `2-5`
- Level `2` full allowed tenant operations except sensitive/billing
- Level `3` operational mid-tier
- Level `4` status-only operations
- Level `5` read-only

## Phase 9: Final Build And Validation

**Files:**
- No new product files expected; run verification and document findings.

- [ ] Run targeted backend auth/client suites.
- [ ] Run targeted frontend auth/client/admin suites.
- [ ] Run full backend suite.
- [ ] Run full frontend suite.
- [ ] Run frontend production build.
- [ ] Perform manual validation in a real browser for each role bucket and billing scenario.

**Expected verification commands:**

```bash
npm --prefix backend run test -- src/routes/authRoutes.test.js src/routes/adminClientRoutes.test.js src/routes/adminRoutes.test.js
npm --prefix frontend run test -- src/pages/auth/AuthLandingPage.test.jsx src/components/layout/RootRedirect.test.jsx src/pages/client/ClientPanelPage.test.jsx src/pages/dashboard/DashboardHomePage.test.jsx
npm --prefix backend run test
npm --prefix frontend run test
npm --prefix frontend run build
```

---

## Migration Strategy Summary

- Compatibility first: preserve `requireAdminAuth`, `/api/admin/auth/*`, and bootstrap admin login.
- Canonical source shift: introduce `roleLevel` without removing `roles` immediately.
- Auth rollout: add `/api/auth/*` before changing frontend routing.
- UI rollout: route new client users to `/panel` while current admin users continue to use `/dashboard`.
- Capability rollout: compute plan, billing, modules, and analytics from `businessId` and `Subscription`, never from `User`.

## Login Risk Summary

- Highest-risk area: breaking the current bootstrap admin login.
- Primary mitigation: preserve admin routes and `requireAdminAuth` while adding unified auth in parallel.
- Secondary mitigation: bootstrap env path remains able to recreate or correct the level-0 account.
- Validation gate: current admin login tests must pass after Phases 1 and 3 before moving forward.

## Rollback Summary

- If role migration fails, keep using legacy `roles` plus bootstrap-corrected user record.
- If unified auth fails, revert frontend to current `/api/admin/auth/*` usage while fixing `/api/auth/*`.
- If client panel rollout fails, keep `/dashboard` intact and disable `/panel` route exposure temporarily.

## Manual Validation Checklist

- Level `0` login still reaches current dashboard and can access everything.
- Level `1` can manage only users `2-5`, but cannot alter plan, billing, level `0`, or level `1`.
- Level `2` can access only its own tenant and sees plan and billing read-only.
- Level `3` can operate orders/agendamentos and allowed operational content only.
- Level `4` can update status only.
- Level `5` can read only.
- Overdue user sees banner, can log in, but cannot perform critical writes.
- Suspended user sees dedicated blocked screen.
- Manual request tampering with another `businessId` returns `403`.

