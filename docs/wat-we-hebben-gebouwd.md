# Mister Chameleon — het Adaptive Experience Platform

*Wat we hebben gebouwd, hoe het werkt, en waarom het fundamenteel anders is dan een
CMS of een losse personalisatietool.*

Dit document volgt de reis van een bezoeker én de werking van het platform. Het is
bewust in gewone taal geschreven — voor een klant, een investeerder of een nieuwe
developer. Het beschrijft wat er gebouwd is; waar iets nog ontwikkelrichting is in plaats
van bestaande functionaliteit, staat dat er expliciet bij.

---

## 1. Wat is Mister Chameleon?

Mister Chameleon is een **Adaptive Experience Platform**: één platform dat bezoekers
begrijpt, per bezoeker de beste ervaring bepaalt, die ervaring uitserveert, en diezelfde
intelligentie hergebruikt voor CRM, advertenties en analyse — voor meerdere klanten
tegelijk, afgerekend op abonnement plus gebruik.

De website is één van de kanalen waarop die context wordt toegepast. De kern is een
**context-engine** die begrijpt wie er komt, beslissingen neemt, ervaringen aanpast, en
die kennis vervolgens laat doorstromen naar de rest van de marketing- en salesketen.

Onder één dak zitten eigenlijk **drie producten**:

