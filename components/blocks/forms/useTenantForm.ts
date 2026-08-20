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
  opts?: { fallbackSuccessMessage?: string },
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

  const successMessage =
    overlay?.successMessage ?? opts?.fallbackSuccessMessage ?? formDef?.action.successMessage ?? DEFAULT_SUCCESS;
  const redirectPath = overlay?.redirectPath ?? formDef?.action.redirectPath;

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
        if (redirectPath && redirectPath.startsWith("/") && !redirectPath.startsWith("//")) {
          router.push(redirectPath);
          return;
        }
        setSubmitState({ status: "success", message: (json as { ok: true; message?: string }).message ?? successMessage });
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
  }, [formKey, redirectPath, successMessage, router, fireFormEvent]);

  return { resolvedForm: overlay, submitState, errorRevision, submit, fireFormEvent, successMessage, redirectPath };
}
