/**
 * Backfill: encrypt existing form_submissions payloads at rest.
 *
 * Converts legacy plaintext rows (payload jsonb, payload_enc NULL) into the
 * encrypted shape written by the app after this feature: it fills payload_enc
 * (AES-256-GCM, enc:v1 format), fills email_hash (deterministic lookup), and
 * blanks payload to '{}' so no plaintext personal data remains.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   - Dry-run by default. Pass --apply to write.
 *   - Requires FORMS_ENCRYPTION_KEY. A startup self-test proves the key
 *     round-trips before any row is touched, so a malformed key is caught early.
 *   - Per-row round-trip: every new ciphertext is decrypted and compared to the
 *     original JSON before the row is written; a mismatch SKIPS the row
 *     (left unchanged), never destructive.
 *   - Only rows with payload_enc IS NULL are processed, so re-runs are idempotent.
 *
 * ─── Prerequisite ────────────────────────────────────────────────────────────
 *
 *   Run the 0165 migration first (npm run db:migrate) so payload_enc / email_hash
 *   exist. Set FORMS_ENCRYPTION_KEY to the SAME key the running app uses, and
 *   deploy the app code first, so the app can decrypt what this writes.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   FORMS_ENCRYPTION_KEY=<hex> npx tsx scripts/encrypt-form-submissions.ts           # dry-run
 *   FORMS_ENCRYPTION_KEY=<hex> npx tsx scripts/encrypt-form-submissions.ts --apply   # write
 *
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are read from
 *   .env.local or the shell. Point these at the environment you want to migrate.
 */

import * as path   from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

// Capture shell-provided overrides BEFORE loading .env.local, so an inline
// `VAR=… npx tsx …` (e.g. prod creds) always wins over the file's dev values.
const _shell = {
  url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
  key: process.env["SUPABASE_SERVICE_ROLE_KEY"],
  enc: process.env["FORMS_ENCRYPTION_KEY"],
};
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
if (_shell.url) process.env["NEXT_PUBLIC_SUPABASE_URL"] = _shell.url;
if (_shell.key) process.env["SUPABASE_SERVICE_ROLE_KEY"] = _shell.key;
if (_shell.enc) process.env["FORMS_ENCRYPTION_KEY"]      = _shell.enc;

// ─── Inlined crypto — byte-for-byte compatible with lib/forms-crypto.ts ────────
//
// This standalone script cannot import @/lib/forms-crypto because that module
// carries `import "server-only"`, which only resolves inside the Next bundler.
// The format below (prefixes, algorithm, IV size, field order, HMAC info string,
// normalisation) is IDENTICAL, so the running app decrypts exactly what this
// writes and computes the same email_hash. Keep the two in sync.
const ENC_PREFIX      = "enc:v1:";
const PLAIN_PREFIX    = "plain:";
const ALGORITHM       = "aes-256-gcm" as const;
const IV_BYTES        = 12;
const EMAIL_HASH_INFO = "forms-email-hash-v1";

function loadCryptoKey(): Buffer {
  const raw = process.env["FORMS_ENCRYPTION_KEY"];
  if (!raw) throw new Error("FORMS_ENCRYPTION_KEY is not set.");
  const buf = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`FORMS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64). Got ${buf.length} bytes.`);
  }
  return buf;
}

function encryptPayload(plaintext: string): string {
  const key       = loadCryptoKey();
  const iv        = randomBytes(IV_BYTES);
  const cipher    = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return ENC_PREFIX + iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptPayload(stored: string): string {
  if (stored.startsWith(PLAIN_PREFIX)) return stored.slice(PLAIN_PREFIX.length);
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy unformatted → passthrough
  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted payload — expected iv:authTag:ciphertext.");
  const [ivHex, tagHex, ctHex] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, loadCryptoKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf8");
}

function emailHash(value: string): string {
  const normalized = value.trim().toLowerCase();
  const subKey = createHmac("sha256", loadCryptoKey()).update(EMAIL_HASH_INFO, "utf8").digest();
  return createHmac("sha256", subKey).update(normalized, "utf8").digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailFromValues(values: Record<string, string>): string | null {
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && /e-?mail/i.test(k) && EMAIL_RE.test(v.trim())) return v.trim();
  }
  for (const v of Object.values(values)) {
    if (typeof v === "string" && EMAIL_RE.test(v.trim())) return v.trim();
  }
  return null;
}

// ─── Config + guards ───────────────────────────────────────────────────────────

const APPLY    = process.argv.includes("--apply");
const SUPA_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPA_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const PAGE     = 500;

function abort(msg: string): never {
  console.error(`\n❌  ${msg}`);
  process.exit(1);
}

if (!SUPA_URL || !SUPA_KEY) {
  abort("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local or shell).");
}

