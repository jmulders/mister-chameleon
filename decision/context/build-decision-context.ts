/**
 * Decision Context Builder
 *
 * Centralises the construction of a fully-populated decision context so that
 * every call site — page routes, API handlers, edge middleware — produces an
 * identical, complete input to the rules engine and AI providers.
 *
 * ─── Why this module exists ──────────────────────────────────────────────────
 *
 *   Previously, page.tsx built the decision input inline through three
 *   independent steps:
 *
 *     const context = detectVisitorContext(request);
 *     const history = await fetchVisitorHistory(sessionId);
 *     const input   = buildDecisionInput(context, history);
 *
 *   This worked for a single page but would be duplicated verbatim in every
 *   future route or handler that needs decision context.  It also gave no
 *   single place to verify completeness, add logging, or attach page-level
 *   metadata (pathname, tenantId, templateKey, pageType).
 *
 *   `buildDecisionContext` is that single place.
 *
 * ─── What it returns ─────────────────────────────────────────────────────────
 *
 *   A `RuleEvaluationContext`, which extends `DecisionInput` with optional
 *   page-level fields.  Because `RuleEvaluationContext` satisfies `DecisionInput`,
 *   it can be passed to every decision provider unchanged.  The rules engine
 *   additionally reads the optional page-level fields when present.
 *
 * ─── Client vs server ────────────────────────────────────────────────────────
 *
 *   This module is server-side only.  It reads from the Web API `Request`
 *   object (headers, URL) and from the pre-fetched `VisitorHistory`.
 *
 *   Fields that are only available client-side (e.g. localStorage-based
 *   pageViewCount fallback) are populated from `history` here; if `history`
 *   came from `emptyHistory()` (DB miss / first visit), those fields are
 *   safe zero-values.  Client-side enhancement can be layered on top via
 *   the `PageTracker` component without touching this module.
 *
 * ─── Helpers ─────────────────────────────────────────────────────────────────
 *
 *   The helpers below are thin, pure, independently testable functions.
 *   Most delegate to existing context-layer utilities (detectVisitorContext,
 *   parseReferrer, detectDevice) so there is no logic duplication.
 */

import { detectVisitorContext } from "@/context";
import { parseReferrer, detectDevice } from "@/context/helpers";
import { emptyHistory } from "@/context/visitor-history";
import type { VisitorHistory } from "@/context/visitor-history";
import type { TrafficSource, DeviceType } from "@/context/types";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { logger } from "@/lib/logger";

// ── Params ─────────────────────────────────────────────────────────────────────

/**
 * Parameters accepted by `buildDecisionContext`.
 *
 * Only `request` is required; everything else enhances the context when
 * available.  Optional history and page-level fields degrade gracefully
 * to safe defaults so the decision engine never receives an incomplete input.
 */
export interface BuildDecisionContextParams {
  /**
   * The incoming HTTP request.
   * Used to extract headers (User-Agent, Referer), cookies (mc_seen),
   * and URL query parameters (UTM, pathname).
   *
   * Accepts any standard Web API `Request` — from a Next.js Route Handler,
   * Middleware, or a unit test.
   */
  request: Request;

  /**
   * Pre-fetched visitor history for this session.
   *
   * Call `fetchVisitorHistory(sessionId)` before `buildDecisionContext` and
   * pass the resolved value here.  Defaults to `emptyHistory()` — safe zero
   * values for all behavior fields — when omitted or on DB error.
   *
   * History fields surfaced in the context:
   *   pageViewCount   — prior page loads in this session
   *   ctaClickCount   — CTA clicks in this session
   *   hasClickedCta   — derived boolean
   *   lastHeroKey     — most recently served hero variant
   *   lastCtaKey      — most recently served CTA variant
   *   firstSeenAt     — first event timestamp for this session
   *   fromDatabase    — whether the data came from DB (vs safe defaults)
   */
  history?: VisitorHistory;

  /**
   * Active tenant identifier.
   * Written into context so tenant-aware rules can match on `tenantId`.
   */
  tenantId?: string | null;

  /**
   * Page template key, e.g. `"homepage"` or `"standard-landing"`.
   * Used by rules that target specific page templates.
   */
  templateKey?: string | null;

