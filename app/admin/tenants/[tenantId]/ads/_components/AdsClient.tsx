"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setAdvertiserRoleAction,
  addPublisherAction,
  setPublisherStatusAction,
  createAdAction,
  setAdStatusAction,
  fetchAdSessionsAction,
  type AdsOverview,
  type CreateAdInput,
  type DayReport,
  type AdSession,
} from "../actions";
import type { AdSlotType, AdPricingModel } from "@/lib/ads/types";
import type { AdFunnelStage } from "@/lib/ads/targeting";

const SLOTS: AdSlotType[] = ["hero", "proof", "cta", "feature", "conversion", "notification"];
const FUNNEL_STAGES: AdFunnelStage[] = ["awareness", "consideration", "intent", "high_intent", "customer"];

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

      <EmbedCard
        siteKey={initial.siteKey}
        slots={(() => {
          const s = Array.from(new Set(initial.ads.filter((a) => a.status === "active").map((a) => a.slot_type)));
          return s.length > 0 ? s : SLOTS;
        })()}
      />
      <ReportCard
        report={initial.report}
        pendingImpressions={initial.pendingImpressions}
        pendingClicks={initial.pendingClicks}
        pendingSpendCents={initial.pendingSpendCents}
      />
      <SessionsCard tenantId={tenantId} />
      <PublishersCard tenantId={tenantId} initial={initial} pending={pending} run={run} />
      <CreateAdCard tenantId={tenantId} pending={pending} run={run} />
      <AdsListCard tenantId={tenantId} initial={initial} pending={pending} run={run} />
    </div>
  );
}

type RunFn = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;

function Stat({ label: text, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-neutral-500">{text}</div>
      <div className="text-lg font-bold text-neutral-900">{value}</div>
    </div>
  );
}

