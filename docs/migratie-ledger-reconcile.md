# Migratie-ledgers verzoenen — analyse en plan

Status: **voorstel**. Dit document beschrijft alleen het probleem en een plan;
het wijzigt niets aan de database of workflows. Uitvoeren gebeurt bewust en
apart, dev-first, met backup.

Directe aanleiding: migraties 163 + 164 stonden pending op prod terwijl de
schema-objecten er al waren, en `supabase db push` weigert de gedivergeerde
history. Zie [`docs/migratie-registratie-163-164.md`](./migratie-registratie-163-164.md)
voor de losse fix van díe twee; dit document gaat over de structurele oorzaak.

---

## 1. Twee ledgers naast elkaar

Er zijn twee onafhankelijke administraties van "welke migratie is toegepast":

| | Ledger A — `db:migrate` | Ledger B — `db push` |
|---|---|---|
| Tool | `npm run db:migrate` → `scripts/migrate.ts` | Supabase CLI `supabase db push` |
| Tracking-tabel | `public._migrations` | `supabase_migrations.schema_migrations` |
| Sleutel | **`filename`** (volledige bestandsnaam) | **`version`** (numeriek prefix van de bestandsnaam) + `name` |
| Uitvoering | Supabase **Management API** (vermijdt PostgREST-cachestaleness) | Postgres-verbinding via CLI |
| Waar aangeroepen | **handmatig**, lokaal, met omgevings-`.env.local` | **CI**: `staging.yml`, `production.yml` |

Beide tabellen bestaan op zowel dev als prod. Ze weten niets van elkaar.

## 2. Wat er feitelijk in staat (gemeten)

**Prod (`kdhfpvjeriszteqhpgll`):**

- `_migrations` (ledger A): 152 rijen, netjes `20240101000001` … `20240101000162_rule_fire_events.sql`. **163 en 164 ontbreken.**
- `schema_migrations` (ledger B): 152 rijen, maar met een **knip**:
  - `20240101000001` … `20240101000153` (matcht de repo-bestandsnamen),
  - daarna **timestamp-versies** `20260724082025` … `20260729061742`, met namen die 1-op-1 matchen op repo-migraties 154–161 (`email_sends`, `ad_publisher_payouts`, …).
  - **162, 163 en 164 staan er helemaal niet in.**
- Schema zelf: `rule_fire_daily` bestaat, `rule_fire_events` is gedropt (= staat ná migratie 163), en `visitor_behavior_state.rule_context` bestaat (`jsonb NOT NULL DEFAULT '{}'`). Die objecten zijn dus met de hand via de SQL-editor toegepast, buiten beide ledgers om.

**Dev (`xqaeqbqjymeyxbvmhseg`):**

- `_migrations`: 151 rijen, ook t/m `…000162`; **163/164 pending.**
- `schema_migrations`: slechts **26 rijen**, allemaal timestamps (t/m `20260802154530`) — deze ledger is duidelijk ooit deels opnieuw opgebouwd en dekt niet de volledige history.

## 3. De knip bij 154: waarom timestamps vs `20240101000XXX`

De repo gebruikt een handmatige, oplopende conventie `20240101000XXX`. Maar:

- `db push` registreert `version` = het numerieke prefix van de **bestandsnaam op het moment van pushen**. De timestamps `20260724…`–`20260729…` in `schema_migrations` betekenen dat de bestanden voor 154–161 op pushmoment een **echte timestamp-naam** hadden — precies wat `supabase migration new <naam>` genereert. Daarna zijn ze in de repo hernoemd/geordend terug naar de `20240101000XXX`-reeks.
- Ledger A (`_migrations`) sleutelt op de **volledige bestandsnaam** en houdt daardoor de nette `20240101000XXX`-reeks bij (t/m 162).

Netto lopen vanaf 154 de repo-bestandsnamen en de `schema_migrations`-versies niet meer 1-op-1. En 162–164 zitten in geen van beide CLI-ledgers.

## 4. De kapotte CI-migratiejob

`production.yml` (job **"DB Migrations — Production"**) doet `supabase link` +
`supabase db push`. In de job staat letterlijk gedocumenteerd: *"Deze job is nog
nooit geslaagd, dus alles hierachter is ongetest terrein."* `staging.yml` gebruikt
hetzelfde `db push`. Gevolg: migraties komen in de praktijk **niet** via CI op de
databases — alles gaat via handmatige `db:migrate` of de SQL-editor.

Waarom hij faalt is dubbel:

1. Ontbrekende/ongeteste secrets (`SUPABASE_ACCESS_TOKEN`, `PRODUCTION_DB_PASSWORD`, `PRODUCTION_SUPABASE_PROJECT_ID`).
2. Zelfs mét secrets zou `db push` op de **history-mismatch** stuklopen: de lokale `20240101000154`…`164` sorteren vóór de reeds-geregistreerde `20260724…`-versies → "migration files to be inserted before the last migration on remote" en/of pogingen om al bestaande objecten opnieuw te maken.

## 5. Tegenstrijdige documentatie

- `docs/developer-gids.md:120` (caveat): *"`supabase db push` kan falen op een history-mismatch. Werkende paden: `npm run db:migrate` of de SQL-editor."* → klopt met de realiteit.
- `docs/developer-gids.md:202-203` (onder "Opgelost op 18 juli 2026"): *"De migratie-ledger is één ledger (`schema_migrations`); `_migrations` en `npm run db:migrate` zijn uitgefaseerd, de history-mismatch is verzoend (repo = DB, 140 = 140)."* → **onwaar**: `_migrations` leeft nog, staat op 162, en de mismatch is er nog steeds.
- `docs/developer-gids.md:122` (regel): *"Voeg `supabase/migrations/<timestamp>_desc.sql` toe"* — schrijft timestamp-namen voor, terwijl de praktijk (en ledger A) de `20240101000XXX`-reeks gebruikt.
- `CLAUDE.md` (Prod-veiligheid): stelt dat migraties "via de deploy" worden toegepast en dat je `schema_migrations` moet checken → onjuist (apart gecorrigeerd).

