/**
 * Shape + sanitiser for the untrusted `context` object of POST /api/snippet/decide.
 *
 * The context comes straight from the browser (or anyone with the public site
 * key). Without validation a `null` context threw on property access (500
 * without CORS headers), a non-string `path` crashed resolvePageMeta, and
 * keywords / path / utm values were written into visitor_journey_events without
 * a bound. sanitizeDecideContext accepts only a plain object, keeps only string
 * fields (non-strings are dropped), and caps what ends up in the database.
 */

export const MAX_PATH_LENGTH     = 512;
export const MAX_UTM_LENGTH      = 200;
export const MAX_KEYWORDS        = 50;
export const MAX_KEYWORD_LENGTH  = 64;
/** Bound for the other free-text fields (referrer, click ids, demo keys, ids). */
export const MAX_FIELD_LENGTH    = 2048;

export interface DecideContext {
  path?:           string;
  referrer?:       string;
  utm_source?:     string;
  utm_medium?:     string;
  utm_campaign?:   string;
  gclid?:          string;
  fbclid?:         string;
  msclkid?:        string;
  ttclid?:         string;
  sessionId?:      string;
  /**
   * Stable first-party visitor id minted and persisted by the snippet
   * (localStorage `mc_vid`, cookie fallback). Sent on every pageview so the
   * platform can key behavioural history to one visitor instead of treating
   * each pageview as a brand-new session. Normally equal to sessionId.
   */
  visitorId?:      string;
  locale?:         string;
  /**
   * Interest keywords for this page — sent by the snippet from the page's
   * <meta name="keywords"> tag. Merged with the URL→keyword map and recorded
   * as a behavioural page_view so interest-profile scoring works on snippet
   * (e.g. Statamic) sites, not just platform-rendered pages.
   */
  keywords?:       string[];
  /**
   * Stable per-pageview id for idempotent journey-event recording. Normalised
   * to a UUID by toJourneyEventId before it reaches the database.
   */
  eventId?:        string;
  /**
   * Mirror-demo scenario override.
   * When present alongside _demoMode === "mirror" the rule engine is bypassed.
   *
   * If _demoId is also supplied, the per-demo AI-generated scenario_slots are
   * loaded from demo_instances and returned directly (no CMS lookup needed).
   * Otherwise the legacy DEMO_SCENARIO_PLANS CMS fallback is used.
   */
  _demoScenario?: string;
  _demoMode?:     string;
  /**
   * Mirror demo instance ID.
   * When present with _demoMode=mirror, the decide endpoint loads the
   * AI-generated scenario_slots for this specific demo from the DB and
   * returns slots[_demoScenario].  This replaces the generic DEMO_SCENARIO_PLANS
   * lookup so every prospect sees their own site's personalised content.
   */
  _demoId?:       string;
  /**
   * Live-demo notification toggle (second axis alongside _demoScenario). Maps
   * to a DEMO_NOTIF_SETS entry (e.g. "open" / "closed") whose notification
   * variant is layered onto the mirror-demo slots. When the tenant has a notif
   * set and this is absent, the first entry is used so the demo always shows one.
   */
  _demoNotif?:    string;
  /**
   * Per-request domain attributes for the current page (e.g. a trailer model's
   * { massa, categorie, occasion }), read by an AttributeCondition. Untrusted /
   * spoofable: sanitised and filtered to the tenant declaration server-side
   * before it reaches rule evaluation.
   */
  customAttributes?: Record<string, unknown>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

const PLAIN_FIELDS = [
  "referrer", "gclid", "fbclid", "msclkid", "ttclid", "sessionId", "visitorId",
  "locale", "eventId", "_demoScenario", "_demoMode", "_demoId", "_demoNotif",
] as const;

const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign"] as const;

export function sanitizeDecideContext(raw: unknown): DecideContext {
  if (!isPlainObject(raw)) return {};
  const out: DecideContext = {};

  if (typeof raw.path === "string") {
    // The path is appended to an origin to build the synthetic request URL, so
    // force a leading slash (a bare "@host/x" would otherwise change the host).
    const p = raw.path.startsWith("/") ? raw.path : `/${raw.path}`;
    out.path = p.slice(0, MAX_PATH_LENGTH);
  }

  for (const k of UTM_FIELDS) {
    const v = str(raw[k], MAX_UTM_LENGTH);
    if (v !== undefined) out[k] = v;
  }

  for (const k of PLAIN_FIELDS) {
    const v = str(raw[k], MAX_FIELD_LENGTH);
    if (v !== undefined) out[k] = v;
  }

  if (Array.isArray(raw.keywords)) {
    const kws: string[] = [];
    for (const k of raw.keywords) {
      if (kws.length >= MAX_KEYWORDS) break;
      if (typeof k !== "string") continue;
      const t = k.trim().slice(0, MAX_KEYWORD_LENGTH);
      if (t) kws.push(t);
    }
    out.keywords = kws;
  }

  if (isPlainObject(raw.customAttributes)) out.customAttributes = raw.customAttributes;

  return out;
}
