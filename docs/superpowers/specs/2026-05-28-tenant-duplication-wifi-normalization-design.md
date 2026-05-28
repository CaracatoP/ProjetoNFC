# Tenant Duplication Wifi Normalization Design

## Context

After duplicating a tenant, the duplicated tenant can fail to load in admin/public flows with schema errors on:

- `data.business.contact.wifi.ssid`
- `data.business.contact.wifi.password`

The root cause is that the backend can persist or serialize `contact.wifi` as a partial object such as:

```json
{
  "security": "WPA"
}
```

This happens because the Mongoose `Business` model materializes the nested `wifi` object with its defaulted `security` field even when `ssid` and `password` are absent. The shared schema then receives a present `wifi` object but required `ssid/password` are still `undefined`.

## Goals

- Keep tenant duplication safe and non-breaking.
- Guarantee `contact` is always an object in final serialized payloads.
- Guarantee `contact.wifi.ssid` and `contact.wifi.password` are always strings in final serialized payloads.
- Use `""` as fallback for missing `ssid/password`.
- Preserve existing `security` when present, otherwise keep current default behavior.
- Ensure duplicated tenants do not share nested object references with originals.
- Keep compatibility with legacy tenants that do not have `contact.wifi`.

## Non-Goals

- No auth/client changes.
- No billing/plan changes.
- No destructive migration of production data.
- No broad schema rewrite.

## Design

### 1. Backend normalization

Introduce a central helper responsible for normalizing business contact data:

- `contact` always resolves to an object.
- `contact.wifi` always resolves to an object shaped like:
  - `ssid: string`
  - `password: string`
  - `security: string`
  - optional `title` and `description` as strings
- `ssid` and `password` default to `""`.
- `security` defaults to the current model/default behavior when absent.
- `pix` behavior remains unchanged except that it continues to be wrapped under a normalized `contact` object.

This helper becomes the only place where `contact/wifi` defaults are defined.

### 2. Backend integration points

Apply the helper in these places:

- `normalizeBusinessPayload`
- `buildDefaultTenantSetup`
- create/update flows that pass through normalized business payloads
- admin editor hydration/serialization
- public site serialization
- client panel business serialization if it exposes `business.contact`

The duplication flow should continue cloning input snapshots, but the duplicated payload must pass through the same backend normalizer used by regular create/edit flows so duplicated tenants are persisted and returned consistently.

### 3. Deep copy safety

The duplication path must continue producing a detached snapshot of the original tenant graph:

- `contact`
- `contact.wifi`
- `modules`
- `segmentConfig`
- other nested editor objects

Changing `wifi/contact` on the duplicate after creation must not mutate the original tenant.

### 4. Shared schema tolerance

Adjust the shared business schema so legacy payloads with missing or partial `contact.wifi` do not crash admin/public/client consumers.

Rules:

- `contact` remains optional/defaultable.
- `wifi` remains conceptually optional.
- If `wifi` is absent or partial, parsing should normalize it into a final object with:
  - `ssid: ""`
  - `password: ""`
  - `security` preserved/defaulted

This keeps final consumers stable while backend normalization remains the primary source of correctness.

### 5. Compatibility

- Existing tenants without `contact.wifi` must continue loading.
- Existing tenants with partial `contact.wifi` such as `{ security: "WPA" }` must continue loading.
- Original tenants must not be modified by duplication alone.
- No production migration is required for this fix because normalization happens on read and write paths.

## Testing

### Backend

Add or update tests for:

- duplicating a tenant without `contact.wifi`
- duplicating a tenant with partial `contact.wifi`
- duplicated tenant payload returning `contact.wifi.ssid === ""`
- duplicated tenant payload returning `contact.wifi.password === ""`
- legacy tenant without wifi loading in admin/public flows
- editing duplicate wifi/contact not mutating original tenant
- deep copy behavior for nested objects in duplicate flow

### Frontend/shared contract

Add or update tests for:

- shared schema parsing legacy payload without `contact.wifi`
- shared schema parsing partial `contact.wifi` like `{ security: "WPA" }`
- admin editor load path tolerating normalized wifi defaults
- public preview load path tolerating normalized wifi defaults
- client panel load path tolerating normalized wifi defaults if `business.contact` is consumed there

## Manual validation

After implementation:

1. Duplicate the butcher tenant again.
2. Open the duplicated tenant in admin.
3. Open the duplicated tenant public preview.
4. Edit wifi/contact fields in the duplicate.
5. Confirm the original tenant remains unchanged.

## Risks

- If normalization is applied only on one serialization path, the bug may still appear in another consumer.
- If the schema is loosened without backend normalization, inconsistent data could keep accumulating in storage.

The fix should therefore prioritize shared backend normalization first, with schema tolerance as a defensive compatibility layer.
