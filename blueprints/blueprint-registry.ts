/**
 * Blueprint Registry
 *
 * Central catalog of all available blueprints.  Import from here whenever
 * you need to enumerate, look up, or display blueprints.
 *
 * Adding a new blueprint:
 *   1. Create blueprints/definitions/<key>.ts
 *   2. Import and add to ALL_BLUEPRINTS below.
 */

import type { Blueprint, BlueprintIndustry } from "./blueprint-types";
import { b2bSaasBlueprint }              from "./definitions/b2b-saas";
import { accountingFirmBlueprint }       from "./definitions/accounting-firm";
import { lawFirmBlueprint }              from "./definitions/law-firm";
import { midwiferyPracticeBlueprint }    from "./definitions/midwifery-practice";
import { itServicesBlueprint }           from "./definitions/it-services";
import { marketingAgencyBlueprint }      from "./definitions/marketing-agency";
import { careersPlatformBlueprint }      from "./definitions/careers-platform";
import { darkAiSaasBlueprint }           from "./definitions/dark-ai-saas";
import { cleanCorporateSaasBlueprint }   from "./definitions/clean-corporate-saas";
import { structuredSaasBlueprint }       from "./definitions/structured-saas";

// ── Registry ──────────────────────────────────────────────────────────────────

export const ALL_BLUEPRINTS: readonly Blueprint[] = [
  // ── Premium style families (featured first) ───────────────────────────────
  darkAiSaasBlueprint,
  cleanCorporateSaasBlueprint,
  structuredSaasBlueprint,

  // ── B2B / Tech ────────────────────────────────────────────────────────────
  b2bSaasBlueprint,
  itServicesBlueprint,

  // ── Professional Services ─────────────────────────────────────────────────
  accountingFirmBlueprint,
  lawFirmBlueprint,

  // ── Lead Generation / Agency ──────────────────────────────────────────────
  marketingAgencyBlueprint,

  // ── Healthcare ────────────────────────────────────────────────────────────
  midwiferyPracticeBlueprint,

  // ── Recruitment ───────────────────────────────────────────────────────────
  careersPlatformBlueprint,
] as const;

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Find a blueprint by its key. Returns undefined if not found. */
export function findBlueprintByKey(key: string): Blueprint | undefined {
  return ALL_BLUEPRINTS.find((b) => b.key === key);
}

/** Filter blueprints by industry. */
export function getBlueprintsByIndustry(
  industry: BlueprintIndustry,
): Blueprint[] {
  return ALL_BLUEPRINTS.filter((b) => b.industry === industry);
}

/** Filter blueprints by tag. */
export function getBlueprintsByTag(tag: string): Blueprint[] {
  return ALL_BLUEPRINTS.filter((b) => b.tags?.includes(tag));
}

/** Return all available blueprint keys. */
export function getBlueprintKeys(): string[] {
  return ALL_BLUEPRINTS.map((b) => b.key);
}
