# Block-level design tokens (per-component token sets)

Per-block styling for Mister Chameleon. Alongside the site-wide tenant theme
(~100 CSS custom properties on `[data-site]`), an individual **content block** or
**adaptive block** can now carry its own small set of curated design tokens —
scoped to just that block, without touching the site theme.

Two ingredients:

1. **Named, reusable token sets** — defined once per tenant (Design → Blocks),
   referenced by many blocks via a slug `key` (e.g. `dark-section`, `highlight`).
2. **Inline per-block tweaks** — a handful of tokens set directly on one block,
   layered on top of the named set it references (inline wins).

Because the overrides are emitted as the **same** CSS variables the theme uses,
just on a wrapper element around one block, CSS inheritance does all the work —
no block component was rewritten. A block that reads `var(--primary)` picks up a
block-scoped `--primary` when present, and falls back to the site value otherwise.

## Curated token surface

Only high-impact tokens are exposed per block (kept small on purpose):

- `surface` — semantic background role (`default | subtle | emphasis | strong | inverse`)
- `background` — explicit background colour (used when no surface role is set)
- `text`, `textMuted` — body / secondary text colour
- `primary`, `primaryText` — accent colour + on-primary (button) text
- `cardBg`, `cardBorder`, `cardRadius` — card/panel surface
- `headingFont`, `headingWeight` — heading typography
- `dividerColor`, `dividerWidth` — section dividers

Each field fans out to the real CSS vars from `design-system/theme/tenant-theme.ts`
(e.g. `primary` → `--primary`, `--btn-bg`, `--text-brand`).

## How to use

### 1. Create reusable sets — Admin → Design → **Blocks** tab

Add sets (name + slug `key` + optional description), fill the curated fields with
colour pickers / selects, and **Save**. Two shortcuts:

- **Load example sets** — inserts four worked-out starters (`dark-section`,
  `highlight`, `soft-cards`, `brand-cta`) to review and save.
- **Import / export JSON** — paste an array of sets (see the example file below).

### 2a. Assign to an **adaptive block** — Admin → Tenant → Blocks → Edit

The editor drawer has a **Design tokens (this block only)** section: pick a token
set from the dropdown and/or set inline overrides. Saved into the block's
`defaultVariant`. Renders on CMS pages and on the homepage (see wiring below).

### 2b. Assign to a **content block** — Statamic page builder

Every content block now has a **Token set** field. Type the `key` of a set defined
in Design → Blocks (e.g. `dark-section`). Renders on all CMS pages.

## Example set to load/test

`block-token-sets.example.json` (delivered to your outputs folder) contains the
same four sets as the **Load example sets** button. Paste it into the
Import / export JSON box in Design → Blocks, or just click the button.

## Architecture / files changed

### Platform repo (`mister-chameleon`)

Model & rendering
- `design-system/theme/block-token-set.ts` **(new)** — `CuratedBlockTokens`,
  `BlockTokenSet`, `BlockTokenRef`, resolver (`resolveBlockTokenStyle`, maps
  curated tokens → real CSS vars).
- `design-system/theme/block-token-set-examples.ts` **(new)** — example sets.
- `components/platform/BlockThemeScope.tsx` **(new)** — server wrapper emitting
  scoped CSS vars; passes children through untouched when there are no tokens.
- `components/platform/ContentBlockRenderer.tsx` — wraps each content block.
- `components/platform/TemplateRenderer.tsx` — resolves the tenant's named sets
  once; wraps content blocks and context/adaptive slots; `tokenRefFromVariant`
  helper; CMS-page adaptive fallback carries the resolved variant's tokens.

Data model
- `tenant/types.ts` — `TenantDesignSettings.blockTokenSets`.
- `page-config/types.ts` — `ContentBlockBase.tokenSet/tokens`,
  `ResolvedContextSlot.tokenSet/tokens`, `ContextSlotData` entries `tokenRef`.
- `cms/types.ts` — `AdaptiveVariantContent.tokenSet/tokens`,
  `PageSectionBase.tokenSet/tokens`, and `tokenRef` on
  `HeroBlockData` / `ProofBlockData` / `CTABlockData` / `FeatureBlockData`.

Admin
- `app/admin/tenants/[tenantId]/actions.ts` — `saveBlockTokenSetsAction`
  (validates unique slug keys, strips unknown fields, writes `design.blockTokenSets`).
- `app/admin/tenants/[tenantId]/design/_components/BlockTokenSetsEditor.tsx` **(new)**
  + `DesignPageClient.tsx` — the Blocks tab.
- `components/admin/EditBlockDrawer.tsx` — adaptive-block token controls.
- `app/admin/tenants/[tenantId]/blocks/page.tsx` +
  `_components/TenantBlocksClient.tsx` — load & thread `blockTokenSets` to the drawer.

CMS mapping / rendering
- `cms/mappers/statamic/statamic-mappers.ts` — forwards `token_set`/`tokens`.
- `cms/mappers/page-config-mapper.ts` — forwards them onto `ContentBlock`.
- `cms/providers/statamic-provider.ts` — `variantTokenRef` carried in the four
  `adaptiveTo*` mappers, so the homepage engine hero/proof/cta/feature keep tokens.

### CMS repo (`mister-chameleon-cms-app`)

- `resources/fieldsets/mrc_*.yaml` (18 content-block fieldsets) — new
  **Token set** text field.

## Rendering paths — coverage

- **Content blocks**, all CMS pages — full (field → mapper → scoped render).
- **Adaptive blocks**, CMS pages — full (adaptive fallback carries tokenRef).
- **Adaptive blocks**, homepage engine — covered via the Statamic provider's
  `adaptiveTo*` mappers. Note: the homepage maps the block's **default variant**,
  so tokens follow the default variant (consistent with the other fields there).
  Per-visitor variant-specific tokens on the homepage would need variant-selection
  threading — a separate, smaller step if ever needed.

## Safety / backward compatibility

Fully additive. Without a token ref a block renders exactly as before and the DOM
stays flat (the wrapper appears only when tokens are actually present). Normalize
passes `blockTokenSets` through untouched (`...r.design` spread).

## Deploy steps (your actions)

1. **Platform repo** — commit + push `mister-chameleon` → Vercel builds `main`.
2. **CMS repo** — commit + push `mister-chameleon-cms-app`, then run a Ploi
   deploy/rebuild so Statamic bakes the updated block fieldsets and shows the new
   **Token set** field in the page builder.

The sandbox does not push — run git push yourself.
