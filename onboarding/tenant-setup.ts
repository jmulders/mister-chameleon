/**
 * Tenant Setup via Onboarding
 *
 * A lightweight intake input shape, validation layer, and projection helper
 * that converts the decisions made at client intake into a valid TenantSettings
 * object with sensible, package-derived defaults.
 *
 * ─── What this is and what it is not ─────────────────────────────────────────
 *
 *   IS:   A quick-start path for producing the initial TenantSettings from the
 *         five questions asked during client intake.  Designed to be called by
 *         a future onboarding UI (or manually during an admin workflow) to
 *         bootstrap a new tenant record in the store.
 *
 *   IS NOT: A replacement for ImplementationTemplate (onboarding/implementation-
 *           template.ts), which is the full internal setup specification.
 *           OnboardingInput answers the five intake questions; ImplementationTemplate
 *           answers every technical setup question (CMS credentials, env vars,
 *           hostnames, analytics, variant config, etc.).
 *
 * ─── Input → TenantSettings mapping ─────────────────────────────────────────
 *
 *   OnboardingInput field    TenantSettings field
 *   ─────────────────────    ────────────────────────────────────────────────
 *   tenantId                 tenantId
 *   packageKey               packageKey
 *   cmsProvider              cms.provider
 *   themePreset              design.theme  (validated against pkg.allowedThemes)
 *   ─────────────────────    package-derived ─────────────────────────────────
 *   (packageKey)             features      ← pkg.allowedFeatures
 *   (packageKey)             blocks        ← pkg.allowedBlocks
 *   ─────────────────────    safe defaults ───────────────────────────────────
 *   (always)                 ai.mode = "disabled"
 *
 *   tenantName is display-only — used for admin labels and the ImplementationTemplate
 *   name field.  It does not appear in TenantSettings.
 *
 *   websiteUrl is captured for downstream use (canonicalHostname in TenantConfig,
 *   resolve-tenant.ts registration) but does not appear in TenantSettings.
 *   Use canonicalHostnameFromInput() to extract a clean hostname from it.
 *
 * ─── Validation behaviour ─────────────────────────────────────────────────────
 *
 *   validateOnboardingInput() returns a result object rather than throwing.
 *   It distinguishes blocking issues (prevent conversion) from warnings
 *   (conversion proceeds with a safe default substituted).
 *
 *   onboardingInputToTenantSettings() calls validateOnboardingInput() internally.
 *   Blocking issues throw OnboardingInputError.
 *   Non-blocking issues (e.g. theme not available on package) are resolved silently
 *   by substituting "default".  Call validateOnboardingInput() first if you want
 *   to surface warnings in a UI.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   onboarding/tenant-setup.ts   ← YOU ARE HERE
 *   onboarding/types.ts          ← onboarding flow/step type definitions
 *   onboarding/flow.ts           ← STANDARD_ONBOARDING_FLOW step definitions
 *   onboarding/implementation-template.ts  ← full internal setup specification
 *   onboarding/index.ts          ← barrel re-export
 */

import type {
  TenantSettings,
  PackageKey,
  CMSProviderName,
  ThemeKey,
  TenantAiSettings,
  TenantCmsSettings,
  TenantDesignSettings,
} from "@/tenant/types";

import { getPackageDefinition }   from "@/tenant/packages";
import { getPackageSeedDefaults }  from "@/tenant/package-defaults";
import { getThemeLayoutProfile }   from "@/design-system/theme/layout-profiles";
import type { ContextBlockKey }    from "@/tenant/types";

// ─────────────────────────────────────────────────────────────────────────────
// INPUT SHAPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The minimum set of decisions made at client intake that can be converted
 * directly to a valid TenantSettings object.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   tenantId
 *     Stable, URL-safe, lowercase slug for this tenant.
 *     Convention: kebab-case, max 32 characters, starts with a letter.
 *     Example: "acme-corp", "bluefin-ai", "delta-growth"
 *     Must be unique across all tenants.  Once live, changing this requires
 *     a data migration — choose carefully at intake.
 *     Maps to: TenantSettings.tenantId
 *
 *   tenantName
 *     Human-readable display name shown in admin UIs and log annotations.
 *     Example: "Acme Corp", "Bluefin AI", "Delta Growth"
 *     Maps to: display only — not stored in TenantSettings.
 *     Used for ImplementationTemplate.name when building the full spec.
 *
 *   websiteUrl
 *     The client's primary website hostname or full URL.
 *     Accepts with or without protocol: "acme.com" or "https://acme.com".
 *     Maps to: not stored in TenantSettings.
 *     Use canonicalHostnameFromInput() to extract a clean hostname for
 *     canonicalHostname in TenantConfig and resolve-tenant.ts registration.
 *
 *   packageKey
 *     Which subscription tier the client has agreed to at intake.
 *     Drives features, block entitlements, allowedThemes, and limits.
 *     Maps to: TenantSettings.packageKey + derived features + derived blocks.
 *
 *   cmsProvider
 *     Which CMS backend the client will use for adaptive variant content.
 *     "mock" is acceptable during onboarding before the CMS is provisioned.
 *     Maps to: TenantSettings.cms.provider
 *
 *   themePreset
 *     Which named design preset to apply.
 *     Must be in the package's allowedThemes — if not, "default" is substituted.
 *     "custom" requires the pro package.
 *     Maps to: TenantSettings.design.theme (after validation)
 */
