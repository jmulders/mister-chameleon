/**
 * lib/enrichment/eponline-ingest.ts
 *
 * EP-Online (RVO) per-address energy-label lookup: postcode + huisnummer → the
 * building's most recent valid energy label + derived signals. Per-address API
 * (no bulk), lazy-cached like the BAG enricher. Requires EPONLINE_API_KEY in the
 * Authorization header. Pure (fetch injectable), unit-testable.
 *
 * Endpoint (v5):
 *   GET https://public.ep-online.nl/api/v5/PandEnergielabel/Adres
 *       ?postcode=3011AD&huisnummer=1[&huisletter=A&huisnummertoevoeging=bis]
 *   header: Authorization: <EPONLINE_API_KEY>
 *
 * ⚠ Licence: free EXCEPT disclosing an individual label to third parties. The raw
 * class is display-gated (tenant flag epLabelDisplayAllowed); the band + internal
 * signals are always available to rules/AI. Registrations with is_prive=true are
 * NOT in the open dataset and are skipped.
 */

const EPONLINE_ENDPOINT = "https://public.ep-online.nl/api/v5/PandEnergielabel/Adres";
const DEFAULT_TIMEOUT_MS = 6_000;

export interface EpOnlineLabel {
  energyLabel:        string | null;   // raw class, e.g. "A", "C" (display-gated)
  energyLabelBand:    string | null;   // "green" | "amber" | "red"
  energyIndex:        number | null;
  buildingClass:      string | null;   // "W" | "U"
  gebouwtype:         string | null;
  bouwjaar:           number | null;
  gebruiksoppervlakte:number | null;
  energiebehoefte:    number | null;
  aandeelHernieuwbaar:number | null;
  co2:                number | null;
  geldigTot:          string | null;   // ISO date
  isPrive:            boolean;
  bagVboId:           string | null;
}

export type EpOnlineFetchStatus = "found" | "empty" | "error";
export interface EpOnlineFetchResult {
  status: EpOnlineFetchStatus;
  data?:  EpOnlineLabel;
}

/** Resolve the platform EP-Online API key (env). Empty → the enricher no-ops. */
export function resolveEpOnlineApiKey(): string | null {
  const k = process.env.EPONLINE_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

/**
 * Map a raw energy label to a coarse band: green (A/B), amber (C/D), red (E/F/G).
 * The band is the SAFE, always-shareable aggregate for segmentation. Null-safe;
 * unknown letters → null. Handles A+/A++/… (only the leading letter matters).
 */
export function deriveLabelBand(rawLabel: string | null | undefined): string | null {
  if (!rawLabel) return null;
  const c = rawLabel.trim().charAt(0).toUpperCase();
  if (c === "A" || c === "B") return "green";
  if (c === "C" || c === "D") return "amber";
  if (c === "E" || c === "F" || c === "G") return "red";
  return null;
}

function toNum(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}
function toStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function firstOf(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Parse an EP-Online `PandEnergielabel/Adres` response → the label facts, or null
 * when no registration is present. The API returns an array (0..n); we take the
 * first (most recent valid) registration. Defensive against field-name casing.
 */
export function parseEpOnlineLabel(json: unknown): EpOnlineLabel | null {
  const rec = firstOf(json) as Record<string, unknown> | undefined;
  if (!rec || typeof rec !== "object") return null;

  // EP-Online uses PascalCase; read a couple of plausible spellings defensively.
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) if (rec[k] != null) return rec[k];
    return null;
  };

  const rawLabel = toStr(pick("Energieklasse", "energieklasse", "Labelletter", "labelletter"));
  const isPrive  = Boolean(pick("Pand_registratie_prive", "isPrive", "IsPrive") === true
                    || pick("Pand_registratie_prive", "isPrive", "IsPrive") === "true");

  const out: EpOnlineLabel = {
    energyLabel:         rawLabel,
    energyLabelBand:     deriveLabelBand(rawLabel),
    energyIndex:         toNum(pick("Energie_index", "energieIndex", "EnergieIndex")),
    buildingClass:       toStr(pick("Pand_gebouwklasse", "gebouwklasse", "Gebouwklasse")),
    gebouwtype:          toStr(pick("Pand_gebouwtype", "gebouwtype", "Gebouwtype")),
    bouwjaar:            toNum(pick("Pand_bouwjaar", "bouwjaar", "Bouwjaar")),
    gebruiksoppervlakte: toNum(pick("Pand_gebruiksoppervlakte", "gebruiksoppervlakte", "Gebruiksoppervlakte")),
    energiebehoefte:     toNum(pick("Energiebehoefte", "energiebehoefte")),
    aandeelHernieuwbaar: toNum(pick("Aandeel_hernieuwbare_energie", "aandeelHernieuwbaar", "AandeelHernieuwbareEnergie")),
    co2:                 toNum(pick("Co2", "CO2", "co2")),
    geldigTot:           toStr(pick("Registratiedatum_einde", "geldigTot", "GeldigTot")),
    isPrive,
    bagVboId:            toStr(pick("BAGVerblijfsobjectID", "bagVboId", "BagVboId")),
  };
  // Nothing usable at all → treat as empty.
  if (out.energyLabel == null && out.energyIndex == null && out.bouwjaar == null) return null;
  return out;
}

/**
 * Fetch the EP-Online label for a postcode + house number. Classified result:
 * "error" = timeout/network/5xx (transient), "empty" = no registration / 404,
 * "found". Never throws. `fetchImpl` is injectable for tests.
 */
export async function fetchEpOnlineLabel(
  postcode:    string,
  houseNumber: string,
  apiKey:      string,
  extra:       { huisletter?: string | null; toevoeging?: string | null } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<EpOnlineFetchResult> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const hn = houseNumber.trim();
  if (!/^\d{4}[A-Z]{2}$/.test(pc) || !/^\d{1,5}$/.test(hn) || !apiKey) return { status: "empty" };

  const params = new URLSearchParams({ postcode: pc, huisnummer: hn });
  if (extra.huisletter)  params.set("huisletter", extra.huisletter.trim());
  if (extra.toevoeging)  params.set("huisnummertoevoeging", extra.toevoeging.trim());

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${EPONLINE_ENDPOINT}?${params.toString()}`, {
      signal:  controller.signal,
      headers: { Authorization: apiKey, Accept: "application/json" },
    });
    if (res.status === 404) return { status: "empty" };
    if (!res.ok) return { status: "error" };
    const parsed = parseEpOnlineLabel(await res.json());
    return parsed ? { status: "found", data: parsed } : { status: "empty" };
  } catch {
    return { status: "error" }; // timeout / network / parse → transient
  } finally {
    clearTimeout(timeout);
  }
}
