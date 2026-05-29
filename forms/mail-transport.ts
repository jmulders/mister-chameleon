/**
 * Mail Transport
 *
 * Unified email sending abstraction that supports:
 *
 *   Resend API  — Plain `fetch` to the Resend REST API.
 *                 No npm package required.  Uses RESEND_API_KEY env var by default,
 *                 or a tenant-specific key from TenantEmailTransport.
 *
 *   SMTP        — Standard SMTP via the `nodemailer` package.
 *                 Requires `npm install nodemailer @types/nodemailer`.
 *                 Activated when transport type is "smtp".
 *
 * ─── Transport resolution order ───────────────────────────────────────────────
 *
 *   1. Per-tenant DB config (tenant_email_transport)    — highest priority
 *   2. Platform DB config   (platform_settings.email)   — admin-configured default
 *   3. SMTP_HOST env var                                → "smtp" transport
 *   4. RESEND_API_KEY env var                           → "resend" transport
 *   5. No config                                        → silent skip
 *
 * ─── Safety model ─────────────────────────────────────────────────────────────
 *
 *   sendMail() never throws and never rejects.
 *   All errors are returned as { ok: false, error: string }.
 *   Callers log them but never surface them to the form submitter.
 *
 * ─── Credentials ──────────────────────────────────────────────────────────────
 *
 *   SMTP credentials (username / password) stored in the tenant_email_transport
 *   table SHOULD be stored encrypted at the application layer before writing
 *   and decrypted after reading.  The transport layer receives already-decrypted
 *   values — encryption/decryption is the responsibility of the admin actions
 *   that read/write the table.
 *
 * ─── Module structure ─────────────────────────────────────────────────────────
 *
 *   MailMessage             — unified message shape (from, to, subject, text, html?)
 *   MailTransportConfig     — transport selection + credentials
 *   SendResult              — { ok: true } | { ok: false; error: string }
 *   sendMail()              — public dispatch entry point
 *   resolveTransportConfig()— builds config from TenantEmailTransport + env fallback
 */

import "server-only";

// ─── Runtime guard ────────────────────────────────────────────────────────────
//
// Exporting `runtime` from a module file has no effect on its own, but it
// serves as documentation and guards against accidental Edge-runtime usage
// if this file is ever re-used from a route segment context.
//
// The `import "server-only"` guard above already prevents this module from
// being imported in client components.  The `runtime` export ensures that
// if this file is ever used in a Next.js route that runs on the Edge, the
// build will fail with a clear error rather than silently using an
// incompatible runtime.
//
// nodemailer is a Node.js-only package — it MUST run in the Node.js runtime.
export const runtime = "nodejs";

import { serverEnv } from "@/lib/env";
import { logger }    from "@/lib/logger";
import type { TenantEmailTransport } from "@/tenant/types";
import type { PlatformEmailSettings } from "@/platform/platform-store";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single outbound email message.
 *
 * `from` must be in one of these formats:
 *   "Name <email@example.com>"
 *   "email@example.com"
 */
export interface MailMessage {
  /** Sender address, e.g. "Acme <hello@acme.com>" */
  readonly from:     string;
  /** One or more recipient addresses. */
  readonly to:       string[];
  /** Optional Reply-To address. */
  readonly replyTo?: string;
  /** Email subject line. */
  readonly subject:  string;
  /** Plain-text body (always required). */
  readonly text:     string;
  /** Optional HTML body. When present, clients prefer HTML over text. */
  readonly html?:    string;
}

/**
 * Resolved transport configuration — passed to sendMail().
 *
 * Produced by resolveTransportConfig() from TenantEmailTransport + env fallback.
 */
export interface MailTransportConfig {
  /** Which underlying transport to use. */
  readonly type: "resend" | "smtp" | "none";

  // ── Resend ──────────────────────────────────────────────────────────────────
  /** Resend API secret key. Required when type === "resend". */
  readonly resendApiKey?: string;

