/**
 * POST /api/trial/start
 *
 * Public endpoint — creates a new admin user and tenant for a free trial signup.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     name:      string;    // Full name
 *     email:     string;    // Work email — becomes the login
 *     company:   string;    // Company / organisation name
 *     password:  string;    // Must pass strength validation
 *     planId?:   string;    // "starter" | "growth" | "pro" (default: "starter")
 *   }
 *
 * ─── Response (success, 201) ─────────────────────────────────────────────────
 *
 *   { tenantId: string }
 *
 * ─── Response (error, 4xx / 5xx) ─────────────────────────────────────────────
 *
 *   { error: string }
 *
 * ─── Flow ────────────────────────────────────────────────────────────────────
 *
 *   1. Validate inputs (password strength, email format)
 *   2. Check that the email address is not already registered
 *   3. Hash the password with bcrypt (12 rounds)
 *   4. Create a row in admin_users (role = "tenant-admin")
 *   5. Derive a unique tenant slug from the company name
 *   6. Create a row in tenant_settings (blank JSON settings + planId metadata)
 *   7. Create a row in admin_user_tenants to bind user ↔ tenant
 *   8. Return 201 with { tenantId }
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   - No auth required (public sign-up route)
 *   - Rate-limited upstream by the middleware
 *   - Password hashed with bcrypt (12 rounds) before any DB write
 *   - Email uniqueness check is atomic-enough for the current scale
 *   - Never logs the plaintext password or hash
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb }                     from "@/data/db";
import { hashPassword, validatePasswordStrength } from "@/lib/admin-auth/password";
import { findAdminUserByEmailForLogin } from "@/data/admin-auth";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import { serverEnv } from "@/lib/env";
import { headers } from "next/headers";
import { getActiveTenant } from "@/tenant/server";
import { resolveSession } from "@/data/session";
import { reportInboundConversion } from "@/lib/lead-base/report-inbound-conversion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts an arbitrary string to a URL-safe slug. */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Returns a slug that does not already exist in tenant_settings. */
async function uniqueTenantSlug(base: string): Promise<string> {
  const db   = getDb();
  const slug = slugify(base) || "tenant";
  let   attempt = 0;

  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
      .from("tenant_settings")
      .select("tenant_id")
      .eq("tenant_id", candidate)
      .maybeSingle();

    if (!data) return candidate; // slug is free
    attempt++;
    if (attempt > 99) return `${slug}-${Date.now()}`; // safety valve
  }
}

