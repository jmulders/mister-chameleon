"use client";

import { useState, useTransition } from "react";
import {
  saveAbmLeadAction,
  deleteAbmLeadAction,
  importAbmLeadsCsvAction,
  listAbmLeadsAction,
} from "../actions";
import type { AbmLead, AbmLeadStatus } from "@/lib/abm/abm-store";

const INPUT =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const LABEL = "block text-xs font-medium text-neutral-600 mb-1";

interface FormState {
  id?:          string;
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
  firstName: "", name: "", company: "", role: "", industry: "", companySize: "",
  linkedinUrl: "", targetPath: "/", vanityPath: "", segmentHint: "", status: "active",
};

export function AbmClient({
  tenantId,
  initialLeads,
  baseUrl,
}: {
  tenantId:     string;
  initialLeads: AbmLead[];
  baseUrl:      string;
}) {
  const [leads, setLeads]   = useState<AbmLead[]>(initialLeads);
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [csv, setCsv]       = useState("");
  const [importTarget, setImportTarget] = useState("/");
  const [msg, setMsg]       = useState<string | null>(null);
  const [pending, start]    = useTransition();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function linkFor(lead: AbmLead): string {
    return `${baseUrl}/go/${lead.identifier}`;
  }

  function edit(lead: AbmLead) {
    setForm({
      id:          lead.id,
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
          <div><label className={LABEL}>First name</label><input className={INPUT} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Jasper" /></div>
          <div><label className={LABEL}>Full name</label><input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jasper Mulders" /></div>
          <div><label className={LABEL}>Company</label><input className={INPUT} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme BV" /></div>
          <div><label className={LABEL}>Role</label><input className={INPUT} value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Head of Growth" /></div>
          <div><label className={LABEL}>Industry</label><input className={INPUT} value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Logistics" /></div>
          <div><label className={LABEL}>Company size</label><input className={INPUT} value={form.companySize} onChange={(e) => set("companySize", e.target.value)} placeholder="51-200" /></div>
        </div>
        <div><label className={LABEL}>LinkedIn URL <span className="text-neutral-400">(optional)</span></label><input className={INPUT} value={form.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} /></div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>Target page</label><input className={INPUT} value={form.targetPath} onChange={(e) => set("targetPath", e.target.value)} placeholder="/pricing" /></div>
          <div><label className={LABEL}>Vanity path <span className="text-neutral-400">(optional)</span></label><input className={INPUT} value={form.vanityPath} onChange={(e) => set("vanityPath", e.target.value)} placeholder="/aanbodvoorjasper" /></div>
          <div><label className={LABEL}>Audience segment <span className="text-neutral-400">(optional)</span></label><input className={INPUT} value={form.segmentHint} onChange={(e) => set("segmentHint", e.target.value)} placeholder="high-intent-enterprise" /></div>
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
        <h2 className="text-sm font-semibold text-neutral-900">Import from Sales Navigator (CSV)</h2>
        <p className="text-xs text-neutral-500">
          Paste a CSV export. Common columns (First name, Last name, Company, Title,
          Industry, Company size, Profile URL) are auto-detected; a link is generated per row.
        </p>
        <textarea className={`${INPUT} font-mono text-xs`} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="First Name,Last Name,Company,Title&#10;Jasper,Mulders,Acme BV,Head of Growth" />
        <div className="flex items-end gap-3">
          <div className="flex-1"><label className={LABEL}>Target page for all imported leads</label><input className={INPUT} value={importTarget} onChange={(e) => setImportTarget(e.target.value)} placeholder="/pricing" /></div>
          <button onClick={runImport} disabled={pending || !csv.trim()} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
      </section>

      {/* ── Leads ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">Leads ({leads.length})</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-neutral-500">No leads yet — add one above or import a CSV.</p>
        ) : (
          <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {leads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-neutral-900 truncate">
                    {lead.profile.name || lead.profile.firstName || lead.identifier}
                    {lead.profile.company && <span className="text-neutral-400"> · {lead.profile.company}</span>}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    <span className="font-mono">{linkFor(lead)}</span> → {lead.targetPath}
                    {lead.status !== "active" && <span className="ml-2 rounded bg-amber-50 px-1.5 text-amber-700">{lead.status}</span>}
                    <span className="ml-2">{lead.visitCount} visit{lead.visitCount === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <button onClick={() => navigator.clipboard?.writeText(linkFor(lead))} className="text-xs text-neutral-500 hover:text-neutral-900">Copy link</button>
                <button onClick={() => edit(lead)} className="text-xs text-neutral-500 hover:text-neutral-900">Edit</button>
                <button onClick={() => remove(lead.id)} disabled={pending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
