# Google Tag Manager wacht op toestemming

Een tenant kan een eigen Tag Manager-container instellen (`gtm.containerId`). Wat er
in die container draait bepaalt de tenant, niet het platform. Daarom houdt het
platform de container zelf tegen tot de bezoeker iets heeft toegestaan.

## De regel

Voor een tenant die de banner van het platform toont:

- Heeft de bezoeker nog niet gekozen, of koos die "alleen essentieel", dan laadt de
  container niet. Er gaat geen verzoek naar Google en geen tag draait.
- Staat de bezoeker analytics, verrijking of advertenties toe, dan laadt de container.
  Dat gebeurt direct bij de keuze in de banner, zonder de pagina te verversen.
- Personalisatie alleen is niet genoeg. Die categorie is van het platform zelf.

Een tenant die de banner heeft uitgezet (`privacy.showConsentBanner = false`) vraagt
op zijn eigen manier toestemming. Daar laadt de container zoals voorheen.

Een container die al draait kan niet meer van de pagina af. Trekt een bezoeker de
toestemming in, dan krijgt de container dat te horen en laadt hij vanaf de volgende
pagina niet meer.

Code: `tracking/gtm-consent.ts`, `components/tracking/GtmLoader.tsx`, `app/layout.tsx`.
Test: `tests/consent/gtm-waits-for-consent.test.ts`.

## Wat de container te horen krijgt

Voor de container start, en opnieuw bij elke wijziging, staat in de dataLayer:

1. De keuze in de termen van Google (Consent Mode v2). Tags van Google houden zich
   daar zelf aan.

   | Google | Categorie van het platform |
   | --- | --- |
   | `analytics_storage` | analytics |
   | `ad_storage`, `ad_user_data`, `ad_personalization` | advertenties |

2. Het event `mc_consent` met per categorie waar of onwaar:
   `mc_consent_analytics`, `mc_consent_personalization`, `mc_consent_enrichment`,
   `mc_consent_advertising`.

## Google Analytics op dezelfde pagina

Een tenant kan ook Google Analytics via het platform laten laden (`ga4.tracking` met
verzendwijze "client"). Analytics start alleen als de bezoeker analytics toestaat, en
dat gebeurt direct bij de keuze in de banner.

Google wil de keuze van de bezoeker weten vóór de eerste `config`. Zonder die melding
gaat Google ervan uit dat alles mag, ook advertenties. Daarom heeft de pagina één
melder voor de keuze, die Analytics en Tag Manager delen:

- Wie het eerst start, zet de keuze als `consent default` in de dataLayer, vóór zijn
  eigen opdrachten. Dat geldt ook voor een tenant met Analytics en zonder container.
- De ander meldt dezelfde keuze niet nog een keer.
- Een latere wijziging komt één keer als `consent update`. Verandert er alleen iets
  in personalisatie of verrijking, dan krijgt Google niets nieuws te horen. De
  container krijgt dan wel het event `mc_consent`.

Code: `tracking/google-consent.ts`, `tracking/ga4-consent.ts`,
`components/tracking/Ga4TrackingProvider.tsx`, `components/tracking/google-tag-page.ts`.
Test: `tests/consent/ga4-consent-default-first.test.ts`.

## Een tag aan zijn eigen categorie houden

De container laadt zodra een van de drie categorieën is toegestaan. Een bezoeker die
alleen analytics toestaat krijgt dus ook de container. Een tag die niet van Google is
en bij een andere categorie hoort, moet je daarom in Tag Manager zelf aan die
categorie koppelen. Voorbeeld voor een Leadinfo-tag, die bij verrijking hoort:

1. Maak een variabele van het type "Gegevenslaagvariabele" met de naam
   `mc_consent_enrichment`.
2. Maak een trigger van het type "Aangepaste gebeurtenis" met de naam `mc_consent` en
   de voorwaarde dat `mc_consent_enrichment` gelijk is aan `true`.
3. Zet die trigger op de tag in plaats van "Alle pagina's", en zet de tag op een keer
   per pagina.
