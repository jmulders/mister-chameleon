/**
 * scripts/fix-cms-projectid.ts
 *
 * One-time fix: clears cms.projectId (and cms.dataset) for tenants whose
 * stored CMS provider does not match the Sanity format.
 *
 * Background:
 *   When a tenant is switched from Sanity to Storyblok/Statamic/platform via
 *   the admin Settings form, the old Sanity projectId was not cleared.  If
 *   that value contains characters outside [a-z0-9-] (e.g. underscores or
 *   uppercase letters) the Sanity SDK throws a validation error when the CMS
 *   provider factory falls back to Sanity — even for Storyblok tenants.
 *
 *   This script reads all tenants, identifies those with a non-Sanity provider
 *   and a non-empty / invalid projectId, clears the offending field, and
 *   persists the corrected settings.
 *
 * Usage (run from the project root):
 *   npx tsx scripts/fix-cms-projectid.ts
 *   npx tsx scripts/fix-cms-projectid.ts --dry-run   # preview only, no writes
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 *   in .env.local (loaded automatically by tsx via dotenv).
 */

import * as path   from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Sanity projectId regex — only a-z, 0-9, and dashes
const SANITY_PROJECT_ID_RE = /^[-a-z0-9]+$/;

// Providers that do NOT use a per-tenant projectId (they rely on platform
// credentials or have no projectId concept at all)
const NON_SANITY_PROVIDERS = new Set(["storyblok", "statamic", "platform", "mock"]);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}fix-cms-projectid starting…\n`);

  // Fetch all tenant settings rows
  const { data: rows, error } = await db
    .from("tenant_settings")
    .select("tenant_id, settings");

  if (error) {
    console.error("Failed to fetch tenants:", error.message);
    process.exit(1);
  }

  let fixed = 0;

  for (const row of rows ?? []) {
    const tenantId: string = row.tenant_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings: any    = row.settings ?? {};
    const cms              = settings.cms ?? {};
    const provider: string = cms.provider ?? "mock";
    const projectId: string = cms.projectId ?? "";

    // Skip Sanity tenants — their projectId is intentional
    if (provider === "sanity") continue;

    // Skip tenants with no projectId stored
    if (!projectId) continue;

    // Flag if: non-Sanity provider AND projectId has Sanity-invalid chars
    const isInvalidForSanity = !SANITY_PROJECT_ID_RE.test(projectId);
    // Also clear any non-empty projectId for non-Sanity providers
    // (it has no meaning and can only cause confusion / errors)
    const shouldClear = NON_SANITY_PROVIDERS.has(provider);

    if (!shouldClear && !isInvalidForSanity) continue;

    const reason = isInvalidForSanity
      ? `projectId "${projectId}" has invalid chars for Sanity SDK`
      : `projectId "${projectId}" is unused for provider "${provider}"`;

    console.log(`  ${DRY_RUN ? "[would fix]" : "[fixing]"} ${tenantId}: ${reason}`);

    if (DRY_RUN) {
      fixed++;
      continue;
    }

    // Clear projectId, dataset, apiVersion, studioUrl for non-Sanity tenants
    const updatedCms = {
      ...cms,
      projectId:  "",
      dataset:    "",
      apiVersion: undefined,
      studioUrl:  undefined,
    };

    const updatedSettings = { ...settings, cms: updatedCms };

    const { error: updateError } = await db
      .from("tenant_settings")
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error(`  ✗ Failed to update ${tenantId}:`, updateError.message);
    } else {
      console.log(`  ✓ Fixed ${tenantId}`);
      fixed++;
    }
  }

  if (fixed === 0) {
    console.log("No tenants required fixing.");
  } else {
    console.log(`\n${DRY_RUN ? "Would fix" : "Fixed"} ${fixed} tenant(s).`);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
