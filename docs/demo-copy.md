# Demo-copy voor de drie rollen (concept)

Concept-copy voor de misterchameleon.nl-demo. Eén set per rol. Eerste versie, de
merkstrateeg bepaalt de definitieve woorden. Website-teksten in het Nederlands, de
demo-UI zelf blijft Engels.

Elke rol-regel wijst al naar een bestaande variant-key. Deze tenant staat op de
ingebouwde platform-CMS, dus je bewerkt de teksten in de platform-admin, niet in
Statamic. Ga naar Content, kies de tab Hero of CTA, open de bijbehorende key en plak de
copy hieronder erin. Van rol wisselen in de schakelaar bovenin verwisselt dan de hero en
de cta naar rol-copy, terwijl de rest van de pagina blijft staan. Houd elke hero even lang
zodat de pagina niet springt bij het wisselen.

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
