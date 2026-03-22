/**
 * Mock Sanity Client Factory
 *
 * Creates a minimal SanityClient-compatible object for use in tests.
 * The mock's `fetch()` method returns data from an in-memory lookup keyed
 * by the `$key` GROQ parameter — no network calls, no environment variables.
 *
 * Usage:
 *   const client = makeMockSanityClient({
 *     hero_test: SANITY_HERO_RAW,
 *     proof_test: SANITY_PROOF_RAW,
 *   });
 *   const provider = new SanityProvider(client);
 */

import type { SanityClient, QueryParams } from '@sanity/client';

/**
 * Creates a mock SanityClient whose `fetch()` does a simple lookup by
 * the `$key` GROQ parameter value.
 *
 * @param lookup  A map of variant key → raw Sanity document object.
 *                Keys that are not present in the map return null,
 *                simulating a GROQ query that found no matching document.
 */
export function makeMockSanityClient(
  lookup: Record<string, unknown>,
): SanityClient {
  return {
    fetch: async (
      _query: string,
      params?: QueryParams,
      _options?: unknown,
    ): Promise<unknown> => {
      const key = params?.key as string | undefined;
      return key !== undefined ? (lookup[key] ?? null) : null;
    },
  } as unknown as SanityClient;
}
