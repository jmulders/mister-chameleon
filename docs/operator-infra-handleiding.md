# Operator & Infra Handleiding

Van scratch tot closed loop: alle diensten, variabelen en omgevingen. Dit document is de brede naslag; `statamic-tenant-handleiding.md` is de compacte stap-voor-stap voor één Statamic-tenant.

## 1. Architectuur en omgevingen

Drie systemen:

- **Platform** — Next.js op Vercel. Domein, personalisatie, admin, API-routes, ad-sync, conversies.
- **CMS** — Statamic/Laravel op Ploi. Content + Control Panel.
- **Supabase** — database (leads, profielen, ad-sync, billing, logs).

Het publieke domein draait via het platform; content komt uit Statamic. Formulieren en conversies lopen altijd via het platform.

### Waar hoort configuratie

1. **Admin-UI** (Platform → Integrations) — voorkeur voor bijna alle credentials. Versleuteld in de DB en heeft **voorrang op env-vars**.
2. **Vercel env** — platform-basis (Supabase, admin-secret, cron) + fallback.
3. **Ploi `.env`** — alleen de Statamic-app.

> Vuistregel: staat er "kan ook via admin-UI", gebruik dan de UI. Voorkomt redeploys en houdt secrets uit env.

### Omgevingen

| Omgeving | Bijzonderheden |
|---|---|
| Lokaal | `.env.local`; cron-secrets zelf zetten |
| Staging | Vercel preview/branch; zet `MC_FALLBACK_TENANT_ID` zodat `*.vercel.app` naar een tenant resolvet |
| Productie | Vercel production; `CRON_SECRET` zet je zelf als env var, Vercel stuurt hem daarna mee met elke cron-aanroep |

---

## 2. Stap-voor-stap: van scratch tot closed loop

1. **Supabase** — project aanmaken, URL + anon + service-role noteren, migraties draaien. `supabase db push` kan falen op history-mismatch → draai migraties los via de SQL-editor.
2. **GitHub + Vercel** — repo koppelen; minimaal Supabase-vars, `ADMIN_SESSION_SECRET` (≥32 tekens), `NEXT_PUBLIC_SITE_URL`. Check Admin → Platform → Deployment.
3. **Admin + 2FA** — eigen JWT-sessie met TOTP (`ADMIN_SESSION_SECRET`, `ADMIN_TOTP_ISSUER`). Geen NextAuth.
4. **Tenant aanmaken** — Admin → New Tenant; CMS-provider = Statamic.
5. **Statamic uitrollen** — geautomatiseerd (repo uit template + Ploi-app; vereist `GITHUB_TOKEN` + `PLOI_CLOUD_TOKEN`, of Forge) of handmatig koppelen. **Ploi-FS is ephemeral**: zet `STATAMIC_GIT_ENABLED`/`_AUTOMATIC`/`_PUSH` aan, anders gaan CP-edits verloren. `STATAMIC_PRO_ENABLED=true` is verplicht (navigations zijn Pro).
6. **Schrijfroute beveiligen** — één geheim: `openssl rand -base64 32` → `STATAMIC_API_KEY` (Vercel) **én** `MISTER_CHAMELEON_CMS_WRITE_TOKEN` (Ploi). Test: curl zonder token → **401**.
7. **Domein** — `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` (+ `VERCEL_TEAM_ID`) of via Integrations → Domains. DNS-records zetten (bijv. Cloudflare). Zonder token: domeinen direct actief zónder verificatie.
8. **Snippet** — site key genereren (Platform → Snippet), script in de Statamic-`<head>`, slots markeren met `data-mc-slot`. Regenereren maakt de vorige key direct ongeldig.
9. **E-mail** — Resend of SMTP via Integrations → Email. Resolutie: tenant → platform → env → skip. Zet `EMAIL_ENCRYPTION_KEY` (32-byte hex, env-only, nooit wijzigen).
10. **Stripe** — keys + webhook (`/api/webhooks/stripe`) + price-ID's. `STRIPE_MODE` bepaalt test/live; `event.livemode` wordt hiertegen gevalideerd.
11. **Enrichment** — keys via Integrations → Enrichment; per tenant stages/volgorde via Platform → Pipeline.
12. **HubSpot** — Private App-token via Integrations → CRM; per tenant aanzetten. Optioneel `HUBSPOT_COMPANY_*_PROP`.
13. **AI** — platform-fallback keys via Integrations → AI; per tenant mode/provider/threshold via Settings. Begin met **shadow**.
14. **Storage** — Supabase / R2 / Sanity via Integrations → Storage. `R2_ACCOUNT_ID` zetten maakt de andere vier verplicht. DB-config wint van env.
15. **Search** — Meilisearch heeft **geen env-vars**; host/key/prefix per tenant onder Platform → Search. Volgorde: Meilisearch → Sanity GROQ → in-memory.
16. **Google Ads retargeting** — Data Manager API aan; OAuth-client; refresh token met scope `.../auth/datamanager`; customer id (+ MCC); Customer list → user list id. Invullen bij Doelgroepen → Retargeting, Test connection, Save, dagelijkse sync aan.
17. **Google Ads conversies** — conversie-actie: Doelen → Conversies → Nieuw → **Conversies offline** → "stap overslaan" + **Verbeterde conversies voor leads aanzetten** → categorie *Gekwalificeerde lead* → `ctId` uit de URL. **Daarna de account-instelling**: Doelen → Conversies → Instellingen → "Verbeterde conversies voor leads" aanzetten + voorwaarden accepteren. Zonder die stap: `DESTINATION_ACCOUNT_NOT_ENABLED_ENHANCED_CONVERSIONS_FOR_LEADS`. Activatie duurt minuten tot ~24u. Vul `ctId` in bij Retargeting → Conversie-feedback.
18. **Formulieren** — alles loopt via één gedeelde route (contact, CMS-formulieren, trial, demo, aankoop). Statamic-eigen formulieren gaan via de **inbound-form-brug**: listener in de CMS-app → `POST /api/webhooks/inbound-form?tenant=<id>` met `x-mc-secret`. `LEAD_INBOUND_SECRET` op Vercel **én** Ploi, en `php artisan config:clear` in de Ploi-deploy.
19. **Suppressie** — `LEAD_SUPPRESSION_SECRET`; ESP post naar `/api/webhooks/suppression?tenant=<id>`.
20. **Firewall + cron** — Vercel → Firewall → Rules: **Bypass** voor `/api/webhooks/*` (Starts with), anders challenget Vercel legitieme webhooks. `CRON_SECRET` gate't alle cron-endpoints. Hetzelfde geldt voor de updateroutes van de WordPress-plugin: **Bypass** voor `/api/plugin/wp/` (Starts with). Zonder die regel krijgt een WordPress-site op een updatecheck het controlescherm van Vercel terug (429 met `x-vercel-mitigated: challenge`, gemeten op 22-11-2026) en ziet hij nooit een nieuwe versie. De routes begrenzen zichzelf per siteKey (60 checks en 10 downloads per minuut), dus de bypass zet ze niet open.
21. **Testen** —
    ```bash
    curl -i -X POST "https://www.jouwsite.nl/api/webhooks/inbound-form?tenant=<id>" \
      -H "Content-Type: application/json" \
      -H 'x-mc-secret: <LEAD_INBOUND_SECRET>' \
      -d '{"values":{"email":"test@example.com"}}'
    ```
    ```sql
    select identifier, (profile->>'email') as email, created_at
    from abm_leads where tenant_id='<id>' and identifier like 'form_%'
    order by created_at desc limit 5;

    select platform, status, event_name, error, created_at
    from ad_conversion_events where tenant_id='<id>'
    order by created_at desc limit 5;
    ```
    `status = ok` op het Google-event = de volledige closed loop werkt.

