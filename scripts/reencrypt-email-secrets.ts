/**
 * scripts/reencrypt-email-secrets.ts
 *
 * One-off migration: re-encrypt email transport secrets that are still stored as
 * plaintext ("plain:…" or a legacy unprefixed value) into AES-256-GCM
 * ("enc:v1:…"), using the shared crypto in lib/email-crypto.ts.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   The encrypt/decrypt pipeline is already fully wired:
 *     • admin save actions call encryptSecret() before writing
 *     • both loaders decrypt on read — loadTenantEmailTransport() for tenants and
 *       getPlatformEmailSettings() for the platform layer
 *   Secrets only sit in plaintext because EMAIL_ENCRYPTION_KEY was never set.
 *   Once the key is set, NEW saves encrypt automatically; this script encrypts the
 *   secrets that were saved BEFORE the key existed, so nothing stays plaintext.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   • Dry-run by default. Pass --apply to write.
 *   • Aborts if EMAIL_ENCRYPTION_KEY is unset — it would otherwise "re-encrypt"
 *     plaintext back to plaintext, which is pointless and misleading.
 *   • Startup self-test: encrypt→decrypt a probe string and bail if it doesn't
 *     round-trip, so a malformed key is caught before any secret is touched.
 *   • Per-secret round-trip: every new ciphertext is decrypted and compared to the
 *     original plaintext BEFORE it is written. A mismatch skips that secret and is
 *     reported — a bad key can never corrupt a live credential.
 *   • Idempotent: values already "enc:v1:…" are skipped.
 *
 * ─── CRITICAL ─────────────────────────────────────────────────────────────────
 *
 *   Run this with the SAME EMAIL_ENCRYPTION_KEY the running app uses. If the app's
 *   key differs from the one used here, SMTP sending fails with
 *   "535 Authentication failed: wrong user/password" because the app cannot
 *   decrypt what this wrote. Set the key in the app's environment FIRST, verify a
 *   test send still works, THEN run this against the same database with the same
 *   key.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   EMAIL_ENCRYPTION_KEY=<hex> npx tsx scripts/reencrypt-email-secrets.ts           # dry-run
 *   EMAIL_ENCRYPTION_KEY=<hex> npx tsx scripts/reencrypt-email-secrets.ts --apply   # write
 *
 *   Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (+ EMAIL_ENCRYPTION_KEY)
 *   from .env.local or the shell. Point these at the environment you want to migrate.
 */

import * as path   from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "@/lib/email-crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const APPLY       = process.argv.includes("--apply");
const SUPA_URL    = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPA_KEY    = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const ENC_PREFIX  = "enc:v1:";
const SECRET_KEYS = ["smtpPassword", "resendApiKey"] as const;

function abort(msg: string): never {
  console.error(`\n❌  ${msg}`);
  process.exit(1);
}

if (!SUPA_URL || !SUPA_KEY) {
  abort("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local or shell).");
}
if (!process.env["EMAIL_ENCRYPTION_KEY"]) {
  abort(
    "EMAIL_ENCRYPTION_KEY is not set. Set it to the SAME key the running app uses, then re-run.\n" +
    "    Without it, secrets would only be rewritten as plaintext.",
  );
}

// Startup self-test — prove the key round-trips before touching any real secret.
try {
  const probe = encryptSecret("mc-probe-value");
  if (!probe.startsWith(ENC_PREFIX) || decryptSecret(probe) !== "mc-probe-value") {
    abort("EMAIL_ENCRYPTION_KEY failed the encrypt→decrypt self-test. Check the key value.");
  }
} catch (err) {
  abort(`EMAIL_ENCRYPTION_KEY is invalid: ${String(err)}`);
}

const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

/**
 * Returns the enc:v1: ciphertext to write for a stored secret, or null when no
 * change is needed (empty, already encrypted, or a failed round-trip check).
 */
function reencrypt(stored: unknown, label: string): string | null {
  if (typeof stored !== "string" || stored === "")   return null;
  if (stored.startsWith(ENC_PREFIX))                  return null; // already encrypted

  const plain = decryptSecret(stored); // strips "plain:" / passes legacy through
  if (!plain) return null;

  const cipher = encryptSecret(plain);
  if (!cipher.startsWith(ENC_PREFIX)) {
    abort(`encryptSecret produced no ciphertext for ${label} — is EMAIL_ENCRYPTION_KEY 32 bytes (64 hex)?`);
  }
  if (decryptSecret(cipher) !== plain) {
    console.error(`  ⚠️  ${label}: round-trip mismatch — SKIPPED (left unchanged).`);
    return null;
  }
  return cipher;
}

async function run(): Promise<void> {
  console.log(APPLY
    ? "APPLY mode — changes WILL be written.\n"
    : "DRY-RUN — no changes written (pass --apply to write).\n");

  let changed = 0;

  // ── 1. tenant_email_transport (one row per tenant) ─────────────────────────
  const { data: tenants, error: tErr } = await db
    .from("tenant_email_transport")
    .select("id, tenant_id, config");
  if (tErr) abort(`read tenant_email_transport: ${tErr.message}`);

  for (const row of tenants ?? []) {
    const cfg = { ...(row.config as Record<string, unknown>) };
    let touched = false;
    for (const field of SECRET_KEYS) {
      const next = reencrypt(cfg[field], `tenant ${row.tenant_id}.${field}`);
      if (next) {
        cfg[field] = next;
        touched = true;
        changed++;
        console.log(`  tenant ${row.tenant_id}.${field}: plain → enc`);
      }
    }
    if (touched && APPLY) {
      const { error } = await db
        .from("tenant_email_transport")
        .update({ config: cfg, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) abort(`update tenant ${row.tenant_id}: ${error.message}`);
    }
  }

  // ── 2. platform_settings.email (single row keyed 'email') ──────────────────
  const { data: pRow, error: pErr } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", "email")
    .maybeSingle();
  if (pErr) abort(`read platform_settings.email: ${pErr.message}`);

  if (pRow?.value) {
    const val = { ...(pRow.value as Record<string, unknown>) };
    let touched = false;
    for (const field of SECRET_KEYS) {
      const next = reencrypt(val[field], `platform.${field}`);
      if (next) {
        val[field] = next;
        touched = true;
        changed++;
        console.log(`  platform.${field}: plain → enc`);
      }
    }
    if (touched && APPLY) {
      const { error } = await db
        .from("platform_settings")
        .update({ value: val, updated_at: new Date().toISOString() })
        .eq("key", "email");
      if (error) abort(`update platform_settings.email: ${error.message}`);
    }
  }

  console.log(`\n${changed} secret(s) ${APPLY ? "re-encrypted." : "would be re-encrypted."}`);
  if (!APPLY && changed > 0) console.log("Re-run with --apply to write the changes.");
  if (changed === 0) console.log("Nothing to do — no plaintext secrets found.");
}

run().catch((err) => abort(String(err)));
