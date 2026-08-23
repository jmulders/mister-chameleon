# `:root` token propagation audit

Analysis-only. No code was changed and no tokens were pinned by this document.

## Why this exists

Tenant theming is injected at `[data-site]` in two layers (both scoped to
`[data-site]`, Layer B wins):

- **Layer A** — `tenantThemeToCSS(finalThemePreset)` → `buildThemeVarsArray()`
  in `design-system/theme/tenant-theme.ts`. Emits the resolved preset's tokens
  concretely.
- **Layer B** — `resolvedThemeToCSS(resolveThemeForTenant(...))` in
  `tenant/resolve-theme.ts`. For curated themes it emits
  `CURATED_THEME_VARS[key]`, which is built from
  `tenantThemeToVarsRecord(THEME_PRESETS[...])` — i.e. **the same set as Layer A**.
  On top of that it maps admin token-group overrides to CSS vars
  (`COLOR_CSS_VARS`, `LAYOUT_CSS_VARS`, `TYPOGRAPHY_CSS_VARS`, …) and applies a
  few conditional/explicit pins.

**The bug class.** A custom property declared *only* at `:root` as
`--x: var(--y)` has its `var()` substituted at `:root` (against the `:root`
value of `--y`) and inherits the already-resolved value down. Re-pinning `--y`
at `[data-site]` does **not** reach `--x`. So `--x` is **at-risk** when:

1. `--x` is a `:root` indirection (its value is `var(...)`), **and**
2. `--x` is **not** re-pinned at `[data-site]` (not emitted by Layer A), **and**
3. its target `--y` **is** re-pinned at `[data-site]` (so there is a
   `[data-site]` value to miss).

If the target is a global `@theme` palette constant (`--color-*`), the token is
**safe** regardless — that constant is identical everywhere.

## Scope

- **89** custom properties are declared as `:root` indirections (value is `var(...)`). Literal `:root` declarations (e.g. `--transition-*`, `--btn-outline-*`) are not indirections and cannot capture a stale value, so they are out of scope.
- Sources cross-referenced: `design-system/theme/theme.css` (`:root` + `@theme`),
  `design-system/theme/tenant-theme.ts` (+ `theme-families.config.ts`),
  `tenant/resolve-theme.ts`. Consumers grepped across `components/`,
  `lib/snippet/`, `app/` (definition files excluded; up to 8 files shown per token).

## AT-RISK tokens (top of report)

**None.** Every `:root` indirection is either re-pinned by Layer A
(`buildThemeVarsArray`) or points to a global `@theme` palette constant.

- The form family and font-role tokens were the last real at-risk set; they were
  fixed in **#217** (`--form-*`, `--font-body/-ui/-code`) — marked `fixed #217`
  in the table below.
- The header top-band (`--header-topband-bg`) was fixed in **#218** (it is not a
  `:root` indirection — it is undeclared at `:root` and pinned in resolve-theme
  + defaulted at the component; hence it does not appear in the indirection list).
- The only indirection not emitted by Layer A is `--ring-offset`, whose target
  (`--color-neutral-0`) is a global palette constant → **not at-risk**.

## Legend

