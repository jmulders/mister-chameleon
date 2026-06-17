"use client";

/**
 * TenantDomainsPanel
 *
 * Admin panel for managing custom domain registrations for a tenant.
 * Rendered on /admin/tenants/[tenantId].
 *
 * ─── Features ────────────────────────────────────────────────────────────────
 *
 *   Add domain     — normalises input, calls addDomainAction().
 *                    Shows DNS routing records (A / CNAME) and any Vercel TXT
 *                    verification records immediately after adding.
 *
 *   Set primary    — marks one domain as the tenant's primary domain.
 *                    The primary domain is the canonical URL for the tenant.
 *
 *   Check / Verify — calls Vercel to refresh verification status for a pending
 *                    domain.  Flips it to "active" when Vercel confirms DNS.
 *                    Hidden when Vercel integration is not configured.
 *
 *   Remove         — calls removeDomainAction(), optionally removing from Vercel.
 *
 *   DNS instructions — after adding any domain, shows the A / CNAME record
 *                      the operator must set at their DNS provider.
 *                      Vercel verification TXT records are shown additionally
 *                      for domains still in "pending" status.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   tenantId        — the tenant this panel manages domains for
 *   initialDomains  — domains pre-loaded server-side (avoids a loading flash)
 *   vercelEnabled   — whether VERCEL_API_TOKEN + VERCEL_PROJECT_ID are set;
 *                     controls visibility of "Check" button and status copy
 */

import { useState, useTransition }  from "react";
import {
  addDomainAction,
  removeDomainAction,
  setPrimaryDomainAction,
  checkDomainAction,
  listDomainsAction,
}                                   from "@/app/admin/tenants/[tenantId]/domain-actions";
import type { TenantDomainRow }     from "@/data/types";
import type { DnsRecord }           from "@/app/admin/tenants/[tenantId]/domain-actions";

// ── Props ──────────────────────────────────────────────────────────────────────

interface TenantDomainsPanelProps {
  tenantId:       string;
  initialDomains: TenantDomainRow[];
  /** True when VERCEL_API_TOKEN + VERCEL_PROJECT_ID are configured server-side. */
  vercelEnabled:  boolean;
}