  /**
   * Semantic page type, e.g. `"homepage"`, `"landing"`, `"article"`.
   * Used by rules that target broad page categories.
   */
  pageType?: string | null;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Build a fully-populated `RuleEvaluationContext` (a superset of `DecisionInput`)
 * ready to pass to any decision provider.
 *
 * Calling this function is the only supported way to construct decision context
 * in the application.  Never build `DecisionInput` or `RuleEvaluationContext`
 * inline.
 *
 * Guarantees:
 *   - All required fields are always present (never undefined/null unexpectedly)
 *   - Never throws — all I/O-free, all fallbacks applied internally
 *   - Safe to call on every request (pure transformation, no side effects)
 *   - Emits a `logger.debug` entry for tracing (suppressed in production)
 *
 * @example
 * // In a Next.js App Router page:
 * const history = await fetchVisitorHistory(sessionId);   // kick off early
 * const input   = buildDecisionContext({
 *   request,
 *   history,
 *   tenantId:    tenantConfig.tenantId,
 *   templateKey: "homepage",
 *   pageType:    "homepage",
 * });
 * const plan = await decisionProvider.getHomepagePlan(input);
 */
export function buildDecisionContext(
  params: BuildDecisionContextParams,
): RuleEvaluationContext {
  const {
    request,
    history     = emptyHistory(),
    tenantId    = null,
    templateKey = null,
    pageType    = null,
  } = params;

  // ── A. Traffic / acquisition + B. Device / session ─────────────────────────
  //
  // detectVisitorContext handles:
  //   source, device, visitType, utmSource, utmMedium, utmCampaign,
  //   utmContent, utmTerm, referrerDomain, rawReferrer, userAgent
  //
  // Extracted once from the request; we reuse rather than duplicate.
  const visitorContext = detectVisitorContext(request);

  // Pathname — extracted separately (not part of VisitorContext today).
  const pathname = getPathnameFromRequest(request);

  // ── C. Behavior / history (from VisitorHistory) ─────────────────────────────
  //
  // pageViewCount, ctaClickCount, hasClickedCta, lastHeroKey, lastCtaKey,
  // firstSeenAt, fromDatabase — all carried in `history`.
  //
  // On the server there is no localStorage; `emptyHistory()` provides safe
  // zero-values for first-visit / DB-miss scenarios.  When the DB responds
  // successfully, `history.fromDatabase === true` and all counts are real.
  // Client-side enhancement (PageTracker) can update counts asynchronously.
  const pageViewCount  = getPageViewCount(history);
  const ctaClickCount  = getCtaClickCount(history);
  const hasClickedCta  = getHasClickedCta(history);

  // ── Assemble ─────────────────────────────────────────────────────────────────

  const ctx: RuleEvaluationContext = {
    ...visitorContext,
    history: {
      ...history,
      // Expose derived helpers so call sites don't need to re-derive them.
      pageViewCount,
      ctaClickCount,
      hasClickedCta,
    },
    // Page-level context (optional in RuleEvaluationContext)
    pathname,
    tenantId,
    templateKey,
    pageType,
  };

  // ── Logging ──────────────────────────────────────────────────────────────────

  logger.debug("[decision-context]", {
    // Traffic / acquisition
    source:         ctx.source,
    utmSource:      ctx.utmSource,
    utmMedium:      ctx.utmMedium,
    utmCampaign:    ctx.utmCampaign,
    referrerDomain: ctx.referrerDomain,
    // Device / session
    device:         ctx.device,
    visitType:      ctx.visitType,
    pathname,
    // Behavior / history
    pageViewCount,
    ctaClickCount,
    hasClickedCta,
    historyFromDb:  history.fromDatabase,
    // Page context
    tenantId,
    templateKey,
    pageType,
  });

  return ctx;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
//
// Small, pure, independently testable helpers.
// Each is exported so callers can use them in isolation (e.g. unit tests).

/**
 * Extract UTM query parameters from a URL string or URL object.
 *
 * Returns all five standard UTM dimensions; each is `null` when absent.
 *
 * @example
 * getUtmParams("https://example.com?utm_source=google&utm_medium=cpc")
 * // → { utmSource: "google", utmMedium: "cpc", utmCampaign: null, ... }
 */
export function getUtmParams(url: string | URL): {
  utmSource:   string | null;
  utmMedium:   string | null;
  utmCampaign: string | null;
  utmContent:  string | null;
  utmTerm:     string | null;
} {
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return {
      utmSource:   parsed.searchParams.get("utm_source"),
      utmMedium:   parsed.searchParams.get("utm_medium"),
      utmCampaign: parsed.searchParams.get("utm_campaign"),
      utmContent:  parsed.searchParams.get("utm_content"),
      utmTerm:     parsed.searchParams.get("utm_term"),
    };
  } catch {
    return {
      utmSource: null, utmMedium: null, utmCampaign: null,
      utmContent: null, utmTerm: null,
    };
  }
}

/**
 * Classify a User-Agent string as `"mobile"` or `"desktop"`.
 *
 * Thin re-export of the existing `detectDevice` helper so consumers of this
 * module don't need to reach into `@/context/helpers` directly.
 *
 * Defaults to `"desktop"` when the User-Agent is absent or unrecognised.
 */
export { detectDevice } from "@/context/helpers";

/**
 * Resolve the primary traffic source from UTM and referrer signals.
 *
 * Precedence:
 *   1. `utmSource`  — explicit, marketer-controlled, highest trust
 *   2. `referrer`   — browser-provided Referer header value
 *   3. `"direct"`   — no referrer, no UTM (typed URL / bookmark)
 *   4. `"unknown"`  — referrer present but domain unrecognised
 *
 * This is a pure subset of the logic in `detectVisitorContext`.
 * When working from a full `Request`, prefer `detectVisitorContext` directly.
 */
export function detectSource(
  utmSource: string | null,
  referrer:  string | null,
): TrafficSource {
  if (utmSource) {
    const normalised = utmSource.toLowerCase().trim();
    const SOURCE_MAP: Record<string, TrafficSource> = {
      linkedin: "linkedin", "linkedin.com": "linkedin",
      google:   "google",   "google.com":   "google",
      "google-ads": "google", googleads: "google", adwords: "google",
    };
    return SOURCE_MAP[normalised] ?? "unknown";
  }

  if (referrer) {
    const parsed = parseReferrer(referrer);
    if (parsed?.inferredSource) return parsed.inferredSource;
    return "unknown";
  }

  return "direct";
}

/**
 * Extract the referrer domain from a `Headers` object.
 *
 * Returns the lowercased hostname without `www.`, e.g. `"linkedin.com"`.
 * Returns `null` when the Referer header is absent or the URL is malformed.
 */
export function getReferrerDomain(headers: Headers): string | null {
  const raw = headers.get("referer") ?? headers.get("referrer") ?? null;
  return parseReferrer(raw)?.domain ?? null;
}

/**
 * Detect the visit type (new vs returning) from request cookies.
 *
 * Reads the `mc_seen` cookie set by the client-side PageTracker.
 * Returns `"returning"` when the cookie is present with value `"1"`,
 * `"new"` otherwise.
 *
 * Server-side only — on the server, "new" is the safe default for the
 * current in-flight request even if the cookie will be written later.
 */
export function getVisitType(cookieHeader: string | null): "new" | "returning" {
  if (!cookieHeader) return "new";
  // Lightweight inline parse — avoids importing readCookies for a single check
  for (const pair of cookieHeader.split(";")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    if (pair.slice(0, eqIdx).trim() === "mc_seen") {
      return pair.slice(eqIdx + 1).trim() === "1" ? "returning" : "new";
    }
  }
  return "new";
}

/**
 * Derive the page-view count from the visitor's first-party history.
 *
 * On the server this comes from the `events` table (rows with type
 * `page_view` for this session).  On the client, the `PageTracker`
 * component maintains a live count in localStorage and syncs it
 * asynchronously — this function is the server-side read path.
 *
 * Returns `0` for brand-new sessions or when DB is unavailable.
 */
export function getPageViewCount(history: VisitorHistory): number {
  return history.pageViewCount;
}

/**
 * Derive the CTA-click count from the visitor's first-party history.
 *
 * Reflects the number of `cta_click` events recorded for this session.
 * Returns `0` for brand-new sessions or when DB is unavailable.
 */
export function getCtaClickCount(history: VisitorHistory): number {
  return history.ctaClickCount;
}

/**
 * Derive the `hasClickedCta` boolean from the visitor's first-party history.
 *
 * True when at least one `cta_click` event has been recorded for this
 * session.  Consistent with `VisitorHistory.hasClickedCta` — exposed here
 * for symmetry with the other helpers.
 */
export function getHasClickedCta(history: VisitorHistory): boolean {
  return history.hasClickedCta;
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Extract the URL pathname from a `Request` object.
 *
 * Returns `null` when the URL is malformed (safe default; pathname rules
 * simply won't match rather than crashing).
 */
function getPathnameFromRequest(request: Request): string | null {
  try {
    return new URL(request.url).pathname;
  } catch {
    return null;
  }
}
