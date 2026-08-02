# Demo-draaiboek — Mister Chameleon

Stap-voor-stap draaiboek voor een volledige demo van het platform op de
Mister Chameleon-website. Bedoeld als script achter de hand: links de handeling,
rechts wat je vertelt en wat de kijker op het scherm ziet gebeuren.

Bijgewerkt: 2 augustus 2026. Tenant: `mister-chameleon`.

---

## 0. De rode draad (zeg dit vooraf)

> "Wij hebben vier soorten klanten en één website. Iedereen komt nu op dezelfde
> pagina met hetzelfde verhaal in dezelfde volgorde — de inkoper leest eerst wat
> de sollicitant zou moeten lezen. Dat kost geld op de plek waar de beslissing
> valt. Ik laat je zien hoe dezelfde site zich per bezoeker anders gedraagt, en
> — belangrijker — hoe we meten of dat uitmaakt."

Houd die zin vast. De hele demo is die zin, bewezen.

---

## 1. Voorbereiding (5 minuten vóór de call)

1. Zorg dat je op de **dev**-omgeving zit (of een demo-tenant), niet op een
   klant-productiesite.
2. Open twee tabbladen: **(A)** de Mister Chameleon-website, **(B)** de admin
   (`/admin/tenants/mister-chameleon`).
3. Open het **Scenario Control Panel** op de site (de client-side control die de
   `mc_scenario`-cookie schrijft). Hiermee wissel je live van persona zonder de
   code of de database te raken.
4. Zet de debug-overlay op **summary** (Admin → Debug) zodat je tijdens de demo
   kunt laten zien wélke regel vuurde en waaróm — maar houd hem klein.
5. Ververs één keer "koud" (scenario leeg) zodat je met de **standaardervaring**
   begint.

---

## 2. De kern-demo: één site, vier bezoekers

Dit is het hart. Doe het rustig en herhaal steeds hetzelfde patroon:
**persona kiezen → verversen → benoemen wat er verandert.**

### 2a. De baseline (standaardervaring)

- **Doen:** scenario leeg, ververs de homepage.
- **Zeggen:** "Dit is wat iedereen vandaag ziet. Onthoud de kop, de volgorde en
  de knop." De inhoud die je ziet komt uit het CMS van de klant — dat is de
  veilige default. Als ons platform wegvalt, is dít wat er staat. Er breekt
  niets.

### 2b. Persona 1 — de inkoper / enterprise-prospect

- **Doen:** Scenario Control → activeer een zakelijk/enterprise-scenario (bv.
  segment `enterprise-prospect` of `high-intent`). Ververs.
- **Zeggen:** "Zelfde URL, zelfde pagina. Maar de kop, het bewijs en de knop
  staan nu in de volgorde die een inkoper overtuigt — en het thema is
  meegeschoven." Wijs de veranderde hero, proof en CTA aan (de `data-mc-slot`-
  elementen).
- **Laat zien in debug:** welke regel vuurde en welke variant per slot gekozen is.

### 2c. Persona 2 — de sollicitant (careers)

- **Doen:** activeer een careers/sollicitant-scenario. Ververs.
- **Zeggen:** "Andere bezoeker, andere beslissing. Nu leidt de pagina met de
  vacature-boodschap in plaats van de zakelijke — precies het omgekeerde van wat
  de inkoper zag."

### 2d. Persona 3 — de bekende klant / retentie

- **Doen:** activeer `crm-known` of `returning-engager`. Ververs.
- **Zeggen:** "Deze kennen we al (bekend in het CRM). We verspillen geen ruimte
  meer aan acquisitie-boodschappen; we tonen wat past bij iemand die al klant is."

### 2e. Persona 4 — herkomst-gedreven (LinkedIn / betaald verkeer)

- **Doen:** activeer `linkedin-traffic` of `paid-acquisition`. Ververs.
- **Zeggen:** "We adverteren gericht en weten dus wie er binnenkomt. De landing
  sluit nu aan op de advertentie, zonder aparte landingspagina die niemand
  bijhoudt."

> **Belangrijk voor de directeur in de zaal:** benoem hier dat het scenario de
> regel-engine bewust *bypasst* voor een schone demo (deterministisch), maar dat
> in productie exact dezelfde uitkomst uit de regels + scores + verrijking rolt.

### 2f. De holdout — het stuk dat overtuigt

- **Zeggen:** "Een deel van de echte bezoekers krijgt bewust de oude versie.
  Niet omdat we twijfelen, maar zodat we kunnen meten of het uitmaakt. Dít is het
  stuk dat een directeur overtuigt — niet de personalisatie, maar dat het
  meetbaar is."
- **Laat zien:** Admin → Personalization → Experiments (challenger/holdout).

---

## 3. Onder de motorkap: hoe de beslissing valt

Wissel naar het admin-tabblad. Vertel de keten in één adem:
**bezoeker → context → beslissing → variant → meten.**

