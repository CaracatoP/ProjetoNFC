# Public Site Performance Optimization Design

Date: 2026-05-26
Project: TapLink
Scope: Public tenant loading, media delivery, route-level caching, frontend bundle cost, and preview-safe performance tuning

## Goal

Improve real-world performance of the public tenant page without changing the functional flow, breaking public routes, or compromising the admin preview and editing experience.

The work must:

- reduce first-load latency for public tenant pages
- reduce image load cost and layout instability
- keep the premium black loading experience
- preserve compatibility with legacy tenants and the theme v2 system
- keep preview/admin able to force fresh data after save or manual refresh
- avoid introducing aggressive cache behavior into private or admin flows

## Current State

The public route is rendered by [PublicSitePage.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/public/PublicSitePage.jsx), which loads tenant data through [useBusinessSite.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/hooks/useBusinessSite.js) and [publicSiteService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/services/publicSiteService.js). The backend serves the public payload through [publicSiteService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/publicSiteService.js) and [publicSiteController.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/controllers/publicSiteController.js).

The main performance gaps today are:

- no frontend cache or deduplication for public tenant fetches
- the full app bundle is loaded eagerly from [App.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/App.jsx), so public traffic likely downloads admin code on first visit
- Cloudinary assets are rendered almost as raw URLs, without transformation-based optimization
- public images do not consistently declare the right loading priority or layout constraints
- the public backend payload is assembled from multiple queries with full document field sets instead of projection-oriented reads
- public API responses do not yet expose short-lived cache headers for normal public access

## Functional Scope

### In scope

- frontend in-memory cache for public tenant data with short TTL
- deduplication of concurrent public tenant requests
- explicit cache bypass for preview/admin refresh flows
- route-level code splitting so public users do not pay the cost of the admin bundle up front
- safe Cloudinary URL optimization for public media
- image loading priority and lazy loading improvements
- smaller backend public payload projections
- public-route-only cache headers
- lighter loading and skeleton behavior for the public route

### Out of scope

- no visual redesign of the public page beyond loading and perceived performance improvements
- no changes to upload storage format or Cloudinary upload flow
- no cache added to admin/private API routes
- no behavioral rewrite of analytics, CRUD, duplication, or tenant wizard flows
- no permanent long-lived offline cache strategy

## Non-Negotiable Constraints

- preview/admin must not get stuck on stale cache
- after saving tenant changes, preview must be able to fetch fresh data immediately
- public routes must continue working for legacy tenants and v2-themed tenants
- uploads and existing Cloudinary asset references must remain valid
- the preview iframe must remain functional
- private/admin data must not receive public cache behavior

## Diagnosis

### Frontend tenant loading

The current [useBusinessSite.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/hooks/useBusinessSite.js) performs a fresh fetch on every load and reload signal. It does not reuse recent results, does not deduplicate in-flight requests, and replaces the view with `loading` immediately even when a recently fetched payload could be shown optimistically.

### Frontend bundle cost

[App.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/App.jsx) imports dashboard, auth, and public pages eagerly. This means public traffic likely downloads dashboard/editor code on first access, which is especially wasteful for `site/:slug`.

### Media delivery

[resolveMediaUrl](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/utils/formatters.js) currently normalizes URLs but does not optimize Cloudinary delivery. Hero, services, and gallery sections render images directly, leaving image size and format selection mostly to the original asset URL.

### Backend payload assembly

[publicSiteService.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/publicSiteService.js) already uses `lean()` through repository calls, which is good. The remaining opportunity is to reduce document shape through field projection and to add indexes better aligned with public reads and sorted visible content.

## Proposed Architecture

### 1. Frontend cache model

Public tenant data will use a lightweight in-memory cache in the frontend service/hook layer.

Key rules:

- cache key is based on public slug or host
- default TTL is short, between `30s` and `60s`
- cache stores:
  - resolved payload
  - fetch timestamp
  - in-flight promise for deduplication
- concurrent requests for the same tenant reuse the same in-flight promise
- stale cached data may be shown immediately while a background refresh happens only when appropriate

This cache remains process-local and ephemeral. It is not persisted to localStorage, IndexedDB, or service worker storage.

### 2. Preview/admin bypass contract

Preview/admin freshness is a first-class requirement, not an afterthought.

Rules:

