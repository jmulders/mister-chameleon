# Registratie-checklist — migraties 163 + 164 op prod en dev

Doel: de twee pending migraties toepassen en registreren via de **werkende** weg
(`npm run db:migrate` → `scripts/migrate.ts`, ledger `public._migrations`):

- `20240101000163_rule_fire_daily_ensure.sql`
- `20240101000164_visitor_behavior_state_rule_context.sql`

Achtergrond en waarom niet via CI: zie
[`docs/migratie-ledger-reconcile.md`](./migratie-ledger-reconcile.md). Kort: de
CI-job `supabase db push` is nog nooit geslaagd en de `schema_migrations`-ledger
is gedivergeerd; `npm run db:migrate` is het gedocumenteerde werkende pad.

> Draai dit zelf. Draai **dev eerst**, verifieer, dan pas **prod**.

---

## 0. Vooraf — dit is veilig (idempotent)

De schema-objecten bestaan al op beide databases (handmatig toegepast); deze stap
**registreert** ze alleen alsnog in `_migrations` en is een veilige no-op op de SQL:

- **163** (`rule_fire_daily_ensure`) gebruikt uitsluitend idempotente statements:
  `DROP TABLE IF EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (herhaalbaar), `DROP FUNCTION IF EXISTS`,
  `CREATE OR REPLACE FUNCTION`. Opnieuw draaien verandert niets aan de al bestaande
  staat (`rule_fire_daily` bestaat, `rule_fire_events` is al gedropt).
- **164** (`rule_context`) is `ALTER TABLE … ADD COLUMN IF NOT EXISTS rule_context
  jsonb NOT NULL DEFAULT '{}'::jsonb` — de kolom bestaat al, dus dit is een no-op.

`scripts/migrate.ts` draait de SQL via de Supabase **Management API** (niet
PostgREST), past alleen bestanden toe die nog **niet** in `_migrations` staan
(alfabetisch = chronologisch), en registreert elk toegepast bestand op
`filename`. Huidige stand op beide omgevingen: `_migrations` staat op
`…000162_rule_fire_events.sql`; **163 en 164 zijn pending**.

---

## 1. Benodigde env-vars (`.env.local`)

`scripts/migrate.ts` leidt het doelproject af uit `NEXT_PUBLIC_SUPABASE_URL` (de
subdomein-ref). **De doel-database bepaal je dus door de URL + keys te wisselen.**

| Variabele | Waarvoor | Bron |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | bepaalt het doelproject (`https://<ref>.supabase.co`) | project-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key van hetzelfde project | Project → Settings → API |
| `SUPABASE_ACCESS_TOKEN` | persoonlijk access token (Management API + `_migrations`-tracking) | <https://supabase.com/dashboard/account/tokens> |

Project-refs:

- **dev**: `xqaeqbqjymeyxbvmhseg` → `NEXT_PUBLIC_SUPABASE_URL=https://xqaeqbqjymeyxbvmhseg.supabase.co`
- **prod**: `kdhfpvjeriszteqhpgll` → `NEXT_PUBLIC_SUPABASE_URL=https://kdhfpvjeriszteqhpgll.supabase.co`

De service-role key **moet** bij de gekozen URL horen (dev-key bij dev-URL,
prod-key bij prod-URL) — anders faalt de auth of raak je het verkeerde project.

---

## 2. Zorg dat het migratiebestand in je working tree staat

Beide bestanden staan in `main` (PR #121 is gemerged). Werk vanaf een schone
checkout van `main`:

```bash
git checkout main && git pull
ls supabase/migrations/20240101000163_*.sql supabase/migrations/20240101000164_*.sql
```

Beide paden moeten bestaan.

---

## 3. Dev — toepassen en registreren

Zet in `.env.local` de **dev**-waarden (URL + service-role key + access token), dan:

```bash
npm run db:migrate
```

Verwachte uitvoer: de runner slaat `…000001`…`…000162` over en past
`…000163_rule_fire_daily_ensure.sql` en `…000164_visitor_behavior_state_rule_context.sql`
toe (beide no-ops op de SQL), en registreert ze.

### Verificatie (dev)

Run in de Supabase SQL-editor van het **dev**-project, of via je eigen client:

```sql
SELECT filename FROM public._migrations
WHERE filename LIKE '%000163%' OR filename LIKE '%000164%';
```

> Let op: de kolom in `_migrations` heet **`filename`** (niet `name` — dat is de
> kolom in `supabase_migrations.schema_migrations`).

Verwacht: twee rijen (`…000163_rule_fire_daily_ensure.sql`,
`…000164_visitor_behavior_state_rule_context.sql`).

Extra check dat de kolom klopt:

```sql
SELECT data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='visitor_behavior_state'
  AND column_name='rule_context';
-- verwacht: jsonb | NO | '{}'::jsonb
```

---

## 4. Prod — toepassen en registreren

Pas nadat dev groen is. Zet in `.env.local` de **prod**-waarden (URL + service-role
key + access token), dan:

```bash
npm run db:migrate
```

### Verificatie (prod)

Draai exact dezelfde verificatie als in stap 3, maar tegen het **prod**-project
(`kdhfpvjeriszteqhpgll`):

```sql
SELECT filename FROM public._migrations
WHERE filename LIKE '%000163%' OR filename LIKE '%000164%';
```

Verwacht: twee rijen. Daarmee staat `_migrations` weer gelijk aan de repo t/m 164.

---

## 5. Naderhand

- Zet `.env.local` terug naar je normale (dev) waarden, zodat je niet per ongeluk
  later tegen prod draait.
- De `schema_migrations`-ledger blijft hierna nog gedivergeerd (163/164 staan daar
  niet in, en de reeks 154+ staat onder timestamps). Dat los je niet met deze stap
  op — zie [`docs/migratie-ledger-reconcile.md`](./migratie-ledger-reconcile.md).
