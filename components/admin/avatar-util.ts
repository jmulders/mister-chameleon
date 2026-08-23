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

/** One or two uppercase initials from a name, splitting on space/underscore/dash. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Deterministic Tailwind class pair for a seed string. */
export function avatarColorClass(seed: string): string {
  return AVATAR_PALETTE[hashString(seed || "") % AVATAR_PALETTE.length];
}
