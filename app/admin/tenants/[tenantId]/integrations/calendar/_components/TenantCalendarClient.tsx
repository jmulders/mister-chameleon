"use client";

import { useState, useTransition } from "react";
import {
  saveTenantCalendarSettingsAction,
  type TenantCalendarConfig,
} from "../actions";

const TIMEZONES = [
  "Europe/Amsterdam",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function TenantCalendarClient({
  tenantId,
  initial,
  platformServiceAccountEmail,
  platformConfigured,
}: {
  tenantId:                    string;
  initial:                     TenantCalendarConfig;
  platformServiceAccountEmail: string;
  platformConfigured:          boolean;
}) {
  const [config, setConfig] = useState<TenantCalendarConfig>(initial);
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "error"; msg?: string }>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function update<K extends keyof TenantCalendarConfig>(key: K, value: TenantCalendarConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setStatus({ kind: "idle" });
  }

  function save() {
    startTransition(async () => {
      const result = await saveTenantCalendarSettingsAction(tenantId, config);
      setStatus(result.ok ? { kind: "ok", msg: "Saved." } : { kind: "error", msg: result.error });
    });
  }

  const inputCls =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
  const labelCls = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <div className="space-y-5">
      {!platformConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          The shared platform service account isn&apos;t configured yet. Set it up under{" "}
          <span className="font-medium">Platform → Integrations → Calendar</span> first.
          Bookings here won&apos;t work until then.
        </div>
      )}

      {/* Enable toggle */}
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update("enabled", e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-neutral-800">
          Use a dedicated calendar for this tenant&apos;s bookings
        </span>
      </label>

      {/* How-to */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 space-y-1">
        <p>
          Share this tenant&apos;s Google Calendar (with <strong>&quot;Make changes to events&quot;</strong>{" "}
          permission) with the shared service-account address:
        </p>
        <p className="font-mono break-all">
          {platformServiceAccountEmail || "— not configured —"}
        </p>
        <p>Then paste that calendar&apos;s ID below (Calendar settings → &quot;Integrate calendar&quot; → Calendar ID).</p>
      </div>

      {/* Calendar ID */}
      <div>
        <label className={labelCls} htmlFor="calendarId">Calendar ID</label>
        <input
          id="calendarId"
          type="text"
          value={config.calendarId}
          onChange={(e) => update("calendarId", e.target.value)}
          placeholder="bookings@tenant-domain.com"
          className={inputCls}
          disabled={!config.enabled}
        />
      </div>

      {/* Timezone */}
      <div>
        <label className={labelCls} htmlFor="bookingTimezone">Timezone</label>
        <select
          id="bookingTimezone"
          value={config.bookingTimezone}
          onChange={(e) => update("bookingTimezone", e.target.value)}
          className={inputCls}
          disabled={!config.enabled}
        >
          {TIMEZONES.includes(config.bookingTimezone) ? null : (
            <option value={config.bookingTimezone}>{config.bookingTimezone}</option>
          )}
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Working hours */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="hoursStart">First slot hour (incl.)</label>
          <input
            id="hoursStart"
            type="number"
            min={0}
            max={23}
            value={config.bookingHoursStart}
            onChange={(e) => update("bookingHoursStart", parseInt(e.target.value || "0", 10))}
            className={inputCls}
            disabled={!config.enabled}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hoursEnd">Last hour (excl.)</label>
          <input
            id="hoursEnd"
            type="number"
            min={1}
            max={24}
            value={config.bookingHoursEnd}
            onChange={(e) => update("bookingHoursEnd", parseInt(e.target.value || "0", 10))}
            className={inputCls}
            disabled={!config.enabled}
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {status.kind === "ok" && <span className="text-xs text-green-600">{status.msg}</span>}
        {status.kind === "error" && <span className="text-xs text-red-600">{status.msg}</span>}
      </div>
    </div>
  );
}
