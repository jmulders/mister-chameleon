# Huisstijl Mister Chameleon

Dit bestand vat samen wat de drie huisstijldocumenten voorschrijven en laten
zien. De preset Mister Chameleon (`tenant/design-presets-mister-chameleon.ts`)
en de cirkels die erbij horen (`app/brand/mister-chameleon.css`) volgen dit
bestand.

Bronnen, aangeleverd op 13-11-2026:

- `032001_MANUAL LOGO MISTER CHAMELEON.pdf`, de handleiding van het logo (11 pagina's)
- `032002_A4 LEAFLETS 4X.pdf`, vier leaflets
- `032004_FOLDERMAP.pdf`, de foldermap

De documenten zijn uit 2011. Alleen de vormgeving is overgenomen. De teksten
en het aanbod erin zijn verouderd en staan nergens op de site.

## Het logo

Het logo bestaat uit het beeldmerk, een profiel van 18 bolletjes in een
kleurverloop, en het woordmerk MISTER CHAMELEON. Die twee horen bij elkaar.

Wat de handleiding verbiedt:

1. De kleur van het woordmerk veranderen. Het woordmerk is zwart, of wit op een donkere achtergrond.
2. Het woordmerk in kleine letters zetten. Het is geheel in kapitalen.
3. De samenstelling van de bolletjes veranderen.
4. Het logo doorzichtig maken.
5. Het lettertype van het woordmerk veranderen.
6. De volgorde van de kleuren veranderen.
7. Het woordmerk verplaatsen ten opzichte van het beeldmerk.
8. Iets anders binnen de vrije ruimte rond het logo plaatsen.

Wat daaruit volgt voor de site:

- Het beeldmerk staat niet los, niet gedraaid en niet afgesneden op een pagina.
- Er worden geen rijtjes of slierten van kleine bolletjes nagemaakt. Dat is een
  andere samenstelling van het beeldmerk.
- Het logo staat op een rustige achtergrond die heel licht of heel donker is,
  niet op een gekleurd vlak en niet op een drukke foto.

## De kleuren

De 18 kleuren van het beeldmerk, in de volgorde van het verloop, met de
RGB-waarden uit de handleiding.

| Nr | RGB | Hex | Naam in de code |
| --- | --- | --- | --- |
| 1 | 230, 68, 21 | `#e64415` | `--mc-orange` |
| 2 | 226, 0, 26 | `#e2001a` | `--mc-red` |
| 3 | 203, 0, 90 | `#cb005a` | `--mc-magenta` |
| 4 | 161, 5, 125 | `#a1057d` | `--mc-plum` |
| 5 | 103, 33, 128 | `#672180` | `--mc-purple` |
| 6 | 0, 81, 158 | `#00519e` | `--mc-navy` |
| 7 | 0, 106, 179 | `#006ab3` | `--mc-blue` |
| 8 | 0, 143, 211 | `#008fd3` | `--mc-sky` |
| 9 | 0, 158, 224 | `#009ee0` | |
| 10 | 0, 152, 156 | `#00989c` | `--mc-teal` |
| 11 | 0, 149, 122 | `#00957a` | |
| 12 | 0, 144, 54 | `#009036` | |
| 13 | 65, 166, 42 | `#41a62a` | `--mc-green` |
| 14 | 146, 189, 17 | `#92bd11` | |
| 15 | 189, 205, 0 | `#bdcd00` | `--mc-lime` |
| 16 | 210, 214, 0 | `#d2d600` | |
| 17 | 229, 222, 0 | `#e5de00` | |
| 18 | 237, 225, 0 | `#ede100` | |

Zwart is 26, 23, 27 (`#1a171b`).

## De beeldtaal van de leaflets en de foldermap

- **Grote vlakke cirkels.** Een paar cirkels van duidelijk verschillende
  grootte, dicht bij elkaar, in volle kleuren uit het verloop. Ze overlappen
  elkaar niet en zijn niet doorzichtig. De grootste wordt vaak door de rand
  van de pagina afgesneden.
- **Cirkels met een getal of een korte tekst erin**, in vet wit. De
  hoofdstuknummers van de handleiding zijn op dezelfde manier gezet.
- **Zwart-witfotografie** van mensen, met een cirkel over het gezicht. De
  kleur op de pagina komt alleen van de cirkels en de koppen.
- **Eén kleur per uiting.** Elk leaflet heeft één kleur uit het verloop voor
  de hoofdkop en de tussenkoppen: paars, blauw, magenta of groen.
- **Koppen in vette kapitalen.** Daarboven een kleine regel in vette zwarte
  kapitalen. Tussenkoppen vet in de kleur van de uiting, lopende tekst zwart.
- **Veel wit.** De leaflets zijn wit, de foldermap is zwart met witte tekst en
  een lichtblauwe kop.

## Het lettertype

De documenten zijn gezet in Gotham, in de snedes Black, Bold, Medium en Book.
Gotham is een betaald lettertype waar het platform geen weblicentie voor heeft.
De preset gebruikt daarom Montserrat, het lettertype in het platform dat er
het dichtst bij komt. Komt er een weblicentie voor Gotham, dan vervang je het
onder Design, Typography.

## De preset

De huisstijl is een preset in de galerij van de admin, onder Design, Presets,
in de groep House style. Je kiest hem daar, net als elke andere preset.

| Onderdeel | Waarde | Waar het vandaan komt |
| --- | --- | --- |
| Achtergrond | wit | de leaflets |
| Tekst | `#1a171b` | het zwart van de handleiding |
| Knoppen en accent | `#672180`, paars | een van de vier kleuren van de leaflets |
| Tweede kleur | `#cb005a`, magenta | idem |
| Links | `#00519e` | het verloop |
| Koppen | vette kapitalen | de leaflets |
| Hoofdbeeld en voettekst | zwart met witte tekst | de foldermap |
| Lijn boven de voettekst | `#009ee0` | de lichtblauwe kop van de foldermap |
| Verlopen en schaduw | geen verloop, nauwelijks schaduw | de vlakke beeldtaal |

De cirkels horen bij de preset. Wie de preset toepast krijgt ze erbij, en wie
daarna een andere preset of een ander thema kiest is ze weer kwijt. Een regel
die tijdelijk een andere kleurpreset toont, naar tijdstip of doelgroep, laat
de cirkels staan. In de
opgeslagen instellingen is dat het veld `design.brandLayer`. Geen enkele tenant
krijgt de cirkels nog op grond van zijn naam.

## Wat de site daarvan gebruikt

- Stapnummers als volle cirkel met een wit cijfer, zoals de hoofdstuknummers.
- Icoontjes van functiekaarten in een volle cirkel, in kleuren uit het verloop.
- Bolletjes die van het laatste blok de voettekst in drijven, zoals op de
  foldermap. Dicht op elkaar aan de rechterkant, steeds losser naar links.

## Wat de site niet overneemt, en waarom

- **Koppen in de kleur van de uiting.** De site wisselt van thema naar
  tijdstip en doelgroep. Een vaste kopkleur haalt op het donkere thema het
  contrast niet.
- **Zwart-witfoto's van mensen.** De site gebruikt kameleons als beeld.