// ── Small UI primitives ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TenantDomainRow["status"] }) {
  const cfg = {
    pending: { dot: "bg-amber-400", bg: "bg-amber-50  border-amber-200 text-amber-700",  label: "Pending DNS" },
    active:  { dot: "bg-green-500", bg: "bg-green-50  border-green-200  text-green-700",  label: "Active"      },
    error:   { dot: "bg-red-500",   bg: "bg-red-50    border-red-200    text-red-600",    label: "Error"       },
  }[status] ?? { dot: "bg-neutral-400", bg: "bg-neutral-100 border-neutral-200 text-neutral-500", label: status };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.bg}`}>
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PrimaryBadge() {
  return (
    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
      Primary
    </span>
  );
}

// ── DNS instructions ──────────────────────────────────────────────────────────

interface VerificationRecord {
  type:   string;
  domain: string;
  value:  string;
  reason: string;
}

function DnsInstructions({
  hostname,
  dnsRecords,
  verification,
}: {
  hostname:     string;
  dnsRecords:   DnsRecord[];
  verification: VerificationRecord[];
}) {
  const [open, setOpen] = useState(true);
  if (dnsRecords.length === 0 && verification.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-semibold text-sky-900"
      >
        <span>DNS configuration for <code className="font-mono">{hostname}</code></span>
        <span className="text-sky-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-sky-200 px-3 pb-3 pt-2 space-y-3">

          {/* Routing records */}
          {dnsRecords.length > 0 && (
            <div>
              <p className="mb-1.5 text-sky-700 font-medium">
                Add this record at your DNS provider to route traffic to Vercel:
              </p>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-sky-600 text-xs uppercase tracking-wide">
                    <th className="py-1 pr-4 font-semibold">Type</th>
                    <th className="py-1 pr-4 font-semibold">Name</th>
                    <th className="py-1 pr-4 font-semibold">Value</th>
                    <th className="py-1 font-semibold">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  {dnsRecords.map((rec, i) => (
                    <tr key={i} className="font-mono text-neutral-800">
                      <td className="py-0.5 pr-4">{rec.type}</td>
                      <td className="py-0.5 pr-4">{rec.name}</td>
                      <td className="py-0.5 pr-4 break-all">{rec.value}</td>
                      <td className="py-0.5 text-neutral-500">{rec.ttl ?? "auto"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vercel TXT verification records */}
          {verification.length > 0 && (
            <div>
              <p className="mb-1.5 text-amber-700 font-medium">
                Additionally, add this Vercel ownership verification record:
              </p>
              {verification.map((rec, i) => (
                <div key={i} className="rounded border border-amber-200 bg-white p-2 font-mono space-y-0.5">
                  <div>
                    <span className="font-semibold text-amber-700">{rec.type}</span>{" "}
                    <span className="text-neutral-700">{rec.domain}</span>
                  </div>
                  <div className="break-all text-neutral-700">{rec.value}</div>
                  {rec.reason && (
                    <div className="font-sans text-xs text-amber-600">{rec.reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-sky-600">
            DNS changes can take up to 24 hours to propagate.
            Once propagated, use the <strong>Check</strong> button to verify.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Domain row ────────────────────────────────────────────────────────────────

interface DomainRowProps {
  domain:        TenantDomainRow;
  tenantId:      string;
  vercelEnabled: boolean;
  onUpdated:     (updated: TenantDomainRow) => void;
  onRemoved:     (id: string) => void;
}

function DomainRow({ domain, tenantId, vercelEnabled, onUpdated, onRemoved }: DomainRowProps) {
  const [rowError,   setRowError]   = useState<string | null>(null);
  const [rowWarning, setRowWarning] = useState<string | null>(null);
  const [checkVerification, setCheckVerification] = useState<VerificationRecord[]>([]);
  const [checkDnsRecords,   setCheckDnsRecords]   = useState<DnsRecord[]>([]);
  const [isPending,  startTransition] = useTransition();

  // Extract persisted verification records for display.
  const persistedVerification: VerificationRecord[] =
    domain.status === "pending" && domain.vercel_verification
      ? ((domain.vercel_verification as { records?: VerificationRecord[] }).records ?? [])
      : [];

  const displayVerification = checkVerification.length > 0 ? checkVerification : persistedVerification;

  // ── Set primary ───────────────────────────────────────────────────────────
  function handleSetPrimary() {
    if (domain.is_primary || isPending) return;
    setRowError(null);
    startTransition(async () => {
      const result = await setPrimaryDomainAction(domain.id, tenantId);
      if (!result.ok) {
        setRowError(result.error);
      } else {
        onUpdated(result.domain);
      }
    });
  }

  // ── Check / verify ────────────────────────────────────────────────────────
  function handleCheck() {
    if (isPending) return;
    setRowError(null);
    setRowWarning(null);
    startTransition(async () => {
      const result = await checkDomainAction(domain.id, tenantId);
      if (!result.ok) {
        setRowError(result.error);
        return;
      }
      onUpdated(result.domain);
      setCheckVerification(result.verification);
      if (result.verified) {
        setRowWarning(null);
        setCheckVerification([]);
      } else {
        setRowWarning("DNS not yet verified. Check your records and try again.");
      }
    });
  }

  // ── Remove ────────────────────────────────────────────────────────────────
  function handleRemove() {
    if (isPending) return;
    setRowError(null);
    startTransition(async () => {
      const result = await removeDomainAction(domain.id, tenantId);
      if (!result.ok) {
        setRowError(result.error);
      } else {
        onRemoved(domain.id);
      }
    });
  }

  const canCheck = vercelEnabled && (domain.status === "pending" || domain.status === "error");

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      {/* Row header */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        {/* Hostname */}
        <code className="flex-1 min-w-0 truncate font-mono text-sm text-neutral-800">
          {domain.hostname}
        </code>

        {/* Status + primary badges */}
        <StatusBadge status={domain.status} />
        {domain.is_primary && <PrimaryBadge />}

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-1">
          {/* Set as primary — only shown when not already primary */}
          {!domain.is_primary && (
            <button
              type="button"
              onClick={handleSetPrimary}
              disabled={isPending}
              className="rounded px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              title="Set as primary domain"
            >
              Set primary
            </button>
          )}

          {/* Check / Verify — only shown for pending/error when Vercel is configured */}
          {canCheck && (
            <button
              type="button"
              onClick={handleCheck}
              disabled={isPending}
              className="rounded px-2 py-1 text-xs text-sky-600 transition-colors hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Check Vercel verification status"
            >
              {isPending ? "Checking…" : "Check"}
            </button>
          )}

          {/* Remove */}
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="rounded px-2 py-1 text-xs text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Remove ${domain.hostname}`}
          >
            {isPending ? "…" : "Remove"}
          </button>
        </div>
      </div>

      {/* Inline error / warning */}
      {rowError   && <p className="px-3 pb-2 text-xs text-red-600">{rowError}</p>}
      {rowWarning && <p className="px-3 pb-2 text-xs text-amber-600">{rowWarning}</p>}

      {/* DNS instructions for pending / error domains */}
      {(domain.status === "pending" || domain.status === "error") && (
        <div className="px-3 pb-3">
          <DnsInstructions
            hostname={domain.hostname}
            dnsRecords={[]}   // Routing records shown once at add time; re-derive here if needed
            verification={displayVerification}
          />
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function TenantDomainsPanel({
  tenantId,
  initialDomains,
  vercelEnabled,
}: TenantDomainsPanelProps) {
  const [domains,     setDomains]     = useState<TenantDomainRow[]>(initialDomains);
  const [input,       setInput]       = useState("");
  const [addError,    setAddError]    = useState<string | null>(null);
  const [addWarnings, setAddWarnings] = useState<string[]>([]);
  // DNS instructions shown after a successful add.
  const [justAdded,   setJustAdded]   = useState<{
    hostname:     string;
    dnsRecords:   DnsRecord[];
    verification: Array<{ type: string; domain: string; value: string; reason: string }>;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function refreshDomains() {
    const result = await listDomainsAction(tenantId);
    if (result.ok) setDomains(result.domains);
  }

  function handleDomainUpdated(updated: TenantDomainRow) {
    setDomains((prev) =>
      prev.map((d) => {
        if (d.id === updated.id) return updated;
        // If updated is now primary, clear others.
        if (updated.is_primary && d.is_primary) return { ...d, is_primary: false };
        return d;
      }),
    );
  }

  function handleDomainRemoved(id: string) {
    setDomains((prev) => prev.filter((d) => d.id !== id));
  }

  // ── Add domain ────────────────────────────────────────────────────────────

  function handleAdd() {
    const raw = input.trim();
    if (!raw || isPending) return;
    setAddError(null);
    setAddWarnings([]);
    setJustAdded(null);

    startTransition(async () => {
      const result = await addDomainAction(tenantId, raw);
      if (!result.ok) {
        setAddError(result.error);
        return;
      }

      setInput("");
      setAddWarnings(result.warnings);
      setJustAdded({
        hostname:     result.domain.hostname,
        dnsRecords:   result.dnsRecords,
        verification: result.verification,
      });
      await refreshDomains();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white">

      {/* Header */}
      <div className="border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Custom Domains</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Map hostnames to this tenant. Traffic to a registered domain routes here
              automatically — no code deploy required.
            </p>
          </div>
          {!vercelEnabled && (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-500">
              Vercel integration off
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">

        {/* ── Add domain form ─────────────────────────────────────────── */}
        <div>
          <label
            htmlFor={`domain-input-${tenantId}`}
            className="mb-1.5 block text-xs font-medium text-neutral-700"
          >
            Add domain
          </label>
          <div className="flex gap-2">
            <input
              id={`domain-input-${tenantId}`}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setAddError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="acme.com or www.acme.com"
              disabled={isPending}
              autoComplete="off"
              spellCheck={false}
              className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-50"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!input.trim() || isPending}
              className="rounded-md bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add"}
            </button>
          </div>

          {/* Add errors / warnings */}
          {addError && <p className="mt-1.5 text-xs text-red-600">{addError}</p>}
          {addWarnings.map((w, i) => (
            <p key={i} className="mt-1 text-xs text-amber-600">{w}</p>
          ))}

          {/* DNS instructions shown immediately after adding a domain */}
          {justAdded && (
            <DnsInstructions
              hostname={justAdded.hostname}
              dnsRecords={justAdded.dnsRecords}
              verification={justAdded.verification}
            />
          )}
        </div>

        {/* ── Domain list ─────────────────────────────────────────────── */}
        {domains.length === 0 ? (
          <p className="py-3 text-center text-xs text-neutral-400">
            No custom domains registered yet. Add one above.
          </p>
        ) : (
          <div className="space-y-2">
            {domains.map((domain) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                tenantId={tenantId}
                vercelEnabled={vercelEnabled}
                onUpdated={handleDomainUpdated}
                onRemoved={handleDomainRemoved}
              />
            ))}
          </div>
        )}

        {/* ── Vercel status note ───────────────────────────────────────── */}
        {vercelEnabled ? (
          <p className="text-xs text-neutral-400">
            Domains are registered on your Vercel project automatically.
            Use <strong>Check</strong> on any pending domain after configuring DNS.
          </p>
        ) : (
          <p className="text-xs text-neutral-400">
            <span className="font-medium text-neutral-500">Vercel integration not configured.</span>{" "}
            Domains are saved as active immediately. Set{" "}
            <code className="font-mono">VERCEL_API_TOKEN</code> and{" "}
            <code className="font-mono">VERCEL_PROJECT_ID</code> to enable automatic
            Vercel domain registration and DNS verification.
          </p>
        )}

        {/* ── DNS setup tip ────────────────────────────────────────────── */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
          <p className="mb-1.5 font-medium text-neutral-700">
            DNS — connecting a domain to this platform
          </p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Add the domain above and save.</li>
            <li>
              At your DNS provider (e.g. Strato, TransIP, Cloudflare), add the
              record Vercel shows for the domain:
              <ul className="ml-4 mt-1 list-disc space-y-0.5">
                <li>
                  <span className="font-medium">Subdomain</span> (e.g.{" "}
                  <code className="font-mono">www</code>,{" "}
                  <code className="font-mono">app</code>,{" "}
                  <code className="font-mono">client</code>): a{" "}
                  <span className="font-medium">CNAME</span> to the value Vercel
                  gives — typically{" "}
                  <code className="font-mono">cname.vercel-dns-0.com</code>.
                </li>
                <li>
                  <span className="font-medium">Root / apex domain</span> (e.g.{" "}
                  <code className="font-mono">example.com</code>): an{" "}
                  <span className="font-medium">A record</span> to{" "}
                  <code className="font-mono">76.76.21.21</code>{" "}
                  (an apex can&apos;t use a CNAME).
                </li>
              </ul>
            </li>
            <li>
              Remove any old/conflicting records for the same name (one record per
              name), then click <strong>Check</strong> to verify.
            </li>
          </ol>
          <p className="mt-1.5 text-neutral-400">
            Vercel shows the exact records under Project → Domains; they can differ
            per domain, so use those when they do.
          </p>
        </div>

        {/* ── Dev hint ─────────────────────────────────────────────────── */}
        <p className="border-t border-neutral-100 pt-3 text-xs text-neutral-400">
          <span className="font-medium text-neutral-500">Dev:</span>{" "}
          <code className="font-mono">localhost</code> always falls back to the default tenant.
          Use <code className="font-mono">?tenant=slug</code> or the Dev Controls above to
          override locally.
        </p>

      </div>
    </section>
  );
}