- **Context:** welke signalen we per bezoeker hebben (gedrag, tijd, herkomst en —
  met toestemming — bedrijf via IP-verrijking). Toon Scenario Control's enrichers
  (IP/Geo, Company, OpenKVK, Leadinfo, HubSpot, GA4) die je aan/uit kunt zetten.
- **Beslissing:** server-side, met een veilige default en een hard tijdsbudget —
  de pagina "springt" niet en valt nooit leeg.
- **Privacy als onderscheid:** verrijking is *consent-gated* en de data staat in
  de EER (Ierland). Dat is het verschil met de Amerikaanse platformen.

---

## 4. Tab-voor-tab (wat je laat zien en wat het op de site doet)

Loop deze in deze volgorde; het bouwt het verhaal op van "wat de bezoeker krijgt"
naar "waarom" naar "bewijs".

### Personalisatie (de kern)

- **Rules** — "Hier bepalen we: als dit signaal, dan deze variant." Laat één
  regel zien die net vuurde in de demo. Scroll naar de **score-distributie** (of
  het scoremodel echt onderscheidt over echte sessies) en **regel-vuringen**
  (welke regels vuren, en welke nooit — dus dood zijn). Dit is je meet- en
  onderhoudsgereedschap.
- **Adaptive blocks** — "Dit zijn de content-varianten zelf, per slot (hero,
  proof, cta) en per formulier." Toon een variant en de status (Customized /
  Platform default). Noem de **AI-generator** (brief → gevalideerde
  variant-draft) als optionele versneller — maar alleen als self-service aanstaat.
- **Experiments** — A/B op planniveau: bucket 0 krijgt het plan, bucket 1 het
  plan + challenger. "Complete, samenhangende varianten van de journey, niet losse
  knopjes."
- **AI-policy / Field Fill / Decisions / AI-logs** — leg het onderscheid uit:
  *shadow* (AI draait mee maar wordt alleen gelogd) vs *live* (bij genoeg
  vertrouwen geserveerd, anders valt het veilig terug op de CMS-tekst). Decisions
  en AI-logs zijn puur inzicht.
- **Context variables** — de signalen die regels/AI mogen gebruiken (let op:
  platform-breed).
- **Variants** — read-only overzicht: welke variant op welke pagina, en welke
  keys dood zijn.

### Publiek & leads

- **Audience → Interests / Scoring / Segments** — hoe een bezoeker een score en
  een segment krijgt (interesseprofielen, scoringsregels, sequences, decay).
- **Audience → Leads (Lead Base)** — het profielregister anoniem→herkend→bekend→
  klant, met verwijderen (erasure) en export.
- **Audience → Target accounts (ABM)** — persoonlijke links per doelaccount.
- **Audience → Retargeting (Ad Sync)** — segmenten naar Google/Meta/LinkedIn,
  server-side gehasht, consent-gated.
- **Audience → Journey** — read-only visualisatie van de sessie-journey (mooi in
  een strategiegesprek).

### Content, design & vorm

- **Content** — CMS-first: status, "Open in CMS", forms-afhandeling, assets,
  blueprints, adaptieve e-mail (preview).
- **Design** + **Theme switching** — het thema/typografie/tokens, en hoe een
  regel een thema aan een bezoeker koppelt. Koppel dit aan wat ze in 2b–2e zagen
  meeschuiven.

### Integraties, setup & operations

- **Integrations** — CMS, CRM (HubSpot), AI-mode, enrichment (MaxMind), domeinen.
- **Snippet** — "Dit ene script-tag in de `<head>` maakt een bestaande site
  adaptief. Geen nieuwe website." Toon de `data-mc-slot`-conventie.
- **Settings** — features aan/uit, retentietermijn, self-service-toggle, plan.
- **Setup** — go-live checklist, site aanmaken, domeinen.
- **Search** — Meilisearch-reindex.
- **Storage / Users / Debug** — provisioning, toegang, en de debug-overlay + het
  faalsignaal-paneel (opslag/mail/decide) waarmee je stille fouten ziet.

### Ads-net (optioneel, als het gesprek daarom vraagt)

- **Ads** + **Publishers** — de tenant als advertentie-account en de
  revenue-share-kant. Sla over tenzij relevant.

---

## 5. Bewijs & betrouwbaarheid (de directeur-slides, kort)

- **Meetbaar:** holdout + score-distributie + regel-vuringen = je ziet of de
  invoer onderscheidt én of de regels iets doen.
- **Snel & veilig:** server-side beslissing binnen een 700ms-budget, veilige
  default, per-tenant nood-schakelaar (terug naar standaard zonder deploy),
  instant rollback.
- **Privacy:** EER (Ierland), consent-gated verrijking, meestuurbare
  verwerkersovereenkomst.

---

## 6. Afsluiting

Herhaal de openingszin, nu bewezen: "Vier soorten klanten, één website — en we
kunnen meten dat het uitmaakt." Vraag of hij het in zijn eigen woorden teruggeeft;
als zijn formulering beter is dan deze, neem die over.

**Let op tijdens de call:** verkoop geen software en dienst apart. Eén verhaal,
één bedrag (setup + maandbedrag; pilot met vaste einddatum en vervolgtarief).
