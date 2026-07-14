# Tenant Handleiding

Alle functionaliteit in de tenant-workspace, per tabblad en menu-item. De platform-brede beheeromgeving (alle tenants, integratie-secrets, systeem) staat in de **Platform-admin handleiding**.

## 1. Inleiding

De workspace heeft zeven hoofdgroepen; groepen met meerdere pagina's tonen een tweede rij met sub-items:

- **Overview** — cockpit van deze tenant
- **Design** — thema, tokens, layout, typografie (eigen tabs)
- **Content** — CMS · Pages · Blueprints · Forms · Assets
- **Personalization** — Slots · Variants · Adaptive blocks · Rules · Experiments · AI · Theme switching
- **Audience** — Interests · Segments · Target accounts · Leads · Retargeting · Suppression · Journey · Scoring
- **Platform** — Integrations · Pipeline · Snippet · Search · Storage · Debug
- **Admin** — Setup · Settings · Billing · Users

**Twee principes die overal terugkomen:**

1. **Vierlagenmodel** — veel instellingen volgen `tenant → platform → env → system`, waarbij de tenant wint. Op o.a. Forms toont een "Effective status"-overzicht welke laag actief is.
2. **Secrets verlaten de server niet** — credential-velden tonen een "configured/saved"-indicator en blijven leeg. Een leeg veld overschrijft nooit een opgeslagen geheim (server-side re-read-merge-write). Bij Retargeting komen opgeslagen secrets geredigeerd terug als `__SET__`.

---

## 2. Overview — `/admin/tenants/[id]`
- **Wat:** Cockpit: identiteit (naam, tenant-ID, package-badge, actief-status), link naar het live domein, readiness-checklist, statuspaneel, config-snapshot.
- **Waarom:** Startpunt van de workspace.
- **Acties:** Quick-actions naar Setup, Design, Settings, Rules, Billing, Content, AI, Debug.
- **Let op:** "Actief" volgt uit `features.analytics` én of het package analytics toestaat — een tenant kan inactief tonen puur door een package-limiet.

---

## 3. Design

Alles rond het visuele uiterlijk. Thema-switching op basis van regels zit **niet** hier maar onder Personalization → Theme switching.

| Tab | Wat |
|---|---|
| **Presets** | Gallery met gecureerde thema's; blijven compatibel met de automatische-switching-regels. |
| **Builder** | Eigen look samenstellen met kleurpickers + live preview; opslaan zet het thema op `custom`. |
| **Layout** | Structurele varianten voor header/footer (los van kleurtokens). |
| **Typography** | Fonts, groottes, regelhoogte. Standaard bepaalt de style-family alles; met "Override typography" open je de editor. Reset wist alle overrides. |
| **Blocks** | "Site design tokens": centraal designsysteem voor élk content-block en adaptief slot. Daaronder optioneel "Block token sets" (dark section, highlight…) per block/slot-key. |
| **Advanced** | Volledige token-editor: preset, colors, radius, spacing, borders, shadows, motion, components + JSON import/export. Overrulet de actieve preset. |

**Let op:** de theme-key wordt server-side genormaliseerd (legacy-map + fallback `default`).

---

## 4. Content

### CMS — `/content`
- **Wat:** CMS-first weergave: provider + live verbindingsstatus, "Open CMS"-deeplink, read-only page inventory, waarschuwing voor ontbrekende verplichte pagina's.
- **Acties:** "Sync CMS" (maakt **ontbrekende** documenten opnieuw aan, niet-destructief), "Open CMS →", credential-/provisioning-panelen, Content Matrix.
- **Let op:** bewust geen page-CRUD (dat hoort in het CMS). De verbindingstest draait server-side.

### Pages — `/pages`
- **Wat:** Read-only lijst van pagina's uit de platform-page-store met template-badge.
- **Waarom:** Interne pagina-CRUD voor tenants die pagina's vanuit het platform beheren.
- **Let op:** voor een CMS-tenant is Content · CMS de bedoelde ingang.

### Blueprints — `/blueprints`
- **Wat:** Blueprint Marketplace: activeren scaffoldt pagina's, regels, scoring en sequences in één keer.
- **Acties:** preview → "Activate Blueprint" met checkbox **Force overwrite**.
- **Let op:** Force overwrite vervangt bestaande regels/scoring — onomkeerbaar.

