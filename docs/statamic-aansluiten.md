# Statamic aansluiten

Er zijn twee manieren om een Statamic-site op Mister Chameleon aan te sluiten.
Kies op basis van wat je nodig hebt.

## Snel kiezen

| Wil je…                                                        | Kies             |
|----------------------------------------------------------------|------------------|
| Alleen personalisatie / een formulier op bestaande pagina's    | **Snippet**      |
| Adaptieve **blokken in de page-builder** (blok kiezen in de CMS) | **Add-on**       |

De snippet is nul-installatie (één scripttag). De add-on is een Composer-pakket
dat de blokken + fieldsets in de Statamic-page-builder zet — dát kan de snippet
niet.

---

## Optie A — Snippet (geen installatie)

Voor personalisatie of formulieren op een bestaande site, zonder iets te
installeren.

1. Eén scripttag, vlak voor `</body>` (siteKey uit **Tenant → Platform →
   Snippet → Generate site key**):

   ```html
   <script async
     src="https://www.misterchameleon.nl/api/snippet.js"
     data-site-key="sk_live_…"
     data-mc-consent="granted"></script>
   ```

2. Markers in de templates waar iets moet gebeuren:

   ```html
   <h1 data-mc-slot="hero-title">Standaard kop</h1>          <!-- tekst-swap -->
   <div data-mc-block="form:contact"></div>                 <!-- adaptief formulier -->
   ```

De snippet vult/wisselt in de browser. Werkt achter cache/CDN. Geen page-builder.

---

## Optie B — Add-on (page-builder-blokken)

Voor het toevoegen van adaptieve blokken via de Statamic-page-builder. Dit is een
**privaat, gelicentieerd Composer-pakket** (Private Packagist). De install is
teruggebracht tot drie stappen.

### 1. Pakket installeren (eenmalig de Packagist-token)

```json
// composer.json van de klant
"repositories": [
  { "type": "composer", "url": "https://repo.packagist.com/<jouw-org>/" }
]
```

```bash
composer config --global --auth http-basic.repo.packagist.com token <token>
composer require mister-chameleon/statamic:^1.0
```

### 2. Eén env-var zetten

`api_url` en `timeout` hebben al goede defaults; je hoeft alleen de siteKey te
zetten (en voor een bestaande, gecachte site de modus op `client`):

```dotenv
MISTER_CHAMELEON_TENANT_KEY=sk_live_…      # Tenant → Platform → Snippet → Generate
MISTER_CHAMELEON_MODE=client               # bestaande/gecachte site; laat weg voor edge
```

> `api_url` defaultt naar `https://www.misterchameleon.nl` (de **www**-host,
> zodat je niet tegen een apex-redirect aanloopt). Alleen overschrijven als je
> een andere platform-URL gebruikt.

### 3. Eén install-commando

```bash
php please mc:install
```

Dit publiceert de config + block-fieldsets, haalt de platform-artefacten op
(`mc:sync`) en leegt de Stache — in één keer.

### Gebruiken

- Kies in een entry via de page-builder het blok **"Mister Chameleon — Context
  Slot"** en zet het slottype (Hero, Proof, CTA, Feature, Conversion,
  Notification, of **Form — Contact/Application/Appointment**).
- Voeg één keer de runtime toe vóór `</body>` (nodig voor `client`/`hybrid` en
  impressie-tracking):

  ```antlers
  {{ mc:snippet }}
  ```

- De fallback-inhoud die je in de entry invult is wat bots en offline-fallback
  krijgen — de pagina is dus altijd compleet en SEO-veilig.

### Bijwerken

Als het platform nieuwe blokken/velden krijgt: op de Statamic-site opnieuw
`php please mc:sync && php please stache:clear` (of `php please mc:install`).
