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

### Twee presets zonder kleur

Naast de preset "Mister Chameleon" staan er twee in de galerij, in dezelfde categorie
"House style":

- **Zwart-wit** (`zwart-wit`): zwarte pagina's, witte tekst, witte knoppen met zwarte
  tekst. Het slotblok is een witte band met zwarte tekst.
- **Wit-zwart** (`wit-zwart`): witte pagina's, zwarte tekst, zwarte knoppen met witte
  tekst. Het slotblok is een zwarte band.

Het zwart is het zwart uit het logohandboek (`#1a171b`), de grijzen zijn stappen
tussen dat zwart en wit. Lettertype, hoofdletters in de titels, hoeken en witruimte
zijn gelijk aan de preset "Mister Chameleon". Alleen "verstuurd" en "fout" bij een
formulier houden het groen en rood uit het handboek, omdat zwart die twee niet uit
elkaar houdt.

Ze dragen zelf geen merklaag. Een site die de cirkels al heeft, houdt ze als een
regel op een van deze twee overschakelt. De cirkels houden dan hun kleur.

Code: `tenant/design-presets-mister-chameleon.ts`. Test:
`tests/design/presets-zwart-wit.test.ts`.

## Wat de site daarvan gebruikt

- Stapnummers als volle cirkel met een wit cijfer, zoals de hoofdstuknummers.
- Icoontjes van functiekaarten als kleine krantenfoto in een cirkel: een echt
  voorwerp in zwart-wit op het papier van de huisstijl. Foto's zijn altijd
  zwart-wit en staan altijd in een cirkel (15-11-2026). De bestanden staan in
  `public/brand/icoon` en komen uit `tools/mc-iconen` in de CMS-repo. Een
  icoonnaam zonder bestand houdt het lijnicoon in een volle gekleurde cirkel.
- Om elke icoonfoto spelen twee of drie gekleurde cirkels (22-11-2026). Eerst
  stond er bij elk icoon hetzelfde bolletje op dezelfde plek. Nu ligt er
  minstens één cirkel half achter de foto en schijnt hij erdoorheen, net als
  bij de grote beelden. Plek, aantal en kleur wisselen per kaart: acht
  indelingen en zeven kleurstellen, die samen pas na 56 kaarten terugkomen. De
  cirkels zelf blijven vol van kleur en raken elkaar niet. Voor de grote
  beelden geldt hetzelfde spel, met twee tot vier cirkels. Dat staat in
  `tools/mc-beeld/LEESMIJ.md` in de CMS-repo.
- In een cirkel staat geen tekst (15-11-2026). Stapnummers zijn de uitzondering.
- Minder lucht tussen de secties dan de presets uit de galerij meegeven. Die
  geven op een breed scherm 115 pixels boven en onder elke sectie. De huisstijl
  houdt 64 pixels aan, en 36 op een telefoon (19-11-2026, na de opmerking dat
  er op /hoe-het-werkt veel loze ruimte tussen de blokken zat).
- De bolletjes van de achterkant van het visitekaartje, los en met lucht
  ertussen, in een paar gravures. Maat en kleur komen van het kaartje. In de
  voettekst staan ze niet meer. Daar lazen ze klein als een propje (15-11-2026).

## Wat de site niet overneemt, en waarom

- **Koppen in de kleur van de uiting.** De site wisselt van thema naar
  tijdstip en doelgroep. Een vaste kopkleur haalt op het donkere thema het
  contrast niet.
- **Zwart-witfoto's van mensen.** De site gebruikt kameleons als beeld.