try {
  console.log(`Target database : ${new URL(SUPA_URL).host}`);
} catch {
  console.log(`Target database : ${SUPA_URL}`);
}
console.log(`Service-role key: ${SUPA_KEY.length} chars, ends …${SUPA_KEY.slice(-4)}`);

// A service_role JWT's `ref` claim names its project; catch a key/URL mismatch
// with a clear message instead of Supabase's opaque "Invalid API key".
try {
  const urlRef  = new URL(SUPA_URL).host.split(".")[0];
  const segment = SUPA_KEY.split(".")[1];
  if (segment) {
    const claims = JSON.parse(Buffer.from(segment, "base64").toString("utf8")) as { ref?: string; role?: string };
    if (claims.ref && claims.ref !== urlRef) {
      abort(
        `Key/URL project mismatch — the service_role key belongs to project "${claims.ref}", ` +
        `but the URL targets "${urlRef}". Copy the service_role key from the SAME project.`,
      );
    }
    if (claims.role && claims.role !== "service_role") {
      abort(`The provided key has role "${claims.role}", not "service_role". Use the service_role secret.`);
    }
  }
} catch (err) {
  if (err instanceof Error && err.message.includes("project")) throw err;
  /* non-JWT key — let the live query be the check */
}
console.log("");

if (!process.env["FORMS_ENCRYPTION_KEY"]) {
  abort(
    "FORMS_ENCRYPTION_KEY is not set. Set it to the SAME key the running app uses, then re-run.\n" +
    "    Without it, payloads would only be rewritten as plaintext.",
  );
}

// Startup self-test — prove the key round-trips before touching any real row.
try {
  const probe = encryptPayload('{"probe":"mc-probe-value"}');
  if (!probe.startsWith(ENC_PREFIX) || decryptPayload(probe) !== '{"probe":"mc-probe-value"}') {
    abort("FORMS_ENCRYPTION_KEY failed the encrypt→decrypt self-test. Check the key value.");
  }
} catch (err) {
  abort(`FORMS_ENCRYPTION_KEY is invalid: ${String(err)}`);
}

const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// ─── Run ─────────────────────────────────────────────────────────────────────

interface LegacyRow { id: string | number; tenant_id: string | null; payload: Record<string, string> | null }

async function run(): Promise<void> {
  console.log(APPLY
    ? "APPLY mode — changes WILL be written.\n"
    : "DRY-RUN — no changes written (pass --apply to write).\n");

  let processed = 0;
  let encrypted = 0;
  let skipped   = 0;

  // Page through rows that are not yet encrypted (payload_enc IS NULL). Because
  // APPLY sets payload_enc, an --apply run drains the backlog; a dry-run keeps
  // seeing the same rows, so we cap the dry-run scan to one page window per id.
  let lastId: string | number | null = null;

  for (;;) {
    let q = db
      .from("form_submissions")
      .select("id, tenant_id, payload")
      .is("payload_enc", null)
      .order("id", { ascending: true })
      .limit(PAGE);
    // In dry-run, payload_enc stays null, so advance a cursor to avoid re-reading.
    if (!APPLY && lastId !== null) q = q.gt("id", lastId);

    const { data, error } = await q;
    if (error) abort(`read form_submissions: ${error.message}`);
    const rows = (data ?? []) as LegacyRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      processed++;
      lastId = row.id;
      const values = (row.payload ?? {}) as Record<string, string>;
      const plaintext = JSON.stringify(values);

      const cipher = encryptPayload(plaintext);
      if (!cipher.startsWith(ENC_PREFIX)) {
        abort(`encryptPayload produced no ciphertext for row ${row.id} — is FORMS_ENCRYPTION_KEY 32 bytes?`);
      }
      if (decryptPayload(cipher) !== plaintext) {
        console.error(`  ⚠️  row ${row.id}: round-trip mismatch — SKIPPED (left unchanged).`);
        skipped++;
        continue;
      }

      const email = emailFromValues(values);
      const hash  = email ? emailHash(email) : null;

      if (APPLY) {
        const { error: uErr } = await db
          .from("form_submissions")
          .update({ payload_enc: cipher, email_hash: hash, payload: {} })
          .eq("id", row.id);
        if (uErr) {
          console.error(`  ⚠️  row ${row.id}: update failed (${uErr.message}) — SKIPPED.`);
          skipped++;
          continue;
        }
      }
      encrypted++;
      console.log(`  row ${row.id}: plain → enc${hash ? " (+email_hash)" : ""}${APPLY ? "" : " [dry-run]"}`);
    }

    if (rows.length < PAGE) break;
  }

  console.log(`\nScanned ${processed} row(s). ${encrypted} ${APPLY ? "encrypted" : "would be encrypted"}, ${skipped} skipped.`);
  if (!APPLY && encrypted > 0) console.log("Re-run with --apply to write the changes.");
  if (processed === 0) console.log("Nothing to do — no un-encrypted rows found.");
}

run().catch((err) => abort(String(err)));
