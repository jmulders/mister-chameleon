# Theme-switching unification — implementation plan (for review)

Analysis + plan only. No runtime code changed by this document. I am stopping
here for your approval of the architecture (and the parity call below) before
implementing, because this item rewrites the critical per-request theme-injection
path and intersects the parked 34-token parity decision.

## Where we are today (grounded in the code)

Two independent theme systems:

1. **Curated theme decision** — `decision/theme-decision.ts` `resolveThemeDecision()`
   evaluates `StoredRule`s whose `plan.themeKey` (a `ThemePresetKey`) is set, in
   priority order, and returns a single `themeKey`. The choice is locked for the
   session via the `mc_theme` httpOnly cookie (~4h). `app/layout.tsx` reads
   `contextualThemeKey` and builds the page theme in two layers scoped to
   `[data-site]`:
   - **Layer A** `tenantThemeToCSS(THEME_PRESETS[finalThemeKey])`
   - **Layer B** `resolvedThemeToCSS(resolveThemeForTenant(settings, contextualThemeKey))`
   Everything here is typed around the curated `ThemePresetKey` union
   (`ThemeDecisionTrace`, candidates, cookie value).

2. **Gallery presets** — `tenant/design-presets-gallery.ts` `DESIGN_PRESET_GALLERY`
   is a list of cards `{ id, category, baseTheme, tokenOverrides }`. Applying one
   (admin) writes `design.theme = baseTheme` + `design.tokenOverrides` via
   `buildCompleteLookDesign(currentDesign, tokenOverrides, baseTheme)`. There is
   **no per-request / contextual injection path** — a gallery preset can only be
   applied as the tenant's stored default.

The gap: contextual theme switching only speaks curated `ThemePresetKey`; the
richer gallery presets can't be switched contextually.

## Target (your spec)

- **Contextual gallery-preset injection**: a rule can select a gallery preset,
  injected per session exactly like a curated theme, producing a page identical
  to having applied that preset in admin.
- **`mc_theme` lock**: the chosen theme (curated or gallery) is session-locked.
- **`themeKey` backward-compat**: existing `plan.themeKey` rules keep working.
- **Categorized picker**: the rule editor's theme option shows the gallery
  presets grouped by `category`.

## Proposed mechanism

**Selection type.** Introduce a discriminated `ThemeSelection`:
`{ kind: "curated"; themeKey: ThemePresetKey } | { kind: "gallery"; presetId: string }`.
`resolveThemeDecision()` returns this instead of a bare `themeKey` (curated stays
the default shape internally; the trace keeps `themeKey` for curated and gains an
optional `presetId`). The `mc_theme` cookie encodes it as `curated:<key>` or
`gallery:<id>` (a pure string-format change; old cookies parse as curated).

**Rule field.** `StoredPlan` gains `themePresetId?: string` beside the existing
`themeKey?: ThemePresetKey`. A theme rule sets exactly one. Validation checks the
id against `DESIGN_PRESET_GALLERY`. Existing rules (only `themeKey`) are untouched.

**Injection (`app/layout.tsx`).** When the resolved selection is `gallery`, look
up the card and build a **virtual** design:
`buildCompleteLookDesign(tenant.design, card.tokenOverrides, card.baseTheme)`,
then run the SAME two layers on that virtual settings object:
- Layer A from `THEME_PRESETS[card.baseTheme]` (or the custom base),
- Layer B from `resolveThemeForTenant(virtualSettings, …)`.
This reuses the exact apply path, so a contextually-injected preset renders
**identically** to an applied one (your dev-check criterion). No DB write.

**Picker (rule editor).** The theme-rule editor's theme dropdown becomes a
categorized gallery-preset picker (grouped by `card.category`), writing
`plan.themePresetId`. The curated `themeKey` option is kept for backward-compat
(and can be folded in later).

## Suggested PR split

1. **Runtime capability** — `ThemeSelection`, `StoredPlan.themePresetId` +
   validation, `resolveThemeDecision` returns a selection, `mc_theme` encoding,
   `app/layout` gallery injection, backward-compat. Dev-check: a rule with a
   gallery preset injects it; the page is pixel-identical to applying that preset.
2. **Categorized picker** in the theme-rule editor. Dev-check: pick a preset by
   category, rule fires, preset switches.
3. **Subsume / datamodel** (optional, later) — make gallery presets the primary
   theme option and provide a `themeKey → gallery` bridge for old rules.

## Parity assessment (the flag you asked for)

Contextual gallery injection routes through `resolveThemeForTenant` — the **same
Layer B path** a saved gallery preset uses. Therefore a contextually-injected
preset propagates tokens exactly as an applied preset does, **including** the
same 34 A-only tokens documented in `docs/design/root-token-propagation-audit.md`
(tokens emitted by presets but not re-derived by the resolve-theme admin-override
maps).

Conclusion: **item 6 does NOT require touching the parked 34-token parity
decision.** "Contextually-injected == applied" is achievable without it, because
both paths share the same maps. The parity gaps stay exactly as they are today.

The only way item 6 would touch the parity area is if you also want a gallery
preset to drive tokens that the resolve-theme maps don't currently propagate
(e.g. the feature-grid / proof component surfaces). That is a separate decision I
am NOT making — flagging it per your instruction. If you want that, it becomes a
dependency on the parity pin-list you're holding.

## What I need from you

1. Approve the mechanism above (selection type + `themePresetId` + virtual-design
   injection + categorized picker), or adjust.
2. Confirm the parity call: proceed with "identical-to-apply" and leave the 34
   A-only tokens parked (my recommendation), or expand scope into the parity
   pin-list (your decision).

On your go I'll build PR 1 (runtime capability) first, push, get checks green,
dev-check that a contextually-injected gallery preset renders identically to an
applied one, and stop before merge for your go.
