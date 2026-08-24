"use client";

/**
 * AvatarPicker
 *
 * Lets an operator override the deterministic avatar of an audience segment or
 * interest profile with an emoji on a chosen background colour. Leaving the emoji
 * empty (or clicking Reset) clears the override, falling back to the deterministic
 * name/seed badge. English admin UI.
 *
 * Image upload is a separate option added on top of this picker; when the current
 * value is already an image it is shown as a preview with a Reset control so this
 * picker never silently drops it.
 */

import { useId } from "react";
import { Avatar } from "./Avatar";
import { AVATAR_COLOR_OPTIONS, type AdminAvatarConfig } from "./avatar-util";
import { cn } from "@/lib/utils";

const QUICK_EMOJI = ["🎯", "🚀", "💡", "⭐", "🔥", "📈", "🧭", "🛠️", "💼", "🎓", "❤️", "🌱"];

export function AvatarPicker({
  value, onChange, name, seed,
}: {
  value:    AdminAvatarConfig | null;
  onChange: (v: AdminAvatarConfig | null) => void;
  /** Preview name (for initials) + seed (for the deterministic colour). */
  name:     string;
  seed?:    string;
}) {
  const inputId = useId();
  const emoji = value?.kind === "emoji" ? value.value : "";
  const color = value?.kind === "emoji" ? value.color : undefined;
  const isImage = value?.kind === "image";

  function setEmoji(next: string) {
    const trimmed = next.trim();
    if (!trimmed) { onChange(null); return; }
    onChange({ kind: "emoji", value: trimmed, ...(color ? { color } : {}) });
  }
  function setColor(nextKey: string) {
    // Colour only applies to an emoji avatar; require an emoji first.
    if (value?.kind !== "emoji") return;
    onChange({ kind: "emoji", value: value.value, ...(nextKey ? { color: nextKey } : {}) });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Avatar name={name || "Preview"} seed={seed} avatar={value} />
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-[11px] font-medium text-neutral-600">Avatar</label>
          {isImage ? (
            <span className="text-xs text-neutral-500">Custom image set.</span>
          ) : (
            <input
              id={inputId}
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="Emoji, e.g. 🎯 (empty = default)"
              className="w-56 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
            />
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-auto rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Reset to default
          </button>
        )}
      </div>

      {!isImage && (
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded border text-sm hover:bg-neutral-50",
                emoji === e ? "border-indigo-500 bg-indigo-50" : "border-neutral-200",
              )}
              aria-label={`Use ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {value?.kind === "emoji" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-neutral-500">Background</span>
          <button
            type="button"
            onClick={() => setColor("")}
            className={cn(
              "h-6 rounded border px-2 text-[11px]",
              !color ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-neutral-200 text-neutral-500",
            )}
          >
            Auto
          </button>
          {AVATAR_COLOR_OPTIONS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              title={c.label}
              aria-label={c.label}
              className={cn(
                "h-6 w-6 rounded-full border",
                c.bgClass,
                color === c.key ? "ring-2 ring-indigo-500 ring-offset-1 border-transparent" : "border-neutral-300",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
