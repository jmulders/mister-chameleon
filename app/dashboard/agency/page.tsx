/**
 * Dashboard — Agency Management
 *
 * Lists all tenants in this agency, shows quick stats (sessions this month,
 * plan tier), and lets the agency owner add / remove member tenants.
 *
 * Gated behind the multiTenant feature flag (Pro plan).
 */

import { getActiveTenantWithDevOverride } from "@/tenant/server";
import { checkPlanFeature }               from "@/billing/plan-enforcement";
import { Text }                           from "@/components/primitives/Text";
import {
  listAgencyMembers,
  getAgencyMemberStats,
  addAgencyMember,
  removeAgencyMember,
  type AgencyMember,
  type AgencyStats,
} from "./actions";

export const metadata = { title: "Agency · Dashboard" };

// ── Page props ────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString("nl-NL"); }

function planBadgeClass(plan: string): string {
  switch (plan) {
    case "pro":     return "bg-violet-100 text-violet-700";
    case "growth":  return "bg-brand-100 text-brand-700";
    default:        return "bg-neutral-100 text-neutral-500";
  }
}

function planLabel(plan: string): string {
  switch (plan) {
    case "pro":     return "Pro";
    case "growth":  return "Growth";
    case "starter": return "Starter";
    default:        return plan;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AgencyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { tenantConfig, devTenantOverride } = await getActiveTenantWithDevOverride(
    params,
    "dashboard/agency",
  );
  const tenantId = devTenantOverride ?? tenantConfig.tenantId;

  // ── Feature gate ──────────────────────────────────────────────────────────
  const gate = await checkPlanFeature(tenantId, "multiTenant");
  if (!gate.allowed) {
    return (
      <div className="px-8 py-8 max-w-3xl">
        <Text variant="h2" as="h1">Agency</Text>
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-8 py-12 text-center">
          <p className="text-2xl font-bold text-neutral-300 mb-2">🏢</p>
          <p className="font-semibold text-neutral-700">Agency management requires the Pro plan</p>
          <p className="mt-1 text-sm text-neutral-500 max-w-sm mx-auto">
            {gate.reason} Upgrade to Pro to manage multiple client tenants, set
            white-label branding, and view cross-tenant session stats.
          </p>
          <a
            href="/dashboard/tenant"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            View plan options
          </a>
        </div>
      </div>
    );
  }

  // ── Data fetch ────────────────────────────────────────────────────────────
  const membersResult = await listAgencyMembers(tenantId);
  const members: AgencyMember[] = membersResult.ok ? membersResult.data : [];

  const memberIds = members.map((m) => m.member_tenant_id);
  const stats: AgencyStats[] = memberIds.length > 0
    ? await getAgencyMemberStats(memberIds)
    : [];

  const statsMap: Record<string, AgencyStats> = {};
  for (const s of stats) {
    statsMap[s.member_tenant_id] = s;
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalSessions = stats.reduce((sum, s) => sum + s.sessions_this_month, 0);

  return (
    <div className="flex flex-col gap-6 px-8 py-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Text variant="h2" as="h1">Agency</Text>
          <p className="mt-1 text-sm text-neutral-500">
            Manage client tenants for{" "}
            <span className="font-medium text-neutral-700">{tenantConfig.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/agency/branding"
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
          >
            White-label branding →
          </a>
        </div>
      </div>

      {devTenantOverride && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Dev override active: <code className="font-mono">{devTenantOverride}</code>
        </div>
      )}

      {membersResult.ok === false && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Failed to load agency members: {membersResult.error}
        </div>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Member tenants",      value: String(members.length) },
          { label: "Sessions this month", value: fmtNum(totalSessions) },
          {
            label: "Owner tenants",
            value: String(members.filter((m) => m.role === "owner").length),
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Member list ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Member tenants</h2>
          <span className="text-xs text-neutral-400">{members.length} tenant{members.length !== 1 ? "s" : ""}</span>
        </div>

        {members.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">
            No member tenants yet. Add a client tenant below to get started.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3 text-right">Sessions / mo</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Added</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const s = statsMap[m.member_tenant_id];
                return (
                  <tr
                    key={m.id}
                    className={`border-b border-neutral-50 ${i % 2 === 0 ? "" : "bg-neutral-50/40"}`}
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-neutral-900">
                        {m.tenant_name ?? <span className="text-neutral-400 italic">Unknown</span>}
                      </div>
                      {m.tenant_domain && (
                        <div className="text-xs text-neutral-400 font-mono">{m.tenant_domain}</div>
                      )}
                      <div className="text-[10px] text-neutral-300 font-mono mt-0.5">{m.member_tenant_id}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.role === "owner"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-neutral-900">
                      {s ? fmtNum(s.sessions_this_month) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {s ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${planBadgeClass(s.plan_name)}`}>
                          {planLabel(s.plan_name)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-neutral-400 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                      {m.invite_note && (
                        <div className="text-neutral-300 mt-0.5 max-w-[160px] truncate" title={m.invite_note}>
                          {m.invite_note}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/admin/tenants/${m.member_tenant_id}`}
                          className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          Manage
                        </a>
                        <RemoveMemberButton
                          agencyTenantId={tenantId}
                          membershipId={m.id}
                          tenantName={m.tenant_name ?? m.member_tenant_id}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add member form ───────────────────────────────────────────────── */}
      <AddMemberForm agencyTenantId={tenantId} />

    </div>
  );
}

// ── AddMemberForm (server action form) ────────────────────────────────────────

async function AddMemberForm({ agencyTenantId }: { agencyTenantId: string }) {
  async function handleAdd(formData: FormData) {
    "use server";
    const memberTenantId = (formData.get("memberTenantId") as string).trim();
    const role = (formData.get("role") as "owner" | "viewer") ?? "viewer";
    const note = (formData.get("note") as string | null) ?? undefined;

    await addAgencyMember(agencyTenantId, memberTenantId, role, agencyTenantId, note || undefined);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900 mb-1">Add member tenant</h2>
      <p className="text-xs text-neutral-500 mb-4">
        Enter the tenant ID of the client you want to manage through this agency account.
      </p>
      <form action={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1" htmlFor="memberTenantId">
            Tenant ID
          </label>
          <input
            id="memberTenantId"
            name="memberTenantId"
            type="text"
            required
            placeholder="tenant_xxxxxxxxxxxxxxxx"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono text-neutral-900 placeholder:text-neutral-300 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-neutral-600 mb-1" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            <option value="viewer">Viewer</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-neutral-600 mb-1" htmlFor="note">
            Note <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            id="note"
            name="note"
            type="text"
            placeholder="e.g. ACME Corp Q2 campaign"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        <div className="shrink-0">
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Add tenant
          </button>
        </div>
      </form>
    </div>
  );
}

// ── RemoveMemberButton (server action form) ───────────────────────────────────

function RemoveMemberButton({
  agencyTenantId,
  membershipId,
  tenantName,
}: {
  agencyTenantId: string;
  membershipId: string;
  tenantName: string;
}) {
  async function handleRemove() {
    "use server";
    await removeAgencyMember(agencyTenantId, membershipId);
  }

  return (
    <form action={handleRemove}>
      <button
        type="submit"
        className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
        title={`Remove ${tenantName} from agency`}
      >
        Remove
      </button>
    </form>
  );
}
