"use client";

/**
 * NewsletterForm
 *
 * Inline email-capture for the `cta_newsletter` CTA variant. It reuses the shared
 * tenant-form pipeline (useTenantForm + TurnstileWidget), so a submit goes to
 * /api/forms/[formKey] with the same encrypted storage, optional per-form
 * Turnstile, and adaptive confirmation email as any other form. No parallel
 * subscribe mechanism.
 *
 * Without a `formKey` it renders nothing on the live site (graceful degradation);
 * the admin preview shows a short hint instead.
 */

import { useRef } from "react";
import { useTenantForm } from "@/components/blocks/forms/useTenantForm";
import { TurnstileWidget } from "@/components/blocks/forms/TurnstileWidget";

// Must match HONEYPOT_FIELD in forms/spam.ts. Inlined to keep this a pure client
// component (no server-only imports).
const HONEYPOT_FIELD = "_hp";

const INPUT_STYLE: React.CSSProperties = {
  background:   "var(--card-bg, #ffffff)",
  borderColor:  "var(--card-border, #e2e8f0)",
  borderRadius: "var(--radius-interactive, 0.5rem)",
  color:        "var(--text)",
};
const BUTTON_STYLE: React.CSSProperties = {
  background:   "var(--primary)",
  borderRadius: "var(--radius-interactive, 0.5rem)",
};

export function NewsletterForm({ formKey, adminPreview }: { formKey?: string; adminPreview?: boolean }) {
  if (!formKey) {
    // Live site: render nothing rather than a broken form. Admin preview: a hint.
    return adminPreview
      ? <p className="text-sm" style={{ color: "var(--text-muted, #64748b)" }}>Pick a form to enable the newsletter signup.</p>
      : null;
  }
  return <NewsletterFormInner formKey={formKey} />;
}

function NewsletterFormInner({ formKey }: { formKey: string }) {
  const { resolvedForm, submitState, submit, fireFormEvent } = useTenantForm(formKey);
  const started = useRef(false);
  const siteKey = resolvedForm?.turnstile?.siteKey;

  if (submitState.status === "success") {
    return (
      <p role="status" aria-live="polite" className="text-sm font-medium" style={{ color: "var(--text)" }}>
        {submitState.message}
      </p>
    );
  }

  const submitting  = submitState.status === "submitting";
  const globalError =
    submitState.status === "error"       ? submitState.message
    : submitState.status === "fieldErrors" ? (submitState.errors.email ?? "Please enter a valid email address.")
    : undefined;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, string> = {
      email:            String(fd.get("email") ?? ""),
      [HONEYPOT_FIELD]: String(fd.get(HONEYPOT_FIELD) ?? ""),
    };
    if (siteKey) values["cf-turnstile-response"] = String(fd.get("cf-turnstile-response") ?? "");
    void submit(values);
  }

  return (
    <form
      onSubmit={onSubmit}
      onFocusCapture={() => { if (!started.current) { started.current = true; fireFormEvent("form_start"); } }}
      aria-label="Newsletter signup"
      className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]"
      noValidate
    >
      {/* Honeypot: off-screen, not keyboard-reachable. */}
      <input
        type="text" name={HONEYPOT_FIELD} aria-hidden="true" tabIndex={-1} autoComplete="off"
        style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", border: 0 }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="newsletter-email">Email address</label>
        <input
          id="newsletter-email" type="email" name="email" required autoComplete="email"
          placeholder="Enter your email"
          className="min-w-0 flex-1 rounded-md border px-4 py-2.5 text-sm outline-none focus:ring-2"
          style={INPUT_STYLE}
        />
        <button
          type="submit" disabled={submitting}
          className="shrink-0 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2"
          style={BUTTON_STYLE}
        >
          {submitting ? "Subscribing..." : "Subscribe"}
        </button>
      </div>

      <TurnstileWidget siteKey={siteKey} className="cf-turnstile" />

      {globalError && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-error-500, #dc2626)" }}>{globalError}</p>
      )}
    </form>
  );
}
