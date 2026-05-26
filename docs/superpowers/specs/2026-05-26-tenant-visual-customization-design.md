# Tenant Visual Customization Design

Date: 2026-05-26
Project: TapLink
Scope: Per-tenant visual customization, public-site theming, admin styling refresh, and loading-screen hardening

## Goal

Add a stable, tenant-specific visual customization system for the public TapLink page using exactly eight editable theme tokens, while preserving the current CRUD, uploads, preview flow, wizard, duplication flow, public routes, and legacy tenants.

The implementation must be:

- backward compatible with tenants that have no theme or only a partial legacy theme
- safe against unintended token coupling
- centralized so backend and frontend derive the same final visual output
- easy to extend later with more tokens such as links, header, inputs, and badges without reworking the core model

## Current State

The project already has a centralized theme utility in [shared/utils/theme.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/shared/utils/theme.js), an admin customization section in [frontend/src/components/business/editor/ThemeCustomizationSection.jsx](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/components/business/editor/ThemeCustomizationSection.jsx), theme persistence in [backend/src/models/BusinessTheme.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/backend/src/models/BusinessTheme.js), and runtime application through [frontend/src/hooks/useTenantTheme.js](/C:/Users/RDP/Downloads/ProjetoNFCv2/ProjetoNFC/frontend/src/hooks/useTenantTheme.js).

Today, the theme utility exposes a resolved theme structure with derived colors and button tokens. The public site already uses CSS variables from that resolver. The admin editor already supports a live preview, color pickers, and theme presets.

There are still gaps that this work must close:

- the public site currently errors when a tenant has no persisted theme record
- the editable theme model is not yet aligned to the requested eight raw tokens
- the admin visual identity is still warmer and more colorful than the desired premium black/white/cool-gray direction
- the boot/loading layer still needs a stronger guarantee against white flashes before React mounts

## Functional Scope

### Tenant-editable theme tokens

Each tenant will store exactly these editable theme tokens as the raw theme source of truth:

```js
theme: {
  version: 2,
  backgroundColor,
  cardColor,
  buttonHoverColor,
  primaryButtonColor,
  textColor,
  accentColor,
  borderColor,
  secondaryColor,
}
```

Default fallback values:

```js
{
  backgroundColor: "#111111",
  cardColor: "#1D1D1D",
  buttonHoverColor: "#2B2B2B",
  primaryButtonColor: "#C8A46A",
  textColor: "#F5F5F5",
  accentColor: "#C8A46A",
  borderColor: "#333333",
  secondaryColor: "#8A6B4A",
}
```

These eight tokens are the only user-editable color fields for now. Additional display tokens may be derived internally but must not become persisted inputs in this phase.

### Non-goals for this phase

- no fully free-form CSS editor changes
- no extra persisted tokens for links, header, inputs, badges, or chips
- no architectural migration of unrelated CRUD, upload, analytics, or routing layers

## Theme Architecture

### Single shared resolver

There will be one shared theme resolver used by backend and frontend. It remains in the shared layer and becomes the authoritative source for:

- default theme generation
- raw token normalization
- legacy-to-v2 compatibility
- contrast-safe derived values
- button state generation
- CSS variable generation

The backend must use it when saving, duplicating, and reading tenants. The frontend must use the same resolver when rendering previews and the public site. No separate frontend-only or backend-only theming rules should be introduced.

### Raw theme plus resolved theme

The implementation will distinguish between:

- raw theme: the persisted eight tokens plus `version`
- resolved theme: the normalized theme object used by the public UI, preview, and CSS variables

This keeps persistence simple and future expansion easy. Later tokens such as `linkColor` or `headerColor` can be added to the raw layer without replacing the resolver contract.

### Versioning

Persisted raw themes created or updated by this feature will use:

```js
theme.version = 2
```

Compatibility rules:

- tenants with no theme record are treated as v2-default at runtime
- tenants with a legacy resolved theme shape but no version are treated as legacy input and normalized into v2-compatible resolved output
- saving a tenant through the editor writes the normalized v2 raw format

Versioning is internal compatibility metadata, not a user-facing control.

## Color Validation and Normalization

All editable color inputs must be validated and normalized centrally.

Accepted user formats:

- `#111111`
- `111111`
- `#FFF`
- `FFF`

Normalization rules:

- always add `#` if omitted
- expand 3-digit hex into 6-digit hex
- save lowercase normalized hex
- reject invalid hex strings safely and fall back to the appropriate default rather than crashing

The stored value must always end up in canonical form like:

- `#111111`
- `#ffffff`

Normalization must happen in the shared resolver, not duplicated across form handlers, backend services, or CSS utilities.

## Backend Design

### Persistence model

Theme persistence remains attached to the tenant by `businessId` through `BusinessTheme`. The schema may continue to store a broader theme document for compatibility, but the persisted source of truth for this feature is the v2 raw theme payload.

The read path must tolerate:

- no theme document
- a partial v2 raw theme
- a legacy resolved theme document

The write path must:

- normalize into v2
- preserve valid user-provided values
- fill only missing or invalid fields from defaults
- avoid silently overriding valid saved colors

### Create, update, read, duplicate

Creation:

- generate a v2 raw theme when no theme is provided
- accept partial incoming theme and complete missing fields through the shared resolver

Update:

- accept partial or complete theme payloads from the editor
- normalize and persist as v2 raw theme
- keep business, links, sections, uploads, and NFC behavior untouched

Read:

- return a resolved theme structure to existing consumers that expect resolved visual tokens
- guarantee safe fallback if the theme record is absent

