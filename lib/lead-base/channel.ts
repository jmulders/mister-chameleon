/**
 * Lead Base — traffic channel classification.
 *
 * Maps raw attribution signals (UTM params, referrer, ad click ids) to a single
 * coarse channel label used for first-touch attribution on visitor_profiles and
 * for the channel funnel report. Pure + dependency-free so it's shared by the
 * capture path and the reporting query.
 *
 * Channels: paid_search | paid_social | organic_search | social | email |
 *           referral | affiliate | display | direct | other
 */

export type Channel =
  | "paid_search"
  | "paid_social"
  | "organic_search"
  | "social"
  | "email"
  | "referral"
  | "affiliate"
  | "display"
  | "direct"
  | "other";

export interface AttributionSignals {
  utmSource?:      string | null;
  utmMedium?:      string | null;
  utmCampaign?:    string | null;
  referrerDomain?: string | null;
  gclid?:          string | null;
  fbclid?:         string | null;
}

const SEARCH_ENGINES = /(google|bing|yahoo|duckduckgo|ecosia|baidu|yandex|qwant|startpage)\./i;
const SOCIAL_DOMAINS = /(facebook|instagram|linkedin|twitter|x\.com|t\.co|tiktok|youtube|pinterest|reddit|threads)\./i;

/** Classify a first-touch channel from attribution signals. */
export function classifyChannel(s: AttributionSignals): Channel {
  const medium   = (s.utmMedium ?? "").toLowerCase().trim();
  const source   = (s.utmSource ?? "").toLowerCase().trim();
  const referrer = (s.referrerDomain ?? "").toLowerCase().trim();

  // Ad click ids are the strongest paid signal.
  if (s.gclid) return "paid_search";
  if (s.fbclid) return "paid_social";

  // UTM medium is the canonical marketer-set signal.
  if (/(^|[_-])(cpc|ppc|paid|paidsearch|paid_search|sem)([_-]|$)/.test(medium)) return "paid_search";
  if (/paid.?social|paidsocial/.test(medium)) return "paid_social";
  if (medium === "email" || /newsletter|mailchimp|activecampaign|klaviyo|sendgrid/.test(source)) return "email";
  if (medium === "social" || /social/.test(medium)) return "social";
  if (medium === "display" || medium === "banner" || medium === "cpm") return "display";
  if (medium === "affiliate") return "affiliate";
  if (medium === "referral") return "referral";
  if (/(^|[_-])(organic)([_-]|$)/.test(medium)) return "organic_search";

  // No UTM: infer from the referrer.
  if (referrer) {
    if (SEARCH_ENGINES.test(referrer)) return "organic_search";
    if (SOCIAL_DOMAINS.test(referrer)) return "social";
    return "referral";
  }

  // A source with no medium and no referrer: treat as a campaign/other.
  if (source) return "other";

  // Nothing at all: direct.
  return "direct";
}
