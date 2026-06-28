# Lead Base — unified visitor/lead profiles (design)

## 1. The idea

Today the platform treats "ABM leads" as a separate silo (`abm_leads`, only the
named PURL recipients), while everything else about a visitor is scattered:

- `sessions` — thin entry context (source, device, visit_type, UTM)
- journey events — behaviour, separate store
- enrichment (company/geo) — computed **per request**, never persisted
- interest scores / segments / intent — computed per request
- `abm_leads` — only the deterministically-known people

So you can't ask "show me all leads with status X / company Y / segment Z" from
multiple angles. The mental shift: **every visitor is a lead at some identity
level.** One profile per visitor, accreting data as we learn more.

### Identity ladder (status)

| Level | Name | What we know | Data nature |
|-------|------|--------------|-------------|
| L0 | Anonymous | context vars only: device, source, geo (country/region), intent score, segments | pseudonymous |
| L1 | Recognised account | company via IP (IPinfo/OpenKvK) | firmographic (company, not person) |
| L2 | Known lead | named person via ABM PURL or form-fill | personal |
| L3 | Customer / CRM | lifecycle stage from CRM | personal |

This formalises the "how much do we know" axis that already exists implicitly
(CrmLifecycleStage, funnelStage, audience segments) into one store.

## 2. Build in-platform, or keep it in another system?

Honest answer: **hybrid — and do NOT rebuild a CRM in the platform.**

- **Real-time decisioning must stay in-platform.** Personalization reads the
  profile at request time; an external round-trip per page view is too slow. The
  signals are already computed here.
- **The system-of-record for named leads belongs in your CRM.** Sales follow-up,
  dedup, multi-channel, durable PII ownership — that is what CRMs/CDPs do. Pushing
  L2/L3 leads to the CRM (via the outbound webhook we already built) is the
  natural "from multiple angles" access, and keeps the heavy PII liability where a
  lawful basis already exists.

So the split:

- **In-platform `visitor_profiles`** = a lean, **pseudonymous-first** real-time
  decisioning cache + a lightweight in-app overview. Short retention. NOT the
  long-term PII system-of-record.
- **CRM (external)** = durable home for named/qualified leads, fed by the webhook.

This split is also the cleanest GDPR posture (see §4).

## 3. Data model

`visitor_profiles` (per tenant, keyed on a stable pseudonymous visitor id):

```
id                uuid pk
tenant_id         text
visitor_key       text     -- hashed/opaque id from the visitor cookie (NOT raw)
identity_level    text     -- 'anonymous' | 'recognised' | 'known' | 'customer'
status            text     -- lifecycle: visitor | engaged | mql | sql | customer | churned
-- behavioural summary (pseudonymous)
first_seen_at     timestamptz
last_seen_at      timestamptz
visit_count       int
intent_score      int
funnel_stage      text
segment_ids       text[]   -- matched audience segments
interests         jsonb    -- top interest keys + scores
-- firmographic snapshot (L1+; company = not personal data)
company_name      text
company_domain    text
company_size      text
company_industry  text
geo_country       text     -- coarse only (country/region), never precise/raw IP
geo_region        text
-- identity link (L2+; personal — consent/lawful-basis gated, see §4)
abm_lead_id       uuid     -- fk → abm_leads when matched
consent_state     text     -- 'none' | 'granted' | 'denied'
pii               jsonb    -- name/email/etc. — ONLY populated when allowed (§4)
-- lifecycle
expires_at        timestamptz  -- retention TTL
created_at, updated_at
```

`abm_leads` is **not** removed — it stays as the source of named-lead identity
(from your own outreach lists) and links into a profile via `abm_lead_id`.

**One shared identity (GA4 in sync).** `visitor_key` IS the `mc_session_id`
cookie value — the same first-party UUID the GA4 History enricher already uses as
its visitor dimension. So GA4 session history and the lead profile join on one
key; there is no separate "lead id" to keep in sync. (Cookie lifetime is ~30 days;
profile retention is 90 — the cookie is the continuity anchor, full cross-session
stitching is Phase 3.)

