/**
 * context/form-location-context.ts
 *
 * First-party form-provided location, carried in the `mc_loc` cookie so a visitor
 * who typed their postcode (or place) in a form is location-enriched on the next
 * server render — no DB write, no migration. Mirrors the mc_li (Leadinfo) cookie
 * pattern. Consumed only under enrichment consent (the CBS stage runs then).
 */

export const FORM_LOCATION_COOKIE = "mc_loc";
export const FORM_LOCATION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export interface FormLocation {
  postcode: string | null;
  place:    string | null;
  /** Dutch house number (digits only), for per-address BAG lookups. */
  houseNumber?: string | null;
}

/**
 * Stable fingerprint of a form-provided location (postcode + huisnummer + place),
 * used to invalidate the session-enrichment cache when the visitor's mc_loc
 * changes — e.g. they browsed (enrichment cached on IP-geo) and then submitted a
 * form that set a postcode + house number. Returns null when there is no usable
 * location, so a request without an mc_loc cookie produces no fingerprint and the
 * cache behaves exactly as before (see the session-enrichment cache).
 */
export function formLocationFingerprint(fl: FormLocation | null | undefined): string | null {
  if (!fl) return null;
  const pc = (fl.postcode ?? "").trim().toLowerCase();
  const hn = (fl.houseNumber ?? "").trim().toLowerCase();
  const pl = (fl.place ?? "").trim().toLowerCase();
  if (!pc && !hn && !pl) return null;
  return `${pc}|${hn}|${pl}`;
}

/** Extract a bare house number (leading digits) from arbitrary text, or null. */
export function normalizeHouseNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,5})/);
  return m ? m[1] : null;
}

/** Extract a Dutch postcode ("1011AB" / "1011 ab") from arbitrary text, or null. */
export function normalizePostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).toUpperCase().replace(/\s+/g, "").match(/^(\d{4})([A-Z]{2})$/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** Compact, URL-encoded serialization for the cookie value. */
export function serializeFormLocation(loc: FormLocation): string {
  return encodeURIComponent(JSON.stringify({ p: loc.postcode ?? null, c: loc.place ?? null, h: loc.houseNumber ?? null }));
}

/** Parse the mc_loc cookie value → FormLocation, or null when empty/invalid. */
export function parseFormLocationCookie(value: string | null | undefined): FormLocation | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(decodeURIComponent(value)) as { p?: unknown; c?: unknown; h?: unknown };
    const postcode = typeof raw.p === "string" ? normalizePostcode(raw.p) : null;
    const place    = typeof raw.c === "string" && raw.c.trim() ? raw.c.trim().slice(0, 80) : null;
    const houseNumber = typeof raw.h === "string" ? normalizeHouseNumber(raw.h) : null;
    if (!postcode && !place) return null;
    return { postcode, place, houseNumber };
  } catch {
    return null;
  }
}

/**
 * Pull a location out of raw form field values: a valid NL postcode (primary) or,
 * failing that, a place/city field (coarse fallback). Returns null when neither
 * is present.
 */
export function formLocationFromValues(values: Record<string, string>): FormLocation | null {
  let postcode: string | null = null;
  let place:    string | null = null;
  let houseNumber: string | null = null;
  for (const [key, val] of Object.entries(values)) {
    if (!val) continue;
    const k = key.toLowerCase();
    if (!postcode && /post.?code|postal|\bzip\b/.test(k)) postcode = normalizePostcode(val);
    if (!place && /\b(plaats|woonplaats|city|town|gemeente)\b/.test(k)) place = val.trim().slice(0, 80) || null;
    if (!houseNumber && /huis.?nr|huis.?nummer|house.?no|house.?number|\bhuisnr\b/.test(k)) houseNumber = normalizeHouseNumber(val);
  }
  // A postcode may also arrive inside a generic free-text field — last-resort
  // scan for an NL postcode substring (loose match, not the strict validator).
  if (!postcode) {
    for (const val of Object.values(values)) {
      const m = String(val).toUpperCase().match(/(?<!\d)(\d{4})\s?([A-Z]{2})(?![A-Z])/);
      if (m) { postcode = `${m[1]}${m[2]}`; break; }
    }
  }
  if (!postcode && !place) return null;
  return { postcode, place, houseNumber };
}
