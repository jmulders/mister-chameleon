=== Mister Chameleon Connect ===
Contributors: misterchameleon
Tags: personalization, cro, personalisatie, ab-testing, content
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.5.9
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Real-time contentpersonalisatie via de Mister Chameleon-snippet. SiteKey invullen, slots markeren — geen thema-code.

== Description ==

Mister Chameleon Connect verbindt je WordPress-site met het Mister Chameleon-platform,
zodat je bestaande pagina's real-time per bezoeker gepersonaliseerd worden.

* Laadt de snippet via `wp_enqueue_script` — de nette WordPress-weg, die niet door
  beveiligingsplugins (zoals Wordfence) als "unsafe operation" wordt geblokkeerd.
* Voeg een volledig **Adaptive Block** in (Gutenberg-block óf `[mc_block key="hero"]`-
  shortcode): het platform toont per bezoeker de juiste variant van een heel blok
  (hero, features, social proof, cta, notification). De inhoud die je opmaakt is de
  standaard/fallback. Voor fijnmazige tekst-swaps bestaat de `[mc_slot]`-shortcode nog.
* Consent-vriendelijk via de `mcc_should_enqueue`-filter (haakpunt voor Complianz,
  Cookiebot, CookieYes).

De snippet zelf regelt FOOC-preventie (geen flikkering), een 1500 ms fail-safe
(bij uitval blijft de originele content staan) en CORS.

== Installation ==

1. Upload de map `mister-chameleon-connect` naar `/wp-content/plugins/`, of installeer
   de zip via Plugins → Nieuwe plugin → Plugin uploaden.
2. Activeer de plugin.
3. Ga naar Instellingen → Mister Chameleon, vul je siteKey in en zet de integratie aan.
4. Markeer slots met het Adaptive Slot-block of `[mc_slot key="hero-title"]…[/mc_slot]`.

== Frequently Asked Questions ==

= Waar vind ik mijn siteKey? =
In het Mister Chameleon-platform: tenant → Snippet → siteKey genereren.

= Werkt dit met caching? =
Ja. De personalisatie gebeurt client-side, ná de cache — dus cache-plugins zijn geen probleem.

= En page builders (Elementor/Divi)? =
Daar heb je de HTML niet altijd in handen. Gebruik dan de selector-mapping in het
platform (Snippet → Selectors) in plaats van slots in de markup.

== Changelog ==

= 0.5.9 =
* Adaptief formulier: het Adaptive Block-block heeft nu één **Form**-slottype met
  een apart **Form type**-veld (Contact, Application of Appointment) — in plaats van
  drie losse "Form — …"-opties. Zo is de keuze gelijk aan de Statamic-add-on. Het
  platform rendert het gekozen formulier per bezoeker; de snippet bedraadt het
  verzenden.
* Compatibiliteit getest tot WordPress 7.0.

= 0.5.8 =
* Onderhoudsrelease: geen functionele wijziging. Dient om het nieuwe
  plugin-icoon zichtbaar te maken op het updatescherm (het icoon wordt getekend
  door de geïnstalleerde 0.5.7+-code).

= 0.5.7 =
* Plugin-icoon: de plugin toont nu een eigen icoon op het Plugins- en
  Updates-scherm (i.p.v. de grijze standaard-placeholder). Het icoon wordt
  meegestuurd in de zelf-gehoste update-informatie.

= 0.5.6 =
* Update-diagnose voortaan verborgen: de instellingenpagina is weer schoon. Roep
  het diagnosepaneel bij nood op door `?mcc_diag=1` aan de instellingen-URL te
  hangen — het toont de live-check plus de antwoord-body en headers, zodat de
  bron van een eventuele blokkade (app-limiter / Cloudflare / Vercel) meteen
  zichtbaar is. Achtergrond: de update-detectie werd geblokkeerd door Vercel Bot
  Protection, die server-to-server-calls met een JS-challenge (429) wegstuurde;
  opgelost met een Firewall-bypass voor de machine-endpoints.

= 0.5.5 =
* Verificatie-release om de gecorrigeerde auto-update-detectie (0.5.4) te testen.
  Geen functionele wijziging t.o.v. 0.5.4.

= 0.5.4 =
* Fix van de auto-update-detectie uit 0.5.2/0.5.3: de `update_plugins_{host}`-filter
  gaf de verkeerde sleutel terug (`version` i.p.v. het door WordPress vereiste
  `new_version`) en miste het `plugin`-veld, waardoor WordPress de update niet toonde.
  Daarnaast omzeilt een handmatige "Opnieuw controleren" nu direct de plugin-cache,
  zodat een net uitgebrachte versie meteen zichtbaar is.

= 0.5.3 =
* Verificatie-release om de nieuwe auto-update-detectie (Update URI, sinds 0.5.2)
  te testen. Bevat het volledige 0.5.2-mechanisme; geen verdere functionele
  wijziging.

= 0.5.2 =
* Betrouwbare update-detectie: de plugin declareert nu een `Update URI`-header en
  gebruikt WordPress' officiële `update_plugins_{host}`-mechanisme (WP 5.8+). WordPress
  routeert de update-check voortaan rechtstreeks naar het platform (nooit meer naar
  WordPress.org), waardoor een nieuwe versie direct in het plugin-scherm verschijnt.
  De oude transient-injectie blijft als fallback. Dit is een eenmalige handmatige
  update; daarna gaan alle volgende updates vanzelf.

= 0.5.1 =
* Self-updater: een handmatige "Opnieuw controleren" op het Updates-scherm ververst
  nu ook de eigen update-cache van de plugin (voorheen bleef een nieuwe versie tot 6
  uur verborgen). De cache-TTL is bovendien teruggebracht van 6 uur naar 1 uur, zodat
  updates sowieso sneller verschijnen.

= 0.5.0 =
* Adaptive Block (heel blok): het slot-block voegt nu een volledig adaptief blok in
  (`data-mc-block`) dat het platform per bezoeker in de juiste variant toont — zoals
  de adaptive slot in Statamic — in plaats van losse tekst-elementen. Je maakt de
  standaard/fallback-inhoud op met gewone blokken (InnerBlocks). Ook nieuw: de
  `[mc_block key="hero"]…[/mc_block]`-shortcode.
* Block-scoped anti-flikker (Optimizely/VWO-stijl): alleen de adaptieve blokken
  blijven verborgen tot ze geswapt zijn — de rest van de pagina rendert direct. Elk
  blok komt tevoorschijn zodra het geswapt is, met een 1500 ms fail-safe.

= 0.4.0 =
* Zelf-update via het platform: WordPress toont voortaan updates in het
  plugin-scherm (checkt `{endpoint}/api/wp-plugin/update`), zonder de
  WordPress.org-directory.

= 0.3.0 =
* Anti-flikker (FOOC): kleine synchrone inline-regel in de <head> die de pagina
  vóór de eerste paint verbergt en na de swap (of een veilige timeout) onthult.
  Zo zie je de standaardtekst niet meer even oplichten.

= 0.2.0 =
* Adaptive Slot-block: slot-key nu via een dropdown met bekende keys (datalist),
  vrij typen blijft mogelijk voor nieuwe keys.

= 0.1.0 =
* Eerste versie: instellingen (siteKey/aan-uit/endpoint), snippet-enqueue,
  Adaptive Slot-block, `[mc_slot]`-shortcode, consent-filter.
