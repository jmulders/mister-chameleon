/**
 * Cookie registry — the cookies this platform (and its integrations) may set,
 * grouped by consent category. Powers the Cookiebot-style cookie declaration so
 * visitors can see exactly what is stored and why, and manage their consent.
 *
 * Integration cookies (GA4, Leadinfo) are only actually set when the tenant has
 * that integration enabled; the declaration notes the provider so it's clear.
 * See docs/lead-base-design.md / tracking/consent-types.ts.
 *
 * The registry is written in English. Every cookie also carries its purpose in
 * Dutch (`purposeNl`), and the labels cookies share (provider, lifetime, type,
 * domain) have a Dutch counterpart in NL_LABELS. `cookiesForCategory(cat, "nl")`
 * returns the rows in Dutch for the public /cookies page.
 */

import type { ConsentCategory } from "./consent-types";

/** A cookie category — the three consent categories plus always-on "essential". */
export type CookieCategory = "essential" | ConsentCategory;

/** Languages the declaration can be shown in. Same union as ConsentLocale. */
export type CookieLocale = "nl" | "en";

export interface CookieDef {
  name:     string;
  provider: string;
  category: CookieCategory;
  purpose:  string;
  /** The purpose in Dutch. Required, so a new cookie cannot ship without it. */
  purposeNl: string;
  /** Human-readable retention / lifetime, e.g. "1 year", "Session", "24 hours". */
  expiry:   string;
  /** Storage mechanism, e.g. "HTTP Cookie" or "HTML localStorage". */
  type:     string;
  /** Where it is set — "First-party" or a third-party host (e.g. "leadinfo.net"). */
  domain:   string;
  /** True when the cookie is HttpOnly (not readable by JavaScript). */
  httpOnly?: boolean;
}

/** Category metadata for the declaration UI (label, description, consent key). */
export const COOKIE_CATEGORY_META: Record<CookieCategory, { label: string; description: string; consentKey: ConsentCategory | null }> = {
  essential: {
    label:       "Strictly necessary",
    description: "Required for the site to work (session continuity, your consent choice, language). Always on.",
    consentKey:  null,
  },
  analytics: {
    label:       "Analytics",
    description: "Measure traffic and usage (e.g. Google Analytics) so we can improve the site.",
    consentKey:  "analytics",
  },
  personalization: {
    label:       "Personalization",
    description: "Tailor content to you — behavioural scoring, adaptive blocks and personalized campaign links.",
    consentKey:  "personalization",
  },
  enrichment: {
    label:       "Enrichment",
    description: "Identify the company behind a visit (e.g. Leadinfo, IP-to-company) for B2B personalization.",
    consentKey:  "enrichment",
  },
  advertising: {
    label:       "Advertising",
    description: "Share ad click identifiers (gclid/fbclid) with advertising platforms (Google, Meta) so a conversion can be matched to the ad you clicked.",
    consentKey:  "advertising",
  },
};

export const COOKIE_CATEGORY_ORDER: CookieCategory[] = ["essential", "analytics", "personalization", "enrichment", "advertising"];

