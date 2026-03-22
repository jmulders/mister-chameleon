/**
 * Mock Statamic Client
 *
 * A testable StatamicClient subclass that serves entries from an in-memory
 * collection/key map instead of making HTTP requests to the Statamic REST API.
 *
 * Usage:
 *   import { HERO_VARIANTS_COLLECTION } from '@/cms/queries/statamic';
 *
 *   const client = new MockStatamicClient({
 *     [`${HERO_VARIANTS_COLLECTION}/hero_test`]: STATAMIC_HERO_ENTRY,
 *   });
 *   const provider = new StatamicProvider(client);
 */

import { StatamicClient, type StatamicEntry } from "@/cms/providers/statamic-client";

export class MockStatamicClient extends StatamicClient {
  private readonly entryMap: Record<string, StatamicEntry<unknown>>;

  /**
   * @param entryMap  A map of "collection/key" → entry object.
   *                  Keys not present in the map return null, simulating a
   *                  Statamic API 404 (entry not found).
   *
   * @example
   *   const map = {
   *     "hero_variants/hero_test": { id: "...", slug: "...", key: "hero_test", ... },
   *   };
   *   new MockStatamicClient(map)
   */
  constructor(entryMap: Record<string, StatamicEntry<unknown>>) {
    // The parent constructor arguments are never used — fetchEntry is fully
    // overridden. We pass placeholder values to satisfy the constructor signature.
    super("https://mock.statamic.test", undefined);
    this.entryMap = entryMap;
  }

  override async fetchEntry<TEntry>(
    collection: string,
    key: string,
  ): Promise<StatamicEntry<TEntry> | null> {
    const mapKey = `${collection}/${key}`;
    return (this.entryMap[mapKey] as StatamicEntry<TEntry>) ?? null;
  }
}
