# Design — Chameleon Connect voor WordPress

*Status: ontwerp (19 juli 2026). Analyse + plan, nog niet gebouwd. Doel: de snippet
bruikbaar maken in WordPress, 's werelds populairste CMS, zonder de snippet zelf te
verbouwen.*

## 1. Hoe de snippet vandaag werkt (de basis)

Geanalyseerd in `lib/snippet/snippet-source.ts` en `app/api/snippet/decide/route.ts`:

- Eén `<script data-site-key="sk_live_…" src=".../api/snippet.js" async>` op de pagina.
- De snippet verbergt kort de pagina (opacity 0, FOOC-preventie, timeout 1500 ms),
  verzamelt lichte signalen (pad, referrer, UTM's, `mc_sid`-cookie, keywords), en POST't
  `{ siteKey, context }` naar `/api/snippet/decide`.
- De server resolvet de tenant via de siteKey, draait de lichte beslispijplijn, en
  retourneert `{ slots: { "hero-title": "…", … } }`.
- De snippet zoekt elementen met `data-mc-slot="<key>"` en wisselt `textContent` (of
  `innerHTML` bij `data-mc-html="true"`, of `href` bij `data-mc-slot-href`).
- CORS staat op `*`; de siteKey is een publieke identifier; er wordt alleen CMS-content
  teruggegeven.

**Cruciaal inzicht:** de snippet is volledig framework-agnostisch. Hij draait client-side
op elke pagina, ongeacht hoe die is gerenderd. Hij werkt dus *technisch nu al* op
WordPress. Het probleem is niet de snippet — het is **distributie en markeren** op een
WordPress-manier.

## 2. Doel

Een WordPress-gebruiker moet Chameleon Connect kunnen installeren en slots kunnen
markeren **zonder thema-code aan te raken**, met respect voor de consent-tooling en de
caching die op vrijwel elke WordPress-site draait.

## 3. Wat al meewerkt (geen werk nodig)

- **Cache-veilig.** De snippet draait client-side; caching-plugins (WP Rocket, LiteSpeed)
  serveren de gecachte HTML en de personalisatie gebeurt daarna in de browser. Geen
  conflict — dit is juist een voordeel tegenover server-side personalisatie.
- **Veilige fallback.** Valt het platform weg, dan blijft de originele WordPress-content
  staan (opacity-reveal met timeout).
- **Cross-origin.** CORS `*` op decide betekent dat elk WordPress-domein werkt.

## 4. Wat de plugin moet toevoegen

Een PHP-plugin (`mister-chameleon-connect`) met drie verantwoordelijkheden:

### 4a. De snippet inladen
Via `wp_enqueue_script` op de `wp_head`- of `wp_footer`-hook, met de tenant-config. De
beheerder plakt geen `<script>`; hij installeert de plugin en vult in een instellingen-
pagina zijn **siteKey** in. De plugin rendert dan het scripttag met `data-site-key`.

### 4b. Slots markeren zonder code — drie mechanismen naast elkaar
WordPress-gebruikers bewerken geen thema-HTML. Dit is het echte werk:

1. **Gutenberg-block** — een "Adaptive Slot"-block dat een `data-mc-slot` om zijn inhoud
   zet. Sleep het block in de editor, kies de slot-key.
2. **Shortcode** — `[mc_slot key="hero-title"]Standaardtekst[/mc_slot]` voor de klassieke
   editor en overal waar shortcodes werken.
3. **Selector-gebaseerde slots** — het krachtigst, en de enige uitbreiding die de snippet
   raakt (zie §5). In de admin koppel je een slot aan een **CSS-selector** (`.hero h1`),
   zodat de snippet het element vindt zónder dat er ergens een `data-mc-slot` in de markup
   hoeft. Dit is wat het bruikbaar maakt met page builders (Elementor, Divi, Beaver),
   waar de gebruiker de HTML niet in handen heeft.

### 4c. Consent respecteren
Integreren met de gangbare WordPress-consent-plugins (Complianz, Cookiebot, CookieYes):
de snippet pas activeren zodra de vereiste toestemmingscategorie is gegeven. De plugin
detecteert de aanwezige consent-oplossing en haakt in op hun API/JS-events.

## 5. De enige snippet-wijziging: selector-gebaseerde slots

Vandaag matcht de snippet alleen op `[data-mc-slot="key"]`. Voor §4b-3 moet de
decide-response (of de tenant-config) een **slot→selector-map** kunnen meegeven, en de
snippet moet dan `document.querySelectorAll(selector)` gebruiken in plaats van alleen de
data-attribuut-match. Dit is een kleine, additieve uitbreiding — de bestaande
`data-mc-slot`-weg blijft werken.

Vorm (voorstel): de decide-response krijgt optioneel een `selectors`-map:
```
{ "slots": { "hero-title": "…" }, "selectors": { "hero-title": ".hero h1" } }
```
De snippet: eerst `data-mc-slot`-elementen, dan (indien aanwezig) de selector-match.
Beveiliging: selectors komen uit de tenant-config (door de beheerder ingesteld), niet uit
bezoekersinvoer.

## 6. Architectuur

```
WordPress-site
  └─ mister-chameleon-connect (PHP-plugin)
       ├─ Settings page          → siteKey + slot/selector-mapping
       ├─ wp_enqueue_script      → laadt /api/snippet.js met data-site-key
       ├─ Gutenberg block        → "Adaptive Slot"
       ├─ [mc_slot] shortcode
       └─ Consent-integratie     → Complianz / Cookiebot / CookieYes
Platform (ongewijzigd, op één punt na)
  ├─ /api/snippet.js            → serveert de snippet
  └─ /api/snippet/decide        → + optionele `selectors`-map in de response
```

## 7. Openstaande beslissingen

- **Distributie:** in de officiële WordPress-plugin-directory (review-proces, groot
  bereik) of als eigen download/updater? De directory geeft vertrouwen maar kost een
  reviewronde.
- **Slot-mapping opslag:** in de WordPress-DB (plugin-instellingen) of centraal in het
  platform per tenant? Centraal is consistenter met de rest, maar vraagt een sync.
- **Live preview in de WP-editor:** willen we dat de beheerder de varianten in de editor
  ziet? Kan later.

## 8. Bouwplan (fasen)

1. **Snippet: selector-support** (klein, in dit platform) + test.
2. **Plugin-skelet**: settings page + siteKey + script-enqueue. Werkt met bestaande
   `data-mc-slot`-markup.
3. **Slot-marking**: shortcode + Gutenberg-block.
4. **Selector-mapping-UI** (leunt op §1).
5. **Consent-integraties** (één voor één: Complianz, Cookiebot, CookieYes).
6. **Verpakken + distributie** (directory-review of eigen updater).

Fase 1 is het enige dat deze codebase raakt; de rest is een aparte PHP-repo
(`mister-chameleon-wordpress`), net zoals de Statamic-addon een eigen repo is.