---

## 3. Env-manifest per dienst

### Supabase
| Variabele | Waar | Verplicht | Waarvoor |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + lokaal | ja | Project-URL. Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + lokaal | ja | Anon key (RLS). Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + lokaal | ja | Server-side writes. **Secret** |
| `SUPABASE_ACCESS_TOKEN` | lokaal | nee | Migratie-scripts (Management API). **Secret** |
| `SUPABASE_REST_READ_TIMEOUT_MS` | Vercel | nee | Na hoeveel milliseconden een leesvraag aan de database opgeeft. Standaard 8000, 0 zet de limiet uit |
| `SUPABASE_REST_WRITE_TIMEOUT_MS` | Vercel | nee | Hetzelfde voor schrijfacties en RPC-aanroepen. Standaard 15000, 0 zet de limiet uit |
| `SUPABASE_REST_BREAKER_OPEN_MS` | Vercel | nee | Hoe lang de database wordt overgeslagen na twee keer geen antwoord. Standaard 15000, 0 zet de zekering uit |

### Admin / auth
| Variabele | Waar | Verplicht | Waarvoor |
|---|---|---|---|
| `ADMIN_SESSION_SECRET` | Vercel + lokaal | ja | HS256-signing admin-JWT, ≥32 tekens. **Secret** |
| `ADMIN_TOTP_ISSUER` | Vercel | nee | Label in authenticator. Default "Mister Chameleon Admin" |
| `ADMIN_SECRET` | Vercel | nee | Beveiligt `/api/cache`; endpoint uit zolang leeg. **Secret** |

