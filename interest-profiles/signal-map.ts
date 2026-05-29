/**
 * interest-profiles/signal-map.ts
 *
 * Signal mapping rules — translates behavioral events into (profileKey, points)
 * pairs for the behavioral scoring engine.
 *
 * ─── Two rule tables ──────────────────────────────────────────────────────────
 *
 *   URL_SIGNAL_RULES  — Match on page pathname.
 *                       Applied for page_view, repeat_visit, form_start, form_submit.
 *                       Each event type applies a multiplier:
 *                         page_view     × 1.0
 *                         repeat_visit  × 1.5  (rewarded for returning)
 *                         form_start    × 0.5  (intent signal, not yet committed)
 *                         form_submit   × 2.0  (strongest possible signal)
 *
 *   CTA_SIGNAL_RULES  — Match on CTA label string.
 *                       Applied for cta_click events.
 *                       Labels are normalized: lowercase, spaces/hyphens → underscore.
 *
 * ─── Rule ordering ────────────────────────────────────────────────────────────
 *
 *   Rules are evaluated in order; ALL matching rules fire (not first-match).
 *   More specific patterns should appear before generic ones.
 *   When multiple URL rules fire for the same URL, points accumulate.
 *
 * ─── Supported profile keys ───────────────────────────────────────────────────
 *
 *   B2B / SaaS:   pricing_focused, product_focused, use_case_focused,
 *                 trust_focused, technical_focused, comparison_focused, roi_focused
 *
 *   MC-specific:  personalization_seeker, conversion_optimizer, demo_intent,
 *                 marketing_decision_maker, agency_partner_interest, saas_audience
 *
 *   Careers:      candidate_explorer, job_specific_candidate,
 *                 high_intent_applicant, employer_brand_interest
 *
 *   Commerce:     product_explorer, deal_sensitive, high_purchase_intent,
 *                 cart_ready, repeat_product_interest
 *
 *   Real Estate:  property_explorer, buyer_intent, viewing_ready,
 *                 investor_style_interest
 */

import type { BehavioralEvent, ResolvedSignal } from "./behavioral-scoring";

// ── Multipliers per event type ────────────────────────────────────────────────

const URL_EVENT_MULTIPLIER: Record<string, number> = {
  page_view:    1.0,
  repeat_visit: 1.5,
  form_start:   0.5,
  form_submit:  2.0,
};

// ── Rule type definitions ─────────────────────────────────────────────────────

interface ProfilePoints {
  profileKey: string;
  points:     number;
}

interface UrlSignalRule {
  /** Short label for debug reasons string. */
  label:   string;
  /** Returns true if this rule should fire for the given pathname. */
  match:   (pathname: string) => boolean;
  signals: ProfilePoints[];
}

interface CtaSignalRule {
  /** Short label for debug reasons string. */
  label:   string;
  /** Returns true if this rule should fire for the given normalized CTA label. */
  match:   (label: string) => boolean;
  signals: ProfilePoints[];
}

// ── Pathname helpers ──────────────────────────────────────────────────────────

function extractPathname(url: string): string {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return new URL(url).pathname.toLowerCase();
    }
  } catch {
    // fall through
  }
  // Strip query string and hash; lowercase.
  return url.split("?")[0].split("#")[0].toLowerCase();
}

/** True if pathname contains any of the given segments (as a substring). */
function hasSegment(pathname: string, ...segments: string[]): boolean {
  return segments.some((s) => pathname.includes(s));
}

/** True if pathname starts with any of the given prefixes. */
function startsWithAny(pathname: string, ...prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "-") || pathname.startsWith(p + "_"));
}

// ── CTA label helper ──────────────────────────────────────────────────────────

/** Normalize a CTA label to lowercase_underscore for consistent matching. */
function normLabel(label: string): string {
  return label.toLowerCase().replace(/[\s\-]/g, "_");
}

/** True if the normalized label equals or contains any of the keywords. */
function labelMatches(label: string, ...keywords: string[]): boolean {
  const n = normLabel(label);
  return keywords.some((k) => n === k || n.includes(k));
}

