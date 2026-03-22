/**
 * Admin — Tenant Creation Server Actions
 *
 * Server actions for creating new tenants from the onboarding flow.
 * These are the list-level actions for the /admin/tenants route; detail-level
 * actions (save, update) live at app/admin/tenants/[tenantId]/actions.ts.
 *
 * ─── Action ───────────────────────────────────────────────────────────────────
 *
 *   createTenantFromOnboardingAction(input)
 *     Accepts an OnboardingInput (the five intake fields), validates it,
 *     checks uniqueness, projects to TenantSettings, persists via createTenant(),
 *     and returns a typed result.
 *
 * ─── Result type ──────────────────────────────────────────────────────────────
 *
 *   CreateTenantResult is a discriminated union:
 *
 *     ok: true
 *       tenant    — the saved, package-enforced TenantSettings
 *       warnings  — non-empty when the package enforcer or theme substitution
 *                   adjusted a field (e.g. theme not available on package)
 *
 *     ok: false
 *       error       — human-readable summary for a general error banner
 *       fieldErrors — optional map of OnboardingInput field → message, for
 *                     wiring directly into a form's field-level error display
 *
 * ─── Validation pipeline ──────────────────────────────────────────────────────
 *
 *   1. validateOnboardingInput()  — checks slug format, non-empty name, URL shape,
 *                                   and theme availability on the chosen package.
 *                                   Blocking issues → fieldErrors returned.
 *                                   Non-blocking warnings → folded into success warnings.
 *
 *   2. Uniqueness check           — getTenantById() guards against duplicate IDs.
 *                                   Returns fieldErrors.tenantId when taken.
 *
 *   3. onboardingInputToTenantSettings()  — projects validated input to TenantSettings
 *                                          with package-derived defaults.
 *
 *   4. createTenant()             — structural validation + package enforcement +
 *                                   insert-only write.  Any remaining store errors
 *                                   (e.g. I/O failure) surface as a general error.
 *
 * ─── Cache invalidation ───────────────────────────────────────────────────────
 *
 *   On success, revalidatePath("/admin/tenants") is called so the tenant list
 *   page reflects the new record immediately on next load.
 *   The new tenant's detail path is also pre-invalidated so navigating to it
 *   serves a fresh Server Component render rather than a 404 cache hit.
 */

"use server";

import { revalidatePath } from "next/cache";

import type { OnboardingInput } from "@/onboarding";
import {
  validateOnboardingInput,
  onboardingInputToTenantSettings,
  OnboardingInputError,
} from "@/onboarding";

import type { TenantSettings } from "@/tenant/server";
import { getTenantById, createTenant } from "@/tenant/server";

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The discriminated result returned by createTenantFromOnboardingAction().
 *
 * ─── Success (ok: true) ───────────────────────────────────────────────────────
 *
 *   tenant    The saved, package-enforced TenantSettings that was written to
 *             the store.  This is the authoritative post-enforcement record,
 *             which may differ from the input if the package enforcer adjusted
 *             any values (e.g. capped a feature not permitted on the chosen tier).
 *
 *   warnings  Present and non-empty when the onboarding validation or package
 *             enforcement adjusted something automatically.  Examples:
 *               • "Theme 'bold' is not available on the Starter package. 'default' will be used."
 *               • "features.ai reset to false — not permitted on the Starter package."
 *             Surface these as non-blocking notices in the UI — the tenant was
 *             saved successfully, but the operator should review the adjustments.
 *
 * ─── Failure (ok: false) ──────────────────────────────────────────────────────
 *
 *   error       A human-readable summary suitable for a general error banner.
 *               Always present.
 *
 *   fieldErrors An optional map of OnboardingInput field names to field-level
 *               error messages.  Present when the failure is traceable to
 *               specific input fields (validation errors, duplicate ID).
 *               Wire these directly into a form's field-level error display.
 *               Absent for infrastructure errors (I/O failure, store corruption).
 */
export type CreateTenantResult =
  | {
      ok:       true;
      tenant:   TenantSettings;
      warnings?: string[];
    }
  | {
      ok:          false;
      error:       string;
      fieldErrors?: Partial<Record<keyof OnboardingInput, string>>;
    };

