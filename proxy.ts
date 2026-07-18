/**
 * Next.js Proxy — Session, Attribution & Admin Route Guard
 *
 * Runs at the Edge before any route handler or Server Component.
 * Responsibilities:
 *
 *   1. Read mc_session_id and mc_seen from the incoming Cookie header.
 *   2. Generate a new session UUID if mc_session_id is absent.
 *   3. Resolve UTM attribution from URL params + mc_attr cookie.
 *   4. Write any new or refreshed cookies onto the response.
 *   5. Forward mc_session_id in the request headers so Server Components
 *      can read the session ID without a second cookie parse.
 *   6. Forward the current pathname as x-pathname so the Admin layout can
 *      detect login routes and skip the auth shell without a DB call.
 *   7. Guard /admin/* routes — redirect to login when the session JWT is
 *      absent, expired, or in a pre-2FA state.
 *
 * ─── Admin route guard ────────────────────────────────────────────────────────
 *
 *   Public admin paths (no token required):
 *     /admin/login        — password form
 *     /admin/login/2fa    — TOTP / backup-code challenge
 *
 *   Protected admin paths (all others under /admin):
 *     • No valid token          → redirect to /admin/login
 *     • Token present but 2FA pending (twoFaEnabled && !twoFaVerified)
 *                               → redirect to /admin/login/2fa
 *     • Fully authenticated     → allow
 *
 *   The proxy performs zero DB I/O — it only verifies the JWT signature
 *   using the ADMIN_SESSION_SECRET environment variable (Web Crypto, HMAC-256).
 *
 * ─── Cookie forwarding strategy ───────────────────────────────────────────────
 *
 *   mc_session_id is injected into the forwarded request headers so the
 *   homepage Server Component always sees a populated session ID, even on
 *   the very first request before the browser receives the Set-Cookie response.
 *
 *   mc_seen is deliberately NOT injected into the forwarded request headers
 *   on a first visit — its absence is what signals "new" to detectVisitorContext().
 *   On subsequent visits the browser sends mc_seen itself, so the forwarded
 *   Cookie header naturally includes it and visitType resolves to "returning".
 *
 *   mc_attr is NOT injected into the forwarded request headers because:
 *   - On first visit with UTM, detectVisitorContext() reads from the URL directly.
 *   - On subsequent visits, the browser sends mc_attr itself in the Cookie header
 *     and detectVisitorContext() reads it as a fallback.
 *
 * ─── Attribution persistence ──────────────────────────────────────────────────
 *
 *   When the URL contains UTM params, or when an external referrer arrives with
 *   no existing mc_attr cookie, the attribution data is serialised and written
 *   to the mc_attr cookie (30-day lifetime, refreshed on each UTM touch).
 *
 * ─── Performance ──────────────────────────────────────────────────────────────
 *
 *   Zero I/O — reads/writes only cookies, headers, and JWT (Web Crypto).
 *
 * ─── Matcher ──────────────────────────────────────────────────────────────────
 *
 *   Runs on all site pages. Excluded paths (see `config.matcher`):
 *     - Next.js internals (_next/*)
 *     - API routes (api/*)
 *     - Static files (anything with a file extension)
 *
 * ─── Dev tenant override via ?tenant= ────────────────────────────────────────
 *
 *   In development, if a `?tenant=<tenantId>` query parameter is present,
 *   the proxy injects it as an `x-tenant-override` request header so
 *   Server Components can resolve the correct tenant without carrying the
 *   query param through every internal link.
 */

import { type NextRequest, NextResponse } from "next/server";
import { resolveSession, SESSION_COOKIE, WEB_SESSION_COOKIE } from "@/data/session";
import {
  resolveAttribution,
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
} from "@/context/attribution";
import {
  verifySession,
  ADMIN_TOKEN_COOKIE,
} from "@/lib/admin-auth/session";
import {
  checkRateLimit,
  extractClientIp,
  endpointFromPath,
} from "@/lib/rate-limiting";
import {
  LOCALE_COOKIE,
  isSupportedLocale,
} from "@/lib/locale";
import {
  DEV_TENANT_COOKIE,
  DEV_TENANT_COOKIE_MAX_AGE,
  isTenantOverrideEnabled,
} from "@/tenant/dev-tenant-cookie";

// ── Admin route helpers ───────────────────────────────────────────────────────

const ADMIN_PREFIX      = "/admin";
const ADMIN_LOGIN       = "/admin/login";
const ADMIN_LOGIN_2FA   = "/admin/login/2fa";

/** True for any /admin/* path that does NOT require a session. */
function isAdminPublicPath(pathname: string): boolean {
  return pathname === ADMIN_LOGIN ||
         pathname.startsWith(ADMIN_LOGIN + "/") ||
         pathname === ADMIN_LOGIN_2FA ||
         pathname.startsWith(ADMIN_LOGIN_2FA + "/");
}