### Forms — `/forms`
- **Wat:** Afhandeling van formulierinzendingen: Effective Status, Email Transport, Recipients, Default Behavior, retentie + read-only lijst geregistreerde formulieren.
- **Acties:** per sectie eigen save; subroute **Submissions** met filter, paginering en retentietermijn.
- **Let op:** dit is géén formulier-builder; het regelt de afhandeling. Vierlagenmodel.

### Assets — `/assets`
- **Wat:** Asset-bibliotheek van de tenant.
- **Let op:** storage-provider kies je onder Platform → Storage; credentials staan op platformniveau.

---

## 5. Personalization

### Slots — `/behavior/slots`
Per slot (hero, proof, cta, feature, conversion, notification) de AI-modus: **AI-assisted** (AI kiest bij voldoende confidence, anders rules-plan), **Rules only**, of **Static** (vaste key).
**Let op:** de globale AI-mode (Settings → AI) moet op `shadow`/`live` staan, anders vallen alle AI-slots terug op rules. Default per slot = AI-assisted.

### Variants — `/variants`
Read-only: Page → Variants en Variant → Pages (incl. dode keys). Alleen een Refresh-knop. Databron verschilt per CMS.

### Adaptive blocks — `/blocks`
Status per block key: **Customized** / **Platform default** / **Not configured**. Acties: Edit, Customize (forkt een tenant-kopie), Create, **Reset to default**, verwijderen, "✨ Generate variant".
**Let op:** Customize forkt permanent — de kopie volgt daarna geen platform-updates meer. In de editor zitten ook de AI/Decision-signalen die bepalen of een block AI-selecteerbaar is.

### Rules — `/rules`
De deterministische kern: contextuele regels die het plan (variant per slot) bepalen. Master-toggle, conditie-builder (veld/operator/waarde, AND/OR), Save/Reset, preset-seed.
**Let op:** wijzigingen zijn pas actief na "Save changes"; de server valideert autoritatief. Geneste sub-groepen toont de platte editor niet.

### Experiments — `/experiments`
Plan-gebaseerd A/B-testen, gekoppeld aan één rule: control = het rule-plan, challenger = datzelfde plan + overrides. Master-toggle, aanmaakformulier (rule, challenger, split), lifecycle draft → active → paused → ended.
**Let op:** master uit = alle evaluatie overgeslagen. Je hebt eerst een rule nodig.

### AI — `/ai`
Decision-explainability: config-samenvatting, laatste 50 beslissingen, gids over de vier beslispaden (rule / experiment / AI / fallback). Vrijwel read-only; instellen doe je op Settings.

### Theme switching — `/theme-switching`
Regels ↔ thema's, sessiegebonden. Drie trigger-modi: **RAW**, **CTX** (audience-profielen + confidence) en **CTX+** (context én extra conditie).

---

## 6. Audience

### Interests — `/interest-profiles`
Interesseprofielen scoren gedrag → `interestPrimary`, `interestSecondary`, `interestConfidence` + score per profiel. Platform-profielen per tenant aan/uit; eigen profielen aanmaken.
**Let op:** platform-actieve profielen staan standaard aan voor elke tenant.

### Segments — `/audience-segments`
CRUD op segmenten (key, label, criteria). Herbruikbaar in rules, Target accounts en Retargeting.
**Let op:** toggle/delete kan rules breken — de dependency-check waarschuwt.

### Target accounts — `/abm`
ABM: accounts/contacten met persoonlijke link (`/go/ax93z` of vanity path). CSV-import, Sales Navigator-import, Copy link, bezoekhistorie, Account dashboard.
**Let op:** zonder primair domein valt de link terug op een relatief pad. Hier leeft named-contact PII.

### Leads — `/leads`
Unified lead base: anonymous → recognised → known → customer. Filters, Hottest/Most recent, account-groepering, event-timeline, delete (erasure), export CSV/JSON, CRM-instellingen (webhook + secret, HubSpot-token, deliveries met replay).
**Let op:** 90 dagen retentie. Bij walletsaldo €0 draaien recognitions door maar wordt de credit niet gefactureerd.

