"use client";

/**
 * VariantPreviewClient
 *
 * Slot-aware preview card for the Adaptive Blocks catalog page.
 *
 * Each slot type gets a structurally distinct wireframe schematic so that
 * scanning the catalog page immediately communicates what each slot DOES —
 * hero header, social proof row, CTA section, feature grid, conversion form,
 * or notification strip.
 *
 * The alignment toggle and content fields remain interactive.
 */

import { useState, useId } from "react";
import type { AdaptiveVariantContent } from "@/cms/types";

type Align = "left" | "center" | "right";

// ── Slot schematic ─────────────────────────────────────────────────────────────

/**
 * Renders a wireframe SVG that represents the SLOT TYPE's visual structure,
 * not a specific layout variant.  Each slot produces a distinctly different
 * schematic so catalog rows are immediately recognisable.
 */
function SlotSchematic({
  slotId,
  contentAlign,
  gradId,
}: {
  slotId:       string;
  contentAlign: Align;
  gradId:       string;
}) {
  const W = 200, H = 90;

  // ── Shared sub-components ────────────────────────────────────────────────────

  function TextBlock({ x, y, w, align = contentAlign }: {
    x: number; y: number; w: number; align?: Align;
  }) {
    const ox = (lw: number) =>
      align === "center" ? x + (w - lw) / 2
      : align === "right"  ? x + w - lw
      : x;
    return (
      <g>
        <rect x={ox(w * 0.38)} y={y}    width={w * 0.38} height={3.5} rx={2}   fill="#a78bfa" opacity={0.75} />
        <rect x={ox(w * 0.82)} y={y+7}  width={w * 0.82} height={5}   rx={2}   fill="#334155" opacity={0.75} />
        <rect x={ox(w * 0.62)} y={y+15} width={w * 0.62} height={5}   rx={2}   fill="#334155" opacity={0.5}  />
        <rect x={ox(w * 0.88)} y={y+24} width={w * 0.88} height={3}   rx={1.5} fill="#94a3b8" opacity={0.4}  />
      </g>
    );
  }

  function Btn({ x, y, w = 38, h = 9, fill = "#6366f1", opacity = 0.85 }: {
    x: number; y: number; w?: number; h?: number; fill?: string; opacity?: number;
  }) {
    return <rect x={x} y={y} width={w} height={h} rx={2.5} fill={fill} opacity={opacity} />;
  }

  function InputField({ x, y, w, label = false }: {
    x: number; y: number; w: number; label?: boolean;
  }) {
    return (
      <g>
        {label && <rect x={x} y={y - 5} width={w * 0.4} height={3} rx={1} fill="#94a3b8" opacity={0.5} />}
        <rect x={x} y={y} width={w} height={10} rx={2} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
      </g>
    );
  }

  // ── Hero ─────────────────────────────────────────────────────────────────────
  // Full-width header: dark brand background, large headline, two CTAs.
  if (slotId === "hero") {
    const bx = contentAlign === "center" ? (W - 83) / 2 : contentAlign === "right" ? W - 97 : 12;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <rect width={W} height={H} rx={5} fill="#1e1b4b" />
        <TextBlock x={12} y={10} w={W - 24} />
        <Btn x={bx}    y={47} />
        <Btn x={bx+43} y={47} fill="none" opacity={0.6} />
        <rect x={bx+43} y={47} width={38} height={9} rx={2.5} fill="none" stroke="#a5b4fc" strokeWidth={1.2} opacity={0.6} />
      </svg>
    );
  }

  // ── Proof ─────────────────────────────────────────────────────────────────────
  // Social proof: light background, 3 stat / testimonial cards side by side.
  if (slotId === "proof") {
    const cardW = (W - 24 - 8) / 3;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <rect width={W} height={H} rx={5} fill="#f8fafc" />
        {/* Short heading */}
        <rect x={(W - W * 0.5) / 2} y={8} width={W * 0.5} height={4} rx={2} fill="#334155" opacity={0.6} />
        <rect x={(W - W * 0.38) / 2} y={15} width={W * 0.38} height={3} rx={1.5} fill="#94a3b8" opacity={0.4} />
        {/* 3 stat cards */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={12 + i * (cardW + 4)} y={26}
              width={cardW} height={H - 34}
              rx={3} fill="#fff" stroke="#e2e8f0" strokeWidth={1}
            />
            {/* Big number */}
            <rect x={12 + i * (cardW + 4) + 4} y={31}  width={cardW * 0.55} height={7}   rx={2} fill="#6366f1" opacity={0.55} />
            {/* Stat label */}
            <rect x={12 + i * (cardW + 4) + 4} y={42}  width={cardW * 0.8}  height={3}   rx={1} fill="#94a3b8" opacity={0.45} />
            <rect x={12 + i * (cardW + 4) + 4} y={48}  width={cardW * 0.65} height={3}   rx={1} fill="#94a3b8" opacity={0.3}  />
          </g>
        ))}
      </svg>
    );
  }

  // ── CTA ───────────────────────────────────────────────────────────────────────
  // Call-to-action: brand-tinted background, headline, one prominent button.
  if (slotId === "cta") {
    const cx = contentAlign === "center" ? (W - 52) / 2 : contentAlign === "right" ? W - 64 : 12;
    const tx = (lw: number) =>
      contentAlign === "center" ? (W - lw) / 2
      : contentAlign === "right"  ? W - lw - 12
      : 12;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <rect width={W} height={H} rx={5} fill="#ede9fe" />
        {/* Eyebrow */}
        <rect x={tx(W * 0.28)} y={12} width={W * 0.28} height={3.5} rx={2} fill="#7c3aed" opacity={0.5} />
        {/* Headline */}
        <rect x={tx(W * 0.72)} y={19} width={W * 0.72} height={6}   rx={2} fill="#3730a3" opacity={0.7} />
        <rect x={tx(W * 0.55)} y={29} width={W * 0.55} height={6}   rx={2} fill="#3730a3" opacity={0.45} />
        {/* Subtitle */}
        <rect x={tx(W * 0.85)} y={39} width={W * 0.85} height={3}   rx={1.5} fill="#6366f1" opacity={0.3} />
        {/* CTA button — larger */}
        <rect x={cx} y={50} width={52} height={12} rx={3} fill="#6366f1" opacity={0.9} />
      </svg>
    );
  }

  // ── Feature ────────────────────────────────────────────────────────────────────
  // Feature grid: 3 icon+title+text cards in a row.
  if (slotId === "feature") {
    const cardW = (W - 24 - 8) / 3;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <rect width={W} height={H} rx={5} fill="#f8fafc" />
        {/* Section title */}
        <rect x={(W - W * 0.42) / 2} y={8}  width={W * 0.42} height={4.5} rx={2}   fill="#334155" opacity={0.65} />
        <rect x={(W - W * 0.65) / 2} y={16} width={W * 0.65} height={3}   rx={1.5} fill="#94a3b8" opacity={0.4}  />
        {/* Feature cards */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={12 + i * (cardW + 4)} y={26}
              width={cardW} height={H - 34}
              rx={3} fill="#fff" stroke="#e2e8f0" strokeWidth={1}
            />
            {/* Icon circle */}
            <circle cx={12 + i * (cardW + 4) + cardW / 2} cy={36} r={6} fill="#ede9fe" />
            <circle cx={12 + i * (cardW + 4) + cardW / 2} cy={36} r={3} fill="#8b5cf6" opacity={0.7} />
            {/* Card label */}
            <rect x={12 + i * (cardW + 4) + 4} y={47} width={cardW * 0.75} height={3}   rx={1} fill="#334155" opacity={0.6} />
            <rect x={12 + i * (cardW + 4) + 4} y={53} width={cardW * 0.9}  height={2.5} rx={1} fill="#94a3b8" opacity={0.35} />
            <rect x={12 + i * (cardW + 4) + 4} y={58} width={cardW * 0.7}  height={2.5} rx={1} fill="#94a3b8" opacity={0.25} />
          </g>
        ))}
      </svg>
    );
  }

  // ── Conversion ────────────────────────────────────────────────────────────────
  // Form section: white card, input fields, submit button.
  if (slotId === "conversion") {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <rect width={W} height={H} rx={5} fill="#f0fdf4" />
        {/* Heading */}
        <rect x={(W - W * 0.55) / 2} y={8}  width={W * 0.55} height={5} rx={2}   fill="#166534" opacity={0.55} />
        <rect x={(W - W * 0.72) / 2} y={17} width={W * 0.72} height={3} rx={1.5} fill="#4ade80" opacity={0.4}  />
        {/* Form card */}
        <rect x={22} y={25} width={W - 44} height={H - 32} rx={4} fill="#fff" stroke="#bbf7d0" strokeWidth={1} />
        {/* Two input fields */}
        <InputField x={30} y={33} w={W - 60} label />
        <InputField x={30} y={51} w={W - 60} label />
        {/* Submit */}
        <Btn x={(W - 52) / 2} y={70} w={52} h={9} fill="#16a34a" />
      </svg>
    );
  }

  // ── Notification ──────────────────────────────────────────────────────────────
  // Thin banner strip: amber tint, short text, inline dismiss / CTA.
  if (slotId === "notification") {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <rect width={W} height={H} rx={5} fill="#f8fafc" />
        {/* Empty page content suggestion */}
        <rect x={12} y={12} width={W - 24} height={4}   rx={2} fill="#e2e8f0" opacity={0.8} />
        <rect x={12} y={20} width={W * 0.7} height={3}  rx={1.5} fill="#e2e8f0" opacity={0.6} />
        <rect x={12} y={27} width={W * 0.55} height={3} rx={1.5} fill="#e2e8f0" opacity={0.5} />
        {/* Notification bar — bottom of viewport */}
        <rect x={0}  y={H - 22} width={W} height={22} rx={0} fill="#fef3c7" />
        <rect x={0}  y={H - 22} width={W} height={1}  fill="#fcd34d" opacity={0.6} />
        {/* Notification text */}
        <rect x={10} y={H - 16} width={W * 0.48} height={3.5} rx={1.5} fill="#92400e" opacity={0.65} />
        <rect x={10} y={H - 10} width={W * 0.38} height={3}   rx={1.5} fill="#b45309" opacity={0.4}  />
        {/* CTA + close */}
        <rect x={W - 52} y={H - 18} width={36} height={10} rx={2} fill="#d97706" opacity={0.85} />
        <rect x={W - 12} y={H - 15} width={6}  height={6}  rx={1} fill="#92400e" opacity={0.35} />
      </svg>
    );
  }

  // ── Fallback ──────────────────────────────────────────────────────────────────
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <rect width={W} height={H} rx={5} fill="#f8fafc" />
      <rect x={12} y={H / 2 - 3} width={W - 24} height={6} rx={2} fill="#cbd5e1" opacity={0.6} />
    </svg>
  );
}