### Platform-basis
| Variabele | Waar | Verplicht | Waarvoor |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Vercel | aanbevolen | Canonieke origin (OG/SEO/sitemaps). Public |
| `NEXT_PUBLIC_APP_URL` | Vercel | nee | Snippet-embed, billing-portal, CMS-callbacks. Public |
| `DEMO_PUBLIC_BASE_URL` | Vercel | nee | Base-URL-override (demo/mirror) |
| `MC_FALLBACK_TENANT_ID` | Vercel (staging) | nee | Tenant bij onbekende hostname. Default `mister-chameleon` |
| `MARKETING_SITE_TENANT` | Vercel | nee | Fallback-tenant aankoop-conversie. Default `statamic` |
| `MC_HOMEPAGE_DECISION_PROVIDER` | Vercel | nee | `rules` \| `claude` \| `openai`. Aanbevolen: `rules` |
| `GITHUB_REPO` | Vercel | nee | Repo voor workflow-dispatch. Default `jmulders/mister-chameleon` |
| `SESSION_CACHE_TTL_SECONDS` / `_STALE_GRACE_SECONDS` | Vercel | nee | TTL enrichment-sessiecache (dev 30s / prod 4u) |
| `NEXT_PUBLIC_STORYBOOK_URL` | Vercel | nee | Storybook-iframe in theme-gallery. Public |

Dev-only toggles: `NEXT_PUBLIC_DEBUG_DIAGNOSTICS`, `NEXT_PUBLIC_SHOW_SCENARIO_PANEL`, `ENABLE_DEBUG_RESET`, `ENABLE_DEBUG_IP_OVERRIDE`, `CMS_CACHE_TTL_SECONDS`, `CMS_FORCE_CACHE`, `DECISION_CACHE_TTL_SECONDS`, `DECISION_FORCE_CACHE`.

### Cron / jobs
| Variabele | Waar | Verplicht | Waarvoor |
|---|---|---|---|
| `CRON_SECRET` | Vercel | ja (prod) | Gate op alle cron-endpoints. Eén cron in `vercel.json` (`/api/cron/daily`, 03:00 UTC) draait alle jobs na elkaar. Zonder deze variabele antwoordt elke cron 401 en draait er niets. **Secret** |
| `KEEP_WARM_URLS` | Vercel | nee | Sites die het opwarmen bezoekt, met komma's ertussen. Standaard `https://www.misterchameleon.nl` |

**Opwarmen (`/api/cron/keep-warm`).** Een functie bij Vercel stopt na een tijd zonder verzoeken, en de eerstvolgende bezoeker wacht dan seconden tot er een gestart is. Dit adres vraagt de homepage op, zodat de functie wakker blijft. Het wordt van buiten aangeroepen, elke vijf minuten: de cron van Vercel mag op het Hobby-plan maar eens per dag, en de planner van GitHub draaide de "uurlijkse" afrekening in november 2026 twee tot drie keer per dag.

- **Instellen bij cron-job.org:** een taak met het adres `https://www.misterchameleon.nl/api/cron/keep-warm`, methode GET, elke 5 minuten. Geen kop en geen sleutel: het adres vraagt er geen, omdat `CRON_SECRET` ook de afrekening opent en niet bij een derde hoort.
- **Een ping kost niets.** Het adres stuurt een kop mee die van `CRON_SECRET` is afgeleid, en de homepage geeft zo'n verzoek de standaardpagina: geen AI-aanroep, geen verrijking, geen getelde sessie. Zonder `CRON_SECRET` pingt het adres niet (antwoord 500).
- **Controleren:** het antwoord is `{"ok":true,…}` met per site een status 200. Een 502 met `"mitigated":"challenge"` betekent dat de firewall van Vercel het bezoek aan de homepage tegenhoudt. Een 429 met het controlescherm op het adres zelf betekent dat de firewall de planner tegenhoudt. In beide gevallen is een **Bypass**-regel nodig in Vercel → Firewall → Rules (zie stap 20).

### Lead-base & webhooks
| Variabele | Waar | Verplicht | Waarvoor |
|---|---|---|---|
| `LEAD_INBOUND_SECRET` | Vercel + **Ploi** | ja bij Statamic-formulieren | `x-mc-secret` op `/api/webhooks/inbound-form`. Zelfde waarde beide kanten. **Secret** |
| `LEAD_SUPPRESSION_SECRET` | Vercel | ja voor opt-outs | `x-mc-secret` op `/api/webhooks/suppression`. **Secret** |
| `N8N_CONTACT_WEBHOOK_URL` | Vercel | nee | n8n-webhook contactformulier; afwezig = overgeslagen |
| `MC_DEMO_SITE_KEY` (+ `_FALLBACK`) | Vercel | nee | Beveiligt `/api/demo/mirror`. Kan ook via admin-UI. **Secret** |

### CMS — Statamic (platform-zijde)
| Variabele | Waar | Verplicht | Waarvoor |
|---|---|---|---|
| `STATAMIC_API_URL` | Vercel | nee | Base-URL; zet Statamic aan. Kan ook via admin-UI |
| `STATAMIC_API_KEY` | Vercel | ja bij Statamic | API-token **én** gedeeld geheim schrijfroute (= `MISTER_CHAMELEON_CMS_WRITE_TOKEN`). **Secret** |
| `STATAMIC_WEBHOOK_SECRET` | Vercel | nee | `x-statamic-secret` cache-flush. Kan ook via admin-UI. **Secret** |
| `STATAMIC_CP_ORIGIN` | Vercel | nee | CP-origins voor live preview (CSP frame-ancestors) |
| `STATAMIC_CMS_PATH` | lokaal | nee | Lokale flat-file-content als de API onbereikbaar is |
| `REVALIDATE_SECRET` | Vercel | nee | Geheim voor `/api/revalidate`. **Secret** |