export const COOKIE_REGISTRY: CookieDef[] = [
  // ── Strictly necessary ──────────────────────────────────────────────────────
  { name: "mc_session_id", provider: "This site", category: "essential",
    purpose: "First-party pseudonymous visitor id for session continuity (also the analytics visitor key).",
    purposeNl: "Een pseudoniem bezoekersnummer dat je bezoek bij elkaar houdt. De statistieken gebruiken hetzelfde nummer.",
    expiry: "1 year", type: "HTTP Cookie", domain: "First-party", httpOnly: false },
  { name: "mc_consent", provider: "This site", category: "essential",
    purpose: "Stores your cookie-consent choices so we can honour them.",
    purposeNl: "Onthoudt welke cookies je hebt toegestaan.",
    expiry: "1 year", type: "HTTP Cookie", domain: "First-party", httpOnly: false },
  { name: "mc_locale", provider: "This site", category: "essential",
    purpose: "Remembers your selected language.",
    purposeNl: "Onthoudt welke taal je hebt gekozen.",
    expiry: "1 year", type: "HTTP Cookie", domain: "First-party", httpOnly: false },

  // ── Personalization ─────────────────────────────────────────────────────────
  { name: "mc_lead", provider: "This site", category: "personalization",
    purpose: "Identifies you to a personalized campaign link (ABM) so the page adapts to your account.",
    purposeNl: "Herkent je als je via een persoonlijke campagnelink komt. Zo past de pagina zich aan jouw bedrijf aan.",
    expiry: "30 days", type: "HTTP Cookie", domain: "First-party", httpOnly: false },

  // ── Analytics (Google Analytics 4 via GTM, when enabled) ────────────────────
  { name: "_ga", provider: "Google Analytics", category: "analytics",
    purpose: "Distinguishes unique visitors.",
    purposeNl: "Houdt bezoekers uit elkaar.",
    expiry: "2 years", type: "HTTP Cookie", domain: "First-party (Google Analytics)", httpOnly: false },
  { name: "_ga_<container>", provider: "Google Analytics", category: "analytics",
    purpose: "Persists GA4 session state.",
    purposeNl: "Bewaart de stand van je sessie in Google Analytics.",
    expiry: "2 years", type: "HTTP Cookie", domain: "First-party (Google Analytics)", httpOnly: false },
  { name: "_gid", provider: "Google Analytics", category: "analytics",
    purpose: "Distinguishes visitors over a short window.",
    purposeNl: "Houdt bezoekers korte tijd uit elkaar.",
    expiry: "24 hours", type: "HTTP Cookie", domain: "First-party (Google Analytics)", httpOnly: false },

  // ── Enrichment (Leadinfo, when enabled) ─────────────────────────────────────
  { name: "mc_li", provider: "This site", category: "enrichment",
    purpose: "Stores the company-identification result from Leadinfo for this visit.",
    purposeNl: "Bewaart voor dit bezoek welk bedrijf Leadinfo heeft herkend.",
    expiry: "30 days", type: "HTTP Cookie", domain: "First-party", httpOnly: false },
  { name: "_li_id / leadinfo", provider: "Leadinfo", category: "enrichment",
    purpose: "Leadinfo company-identification tracking.",
    purposeNl: "Laat Leadinfo herkennen vanuit welk bedrijf je de site bezoekt.",
    expiry: "Varies (Leadinfo)", type: "HTTP Cookie", domain: "leadinfo.net (third-party)", httpOnly: false },
];

/**
 * Dutch for the labels that cookies share: provider, lifetime, type and domain.
 * A label that is missing here is shown in English, so add the Dutch when you
 * introduce a new one. Brand names and hostnames need no entry.
 */
const NL_LABELS: Record<string, string> = {
  // provider
  "This site":                      "Deze site",
  // expiry
  "1 year":                         "1 jaar",
  "2 years":                        "2 jaar",
  "30 days":                        "30 dagen",
  "24 hours":                       "24 uur",
  "Varies (Leadinfo)":              "Wisselt (Leadinfo)",
  // type
  "HTTP Cookie":                    "HTTP-cookie",
  // domain
  "First-party":                    "Eigen domein",
  "First-party (Google Analytics)": "Eigen domein (Google Analytics)",
  "leadinfo.net (third-party)":     "leadinfo.net (derde partij)",
};

/** One registry row with its visitor-facing texts in the given language. */
function localizeCookie(cookie: CookieDef, locale: CookieLocale): CookieDef {
  if (locale !== "nl") return cookie;
  return {
    ...cookie,
    provider: NL_LABELS[cookie.provider] ?? cookie.provider,
    purpose:  cookie.purposeNl,
    expiry:   NL_LABELS[cookie.expiry]   ?? cookie.expiry,
    type:     NL_LABELS[cookie.type]     ?? cookie.type,
    domain:   NL_LABELS[cookie.domain]   ?? cookie.domain,
  };
}

/**
 * Cookies for one category (for the declaration table), with purpose and labels
 * in the given language. Defaults to English, the language of the registry.
 */
export function cookiesForCategory(category: CookieCategory, locale: CookieLocale = "en"): CookieDef[] {
  return COOKIE_REGISTRY
    .filter((c) => c.category === category)
    .map((c) => localizeCookie(c, locale));
}