// ── MediaBadge ────────────────────────────────────────────────────────────────

function MediaBadge({ content }: { content: AdaptiveVariantContent }) {
  const m = content.media;
  if (!m) {
    if (content.imageUrl) {
      return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-600 ring-1 ring-blue-200">image</span>;
    }
    return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-neutral-100 text-neutral-400 ring-1 ring-neutral-200">no media</span>;
  }
  if (m.kind === "image") {
    return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-600 ring-1 ring-blue-200">image</span>;
  }
  const src = m.video.source;
  const labels: Record<string, string> = { upload: "video upload", youtube: "YouTube", vimeo: "Vimeo" };
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-purple-50 text-purple-700 ring-1 ring-purple-200">
      ▶ {labels[src] ?? src}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string | undefined | null, max = 90): string {
  if (!text) return ", ";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ── Per-slot capabilities ─────────────────────────────────────────────────────

/**
 * Controls which UI sections are shown per slot type.
 *
 *  hasAlignment — hero/cta only: text can be left/center/right aligned
 *  hasMedia     — hero only: supports image/video background/panel
 *  hasItems     — proof/feature: has per-card item list (title + text/body ± image ± cta)
 *  itemLabel    — singular label for each item/card (e.g. "Card", "Column")
 *  itemHasImage — whether items in this slot can have an image
 *  itemHasCta   — whether items in this slot can have a CTA
 *  tagLabel     — slot-specific label for the `tag` / eyebrow field
 *  titleLabel   — slot-specific label for the `title` field
 *  ctaLabel     — slot-specific label for CTAs (undefined = "CTA's")
 */
interface SlotMeta {
  hasAlignment: boolean;
  hasMedia:     boolean;
  hasItems:     boolean;
  itemLabel:    string;
  itemHasImage: boolean;
  itemHasCta:   boolean;
  tagLabel:     string;
  titleLabel:   string;
  ctaLabel?:    string;
}

const SLOT_META: Record<string, SlotMeta> = {
  hero: {
    hasAlignment: true,
    hasMedia:     true,
    hasItems:     false,
    itemLabel:    "Item",
    itemHasImage: false,
    itemHasCta:   false,
    tagLabel:     "Eyebrow",
    titleLabel:   "Headline",
    ctaLabel:     "CTA's",
  },
  proof: {
    hasAlignment: false,
    hasMedia:     false,
    hasItems:     true,
    itemLabel:    "Column",
    itemHasImage: false,
    itemHasCta:   false,
    tagLabel:     "Section label",
    titleLabel:   "Section title",
  },
  cta: {
    hasAlignment: true,
    hasMedia:     false,
    hasItems:     false,
    itemLabel:    "Item",
    itemHasImage: false,
    itemHasCta:   false,
    tagLabel:     "Eyebrow",
    titleLabel:   "Headline",
    ctaLabel:     "Buttons",
  },
  feature: {
    hasAlignment: false,
    hasMedia:     false,
    hasItems:     true,
    itemLabel:    "Card",
    itemHasImage: true,
    itemHasCta:   true,
    tagLabel:     "Section label",
    titleLabel:   "Section title",
  },
  conversion: {
    hasAlignment: false,
    hasMedia:     false,
    hasItems:     false,
    itemLabel:    "Item",
    itemHasImage: false,
    itemHasCta:   false,
    tagLabel:     "Form title",
    titleLabel:   "Title",
    ctaLabel:     "Button label",
  },
  notification: {
    hasAlignment: false,
    hasMedia:     false,
    hasItems:     false,
    itemLabel:    "Item",
    itemHasImage: false,
    itemHasCta:   false,
    tagLabel:     "Badge",
    titleLabel:   "Message title",
    ctaLabel:     "Button label",
  },
};

const DEFAULT_SLOT_META: SlotMeta = {
  hasAlignment: true,
  hasMedia:     true,
  hasItems:     false,
  itemLabel:    "Item",
  itemHasImage: false,
  itemHasCta:   false,
  tagLabel:     "Eyebrow",
  titleLabel:   "Headline",
  ctaLabel:     "CTA's",
};

// ── VariantPreviewClient ──────────────────────────────────────────────────────

export function VariantPreviewClient({
  content,
  slotId,
}: {
  content: AdaptiveVariantContent;
  slotId?: string;
}) {
  const meta        = slotId ? (SLOT_META[slotId] ?? DEFAULT_SLOT_META) : DEFAULT_SLOT_META;
  const storedAlign = content.contentAlign ?? "left";
  const [align, setAlign] = useState<Align>(storedAlign);
  const gradId = useId();

  return (
    <div className="rounded-lg border border-neutral-100 bg-white overflow-hidden text-[11px]">

      {/* ① Slot wireframe schematic */}
      <div className="px-3 pt-3 pb-2 bg-slate-50 border-b border-neutral-100">
        <SlotSchematic
          slotId={slotId ?? "hero"}
          contentAlign={align}
          gradId={gradId}
        />
      </div>

      {/* ② Alignment toggle — hero and cta only */}
      {meta.hasAlignment && (
        <div className="px-3 pt-2 pb-2 border-b border-neutral-100 flex items-center gap-3">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-400 shrink-0">Alignment</p>
          <div className="inline-flex items-center rounded overflow-hidden border border-neutral-200 divide-x divide-neutral-200">
            {(["left", "center", "right"] as Align[]).map((a) => {
              const isActive = align === a;
              const label    = a === "left" ? "Left" : a === "center" ? "Center" : "Right";
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAlign(a)}
                  className={[
                    "px-2.5 py-1 text-[9px] font-semibold leading-none transition-colors",
                    isActive
                      ? "bg-amber-500 text-white"
                      : "bg-white text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ③ Media badge — hero only */}
      {meta.hasMedia && (
        <div className="px-3 py-1.5 border-b border-neutral-100 flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-14 shrink-0">Media</span>
          <MediaBadge content={content} />
        </div>
      )}

      {/* ④ Content fields — slot-specific labels */}
      <div className="px-3 py-2 space-y-1.5">
        {content.tag && (
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-14 pt-px">
              {meta.tagLabel}
            </span>
            <span className="text-violet-600 font-medium">{truncate(content.tag, 60)}</span>
          </div>
        )}
        <div className="flex items-start gap-1.5">
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-14 pt-px">
            {meta.titleLabel}
          </span>
          <span className="font-semibold text-neutral-800 leading-snug">{truncate(content.title, 80)}</span>
        </div>
        {content.subtitle && (
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-14 pt-px">Subtitle</span>
            <span className="text-neutral-500 leading-snug">{truncate(content.subtitle, 110)}</span>
          </div>
        )}
        {meta.ctaLabel && content.ctas && content.ctas.length > 0 && (
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-14 pt-px">
              {meta.ctaLabel}
            </span>
            <div className="flex flex-wrap gap-1">
              {content.ctas.map((cta, i) => (
                <span
                  key={i}
                  className={[
                    "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ring-1",
                    i === 0
                      ? "bg-indigo-600 text-white ring-indigo-700"
                      : "bg-white text-indigo-600 ring-indigo-200",
                  ].join(" ")}
                >
                  {truncate(cta.label, 30)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ⑤ Per-item cards — proof / feature slots */}
        {meta.hasItems && (
          <div className="mt-1 border-t border-neutral-100 pt-2 space-y-2">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-300">
              {meta.itemLabel}s
            </p>
            {content.items && content.items.length > 0 ? (
              content.items.map((item, i) => (
                <div
                  key={i}
                  className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1.5 space-y-0.5"
                >
                  <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest mb-0.5">
                    {meta.itemLabel} {i + 1}
                  </p>
                  {meta.itemHasImage && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-10 shrink-0">Image</span>
                      {item.imageUrl
                        ? <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-600 ring-1 ring-blue-200">image</span>
                        : <span className="text-[9px] text-neutral-300">, </span>
                      }
                    </div>
                  )}
                  {(item.title) && (
                    <div className="flex items-start gap-1">
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-10 pt-px">Title</span>
                      <span className="font-medium text-neutral-700 leading-snug">{truncate(item.title, 60)}</span>
                    </div>
                  )}
                  {(item.text || item.body) && (
                    <div className="flex items-start gap-1">
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-10 pt-px">Text</span>
                      <span className="text-neutral-500 leading-snug">{truncate(item.text ?? item.body, 80)}</span>
                    </div>
                  )}
                  {meta.itemHasCta && item.cta && (
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-neutral-300 w-10">CTA</span>
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-indigo-600 text-white ring-1 ring-indigo-700">
                        {truncate(item.cta, 30)}
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              /* No items configured yet — show placeholder cards */
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="rounded border border-dashed border-neutral-200 bg-white px-1.5 py-2 space-y-1 text-center"
                  >
                    {meta.itemHasImage && (
                      <div className="mx-auto w-6 h-4 rounded bg-neutral-100" />
                    )}
                    <div className="mx-auto h-2 w-3/4 rounded bg-neutral-100" />
                    <div className="mx-auto h-1.5 w-full rounded bg-neutral-100" />
                    <div className="mx-auto h-1.5 w-5/6 rounded bg-neutral-100" />
                    {meta.itemHasCta && (
                      <div className="mx-auto mt-1 h-3 w-2/3 rounded bg-neutral-200" />
                    )}
                    <p className="text-[8px] text-neutral-300">{meta.itemLabel} {n}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