### Statamic-app (Ploi `.env`)
| Variabele | Verplicht | Waarvoor |
|---|---|---|
| `MISTER_CHAMELEON_API_URL` | ja | Platform-URL voor de webhook-listener |
| `MISTER_CHAMELEON_WEBHOOK_SECRET` | ja | Moet matchen met `STATAMIC_WEBHOOK_SECRET`. **Secret** |
| `MISTER_CHAMELEON_CMS_WRITE_TOKEN` | ja | Moet gelijk zijn aan `STATAMIC_API_KEY`. **Secret** |
| `MISTER_CHAMELEON_TENANT_KEY` | ja | siteKey van de tenant |
| `LEAD_INBOUND_SECRET` | ja bij formulieren | Zelfde waarde als op Vercel. **Secret** |
| `APP_KEY` | ja | Laravel-encryptiesleutel. **Secret** |
| `APP_ENV` / `APP_DEBUG` / `APP_URL` | ja | `production` / `false` / platform-URL |
| `STATAMIC_LICENSE_KEY` | ja (prod) | Licentie. **Secret** |
| `STATAMIC_PRO_ENABLED` | ja | **Moet `true`** — anders 404 op de nav-API |
| `STATAMIC_API_ENABLED` | ja | REST-API aan |
| `STATAMIC_GIT_ENABLED` / `_AUTOMATIC` / `_PUSH` | ja | Persisteert CP-edits naar de repo (FS is ephemeral) |
| `SESSION_DRIVER` | ja | `file` |
| `MISTER_CHAMELEON_MODE` / `_TIMEOUT` / `_CACHE_TTL` / `_BOT_DEFAULT` | nee | `edge` (default), 1.5s, 60s, true |

### Stripe
| Variabele | Verplicht | Waarvoor |
|---|---|---|
| `STRIPE_SECRET_KEY` | voor billing | Live secret. Kan ook via admin-UI. **Secret** |
| `STRIPE_WEBHOOK_SECRET` | voor billing | Signing secret. Kan ook via admin-UI. **Secret** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | nee | Public |
| `STRIPE_MODE` | nee | `test` \| `live` (default live) |
| `STRIPE_TEST_SECRET_KEY` / `_WEBHOOK_SECRET` / `_PUBLISHABLE_KEY` | nee | Test-mode |
| `STRIPE_PRICE_{STARTER,GROWTH,PRO}_{MONTHLY,ANNUAL}` | nee | Plan-price-ID's. Kan ook via admin-UI |
| `STRIPE_PRICE_CREDITS_{250,1000,5000}` | nee | Credit-bundles. Kan ook via admin-UI |
| `STRIPE_PRICE_SESSIONS_{1K,5K,20K}` | nee | Sessie-bundels: eenmalige prijzen in Stripe van € 29, € 119 en € 399 voor 1.000, 5.000 en 20.000 extra sessies. Het bedrag dat wordt afgeschreven is de prijs in Stripe, niet het bedrag in de code. De oude variabelen `_10K`, `_50K` en `_200K` worden niet meer gelezen en kunnen weg |
| `ENABLE_DIRECT_CHECKOUT` / `STARTER_DIRECT_CHECKOUT` | nee | Self-service checkout |
| `CHAMELEON_DEMO_MODE` / `ENABLE_BILLING_TEST_MODE` / `BILLING_DEBUG` | nee | Demo/test/logging |

### Proefperiode zonder betaalgegevens

Sinds 28-11-2026 vraagt een proefperiode niet om een kaart of een betaling. Dat geldt bij Stripe en bij Mollie.

| Variabele | Verplicht | Uitleg |
|---|---|---|
| `TRIAL_REQUIRES_PAYMENT` | nee | `on` zet de oude manier terug: eerst een kaart (Stripe) of € 0,01 (Mollie, met `MOLLIE_TRIAL_SIGNUP=on`). Leeg of iets anders: geen betaalgegevens. |

