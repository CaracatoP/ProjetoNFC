# Public Site Performance Optimization Plan

## Goal

Improve first-load performance for tenant public pages without breaking preview, admin, uploads, legacy tenants, realtime updates, or theme v2 behavior.

## Constraints

- Public preview/admin must always be able to bypass cache and fetch fresh data after save.
- Public `Cache-Control` headers apply only to the normal public route.
- Preview/admin requests must use `Cache-Control: no-store`.
- SSE must keep `Cache-Control: no-cache, no-transform`.
- Non-Cloudinary URLs must remain untouched.
- Changes must preserve the current public route contract and preview iframe workflow.

## Steps

1. Add regression tests first.
   - Cover public service cache, deduplication, bypass, and invalidation behavior.
   - Cover preview query handling and response headers on public routes.
   - Cover preview iframe URL refresh behavior and safe Cloudinary URL optimization.

2. Introduce shared public-fetch caching behavior in the frontend.
   - Add short-lived in-memory cache plus in-flight request deduplication.
   - Expose explicit bypass for preview/admin and forced reload flows.
   - Keep stale content visible during revalidation when safe.

3. Make preview fetches always fresh.
   - Append `preview=1` and a timestamp/refresh token to preview iframe URLs.
   - Ensure public page logic detects preview mode and bypasses cache.
   - Preserve realtime refresh behavior after tenant updates.

4. Reduce public frontend startup cost.
   - Lazy-load public/auth/dashboard routes behind a shared dark loading fallback.
   - Keep the black premium boot/loading experience with no white flash.

5. Optimize public media delivery.
   - Add safe Cloudinary transformation helpers with `f_auto`, `q_auto`, `dpr_auto`, and context-aware widths.
   - Keep non-Cloudinary media unchanged.
   - Prioritize hero imagery and defer secondary imagery with lazy loading and stable sizing.

6. Tighten backend public delivery.
   - Apply public cache headers only for non-preview public requests.
   - Apply `no-store` for preview/admin public reads.
   - Reduce payload selection where possible and review public query indexes.

7. Verify end to end.
   - Run targeted frontend/backend tests, full suites, and production build.
   - Manually verify admin, preview iframe, and public page behavior.