### Retargeting — `/ad-sync`
Audience-sync naar Google Ads / Meta / LinkedIn (SHA-256-gehashte identifiers) + conversie-feedback. Master-toggle, segmentdefinitie, per platform Test/Save/Disconnect, Preview segment, Sync now, recente syncs.
**Let op (AVG):** identifiers delen is een aparte verwerking met eigen grondslag + verwerkersovereenkomst per platform. Laat "alleen leads met toestemming" aan tenzij je DPO anders bepaalt.

### Suppression — `/leads/suppression`
Opt-outlijst: adressen die niet benaderd mogen worden. Vallen uit de audiences en worden direct bij de ad-platforms verwijderd. Handmatig onderdrukken/opheffen; gevoed door de suppressie-webhook.
**Let op:** vereist `LEAD_SUPPRESSION_SECRET`; zorg dat de Vercel-firewall `/api/webhooks/*` niet challenget.

### Journey — `/behavior/journey`
Read-only journey-intelligence per sessie: stage, confidence, friction, "Why This Experience?", event-timeline, matched sequences.

### Scoring — `/behavior`
Scoring rules (event → score), sequence patterns en decay profiles. Tabs Overview · Scoring Rules · Sequences · Decay Profiles + seed-knoppen.
**Let op:** de `key` is een slug die je beter niet achteraf wijzigt.

---

## 7. Platform

| Pagina | Wat | Let op |
|---|---|---|
| **Integrations** `/integrations` | Wat déze tenant gebruikt: CMS-provider + config, CRM aan/uit, AI (mode/provider/model/threshold), enrichment, Vercel-domeinen. | Secrets nooit hier; ontbreekt de platform-credential → toggle disabled. |
| **Pipeline** `/integrations/pipeline` | Enrichment-stages aan/uit + volgorde binnen de wave. Wave 1 (MaxMind, IPinfo, GA4), Wave 2 (Reverse Geocode, Weather, OpenKvK, Leadinfo), Sequential (HubSpot, Seasonal). | Wave-indeling ligt vast; IP-classificatie en cloud-detectie zijn always-on. |
| **Snippet** `/snippet` | Site key + `<script>`-tag, aan/uit, `data-mc-slot`-uitleg. Tabs Install en How it works. | Regenereren maakt de vorige key direct ongeldig. |
| **Search** `/search` | Zoekprovider (o.a. Meilisearch, Auto-detect) + reindex. | Vereist de tabel `tenant_search_settings`; reindex kan zwaar zijn. |
| **Storage** `/storage` | Providerkeuze: Platform default, Supabase, R2, Sanity. | Alleen de keuze is per tenant; credentials op platformniveau. |
| **Debug** `/debug` | Debug-overlay aan/uit + niveau (off/summary/full); in dev een dev-tenant-cookie. | Default uit. De overlay gate't alleen de weergave; beslislogica draait altijd. |

---

## 8. Admin

### Setup — `/setup`
Provisioning-hub: readiness-checklist, site-builder gates, CMS-credentials, site aanmaken/initialiseren, domeinen + Vercel; bij Statamic extra deploy-panelen en setup-gids.
**Let op:** geen paneel toont secret-waarden. Domeinbeheer vereist de Vercel-integratie op platformniveau.

### Settings — `/settings`
Identity, Package, CMS, AI, Design, Languages, Features, Allowed Blocks + verwijderen.
**Let op:** de Package-selector schrijft het pakket direct weg en **omzeilt billing** — alleen voor super-admins; tenant-admins zien een read-only indicator met link naar Billing.

### Billing — `/billing`
Zie hoofdstuk 9.

### Users — `/users`
Tenant-admins toewijzen/verwijderen; super-admins hebben impliciet toegang.
**Let op:** super-admin-only pagina; super-admins kun je hier niet verwijderen.

---

## 9. Billing & credits in detail

> Er zijn **twee volledig gescheiden valuta's**: enrichment-credits en sessie-credits. Beide staan los van je abonnement.

### 9.1 Abonnementen

