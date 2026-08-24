/**
 * Deterministic avatar helpers (pure, no JSX/React) so they can be unit-tested
 * and reused. Colour + initials are derived from a seed/name, giving each
 * interest profile / audience segment a stable, scannable badge with no data
 * entry. Presentation only — nothing here touches matching/scoring.
 */

// Tailwind class pairs (light tint + readable text). Literal strings so the JIT
// compiler picks them up. Muted 100/700 tints keep lists calm, not loud.
export const AVATAR_PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-lime-100 text-lime-700",
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-sky-100 text-sky-700",
  "bg-blue-100 text-blue-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-pink-100 text-pink-700",
] as const;

/** Stable 32-bit string hash (order-sensitive). */
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** One or two uppercase initials from a name, splitting on any non-letter/digit. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Deterministic Tailwind class pair for a seed string. */
export function avatarColorClass(seed: string): string {
  return AVATAR_PALETTE[hashString(seed || "") % AVATAR_PALETTE.length];
}

// ── Configurable avatar ─────────────────────────────────────────────────────────
//
// An operator may override the deterministic badge with an emoji (+ background
// colour) or an uploaded image. Absent → the deterministic name/seed badge.

/**
 * A stored avatar override. Discriminated by `kind`; absent/null means the
 * deterministic avatar. Persisted as-is in the `avatar` JSONB column on
 * audience_segments / interest_profiles.
 */
export type AdminAvatarConfig =
  | { kind: "emoji"; value: string; color?: string }
  | { kind: "image"; url: string };

/**
 * Selectable background tints for an emoji avatar, keyed by a stable name so the
 * stored value survives palette tweaks. `null` key = "auto" (derive the tint
 * deterministically from the seed).
 */
export const AVATAR_COLOR_OPTIONS: readonly { key: string; bgClass: string; label: string }[] = [
  { key: "slate",   bgClass: "bg-slate-100",   label: "Slate" },
  { key: "rose",    bgClass: "bg-rose-100",    label: "Rose" },
  { key: "orange",  bgClass: "bg-orange-100",  label: "Orange" },
  { key: "amber",   bgClass: "bg-amber-100",   label: "Amber" },
  { key: "emerald", bgClass: "bg-emerald-100", label: "Emerald" },
  { key: "teal",    bgClass: "bg-teal-100",    label: "Teal" },
  { key: "sky",     bgClass: "bg-sky-100",     label: "Sky" },
  { key: "blue",    bgClass: "bg-blue-100",    label: "Blue" },
  { key: "indigo",  bgClass: "bg-indigo-100",  label: "Indigo" },
  { key: "violet",  bgClass: "bg-violet-100",  label: "Violet" },
  { key: "fuchsia", bgClass: "bg-fuchsia-100", label: "Fuchsia" },
  { key: "pink",    bgClass: "bg-pink-100",    label: "Pink" },
];

/** Background tint class for an emoji avatar: the chosen colour, else derived from the seed. */
export function avatarEmojiBgClass(color: string | undefined, seed: string): string {
  const opt = color ? AVATAR_COLOR_OPTIONS.find((o) => o.key === color) : undefined;
  if (opt) return opt.bgClass;
  // Auto: reuse the deterministic palette but keep only the background tint.
  return avatarColorClass(seed || "").split(" ").find((c) => c.startsWith("bg-")) ?? "bg-slate-100";
}

/**
 * Validate an untrusted stored/submitted avatar value into an AdminAvatarConfig,
 * or null (→ deterministic). Used by the save actions (server) and the repository
 * read path, so bad data never reaches the renderer.
 */
export function parseAvatarConfig(raw: unknown): AdminAvatarConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === "emoji" && typeof o.value === "string" && o.value.trim()) {
    const color = typeof o.color === "string" && AVATAR_COLOR_OPTIONS.some((c) => c.key === o.color)
      ? (o.color as string)
      : undefined;
    // Cap the emoji length defensively (an emoji can be several code points).
    return { kind: "emoji", value: [...o.value.trim()].slice(0, 4).join(""), ...(color ? { color } : {}) };
  }
  if (o.kind === "image" && typeof o.url === "string" && o.url.trim()) {
    return { kind: "image", url: o.url.trim() };
  }
  return null;
}
