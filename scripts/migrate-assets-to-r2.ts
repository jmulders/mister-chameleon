/**
 * Migrate existing tenant assets to Cloudflare R2 (non-destructive).
 *
 * Copies every asset that is not yet on R2 to the R2 bucket, updates its
 * tenant_assets row, and rewrites the exact old -> new public_url string in the
 * content that hardcodes it (adaptive_blocks). The Supabase originals are kept by
 * default (behind --delete-originals) so any missed / legacy reference still
 * resolves.
 *
 * ─── Reference model ──────────────────────────────────────────────────────────
 *
 *   Content stores the asset's PUBLIC URL, not an assetId. So moving the file and
 *   updating tenant_assets.public_url is not enough: the stored URLs in
 *   adaptive_blocks must be rewritten too. This script does both.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   - Dry-run by default. Pass --apply to write.
 *   - Startup R2 self-test (put -> get -> delete a probe object) before any row
 *     is touched. This is a safety gate; also confirm R2 via the admin route
 *     /api/admin/integrations/storage/test (provider cloudflare_r2) first.
 *   - Per asset round-trip: download from the current backend, upload to R2, then
 *     re-download from R2 and compare bytes BEFORE any DB write. A mismatch skips
 *     the asset (nothing written for it).
 *   - Non-destructive: Supabase originals are kept unless --delete-originals.
 *   - Idempotent: only rows with storage_backend <> 'cloudflare_r2' are processed.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/migrate-assets-to-r2.ts                 # dry-run
 *   ... npx tsx scripts/migrate-assets-to-r2.ts --apply        # write (keep originals)
 *   ... npx tsx scripts/migrate-assets-to-r2.ts --apply --delete-originals
 *
 *   R2 credentials are read from platform_settings.storage.cloudflareR2 in the
 *   target database. NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY come
 *   from .env.local or the shell; point them at the environment you migrate.
 */

