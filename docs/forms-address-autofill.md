# Adres invullen in formulieren

Een formulier met een veld voor de postcode en een veld voor het huisnummer vult de
straat en de woonplaats zelf in. In Nederland liggen die twee vast zodra je de eerste
twee weet. Bestaat de combinatie niet, dan hoort de bezoeker dat voordat hij verstuurt.

## Wat de bezoeker ziet

- Hij vult postcode en huisnummer in. Kort daarna staan straat en woonplaats ingevuld.
  Hij kan ze nog aanpassen.
- Heeft het formulier geen velden voor straat en woonplaats, dan staat het gevonden
  adres onder het huisnummer.
- Bestaat het adres niet, dan staat er onder het huisnummer een melding. Wat het
  formulier eerder zelf had ingevuld, haalt het weer weg.
- Een huisnummer met een letter of toevoeging (12A, 12-2) zoeken we op het nummer. De
  straat en de woonplaats zijn voor elke toevoeging gelijk.

## Een formulier laten meedoen

Het formulier doet mee zodra het een postcodeveld en een huisnummerveld heeft. De
velden worden herkend aan hun sleutel, niet aan hun label. Dat werkt voor de
ingebouwde formulieren en voor een formulier uit het CMS.

| Veld | Sleutels die herkend worden |
| --- | --- |
| Postcode | `postcode`, `postal_code`, `zip` |
| Huisnummer | `huisnummer`, `huisnr`, `house_number` |
| Straat (optioneel) | `straat`, `straatnaam`, `street` |
| Woonplaats (optioneel) | `woonplaats`, `plaats`, `stad`, `city`, `town` |

Een formulier zonder postcode of zonder huisnummer merkt er niets van.

## De controle bij het versturen

De server kijkt het adres bij het versturen nog een keer na. Alleen een adres dat
zeker niet bestaat houdt het formulier tegen, met dezelfde melding. In deze gevallen
gaat het formulier gewoon door:

- de postcode is geen Nederlandse postcode,
- het adresregister geeft geen antwoord.

Zijn straat en woonplaats leeg gebleven, dan vult de server ze in. Zo staat het hele
adres in de opgeslagen inzending en in de melding naar de backoffice.

## Waar het adres vandaan komt

Uit de Locatieserver van PDOK, de open adresgegevens van het Kadaster (BAG). Daar is
geen sleutel voor nodig en het kost niets.

- De opvraging loopt via onze eigen server (`POST /api/forms/address`). De browser van
  de bezoeker praat niet met PDOK.
- Naar PDOK gaan alleen de postcode en het huisnummer. Niets dat zegt wie het vroeg.
- Het adres staat in de inhoud van het verzoek, niet in het webadres. Zo komt het niet
  in logbestanden terecht. Er wordt niets opgeslagen.
- Een antwoord wordt een dag onthouden in het geheugen van de server. Een storing bij
  PDOK onthouden we nooit.
- Per bezoeker zijn er hooguit zestig opvragingen per tien minuten. Daarboven werkt
  het formulier door, alleen zonder de hulp.

Code: `lib/forms/address-lookup.ts`, `app/api/forms/address/route.ts`,
`components/blocks/forms/useAddressAutofill.ts`. Test: `tests/forms/address-lookup.test.ts`.