// ── URL signal rules (ordered most-specific → least-specific) ─────────────────

const URL_SIGNAL_RULES: UrlSignalRule[] = [

  // ── B2B / SaaS ────────────────────────────────────────────────────────────

  {
    label:  "pricing / plans page",
    match:  (p) => hasSegment(p, "/pricing", "/tarieven", "/abonnement", "/plans", "/pakket", "/offerte"),
    signals: [{ profileKey: "pricing_focused", points: 10 }],
  },
  {
    label:  "features / capabilities page",
    match:  (p) => hasSegment(p, "/features", "/functionaliteiten", "/mogelijkheden", "/capabilities"),
    signals: [{ profileKey: "product_focused", points: 8 }],
  },
  {
    label:  "product / platform overview",
    match:  (p) => hasSegment(p, "/product", "/platform", "/how-it-works", "/hoe-werkt"),
    signals: [{ profileKey: "product_focused", points: 5 }],
  },
  {
    label:  "docs / API / developer page",
    match:  (p) => hasSegment(p, "/docs", "/api", "/developer", "/sdk", "/documentatie", "/webhook"),
    signals: [{ profileKey: "technical_focused", points: 8 }],
  },
  {
    label:  "use case / solution / industry page",
    match:  (p) => hasSegment(p, "/use-case", "/use_case", "/oplossing", "/solution", "/industry", "/industrie", "/sector", "/branche"),
    signals: [{ profileKey: "use_case_focused", points: 7 }],
  },
  {
    label:  "social proof / trust / security page",
    match:  (p) => hasSegment(p, "/cases", "/case-study", "/testimonials", "/reviews", "/klanten", "/customers", "/security", "/privacy", "/gdpr", "/compliance"),
    signals: [{ profileKey: "trust_focused", points: 8 }],
  },
  {
    label:  "comparison / alternatives page",
    match:  (p) => hasSegment(p, "/compare", "/vergelijken", "/alternatives", "/alternatieven", "/versus", "/vs-"),
    signals: [{ profileKey: "comparison_focused", points: 10 }],
  },
  {
    label:  "ROI / business case / calculator",
    match:  (p) => hasSegment(p, "/roi", "/business-case", "/businesscase", "/calculator", "/savings", "/besparing"),
    signals: [{ profileKey: "roi_focused", points: 10 }],
  },

  // ── Mister Chameleon — specific profiles ─────────────────────────────────
  //
  // These rules fire alongside the generic B2B/SaaS rules, so a visit to
  // /pricing also increments pricing_focused AND (where relevant) demo_intent
  // or marketing_decision_maker.

  {
    label:  "how-it-works / platform mechanics page",
    match:  (p) => hasSegment(p, "/how-it-works", "/hoe-het-werkt", "/hoe-werkt", "/werking"),
    signals: [
      { profileKey: "personalization_seeker", points: 12 },
      { profileKey: "conversion_optimizer",   points: 6  },
    ],
  },
  {
    label:  "platform / features / capabilities page (MC)",
    match:  (p) => hasSegment(p, "/platform", "/features", "/functionaliteiten", "/mogelijkheden", "/capabilities"),
    signals: [
      { profileKey: "personalization_seeker", points: 8  },
      { profileKey: "conversion_optimizer",   points: 5  },
    ],
  },
  {
    label:  "agency / bureau use case page",
    match:  (p) => hasSegment(p, "/agency", "/bureau", "/voor-bureaus", "/agentschap", "/voor-marketing-bureaus"),
    signals: [
      { profileKey: "agency_partner_interest", points: 15 },
      { profileKey: "personalization_seeker",  points: 5  },
    ],
  },
  {
    label:  "SaaS / scale-up use case page",
    match:  (p) => hasSegment(p, "/saas", "/scale-up", "/startup", "/voor-saas", "/product-led"),
    signals: [
      { profileKey: "saas_audience",           points: 15 },
      { profileKey: "personalization_seeker",  points: 5  },
      { profileKey: "conversion_optimizer",    points: 5  },
    ],
  },
  {
    label:  "contact / demo booking page",
    match:  (p) => hasSegment(p, "/contact", "/demo", "/book", "/afspraak", "/gesprek"),
    signals: [
      { profileKey: "demo_intent",             points: 15 },
      { profileKey: "marketing_decision_maker",points: 8  },
    ],
  },
  {
    label:  "cases / social proof page (MC)",
    match:  (p) => hasSegment(p, "/cases", "/klanten", "/customers", "/referenties"),
    signals: [
      { profileKey: "marketing_decision_maker", points: 8 },
      { profileKey: "conversion_optimizer",     points: 6 },
    ],
  },
  {
    label:  "about / company page (MC decision-maker signal)",
    match:  (p) => hasSegment(p, "/about", "/over-ons", "/over-mij", "/bedrijf", "/company", "/team", "/missie"),
    signals: [
      { profileKey: "marketing_decision_maker", points: 6 },
      { profileKey: "agency_partner_interest",  points: 4 },
    ],
  },
  {
    label:  "ROI / calculator page (MC)",
    match:  (p) => hasSegment(p, "/roi", "/calculator", "/business-case", "/besparing", "/rendement"),
    signals: [
      { profileKey: "conversion_optimizer",     points: 12 },
      { profileKey: "marketing_decision_maker", points: 8  },
    ],
  },
  {
    label:  "pricing page (MC conversion signal)",
    match:  (p) => hasSegment(p, "/pricing", "/tarieven", "/abonnement", "/plans", "/pakket"),
    signals: [
      { profileKey: "demo_intent",              points: 8  },
      { profileKey: "marketing_decision_maker", points: 6  },
      { profileKey: "saas_audience",            points: 5  },
    ],
  },
  {
    label:  "signup / start page (SaaS PLG signal)",
    match:  (p) => hasSegment(p, "/signup", "/registreer", "/start", "/get-started", "/aan-de-slag"),
    signals: [
      { profileKey: "saas_audience",          points: 12 },
      { profileKey: "conversion_optimizer",   points: 6  },
    ],
  },

  // ── Careers ───────────────────────────────────────────────────────────────

  {
    label:  "specific job listing page",
    match:  (p) => startsWithAny(p, "/jobs/", "/vacatures/", "/vacature/") || hasSegment(p, "/job/", "/vacature/"),
    signals: [
      { profileKey: "candidate_explorer",     points: 5  },
      { profileKey: "job_specific_candidate", points: 12 },
    ],
  },
  {
    label:  "apply / application form",
    match:  (p) => hasSegment(p, "/apply", "/solliciteer", "/application", "/sollicitatie"),
    signals: [
      { profileKey: "high_intent_applicant",  points: 20 },
      { profileKey: "job_specific_candidate", points: 8  },
    ],
  },
  {
    label:  "careers / jobs overview",
    match:  (p) => hasSegment(p, "/careers", "/jobs", "/vacatures", "/werken-bij", "/loopbaan"),
    signals: [{ profileKey: "candidate_explorer", points: 10 }],
  },
  {
    label:  "employer brand / culture / people page",
    match:  (p) => hasSegment(p, "/employer", "/cultuur", "/culture", "/people", "/team", "/benefits", "/arbeidsmarkt"),
    signals: [{ profileKey: "employer_brand_interest", points: 8 }],
  },

  // ── Commerce ──────────────────────────────────────────────────────────────

  {
    label:  "cart / checkout page",
    match:  (p) => hasSegment(p, "/cart", "/winkelwagen", "/checkout", "/afrekenen", "/winkelmand"),
    signals: [
      { profileKey: "high_purchase_intent", points: 15 },
      { profileKey: "cart_ready",           points: 15 },
    ],
  },
  {
    label:  "deal / sale / discount page",
    match:  (p) => hasSegment(p, "/sale", "/deal", "/korting", "/aanbieding", "/actie", "/promo", "/discount", "/uitverkoop"),
    signals: [{ profileKey: "deal_sensitive", points: 10 }],
  },
  {
    label:  "product catalog / shop",
    match:  (p) => hasSegment(p, "/shop", "/catalog", "/assortiment", "/collections", "/products"),
    signals: [{ profileKey: "product_explorer", points: 8 }],
  },
  {
    label:  "wishlist / saved items",
    match:  (p) => hasSegment(p, "/wishlist", "/verlanglijst", "/saved", "/favoriet"),
    signals: [
      { profileKey: "product_explorer",        points: 5 },
      { profileKey: "repeat_product_interest", points: 10 },
    ],
  },

  // ── Real Estate ───────────────────────────────────────────────────────────

  {
    label:  "schedule viewing / bezichtiging",
    match:  (p) => hasSegment(p, "/bezichtiging", "/viewing", "/inplannen", "/afspraak"),
    signals: [
      { profileKey: "viewing_ready",     points: 12 },
      { profileKey: "property_explorer", points: 5  },
    ],
  },
  {
    label:  "mortgage / financing / make offer",
    match:  (p) => hasSegment(p, "/hypotheek", "/financiering", "/mortgage", "/bod", "/aankoop", "/offer"),
    signals: [
      { profileKey: "buyer_intent",      points: 15 },
      { profileKey: "property_explorer", points: 5  },
    ],
  },
  {
    label:  "property listing / real estate portal",
    match:  (p) => hasSegment(p, "/property", "/woning", "/pand", "/appartement", "/huis", "/vastgoed", "/object"),
    signals: [{ profileKey: "property_explorer", points: 8 }],
  },
  {
    label:  "investment / rental yield page",
    match:  (p) => hasSegment(p, "/investeren", "/rendement", "/belegging", "/verhuur", "/investor", "/yield"),
    signals: [{ profileKey: "investor_style_interest", points: 10 }],
  },
];