- preview iframe and admin-triggered preview refreshes must bypass the short frontend cache
- preview fetches must be treated as fresh-read requests
- after saving a tenant, the preview refresh path must request fresh data immediately
- normal public visitors keep the short cache behavior

The preferred contract is:

- preview iframe opens the same public route but with a preview signal such as `?preview=1`
- preview refreshes also append a cache-busting timestamp or unique token to the iframe URL when needed
- frontend public data fetching interprets preview mode as `bypassCache: true`
- backend public controller interprets preview mode as `Cache-Control: no-store`

This creates a clear split:

- normal public route: short cache allowed
- preview mode: fresh data required

### 3. Normal public route caching

For standard public tenant access, the backend route should return:

```http
Cache-Control: public, max-age=30, stale-while-revalidate=120
```

This applies only to the public tenant content route under normal public usage.

It must not apply to:

- admin routes
- authenticated/private flows
- preview mode requests
- SSE realtime endpoints

The backend should be explicit: preview requests receive `no-store`, while standard public requests receive the short-lived caching header.

### 4. Hook behavior

[useBusinessSite.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/hooks/useBusinessSite.js) will evolve from a simple fetch hook to a small cached resource hook.

Desired behavior:

- if no slug exists, do nothing
- if fresh cache exists and the request is not preview, return cached data immediately
- if the same slug is already being fetched, await the existing in-flight promise
- if cache is stale or bypass is requested, fetch fresh data
- while refreshing normal public content, preserve previous content when possible to reduce flicker
- do not keep stale content in preview mode after an explicit refresh

The hook must avoid unnecessary rerenders by preserving object identity whenever data is unchanged and by not resetting state to empty when an existing cached payload can remain visible.

## Code Splitting Design

[App.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/App.jsx) will be changed to lazy-load major route pages:

- [PublicSitePage.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/public/PublicSitePage.jsx)
- [AuthLandingPage.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/auth/AuthLandingPage.jsx)
- [DashboardHomePage.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/dashboard/DashboardHomePage.jsx)

This reduces the amount of JavaScript required for the public route and lowers the cost of the first tenant visit.

The route fallback must preserve the existing premium dark loading baseline and avoid a white flash.

## Cloudinary Optimization Design

### Transformation strategy

Cloudinary URLs will be optimized at delivery time, not by changing uploads.

When the source URL is a Cloudinary delivery URL, the frontend should inject safe transformations such as:

- `f_auto`
- `q_auto`
- `dpr_auto`
- width appropriate to the render context
- fit/fill mode appropriate to the visual slot

This should happen through shared media URL helpers in the frontend, not per-component string concatenation.

### Context-specific image policies

Hero logo:

- small width
- crisp display
- no lazy loading when above the fold

Hero banner:

- high priority
- width capped to the visible hero context
- no original-size delivery
- `fetchpriority="high"`

Service cards:

- medium width
- lazy loaded when below the fold
- preserve aspect ratio

Gallery:

- active image optimized for the visible frame
- later images may remain lazy

SEO/favicon-like images:

- keep compatibility
- avoid over-transforming where browser behavior expects the original asset type

### Layout stability

Where images are rendered, components should provide predictable layout through:

- width/height when practical
- CSS `aspect-ratio` for framed media slots
- stable containers for hero, services, and gallery

The goal is to reduce layout shift without changing the page design.

## Public Page Rendering Design

### Prioritization

The public route should prioritize:

1. core textual shell
2. theme application
3. hero content
4. essential actions
5. secondary media and lower-page content

This means:

- the loading layer appears immediately
- hero and critical content render first
- lower-priority images remain lazy
- non-critical heavy work is moved out of render or deferred

### Render hygiene

The public page and its subsections should avoid avoidable work inside render paths:

- no repeated expensive URL normalization inside deep loops if normalization can be done once upstream
- no repeated derived computation that can be memoized or normalized earlier
- no imports of unrelated admin logic into the public route path

## Backend/API Design

### Query shape

The public backend service currently issues parallel reads for:

- business
- theme
- sections
- links

That structure is acceptable, but each query should read only the fields needed for public rendering.

Repository-level projections should be introduced where useful, especially for:

- business fields
- theme fields
- section fields
- link fields

### Query behavior

Required rules:

- continue using `lean()`
- keep visible-only filters
- keep stable order for sections and links
- avoid extra reads that can be derived from already loaded business data

### Indexes

Current `slug` and domain indexes already exist on [Business.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/models/Business.js), which is good.

Additional read-oriented indexes should be added where useful and safe:

- `businessId + visible + order` on sections
- `businessId + visible + order` on links

These are aligned with the public queries and should reduce sorting/filtering cost on growing datasets.

### Response headers

[publicSiteController.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/controllers/publicSiteController.js) should differentiate:

- normal public tenant route:
  - `Cache-Control: public, max-age=30, stale-while-revalidate=120`
- preview mode:
  - `Cache-Control: no-store`

Realtime SSE remains:

- `no-cache, no-transform`

## Preview and Admin Safety

### Preview iframe behavior

[TenantPreviewPanel.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/components/business/TenantPreviewPanel.jsx) should remain compatible, but its refresh behavior must force freshness.

Desired behavior:

- saved tenant changes trigger a preview reload path that can fetch fresh content
- manual `Atualizar preview` must also force a fresh fetch
- preview URL may include `preview=1` and a timestamp token to ensure browser-level freshness

### Admin route isolation

No public cache or public hook-level reuse should be applied to:

- dashboard data
- auth routes
- admin CRUD
- uploads

The optimization layer is public-site-scoped only.

## Loading and UX Design

The dark loading baseline introduced earlier remains the foundation.

Improvements here should focus on perceived speed:

- keep black/premium loading background
- replace empty waiting with a lighter skeleton or subtle content placeholder when appropriate
- avoid blank intermediate states if cached data already exists
- smooth the transition from loading to loaded public content

The goal is to make first load feel intentional rather than stalled.

## Compatibility Strategy

The optimization work must preserve:

- tenant preview iframe
- tenant admin save flow
- uploads and existing Cloudinary URLs
- public route behavior for old and new tenants
- theme v2 resolution
- realtime refresh support

The cache layer must never be the only source of truth. Fresh network reads remain available whenever preview/admin requires them.

## Testing and Verification

Required test coverage:

- public hook cache hit within TTL
- in-flight request deduplication
- bypass cache path for preview/admin
- preview refresh gets fresh data after save
- Cloudinary URL optimization helper behavior
- non-Cloudinary URLs remain unchanged
- hero image gets high priority behavior
- secondary images remain lazy
- public route cache headers differ between normal and preview mode
- preview iframe behavior remains functional
- admin flows remain uncached
- frontend build still succeeds with code splitting

Manual verification targets:

- first public visit feels lighter
- second public visit within TTL reuses cached data
- preview iframe after save shows current content
- public page images load smaller/faster than before
- admin page still works normally

## Implementation Staging

Implementation will follow this order:

1. public data cache design in frontend service/hook with tests
2. preview bypass and fresh iframe contract
3. route-level code splitting and loading fallbacks
4. Cloudinary transformation helpers and public image component updates
5. backend query projections, indexes, and public cache headers
6. regression tests across public page, preview, and admin
7. build and manual verification

This order reduces risk by stabilizing data freshness semantics before optimizing rendering and media.

## Risks and Mitigations

Risk: preview shows stale content after save.
Mitigation: explicit preview bypass path, preview query signal, and forced iframe refresh token.

Risk: normal public cache hides tenant edits for too long.
Mitigation: short TTL only, `max-age=30`, and preview/admin bypass.

Risk: Cloudinary transformation breaks non-Cloudinary URLs.
Mitigation: helper only transforms recognized Cloudinary delivery URLs and leaves all others untouched.

Risk: code splitting introduces route flicker or loading flash.
Mitigation: keep dark `Suspense` fallback aligned with current premium loading baseline.

Risk: payload reduction accidentally removes fields used by sections.
Mitigation: update tests around public payload schema, services, and page rendering before implementing field projections.

## Approval Status

Design approved by the user on 2026-05-26 with these explicit requirements:

- short frontend cache with deduplication
- preview/admin bypass must always allow fresh reads
- public route may use `Cache-Control: public, max-age=30, stale-while-revalidate=120`
- preview mode must not use aggressive cache
- code splitting for public/auth/dashboard routes
- Cloudinary delivery optimization with safe transforms
- loading remains black/premium with no white flash
