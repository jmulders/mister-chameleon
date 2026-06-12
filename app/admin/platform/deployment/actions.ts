"use server";

import { rethrowNextInternal } from "@/lib/server-action-guard";

/**
 * app/admin/platform/deployment/actions.ts
 *
 * Server actions for the deployment dashboard.
 * All actions require a platform-admin session.
 */

import { createClient }            from "@supabase/supabase-js";
import { revalidatePath }          from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";

export interface ActionResult {
  ok:     boolean;
  error?: string;
  detail?: string;
}

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── seedEnrichmentPricing ─────────────────────────────────────────────────────

/**
 * Force-seed all enrichment pricing rows with canonical defaults.
 * Overwrites any rows where credit_cost = 0 (schema default, never set correctly).
 */
export async function seedEnrichmentPricingAction(): Promise<ActionResult> {
  await getRequiredAdminSession();

  try {
    const { resetToDefaultPricing } = await import(
      "@/app/admin/platform/billing/pricing/actions"
    );
    const result = await resetToDefaultPricing();
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/admin/platform/deployment");
    return { ok: true, detail: "All enrichment pricing rows reset to defaults." };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── seedPlatformVariants ──────────────────────────────────────────────────────

/**
 * Seed all shared platform variant documents into Sanity using createOrReplace.
 * Requires SANITY_API_TOKEN (write token) to be configured in env vars.
 *
 * Safe to run multiple times — idempotent via createOrReplace.
 */
export async function seedPlatformVariantsAction(): Promise<ActionResult> {
  await getRequiredAdminSession();

  const token     = process.env["SANITY_API_TOKEN"];
  const projectId = process.env["SANITY_PROJECT_ID"] ?? process.env["NEXT_PUBLIC_SANITY_PROJECT_ID"];
  const dataset   = process.env["SANITY_DATASET"] ?? process.env["NEXT_PUBLIC_SANITY_DATASET"] ?? "production";

  if (!projectId) {
    return {
      ok:    false,
      error: "SANITY_PROJECT_ID is not set. Add it to your environment variables.",
    };
  }

  if (!token) {
    return {
      ok:    false,
      error:
        "SANITY_API_TOKEN is not set. Create an Editor token at manage.sanity.io → " +
        "your project → API → Tokens, then add it to your environment variables.",
    };
  }

  try {
    const { createClient } = await import("@sanity/client");
    const { platformDocuments } = await import("@/cms/seed/platform-seed");

    const client = createClient({
      projectId,
      dataset,
      token,
      apiVersion: process.env["SANITY_API_VERSION"] ?? "2024-01-01",
      useCdn:     false,
    });

    let success = 0;
    let errors  = 0;

    for (const doc of platformDocuments) {
      try {
        await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
        success++;
      } catch {
        errors++;
      }
    }

    if (errors > 0) {
      return {
        ok:     false,
        error:  `${errors} document${errors !== 1 ? "s" : ""} failed to seed. Check server logs.`,
        detail: `${success} seeded successfully.`,
      };
    }

    revalidatePath("/admin/platform/deployment");
    return {
      ok:     true,
      detail: `${success} platform variant documents seeded successfully.`,
    };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── checkDeploymentStatus ─────────────────────────────────────────────────────

/**
 * Re-run all deployment checks and return fresh status.
 * Used by the "Refresh" button on the deployment dashboard.
 */
export async function checkDeploymentStatusAction(): Promise<ActionResult> {
  await getRequiredAdminSession();

  try {
    const db = makeClient();
    const { error } = await db.from("tenant_wallets").select("id").limit(1);
    if (error && error.code !== "42P01") {
      return { ok: false, error: `DB check failed: ${error.message}` };
    }
    revalidatePath("/admin/platform/deployment");
    return { ok: true, detail: "Status refreshed." };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
