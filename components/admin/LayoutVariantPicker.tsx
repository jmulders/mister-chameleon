"use client";

/**
 * LayoutVariantPicker
 *
 * Visual replacement for the "Layout variant" <select> in the block editor. Each
 * option is a clickable card with a schematic VariantPreview + label +
 * shortDescription. The curated per-slot option list (from LAYOUT_OPTIONS) stays
 * the source of WHICH variants are shown; the visuals come from the variant
 * register (previewType / label / shortDescription looked up by key). An
 * unregistered or preview-less variant falls back to VariantPreview's generic
 * schematic (no crash, no blank).
 *
 * Accessibility: a radiogroup with roving tabindex. Arrow keys move + select,
 * Home/End jump to ends, Space/Enter select the focused card. The active card
 * carries a clear ring/border.
 */

import { useRef } from "react";
import { VariantPreview } from "@/components/admin/VariantPreview";
import { getVariantDefByKey } from "@/page-config/block-variant-register";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface LayoutVariantPickerProps {
  /** Slot id (hero / proof / cta / feature / …), used to resolve unprefixed keys. */
  slotId:   string;
  /** Curated options for this slot (LAYOUT_OPTIONS[slotId]). */
  options:  readonly Option[];
  /** Current layoutVariant. "" = family default. */
  value:    string;
  onChange: (value: string) => void;
}

interface Card {
  value:            string;
  label:            string;
  shortDescription: string;
  previewType:      string;
}

export function LayoutVariantPicker({ slotId, options, value, onChange }: LayoutVariantPickerProps) {
  // "Default" (empty value) first, then the curated options enriched from the register.
  const cards: Card[] = [
    { value: "", label: "Default", shortDescription: "Family default", previewType: "" },
    ...options.map((opt): Card => {
      // LAYOUT_OPTIONS values are full variant keys, except the legacy hero
      // "default"; prefix an unprefixed value with the slot so the register
      // lookup hits the right variant (e.g. "default" -> "hero_default").
      const key = opt.value.startsWith(`${slotId}_`) ? opt.value : `${slotId}_${opt.value}`;
      const def = getVariantDefByKey(key);
      return {
        value:            opt.value,
        // Use the curated LAYOUT_OPTIONS label (admin-facing, matches the old
        // dropdown); take only the preview + short description from the register.
        label:            opt.label,
        shortDescription: def?.shortDescription ?? "",
        previewType:      def?.previewType ?? "",
      };
    }),
  ];

  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, cards.findIndex((c) => c.value === value));

  function selectAt(idx: number) {
    onChange(cards[idx].value);
    refs.current[idx]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, idx: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        selectAt((idx + 1) % cards.length);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        selectAt((idx - 1 + cards.length) % cards.length);
        break;
      case "Home":
        e.preventDefault();
        selectAt(0);
        break;
      case "End":
        e.preventDefault();
        selectAt(cards.length - 1);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        onChange(cards[idx].value);
        break;
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-label="Layout variant" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cards.map((c, idx) => {
        const selected = c.value === value;
        return (
          <button
            key={c.value || "__default__"}
            ref={(el) => { refs.current[idx] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.shortDescription ? `${c.label}: ${c.shortDescription}` : c.label}
            tabIndex={idx === selectedIndex ? 0 : -1}
            onClick={() => onChange(c.value)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
              selected
                ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/40"
                : "border-neutral-200 hover:border-neutral-300",
            )}
          >
            <div className="aspect-[80/48] w-full overflow-hidden rounded border border-neutral-100 bg-white">
              <VariantPreview previewType={c.previewType} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-neutral-800">{c.label}</div>
              {c.shortDescription && (
                <div className="truncate text-[10px] text-neutral-500">{c.shortDescription}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
