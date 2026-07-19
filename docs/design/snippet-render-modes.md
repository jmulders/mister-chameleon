# Design — Snippet render-modes: content-swap vs. styled block

*Status: ontwerp (19 juli 2026). Analyse + plan, nog niet gebouwd. Doel: naast het
huidige content-wisselen ook rijke, gestylede blocks via de snippet ondersteunen — met de
huisstijl van de klant via design tokens, en een keuze per variant.*

## 1. Hoe het vandaag werkt (de basis)

Geanalyseerd in `lib/snippet/snippet-source.ts`:

- De decide-response geeft `{ slots: { "hero-title": "…" } }` — een map van slot-key naar
  een **string**.
- De snippet wisselt per slot de `textContent` (of `innerHTML` bij `data-mc-html="true"`,
  of `href` bij `data-mc-slot-href`).
- Er wordt **geen styling geïnjecteerd.** De vervangen inhoud leeft in het bestaande,
  al-gestylede element van de klant en erft dus automatisch diens font, kleur en grootte.

Dit is elegant: de host bezit de styling, wij bezitten de inhoud. Geen CSS-conflict, geen
CSP-gedoe. De grens: je kunt alleen *woorden* variëren binnen bestaande opmaak, geen
*structuur* toevoegen.

## 2. Doel

Een variant moet kunnen kiezen tussen:

- **`content`** (de huidige, veilige default) — tekst/innerHTML/href wisselen, stijl geërfd.
- **`block`** — een rijk, gestyled stuk HTML injecteren dat de **huisstijl van de klant**
  overneemt via design tokens, zonder een stylesheet te importeren die met de host botst.

Een **toggle per variant** bepaalt welke van de twee. Default blijft `content`.

## 3. Datamodel

Een adaptive-block-variant krijgt een veld:

```
renderMode: "content" | "block"   // default "content"
```

Voor `block`-varianten komt daar bij:
- `blockHtml: string` — de markup van het block (door de klant of door AI-generatie
  gemaakt; sluit aan op de bestaande block-bibliotheek en de blueprint-generatie).
- `tokenSetRef?: string` — welke design-token-set het block gebruikt (die laag bestaat al:
  `blockTokenSets` / `defaultTokens`). Ontbreekt hij, dan vallen we terug op de
  tenant-defaults.

## 4. Response-wijziging (decide)

Vandaag is elke slot-waarde een string. We maken de waarde **polymorf**:

```jsonc
{
  "slots": {
    "hero-title":  "Kop voor enterprise",          // content-mode: gewoon een string
    "hero-block":  {                                // block-mode: een object
      "mode": "block",
      "html": "<div class=\"mc-hero\">…</div>",
      "tokens": { "--mc-color-primary": "#0B5", "--mc-font-heading": "Inter, sans-serif" }
    }
  }
}
```

De snippet detecteert per slot: string → content-swap (ongewijzigd gedrag); object met
`mode: "block"` → block-injectie (nieuw). Volledig backward-compatible.

## 5. Snippet-wijziging

Naast de bestaande `data-mc-slot`-afhandeling:

- Een **block-doelwit** in de markup: `data-mc-block="hero"`. Waar een content-slot een
  bestaand `<h1>` aanpast, vervangt een block de **hele `innerHTML`** van zijn container.
- **Scoped token-injectie.** De snippet zet de meegegeven tokens als CSS-custom-properties
  op de container:
  ```
  <div data-mc-block="hero" style="--mc-color-primary:#0B5; --mc-font-heading:Inter">
  ```
  De block-HTML gebruikt `var(--mc-color-primary)` etc., dus hij neemt de huisstijl over
  zonder een externe stylesheet.
- **Style-isolatie zonder shadow DOM.** Bewust géén shadow DOM — dat zou juist de
  token-/huisstijl-overname blokkeren, wat het hele punt is. In plaats daarvan:
  - alle block-classes krijgen een `mc-`-prefix (`.mc-hero`, `.mc-hero__cta`);
  - één keer een minimale, `mc-`-gescopete reset injecteren zodat host-CSS het block niet
    onbedoeld clobbered en andersom;
  - de block-styles worden als één `<style>` met `mc-`-gescopete selectors ingeladen (of
    zijn al inline in de blockHtml).

De FOOC-preventie en de 1500 ms-timeout blijven onveranderd gelden.

## 6. De admin-toggle

Per variant een keuze: **"Inhoud aanpassen"** (veilig, erft stijl, alleen tekst/href) of
**"Vervang door gestyled block"** (huisstijl via tokens). `content` is de default, zodat de
eenvoudige, risicoloze weg de standaard blijft en `block` een bewuste opt-in is.

Bij `block` toont de editor een block-samensteller (leunt op de bestaande block-editor en
token-set-editor) en een token-set-keuze.

## 7. Risico's en afwegingen

- **CSS-botsing blijft mogelijk** bij `block` (geen shadow DOM). De `mc-`-prefix + reset
  mitigeren het, maar 100% isolatie is er niet. Dat is de bewuste prijs voor huisstijl-
  overname. Klanten die volledige isolatie willen boven huisstijl-overname, zouden een
  toekomstige derde modus (`isolated`, shadow DOM) kunnen kiezen — niet nu bouwen.
- **Grootte van de response.** Block-HTML + tokens maken de decide-response zwaarder dan
  een paar strings. Prima voor een handvol blocks per pagina; niet oneindig opschalen.
- **Veiligheid.** De block-HTML komt uit de tenant-config (door de klant/AI gemaakt en
  goedgekeurd), niet uit bezoekersinvoer — net als de huidige `data-mc-html`-weg. Zelfde
  vertrouwensgrens.

## 8. Bouwplan (fasen)

1. **Datamodel + response**: `renderMode` op de variant; decide-response polymorf maken
   (string | block-object). Backward-compatible, met tests.
2. **Snippet**: block-mode toevoegen (`data-mc-block`, token-injectie, `mc-`-scoping),
   content-mode onveranderd. Test tegen een fixture-pagina.
3. **Admin-toggle** + block-samensteller + token-set-keuze per variant.
4. **AI-generatie koppelen** (raakt D1): een gegenereerd block levert meteen `blockHtml`
   + een token-set — kostenbewust, op afroep.

Fase 1 en 2 zijn de kern en raken deze codebase (snippet, decide, datamodel). Fase 3 is
admin-UI. Fase 4 haakt aan op het AI-traject.