/** Basic email format check (RFC 5322 simplified). */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Parse body ────────────────────────────────────────────────────────────

  let body: { name?: string; email?: string; company?: string; password?: string; planId?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name     = (body.name    ?? "").trim();
  const email    = (body.email   ?? "").trim().toLowerCase();
  const company  = (body.company ?? "").trim();
  const password = body.password ?? "";
  const planId   = (body.planId ?? "starter").toLowerCase();

  // ── 2. Validate inputs ───────────────────────────────────────────────────────

  if (!name) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (!company) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (!["starter", "growth", "pro"].includes(planId)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  // ── 3. Check email uniqueness ────────────────────────────────────────────────

  try {
    const existing = await findAdminUserByEmailForLogin(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in instead." },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error("[trial/start] email lookup error:", err);
    return NextResponse.json({ error: "Database error. Please try again." }, { status: 500 });
  }

  // ── 4. Hash password ─────────────────────────────────────────────────────────

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    console.error("[trial/start] bcrypt error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }

  // ── 5. Create admin user ─────────────────────────────────────────────────────

  const db = getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newUser, error: userError } = await (db as any)
    .from("admin_users")
    .insert({
      email:         email,
      password_hash: passwordHash,
      name:          name,
      role:          "tenant_admin",
      is_active:     true,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .select("id")
    .single();

  if (userError || !newUser?.id) {
    console.error("[trial/start] admin_users insert error:", userError?.message);
    // Catch duplicate email at DB level in case of race condition
    if (userError?.message?.includes("unique") || userError?.code === "23505") {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }

  const userId = newUser.id as string;

  // ── 6. Create tenant ─────────────────────────────────────────────────────────

  let tenantId: string;
  try {
    tenantId = await uniqueTenantSlug(company);
  } catch (err) {
    console.error("[trial/start] slug generation error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }

  const trialStartedAt = new Date().toISOString();
  const trialEndsAt    = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tenantError } = await (db as any)
    .from("tenant_settings")
    .insert({
      id:         tenantId,
      tenant_id:  tenantId,
      settings:   {
        tenantId,
        name:       company,
        packageKey: planId,
        features: {
          experiments: true,
          ai:          planId !== "starter",
          analytics:   true,
        },
        ai:  { mode: "disabled" },
        cms: { provider: "sanity", projectId: "", dataset: "production" },
        design: { theme: "default" },
        trial: {
          active:    true,
          startedAt: trialStartedAt,
          endsAt:    trialEndsAt,
        },
      },
      updated_at: trialStartedAt,
    });

  if (tenantError) {
    console.error("[trial/start] tenant_settings insert error:", tenantError.message);
    // Best-effort cleanup of the orphaned admin_users row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("admin_users").delete().eq("id", userId);
    return NextResponse.json({ error: "Failed to create tenant. Please try again." }, { status: 500 });
  }

  // ── 7. Bind user to tenant ───────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: assignError } = await (db as any)
    .from("admin_user_tenants")
    .insert({
      user_id:    userId,
      tenant_id:  tenantId,
      created_at: trialStartedAt,
    });

  if (assignError) {
    // Non-fatal — the tenant and user exist, the assignment just failed.
    // Log it for manual remediation rather than rolling back.
    console.error("[trial/start] admin_user_tenants insert error:", assignError.message);
  }

  // ── 7b. Create subscription row ─────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: subError } = await (db as any)
    .from("subscriptions")
    .insert({
      tenant_id:            tenantId,
      plan:                 planId,
      status:               "trialing",
      billing_cycle:        "monthly",
      current_period_start: trialStartedAt,
      current_period_end:   trialEndsAt,
      trial_end:            trialEndsAt,
    });

  if (subError) {
    // Non-fatal — the tenant exists. Log for manual remediation.
    console.error("[trial/start] subscriptions insert error:", subError.message);
  }

  // ── 8. Send emails (non-blocking — never fails the request) ─────────────────

  console.info(`[trial/start] New trial: user=${userId} tenant=${tenantId} plan=${planId}`);

  const transport    = resolveTransportConfig();
  const fromAddress  = serverEnv.email.fromAddress ?? "Mister Chameleon <hello@mister-chameleon.com>";
  const adminAddress = serverEnv.email.backofficeEmail;
  const planLabel    = planId.charAt(0).toUpperCase() + planId.slice(1);
  const trialEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // Welcome email to the new user
  void sendMail(
    {
      from:    fromAddress,
      to:      [email],
      subject: `Welcome to Mister Chameleon — your ${planLabel} trial has started`,
      text: [
        `Hi ${name},`,
        "",
        `Your 14-day free trial on the ${planLabel} plan is now active.`,
        "",
        `Trial ends: ${trialEndDate}`,
        `No credit card required — cancel any time before the trial ends.`,
        "",
        `Log in to your dashboard and start personalising:`,
        `https://mister-chameleon.com/admin`,
        "",
        `If you have any questions, reply to this email and we'll be happy to help.`,
        "",
        `The Mister Chameleon team`,
      ].join("\n"),
      html: `
        <p>Hi ${name},</p>
        <p>Your <strong>14-day free trial on the ${planLabel} plan</strong> is now active.</p>
        <ul>
          <li><strong>Trial ends:</strong> ${trialEndDate}</li>
          <li>No credit card required — cancel any time.</li>
        </ul>
        <p>
          <a href="https://mister-chameleon.com/admin"
             style="display:inline-block;background:#4f46e5;color:white;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;">
            Go to your dashboard
          </a>
        </p>
        <p style="color:#6b7280;font-size:0.875rem;">
          Questions? Just reply to this email.
        </p>
      `.trim(),
    },
    transport,
  ).then((r) => {
    if (!r.ok) console.warn("[trial/start] Welcome email failed:", r.error);
  });

  // Admin notification to the backoffice
  if (adminAddress) {
    void sendMail(
      {
        from:    fromAddress,
        to:      [adminAddress],
        subject: `New trial signup: ${name} (${planLabel})`,
        text: [
          `A new trial account was just created.`,
          "",
          `Name:    ${name}`,
          `Email:   ${email}`,
          `Company: ${company}`,
          `Plan:    ${planLabel}`,
          `Tenant:  ${tenantId}`,
          `User ID: ${userId}`,
          `Trial ends: ${trialEndDate}`,
          "",
          `View in admin: https://mister-chameleon.com/admin/platform/tenants`,
        ].join("\n"),
      },
      transport,
    ).then((r) => {
      if (!r.ok) console.warn("[trial/start] Admin notification email failed:", r.error);
    });
  }

  // ── 8b. Report the signup as a conversion ───────────────────────────────────
  //
  //   A trial signup is a strong conversion for the MARKETING site's tenant
  //   (the site the visitor signed up on) — not the freshly created trial tenant.
  //   Resolve the active (site) tenant and report against it. Fail-open.
  try {
    const siteTenant = await getActiveTenant();
    const cookieHeader = (await headers()).get("cookie");
    const { sessionId } = resolveSession(cookieHeader);
    await reportInboundConversion({
      tenantId:   siteTenant.tenantId,
      sessionId,
      targetPath: "/",
      eventName:  "Trial",
      cookieHeader,
      values:     { name, email, company },
    });
  } catch {
    // Never let conversion reporting affect the signup response.
  }

  // ── 9. Return success ────────────────────────────────────────────────────────

  return NextResponse.json({ tenantId }, { status: 201 });
}
