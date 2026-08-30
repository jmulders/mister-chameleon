# Ontwerp — Back-office-koppeling + form-prefill voor known leads

Status: **Fase 1 (sync-API) GEBOUWD** · fase 2 (form-prefill) backlog. Opgesteld
29 aug 2026; fase 1 opgeleverd 30 aug 2026.

- Fase 1 contract: **`docs/abm-backoffice-sync-api.md`**. Endpoint
  `POST /api/abm/leads`, migratie 182.

## Wat er al is (niet opnieuw bouwen)

Het ABM "known-lead"-systeem levert de kern al:
- **`/go/{token}`** — opaak handle dat je een lead stuurt; zet de lead-id in de
  **`mc_lead`-cookie** (30d), redirect naar de doelpagina. Bron: `abm_leads` (Supabase).
- **`apply-known-lead.ts`** — vouwt per request de firmografie (companyName / companyIndustry
  / companySize / targetAccountMatched) + `segment_hint` in de context → segmenten
  auto-matchen, regels adapteren, named greeting + AI-`knownLead`-blok. Exacte identiteit,
  overschrijft lagere-confidence enrichment.
- **`visitor_profiles.abm_lead_id`** — koppelt de auto-opgebouwde lead-base aan een abm-lead
  (gezet bij een form-submit via `linkVisitorProfileToAbmLead`).

Doc: `docs/abm-personalized-urls.md`.

## Wat mist voor het back-office-scenario

### 1. Back-office-sync-API (in/uit) — ✅ GEBOUWD (fase 1)
Opgeleverd. Contract + voorbeelden: **`docs/abm-backoffice-sync-api.md`**.
Migratie 182 (`external_id`, `contact_name`, `contact_email`, partieel uniek
`abm_leads_tenant_external_idx`, `abm_settings.sync_api_key`).

De back-office moet leads kunnen **aanmaken/bijwerken** en het **handle terugkrijgen** om in
mail-links te zetten.
- `POST /api/abm/leads` (per-tenant API-key): upsert een abm-lead met firmografie +
  contactvelden (naam, e-mail) + `segment_hint` + doelpagina + een **`external_id`** (de
  back-office/CRM-record-id, voor idempotente sync). Response = het **handle** (`/go/{handle}`).
- Optioneel omgekeerd: geef de lead-base `visitor_key` mee zodat een bestaand
  `visitor_profiles`-record aan de abm-lead wordt gekoppeld (bekende historie sluit aan).
- Zo houdt de back-office de mapping `external_id ↔ handle` en bouwt hij zelf de
  `/go/{handle}`-links in z'n e-mails.

### 2. Form-prefill
De known-lead-data voedt nu de *beslissing*, maar vult nog geen **formulier**.
- **Prefill-bron:** bij een aanwezige `mc_lead`-cookie (of een gekoppeld `visitor_profile`)
  de bekende velden beschikbaar maken: naam, e-mail, bedrijf, industrie, (evt. functie uit
  het `knownLead`-blok).
- **Mechanisme:** server-side in de pagina meegeven of via een kleine
  `GET /api/forms/prefill`-endpoint; de form-component vult de velden voor.
- **Consent-gated:** prefill van PII alleen onder de geldende consent.

## Datamodel
- `abm_leads` bestaat al; toevoegen indien nodig: `external_id` (back-office-mapping) +
  contactvelden (`contact_name`, `contact_email`) als die er nog niet zijn. Migratie =
  prod-SQL.
- Geen nieuwe sessie-opslag; het handle blijft de sleutel, per request geresolved.

## Privacy / security
- Handles blijven **opaak** + fail-open (geen enumeratie, geen 404 die het mechanisme
  verraadt).
- **Form-prefill van PII** heeft een link-forwarding-risico (wie de doorgestuurde mail heeft,
  ziet de ingevulde data). Mitigatie: **korte geldigheid** op prefill-links, géén
  zeer-gevoelige velden prefillen, consent-gated, en overweeg **eenmalige** tokens voor de
  prefill-variant (los van het 30d-personalisatie-handle).
- Back-office-sync-API: per-tenant API-key; nooit de lead-data teruggeven zonder auth.

## Fasering
1. ✅ **Back-office-sync-API** (`external_id`-upsert → handle) — de koppeling zelf.
   **GEBOUWD** (migratie 182, `POST /api/abm/leads`, per-tenant API-key). Zie
   `docs/abm-backoffice-sync-api.md`.
2. ⏳ **Form-prefill** (consent-gated, korte geldigheid) — "prefillen met wat we al weten".
   Backlog.
