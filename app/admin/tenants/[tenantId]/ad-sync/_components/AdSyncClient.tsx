"use client";

/**
 * Ad Sync admin — client UI.
 *
 * Segment definition + per-platform credential forms + live test/preview/sync.
 * Secrets arrive from the server redacted as "__SET__"; the inputs render those
 * as a "saved" placeholder and only send fields the admin actually changes, so a
 * blank field never wipes a stored secret.
 */

import { useState, useTransition, type ReactNode } from "react";
import {
  saveAdSyncEnabledAction,
  saveAdSyncSegmentAction,
  savePlatformConfigAction,
  previewSegmentAction,
  testPlatformConnectionAction,
  syncNowAction,
} from "../actions";
import type {
  AdPlatform,
  AdSyncRun,
  AdSyncSettings,
  AdSyncSegment,
  GoogleAdsConfig,
  LinkedInConfig,
  MetaConfig,
  PlatformSyncResult,
} from "@/lib/ad-sync/types";

const SET = "__SET__";
const isSet = (v: string | undefined) => v === SET;

const IDENTITY_LEVELS = ["anonymous", "recognised", "known", "customer"] as const;
const STATUSES = ["", "visitor", "engaged", "mql", "sql", "customer", "churned"] as const;

function Field({
  label, value, onChange, placeholder, type = "text", hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
      />
      {hint ? <span className="mt-0.5 block text-[11px] text-neutral-400">{hint}</span> : null}
    </label>
  );
}

