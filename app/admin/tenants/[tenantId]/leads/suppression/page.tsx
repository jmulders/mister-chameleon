/**
 * Admin — Tenant Workspace › Leads › Suppression
 *
 * The opt-out list: emails that must not be marketed to. Suppressed addresses
 * are excluded from retargeting audiences and removed from the ad platforms.
 * Fed by the suppression webhook (/api/webhooks/suppression) or manually here.
 */

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  listSuppressionsAction,
  addSuppressionAction,
  removeSuppressionAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SuppressionPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const rows   = await listSuppressionsAction(tenantId);
  const add    = addSuppressionAction.bind(null, tenantId);
  const remove = removeSuppressionAction.bind(null, tenantId);

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <AdminPageHeader
        eyebrow="Audience"
        title="Suppressie / opt-outs"
        description="E-mailadressen die niet meer benaderd mogen worden (unsubscribes, opt-outs, ingetrokken toestemming). Ze vallen uit de retargeting-audiences en worden meteen bij de ad-platforms verwijderd. Gevoed door de suppression-webhook of handmatig hieronder."
      />

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <form action={add} className="flex items-end gap-2">
          <label className="flex-1">
            <span className="text-xs font-medium text-neutral-700">E-mailadres onderdrukken</span>
            <input
              name="email"
              type="email"
              required
              placeholder="naam@bedrijf.nl"
              className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </label>
          <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
            Onderdrukken
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Onderdrukte adressen ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-400">Nog geen onderdrukte adressen.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-1.5">E-mail</th>
                <th>Reden</th>
                <th>Bron</th>
                <th>Datum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email} className="border-b border-neutral-100">
                  <td className="py-1.5 font-medium text-neutral-800">{r.email}</td>
                  <td className="text-neutral-500">{r.reason ?? "·"}</td>
                  <td className="text-neutral-500">{r.source ?? "·"}</td>
                  <td className="text-neutral-500">{new Date(r.createdAt).toLocaleDateString("nl-NL")}</td>
                  <td className="text-right">
                    <form action={remove}>
                      <input type="hidden" name="email" value={r.email} />
                      <button type="submit" className="text-xs text-red-700 hover:underline">Opheffen</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
