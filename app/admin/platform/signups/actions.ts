"use server";

import { rethrowNextInternal } from "@/lib/server-action-guard";

/**
 * app/admin/platform/signups/actions.ts
 *
 * Server actions for the Pending Signups admin page.
 *
 * processSignupAction  — manually processes a pending_trial_signups row,
 *                        creating the tenant + user without needing Stripe
 *                        to replay the webhook event.
 *
 * retryEmailAction     — re-sends the welcome email for a completed signup.
 */

import { createClient }            from "@supabase/supabase-js";
import { revalidatePath }          from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tenant";
}

async function uniqueSlug(client: ReturnType<typeof makeClient>, base: string): Promise<string> {
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slugify(base) : `${slugify(base)}-${attempt}`;
    const { data } = await client.from("tenant_settings").select("tenant_id").eq("tenant_id", candidate).maybeSingle();
    if (!data) return candidate;
    attempt++;
    if (attempt > 99) return `${slugify(base)}-${Date.now()}`;
  }
}

export async function processSignupAction(
  pendingId: string,
): Promise<{ ok: true; tenantId: string } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const client = makeClient();

  // 1. Fetch the pending row
  const { data: pending, error: fetchErr } = await client
    .from("pending_trial_signups")
    .select("*")
    .eq("id", pendingId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchErr || !pending) {
    return { ok: false, error: "Pending signup not found or already processed." };
  }

  const { name, email, company, password_hash, plan_id } = pending as {
    name: string; email: string; company: string;
    password_hash: string; plan_id: string;
  };

  const now         = new Date().toISOString();
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const planLabel   = plan_id.charAt(0).toUpperCase() + plan_id.slice(1);
  const tenantId    = await uniqueSlug(client, company);

  // 2. Create admin_user
  const { data: newUser, error: userErr } = await client
    .from("admin_users")
    .insert({ email, password_hash, name, role: "tenant_admin", is_active: true, created_at: now, updated_at: now })
    .select("id")
    .single();

  if (userErr || !newUser?.id) {
    return { ok: false, error: `Failed to create user: ${userErr?.message ?? "unknown error"}` };
  }

  const userId = newUser.id as string;

  // 3. Create tenant_settings
  const { error: tenantErr } = await client
    .from("tenant_settings")
    .insert({
      id:        tenantId,
      tenant_id: tenantId,
      settings: {
        tenantId,
        name:       company,
        packageKey: plan_id,
        features:   { experiments: true, ai: plan_id !== "starter", analytics: true },
        ai:         { mode: "disabled" },
        cms:        { provider: "sanity", projectId: "", dataset: "production" },
        design:     { theme: "default" },
        trial:      { active: true, startedAt: now, endsAt: trialEndsAt },
      },
      updated_at: now,
    });

  if (tenantErr) {
    await client.from("admin_users").delete().eq("id", userId);
    return { ok: false, error: `Failed to create tenant: ${tenantErr.message}` };
  }

  // 4. Bind user to tenant
  await client.from("admin_user_tenants").insert({ user_id: userId, tenant_id: tenantId, created_at: now });

  // 5. Create subscription row
  await client.from("subscriptions").upsert({
    tenant_id:            tenantId,
    plan:                 plan_id,
    status:               "trialing",
    billing_cycle:        "monthly",
    current_period_start: now,
    current_period_end:   trialEndsAt,
  }, { onConflict: "tenant_id" });

  // 6. Mark pending row as completed
  await client
    .from("pending_trial_signups")
    .update({ status: "completed", completed_at: now })
    .eq("id", pendingId);

  // 7. Send welcome email (best-effort)
  try {
    const { sendMail, resolveTransportConfig } = await import("@/forms/mail-transport");
    const { serverEnv }                        = await import("@/lib/env");
    const { getPlatformEmailSettings }         = await import("@/platform/platform-store");
    const platformEmailResult                  = await getPlatformEmailSettings();
    const platformEmailConfig                  = platformEmailResult.ok ? platformEmailResult.data : null;
    const transport                            = resolveTransportConfig(null, platformEmailConfig);
    const fromAddress  = serverEnv.email.fromAddress ?? "Mister Chameleon <hello@mister-chameleon.com>";
    const trialEndDate = new Date(trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    await sendMail({
      from:    fromAddress,
      to:      [email],
      subject: `Welcome to Mister Chameleon — your ${planLabel} trial has started`,
      text:    `Hi ${name},\n\nYour ${planLabel} trial is active until ${trialEndDate}.\n\nLog in: https://mister-chameleon.com/admin\n\nThe Mister Chameleon team`,
      html:    `<p>Hi ${name},</p><p>Your <strong>${planLabel} trial</strong> is active until <strong>${trialEndDate}</strong>.</p><p><a href="https://mister-chameleon.com/admin" style="background:#4f46e5;color:white;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;display:inline-block;">Go to your dashboard</a></p>`,
    }, transport);
  } catch {
    // Non-fatal — tenant is created regardless
  }

  revalidatePath("/admin/platform/signups");
  return { ok: true, tenantId };
}

export async function retryEmailAction(
  pendingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const client = makeClient();

  const { data: pending } = await client
    .from("pending_trial_signups")
    .select("name, email, plan_id, completed_at")
    .eq("id", pendingId)
    .maybeSingle();

  if (!pending) return { ok: false, error: "Signup not found." };

  const { name, email, plan_id } = pending as { name: string; email: string; plan_id: string; completed_at: string };
  const planLabel   = plan_id.charAt(0).toUpperCase() + plan_id.slice(1);

  try {
    const { sendMail, resolveTransportConfig } = await import("@/forms/mail-transport");
    const { serverEnv }                        = await import("@/lib/env");
    const { getPlatformEmailSettings }         = await import("@/platform/platform-store");
    const platformEmailResult                  = await getPlatformEmailSettings();
    const platformEmailConfig                  = platformEmailResult.ok ? platformEmailResult.data : null;
    const transport                            = resolveTransportConfig(null, platformEmailConfig);
    const fromAddress = serverEnv.email.fromAddress ?? "Mister Chameleon <hello@mister-chameleon.com>";

    const result = await sendMail({
      from:    fromAddress,
      to:      [email],
      subject: `Welcome to Mister Chameleon — your ${planLabel} trial has started`,
      text:    `Hi ${name},\n\nYour account is ready.\n\nLog in: https://mister-chameleon.com/admin\n\nThe Mister Chameleon team`,
      html:    `<p>Hi ${name},</p><p>Your <strong>${planLabel}</strong> account is ready.</p><p><a href="https://mister-chameleon.com/admin" style="background:#4f46e5;color:white;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;display:inline-block;">Go to your dashboard</a></p>`,
    }, transport);

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  } catch (err) {
    rethrowNextInternal(err);
    return { ok: false, error: (err as Error).message };
  }
}

export async function dismissSignupAction(
  pendingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const client = makeClient();
  const { error } = await client
    .from("pending_trial_signups")
    .update({ status: "dismissed" })
    .eq("id", pendingId)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/platform/signups");
  return { ok: true };
}
