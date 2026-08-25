/**
 * Cookie registry — the cookies this platform (and its integrations) may set,
 * grouped by consent category. Powers the Cookiebot-style cookie declaration so
 * visitors can see exactly what is stored and why, and manage their consent.
 *
 * Integration cookies (GA4, Leadinfo) are only actually set when the tenant has
 * that integration enabled; the declaration notes the provider so it's clear.
 * See docs/lead-base-design.md / tracking/consent-types.ts.
 */

import type { ConsentCategory } from "./consent-types";

/** A cookie category — the three consent categories plus always-on "essential". */
export type CookieCategory = "essential" | ConsentCategory;

export interface CookieDef {
  name:     string;
  provider: string;
  category: CookieCategory;
  purpose:  string;
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
    expiry: "1 year", type: "HTTP Cookie", domain: "First-party", httpOnly: false },
  { name: "mc_consent", provider: "This site", category: "essential",
    purpose: "Stores your cookie-consent choices so we can honour them.",
    expiry: "1 year", type: "HTTP Cookie", domain: "First-party", httpOnly: false },
  { name: "mc_locale", provider: "This site", category: "essential",
    purpose: "Remembers your selected language.",
    expiry: "1 year", type: "HTTP Cookie", domain: "First-party", httpOnly: false },

  // ── Personalization ─────────────────────────────────────────────────────────
  { name: "mc_lead", provider: "This site", category: "personalization",
    purpose: "Identifies you to a personalized campaign link (ABM) so the page adapts to your account.",
    expiry: "30 days", type: "HTTP Cookie", domain: "First-party", httpOnly: false },

  // ── Analytics (Google Analytics 4 via GTM, when enabled) ────────────────────
  { name: "_ga", provider: "Google Analytics", category: "analytics",
    purpose: "Distinguishes unique visitors.",
    expiry: "2 years", type: "HTTP Cookie", domain: "First-party (Google Analytics)", httpOnly: false },
  { name: "_ga_<container>", provider: "Google Analytics", category: "analytics",
    purpose: "Persists GA4 session state.",
    expiry: "2 years", type: "HTTP Cookie", domain: "First-party (Google Analytics)", httpOnly: false },
  { name: "_gid", provider: "Google Analytics", category: "analytics",
    purpose: "Distinguishes visitors over a short window.",
    expiry: "24 hours", type: "HTTP Cookie", domain: "First-party (Google Analytics)", httpOnly: false },

  // ── Enrichment (Leadinfo, when enabled) ─────────────────────────────────────
  { name: "mc_li", provider: "This site", category: "enrichment",
    purpose: "Stores the company-identification result from Leadinfo for this visit.",
    expiry: "30 days", type: "HTTP Cookie", domain: "First-party", httpOnly: false },
  { name: "_li_id / leadinfo", provider: "Leadinfo", category: "enrichment",
    purpose: "Leadinfo company-identification tracking.",
    expiry: "Varies (Leadinfo)", type: "HTTP Cookie", domain: "leadinfo.net (third-party)", httpOnly: false },
];

/** Cookies for one category (for the declaration table). */
export function cookiesForCategory(category: CookieCategory): CookieDef[] {
  return COOKIE_REGISTRY.filter((c) => c.category === category);
}
