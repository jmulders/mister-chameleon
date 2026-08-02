# Grondslag voor verrijking en profilering

**Status: concept, geen juridisch advies.** Onderbouwing van de grondslag onder
de AVG voor het opbouwen van bezoekersprofielen en het verrijken van
IP-adressen. Bedoeld als interne onderbouwing én als bijlage die de
verwerkingsverantwoordelijke (de Klant) kan gebruiken voor zijn eigen
privacyverklaring en afweging. Laat toetsen door een privacyjurist.

Laatst bijgewerkt: 2 augustus 2026

---

## Kern: het platform draait op toestemming, niet enkel op gerechtvaardigd belang

Een veelgehoorde aanname is dat IP-naar-bedrijf verrijking "zakelijk en dus
onpersoonlijk" is en op gerechtvaardigd belang kan. Dat klopt niet zonder meer:

- Een **IP-adres is in de EU doorgaans een persoonsgegeven**, ook als de uitkomst
  een bedrijfsnaam is.
- Dat je **geen cookies** gebruikt helpt tegen de ePrivacy-kant, niet tegen de
  AVG-kant. De verwerking blijft een verwerking.
- **Server-side** verwerken verandert de grondslag niet.

Het platform kiest daarom een **gelaagd, consent-gestuurd model** (zie
`lib/lead-base/profile-gate.ts`). Dat is strenger dan pure grondslag
gerechtvaardigd belang, en het is precies wat je privacy-positionering
onderscheidt van de Amerikaanse platformen.

## De drie lagen en hun grondslag

| Laag | Wat | Grondslag | Voorwaarde in de code |
|---|---|---|---|
| **Essentieel / pseudoniem** | `visitor_key`, aantal bezoeken, eerste/laatste bezoek | **Gerechtvaardigd belang** (art. 6-1-f) — noodzakelijk om de dienst te leveren en misbruik te beperken; minimale, pseudonieme gegevens | Altijd toegestaan |
| **Gedragsprofilering** | bekeken pagina's, interesse-scores, funnelfase, segmenten | **Toestemming** (`personalization`) | Alleen weggeschreven bij `personalization`-consent |
| **Firmografische verrijking** | bedrijfsnaam, domein, grootte, sector, geo | **Toestemming** (`enrichment`) | Alleen weggeschreven bij `enrichment`-consent; verrijkingssubverwerkers draaien alleen dan |

Zonder respons op de consentvraag (`consentState = "none"`) ontvangt de bezoeker
de **standaardervaring** en wordt geen profiel met gedrags- of firmografische
velden opgebouwd.

## Beknopte LIA voor de essentiële laag (gerechtvaardigd belang)

1. **Belang.** Het leveren van een werkende, veilige, personaliseerbare website
   voor de Klant; herkennen van terugkerende sessies om de dienst te laten
   functioneren.
2. **Noodzaak.** De pseudonieme sleutel en bezoektelling zijn het minimum om de
   dienst te laten werken; er is geen minder ingrijpend alternatief dat hetzelfde
   bereikt.
3. **Afweging.** De gegevens zijn pseudoniem, niet gevoelig, kort bewaard
   (90 dagen rollend), niet verkocht en niet gebruikt voor eigen doeleinden van
   Mister Chameleon. De impact op de betrokkene is laag; er is een
   standaardervaring en een consentvraag voor alles daarboven. Conclusie: het
   belang weegt op tegen de impact. *Te bevestigen door jurist.*

## Bewaartermijn

Bezoekersprofielen: **rollend 90 dagen** vanaf het laatste bezoek
(`DEFAULT_RETENTION_DAYS = 90`), automatisch verwijderd na afloop. Zie Annex I
van de DPA.

## Rolverdeling — het scherpste punt

Voor de kernverwerking is Mister Chameleon **verwerker** in opdracht van de
Klant. Maar doordat Mister Chameleon de **verrijkingsbronnen kiest en de
verrijkingslogica bepaalt**, kan voor dat onderdeel **gezamenlijke
verwerkingsverantwoordelijkheid** (art. 26 AVG) ontstaan. Dat is geen
formaliteit: het bepaalt wie aansprakelijk is als het misgaat.

Beheersmaatregel in het product: verrijking staat **per tenant uit** tot de
Klant hem aanzet, en de Klant kiest **per bron** (`TenantEnrichmentSettings`).
Daarmee instrueert de Klant welke verrijking plaatsvindt, wat de
verwerker-rol ondersteunt. Waar Mister Chameleon zelf de bronnenlijst cureert,
blijft een rest-risico op gezamenlijke verantwoordelijkheid; leg dat expliciet
vast (art. 26-regeling of duidelijke instructie-constructie). *Juridisch te
toetsen.*

## Wat de Klant moet doen

- De verrijking en de ingeschakelde subverwerkers opnemen in de eigen
  **privacyverklaring**.
- Een **consentmechanisme** tonen dat `personalization` en `enrichment`
  onderscheidt.
- De eigen afweging (deze LIA als basis) documenteren en bewaren.