// ── CTA signal rules ──────────────────────────────────────────────────────────

const CTA_SIGNAL_RULES: CtaSignalRule[] = [

  // ── B2B / SaaS ────────────────────────────────────────────────────────────

  {
    label:  "pricing / plan CTA",
    match:  (l) => labelMatches(l, "pricing", "plan", "plans", "upgrade", "subscribe", "abonnement", "tarieven"),
    signals: [{ profileKey: "pricing_focused", points: 25 }],
  },
  {
    label:  "demo / trial CTA",
    match:  (l) => labelMatches(l, "demo", "trial", "free_trial", "probeer", "gratis_proberen", "start_trial", "book_demo"),
    signals: [
      { profileKey: "pricing_focused", points: 15 },
      { profileKey: "product_focused", points: 10 },
    ],
  },
  {
    label:  "features / product CTA",
    match:  (l) => labelMatches(l, "features", "feature", "functionaliteiten", "mogelijkheden", "see_features"),
    signals: [{ profileKey: "product_focused", points: 15 }],
  },
  {
    label:  "docs / technical CTA",
    match:  (l) => labelMatches(l, "docs", "api", "developer", "sdk", "documentatie", "get_api_key", "technical"),
    signals: [{ profileKey: "technical_focused", points: 15 }],
  },
  {
    label:  "case study / trust CTA",
    match:  (l) => labelMatches(l, "case", "cases", "testimonial", "read_case", "customer_story", "klant"),
    signals: [{ profileKey: "trust_focused", points: 15 }],
  },
  {
    label:  "ROI calculator CTA",
    match:  (l) => labelMatches(l, "roi", "roi_calculator", "calculator", "business_case", "bereken", "rendement"),
    signals: [{ profileKey: "roi_focused", points: 20 }],
  },
  {
    label:  "compare / alternatives CTA",
    match:  (l) => labelMatches(l, "compare", "vergelijken", "alternatives", "alternatieven", "versus"),
    signals: [{ profileKey: "comparison_focused", points: 15 }],
  },

  // ── Mister Chameleon — specific CTA rules ────────────────────────────────

  {
    label:  "see how it works / explore platform CTA",
    match:  (l) => labelMatches(l, "how_it_works", "see_how", "explore_platform", "hoe_het_werkt", "hoe_werkt_het", "see_platform", "explore"),
    signals: [
      { profileKey: "personalization_seeker", points: 18 },
      { profileKey: "conversion_optimizer",   points: 8  },
    ],
  },
  {
    label:  "book demo / meeting / schedule CTA",
    match:  (l) => labelMatches(l, "book_demo", "book_a_demo", "schedule", "plan_demo", "boek_demo", "plan_een_gesprek", "gesprek_inplannen", "meeting", "afspraak", "talk_to_us", "contact_sales", "see_it_in_action", "in_actie_zien", "live_demo"),
    signals: [
      { profileKey: "demo_intent",              points: 30 },
      { profileKey: "marketing_decision_maker", points: 12 },
    ],
  },
  {
    label:  "start for free / trial CTA (SaaS PLG)",
    match:  (l) => labelMatches(l, "start_for_free", "start_gratis", "gratis_starten", "free_trial", "start_trial", "try_free", "probeer_gratis", "aan_de_slag", "get_started"),
    signals: [
      { profileKey: "saas_audience",          points: 20 },
      { profileKey: "conversion_optimizer",   points: 10 },
    ],
  },
  {
    label:  "agency / partner / voor bureaus CTA",
    match:  (l) => labelMatches(l, "for_agencies", "voor_bureaus", "agency", "bureau", "partner", "white_label", "reseller", "partner_worden"),
    signals: [
      { profileKey: "agency_partner_interest", points: 25 },
    ],
  },
  {
    label:  "ROI / bereken savings CTA",
    match:  (l) => labelMatches(l, "calculate_roi", "bereken_besparing", "roi_calculator", "business_case", "bereken", "zie_de_resultaten", "see_results", "wat_levert_het_op"),
    signals: [
      { profileKey: "conversion_optimizer",     points: 20 },
      { profileKey: "marketing_decision_maker", points: 12 },
    ],
  },
  {
    label:  "see cases / view results CTA",
    match:  (l) => labelMatches(l, "see_cases", "bekijk_cases", "customer_stories", "case_studies", "results", "resultaten", "see_results"),
    signals: [
      { profileKey: "marketing_decision_maker", points: 12 },
      { profileKey: "conversion_optimizer",     points: 8  },
    ],
  },

  // ── Careers ───────────────────────────────────────────────────────────────

  {
    label:  "apply / solliciteren CTA (high-intent)",
    match:  (l) => labelMatches(l, "apply", "apply_now", "apply_here", "solliciteren", "solliciteer", "direct_solliciteren"),
    signals: [
      { profileKey: "high_intent_applicant",  points: 30 },
      { profileKey: "job_specific_candidate", points: 15 },
    ],
  },
  {
    label:  "view jobs CTA",
    match:  (l) => labelMatches(l, "jobs", "vacatures", "view_jobs", "bekijk_vacatures", "open_positions"),
    signals: [{ profileKey: "candidate_explorer", points: 12 }],
  },

  // ── Commerce ──────────────────────────────────────────────────────────────

  {
    label:  "add to cart CTA",
    match:  (l) => labelMatches(l, "add_to_cart", "add_cart", "in_wagen", "toevoegen", "kopen", "buy_now"),
    signals: [
      { profileKey: "high_purchase_intent", points: 25 },
      { profileKey: "product_explorer",     points: 10 },
    ],
  },
  {
    label:  "checkout / order CTA",
    match:  (l) => labelMatches(l, "checkout", "afrekenen", "pay", "betalen", "bestellen", "order_now"),
    signals: [
      { profileKey: "high_purchase_intent", points: 20 },
      { profileKey: "cart_ready",           points: 20 },
    ],
  },
  {
    label:  "deal / coupon CTA",
    match:  (l) => labelMatches(l, "deal", "korting", "coupon", "discount", "aanbieding", "sale"),
    signals: [{ profileKey: "deal_sensitive", points: 15 }],
  },

  // ── Real Estate ───────────────────────────────────────────────────────────

  {
    label:  "book viewing CTA",
    match:  (l) => labelMatches(l, "book_viewing", "bezichtiging", "viewing", "schedule_viewing", "inplannen", "plan_visit"),
    signals: [
      { profileKey: "viewing_ready",     points: 30 },
      { profileKey: "property_explorer", points: 10 },
    ],
  },
  {
    label:  "make offer / mortgage CTA",
    match:  (l) => labelMatches(l, "make_offer", "bod_uitbrengen", "mortgage", "hypotheek", "financing", "financiering"),
    signals: [
      { profileKey: "buyer_intent",      points: 25 },
      { profileKey: "property_explorer", points: 8  },
    ],
  },
  {
    label:  "investment info CTA",
    match:  (l) => labelMatches(l, "invest", "investeren", "belegging", "rendement", "yield", "rental_info"),
    signals: [{ profileKey: "investor_style_interest", points: 20 }],
  },
];