| Plan | Prijs | Sessies/mnd | Extra |
|---|---|---|---|
| Starter | €149/mnd (€124 jaarlijks, −17%) | 25.000 | — |
| Growth | €349/mnd (€279 jaarlijks, −20%) | 150.000 | AI-personalisatie, CRM/ABM-enrichment, custom decay, analytics |
| Pro | €749/mnd (€599 jaarlijks, −20%) | 500.000 | + multi-tenant, priority support |

Sessies zijn de **enige** numerieke limiet; rules, experimenten, segmenten en pagina's zijn ongelimiteerd.

Statussen: `active`, `trialing`, `past_due`, `canceled`, `unpaid`, `paused`. Effectief plan = actief Stripe-abonnement → anders `packageKey` → anders Starter. Trials duren 14 dagen met volledige features.

**Let op de periodes:** de sessie-cap en credit-maandcap resetten op de **UTC-kalendermaand**, niet op je billing-periode.

**Planwissel:** maandelijks → upgrade direct met proratie, downgrade gepland per einde periode. Op een jaarplan zijn downgrades en switches naar maandelijks geblokkeerd.

**Dunning:** mislukte incasso → `past_due` + eenmalige mail → quarantaine (standaard **8 dagen**, instelbaar 1–90) waarin `/api/snippet/decide` lege slots teruggeeft (site toont standaardcontent) → onbetaald → `unpaid` en de endpoint geeft **404**. Bij betaling terug naar `active`.

### 9.2 Enrichment-credits

**1 credit = €0,01.** Wallet met append-only grootboek.

| Categorie | Kosten | Types |
|---|---|---|
| Recognition | 3 credits/call | ip_enrich, reverse_geocode, company_lookup, leadinfo_lookup |
| Adaptation | 3 credits | intent_enrich, weather_enrich |
| Brainpower | 6 credits | ga4_history, crm_lookup |

**Cache-hits en mislukte calls kosten 0 credits.**

**Bijkopen:** 250 (€6,50), 1.000 (€22), 5.000 (€99). Optioneel auto-reload (drempel, bedrag, maandelijkse cap) — vereist een gekoppelde betaalmethode.

**Geen overage:** het saldo gaat nooit negatief. Bij 0 wordt de wallet opgeschort en worden enrichment-calls geblokkeerd; de bezoeker krijgt de fallback-ervaring. De guard faalt bewust *open* bij DB-fouten, zodat billing nooit de bezoekerservaring sloopt.

**Budget caps:** maandelijkse credit-cap (0 = ongelimiteerd) met gedrag bij bereiken: *Full adaptive* (alles aan), *Smart lite* (alleen Recognition, standaard) of *Default* (geen enrichment). Plus per-categorie kill-switches onder Cost Controls.

> Aandachtspunt: de maandcap leeft op twee plekken — de wallet-kolommen die de guard leest (Budget-kaart) en de credit-settings (Cost Controls).

### 9.3 Sessie-credits

Bundels: 10.000 (€24,90), 50.000 (€99), 200.000 (€349). **Verlopen nooit**, komen bovenop de plan-cap.

De sessie-cap is een **soft cap**: boven de limiet krijgen bezoekers de standaard (niet-gepersonaliseerde) ervaring zonder errors, tot de maand reset of je bijkoopt. De top-upprijs (€2,49/1K) ligt bewust boven het Pro-tarief (€1,50/1K) om upgraden te stimuleren.

### 9.4 Het dashboard

Zes tabs: **Credits & Usage · Enrichment Wallet · Plan · Sessions · Payments · Debug**. Bovenaan altijd saldo (credits + euro), status-badge, Today / This month / Est. monthly en een budget-voortgangsbalk.

Acties: bundels kopen, maandbudget opslaan, cost controls, auto-reload, notificaties, plan wisselen, Stripe-portal openen, ledgers doorbladeren.

**Super-admin-only** (ook server-side afgedwongen): wallet reactiveren, handmatig credits toekennen (grant/adjustment/refund) en het abonnements-beheerpaneel (status/plan/periode/trial, pending plan activeren, sync vanuit Stripe).

Bundels tonen "Not configured" zolang de Stripe price-ID niet op platformniveau is ingesteld.
