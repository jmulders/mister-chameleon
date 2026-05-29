"use server";

/**
 * app/dashboard/agency/actions.ts
 *
 * Server actions for the white-label agency management dashboard.
 * Requires the multiTenant feature flag (Pro plan).
 */

import { createClient }    from "@supabase/supabase-js";
import { revalidatePath }  from "next/cache";

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AgencyMember {
  id:               string;
  member_tenant_id: string;
  role:             "owner" | "viewer";
  invited_by:       string | null;
  invite_note:      string | null;
  created_at:       string;
  // Enriched from tenants table:
  tenant_name?:     string;
  tenant_domain?:   string;
}

export interface AgencyBranding {
  agency_name:    string | null;
  logo_url:       string | null;
  favicon_url:    string | null;
  primary_color:  string;
  custom_domain:  string | null;
  domain_verified:boolean;
  support_email:  string | null;
  footer_text:    string | null;
}

export interface AgencyStats {
  member_tenant_id: string;
  sessions_this_month: number;
  plan_name: string;
}

// ── listAgencyMembers ──────────────────────────────────────────────────────────

export async function listAgencyMembers(
  agencyTenantId: string,
): Promise<{ ok: true; data: AgencyMember[] } | { ok: false; error: string }> {
  const db = makeClient();
  try {
    const { data, error } = await db
      .from("agency_memberships")
      .select("id, member_tenant_id, role, invited_by, invite_note, created_at")
      .eq("agency_tenant_id", agencyTenantId)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: error.message };

    // Enrich with tenant name/domain from tenants table
    const memberIds = (data ?? []).map((m: { member_tenant_id: string }) => m.member_tenant_id);
    const tenantMeta: Record<string, { name?: string; domain?: string }> = {};

    if (memberIds.length > 0) {
      const { data: tenants } = await db
        .from("tenants")
        .select("id, name, domain")
        .in("id", memberIds);

      for (const t of tenants ?? []) {
        tenantMeta[t.id] = { name: t.name, domain: t.domain };
      }
    }

    const members: AgencyMember[] = (data ?? []).map((m: AgencyMember) => ({
      ...m,
      tenant_name:   tenantMeta[m.member_tenant_id]?.name,
      tenant_domain: tenantMeta[m.member_tenant_id]?.domain,
    }));

    return { ok: true, data: members };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ── addAgencyMember ────────────────────────────────────────────────────────────

export async function addAgencyMember(
  agencyTenantId: string,
  memberTenantId: string,
  role: "owner" | "viewer",
  invitedBy: string,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!memberTenantId.trim()) return { ok: false, error: "Tenant ID is required." };
  if (memberTenantId === agencyTenantId) return { ok: false, error: "Cannot add your own tenant as a member." };

  const db = makeClient();

  // Verify the target tenant exists
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("id", memberTenantId)
    .maybeSingle();

  if (!tenant) return { ok: false, error: `Tenant "${memberTenantId}" not found.` };

  const { error } = await db.from("agency_memberships").insert({
    agency_tenant_id: agencyTenantId,
    member_tenant_id: memberTenantId,
    role,
    invited_by: invitedBy,
    invite_note: note ?? null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "This tenant is already a member of your agency." };
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/agency");
  return { ok: true };
}

// ── removeAgencyMember ─────────────────────────────────────────────────────────

export async function removeAgencyMember(
  agencyTenantId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = makeClient();
  const { error } = await db
    .from("agency_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("agency_tenant_id", agencyTenantId); // ensure ownership

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/agency");
  return { ok: true };
}

// ── getAgencyBranding ──────────────────────────────────────────────────────────

export async function getAgencyBranding(
  tenantId: string,
): Promise<AgencyBranding> {
  const db = makeClient();
  const defaults: AgencyBranding = {
    agency_name: null, logo_url: null, favicon_url: null,
    primary_color: "#006BA6", custom_domain: null,
    domain_verified: false, support_email: null, footer_text: null,
  };
  try {
    const { data } = await db
      .from("agency_branding")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return defaults;
    return { ...defaults, ...data } as AgencyBranding;
  } catch {
    return defaults;
  }
}

// ── saveAgencyBranding ─────────────────────────────────────────────────────────

export async function saveAgencyBranding(
  tenantId: string,
  branding: Partial<AgencyBranding>,
): Promise<{ ok: boolean; error?: string }> {
  const db = makeClient();
  const { error } = await db
    .from("agency_branding")
    .upsert({ tenant_id: tenantId, ...branding, updated_at: new Date().toISOString() }, {
      onConflict: "tenant_id",
    });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/agency/branding");
  return { ok: true };
}

// ── getAgencyMemberStats ───────────────────────────────────────────────────────

export async function getAgencyMemberStats(
  memberTenantIds: string[],
): Promise<AgencyStats[]> {
  if (memberTenantIds.length === 0) return [];
  const db = makeClient();

  const monthKey = new Date().toISOString().slice(0, 7);

  try {
    // Session counts for this month across all member tenants
    const { data: sessions } = await db
      .from("personalization_sessions")
      .select("tenant_id")
      .in("tenant_id", memberTenantIds)
      .eq("month_key", monthKey);

    const counts: Record<string, number> = {};
    for (const row of sessions ?? []) {
      counts[row.tenant_id] = (counts[row.tenant_id] ?? 0) + 1;
    }

    // Plan names
    const { data: subs } = await db
      .from("subscriptions")
      .select("tenant_id, plan")
      .in("tenant_id", memberTenantIds)
      .neq("status", "canceled");

    const plans: Record<string, string> = {};
    for (const sub of subs ?? []) {
      plans[sub.tenant_id] = sub.plan;
    }

    return memberTenantIds.map((id) => ({
      member_tenant_id:    id,
      sessions_this_month: counts[id] ?? 0,
      plan_name:           plans[id] ?? "starter",
    }));
  } catch {
    return memberTenantIds.map((id) => ({
      member_tenant_id: id, sessions_this_month: 0, plan_name: "starter",
    }));
  }
}
