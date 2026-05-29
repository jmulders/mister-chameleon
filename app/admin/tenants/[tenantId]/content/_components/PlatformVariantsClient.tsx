/**
 * PlatformVariantsClient
 *
 * Admin UI for editing variant content when the tenant's CMS is set to
 * "platform" (built-in). Lets operators create, edit, and delete hero, proof,
 * and CTA variants without connecting an external CMS.
 *
 * ─── Features ─────────────────────────────────────────────────────────────────
 *
 *   • Tab strip — one tab per variant type (Hero, Proof, CTA, Feature, Conversion)
 *   • Variant list — shows all saved variants for the active type
 *   • Inline form — click a variant to expand its editor in-place
 *   • Add variant — button to create a new key for the active type
 *   • Delete variant — with a confirmation step
 *   • Seed defaults — populates starter variants (non-destructive)
 *
 * ─── Form shapes ──────────────────────────────────────────────────────────────
 *
 *   Hero:       key, title, subtitle, ctas[0..1] {label, href}, tag?
 *   Proof:      key, title, items[] {title, text}
 *   CTA:        key, title, text, cta {label, href}
 *   Feature:    key, title, subtitle?, items[] {icon?, title, body}
 *   Conversion: key, title, text, ctas[] {label, href}
 */

"use client";

