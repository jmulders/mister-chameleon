"use client";

import { useState, useTransition } from "react";
import {
  saveAbmLeadAction,
  deleteAbmLeadAction,
  importAbmLeadsCsvAction,
  listAbmLeadsAction,
  listAbmLeadVisitsAction,
  saveAbmWebhookUrlAction,
  saveAbmHubspotTokenAction,
  testAbmHubspotSyncAction,
  saveAbmWebhookSecretAction,
  generateAbmWebhookSecretAction,
} from "../actions";
import type { AbmLead, AbmLeadStatus, AbmLeadVisit } from "@/lib/abm/abm-store";

/** Compact local date-time label, e.g. "28 Jun, 14:02". */
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const INPUT =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const LABEL = "block text-xs font-medium text-neutral-600 mb-1";

interface FormState {
  id?:          string;
  identifier:   string;
  firstName:    string;
  name:         string;
  company:      string;
  role:         string;
  industry:     string;
  companySize:  string;
  linkedinUrl:  string;
  targetPath:   string;
  vanityPath:   string;
  segmentHint:  string;
  status:       AbmLeadStatus;
}

const EMPTY: FormState = {
  identifier: "",
  firstName: "", name: "", company: "", role: "", industry: "", companySize: "",
  linkedinUrl: "", targetPath: "/", vanityPath: "", segmentHint: "", status: "active",
};

export interface SegmentOption {
  key:   string;
  label: string;
}