export function AdSyncClient({
  tenantId,
  initialSettings,
  initialRuns,
}: {
  tenantId: string;
  initialSettings: AdSyncSettings;
  initialRuns: AdSyncRun[];
}) {
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [segment, setSegment] = useState<AdSyncSegment>(initialSettings.segment ?? { requireConsent: true });
  const [google, setGoogle] = useState<GoogleAdsConfig>(initialSettings.google ?? {});
  const [meta, setMeta] = useState<MetaConfig>(initialSettings.meta ?? {});
  const [linkedin, setLinkedin] = useState<LinkedInConfig>(initialSettings.linkedin ?? {});
  const [runs] = useState<AdSyncRun[]>(initialRuns);

  const [preview, setPreview] = useState<number | null>(null);
  const [syncResults, setSyncResults] = useState<PlatformSyncResult[] | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const toggleEnabled = (val: boolean) => {
    setEnabled(val);
    startTransition(async () => {
      const r = await saveAdSyncEnabledAction(tenantId, val);
      flash(r.ok ? (val ? "Sync ingeschakeld." : "Sync uitgeschakeld.") : `Fout: ${r.error}`);
    });
  };

  const saveSegment = () => startTransition(async () => {
    const r = await saveAdSyncSegmentAction(tenantId, segment);
    flash(r.ok ? "Segment opgeslagen." : `Fout: ${r.error}`);
  });

  const savePlatform = (platform: AdPlatform, config: GoogleAdsConfig | MetaConfig | LinkedInConfig) =>
    startTransition(async () => {
      const r = await savePlatformConfigAction(tenantId, platform, config);
      flash(r.ok ? `${platform} opgeslagen.` : `Fout: ${r.error}`);
    });

  const clearPlatform = (platform: AdPlatform) => startTransition(async () => {
    const r = await savePlatformConfigAction(tenantId, platform, {}, true);
    if (r.ok) {
      if (platform === "google") setGoogle({});
      if (platform === "meta") setMeta({});
      if (platform === "linkedin") setLinkedin({});
    }
    flash(r.ok ? `${platform} losgekoppeld.` : `Fout: ${r.error}`);
  });

  const testConn = (platform: AdPlatform) => startTransition(async () => {
    const r = await testPlatformConnectionAction(tenantId, platform);
    flash(r.ok ? `${platform}: verbinding OK.` : `${platform}: ${r.error}`);
  });

  const runPreview = () => startTransition(async () => {
    const r = await previewSegmentAction(tenantId);
    setPreview(r.count);
  });

  const syncNow = () => startTransition(async () => {
    setSyncResults(null);
    const r = await syncNowAction(tenantId);
    if (r.ok) { setSyncResults(r.results); flash(`Sync klaar — ${r.membersTotal} leads verwerkt.`); }
    else flash(`Fout: ${r.error}`);
  });

  return (
    <div className="space-y-6">
      {msg ? (
        <div className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{msg}</div>
      ) : null}

      {/* Master toggle + run now */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-900">
              <input type="checkbox" checked={enabled} onChange={(e) => toggleEnabled(e.target.checked)} />
              Dagelijkse audience-sync ingeschakeld
            </label>
            <p className="mt-1 text-xs text-neutral-500">Draait elke nacht (03:30). Pusht het segment naar elk gekoppeld platform.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={runPreview} disabled={pending}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
              Preview segment{preview !== null ? `: ${preview}` : ""}
            </button>
            <button onClick={syncNow} disabled={pending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
              Sync nu
            </button>
          </div>
        </div>
        {syncResults ? (
          <div className="mt-3 space-y-1 text-xs">
            {syncResults.map((r) => (
              <div key={r.platform} className={r.status === "ok" ? "text-green-700" : r.status === "skipped" ? "text-neutral-400" : "text-red-700"}>
                <strong className="capitalize">{r.platform}</strong>: {r.status} — +{r.membersSent} toegevoegd, −{r.membersRemoved ?? 0} verwijderd (segment: {r.membersTotal}){r.error ? ` — ${r.error}` : ""}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Segment definition */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Segment — welke leads</h2>
        <p className="mt-1 text-xs text-neutral-500">Alleen leads met een e-mailadres (uit je lead-base) worden meegenomen.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Min. lead level</span>
            <select value={segment.minIdentityLevel ?? ""} onChange={(e) => setSegment({ ...segment, minIdentityLevel: (e.target.value || undefined) as AdSyncSegment["minIdentityLevel"] })}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
              <option value="">— geen minimum —</option>
              {IDENTITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Status</span>
            <select value={segment.status ?? ""} onChange={(e) => setSegment({ ...segment, status: (e.target.value || undefined) as AdSyncSegment["status"] })}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s || "— elke status —"}</option>)}
            </select>
          </label>
          <Field label="Min. intent score" type="number" value={segment.minIntent?.toString() ?? ""}
            onChange={(v) => setSegment({ ...segment, minIntent: v ? Number(v) : undefined })} />
          <Field label="Min. hot score (0–100)" type="number" value={segment.minScore?.toString() ?? ""}
            onChange={(v) => setSegment({ ...segment, minScore: v ? Number(v) : undefined })} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={segment.requireConsent !== false}
            onChange={(e) => setSegment({ ...segment, requireConsent: e.target.checked })} />
          Alleen leads met toestemming of first-party (aanbevolen)
        </label>
        <button onClick={saveSegment} disabled={pending}
          className="mt-3 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
          Segment opslaan
        </button>
      </section>

      {/* Google Ads */}
      <PlatformCard title="Google — Customer Match (Data Manager API)"
        onSave={() => savePlatform("google", google)} onTest={() => testConn("google")} onClear={() => clearPlatform("google")} pending={pending}>
        <Field label="Customer id (doelaccount)" value={google.customerId ?? ""} onChange={(v) => setGoogle({ ...google, customerId: v })} hint="Cijfers, zonder streepjes" />
        <Field label="Login customer id (MCC)" value={google.loginCustomerId ?? ""} onChange={(v) => setGoogle({ ...google, loginCustomerId: v })} hint="Optioneel — alleen bij een manager-account" />
        <Field label="User list id" value={google.userListId ?? ""} onChange={(v) => setGoogle({ ...google, userListId: v })} hint="De Customer Match-lijst" />
        <Field label="OAuth client id" value={google.clientId ?? ""} onChange={(v) => setGoogle({ ...google, clientId: v })} />
        <Field label="OAuth client secret" type="password" value={isSet(google.clientSecret) ? "" : (google.clientSecret ?? "")} placeholder={isSet(google.clientSecret) ? "•••• opgeslagen" : ""} onChange={(v) => setGoogle({ ...google, clientSecret: v })} />
        <Field label="Refresh token" type="password" value={isSet(google.refreshToken) ? "" : (google.refreshToken ?? "")} placeholder={isSet(google.refreshToken) ? "•••• opgeslagen" : ""} onChange={(v) => setGoogle({ ...google, refreshToken: v })} hint="Scope: .../auth/datamanager" />
      </PlatformCard>

      {/* Meta */}
      <PlatformCard title="Meta — Custom Audience"
        onSave={() => savePlatform("meta", meta)} onTest={() => testConn("meta")} onClear={() => clearPlatform("meta")} pending={pending}>
        <Field label="Access token (system user)" type="password" value={isSet(meta.accessToken) ? "" : (meta.accessToken ?? "")} placeholder={isSet(meta.accessToken) ? "•••• opgeslagen" : ""} onChange={(v) => setMeta({ ...meta, accessToken: v })} />
        <Field label="Ad account id" value={meta.adAccountId ?? ""} onChange={(v) => setMeta({ ...meta, adAccountId: v })} hint="act_… of alleen de cijfers" />
        <Field label="Custom Audience id" value={meta.audienceId ?? ""} onChange={(v) => setMeta({ ...meta, audienceId: v })} />
      </PlatformCard>

      {/* LinkedIn */}
      <PlatformCard title="LinkedIn — Matched Audience (DMP Segment)"
        onSave={() => savePlatform("linkedin", linkedin)} onTest={() => testConn("linkedin")} onClear={() => clearPlatform("linkedin")} pending={pending}>
        <Field label="Access token" type="password" value={isSet(linkedin.accessToken) ? "" : (linkedin.accessToken ?? "")} placeholder={isSet(linkedin.accessToken) ? "•••• opgeslagen" : ""} onChange={(v) => setLinkedin({ ...linkedin, accessToken: v })} />
        <Field label="Ad account id" value={linkedin.adAccountId ?? ""} onChange={(v) => setLinkedin({ ...linkedin, adAccountId: v })} hint="Cijfers" />
        <Field label="DMP segment id" value={linkedin.dmpSegmentId ?? ""} onChange={(v) => setLinkedin({ ...linkedin, dmpSegmentId: v })} />
      </PlatformCard>

      {/* Run history */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Recente syncs</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-400">Nog geen syncs uitgevoerd.</p>
        ) : (
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-400">
                <th className="py-1">Tijd</th><th>Platform</th><th>Status</th><th>Toegevoegd</th><th>Verwijderd</th><th>Segment</th><th>Trigger</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="py-1">{new Date(r.createdAt).toLocaleString("nl-NL")}</td>
                  <td className="capitalize">{r.platform}</td>
                  <td className={r.status === "ok" ? "text-green-700" : r.status === "skipped" ? "text-neutral-400" : "text-red-700"}>{r.status}</td>
                  <td>+{r.membersSent}</td>
                  <td>−{r.membersRemoved}</td>
                  <td>{r.membersTotal}</td>
                  <td>{r.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function PlatformCard({
  title, onSave, onTest, onClear, pending, children,
}: {
  title: string;
  onSave: () => void;
  onTest: () => void;
  onClear: () => void;
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">{children}</div>
      <div className="mt-3 flex gap-2">
        <button onClick={onSave} disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">Opslaan</button>
        <button onClick={onTest} disabled={pending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">Test verbinding</button>
        <button onClick={onClear} disabled={pending}
          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Loskoppelen</button>
      </div>
    </section>
  );
}
