# Back-office-sync-API — `POST /api/abm/leads`

Fase 1 van de back-office-koppeling (`docs/design/backoffice-lead-coupling.md`).
Een back-office / CRM upsert per tenant leads op zijn **eigen** record-id
(`external_id`) en krijgt het **opaak-handle** (`/go/{handle}`) terug om zelf in
mail-links te zetten. De mapping `external_id ↔ handle` houdt de back-office; het
handle blijft **stabiel over syncs heen**.

> Alleen de sync-API. Form-prefill (bekende velden een formulier in voeden) is
> fase 2 en zit hier niet in.

## Auth (fail-closed)

Per-tenant API-key als Bearer-token:

```
Authorization: Bearer <sync-key>
```

- De key genereer/roteer je in de admin: **Leads → CRM & integrations →
  Back-office sync API**. Hij wordt **versleuteld** opgeslagen
  (`abm_settings.sync_api_key`, AES-256-GCM via `EMAIL_ENCRYPTION_KEY`) en is
  **maar één keer** zichtbaar, bij genereren.
- Verificatie is **constant-time** (SHA-256-digest + `timingSafeEqual`).
- Ontbrekende key, foute key, of **geen key ingesteld** voor de tenant → `401`.
  De 401 is identiek in alle gevallen en wordt **vóór** body-validatie gecheckt,
  zodat een niet-geauthenticeerde caller niets leert over de tenant of de body.

## Request

`Content-Type: application/json`

| Veld          | Type     | Verplicht | Opmerking |
|---------------|----------|-----------|-----------|
| `tenantId`    | string   | ✅        | Tenant-id (ook de auth-scope). |
| `externalId`  | string   | ✅        | Back-office/CRM-record-id. **Idempotente sync-sleutel** per tenant. |
| `profile`     | object   | –         | `{ firstName, name, company, role, industry, companySize, linkedinUrl }`. Alleen deze keys worden gelezen; onbekende genegeerd. |
| `contactName` | string   | –         | Naam contact. |
| `contactEmail`| string   | –         | E-mail contact. |
| `segmentHint` | string   | –         | Audience-segment-key om te forceren. |
| `targetPath`  | string   | –         | Redirect-doel; **relatief pad** dat met `/` begint (geen `//`, geen protocol). |
| `expiresAt`   | string   | –         | ISO-8601; na dit moment is het handle niet meer "live". |
| `status`      | string   | –         | `active` \| `paused` \| `expired`. |
| `visitorKey`  | string   | –         | Koppelt een bestaand `visitor_profiles`-record aan de lead (fail-open). |

- Validatie is streng; **onbekende velden worden genegeerd** (niet geweigerd).
- Velden die je bij een re-sync **weglaat**, blijven op de bestaande rij staan
  (behalve `profile`, dat wordt telkens vervangen door wat je meestuurt).
- Ontbrekende/ongeldige verplichte velden (na auth) → `400`.

### Voorbeeld

```bash
curl -X POST https://<tenant-domein>/api/abm/leads \
  -H "Authorization: Bearer mcsk_…" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "acme",
    "externalId": "crm-8842",
    "profile": { "firstName": "Jan", "name": "Jan Jansen", "company": "Acme BV",
                 "role": "Head of Ops", "industry": "Logistics", "companySize": "51-200" },
    "contactName": "Jan Jansen",
    "contactEmail": "jan@acme.example",
    "segmentHint": "ops-leaders",
    "targetPath": "/oplossingen/logistiek"
  }'
```

## Response

`200 OK`

```json
{
  "handle": "8fK2r9xQ7bLa",
  "goPath": "/go/8fK2r9xQ7bLa",
  "vanityPath": null,
  "status": "active"
}
```

- `handle` — het opaak-handle. **Reused** bij een volgende sync met dezelfde
  `externalId`, dus links die je al gemaild hebt blijven werken.
- `goPath` — kant-en-klaar pad: `/go/{handle}`. Bouw er zelf de volledige URL
  van (`https://<tenant-domein>{goPath}`).
- `vanityPath` — `null` voor via de API gemaakte leads (vanity-paths zet je in de
  admin).
- `status` — de opgeslagen status.

### Statuscodes

| Code | Betekenis |
|------|-----------|
| 200  | Upsert gelukt. |
| 400  | Ongeldige body (na geslaagde auth). |
| 401  | Ontbrekende/foute key of geen key ingesteld. |
| 500  | Interne fout (upsert mislukt). |

## Idempotentie

De upsert is idempotent op `(tenant_id, external_id)` (partieel uniek index
`abm_leads_tenant_external_idx`):

1. Bestaat er al een rij met die `external_id`? → **hergebruik** het bestaande
   `identifier` (handle) én de rij-id, en werk de velden bij.
2. Zo niet → genereer een **vers** opaak `identifier`
   (`crypto.randomBytes` → base64url, niet-ratend) en maak een nieuwe rij.

Zo blijft het handle stabiel: 2× dezelfde `external_id` geeft hetzelfde
`handle` terug.

## Logging & privacy

- Gestructureerd, **zonder PII**: alleen `tenantId` + `external_id` +
  create/update-uitkomst worden gelogd. Geen naam/e-mail in de logs.
- Handles blijven opaak; de lead-data wordt nooit teruggegeven zonder auth.

## Waar het zit

- Route: `app/api/abm/leads/route.ts`
- Kern (auth/validatie/orchestratie, framework-vrij + getest):
  `lib/abm/backoffice-sync.ts`
- Store: `lib/abm/abm-store.ts`
  (`upsertAbmLeadByExternalId`, `getAbmLeadByExternalId`, `getAbmSyncApiKey`,
  `setAbmSyncApiKey`)
- Admin: `app/admin/tenants/[tenantId]/audience/leads` (sectie "Back-office sync API")
- Tests: `tests/abm/backoffice-sync.test.ts`
- Migratie: `supabase/migrations/20240101000182_abm_backoffice_sync.sql`
