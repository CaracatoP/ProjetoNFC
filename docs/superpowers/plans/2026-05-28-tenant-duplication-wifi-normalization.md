# Tenant Duplication Wifi Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix tenant duplication and legacy payload loading so `business.contact.wifi` never breaks admin, public preview, or client panel when `ssid/password` are missing.

**Architecture:** Introduce one idempotent `contact/wifi` normalizer shared between backend serialization and shared schemas, then thread it through business creation/update/defaults and response mappers. Keep schema tolerance as a defensive layer, but make backend normalization the primary source of correctness.

**Tech Stack:** Node.js, Express, MongoDB/Mongoose, React, Zod, Vitest, Supertest

---

### Task 1: Lock the bug down with failing tests

**Files:**
- Create: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/shared/utils/businessContact.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/services/publicSiteSchema.test.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/panel/ClientPanelPage.test.jsx`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/routes/adminRoutes.test.js`

- [ ] **Step 1: Add a shared-schema regression test for legacy wifi payloads**

Add assertions that `publicSitePayloadSchema.parse(...)` accepts:

```js
contact: {}
```

and:

```js
contact: {
  wifi: { security: 'WPA' },
}
```

with final parsed output:

```js
contact.wifi.ssid === ''
contact.wifi.password === ''
contact.wifi.security === 'WPA'
```

- [ ] **Step 2: Add backend duplication regression tests**

Extend `backend/src/routes/adminRoutes.test.js` with cases that:

```js
// original tenant has no wifi object
delete business.contact.wifi;

// original tenant has partial wifi
business.contact.wifi = { security: 'WPA' };
```

Then duplicate the tenant through `POST /api/admin/businesses` and assert:

```js
duplicate.business.contact.wifi.ssid === ''
duplicate.business.contact.wifi.password === ''
duplicate.business.contact.wifi.security === 'WPA'
```

Also update the duplicate and confirm the original tenant contact/wifi is unchanged.

- [ ] **Step 3: Add a client-panel tolerance test**

Add a fixture in `ClientPanelPage.test.jsx` where:

```js
business: {
  contact: {
    wifi: { security: 'WPA' },
  },
}
```

and verify the page still renders instead of crashing.

- [ ] **Step 4: Run the targeted tests and confirm they fail for the right reason**

Run:

```bash
npm --prefix frontend run test -- src/services/publicSiteSchema.test.js src/pages/panel/ClientPanelPage.test.jsx
npm --prefix backend run test -- src/routes/adminRoutes.test.js
```

Expected: failures showing missing `wifi.ssid/password` or unchanged regression coverage.

### Task 2: Implement idempotent backend normalization and serializer safeguards

**Files:**
- Create: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/shared/utils/businessContact.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/shared/schemas/business.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/adminBusinessService.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/utils/adminDefaults.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/publicSiteService.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/services/clientPanelService.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/models/Business.js`

- [ ] **Step 1: Implement the shared idempotent normalizer**

Create a pure helper that normalizes:

```js
normalizeBusinessContact(input = {})
normalizeBusinessWifi(input = {})
```

Rules:

```js
ssid -> ''
password -> ''
security -> existing value or 'WPA'
title -> ''
description -> ''
```

The helper must return the same output when called repeatedly on already-normalized data.

- [ ] **Step 2: Use the helper in backend write paths**

Replace inline `contact/wifi` shaping in:

```js
normalizeBusinessPayload(...)
buildDefaultTenantSetup(...)
```

so create/update/duplicate flows all persist the same normalized shape.

- [ ] **Step 3: Use the helper in backend read/serialization paths**

Apply the helper when building API payloads for:

```js
hydrateEditorResponse(...)
public site payload serialization
client panel business sanitization
```

and add a `toObject`/`toJSON` transform or equivalent model-boundary safeguard in `Business.js` so non-lean flows also emit safe `contact/wifi`.

- [ ] **Step 4: Make the shared schema tolerant but final-output stable**

Update `shared/schemas/business.js` so parsing legacy or partial `wifi` still yields:

```js
{
  wifi: {
    ssid: '',
    password: '',
    security: 'WPA',
    title: '',
    description: '',
  }
}
```

without requiring every caller to pre-normalize first.

- [ ] **Step 5: Run the targeted tests again and confirm they pass**

Run:

```bash
npm --prefix frontend run test -- src/services/publicSiteSchema.test.js src/pages/panel/ClientPanelPage.test.jsx
npm --prefix backend run test -- src/routes/adminRoutes.test.js
```

Expected: PASS with the regression cases green.

### Task 3: Verify end-to-end compatibility and guard against regressions

**Files:**
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/services/publicSiteService.test.js`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/pages/dashboard/DashboardHomePage.test.jsx`
- Modify: `C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/docs/superpowers/specs/2026-05-28-tenant-duplication-wifi-normalization-design.md`

- [ ] **Step 1: Add a public-site service regression**

Extend `publicSiteService.test.js` with a mocked API payload containing:

```js
business: {
  contact: {
    wifi: { security: 'WPA' },
  },
}
```

and assert `getPublicSiteBySlug(...)` returns normalized `ssid/password` as empty strings.

- [ ] **Step 2: Add a dashboard duplication regression**

Extend `DashboardHomePage.test.jsx` so duplicating a tenant with partial wifi does not break editor loading and keeps duplicated `contact.wifi` detached from the source fixture.

- [ ] **Step 3: Run the broader verification set**

Run:

```bash
npm --prefix frontend run test -- src/services/publicSiteSchema.test.js src/services/publicSiteService.test.js src/pages/panel/ClientPanelPage.test.jsx src/pages/dashboard/DashboardHomePage.test.jsx
npm --prefix backend run test -- src/routes/adminRoutes.test.js
```

Expected: PASS.

- [ ] **Step 4: Run full safety verification before claiming completion**

Run:

```bash
npm --prefix frontend run test
npm --prefix backend run test
npm --prefix frontend run build
```

Expected:
- frontend tests pass
- backend tests pass
- production build succeeds