import * as path   from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Shell overrides win over .env.local so an inline `VAR=... npx tsx ...` (prod
// creds) is never swapped back to the file's dev values.
const _shell = {
  url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
  key: process.env["SUPABASE_SERVICE_ROLE_KEY"],
};
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
if (_shell.url) process.env["NEXT_PUBLIC_SUPABASE_URL"] = _shell.url;
if (_shell.key) process.env["SUPABASE_SERVICE_ROLE_KEY"] = _shell.key;

const APPLY            = process.argv.includes("--apply");
const DELETE_ORIGINALS = process.argv.includes("--delete-originals");
const SUPA_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPA_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

function abort(msg: string): never {
  console.error(`\n❌  ${msg}`);
  process.exit(1);
}

if (!SUPA_URL || !SUPA_KEY) {
  abort("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local or shell).");
}
try { console.log(`Target database : ${new URL(SUPA_URL).host}`); }
catch { console.log(`Target database : ${SUPA_URL}`); }
console.log(`Service-role key: ${SUPA_KEY.length} chars, ends …${SUPA_KEY.slice(-4)}`);
console.log("");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

interface R2Config {
  accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string; publicUrl: string;
}

async function loadR2Config(): Promise<R2Config> {
  const { data, error } = await db.from("platform_settings").select("value").eq("key", "storage").maybeSingle();
  if (error) abort(`read platform_settings.storage: ${error.message}`);
  const r2 = data?.value?.cloudflareR2 ?? {};
  const cfg: R2Config = {
    accountId:       r2.accountId       ?? process.env["R2_ACCOUNT_ID"]        ?? "",
    accessKeyId:     r2.accessKeyId     ?? process.env["R2_ACCESS_KEY_ID"]     ?? "",
    secretAccessKey: r2.secretAccessKey ?? process.env["R2_SECRET_ACCESS_KEY"] ?? "",
    bucketName:      r2.bucketName      ?? process.env["R2_BUCKET_NAME"]       ?? "",
    publicUrl:       r2.publicUrl       ?? process.env["R2_PUBLIC_URL"]        ?? "",
  };
  for (const [k, v] of Object.entries(cfg)) {
    if (!v) abort(`R2 config is incomplete: missing ${k}. Configure it under Admin > Platform > Storage.`);
  }
  return cfg;
}

function makeClient(cfg: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function streamToBuffer(body: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function r2SelfTest(client: S3Client, cfg: R2Config): Promise<void> {
  const key = `__mc_probe/${Date.now()}.txt`;
  const payload = Buffer.from("mc-r2-probe");
  try {
    await client.send(new PutObjectCommand({ Bucket: cfg.bucketName, Key: key, Body: payload, ContentType: "text/plain" }));
    const got = await client.send(new GetObjectCommand({ Bucket: cfg.bucketName, Key: key }));
    const back = await streamToBuffer(got.Body);
    if (!back.equals(payload)) abort("R2 self-test round-trip mismatch. Aborting before touching any asset.");
    await client.send(new DeleteObjectCommand({ Bucket: cfg.bucketName, Key: key }));
  } catch (err) {
    abort(`R2 self-test failed (credentials/bucket/endpoint): ${String(err)}`);
  }
}

interface AssetRow {
  id: string; tenant_id: string | null; storage_path: string; public_url: string;
  mime_type: string | null; file_size: number | null; storage_backend: string; provider_bucket: string | null;
}

async function rewriteReferences(oldUrl: string, newUrl: string): Promise<number> {
  // Content hardcodes public URLs (confirmed in adaptive_blocks). Rewrite the
  // exact old -> new URL in default_variant / adaptive_variants JSON. Read all
  // blocks (small table) and update only those that contain the old URL.
  const { data, error } = await db.from("adaptive_blocks").select("id, default_variant, adaptive_variants");
  if (error) abort(`read adaptive_blocks: ${error.message}`);
  let touched = 0;
  for (const b of (data ?? []) as Array<{ id: string; default_variant: unknown; adaptive_variants: unknown }>) {
    const dv = JSON.stringify(b.default_variant ?? null);
    const av = JSON.stringify(b.adaptive_variants ?? null);
    if (!dv.includes(oldUrl) && !av.includes(oldUrl)) continue;
    touched++;
    if (!APPLY) continue;
    const patch: Record<string, unknown> = {};
    if (dv.includes(oldUrl)) patch.default_variant   = JSON.parse(dv.split(oldUrl).join(newUrl));
    if (av.includes(oldUrl)) patch.adaptive_variants = JSON.parse(av.split(oldUrl).join(newUrl));
    const { error: uErr } = await db.from("adaptive_blocks").update(patch).eq("id", b.id);
    if (uErr) abort(`rewrite adaptive_blocks ${b.id}: ${uErr.message}`);
  }
  return touched;
}

async function run(): Promise<void> {
  console.log(APPLY ? "APPLY mode — changes WILL be written." : "DRY-RUN — no changes written (pass --apply to write).");
  console.log(DELETE_ORIGINALS ? "Originals: WILL be deleted after migration.\n" : "Originals: kept (pass --delete-originals to remove).\n");

  const cfg = await loadR2Config();
  console.log(`R2 bucket       : ${cfg.bucketName}`);
  console.log(`R2 public URL   : ${cfg.publicUrl}\n`);
  const client = makeClient(cfg);
  await r2SelfTest(client, cfg);
  console.log("R2 self-test    : ok\n");

  const { data, error } = await db
    .from("tenant_assets")
    .select("id, tenant_id, storage_path, public_url, mime_type, file_size, storage_backend, provider_bucket")
    .neq("storage_backend", "cloudflare_r2");
  if (error) abort(`read tenant_assets: ${error.message}`);
  const assets = (data ?? []) as AssetRow[];

  let migrated = 0, skipped = 0, refsRewritten = 0, deleted = 0;

  for (const a of assets) {
    const label = `${a.storage_path}`;
    try {
      // 1. Download from the current backend.
      const res = await fetch(a.public_url);
      if (!res.ok) { console.error(`  ⚠️  ${label}: source fetch ${res.status} — SKIPPED.`); skipped++; continue; }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (a.file_size != null && bytes.length !== a.file_size) {
        console.error(`  ⚠️  ${label}: downloaded ${bytes.length}B != recorded ${a.file_size}B — SKIPPED.`); skipped++; continue;
      }

      // 2. Upload to R2 under the same key, then round-trip verify.
      const key = a.storage_path;
      if (APPLY) {
        await client.send(new PutObjectCommand({
          Bucket: cfg.bucketName, Key: key, Body: bytes,
          ContentType: a.mime_type ?? "application/octet-stream",
          CacheControl: "public, max-age=31536000, immutable",
        }));
        const got  = await client.send(new GetObjectCommand({ Bucket: cfg.bucketName, Key: key }));
        const back = await streamToBuffer(got.Body);
        if (!back.equals(bytes)) { console.error(`  ⚠️  ${label}: R2 round-trip mismatch — SKIPPED (no DB change).`); skipped++; continue; }
      }

      const newUrl = `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;

      // 3. Update tenant_assets, then rewrite the hardcoded references.
      if (APPLY) {
        const { error: uErr } = await db.from("tenant_assets")
          .update({ storage_backend: "cloudflare_r2", provider_bucket: cfg.bucketName, public_url: newUrl })
          .eq("id", a.id);
        if (uErr) { console.error(`  ⚠️  ${label}: tenant_assets update failed (${uErr.message}) — SKIPPED.`); skipped++; continue; }
      }
      const refs = await rewriteReferences(a.public_url, newUrl);
      refsRewritten += refs;

      // 4. Optionally delete the Supabase original (off by default).
      if (APPLY && DELETE_ORIGINALS && a.storage_backend === "supabase_storage" && a.provider_bucket) {
        const { error: dErr } = await db.storage.from(a.provider_bucket).remove([a.storage_path]);
        if (dErr) console.error(`  ⚠️  ${label}: original delete failed (${dErr.message}) — left in place.`);
        else deleted++;
      }

      migrated++;
      console.log(`  ${label}: ${a.storage_backend} -> cloudflare_r2${refs ? ` (+${refs} block ref${refs === 1 ? "" : "s"})` : ""}${APPLY ? "" : " [dry-run]"}`);
    } catch (err) {
      console.error(`  ⚠️  ${label}: ${String(err)} — SKIPPED.`); skipped++;
    }
  }

  console.log(`\nScanned ${assets.length} non-R2 asset(s). ${migrated} ${APPLY ? "migrated" : "would migrate"}, ${skipped} skipped, ${refsRewritten} block reference(s) ${APPLY ? "rewritten" : "would rewrite"}${DELETE_ORIGINALS ? `, ${deleted} original(s) deleted` : ""}.`);
  if (!APPLY && migrated > 0) console.log("Re-run with --apply to write the changes.");
  if (assets.length === 0) console.log("Nothing to do — every asset is already on R2.");
}

run().catch((err) => abort(String(err)));
