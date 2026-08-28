/**
 * POST /api/enrichment/leadinfo
 *
 * Receives a normalised Leadinfo identify result from the LeadinfoProvider
 * client component and persists it in the mc_li httpOnly cookie so that
 * subsequent server renders can include Leadinfo data in the decision context.
 *
 * ─── Why a dedicated endpoint? ────────────────────────────────────────────────
 *
 *   The Leadinfo Identify API is called from the visitor's browser — the real
 *   client IP is used, which is more accurate than a server-to-server call that
 *   may see a CDN/load-balancer address.
 *
 *   Setting the result in a httpOnly cookie (rather than document.cookie or
 *   localStorage) keeps it opaque to third-party scripts while making it
 *   available on all subsequent server requests.
 *
 * ─── Cookie set ───────────────────────────────────────────────────────────────
 *
 *   mc_li — compact URL-encoded JSON.  Max ≈ 300 bytes.
 *           httpOnly — not readable by client JS.
 *           SameSite=Lax, Secure in production.
 *           MaxAge = 7 days (see LEADINFO_COOKIE_MAX_AGE).
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     matched:         boolean;
 *     companyId:       string | null;
 *     companyName:     string | null;
 *     companyCity:     string | null;
 *     companyDomain:   string | null;
 *     companyCountry:  string | null;
 *     employees:       string | null;
 *     employeesTotal:  number | null;
 *     salesVolume:     string | null;
 *     cocNumber:       string | null;
 *     branchCode:      string | null;
 *     branchCodeSic87: string | null;
 *   }
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   - All incoming values are type-checked and sanitised before serialisation.
 *   - No secret or PII data is accepted — company firmographic data only.
 *   - The endpoint accepts same-origin requests only (no CORS header set).
 */

import { NextRequest, NextResponse, after } from "next/server";
import { createClient }               from "@supabase/supabase-js";
import { ipCompanyCache }             from "@/enrichment/ip-company-store";
import { leadinfoDataToCacheOutput }  from "@/enrichment/leadinfo-cache-map";
import { extractIpFromRequest }       from "@/lib/request-ip";
import { readConsentFromCookieHeader } from "@/lib/consent/server-consent";
import {
  serializeLeadinfoData,
  LEADINFO_COOKIE,
  LEADINFO_COOKIE_MAX_AGE,
} from "@/context/leadinfo-context";
import type { LeadinfoData }           from "@/context/leadinfo-context";
import { logger }                      from "@/lib/logger";
import { getActiveTenant }             from "@/tenant/server";
import { SESSION_COOKIE }              from "@/data/session";
import { trackUsageEvent, buildIdempotencyKey } from "@/billing/usage-events";
import { debitWallet }                 from "@/billing/wallet";
import { resolveCreditCost, getStaticCustomerPrice } from "@/billing/pricing";
import { resolveFirstPartyTenantFlags } from "@/lib/enrichment/firstparty-tenant-flags";
import { checkWalletForEnrichment }    from "@/billing/enrichment-guard";

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate and sanitise the incoming request body into LeadinfoData.
 * Returns null when the body is missing `matched` or fails basic sanity checks.
 */
function parseBody(raw: unknown): LeadinfoData | null {
  if (typeof raw !== "object" || raw === null) return null;

  const body = raw as Record<string, unknown>;

  // `matched` is required and must be boolean.
  if (typeof body.matched !== "boolean") return null;

  return {
    matched:         body.matched,
    companyId:       strOrNull(body.companyId,       100),
    companyName:     strOrNull(body.companyName,      200),
    companyCity:     strOrNull(body.companyCity,      100),
    companyDomain:   strOrNull(body.companyDomain,    253), // max hostname length
    companyCountry:  strOrNull(body.companyCountry,   2),   // ISO alpha-2
    employees:       strOrNull(body.employees,        50),
    employeesTotal:  numOrNull(body.employeesTotal),
    salesVolume:     strOrNull(body.salesVolume,      50),
    cocNumber:       strOrNull(body.cocNumber,        20),
    branchCode:      strOrNull(body.branchCode,       20),
    branchCodeSic87: strOrNull(body.branchCodeSic87,  20),
  };
}