Upsert happens cheaply per request from the already-built `DecisionContext`
(reuse `recordPersonalizedSession`/session write path), so no extra latency.

**Reuse existing engines — don't recompute.** `intent_score`, `funnel_stage` and
the journey already come from the **behaviour scoring engine** (admin → Audience →
Scoring, `/behavior`; `deriveBehaviorState`). Segments come from
`evaluateAudienceSegments`, interests from the interest-scoring layer, company from
the enrichment chain. The lead base only **persists the output** of these into the
profile — it is a store + overview, not a second scoring system.

## 4. GDPR / AVG built in

Principle (per requirement): **no consent → only non-identifiable data is stored;
whatever is permitted, we keep.**

**Reuse the existing consent model — don't invent one.** The platform already has
`mc_consent` (cookie, not httpOnly, server+client readable) with categories
`analytics` / `personalization` / `enrichment`, a privacy-first default (all
false), and a server reader (`resolveConsent(cookieHeader, tenantPrivacy)` →
`ConsentState`). The gate maps each profile field-group to a category:
behavioural summary → `personalization`; firmographic snapshot → `enrichment`;
PII → explicit consent / own-list basis. If a category is denied, that field-group
is simply not written.

- **No consent (default):** store only pseudonymous + firmographic data — behaviour
  summary, segments, intent, coarse geo (country/region), and **company** name/
  domain/size/industry. Company-by-IP is firmographic, not personal data, and is
  retained on a legitimate-interest basis. The `pii` column stays `null`.
- **Raw IP is never stored** — only derived fields. `visitor_key` is a hash, not
  the cookie value.
- **Personal data (name/email/person LinkedIn, precise location) only when allowed:**
  - ABM named leads (L2) come from *your* outreach list — you already hold that
    data under your own lawful basis, so those `abm_leads` rows are fine; the
    profile links to them but doesn't duplicate PII into pseudonymous rows.
  - Form-fill / explicit consent → `consent_state = granted`, then `pii` may be
    populated.
- **Retention:** pseudonymous profiles get a TTL (`expires_at`, default 90 days,
  configurable per tenant); a scheduled job purges expired rows.
- **Data-subject rights:**
  - *Erasure* → delete (single + bulk) in the admin (§5).
  - *Access / portability* → export (§5).
- **A "GDPR check" gate** in the write path: a single `gateProfileWrite(ctx)`
  function decides, per field, whether it may be persisted given `consent_state`
  and the field's classification (pseudonymous / firmographic / personal). Nothing
  reaches the table without passing it.

## 5. Admin — Lead Base view

Extends the existing ABM admin into a unified "Leads" surface:

- **List** all profiles with identity level + status + company + last seen + score.
- **Filter:** by identity level, status, segment, company, intent-score range,
  date range, consent state.
- **Delete:** single row + multi-select bulk delete (right to erasure).
- **Export:** filtered set → CSV/JSON (right to access/portability). PII columns
  only included when `consent_state = granted` (or for your own ABM leads).
- Per-profile drawer: the visit timeline (we already built `abm_lead_visits`) +
  the resolved context snapshot.

Named/qualified leads also flow outbound to the CRM via the existing webhook.

## 6. Phasing

1. **Phase 1 — store + GDPR gate:** `visitor_profiles` table + migration; the
   `gateProfileWrite` classifier; per-request upsert from `DecisionContext`;
   retention TTL + a purge scheduled task; link `abm_leads`.
2. **Phase 2 — Lead Base admin:** list + filter + single/bulk delete + export,
   reusing the ABM admin shell and the visit timeline.
3. **Phase 3 — identity merge + CRM sync:** merge anonymous history when a visitor
   becomes named; extend the webhook to push qualified profiles to the CRM; consent
   capture wiring.

## 7. Open decisions

- Retention default (90 days?) and whether it's per-tenant configurable.
- Consent source: do you have a cookie/consent banner whose state we can read, or
  is everything legitimate-interest + pseudonymous for now?
- CRM target for the outbound push (HubSpot via the webhook, or generic only?).
