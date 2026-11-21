/**
 * A database read whose answer is remembered across requests and instances.
 *
 * Why this exists. Measured on production on 21 Nov 2026: when the site had
 * been quiet for half a minute, the first reads at Supabase took 0.4 to 1 s
 * each instead of 0.02 s (the time is spent at PostgREST itself, see
 * docs/performance/2026-11-21-homepage-cold-database.md). The homepage made its
 * reads in six steps one after another before it could send the hero, so a
 * visitor on a quiet site waited 2 to 6 s. Most of those reads fetch
 * configuration that is the same for every visitor and changes a few times a
 * day.
 *
 * rememberedRead() keeps such an answer in the Next data cache, which on Vercel
 * is shared by every instance and survives a cold start. After `seconds` the
 * answer is stale: the next request still gets it at once, and the read runs
 * again behind the response. So a visitor never waits for the database, and the
 * answer is at most one visit behind.
 *
 * A failed read is never kept. The stores in this codebase answer a database
 * error with an empty list or null; kept, that would turn a hiccup of a second
 * into an empty configuration for a minute. So a store calls noteFailedRead()
 * where it swallows an error, and the answer of a read that noted one is not
 * kept. `keep` can add a check of its own (a result object with ok: false).
 * An answer that is not kept still goes to the caller, exactly as without the
 * cache, and a stale answer that fails to refresh stays as it was.
 *
 * Only for the public render path. Admin screens and writes read the database
 * directly, so an edit is visible to the person who made it.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { revalidateTag, unstable_cache } from "next/cache";

/** One tag on every remembered answer, so a save in the admin can drop them all. */
export const REMEMBERED_READ_TAG = "remembered-read";

// ── A read that failed says so ────────────────────────────────────────────────

const watch = new AsyncLocalStorage<{ failed: boolean }>();

/**
 * Called by a store where it answers a database error with an empty value.
 * Inside a remembered read it marks the answer as not to be kept; anywhere
 * else it does nothing.
 */
export function noteFailedRead(): void {
  const state = watch.getStore();
  if (state) state.failed = true;
}

/**
 * Drops every remembered answer. Called after a write to configuration, so the
 * public site shows the edit on the next visit instead of a minute later.
 */
export function forgetRememberedReads(): void {
  try {
    revalidateTag(REMEMBERED_READ_TAG, {});
  } catch {
    // Outside a request scope (a script): nothing to drop from here.
  }
}

/** Arguments become part of the cache key, so they must be plain values. */
type KeyPart = string | number | boolean | null | undefined;

export interface RememberedReadOptions<A extends KeyPart[], T> {
  /** How long an answer counts as fresh. */
  seconds: number;
  /**
   * An extra check on the answer, for a read that reports failure in its
   * result (ok: false). A read that called noteFailedRead() is never kept,
   * with or without this.
   */
  keep?: (value: T) => boolean;
}

/** Carries an answer that must not be kept out of the cache layer. */
class NotKept extends Error {
  constructor(readonly value: unknown) {
    super("answer not kept");
    this.name = "NotKept";
  }
}

/** Carries an error thrown by the read itself, to tell it from a cache error. */
class ReadThrew extends Error {
  constructor(readonly reason: unknown) {
    super("read threw");
    this.name = "ReadThrew";
  }
}

/** The part of unstable_cache this file uses; a test passes its own. */
export type CacheLayer = <T>(
  load: () => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
) => () => Promise<T>;

/**
 * Wraps `read` so its answer is remembered per set of arguments.
 *
 * The answer passes through JSON on its way into the cache: use it for plain
 * data (rows, numbers, strings), not for dates, maps or class instances.
 *
 * @param name   Unique name of this read; part of the cache key.
 * @param layer  The cache to keep answers in. Only tests pass one.
 */
export function rememberedRead<A extends KeyPart[], T>(
  name: string,
  read: (...args: A) => Promise<T>,
  options: RememberedReadOptions<A, T>,
  layer: CacheLayer = unstable_cache,
): (...args: A) => Promise<T> {
  return async (...args: A): Promise<T> => {
    const cached = layer(
      async (): Promise<T> => {
        const state = { failed: false };
        let value: T;
        try {
          value = await watch.run(state, () => read(...args));
        } catch (reason) {
          throw new ReadThrew(reason);
        }
        if (state.failed || (options.keep && !options.keep(value))) throw new NotKept(value);
        return value;
      },
      // The arguments as one JSON part: joined as loose strings, ("a,b", "c")
      // and ("a", "b,c") would share a key, and one tenant would get the
      // answer of another.
      ["remembered-read", name, JSON.stringify(args)],
      { revalidate: options.seconds, tags: [REMEMBERED_READ_TAG] },
    );

    try {
      return await cached();
    } catch (err) {
      if (err instanceof NotKept) return err.value as T;
      if (err instanceof ReadThrew) throw err.reason;
      // The cache itself failed (no request scope in a script, or the storage
      // is unreachable). The page must not depend on it: read directly.
      return read(...args);
    }
  };
}
