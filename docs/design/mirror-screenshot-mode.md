# Ontwerp — Mirror screenshot-modus (managed render)

Status: **backlog / ontwerp** (nog niet gebouwd). Opgesteld 29 aug 2026.

## Waarom

De zelf-gehoste headless Chrome launcht niet in prod: `libnss3.so: cannot open shared
object file` — een systeem-library die de Vercel-runtime (`@sparticuz/chromium-min`) niet
levert. Twee generaties waren byte-identiek aan plain fetch (Chrome start nooit). Verder in
die serverless-Chromium-put graven is niet de moeite waard. In plaats daarvan: de visuele
laag via een **managed screenshot-API**, en de personalisatie via **onze eigen overlays**.
Dat omzeilt Chromium-op-Vercel volledig.

## Architectuur (drie losse, managed stappen — geen eigen Chrome)

1. **Screenshot** — capture één full-page screenshot van de prospect-site via een managed
   API (JS-gerenderd, cookie-banners weg, lazy-load afgehandeld). Eénmalig bij generatie,
   opslaan (blob/URL). Dit is de visuele laag: pixel-perfect, geen kapotte assets/CSS.
2. **Regio's** — stuur de screenshot naar Claude-vision → bounding-boxes (als **fractie**
   van de afbeeldingsafmetingen) voor de personaliseerbare slots (hero-kop, subtitel,
   primaire CTA, proof) + de originele tekst per regio. Geen eigen DOM/Chrome nodig.
3. **Varianten** — hergebruik de bestaande AI-slot-analyzer: 6 scenario-varianten per slot.
   (Tekst-input kan uit de plain-fetch-HTML — die werkt al — of uit de vision-stap.)

**Serve:** de demo-pagina rendert de screenshot als basislaag, met absoluut-gepositioneerde
overlays op de vision-regio's (in %), die per persona/scenario van tekst wisselen, gestyled
met de al-geëxtraheerde brand-tokens.

## Managed screenshot-API — keuze (geverifieerd)

**ScreenshotOne** — aanbevolen startpunt:
- **100 screenshots/maand gratis**, geen creditcard. Ruim voldoende voor demo-volume
  (één capture per generatie).
- Full-page, JS-render, **50k+ banner/cookie-blokkeerregels**, lazy-load-afhandeling,
  custom JS/CSS.
- Betaald pas bij schaal: $17/2.000, $79/10.000 — pas relevant ver voorbij demo-gebruik.
- Alternatieven: **ApiFlash** (goedkoop, echte Chrome), **Urlbox** (hi-fi, betaald),
  **Microlink** (metadata + capture). ScreenshotOne wint op free tier + banner-handling.

Kosten voor onze use-case: **€0** (ver onder 100/maand).

## Fasering

- **MVP — geannoteerde hotspots:** screenshot met de personaliseerbare regio's omkaderd +
  een callout die per persona de variant toont. Robuust, glashelder voor een sales-gesprek,
  simpel te bouwen. Vision hoeft alleen grove regio's te geven.
- **Polish — naadloze in-place swap:** dekkend maskje in de regio-achtergrondkleur + de
  variant-tekst in het gematchte font, zodat het lijkt of de site zelf personaliseert.
  Vraagt preciezere regio's + achtergrond/font-match uit de vision-stap.

## Wat dit vervangt / hergebruikt

- **Vervangt:** de DOM-kloon-render, de asset-proxy (#325/#329) en de slot-injectie in een
  vreemde DOM — allemaal overbodig; de screenshot regelt de visuals, onze overlays de
  personalisatie.
- **Hergebruikt:** de AI-slot-analyzer (varianten), de brand-token-extractie, en de
  scenario/persona-console.
- **Zelf-gehoste Chrome:** kan blijven bestaan als optionele "live mirror" voor simpele
  sites, maar is niet langer kritiek — de render-outcome-zichtbaarheid (#332) laat zien
  wanneer die faalt en terugvalt.

## Config / randvoorwaarden
- `SCREENSHOTONE_API_KEY` als platform-secret (env), net als andere provider-keys.
- Screenshot éénmalig bij generatie cachen (blob/URL in `demo_instances`), niet per view.
- Vision-call via de bestaande Claude-integratie; regio's als fracties opslaan zodat ze
  schaal-onafhankelijk over de screenshot leggen.
- Fail-open: geen screenshot/regio's → val terug op de huidige (plain-fetch) mirror.

## Bronnen (verificatie)
- ScreenshotOne — 100/maand gratis, full-page + banner-handling (screenshotone.com).
- Vergelijkingen 2026: Scrapfly / Olostep / HookRay screenshot-API-overzichten.
- Element-clip/selector + `getBoundingClientRect`-patroon (ScreenshotAPI/Puppeteer-docs) —
  achtergrond voor de regio-aanpak; wij kiezen vision i.p.v. eigen DOM-toegang.
