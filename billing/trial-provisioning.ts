/**
 * From a pending signup to a tenant on trial.
 *
 * Someone fills in the trial form: name, email, company, a password. Nothing
 * is created yet. The form's data waits in `pending_trial_signups` until the
 * payment provider confirms the payment method. Then this file creates the
 * admin user and the tenant, binds them, and sends the welcome mails.
 *
 * It was written inline in the Stripe webhook. Mollie needs the same steps,
 * so they live here and both providers call them. What stays with each
 * provider is its own record of the subscription, written between the two
 * halves:
 *
 *   provisionTrialTenant()   pending row → admin user + tenant
 *   (the provider stores its subscription for the new tenant)
 *   completeTrialSignup()    pending row marked completed, mails sent
 *
 * The order, the rollback on a half-made tenant and the wording of the logs
 * are those of the original, with one repair: binding the user to the tenant
 * (see provisionTrialTenant).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_FROM } from "@/lib/platform-contact";
import { resolveRequestBaseUrl } from "@/lib/base-url";

/** A trial lasts this long, whichever provider confirmed it. */
export const TRIAL_DAYS = 14;

export interface ProvisionedTrial {
  tenantId:    string;
  userId:      string;
  name:        string;
  email:       string;
  company:     string;
  planId:      string;
  /** "Starter", "Growth", "Pro": the plan id with a capital. */
  planLabel:   string;
  /** ISO timestamp of the provisioning. */
  now:         string;
  /** ISO timestamp, `now` plus TRIAL_DAYS. */
  trialEndsAt: string;
}

export type ProvisionFailure =
  | "trial_signup_pending_not_found"
  | "trial_signup_user_create_failed"
  | "trial_signup_tenant_create_failed"
  | "trial_signup_binding_failed";

export type ProvisionResult =
  | { ok: true;  trial: ProvisionedTrial }
  | { ok: false; action: ProvisionFailure };

export function slugifyTenant(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tenant";
}

async function uniqueSlug(client: SupabaseClient, base: string): Promise<string> {
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slugifyTenant(base) : `${slugifyTenant(base)}-${attempt}`;
    const { data } = await client.from("tenant_settings").select("tenant_id").eq("tenant_id", candidate).maybeSingle();
    if (!data) return candidate;
    attempt++;
    if (attempt > 99) return `${slugifyTenant(base)}-${Date.now()}`;
  }
}

/**
 * Create the admin user and the tenant of a pending signup.
 *
 * Only a row that is still `pending` is used, so a signup is provisioned
 * once. On a failure halfway the user that was just made is removed again
 * and the row is marked failed.
 *
 * @param logTag  The caller's log prefix, "[stripe-webhook]" or "[mollie]".
 */
export async function provisionTrialTenant(
  client:    SupabaseClient,
  pendingId: string,
  logTag:    string,
): Promise<ProvisionResult> {
  // Fetch the pending signup row
  const { data: pending, error: fetchErr } = await client
    .from("pending_trial_signups")
    .select("*")
    .eq("id", pendingId)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchErr || !pending) {
    console.error(`${logTag} trial_signup: pending row not found or already processed`, pendingId);
    return { ok: false, action: "trial_signup_pending_not_found" };
  }

  const { name, email, company, password_hash, plan_id } = pending as {
    name: string; email: string; company: string; password_hash: string; plan_id: string;
  };

  // Derive a unique tenant slug
  const tenantId = await uniqueSlug(client, company);

  const now          = new Date().toISOString();
  const trialEndsAt  = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const planLabel    = plan_id.charAt(0).toUpperCase() + plan_id.slice(1);

  // Create admin_user
  const { data: newUser, error: userErr } = await client
    .from("admin_users")
    .insert({ email, password_hash, name, role: "tenant_admin", is_active: true, created_at: now, updated_at: now })
    .select("id")
    .single();

  if (userErr || !newUser?.id) {
    console.error(`${logTag} trial_signup: admin_users insert failed`, userErr?.message);
    await client.from("pending_trial_signups").update({ status: "failed" }).eq("id", pendingId);
    return { ok: false, action: "trial_signup_user_create_failed" };
  }

  const userId = newUser.id as string;

  // Create tenant_settings
  const { error: tenantErr } = await client
    .from("tenant_settings")
    .insert({
      id:         tenantId,
      tenant_id:  tenantId,
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
    console.error(`${logTag} trial_signup: tenant_settings insert failed`, tenantErr.message);
    await client.from("admin_users").delete().eq("id", userId);
    await client.from("pending_trial_signups").update({ status: "failed" }).eq("id", pendingId);
    return { ok: false, action: "trial_signup_tenant_create_failed" };
  }

  // Bind user to tenant
  //
  // The table's timestamp column is `assigned_at`, filled by its default. The
  // insert used to name a `created_at` that does not exist, was refused, and
  // nobody looked at the answer: the user and the tenant were made and the
  // user could not open the tenant. The answer is read now, and a tenant
  // without its user is undone like any other half-made signup.
  const { error: bindErr } = await client
    .from("admin_user_tenants")
    .insert({ user_id: userId, tenant_id: tenantId });

  if (bindErr) {
    console.error(`${logTag} trial_signup: admin_user_tenants insert failed`, bindErr.message);
    await client.from("tenant_settings").delete().eq("tenant_id", tenantId);
    await client.from("admin_users").delete().eq("id", userId);
    await client.from("pending_trial_signups").update({ status: "failed" }).eq("id", pendingId);
    return { ok: false, action: "trial_signup_binding_failed" };
  }

  return {
    ok: true,
    trial: { tenantId, userId, name, email, company, planId: plan_id, planLabel, now, trialEndsAt },
  };
}

