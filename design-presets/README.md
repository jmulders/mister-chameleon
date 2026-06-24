# Design presets — importeerbare JSON

Eén JSON-bestand per preset uit `DESIGN_PRESET_GALLERY`. Te importeren in de
admin: **Tenant → Design → Builder → "Of importeer een preset-JSON"**. De import
vervangt de tokens van de tenant met de preset (complete look), valideert
server-side (CSS-injectie-guard + allowlist) en zet `typographyOverrideEnabled`
aan.

## Formaat

Het grouped design-token *upload*-formaat: `theme` + token-groepen op top-niveau.

Elke preset is **compleet**: alle token-groepen zijn ingevuld zodat een import
de hele render-pijplijn raakt (hero, kaarten, secties, knoppen, focus-ring,
gradient, spacing/motion), niet alleen kleur + radius.

```jsonc
{
  "meta":   { "schema": "mister-chameleon-design-preset@1", "id": "...", "name": "...", "description": "..." },
  "theme":  "custom",
  "color":      { "primary": "#…", "background": "#…", "foreground": "#…", "card": "#…", "muted": "#…", "border": "#…", "link": "#…", "success": "#…", "danger": "#…", "gradient": "linear-gradient(…)", … },
  "typography": { "fontHeading": "…", "fontBody": "…", "baseFontSize": "16px", "headingWeight": "700", "letterSpacing": "…", "headingTransform": "none", "headingLineHeight": "1.1" },
  "radius":     { "interactive": "8px", "card": "12px" },
  "shadow":     { "md": "…" },
  "border":     { "width": "1px" },
  "spacing":    { "sectionPadding": "clamp(56px,8vw,120px)", "container": "72rem", "align": "center" },
  "component":  { "buttonPaddingX": "…", "buttonPaddingY": "…" },
  "motion":     { "hoverLift": "-3px" },
  "layout":     { "headerBg": "#…", "headerFg": "#…", "headerBorder": "#…", "navLinkWeight": "600", "navLinkTracking": "0" },
  "focus":      { "ringWidth": "3px", "ringColor": "#…" },
  "swatch":     { "primary": "#…", … }
}
```

`meta` en `swatch` zijn alleen ter referentie/preview — de importer leest enkel
bekende token-groepen, dus extra velden worden genegeerd.

## Bestanden

`indigo-saas`, `editorial-serif`, `industrial-strong`, `minimal-mono`,
`bold-dark`, `healthcare-calm`, `corporate-navy`, `playful-startup`,
`premium-luxury`, `modern-green`.

## Opnieuw genereren

```bash
node --experimental-transform-types scripts/export-design-presets.ts
```

Genereert deze map opnieuw uit `tenant/design-presets-gallery.ts` (de
bron-of-truth), zodat de JSON's nooit afwijken van de in-repo presets.
