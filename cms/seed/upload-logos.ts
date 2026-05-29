/**
 * Logo Upload Utility
 *
 * Uploads the three Mister Chameleon logo SVG variants to Sanity's asset pipeline
 * and patches the siteSettings document with the resulting asset references.
 *
 * Logo variants:
 *   logo-default.svg   →  siteSettings.logo       (colour, for light/neutral backgrounds)
 *   logo-dark.svg      →  siteSettings.logoDark    (inverted/white, for dark backgrounds)
 *   logo-light.svg     →  siteSettings.logoLight   (black, for white/very-light backgrounds)
 *
 * The SVG files live in:  cms/seed/assets/
 *
 * Usage:
 *   npx tsx cms/seed/upload-logos.ts
 *   npx tsx cms/seed/upload-logos.ts --dry-run
 *
 * Required env vars (same as the main seed):
 *   SANITY_API_TOKEN
 *   NEXT_PUBLIC_SANITY_PROJECT_ID  (or SANITY_PROJECT_ID)
 *   NEXT_PUBLIC_SANITY_DATASET     (or SANITY_DATASET, default: production)
 */

import { readFileSync }         from "fs";
import { resolve, dirname }     from "path";
import { fileURLToPath }        from "url";
import { parse as parseDotenv } from "dotenv";
import { createClient }         from "@sanity/client";

// ── Constants ──────────────────────────────────────────────────────────────────

const SITE_SETTINGS_ID = "siteSettings-mister-chameleon";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ASSETS_DIR = resolve(__dirname, "assets");

const LOGO_FILES: Array<{ field: string; file: string; alt: string }> = [
  {
    field: "logo",
    file:  "logo-default.svg",
    alt:   "Mister Chameleon logo",
  },
  {
    field: "logoDark",
    file:  "logo-dark.svg",
    alt:   "Mister Chameleon logo (dark background variant)",
  },
  {
    field: "logoLight",
    file:  "logo-light.svg",
    alt:   "Mister Chameleon logo (light background variant)",
  },
];

// ── Env loading ────────────────────────────────────────────────────────────────

(function loadEnvFiles() {
  const root = resolve(__dirname, "../..");
  for (const file of [".env", ".env.local"]) {
    try {
      const vars = parseDotenv(readFileSync(resolve(root, file), "utf8"));
      for (const [k, v] of Object.entries(vars)) {
        if (!(k in process.env)) process.env[k] = v;
      }
    } catch { /* skip */ }
  }
})();

function resolveConfig() {
  const projectId = process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset   = process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  const token     = process.env.SANITY_API_TOKEN;
  if (!projectId) throw new Error("SANITY_PROJECT_ID not set.");
  if (!token)     throw new Error("SANITY_API_TOKEN not set. Needs Editor role or higher.");
  return { projectId, dataset, token };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function uploadLogos(dryRun = false): Promise<void> {
  console.log(`\n🦎  Mister Chameleon logo upload - ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  if (dryRun) {
    for (const { field, file, alt } of LOGO_FILES) {
      const path = resolve(ASSETS_DIR, file);
      const size = readFileSync(path).length;
      console.log(`   ${field.padEnd(12)}  ${file}  (${(size / 1024).toFixed(1)} KB)  alt="${alt}"`);
    }
    console.log(`\n✅  Dry run - 3 files, no changes written.\n`);
    return;
  }

  const config = resolveConfig();
  const client = createClient({ ...config, apiVersion: "2024-01-01", useCdn: false });

  const patchData: Record<string, unknown> = {};

  for (const { field, file, alt } of LOGO_FILES) {
    const filePath = resolve(ASSETS_DIR, file);
    const buffer   = readFileSync(filePath);
    console.log(`   Uploading ${field} (${file}, ${(buffer.length / 1024).toFixed(1)} KB)…`);

    try {
      const asset = await client.assets.upload("image", buffer, {
        filename:    file,
        contentType: "image/svg+xml",
      });

      patchData[field] = {
        _type:  "image",
        asset:  { _type: "reference", _ref: asset._id },
        alt,
      };

      console.log(`   ✓  ${field} → ${asset._id}`);
    } catch (err) {
      console.error(`   ✗  ${field} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  console.log(`\n   Patching ${SITE_SETTINGS_ID}…`);
  await client
    .patch(SITE_SETTINGS_ID)
    .set(patchData)
    .commit({ visibility: "async" });

  console.log(`   ✓  siteSettings patched with logo references.\n`);
  console.log(`✅  Done. Logo variants are now live in Sanity.\n`);
}

// ── CLI entry ──────────────────────────────────────────────────────────────────

const dryRun = process.argv.includes("--dry-run");
uploadLogos(dryRun).catch((err) => {
  console.error(`\n❌  Upload failed: ${err.message}\n`);
  process.exit(1);
});
