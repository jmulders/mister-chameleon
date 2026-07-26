"use client";

import { Fragment, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, countryName, resolveCountry } from "@/lib/geo/countries";
import {
  setAdvertiserRoleAction,
  addPublisherAction,
  setPublisherStatusAction,
  createAdAction,
  setAdStatusAction,
  setAdSlotsAction,
  setTenantAdRateCardAction,
  setAdAccountThemeAction,
  editAdAction,
  fetchAdSessionsAction,
  fetchAdSessionGa4Action,
  type AdsOverview,
  type CreateAdInput,
  type DayReport,
  type AdSession,
  type AdSessionGa4,
  type Ga4AdStatus,
} from "../actions";
import type { AdSlotType, AdPricingModel, Ad } from "@/lib/ads/types";
import { parseAdTargeting, type AdFunnelStage } from "@/lib/ads/targeting";
import { renderBlockHtml } from "@/lib/snippet/render-block-html";
import { BLOCK_TOKEN_GROUPS, blockTokensToStyle, VALID_SURFACE_ROLES, type CuratedBlockTokens } from "@/design-system/theme/block-token-set";

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

      <SlotsCard tenantId={tenantId} initial={initial} pending={pending} run={run} />
      <AdThemeCard tenantId={tenantId} initial={initial} pending={pending} run={run} />
      {initial.isSuperAdmin && <AdRateCardCard tenantId={tenantId} initial={initial} pending={pending} run={run} />}
      <EmbedCard
        siteKey={initial.siteKey}
        slots={initial.activeSlots.length > 0 ? initial.activeSlots : SLOTS}
      />
      <ReportCard
        report={initial.report}
        pendingImpressions={initial.pendingImpressions}
        pendingClicks={initial.pendingClicks}
        pendingSpendCents={initial.pendingSpendCents}
        profilingSpentCents={initial.profilingSpentCents}
        pendingProfilingCents={initial.pendingProfilingCents}
      />
      <SessionsCard tenantId={tenantId} ga4Ready={initial.ga4.readReady} />
      <Ga4StatusCard tenantId={tenantId} status={initial.ga4} />
      <PublishersCard tenantId={tenantId} initial={initial} pending={pending} run={run} />
      <AdForm tenantId={tenantId} pending={pending} run={run} mode="create" slots={initial.activeSlots} rateCard={initial.effectiveRateCard} suggestions={initial.companySuggestions} />
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

