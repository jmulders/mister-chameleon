/**
 * Tenant Readiness
 *
 * A lightweight readiness model that produces a structured checklist for a
 * freshly onboarded (or existing) tenant.  Gives an admin an instant view of
 * what is and is not yet configured before the tenant goes live.
 *
 * ─── Checks ───────────────────────────────────────────────────────────────────
 *
 *   1. Package selected            — packageKey is set (always passes post-creation)
 *   2. Primary website URL set     — websiteUrl is a plausible hostname (optional input)
 *   3. CMS provider configured     — cms.provider is not "mock" (dev placeholder)
 *   4. Theme preset selected       — design.theme is set (always passes post-creation)
 *   5. At least one context block  — blocks.context has at least one entry
 *   6. CTA block allowed           — blocks.context includes "cta"
 *
 * ─── URL check vs. TenantSettings ────────────────────────────────────────────
 *
 *   The primary website URL is captured at onboarding intake (OnboardingInput)
 *   but is NOT stored in TenantSettings.  To evaluate this check, pass the URL
 *   via ReadinessOptions.  When omitted the check is included as not-yet-verified
 *   (passed: false) with a hint directing the operator to supply it.
 *
 *   On the onboarding success panel the URL is available from the form state.
 *   On the tenant detail page it is not — the check simply shows as pending.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // With URL (e.g. onboarding success panel):
 *   const result = getTenantReadiness(tenant, { websiteUrl: "acme.com" });
 *
 *   // Without URL (e.g. tenant detail page):
 *   const result = getTenantReadiness(tenant);
 *
 *   result.allPassed        // true when every check passes
 *   result.passedCount      // e.g. 4
 *   result.totalCount       // e.g. 6
 *   result.checks           // ReadinessCheck[]
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   Pure function — no I/O, no async, no server-only imports.
 *   Safe to call from Server Components, Client Components, or tests.
 *   Checks that are always satisfied (package, theme) still appear in the
 *   list — their ✓ gives operators visual confirmation of what is set up.
 */

import type { TenantSettings, ContextBlockKey } from "@/tenant/types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single step in the readiness checklist.
 *
 *   id     — stable kebab-case identifier for programmatic use
 *   label  — short human-readable label for display
 *   passed — true when the check is satisfied
 *   hint   — what to do to pass this check; absent when already passed
 */
export interface ReadinessCheck {
  readonly id:     string;
  readonly label:  string;
  readonly passed: boolean;
  readonly hint?:  string;
}

/**
 * The complete readiness result for a tenant.
 *
 *   checks      — ordered list of ReadinessCheck items
 *   passedCount — number of checks where passed === true
 *   totalCount  — total number of checks evaluated
 *   allPassed   — true when passedCount === totalCount
 */
export interface ReadinessResult {
  readonly checks:      readonly ReadinessCheck[];
  readonly passedCount: number;
  readonly totalCount:  number;
  readonly allPassed:   boolean;
}

/**
 * Optional metadata that is not stored in TenantSettings but is needed for
 * some readiness checks.
 *
 *   websiteUrl — the tenant's primary website URL or bare hostname.
 *                Accepted with or without protocol: "acme.com" or "https://acme.com".
 *                Required by the "Primary website URL" check.
 *                Typically available from the OnboardingInput / form state at
 *                the point of creation; not available from TenantSettings alone.
 */
