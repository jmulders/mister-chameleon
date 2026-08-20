# Form submission payload encryption

Form submissions store personal data (email addresses, contact messages). This
feature encrypts that data at rest and adds a deterministic email hash so a
submission can still be looked up by email without decrypting rows.

## What changed

- New crypto module `lib/forms-crypto.ts` (modeled on `lib/email-crypto.ts`):
  - `encryptPayload` / `decryptPayload`: AES-256-GCM, `enc:v1:<iv>:<tag>:<ct>`
    format, with `plain:` and legacy passthrough fallbacks.
  - `emailHash(value)`: deterministic hex digest for lookup. Keyed HMAC-SHA256
    under a sub-key derived from `FORMS_ENCRYPTION_KEY` when the key is set,
    unkeyed SHA-256 fallback when it is not. Input is normalised (trim +
    lowercase).
- New columns on `form_submissions` (migration `0165`):
  - `payload_enc text`: the encrypted whole-payload blob.
  - `email_hash text`: the deterministic email lookup hash.
  - index `form_submissions_email_hash_idx (tenant_id, email_hash)`.
- `data/repositories/form-submissions-repository.ts`:
  - Write (`saveFormSubmission`): stores `payload_enc = encrypt(JSON.stringify(values))`,
    fills `email_hash` from the submitted email, and writes `payload = '{}'` so the
    plaintext column keeps its NOT NULL constraint without holding personal data.
  - Read (`mapRow` via `decodeValues`): decrypts `payload_enc` (with a legacy
    plaintext `payload` fallback for not-yet-backfilled rows), and never returns
    raw ciphertext on a decrypt failure (logs and returns the legacy value / `{}`).
  - Search (`listFormSubmissions`): the old `ilike payload::text` free-text search
    is replaced by an exact `email_hash` lookup. Content substring search is
    intentionally dropped now that payloads are encrypted.

All read paths (admin list, detail view, CSV export) go through `mapRow`, so they
decrypt transparently.

## Key

Set `FORMS_ENCRYPTION_KEY` to a 32-byte hex string (64 hex chars):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

When the key is absent, payloads are stored with a `plain:` prefix and a startup
warning is emitted, so development works without a key. The email hash still works
in that mode (unkeyed SHA-256), so lookups are consistent within a given key mode.

## Prod rollout order

Run each step yourself (nothing here is run against prod automatically):

1. Set `FORMS_ENCRYPTION_KEY` in the prod environment.
2. Run the migration: `npm run db:migrate` (adds `payload_enc` / `email_hash`,
   registered in `public._migrations` by filename). Do not rely on
   `supabase db push`.
3. Deploy the application code. The decrypt-with-legacy-fallback read path means
   the deploy is safe before the backfill: old rows still read via `payload`.
4. Backfill existing rows:

   ```bash
   FORMS_ENCRYPTION_KEY=<hex> npx tsx scripts/encrypt-form-submissions.ts           # dry-run
   FORMS_ENCRYPTION_KEY=<hex> npx tsx scripts/encrypt-form-submissions.ts --apply   # write
   ```

   Dry-run by default; a startup self-test and a per-row round-trip check guard
   the write (a mismatch skips the row, never destructive). It fills `payload_enc`
   + `email_hash` and blanks `payload` to `{}`. It is idempotent (only rows with
   `payload_enc IS NULL` are processed).
5. Verify: no `enc:v1:` strings are visible in the admin list, detail, or CSV
   export (all read paths decrypt), and email lookup returns the expected rows.