- **Aanmelden:** het formulier op `/checkout` slaat de aanmelding op en mailt een bevestigingslink. Het account wordt aangemaakt als de link wordt geopend (`/checkout/confirm`, `billing/trial-signup.ts`). Zo is het e-mailadres het bewijs dat de aanmelder bestaat.
- **De link** werkt 48 uur en maakt één account, ook als hij twee keer wordt geopend. Hij is ondertekend met een eigen sleutel, afgeleid van `ADMIN_SESSION_SECRET`. Er komt geen kolom of tabel bij.
- **Mail is nodig.** Zonder werkende mailinstelling (Integrations → Email) kan niemand zich aanmelden: het formulier zegt dan dat de bevestigingsmail niet verstuurd kon worden.
- **De proef:** 14 dagen, tot 250 gepersonaliseerde bezoeken (`TRIAL_SESSION_LIMIT` in `billing/trial-session-cap.ts`).
- **Einde van de proef zonder betaalmethode** (`billing/trial-end.ts`): de dagelijkse taak schrijft niets af en stuurt geen aanmaning. Het abonnement gaat op `paused`, de klant krijgt één mail, en de site toont weer de gewone pagina's (de betaalpoort behandelt `paused` als `unpaid`). Het account en alles erin blijven staan.
- **Doorgaan:** in het dashboard staat "Your trial has ended". Bij Mollie betaalt de klant daar de eerste maand, en die betaling is meteen de machtiging voor de volgende maanden. Bij Stripe kiest de klant een pakket op het tabblad Plan.
- **Wie tijdens de proef zelf een betaalmethode vastlegt** (bij Mollie een machtiging via een opwaardering) gaat na de proef vanzelf door: dan wordt het pakket afgeschreven, zoals voorheen.
- **Het overzicht Tenants** toont een klant alleen zijn eigen tenants. Tot deze wijziging stonden daar de namen van alle klanten.

### Mollie (naast Stripe)

Mollie neemt stap voor stap geldstromen over van Stripe. Live zijn de **losse aankopen** (sessie-bundels, AI-credits, tegoed opwaarderen), het **automatisch opwaarderen** via een machtiging, de **proefaanmelding** en het **maandelijks afschrijven van het abonnement**. Ook **pakket wisselen** en **de betaalmethode wijzigen** werken via Mollie. Op alles wat via Mollie loopt komt **btw**, en het platform schrijft er zelf de **facturen** voor.

| Variabele | Verplicht | Uitleg |
|---|---|---|
| `PAYMENT_PROVIDER` | nee | `mollie` stuurt de losse aankopen via Mollie. Leeg of iets anders is Stripe. |
| `MOLLIE_API_KEY` | bij `mollie` | `test_…` of `live_…`. De sleutel bepaalt test of live. **Secret** |
| `MOLLIE_TRIAL_SIGNUP` | nee | `on` laat ook de **proefaanmelding** via Mollie lopen. Kan aan zodra migratie 195 gedraaid is: zonder die tabel kan het abonnement na de proef niet worden afgeschreven. |

- **Geen prijs-ID's.** Bij Mollie noemt het platform zelf het bedrag (`priceCents` in `billing/plans.ts`). De `STRIPE_PRICE_*`-variabelen zijn dan niet nodig voor de bundels.
- **Webhook:** `/api/webhooks/mollie`. Het adres gaat per betaling mee, je stelt het niet in het Mollie-dashboard in. Het wordt afgeleid van `NEXT_PUBLIC_APP_URL`, anders van het adres waar de klant op zit. Op localhost gaat er geen webhook mee, daar bevestigt de terugkeerpagina de betaling.
- **Tabel:** `mollie_payments` (migratie 191) moet bestaan voordat `PAYMENT_PROVIDER=mollie` aangaat.
- **Migratie 192** hoort erbij en geldt ook voor Stripe: de functie `credit_wallet` weigerde elke bijschrijving van AI-credits omdat de statuskolom tekst is en de functie naar een enum castte.
- **Btw via Mollie** (`billing/vat.ts`, tabel `billing_details`, migratie 196). De prijzen in de code zijn exclusief btw. Bij elke afschrijving via Mollie telt het platform de btw erbij op:
  - Nederland: 21%.
  - Ander EU-land met een btw-nummer van dat land: 0%, btw verlegd.
  - Ander EU-land zonder btw-nummer: 21%.
  - Buiten de EU: 0%.
  - Het land en het btw-nummer komen uit het aanmeldformulier en zijn daarna te wijzigen op de billing-pagina ("Billing details"). Een klant zonder gegevens telt als Nederlandse klant.
  - Het btw-nummer wordt gecontroleerd op vorm en op land, niet tegen VIES.
  - Tegoed wordt bijgeschreven voor het bedrag zonder btw: wie € 50 opwaardeert betaalt € 60,50 en krijgt € 50 tegoed.
  - **Bij Stripe komt er geen btw bij.** Dat is niet veranderd.