function SessionsCard({ tenantId }: { tenantId: string }) {
  const [sessions, setSessions] = useState<AdSession[] | null>(null);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [loading, start]        = useTransition();
  const [error, setError]       = useState<string | null>(null);

  const load = () => {
    setError(null);
    start(async () => {
      try { setSessions(await fetchAdSessionsAction(tenantId)); }
      catch { setError("Could not load sessions."); }
    });
  };

  const shortId = (id: string) => (id.length > 14 ? id.slice(0, 8) + "…" + id.slice(-4) : id);
  const when    = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Ad-audience sessions</h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            Journeys of the visitors your ads reached — page path + interest keywords per session.
          </p>
        </div>
        <button className={btnGhost} disabled={loading} onClick={load}>
          {loading ? "Loading…" : sessions ? "Refresh" : "Load sessions"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {sessions && sessions.length === 0 && (
        <p className="mt-4 text-sm text-neutral-400">
          No ad-audience sessions yet — they appear once your ads are served on a publisher.
        </p>
      )}

      {sessions && sessions.length > 0 && (
        <div className="mt-4 space-y-2">
          {sessions.map((s) => {
            const open = openId === s.sessionId;
            return (
              <div key={s.sessionId} className="rounded-lg border border-neutral-200">
                <button
                  onClick={() => setOpenId(open ? null : s.sessionId)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-neutral-700">{shortId(s.sessionId)}</span>
                      {s.publisherDomain && <span className="text-neutral-400">· {s.publisherDomain}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-400">
                      {s.impressions} impr · {s.clicks} clicks · {s.journey.length} pageviews · {when(s.lastSeen)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.adsSeen.slice(0, 2).map((a) => (
                      <span key={a} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{a}</span>
                    ))}
                    <span className="text-neutral-400">{open ? "▾" : "▸"}</span>
                  </div>
                </button>
                {open && (
                  <div className="border-t border-neutral-100 px-3 py-2">
                    {s.journey.length === 0 ? (
                      <p className="text-xs text-neutral-400">No journey captured for this session yet.</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {s.journey.map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className="mt-0.5 text-neutral-300">{i + 1}.</span>
                            <div className="min-w-0">
                              <span className="font-medium text-neutral-700">{step.path ?? "/"}</span>
                              <span className="ml-2 text-neutral-400">{when(step.at)}</span>
                              {step.keywords.length > 0 && (
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {step.keywords.slice(0, 8).map((k) => (
                                    <span key={k} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">{k}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
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

function ReportCard({ report, pendingImpressions = 0, pendingClicks = 0, pendingSpendCents = 0 }: {
  report: DayReport[];
  pendingImpressions?: number;
  pendingClicks?: number;
  pendingSpendCents?: number;
}) {
  const totals = report.reduce(
    (t, d) => ({ impressions: t.impressions + d.impressions, clicks: t.clicks + d.clicks, spend_cents: t.spend_cents + d.spend_cents }),
    { impressions: 0, clicks: 0, spend_cents: 0 },
  );
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const maxImpr = Math.max(1, ...report.map((d) => d.impressions));
  const W = 720, H = 140, pad = 8;
  const bw = report.length > 0 ? (W - pad * 2) / report.length : 0;
  const hasPending = pendingImpressions > 0 || pendingClicks > 0 || pendingSpendCents > 0;

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900">Performance (30 days)</h3>
        {hasPending && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500"></span>
            {pendingImpressions.toLocaleString()} impressies · {euros(pendingSpendCents)} nog niet afgerekend
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-8">
        <Stat label="Impressions" value={totals.impressions.toLocaleString()} />
        <Stat label="Clicks" value={totals.clicks.toLocaleString()} />
        <Stat label="CTR" value={ctr.toFixed(2) + "%"} />
        <Stat label="Spend" value={euros(totals.spend_cents)} />
      </div>
      {hasPending && (
        <p className="mt-2 text-xs text-neutral-400">
          Cijfers zijn live: pas-geregistreerde impressies tellen direct mee. De spend hiervan
          ({euros(pendingSpendCents)}) wordt bij de eerstvolgende afreken-rollup van de wallet afgeschreven.
        </p>
      )}

      {report.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">No data yet — impressions appear after the first served ad.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Impressions per day">
            {report.map((d, i) => {
              const h = (d.impressions / maxImpr) * (H - 16);
              return (
                <rect key={d.date} x={pad + i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} rx={2} fill="#6366f1">
                  <title>{`${d.date} — ${d.impressions} impr · ${d.clicks} clicks · ${euros(d.spend_cents)}`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="mt-3 max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100">
                  <th className="py-1.5 pr-3">Date</th><th className="pr-3">Impr.</th><th className="pr-3">Clicks</th><th className="pr-3">CTR</th><th>Spend</th>
                </tr>
              </thead>
              <tbody>
                {[...report].reverse().map((d) => (
                  <tr key={d.date} className="border-b border-neutral-50">
                    <td className="py-1.5 pr-3">{d.date}</td>
                    <td className="pr-3">{d.impressions.toLocaleString()}</td>
                    <td className="pr-3">{d.clicks.toLocaleString()}</td>
                    <td className="pr-3">{d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(1) + "%" : "—"}</td>
                    <td>{euros(d.spend_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EmbedCard({ siteKey, slots }: { siteKey: string | null; slots: string[] }) {
  const [slot, setSlot] = useState(slots[0] ?? "hero");
  const [copied, setCopied] = useState(false);
  const base = typeof window !== "undefined" ? window.location.origin : "https://www.misterchameleon.nl";
  const code = siteKey
    ? `<!-- Mister Chameleon ad slot — paste where the ad should appear -->\n` +
      `<div data-mc-block="${slot}"></div>\n` +
      `<script src="${base}/api/snippet.js"\n        data-site-key="${siteKey}" async></script>`
    : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked */ }
  };

  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">Embed code for publishers</h3>
      <p className="mt-1 text-sm text-neutral-600 max-w-2xl">
        Give this to a publisher / affiliate. They paste it where the ad should appear —
        on any site, no plugin needed. WordPress and Statamic publishers can use the
        plugin / add-on instead, but this snippet works everywhere.
      </p>
      {!siteKey ? (
        <p className="mt-3 text-sm text-amber-700">Generate a siteKey first on the Snippet tab.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs font-semibold text-neutral-600">Slot</span>
            <select className={input + " max-w-[160px]"} value={slot} onChange={(e) => setSlot(e.target.value)}>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className={btn} onClick={copy}>{copied ? "Copied!" : "Copy code"}</button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-neutral-900 p-4 text-xs text-neutral-100"><code>{code}</code></pre>
        </>
      )}
    </div>
  );
}

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
  const setT = (patch: Partial<NonNullable<CreateAdInput["targeting"]>>) =>
    setForm((f) => ({ ...f, targeting: { ...(f.targeting ?? {}), ...patch } }));
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

        <div className="md:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600">Behavioural targeting (optional)</span>
            <span className="text-[11px] text-neutral-400">Leave empty to show to everyone</span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className={label}>Interest keywords (comma-separated)</label>
              <input className={input}
                value={(form.targeting?.interestKeywords ?? []).join(", ")}
                onChange={(e) => setT({ interestKeywords: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) })}
                placeholder="saas, marketing" />
            </div>
            <div>
              <label className={label}>Keyword match</label>
              <select className={input} value={form.targeting?.keywordMatch ?? "any"} onChange={(e) => setT({ keywordMatch: e.target.value as "any" | "all" })}>
                <option value="any">any keyword</option><option value="all">all keywords</option>
              </select>
            </div>
            <div>
              <label className={label}>Audience</label>
              <select className={input} value={form.targeting?.audience ?? "any"} onChange={(e) => setT({ audience: e.target.value as "any" | "new" | "returning" })}>
                <option value="any">everyone</option><option value="new">new visitors</option><option value="returning">returning visitors</option>
              </select>
            </div>
            <div>
              <label className={label}>Min. pageviews</label>
              <input type="number" min={0} className={input} value={form.targeting?.minPageviews ?? 0} onChange={(e) => setT({ minPageviews: Math.max(0, Number(e.target.value)) })} />
            </div>
          </div>
          <div className="mt-2">
            <label className={label}>Funnel stage</label>
            <div className="flex flex-wrap gap-1.5">
              {FUNNEL_STAGES.map((st) => {
                const on = (form.targeting?.funnelStages ?? []).includes(st);
                return (
                  <button key={st} type="button"
                    onClick={() => {
                      const cur = new Set(form.targeting?.funnelStages ?? []);
                      if (on) cur.delete(st); else cur.add(st);
                      setT({ funnelStages: Array.from(cur) });
                    }}
                    className={"rounded-full border px-2.5 py-1 text-xs " + (on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50")}>
                    {st.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            Uses the visitor's interest/journey profile. When active it adds a €0.02 profiling fee per unique visitor/day, on top of CPM/CPC.
          </p>
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
