"use client";

/**
 * useTenantForm
 *
 * Shared client hook that owns the tenant-form submit pipeline used by
 * FormSectionBlock (full forms) and NewsletterForm (cta_newsletter):
 *
 *   - fetches the contextual overlay (ResolvedForm) from /api/forms/[key]/context
 *   - resolves the effective successMessage / redirectPath
 *   - exposes submit(values) that POSTs to /api/forms/[key] and maps the response
 *     to a submit state (success / fieldErrors / error), honouring a segment
 *     thank-you redirect
 *   - fires form_start / form_submit analytics (consent-aware)
 *
 * Reusing this means both consumers hit the identical pipeline (encrypted
 * storage, optional per-form Turnstile, adaptive confirmation email); nothing is
 * duplicated. The Turnstile widget itself is rendered by TurnstileWidget.
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getFormDefinition, isFormKey } from "@/forms";
import { resolveRedirectTarget, resolvePostSubmitAction } from "@/forms/context/resolve";
import type { ResolvedForm } from "@/forms/context/types";
import { trackEvent } from "@/tracking/track-event";
import { pushToJourneyStore, generateEventId, getJourneyStoreVisitorId } from "@/tracking/journey-store";
import { hasConsent } from "@/tracking/consent-store";

export type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success";     message: string }
  | { status: "fieldErrors"; errors: Record<string, string> }
  | { status: "error";       message: string };

function isResponseShape(value: unknown): value is { ok: boolean } {
  return typeof value === "object" && value !== null && "ok" in value;
}

const DEFAULT_SUCCESS = "Thank you. Your submission has been received.";

export interface UseTenantFormResult {
  resolvedForm:  ResolvedForm | null;
  submitState:   SubmitState;
  errorRevision: number;
  submit:        (values: Record<string, string>) => Promise<void>;
  fireFormEvent: (eventType: "form_start" | "form_submit") => void;
  successMessage: string;
  redirectPath?: string;
}

export function useTenantForm(
  formKey: string,
  opts?: {
    /** @deprecated Use `blockSuccessMessage` — kept so existing callers keep working. */
    fallbackSuccessMessage?: string;
    /** CMS block-level success message (Form Section "Bedanktekst"). */
    blockSuccessMessage?:    string;
    /** CMS block-level redirect target — already normalised by the mapper. */
    blockRedirectUrl?:       string;
    /** CMS block-level post-submit behaviour; absent = "message". */
    postSubmit?:             "message" | "redirect";
  },
): UseTenantFormResult {
  const pathname = usePathname();
  const router   = useRouter();

  const formDef = isFormKey(formKey) ? getFormDefinition(formKey) : undefined;

  const [overlay, setOverlay] = useState<ResolvedForm | null>(null);
  useEffect(() => {
    let cancelled = false;
    const query: Record<string, string> = {};
    try {
      new URLSearchParams(window.location.search).forEach((v, k) => { query[k.toLowerCase()] = v; });
    } catch { /* ignore */ }
    fetch(`/api/forms/${formKey}/context`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ path: pathname, query }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j && j.ok && j.form) setOverlay(j.form as ResolvedForm); })
      .catch(() => { /* keep base form */ });
    return () => { cancelled = true; };
  }, [formKey, pathname]);

  // A contextual overlay is the most specific source, then the CMS block
  // placement, then the code FormDefinition.
  const blockSuccessMessage   = opts?.blockSuccessMessage ?? opts?.fallbackSuccessMessage;
  const overlaySuccessMessage = overlay?.successMessage;
  const successMessage =
    overlaySuccessMessage ?? blockSuccessMessage ?? formDef?.action.successMessage ?? DEFAULT_SUCCESS;

  // Post-submit target — see resolveRedirectTarget for the precedence rules.
  const redirectPath = resolveRedirectTarget({
    postSubmit:             opts?.postSubmit,
    blockRedirectUrl:       opts?.blockRedirectUrl,
    overlayRedirectPath:    overlay?.redirectPath,
    definitionRedirectPath: formDef?.action.redirectPath,
  });

  const fireFormEvent = useCallback((eventType: "form_start" | "form_submit") => {
    const payload = { form_key: formKey, page_path: pathname, visitor_id: getJourneyStoreVisitorId() ?? undefined };
    if (hasConsent("analytics") && hasConsent("personalization")) {
      trackEvent(eventType, payload);
    } else {
      pushToJourneyStore(generateEventId(), eventType, { ...payload, occurred_at: new Date().toISOString(), scenario_panel: true });
      fetch("/api/scenario/event", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ eventType, pagePath: pathname, eventValue: formKey }),
        credentials: "include",
      }).catch(() => { /* fire-and-forget */ });
    }
  }, [formKey, pathname]);

  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [errorRevision, setErrorRevision] = useState(0);

  const submit = useCallback(async (values: Record<string, string>): Promise<void> => {
    setSubmitState({ status: "submitting" });
    try {
      const res  = await fetch(`/api/forms/${formKey}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });
      const json = await res.json() as unknown;

      if (!isResponseShape(json)) {
        setSubmitState({ status: "error", message: "Submission failed. Please try again." });
        return;
      }
      if (json.ok) {
        fireFormEvent("form_submit");
        // An internal path stays a client-side navigation; an external URL (a
        // Form Section block may point at an off-site thank-you page) needs a
        // full page load. An unsafe target degrades to the message.
        const action = resolvePostSubmitAction(redirectPath, {
          overlaySuccessMessage,
          blockSuccessMessage,
          responseMessage: (json as { ok: true; message?: string }).message,
          fallbackMessage: successMessage,
        });
        if (action.kind === "push")   { router.push(action.path);          return; }
        if (action.kind === "assign") { window.location.assign(action.url); return; }
        setSubmitState({ status: "success", message: action.message });
        return;
      }
      if ("errors" in json && json.errors && typeof json.errors === "object") {
        setSubmitState({ status: "fieldErrors", errors: json.errors as Record<string, string> });
        setErrorRevision((r) => r + 1);
        return;
      }
      const errorMessage = "error" in json && typeof json.error === "string" ? json.error : "Submission failed. Please try again.";
      setSubmitState({ status: "error", message: errorMessage });
    } catch {
      setSubmitState({ status: "error", message: "Network error. Please check your connection and try again." });
    }
  }, [formKey, redirectPath, successMessage, blockSuccessMessage, overlaySuccessMessage, router, fireFormEvent]);

  return { resolvedForm: overlay, submitState, errorRevision, submit, fireFormEvent, successMessage, redirectPath };
}
