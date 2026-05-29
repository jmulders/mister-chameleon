"use client";

/**
 * NotificationRecipientsClient
 *
 * Manages the notification recipient configuration for a tenant.
 *
 *   - notificationRecipients: addresses that receive a backoffice email on
 *     every form submission.  One per line in a textarea.
 *   - replyTo: optional address that recipients can reply to (e.g. a shared
 *     support inbox) instead of the transactional From address.
 *
 * ─── Source badge ─────────────────────────────────────────────────────────────
 *
 *   recipientSource tells the user where the active recipients come from.
 *   When they haven't set any recipients yet, it shows "Platform" (if a
 *   platform backoffice email is set) or "Env var" so they understand the
 *   fallback without having to leave the page.
 *
 * ─── Save model ───────────────────────────────────────────────────────────────
 *
 *   Saves only the two recipient fields via saveNotificationSettingsAction.
 *   All other TenantFormSettings fields are merged server-side so this
 *   section cannot clobber the Default Form Behavior section.
 */

import { useState } from "react";
import type { ConfigSource } from "@/lib/config/types";

// ── Props ──────────────────────────────────────────────────────────────────────

interface NotificationRecipientsClientProps {
  initialRecipients:       string[];
  initialReplyTo:          string;
  recipientSource:         ConfigSource;
  /** Platform backoffice email — shown as the fallback when no tenant recipients are set. */
  platformBackofficeEmail: string | null;
  /** Env-var backoffice email — shown as last-resort fallback. */
  envBackofficeEmail:      string | null;
  saveAction: (data: {
    notificationRecipients: string[];
    replyTo?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationRecipientsClient({
  initialRecipients,
  initialReplyTo,
  recipientSource,
  platformBackofficeEmail,
  envBackofficeEmail,
  saveAction,
}: NotificationRecipientsClientProps) {
  const [recipientsText, setRecipientsText] = useState(
    initialRecipients.join("\n"),
  );
  const [replyTo, setReplyTo]       = useState(initialReplyTo);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [isDirty, setIsDirty]       = useState(false);

  const markDirty = () => {
    setIsDirty(true);
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    const recipients = recipientsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s !== "" && s.includes("@"));

    const result = await saveAction({
      notificationRecipients: recipients,
      replyTo: replyTo.trim() || undefined,
    });

    if (result.ok) {
      setSaveStatus("saved");
      setIsDirty(false);
      setRecipientsText(recipients.join("\n"));
    } else {
      setSaveStatus("error");
      setErrorMsg(result.error);
    }
  };

  // ── Fallback note ──────────────────────────────────────────────────────────
  const fallbackNote: string | null =
    recipientSource === "platform" && platformBackofficeEmail
      ? `Using platform default: ${platformBackofficeEmail}`
      : recipientSource === "env" && envBackofficeEmail
      ? `Using env var: ${envBackofficeEmail}`
      : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Notification Recipients</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Who receives a notification email on each new form submission.
          </p>
        </div>
        <SourceBadge source={recipientSource} />
      </div>

      {/* ── Fields ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-5">

        {/* Recipients textarea */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="recipients">
            Email addresses <span className="text-neutral-400 font-normal">(one per line)</span>
          </label>
          <textarea
            id="recipients"
            rows={4}
            value={recipientsText}
            onChange={(e) => { setRecipientsText(e.target.value); markDirty(); }}
            placeholder={"admin@example.com\nsales@example.com"}
            className={textareaCls}
          />

          {/* Fallback note or empty-state guidance */}
          {fallbackNote ? (
            <p className="mt-1 text-xs text-blue-600">
              <span className="font-medium">Active fallback:</span> {fallbackNote}
              {" — add recipients above to override."}
            </p>
          ) : (
            <p className="mt-1 text-xs text-neutral-400">
              When empty, falls back to the platform default backoffice address (
              <a href="/admin/platform/integrations/email" className="underline hover:text-neutral-600">
                Platform › Email
              </a>
              ), then the{" "}
              <code className="bg-neutral-100 px-0.5 rounded">BACKOFFICE_EMAIL</code> env var.
            </p>
          )}
        </div>

        {/* Reply-to */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="replyTo">
            Reply-to address{" "}
            <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            id="replyTo"
            type="email"
            value={replyTo}
            onChange={(e) => { setReplyTo(e.target.value); markDirty(); }}
            placeholder="support@example.com"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-neutral-400">
            When set, recipients can reply to this address instead of the transactional From address.
            Useful for routing replies to a shared support inbox.
          </p>
        </div>
      </div>

      {/* ── Save bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
        <StatusMessage status={saveStatus} errorMsg={errorMsg} isDirty={isDirty} savedText="Recipients saved." />
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === "saving" || !isDirty}
          className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
        >
          {saveStatus === "saving" ? "Saving…" : "Save recipients"}
        </button>
      </div>
    </div>
  );
}

// ── Primitive helpers ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 " +
  "placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]";

const textareaCls =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono text-neutral-800 " +
  "placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-y";

function StatusMessage({
  status,
  errorMsg,
  isDirty,
  savedText,
}: {
  status:    "idle" | "saving" | "saved" | "error";
  errorMsg:  string | null;
  isDirty:   boolean;
  savedText: string;
}) {
  if (status === "error" && errorMsg)  return <p className="text-sm text-red-600 flex-1">{errorMsg}</p>;
  if (status === "saved")              return <p className="text-sm text-green-600 flex-1">{savedText}</p>;
  if (status === "saving")             return <p className="text-sm text-neutral-400 flex-1">Saving…</p>;
  if (status === "idle" && isDirty)    return <p className="text-xs text-amber-600 flex-1">Unsaved changes</p>;
  return <span className="flex-1" />;
}

function SourceBadge({ source }: { source: ConfigSource }) {
  const styles: Record<ConfigSource, { dot: string; text: string; label: string }> = {
    tenant:   { dot: "bg-green-500",   text: "text-green-700",   label: "Tenant override" },
    platform: { dot: "bg-blue-500",    text: "text-blue-700",    label: "Platform default" },
    env:      { dot: "bg-neutral-400", text: "text-neutral-600", label: "Env var fallback" },
    system:   { dot: "bg-neutral-300", text: "text-neutral-500", label: "System default" },
    none:     { dot: "bg-amber-400",   text: "text-amber-700",   label: "Not configured" },
  };
  const s = styles[source];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
