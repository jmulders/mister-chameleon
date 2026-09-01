/**
 * DB-backed lazy cache for EP-Online per-address energy labels
 * (eponline_label_cache), server-only. Keyed on a SHA-256 hash of
 * "POSTCODE:huisnummer[:huisletter:toevoeging]" — the raw address (personal data)
 * is NEVER stored, only the hash + the derived label facts.
 *
 * Reads/writes never throw: on any failure the enricher simply adds no fields.
 * Labels are stable, so the TTL is long.
 */

import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";
import type { EpOnlineLabel } from "@/lib/enrichment/eponline-ingest";

export const EPONLINE_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1_000; // 90 days

/** SHA-256 of the normalised "postcode:huisnummer[:huisletter:toevoeging]" — the cache key. */
export function eponlineAddrHash(
  postcode: string, houseNumber: string, huisletter?: string | null, toevoeging?: string | null,
): string {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const hn = houseNumber.trim();
  const hl = (huisletter ?? "").trim().toUpperCase();
  const tv = (toevoeging ?? "").trim().toUpperCase();
  return createHash("sha256").update(`${pc}:${hn}:${hl}:${tv}`, "utf8").digest("hex");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }
const num = (v: unknown): number | null => (v != null ? Number(v) : null);

/** Look up cached EP-Online label for an address. Null on miss / expiry / error. */
export async function getEpOnlineLabel(
  postcode: string, houseNumber: string, huisletter?: string | null, toevoeging?: string | null,
): Promise<EpOnlineLabel | null> {
  try {
    const { data } = await db()
      .from("eponline_label_cache")
      .select("energy_label, energy_label_band, energy_index, building_class, gebouwtype, bouwjaar, gebruiksoppervlakte, energiebehoefte, aandeel_hernieuwbaar, co2, geldig_tot, is_prive, bag_vbo_id, expires_at")
      .eq("addr_hash", eponlineAddrHash(postcode, houseNumber, huisletter, toevoeging))
      .maybeSingle();
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null; // expired
    return {
      energyLabel:         data.energy_label ?? null,
      energyLabelBand:     data.energy_label_band ?? null,
      energyIndex:         num(data.energy_index),
      buildingClass:       data.building_class ?? null,
      gebouwtype:          data.gebouwtype ?? null,
      bouwjaar:            num(data.bouwjaar),
      gebruiksoppervlakte: num(data.gebruiksoppervlakte),
      energiebehoefte:     num(data.energiebehoefte),
      aandeelHernieuwbaar: num(data.aandeel_hernieuwbaar),
      co2:                 num(data.co2),
      geldigTot:           data.geldig_tot ?? null,
      isPrive:             Boolean(data.is_prive),
      bagVboId:            data.bag_vbo_id ?? null,
    };
  } catch (err) {
    logger.debug("[eponline-label-store] lookup failed", { error: String(err) });
    return null;
  }
}

/** Upsert EP-Online label facts for an address (the lazy cache write). Never throws. */
export async function upsertEpOnlineLabel(
  postcode: string, houseNumber: string, data: EpOnlineLabel,
  huisletter?: string | null, toevoeging?: string | null,
): Promise<void> {
  try {
    await db()
      .from("eponline_label_cache")
      .upsert({
        addr_hash:            eponlineAddrHash(postcode, houseNumber, huisletter, toevoeging),
        energy_label:         data.energyLabel,
        energy_label_band:    data.energyLabelBand,
        energy_index:         data.energyIndex,
        building_class:       data.buildingClass,
        gebouwtype:           data.gebouwtype,
        bouwjaar:             data.bouwjaar,
        gebruiksoppervlakte:  data.gebruiksoppervlakte,
        energiebehoefte:      data.energiebehoefte,
        aandeel_hernieuwbaar: data.aandeelHernieuwbaar,
        co2:                  data.co2,
        geldig_tot:           data.geldigTot,
        is_prive:             data.isPrive,
        bag_vbo_id:           data.bagVboId,
        refreshed_at:         new Date().toISOString(),
        expires_at:           new Date(Date.now() + EPONLINE_CACHE_TTL_MS).toISOString(),
      }, { onConflict: "addr_hash" });
  } catch (err) {
    logger.debug("[eponline-label-store] upsert failed", { error: String(err) });
  }
}
