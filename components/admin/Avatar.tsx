/**
 * Avatar
 *
 * A small, purely presentational avatar for admin lists (interest profiles,
 * audience segments). By default the colour and initials are derived
 * deterministically from a seed string (id/key) and the display name, so every
 * profile/segment gets a stable, scannable badge with no data entry.
 *
 * An operator can override that with a configured avatar (`avatar` prop):
 *   image  → the uploaded image fills the badge
 *   emoji  → the emoji on a chosen (or seed-derived) background tint
 *   absent → the deterministic initials badge (unchanged behaviour)
 *
 * Decorative only: the display name is always shown next to it, so the avatar
 * is marked aria-hidden and contributes no accessible text.
 */

import { cn } from "@/lib/utils";
import {
  avatarColorClass, avatarEmojiBgClass, initialsFrom, type AdminAvatarConfig,
} from "./avatar-util";

interface AvatarProps {
  /** Display name — used to derive the initials shown. */
  name: string;
  /** Stable seed for the colour (e.g. the key/id). Falls back to the name. */
  seed?: string;
  /** Optional configured override: emoji (+ colour) or image. Absent → deterministic. */
  avatar?: AdminAvatarConfig | null;
  size?: "sm" | "md";
  className?: string;
}

export function Avatar({ name, seed, avatar, size = "md", className }: AvatarProps) {
  const sizeCls = size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs";
  const base = "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none";

  // Image override — the uploaded picture fills the badge.
  if (avatar?.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar.url}
        alt=""
        aria-hidden="true"
        className={cn(base, sizeCls, "object-cover", className)}
      />
    );
  }

  // Emoji override — emoji on a chosen (or seed-derived) tint.
  if (avatar?.kind === "emoji") {
    return (
      <span aria-hidden="true" className={cn(base, sizeCls, avatarEmojiBgClass(avatar.color, seed || name), className)}>
        {avatar.value}
      </span>
    );
  }

  // Deterministic default — initials on a stable palette colour.
  return (
    <span aria-hidden="true" className={cn(base, sizeCls, avatarColorClass(seed || name), className)}>
      {initialsFrom(name)}
    </span>
  );
}