export interface OnboardingInput {
  readonly tenantId:    string;
  readonly tenantName:  string;
  readonly websiteUrl:  string;
  readonly packageKey:  PackageKey;
  readonly cmsProvider: CMSProviderName;
  readonly themePreset: ThemeKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single validation message with field context.
 *
 * blocking:true  → must be resolved before conversion to TenantSettings.
 * blocking:false → warning; conversion proceeds with a safe default substituted.
 */
export interface OnboardingValidationIssue {
  /** The OnboardingInput field this issue relates to. */
  readonly field: keyof OnboardingInput;
  /** Human-readable description of the issue. */
  readonly message: string;
  /**
   * Whether this issue prevents conversion to TenantSettings.
   *
   * true  → onboardingInputToTenantSettings() will throw OnboardingInputError.
   * false → conversion proceeds; a safe default is substituted automatically.
   */
  readonly blocking: boolean;
}

/**
 * Result of validateOnboardingInput().
 *
 * valid:true  → no blocking issues; the input can be converted to TenantSettings.
 * valid:false → at least one blocking issue; conversion will throw OnboardingInputError.
 *
 * Non-blocking issues (warnings) appear in issues[] regardless of the valid flag.
 * Display them to the operator — they indicate a substitution was made.
 */
export type OnboardingValidationResult =
  | { readonly valid: true;  readonly issues: readonly OnboardingValidationIssue[] }
  | { readonly valid: false; readonly issues: readonly OnboardingValidationIssue[] };

/**
 * Thrown by onboardingInputToTenantSettings() when the input has blocking
 * validation issues.
 *
 * Call validateOnboardingInput() first to surface issues without throwing.
 */
export class OnboardingInputError extends Error {
  public readonly issues: readonly OnboardingValidationIssue[];

