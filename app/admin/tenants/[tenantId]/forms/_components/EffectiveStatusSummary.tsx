/**
 * EffectiveStatusSummary
 *
 * Server component rendered at the top of the tenant Forms page.
 *
 * Summarises the fully-resolved configuration state for this tenant across
 * all six key dimensions:
 *
 *   1. Email transport      — which provider is active (tenant / platform / env)
 *   2. Sender identity      — the From address that will appear on outbound email
 *   3. Notification recipients — who receives backoffice notifications
 *   4. Store submissions    — whether submissions are written to the DB
 *   5. Send confirmations   — whether submitters receive a confirmation
 *   6. Webhook              — whether a webhook fires on submission
 *
 * ─── Data contract ────────────────────────────────────────────────────────────
 *
 *   All computation is performed in page.tsx using the config resolvers.
 *   This component is pure display — it receives pre-computed props so it
 *   remains a simple, testable presentational component.
 *
 * ─── Design decisions ─────────────────────────────────────────────────────────
 *
 *   • Status rows use a consistent dot + label pattern (mirrors ConfigSourceBadge).
 *   • Warnings surface actionable guidance without blocking page use.
 *   • The component renders "not configured" states clearly so admins know
 *     what is missing rather than seeing a blank or ambiguous UI.
 */

import type { ConfigSource } from "@/lib/config";

// ── Public props ───────────────────────────────────────────────────────────────

export interface EffectiveStatusSummaryProps {
  // ── Transport
  transportType:   "resend" | "smtp" | "none";
  transportSource: ConfigSource;

  // ── Sender identity
  fromEmail:       string | null;
  fromName:        string | null;
  senderSource:    ConfigSource;   // which layer provided the from address

  // ── Recipients
  recipientCount:    number;
  recipientSample:   string | null;   // first recipient, for display
  recipientSource:   ConfigSource;

  // ── Form behaviour (from resolved TenantFormSettings)
  storeSubmissions:       boolean;
  sendConfirmationEmails: boolean;
  webhookConfigured:      boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EffectiveStatusSummary({
  transportType,
  transportSource,
  fromEmail,
  fromName,
  senderSource,
  recipientCount,
  recipientSample,
  recipientSource,
  storeSubmissions,
  sendConfirmationEmails,
  webhookConfigured,
}: EffectiveStatusSummaryProps) {
  const transportOk  = transportType !== "none";
  const recipientOk  = recipientCount > 0 || recipientSource !== "none";
  const emailReady   = transportOk && recipientOk;
  const hasWarning   = !emailReady;

  return (
    <div className={`mb-6 rounded-xl border ${hasWarning ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"} overflow-hidden`}>
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 px-5 py-3 border-b ${hasWarning ? "border-amber-200 bg-amber-100/50" : "border-neutral-100 bg-neutral-50"}`}>
        <span
          className={`h-2 w-2 rounded-full flex-shrink-0 ${emailReady ? "bg-green-500" : "bg-amber-400"}`}
          aria-hidden
        />
        <span className={`text-sm font-semibold ${hasWarning ? "text-amber-900" : "text-neutral-800"}`}>
          {emailReady ? "Email ready" : "Configuration incomplete"}
        </span>
        {hasWarning && (
          <span className="ml-auto text-xs text-amber-700">
            {!transportOk && !recipientOk
              ? "Transport and recipients not configured"
              : !transportOk
              ? "No email transport configured"
              : "No notification recipients configured"}
          </span>
        )}
      </div>

      {/* ── Status rows ─────────────────────────────────────────────────── */}
      <div className="divide-y divide-neutral-100">

        {/* Transport */}
        <StatusRow
          label="Transport"
          source={transportSource}
          value={
            transportType === "resend" ? "Resend API"
            : transportType === "smtp" ? "SMTP"
            : null
          }
          missingHint='Configure in "Email Transport" below'
        />

        {/* Sender identity */}
        <StatusRow
          label="Sender"
          source={senderSource}
          value={
            fromEmail
              ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail)
              : null
          }
          missingHint="Falls back to MAIL_FROM_ADDRESS env var"
        />

        {/* Recipients */}
        <StatusRow
          label="Recipients"
          source={recipientSource}
          value={
            recipientCount > 1
              ? `${recipientSample} + ${recipientCount - 1} more`
              : recipientCount === 1
              ? recipientSample
              : null
          }
          missingHint='Add in "Notification Recipients" below'
        />

        {/* Behaviour row: compact inline grid */}
        <div className="px-5 py-3 grid grid-cols-3 gap-x-4 gap-y-1">
          <BehaviourCell
            label="Store submissions"
            active={storeSubmissions}
          />
          <BehaviourCell
            label="Send confirmation"
            active={sendConfirmationEmails}
          />
          <BehaviourCell
            label="Webhook"
            active={webhookConfigured}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/**
 * One labelled row showing a config source badge + resolved value.
 */
function StatusRow({
  label,
  source,
  value,
  missingHint,
}: {
  label:       string;
  source:      ConfigSource;
  value:       string | null;
  missingHint: string;
}) {
  return (
    <div className="px-5 py-2.5 flex items-start gap-3 text-sm">
      <span className="w-24 flex-shrink-0 text-xs text-neutral-500 pt-px">{label}</span>
      <div className="flex-1 min-w-0">
        {value ? (
          <span className="text-neutral-800 truncate block">{value}</span>
        ) : (
          <span className="text-neutral-400 italic">{missingHint}</span>
        )}
      </div>
      <SourceBadge source={source} />
    </div>
  );
}

/** Compact on/off indicator for a behaviour flag. */
function BehaviourCell({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${active ? "bg-green-500" : "bg-neutral-300"}`}
        aria-hidden
      />
      <span className="text-xs text-neutral-600">{label}</span>
    </div>
  );
}

/**
 * Inline source badge.
 * Colours mirror ConfigSourceBadge so the two components look consistent.
 */
function SourceBadge({ source }: { source: ConfigSource }) {
  const styles: Record<ConfigSource, { dot: string; text: string; label: string }> = {
    tenant:   { dot: "bg-green-500",   text: "text-green-700",  label: "Tenant" },
    platform: { dot: "bg-blue-500",    text: "text-blue-700",   label: "Platform" },
    env:      { dot: "bg-neutral-400", text: "text-neutral-600",label: "Env var" },
    system:   { dot: "bg-neutral-300", text: "text-neutral-500",label: "Default" },
    none:     { dot: "bg-amber-400",   text: "text-amber-700",  label: "Not set" },
  };
  const s = styles[source];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${s.text} flex-shrink-0`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