Duplicate:

- copy the tenant theme values into a new raw theme payload
- ensure the duplicate gets its own independent persisted theme document

### Public-site fallback fix

The current public site service throws if no theme record exists. This must change.

New behavior:

- if no theme record exists, resolve defaults from the shared resolver
- if a theme record exists but is partial or legacy, normalize it through the same resolver
- public rendering must never fail solely because a tenant lacks a theme record

This is a required compatibility fix for older tenants.

## Duplication Design

The duplication flow must perform a real deep clone of the theme payload before creating the new tenant.

Requirements:

- no shared references between original and duplicate theme objects
- future edits on the duplicated tenant must not mutate the original
- deep cloning must cover the theme payload even if the current structure is simple

The frontend duplication payload builder and the backend persistence path must both preserve this guarantee. Tests must verify behavior, not just object shape.

## Admin Editor Design

### Personalizacao Visual section

The tenant editor will expose a section named `Personalizacao Visual` with exactly eight controls:

- Cor de fundo principal
- Cor dos cards/botoes
- Cor de hover dos botoes
- Cor do botao principal/destaque
- Cor do texto principal
- Cor dos icones/detalhes
- Cor das bordas/linhas
- Cor secundaria

Each control includes:

- a color picker
- an editable HEX input
- immediate preview of the selected value

The editor must remain easy to use and not introduce additional advanced token groups at this stage.

### Simplicity and expandability

The UI component structure should be organized so that future tokens can be added through configuration rather than another large rewrite. The current card-based field rendering is a suitable base and should be extended rather than replaced wholesale.

## Preview Design

The admin live preview must reflect the resolved theme in real time without saving.

It must visibly represent:

- background
- header or hero area
- cards
- primary button
- button hover treatment
- text
- borders
- accent details

The preview must use the same shared resolver and CSS variable pipeline as the public site, so the preview cannot diverge from production output.

## Public Site Design

The public site will keep CSS variables as the delivery mechanism. The difference is that the CSS variable map will now come from the v2 raw tokens through the shared resolver.

Rules:

- replace remaining hardcoded visual roles with resolved theme variables where they belong
- keep text contrast legible
- allow only safe automatic derivation for readability
- do not auto-mutate one persisted token from another persisted token

Any derived values such as subtle surfaces, overlays, muted text, or shadow tints must be computed from the raw tokens inside the resolver, not hand-coded separately across components.

## Loading Screen Design

The loading experience must be black from the earliest possible rendering stage.

Requirements:

- `index.html`, `body`, and `#root` must already render on a black base before React loads
- no bright boot card or light-toned placeholder should remain
- loading states inside React should visually match the same dark premium direction
- transitions should minimize flash and layout jank

The boot layer should be minimal, premium, and cold-toned, aligned with the new admin direction.

## Admin Palette Refresh

The admin UI will adopt a fixed internal palette independent from tenant themes.

Target visual direction:

- background: `#0F1115`
- cards: `#181B22`
- borders: `#252932`
- main text: `#F5F7FA`
- secondary text: `#9AA4B2`
- hover: `#20242D`
- subtle accent: `#D1D5DB`

This is a styling refresh for the internal dashboard only. Tenant colors should not leak into the admin shell chrome.

## Compatibility Strategy

The implementation must preserve all existing flows:

- CRUD of tenants
- uploads and Cloudinary integration
- public preview iframe
- tenant wizard/onboarding
- duplication
- public tenant routes
- analytics and real-time tenant updates

Compatibility cases:

- no theme stored
- legacy theme stored
- partially configured theme stored
- fully configured v2 theme stored

The resolver is responsible for compatibility, not scattered feature flags.

## Testing and Verification

Required verification coverage:

- shared theme normalization and legacy compatibility
- hex normalization and fallback behavior
- tenant creation with no explicit theme
- tenant update with partial theme
- public site render when no theme record exists
- public site render with legacy and v2 themes
- duplication keeps theme values but does not share references
- admin live preview updates without save
- persisted values remain exactly as chosen after save/reload
- loading screen remains black before React mount
- admin palette changes do not break dashboard UX

Minimum verification commands before completion:

- backend tests
- frontend tests
- frontend build
- targeted manual validation of admin preview and public page

## Implementation Staging

Implementation will proceed in ordered stages:

1. update shared resolver and compatibility layer
2. adapt backend validation, persistence, fallback, and duplication paths
3. update admin editor theme fields and live preview
4. apply resolved v2 variables to the public site and clean remaining hardcoded roles
5. refresh loading screen and admin palette
6. add and update regression tests
7. run full verification and manual checks

This order minimizes regression risk by stabilizing the shared contract first.

## Risks and Mitigations

Risk: legacy tenants fail to render because the theme shape changed.
Mitigation: resolver accepts legacy, partial, missing, and v2 input and always returns a resolved output.

Risk: preview and public page drift visually.
Mitigation: both use the same shared resolver and CSS variable builder.

Risk: one token accidentally mutates another on save.
Mitigation: raw persisted tokens are independent inputs and derived values are computed only at render/normalization time.

Risk: duplication shares theme references.
Mitigation: explicit deep cloning plus behavioral tests.

Risk: boot flash remains visible before React mount.
Mitigation: black styling starts in `index.html`, `body`, and `#root`, not only after app hydration.

## Approval Status

Design approved by the user on 2026-05-26 with additional required adjustments:

- `theme.version = 2`
- one shared resolver for backend and frontend
- secure HEX normalization into canonical storage form
- real deep clone during duplication
- black loading screen from the earliest bootstrap layer