Kortom: de docs beschrijven een gewenste eindtoestand die nooit is bereikt.

---

## 6. Doel

Eén bron van waarheid voor de migratie-history, waarbij **repo = database**, zodat
een standaardtool (CLI of runner) betrouwbaar de volgende migratie toepast en CI
weer kan werken.

## 7. Keuze: op welke ledger convergeren?

| Optie | Voordeel | Nadeel |
|---|---|---|
| **A. Convergeer op `schema_migrations`** (CLI native) | Werkt met `supabase db push`, branching, `migration repair`; CI kan weer functioneren | Vereist reconcile van de gedivergeerde versies; timestamp-conventie afdwingen |
| **B. Convergeer op `_migrations`** (huidige werkende runner) | Is al de de-facto waarheid (t/m 162), simpele filename-tracking | Niet-standaard; CI zou `db push` moeten inruilen voor `db:migrate`; geen Supabase-branching-support |

**Aanbeveling: Optie A** — richting de Supabase-standaard (`schema_migrations`),
omdat CI, previews en toekomstige tooling daarop leunen. `_migrations`/`db:migrate`
blijven als vangnet tot A bewezen werkt, en worden daarna pas uitgefaseerd (deze
keer echt).

## 8. Plan (dev-first, met backup; niets hiervan is uitgevoerd)

### Fase 0 — voorbereiding
- Backup van beide databases (Supabase dashboard → Database → Backups, of `pg_dump`).
- Snapshot van de huidige staat van **beide** ledgers op dev én prod (bewaar de output):
  ```sql
  SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
  SELECT filename    FROM public._migrations                       ORDER BY filename;
  ```
- Doe **alles eerst volledig op dev**, verifieer, en herhaal daarna pas op prod.

### Fase 1 — repo = waarheid vaststellen
- Bevestig dat elke `supabase/migrations/*.sql` een idempotente of reeds-toegepaste
  wijziging is (spot-check de objecten die ná 153 zijn toegevoegd).
- Beslis de canonieke versienummers: **de bestaande `20240101000XXX`-prefixes**
  (geen herbenoeming — dat zou ledger A breken).

### Fase 2 — `schema_migrations` verzoenen met de repo (geen SQL opnieuw draaien)
Gebruik `supabase migration repair`, dat alleen de tracking aanpast, niet het schema:
- Markeer de repo-versies die al zijn toegepast als **applied** zonder ze te draaien, voor het gedivergeerde bereik:
  ```bash
  supabase migration repair --status applied 20240101000154 20240101000155 … 20240101000164
  ```
- Markeer de **stray timestamp-rijen** (dubbelingen van 154–161, en op dev de losse `20260802…`) als **reverted**, zodat de ledger niet dubbeltelt:
  ```bash
  supabase migration repair --status reverted 20260724082025 … 20260729061742
  ```
- Eindresultaat: `schema_migrations` bevat exact de repo-versies `20240101000001…164`, allemaal *applied*. `supabase db push` wordt daarna een no-op ("remote database is up to date").

> Draai deze reparaties **eerst op dev**, controleer met de snapshot-queries uit Fase 0, en pas dan op prod. `migration repair` raakt alleen de ledger-tabel; het voert geen DDL uit.

### Fase 3 — ledger A afsluiten
- Zodra `schema_migrations` klopt en `db push` op beide omgevingen "up to date" meldt: markeer `_migrations`/`db:migrate` als afgeschaft (of houd het bewust als read-only vangnet). Verwijder de tabel pas als je zeker bent.

### Fase 4 — CI repareren of verwijderen
- **Repareren:** zet de drie secrets (`SUPABASE_ACCESS_TOKEN`, `PRODUCTION_DB_PASSWORD`, `PRODUCTION_SUPABASE_PROJECT_ID`) op environment-scope `production` (en de staging-equivalenten), en laat de `db push`-job eerst tegen **staging** slagen. Pas als staging groen is, prod aanzetten.
- **Of verwijderen:** als je op ledger A blijft (Optie B) of de handmatige weg bewust houdt, haal dan de dode `migrate`-job uit `production.yml`/`staging.yml` weg zodat hij geen valse zekerheid wekt — en documenteer expliciet dat migraties handmatig gaan.
- Voeg een lichte **drift-check** toe (CI-stap die `db push --dry-run` of een diff draait en faalt bij verschil), zodat repo en DB niet opnieuw uit elkaar lopen.

### Fase 5 — docs gelijktrekken
- Corrigeer `docs/developer-gids.md` (regels 120 vs 202-203 en de timestamp-regel 122) naar de gekozen realiteit.
- `CLAUDE.md` is al bijgewerkt (migraties handmatig via `db:migrate`, check `_migrations`); pas dat opnieuw aan zodra CI werkt.

## 9. Acceptatiecriteria
- `supabase db push` meldt op dev én prod "up to date" (geen pending, geen mismatch).
- `schema_migrations`-versies == repo-bestandsprefixes, 1-op-1.
- CI-migratiejob slaagt op staging (en, indien gewenst, prod) — of is verwijderd met expliciete documentatie.
- Eén, consistente set migratie-docs.
