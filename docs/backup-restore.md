# Backup, Restore & Bootstrap

Complete guide for backing up, restoring, and bootstrapping a Mister Chameleon environment.

---

## Backup Structure

Each backup is a timestamped folder created by `scripts/backup.ts`:

```
backups/
└── 2024-12-01T14-30-00Z/
    ├── manifest.json          # Metadata: git SHA, table counts, section results, timestamps
    ├── code/
    │   └── source.tar.gz      # Git archive of current HEAD (all tracked files)
    ├── migrations/
    │   └── *.sql              # Copy of supabase/migrations/ — all applied SQL migrations
    ├── db-data/
    │   ├── tenants.ndjson
    │   ├── subscriptions.ndjson
    │   ├── credit_balance.ndjson
    │   ├── credit_transactions.ndjson
    │   ├── admin_users.ndjson
    │   ├── platform_settings.ndjson
    │   ├── tenant_settings.ndjson
    │   ├── tenant_domains.ndjson
    │   ├── tenant_email_transport.ndjson
    │   ├── tenant_form_settings.ndjson
    │   ├── tenant_form_overrides.ndjson
    │   ├── context_variable_metadata.ndjson
    │   ├── rules_config.ndjson
    │   ├── pages.ndjson
    │   ├── sessions.ndjson
    │   ├── served_variants.ndjson
    │   ├── events.ndjson
    │   ├── form_submissions.ndjson
    │   ├── visitor_journey.ndjson
    │   ├── experiments.ndjson
    │   ├── interest_profiles.ndjson
    │   ├── ai_decision_logs.ndjson
    │   └── scoring_rules.ndjson
    ├── sanity/
    │   ├── export.tar.gz      # Sanity CLI export (documents + assets)
    │   └── schemas/           # Copy of studio/src/schemaTypes/
    ├── config/
    │   ├── env.example        # .env.local with secrets redacted (keys present, values masked)
    │   └── package-versions.json  # Node version, npm deps snapshot
    └── assets/
        └── public.tar.gz      # public/ directory (images, icons, favicon)
```

### Data format: NDJSON

Database tables are exported as newline-delimited JSON (one object per line). This format handles nested JSON fields natively and is streaming-compatible for large tables.

```
{"id":"abc","tenant_id":"xyz","name":"Acme","created_at":"2024-01-01T00:00:00Z"}
{"id":"def","tenant_id":"xyz","name":"Corp","created_at":"2024-01-02T00:00:00Z"}
```

---

## Running a Backup

```bash
# Full backup (default output: backups/<timestamp>/)
node --experimental-strip-types scripts/backup.ts

# Custom output directory
node --experimental-strip-types scripts/backup.ts --output=./my-backup

# Skip sections
node --experimental-strip-types scripts/backup.ts --no-code     # skip git archive
node --experimental-strip-types scripts/backup.ts --no-sanity   # skip Sanity export
node --experimental-strip-types scripts/backup.ts --no-data     # skip DB data (schema only)

# Load from a non-default env file
node --experimental-strip-types scripts/backup.ts --env=.env.production
```

**Required env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Optional (for Sanity backup):** `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_AUTH_TOKEN`

---

## Restore Flow

The restore script (`scripts/restore.ts`) applies a backup folder to a target environment. Restore operations are **idempotent** — safe to re-run.

### Steps performed

1. **Schema** — runs `supabase db push` (if CLI available) or copies migration files and prints manual instructions.
2. **Data** — reads each `.ndjson` file and upserts rows via the Supabase service-role client. Existing rows are updated; new rows are inserted. Foreign key order is respected (tenants → subscriptions → transactions).
3. **Sanity** — runs `sanity dataset import export.tar.gz <dataset> --replace` using the Sanity CLI.

### Commands

```bash
# Restore from a specific backup
node --experimental-strip-types scripts/restore.ts --backup=backups/2024-12-01T14-30-00Z

# Dry run — log what would happen without writing anything
node --experimental-strip-types scripts/restore.ts --backup=... --dry-run

# Skip sections
node --experimental-strip-types scripts/restore.ts --backup=... --no-schema
node --experimental-strip-types scripts/restore.ts --backup=... --no-data
node --experimental-strip-types scripts/restore.ts --backup=... --no-sanity

# Restore only specific tables
node --experimental-strip-types scripts/restore.ts --backup=... --tables=tenants,rules_config,pages
```

