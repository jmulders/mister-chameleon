# Snippet block fidelity

Which block variants render fully on the snippet path (`lib/snippet/render-block-html.ts`,
block mode) and which degrade to a simpler render, and where they degrade to.

The snippet injects self-contained inline-styled HTML into an arbitrary external
page, so it does not have the platform's React components or Tailwind. For each
block, a variant either has a dedicated snippet render or falls back to the
block's base render. Media reuses the shared helper `ctaMediaInner` (image /
asset video / YouTube-Vimeo click-to-load facade) wired by the snippet runtime
`mcWireVideoFacades`.

This reflects the state after the recent snippet work: PRs #157 (CTA media),
#158 (cta_newsletter), #159 (notification media), #162 (spotlight media), #165
(conversion book-demo fallback), #166 (hero layouts). Where a row depends on a
PR that is not yet merged, it is noted.

Legend: Full = dedicated snippet render; Degrades = falls back to the noted
simpler render; n/a = not applicable.

## Hero

`renderHero` honours `layoutVariant` for the media-bearing layouts (#166) and
otherwise renders the base centered layout. Text-only / no-media heroes are
byte-identical to the base regardless of layout.

| Variant | Snippet | Degrades to |
| --- | --- | --- |
| hero_default | Full (base centered) | n/a |
| hero_split / hero_split_clean / hero_dark_split | Full with media (text + media split, side-panel facade) | Base centered when no media |
| hero_background | Full with media (full-bleed media + overlay; background video muted-autoplays) | Base centered when no media |
| hero_page_banner | Full with media (compact banner + side media) | Base centered when no media |
| hero_carousel | First slide rendered statically (no autoplay runtime) | Base centered when the first slide has no media |
| hero_minimal_dark / hero_editorial / hero_proof | Degrades | Base centered (text-only, by design) |

Note: hero media on the snippet uses the shared facade stack. On the platform,
hero images stay on `next/image` and `hero_background` is bespoke (see #167); the
snippet does not have those constraints and renders through `ctaMediaInner`.

## Proof

`renderProof` renders the spotlight media split when the layout is
`proof_spotlight` and an item carries media (#162); otherwise a stat-card grid.

| Variant | Snippet | Degrades to |
| --- | --- | --- |
| proof_stats | Full (stat-card grid = the base) | n/a |
| proof_spotlight | Full with media (media + quote + attribution, facade) | Stat-card grid when no item media |
| proof_logos | Degrades | Stat-card grid (cosmetic) |
| proof_quotes | Degrades | Stat-card grid (cosmetic) |

## CTA

`renderCta` handles the media variants and delegates `cta_newsletter` to a form
render; other layouts fall back to the base banner.

| Variant | Snippet | Degrades to |
| --- | --- | --- |
| cta_banner | Full (base banner) | n/a |
| cta_media_split | Full (media beside text + buttons, facade) (#157) | n/a |
| cta_media_first | Full (media background + overlaid CTA) (#157) | n/a |
| cta_newsletter | Full (inline form via the shared forms pipeline) (#158) | n/a |
| cta_split / cta_card / cta_banner_default / cta_banner_compact / cta_soft / cta_glow | Degrades | Base banner (cosmetic) |

## Feature

`renderFeature` renders the spotlight media split when the layout is
`feature_spotlight` and an item carries media (#162); otherwise a card grid.

| Variant | Snippet | Degrades to |
| --- | --- | --- |
| feature_grid_3up | Full (card grid = the base) | n/a |
| feature_spotlight | Full with media (media + title + body + price + CTA, facade) | Card grid when no item media |
| feature_grid_4up / feature_grid_cards / feature_grid_checklist / feature_grid_spacious / feature_grid_dark | Degrades | Card grid (cosmetic) |

## Conversion

Conversion has no layout-variant axis; behavior is driven by `formKey`.
`renderConversion` renders a headline + CTA section.

| Case | Snippet | Notes |
| --- | --- | --- |
| standard (headline + CTA) | Full | n/a |
| formKey book-demo | Full (localized booking button to the hosted /book-demo page) (#165) | The platform BookDemoClient widget is not reproduced; the snippet links to it. An author-supplied CTA wins. |

## Notification

`renderNotification` renders a single bar with the severity accent, optional CTA,
and optional media (#159). Position, dismiss, auto-dismiss, and frequency capping
are handled by the snippet runtime (`mcApplyNotificationCapping`), not by the
markup.

| Case | Snippet | Notes |
| --- | --- | --- |
| text (info / success / warning / promo severity) | Full | Severity accent only; position and capping are runtime concerns |
| with media | Full (media beside the message, facade) (#159) | mediaSide via CSS order |

## Summary of intentional degradations

- Cosmetic-only layout variants that fall back to the block's base render:
  `proof_logos`, `proof_quotes`, the `cta_*` banner family, and the
  `feature_grid_*` variants. These carry no media, so the base render conveys the
  same content in a slightly plainer layout.
- Text-only / no-media heroes and the text-centric hero layouts
  (`hero_minimal_dark`, `hero_editorial`, `hero_proof`) render the base centered
  hero by design.
- `hero_carousel` renders its first slide statically; there is no autoplay
  carousel runtime on the snippet.
- Conversion `book-demo` links to the hosted booking page rather than embedding
  the booking widget.
