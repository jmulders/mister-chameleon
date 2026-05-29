/**
 * Sanity Client Factory
 *
 * Creates a configured @sanity/client instance for use by SanityProvider.
 * Environment variables are read from serverEnv.sanity (src/lib/env.ts),
 * which validates them lazily and throws with a clear error if any are
 * missing when SANITY_PROJECT_ID is set.
 *
 * ─── CDN vs. API ─────────────────────────────────────────────────────────────
 *
 *   useCdn: true   — served from Sanity CDN (apicdn.sanity.io)
 *                    fast, eventually consistent, no token needed for public
 *   useCdn: false  — served from Sanity live API (api.sanity.io)
 *                    required when using a read token (CDN ignores tokens)
 *
 *   We switch automatically: CDN is disabled when a read token is present.
 *
 * ─── Next.js fetch caching ───────────────────────────────────────────────────
 *
 *   @sanity/client >= 6.4.0 routes requests through the native `fetch` API,
 *   which Next.js App Router intercepts and extends with ISR options.
 *   SanityProvider passes { next: { revalidate, tags } } per fetch call.
 *
 * ─── Installation ────────────────────────────────────────────────────────────
 *
 *   npm install @sanity/client server-only
 */

import { createClient, type SanityClient } from "@sanity/client";
import { serverEnv } from "@/lib/env";

// ── Client factory ────────────────────────────────────────────────────────────

/**
 * Per-tenant Sanity client configuration overrides.
 *
 * Fields present here take precedence over the platform-level environment
 * variables read from serverEnv.sanity.  Omit a field to fall back to the
 * platform default.
 */
export interface SanityClientOverrides {
  /** Overrides SANITY_PROJECT_ID / serverEnv.sanity.projectId */
  projectId?:  string;
  /** Overrides SANITY_DATASET / serverEnv.sanity.dataset */
  dataset?:    string;
  /** Overrides SANITY_API_VERSION / serverEnv.sanity.apiVersion */
  apiVersion?: string;
  /**
   * Overrides the read token used to authenticate API requests.
   * When set, takes precedence over SANITY_READ_TOKEN / SANITY_API_TOKEN
   * env vars and serverEnv.sanity.readToken.
   *
   * Use when Sanity credentials are loaded from the database (platform_settings)
   * rather than environment variables — enables DB-only production deployments.
   */
  readToken?:  string;
}

/**
 * Creates a configured Sanity client from validated environment variables,
 * with optional per-tenant overrides for projectId, dataset, and apiVersion.
 *
 * Delegates env validation to serverEnv.sanity (src/lib/env.ts) — all
 * validation logic, error formatting, and memoisation live there.
 *
 * Callers should check serverEnv.sanity.isConfigured before calling this
 * function; createCMSProvider() handles that check automatically.
 *
 * @param overrides  Optional per-tenant config that takes precedence over
 *                   the platform-level environment variables.
 *
 * @internal  Exposed for testing (inject a pre-configured client into
 *            SanityProvider rather than calling this directly in tests).
 */
export function createSanityClient(overrides?: SanityClientOverrides): SanityClient {
  // Token resolution: explicit override → env vars → undefined (CDN-only)
  const readToken =
    overrides?.readToken ??
    serverEnv.sanity.readToken;

  // Per-tenant / DB values take precedence; fall back to platform env.
  const projectId  = overrides?.projectId  ?? serverEnv.sanity.projectId;
  const dataset    = overrides?.dataset    ?? serverEnv.sanity.dataset;
  const apiVersion = overrides?.apiVersion ?? serverEnv.sanity.apiVersion ?? "2024-01-01";

  return createClient({
    projectId,
    dataset,
    apiVersion,
    // CDN is incompatible with authenticated requests — disable when a token
    // is present so the live API is used instead.
    useCdn: !readToken,
    token: readToken,
    // perspective: "published" excludes draft documents from all queries.
    // Switch to "previewDrafts" in a preview mode route handler.
    perspective: "published",
    // stega: false — disable Sanity Visual Editing stega encoding.
    // Enable when adding the Presentation Tool to the Studio.
    stega: false,
  });
}

/**
 * Creates a Sanity client configured for preview / draft mode.
 *
 * Key differences from the public client:
 *   - `perspective: "previewDrafts"` — returns draft documents when available,
 *     falling back to the published version for documents without a draft.
 *   - `useCdn: false` — always hits the live API; the CDN does not serve drafts.
 *   - Uses SANITY_PREVIEW_TOKEN when set, falling back to the general readToken.
 *     A dedicated preview token is preferred because it can be scoped to
 *     "Viewer" access only — no write permissions needed for preview.
 *
 * This client is only ever instantiated inside `createPreviewCMSProvider()`.
 * It must never be used for public (non-preview) page rendering.
 *
 * @param overrides  Optional per-tenant config overrides, same as the public client.
 */
