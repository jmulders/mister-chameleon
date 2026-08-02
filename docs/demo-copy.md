# Demo-copy voor de drie rollen (concept)

Concept-copy voor de misterchameleon.nl-demo. Eén set per rol. Eerste versie, de
merkstrateeg bepaalt de definitieve woorden. Website-teksten in het Nederlands, de
demo-UI zelf blijft Engels.

Status. Deze copy staat er al in. Het platform leest de home-content uit de gekoppelde
CMS-bron (in dev de map mister-chameleon-cms-app, home.md). Daar heb ik de vier hero's en
vier cta's gezet, en de drie keys die nog ontbraken (hero_consideration, cta_guide,
cta_platform) toegevoegd zodat elke rol-regel nu resolvet. Op dev is dit meteen zichtbaar.
Voor de live site moet die content nog mee met een deploy van de CMS, of je zet dezelfde
teksten in de CMS-beheeromgeving.

Elke rol-regel wijst naar een variant-key. Van rol wisselen in de schakelaar bovenin
verwisselt de hero en de cta naar rol-copy, terwijl de rest van de pagina blijft staan.
Elke hero is ongeveer even lang gehouden zodat de pagina niet springt bij het wisselen.
Aanspreekvorm is u/uw, gelijk aan de rest van de pagina.

De rode draad over alle vier. De kleur verandert, niet het dier. Zelfde belofte, andere
ingang.

---

## Default (wat iedereen eerst ziet)

hero `hero_direct_brand`, cta `cta_guide`, proof `proof_default`

**Hero-kop**
Eén website. Elke bezoeker.

**Hero-subtekst**
Je site houdt zijn belofte. Alleen de ingang past zich aan wie er leest. Zelfde
boodschap, andere insteek.

**CTA**
Bekijk hoe het werkt

**Proof-regel**
Server-side en meetbaar. Je data staat in Europa.

---

## Marketeer (bij een eindklant)

hero `hero_consideration`, cta `cta_demo`

**Hero-kop**
Je advertenties zijn scherp. Je landingspagina niet.

**Hero-subtekst**
Je richt precies op wie je wilt bereiken. Toch krijgt iedereen dezelfde pagina in
dezelfde volgorde. Wij laten de landing aansluiten op de advertentie. En je meet zelf of
het werkt.

**CTA**
Plan een demo

---

## Bureau-eigenaar

hero `hero_linkedin_vision`, cta `cta_platform`

**Hero-kop**
Elke klantsite een versie per bezoeker. Zonder losse landingspagina's.

**Hero-subtekst**
Eén laag over de sites die je al beheert. Je richt het één keer in en stuurt maandelijks
bij. Nieuw werk in de retainer, zonder dat je elke maand pagina's bouwt.

**CTA**
Ontdek het platform

---

## Technisch verantwoordelijke

hero `hero_google_problem`, cta `cta_meeting`

**Hero-kop**
Eén regel code. Server-side. Geen geflikker.

**Hero-subtekst**
De keuze valt op de server, binnen 700 milliseconden, met een veilige terugval. Gaat er
iets mis, dan ziet de bezoeker gewoon je normale pagina. We bewaren geen persoonsgegevens
en je data staat in Europa.

**CTA**
Praat met ons

---

## Voor de schrijver, wat er onder de motorkap zit

Je schrijft niet los tekst voor één pagina. Je schrijft in een bibliotheek van
content-blokken en varianten die we zelf gebouwd hebben. Denk aan een pagebuilder. Een
pagina is opgebouwd uit blokken (hero, social proof, cta, features, conversie,
notificaties), en elk blok kan meerdere varianten hebben. De adaptieve laag kiest per
bezoeker welke variant getoond wordt. Jij levert de woorden per variant, de techniek
zorgt voor de rest.

Omdat de blokken en varianten herbruikbaar zijn, kunnen we een nieuwe website razendsnel
neerzetten. We stellen een site samen uit bestaande blokken, vullen de teksten, en de
add-on met adaptieve blokken staat er meteen bovenop. Zo levert elke nieuwe site vanaf
dag één personalisatie, zonder los maatwerk.

De voordelen op een rij.

Snelheid. Een nieuwe website bouw je uit kant-en-klare blokken in plaats van vanaf nul.
Wat vroeger een project van weken was, staat nu in dagen.

Personalisatie zit ingebakken. Elk blok is al voorbereid op meerdere varianten. De
adaptieve add-on hoef je niet apart in te bouwen, hij hoort bij de structuur.

Werk verdeeld naar wie het kan. De schrijver levert tekst per variant, de vormgever de
stijl, de techniek de regels. Niemand wacht op een developer om een kop aan te passen.

Consistente merkstijl. Alle blokken volgen dezelfde opmaak en toon per klant, dus een
snelle uitrol blijft er verzorgd uitzien.

Makkelijk uitbreiden. Een extra variant of een nieuwe rol voeg je toe zonder de pagina te
verbouwen. Handig voor campagnes, doelgroepen en seizoenen.

Meetbaar. Omdat varianten los staan, zie je welke variant werkt en kun je bijsturen op
data in plaats van op onderbuik.

Herbruikbaar over klanten heen. Een blok dat zich bewijst bij de ene site, zet je zo in
bij de volgende. De bibliotheek wordt met elke opdracht sterker.

Werkt op meerdere CMS-en. De blokken en varianten draaien op het ingebouwde platform en
op externe CMS-en, dus je zit niet vast aan één systeem.

Lagere kosten per site. Minder maatwerk per opdracht betekent dat een adaptieve website
haalbaar wordt voor klanten die anders nooit aan personalisatie zouden beginnen.

## Notities

Alleen hero en cta wisselen per rol. Proof en de rest van de pagina blijven op de
default. Dat is bewust zo.

Je bewerkt deze varianten in de platform-admin onder Content, tab Hero en tab CTA, per
key. Niet in Statamic. Deze tenant gebruikt de ingebouwde platform-CMS.

Deze keys zijn gedeeld met andere regels op de demo-tenant. Op een demo-tenant is dat
prima. Bij een echte klant geef je elke rol een eigen variant-key, zodat gedeelde
varianten niet meebewegen.

De interesse die het profielpaneel per rol toont. Marketeer conversion, Bureau-eigenaar
partnership, Technisch integration. Naar smaak aan te passen.
