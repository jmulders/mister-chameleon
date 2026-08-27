# Fire-on-enrichment (verrijkte rule-webhook bij company-identificatie)

## Probleem
De rule-webhook vuurt op page-render. Bij client-side Leadinfo is de company pas
~15s later bekend (mc_li-cookie), dus snelle bezoekers kregen een **lege** webhook.
Achtergrond: `ip_company_cache` is leeg over alle tenants → het server-side
enrichment-pad levert in de praktijk niks; het client-side mc_li-pad is het enige
dat werkt. Deze feature hangt dus aan het client-pad.

## Doel
Elke geïdentificeerde bezoeker krijgt **precies één VERRIJKTE webhook** per sessie,
ongeacht hoe snel-ie browst.

## Wat is een "company webhook"?
Een rule-webhook met **`fireOncePerSession: true`** én minstens één **firmographic**
payload-veld geselecteerd (company/geo/Leadinfo — group `firmographic` in
`lib/webhooks/payload-fields.ts`). Alleen die webhooks doen mee aan de coördinatie
hieronder. Alle andere webhooks: gedrag volledig ongewijzigd.

## Mechaniek

### 1. Enrichment-fire vanuit het endpoint
`POST /api/enrichment/leadinfo` zet bij een **MATCHED** company de mc_li-cookie en
plant daarna (via `after()`, ná de response) `fireEnrichmentWebhook(...)`
(`lib/webhooks/fire-enrichment-webhook.ts`). Die:
1. leest consent uit de request-cookies (`mc_consent`) + tenant-privacy-ceiling en
   **stopt zonder enrichment-consent** (gedrag ongewijzigd);
2. injecteert de company via een **synthetische mc_li** (uit de request-body, niet
   uit de response-cookie) in de `cookieHeader`;
3. bouwt de context met `buildDecisionContext` (request-URL = de `Referer` → utm/
   source/path; sessie = `mc_session_id`; history via `fetchVisitorHistory`);
4. draait `RulesDecisionProvider(..., enrichmentPass = true).getHomepagePlan()`.

### 2. Provider-coördinatie (`enrichmentPass`)
In `RulesDecisionProvider.fireMatchWebhook`, alleen voor een company-webhook:

| Situatie | Gedrag |
|---|---|
| **Page-render**, company nog afwezig, enrichment-consent aanwezig | **DEFER**: niet vuren, marker NIET zetten (de enrichment-pass doet het verrijkt) |
| **Page-render**, geen enrichment-consent | Géén defer → vuurt zoals vanouds (company-velden toch consent-gestript) |
| **Page-render**, company al aanwezig | Vuurt mét company + zet de fire-once-marker |
| **Enrichment-pass** | Vuurt **alléén** company-webhooks; de rest vuurde al op page-render |

Fire-once dedup = de bestaande marker `__wh:<ruleId>` in `rule_context` (JSONB,
monotone/write-once — geen migratie).

In enrichment-pass persisteert de provider **alleen de fire-once-marker** (nooit de
sticky context-writes) en registreert **geen** rule-fire-stats. Zo blijft de
decision/variant-state byte-for-byte identiek aan wat page-renders schrijven —
deze feature raakt uitsluitend webhook-delivery.

## Netto per sessie
- **Snelle bezoeker**: page-render defert → enrichment-pass vuurt mét company +
  zet marker. = **1 verrijkte webhook**.
- **Trage bezoeker**: company al in context → page-render vuurt mét company + zet
  marker → enrichment-pass ziet marker → skip. = **1 verrijkte webhook**.
- **Geen enrichment-consent**: page-render vuurt zoals vanouds (geen company),
  enrichment-fire draait niet. = **ongewijzigd**.

## Bekende beperking — sessie-alignment
De dedup lijnt op wanneer de page-decision en de enrichment-POST **dezelfde
sessie-id** gebruiken.
- **Platform-gehoste pagina's**: beide gebruiken `mc_session_id` → lijnt op. ✅
- **Snippet-route** (`/api/snippet/decide`): de page-decision keyt op een
  client-gemunte id uit de decide-body, die het leadinfo-endpoint niet ziet (het
  leest alleen `mc_session_id`). Daar kan de marker mislijnen; op die route is dit
  best-effort. Deze feature richt zich op het platform mc_li-pad.

## Tests
`tests/webhooks/fire-on-enrichment.test.ts` — snelle bezoeker (1 verrijkte), trage
bezoeker (geen dubbele), geen-consent (ongewijzigd), en non-company-webhook
(onaangeraakt). `tests/webhooks/webhook-fire-once.test.ts` blijft groen (geen
regressie op het bestaande fire-once-gedrag).