  // ── SMTP ────────────────────────────────────────────────────────────────────
  /** SMTP server hostname, e.g. "smtp.mailgun.org". Required when type === "smtp". */
  readonly smtpHost?:     string;
  /** SMTP port. Defaults to 587 (STARTTLS). */
  readonly smtpPort?:     number;
  /** SMTP auth username. */
  readonly smtpUsername?: string;
  /** SMTP auth password (decrypted). */
  readonly smtpPassword?: string;
  /**
   * Use implicit TLS (port 465) when true; STARTTLS upgrade when false.
   * Defaults to false (STARTTLS on port 587).
   */
  readonly smtpSecure?:   boolean;
}

/** Result of a sendMail() call. Never throws — always returns a result. */
export type SendResult =
  | { ok: true }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Config resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the effective MailTransportConfig from:
 *   1. tenantTransport — per-tenant DB config (highest priority)
 *   2. platformConfig  — platform-level DB config (platform_settings.email)
 *   3. Env vars        — SMTP_HOST / RESEND_API_KEY (legacy fallback)
 *   4. { type: "none" } — silent skip
 *
 * @param tenantTransport  Optional per-tenant transport config from DB.
 * @param platformConfig   Optional platform-level transport config from platform_settings.
 */
export function resolveTransportConfig(
  tenantTransport?: TenantEmailTransport | null,
  platformConfig?:  PlatformEmailSettings | null,
): MailTransportConfig {
  // ── 1. Per-tenant DB config — highest priority ─────────────────────────────
  if (tenantTransport) {
    if (tenantTransport.transportType === "smtp" && tenantTransport.smtpHost) {
      return {
        type:         "smtp",
        smtpHost:     tenantTransport.smtpHost,
        smtpPort:     tenantTransport.smtpPort     ?? 587,
        smtpUsername: tenantTransport.smtpUsername,
        smtpPassword: tenantTransport.smtpPassword,
        smtpSecure:   tenantTransport.smtpSecure   ?? false,
      };
    }
    if (tenantTransport.transportType === "resend" && tenantTransport.resendApiKey) {
      return { type: "resend", resendApiKey: tenantTransport.resendApiKey };
    }
  }

  // ── 2. Platform DB config (platform_settings.email) ───────────────────────
  if (platformConfig) {
    if (platformConfig.transportType === "smtp" && platformConfig.smtpHost) {
      return {
        type:         "smtp",
        smtpHost:     platformConfig.smtpHost,
        smtpPort:     platformConfig.smtpPort     ?? 587,
        smtpUsername: platformConfig.smtpUsername,
        smtpPassword: platformConfig.smtpPassword,
        smtpSecure:   platformConfig.smtpSecure   ?? false,
      };
    }
    if (platformConfig.transportType === "resend" && platformConfig.resendApiKey) {
      return { type: "resend", resendApiKey: platformConfig.resendApiKey };
    }
  }

  // ── 3. Env-var fallback ────────────────────────────────────────────────────
  const smtpHost  = serverEnv.smtp.host;
  const resendKey = serverEnv.email.resendApiKey;

  if (smtpHost) {
    return {
      type:         "smtp",
      smtpHost,
      smtpPort:     serverEnv.smtp.port     ?? 587,
      smtpUsername: serverEnv.smtp.username,
      smtpPassword: serverEnv.smtp.password,
      smtpSecure:   serverEnv.smtp.secure   ?? false,
    };
  }

  if (resendKey) {
    return { type: "resend", resendApiKey: resendKey };
  }

  // ── 4. No transport ────────────────────────────────────────────────────────
  return { type: "none" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: sendMail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a single email message via the configured transport.
 *
 * Dispatches to the appropriate provider (Resend or SMTP) based on
 * `transport.type`.  Never throws — all failures return { ok: false, error }.
 *
 * @param message   The email to send.
 * @param transport The resolved transport config (from resolveTransportConfig()).
 */
export async function sendMail(
  message:   MailMessage,
  transport: MailTransportConfig,
): Promise<SendResult> {
  if (transport.type === "none") {
    if (process.env.NODE_ENV === "development") {
      logger.info("[mail-transport] No transport configured — email skipped (dev)", {
        to:      message.to,
        subject: message.subject,
        preview: message.text.slice(0, 120),
      });
    }
    return { ok: true };
  }

  if (transport.type === "resend") {
    return sendViaResend(message, transport);
  }

  if (transport.type === "smtp") {
    return sendViaSMTP(message, transport);
  }

  return { ok: false, error: `Unknown transport type: ${String((transport as MailTransportConfig).type)}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Resend
// ─────────────────────────────────────────────────────────────────────────────

interface ResendPayload {
  from:      string;
  to:        string[];
  reply_to?: string;
  subject:   string;
  text:      string;
  html?:     string;
}

async function sendViaResend(
  message:   MailMessage,
  transport: MailTransportConfig,
): Promise<SendResult> {
  const apiKey = transport.resendApiKey;

  if (!apiKey) {
    logger.warn("[mail-transport] Resend transport selected but resendApiKey is missing — skipping.");
    return { ok: true };
  }

  const payload: ResendPayload = {
    from:    message.from,
    to:      message.to,
    subject: message.subject,
    text:    message.text,
    ...(message.html    ? { html:     message.html    } : {}),
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return { ok: true };

    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { message?: string; name?: string };
      if (body.message) errorMessage = `${body.name ?? "Resend error"}: ${body.message}`;
    } catch { /* non-JSON body — use status code message */ }

    logger.error("[mail-transport] Resend API error", {
      status: res.status, error: errorMessage, to: message.to, subject: message.subject,
    });
    return { ok: false, error: errorMessage };

  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    logger.error("[mail-transport] Resend fetch failed", { error });
    return { ok: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: SMTP via nodemailer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal inline type declarations for the nodemailer surface we use.
 *
 * ─── Why not `import type { … } from "nodemailer"` ? ─────────────────────────
 *
 *   TypeScript resolves `import("nodemailer")` and `typeof import("nodemailer")`
 *   at COMPILE TIME, even inside a dynamic import expression.  That means
 *   `@types/nodemailer` must be installed for the project to type-check,
 *   defeating the whole point of the optional dependency.
 *
 *   Instead we declare only the three interfaces we actually use.  They are
 *   structurally compatible with nodemailer's real types (structural subtyping),
 *   so the cast `as unknown as NodemailerModule` is safe at runtime.
 *
 *   If @types/nodemailer IS installed, these definitions are simply unused by
 *   the compiler — they cause no conflict.
 */
interface _SmtpOptions {
  host:    string;
  port:    number;
  secure:  boolean;
  auth?:   { user: string; pass: string };
}

interface _MailOptions {
  from:     string;
  to:       string;
  replyTo?: string;
  subject:  string;
  text:     string;
  html?:    string;
}

interface _Transporter {
  sendMail(options: _MailOptions): Promise<unknown>;
}

interface _NodemailerModule {
  createTransport(options: _SmtpOptions): _Transporter;
}

// ── Module cache ──────────────────────────────────────────────────────────────

/**
 * Cached reference to the successfully-loaded nodemailer module.
 *
 *   undefined         — not yet loaded, OR last attempt failed (will retry)
 *   _NodemailerModule — successfully loaded; reused on subsequent calls
 *
 * ─── Why failures are NOT cached ──────────────────────────────────────────────
 *
 *   Permanently caching failure (`null`) would mean that `npm install nodemailer`
 *   while the dev server is running has no effect — the server keeps returning
 *   "not installed" until manually restarted.  By leaving the value as
 *   `undefined` on failure, each SMTP call retries the import, so installing
 *   the package takes effect immediately on the next request.
 *
 * ─── Why `turbopackIgnore` is required ────────────────────────────────────────
 *
 *   `next.config.mjs` declares `serverExternalPackages: ["nodemailer"]`.
 *   This tells webpack (production builds) to treat nodemailer as a Node.js
 *   external — the package is resolved at runtime via Node.js native require
 *   rather than pre-bundled at build time.
 *
 *   However, Turbopack (used by `next dev`) statically analyses dynamic
 *   `import()` expressions at build time regardless of `serverExternalPackages`.
 *   If nodemailer is absent from node_modules at the time Turbopack builds the
 *   file, it replaces the entire import expression with a pre-baked throw:
 *
 *     await Promise.resolve().then(() => {
 *       const e = new Error("Cannot find module 'nodemailer'");
 *       e.code = 'MODULE_NOT_FOUND';
 *       throw e;
 *     });
 *
 *   This pre-baked error runs at every request, regardless of what is actually
 *   in node_modules at runtime.  The package.json or node_modules state does
 *   not matter — Turbopack already decided the answer at build time.
 *
 *   `/* turbopackIgnore: true *\/` opts the specific import() call out of
 *   Turbopack's static analysis, forcing it to emit a real runtime import()
 *   call.  Node.js then resolves nodemailer from node_modules at request time,
 *   which is the correct behaviour for an optional dependency.
 *
 *   Both annotations are needed:
 *     - `turbopackIgnore`  — for `next dev` (Turbopack)
 *     - `webpackIgnore`    — defensive; webpack with serverExternalPackages
 *                            handles this correctly, but the annotation makes
 *                            the intent explicit for any webpack fallback path.
 */
let _nodemailerModule: _NodemailerModule | undefined = undefined;

/**
 * Dynamically imports the nodemailer module, handling both CJS and ESM entry
 * points.
 *
 * nodemailer publishes a CJS main entry (`lib/nodemailer.js`).  When imported
 * via `import()` from an ESM context, the CJS module is wrapped so that the
 * named exports appear both at the module root AND on `.default`.  Using
 * `mod.default ?? mod` handles both shapes:
 *
 *   CJS via Node.js native `require()` wrapper  → mod.createTransport exists
 *   ESM-wrapped CJS                             → mod.default.createTransport
 *
 * The `/* turbopackIgnore: true *\/` annotation is required — see the cache
 * variable comment above for the full explanation.
 */
async function loadNodemailer(): Promise<_NodemailerModule> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — nodemailer is an optional dependency; @types/nodemailer not required
  const raw = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ "nodemailer");
  // CJS interop: `mod.default ?? mod` covers both the direct CJS shape and the
  // ESM-wrapped shape that bundlers may produce.
  return ((raw as { default?: _NodemailerModule }).default ?? raw) as unknown as _NodemailerModule;
}

/**
 * Probes whether `nodemailer` is importable in the current Node.js environment.
 *
 * Uses the `turbopackIgnore` / `webpackIgnore` annotated import so that
 * Turbopack does not pre-bake a "not found" error at build time.
 * Success is cached; failures are NOT cached so that installing the package
 * takes effect without a server restart.
 *
 * Exported so admin server actions can surface a "install nodemailer" warning
 * before the user tries to send a test email via SMTP.
 */
export async function isNodemailerAvailable(): Promise<boolean> {
  // Fast-path: already successfully loaded in this process.
  if (_nodemailerModule !== undefined) return true;

  try {
    _nodemailerModule = await loadNodemailer();
    return true;
  } catch {
    // Do NOT cache failure — leave as `undefined` so the next call retries.
    // This allows `npm install nodemailer` to take effect immediately.
    return false;
  }
}

/** Human-readable install hint shown when nodemailer is absent. */
const NODEMAILER_INSTALL_HINT =
  "SMTP transport requires the nodemailer package, which is not installed.\n" +
  "Run:  npm install nodemailer\n" +
  "Then: npm install --save-dev @types/nodemailer   (optional — for TypeScript types)";

// ── SMTP sender ───────────────────────────────────────────────────────────────

/**
 * Sends via SMTP using the `nodemailer` package.
 *
 * ─── nodemailer is an optional dependency ────────────────────────────────────
 *
 *   nodemailer is NOT listed in package.json dependencies so that projects
 *   using only Resend (or no email at all) do not need to install it.
 *
 *   Installation is required only when transport type is "smtp":
 *     npm install nodemailer
 *     npm install --save-dev @types/nodemailer   # optional, for TS types
 *
 *   When nodemailer is absent:
 *     • This function returns { ok: false, error } with the install hint.
 *     • The server never crashes — sendMail() always returns a result.
 *     • The admin test-email UI shows the install hint directly.
 *
 * ─── TypeScript ───────────────────────────────────────────────────────────────
 *
 *   We cast the dynamic import to our own _NodemailerModule interface (defined
 *   above) rather than `typeof import("nodemailer")`.  This removes the compile-
 *   time dependency on @types/nodemailer while keeping full type safety for the
 *   small surface we use.
 */
async function sendViaSMTP(
  message:   MailMessage,
  transport: MailTransportConfig,
): Promise<SendResult> {
  if (!transport.smtpHost) {
    return { ok: false, error: "SMTP transport selected but smtpHost is missing." };
  }

  // ── Load (or reuse) nodemailer ────────────────────────────────────────────
  //
  // `_nodemailerModule` is the process-level cache (undefined = not yet loaded
  // OR last attempt failed; object = successfully loaded and ready to reuse).
  //
  // The import uses `loadNodemailer()` which applies `turbopackIgnore` so
  // Turbopack does not pre-bake a "Cannot find module" error at build time.
  // See the `_nodemailerModule` cache variable comment for the full explanation.

  let nodemailer: _NodemailerModule;

  if (_nodemailerModule !== undefined) {
    // Fast path: already successfully loaded in this process — reuse it.
    nodemailer = _nodemailerModule;
  } else {
    // Attempt the import.  Failure is NOT cached — leaving `_nodemailerModule`
    // as `undefined` allows `npm install nodemailer` to take effect immediately
    // on the next SMTP call without a server restart.
    try {
      _nodemailerModule = await loadNodemailer();
      nodemailer = _nodemailerModule;
    } catch (err) {
      // Do NOT set _nodemailerModule = null — leave as undefined for retries.

      const isModuleNotFound =
        err instanceof Error &&
        (err.message.includes("Cannot find module")   ||
         err.message.includes("MODULE_NOT_FOUND")      ||
         err.message.includes("Cannot find package")   ||
         (err as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND");

      if (isModuleNotFound) {
        logger.error("[mail-transport] nodemailer is not installed", {
          hint: "npm install nodemailer",
        });
        return { ok: false, error: NODEMAILER_INSTALL_HINT };
      }

      // Import failed for a reason other than "package missing" — surface the
      // real error rather than the misleading "not installed" message.
      const error = err instanceof Error ? err.message : "Failed to load nodemailer";
      logger.error("[mail-transport] Unexpected error loading nodemailer", { error });
      return { ok: false, error };
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  try {
    const transporter = nodemailer.createTransport({
      host:   transport.smtpHost,
      port:   transport.smtpPort  ?? 587,
      secure: transport.smtpSecure ?? false,
      ...(transport.smtpUsername && transport.smtpPassword
        ? { auth: { user: transport.smtpUsername, pass: transport.smtpPassword } }
        : {}),
    });

    await transporter.sendMail({
      from:    message.from,
      to:      message.to.join(", "),
      replyTo: message.replyTo,
      subject: message.subject,
      text:    message.text,
      html:    message.html,
    });

    return { ok: true };

  } catch (err) {
    const error = err instanceof Error ? err.message : "SMTP send failed";
    logger.error("[mail-transport] SMTP send error", {
      host:  transport.smtpHost,
      port:  transport.smtpPort,
      error,
    });
    return { ok: false, error };
  }
}
