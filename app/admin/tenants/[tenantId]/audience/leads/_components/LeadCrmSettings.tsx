"use client";

/**
 * Lead Base — CRM / outbound integration settings.
 *
 * These fire on lead QUALIFICATION (a named ABM lead arriving, or any visitor
 * reaching MQL/SQL via the funnel), so they live on the Leads page rather than
 * under Target accounts. The underlying server actions + store are still shared
 * with ABM (abm/actions.ts, abm_settings table).
 */

import { useState, useTransition } from "react";
import {
  saveAbmWebhookUrlAction,
  saveAbmWebhookSecretAction,
  generateAbmWebhookSecretAction,
  saveAbmHubspotTokenAction,
  testAbmHubspotSyncAction,
  saveAbmNotifySettingsAction,
} from "../../accounts/actions";
import type { AbmNotifySettings } from "@/lib/abm/abm-store";
import { listWebhookDeliveriesAction, replayWebhookDeliveryAction } from "../actions";
import type { WebhookDelivery } from "@/lib/lead-base/webhook-deliveries-store";

/** Loosely read the interesting bits out of a stored delivery payload. */
function summarizePayload(payload: unknown): { company: string; person: string; toStatus: string } {
  const p = (payload ?? {}) as {
    profile?: { companyName?: string | null; status?: string | null };
    person?:  { fullName?: string | null };
    transition?: { toStatus?: string | null };
  };
  return {
    company:  p.profile?.companyName ?? "·",
    person:   p.person?.fullName ?? "·",
    toStatus: p.transition?.toStatus ?? p.profile?.status ?? "·",
  };
}

function fmtDeliveryTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "·" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const INPUT = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const LABEL = "block text-xs font-medium text-neutral-600 mb-1";

