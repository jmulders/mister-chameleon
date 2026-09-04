"use client";

/**
 * StatamicRolloutCard
 *
 * One button that produces a complete working Statamic site: tenant, repo from
 * the template, content, a write deploy key, a super-user, and a public URL
 * under the *.demo.misterchameleon.nl wildcard.
 *
 * Two modes, because "demo" used to mean a blank canvas — which made the button
 * misleading:
 *
 *   Demo — a curated, brand-free Dutch example site: every block type, filled
 *          collections, adaptive slots that actually switch. Presentable as-is.
 *   Leeg — the neutral starter: a couple of blank pages to build on.
 *
 * The credentials come back exactly once — the password is generated during the
 * rollout and stored only as a Ploi secret, which the admin cannot read back —
 * so this card is where the operator copies them from. It is rendered on the
 * tenants index, since the rollout CREATES a tenant rather than acting on one.
 */

import { useState, useTransition } from "react";
import { provisionTenantSiteAction, type RolloutResult, type RolloutMode } from "@/app/admin/tenants/[tenantId]/actions";

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="w-28 shrink-0 text-neutral-500">{label}</span>
      <span className={`min-w-0 flex-1 break-all ${mono ? "font-mono" : ""}`}>{value}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
            () => { /* clipboard blocked — the value is on screen anyway */ },
          );
        }}
        className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const MODES: { value: RolloutMode; label: string; hint: string }[] = [
  { value: "demo",    label: "Demo", hint: "Voorbeeldsite met alle blokken, gevulde collecties en werkende personalisatie." },
  { value: "vanilla", label: "Leeg", hint: "Neutrale startpagina's om zelf op te bouwen." },
];

export function StatamicRolloutCard() {
  const [pending, start] = useTransition();
  const [name, setName]  = useState("");
  const [mode, setMode]  = useState<RolloutMode>("demo");
  const [result, setResult] = useState<RolloutResult | null>(null);

  function run() {
    setResult(null);
    start(async () => setResult(await provisionTenantSiteAction(name, { mode })));
  }

  const done = result?.ok === true;

  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Nieuwe Statamic-site</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Creates the tenant, its repo from the template, content, a write deploy key,
        a CP login and a public URL at{" "}
        <code className="font-mono">&lt;slug&gt;.demo.misterchameleon.nl</code>. No DNS per site —
        the wildcard covers it. Takes a couple of minutes while Ploi assigns a host.
      </p>

      <fieldset className="mt-3">
        <legend className="sr-only">Wat de site bevat</legend>
        <div className="flex flex-col gap-1.5">
          {MODES.map((m) => (
            <label key={m.value} className="flex items-start gap-2 text-xs">
              <input
                type="radio"
                name="rollout-mode"
                value={m.value}
                checked={mode === m.value}
                disabled={pending}
                onChange={() => setMode(m.value)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-neutral-800">{m.label}</span>
                <span className="text-neutral-500"> — {m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim() && !pending) run(); }}
          placeholder="Sitenaam, bijv. Acme Corp"
          disabled={pending}
          className="w-64 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm disabled:bg-neutral-50"
        />
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={run}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Bezig…" : "Site uitrollen"}
        </button>
      </div>

      {pending && (
        <p className="mt-2 text-xs text-neutral-500">
          Waiting for Ploi to assign a host — up to two minutes. Leave this tab open.
        </p>
      )}

      {result && !result.ok && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <p>{result.error}</p>
          {result.cpPassword && (
            <p className="mt-1">
              A CP password was already generated: <code className="font-mono">{result.cpPassword}</code>{" "}
              — keep it, it is not stored anywhere readable.
            </p>
          )}
        </div>
      )}

      {done && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${
          result.status === "ready"
            ? "border-green-200 bg-green-50 text-green-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}>
          <p className="font-medium">
            {result.status === "ready"
              ? "Site staat."
              : "Everything is built — Ploi just hasn't assigned a host yet."}
          </p>

          <div className="mt-2 space-y-0.5">
            {result.demoUrl && <CopyRow label="Site" value={result.demoUrl} />}
            {result.cpUrl   && <CopyRow label="Control panel" value={result.cpUrl} />}
            {result.cpEmail && <CopyRow label="CP e-mail" value={result.cpEmail} mono />}
            {result.cpPassword && <CopyRow label="CP password" value={result.cpPassword} mono />}
            {result.repoUrl && <CopyRow label="Repo" value={result.repoUrl} />}
          </div>

          <p className="mt-2 font-medium">
            Copy the password now — it is only ever shown here.
          </p>

          {result.status === "host-pending" && (
            <p className="mt-2">
              Once the host appears in Ploi, open the tenant&apos;s Setup tab and run Finalize with it
              to set <code className="font-mono">statamicBaseUrl</code> and <code className="font-mono">APP_URL</code>.
            </p>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-4">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}

          {result.steps && result.steps.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-neutral-600">Steps</summary>
              <ul className="mt-1 space-y-0.5">
                {result.steps.map((s, i) => (
                  <li key={i}>
                    <span aria-hidden>{s.ok ? "✓" : "!"}</span>{" "}
                    <span className="sr-only">{s.ok ? "ok" : "warning"}</span>
                    {s.label} — <span className="text-neutral-600">{s.note}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