function SessionsCard({ tenantId, ga4Ready }: { tenantId: string; ga4Ready: boolean }) {
  const [sessions, setSessions] = useState<AdSession[] | null>(null);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [loading, start]        = useTransition();
  const [error, setError]       = useState<string | null>(null);
  const [ga4By, setGa4By]       = useState<Record<string, AdSessionGa4 | null | "loading">>({});

  const load = () => {
    setError(null);
    start(async () => {
      try { setSessions(await fetchAdSessionsAction(tenantId)); }
      catch { setError("Could not load sessions."); }
    });
  };

  const loadGa4 = async (sid: string) => {
    setGa4By((m) => ({ ...m, [sid]: "loading" }));
    try {
      const r = await fetchAdSessionGa4Action(tenantId, sid);
      setGa4By((m) => ({ ...m, [sid]: r }));
    } catch {
      setGa4By((m) => ({ ...m, [sid]: null }));
    }
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
            const g = ga4By[s.sessionId];
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
                    {s.company?.name && (
                      <div className="mt-0.5 text-[11px] text-emerald-700">
                        🏢 {s.company.name}{s.company.industry ? ` · ${s.company.industry}` : ""}{s.company.size ? ` · ${s.company.size}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.adsSeen.slice(0, 2).map((a) => (
                      <span key={a} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{a}</span>
                    ))}
                    <span className="text-neutral-400">{open ? "▾" : "▸"}</span>
                  </div>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-neutral-100 px-3 py-2">
                    {s.company && (s.company.name || s.company.industry || s.company.size) && (
                      <div className="text-xs">
                        <span className="font-semibold text-neutral-600">Company:</span>{" "}
                        <span className="text-neutral-700">{s.company.name ?? "—"}</span>
                        {s.company.industry && <span className="text-neutral-400"> · {s.company.industry}</span>}
                        {s.company.size && <span className="text-neutral-400"> · {s.company.size}</span>}
                      </div>
                    )}
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
                    {ga4Ready && (
                      <div className="text-xs">
                        {g === undefined && (
                          <button className={btnGhost} onClick={() => void loadGa4(s.sessionId)}>Load GA4 history</button>
                        )}
                        {g === "loading" && <span className="text-neutral-400">Loading GA4…</span>}
                        {g === null && <span className="text-neutral-400">No GA4 history for this visitor.</span>}
                        {g && g !== "loading" && (
                          <div className="text-neutral-600">
                            <span className="font-semibold">GA4:</span>{" "}
                            {g.sessionCount != null ? `${g.sessionCount} sessions` : "—"}
                            {(g.lastCity || g.lastRegion || g.lastCountry) && ` · ${[g.lastCity, g.lastRegion, g.lastCountry].filter(Boolean).join(", ")}`}
                            {g.lastChannel && ` · ${g.lastChannel}`}
                          </div>
                        )}
                      </div>
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

type Ga4RowState = "ready" | "incomplete" | "off";

function Ga4Pill({ state }: { state: Ga4RowState }) {
  const cls = state === "ready"
    ? "bg-green-100 text-green-700"
    : state === "incomplete" ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-500";
  const txt = state === "ready" ? "Ready" : state === "incomplete" ? "Incomplete" : "Off";
  return <span className={"rounded px-1.5 py-0.5 text-xs font-medium " + cls}>{txt}</span>;
}

function Ga4Row({ title, hint, state, detail }: { title: string; hint: string; state: Ga4RowState; detail?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-800">{title} <Ga4Pill state={state} /></div>
        <div className="mt-0.5 text-xs text-neutral-500">{hint}{detail ? ` · ${detail}` : ""}</div>
      </div>
    </div>
  );
}

function Ga4StatusCard({ tenantId, status }: { tenantId: string; status: Ga4AdStatus }) {
  const writeState: Ga4RowState = status.writeReady ? "ready" : status.trackingEnabled ? "incomplete" : "off";
  const readState:  Ga4RowState = status.readReady  ? "ready" : status.historyEnabled  ? "incomplete" : "off";

  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">GA4 for ads</h3>
          <p className="mt-0.5 text-sm text-neutral-500 max-w-2xl">
            When configured, each ad-audience session is written to your own GA4 (keyed by our first-party
            visitor id) and the visitor's GA4 history is read back — so you can target on <code>ga4.*</code> fields
            in an advanced rule. GA4 is free; it adds no wallet fee.
          </p>
        </div>
        <a href={`/admin/tenants/${tenantId}/integrations`} className={btnGhost + " shrink-0"}>Configure GA4</a>
      </div>
      <div className="mt-3 divide-y divide-neutral-100">
        <Ga4Row title="Event write (server-side)" state={writeState}
          hint="Sends ad views to your GA4 via the Measurement Protocol"
          detail={status.measurementId} />
        <Ga4Row title="History read" state={readState}
          hint="Reads returning-visitor signals from your GA4 (Data API)"
          detail={status.propertyId ? `property ${status.propertyId}` : null} />
      </div>
      {(writeState === "incomplete" || readState === "incomplete") && (
        <p className="mt-2 text-xs text-amber-700">
          Enabled but not fully configured. Write needs server send mode + measurement ID + API secret; read needs
          property ID + service-account JSON. Finish it under Integrations → GA4.
        </p>
      )}
      {writeState === "off" && readState === "off" && (
        <p className="mt-2 text-xs text-neutral-400">
          Optional — leave off if you don't target on GA4 history. Behavioural, geo and firmographic targeting work without it.
        </p>
      )}
    </div>
  );
}

function ReportCard({ report, pendingImpressions = 0, pendingClicks = 0, pendingSpendCents = 0, profilingSpentCents = 0, pendingProfilingCents = 0 }: {
  report: DayReport[];
  pendingImpressions?: number;
  pendingClicks?: number;
  pendingSpendCents?: number;
  profilingSpentCents?: number;
  pendingProfilingCents?: number;
}) {
  const totals = report.reduce(
    (t, d) => ({ impressions: t.impressions + d.impressions, clicks: t.clicks + d.clicks, spend_cents: t.spend_cents + d.spend_cents }),
    { impressions: 0, clicks: 0, spend_cents: 0 },
  );
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const maxImpr = Math.max(1, ...report.map((d) => d.impressions));
  const W = 720, H = 140, pad = 8;
  const bw = report.length > 0 ? (W - pad * 2) / report.length : 0;
  const profilingTotal = profilingSpentCents + pendingProfilingCents;
  const pendingTotalCents = pendingSpendCents + pendingProfilingCents;
  const hasProfiling = profilingTotal > 0;
  const hasPending = pendingImpressions > 0 || pendingClicks > 0 || pendingTotalCents > 0;

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900">Performance (30 days)</h3>
        {hasPending && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500"></span>
            {euros(pendingTotalCents)} nog niet afgerekend
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-8">
        <Stat label="Impressions" value={totals.impressions.toLocaleString()} />
        <Stat label="Clicks" value={totals.clicks.toLocaleString()} />
        <Stat label="CTR" value={ctr.toFixed(2) + "%"} />
        <Stat label="Ad spend" value={euros(totals.spend_cents)} />
        {hasProfiling && <Stat label="Targeting fees" value={euros(profilingTotal)} />}
      </div>
      {hasPending && (
        <p className="mt-2 text-xs text-neutral-400">
          Cijfers zijn live. Nog niet afgerekend: {euros(pendingSpendCents)} ad-spend
          {pendingProfilingCents > 0 ? ` + ${euros(pendingProfilingCents)} targeting fees` : ""} —
          dit wordt bij de eerstvolgende afreken-rollup van de wallet afgeschreven.
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

function adToForm(a: Ad): CreateAdInput {
  return {
    name: a.name, slot_type: a.slot_type,
    creativeJson: JSON.stringify(a.creative ?? {}, null, 2),
    click_url: a.click_url ?? "", pricing_model: a.pricing_model,
    rate_cents: a.rate_cents, budget_cents: a.budget_cents, weight: a.weight,
    targeting: parseAdTargeting(a.targeting),
  };
}

/** Chip input with a native datalist. Values are validated/normalised via `resolve`. */
function TokenField({ label: lbl, tokens, onChange, placeholder, suggestions, resolve, display }: {
  label: string;
  tokens: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
  suggestions: { value: string; label: string }[];
  resolve: (raw: string) => string | null;
  display: (token: string) => string;
}) {
  const [text, setText] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const v = resolve(raw);
    if (v && !tokens.includes(v)) onChange([...tokens, v]);
    setText("");
  };
  return (
    <div>
      <label className={label}>{lbl}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-300 px-2 py-1.5 focus-within:border-indigo-500">
        {tokens.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
            {display(t)}
            <button type="button" className="text-indigo-400 hover:text-indigo-700" onClick={() => onChange(tokens.filter((x) => x !== t))}>×</button>
          </span>
        ))}
        <input
          list={listId}
          className="min-w-[7rem] flex-1 border-0 bg-transparent p-0.5 text-sm focus:outline-none"
          value={text}
          placeholder={tokens.length === 0 ? placeholder : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (suggestions.some((s) => s.label === v || s.value === v)) add(v); // picked from list / exact match
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (text.trim()) add(text); }
            else if (e.key === "Backspace" && !text && tokens.length > 0) onChange(tokens.slice(0, -1));
          }}
          onBlur={() => { if (text.trim()) add(text); }}
        />
      </div>
      <datalist id={listId}>
        {suggestions.filter((s) => !tokens.includes(s.value)).map((s) => <option key={s.value} value={s.label} />)}
      </datalist>
    </div>
  );
}

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const identityToken = (raw: string): string | null => (raw.trim() || null);

// ── Friendly creative editor (per slot type) ─────────────────────────────────
// Edits the ad `creative` object with real fields instead of raw JSON. The field
// set per slot matches exactly what renderBlockHtml consumes, so what you type is
// what serves. Raw JSON stays available under "Advanced" for power users.

type Cta = { label?: string; href?: string };
type CreativeValue = Record<string, unknown>;

function CreativeText({ label: lbl, value, onChange, placeholder, area }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean }) {
  return (
    <div>
      <label className={label}>{lbl}</label>
      {area
        ? <textarea className={input} rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <input className={input} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
    </div>
  );
}

function CtaList({ ctas, onChange, max = 2 }: { ctas: Cta[]; onChange: (c: Cta[]) => void; max?: number }) {
  const upd = (i: number, patch: Partial<Cta>) => onChange(ctas.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div>
      <label className={label}>Buttons — the first link becomes the tracked click URL</label>
      <div className="space-y-2">
        {ctas.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className={input} value={c.label ?? ""} placeholder="Button label" onChange={(e) => upd(i, { label: e.target.value })} />
            <input className={input} value={c.href ?? ""} placeholder="https://advertiser.example" onChange={(e) => upd(i, { href: e.target.value })} />
            <button type="button" className={btnGhost} onClick={() => onChange(ctas.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {ctas.length < max && (
          <button type="button" className={btnGhost} onClick={() => onChange([...ctas, { label: "", href: "" }])}>+ Button</button>
        )}
      </div>
    </div>
  );
}

function SingleCta({ cta, onChange }: { cta: Cta; onChange: (c: Cta) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div><label className={label}>Button label</label><input className={input} value={cta.label ?? ""} placeholder="Get started" onChange={(e) => onChange({ ...cta, label: e.target.value })} /></div>
      <div><label className={label}>Button link</label><input className={input} value={cta.href ?? ""} placeholder="https://advertiser.example" onChange={(e) => onChange({ ...cta, href: e.target.value })} /></div>
    </div>
  );
}

function ItemList({ items, onChange, fields, addLabel }:
  { items: Record<string, string>[]; onChange: (i: Record<string, string>[]) => void; fields: { key: string; label: string }[]; addLabel: string }) {
  const upd = (i: number, patch: Record<string, string>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div>
      <label className={label}>Items</label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md border border-neutral-200 p-2">
            <div className="flex-1 space-y-1.5">
              {fields.map((f) => (
                <input key={f.key} className={input} value={it[f.key] ?? ""} placeholder={f.label}
                  onChange={(e) => upd(i, { [f.key]: e.target.value })} />
              ))}
            </div>
            <button type="button" className={btnGhost} onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className={btnGhost} onClick={() => onChange([...items, {}])}>{addLabel}</button>
      </div>
    </div>
  );
}

function CreativeEditor({ slotType, value, onChange }:
  { slotType: AdSlotType; value: CreativeValue; onChange: (v: CreativeValue) => void }) {
  const up   = (patch: CreativeValue) => onChange({ ...value, ...patch });
  const s    = (k: string): string => (typeof value[k] === "string" ? (value[k] as string) : "");
  const list = (k: string): Record<string, string>[] => (Array.isArray(value[k]) ? (value[k] as Record<string, string>[]) : []);
  const ctas = (k: string): Cta[] => (Array.isArray(value[k]) ? (value[k] as Cta[]) : []);
  const obj  = (k: string): Cta => (value[k] && typeof value[k] === "object" ? (value[k] as Cta) : {});

  switch (slotType) {
    case "hero":
      return (
        <div className="space-y-3">
          <CreativeText label="Eyebrow / tag" value={s("tag")} onChange={(v) => up({ tag: v })} placeholder="Sponsored" />
          <CreativeText label="Title" value={s("title")} onChange={(v) => up({ title: v })} placeholder="Your headline" />
          <CreativeText label="Subtitle" value={s("subtitle")} onChange={(v) => up({ subtitle: v })} area />
          <CtaList ctas={ctas("ctas")} onChange={(c) => up({ ctas: c })} />
        </div>
      );
    case "proof":
      return (
        <div className="space-y-3">
          <CreativeText label="Title" value={s("title")} onChange={(v) => up({ title: v })} placeholder="Trusted widely" />
          <ItemList items={list("items")} onChange={(i) => up({ items: i })} addLabel="+ Stat"
            fields={[{ key: "title", label: "Stat (e.g. 5,000+)" }, { key: "text", label: "Label (e.g. teams)" }]} />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <CreativeText label="Title" value={s("title")} onChange={(v) => up({ title: v })} placeholder="Ready to switch?" />
          <CreativeText label="Text" value={s("text")} onChange={(v) => up({ text: v })} area />
          <SingleCta cta={obj("cta")} onChange={(c) => up({ cta: c })} />
        </div>
      );
    case "feature":
      return (
        <div className="space-y-3">
          <CreativeText label="Title" value={s("title")} onChange={(v) => up({ title: v })} placeholder="Why us" />
          <CreativeText label="Subtitle" value={s("subtitle")} onChange={(v) => up({ subtitle: v })} area />
          <ItemList items={list("items")} onChange={(i) => up({ items: i })} addLabel="+ Feature"
            fields={[{ key: "title", label: "Feature title" }, { key: "body", label: "Feature description" }]} />
        </div>
      );
    case "conversion":
      return (
        <div className="space-y-3">
          <CreativeText label="Urgency label" value={s("urgencyLabel")} onChange={(v) => up({ urgencyLabel: v })} placeholder="Limited" />
          <CreativeText label="Title" value={s("title")} onChange={(v) => up({ title: v })} placeholder="Start today" />
          <CreativeText label="Text" value={s("text")} onChange={(v) => up({ text: v })} area />
          <CtaList ctas={ctas("ctas")} onChange={(c) => up({ ctas: c })} />
        </div>
      );
    case "notification":
      return (
        <div className="space-y-3">
          <CreativeText label="Message" value={s("message")} onChange={(v) => up({ message: v })} area placeholder="Something new." />
          <div>
            <label className={label}>Severity</label>
            <select className={input} value={s("severity") || "info"} onChange={(e) => up({ severity: e.target.value })}>
              <option value="info">info</option>
              <option value="success">success</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CreativeText label="Link label" value={s("ctaLabel")} onChange={(v) => up({ ctaLabel: v })} placeholder="See it" />
            <CreativeText label="Link URL" value={s("ctaHref")} onChange={(v) => up({ ctaHref: v })} placeholder="https://advertiser.example" />
          </div>
        </div>
      );
    default:
      return null;
  }
}

// ── Design-token styling (same tokens CMS blocks use) ────────────────────────

function DesignTokenField({ field, value, onChange }:
  { field: { key: string; label: string; kind: string; placeholder?: string }; value: string; onChange: (v: string) => void }) {
  if (field.kind === "surface") {
    return (
      <div>
        <label className="mb-0.5 block text-[11px] text-neutral-500">{field.label}</label>
        <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— default —</option>
          {VALID_SURFACE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
    );
  }
  const isColor = field.kind === "color";
  return (
    <div>
      <label className="mb-0.5 block text-[11px] text-neutral-500">{field.label}</label>
      <div className="flex items-center gap-1.5">
        {isColor && (
          <input type="color" className="h-9 w-9 shrink-0 rounded border border-neutral-300 p-0.5"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} />
        )}
        <input className={input} value={value} placeholder={field.placeholder ?? "—"} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function TokensEditor({ tokens, onChange }: { tokens: CuratedBlockTokens; onChange: (t: CuratedBlockTokens) => void }) {
  const rec = tokens as Record<string, string>;
  const setTok = (key: string, val: string) => {
    const next: Record<string, string> = { ...rec };
    if (val) next[key] = val; else delete next[key];
    onChange(next as CuratedBlockTokens);
  };
  return (
    <div className="space-y-3">
      {BLOCK_TOKEN_GROUPS.map((g) => (
        <div key={g.title}>
          <div className="mb-1 text-[11px] font-semibold text-neutral-600">{g.title}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {g.fields.map((f) => (
              <DesignTokenField key={f.key} field={f} value={rec[f.key] ?? ""} onChange={(v) => setTok(f.key, v)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreativePreview({ slot, creative }: { slot: AdSlotType; creative: CreativeValue }) {
  const html = renderBlockHtml(slot, creative);
  if (!html) return <p className="text-xs text-neutral-400">Add content to see a preview.</p>;
  const style = blockTokensToStyle((creative.tokens as CuratedBlockTokens) ?? {});
  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white" style={style}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function AdForm({ tenantId, pending, run, mode = "create", initial, adId, onDone, slots, rateCard, suggestions }:
  { tenantId: string; pending: boolean; run: RunFn; mode?: "create" | "edit"; initial?: CreateAdInput; adId?: string; onDone?: () => void; slots?: AdSlotType[]; rateCard?: { cpmCents: number; cpcCents: number }; suggestions?: { industries: string[]; sizes: string[] } }) {
  const slotOptions = slots && slots.length > 0 ? slots : SLOTS;
  const [slot, setSlot] = useState<AdSlotType>(initial?.slot_type ?? "hero");
  const [form, setForm] = useState<CreateAdInput>(initial ?? {
    name: "", slot_type: "hero",
    creativeJson: JSON.stringify(CREATIVE_TEMPLATES.hero, null, 2),
    click_url: "", pricing_model: "cpm", rate_cents: rateCard?.cpmCents ?? 500, budget_cents: 5000, weight: 1,
  });
  // When switching model on a new ad, snap the rate to the platform rate-card.
  // Rate is platform-controlled; keep the submitted value in sync with the rate
  // card for display, but the server enforces it regardless of what's sent.
  const onModel = (m: AdPricingModel) =>
    set({ pricing_model: m, rate_cents: m === "cpm" ? (rateCard?.cpmCents ?? 0) : (rateCard?.cpcCents ?? 0) });
  const [ruleText, setRuleText] = useState(() => (form.targeting?.rule ? JSON.stringify(form.targeting.rule, null, 2) : ""));
  const [ruleError, setRuleError] = useState<string | null>(null);
  const onRuleText = (v: string) => {
    setRuleText(v);
    const trimmed = v.trim();
    if (!trimmed) { setRuleError(null); setT({ rule: undefined }); return; }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && "type" in parsed) { setRuleError(null); setT({ rule: parsed }); }
      else setRuleError('Rule must be a condition object with a "type" field.');
    } catch { setRuleError("Invalid JSON."); }
  };
  const set = (patch: Partial<CreateAdInput>) => setForm((f) => ({ ...f, ...patch }));
  const setT = (patch: Partial<NonNullable<CreateAdInput["targeting"]>>) =>
    setForm((f) => ({ ...f, targeting: { ...(f.targeting ?? {}), ...patch } }));
  // Edit mode: changing slot keeps the existing creative (don't overwrite it).
  const onSlot = (s: AdSlotType) => {
    setSlot(s);
    if (mode === "edit") set({ slot_type: s });
    else set({ slot_type: s, creativeJson: JSON.stringify(CREATIVE_TEMPLATES[s], null, 2) });
  };
  // Parse the creative JSON for the friendly editor; null when it isn't valid.
  let parsedCreative: CreativeValue | null = null;
  try { const p = JSON.parse(form.creativeJson); if (p && typeof p === "object" && !Array.isArray(p)) parsedCreative = p as CreativeValue; } catch { /* invalid → editor hidden */ }

  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">{mode === "edit" ? "Edit ad" : "New ad"}</h3>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={label}>Name</label>
          <input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Acme hero — launch" />
        </div>
        <div>
          <label className={label}>Slot</label>
          <select className={input} value={slot} onChange={(e) => onSlot(e.target.value as AdSlotType)}>
            {slotOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
          <div className="mb-2 text-xs font-semibold text-neutral-600">Creative content</div>
          {parsedCreative ? (
            <>
              <CreativeEditor slotType={slot} value={parsedCreative}
                onChange={(obj) => set({ creativeJson: JSON.stringify(obj, null, 2) })} />
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Styling (design tokens)</summary>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Override colours, radius and fonts for this ad. Leave blank to use your account's theme.
                </p>
                <div className="mt-2">
                  <TokensEditor
                    tokens={(parsedCreative.tokens as CuratedBlockTokens) ?? {}}
                    onChange={(tk) => set({ creativeJson: JSON.stringify({ ...parsedCreative, tokens: Object.keys(tk).length ? tk : undefined }, null, 2) })}
                  />
                </div>
              </details>
              <div className="mt-3">
                <div className="mb-1 text-[11px] font-semibold text-neutral-500">Live preview</div>
                <CreativePreview slot={slot} creative={parsedCreative} />
              </div>
            </>
          ) : (
            <p className="text-xs text-amber-700">The creative JSON below is invalid — fix it to use the form editor.</p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Advanced (raw JSON)</summary>
            <textarea className={input + " mt-2 font-mono text-xs h-44"} value={form.creativeJson}
              onChange={(e) => set({ creativeJson: e.target.value })} />
          </details>
        </div>
        <div>
          <label className={label}>Landing URL (click destination)</label>
          <input className={input} value={form.click_url} onChange={(e) => set({ click_url: e.target.value })} placeholder="https://advertiser.example" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={label}>Model</label>
            <select className={input} value={form.pricing_model} onChange={(e) => onModel(e.target.value as AdPricingModel)}>
              <option value="cpm">CPM</option><option value="cpc">CPC</option>
            </select>
          </div>
          <div>
            <label className={label}>{form.pricing_model === "cpm" ? "€/1000 (platform rate)" : "€/click (platform rate)"}</label>
            <div className={input + " bg-neutral-100 text-neutral-600"}>
              {euros(form.pricing_model === "cpm" ? (rateCard?.cpmCents ?? null) : (rateCard?.cpcCents ?? null))}
            </div>
            <p className="mt-0.5 text-[11px] text-neutral-400">Set by the platform</p>
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
            <TokenField
              label="Countries"
              tokens={form.targeting?.countries ?? []}
              onChange={(t) => setT({ countries: t })}
              placeholder="Type a country…"
              suggestions={COUNTRY_OPTIONS}
              resolve={resolveCountry}
              display={(code) => `${countryName(code)} (${code})`}
            />
            <TokenField
              label="Industries"
              tokens={form.targeting?.industries ?? []}
              onChange={(t) => setT({ industries: t })}
              placeholder={(suggestions?.industries.length ?? 0) > 0 ? "Type or pick an industry…" : "software, finance"}
              suggestions={(suggestions?.industries ?? []).map((v) => ({ value: v, label: v }))}
              resolve={identityToken}
              display={(v) => v}
            />
            <TokenField
              label="Company sizes"
              tokens={form.targeting?.companySizes ?? []}
              onChange={(t) => setT({ companySizes: t })}
              placeholder={(suggestions?.sizes.length ?? 0) > 0 ? "Type or pick a size…" : "51-200, 201-500"}
              suggestions={(suggestions?.sizes ?? []).map((v) => ({ value: v, label: v }))}
              resolve={identityToken}
              display={(v) => v}
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={form.targeting?.requireCompany ?? false}
                  onChange={(e) => setT({ requireCompany: e.target.checked })} />
                Only company visitors
              </label>
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
            Uses the visitor's interest/journey profile, country and (when enabled) company. Targeting adds a
            small fee per unique visitor/day, on top of CPM/CPC: €0.02 behavioural, €0.01 geo, €0.03 firmographic.
            Firmographic (industry / size / company) requires IP→company enrichment to be switched on — until
            then those ads simply don't serve.
          </p>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Advanced rule (optional)</summary>
            <p className="mt-1 text-[11px] text-neutral-400">
              A full decision-engine RuleCondition (JSON) — AND/OR/NOT over the platform's rule fields
              (e.g. <code>funnelStage</code>, <code>companyIndustry</code>, <code>countryCode</code>).
              AND-combined with the fields above. Evaluated against a cost-safe context (no extra paid lookups).
            </p>
            <textarea
              className={input + " mt-2 font-mono text-xs h-28"}
              value={ruleText}
              onChange={(e) => onRuleText(e.target.value)}
              placeholder={'{"type":"field","field":"countryCode","operator":"equals","value":"NL"}'}
            />
            {ruleError && <p className="mt-1 text-xs text-red-600">{ruleError}</p>}
          </details>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button className={btn} disabled={pending || !form.name.trim()}
          onClick={() => {
            if (mode === "edit" && adId) { run(() => editAdAction(tenantId, adId, form)); onDone?.(); }
            else run(() => createAdAction(tenantId, form));
          }}>
          {mode === "edit" ? "Save changes" : "Create ad"}
        </button>
        {mode === "edit" && onDone && (
          <button className={btnGhost} onClick={onDone}>Cancel</button>
        )}
      </div>
    </div>
  );
}

function AdThemeCard({ tenantId, initial, pending, run }:
  { tenantId: string; initial: AdsOverview; pending: boolean; run: RunFn }) {
  const [theme, setTheme] = useState(initial.themePreset);
  const current = initial.themeOptions.find((o) => o.key === initial.themePreset)?.label ?? initial.themePreset;
  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">Account theme</h3>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        The base look for all your ads (colours, fonts, radius) — currently <span className="font-medium">{current}</span>.
        Each ad&apos;s &quot;Styling (design tokens)&quot; section overrides this per creative.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className={label}>Theme preset</label>
          <select className={input + " max-w-xs"} value={theme} onChange={(e) => setTheme(e.target.value)}>
            {initial.themeOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <button className={btn} disabled={pending || theme === initial.themePreset}
          onClick={() => run(() => setAdAccountThemeAction(tenantId, theme))}>
          Save theme
        </button>
      </div>
    </div>
  );
}

function AdRateCardCard({ tenantId, initial, pending, run }:
  { tenantId: string; initial: AdsOverview; pending: boolean; run: RunFn }) {
  const [cpm, setCpm] = useState(initial.tenantRateOverride.cpmCents?.toString() ?? "");
  const [cpc, setCpc] = useState(initial.tenantRateOverride.cpcCents?.toString() ?? "");
  const save = () => run(() => setTenantAdRateCardAction(tenantId, {
    cpmCents: cpm.trim() === "" ? null : Math.max(0, Number(cpm)),
    cpcCents: cpc.trim() === "" ? null : Math.max(0, Number(cpc)),
  }));
  const resetToGlobal = () => { setCpm(""); setCpc(""); run(() => setTenantAdRateCardAction(tenantId, { cpmCents: null, cpcCents: null })); };
  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-neutral-900">Rate card</h3>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">platform-only</span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        The CPM/CPC this advertiser pays — advertisers can't change it. Leave a field blank to inherit the
        global rate-card ({euros(initial.rateCard.cpmCents)}/1000, {euros(initial.rateCard.cpcCents)}/click).
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className={label}>CPM override (cents /1000)</label>
          <input type="number" min={0} className={input + " max-w-[160px]"} value={cpm}
            placeholder={`global ${initial.rateCard.cpmCents}`} onChange={(e) => setCpm(e.target.value)} />
        </div>
        <div>
          <label className={label}>CPC override (cents /click)</label>
          <input type="number" min={0} className={input + " max-w-[160px]"} value={cpc}
            placeholder={`global ${initial.rateCard.cpcCents}`} onChange={(e) => setCpc(e.target.value)} />
        </div>
        <button className={btn} disabled={pending} onClick={save}>Save rate</button>
        <button className={btnGhost} disabled={pending} onClick={resetToGlobal}>Reset to global</button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Effective now: {euros(initial.effectiveRateCard.cpmCents)}/1000 · {euros(initial.effectiveRateCard.cpcCents)}/click
      </p>
    </div>
  );
}

function SlotsCard({ tenantId, initial, pending, run }:
  { tenantId: string; initial: AdsOverview; pending: boolean; run: RunFn }) {
  const active = new Set(initial.activeSlots);
  const toggle = (s: AdSlotType) => {
    const next = new Set(active);
    if (next.has(s)) next.delete(s); else next.add(s);
    run(() => setAdSlotsAction(tenantId, SLOTS.filter((x) => next.has(x))));
  };
  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">Slots</h3>
      <p className="mt-1 text-sm text-neutral-600 max-w-2xl">
        Which adaptive slot types your account offers to publishers. Only enabled slots appear in the
        embed code and can hold ads. These are the same six adaptive slots the platform personalises —
        here they are filled with your ads instead.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SLOTS.map((s) => {
          const on = active.has(s);
          return (
            <button key={s} type="button" disabled={pending} onClick={() => toggle(s)}
              className={"rounded-full border px-3 py-1.5 text-sm capitalize " + (on
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-neutral-300 text-neutral-500 hover:bg-neutral-50")}>
              {on ? "✓ " : ""}{s}
            </button>
          );
        })}
      </div>
      {active.size === 0 && (
        <p className="mt-2 text-xs text-amber-700">No slots enabled — publishers have nothing to embed and no ads will serve.</p>
      )}
    </div>
  );
}

function AdsListCard({ tenantId, initial, pending, run }:
  { tenantId: string; initial: AdsOverview; pending: boolean; run: RunFn }) {
  const statFor = (id: string) => initial.stats.find((s) => s.ad_id === id);
  const [editId, setEditId] = useState<string | null>(null);
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
                <Fragment key={a.id}>
                <tr className="border-b border-neutral-50">
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
                    <div className="inline-flex gap-1.5">
                      <button className={btnGhost} onClick={() => setEditId(editId === a.id ? null : a.id)}>
                        {editId === a.id ? "Close" : "Edit"}
                      </button>
                      {a.status === "active"
                        ? <button className={btnGhost} disabled={pending} onClick={() => run(() => setAdStatusAction(tenantId, a.id, "paused"))}>Pause</button>
                        : a.status === "paused"
                        ? <button className={btnGhost} disabled={pending} onClick={() => run(() => setAdStatusAction(tenantId, a.id, "active"))}>Resume</button>
                        : null}
                    </div>
                  </td>
                </tr>
                {editId === a.id && (
                  <tr>
                    <td colSpan={8} className="bg-neutral-50/60 p-3">
                      <AdForm tenantId={tenantId} pending={pending} run={run}
                        mode="edit" adId={a.id} initial={adToForm(a)} onDone={() => setEditId(null)}
                        rateCard={initial.effectiveRateCard} suggestions={initial.companySuggestions} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
