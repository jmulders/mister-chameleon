"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setAdvertiserRoleAction,
  addPublisherAction,
  setPublisherStatusAction,
  createAdAction,
  setAdStatusAction,
  type AdsOverview,
  type CreateAdInput,
} from "../actions";
import type { AdSlotType, AdPricingModel } from "@/lib/ads/types";

const SLOTS: AdSlotType[] = ["hero", "proof", "cta", "feature", "conversion", "notification"];

/** Starter creative per slot type (matches renderBlockHtml / the setup doc). */
const CREATIVE_TEMPLATES: Record<AdSlotType, unknown> = {
  hero:         { tag: "Sponsored", title: "Your headline", subtitle: "One line of supporting copy.", ctas: [{ label: "Learn more", href: "https://advertiser.example" }] },
  cta:          { title: "Ready to switch?", text: "A short pitch.", cta: { label: "Get started", href: "https://advertiser.example" } },
  notification: { message: "Something new.", severity: "info", ctaLabel: "See it", ctaHref: "https://advertiser.example" },
  proof:        { title: "Trusted widely", items: [{ title: "5,000+", text: "teams" }] },
  feature:      { title: "Why us", subtitle: "The difference.", items: [{ title: "Fast", body: "Live in a day." }] },
  conversion:   { urgencyLabel: "Limited", title: "Start today", text: "A reason to act now.", ctas: [{ label: "Claim", href: "https://advertiser.example" }] },
};

function euros(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return "€" + (Number(cents) / 100).toFixed(2);
}

const card = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";
const label = "block text-xs font-semibold text-neutral-600 mb-1";
const input = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
const btn = "inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50";

export function AdsClient({ tenantId, initial }: { tenantId: string; initial: AdsOverview }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  };

  // ── Not an advertiser yet ────────────────────────────────────────────────
  if (!initial.isAdvertiser) {
    return (
      <div className={card}>
        <h3 className="text-base font-semibold text-neutral-900">Advertiser mode is off</h3>
        <p className="mt-1 text-sm text-neutral-600 max-w-xl">
          Enable it to run this tenant as an ad account. Its siteKey becomes the key
          publishers embed, its adaptive slots serve ads, and billing switches to
          metered impressions/clicks against the wallet.
        </p>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <button className={btn + " mt-4"} disabled={pending}
          onClick={() => run(() => setAdvertiserRoleAction(tenantId, true))}>
          Enable advertiser mode
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {err && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{err}</div>}

      {/* Account summary */}
      <div className={card}>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className={label}>SiteKey (publishers embed this)</div>
            <code className="rounded bg-neutral-100 px-2 py-1 text-xs">{initial.siteKey ?? "— generate one under Snippet —"}</code>
          </div>
          <div>
            <div className={label}>Wallet balance</div>
            <div className="text-sm font-semibold">{euros(initial.walletBalance)}</div>
          </div>
          <div className="ml-auto">
            <button className={btnGhost} disabled={pending}
              onClick={() => run(() => setAdvertiserRoleAction(tenantId, false))}>
              Disable advertiser mode
            </button>
          </div>
        </div>
        {(initial.walletBalance ?? 0) <= 0 && (
          <p className="mt-3 text-xs text-amber-700">Wallet is empty — no ads will serve until it is funded (top up under Admin → Billing).</p>
        )}
      </div>

      <PublishersCard tenantId={tenantId} initial={initial} pending={pending} run={run} />
      <CreateAdCard tenantId={tenantId} pending={pending} run={run} />
      <AdsListCard tenantId={tenantId} initial={initial} pending={pending} run={run} />
    </div>
  );
}

type RunFn = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;

