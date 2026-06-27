/**
 * POST /api/demo/book
 *
 * Creates a Google Calendar event for a 30-minute demo booking and sends
 * a confirmation email to the booker via Resend.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     date:     "2026-05-15",           // YYYY-MM-DD
 *     time:     "10:00",                // HH:MM (24h, local time)
 *     name:     "Jasper Mulders",
 *     email:    "jasper@example.com",
 *     company?: "Acme Corp",
 *     phone?:   "+31 6 12345678",
 *     message?: "Looking forward to it!"
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   200  { ok: true, eventId: "...", htmlLink: "..." }
 *   400  { error: "..." }  — validation failure
 *   409  { error: "Slot no longer available." }  — race condition
 *   500  { error: "..." }  — calendar or email error
 *
 * ─── What happens on success ──────────────────────────────────────────────────
 *
 *   1. Google Calendar event created with booker as attendee.
 *      Google automatically sends a calendar invite email to the booker.
 *   2. Branded confirmation email sent via Resend (or platform email config).
 *   3. Backoffice notification sent to BACKOFFICE_EMAIL.
 */

import { NextRequest, NextResponse }  from "next/server";
import { createDemoBooking }          from "@/lib/google-calendar/booking";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import { logger }                     from "@/lib/logger";
import { serverEnv }                  from "@/lib/env";
import { getActiveTenant }            from "@/tenant/get-active-tenant";
import { resolveCalendarConfig }      from "@/lib/google-calendar/config";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse body ───────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateBookingBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { date, time, name, email, company, phone, message } = validation.data;

  logger.info("[demo/book] Booking request received", { date, time, email });

  // Resolve the active tenant so per-tenant calendars are honoured (the booking
  // lib falls back to the platform calendar when the tenant has none).
  let tenantId: string | undefined;
  try {
    tenantId = (await getActiveTenant()).tenantId;
  } catch {
    tenantId = undefined;
  }

  // ── Create Google Calendar event ─────────────────────────────────────────
  const bookingResult = await createDemoBooking({
    date, time, name, email,
    ...(company ? { company } : {}),
    ...(phone   ? { phone   } : {}),
    ...(message ? { message } : {}),
  }, tenantId);

  if (!bookingResult.ok) {
    logger.error("[demo/book] Calendar booking failed", { error: bookingResult.error });

    // Detect a slot-conflict signal (not guaranteed from GCal API, but handle gracefully)
    if (bookingResult.error.toLowerCase().includes("conflict")) {
      return NextResponse.json(
        { error: "This slot is no longer available. Please choose another time." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: bookingResult.error }, { status: 500 });
  }

  logger.info("[demo/book] Calendar event created", {
    eventId: bookingResult.eventId,
    email,
    date,
    time,
  });

  // ── Send confirmation + backoffice emails ────────────────────────────────
  const transport = resolveTransportConfig();
  const from      = serverEnv.email.fromAddress ?? "Mister Chameleon <hello@misterchameleon.nl>";
  const timezone  = (await resolveCalendarConfig(tenantId)).timezone;

  logger.info("[demo/book] Email transport", { type: transport.type, from });

  // Await confirmation email so failures are visible in the response
  const confirmResult = await sendMail({
    from,
    to:      [email],
    subject: `Your Mister Chameleon demo is confirmed — ${formatDateDisplay(date)} at ${time}`,
    text:    buildConfirmationText({ name, date, time, timezone }),
    html:    buildConfirmationHtml({ name, date, time, timezone, eventLink: bookingResult.htmlLink }),
  }, transport);

  if (!confirmResult.ok) {
    logger.error("[demo/book] Confirmation email failed", { error: confirmResult.error, transport: transport.type });
  } else {
    logger.info("[demo/book] Confirmation email sent", { to: email });
  }

  // Backoffice notification — fire-and-forget
  if (serverEnv.email.backofficeEmail) {
    void sendMail({
      from,
      to:      [serverEnv.email.backofficeEmail],
      subject: `New demo booking: ${name}${company ? ` (${company})` : ""} — ${date} ${time}`,
      text:    buildBackofficeText({ name, email, company, phone, message, date, time }),
    }, transport).then((r) => {
      if (!r.ok) logger.warn("[demo/book] Backoffice email failed", { error: r.error });
    });
  }

  return NextResponse.json(
    {
      ok:      true,
      eventId: bookingResult.eventId,
      htmlLink: bookingResult.htmlLink,
      emailSent: confirmResult.ok,
      ...(confirmResult.ok ? {} : { emailError: confirmResult.error }),
    },
    { status: 200 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

interface ValidatedBooking {
  date:     string;
  time:     string;
  name:     string;
  email:    string;
  company?: string;
  phone?:   string;
  message?: string;
}

type ValidationResult =
  | { ok: true;  data: ValidatedBooking }
  | { ok: false; error: string };

function validateBookingBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  const date    = str(raw.date);
  const time    = str(raw.time);
  const name    = str(raw.name);
  const email   = str(raw.email);
  const company = str(raw.company);
  const phone   = str(raw.phone);
  const message = str(raw.message);

  const missing: string[] = [];
  if (!date)  missing.push("date");
  if (!time)  missing.push("time");
  if (!name)  missing.push("name");
  if (!email) missing.push("email");

  if (missing.length) {
    return { ok: false, error: `Missing required field(s): ${missing.join(", ")}.` };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date!)) {
    return { ok: false, error: "Invalid date format. Expected YYYY-MM-DD." };
  }

  if (!/^\d{2}:\d{2}$/.test(time!)) {
    return { ok: false, error: "Invalid time format. Expected HH:MM." };
  }

  if (!isPlausibleEmail(email!)) {
    return { ok: false, error: "Please provide a valid email address." };
  }

  // Reject past dates
  const today = new Date().toISOString().slice(0, 10);
  if (date! < today) {
    return { ok: false, error: "Cannot book a slot in the past." };
  }

  return {
    ok:   true,
    data: {
      date:    date!,
      time:    time!,
      name:    name!,
      email:   email!,
      ...(company ? { company } : {}),
      ...(phone   ? { phone }   : {}),
      ...(message ? { message } : {}),
    },
  };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() || undefined : undefined;
}

function isPlausibleEmail(v: string): boolean {
  const at = v.indexOf("@");
  if (at <= 0) return false;
  const domain = v.slice(at + 1);
  return domain.includes(".") && domain.length >= 3;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmationData {
  name:      string;
  date:      string;
  time:      string;
  timezone:  string;
  eventLink?: string;
}

function formatDateDisplay(date: string): string {
  try {
    return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", {
      weekday: "long",
      year:    "numeric",
      month:   "long",
      day:     "numeric",
    });
  } catch {
    return date;
  }
}

