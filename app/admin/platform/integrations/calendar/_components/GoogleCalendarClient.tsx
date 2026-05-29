"use client";

import { useState, useTransition }         from "react";
import type {
  SafeGoogleCalendarConfig,
  GoogleCalendarFormInput,
}                                           from "../actions";

interface Props {
  initialConfig: SafeGoogleCalendarConfig;
  onSave:  (input: GoogleCalendarFormInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  onClear: ()                              => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function GoogleCalendarClient({ initialConfig, onSave, onClear }: Props) {
  const [email,        setEmail]        = useState(initialConfig.serviceAccountEmail);
  const [privateKey,   setPrivateKey]   = useState("");
  const [showKey,      setShowKey]      = useState(!initialConfig.hasPrivateKey);
  const [hasKey,       setHasKey]       = useState(initialConfig.hasPrivateKey);
  const [calendarId,   setCalendarId]   = useState(initialConfig.calendarId);
  const [timezone,     setTimezone]     = useState(initialConfig.bookingTimezone);
  const [hoursStart,   setHoursStart]   = useState(initialConfig.bookingHoursStart);
  const [hoursEnd,     setHoursEnd]     = useState(initialConfig.bookingHoursEnd);

  const [isDirty,      setIsDirty]      = useState(false);
  const [saveStatus,   setSaveStatus]   = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [isPending,    startTransition] = useTransition();

  const dirty = () => { setIsDirty(true); setSaveStatus("idle"); };

  function handleSave() {
    startTransition(async () => {
      setSaveStatus("idle");
      setErrorMsg(null);

      const result = await onSave({
        serviceAccountEmail:      email.trim(),
        serviceAccountPrivateKey: showKey ? privateKey.trim() : "",
        calendarId:               calendarId.trim(),
        bookingTimezone:          timezone.trim(),
        bookingHoursStart:        hoursStart,
        bookingHoursEnd:          hoursEnd,
      });

      if (result.ok) {
        setSaveStatus("saved");
        setIsDirty(false);
        if (showKey && privateKey.trim()) {
          setHasKey(true);
          setShowKey(false);
          setPrivateKey("");
        }
      } else {
        setSaveStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  function handleClear() {
    if (!confirm("Verwijder alle Google Calendar instellingen?")) return;
    startTransition(async () => {
      const result = await onClear();
      if (result.ok) {
        setEmail(""); setCalendarId(""); setPrivateKey("");
        setHasKey(false); setShowKey(true);
        setTimezone("Europe/Amsterdam"); setHoursStart(9); setHoursEnd(17);
        setIsDirty(false); setSaveStatus("idle");
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">

      {/* Service Account */}
      <Section title="Service Account">
        <div className="space-y-4">
          <Field label="Service Account Email" hint="Uit het JSON-bestand: client_email">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); dirty(); }}
              placeholder="demo-booking@my-project.iam.gserviceaccount.com"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Private Key" hint="Uit het JSON-bestand: private_key — wordt versleuteld opgeslagen">
            {hasKey && !showKey ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
                  ✓ Sleutel opgeslagen
                </span>
                <button
                  type="button"
                  onClick={() => { setShowKey(true); dirty(); }}
                  className="text-xs text-neutral-500 underline hover:text-neutral-700"
                >
                  Vervangen
                </button>
              </div>
            ) : (
              <textarea
                value={privateKey}
                onChange={(e) => { setPrivateKey(e.target.value); dirty(); }}
                placeholder={"-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----"}
                rows={4}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-xs font-mono"
              />
            )}
          </Field>
        </div>
      </Section>

      {/* Calendar */}
      <Section title="Agenda">
        <Field label="Calendar ID" hint="Meestal je e-mailadres. Te vinden via Google Calendar → Instellingen → [Agenda] → Calendar ID">
          <input
            type="text"
            value={calendarId}
            onChange={(e) => { setCalendarId(e.target.value); dirty(); }}
            placeholder="jouw-email@gmail.com"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      {/* Booking window */}
      <Section title="Beschikbaarheidsvenster">
        <div className="space-y-4">
          <Field label="Tijdzone">
            <input
              type="text"
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); dirty(); }}
              placeholder="Europe/Amsterdam"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Begintijd (uur)">
              <input
                type="number" min={0} max={23}
                value={hoursStart}
                onChange={(e) => { setHoursStart(Number(e.target.value)); dirty(); }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Eindtijd (uur, exclusief)">
              <input
                type="number" min={1} max={24}
                value={hoursEnd}
                onChange={(e) => { setHoursEnd(Number(e.target.value)); dirty(); }}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <p className="text-xs text-neutral-400">
            Slots worden gegenereerd van {String(hoursStart).padStart(2,"0")}:00 t/m {String(hoursEnd - 1).padStart(2,"0")}:30, maandag t/m vrijdag.
          </p>
        </div>
      </Section>

      {/* Last updated */}
      {initialConfig.updatedAt && (
        <p className="text-xs text-neutral-400">
          Laatst bijgewerkt: {new Date(initialConfig.updatedAt).toLocaleString("nl-NL")}
        </p>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
        <div className="flex-1 text-sm">
          {saveStatus === "error"  && <p className="text-red-600">{errorMsg}</p>}
          {saveStatus === "saved"  && <p className="text-green-600">✓ Instellingen opgeslagen.</p>}
          {isDirty && saveStatus === "idle" && <p className="text-xs text-amber-600">Niet-opgeslagen wijzigingen</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
          >
            Wissen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !isDirty}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            {isPending ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-700 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}