function PublishersCard({ tenantId, initial, pending, run }:
  { tenantId: string; initial: AdsOverview; pending: boolean; run: RunFn }) {
  const [domain, setDomain] = useState("");
  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">Approved publishers</h3>
      <p className="mt-1 text-sm text-neutral-600">Only these domains may serve your ads with your siteKey.</p>
      <div className="mt-3 flex gap-2">
        <input className={input + " max-w-xs"} placeholder="publisher.nl" value={domain}
          onChange={(e) => setDomain(e.target.value)} />
        <button className={btn} disabled={pending || !domain.trim()}
          onClick={() => { run(() => addPublisherAction(tenantId, domain, true)); setDomain(""); }}>
          Add + approve
        </button>
      </div>
      <div className="mt-4 divide-y divide-neutral-100">
        {initial.publishers.length === 0 && <p className="text-sm text-neutral-400 py-2">No publishers yet.</p>}
        {initial.publishers.map((p) => (
          <div key={p.publisher_domain} className="flex items-center gap-3 py-2 text-sm">
            <span className="font-medium">{p.publisher_domain}</span>
            <span className={"rounded px-1.5 py-0.5 text-xs " + (
              p.status === "approved" ? "bg-green-100 text-green-700"
              : p.status === "blocked" ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-600")}>
              {p.status}
            </span>
            <div className="ml-auto flex gap-2">
              {p.status !== "approved" && <button className={btnGhost} disabled={pending}
                onClick={() => run(() => setPublisherStatusAction(tenantId, p.id, "approved"))}>Approve</button>}
              {p.status !== "blocked" && <button className={btnGhost} disabled={pending}
                onClick={() => run(() => setPublisherStatusAction(tenantId, p.id, "blocked"))}>Block</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateAdCard({ tenantId, pending, run }:
  { tenantId: string; pending: boolean; run: RunFn }) {
  const [slot, setSlot] = useState<AdSlotType>("hero");
  const [form, setForm] = useState<CreateAdInput>({
    name: "", slot_type: "hero",
    creativeJson: JSON.stringify(CREATIVE_TEMPLATES.hero, null, 2),
    click_url: "", pricing_model: "cpm", rate_cents: 500, budget_cents: 5000, weight: 1,
  });
  const set = (patch: Partial<CreateAdInput>) => setForm((f) => ({ ...f, ...patch }));
  const onSlot = (s: AdSlotType) => { setSlot(s); set({ slot_type: s, creativeJson: JSON.stringify(CREATIVE_TEMPLATES[s], null, 2) }); };

  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">New ad</h3>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={label}>Name</label>
          <input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Acme hero — launch" />
        </div>
        <div>
          <label className={label}>Slot</label>
          <select className={input} value={slot} onChange={(e) => onSlot(e.target.value as AdSlotType)}>
            {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={label}>Creative (JSON) — the CTA link is auto-replaced with a click-tracking URL</label>
          <textarea className={input + " font-mono text-xs h-44"} value={form.creativeJson}
            onChange={(e) => set({ creativeJson: e.target.value })} />
        </div>
        <div>
          <label className={label}>Landing URL (click destination)</label>
          <input className={input} value={form.click_url} onChange={(e) => set({ click_url: e.target.value })} placeholder="https://advertiser.example" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={label}>Model</label>
            <select className={input} value={form.pricing_model} onChange={(e) => set({ pricing_model: e.target.value as AdPricingModel })}>
              <option value="cpm">CPM</option><option value="cpc">CPC</option>
            </select>
          </div>
          <div>
            <label className={label}>{form.pricing_model === "cpm" ? "€/1000 (cents)" : "€/click (cents)"}</label>
            <input type="number" className={input} value={form.rate_cents} onChange={(e) => set({ rate_cents: Number(e.target.value) })} />
          </div>
          <div>
            <label className={label}>Budget (cents, 0=∞)</label>
            <input type="number" className={input} value={form.budget_cents} onChange={(e) => set({ budget_cents: Number(e.target.value) })} />
          </div>
        </div>
      </div>
      <button className={btn + " mt-4"} disabled={pending || !form.name.trim()}
        onClick={() => run(() => createAdAction(tenantId, form))}>
        Create ad
      </button>
    </div>
  );
}

function AdsListCard({ tenantId, initial, pending, run }:
  { tenantId: string; initial: AdsOverview; pending: boolean; run: RunFn }) {
  const statFor = (id: string) => initial.stats.find((s) => s.ad_id === id);
  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">Ads</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100">
              <th className="py-2 pr-3">Name</th><th className="pr-3">Slot</th><th className="pr-3">Pricing</th>
              <th className="pr-3">Spent / budget</th><th className="pr-3">Impr.</th><th className="pr-3">Clicks</th>
              <th className="pr-3">Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {initial.ads.length === 0 && <tr><td colSpan={8} className="py-3 text-neutral-400">No ads yet.</td></tr>}
            {initial.ads.map((a) => {
              const s = statFor(a.id);
              return (
                <tr key={a.id} className="border-b border-neutral-50">
                  <td className="py-2 pr-3 font-medium">{a.name}</td>
                  <td className="pr-3">{a.slot_type}</td>
                  <td className="pr-3">{a.pricing_model.toUpperCase()} {euros(a.rate_cents)}</td>
                  <td className="pr-3">{euros(a.spent_cents)} / {a.budget_cents > 0 ? euros(a.budget_cents) : "∞"}</td>
                  <td className="pr-3">{s?.impressions ?? 0}</td>
                  <td className="pr-3">{s?.clicks ?? 0}</td>
                  <td className="pr-3">
                    <span className={"rounded px-1.5 py-0.5 text-xs " + (
                      a.status === "active" ? "bg-green-100 text-green-700"
                      : a.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-600")}>
                      {a.status}
                    </span>
                  </td>
                  <td className="text-right">
                    {a.status === "active"
                      ? <button className={btnGhost} disabled={pending} onClick={() => run(() => setAdStatusAction(tenantId, a.id, "paused"))}>Pause</button>
                      : a.status === "paused"
                      ? <button className={btnGhost} disabled={pending} onClick={() => run(() => setAdStatusAction(tenantId, a.id, "active"))}>Resume</button>
                      : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