function buildConfirmationText(d: ConfirmationData): string {
  return [
    `Hi ${d.name},`,
    "",
    `Your 30-minute demo has been confirmed!`,
    "",
    `Date:  ${formatDateDisplay(d.date)}`,
    `Time:  ${d.time} (${d.timezone})`,
    "",
    "You should receive a Google Calendar invite shortly.",
    "",
    "What to expect:",
    "- A live walkthrough of Mister Chameleon's personalisation engine",
    "- See how it adapts your site to each individual visitor in real time",
    "- Q&A session tailored to your business",
    "",
    "If you need to reschedule, just reply to this email.",
    "",
    "See you soon!",
    "The Mister Chameleon team",
  ].join("\n");
}

function buildConfirmationHtml(d: ConfirmationData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);padding:40px 40px 32px;text-align:center">
    <div style="font-size:28px;margin-bottom:8px">🦎</div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px">Demo Confirmed!</h1>
    <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:14px">Mister Chameleon</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px">
    <p style="color:#374151;font-size:16px;margin:0 0 24px">Hi ${d.name},</p>
    <p style="color:#374151;font-size:16px;margin:0 0 32px">Your 30-minute demo is confirmed. We're looking forward to showing you what Mister Chameleon can do for your website.</p>

    <!-- Booking card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-radius:10px;margin-bottom:32px">
    <tr><td style="padding:24px 28px">
      <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.8px;font-weight:600">Your booking</p>
      <p style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:700">${formatDateDisplay(d.date)}</p>
      <p style="margin:0;color:#374151;font-size:16px">
        <span style="display:inline-block;background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:4px 12px;font-weight:600;color:#111827">${d.time}</span>
        <span style="color:#6b7280;font-size:14px;margin-left:8px">${d.timezone}</span>
      </p>
    </td></tr>
    </table>

    <!-- What to expect -->
    <h3 style="color:#111827;font-size:15px;font-weight:600;margin:0 0 12px">What to expect</h3>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:32px">
      ${["A live walkthrough of Mister Chameleon's personalisation engine", "See how it adapts your site to each individual visitor in real time", "Q&amp;A session tailored to your business"].map((item) => `
      <tr><td style="padding:4px 0">
        <span style="display:inline-block;width:20px;color:#059669;font-weight:700;font-size:16px">✓</span>
        <span style="color:#374151;font-size:14px">${item}</span>
      </td></tr>`).join("")}
    </table>

    ${d.eventLink ? `<p style="margin:0 0 32px;text-align:center"><a href="${d.eventLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;border-radius:8px;padding:12px 28px;font-size:14px;font-weight:600">View in Google Calendar</a></p>` : ""}

    <p style="color:#6b7280;font-size:14px;margin:0">Need to reschedule? Simply reply to this email and we'll sort it out.</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center">
    <p style="color:#9ca3af;font-size:12px;margin:0">Mister Chameleon — Web Personalisation Platform</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildBackofficeText(d: {
  name:     string;
  email:    string;
  company?: string;
  phone?:   string;
  message?: string;
  date:     string;
  time:     string;
}): string {
  const lines = [
    "New demo booking received!",
    "",
    `Date:    ${d.date} at ${d.time}`,
    `Name:    ${d.name}`,
    `Email:   ${d.email}`,
  ];
  if (d.company) lines.push(`Company: ${d.company}`);
  if (d.phone)   lines.push(`Phone:   ${d.phone}`);
  if (d.message) { lines.push("", `Message: ${d.message}`); }
  return lines.join("\n");
}