export function createPreviewSanityClient(overrides?: SanityClientOverrides): SanityClient {
  const { previewToken, readToken: envReadToken } = serverEnv.sanity;

  // Token resolution: explicit override → env preview token → env read token → undefined
  const token = overrides?.readToken ?? previewToken ?? envReadToken;

  const projectId  = overrides?.projectId  ?? serverEnv.sanity.projectId;
  const dataset    = overrides?.dataset    ?? serverEnv.sanity.dataset;
  const apiVersion = overrides?.apiVersion ?? serverEnv.sanity.apiVersion ?? "2024-01-01";

  return createClient({
    projectId,
    dataset,
    apiVersion,
    // CDN cannot serve draft content — always use the live API for preview.
    useCdn: false,
    token,
    // previewDrafts: returns the draft version of a document when one exists,
    // otherwise falls back to the published version.  This is the correct
    // perspective for all Sanity preview mode requests.
    perspective: "previewDrafts",
    stega: false,
  });
}

// ── ISR / caching constants ───────────────────────────────────────────────────

/**
 * ISR revalidation window for Sanity content (seconds).
 *
 * Content fetches are cached by Next.js and revalidated after this interval.
 * For on-demand revalidation via webhooks, call `revalidateTag("sanity")`
 * from a route handler triggered by Sanity GROQ-powered webhooks.
 *
 * ─── Production ──────────────────────────────────────────────────────────────
 *
 *   Default: 300 s (5 min).  Previously 60 s — raised to reduce Sanity API and
 *   CDN bandwidth consumption.  With on-demand revalidation via the webhook at
 *   /api/revalidate, 300 s is the maximum stale window editors will ever see;
 *   the webhook fires within seconds of a Sanity publish.
 *
 *   Override via SANITY_REVALIDATE_SECONDS env var (integer seconds).
 *   Higher values (600–900) are safe when webhook-based revalidation is active.
 *
 * ─── Development ─────────────────────────────────────────────────────────────
 *
 *   Default: 30 s.  Previously 5 s — even 30 s is far more responsive than
 *   the 60 s production window while substantially reducing Sanity API calls
 *   during local development sessions.  The `cache: "no-store"` path in
 *   SanityProvider already bypasses this entirely in dev, so this value only
 *   affects places that construct their own fetch options.
 *
 *   Override via SANITY_DEV_REVALIDATE_SECONDS env var.
 *
 * ─── Bandwidth impact ────────────────────────────────────────────────────────
 *
 *   Raising from 60 → 300 s reduces Sanity fetch frequency by 5× on cold
 *   cache paths.  Combined with on-demand webhook revalidation, editors still
 *   see updates within seconds while the quota burn drops dramatically.
 */
export const SANITY_REVALIDATE_SECONDS: number =
  process.env.NODE_ENV === "development"
    ? Number(process.env.SANITY_DEV_REVALIDATE_SECONDS ?? "30")
    : Number(process.env.SANITY_REVALIDATE_SECONDS ?? "300");

/**
 * Longer ISR revalidation window for Sanity search index fetches (seconds).
 *
 * The search provider fetches ALL published pages for a tenant on each query.
 * This list changes far less frequently than individual content documents, so
 * it benefits from a much longer cache TTL.  900 s (15 min) keeps the search
 * index fresh enough while cutting Sanity round-trips by ~15× vs the default.
 *
 * On-demand revalidation via `revalidateTag("sanity")` still flushes this
 * immediately when content is published — the long TTL only applies when no
 * webhook has fired since the last fetch.
 *
 * Override via SANITY_SEARCH_REVALIDATE_SECONDS env var.
 */
export const SANITY_SEARCH_REVALIDATE_SECONDS: number =
  process.env.NODE_ENV === "development"
    ? 60
    : Number(process.env.SANITY_SEARCH_REVALIDATE_SECONDS ?? "900");

/**
 * Default Next.js cache tag applied to all Sanity fetch calls.
 * Use with `revalidateTag(SANITY_CACHE_TAG)` for on-demand ISR invalidation.
 */
export const SANITY_CACHE_TAG = "sanity" as const;

// ── Dev bandwidth guard ───────────────────────────────────────────────────────

/**
 * Log a warning when running in development mode with live Sanity API calls.
 *
 * In development, SanityProvider uses `cache: "no-store"` — every Sanity fetch
 * bypasses the Next.js data cache and hits the live API directly.  If the
 * project ID points at the production dataset this drains the Sanity bandwidth
 * quota at dev-reload speed.
 *
 * This warning fires once per process.  Set SANITY_SUPPRESS_DEV_WARNING=true
 * to silence it when the dev/production datasets are intentionally shared.
 */
if (
  process.env.NODE_ENV === "development" &&
  process.env.SANITY_PROJECT_ID &&
  process.env.SANITY_SUPPRESS_DEV_WARNING !== "true" &&
  typeof console !== "undefined"
) {
  console.warn(
    `[sanity-client] ⚠ DEV MODE: Sanity is configured with projectId="${process.env.SANITY_PROJECT_ID}". ` +
    `All Sanity fetches use cache:"no-store" — every page reload hits the live Sanity API directly. ` +
    `Use a dedicated dev dataset (SANITY_DATASET=staging) to protect your production quota. ` +
    `Set SANITY_SUPPRESS_DEV_WARNING=true to silence this message.`,
  );
}