export interface ReadinessOptions {
  readonly websiteUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the raw string resolves to a plausible public hostname.
 *
 * Accepts a bare hostname ("acme.com") or a full URL ("https://www.acme.co.uk").
 * Rejects empty strings, strings without a dot, and strings with spaces.
 *
 * Mirrors isPlausibleHostname() from onboarding/tenant-setup.ts — duplicated
 * here to avoid a circular import between the two onboarding modules.
 */
function isPlausibleHostname(raw: string): boolean {
  const h = raw
    .replace(/^https?:\/\//i, "")  // strip protocol
    .replace(/[/?#].*$/, "");       // strip path, query, fragment

  return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(h);
}

// ─────────────────────────────────────────────────────────────────────────────
// READINESS FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the readiness checklist for a tenant.
 *
 * Produces 6 checks reflecting the operational state of a new (or existing)
 * tenant.  Checks that depend only on TenantSettings always have a definite
 * result.  The "primary website URL" check requires `opts.websiteUrl` — when
 * absent the check is included as not-yet-verified (passed: false).
 *
 * @param tenant  The tenant's stored settings.
 * @param opts    Optional metadata not stored in TenantSettings.
 * @returns       A ReadinessResult with all checks and aggregate status.
 *
 * @example
 * // On the onboarding success panel (websiteUrl available from the form):
 * const result = getTenantReadiness(tenant, { websiteUrl: "acme.com" });
 * result.allPassed   // false — CMS provider still set to mock
 * result.passedCount // 4 (of 6)
 *
 * // On the tenant detail page (websiteUrl not stored in TenantSettings):
 * const result = getTenantReadiness(tenant);
 * result.passedCount // 3 (of 6) — URL also shows as pending
 */
export function getTenantReadiness(
  tenant: TenantSettings,
  opts?:  ReadinessOptions,
): ReadinessResult {
  const checks: ReadinessCheck[] = [];

  // ── 1. Package selected ─────────────────────────────────────────────────────
  //
  // Always passes post-creation — packageKey is a required field on TenantSettings.
  // Shown explicitly so operators can confirm the correct tier at a glance.
  //
  const packagePassed = Boolean(tenant.packageKey);
  checks.push({
    id:     "package",
    label:  "Subscription package set",
    passed: packagePassed,
    hint:   packagePassed ? undefined : "Re-run onboarding and select a package tier.",
  });

  // ── 2. Primary website URL ──────────────────────────────────────────────────
  //
  // websiteUrl is not stored in TenantSettings.  Pass it via opts when available
  // (e.g. from the onboarding form).  When absent, the check fails with a hint
  // to supply the URL during the next review or by re-running onboarding.
  //
  const rawUrl      = opts?.websiteUrl?.trim() ?? "";
  const urlProvided = rawUrl.length > 0;
  const urlValid    = urlProvided && isPlausibleHostname(rawUrl);
  checks.push({
    id:     "website-url",
    label:  "Primary website URL set",
    passed: urlValid,
    hint:   urlValid
      ? undefined
      : urlProvided
        ? "The website URL is not a valid hostname. Correct it before registering the canonical hostname in resolve-tenant.ts."
        : "The primary website URL is not stored in tenant settings. Verify it and register the hostname in resolve-tenant.ts.",
  });

  // ── 3. CMS provider: not mock ───────────────────────────────────────────────
  //
  // "mock" is the dev/staging placeholder.  A production tenant should use a
  // real CMS backend (sanity, storyblok, or statamic) before going live.
  //
  const notMock = tenant.cms.provider !== "mock";
  checks.push({
    id:     "cms-provider",
    label:  "Production CMS provider selected",
    passed: notMock,
    hint:   notMock
      ? undefined
      : "Update the CMS provider from 'mock' to a production backend (Sanity, Storyblok, or Statamic), then add the project credentials in tenant settings.",
  });

  // ── 4. Theme preset selected ────────────────────────────────────────────────
  //
  // Always passes post-creation — design.theme is a required ThemeKey.
  // Shown explicitly so operators can confirm the chosen preset at a glance.
  //
  const themePassed = Boolean(tenant.design.theme);
  checks.push({
    id:     "theme-preset",
    label:  "Theme preset selected",
    passed: themePassed,
    hint:   themePassed ? undefined : "Set a theme preset in the tenant design settings.",
  });

  // ── 5. At least one context block active ────────────────────────────────────
  //
  // The decision engine can only serve variants for blocks that are in the
  // tenant's allowed context list.  At minimum one block must be active for
  // the adaptive pipeline to do any work.
  //
  const hasContextBlock = tenant.blocks.context.length > 0;
  checks.push({
    id:     "context-blocks",
    label:  "At least one adaptive block enabled",
    passed: hasContextBlock,
    hint:   hasContextBlock
      ? undefined
      : "Enable at least one context block (hero, proof, or CTA) in the tenant block settings.",
  });

  // ── 6. CTA block allowed ────────────────────────────────────────────────────
  //
  // The CTA block drives the primary conversion action on the page.
  // If it is absent from the allowed context blocks the decision engine
  // cannot serve CTA variants — a common sign of a misconfigured block list.
  //
  const ctaAllowed = (tenant.blocks.context as readonly ContextBlockKey[]).includes("cta");
  checks.push({
    id:     "cta-block",
    label:  "CTA block allowed",
    passed: ctaAllowed,
    hint:   ctaAllowed
      ? undefined
      : "Enable the CTA context block so the decision engine can serve CTA variants to visitors.",
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount  = checks.length;

  return {
    checks,
    passedCount,
    totalCount,
    allPassed: passedCount === totalCount,
  };
}