// ── Public resolver ───────────────────────────────────────────────────────────

/**
 * Resolves a behavioral event into a list of (profileKey, points, reason) signals.
 *
 * @param event  The behavioral event to resolve.
 * @returns      Array of signals to apply to the scoring state.
 *               Empty array when no rules match.
 */
export function resolveSignals(event: BehavioralEvent): ResolvedSignal[] {
  const signals: ResolvedSignal[] = [];

  const { type, url, label } = event;

  // ── URL-based events ─────────────────────────────────────────────────────
  if (
    (type === "page_view" || type === "repeat_visit" ||
     type === "form_start" || type === "form_submit") &&
    url
  ) {
    const pathname   = extractPathname(url);
    const multiplier = URL_EVENT_MULTIPLIER[type] ?? 1.0;

    for (const rule of URL_SIGNAL_RULES) {
      if (rule.match(pathname)) {
        for (const { profileKey, points } of rule.signals) {
          const adjusted = Math.round(points * multiplier * 10) / 10;
          if (adjusted > 0) {
            signals.push({
              profileKey,
              points: adjusted,
              reason: `${type}:${pathname} — ${rule.label}`,
            });
          }
        }
      }
    }
  }

  // ── CTA click ────────────────────────────────────────────────────────────
  if (type === "cta_click" && label) {
    const normalizedLabel = normLabel(label);

    for (const rule of CTA_SIGNAL_RULES) {
      if (rule.match(normalizedLabel)) {
        for (const { profileKey, points } of rule.signals) {
          signals.push({
            profileKey,
            points,
            reason: `cta_click:${label} — ${rule.label}`,
          });
        }
      }
    }

    // Augment with URL signals at ×0.3 when URL is also provided.
    // E.g. clicking "add_to_cart" on /shop/product-x reinforces product_explorer.
    if (url) {
      const pathname = extractPathname(url);
      for (const rule of URL_SIGNAL_RULES) {
        if (rule.match(pathname)) {
          for (const { profileKey, points } of rule.signals) {
            const adjusted = Math.round(points * 0.3 * 10) / 10;
            if (adjusted > 0) {
              signals.push({
                profileKey,
                points: adjusted,
                reason: `cta_click+url:${pathname} — ${rule.label} (context)`,
              });
            }
          }
        }
      }
    }
  }

  // Merge duplicate profileKeys by summing points.
  return mergeSignals(signals);
}

// ── Internal: merge duplicate profileKeys ─────────────────────────────────────

function mergeSignals(signals: ResolvedSignal[]): ResolvedSignal[] {
  const map = new Map<string, ResolvedSignal>();
  for (const signal of signals) {
    const existing = map.get(signal.profileKey);
    if (existing) {
      map.set(signal.profileKey, {
        ...existing,
        points: existing.points + signal.points,
        reason: `${existing.reason}; ${signal.reason}`,
      });
    } else {
      map.set(signal.profileKey, signal);
    }
  }
  return [...map.values()];
}
