/**
 * Shared response contract for POST /api/snippet/decide.
 *
 * This is the wire format the browser snippet (lib/snippet/snippet-source.ts)
 * parses, so the two must agree. Kept deliberately small and additive.
 *
 * ─── Slot values (two render modes) ──────────────────────────────────────────
 *
 *   A slot value is either:
 *     - a STRING           → content mode: swap textContent / innerHTML / href
 *     - a BlockSlot object → block mode:  inject HTML + scoped design tokens
 *
 *   Strings are the original, fully backward-compatible shape. Block objects are
 *   only emitted once a variant opts into renderMode "block" (see
 *   docs/design/snippet-render-modes.md) — the data-model increment that sources
 *   `html`/`tokens`. The response contract supports them now so the snippet and
 *   the route already speak the same language when that lands.
 *
 * ─── Selectors (D2) ──────────────────────────────────────────────────────────
 *
 *   `selectors` maps a slot key to a CSS selector, so a slot can target host
 *   markup that carries no `data-mc-slot` attribute (e.g. a WordPress page
 *   builder). It comes from the tenant's snippet config — never from visitor
 *   input — so it is a trusted source of selectors.
 *   See docs/design/snippet-wordpress-plugin.md.
 */

export interface BlockSlot {
  mode: "block";
  html: string;
  tokens?: Record<string, string>;
}

export type SlotValue = string | BlockSlot;
export type SlotMap   = Record<string, SlotValue>;

export interface DecideResponse {
  slots: SlotMap;
  /** Slot-key → CSS selector, from tenant config. Omitted when none configured. */
  selectors?: Record<string, string>;
  /** Diagnostic flags: _demo, _scenario, _quarantined, _editorMode, … */
  [meta: string]: unknown;
}

/**
 * Coerce a tenant-configured selector map (JSON from the DB, so untyped) into a
 * clean string→string record, dropping any malformed entry. Returns `undefined`
 * when nothing usable remains, so the caller can omit the `selectors` key
 * entirely and keep the response backward-compatible.
 */
export function sanitizeSelectorMap(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === "string" && key.trim() &&
        typeof value === "string" && value.trim()) {
      out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}
