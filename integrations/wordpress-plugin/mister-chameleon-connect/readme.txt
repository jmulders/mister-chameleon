=== Mister Chameleon Connect ===
Contributors: misterchameleon
Tags: personalization, cro, personalisatie, ab-testing, content
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 0.4.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Real-time contentpersonalisatie via de Mister Chameleon-snippet. SiteKey invullen, slots markeren — geen thema-code.

== Description ==

Mister Chameleon Connect verbindt je WordPress-site met het Mister Chameleon-platform,
zodat je bestaande pagina's real-time per bezoeker gepersonaliseerd worden.

* Laadt de snippet via `wp_enqueue_script` — de nette WordPress-weg, die niet door
  beveiligingsplugins (zoals Wordfence) als "unsafe operation" wordt geblokkeerd.
* Markeer slots zonder thema-code: een **Adaptive Slot**-block én een
  `[mc_slot]`-shortcode. Beide renderen een gewone inline `data-mc-slot`-span, dus
  géén iframe/sandbox waar de snippet niet bij kan.
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