/** True for any /admin/* path (public or protected). */
function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX ||
         pathname.startsWith(ADMIN_PREFIX + "/");
}

// ── Proxy ─────────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ── Rate limiting (API routes only) ────────────────────────────────────────
  //
  // API routes are matched separately (see config.matcher below).  For every
  // /api/* request we check a per-minute counter in Supabase before anything
  // else.  Fails open on any infra error so legitimate traffic is never blocked
  // due to a transient DB issue.
  // /api/statamic-draft is internal Live Preview infrastructure, called
  // server-side (in bursts) by the CMS render-proxy. Exempt it from public
  // rate limiting so the editor preview is never 429'd.
  //
  // /api/health is the deploy pipeline's liveness probe: polled repeatedly right
  // after a release, from a small pool of GitHub-runner IPs. Under the public
  // limiter that shared IP is exhausted instantly, so the check returned 429 and
  // a healthy deploy was reported as failed. A health endpoint exists to be
  // polled — it must never be rate-limited. (First observed 18 Jul 2026: five
  // straight 429s on the post-deploy check while the site itself was fine.)
  const RATE_LIMIT_EXEMPT = new Set(["/api/statamic-draft", "/api/health"]);
  if (pathname.startsWith("/api/") && !RATE_LIMIT_EXEMPT.has(pathname)) {
    const endpoint  = endpointFromPath(pathname);
    const clientIp  = extractClientIp(request.headers);
    const rl        = await checkRateLimit(endpoint, clientIp);

    const rlHeaders: Record<string, string> = {
      "X-RateLimit-Limit":     String(rl.limit),
      "X-RateLimit-Remaining": String(Math.max(0, rl.limit - rl.count)),
      "X-RateLimit-Reset":     String(
        Math.floor(Date.now() / 1000) + rl.retryAfterSeconds,
      ),
    };

    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({
          error:   "Too Many Requests",
          message: `Rate limit exceeded. Retry after ${rl.retryAfterSeconds} seconds.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After":  String(rl.retryAfterSeconds),
            ...rlHeaders,
          },
        },
      );
    }

    // Allowed — forward with rate-limit headers attached.
    const response = NextResponse.next();
    for (const [k, v] of Object.entries(rlHeaders)) {
      response.headers.set(k, v);
    }
    return response;
  }

  const cookieHeader = request.headers.get("cookie");

  // ── Visitor session (public pages) ─────────────────────────────────────────
  const session      = resolveSession(cookieHeader);
  const attribution  = resolveAttribution(request);

  // Build modified request headers
  const requestHeaders = new Headers(request.headers);

  // Always forward the current pathname so layouts can detect route segments
  // without needing usePathname() (which is client-only).
  requestHeaders.set("x-pathname", pathname);

  if (session.isNewSession) {
    const existing  = requestHeaders.get("cookie") ?? "";
    const separator = existing.length > 0 ? "; " : "";
    requestHeaders.set(
      "cookie",
      `${existing}${separator}${SESSION_COOKIE}=${session.sessionId}`,
    );
  }

  // Same trick for the billable web-session cookie: on the first request of a
  // visit the browser has not received the Set-Cookie yet, so inject it into the
  // forwarded request. Without this the very first pageview of every visit — the
  // one that actually gets personalised — would be counted under a value the
  // next pageview no longer carries, billing each visit twice.
  if (session.isNewWebSession) {
    const existing  = requestHeaders.get("cookie") ?? "";
    const separator = existing.length > 0 ? "; " : "";
    requestHeaders.set(
      "cookie",
      `${existing}${separator}${WEB_SESSION_COOKIE}=${session.webSessionId}`,
    );
  }

  // ── /home → / canonical redirect ────────────────────────────────────────────
  //
  // "/home" is the CMS slug that maps to the homepage document in Sanity.
  // It is reachable as a URL because app/(site)/[slug]/page.tsx catches all
  // CMS-backed slugs including "home".  However "/" is the canonical homepage
  // URL — served by app/(site)/page.tsx which runs the full adaptive decision
  // engine (rules, experiments, AI).  The [slug]/page.tsx path is a "no-engine"
  // path: context slots resolve from static CMS fallback keys only.
  //
  // Redirecting /home → / ensures:
  //   1. There is one canonical URL for the homepage (SEO: no duplicate content).
  //   2. Visitors on /home get the decision-engine-powered experience.
  //   3. Contextual theme rules triggered by ?utm_source=google (or any other
  //      campaign/season/device rule) work identically on both paths — the
  //      theme is decided in app/layout.tsx which runs for all routes, but
  //      the homepage decision engine (hero/proof/cta variants) only runs on /.
  //   4. All query params (?utm_source=google etc.) are preserved so the
  //      attribution pipeline fires correctly on the canonical URL.
  //
  // 301 (permanent) redirect: signals to search engines that "/" is canonical.
  if (pathname === "/home") {
    const canonicalUrl = new URL("/", request.url);
    // Preserve every query param (UTM, debug, preview, etc.)
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      canonicalUrl.searchParams.set(key, value);
    }
    return NextResponse.redirect(canonicalUrl, { status: 301 });
  }

  // ── UTM forwarding ──────────────────────────────────────────────────────────
  // App Router layouts cannot read searchParams directly — forward UTM query
  // params as x-mc-utm-* request headers so the root layout (app/layout.tsx)
  // can read them via next/headers for contextual theme decisioning.
  //
  // Fallback strategy: URL params take precedence (first touch wins within a
  // request), but if the URL has no UTM params we fall back to the mc_attr
  // attribution cookie (already parsed into attribution.data above).  This
  // ensures contextual theme rules keep firing on every navigation after the
  // landing page — not just on the initial UTM-bearing URL.
  const { searchParams } = request.nextUrl;
  const UTM_ATTRIBUTION_MAP: ReadonlyArray<
    readonly [string, string, keyof NonNullable<typeof attribution.data>]
  > = [
    ["utm_source",   "x-mc-utm-source",   "utmSource"],
    ["utm_medium",   "x-mc-utm-medium",   "utmMedium"],
    ["utm_campaign", "x-mc-utm-campaign", "utmCampaign"],
    ["utm_content",  "x-mc-utm-content",  "utmContent"],
    ["utm_term",     "x-mc-utm-term",     "utmTerm"],
  ];
  for (const [param, header, attrKey] of UTM_ATTRIBUTION_MAP) {
    const fromUrl    = searchParams.get(param) ?? null;
    const fromCookie = attribution.data?.[attrKey] ?? null;
    const value      = fromUrl ?? fromCookie;
    if (value) requestHeaders.set(header, value);
  }

  // ── Dev / preview tenant override ───────────────────────────────────────────
  //
  // When ?tenant=<id> is present, inject it as x-tenant-override so the current
  // request resolves immediately.  Also write mc_dev_tenant cookie onto the
  // response so the override persists across all subsequent navigations without
  // carrying the query param in every link.
  //
  // Active in local dev AND on Vercel preview/staging (never production) — see
  // isTenantOverrideEnabled(). Lets a staging deploy be pointed at any real
  // tenant for testing.
  let devTenantCookieToSet: string | null = null;
  if (isTenantOverrideEnabled()) {
    const tenantParam = request.nextUrl.searchParams.get("tenant")?.trim();
    if (tenantParam) {
      requestHeaders.set("x-tenant-override", tenantParam);
      // Persist as cookie so navigation links don't need to carry ?tenant=
      const existing = request.cookies.get(DEV_TENANT_COOKIE)?.value ?? null;
      if (existing !== tenantParam) {
        devTenantCookieToSet = tenantParam;
      }
    }
  }

  // ── Admin route guard ───────────────────────────────────────────────────────
  //
  // All /admin/* routes are guarded here at the Edge so that even a direct
  // URL visit never renders protected server components.
  //
  // ── Server Action exemption ───────────────────────────────────────────────
  //
  // Server Action requests (POST + `next-action` header) are excluded from
  // HTTP-level proxy redirects.  React's fetch call does not survive a
  // mid-flight 307 redirect: the followed response loses both the
  // `x-action-redirect` header and the `text/x-component` content-type that
  // the client router requires, which triggers the E394 runtime error
  // "An unexpected response was received from the server".
  //
  // The individual Server Actions and the Next.js action handler are
  // responsible for their own auth checks and routing when invoked directly.
  if (isAdminPath(pathname)) {
    const isServerAction =
      request.method === "POST" && !!request.headers.get("next-action");

    const tokenCookie = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
    const adminSession = tokenCookie ? await verifySession(tokenCookie) : null;

    if (!isAdminPublicPath(pathname)) {
      // Protected route — require a valid, fully-verified session.
      // Server Actions are exempt: they carry their own auth-check logic.
      if (!isServerAction) {
        if (!adminSession) {
          // No valid token → login page, preserving the intended destination.
          const loginUrl = new URL(ADMIN_LOGIN, request.url);
          loginUrl.searchParams.set("next", pathname);
          return NextResponse.redirect(loginUrl);
        }

        if (adminSession.twoFaEnabled && !adminSession.twoFaVerified) {
          // Valid pre-2FA token — send to the TOTP challenge.
          const twoFaUrl = new URL(ADMIN_LOGIN_2FA, request.url);
          return NextResponse.redirect(twoFaUrl);
        }
      }
    } else {
      // Public login/2fa route — if the user is already fully authenticated,
      // send them to the admin home so they don't have to go back manually.
      // Skip for Server Action requests (see exemption note above).
      if (
        !isServerAction &&
        adminSession &&
        (!adminSession.twoFaEnabled || adminSession.twoFaVerified)
      ) {
        return NextResponse.redirect(new URL(ADMIN_PREFIX, request.url));
      }
    }
  }

  // ── Build response ──────────────────────────────────────────────────────────
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const isSecure = process.env.NODE_ENV === "production";

  // ── Visitor session cookies ────────────────────────────────────────────────
  for (const spec of session.cookiesToSet) {
    response.cookies.set(spec.name, spec.value, {
      maxAge:   spec.maxAge,
      path:     spec.path,
      httpOnly: spec.httpOnly,
      sameSite: spec.sameSite,
      secure:   spec.secure,
    });
  }

  // ── Attribution cookie ────────────────────────────────────────────────────
  if (attribution.shouldSetCookie && attribution.serialized) {
    response.cookies.set({
      name:     ATTRIBUTION_COOKIE,
      value:    attribution.serialized,
      maxAge:   ATTRIBUTION_MAX_AGE,
      path:     "/",
      httpOnly: true,
      sameSite: "lax",
      secure:   isSecure,
    });
  }

  // ── Dev tenant cookie (development only) ─────────────────────────────────
  if (devTenantCookieToSet) {
    response.cookies.set({
      name:     DEV_TENANT_COOKIE,
      value:    devTenantCookieToSet,
      maxAge:   DEV_TENANT_COOKIE_MAX_AGE,
      path:     "/",
      httpOnly: true,
      sameSite: "lax",
      secure:   false, // always dev
    });
  }

  // ── Locale cookie + redirect ───────────────────────────────────────────────
  //
  // When ?lang=<code> is present in the URL and the code is a supported locale,
  // we REDIRECT to the same URL without the ?lang= param, with the locale cookie
  // already set on the redirect response.
  //
  // Why redirect instead of just setting the cookie on the NextResponse.next()?
  //   Next.js middleware can only pass data to server components via request
  //   headers (not response cookies).  Setting the cookie on the NextResponse.next()
  //   response stores it in the browser for the NEXT request, but the *current*
  //   page still reads the old locale from the incoming request.  A redirect
  //   causes the browser to make a second request that already carries the new
  //   cookie, so getLocale() immediately returns the correct locale and the page
  //   renders in the chosen language on the very first navigation.
  //
  // Supported codes: "en" | "nl" | "de"
  const langParam = request.nextUrl.searchParams.get("lang");
  if (langParam && isSupportedLocale(langParam)) {
    // Build the redirect target — same URL, ?lang= removed, other params kept.
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete("lang");

    const redirectResponse = NextResponse.redirect(redirectUrl);

    // ── Set locale cookie on the redirect response ──────────────────────────
    redirectResponse.cookies.set({
      name:     LOCALE_COOKIE,
      value:    langParam,
      maxAge:   60 * 60 * 24 * 365,   // 1 year
      path:     "/",
      httpOnly: false,                 // readable by client JS (language switcher)
      sameSite: "lax",
      secure:   isSecure,
    });

    // ── Forward session + attribution cookies onto the redirect ─────────────
    // These were computed above for the original response.  They must also be
    // attached to the redirect response so that a new-session visitor doesn't
    // lose their session ID between the redirect and the following GET.
    for (const spec of session.cookiesToSet) {
      redirectResponse.cookies.set(spec.name, spec.value, {
        maxAge:   spec.maxAge,
        path:     spec.path,
        httpOnly: spec.httpOnly,
        sameSite: spec.sameSite,
        secure:   spec.secure,
      });
    }
    if (attribution.shouldSetCookie && attribution.serialized) {
      redirectResponse.cookies.set({
        name:     ATTRIBUTION_COOKIE,
        value:    attribution.serialized,
        maxAge:   ATTRIBUTION_MAX_AGE,
        path:     "/",
        httpOnly: true,
        sameSite: "lax",
        secure:   isSecure,
      });
    }

    return redirectResponse;
  }

  return response;
}

// ── Route matcher ─────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Pattern 1 — Page routes:
     *   Match all request paths EXCEPT:
     *   - _next/static   (static assets bundled by Next.js)
     *   - _next/image    (Next.js Image Optimisation API)
     *   - api/*          (handled by pattern 2 below)
     *   - favicon.ico    (browser default icon request)
     *   - Any path ending in a file extension (e.g. .png, .svg, .js, .css)
     *     These are public assets served from /public — no session needed.
     */
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\..*).*)",

    /*
     * Pattern 2 — API routes:
     *   All /api/* paths are matched for rate limiting.
     *   The proxy short-circuits after the rate-limit check and never
     *   touches session cookies or admin auth for these paths.
     */
    "/api/:path*",
  ],
};
