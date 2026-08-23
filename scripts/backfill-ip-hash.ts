/**
 * Backfill: populate ip_company_cache.ip_hash from the raw ip column.
 *
 * Between migrations 0169 (adds ip_hash) and 0170 (drops raw ip), existing rows
 * still hold a raw IP in `ip` and a NULL ip_hash. This script computes the
 * one-way digest for each such row and writes ip_hash, so warm cache entries keep
 * matching after the app switches to hashed lookups. It never writes the raw IP
 * anywhere new; it only derives the digest and leaves the raw column for 0170 to
 * drop.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   - Dry-run by default. Pass --apply to write.
 *   - Only rows with ip_hash IS NULL and ip IS NOT NULL are processed, so re-runs
 *     are idempotent.
 *   - The digest is byte-for-byte compatible with lib/ip-hash.ts (same
 *     domain-separated HMAC construction, or unkeyed SHA-256 without a key), so
 *     the running app reads exactly what this writes.
 *
 * ─── Order of operations ──────────────────────────────────────────────────────
 *
 *   1. Apply migration 0169 (npm run db:migrate).
 *   2. Deploy the app code that reads/writes ip_hash.
 *   3. Run this backfill with the SAME IP_HASH_KEY the app uses.
 *   4. Apply migration 0170 (drops the raw ip column).
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   IP_HASH_KEY=<hex> npx tsx scripts/backfill-ip-hash.ts           # dry-run
 *   IP_HASH_KEY=<hex> npx tsx scripts/backfill-ip-hash.ts --apply   # write
 *
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are read from
 *   .env.local or the shell. Point these at the environment you want to migrate.
 *   Omitting IP_HASH_KEY is allowed (unkeyed SHA-256) but must match the app's
 *   mode, or the backfilled digests will not match live lookups.
 */

import * as path   from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac } from "crypto";

// Capture shell-provided overrides BEFORE loading .env.local, so an inline
// `VAR=… npx tsx …` (e.g. prod creds) always wins over the file's dev values.
const _shell = {
  url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
  key: process.env["SUPABASE_SERVICE_ROLE_KEY"],
  ipk: process.env["IP_HASH_KEY"],
};
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
if (_shell.url) process.env["NEXT_PUBLIC_SUPABASE_URL"] = _shell.url;
if (_shell.key) process.env["SUPABASE_SERVICE_ROLE_KEY"] = _shell.key;
if (_shell.ipk) process.env["IP_HASH_KEY"]              = _shell.ipk;

// ─── Inlined hash — byte-for-byte compatible with lib/ip-hash.ts ───────────────
//
// This standalone script cannot import @/lib/ip-hash because that module carries
// `import "server-only"`, which only resolves inside the Next bundler. The
// construction below (info string, HMAC layering, normalisation, unkeyed
// fallback) is IDENTICAL, so the running app matches exactly what this writes.
// Keep the two in sync.
const IP_HASH_INFO = "ip-company-cache-hash-v1";
const HEX_KEY_RE   = /^[0-9a-fA-F]{64}$/;

function loadKey(): Buffer | null {
  const raw = process.env["IP_HASH_KEY"];
  if (!raw || !HEX_KEY_RE.test(raw)) return null;
  return Buffer.from(raw, "hex");
}

function ipHash(ip: string): string {
  const normalized = ip.trim();
  const key = loadKey();
  if (!key) return createHash("sha256").update(normalized, "utf8").digest("hex");
  const subKey = createHmac("sha256", key).update(IP_HASH_INFO, "utf8").digest();
  return createHmac("sha256", subKey).update(normalized, "utf8").digest("hex");
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
console.log(`IP hash mode    : ${loadKey() ? "keyed (HMAC-SHA256)" : "UNKEYED SHA-256 (no IP_HASH_KEY)"}`);

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

const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// ─── Run ─────────────────────────────────────────────────────────────────────

interface Row { ip: string | null; ip_hash: string | null }

async function run(): Promise<void> {
  console.log(APPLY
    ? "APPLY mode — changes WILL be written.\n"
    : "DRY-RUN — no changes written (pass --apply to write).\n");

  let processed = 0;
  let filled    = 0;
  let skipped   = 0;

  // Page through rows still missing ip_hash. APPLY sets ip_hash, so an --apply run
  // drains the backlog; a dry-run keeps seeing the same rows, so we advance a
  // cursor over the raw ip to avoid re-reading in dry-run.
  let lastIp: string | null = null;

  for (;;) {
    let q = db
      .from("ip_company_cache")
      .select("ip, ip_hash")
      .is("ip_hash", null)
      .not("ip", "is", null)
      .order("ip", { ascending: true })
      .limit(PAGE);
    if (!APPLY && lastIp !== null) q = q.gt("ip", lastIp);

    const { data, error } = await q;
    if (error) abort(`read ip_company_cache: ${error.message}`);
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      processed++;
      lastIp = row.ip;
      if (!row.ip) { skipped++; continue; }

      const hash = ipHash(row.ip);

      if (APPLY) {
        const { error: uErr } = await db
          .from("ip_company_cache")
          .update({ ip_hash: hash })
          .eq("ip", row.ip)
          .is("ip_hash", null);
        if (uErr) {
          console.error(`  ⚠️  ip_hash update failed (${uErr.message}) — SKIPPED.`);
          skipped++;
          continue;
        }
      }
      filled++;
      console.log(`  ${APPLY ? "filled" : "would fill"} ip_hash …${hash.slice(-8)}`);
    }

    if (rows.length < PAGE) break;
  }

  console.log(`\nScanned ${processed} row(s). ${filled} ${APPLY ? "filled" : "would be filled"}, ${skipped} skipped.`);
  if (!APPLY && filled > 0) console.log("Re-run with --apply to write the changes.");
  if (processed === 0) console.log("Nothing to do — no rows missing ip_hash.");
}

run().catch((err) => abort(String(err)));
