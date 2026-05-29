/**
 * site/profile-activator.ts
 *
 * Activates the appropriate interest profiles for a tenant based on the
 * site type key selected during initialization.
 *
 * ─── Strategy ─────────────────────────────────────────────────────────────────
 *
 *   Interest profiles are stored in the `interest_profiles` table, seeded by
 *   migrations 073 / 074 with a `family` column grouping them by business domain.
 *   Profiles with `default_status = "active"` are ON by default for all tenants.
 *   Profiles with `default_status = "suggested"` are OFF and must be activated.
 *
 *   activateProfilesForSiteType():
 *     1. Maps siteTypeKey → InterestProfileFamily (e.g. "b2b_saas" → "b2b_saas").
 *     2. Loads all platform-wide profiles for the matched family.
 *     3. Activates any inactive profiles in that family (is_active = false → true).
 *     4. Returns the keys of all newly activated profiles.
 *
 *   Profiles that are already active are left unchanged.
 *   Profiles from other families are not touched.
 *
 * ─── siteTypeKey → family mapping ────────────────────────────────────────────
 *
 *   b2b_saas             → b2b_saas
 *   careers / recruitment → careers
 *   ecommerce / commerce  → commerce
 *   real_estate           → real_estate
 *
 *   Unknown site type keys produce no activations (with a warning).
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 */

import "server-only";

import {
  listAllInterestProfiles,
  updateInterestProfile,
} from "@/interest-profiles/repository";
import type { InterestProfileFamily } from "@/interest-profiles/types";

// ── siteTypeKey → family ──────────────────────────────────────────────────────

const SITE_TYPE_FAMILY_MAP: Record<string, InterestProfileFamily> = {
  b2b_saas:             "b2b_saas",
  saas:                 "b2b_saas",
  professional_services: "b2b_saas",
  lead_gen:             "b2b_saas",
  careers:              "careers",
  recruitment:          "careers",
  ecommerce:            "commerce",
  commerce:             "commerce",
  marketplace:          "commerce",
  real_estate:          "real_estate",
};

/**
 * Resolve the interest profile family for a given site type key.
 * Returns undefined when no mapping is known.
 */
export function resolveFamilyForSiteType(
  siteTypeKey: string,
): InterestProfileFamily | undefined {
  return SITE_TYPE_FAMILY_MAP[siteTypeKey.toLowerCase()];
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface ActivateProfilesResult {
  /** Keys of profiles that were activated (previously inactive). */
  activated: string[];
  /** Keys of profiles already active — left unchanged. */
  alreadyActive: string[];
  /** Non-fatal warnings. */
  warnings: string[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Activate interest profiles for the family matching `siteTypeKey`.
 *
 * Returns the keys of all activated (or already-active) profiles for that
 * family.  Never throws — errors are captured as warnings.
 */
export async function activateProfilesForSiteType(
  siteTypeKey: string,
): Promise<ActivateProfilesResult> {
  const result: ActivateProfilesResult = {
    activated:     [],
    alreadyActive: [],
    warnings:      [],
  };

  const family = resolveFamilyForSiteType(siteTypeKey);
  if (!family) {
    result.warnings.push(
      `[profile-activator] Unknown siteTypeKey "${siteTypeKey}" — no profiles activated.`,
    );
    return result;
  }

  // Load all platform-wide profiles.
  const listResult = await listAllInterestProfiles();
  if (!listResult.ok) {
    result.warnings.push(
      `[profile-activator] Failed to load profiles: ${listResult.error}`,
    );
    return result;
  }

  // Filter to the target family.
  const familyProfiles = listResult.data.filter((p) => p.family === family);

  for (const profile of familyProfiles) {
    if (profile.isActive) {
      result.alreadyActive.push(profile.key);
      continue;
    }

    // Activate this profile.
    const updateResult = await updateInterestProfile(profile.id, { is_active: true });

    if (updateResult.ok) {
      result.activated.push(profile.key);
    } else {
      result.warnings.push(
        `[profile-activator] Could not activate "${profile.key}": ${updateResult.error}`,
      );
    }
  }

  return result;
}
