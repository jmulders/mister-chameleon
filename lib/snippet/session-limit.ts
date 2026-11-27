/**
 * The monthly session limit for the two API paths: snippet decide and v1/slot.
 *
 * A tenant buys a number of personalised sessions per month. The pages the
 * platform hosts itself keep to that number: they count each visit and serve
 * the default page once the month is used up (lib/pipeline/homepage-pipeline.ts
 * and lib/cms-page-decision.ts). The snippet and the slot API did neither. A
 * tenant whose site runs on its own CMS, which is every Statamic and WordPress
 * tenant, was never counted and never stopped: the limit on the price page did
 * not exist for them.
 *
 * Both routes now ask the same two questions through this file.
 *
 *   1. May this tenant still personalise? The verdict is the one the hosted
 *      pages use, remembered for a minute. Over the limit the route serves the
 *      default: the rules are skipped, forms and default content keep working.
 *
 *   2. Does this call count as a session? Only when it was personalised for a
 *      visitor we may recognise: under the limit, not a bot, with a visitor id
 *      and with personalisation consent. Without consent the routes store
 *      nothing per visitor (see decision-persistence.ts) and the count is a
 *      row per visitor, so such a visit is served and not counted. It is still
 *      stopped once the limit is reached.
 *
 * The count is one row per (tenant, month, visitor id), the same table and key
 * the hosted pages write, so a visitor is one session however many pages or
 * slots the visit asks for.
 */

import type { SessionCapResult } from "@/billing/plan-enforcement";

export interface ApiVisit {
  /** The cap verdict for the tenant. */
  overLimit:              boolean;
  /** Clear bot by User-Agent, or flagged as a bot by the adapter. */
  isBot:                  boolean;
  /** The stable visitor id the snippet or adapter sent, when there is one. */
  visitorId:              string | null | undefined;
  /** Effective personalisation consent (tenant ceiling already applied). */
  personalizationConsent: boolean;
}

/**
 * Whether this API call counts as a personalised session. Pure.
 *
 * Over the limit nothing counts: the visitor got the default, and counting it
 * would raise the very number that decides the limit.
 */
export function apiVisitCounts(visit: ApiVisit): boolean {
  if (visit.overLimit) return false;
  if (visit.isBot) return false;
  if (!visit.personalizationConsent) return false;
  return typeof visit.visitorId === "string" && visit.visitorId !== "";
}

// ── Counted once per instance ─────────────────────────────────────────────────
//
// The slot API is called once per slot, up to six times for one page, and the
// snippet once per pageview. The table already makes a second insert for the
// same visitor a no-op, but it is still a round trip. A visitor this instance
// has counted this month is not sent again.

export interface CountedOnce {
  /** True the first time a key is seen, false after that. */
  firstTime(key: string): boolean;
  /** Forget a key, so a failed write is tried again. */
  forget(key: string): void;
  readonly size: number;
}

/**
 * A bounded set of keys. When it is full it is emptied: the worst case is one
 * extra insert per visitor, which the table ignores.
 */
export function createCountedOnce(max = 5_000): CountedOnce {
  const seen = new Set<string>();
  return {
    firstTime(key) {
      if (seen.has(key)) return false;
      if (seen.size >= max) seen.clear();
      seen.add(key);
      return true;
    },
    forget(key) {
      seen.delete(key);
    },
    get size() {
      return seen.size;
    },
  };
}

export function apiSessionKey(tenantId: string, monthKey: string, visitorId: string): string {
  return `${tenantId}|${monthKey}|${visitorId}`;
}

const countedThisInstance = createCountedOnce();

/**
 * The cap verdict, or null when it could not be read.
 *
 * A failed read never stops personalisation: the route goes on as if the
 * tenant is under the limit, as the hosted pages do.
 */
export async function readApiSessionCap(tenantId: string): Promise<SessionCapResult | null> {
  if (!tenantId) return null;
  try {
    const { checkSessionSoftCapRemembered } = await import("@/billing/plan-enforcement");
    return await checkSessionSoftCapRemembered(tenantId);
  } catch {
    return null;
  }
}

export interface CountApiSessionDeps {
  record:   (tenantId: string, sessionId: string, cap?: SessionCapResult) => Promise<void>;
  monthKey: () => string;
  counted:  CountedOnce;
}

/**
 * Count one visitor for this month. Never throws.
 *
 * Call it only when apiVisitCounts() said yes, and after the response where
 * the route can (next/server `after`), so the visitor does not wait for it.
 */
export async function countApiSession(
  tenantId:  string,
  visitorId: string,
  cap:       SessionCapResult | null,
  deps?:     CountApiSessionDeps,
): Promise<void> {
  if (!tenantId || !visitorId) return;
  const counted = deps?.counted ?? countedThisInstance;
  let key = "";
  try {
    let record   = deps?.record;
    let monthKey = deps?.monthKey;
    if (!record || !monthKey) {
      const billing = await import("@/billing/plan-enforcement");
      record   = record   ?? billing.recordPersonalizedSession;
      monthKey = monthKey ?? billing.currentMonthKey;
    }
    key = apiSessionKey(tenantId, cap?.monthKey ?? monthKey(), visitorId);
    if (!counted.firstTime(key)) return;
    await record(tenantId, visitorId, cap ?? undefined);
  } catch {
    // The write failed before it was sent: let a later call try again.
    if (key) counted.forget(key);
  }
}