/**
 * Mark the pending signup completed and send the welcome mail and the
 * notification to the back office. The mails are best effort: a tenant that
 * exists is not undone because a mail could not be sent.
 *
 * @param source  Shown in the back-office subject: which provider confirmed it.
 */
export async function completeTrialSignup(
  client:    SupabaseClient,
  pendingId: string,
  trial:     ProvisionedTrial,
  source:    "Stripe" | "Mollie",
  logTag:    string,
): Promise<void> {
  const { tenantId, name, email, company, planLabel, now, trialEndsAt } = trial;

  // Mark pending row as completed
  await client
    .from("pending_trial_signups")
    .update({ status: "completed", completed_at: now })
    .eq("id", pendingId);

  // Fire welcome + admin notification emails (best-effort)
  try {
    const { sendMail, resolveTransportConfig }  = await import("@/forms/mail-transport");
    const { serverEnv }                          = await import("@/lib/env");
    const { getPlatformEmailSettings }           = await import("@/platform/platform-store");
    const platformEmailResult                    = await getPlatformEmailSettings();
    const platformEmailConfig                    = platformEmailResult.ok ? platformEmailResult.data : null;
    const transport                              = resolveTransportConfig(null, platformEmailConfig);
    const adminBaseUrl   = await resolveRequestBaseUrl();
    const fromAddress    = serverEnv.email.fromAddress ?? PLATFORM_FROM;
    const adminAddress   = serverEnv.email.backofficeEmail;
    const trialEndDate   = new Date(trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const welcomeResult = await sendMail({
      from: fromAddress, to: [email],
      subject: `Welcome to Mister Chameleon — your ${planLabel} trial has started`,
      text: `Hi ${name},\n\nYour ${planLabel} trial is active until ${trialEndDate}.\n\nLog in: ${adminBaseUrl}/admin\n\nThe Mister Chameleon team`,
      html: `<p>Hi ${name},</p><p>Your <strong>${planLabel} trial</strong> is active until <strong>${trialEndDate}</strong>.</p><p><a href="${adminBaseUrl}/admin" style="background:#4f46e5;color:white;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;display:inline-block;">Go to your dashboard</a></p>`,
    }, transport);
    if (!welcomeResult.ok) {
      console.warn(`${logTag} trial_signup: welcome email failed:`, welcomeResult.error);
    } else {
      console.info(`${logTag} trial_signup: welcome email sent to ${email}`);
    }

    if (adminAddress) {
      const adminResult = await sendMail({
        from: fromAddress, to: [adminAddress],
        subject: `New trial signup (${source}): ${name} (${planLabel})`,
        text: `Name: ${name}\nEmail: ${email}\nCompany: ${company}\nPlan: ${planLabel}\nTenant: ${tenantId}\nTrial ends: ${trialEndDate}`,
      }, transport);
      if (!adminResult.ok) {
        console.warn(`${logTag} trial_signup: admin notification email failed:`, adminResult.error);
      }
    }
  } catch (emailErr) {
    console.warn(`${logTag} trial_signup: email send failed`, emailErr);
  }
}
