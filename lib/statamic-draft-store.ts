/**
 * Statamic Live Preview — in-memory draft store
 *
 * When the Statamic CP Live Preview re-renders the Antlers template on every
 * keystroke, a small JavaScript snippet POSTs the current (unsaved) entry data
 * here.  The response token is appended to the Next.js iframe URL so the page
 * renders with draft content in real time — without requiring a Save first.
 *
 * The store survives Next.js HMR restarts via a module-level global because
 * the global namespace persists across hot reloads in development.
 */

export interface StatamicDraftEntry {
  collection: string;
  slug: string;
  /**
   * Raw page_blocks Replicator — the unified array containing both
   * context_slot blocks and free content blocks in authored order.
   * Serialised by the Antlers template and POSTed on every keystroke.
   */
  blocks: unknown[];
  title?: string;
  seoDescription?: string;
}

interface DraftRecord {
  entry: StatamicDraftEntry;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __statamicDraftStore: Map<string, DraftRecord> | undefined;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes

function getStore(): Map<string, DraftRecord> {
  if (!global.__statamicDraftStore) {
    global.__statamicDraftStore = new Map();
  }
  return global.__statamicDraftStore;
}

export function storeDraft(entry: StatamicDraftEntry): string {
  const store = getStore();
  const now = Date.now();

  // Prune expired entries
  for (const [key, record] of store) {
    if (record.expiresAt < now) store.delete(key);
  }

  const token = now.toString(36) + Math.random().toString(36).slice(2, 8);
  store.set(token, { entry, expiresAt: now + TTL_MS });
  return token;
}

export function getDraft(token: string): StatamicDraftEntry | null {
  if (!token) return null;
  const record = getStore().get(token);
  if (!record || record.expiresAt < Date.now()) return null;
  return record.entry;
}
