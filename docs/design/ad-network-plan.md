# Ad-tenant / contextual ad-network — plan

Van "kan technisch" naar "verkoopbaar product". Bouwt volledig voort op wat er
al staat: universele snippet, decide-engine, journey-events, whole-block-render,
regels-engine, origin-allowlist, wallets/billing.

## Kernidee

Een **advertentie-tenant** is een gewone tenant waarvan de varianten *advertenties*
zijn. Publishers plaatsen de snippet + de ad-siteKey en zetten een leeg
`data-mc-block` waar de advertentie moet komen. Het decide-endpoint kiest per
bezoeker (contextueel) een ad, rendert die als zelf-stylend blok, telt een
impressie, en meet klikken via een redirect. Afrekening loopt via de wallet.

**Differentiator:** context is first-party én per publisher-site (`mc_vid` in de
localStorage van de publisher), dus **geen third-party cookies, geen cross-site
tracking** — wel per-bezoeker-adaptieve, contextuele ads. Post-cookie/AVG-proof.
Dat is het verkoopverhaal.

## Datamodel (minimaal, hergebruikt bestaande tabellen)

1. **Tenant-rol** — `tenant_settings.settings.tenantRole = "advertiser"` (naast de
   bestaande `siteType`). Onderscheidt ad-tenants van site-tenants voor billing,
   UI en defaults. Geen nieuwe tabel nodig.

2. **`ad_publishers`** (nieuw) — de misbruik-/billing-poort. Vervangt/verrijkt de
   origin-allowlist: een publisher moet goedgekeurd zijn om de key te serveren.
   ```
   id, ad_tenant_id, publisher_domain, status (pending|approved|blocked),
   revshare_pct, created_at, approved_at
   ```
   Decide weigert (of serveert niets) als het Origin-domein hier niet approved is.

3. **`ads`** (nieuw, licht) — één ad = één creative + targeting + budget.
   ```
   id, ad_tenant_id, name, slot_type (hero|cta|notification|…),
   variant_key (→ creative in de CMS/whole-block), targeting (jsonb: dezelfde
   condities als rules_config), pricing_model (cpm|cpc), rate_cents,
   budget_cents, spent_cents, status (active|paused|ended),
   start_at, end_at, created_at
   ```
   MVP-alternatief: ads-als-varianten + targeting puur in `rules_config` (geen
   `ads`-tabel). Nadeel: geen budget/flight/rapportage per ad. Aanrader: wél de
   lichte `ads`-tabel, want budget + telling hangen eraan.

4. **`ad_events`** (nieuw, append-only) — de ruwe teller, los van
   `visitor_journey_events` (ad-volume is te hoog om de journey-tabel mee te
   vervuilen).
   ```
   id, ad_tenant_id, ad_id, publisher_domain, event_type (impression|click),
   session_id (mc_vid), occurred_at, metadata (jsonb: slot, referrer, geo)
   ```

5. **`ad_stats_daily`** (nieuw, rollup) — voor billing + dashboards.
   ```
   ad_id, publisher_domain, date, impressions, clicks, spend_cents
   ```
   Batch/trigger vanuit `ad_events`.

6. **Publisher-ledger** — hergebruik `tenant_wallets` voor de adverteerder
   (budget). Voor publisher-uitbetaling een simpele `publisher_earnings`
   (publisher_domain of publisher-tenant, accrued_cents, paid_cents).

## Impressies & klikken tellen (bovenop de journey-events)

- **Impressie** = elke decide-call die voor een ad-blok een ad teruggeeft. In het
  decide-pad (na ad-keuze, vóór render) één insert in `ad_events`
  (`impression`). Gebruik dezelfde dedup-truc als bij `/api/v1/slot`
  (deterministische key per bezoeker+ad+pageview) zodat herhaalde calls binnen
  één paginaweergave niet dubbeltellen.
