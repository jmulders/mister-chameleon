# Een WordPress-site aansluiten op Mister Chameleon

*Praktische handleiding. De snippet is framework-agnostisch en werkt technisch op
elke WordPress-site — je hoeft niets aan de server te veranderen. Drie stappen:
siteKey → script in de `<head>` → aangeven wat gepersonaliseerd wordt.*

---

## Stap 1 — siteKey ophalen (in het MC-platform)

Ga in de admin naar de tenant → **Snippet**. Zet de integratie **aan** (Enable) en
genereer/kopieer de `sk_live_…`-siteKey. De siteKey is een publieke identifier —
veilig om in de pagina-HTML te zetten.

## Stap 2 — Het script in de `<head>` van de WP-site

WordPress laat je normaal geen `<head>` bewerken, dus gebruik een header-plugin.

1. Installeer en activeer **WPCode** ("Insert Headers and Footers").
2. Ga naar **Code Snippets → Header & footer**.
3. Plak in het **Header**-veld (met je eigen key):

   ```html
   <script src="https://www.misterchameleon.nl/api/snippet.js" data-site-key="sk_live_JOUW_KEY" async></script>
   ```

4. Klik **Wijzigingen opslaan**.

> **Wordfence?** Die blokkeert het opslaan van een `<script>` als "A potentially
> unsafe operation" (403). Dat is een bekende false-positive. Op die blokkeerpagina
> vink je *"I am certain this is a false positive"* aan en klik je
> *"Allowlist This Action"*; daarna opslaan. (Zodra de speciale plugin er is —
> zie onderaan — vervalt deze stap, want die laadt de snippet via
> `wp_enqueue_script` en dat triggert Wordfence niet.)

De snippet laadt nu op **elke** pagina, maar verandert nog niets tot stap 3.

## Stap 3 — Aangeven wát gepersonaliseerd wordt

Twee wegen. Ze werken naast elkaar.

### 3a. `data-mc-slot` in de markup

Zet op een element een slot-attribuut:

```html
<h1 data-mc-slot="hero-title">Standaard kop</h1>
<p  data-mc-slot="hero-subtitle">Standaard subtekst</p>
<a  data-mc-slot="hero-cta-label" data-mc-slot-href="hero-cta-href" href="/aanmelden">Meld je aan</a>
```

De snippet wisselt `textContent` (of `innerHTML` bij `data-mc-html="true"`, of `href`
bij `data-mc-slot-href`).

> **Let op — HTML-block valkuil.** Doe dit via een **inline** HTML-block. Sommige
> "fancy" HTML-blokken (bv. bPlugins' *Aangepaste HTML*) stoppen de inhoud in een
> iframe/sandbox, waardoor de snippet er niet bij kan en de swap uitblijft. Gebruik
> de eenvoudige *core* HTML-block, of de selector-weg hieronder.

### 3b. Selectors (geen markup nodig) — aanrader voor WordPress

Koppel een slot aan een **CSS-selector**. Ideaal voor thema-titels
(`h1.entry-title`) en page builders (Elementor/Divi) waar je de HTML niet in handen
hebt. **Scope per pagina** met de body-class, zodat andere pagina's ongemoeid blijven:

```
hero-title  →  .page-id-123 h1.entry-title
```

Op dit moment zet je dat in de tenant-config (`snippet.selectorMap`). Direct in de DB:

```sql
UPDATE tenant_settings
SET settings = jsonb_set(settings, '{snippet,selectorMap}',
      '{"hero-title": ".page-id-123 h1.entry-title"}'::jsonb, true),
    updated_at = now()
WHERE id = 'JOUW_TENANT_ID';
```

Terugdraaien: `UPDATE tenant_settings SET settings = settings #- '{snippet,selectorMap}' WHERE id = 'JOUW_TENANT_ID';`

Zodra `feat/snippet-selector-admin` gemerged en gedeployed is, beheer je dit
vanuit **Snippet → Selectors** in de admin — zonder SQL.

## Veelgebruikte slot-namen

`hero-title`, `hero-subtitle`, `hero-tag`, `hero-cta-label`, `hero-cta-href`,
`proof-title`, `cta-title`, `cta-text`, `cta-cta-label`, `cta-cta-href`,
`feature-title`, `feature-subtitle`, `conversion-title`, `notification-message`.

## Controleren of het werkt

1. Open de pagina en check in de DevTools-console:
   `document.querySelectorAll('script[data-site-key]').length` → moet `1` zijn.
2. Test de beslis-endpoint (geeft 200 + `slots`, en `selectors` als je die hebt gezet):

   ```js
   fetch('https://www.misterchameleon.nl/api/snippet/decide', {
     method:'POST', headers:{'Content-Type':'application/json'},
     body: JSON.stringify({ siteKey:'sk_live_JOUW_KEY', context:{ path: location.pathname } })
   }).then(r=>r.json()).then(console.log)
   ```

   - **403 "not enabled"** → snippet staat uit voor de tenant (stap 1).
   - **403 "Unknown site key"** → verkeerde/onbekende siteKey.
   - **200 met lege `slots`** → tenant heeft (nog) geen matchende content/regels.

## Fail-safes (zelf geregeld door de snippet)

- **FOOC-preventie:** de pagina wordt kort verborgen tot de swap klaar is.
- **Timeout 1500 ms:** reageert de endpoint niet, dan toont de pagina gewoon de
  originele WordPress-content — geen zichtbare vertraging.
- **CORS `*`:** werkt vanaf elk domein.
- **Caching-veilig:** de personalisatie gebeurt client-side, ná de cache.

---

## En een echte plugin?

Bovenstaande is de handmatige route. Een **`mister-chameleon-connect`-plugin**
automatiseert precies de wrijving hierboven: een instellingen-pagina met alleen een
siteKey-veld, laden via `wp_enqueue_script` (geen Wordfence-gedoe), een "Adaptive
Slot"-Gutenberg-block + `[mc_slot]`-shortcode, een selector-mapping-UI en
consent-integratie (Complianz/Cookiebot/CookieYes). Ontwerp en fasering staan in
[`docs/design/snippet-wordpress-plugin.md`](./design/snippet-wordpress-plugin.md).
Het platform-deel (snippet-selector-support + decide-`selectors`) is al gebouwd; de
plugin zelf is een aparte PHP-repo.