  constructor(issues: readonly OnboardingValidationIssue[]) {
    const blocking = issues.filter((i) => i.blocking);
    const lines = blocking.map((i) => `  ${i.field}: ${i.message}`);
    super(`OnboardingInput has ${blocking.length} blocking issue(s):\n${lines.join("\n")}`);
    this.name = "OnboardingInputError";
    this.issues = issues;
  }
}

// ── Validation helpers ─────────────────────────────────────────────────────────

/**
 * Pattern for a valid tenant ID slug.
 *
 * Rules:
 *   • Starts with a lowercase letter (not a digit or hyphen).
 *   • Contains only lowercase letters, digits, and hyphens.
 *   • Maximum 32 characters total.
 *
 * Rationale for max 32: tenant IDs appear in log lines, analytics events,
 * and file paths; keeping them short makes tooling output readable.
 */
const TENANT_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * Strips the protocol and any path/query suffix from a URL or hostname string.
 *
 * "https://acme.com/about?x=1" → "acme.com"
 * "acme.com"                    → "acme.com"
 * "www.acme.co.uk"              → "www.acme.co.uk"
 */
function stripToHostname(raw: string): string {
  return raw
    .replace(/^https?:\/\//i, "")  // strip protocol
    .replace(/[/?#].*$/, "");       // strip path, query, fragment
}

/**
 * Returns true when the value resolves to a plausible public hostname.
 *
 * Accepts:
 *   • "acme.com" — bare hostname
 *   • "https://www.acme.co.uk" — full URL
 *   • "staging.acme.com" — subdomain
 *
 * Rejects:
 *   • "" — empty
 *   • "localhost" — no dot
 *   • "http://" — no hostname
 *   • "acme com" — spaces
 */
function isPlausibleHostname(raw: string): boolean {
  const h = stripToHostname(raw);
  // Must have at least one dot, no spaces, reasonable hostname chars
  return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(h);
}

/**
 * Validates an OnboardingInput and returns a structured result.
 *
 * Blocking issues prevent conversion to TenantSettings and must be corrected.
 * Non-blocking issues (warnings) indicate a safe default will be substituted —
 * the operator should be informed but conversion can proceed.
 *
 * @example
 * const result = validateOnboardingInput(input);
 * if (!result.valid) {
 *   result.issues
 *     .filter(i => i.blocking)
 *     .forEach(i => console.error(`[${i.field}] ${i.message}`));
 * }
 * // Show warnings regardless
 * result.issues
 *   .filter(i => !i.blocking)
 *   .forEach(i => console.warn(`[${i.field}] ${i.message}`));
 */
export function validateOnboardingInput(
  input: OnboardingInput,
): OnboardingValidationResult {
  const issues: OnboardingValidationIssue[] = [];

  // ── tenantId ───────────────────────────────────────────────────────────────
  if (!TENANT_ID_PATTERN.test(input.tenantId)) {
    issues.push({
      field:    "tenantId",
      message:
        "Must start with a lowercase letter, contain only lowercase letters, " +
        "digits, and hyphens, and be at most 32 characters. " +
        "Example: \"acme-corp\".",
      blocking: true,
    });
  }

  // ── tenantName ─────────────────────────────────────────────────────────────
  if (!input.tenantName.trim()) {
    issues.push({
      field:    "tenantName",
      message:  "Tenant name must not be empty.",
      blocking: true,
    });
  }

  // ── websiteUrl ─────────────────────────────────────────────────────────────
  //
  // Non-blocking: a bad URL doesn't prevent TenantSettings from being produced.
  // The operator must fix it before registering the hostname in resolve-tenant.ts,
  // but blocking intake over a URL typo is unnecessarily aggressive.
  //
  if (!input.websiteUrl.trim()) {
    issues.push({
      field:    "websiteUrl",
      message:  "Website URL must not be empty.",
      blocking: false,
    });
  } else if (!isPlausibleHostname(input.websiteUrl)) {
    issues.push({
      field:    "websiteUrl",
      message:
        "Must be a valid hostname or URL. " +
        "Examples: \"acme.com\" or \"https://www.acme.com\".",
      blocking: false,
    });
  }

  // ── themePreset vs package ─────────────────────────────────────────────────
  //
  // Non-blocking: if the requested theme is not permitted by the package, the
  // factory substitutes "default" automatically.  The warning here tells the
  // operator what happened so they can adjust the package or theme selection.
  //
  const pkg = getPackageDefinition(input.packageKey);
  if (!(pkg.allowedThemes as readonly string[]).includes(input.themePreset)) {
    issues.push({
      field:    "themePreset",
      message:
        `Theme "${input.themePreset}" is not available on the ${pkg.displayName} package. ` +
        `Allowed themes: ${pkg.allowedThemes.join(", ")}. ` +
        `"default" will be used.`,
      blocking: false,
    });
  }

  const hasBlocking = issues.some((i) => i.blocking);
  return hasBlocking
    ? { valid: false, issues }
    : { valid: true,  issues };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The AI settings applied to every new tenant at onboarding.
 *
 * AI is always disabled at intake — even on Pro.  The AI decision layer
 * requires a configured confidence policy and a wired AiDecisionProvider
 * subclass before it is safe to enable.  The operator activates it via the
 * admin panel post-setup once those prerequisites are in place.
 *
 * Used internally by getPackageSeedDefaults() and exported for consumers
 * that need to reference or display the constant directly.
 */
export const DEFAULT_ONBOARDING_AI_SETTINGS: TenantAiSettings = {
  mode: "disabled",
};

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY: OnboardingInput → TenantSettings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Projects an OnboardingInput into a valid TenantSettings object.
 *
 * ─── What the factory does ────────────────────────────────────────────────────
 *
 *   1. Validates the input (blocking issues throw OnboardingInputError).
 *   2. Resolves the package definition for the requested packageKey.
 *   3. Derives features and blocks directly from the package — no manual config.
 *   4. Validates the themePreset against the package's allowedThemes.
 *      If not permitted, "default" is substituted silently.
 *   5. Sets ai.mode = "disabled" unconditionally.
 *   6. Sets cms.provider from the input.
 *   7. Returns a complete TenantSettings ready for the tenant store.
 *
 * ─── What to do next ─────────────────────────────────────────────────────────
 *
 *   Pass the returned TenantSettings to saveTenant() (tenant/tenant-store.ts)
 *   to persist it.  The store's enforcement layer will validate that all fields
 *   are within the package entitlements.
 *
 *   Build the full ImplementationTemplate separately (onboarding/implementation-
 *   template.ts) to capture CMS credentials, env vars, hostname registration,
 *   analytics config, and variant setup.
 *
 * @throws {OnboardingInputError} when the input has blocking validation issues.
 *
 * @example
 * const settings = onboardingInputToTenantSettings({
 *   tenantId:    "acme-corp",
 *   tenantName:  "Acme Corp",
 *   websiteUrl:  "acme.com",
 *   packageKey:  "growth",
 *   cmsProvider: "sanity",
 *   themePreset: "minimal",
 * });
 *
 * settings.tenantId                   // "acme-corp"
 * settings.packageKey                 // "growth"
 * settings.features.analytics        // true  (Growth includes analytics)
 * settings.features.experiments       // false (off by default; operator enables when ready)
 * settings.features.ai                // false (not available on Growth)
 * settings.blocks.context             // ["hero", "proof", "cta"]
 * settings.blocks.content             // ["textSection", "featureGrid", "faqSection"]
 * settings.design.theme               // "minimal"
 * settings.ai.mode                    // "disabled"
 * settings.cms.provider               // "sanity"
 */
export function onboardingInputToTenantSettings(
  input: OnboardingInput,
): TenantSettings {
  const result = validateOnboardingInput(input);
  if (!result.valid) {
    throw new OnboardingInputError(result.issues);
  }

  const pkg = getPackageDefinition(input.packageKey);

  // Resolve theme — substitute "default" when the preset is not in allowedThemes.
  const resolvedTheme: ThemeKey = (pkg.allowedThemes as readonly string[]).includes(
    input.themePreset,
  )
    ? input.themePreset
    : "default";

  // Seed conservative feature flags, block entitlements, and AI defaults from
  // the package definition.  getPackageSeedDefaults() is the single source of
  // truth for the starting state of a new tenant — see tenant/package-defaults.ts
  // for the full rationale behind each value.
  //
  // Key conservative choices:
  //   features.analytics    — true  (immediate; no setup required)
  //   features.experiments  — false (off until an experiment record exists)
  //   features.ai           — false (off until provider + policy are configured)
  //   blocks.context        — filtered by the theme's layout profile (see below)
  //   blocks.content        — all allowed content blocks enabled by default
  //   ai.mode               — "disabled" (operator activates post-setup)
  const { features, blocks: packageBlocks, ai } = getPackageSeedDefaults(input.packageKey);

  // Apply the theme's layout profile to the context block set.
  //
  // The layout profile declares which adaptive context blocks make sense for
  // the selected theme (e.g. "corporate-standard" skips the notification bar).
  // We intersect this with the package-allowed set so the package remains the
  // ceiling — a theme profile can never grant blocks the package doesn't allow.
  //
  // Operators can still enable additional blocks after creation via the admin.
  const layoutProfile = getThemeLayoutProfile(resolvedTheme);
  const profileBlockSet = new Set<string>(layoutProfile.contextBlocks);

  const blocks = {
    ...packageBlocks,
    context: packageBlocks.context.filter(
      (key) => profileBlockSet.has(key),
    ) as readonly ContextBlockKey[],
  };

  // CMS provider from input; credentials are set during technical setup.
  const cms: TenantCmsSettings = {
    provider: input.cmsProvider,
  };

  // Design from validated theme preset.
  const design: TenantDesignSettings = {
    theme: resolvedTheme,
  };

  return {
    tenantId:   input.tenantId,
    packageKey: input.packageKey,
    features,
    blocks,
    ai,
    cms,
    design,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: websiteUrl → canonical hostname
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts a clean canonical hostname from the websiteUrl field of an
 * OnboardingInput.
 *
 * Strips the protocol prefix and any path, query, or fragment component.
 * The result is suitable for use as canonicalHostname in TenantConfig and
 * for registration in the TENANT_REGISTRY in resolve-tenant.ts.
 *
 * @example
 * canonicalHostnameFromInput({ websiteUrl: "https://acme.com/about?ref=x" })
 * // → "acme.com"
 *
 * canonicalHostnameFromInput({ websiteUrl: "acme.com" })
 * // → "acme.com"
 *
 * canonicalHostnameFromInput({ websiteUrl: "www.acme.co.uk" })
 * // → "www.acme.co.uk"
 */
export function canonicalHostnameFromInput(
  input: Pick<OnboardingInput, "websiteUrl">,
): string {
  return stripToHostname(input.websiteUrl);
}