function strOrNull(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string" || val.length === 0) return null;
  return val.slice(0, maxLen);
}

function numOrNull(val: unknown): number | null {
  if (typeof val !== "number" || !isFinite(val)) return null;
  // Guard against absurdly large integers (cap at 10M employees).
  if (val < 0 || val > 10_000_000) return null;
  return Math.round(val);
}

// ── Service-role Supabase client (lazy, server-only) ─────────────────────────

function getBillingClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const data = parseBody(body);

  if (!data) {
    return NextResponse.json(
      { error: "Invalid request body: 'matched' (boolean) is required." },
      { status: 400 },
    );
  }

  logger.debug("[api/enrichment/leadinfo] persisting Leadinfo result", {
    matched:        data.matched,
    companyName:    data.companyName,
    companyDomain:  data.companyDomain,
    companyCountry: data.companyCountry,
  });

  // ── Resolve tenant and session (for billing) ────────────────────────────────
  // These are best-effort — if tenant resolution fails, we still set the cookie
  // so the visitor experience is never degraded by a billing lookup error.

  let tenantId:  string | null = null;
  let sessionId: string | null = null;
  let creditDeducted = false;

  try {
    const tenant = await getActiveTenant();
    tenantId  = tenant.tenantId ?? null;
    sessionId = request.cookies.get(SESSION_COOKIE)?.value ?? null;
  } catch (err) {
    logger.warn("[api/enrichment/leadinfo] could not resolve tenant for billing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── Wallet debit + usage recording (matched lookups only) ────────────────────
  //
  // Billing model:
  //   • Non-matched lookups (matched=false) cost 0 — no enrichment value delivered.
  //   • Matched lookups cost 3 cents (leadinfo_lookup, category=recognition).
  //
  // Debit path:
  //   debitWallet() → public.debit_wallet RPC (single debit path).
  //   The RPC atomically decrements tenant_wallets.balance_cents and writes a
  //   wallet_ledger row (entry_type=enrichment_debit, category=recognition).
  //
  // Pre-flight guard:
  //   checkWalletForEnrichment() runs before the debit attempt.  When the wallet
  //   is empty, frozen, or suspended, the debit is skipped (not attempted) and
  //   the enrichment_usage row is marked wallet_blocked=true.
  //
  // Ledger alignment:
  //   Both enrichment_usage and usage_events are written so the admin billing
  //   panel shows a complete audit trail aligned with the wallet ledger.

  // Leadinfo price (recognition category), resolved through the shared pricing
  // helper so it is admin-editable at /admin/platform/billing/pricing instead of
  // hardcoded: enrichment_pricing.credit_cost for `leadinfo_lookup`, falling back
  // to the static default (3 credits = €0.03). 1 credit = €0.01. Starts at the
  // static value (no DB read for no-match) and is refined from the DB below.
  let LEADINFO_CREDIT_COST = getStaticCustomerPrice("leadinfo_lookup");

  if (tenantId && data.matched) {
    const client         = getBillingClient();
    LEADINFO_CREDIT_COST  = await resolveCreditCost(client, "leadinfo_lookup", LEADINFO_CREDIT_COST);
    const idempotencyKey = sessionId
      ? buildIdempotencyKey("leadinfo_lookup", tenantId, sessionId)
      : null;

    // ── Pre-flight wallet guard ──────────────────────────────────────────────
    let walletBlocked    = false;
    let walletBlockReason: string | undefined;

    try {
      const guard = await checkWalletForEnrichment(client, tenantId);
      if (guard.blocked) {
        walletBlocked     = true;
        walletBlockReason = guard.blockReason ?? "wallet_blocked";
        logger.warn("[api/enrichment/leadinfo] wallet guard blocked debit", {
          tenantId,
          blockReason:  walletBlockReason,
          balanceCents: guard.balanceCents,
        });
      }
    } catch (guardErr) {
      // Guard failure → fail open (attempt debit anyway).
      logger.warn("[api/enrichment/leadinfo] wallet guard error — failing open", {
        tenantId,
        error: guardErr instanceof Error ? guardErr.message : String(guardErr),
      });
    }

    // ── Wallet debit via debit_wallet RPC ────────────────────────────────────
    if (!walletBlocked) {
      try {
        const debitResult = await debitWallet(
          client,
          tenantId,
          LEADINFO_CREDIT_COST,
          "enrichment_usage",      // referenceType
          "leadinfo_route",        // referenceId — identifies this call site
          `leadinfo_lookup — client-side identify (matched)`,
          "recognition",           // category → written to wallet_ledger
        );

        creditDeducted = debitResult.success;

        if (!debitResult.success) {
          walletBlocked     = true;
          walletBlockReason = debitResult.error ?? "insufficient_balance";
          logger.warn("[api/enrichment/leadinfo] debit_wallet: debit blocked", {
            tenantId,
            balanceAfter: debitResult.balanceAfter,
            error:        debitResult.error,
          });
        }
      } catch (debitErr) {
        // Debit failure must not break the visitor-facing response.
        logger.error("[api/enrichment/leadinfo] debitWallet error", {
          tenantId,
          error: debitErr instanceof Error ? debitErr.message : String(debitErr),
        });
      }
    }

    // ── usage_events row (single canonical write) ────────────────────────────
    //
    // enrichment_usage has been retired (migration 068).
    // All billing data — including wallet_blocked signal — is in usage_events.
    const chargedCents = creditDeducted ? LEADINFO_CREDIT_COST : 0;
    try {
      await trackUsageEvent(
        getBillingClient(),
        {
          tenantId,
          eventType:       "leadinfo_lookup",
          creditsCost:     chargedCents,
          creditsUsed:     chargedCents,
          price:           chargedCents / 100,   // EUR
          billable:        true,
          category:        "recognition",
          featureKey:      "leadinfo_lookup",
          success:         true,
          cacheHit:        false,
          errorCode:       walletBlocked ? (walletBlockReason ?? "wallet_blocked") : undefined,
          sessionId:       sessionId ?? undefined,
          idempotencyKey:  idempotencyKey ?? undefined,
          metadata: {
            companyName:      data.companyName,
            companyDomain:    data.companyDomain,
            companyCountry:   data.companyCountry,
            companyId:        data.companyId,
            matched:          true,
            unitPriceCents:   LEADINFO_CREDIT_COST,
            creditDeducted,
            walletBlocked,
            walletBlockReason,
          },
        },
      );
    } catch (eventErr) {
      // Usage event failures are non-fatal — visitor response is never degraded.
      logger.error(
        `[api/enrichment/leadinfo] usage event tracking error` +
        ` | table=usage_events | tenant=${tenantId}` +
        ` | ${eventErr instanceof Error ? eventErr.message : String(eventErr)}`,
      );
    }
  } else if (tenantId && !data.matched && sessionId) {
    // Track no-match events (0 cost) for completeness.
    // These are useful for understanding Leadinfo hit-rate per tenant.
    try {
      await trackUsageEvent(
        getBillingClient(),
        {
          tenantId,
          eventType:      "leadinfo_lookup",
          creditsCost:    0,
          category:       "recognition",
          featureKey:     "leadinfo_lookup",
          success:        false,
          cacheHit:       false,
          errorCode:      "no_match",
          sessionId,
          idempotencyKey: buildIdempotencyKey("leadinfo_lookup", tenantId, sessionId),
          metadata:       { matched: false },
        },
      );
    } catch {
      // Swallow — non-matched tracking is purely informational.
    }
  }

  // ── Persist enrichment data in cookie (always, regardless of billing) ───────

  const cookieValue = serializeLeadinfoData(data);
  const isSecure    = process.env.NODE_ENV === "production";
  const response    = NextResponse.json({ ok: true }, { status: 200 });

  // ── X-Billing-Debug response header (dev / debug flag only) ─────────────────
  //
  // In dev or when BILLING_DEBUG=1, surface a JSON summary of the billing outcome
  // in the response header so it's visible in browser devtools → Network tab.
  // The header is omitted in production builds to avoid leaking billing metadata.
  if (process.env.NODE_ENV !== "production" || process.env.BILLING_DEBUG === "1") {
    const debugSummary = {
      matched:        data.matched,
      billable:       !!(tenantId && data.matched),
      tenant_id:      tenantId,
      session_id:     sessionId,
      credit_cost:    creditDeducted ? LEADINFO_CREDIT_COST : 0,
      credit_deducted: creditDeducted,
      enrichment_type: "leadinfo_lookup",
      category:       "recognition",
    };
    response.headers.set("X-Billing-Debug", JSON.stringify(debugSummary));
  }

  response.cookies.set(LEADINFO_COOKIE, cookieValue, {
    maxAge:   LEADINFO_COOKIE_MAX_AGE,
    path:     "/",
    httpOnly: true,
    sameSite: "lax",
    secure:   isSecure,
  });

  // ── Warm the server-side IP→company cache ───────────────────────────────────
  //
  // The client identified this company on the REAL visitor IP. Upsert it into the
  // platform-wide ip_company_cache (keyed by ip_hash) so a later server-side
  // decision from the same IP is a cache hit — no new paid Leadinfo lookup. Uses
  // the same IP extraction as the read side (extractIpFromRequest) and the shared
  // ipCompanyCache writer, so key + schema/TTL stay consistent (refreshed_at = now).
  //
  // Consent: gated on the visitor's enrichment consent — consistent with the
  // server-side staged enrichers, which only read/write this cache under enrichment
  // consent. So gating the write costs nothing (an un-consented repeat visitor
  // never triggers a cache read) and keeps the cache consent-consistent.
  //
  // Best-effort: scheduled via after() so it never blocks the response, and
  // ipCompanyCache.set never throws.
  if (data.matched) {
    const ip = extractIpFromRequest(request);
    const consent = readConsentFromCookieHeader(request.headers.get("cookie"));

    // Contribute gate (firstpartyContribute): only warm the shared cross-tenant
    // pool when this tenant is allowed to contribute its Leadinfo-derived
    // identifications. This is the WRITE half of the first-party ToS controls;
    // the READ half (consume) gates the server-side stage. Open-data providers
    // (OpenKvK/KvK) are unaffected — they carry no ToS restriction and do not
    // write here. Defaults to the platform setting when the tenant is unresolved.
    let mayContribute = true;
    try {
      mayContribute = (await resolveFirstPartyTenantFlags(tenantId)).contribute;
    } catch { /* default: honour the platform allowance */ }

    if (ip && consent.enrichment === true && mayContribute) {
      const cacheData = data; // narrow for the closure
      after(() => ipCompanyCache.set(ip, {
        matched: true,
        output:  leadinfoDataToCacheOutput(cacheData),
        raw:     cacheData,
        source:  "leadinfo",
      }));
    }
  }

  return response;
}

// ── DELETE /api/enrichment/leadinfo ────────────────────────────────────────────
//
// Clears the mc_li cookie.  Used by the admin test panel so operators can
// reset the cookie between test runs without waiting for the 7-day TTL.
//
// The sessionStorage deduplication flag ("mc_li_sent") is client-side and must
// be cleared by the caller (LeadinfoProvider or the test harness in the admin).

export async function DELETE(): Promise<NextResponse> {
  logger.debug("[api/enrichment/leadinfo] clearing mc_li cookie");

  const isSecure = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ ok: true }, { status: 200 });

  response.cookies.set(LEADINFO_COOKIE, "", {
    maxAge:   0,
    path:     "/",
    httpOnly: true,
    sameSite: "lax",
    secure:   isSecure,
  });

  return response;
}
