# Design presets — importeerbare JSON

Eén JSON-bestand per preset uit `DESIGN_PRESET_GALLERY`. Te importeren in de
admin: **Tenant → Design → Builder → "Of importeer een preset-JSON"**. De import
vervangt de tokens van de tenant met de preset (complete look), valideert
server-side (CSS-injectie-guard + allowlist) en zet `typographyOverrideEnabled`
aan.

## Formaat

Het grouped design-token *upload*-formaat: `theme` + token-groepen op top-niveau.

```jsonc
{
  "meta":   { "schema": "mister-chameleon-design-preset@1", "id": "...", "name": "...", "description": "..." },
  "theme":  "custom",
  "color":      { "primary": "#…", "background": "#…", … },
  "typography": { "fontHeading": "…", "fontBody": "…", … },
  "radius":     { "interactive": "8px", "card": "12px" },
  "shadow":     { "md": "…" },
  "component":  { "buttonPaddingX": "…", "buttonPaddingY": "…" },
  "layout":     { "headerBg": "#…", "headerFg": "#…", … },
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
