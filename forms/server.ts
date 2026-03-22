/**
 * forms/server — server-only form exports
 *
 * A named barrel for all form-layer modules that must never run in the browser.
 * Importing this file in a Client Component will throw a build-time error via
 * the "server-only" package — that error is intentional and correct.
 *
 * ─── What is exported ─────────────────────────────────────────────────────────
 *
 *   Email dispatch (forms/email.ts)
 *   ────────────────────────────────
 *   EmailDispatchConfig                   — input shape for both dispatch fns
 *   EmailDispatchResult                   — { ok: true } | { ok: false; error }
 *   dispatchBackofficeNotification(cfg)   — internal notification via Resend
 *   dispatchSubmitterConfirmation(cfg)    — submitter acknowledgement via Resend
 *
 *   Submission storage (forms/storage.ts)
 *   ──────────────────────────────────────
 *   StoreSubmissionInput                  — { formKey, values, sessionId? }
 *   StoreSubmissionResult                 — { ok: true; id } | { ok: false; error }
 *   storeSubmission(input)                — write to form_submissions table
 *
 *   Spam protection (forms/spam.ts)
 *   ────────────────────────────────
 *   HONEYPOT_FIELD                        — "_hp" — field name shared with client
 *   RateLimitResult                       — { allowed: true } | { allowed: false; … }
 *   checkHoneypot(body)                   — true when the honeypot field is filled
 *   checkRateLimit(ip, formKey)           — per-IP burst limit guard
 *   resolveClientIp(headers)             — extract IP from x-forwarded-for / x-real-ip
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In API routes, server actions, or other server-only files:
 *   import {
 *     storeSubmission,
 *     dispatchBackofficeNotification,
 *     dispatchSubmitterConfirmation,
 *   } from "@/forms/server";
 *
 *   // The sub-module paths are equally valid and preferred when only one
 *   // module is needed:
 *   import { storeSubmission } from "@/forms/storage";
 *   import { checkHoneypot }   from "@/forms/spam";
 *
 * ─── What is NOT exported ──────────────────────────────────────────────────────
 *
 *   Client-safe exports (types, definitions, validation helpers) live in the
 *   main barrel (@/forms) so Client Components can import them without hitting
 *   this guard.  There is intentionally no duplication between the two barrels.
 */

import "server-only";

// ── Email dispatch ─────────────────────────────────────────────────────────────

export type { EmailDispatchConfig, EmailDispatchResult } from "./email";
export {
  dispatchBackofficeNotification,
  dispatchSubmitterConfirmation,
} from "./email";

// ── Submission storage ─────────────────────────────────────────────────────────

export type { StoreSubmissionInput, StoreSubmissionResult } from "./storage";
export { storeSubmission } from "./storage";

// ── Spam protection ────────────────────────────────────────────────────────────

export type { RateLimitResult } from "./spam";
export {
  HONEYPOT_FIELD,
  checkHoneypot,
  checkRateLimit,
  resolveClientIp,
} from "./spam";
