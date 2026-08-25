/**
 * Admin — Tenant Workspace › Audience › Webhooks
 *
 * One overview of every outbound webhook, across both mechanisms: the
 * lead-qualification webhook (CRM sync, fires on upward qualification) and
 * rule-triggered webhooks (fire on rule match). Independent webhook rules are
 * created/edited here; variant rules that also carry a webhook are shown
 * read-only with a link to the Rules editor. See docs/lead-base-design.md.
 */

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { listOutboundWebhooksAction } from "./actions";
import { getConditionFieldOptions } from "@/lib/webhooks/condition-field-options";
import { WebhookRulesManager } from "./_components/WebhookRulesManager";
import type { WebhookDelivery } from "@/lib/lead-base/webhook-deliveries-store";

export const dynamic = "force-dynamic";

function TypeBadge({ kind }: { kind: "lead" | "rule" }) {
  const cfg = kind === "lead"
    ? { label: "Lead-qualification webhook", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" }
    : { label: "Rule-triggered webhook",     cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
      ok ? "bg-green-50 text-green-700 ring-green-200" : "bg-red-50 text-red-600 ring-red-200"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
      {ok ? "OK" : "Failed"}
    </span>
  );
}

function Url({ url }: { url: string }) {
  return <code className="block max-w-full truncate rounded bg-neutral-100 px-2 py-1 text-xs font-mono text-neutral-700" title={url}>{url}</code>;
}

function DeliveriesTable({ deliveries }: { deliveries: WebhookDelivery[] }) {
  if (deliveries.length === 0) {
    return <p className="mt-3 text-xs text-neutral-400">No deliveries recorded yet.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-500">
            <th className="py-1.5 pr-3 font-medium">When</th>
            <th className="py-1.5 pr-3 font-medium">Event</th>
            <th className="py-1.5 pr-3 font-medium">Status</th>
            <th className="py-1.5 pr-3 font-medium text-right">Code</th>
            <th className="py-1.5 pr-3 font-medium text-right">Attempts</th>
            <th className="py-1.5 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id} className="border-b border-neutral-100">
              <td className="py-1.5 pr-3 whitespace-nowrap text-neutral-600">{new Date(d.createdAt).toLocaleString()}</td>
              <td className="py-1.5 pr-3"><code className="font-mono text-neutral-500">{d.event}</code></td>
              <td className="py-1.5 pr-3"><StatusPill ok={d.ok} /></td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-neutral-600">{d.statusCode ?? "—"}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-neutral-600">{d.attempts}</td>
              <td className="py-1.5 text-neutral-500 max-w-[220px] truncate" title={d.error ?? ""}>{d.error ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function WebhooksOverviewPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { leadQual, ruleWebhooks } = await listOutboundWebhooksAction(tenantId);
  const base = `/admin/tenants/${tenantId}`;

  // Independent webhook rules are edited here; combine rules (variant + inline
  // webhook) are edited in the Rules editor.
  const webhookOnlyRules = ruleWebhooks.filter((w) => w.webhookOnly);
  const combineRules     = ruleWebhooks.filter((w) => !w.webhookOnly);
  const fieldOptions     = getConditionFieldOptions();

  const total = (leadQual.url ? 1 : 0) + ruleWebhooks.length;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <AdminPageHeader
        eyebrow="Audience"
        title="Webhooks"
        description="Every outbound webhook this tenant sends, across both mechanisms. This is a read-only overview; each webhook is edited on its own page (linked below). Nothing here changes how or when a webhook fires."
      />

      {total === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">
          No outbound webhooks are configured yet. Add the lead-qualification webhook under{" "}
          <Link href={`${base}/audience/leads`} className="font-medium text-brand-600 hover:text-brand-800">Leads</Link>, or a
          rule-triggered webhook on a rule under{" "}
          <Link href={`${base}/personalization/rules`} className="font-medium text-brand-600 hover:text-brand-800">Rules</Link>.
        </div>
      )}

      {/* ── Lead-qualification webhook ─────────────────────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <TypeBadge kind="lead" />
            <h2 className="mt-2 text-sm font-semibold text-neutral-900">CRM sync on lead qualification</h2>
            <p className="mt-1 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">Trigger:</span> a visitor&apos;s profile qualifies upward
              (reaches recognised → known/customer, or status mql/sql/customer). One webhook per tenant, HMAC-signed,
              retried up to 3 times.
            </p>
          </div>
          <Link href={`${base}/audience/leads`} className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50">
            Configure in Leads →
          </Link>
        </div>

        <div className="mt-4 grid gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Destination</p>
            {leadQual.url
              ? <div className="mt-1"><Url url={leadQual.url} /></div>
              : <p className="mt-1 text-xs text-neutral-400">Not configured — no webhook is sent.</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Recent deliveries</p>
            <DeliveriesTable deliveries={leadQual.deliveries} />
          </div>
        </div>
      </section>

      {/* ── Independent webhook rules (editable here) ──────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div>
          <TypeBadge kind="rule" />
          <h2 className="mt-2 text-sm font-semibold text-neutral-900">Independent webhook rules</h2>
          <p className="mt-1 text-sm text-neutral-500">
            <span className="font-medium text-neutral-700">Trigger:</span> the condition matches for a (non-bot) visitor.
            Each matching rule fires independently and never affects which variant a visitor sees. Fire-and-forget:
            individual deliveries are not logged here.
          </p>
        </div>
        <div className="mt-4">
          <WebhookRulesManager
            tenantId={tenantId}
            rules={webhookOnlyRules}
            fields={fieldOptions}
            rulesHref={`${base}/personalization/rules`}
          />
        </div>
      </section>

      {/* ── Variant + webhook rules (read-only; edited in Rules) ───────────── */}
      {combineRules.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <TypeBadge kind="rule" />
              <h2 className="mt-2 text-sm font-semibold text-neutral-900">Variant rules that also fire a webhook</h2>
              <p className="mt-1 text-sm text-neutral-500">
                These rules set a personalization variant AND fire a webhook when they win the first-match decision.
                They are edited in the Rules editor.
              </p>
            </div>
            <Link href={`${base}/personalization/rules`} className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50">
              Edit rules →
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
                  <th className="px-3 py-2 font-medium">Rule (trigger)</th>
                  <th className="px-3 py-2 font-medium">Conditions</th>
                  <th className="px-3 py-2 font-medium">Destination</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {combineRules.map((w) => (
                  <tr key={w.ruleId} className="border-b border-neutral-100 last:border-0 align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-neutral-800">{w.label}</p>
                      <p className="text-xs text-neutral-400">Priority {w.priority}</p>
                    </td>
                    <td className="px-3 py-2.5"><code className="text-xs font-mono text-neutral-600">{w.conditionSummary}</code></td>
                    <td className="px-3 py-2.5 max-w-[240px]"><Url url={w.url} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-neutral-500">{w.enabled ? "Enabled" : "Disabled"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
