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
 * Creates a configured Sanity client from validated environment variables.
 *
 * Delegates env validation to serverEnv.sanity (src/lib/env.ts) — all
 * validation logic, error formatting, and memoisation live there.
 *
 * Callers should check serverEnv.sanity.isConfigured before calling this
 * function; createCMSProvider() handles that check automatically.
 *
 * @internal  Exposed for testing (inject a pre-configured client into
 *            SanityProvider rather than calling this directly in tests).
 */
export function createSanityClient(): SanityClient {
  const { projectId, dataset, apiVersion, readToken } = serverEnv.sanity;

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

// ── ISR / caching constants ───────────────────────────────────────────────────

/**
 * ISR revalidation window for Sanity content (seconds).
 *
 * Content fetches are cached by Next.js and revalidated after this interval.
 * For on-demand revalidation via webhooks, call `revalidateTag("sanity")`
 * from a route handler triggered by Sanity GROQ-powered webhooks.
 *
 * 60 seconds is conservative for an MVP. Raise to 300–900 in production.
 */
export const SANITY_REVALIDATE_SECONDS = 60;

/**
 * Default Next.js cache tag applied to all Sanity fetch calls.
 * Use with `revalidateTag(SANITY_CACHE_TAG)` for on-demand ISR invalidation.
 */
export const SANITY_CACHE_TAG = "sanity" as const;
