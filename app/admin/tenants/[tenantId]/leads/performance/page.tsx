/**
 * Admin — Tenant Workspace › Leads › Personalization performance
 *
 * Does personalization actually convert better? Conversion rate (form submissions)
 * of personalized vs baseline visitors, and per audience segment. See
 * docs/lead-base-design.md.
 */

import Link from "next/link";
import { getPersonalizationPerformanceAction, getChannelAttributionAction } from "../actions";
import { listAudienceSegmentsAction }          from "@/app/admin/tenants/[tenantId]/audience-segments/actions";
import { PersonalizationReport }               from "../_components/PersonalizationReport";

export const dynamic = "force-dynamic";

const CHANNEL_LABELS: Record<string, string> = {
  paid_search:    "Paid search",
  paid_social:    "Paid social",
  organic_search: "Organic search",
  social:         "Social",
  email:          "E-mail",
  referral:       "Referral",
  affiliate:      "Affiliate",
  display:        "Display",
  direct:         "Direct",
  other:          "Overig",
};

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [perf, segmentsResult, channels] = await Promise.all([
    getPersonalizationPerformanceAction(tenantId),
    listAudienceSegmentsAction(tenantId),
    getChannelAttributionAction(tenantId),
  ]);

  const segmentLabels: Record<string, string> = {};
  if (segmentsResult.ok) for (const s of segmentsResult.data) segmentLabels[s.key] = s.label;

  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div>
        <Link href={`/admin/tenants/${tenantId}/leads`} className="text-xs text-neutral-500 hover:text-neutral-800">
          ← Leads
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">Personalization performance</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Does adaptive content convert? Conversion rate (form submissions) for personalized
          visitors (matched a segment) vs baseline, and per segment. A randomized holdout for
          true causal lift is a planned next step.
        </p>
      </div>

      <PersonalizationReport perf={perf} segmentLabels={segmentLabels} />

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Kanaal-attributie</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Waar komen je leads vandaan? First-touch kanaal per bezoeker: bezoekers, leads
          (herkend/known) en conversies (formulier-inzending). Kanaal wordt vastgelegd bij het
          eerste bezoek uit UTM/verwijzer.
        </p>

        {channels.length === 0 ? (
          <p className="mt-4 text-xs text-neutral-400">Nog geen data. Zodra bezoekers binnenkomen verschijnt de verdeling hier.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-2">Kanaal</th>
                <th className="py-2 text-right">Bezoekers</th>
                <th className="py-2 text-right">Leads</th>
                <th className="py-2 text-right">Conversies</th>
                <th className="py-2 text-right">Lead-rate</th>
                <th className="py-2 text-right">Conv-rate</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => {
                const leadRate = c.visitors > 0 ? (c.leads / c.visitors) * 100 : 0;
                const convRate = c.visitors > 0 ? (c.conversions / c.visitors) * 100 : 0;
                return (
                  <tr key={c.channel} className="border-b border-neutral-100">
                    <td className="py-2 font-medium text-neutral-800">{CHANNEL_LABELS[c.channel] ?? c.channel}</td>
                    <td className="py-2 text-right tabular-nums">{c.visitors}</td>
                    <td className="py-2 text-right tabular-nums">{c.leads}</td>
                    <td className="py-2 text-right tabular-nums">{c.conversions}</td>
                    <td className="py-2 text-right tabular-nums text-neutral-500">{leadRate.toFixed(1)}%</td>
                    <td className="py-2 text-right tabular-nums text-neutral-500">{convRate.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