- **Layer A** = `pin` when `buildThemeVarsArray()` emits the token concretely
  (covers every curated preset, and Layer B's curated emission).
- **resolve-theme (B)** = `map/pin` when the token has an admin token-group
  override mapping or an explicit/conditional pin in `resolve-theme.ts`.
- **Status**: `pinned A+B`, `pinned A only`, `B only`, `fixed #217`,
  `safe (palette target)`, or `AT-RISK`.

## Per-token table

### Global: surfaces / text / brand

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--bg` | `var(--color-neutral-50)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `ApplyPanelBlock.tsx`, `ArticleMetaBlock.tsx`, `CartIconButton.tsx`, `CartSummaryBlock.tsx`, `CheckoutBlock.tsx`, `ContactSectionBlock.tsx`, `ContentSectionBlock.tsx` |
| `--bg-subtle` | `var(--color-neutral-100)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `ArticleMetaBlock.tsx`, `CartIconButton.tsx`, `CartSummaryBlock.tsx`, `CheckoutBlock.tsx`, `ContentSectionBlock.tsx`, `DesignTokenEditor.tsx`, `FilterBarBlock.tsx` |
| `--bg-inverse` | `var(--color-neutral-900)` | pin | map/pin | pinned A+B | `HeaderShell.tsx`, `OnboardingForm.tsx`, `PresetPreviewViewer.tsx`, `page.tsx` |
| `--text` | `var(--color-neutral-900)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `Accordion.tsx`, `ApplyPanelBlock.tsx`, `ArticleBodyBlock.tsx`, `ArticleMetaBlock.tsx`, `Breadcrumbs.tsx`, `Button.tsx`, `Card.stories.tsx` |
| `--text-muted` | `var(--color-neutral-500)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `ApplyPanelBlock.tsx`, `ArticleBodyBlock.tsx`, `ArticleMetaBlock.tsx`, `Breadcrumbs.tsx`, `Card.stories.tsx`, `CartSummaryBlock.tsx`, `CheckoutBlock.tsx` |
| `--text-subtle` | `var(--color-neutral-400)` | pin | map/pin | pinned A+B | `Accordion.tsx`, `FaqSectionBlock.tsx`, `HeroBlock.tsx`, `LogoStripBlock.tsx`, `ProcessStepsBlock.tsx`, `ProofBlock.tsx`, `Text.tsx`, `page.tsx` |
| `--text-inverse` | `var(--color-neutral-0)` | pin | map/pin | pinned A+B | `HeaderShell.tsx`, `HeroCarousel.tsx`, `Text.tsx`, `page.tsx` |
| `--text-brand` | `var(--primary)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `Accordion.tsx`, `ContentSectionBlock.tsx`, `DesignTokenEditor.tsx`, `FaqSectionBlock.tsx`, `FeatureGridBlock.tsx`, `Link.tsx`, `NavBar.tsx` |
| `--border` | `var(--color-neutral-200)` | pin | map/pin | pinned A+B | `Card.tsx`, `ConversionBlock.tsx`, `DesignTokenEditor.tsx`, `FeatureGridBlock.tsx`, `Footer.tsx`, `FooterBottomStrip.tsx`, `FormSectionBlock.tsx`, `Header.tsx` |
| `--border-strong` | `var(--color-neutral-300)` | pin | map/pin | pinned A+B | `ThemeWebPreview.tsx`, `page.tsx` |
| `--foreground` | `var(--text)` | pin | map/pin | pinned A+B | `ConversionBlock.tsx`, `QuoteBlock.tsx`, `render-block-html.ts` |
| `--card-foreground` | `var(--text)` | pin | map/pin | pinned A+B | `render-block-html.ts` |
| `--popover-foreground` | `var(--text)` | pin | map/pin | pinned A+B | `render-block-html.ts` |
| `--muted-foreground` | `var(--text-muted)` | pin | map/pin | pinned A+B | `ConversionBlock.tsx`, `FaqSectionBlock.tsx`, `QuickLinksBlock.tsx`, `render-block-html.ts` |
| `--primary` | `var(--color-brand-500)` | pin | map/pin | pinned A+B | `Accordion.tsx`, `ApplyPanelBlock.tsx`, `ArticleMetaBlock.tsx`, `Badge.tsx`, `BookDemoClient.tsx`, `Breadcrumbs.tsx`, `Button.tsx`, `CTAGroup.stories.tsx` |
| `--primary-hover` | `var(--color-brand-600)` | pin | map/pin | pinned A+B | `Button.tsx`, `DesignTokenEditor.tsx`, `page.tsx`, `types.ts` |
| `--primary-active` | `var(--color-brand-700)` | pin | map/pin | pinned A+B | `Button.tsx`, `CTAGroup.tsx`, `CtaSectionBlock.tsx`, `FloatingContactBlock.tsx`, `HeroBlock.tsx`, `TrackedCTAButton.tsx`, `page.tsx` |
| `--primary-subtle` | `var(--color-brand-50)` | pin | map/pin | pinned A+B | `ArticleMetaBlock.tsx`, `FormSectionBlock.tsx`, `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx` |
| `--primary-text` | `var(--color-neutral-0)` | pin | map/pin | pinned A+B | `Button.tsx`, `FloatingContactBlock.tsx`, `HeroCarousel.tsx`, `NavMegaRich.tsx`, `OnboardingForm.tsx`, `PresetPreviewViewer.tsx`, `page.tsx`, `render-block-html.ts` |
| `--ring` | `var(--color-brand-500)` | pin | map/pin | pinned A+B | `Button.tsx`, `DefaultFormBehaviorClient.tsx`, `EmailPlatformClient.tsx`, `FaqSectionBlock.tsx`, `FooterBottomStrip.tsx`, `FooterBranding.tsx`, `FooterCorporate.tsx`, `FooterMinimal.tsx` |
| `--ring-offset` | `var(--color-neutral-0)` | — | map/pin | safe (palette target) | _(none found)_ |

### Buttons: primary

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--btn-bg` | `var(--primary)` | pin | map/pin | pinned A+B | `ApplyPanelBlock.tsx`, `Button.tsx`, `ContentSectionBlock.tsx`, `FilterBarBlock.tsx`, `FloatingContactBlock.tsx`, `FormSectionBlock.tsx`, `Header.tsx`, `HeroCarousel.tsx` |
| `--btn-text` | `var(--primary-text)` | pin | map/pin | pinned A+B | `ApplyPanelBlock.tsx`, `Button.tsx`, `ContentSectionBlock.tsx`, `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `ProductDetailBlock.tsx`, `ThemeWebPreview.tsx` |
| `--btn-hover-bg` | `var(--primary-hover)` | pin | map/pin | pinned A+B | `ApplyPanelBlock.tsx`, `Button.tsx`, `FilterBarBlock.tsx`, `FloatingContactBlock.tsx`, `FormSectionBlock.tsx` |
| `--btn-active-bg` | `var(--primary-active)` | pin | map/pin | pinned A+B | `Button.tsx` |
| `--btn-ring` | `var(--ring)` | pin | — | pinned A only | _(none found)_ |
| `--btn-radius` | `var(--radius-interactive)` | pin | map/pin | pinned A+B | `ApplyPanelBlock.tsx`, `Button.tsx`, `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `OnboardingForm.tsx`, `PresetPreviewViewer.tsx`, `render-block-html.ts` |
| `--btn-shadow` | `var(--shadow-sm)` | pin | map/pin | pinned A+B | `ApplyPanelBlock.tsx`, `FormSectionBlock.tsx` |

### Buttons: secondary / outline / ghost

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--btn-secondary-bg` | `var(--primary-subtle)` | pin | — | pinned A only | `Button.tsx` |
| `--btn-secondary-text` | `var(--text-brand)` | pin | — | pinned A only | `Button.tsx` |
| `--btn-secondary-hover-bg` | `var(--primary-subtle)` | pin | — | pinned A only | `Button.tsx` |

### Badge

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--badge-primary-bg` | `var(--primary-subtle)` | pin | — | pinned A only | `Badge.tsx` |
| `--badge-primary-text` | `var(--text-brand)` | pin | — | pinned A only | `Badge.tsx` |

### Radii

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--radius-interactive` | `var(--radius-md)` | pin | map/pin | pinned A+B | `CTAGroup.tsx`, `CtaSectionBlock.tsx`, `ThemeWebPreview.tsx`, `_NewsletterForm.tsx`, `render-block-html.ts` |
| `--radius-card` | `var(--radius-xl)` | pin | map/pin | pinned A+B | `ThemeWebPreview.tsx` |
| `--radius-popover` | `var(--radius-lg)` | pin | map/pin | pinned A+B | _(none found)_ |

### Section surfaces

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--section-hero-bg` | `var(--color-neutral-950)` | pin | map/pin | pinned A+B | `Section.tsx` |
| `--section-cta-bg` | `var(--primary)` | pin | map/pin | pinned A+B | `ApplyPanelBlock.tsx`, `CtaSectionBlock.tsx`, `OnboardingForm.tsx`, `PresetPreviewViewer.tsx`, `Section.stories.tsx`, `render-block-html.ts` |
| `--section-cta-body` | `var(--primary-subtle)` | pin | — | pinned A only | `ApplyPanelBlock.tsx`, `CTAGroup.tsx`, `CtaSectionBlock.tsx` |
| `--section-subtle-bg` | `var(--bg-subtle)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `BlockMediaView.tsx`, `ContactSectionBlock.tsx`, `Container.stories.tsx`, `CtaSectionBlock.tsx`, `FaqSectionBlock.tsx`, `FeatureGridBlock.tsx`, `HeroBlock.tsx` |
| `--section-subtle-border` | `var(--border)` | pin | map/pin | pinned A+B | `ContactSectionBlock.tsx`, `CtaSectionBlock.tsx`, `FaqSectionBlock.tsx`, `LogoStripBlock.tsx`, `ProcessStepsBlock.tsx`, `ProofBlock.tsx`, `RecruiterPanelBlock.tsx`, `StatsBlock.tsx` |

### Card

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--card-bg` | `var(--color-surface)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `Accordion.tsx`, `ApplyPanelBlock.tsx`, `CTAGroup.tsx`, `Card.tsx`, `CartSummaryBlock.tsx`, `CheckoutBlock.tsx`, `ContactSectionBlock.tsx` |
| `--card-border` | `var(--border)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `Accordion.tsx`, `ApplyPanelBlock.tsx`, `ArticleBodyBlock.tsx`, `ArticleMetaBlock.tsx`, `CartSummaryBlock.tsx`, `CheckoutBlock.tsx`, `ContactSectionBlock.tsx` |
| `--card-radius` | `var(--radius-card)` | pin | — | pinned A only | `AboutBlock.tsx`, `Accordion.tsx`, `ApplyPanelBlock.tsx`, `ArticleMetaBlock.tsx`, `Card.tsx`, `CartSummaryBlock.tsx`, `CheckoutBlock.tsx`, `ContactSectionBlock.tsx` |
| `--card-shadow` | `var(--shadow-sm)` | pin | map/pin | pinned A+B | `CtaSectionBlock.tsx`, `FormSectionBlock.tsx`, `QuickLinksBlock.tsx`, `RecruiterPanelBlock.tsx`, `ResultCard.tsx`, `SearchResultCard.tsx`, `ThemeWebPreview.tsx`, `VacancyMetaBlock.tsx` |
| `--card-quote` | `var(--primary)` | pin | — | pinned A only | _(none found)_ |

### Hero

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--hero-bg` | `var(--section-hero-bg)` | pin | map/pin | pinned A+B | `HeroBlock.tsx`, `HeroCarousel.tsx`, `OnboardingForm.tsx`, `PresetPreviewViewer.tsx`, `render-block-html.ts` |
| `--hero-glow-color` | `var(--primary)` | pin | — | pinned A only | `HeroBlock.tsx`, `StatsBlock.tsx` |
| `--hero-title-color` | `var(--text-inverse)` | pin | — | pinned A only | `HeroBlock.tsx`, `HeroCarousel.tsx`, `OnboardingForm.tsx`, `PresetPreviewViewer.tsx`, `render-block-html.ts` |
| `--hero-subtitle-color` | `var(--text-subtle)` | pin | — | pinned A only | `HeroBlock.tsx`, `HeroCarousel.tsx`, `render-block-html.ts` |

### Proof

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--proof-bg` | `var(--bg)` | pin | — | pinned A only | `TestimonialSectionBlock.tsx` |
| `--proof-card-bg` | `var(--card-bg)` | pin | — | pinned A only | `ProofBlock.tsx`, `TestimonialSectionBlock.tsx` |
| `--proof-card-border` | `var(--card-border)` | pin | map/pin | pinned A+B | `ProofBlock.tsx`, `TestimonialSectionBlock.tsx` |
| `--proof-card-radius` | `var(--card-radius)` | pin | — | pinned A only | `ProofBlock.tsx`, `TestimonialSectionBlock.tsx` |
| `--proof-card-shadow` | `var(--card-shadow)` | pin | — | pinned A only | `TestimonialSectionBlock.tsx` |
| `--proof-quote-color` | `var(--card-quote)` | pin | map/pin | pinned A+B | `ProofBlock.tsx`, `TestimonialSectionBlock.tsx`, `render-block-html.ts` |

### Feature grid

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--feature-grid-bg` | `var(--section-subtle-bg)` | pin | — | pinned A only | `FeatureGridBlock.tsx`, `OnboardingForm.tsx`, `PresetPreviewViewer.tsx`, `ProductOverviewBlock.tsx`, `render-block-html.ts` |
| `--feature-grid-border` | `var(--section-subtle-border)` | pin | — | pinned A only | `FeatureGridBlock.tsx`, `ProductOverviewBlock.tsx` |
| `--feature-grid-card-bg` | `var(--card-bg)` | pin | — | pinned A only | `FeatureGridBlock.tsx` |
| `--feature-grid-card-border` | `var(--card-border)` | pin | — | pinned A only | `FeatureGridBlock.tsx` |
| `--feature-grid-card-radius` | `var(--card-radius)` | pin | — | pinned A only | `FeatureGridBlock.tsx` |
| `--feature-grid-card-shadow` | `var(--card-shadow)` | pin | — | pinned A only | `FeatureGridBlock.tsx`, `ProductOverviewBlock.tsx` |
| `--feature-grid-icon-bg` | `var(--section-subtle-bg)` | pin | — | pinned A only | `FeatureGridBlock.tsx` |

### Form

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--form-bg` | `var(--section-subtle-bg)` | pin | map/pin | fixed #217 | `FormSectionBlock.tsx` |
| `--form-border` | `var(--section-subtle-border)` | pin | map/pin | fixed #217 | `FormSectionBlock.tsx` |
| `--form-input-bg` | `var(--card-bg)` | pin | — | fixed #217 | `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `Input.tsx`, `SearchBlock.tsx`, `Select.tsx`, `Textarea.tsx` |
| `--form-input-border` | `var(--border-strong)` | pin | — | fixed #217 | `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `Input.tsx`, `SearchBlock.tsx`, `Select.tsx`, `Textarea.tsx` |
| `--form-input-radius` | `var(--radius-interactive)` | pin | — | fixed #217 | `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `Input.tsx`, `SearchBlock.tsx`, `Select.tsx`, `Textarea.tsx` |
| `--form-input-text` | `var(--text)` | pin | — | fixed #217 | `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `Input.tsx`, `SearchBlock.tsx`, `Select.tsx`, `Textarea.tsx` |
| `--form-input-placeholder` | `var(--text-subtle)` | pin | — | fixed #217 | `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `Input.tsx`, `Textarea.tsx` |
| `--form-input-focus-ring` | `var(--ring)` | pin | — | fixed #217 | `FilterBarBlock.tsx`, `FormSectionBlock.tsx`, `Input.tsx` |
| `--form-label-color` | `var(--text)` | pin | — | fixed #217 | `FormField.tsx`, `FormGroup.tsx`, `FormSectionBlock.tsx` |
| `--form-help-color` | `var(--text-muted)` | pin | — | fixed #217 | `FormField.tsx`, `FormSectionBlock.tsx` |

### Header / footer

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--header-fg` | `var(--text)` | pin | map/pin | pinned A+B | `CartIconButton.tsx`, `HeaderShell.tsx`, `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx` |
| `--header-border` | `var(--border)` | pin | map/pin | pinned A+B | `Header.tsx`, `HeaderShell.tsx`, `SearchBar.stories.tsx`, `SearchBar.tsx`, `types.ts` |
| `--footer-bg` | `var(--bg-subtle)` | pin | map/pin | pinned A+B | `Footer.tsx`, `FooterBottomStrip.tsx`, `FooterBranding.tsx`, `FooterCorporate.tsx`, `FooterMinimal.tsx`, `types.ts` |
| `--footer-fg` | `var(--text-muted)` | pin | map/pin | pinned A+B | `Footer.tsx`, `FooterBottomStrip.tsx`, `FooterBranding.tsx`, `FooterCorporate.tsx`, `FooterMinimal.tsx`, `types.ts` |
| `--footer-border` | `var(--border)` | pin | map/pin | pinned A+B | `Footer.tsx`, `FooterBottomStrip.tsx`, `FooterBranding.tsx`, `FooterCorporate.tsx`, `FooterMinimal.tsx`, `types.ts` |

### Navigation

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--nav-link` | `var(--header-fg, var(--text))` | pin | map/pin | pinned A+B | `Header.tsx`, `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx`, `SectionTabs.tsx` |
| `--nav-link-hover` | `var(--text-brand)` | pin | map/pin | pinned A+B | `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx`, `SectionTabs.tsx` |
| `--nav-dropdown-bg` | `var(--card-bg, #ffffff)` | pin | map/pin | pinned A+B | `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx` |
| `--nav-dropdown-border` | `var(--border)` | pin | — | pinned A only | `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx` |
| `--nav-dropdown-text` | `var(--text-muted)` | pin | map/pin | pinned A+B | `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx` |
| `--nav-dropdown-link-hover-bg` | `var(--primary-subtle)` | pin | — | pinned A only | `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx`, `SectionTabs.tsx` |
| `--nav-dropdown-link-hover-text` | `var(--text-brand)` | pin | — | pinned A only | `NavBar.tsx`, `NavContent.tsx`, `NavFlyout.tsx`, `NavGrid.tsx`, `NavMega.tsx`, `NavMegaRich.tsx` |

### Typography roles

| Token | :root target | Layer A | resolve-theme (B) | Status | Consuming files |
|---|---|---|---|---|---|
| `--font-heading` | `var(--font-sans)` | pin | map/pin | pinned A+B | `AboutBlock.tsx`, `ApplyPanelBlock.tsx`, `ArticleMetaBlock.tsx`, `CartSummaryBlock.tsx`, `CheckoutBlock.tsx`, `ContactSectionBlock.tsx`, `ContentSectionBlock.tsx`, `CtaSectionBlock.tsx` |
| `--font-body` | `var(--font-sans)` | pin | map/pin | fixed #217 | `ArticleBodyBlock.tsx`, `globals.css` |
| `--font-ui` | `var(--font-sans)` | pin | map/pin | fixed #217 | `Button.tsx`, `NavBar.tsx`, `globals.css` |
| `--font-code` | `var(--font-mono)` | pin | map/pin | fixed #217 | `globals.css` |

## Parity gaps between the two paths

#### A-only — emitted by presets (Layer A) but no admin-override map/pin in resolve-theme (34)

These render correctly on curated presets, but an admin token-group override (e.g. changing the card or section colour in the token editor) does not re-derive them, so they keep the preset value.

- `--btn-ring`  ←  `var(--ring)`
- `--btn-secondary-bg`  ←  `var(--primary-subtle)`
- `--btn-secondary-text`  ←  `var(--text-brand)`
- `--btn-secondary-hover-bg`  ←  `var(--primary-subtle)`
- `--badge-primary-bg`  ←  `var(--primary-subtle)`
- `--badge-primary-text`  ←  `var(--text-brand)`
- `--section-cta-body`  ←  `var(--primary-subtle)`
- `--card-radius`  ←  `var(--radius-card)`
- `--card-quote`  ←  `var(--primary)`
- `--hero-glow-color`  ←  `var(--primary)`
- `--hero-title-color`  ←  `var(--text-inverse)`
- `--hero-subtitle-color`  ←  `var(--text-subtle)`
- `--proof-bg`  ←  `var(--bg)`
- `--proof-card-bg`  ←  `var(--card-bg)`
- `--proof-card-radius`  ←  `var(--card-radius)`
- `--proof-card-shadow`  ←  `var(--card-shadow)`
- `--feature-grid-bg`  ←  `var(--section-subtle-bg)`
- `--feature-grid-border`  ←  `var(--section-subtle-border)`
- `--feature-grid-card-bg`  ←  `var(--card-bg)`
- `--feature-grid-card-border`  ←  `var(--card-border)`
- `--feature-grid-card-radius`  ←  `var(--card-radius)`
- `--feature-grid-card-shadow`  ←  `var(--card-shadow)`
- `--feature-grid-icon-bg`  ←  `var(--section-subtle-bg)`
- `--form-input-bg`  ←  `var(--card-bg)`
- `--form-input-border`  ←  `var(--border-strong)`
- `--form-input-radius`  ←  `var(--radius-interactive)`
- `--form-input-text`  ←  `var(--text)`
- `--form-input-placeholder`  ←  `var(--text-subtle)`
- `--form-input-focus-ring`  ←  `var(--ring)`
- `--form-label-color`  ←  `var(--text)`
- `--form-help-color`  ←  `var(--text-muted)`
- `--nav-dropdown-border`  ←  `var(--border)`
- `--nav-dropdown-link-hover-bg`  ←  `var(--primary-subtle)`
- `--nav-dropdown-link-hover-text`  ←  `var(--text-brand)`

#### B-only — mapped/pinned in resolve-theme but not emitted concretely by Layer A (1)

- `--ring-offset`  ←  `var(--color-neutral-0)` — target is a global `@theme` palette constant, so not at-risk.

## Proposed pin-list (for review — not applied)

Nothing is pinned by this document. Two candidate lists follow; the pin decision
is left to review.

### A. Pinned in neither path

**Empty.** No indirection is unpinned in both paths (the only not-in-A token,
`--ring-offset`, targets a palette constant and is safe).

### B. Pinned in only one path (parity candidates)

- **A-only (34 tokens, listed above).** Emitted by presets but not reachable via
  the resolve-theme admin-override maps. Consequence: a tenant changing a
  token-group (e.g. the card or section colour) in the token editor does not move
  these derived component tokens — they keep the preset value. Deciding which of
  these *should* follow an admin group-override (vs. intentionally stay
  preset-controlled) is the review question. Natural grouping:
  - **Form inputs** (`--form-input-*`, `--form-label-color`, `--form-help-color`)
    — currently follow the preset; candidates to track the `color` group.
  - **Feature-grid / proof component surfaces** (`--feature-grid-*`,
    `--proof-*`) — derive from card/section; candidates to track `card` /
    `section` overrides.
  - **Secondary/badge/nav-dropdown accents** (`--btn-secondary-*`,
    `--badge-primary-*`, `--nav-dropdown-link-hover-*`, `--card-quote`,
    `--hero-glow-color`) — derive from `--primary`/`--text-brand`; candidates to
    track the brand override.
  - **Radii** (`--card-radius`, `--proof-card-radius`,
    `--feature-grid-card-radius`, `--form-input-radius`) — track the `radius`
    group.
  - **Hero text** (`--hero-title-color`, `--hero-subtitle-color`) and
    `--section-cta-body` — inverse-surface text; care needed (they pair with dark
    hero/cta surfaces, not the page text).
- **B-only (1 token).** `--ring-offset` — mapped in resolve-theme, not emitted by
  Layer A; safe (palette target). No action needed unless emitting it for
  completeness is desired.

_End of audit._