- **Klik** = een redirect-tracker. De ad-CTA krijgt als `href`
  `…/api/ad/click?ad=<id>&pub=<domain>&sid=<mc_vid>&to=<enc-advertiser-url>`.
  Dat endpoint logt een `click`-event en 302't naar de bestemming. Werkt óók
  zonder JS en is de standaard-robuuste aanpak. Valideer `to` tegen een
  allowlist per ad (open-redirect voorkomen).
- **Frequency capping** = tel recente `ad_events` (impression) voor
  `session_id + ad_id` en cap per bezoeker per dag. Query is goedkoop met een
  index op `(session_id, ad_id, occurred_at)`.

## Decide-pad (runtime-wijzigingen)

Wanneer decide een ad-tenant resolvet:
1. **Publisher-gate:** is het Origin-domein `approved` in `ad_publishers`? Zo nee
   → geen ad (leeg blok / default).
2. **Ad-keuze:** filter ads op `status=active`, flight-datum, budget over, en
   targeting (regels-engine met de bezoeker-context). Kies er één (rotatie /
   gewicht / hoogste bod).
3. **Budget/pacing-gate:** `spent_cents < budget_cents`; anders overslaan.
4. **Frequency-gate:** cap per bezoeker.
5. **Render** het ad-blok (whole-block) met de klik-tracking-CTA.
6. **Tel + reken af (async):** `ad_events` impression + debet wallet (CPM) /
   markeer voor CPC-afrekening bij klik; credit publisher-ledger minus platform-fee.

## Billing-knoppen

- **Wie betaalt:** de adverteerder (ad-tenant) financiert een **budget**
  (`tenant_wallets`), dat per impressie (CPM) of klik (CPC) wordt gedebiteerd.
  Publishers verdienen een **revshare** (credit op `publisher_earnings`).
- **Prijsmodel:** `pricing_model` + `rate_cents` per ad (CPM en/of CPC).
- **Platform-fee:** `platform_fee_pct` op de revshare.
- **Billing-modus per tenant:** nieuwe flag `billingMode = "subscription" |
  "usage_ads"`. Ad-tenants staan op `usage_ads` → de bestaande
  sessie-/dunning-gate in decide **overslaan** voor ad-tenants, en in plaats
  daarvan een **wallet-saldo-gate** (saldo op → serveer default/niets). Dit
  voorkomt dat het huidige "elke decide = billable sessie" ad-tenants dubbel
  belast.
- **Budget-caps & flight:** ad stopt bij `spent >= budget` of na `end_at`.

## Kleinste route (MVP → verkoopbaar)

Fase 1 — bewijs + eerste omzet (klein):
- `tenantRole = "advertiser"` + `billingMode = "usage_ads"` + wallet-gate in decide.
- `ad_publishers` (approve-lijst) + publisher-gate in decide.
- `ads`-tabel (creative = whole-block-variant) + targeting via bestaande regels.
- Impressie-insert in `ad_events` (met dedup) + `/api/ad/click`-redirect.
- CPM-debet op de wallet; simpele `ad_stats_daily`-rollup voor een basisrapport.

Fase 2 — product-afwerking:
- Publisher-onboarding-UI + revshare-uitbetaling.
- CPC + eenvoudige veiling/gewichten; pacing.
- Adverteerder-campagne-UI (budget, targeting, flights, creatives).
- Brand safety (per-publisher/ per-categorie block-lijsten) + basale fraud-checks
  (rate-limits per IP/sessie, bot-filter — die laatste heb je al).

## Risico's / beslissingen vooraf

- **Open key = kostenrisico.** Zonder de publisher-approve-gate kan iedereen je
  key inbouwen en impressies (= budget) opstoken. De gate is dus niet optioneel.
- **Fraud/viewability.** MVP kan dit uitstellen; voor schaal nodig.
- **Billing-modus.** Zonder de `usage_ads`-switch mis-belast het huidige
  sessie-model ad-tenants. Eerst regelen.
- **Targeting blijft contextueel** (per-site), niet cross-site — bewust, en je
  belangrijkste juridische/commerciële troef. Positioneer het zo.