export function AbmClient({
  tenantId,
  initialLeads,
  baseUrl,
  segments,
  initialWebhookUrl,
  initialWebhookSecret,
  initialHubspotToken,
}: {
  tenantId:             string;
  initialLeads:         AbmLead[];
  baseUrl:              string;
  segments:             SegmentOption[];
  initialWebhookUrl:    string;
  initialWebhookSecret: string;
  initialHubspotToken:  string;
}) {
  const [leads, setLeads]   = useState<AbmLead[]>(initialLeads);
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [csv, setCsv]       = useState("");
  const [importTarget, setImportTarget] = useState("/");
  const [msg, setMsg]       = useState<string | null>(null);
  const [pending, start]    = useTransition();

  // Outbound webhook settings.
  const [webhookUrl, setWebhookUrl]       = useState(initialWebhookUrl);
  const [webhookMsg, setWebhookMsg]       = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState(initialWebhookSecret);
  const [secretMsg, setSecretMsg]         = useState<string | null>(null);

  // HubSpot CRM-sync token.
  const [hubspotToken, setHubspotToken] = useState(initialHubspotToken);
  const [hubspotMsg, setHubspotMsg]     = useState<string | null>(null);

  // Per-lead visit timeline (lazy-loaded on expand; only one lead at a time).
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [visits, setVisits]             = useState<AbmLeadVisit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function toggleExpand(leadId: string) {
    if (expandedId === leadId) { setExpandedId(null); return; }
    setExpandedId(leadId);
    setVisits([]);
    setVisitsLoading(true);
    try {
      const rows = await listAbmLeadVisitsAction(leadId);
      setVisits(rows);
    } finally {
      setVisitsLoading(false);
    }
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
      if (res.ok) { setWebhookSecret(res.secret); setSecretMsg("Generated + saved — copy it into your receiver."); }
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
          ? `✓ Verbonden — testbedrijf "Mister Chameleon — Sync Test" aangemaakt/bijgewerkt${res.companyId ? ` (id ${res.companyId})` : ""}.`
          : `✗ ${res.error}`,
      );
    });
  }

  function linkFor(lead: AbmLead): string {
    return `${baseUrl}/go/${lead.identifier}`;
  }

  function edit(lead: AbmLead) {
    setForm({
      id:          lead.id,
      identifier:  lead.identifier,
      firstName:   lead.profile.firstName   ?? "",
      name:        lead.profile.name        ?? "",
      company:     lead.profile.company     ?? "",
      role:        lead.profile.role        ?? "",
      industry:    lead.profile.industry    ?? "",
      companySize: lead.profile.companySize ?? "",
      linkedinUrl: lead.profile.linkedinUrl ?? "",
      targetPath:  lead.targetPath,
      vanityPath:  lead.vanityPath ?? "",
      segmentHint: lead.segmentHint ?? "",
      status:      lead.status,
    });
    setMsg(null);
  }

  function save() {
    start(async () => {
      const res = await saveAbmLeadAction(tenantId, {
        id:          form.id,
        identifier:  form.identifier || undefined,
        targetPath:  form.targetPath,
        vanityPath:  form.vanityPath,
        segmentHint: form.segmentHint,
        status:      form.status,
        profile: {
          ...(form.firstName   ? { firstName:   form.firstName }   : {}),
          ...(form.name        ? { name:        form.name }        : {}),
          ...(form.company     ? { company:     form.company }     : {}),
          ...(form.role        ? { role:        form.role }        : {}),
          ...(form.industry    ? { industry:    form.industry }    : {}),
          ...(form.companySize ? { companySize: form.companySize } : {}),
          ...(form.linkedinUrl ? { linkedinUrl: form.linkedinUrl } : {}),
        },
      });
      if (!res.ok) { setMsg(res.error); return; }
      setLeads((cur) => {
        const without = cur.filter((l) => l.id !== res.lead.id);
        return [res.lead, ...without];
      });
      setForm(EMPTY);
      setMsg("Saved.");
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteAbmLeadAction(tenantId, id);
      setLeads((cur) => cur.filter((l) => l.id !== id));
    });
  }

  function runImport() {
    start(async () => {
      const res = await importAbmLeadsCsvAction(tenantId, csv, importTarget);
      const fresh = await listAbmLeadsAction(tenantId);
      setLeads(fresh);
      setCsv("");
      setMsg(`Imported ${res.created} lead(s)${res.errors.length ? ` — ${res.errors.length} skipped` : ""}.`);
    });
  }

  return (
    <div className="space-y-8">
      {/* ── Add / edit ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          {form.id ? "Edit lead" : "Add a lead"}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>First name</label><input className={INPUT} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="John" /></div>
          <div><label className={LABEL}>Full name</label><input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="John Doe" /></div>
          <div><label className={LABEL}>Company</label><input className={INPUT} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme BV" /></div>
          <div><label className={LABEL}>Role</label><input className={INPUT} value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Head of Growth" /></div>
          <div><label className={LABEL}>Industry</label><input className={INPUT} value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Logistics" /></div>
          <div><label className={LABEL}>Company size</label><input className={INPUT} value={form.companySize} onChange={(e) => set("companySize", e.target.value)} placeholder="51-200" /></div>
        </div>
        <div><label className={LABEL}>LinkedIn URL <span className="text-neutral-400">(optional)</span></label><input className={INPUT} value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} /></div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>Target page</label><input className={INPUT} value={form.targetPath} onChange={(e) => set("targetPath", e.target.value)} placeholder="/pricing" /></div>
          <div><label className={LABEL}>Vanity path <span className="text-neutral-400">(optional)</span></label><input className={INPUT} value={form.vanityPath} onChange={(e) => set("vanityPath", e.target.value)} placeholder="/offer-for-john" /></div>
          <div>
            <label className={LABEL}>Audience segment <span className="text-neutral-400">(optional)</span></label>
            <select className={INPUT} value={form.segmentHint} onChange={(e) => set("segmentHint", e.target.value)}>
              <option value="">— None —</option>
              {segments.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
              {form.segmentHint && !segments.some((s) => s.key === form.segmentHint) && (
                <option value={form.segmentHint}>{form.segmentHint} (not in list)</option>
              )}
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className={INPUT} value={form.status} onChange={(e) => set("status", e.target.value as AbmLeadStatus)}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="expired">expired</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={pending} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
            {pending ? "Saving…" : form.id ? "Update lead" : "Add lead"}
          </button>
          {form.id && <button onClick={() => setForm(EMPTY)} className="text-xs text-neutral-500 hover:text-neutral-800">Cancel edit</button>}
          {msg && <span className="text-xs text-neutral-500">{msg}</span>}
        </div>
      </section>

      {/* ── Import ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Import leads (CSV)</h2>
        <p className="text-xs text-neutral-500">
          Paste any CSV with these columns: First name, Last name, Company, Title,
          Industry, Company size, Profile URL. Columns are auto-detected (comma,
          semicolon, or tab-separated); a link is generated per row.
        </p>
        <textarea className={`${INPUT} font-mono text-xs`} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"First Name,Last Name,Company,Title\nJohn,Doe,Acme BV,Head of Growth"} />
        <div className="flex items-end gap-3">
          <div className="flex-1"><label className={LABEL}>Target page for all imported leads</label><input className={INPUT} value={importTarget} onChange={(e) => setImportTarget(e.target.value)} placeholder="/pricing" /></div>
          <button onClick={runImport} disabled={pending || !csv.trim()} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
      </section>

      {/* ── Outbound webhook ───────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Outbound webhook <span className="text-neutral-400 font-normal">(optional)</span></h2>
        <p className="text-xs text-neutral-500">
          When a lead qualifies — a named lead arriving via their link, or any visitor reaching
          MQL/SQL through the funnel — POST a JSON event to this URL. The payload carries the
          named <code className="font-mono">person</code> (name, job title, LinkedIn) plus the
          <code className="font-mono"> profile</code> (company, size, industry, geo, intent, funnel
          stage, segments), so your flow (Make, n8n, Slack, your own endpoint) can use them — e.g.
          in the body of a triggered email. Leave empty to disable.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={LABEL}>Webhook URL</label>
            <input className={INPUT} value={webhookUrl} onChange={(e) => { setWebhookUrl(e.target.value); setWebhookMsg(null); }} placeholder="https://hooks.example.com/abm" />
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

      {/* ── Leads ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">Leads ({leads.length})</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-neutral-500">No leads yet — add one above or import a CSV.</p>
        ) : (
          <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {leads.map((lead) => (
              <div key={lead.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(lead.id)}
                    className="w-4 shrink-0 text-neutral-400 hover:text-neutral-700"
                    aria-label={expandedId === lead.id ? "Collapse activity" : "Show activity"}
                  >
                    {expandedId === lead.id ? "▾" : "▸"}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-neutral-900 truncate">
                      {lead.profile.name || lead.profile.firstName || lead.identifier}
                      {lead.profile.company && <span className="text-neutral-400"> · {lead.profile.company}</span>}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      <span className="font-mono">{linkFor(lead)}</span> → {lead.targetPath}
                      {lead.status !== "active" && <span className="ml-2 rounded bg-amber-50 px-1.5 text-amber-700">{lead.status}</span>}
                      <span className="ml-2">{lead.visitCount} visit{lead.visitCount === 1 ? "" : "s"}</span>
                      {lead.lastSeenAt
                        ? <span className="ml-2">· last seen {fmtWhen(lead.lastSeenAt)}</span>
                        : <span className="ml-2 text-neutral-400">· not visited yet</span>}
                    </div>
                  </div>
                  <button onClick={() => navigator.clipboard?.writeText(linkFor(lead))} className="text-xs text-neutral-500 hover:text-neutral-900">Copy link</button>
                  <button onClick={() => edit(lead)} className="text-xs text-neutral-500 hover:text-neutral-900">Edit</button>
                  <button onClick={() => remove(lead.id)} disabled={pending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
                </div>

                {expandedId === lead.id && (
                  <div className="mt-2 ml-7 border-l border-neutral-100 pl-3">
                    {visitsLoading ? (
                      <p className="text-xs text-neutral-400 py-1">Loading activity…</p>
                    ) : visits.length === 0 ? (
                      <p className="text-xs text-neutral-400 py-1">No visits recorded yet.</p>
                    ) : (
                      <ul className="py-1 space-y-1">
                        {visits.map((v) => (
                          <li key={v.id} className="text-xs text-neutral-600 flex justify-between gap-3">
                            <span className="font-mono truncate">{v.path}</span>
                            <span className="shrink-0 text-neutral-400">{fmtWhen(v.visitedAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