export function LeadCrmSettings({
  tenantId,
  initialWebhookUrl,
  initialWebhookSecret,
  initialHubspotToken,
  initialDeliveries,
  initialNotify,
}: {
  tenantId:             string;
  initialWebhookUrl:    string;
  initialWebhookSecret: string;
  initialHubspotToken:  string;
  initialDeliveries:    WebhookDelivery[];
  initialNotify:        AbmNotifySettings;
}) {
  const [pending, start] = useTransition();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>(initialDeliveries);
  const [deliveryMsg, setDeliveryMsg] = useState<string | null>(null);

  function refreshDeliveries() {
    start(async () => { setDeliveries(await listWebhookDeliveriesAction(tenantId)); });
  }
  function replay(id: string) {
    setDeliveryMsg("Replaying…");
    start(async () => {
      const res = await replayWebhookDeliveryAction(tenantId, id);
      setDeliveryMsg(res.ok ? `✓ Replayed (status ${res.status ?? "·"}).` : `✗ ${res.error}`);
      setDeliveries(await listWebhookDeliveriesAction(tenantId));
    });
  }

  const [webhookUrl, setWebhookUrl]       = useState(initialWebhookUrl);
  const [webhookMsg, setWebhookMsg]       = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState(initialWebhookSecret);
  const [secretMsg, setSecretMsg]         = useState<string | null>(null);
  const [hubspotToken, setHubspotToken]   = useState(initialHubspotToken);
  const [hubspotMsg, setHubspotMsg]       = useState<string | null>(null);
  const [slackUrl, setSlackUrl]           = useState(initialNotify.slackUrl ?? "");
  const [minScore, setMinScore]           = useState(String(initialNotify.minScore));
  const [notifyMsg, setNotifyMsg]         = useState<string | null>(null);

  function saveNotify() {
    start(async () => {
      const res = await saveAbmNotifySettingsAction(tenantId, slackUrl, parseInt(minScore, 10) || 60);
      setNotifyMsg(res.ok ? "Saved." : res.error);
    });
  }

  function saveWebhook() {
    start(async () => {
      const res = await saveAbmWebhookUrlAction(tenantId, webhookUrl);
      setWebhookMsg(res.ok ? "Saved." : res.error);
    });
  }
  function saveSecret() {
    start(async () => {
      const res = await saveAbmWebhookSecretAction(tenantId, webhookSecret);
      setSecretMsg(res.ok ? "Saved." : res.error);
    });
  }
  function generateSecret() {
    start(async () => {
      const res = await generateAbmWebhookSecretAction(tenantId);
      if (res.ok) { setWebhookSecret(res.secret); setSecretMsg("Generated + saved. Copy it into your receiver."); }
      else setSecretMsg(res.error);
    });
  }
  function saveHubspot() {
    start(async () => {
      const res = await saveAbmHubspotTokenAction(tenantId, hubspotToken);
      setHubspotMsg(res.ok ? "Saved." : res.error);
    });
  }
  function testHubspot() {
    setHubspotMsg("Testing…");
    start(async () => {
      const res = await testAbmHubspotSyncAction(tenantId);
      setHubspotMsg(
        res.ok
          ? `✓ Verbonden: testbedrijf "Mister Chameleon (Sync Test)" aangemaakt/bijgewerkt${res.companyId ? ` (id ${res.companyId})` : ""}.`
          : `✗ ${res.error}`,
      );
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Outbound webhook ───────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Outbound webhook <span className="text-neutral-400 font-normal">(optional)</span></h2>
        <p className="text-xs text-neutral-500">
          When a lead qualifies (a named lead arriving via their link, or any visitor reaching
          MQL/SQL through the funnel), POST a JSON event to this URL. The payload carries the
          named <code className="font-mono">person</code> (name, job title, LinkedIn) plus the
          <code className="font-mono"> profile</code> (company, size, industry, geo, intent, funnel
          stage, segments), so your flow (Make, n8n, Slack, your own endpoint) can use them, e.g.
          in the body of a triggered email. Leave empty to disable.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={LABEL}>Webhook URL</label>
            <input className={INPUT} value={webhookUrl} onChange={(e) => { setWebhookUrl(e.target.value); setWebhookMsg(null); }} placeholder="https://hooks.example.com/leads" />
          </div>
          <button onClick={saveWebhook} disabled={pending} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
            {pending ? "Saving…" : "Save webhook"}
          </button>
        </div>
        {webhookMsg && <span className="text-xs text-neutral-500">{webhookMsg}</span>}

        {/* Signing secret */}
        <div className="mt-2 border-t border-neutral-100 pt-3">
          <label className={LABEL}>Signing secret <span className="text-neutral-400 font-normal">(optional)</span></label>
          <p className="mb-2 text-xs text-neutral-500">
            When set, each POST is signed: header <code className="font-mono">X-MC-Signature: sha256=…</code> is
            <code className="font-mono"> HMAC-SHA256(secret, `${"{timestamp}"}.${"{body}"}`)</code> and
            <code className="font-mono"> X-MC-Timestamp</code> carries the unix time. Verify it in your
            receiver to confirm authenticity and reject replays.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <input className={`${INPUT} font-mono text-xs`} value={webhookSecret} onChange={(e) => { setWebhookSecret(e.target.value); setSecretMsg(null); }} placeholder="whsec_…" />
            </div>
            <button onClick={generateSecret} disabled={pending} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
              Generate
            </button>
            <button onClick={saveSecret} disabled={pending} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
              {pending ? "Saving…" : "Save secret"}
            </button>
          </div>
          {secretMsg && <span className="text-xs text-neutral-500">{secretMsg}</span>}
        </div>
      </section>

      {/* ── HubSpot CRM sync ────────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">HubSpot CRM sync <span className="text-neutral-400 font-normal">(optional)</span></h2>
        <p className="text-xs text-neutral-500">
          When a known lead arrives, its account is synced to HubSpot as a{" "}
          <strong>Company</strong> (deduped by domain, else name) with firmographics, the named
          person as an associated <strong>Contact</strong>, and a website-visit note on the
          timeline. Create a private app or Service Key with CRM write scopes
          (<code className="font-mono">companies</code> + <code className="font-mono">contacts</code>)
          and paste its token. Leave empty to disable.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={LABEL}>HubSpot private-app token</label>
            <input type="password" className={INPUT} value={hubspotToken} onChange={(e) => { setHubspotToken(e.target.value); setHubspotMsg(null); }} placeholder="pat-eu1-…" />
          </div>
          <button onClick={saveHubspot} disabled={pending} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
            {pending ? "Saving…" : "Save token"}
          </button>
          <button onClick={testHubspot} disabled={pending} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
            Test verbinding
          </button>
        </div>
        {hubspotMsg && <span className="block break-words text-xs text-neutral-500">{hubspotMsg}</span>}
      </section>

      {/* ── Hot-lead Slack alerts ───────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Hot-lead Slack alerts <span className="text-neutral-400 font-normal">(optional)</span></h2>
        <p className="text-xs text-neutral-500">
          Get an instant Slack message when a qualifying lead clears a hot-score threshold,
          no Make/Zapier needed. Paste a Slack{" "}
          <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="underline">incoming-webhook URL</a>{" "}
          and set the minimum score (the same 0-100 score shown in the list).
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={LABEL}>Slack webhook URL</label>
            <input className={INPUT} value={slackUrl} onChange={(e) => { setSlackUrl(e.target.value); setNotifyMsg(null); }} placeholder="https://hooks.slack.com/services/…" />
          </div>
          <div className="w-28">
            <label className={LABEL}>Min score</label>
            <input type="number" min={0} max={100} className={INPUT} value={minScore} onChange={(e) => { setMinScore(e.target.value); setNotifyMsg(null); }} />
          </div>
          <button onClick={saveNotify} disabled={pending} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        {notifyMsg && <span className="text-xs text-neutral-500">{notifyMsg}</span>}
      </section>

      {/* ── Recent webhook deliveries ───────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">Recent webhook deliveries</h2>
          <button onClick={refreshDeliveries} disabled={pending} className="text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-50">Refresh</button>
          {deliveryMsg && <span className="text-xs text-neutral-500">{deliveryMsg}</span>}
        </div>
        <p className="text-xs text-neutral-500">
          The last 25 outbound webhook attempts. Each is retried up to 3× on network/5xx errors;
          a failed one can be re-sent to the current URL with <strong>Replay</strong>.
        </p>
        {deliveries.length === 0 ? (
          <p className="text-xs text-neutral-400">No deliveries yet. They appear when a lead qualifies and a webhook URL is set.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-2 py-1.5 text-left">When</th>
                  <th className="px-2 py-1.5 text-left">Company</th>
                  <th className="px-2 py-1.5 text-left">Person</th>
                  <th className="px-2 py-1.5 text-left">→ Status</th>
                  <th className="px-2 py-1.5 text-left">Result</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {deliveries.map((d) => {
                  const s = summarizePayload(d.payload);
                  return (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td className="px-2 py-1.5 text-neutral-500">{fmtDeliveryTime(d.createdAt)}</td>
                      <td className="px-2 py-1.5 text-neutral-800">{s.company}</td>
                      <td className="px-2 py-1.5 text-neutral-600">{s.person}</td>
                      <td className="px-2 py-1.5 text-neutral-600">{s.toStatus}</td>
                      <td className="px-2 py-1.5">
                        {d.ok
                          ? <span className="text-green-600">✓ {d.statusCode ?? "200"}</span>
                          : <span className="text-red-600" title={d.error ?? ""}>✗ {d.statusCode ?? d.error ?? "failed"} ({d.attempts}×)</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => replay(d.id)} disabled={pending} className="text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-50">Replay</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