- **Facturen via Mollie** (`billing/invoices.ts`, tabellen `invoices` en `invoice_counter`, migratie 197):
  - Het nummer is de datum en een teller: `20261127-0001`. De teller loopt door over de dagen heen, begint nooit opnieuw en slaat geen nummer over. De databasefunctie `issue_invoice` geeft het nummer uit in dezelfde transactie die de factuur schrijft.
  - Per betaling komt er één factuur, ook als de webhook en de terugkeerpagina de betaling allebei melden.
  - Een losse aankoop of opwaardering krijgt de factuur zodra hij betaald is. Het abonnement krijgt de factuur zodra Mollie de afschrijving aanneemt. Die staat open tot de incasso betaald is en gaat weer open bij een weigering of terugboeking.
  - Een afschrijving die Mollie direct weigert krijgt geen factuur. Die komt er zodra de klant het openstaande bedrag zelf betaalt.
  - De betaling van € 0,01 (proefaanmelding, betaalmethode wijzigen) krijgt geen factuur.
  - De factuur is een momentopname: een klant die later verhuist verandert een bestaande factuur niet.
  - De klant krijgt de factuur als pdf per mail op het factuuradres uit "Billing details" en kan hem downloaden op de billing-pagina (`/api/billing/invoices/<nummer>/pdf`). Zonder mailadres gaat er geen mail uit, de factuur bestaat dan wel.
  - De gegevens van de verkoper staan in `billing/seller.ts`. De factuur is in het Nederlands.
  - **Volgorde bij uitrollen:** migratie 196 en 197 moeten gedraaid zijn vóór deze code live gaat. Het aanmeldformulier schrijft het land en het btw-nummer weg, ook bij Stripe.
- **Proefaanmelding via Mollie** (alleen met `MOLLIE_TRIAL_SIGNUP=on`): de bezoeker betaalt € 0,01 om de betaalmethode te controleren. Die betaling legt de machtiging vast waarop het pakket na de proef wordt afgeschreven. Het account wordt aangemaakt zodra die betaling betaald is.
- **Abonnement via Mollie** (tabel `mollie_renewals`, migratie 195): de dagelijkse taak `/api/cron/billing-renewal` schrijft het pakket af van de machtiging. Zo loopt het:
  - Een proef die afloopt schuift eerst naar de 1e van de volgende maand (een paar gratis dagen, zoals bij Stripe). Op of na de 1e wordt het pakket afgeschreven en loopt de periode van de 1e tot de 1e.
  - Een incasso die Mollie aanneemt telt als geïnd: de periode schuift door en de klant blijft actief, ook al is de incasso nog enkele werkdagen "pending".
  - Weigert de bank de incasso later, of boekt de klant hem terug, dan gaat de klant op "betaling te laat" met dezelfde herinneringsmail en dezelfde quarantaine als bij Stripe.
  - Er is geen automatische nieuwe poging. De klant betaalt het openstaande bedrag zelf in het dashboard ("Pay now"). Daarmee is het abonnement weer actief en ligt er een verse machtiging.
  - Per periode wordt één keer afgeschreven, ook als de taak twee keer draait.
- **Pakket wisselen via Mollie** (`billing/mollie-plan-change.ts`), alleen bij maandelijks betalen:
  - Op proef: het pakket wisselt direct, er wordt niets afgeschreven.
  - Hoger pakket: wisselt direct. Het verschil voor de rest van de periode wordt van de machtiging afgeschreven. Lukt dat niet, dan wisselt het pakket niet en blijft er geen schuld staan.
  - Lager pakket: gaat in bij de volgende periode. Er wordt niets terugbetaald.
- **Betaalmethode wijzigen via Mollie:** in het dashboard betaalt de klant € 0,01 met de nieuwe rekening of kaart. De machtiging van die betaling vervangt de oude in het platform. De oude machtiging blijft bij Mollie bestaan maar wordt niet meer gebruikt.
- **Machtiging voor automatisch opwaarderen:** de klant betaalt in het dashboard de eerste opwaardering en geeft daarmee toestemming voor de volgende (tabel `mollie_customers`, migratie 193). Een eerste betaling met iDEAL levert een incassomachtiging op, en dat kan alleen als **SEPA-incasso** in het Mollie-profiel aanstaat.
- **Incasso is niet direct betaald.** Een automatische opwaardering via incasso staat enkele werkdagen op "pending". Het tegoed komt erbij zodra Mollie "paid" meldt, niet eerder, en in de tussentijd start er geen tweede. Een machtiging via creditcard wordt direct afgeschreven.
- **Migratie 194** repareert zes wallet-functies die niet konden draaien, ook voor Stripe: een geslaagde automatische opwaardering werd niet bijgeschreven en een mislukte kon niet als mislukt worden vastgelegd.
- **Terugboekingen** worden nog niet verwerkt: een teruggeboekte betaling haalt het tegoed niet vanzelf weer weg.

### Email
Resolutie: per-tenant → `SMTP_HOST` → `RESEND_API_KEY` → skip.

