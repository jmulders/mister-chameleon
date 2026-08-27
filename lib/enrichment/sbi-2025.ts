/**
 * SBI 2025 industry lookup.
 *
 * Maps a KvK SBI code (Standaard Bedrijfsindeling) to a human-readable industry
 * name in Dutch and English. Used to derive a readable industry from Leadinfo's
 * numeric `leadinfoBranchCode` so the rule webhook can forward a company industry
 * text (companyIndustryNl / companyIndustryEn) without a downstream translation
 * table.
 *
 * The data lives in data/sbi-2025.json (regenerated from the KvK Excel via
 * scripts/regen-sbi — see docs/sbi-codes-onderhoud.md). Codes are strings and
 * preserve leading zeros ("0001").
 *
 * Match on the SBI code (`leadinfoBranchCode`, e.g. "73110"), NOT on the SIC-87
 * code — SIC-87 is a different (US) taxonomy and is not present in this table.
 */

import sbiData from "@/data/sbi-2025.json";

export interface SbiIndustry {
  /** Dutch industry name. */
  nl: string;
  /** English industry name. */
  en: string;
}

/**
 * Build the code → { nl, en } map from data/sbi-2025.json.
 *
 * The committed file is a FLAT object ({ "<code>": { en, nl }, … }). This also
 * tolerates a { meta, codes } wrapper (e.g. from an alternative regen output) and
 * skips a stray meta/_meta key, so the lookup never treats metadata as a code.
 * Keys are SBI codes as strings — leading zeros are preserved ("0001").
 */
function buildLookup(json: unknown): Record<string, SbiIndustry> {
  const obj = json as Record<string, unknown>;
  const src = (obj.codes && typeof obj.codes === "object")
    ? (obj.codes as Record<string, unknown>)
    : obj;
  const out: Record<string, SbiIndustry> = {};
  for (const [key, value] of Object.entries(src)) {
    if (key === "meta" || key === "_meta") continue;
    if (value && typeof value === "object" && "en" in value && "nl" in value) {
      const v = value as { en?: unknown; nl?: unknown };
      out[key] = { nl: String(v.nl ?? ""), en: String(v.en ?? "") };
    }
  }
  return out;
}

/** The raw code → { nl, en } map. Keys are SBI codes as strings (leading zeros kept). */
export const sbiLookup: Readonly<Record<string, SbiIndustry>> = buildLookup(sbiData);

/**
 * Resolve an SBI code to its industry names, or null when the code is absent,
 * blank, or unknown. Never throws.
 *
 * The code is normalised to a trimmed string so a leading-zero code ("0001")
 * resolves correctly; unknown codes simply return null (the raw SBI code still
 * travels in the webhook, so nothing is lost).
 */
export function lookupSbiIndustry(code: string | null | undefined): SbiIndustry | null {
  if (code == null) return null;
  const key = String(code).trim();
  if (!key) return null;
  return sbiLookup[key] ?? null;
}
