# Demo-copy — de drie rollen (concept)

Concept-copy voor de misterchameleon.nl-demo, één set per rol. **Eerste versie — de
merkstrateeg bepaalt de definitieve woorden** (de varianten *zíjn* de positionering).
Website-teksten in het **Nederlands** (de demo-UI zelf blijft Engels).

**Hoe te gebruiken.** Elke rol-regel wijst al naar een bestaande variant-key. Plak de
copy hieronder in de CMS (Statamic) op die key, en de demo is niet langer kaal: van rol
wisselen in de schakelaar bovenin verwisselt de **hero + cta** naar rol-copy, terwijl de
rest van de pagina (proof, secties) blijft staan. Houd elke hero **even lang / dezelfde
vorm** zodat de pagina niet springt bij het wisselen.

De rode draad over alle vier: **de kleur verandert, niet het dier** — dezelfde belofte
(één site die zich per bezoeker gedraagt, meetbaar), een andere ingang.

---

## Default — wat iedereen eerst ziet

*Keys: hero `hero_direct_brand` · cta `cta_guide` · proof `proof_default`*

- **Hero-kop:** Eén website. Elke bezoeker.
- **Hero-subtekst:** Je site houdt zijn belofte — en past de ingang aan wie er leest.
  Dezelfde boodschap, een andere manier binnen.
- **CTA:** Bekijk hoe het werkt
- **Proof-regel:** Server-side, meetbaar en privacy-bewust — je data staat in Europa.

---

## Marketeer (bij een eindklant)

*Keys: hero `hero_consideration` · cta `cta_demo`*

- **Hero-kop:** Je advertenties zijn scherp. Je landingspagina niet.
- **Hero-subtekst:** Je richt precies — en dan komt iedereen op dezelfde pagina, in
  dezelfde volgorde. Wij laten de landing aansluiten op de advertentie, en je meet zelf
  of het loont.
- **CTA:** Plan een demo

## Bureau-eigenaar

*Keys: hero `hero_linkedin_vision` · cta `cta_platform`*

- **Hero-kop:** Een versie per bezoeker — voor elke klantsite, zonder landingspagina's te
  bouwen.
- **Hero-subtekst:** Eén laag over de sites die je al beheert. Eén keer inrichten vanuit
  de positionering, maandelijks bijsturen. Een nieuwe retainerregel die bewaking is, geen
  productie.
- **CTA:** Ontdek het platform

## Technisch verantwoordelijke

*Keys: hero `hero_google_problem` · cta `cta_meeting`*

- **Hero-kop:** Eén regel code. Server-side. Geen geflikker.
- **Hero-subtekst:** De beslissing valt server-side binnen een 700ms-budget, met een
  veilige default — gaat het ooit mis, dan krijgt de bezoeker gewoon je normale pagina.
  Geen persoonsgegevens die we bewaren; data in Europa.
- **CTA:** Praat met ons

---

## Notities

- De drie rol-regels houden **proof en de rest van de pagina op de default** — alleen
  hero + cta wisselen per rol. Dat is bewust ("alleen hero en cta wisselen").
- Deze keys zijn **gedeeld** met andere regels op de demo-tenant. Op een demo-tenant is
  dat prima; bij een echte klant geef je elke rol zijn **eigen** variant-key zodat gedeelde
  varianten niet meebewegen.
- De `interestPrimary` die het profielpaneel per rol toont: Marketeer → *conversion*,
  Bureau-eigenaar → *partnership*, Technisch → *integration*. Naar smaak aan te passen.