| Variabele | Waarvoor |
|---|---|
| `RESEND_API_KEY` | Resend. Kan ook via admin-UI. **Secret** |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_SECURE` / `_FROM` | SMTP (voorrang op Resend). Kan ook via admin-UI. **Secret** |
| `MAIL_FROM_ADDRESS` | Standaard afzender. Kan ook via admin-UI |
| `BACKOFFICE_EMAIL` | Fallback-ontvanger notificaties. Kan ook via admin-UI |
| `EMAIL_ENCRYPTION_KEY` | 32-byte hex; versleutelt per-tenant transports. **Env-only, nooit wijzigen.** **Secret** |

### AI
| Variabele | Waarvoor |
|---|---|
| `ANTHROPIC_API_KEY` / `CLAUDE_MODEL` / `CLAUDE_DECISION_TIMEOUT` | Claude. Key kan ook via admin-UI. **Secret** |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI. Kan ook via admin-UI. **Secret** |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini. **Secret** |
| `MC_AI_CONFIDENCE_THRESHOLD` | Min. vertrouwen (0–1). Default 0.7 |
| `SHADOW_AI_ENABLED` / `_PROVIDER` | Shadow-mode → `ai_decision_logs` |
| `MC_AI_SELECTION_MODE` / `_THRESHOLD`, `MC_AI_FIELD_FILL_MODE` / `_THRESHOLD` | Env-laag AI-policy. Kan ook via admin-UI |

### CMS — Sanity / Storyblok (indien gebruikt)
Sanity: `SANITY_PROJECT_ID` (zet Sanity aan), `SANITY_DATASET`, `SANITY_API_VERSION` (beide verplicht zodra project-ID gezet), `SANITY_READ_TOKEN`, `SANITY_API_TOKEN` (nodig voor "Seed platform variants"), `SANITY_API_WRITE_TOKEN` / `SANITY_WRITE_TOKEN`, `SANITY_PREVIEW_TOKEN`, `SANITY_STUDIO_URL`, `SANITY_PREVIEW_SECRET`, `SANITY_WEBHOOK_SECRET`, `SANITY_USE_CDN`, `SANITY_*_REVALIDATE_SECONDS`.

Storyblok: `STORYBLOK_ACCESS_TOKEN` (zet Storyblok aan), `STORYBLOK_REGION` (default `eu`), `STORYBLOK_VERSION`, `STORYBLOK_MANAGEMENT_TOKEN`, `STORYBLOK_SPACE_ID`, `STORYBLOK_WEBHOOK_SECRET`, `STORYBLOK_TENANT_ID`. Alle via admin-UI mogelijk.

### Enrichment
| Variabele | Waarvoor |
|---|---|
| `CLEARBIT_SECRET_KEY` | Reverse-IP → bedrijf. Afwezig → stub-provider. Kan ook via admin-UI. **Secret** |
| `IPINFO_TOKEN` | ASN/network-org. Kan ook via admin-UI. **Secret** |
| `LEADINFO_API_KEY` | IP-to-company. Kan ook via admin-UI. **Secret** |
| `LOCATIONIQ_API_KEY` | Reverse-geocoding. **Secret** |
| `MAXMIND_DB_PATH` | Pad naar lokale GeoLite-DB |
| `UNSPLASH_ACCESS_KEY` | Beeld voor demo-generator. **Secret** |
| `DEV_COMPANY_FALLBACK_IP` / `DEV_GEO_FALLBACK_IP` | Dev: publiek IP i.p.v. 127.0.0.1 |

### CRM (HubSpot)
| Variabele | Waarvoor |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | Private-app-token. Kan ook via admin-UI (env = onderste laag). **Secret** |
| `HUBSPOT_COMPANY_CUSTOMER_SINCE_PROP` | Default `createdate` |
| `HUBSPOT_COMPANY_LAST_ACTIVITY_PROP` | Default `hs_lastmodifieddate` |
| `HUBSPOT_COMPANY_PLAN_TIER_PROP` / `_DEAL_STAGE_PROP` / `_CONTRACT_VALUE_PROP` | Eigen property-handles |

### Storage (Cloudflare R2)
DB-config heeft voorrang; env is fallback. `R2_ACCOUNT_ID` zetten maakt de rest verplicht.

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` (**secret**), `R2_SECRET_ACCESS_KEY` (**secret**), `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (zonder trailing slash). Alle ook via admin-UI.

### Provisioning + Vercel Domains
| Variabele | Waarvoor |
|---|---|
| `GITHUB_TOKEN` | Repo-generatie uit template. Kan ook via admin-UI. **Secret** |
| `PLOI_CLOUD_TOKEN` (+ `PLOI_CLOUD_API_BASE`) | Ploi Cloud API. Kan ook via admin-UI. **Secret** |
| `FORGE_API_TOKEN` | Laravel Forge. Kan ook via admin-UI. **Secret** |
| `VERCEL_API_TOKEN` (of `VERCEL_TOKEN`) | Domains-API; zonder dit geen DNS-verificatie. **Secret** |
| `VERCEL_PROJECT_ID` | Vereist samen met de token |
| `VERCEL_TEAM_ID` | Bij team-scoped tokens |

### Google Calendar (demo-boekingen)
Resolutie: tenant → platform_settings → env.

`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (**secret**), `GOOGLE_CALENDAR_ID`, `DEMO_BOOKING_TIMEZONE` (default `Europe/Amsterdam`), `DEMO_BOOKING_HOURS_START` / `_END` (9/17). Alle ook via admin-UI.

