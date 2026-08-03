# Adaptieve content — waar komt het vandaan

Kort naslagwerk zodat we niet elke keer opnieuw uitzoeken welk systeem welke content
levert. Vastgelegd 2 augustus 2026.

## Twee rendermodellen

Een tenant kan er twee tegelijk draaien; ze bijten elkaar niet.

**1. Snippet (externe site).** De klant houdt zijn eigen site en CMS en plakt alleen de
snippet erop — via los script, de add-on of de WordPress-plugin. De snippet wisselt per
bezoeker de adaptieve blokken (hero/proof/cta/feature/conversion/notification) om.
Routes: `/api/snippet/decide` en `/api/v1/slot`.

**2. Platform-gehost (eigen site via ons).** Wij renderen de hele pagina, inclusief
gewone content én de adaptieve blokken. Route: de homepage-pipeline
(`composeHomepageExperience`).

## Waar de variant-content vandaan komt

Dit is de kern, en waar eerder de verwarring zat.

**Snippet-pad: platform-first.** De adaptieve varianten die de snippet inlaadt komen
**altijd eerst uit onze platform-store** (`platform_cms_content`, via
`PlatformCMSProvider`). Alleen als daar geen entry voor een key staat, valt het terug op
de CMS-provider van de tenant. Zo geldt het principe: *de adaptieve blokken worden in ons
platform gemaakt en vanuit ons platform geserveerd*, ongeacht welk CMS de klant voor zijn
eigen pagina's gebruikt. Geïmplementeerd in `cms/providers/platform-first-variants.ts`,
gebruikt door beide snippet-routes.

**Platform-gehost pad: tenant-CMS.** De volledige rendering (pagina's, site-settings én
varianten) komt via de CMS-provider van de tenant (`createCMSProvider(tenant.cms, …)`).
Hier kan een externe CMS (Sanity/Statamic/Storyblok) dus wél de varianten leveren, omdat
we daar de hele site uit die bron opbouwen.

Gevolg: een tenant met **beide** modellen levert snippet-varianten platform-native, en
zijn eigen platform-gehoste site uit zijn eigen CMS — zonder dat het botst.

## De drie content-stores (niet door elkaar halen)

- **`platform_cms_content`** — de platform-eigen variant-store. Bewerk je in de admin
  onder Content (de platform-varianteneditor, zichtbaar als `cms.provider = "platform"`).
  Dit is de bron voor snippet-varianten (platform-first).
- **`adaptive_blocks`** — aparte tabel voor de ChameleonHero "Adaptive Blocks" (blok met
  meerdere inline varianten). Bewerkt via de admin "Personalization → Blocks"-pagina.
  Let op: de snippet-slots lezen deze tabel **niet**; verwar 'm niet met de variant-store.
- **Externe CMS** (Sanity/Statamic/Storyblok) — de eigen site-content van de klant, plus
  varianten in het platform-gehoste model. Niet nodig voor snippet-only klanten.

## Aanbevolen inrichting per klanttype

- **Snippet-only** (zoals nascita, of een adverteerder): zet de varianten in
  `platform_cms_content` (Content-tab). Door platform-first serveert de snippet die
  automatisch. **Zet `cms_provider` NIET op `platform`.** Laat 'm op null/Sanity: dan blijft
  de externe CMS de fallback voor keys die je nog niet gemigreerd hebt. Zet je 'm wél op
  `platform`, dan wordt de fallback óók de (deels lege) platform-store en krijg je lege
  slots voor niet-gemigreerde keys — het "soms wel, soms niet"-gedrag. Pas de provider pas
  aan als je élke door de regels kiesbare key naar het platform hebt gemigreerd.
- **Platform-gehost met eigen CMS**: de tenant-CMS levert alles; niks te doen aan de
  snippet-kant.
- **Beide**: allebei bovenstaande naast elkaar. Geen conflict.

## Fallback-content (als de snippet niet laadt)

Progressive enhancement: het slot bevat **standaard je fallback-content in de HTML**, en
de snippet wisselt die *in place* om zodra hij een variant heeft.

- **WordPress-plugin:** wat je in het Adaptive Slot-block typt, ís de fallback.
- **Add-on / losse HTML:** zet de fallback als begininhoud van het `data-mc-slot`-element.

Laat het **niet leeg**, om drie redenen: geen lege of springende sectie als de snippet
niet laadt (JS uit, netwerkfout, ad-blocker); de bezoeker ziet altijd iets zinnigs; en
zoekmachines indexeren die fallback als de echte content. De personalisatie is een
verbetering bovenop een pagina die zónder de snippet ook klopt.

Nuance: bij client-side wisselen kan er een korte flits zijn (fallback → variant). Dat
hoort bij snippet-personalisatie. Je kunt het slot heel even verbergen tot de beslissing
binnen is, maar dan is een gefaalde snippet wél leeg — dus de veiligste keuze is de
fallback zichtbaar laten. Wil je gegarandeerd geen flits, dan is het platform-gehoste
(server-side) pad beter.

## Server-side fallback (als de snippet wél laadt maar er niks resolvet)

Los van de HTML-fallback heeft de decide-laag zijn eigen vangnet: mist een variant-key
zijn content, dan valt het plan terug op de `FALLBACK_PLAN`-keys, en ontbreekt díé ook,
dan een statische noodervaring. Zorg dus dat elke variant-key die een regel kan kiezen,
content heeft in de bron die geldt (platform-store voor snippet). Zie ook de demo-ervaring
op de statamic-tenant, waar ontbrekende fallback-varianten de personalisatie platlegden.
