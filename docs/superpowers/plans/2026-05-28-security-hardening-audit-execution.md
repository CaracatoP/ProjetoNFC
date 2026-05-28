## TapLink Security Hardening Execution

Date: 2026-05-28

### Scope

Implement the approved hardening work in small, low-risk phases without breaking:

- unified auth
- legacy `/api/admin/auth/*`
- admin dashboard
- client panel
- tenant public pages
- multi-tenant scoping

### Phase 1 — Critical Hardening Without UX Changes

Goals:

- remove legacy admin authorization drift where routes still depend on `roles[]`
- validate resource identifiers as real MongoDB ObjectIds where applicable
- escape admin search regex input before constructing Mongo filters
- strengthen tests around privilege escalation and cross-tenant safety

Planned changes:

1. Replace `requireAdminRole` route gating with `roleLevel`-based authorization.
2. Tighten admin/client/module validators to reject invalid ObjectId-like strings early.
3. Escape user-provided admin search text before building regex filters.
4. Add regression tests for:
   - level 1 restrictions on sensitive actions
   - level 5 mutation denial
   - cross-tenant access denial
   - invalid ids rejected with validation errors

### Phase 2 — Upload, Rate Limit, Headers, CORS

Goals:

- reduce attack surface on uploads and public write endpoints
- keep existing upload UX intact

Planned changes:

1. Remove SVG from accepted upload MIME types unless a safe sanitization path is introduced.
2. Add dedicated rate limiters for:
   - public orders
   - public appointment requests
   - public analytics events
3. Review explicit Helmet and CORS settings for production-safe defaults.

### Phase 3 — Backend Performance

Goals:

- reduce payload and query cost in admin-heavy flows

Planned changes:

1. Add projections to oversized admin list and editor fetches.
2. Review analytics/dashboard query shapes for waste and N+1 patterns.
3. Add only justified missing indexes, starting with `subscriptions.status`.

### Phase 4 — Frontend Performance

Goals:

- reduce cost of dashboard and panel boot

Planned changes:

1. Split large dashboard/editor/client-panel chunks further where helpful.
2. Reduce eager admin fetches and review repeated reload paths.
3. Revisit large CSS and heavy sections loaded by default.

### Phase 5 — Safe Legacy Cleanup

Goals:

- remove only dead or clearly superseded code with evidence

Candidates:

- `backend/src/middlewares/resolveTenant.js`
- `backend/src/middlewares/requireAdminRole.js`
- legacy auth wrappers in `frontend/src/services/authService.js`

Rule:

- verify imports, runtime registration, and tests before removal
- if uncertain, mark deprecated and keep compatibility

### Phase 6 — Final Verification

Required checks:

- targeted backend/frontend tests per phase
- full backend test suite
- full frontend test suite
- frontend production build
- post-change audit recheck where relevant