### Conflict behaviour

| Table | Conflict column | Strategy |
|-------|----------------|----------|
| `tenants` | `id` | Upsert (update existing) |
| `subscriptions` | `tenant_id` | Upsert |
| `credit_balance` | `tenant_id` | Upsert |
| `credit_transactions` | `id` | Upsert (idempotent — keeps audit log) |
| `platform_settings` | `key` | Upsert |
| `rules_config` | `id` | Upsert |
| All others | `id` | Upsert |

---

## Bootstrap (fresh environment in 1–2 commands)

The bootstrap script sets up a brand new environment end-to-end.

```bash
# 1. Copy and fill in environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL, keys, Sanity IDs, etc.

# 2. Bootstrap everything
node --experimental-strip-types scripts/bootstrap.ts
```

### What bootstrap does

1. **Node version check** — requires Node ≥ 20.
2. **Env validation** — verifies `.env.local` exists and all required variables are set.
3. **Install dependencies** — runs `npm install` in root and `studio/` (Sanity).
4. **Apply migrations** — runs `supabase db push` (or falls back to manual instructions).
5. **Seed platform settings** — inserts default `platform_settings` rows if missing.
6. **Check admin users** — prints instructions to create the first admin if none exist.
7. **Validate** — runs the full validation script and reports pass/fail.

### Bootstrap from a backup

```bash
# After filling in .env.local:
node --experimental-strip-types scripts/restore.ts --backup=backups/<timestamp>
node --experimental-strip-types scripts/bootstrap.ts  # seeds + validates on top
```

---

## Validation

Run at any time to check environment health:

```bash
node --experimental-strip-types scripts/validate.ts

# Machine-readable JSON output (for CI or monitoring)
node --experimental-strip-types scripts/validate.ts --json
```

### Checks performed

| Check | What it verifies |
|-------|-----------------|
| ENV vars | Required vars present (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) |
| Migration files | Expected `.sql` files present in `supabase/migrations/` |
| DB connectivity | Service-role client can connect and query |
| Required tables | All 23 tables exist in the schema |
| Tenants | At least one tenant row exists |
| Tenant settings | Each tenant has a `tenant_settings` row |
| Admin users | At least one admin user exists |
| Platform settings | `platform_settings` is populated |
| Sanity connection | Project ID / dataset env vars are set |

Exit code `0` = all checks pass. Exit code `1` = one or more failures (details printed to stderr or JSON).

---

## Known Limitations

### Analytics and event tables

The `sessions`, `events`, `served_variants`, and `form_submissions` tables can grow very large in production. The backup script exports all rows, which may be slow or produce very large NDJSON files. For production use, consider:

- Exporting only a recent time window (`--since=30d` option, not yet implemented).
- Archiving old analytics data to cold storage (S3/GCS) separately.
- Truncating analytics tables in staging restores (`--skip-analytics` option, not yet implemented).

### Stripe subscriptions

The backup captures the **local** subscription state from the `subscriptions` table. Stripe itself is not backed up. After a restore to a new environment:

- Subscription rows will be present, but Stripe customer / subscription IDs will not be valid in the new Stripe account.
- Credit balance rows are restored as-is.
- For a full environment recreation, Stripe test mode data must be re-created manually or via Stripe's export tools.

### Sanity assets

`sanity dataset import` restores documents and metadata. Large binary assets (images, files) stored in Sanity's CDN are referenced by URL and not re-uploaded during import. Assets will continue to resolve from the original CDN as long as the Sanity project exists.

### Secret rotation

The `config/env.example` in each backup has secret **keys** but **masked values** (e.g., `SUPABASE_SERVICE_ROLE_KEY=***`). The actual secret values are never written to disk as part of the backup. Rotate secrets separately using your secrets manager or `.env.local` configuration.

### No point-in-time restore

The current backup system is snapshot-based (full export at a point in time). It does not support WAL-based point-in-time recovery. For that, use Supabase's built-in PITR feature (available on Pro and above plans).