import { useState, useTransition, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { PlatformVariantRow, VariantType } from "../actions";
import {
  listPlatformVariantsAction,
  savePlatformVariantAction,
  deletePlatformVariantAction,
  seedPlatformVariantsAction,
} from "../actions";

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls = [
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2",
  "text-sm text-neutral-900 placeholder:text-neutral-400",
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
].join(" ");

const labelCls = "block text-xs font-medium text-neutral-600 mb-1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CTAItem { label: string; href: string; }
interface ProofItem { title: string; text: string; }
interface FeatureItem { icon: string; title: string; body: string; }

interface HeroForm {
  key:      string;
  title:    string;
  subtitle: string;
  tag:      string;
  cta0_label: string; cta0_href: string;
  cta1_label: string; cta1_href: string;
}

interface ProofForm {
  key:   string;
  title: string;
  items: ProofItem[];
}

interface CTAForm {
  key:       string;
  title:     string;
  text:      string;
  cta_label: string;
  cta_href:  string;
}

interface FeatureForm {
  key:      string;
  title:    string;
  subtitle: string;
  items:    FeatureItem[];
}

interface ConversionForm {
  key:       string;
  title:     string;
  text:      string;
  cta0_label: string; cta0_href: string;
  cta1_label: string; cta1_href: string;
}

interface NotificationForm {
  key:           string;
  message:       string;
  severity:      "info" | "success" | "warning" | "promo";
  cta_label:     string;
  cta_href:      string;
  position:      "top" | "bottom-right";
  dismissible:   boolean;
  autoDismissMs: number;
}

type AnyForm = HeroForm | ProofForm | CTAForm | FeatureForm | ConversionForm | NotificationForm;

// ── Helpers ───────────────────────────────────────────────────────────────────

const VARIANT_TYPES: { key: VariantType; label: string }[] = [
  { key: "hero",         label: "Hero" },
  { key: "proof",        label: "Proof" },
  { key: "cta",          label: "CTA" },
  { key: "feature",      label: "Feature" },
  { key: "conversion",   label: "Conversion" },
  { key: "notification", label: "Notification" },
];

function rowToHeroForm(row: PlatformVariantRow): HeroForm {
  const c = row.content as Record<string, unknown>;
  const ctas = (c.ctas as CTAItem[] | undefined) ?? [];
  return {
    key:        row.variant_key,
    title:      String(c.title ?? ""),
    subtitle:   String(c.subtitle ?? ""),
    tag:        String(c.tag ?? ""),
    cta0_label: ctas[0]?.label ?? "",
    cta0_href:  ctas[0]?.href  ?? "",
    cta1_label: ctas[1]?.label ?? "",
    cta1_href:  ctas[1]?.href  ?? "",
  };
}

function heroFormToContent(f: HeroForm): Record<string, unknown> {
  const ctas: CTAItem[] = [];
  if (f.cta0_label.trim()) ctas.push({ label: f.cta0_label.trim(), href: f.cta0_href.trim() });
  if (f.cta1_label.trim()) ctas.push({ label: f.cta1_label.trim(), href: f.cta1_href.trim() });
  return {
    title:    f.title.trim(),
    subtitle: f.subtitle.trim(),
    ...(f.tag.trim() ? { tag: f.tag.trim() } : {}),
    ctas,
  };
}

function rowToProofForm(row: PlatformVariantRow): ProofForm {
  const c = row.content as Record<string, unknown>;
  return {
    key:   row.variant_key,
    title: String(c.title ?? ""),
    items: (c.items as ProofItem[] | undefined) ?? [{ title: "", text: "" }],
  };
}

function proofFormToContent(f: ProofForm): Record<string, unknown> {
  return {
    title: f.title.trim(),
    items: f.items.filter((i) => i.title.trim() || i.text.trim()).map((i) => ({
      title: i.title.trim(),
      text:  i.text.trim(),
    })),
  };
}

function rowToCTAForm(row: PlatformVariantRow): CTAForm {
  const c = row.content as Record<string, unknown>;
  const cta = c.cta as CTAItem | undefined;
  return {
    key:       row.variant_key,
    title:     String(c.title ?? ""),
    text:      String(c.text  ?? ""),
    cta_label: cta?.label ?? "",
    cta_href:  cta?.href  ?? "",
  };
}

function ctaFormToContent(f: CTAForm): Record<string, unknown> {
  return {
    title: f.title.trim(),
    text:  f.text.trim(),
    cta:   { label: f.cta_label.trim(), href: f.cta_href.trim() },
  };
}

function rowToFeatureForm(row: PlatformVariantRow): FeatureForm {
  const c = row.content as Record<string, unknown>;
  return {
    key:      row.variant_key,
    title:    String(c.title    ?? ""),
    subtitle: String(c.subtitle ?? ""),
    items:    (c.items as FeatureItem[] | undefined) ?? [{ icon: "", title: "", body: "" }],
  };
}

function featureFormToContent(f: FeatureForm): Record<string, unknown> {
  return {
    title:    f.title.trim(),
    subtitle: f.subtitle.trim() || undefined,
    items:    f.items.filter((i) => i.title.trim() || i.body.trim()).map((i) => ({
      ...(i.icon.trim() ? { icon: i.icon.trim() } : {}),
      title: i.title.trim(),
      body:  i.body.trim(),
    })),
  };
}

function rowToConversionForm(row: PlatformVariantRow): ConversionForm {
  const c = row.content as Record<string, unknown>;
  const ctas = (c.ctas as CTAItem[] | undefined) ?? [];
  return {
    key:        row.variant_key,
    title:      String(c.title ?? ""),
    text:       String(c.text  ?? ""),
    cta0_label: ctas[0]?.label ?? "",
    cta0_href:  ctas[0]?.href  ?? "",
    cta1_label: ctas[1]?.label ?? "",
    cta1_href:  ctas[1]?.href  ?? "",
  };
}

function conversionFormToContent(f: ConversionForm): Record<string, unknown> {
  const ctas: CTAItem[] = [];
  if (f.cta0_label.trim()) ctas.push({ label: f.cta0_label.trim(), href: f.cta0_href.trim() });
  if (f.cta1_label.trim()) ctas.push({ label: f.cta1_label.trim(), href: f.cta1_href.trim() });
  return { title: f.title.trim(), text: f.text.trim(), ctas };
}

function rowToNotificationForm(row: PlatformVariantRow): NotificationForm {
  const c = row.content as Record<string, unknown>;
  return {
    key:           row.variant_key,
    message:       String(c.message ?? ""),
    severity:      (c.severity as NotificationForm["severity"]) ?? "info",
    cta_label:     String(c.ctaLabel ?? ""),
    cta_href:      String(c.ctaHref  ?? ""),
    position:      (c.position as NotificationForm["position"]) ?? "top",
    dismissible:   (c.dismissible as boolean) ?? true,
    autoDismissMs: Number(c.autoDismissMs ?? 0),
  };
}

function notificationFormToContent(f: NotificationForm): Record<string, unknown> {
  return {
    message:      f.message.trim(),
    severity:     f.severity,
    ...(f.cta_label.trim() ? { ctaLabel: f.cta_label.trim() } : {}),
    ...(f.cta_href.trim()  ? { ctaHref:  f.cta_href.trim()  } : {}),
    position:     f.position,
    dismissible:  f.dismissible,
    autoDismissMs: f.autoDismissMs,
  };
}

// Build an empty blank row for a given type
function emptyRow(variantType: VariantType, key: string): PlatformVariantRow {
  return {
    id:           "__new__",
    variant_type: variantType,
    variant_key:  key,
    content:      {},
    updated_at:   new Date().toISOString(),
  };
}

// ── Hero form ─────────────────────────────────────────────────────────────────

function HeroEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial:  HeroForm;
  onSave:   (f: HeroForm) => void;
  onCancel: () => void;
  saving:   boolean;
}) {
  const [f, setF] = useState<HeroForm>(initial);
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Variant key</label>
        <input className={inputCls} value={f.key}
          onChange={(e) => setF({ ...f, key: e.target.value })}
          placeholder="e.g. hero_direct_brand"
          disabled={initial.key !== "" && initial.key !== "__new__"}
        />
      </div>
      <div>
        <label className={labelCls}>Eyebrow tag <span className="font-normal text-neutral-400">(optional)</span></label>
        <input className={inputCls} value={f.tag}
          onChange={(e) => setF({ ...f, tag: e.target.value })}
          placeholder="e.g. AI-powered personalisation"
        />
      </div>
      <div>
        <label className={labelCls}>Headline</label>
        <input className={inputCls} value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="Main headline"
        />
      </div>
      <div>
        <label className={labelCls}>Subtitle</label>
        <textarea className={cn(inputCls, "resize-y")} rows={3} value={f.subtitle}
          onChange={(e) => setF({ ...f, subtitle: e.target.value })}
          placeholder="Supporting paragraph"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Primary CTA label</label>
          <input className={inputCls} value={f.cta0_label}
            onChange={(e) => setF({ ...f, cta0_label: e.target.value })}
            placeholder="Get started free"
          />
        </div>
        <div>
          <label className={labelCls}>Primary CTA href</label>
          <input className={inputCls} value={f.cta0_href}
            onChange={(e) => setF({ ...f, cta0_href: e.target.value })}
            placeholder="/trial/start"
          />
        </div>
        <div>
          <label className={labelCls}>Secondary CTA label <span className="font-normal text-neutral-400">(opt)</span></label>
          <input className={inputCls} value={f.cta1_label}
            onChange={(e) => setF({ ...f, cta1_label: e.target.value })}
            placeholder="See how it works"
          />
        </div>
        <div>
          <label className={labelCls}>Secondary CTA href</label>
          <input className={inputCls} value={f.cta1_href}
            onChange={(e) => setF({ ...f, cta1_href: e.target.value })}
            placeholder="/the-engine"
          />
        </div>
      </div>
      <FormButtons saving={saving} onSave={() => onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── Proof form ────────────────────────────────────────────────────────────────

function ProofEditor({
  initial, onSave, onCancel, saving,
}: { initial: ProofForm; onSave: (f: ProofForm) => void; onCancel: () => void; saving: boolean }) {
  const [f, setF] = useState<ProofForm>(() => ({
    ...initial,
    items: initial.items.length ? initial.items : [{ title: "", text: "" }],
  }));
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Variant key</label>
        <input className={inputCls} value={f.key}
          onChange={(e) => setF({ ...f, key: e.target.value })}
          placeholder="e.g. proof_default"
          disabled={initial.key !== ""}
        />
      </div>
      <div>
        <label className={labelCls}>Section heading</label>
        <input className={inputCls} value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="Trusted by growth teams"
        />
      </div>
      <div className="space-y-3">
        <label className={labelCls}>Proof items</label>
        {f.items.map((item, idx) => (
          <div key={idx} className="rounded-md border border-neutral-200 p-3 space-y-2">
            <div>
              <label className={labelCls}>Stat / title</label>
              <input className={inputCls} value={item.title}
                onChange={(e) => {
                  const items = [...f.items]; items[idx] = { ...item, title: e.target.value };
                  setF({ ...f, items });
                }}
                placeholder="3.2× more leads"
              />
            </div>
            <div>
              <label className={labelCls}>Body text</label>
              <textarea className={cn(inputCls, "resize-y")} rows={2} value={item.text}
                onChange={(e) => {
                  const items = [...f.items]; items[idx] = { ...item, text: e.target.value };
                  setF({ ...f, items });
                }}
                placeholder="Supporting sentence"
              />
            </div>
            {f.items.length > 1 && (
              <button type="button" className="text-[11px] text-red-600 hover:underline"
                onClick={() => setF({ ...f, items: f.items.filter((_, i) => i !== idx) })}>
                Remove item
              </button>
            )}
          </div>
        ))}
        <button type="button"
          className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          onClick={() => setF({ ...f, items: [...f.items, { title: "", text: "" }] })}>
          + Add item
        </button>
      </div>
      <FormButtons saving={saving} onSave={() => onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── CTA form ──────────────────────────────────────────────────────────────────

function CTAEditor({
  initial, onSave, onCancel, saving,
}: { initial: CTAForm; onSave: (f: CTAForm) => void; onCancel: () => void; saving: boolean }) {
  const [f, setF] = useState<CTAForm>(initial);
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Variant key</label>
        <input className={inputCls} value={f.key}
          onChange={(e) => setF({ ...f, key: e.target.value })}
          placeholder="e.g. cta_guide"
          disabled={initial.key !== ""}
        />
      </div>
      <div>
        <label className={labelCls}>Headline</label>
        <input className={inputCls} value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="Ready to personalise your homepage?"
        />
      </div>
      <div>
        <label className={labelCls}>Body text</label>
        <textarea className={cn(inputCls, "resize-y")} rows={2} value={f.text}
          onChange={(e) => setF({ ...f, text: e.target.value })}
          placeholder="Set up takes 10 minutes."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CTA label</label>
          <input className={inputCls} value={f.cta_label}
            onChange={(e) => setF({ ...f, cta_label: e.target.value })}
            placeholder="Get started free"
          />
        </div>
        <div>
          <label className={labelCls}>CTA href</label>
          <input className={inputCls} value={f.cta_href}
            onChange={(e) => setF({ ...f, cta_href: e.target.value })}
            placeholder="/trial/start"
          />
        </div>
      </div>
      <FormButtons saving={saving} onSave={() => onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── Feature form ──────────────────────────────────────────────────────────────

function FeatureEditor({
  initial, onSave, onCancel, saving,
}: { initial: FeatureForm; onSave: (f: FeatureForm) => void; onCancel: () => void; saving: boolean }) {
  const [f, setF] = useState<FeatureForm>(() => ({
    ...initial,
    items: initial.items.length ? initial.items : [{ icon: "", title: "", body: "" }],
  }));
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Variant key</label>
        <input className={inputCls} value={f.key}
          onChange={(e) => setF({ ...f, key: e.target.value })}
          placeholder="e.g. feature_highlights"
          disabled={initial.key !== ""}
        />
      </div>
      <div>
        <label className={labelCls}>Section heading</label>
        <input className={inputCls} value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="What makes us different"
        />
      </div>
      <div>
        <label className={labelCls}>Subtitle <span className="font-normal text-neutral-400">(optional)</span></label>
        <input className={inputCls} value={f.subtitle}
          onChange={(e) => setF({ ...f, subtitle: e.target.value })}
          placeholder="Optional intro sentence"
        />
      </div>
      <div className="space-y-3">
        <label className={labelCls}>Feature items</label>
        {f.items.map((item, idx) => (
          <div key={idx} className="rounded-md border border-neutral-200 p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Icon key <span className="font-normal text-neutral-400">(opt)</span></label>
                <input className={inputCls} value={item.icon}
                  onChange={(e) => {
                    const items = [...f.items]; items[idx] = { ...item, icon: e.target.value };
                    setF({ ...f, items });
                  }}
                  placeholder="lightning"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Title</label>
                <input className={inputCls} value={item.title}
                  onChange={(e) => {
                    const items = [...f.items]; items[idx] = { ...item, title: e.target.value };
                    setF({ ...f, items });
                  }}
                  placeholder="Feature name"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Body</label>
              <textarea className={cn(inputCls, "resize-y")} rows={2} value={item.body}
                onChange={(e) => {
                  const items = [...f.items]; items[idx] = { ...item, body: e.target.value };
                  setF({ ...f, items });
                }}
                placeholder="2-3 sentence description"
              />
            </div>
            {f.items.length > 1 && (
              <button type="button" className="text-[11px] text-red-600 hover:underline"
                onClick={() => setF({ ...f, items: f.items.filter((_, i) => i !== idx) })}>
                Remove item
              </button>
            )}
          </div>
        ))}
        <button type="button"
          className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          onClick={() => setF({ ...f, items: [...f.items, { icon: "", title: "", body: "" }] })}>
          + Add item
        </button>
      </div>
      <FormButtons saving={saving} onSave={() => onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── Conversion form ───────────────────────────────────────────────────────────

function ConversionEditor({
  initial, onSave, onCancel, saving,
}: { initial: ConversionForm; onSave: (f: ConversionForm) => void; onCancel: () => void; saving: boolean }) {
  const [f, setF] = useState<ConversionForm>(initial);
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Variant key</label>
        <input className={inputCls} value={f.key}
          onChange={(e) => setF({ ...f, key: e.target.value })}
          placeholder="e.g. conversion_demo"
          disabled={initial.key !== ""}
        />
      </div>
      <div>
        <label className={labelCls}>Headline</label>
        <input className={inputCls} value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="Book a personalised demo"
        />
      </div>
      <div>
        <label className={labelCls}>Body text</label>
        <textarea className={cn(inputCls, "resize-y")} rows={2} value={f.text}
          onChange={(e) => setF({ ...f, text: e.target.value })}
          placeholder="Supporting paragraph"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Primary CTA label</label>
          <input className={inputCls} value={f.cta0_label}
            onChange={(e) => setF({ ...f, cta0_label: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Primary CTA href</label>
          <input className={inputCls} value={f.cta0_href}
            onChange={(e) => setF({ ...f, cta0_href: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Secondary CTA label <span className="font-normal text-neutral-400">(opt)</span></label>
          <input className={inputCls} value={f.cta1_label}
            onChange={(e) => setF({ ...f, cta1_label: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Secondary CTA href</label>
          <input className={inputCls} value={f.cta1_href}
            onChange={(e) => setF({ ...f, cta1_href: e.target.value })}
          />
        </div>
      </div>
      <FormButtons saving={saving} onSave={() => onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── Notification form ─────────────────────────────────────────────────────────

function NotificationEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial:  NotificationForm;
  onSave:   (f: NotificationForm) => void;
  onCancel: () => void;
  saving:   boolean;
}) {
  const [f, setF] = useState<NotificationForm>(initial);
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Variant key</label>
        <input className={inputCls} value={f.key}
          onChange={(e) => setF({ ...f, key: e.target.value })}
          placeholder="e.g. notification_offer"
          disabled={initial.key !== "" && initial.key !== "__new__"}
        />
      </div>
      <div>
        <label className={labelCls}>Message</label>
        <textarea className={cn(inputCls, "resize-y")} rows={2} value={f.message}
          onChange={(e) => setF({ ...f, message: e.target.value })}
          placeholder="🎁 Beperkte aanbieding — alleen deze week."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Severity</label>
          <select className={inputCls} value={f.severity}
            onChange={(e) => setF({ ...f, severity: e.target.value as NotificationForm["severity"] })}>
            <option value="info">Info (blue)</option>
            <option value="success">Success (green)</option>
            <option value="warning">Warning (amber)</option>
            <option value="promo">Promo (brand)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Position</label>
          <select className={inputCls} value={f.position}
            onChange={(e) => setF({ ...f, position: e.target.value as NotificationForm["position"] })}>
            <option value="top">Top banner</option>
            <option value="bottom-right">Bottom-right toast</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>CTA label <span className="font-normal text-neutral-400">(opt)</span></label>
          <input className={inputCls} value={f.cta_label}
            onChange={(e) => setF({ ...f, cta_label: e.target.value })}
            placeholder="Bekijk aanbieding"
          />
        </div>
        <div>
          <label className={labelCls}>CTA href <span className="font-normal text-neutral-400">(opt)</span></label>
          <input className={inputCls} value={f.cta_href}
            onChange={(e) => setF({ ...f, cta_href: e.target.value })}
            placeholder="/pricing"
          />
        </div>
        <div>
          <label className={labelCls}>Auto-dismiss (ms) <span className="font-normal text-neutral-400">(0 = never)</span></label>
          <input className={inputCls} type="number" min={0} step={500} value={f.autoDismissMs}
            onChange={(e) => setF({ ...f, autoDismissMs: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="notif-dismissible" checked={f.dismissible}
            onChange={(e) => setF({ ...f, dismissible: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300"
          />
          <label htmlFor="notif-dismissible" className="text-xs text-neutral-700">Visitor can dismiss</label>
        </div>
      </div>
      <FormButtons saving={saving} onSave={() => onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── Shared form buttons ───────────────────────────────────────────────────────

function FormButtons({ saving, onSave, onCancel }: {
  saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button type="button" disabled={saving}
        onClick={onSave}
        className={cn(
          "rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white",
          "hover:bg-brand-700 transition-colors",
          saving && "cursor-not-allowed opacity-60",
        )}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={onCancel}
        className="rounded-md border border-neutral-200 px-4 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors">
        Cancel
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlatformVariantsClient({
  tenantId,
  initialVariants,
}: {
  tenantId:        string;
  initialVariants: PlatformVariantRow[];
}) {
  const [variants,      setVariants]      = useState<PlatformVariantRow[]>(initialVariants);
  const [activeType,    setActiveType]    = useState<VariantType>("hero");
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [deletingKey,   setDeletingKey]   = useState<string | null>(null);
  const [newMode,       setNewMode]       = useState(false);
  const [statusMsg,     setStatusMsg]     = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending,     startTransition]  = useTransition();

  const activeVariants = variants.filter((v) => v.variant_type === activeType);

  // ── Reload from DB ─────────────────────────────────────────────────────────

  const reload = useCallback(() => {
    startTransition(async () => {
      const result = await listPlatformVariantsAction(tenantId);
      if (result.ok) setVariants(result.variants);
    });
  }, [tenantId]);

  // ── Save ───────────────────────────────────────────────────────────────────

  function handleSave(variantKey: string, content: Record<string, unknown>) {
    startTransition(async () => {
      const result = await savePlatformVariantAction(tenantId, activeType, variantKey, content);
      if (result.ok) {
        setStatusMsg({ ok: true, text: `Saved "${variantKey}".` });
        setExpandedId(null);
        setNewMode(false);
        reload();
      } else {
        setStatusMsg({ ok: false, text: result.error });
      }
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(row: PlatformVariantRow) {
    if (deletingKey === row.variant_key) {
      // Second click = confirmed delete
      startTransition(async () => {
        const result = await deletePlatformVariantAction(tenantId, row.variant_type, row.variant_key);
        if (result.ok) {
          setStatusMsg({ ok: true, text: `Deleted "${row.variant_key}".` });
          setDeletingKey(null);
          reload();
        } else {
          setStatusMsg({ ok: false, text: result.error });
        }
      });
    } else {
      setDeletingKey(row.variant_key);
    }
  }

  // ── Seed defaults ──────────────────────────────────────────────────────────

  function handleSeed() {
    startTransition(async () => {
      const result = await seedPlatformVariantsAction(tenantId);
      if (result.ok) {
        setStatusMsg({ ok: true, text: `Seeded ${result.seeded} starter variant(s).` });
        reload();
      } else {
        setStatusMsg({ ok: false, text: result.error });
      }
    });
  }

  // ── Render editors ─────────────────────────────────────────────────────────

  function renderEditor(row: PlatformVariantRow, onCancel: () => void) {
    const saving = isPending;
    switch (activeType) {
      case "hero": {
        const f = rowToHeroForm(row);
        return <HeroEditor initial={f} saving={saving} onCancel={onCancel}
          onSave={(nf) => handleSave(nf.key, heroFormToContent(nf))} />;
      }
      case "proof": {
        const f = rowToProofForm(row);
        return <ProofEditor initial={f} saving={saving} onCancel={onCancel}
          onSave={(nf) => handleSave(nf.key, proofFormToContent(nf))} />;
      }
      case "cta": {
        const f = rowToCTAForm(row);
        return <CTAEditor initial={f} saving={saving} onCancel={onCancel}
          onSave={(nf) => handleSave(nf.key, ctaFormToContent(nf))} />;
      }
      case "feature": {
        const f = rowToFeatureForm(row);
        return <FeatureEditor initial={f} saving={saving} onCancel={onCancel}
          onSave={(nf) => handleSave(nf.key, featureFormToContent(nf))} />;
      }
      case "conversion": {
        const f = rowToConversionForm(row);
        return <ConversionEditor initial={f} saving={saving} onCancel={onCancel}
          onSave={(nf) => handleSave(nf.key, conversionFormToContent(nf))} />;
      }
      case "notification": {
        const f = rowToNotificationForm(row);
        return <NotificationEditor initial={f} saving={saving} onCancel={onCancel}
          onSave={(nf) => handleSave(nf.key, notificationFormToContent(nf))} />;
      }
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Platform CMS Variants</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Create and edit the variant content served by the built-in Platform CMS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSeed}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Seed defaults
          </button>
          <button
            type="button"
            disabled={isPending || newMode}
            onClick={() => { setNewMode(true); setExpandedId(null); setDeletingKey(null); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            + New variant
          </button>
        </div>
      </div>

      {/* ── Status message ─────────────────────────────────────────────────── */}
      {statusMsg && (
        <div className={cn(
          "rounded-md px-3 py-2 text-xs",
          statusMsg.ok
            ? "border border-green-200 bg-green-50 text-green-700"
            : "border border-red-200 bg-red-50 text-red-700",
        )}>
          {statusMsg.ok ? "✓ " : "⚠ "}{statusMsg.text}
          <button className="ml-2 underline opacity-70 hover:opacity-100" onClick={() => setStatusMsg(null)}>
            dismiss
          </button>
        </div>
      )}

      {/* ── Type tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-neutral-200">
        {VARIANT_TYPES.map(({ key, label }) => {
          const count = variants.filter((v) => v.variant_type === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveType(key); setExpandedId(null); setNewMode(false); setDeletingKey(null); }}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors relative",
                activeType === key
                  ? "text-brand-700 after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-brand-600"
                  : "text-neutral-500 hover:text-neutral-800",
              )}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── New variant form ────────────────────────────────────────────────── */}
      {newMode && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="mb-3 text-xs font-semibold text-brand-700">
            New {activeType} variant
          </p>
          {renderEditor(
            emptyRow(activeType, ""),
            () => setNewMode(false),
          )}
        </div>
      )}

      {/* ── Variant list ────────────────────────────────────────────────────── */}
      {activeVariants.length === 0 && !newMode ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 py-10 text-center">
          <p className="text-sm font-medium text-neutral-500">No {activeType} variants yet</p>
          <p className="mt-1 text-xs text-neutral-400">
            Click <strong>+ New variant</strong> or <strong>Seed defaults</strong> to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeVariants.map((row) => {
            const isExpanded  = expandedId === row.id;
            const isDeleting  = deletingKey === row.variant_key;

            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-lg border bg-white transition-colors",
                  isExpanded ? "border-brand-300 ring-1 ring-brand-200" : "border-neutral-200",
                )}
              >
                {/* Row header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : row.id);
                      setNewMode(false);
                      setDeletingKey(null);
                    }}
                  >
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      isExpanded ? "bg-brand-500" : "bg-neutral-300",
                    )} />
                    <code className="text-xs font-mono text-neutral-700 truncate">
                      {row.variant_key}
                    </code>
                    <span className="text-[10px] text-neutral-400 shrink-0">
                      {new Date(row.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                    className={cn(
                      "shrink-0 rounded px-2 py-1 text-[11px] transition-colors",
                      isDeleting
                        ? "bg-red-600 text-white font-semibold"
                        : "text-neutral-400 hover:text-red-600 hover:bg-red-50",
                    )}
                  >
                    {isDeleting ? "Confirm delete" : "Delete"}
                  </button>
                  {isDeleting && (
                    <button
                      type="button"
                      className="shrink-0 rounded px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-100 transition-colors"
                      onClick={() => setDeletingKey(null)}
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-4 py-4">
                    {renderEditor(row, () => setExpandedId(null))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
