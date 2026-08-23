/**
 * Avatar
 *
 * A small, purely presentational avatar for admin lists (interest profiles,
 * audience segments). The colour and initials are derived deterministically
 * from a seed string (id/key) and the display name, so every profile/segment
 * gets a stable, scannable badge with no data entry.
 *
 * Decorative only: the display name is always shown next to it, so the avatar
 * is marked aria-hidden and contributes no accessible text.
 */

import { cn } from "@/lib/utils";
import { avatarColorClass, initialsFrom } from "./avatar-util";

interface AvatarProps {
  /** Display name — used to derive the initials shown. */
  name: string;
  /** Stable seed for the colour (e.g. the key/id). Falls back to the name. */
  seed?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Avatar({ name, seed, size = "md", className }: AvatarProps) {
  const colour = avatarColorClass(seed || name);
  const sizeCls = size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none",
        sizeCls,
        colour,
        className,
      )}
    >
      {initialsFrom(name)}
    </span>
  );
}