### Diensten zónder env-vars
- **Google Ads** (retargeting + conversies) — bewust per tenant in de admin (Doelgroepen → Retargeting).
- **Meilisearch** — per tenant onder Platform → Search (host, versleutelde key, index-prefix).
- **Hetzner** — geen koppeling in de code; komt alleen voor als ASN in bot-/datacenter-detectie.
- **Cloudflare** — alleen R2 (storage).
- **Google Analytics** — geen enkele var wordt door de app gelezen.
- **Google Cloud** — alleen het Calendar-service-account.

---

## 4. Aandachtspunten

**Nog open:**

- **De dagelijkse cron deed op productie niets** (vastgesteld 14-11-2026): 1.164 bezoekersprofielen stonden over hun bewaartermijn, de oudste sinds 26 september, en de ad-sync liep voor het laatst op 25 augustus. De oorzaak is nog niet vastgesteld, die staat in het Vercel-log van de cron. Admin → Platform → System toont sindsdien per nacht of de cron gelopen heeft en wat elke job deed. Staat daar "No run on record" of "too long ago": controleer in Vercel (Schedules → Cron Jobs) of de cron bestaat en aan staat, en lees View Logs. Een 401 betekent dat `CRON_SECRET` niet voor Production gezet is (Vercel maakt hem niet zelf aan, en een nieuwe waarde werkt pas na een redeploy). Geen logregel betekent dat de cron de app niet bereikt, bijvoorbeeld door een firewallregel die `/api/cron/` challenget.
- `/api/cron/billing-renewal` bestaat als route maar staat **niet in `vercel.json`** → draait niet automatisch. Bewust niet stilzwijgend aangezet: billing-renewal activeren heeft echte gevolgen. `/api/cron/keep-warm` staat er ook niet in: dat wordt van buiten aangeroepen (zie §3, Cron / jobs).
- `NEXTAUTH_URL` wordt alleen als fallback-base-URL gelezen; er is geen NextAuth-implementatie (admin-auth is een eigen JWT).
- `.nvmrc` zegt Node 22, CI draait Node 20.

**Opgelost (was drift, nu gefixt):**

- De **env-checklist op Admin → Deployment** miste hele groepen → aangevuld met Statamic, Stripe, Cron, Lead-base/webhooks, Enrichment, HubSpot en Google Calendar.
- Het **setup-script** noemde vars die de code niet leest → vervangen door de echte namen (`MAXMIND_DB_PATH`, `MAIL_FROM_ADDRESS`, `R2_PUBLIC_URL`, `VERCEL_API_TOKEN`), plus de ontbrekende groepen toegevoegd. `NEXTAUTH_SECRET` en `GA4_*` zijn weg.
- **De "Download setup.sh"-route was kapot**: het bash-script zit in een TS-template-literal en de shell-variabelen (`${CYAN}`, `${BOLD}`, …) werden door TypeScript geïnterpoleerd → `ReferenceError` → 500. Nu geëscaped en geverifieerd met `bash -n`.
- `.env.production.example` / `.env.staging.example` gebruikten `STRIPE_PUBLISHABLE_KEY` → nu `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `SANITY_API_TOKEN` stond beschreven als "in `apps/studio/.env.local`" → omschrijving gecorrigeerd: hij wordt uit de server-env gelezen, dus op het Vercel-project zetten.
- `STATAMIC_CMS_PATH` ontbrak in `.env.example` → toegevoegd, met uitleg over de file-fallback.
- Staging ontbrak op de System-pagina → staging-rij + "Deploy to staging"-knop toegevoegd.

---

## 5. Checklist

- [ ] Supabase-project + migraties
- [ ] Vercel-project met Supabase-vars, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`
- [ ] Admin-login met 2FA
- [ ] Tenant aangemaakt, CMS = Statamic
- [ ] Statamic uitgerold (Ploi), git-persistence + Pro aan
- [ ] Schrijfroute beveiligd (401-test), `STATAMIC_API_KEY` = `MISTER_CHAMELEON_CMS_WRITE_TOKEN`
- [ ] Domein gekoppeld + DNS
- [ ] Snippet geplaatst
- [ ] E-mail + `EMAIL_ENCRYPTION_KEY`
- [ ] Stripe: keys, webhook, price-ID's
- [ ] Enrichment + pipeline per tenant
- [ ] HubSpot-token + per tenant aan
- [ ] AI: fallback-key + per tenant mode
- [ ] Storage-provider
- [ ] Search (indien nodig)
- [ ] Google-retargeting + dagelijkse sync
- [ ] Conversie-actie + "Verbeterde conversies voor leads" + `ctId`
- [ ] Inbound-form-brug + `config:clear`
- [ ] `LEAD_SUPPRESSION_SECRET` + ESP-webhook
- [ ] Firewall-bypass `/api/webhooks/*`
- [ ] Firewall-bypass `/api/plugin/wp/` (updates van de WordPress-plugin)
- [ ] `CRON_SECRET`
- [ ] End-to-end: lead + conversie-event `ok`