// ─────────────────────────────────────────────────────────────────────────────
// ACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new tenant from an OnboardingInput.
 *
 * ─── Happy path ───────────────────────────────────────────────────────────────
 *
 *   1. Validate the input (blocking issues → fieldErrors + early return).
 *   2. Check uniqueness (duplicate tenantId → fieldErrors + early return).
 *   3. Project to TenantSettings with package-derived defaults.
 *   4. Persist via createTenant() (structural validation + enforcement + write).
 *   5. Revalidate /admin/tenants and /admin/tenants/<new-id>.
 *   6. Return { ok: true, tenant, warnings? }.
 *
 * ─── Error path ───────────────────────────────────────────────────────────────
 *
 *   Validation failures    → { ok: false, error, fieldErrors }
 *   Duplicate ID           → { ok: false, error, fieldErrors: { tenantId } }
 *   Store / I/O failure    → { ok: false, error }   (no fieldErrors)
 *
 * @param input  The five onboarding intake fields.
 * @returns      CreateTenantResult — branch on `ok` to handle success/failure.
 *
 * @example
 * const result = await createTenantFromOnboardingAction({
 *   tenantId:    "acme-corp",
 *   tenantName:  "Acme Corp",
 *   websiteUrl:  "acme.com",
 *   packageKey:  "growth",
 *   cmsProvider: "sanity",
 *   themePreset: "minimal",
 * });
 *
 * if (!result.ok) {
 *   console.error(result.error);
 *   // result.fieldErrors?.tenantId → "acme-corp is already taken."
 *   return;
 * }
 *
 * console.log("Created:", result.tenant.tenantId);
 * if (result.warnings?.length) {
 *   console.warn("Adjusted settings:", result.warnings);
 * }
 */
export async function createTenantFromOnboardingAction(
  input: OnboardingInput,
): Promise<CreateTenantResult> {

  // ── Step 1: validate the onboarding input ───────────────────────────────────
  const validation = validateOnboardingInput(input);

  if (!validation.valid) {
    // Map blocking issues to a field-keyed error object for form display.
    const fieldErrors: Partial<Record<keyof OnboardingInput, string>> = {};
    for (const issue of validation.issues.filter((i) => i.blocking)) {
      // Keep the first error per field — most common case is one error per field.
      if (!fieldErrors[issue.field]) {
        fieldErrors[issue.field] = issue.message;
      }
    }

    return {
      ok:          false,
      error:       "Please fix the errors below before creating the tenant.",
      fieldErrors,
    };
  }

  // Capture non-blocking warnings to forward in the success result.
  // These indicate that a safe default was substituted (e.g. theme downgraded).
  const setupWarnings = validation.issues
    .filter((i) => !i.blocking)
    .map((i) => `[${i.field}] ${i.message}`);

  // ── Step 2: uniqueness check ─────────────────────────────────────────────────
  // Check before hitting the full store pipeline so we can return a specific
  // fieldErrors.tenantId message rather than a generic store error string.
  try {
    const existing = await getTenantById(input.tenantId);
    if (existing) {
      return {
        ok:    false,
        error: `A tenant with the ID "${input.tenantId}" already exists.`,
        fieldErrors: {
          tenantId: `"${input.tenantId}" is already taken. Choose a different slug.`,
        },
      };
    }
  } catch (err) {
    // Store read failure — surface as a general error; don't proceed.
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok:    false,
      error: `Unable to check for duplicate tenant IDs: ${message}`,
    };
  }

  // ── Step 3: project to TenantSettings ───────────────────────────────────────
  // validateOnboardingInput() passed, so this should not throw.
  // Wrap defensively to surface any unexpected projection errors clearly.
  let settings: TenantSettings;
  try {
    settings = onboardingInputToTenantSettings(input);
  } catch (err) {
    if (err instanceof OnboardingInputError) {
      // Shouldn't happen after a passing validateOnboardingInput(), but handle.
      const fieldErrors: Partial<Record<keyof OnboardingInput, string>> = {};
      for (const issue of err.issues.filter((i) => i.blocking)) {
        if (!fieldErrors[issue.field]) {
          fieldErrors[issue.field] = issue.message;
        }
      }
      return { ok: false, error: err.message, fieldErrors };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Unexpected error building tenant settings: ${message}` };
  }

  // ── Step 4: persist via createTenant() ──────────────────────────────────────
  // createTenant applies its own structural validation and package enforcement.
  // Its uniqueness guard acts as a second safety net (race condition window).
  const result = await createTenant(settings);

  if (!result.ok) {
    // Check if the store's uniqueness guard fired (narrow race condition).
    if (result.error.includes("already exists")) {
      return {
        ok:    false,
        error: result.error,
        fieldErrors: {
          tenantId: `"${input.tenantId}" is already taken. Choose a different slug.`,
        },
      };
    }
    return { ok: false, error: result.error };
  }

  // ── Step 5: revalidate Next.js cache ────────────────────────────────────────
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${result.data.tenantId}`);

  // ── Step 6: return success ───────────────────────────────────────────────────
  // Merge setup warnings (theme substitution etc.) with enforcement warnings
  // (package enforcer clamped a field) into a single list for the UI.
  const allWarnings = [
    ...setupWarnings,
    ...(result.warnings ?? []),
  ];

  return {
    ok:     true,
    tenant: result.data,
    ...(allWarnings.length > 0 ? { warnings: allWarnings } : {}),
  };
}