- **Adaptive Website Builder** — razendsnel complete websites bouwen (blocks, presets,
  design tokens, drie CMS'en), of een bestaande site aansluiten.
- **Adaptive Experience Engine** — context bepalen, en met regels én AI beslissen wie
  welke ervaring krijgt.
- **Adaptive Intelligence** — dezelfde context inzetten voor leads, CRM, advertenties en
  analyse.

Drie producten, één engine eronder. Dat is de essentie.

## 2. Waarom gewone websites tekortschieten

Een gewone website is een folder: hij toont iedereen hetzelfde, ongeacht wie er kijkt.
Maar je bezoekers zijn niet hetzelfde. Een inkoper van een enterprise-bedrijf, een
ondernemer uit het MKB en een student komen met totaal verschillende vragen, budgetten
en twijfels — en krijgen allemaal exact dezelfde kop, hetzelfde bewijs en dezelfde
call-to-action.

Marketeers proberen dat te ondervangen met landingspagina's, A/B-tests en losse tools.
Maar dat schaalt niet: elke doelgroep een eigen pagina onderhouden is onbegonnen werk,
en een A/B-test vertelt je wat gemiddeld beter werkt, niet wat beter werkt *voor deze
specifieke bezoeker op dit moment*.

Wat ontbreekt is een systeem dat de bezoeker begrijpt en de ervaring in real time
aanpast — beheersbaar, meetbaar en met respect voor privacy. Dat is wat we hebben
gebouwd.

## 3. Adaptive Websites

Een adaptive website past zich aan aan de **context** van de bezoeker: zijn situatie op
dit moment. Een terugkerende, koopklare bezoeker uit een groot bedrijf op maandagochtend
krijgt een andere boodschap dan een nieuwe, aarzelende bezoeker op zaterdagavond —
automatisch, in milliseconden, zonder dat iemand handmatig iets schakelt.

Belangrijk: we laten niet een hele website oneindig variëren — dat wordt onbeheersbaar.
We passen aan op scherp gekozen plekken. Die plekken heten adaptive blocks, en dat is
het volgende hoofdstuk.

---

# Deel I — Adaptive Experience Engine

*De kern: begrijpen, beslissen, aanpassen.*

## 4. Adaptive Blocks — het hart van het platform

> **Mister Chameleon personaliseert geen pagina's. Mister Chameleon personaliseert
> Adaptive Blocks.**

Dat onderscheid is de kern van onze aanpak. In plaats van hele pagina's te dupliceren,
hebben we vijf plekken bepaald waar aanpassing het meeste effect heeft — de dragende
momenten van overtuiging:

1. **Hero** — de kop en eerste boodschap bovenaan de pagina.
2. **Features** — welke eigenschappen of voordelen je benadrukt.
3. **Social proof** — welke klantlogo's, cases of testimonials je toont.
4. **CTA** — de call-to-action: wat je de bezoeker vraagt te doen.
5. **Notifications** — contextuele meldingen en signalen.

Belofte, onderbouwing, bewijs, vraag, nudge. Van elk block maakt de klant **meerdere
varianten** — een hero voor de zakelijke bezoeker, een hero voor de particulier; een
social-proof-blok met enterprise-logo's, en een met MKB-cases.

Het platform beslist per bezoeker welke variant elk block toont. Zo ontstaan veel
verschillende ervaringen uit een beperkt aantal beheersbare bouwstenen — in plaats van een
wildgroei aan pagina's. Eén pagina, met per bezoeker de best passende varianten van de
ingestelde adaptive blocks.

## 5. De Context Engine

Dit is de technologische kern van het platform. Alle signalen komen eerst binnen in één
centrale **context-engine**, en al het andere in het platform gebruikt diezelfde engine.

De context-engine:

- **verzamelt** signalen (profiel, gebeurtenissen, tijd);
- **verrijkt** die signalen (bedrijf, sector, locatie, geschiedenis — hoofdstuk 14);
- **berekent** scores (intentie, betrokkenheid);
- **bepaalt** profielen (welk type bezoeker is dit);
- **bewaakt** toestemming (wat mag wel en niet — hoofdstuk 17);
- **levert** de context terug aan de website, de regels en de AI.

Dat één engine dit doet, is geen technisch detail — het is de belofte. Omdat website,
CRM en advertenties uit dezelfde context-engine worden gevoed, werken de kanalen vanuit
één centraal en zo consistent mogelijk bezoekersbeeld. De bezoeker die op de site als
"hot enterprise lead" wordt herkend, wordt met diezelfde basis doorvertaald naar het CRM
en de advertentiedoelgroep. **Eén centraal bezoekersbeeld, doorvertaald naar alle
aangesloten kanalen** — in plaats van elk kanaal met zijn eigen, losse beeld.

## 6. Context Variables

De engine drukt context uit in **context-variabelen**: losse, benoemde waarden die het
platform bij elk verzoek kan uitlezen. Denk aan `pageType`, `visitType`, `companySize`,
`intentScore`, `scrollDepth`, `utmSource`.

Er zijn twee soorten:

- **Ruwe variabelen** — direct waarneembaar: het tijdstip, de pagina, de campagne, de
  scrolldiepte.
- **Afgeleide variabelen** — berekend door de engine: een intentiescore uit gedrag, een
  firmografisch profiel uit het IP-adres, "terugkerende betrokken bezoeker" uit de
  geschiedenis.

Voor het instellen van ervaringen hoeft de klant niet met losse ruwe signalen te werken.
Hij werkt vooral met begrijpelijke variabelen die de context samenvatten — en dat zijn
precies de bouwstenen waarmee de regels en de AI werken. (Wie wél de onderliggende
signalen wil zien, kan dat via de Context Explorer in de admin.)

## 7. De Behaviour Engine

De afgeleide variabelen komen niet uit de lucht vallen; er zit een gedragsmotor onder.

**Interesseprofielen.** Een catalogus van canonieke profielen — een gedeelde
woordenschat van wie een bezoeker kan zijn — met scoring die bepaalt hoe goed iemand bij
elk profiel past. Een tenant kan daar eigen profielen bovenop zetten. Zo wordt gedrag een
herkenbaar *type* in plaats van een hoop losse klikken.

**Gedragsscoring die leeft.** De intentiescore is geen momentopname maar een waarde die
**opbouwt** naarmate iemand betrokken raakt en **vervalt** als de betrokkenheid wegzakt.
De engine herkent ook gedragspatronen — reeksen van acties die samen iets betekenen
(prijspagina → cases → terug naar de prijspagina). De uitkomst is een levend beeld van
waar iemand staat, dat vanzelf actueel blijft.

## 8. De Rules Engine

Regels zijn de expliciete, uitlegbare manier om te beslissen wie wat ziet. Ze werken met
de context-variabelen, in de vorm **ALS … DAN …**:

```
ALS   companySize = enterprise
EN    intentScore > 80
DAN   Hero          = Enterprise Hero
      CTA           = Demo aanvragen
      Social proof  = Enterprise cases
```

Eén regel stuurt in één keer meerdere adaptive blocks aan. Regels zijn direct,
transparant en voor de klant zelf te beheren — je ziet precies waarom een bezoeker kreeg
wat hij kreeg. Ze kunnen op ruwe én afgeleide variabelen werken, dus ook op zaken als
intentie en firmografie.

Voor het overgrote deel van de gevallen zijn regels voldoende. In complexere situaties
kan AI als aanvullende beslislaag worden ingezet — het volgende hoofdstuk.

## 9. AI Decisioning

Sommige situaties zijn te complex, te veelzijdig of te subtiel om in regels te vatten.
Dan laat het platform een **AI-model** de beste variant kiezen op basis van de volledige
context.

Twee dingen houden dit beheersbaar:

- **Confidence.** Het model geeft naast een keuze ook een zekerheid mee. Is die te laag,
  dan neemt AI geen zelfstandige beslissing en valt het platform terug op de regels. AI
  mag een afweging maken, maar alleen binnen ingestelde zekerheidsgrenzen — een model
  blijft een inschatting, en die grens bepaalt wanneer we die inschatting vertrouwen.
- **Meetbaarheid.** Een instelbaar deel van de bezoekers gaat naar een **holdout** die
  bewust de standaardervaring krijgt, zodat we de werkelijke lift van AI kunnen meten
  (hoofdstuk 16).

AI is hier geen black box die de controle overneemt, maar een extra beslislaag boven de
regels — met een vangnet eronder.

## 10. AI Generation

Naast het selecteren van varianten kan het platform ook nieuwe content en pagina-opzetten
**genereren**: losse hero's, complete blocks, en een pagina-opzet vanuit een enkele URL.
Hier is het eerlijk om onderscheid te maken tussen wat vandaag werkt en waar we naartoe
bouwen.

**Wat vandaag werkt.** De generatiefunctionaliteit kan een bestaande website analyseren
en op basis daarvan content en een pagina-opzet voorstellen — hero's, blocks en een
blueprint vanuit één URL. Elke generatiestap is een bewuste, afgerekende actie (hoofdstuk
14 en 20), en de mens houdt de controle: het platform stelt voor, de klant beslist en
publiceert.

**De ontwikkelrichting.** De ambitie is deze keten verder door te trekken — van
gegenereerde content naar voorgestelde varianten en regels, en uiteindelijk naar meer
geautomatiseerde publicatie:

```
URL  →  analyse  →  contentvoorstel        (gebouwd)
                 →  varianten & regels      (ontwikkelrichting)
                 →  geautomatiseerde publicatie  (ontwikkelrichting)
```

De analyse- en contentvoorstel-stap is gebouwd en in gebruik. Het voorstellen van
varianten en regels en de geautomatiseerde publicatie zijn ontwikkelrichting — de koers,
niet een bestaande knop. Zo blijft duidelijk wat productierijp is en wat we nog bouwen.

---

# Deel II — Adaptive Website Builder

*Razendsnel van merk naar live site.*

## 11. De Website Builder

Contextueel maken is de helft. De andere helft is: hoe bouw je überhaupt snel een goede
site? Drie gestapelde lagen:

- **Content blocks** — uitgebreide bibliotheken met kant-en-klare bouwstenen: hero's,
  feature-secties, prijstabellen, FAQ's, cases, formulieren. Een complete website in
  korte tijd, zonder alles van nul te ontwerpen.
- **Presets** — samengestelde, beproefde combinaties, zodat je niet met een leeg canvas
  begint maar met een werkende opzet. Presets kunnen zelf ook **contextafhankelijk**
  worden ingezet: niet alleen losse blocks, maar hele opzetten passen zich aan de
  bezoeker aan.
- **Design tokens** — de klant laadt zijn huisstijl in (kleuren, typografie, spacing,
  radius) en het platform trekt die door de hele site. Zo deploy je **puur vanuit de
  huisstijl** al een website die er meteen goed uitziet. Van merk naar live site, zonder
  pixelwerk.

## 12. CMS-integraties

Klanten zitten al ergens, en we dwingen ze niet te verhuizen. Daarom werkt het platform
met **drie headless CMS'en** — Statamic, Sanity en Storyblok — via een gedeelde
abstractielaag. Het platform trekt zich niets aan van welk CMS eronder zit; de content-
block-bibliotheken bestaan voor alle drie. Er is bovendien een file-fallback, zodat
lokaal werken mogelijk blijft en een tijdelijk onbereikbaar CMS niet direct tot een
onbeschikbare website leidt. Het CMS levert de content; het platform levert de context.

## 13. Chameleon Connect — elke bestaande website contextueel

Je hoeft je site niet bij ons te bouwen om er contextueel van te profiteren. Met
**Chameleon Connect** — een klein stukje code dat je op een bestaande website plaatst —
kun je een bestaande site adaptief maken. Op de plekken waar je wilt aanpassen, markeer je een slot;
Chameleon Connect vult die slots met de juiste variant voor de context van de bezoeker.

Twee dingen maken het robuust:

- **Veilige fallback** — als Mister Chameleon niet bereikbaar is of niet op tijd
  reageert, blijft de oorspronkelijke content van de website zichtbaar. De aanpassing is
  een verrijking bovenop wat er al staat, geen vervanging die kan wegvallen.
- **Werkt naast de bestaande site** — Chameleon Connect vult afgebakende slots, los van
  hoe de site verder is gebouwd.

Zo reikt het platform voorbij onze eigen tenants: ook bestaande websites kunnen
contextueel worden gemaakt, zonder dat een volledige herbouw nodig is.

---

# Deel III — Adaptive Intelligence

*Dezelfde context, ingezet voor leads, advertenties en analyse.*

## 14. Verrijkingen

Om vanuit een anonieme bezoeker snel bruikbare context op te bouwen, draait de
verrijkingspijplijn. Elke verrijking is een aparte, meetbare stap met een eigen prijs —
je betaalt alleen voor de intelligentie die je inzet. Drie groepen:

- **Herkenning** — wie is dit? IP-naar-bedrijf (netwerk, organisatie, domein),
  reverse-IP-firmografie (bedrijfsnaam, grootte, sector), reverse-geocoding, en
  B2B-identificatie.
- **Aanpassing** — waar past de context zich op aan? Gedrags- en intentiesignalen, en
  bijvoorbeeld actuele weersomstandigheden.
- **Denkkracht** — de zwaardere, AI-gedreven stappen: GA4-bezoekgeschiedenis en
  kanaalattributie, CRM-matching, en de AI-generatie van hero's, blocks en blueprints.

Elke stap kent zijn eigen credit-prijs, oplopend van lichte herkenning tot zware
AI-generatie — en alles gebeurt binnen de grenzen van toestemming (hoofdstuk 17).

## 15. Lead Intelligence

Dezelfde context die de site personaliseert, levert een tweede opbrengst: **leads**.
Wordt een zakelijke bezoeker herkend en verrijkt, dan kan het platform daar — binnen de
geldende grondslag — een lead van maken en die naar het CRM sturen. Wat erin zit:

- **Bezoekersprofielen** die zich over bezoeken heen opbouwen: anoniem → herkend →
  bekend.
- **CRM-synchronisatie** (o.a. HubSpot): bedrijf, contact en een notitie van het bezoek,
  ontdubbeld zodat je geen dubbele records krijgt.
- **Hot-lead-signalen** — scoort een lead boven een drempel, dan gaat er een melding uit
  (bijvoorbeeld naar Slack).
- **Gepersonaliseerde campagne-URL's** — een unieke of vanity-link die een genodigde
  meteen de op hem afgestemde ervaring geeft (ABM).
- **Uitgaande webhooks**, ondertekend zodat de ontvanger de echtheid kan verifiëren.
- **AVG-verwijdering** die ook het gekoppelde CRM-record opruimt.

Personalisatie en leadgeneratie gebruiken daarmee dezelfde contextuele basis.

## 16. Analytics & Lift

Personalisatie zonder meting is een gok. De meetlat zit ingebouwd:

- **Werkelijke lift** — de holdout levert een eerlijke vergelijking (gepersonaliseerd vs.
  standaard) met een prestatie-rapport dat laat zien of het echt wat oplevert.
- **Conversietracking en funnel** — conversies en de weg ernaartoe, per segment.
- **Terug naar de advertentieplatforms** — het platform synchroniseert doelgroepen naar
  advertentieplatforms en koppelt conversies terug, inclusief onderdrukking (suppressie)
  van wie niet meer benaderd mag worden.

Meten is hier geen dashboard achteraf, maar een ingebouwde lus: waarnemen, bewijzen,
bijsturen.

---

# Deel IV — Fundament

*Privacy, beheer, model, prijs en techniek.*

## 17. Privacy & Consent

Een platform dat context leest, moet privacy serieus nemen — als fundament, niet als
sluitpost. Welke gegevens mogen worden verzameld en gebruikt, hangt af van het type
gegeven, het doel van de verwerking en de geldende grondslag; niet elke context-variabele
is automatisch een persoonsgegeven, en toestemming is niet altijd de enige grondslag.
Waar toestemming wél vereist is, leggen we die per categorie vast en dwingen we die af.

Waar toestemming de grondslag is, kan de bezoeker die **per categorie** geven: *analytics*,
*personalisatie* en *verrijking* zijn afzonderlijk in te stellen. Het platform past per
verwerking de ingestelde grondslag en toestemmingsstatus toe: zonder geldige grondslag
voor verrijking draait de betreffende verrijkingsstap niet; zonder grondslag voor
personalisatie valt de site terug op de standaardervaring. De keuze wordt vastgelegd en
geldt direct, ook als de bezoeker hem later aanpast.

Dit is geen rem op de belofte — het is wat de belofte houdbaar maakt. De klant kan met
een gerust hart personaliseren, omdat het platform de grenzen bewaakt in plaats van ze op
te rekken.

## 18. De Admin — de cockpit

Al het bovenstaande beheert de klant zelf, vanuit één cockpit. Geen tickets, geen deploy
voor een tekstwijziging. Wat er in die cockpit zit:

- **Context Explorer** — zie welke context een bezoeker krijgt en waarom.
- **Rules Builder** — regels opstellen en beheren.
- **Adaptive Block Manager & Variants** — blocks en hun varianten.
- **Analytics & Lift Reports** — prestaties en werkelijke lift.
- **AI Suggestions** — voorstellen van de engine.
- **Leads & CRM** — de lead-intelligence.
- **Wallet & Credits** — verbruik en bijladen.
- **Consent** — de toestemmingsinstellingen.
- **Deployments** — back-up, herstel, en deploys/rollbacks met een knop.

De klant heeft de controle over zijn eigen ervaring, binnen de kaders die het platform
bewaakt.

## 19. Het datamodel — alles uit een paar bouwstenen

Onder al die functies zit een verrassend eenvoudig model. Het valt uiteen in twee
structuren die elkaar ontmoeten in de context.

**De inhoudskant** — wat er te tonen valt:

```
Tenant
  └─ Website
       └─ Pagina
            └─ Adaptive Block
                 └─ Varianten
```

**De bezoekerskant** — wie er kijkt:

```
Bezoeker
  └─ Sessies
       └─ Gebeurtenissen
```

En dan de schakel ertussen: **gebeurtenissen en verrijkingen voeden de context-
variabelen; regels (of AI) gebruiken die variabelen om per adaptive block een variant te
selecteren.** De inhoudskant zegt *wat* er kan worden getoond, de bezoekerskant zegt
*aan wie*, en de context-variabelen zijn de brug.

Omdat het hele platform op deze paar bouwstenen rust, is het uitlegbaar, uitbreidbaar en
per tenant te configureren zonder maatwerk-code.

## 20. Pricing

De afrekening volgt de belofte: je betaalt voor het contextueel bedienen van bezoekers,
plus voor de extra intelligentie die je inzet.

**De rekeneenheid is de web-sessie.** Iedere keer dat iemand de website bezoekt, is dat
één web-sessie — en binnen die sessie bezoekt hij een of meer pagina's, die samen als één
afgerekende contextuele sessie tellen. Een sessie leeft dertig minuten; kom je later
terug, dan is dat een nieuwe sessie.

**Twee lagen:**

- **Het abonnement** geeft een maandelijkse bundel contextuele sessies, oplopend in
  volume én mogelijkheden — van een instapplan tot een plan met de volledige
  AI-decisioning en verrijking.
- **De wallet met credits** dekt het gebruik bovenop het abonnement: de verrijkingen en
  AI-generaties. Elke actie heeft een transparante prijs in credits; automatisch bijladen
  kan.

**Maanden lopen van de 1e tot het einde van de maand.** Start je halverwege, dan betaal je
die eerste maand naar rato en vanaf de 1e het volle bedrag — zodat de facturatieperiode
samenvalt met de periode waarover we sessies tellen.

Kort: **abonnement voor het bereik, credits voor de intelligentie, de web-sessie als
eerlijke eenheid.** Veel eerlijker uit te leggen dan een wirwar aan AI-tokens of
pageviews.

## 21. Deployment & betrouwbaarheid

Meerdere klanten op één platform betekent dat betrouwbaarheid geen bijzaak is. Daarom
staat er een dichtgetimmerde pijplijn omheen: één gedeelde testgate — hetzelfde commando
— voor lokaal gebruik en CI, een database waarvan het schema volledig in versiebeheer zit
en via migraties wordt toegepast, verplichte review vóór productie, automatische deploys
en back-ups. Een nieuwe klant is configuratie, geen nieuw systeem — en elke verbetering
geldt meteen voor iedereen.

## 22. Wat Mister Chameleon niet is

Positioneren is ook afbakenen. Om verkeerde verwachtingen te voorkomen, expliciet wat het
platform **niet** is:

- **Geen vervanging voor ieder CMS.** We werken juist mét bestaande CMS'en; het platform
  levert de context, niet per se de content.
- **Geen contentmachine zonder menselijke controle.** AI stelt voor; de klant beslist en
  publiceert. Er gaat niets zelfstandig live.
- **Geen systeem dat bezoekers zonder grondslag identificeert.** Verwerking gebeurt binnen
  de geldende grondslagen en, waar vereist, op vastgelegde toestemming.
- **Geen traditionele A/B-testtool.** A/B vertelt je wat gemiddeld beter werkt; wij
  bepalen per bezoeker de beste ervaring en meten de werkelijke lift met een holdout.
- **Geen black-box-AI die zelfstandig websites beheert.** AI beslist binnen
  zekerheidsgrenzen, met de regels als vangnet en de mens aan het roer.

Wat het wél is, staat in de rest van dit document: een context-engine die ervaringen
begrijpelijk, meetbaar en houdbaar aanpast.

## 23. Technische architectuur

Elke keuze in de stack dient één van drie doelen: **snelheid** (context in
milliseconden), **isolatie** (de ene klant raakt niet de data of ervaring van de ander)
en **betrouwbaarheid** (omdat meerdere klanten dezelfde platformbasis delen, moeten
wijzigingen gecontroleerd, testbaar en veilig worden uitgerold).

**Next.js (React, TypeScript) op Vercel — frontend en API's.** Next.js combineert
server-rendering met een **edge-middleware** die vóór elke pagina draait — precies wat een
contextueel, multi-tenant platform nodig heeft: bij binnenkomst bepalen we al voor welke
klant het verzoek is en zetten we de contextbepaling in gang. Server components en
streaming leveren daarna snel een volledige, gepersonaliseerde pagina in plaats van een
leeg scherm dat later bijlaadt. Vercel sluit direct aan op Next.js en ondersteunt onder
meer edge-uitvoering (dicht bij de bezoeker = snel), preview-omgevingen per pull request
en automatische deployments bij elke merge.

**Supabase (PostgreSQL) — de database.** Postgres omdat ons hart relationeel is en moet
kloppen: abonnementen, wallets, credits, sessietellingen en tenant-config vragen om
integriteit en verbanden, met JSONB voor de vormvrije delen (regels, tokens). Supabase
geeft ons daar managed Postgres omheen met **Row-Level Security** — de database dwingt de
tenant-isolatie zélf af, niet alleen de code — plus opslag, een migratie-workflow (de
`migrations/`-bestanden zijn de bron van waarheid) en gegenereerde types zodat code en
database niet uit elkaar lopen.

**Drie headless CMS'en (Statamic, Sanity, Storyblok)** achter één abstractielaag, zodat we
klanten ontmoeten waar ze al zitten in plaats van ze te laten verhuizen.

**TypeScript overal** — gedeelde typen verkleinen de kans op programmeerfouten en houden
de interfaces tussen database, API en frontend consistent. Belangrijk om te scheiden: de
daadwerkelijke tenant-isolatie wordt afgedwongen in de database (Row-Level Security) en de
applicatielaag, niet door de types. TypeScript helpt de fout voorkomen; het is niet de
beveiligingsgrens.

**Stripe** — abonnementen én gebruik in één systeem, met webhooks en een test-modus waarin
het hele facturatiepad na te spelen is.

De **edge-middleware** is de voordeur: bij binnenkomst bepaalt hij voor welke tenant het
verzoek bestemd is, doet een rate-limit-check, en geeft de benodigde gegevens door aan de
context- en beslislaag — met een laatst-bekende-goede tenant-resolutie als vangnet, zodat
een bekend domein niet terugvalt op de verkeerde site. Die laag bepaalt vervolgens, met
context, regels, AI, confidence en holdout, welke ervaring per block wordt uitgeserveerd.
Het zwaardere werk — databasequeries, verrijking, AI-decisioning — gebeurt daar, niet in
de middleware zelf.

Voor de details: `docs/testing.md` (de testgate en waarom die zo is), `docs/pipeline.md`
(de deploy-flow) en `CONTRIBUTING.md` (van kale laptop tot gemergde PR).

---

## Tot slot

Wat we hebben gebouwd is geen CMS en geen losse personalisatietool. Het is een **Adaptive
Experience Platform**: een context-engine die bezoekers begrijpt, beslissingen neemt,
ervaringen aanpast, en diezelfde intelligentie gebruikt voor CRM, advertenties en analyse.
De website is één kanaal; de context-engine is de kern.

Een gewone website is een folder die voor iedereen hetzelfde is. Mister Chameleon is een
ervaring die meebeweegt met de mens ervoor — en die zichzelf bewijst.

---

*Laatst bijgewerkt: 19 juli 2026.*
