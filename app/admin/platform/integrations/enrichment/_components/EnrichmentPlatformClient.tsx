/**
 * EnrichmentPlatformClient
 *
 * Client component for the /admin/platform/integrations/enrichment page.
 * Manages credentials for all IP enrichment providers:
 *   • MaxMind GeoIP   — city / country / region from IP
 *   • Clearbit        — reverse-IP company firmographics
 *   • IPinfo Lite     — ASN / network org enrichment
 *   • Leadinfo        — IP-to-company (commercial, EMEA-strong)
 *
 * ─── Security ──────────────────────────────────────────────────────────────────
 *
 *   No secret values are held in component state or passed as props.
 *   The server page passes only boolean presence flags and non-secret config
 *   (accountId).  Secret keys are sent once to the respective server action and
 *   immediately cleared from state — they are never echoed back.
 */

"use client";

import { useState, useTransition } from "react";
import { savePlatformMaxMindAction }      from "@/app/admin/platform/settings/actions";
import {
  saveEnrichmentPlatformSettingsAction,
  saveOpenKvKPlatformSettingsAction,
  saveHolidayPlatformSettingsAction,
} from "../actions";
import {
  testNagerDateConnectionAction,
  testOpenKvKConnectionAction,
  testIpinfoConnectionAction,
  testLeadinfoConnectionAction,
  testMaxMindConnectionAction,
  testReverseGeocodeConnectionAction,
  testWeatherConnectionAction,
  testGa4HistoryConnectionAction,
  type TestConnectionResult,
} from "../test-actions";
import {
  saveReverseGeocodePlatformSettingsAction,
  saveWeatherPlatformSettingsAction,
  saveGa4HistoryPlatformSettingsAction,
} from "../actions";

// ── Shared primitives ──────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
  hint?:       string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function SecretField({
  label,
  value,
  onChange,
  hasExisting,
  placeholder,
  hint,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  hasExisting: boolean;
  placeholder: string;
  hint?:       string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
        <span className="ml-1.5 font-normal text-neutral-400">(not shown after save)</span>
      </label>
      {hasExisting && !value && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5">
          <span className="font-mono text-xs tracking-widest text-neutral-400">
            ••••••••••••••••••••••••••••••••
          </span>
          <span className="ml-auto text-[11px] text-green-600 font-medium">configured</span>
        </div>
      )}
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasExisting ? "Enter new value to replace…" : placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <p className="mt-0.5 text-[11px] text-neutral-400">
        {hint ?? "Leave blank to keep the existing value. Stored server-side only — never echoed back."}
      </p>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label:   string;
  value:   T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?:   string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label:   string;
  value:   number;
  onChange: (v: number) => void;
  min?:    number;
  max?:    number;
  step?:   number;
  hint?:   string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step ?? 1}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label:       string;
  description: string;
  checked:     boolean;
  onChange:    (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-brand-600" : "bg-neutral-200"}`} />
        <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </div>
      <div>
        <span className="text-xs font-medium text-neutral-700">{label}</span>
        <p className="text-[11px] text-neutral-400">{description}</p>
      </div>
    </label>
  );
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

function SaveFooter({
  isPending,
  saveState,
  onSave,
  onDismiss,
}: {
  isPending:  boolean;
  saveState:  SaveState;
  onSave:     () => void;
  onDismiss:  () => void;
}) {
  // No margin — spacing is managed by the CardFooter wrapper.
  return (
    <>
      <button
        onClick={onSave}
        disabled={isPending}
        className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save settings"}
      </button>

      {saveState.mode === "success" && (
        <span className="flex items-center gap-1.5 text-xs text-green-700">
          ✓ Settings saved
          <button onClick={onDismiss} className="text-[11px] text-neutral-400 underline hover:text-neutral-600">
            Dismiss
          </button>
        </span>
      )}

      {saveState.mode === "error" && (
        <span className="flex items-center gap-1.5 text-xs text-red-700">
          {saveState.message}
          <button onClick={onDismiss} className="text-[11px] text-neutral-400 underline hover:text-neutral-600">
            Dismiss
          </button>
        </span>
      )}
    </>
  );
}

/**
 * Consistent action row used as the footer of every integration card.
 * Provides a divider line, uniform top spacing, and a flex layout so that
 * the Save button and optional Test button are always visually aligned.
 */
function CardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
      {children}
    </div>
  );
}

// ── Test connection primitives ─────────────────────────────────────────────────

type TestState =
  | { mode: "idle" }
  | { mode: "testing" }
  | { mode: "done"; result: TestConnectionResult };

/** Error type → human-readable badge label */
const ERROR_TYPE_LABEL: Record<string, string> = {
  config:  "Not configured",
  auth:    "Auth error",
  empty:   "Empty response",
  network: "Network error",
  unknown: "Error",
};

function TestResultPanel({ state, onDismiss }: { state: TestState; onDismiss: () => void }) {
  if (state.mode === "idle") return null;

  if (state.mode === "testing") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        <svg className="h-3.5 w-3.5 animate-spin text-neutral-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Testing connection…
      </div>
    );
  }

  const { result } = state;

  if (result.ok) {
    return (
      <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-green-700">✓ Connected</span>
            <span className="text-[11px] text-green-600">{result.latencyMs} ms</span>
          </div>
          <button onClick={onDismiss} className="text-[11px] text-neutral-400 underline hover:text-neutral-600">
            Dismiss
          </button>
        </div>
        <dl className="space-y-0.5">
          {result.fields.map((f) =>
            f.value != null ? (
              <div key={f.label} className="flex items-baseline gap-1.5 text-[11px]">
                <dt className="shrink-0 font-medium text-neutral-600 after:content-[':']">{f.label}</dt>
                <dd className="text-neutral-700 break-all">{f.value}</dd>
              </div>
            ) : null
          )}
        </dl>
      </div>
    );
  }

  // Failure
  const errorLabel = ERROR_TYPE_LABEL[result.errorType] ?? "Error";
  const borderColor =
    result.errorType === "config"  ? "border-neutral-200"  :
    result.errorType === "auth"    ? "border-orange-200"   :
    "border-red-200";
  const bgColor =
    result.errorType === "config"  ? "bg-neutral-50"    :
    result.errorType === "auth"    ? "bg-orange-50"     :
    "bg-red-50";
  const badgeColor =
    result.errorType === "config"  ? "bg-neutral-100 text-neutral-600"  :
    result.errorType === "auth"    ? "bg-orange-100 text-orange-700"    :
    "bg-red-100 text-red-700";
  const textColor =
    result.errorType === "config"  ? "text-neutral-700" :
    result.errorType === "auth"    ? "text-orange-800"  :
    "text-red-800";

  return (
    <div className={`mt-3 rounded-md border ${borderColor} ${bgColor} px-3 py-2`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${badgeColor}`}>
            {errorLabel}
          </span>
          <span className="text-[11px] text-neutral-400">{result.latencyMs} ms</span>
        </div>
        <button onClick={onDismiss} className="text-[11px] text-neutral-400 underline hover:text-neutral-600">
          Dismiss
        </button>
      </div>
      <p className={`text-[11px] leading-relaxed ${textColor}`}>{result.message}</p>
    </div>
  );
}

function TestButton({
  isTesting,
  onTest,
}: {
  isTesting: boolean;
  onTest:    () => void;
}) {
  return (
    <button
      onClick={onTest}
      disabled={isTesting}
      className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isTesting ? "Testing…" : "Test connection"}
    </button>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface EnrichmentPlatformClientProps {
  // MaxMind
  accountId:           string;
  hasLicenseKey:       boolean;
  updatedAt:           string | null;
  // Clearbit / IPinfo / Leadinfo / overheid.io
  hasClearbitKey:      boolean;
  hasIpinfoToken:      boolean;
  hasLeadinfoKey:      boolean;
  hasOvioApiKey:       boolean;
  enrichmentUpdatedAt: string | null;
  // OpenKvK
  openKvKMode:                "off" | "nl-only" | "always";
  openKvKConfidenceThreshold: number;
  openKvKMatchingStrategy:    "networkOrg" | "companyName" | "networkDomain";
  openKvKUpdatedAt:           string | null;
  // Holidays / Nager.Date
  holidayEnabled:         boolean;
  holidayCacheTtlHours:   number;
  holidayCountriesFilter: string;
  holidayUpdatedAt:       string | null;
  // Reverse Geocode
  reverseGeocodeEnabled:            boolean;
  reverseGeocodeHasLocationIqKey:   boolean;
  reverseGeocodeCacheTtlHours:      number;
  reverseGeocodeUpdatedAt:          string | null;
  // Weather (Open-Meteo — no API key required)
  weatherEnabled:       boolean;
  weatherCacheTtlHours: number;
  weatherUpdatedAt:     string | null;
  // GA4 Analytics History
  ga4HistoryEnabled:            boolean;
  ga4HistoryHasServiceAccount:  boolean;
  ga4HistoryPropertyId:         string;
  ga4HistoryVisitorIdDimension: string;
  ga4HistoryLookbackDays:       number;
  ga4HistoryCacheTtlMinutes:    number;
  // GA4 Tracking (send)
  ga4HistoryMeasurementId:      string;
  ga4HistoryVisitorIdParamName: string;
  ga4HistorySendMode:           "off" | "client" | "server";
  ga4HistoryUpdatedAt:          string | null;
}

// ── Root component ─────────────────────────────────────────────────────────────

export function EnrichmentPlatformClient({
  accountId:                  initialAccountId,
  hasLicenseKey:              initialHasLicenseKey,
  updatedAt:                  initialUpdatedAt,
  hasClearbitKey:             initialHasClearbitKey,
  hasIpinfoToken:             initialHasIpinfoToken,
  hasLeadinfoKey:             initialHasLeadinfoKey,
  hasOvioApiKey:              initialHasOvioApiKey,
  enrichmentUpdatedAt:        initialEnrichmentUpdatedAt,
  openKvKMode:                initialOpenKvKMode,
  openKvKConfidenceThreshold: initialOpenKvKConfidence,
  openKvKMatchingStrategy:    initialOpenKvKStrategy,
  openKvKUpdatedAt:           initialOpenKvKUpdatedAt,
  holidayEnabled:             initialHolidayEnabled,
  holidayCacheTtlHours:       initialHolidayCacheTtlHours,
  holidayCountriesFilter:     initialHolidayCountriesFilter,
  holidayUpdatedAt:           initialHolidayUpdatedAt,
  reverseGeocodeEnabled:           initialReverseGeocodeEnabled,
  reverseGeocodeHasLocationIqKey:  initialReverseGeocodeHasLocationIqKey,
  reverseGeocodeCacheTtlHours:     initialReverseGeocodeCacheTtlHours,
  reverseGeocodeUpdatedAt:         initialReverseGeocodeUpdatedAt,
  weatherEnabled:       initialWeatherEnabled,
  weatherCacheTtlHours: initialWeatherCacheTtlHours,
  weatherUpdatedAt:     initialWeatherUpdatedAt,
  ga4HistoryEnabled:            initialGa4HistoryEnabled,
  ga4HistoryHasServiceAccount:  initialGa4HistoryHasServiceAccount,
  ga4HistoryPropertyId:         initialGa4HistoryPropertyId,
  ga4HistoryVisitorIdDimension: initialGa4HistoryVisitorIdDimension,
  ga4HistoryLookbackDays:       initialGa4HistoryLookbackDays,
  ga4HistoryCacheTtlMinutes:    initialGa4HistoryCacheTtlMinutes,
  ga4HistoryMeasurementId:      initialGa4HistoryMeasurementId,
  ga4HistoryVisitorIdParamName: initialGa4HistoryVisitorIdParamName,
  ga4HistorySendMode:           initialGa4HistorySendMode,
  ga4HistoryUpdatedAt:          initialGa4HistoryUpdatedAt,
}: EnrichmentPlatformClientProps) {

  // ── MaxMind state ───────────────────────────────────────────────────────────
  const [accountId,  setAccountId]  = useState(initialAccountId);
  const [licenseKey, setLicenseKey] = useState("");
  const [hasKey,     setHasKey]     = useState(initialHasLicenseKey);
  const [mmUpdatedAt, setMmUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [mmSaveState, setMmSaveState] = useState<SaveState>({ mode: "idle" });
  const [mmPending,  startMmTransition] = useTransition();
  const [mmTestState, setMmTestState] = useState<TestState>({ mode: "idle" });
  const [mmTestPending, startMmTestTransition] = useTransition();

  // ── Enrichment provider state ───────────────────────────────────────────────
  const [clearbitKey,  setClearbitKey]  = useState("");
  const [ipinfoToken,  setIpinfoToken]  = useState("");
  const [leadinfoKey,  setLeadinfoKey]  = useState("");
  const [ovioKey,      setOvioKey]      = useState("");
  const [hasClearbit,  setHasClearbit]  = useState(initialHasClearbitKey);
  const [hasIpinfo,    setHasIpinfo]    = useState(initialHasIpinfoToken);
  const [hasLeadinfo,  setHasLeadinfo]  = useState(initialHasLeadinfoKey);
  const [hasOvio,      setHasOvio]      = useState(initialHasOvioApiKey);
  const [enrichUpdatedAt, setEnrichUpdatedAt] = useState<string | null>(initialEnrichmentUpdatedAt);
  const [enrichSaveState, setEnrichSaveState] = useState<SaveState>({ mode: "idle" });
  const [enrichPending, startEnrichTransition] = useTransition();
  const [ipinfoTestState, setIpinfoTestState] = useState<TestState>({ mode: "idle" });
  const [ipinfoTestPending, startIpinfoTestTransition] = useTransition();
  const [leadinfoTestState, setLeadinfoTestState] = useState<TestState>({ mode: "idle" });
  const [leadinfoTestPending, startLeadinfoTestTransition] = useTransition();

  // ── OpenKvK state ───────────────────────────────────────────────────────────
  const [openKvKMode,       setOpenKvKMode]       = useState<"off" | "nl-only" | "always">(initialOpenKvKMode);
  const [openKvKConfidence, setOpenKvKConfidence] = useState(initialOpenKvKConfidence);
  const [openKvKStrategy,   setOpenKvKStrategy]   = useState<"networkOrg" | "companyName" | "networkDomain">(initialOpenKvKStrategy);
  const [openKvKUpdatedAt,  setOpenKvKUpdatedAt]  = useState<string | null>(initialOpenKvKUpdatedAt);
  const [openKvKSaveState,  setOpenKvKSaveState]  = useState<SaveState>({ mode: "idle" });
  const [openKvKPending,    startOpenKvKTransition] = useTransition();
  const [openKvKTestState,  setOpenKvKTestState]  = useState<TestState>({ mode: "idle" });
  const [openKvKTestPending, startOpenKvKTestTransition] = useTransition();
  // Test inputs — defaults give a reliable result for quick connectivity checks.
  const [openKvKTestQuery,  setOpenKvKTestQuery]  = useState("ING");
  const [openKvKTestCity,   setOpenKvKTestCity]   = useState("Amsterdam");

  // ── Holiday state ───────────────────────────────────────────────────────────
  const [holidayEnabled,   setHolidayEnabled]   = useState(initialHolidayEnabled);
  const [holidayTtl,       setHolidayTtl]       = useState(initialHolidayCacheTtlHours);
  const [holidayCountries, setHolidayCountries] = useState(initialHolidayCountriesFilter);
  const [holidayUpdatedAt, setHolidayUpdatedAt] = useState<string | null>(initialHolidayUpdatedAt);
  const [holidaySaveState, setHolidaySaveState] = useState<SaveState>({ mode: "idle" });
  const [holidayPending,   startHolidayTransition] = useTransition();
  const [nagerTestState,   setNagerTestState]   = useState<TestState>({ mode: "idle" });
  const [nagerTestPending, startNagerTestTransition] = useTransition();

  // ── Reverse Geocode state ───────────────────────────────────────────────────
  const [rgEnabled,    setRgEnabled]    = useState(initialReverseGeocodeEnabled);
  const [rgLocationIqKey, setRgLocationIqKey] = useState("");
  const [rgHasLocationIqKey, setRgHasLocationIqKey] = useState(initialReverseGeocodeHasLocationIqKey);
  const [rgCacheTtl,   setRgCacheTtl]   = useState(initialReverseGeocodeCacheTtlHours);
  const [rgUpdatedAt,  setRgUpdatedAt]  = useState<string | null>(initialReverseGeocodeUpdatedAt);
  const [rgSaveState,  setRgSaveState]  = useState<SaveState>({ mode: "idle" });
  const [rgPending,    startRgTransition] = useTransition();
  const [rgTestState,  setRgTestState]  = useState<TestState>({ mode: "idle" });
  const [rgTestPending, startRgTestTransition] = useTransition();

  // ── Weather state ────────────────────────────────────────────────────────────
  const [wxEnabled,   setWxEnabled]   = useState(initialWeatherEnabled);
  const [wxCacheTtl,  setWxCacheTtl]  = useState(initialWeatherCacheTtlHours);
  const [wxUpdatedAt, setWxUpdatedAt] = useState<string | null>(initialWeatherUpdatedAt);
  const [wxSaveState, setWxSaveState] = useState<SaveState>({ mode: "idle" });
  const [wxPending,   startWxTransition] = useTransition();
  const [wxTestState, setWxTestState] = useState<TestState>({ mode: "idle" });
  const [wxTestPending, startWxTestTransition] = useTransition();

  // ── GA4 History state ────────────────────────────────────────────────────────
  const [ga4Enabled,          setGa4Enabled]          = useState(initialGa4HistoryEnabled);
  const [ga4PropertyId,       setGa4PropertyId]       = useState(initialGa4HistoryPropertyId);
  const [ga4ServiceJson,      setGa4ServiceJson]      = useState("");
  const [ga4HasServiceAcc,    setGa4HasServiceAcc]    = useState(initialGa4HistoryHasServiceAccount);
  const [ga4VisitorDim,       setGa4VisitorDim]       = useState(initialGa4HistoryVisitorIdDimension);
  const [ga4LookbackDays,     setGa4LookbackDays]     = useState(initialGa4HistoryLookbackDays);
  const [ga4CacheTtl,         setGa4CacheTtl]         = useState(initialGa4HistoryCacheTtlMinutes);
  const [ga4MeasurementId,    setGa4MeasurementId]    = useState(initialGa4HistoryMeasurementId);
  const [ga4VisitorParamName, setGa4VisitorParamName] = useState(initialGa4HistoryVisitorIdParamName);
  const [ga4SendMode,         setGa4SendMode]         = useState<"off" | "client" | "server">(initialGa4HistorySendMode);
  const [ga4UpdatedAt,        setGa4UpdatedAt]        = useState<string | null>(initialGa4HistoryUpdatedAt);
  const [ga4SaveState,        setGa4SaveState]        = useState<SaveState>({ mode: "idle" });
  const [ga4Pending,          startGa4Transition]     = useTransition();
  const [ga4TestState,        setGa4TestState]        = useState<TestState>({ mode: "idle" });
  const [ga4TestPending,      startGa4TestTransition] = useTransition();

  // ── "Test all" state ────────────────────────────────────────────────────────
  const [testAllPending, startTestAllTransition] = useTransition();

  // ── OpenKvK save ────────────────────────────────────────────────────────────
  function handleOpenKvKSave() {
    startOpenKvKTransition(async () => {
      setOpenKvKSaveState({ mode: "saving" });
      const result = await saveOpenKvKPlatformSettingsAction({
        mode:                openKvKMode,
        confidenceThreshold: openKvKConfidence,
        matchingStrategy:    openKvKStrategy,
      });
      if (result.ok) {
        setOpenKvKUpdatedAt(new Date().toISOString());
        setOpenKvKSaveState({ mode: "success" });
      } else {
        setOpenKvKSaveState({ mode: "error", message: result.error });
      }
    });
  }

  // ── Holiday save ────────────────────────────────────────────────────────────
  function handleHolidaySave() {
    startHolidayTransition(async () => {
      setHolidaySaveState({ mode: "saving" });
      const result = await saveHolidayPlatformSettingsAction({
        enabled:         holidayEnabled,
        cacheTtlHours:   holidayTtl,
        countriesFilter: holidayCountries,
      });
      if (result.ok) {
        setHolidayUpdatedAt(new Date().toISOString());
        setHolidaySaveState({ mode: "success" });
      } else {
        setHolidaySaveState({ mode: "error", message: result.error });
      }
    });
  }

  // ── MaxMind save ────────────────────────────────────────────────────────────
  function handleMmSave() {
    startMmTransition(async () => {
      setMmSaveState({ mode: "saving" });
      const result = await savePlatformMaxMindAction({
        accountId,
        licenseKey: licenseKey || undefined,
      });
      if (result.ok) {
        if (licenseKey) setHasKey(true);
        setLicenseKey("");
        setMmUpdatedAt(new Date().toISOString());
        setMmSaveState({ mode: "success" });
      } else {
        setMmSaveState({ mode: "error", message: result.error });
      }
    });
  }

  // ── Enrichment providers save ───────────────────────────────────────────────
  function handleEnrichSave() {
    startEnrichTransition(async () => {
      setEnrichSaveState({ mode: "saving" });
      const result = await saveEnrichmentPlatformSettingsAction({
        clearbitSecretKey: clearbitKey || undefined,
        ipinfoToken:       ipinfoToken || undefined,
        leadinfoApiKey:    leadinfoKey || undefined,
        ovioApiKey:        ovioKey     || undefined,
      });
      if (result.ok) {
        if (clearbitKey) setHasClearbit(true);
        if (ipinfoToken) setHasIpinfo(true);
        if (leadinfoKey) setHasLeadinfo(true);
        if (ovioKey)     setHasOvio(true);
        setClearbitKey("");
        setIpinfoToken("");
        setLeadinfoKey("");
        setEnrichUpdatedAt(new Date().toISOString());
        setEnrichSaveState({ mode: "success" });
      } else {
        setEnrichSaveState({ mode: "error", message: result.error });
      }
    });
  }

  // ── Reverse Geocode save ────────────────────────────────────────────────────
  function handleRgSave() {
    startRgTransition(async () => {
      setRgSaveState({ mode: "saving" });
      const result = await saveReverseGeocodePlatformSettingsAction({
        enabled:          rgEnabled,
        locationIqApiKey: rgLocationIqKey || undefined,
        cacheTtlHours:    rgCacheTtl,
      });
      if (result.ok) {
        if (rgLocationIqKey) setRgHasLocationIqKey(true);
        setRgLocationIqKey("");
        setRgUpdatedAt(new Date().toISOString());
        setRgSaveState({ mode: "success" });
      } else {
        setRgSaveState({ mode: "error", message: result.error });
      }
    });
  }

  // ── Individual test handlers ────────────────────────────────────────────────

  function handleTestMaxMind() {
    startMmTestTransition(async () => {
      setMmTestState({ mode: "testing" });
      const result = await testMaxMindConnectionAction();
      setMmTestState({ mode: "done", result });
    });
  }

  function handleTestIpinfo() {
    startIpinfoTestTransition(async () => {
      setIpinfoTestState({ mode: "testing" });
      const result = await testIpinfoConnectionAction();
      setIpinfoTestState({ mode: "done", result });
    });
  }

  function handleTestLeadinfo() {
    startLeadinfoTestTransition(async () => {
      setLeadinfoTestState({ mode: "testing" });
      const result = await testLeadinfoConnectionAction();
      setLeadinfoTestState({ mode: "done", result });
    });
  }

  function handleTestOpenKvK() {
    startOpenKvKTestTransition(async () => {
      setOpenKvKTestState({ mode: "testing" });
      const result = await testOpenKvKConnectionAction(
        openKvKTestQuery || "ING",
        openKvKTestCity  || undefined,
      );
      setOpenKvKTestState({ mode: "done", result });
    });
  }

  function handleTestNager() {
    startNagerTestTransition(async () => {
      setNagerTestState({ mode: "testing" });
      const result = await testNagerDateConnectionAction();
      setNagerTestState({ mode: "done", result });
    });
  }

  function handleTestReverseGeocode() {
    startRgTestTransition(async () => {
      setRgTestState({ mode: "testing" });
      const result = await testReverseGeocodeConnectionAction();
      setRgTestState({ mode: "done", result });
    });
  }

  // ── Weather save ─────────────────────────────────────────────────────────────
  function handleWxSave() {
    startWxTransition(async () => {
      setWxSaveState({ mode: "saving" });
      const result = await saveWeatherPlatformSettingsAction({
        enabled:       wxEnabled,
        cacheTtlHours: wxCacheTtl,
      });
      if (result.ok) {
        setWxUpdatedAt(new Date().toISOString());
        setWxSaveState({ mode: "success" });
      } else {
        setWxSaveState({ mode: "error", message: result.error });
      }
    });
  }

  function handleTestWeather() {
    startWxTestTransition(async () => {
      setWxTestState({ mode: "testing" });
      const result = await testWeatherConnectionAction();
      setWxTestState({ mode: "done", result });
    });
  }

  // ── GA4 History save ──────────────────────────────────────────────────────────
  function handleGa4Save() {
    startGa4Transition(async () => {
      setGa4SaveState({ mode: "saving" });
      const result = await saveGa4HistoryPlatformSettingsAction({
        enabled:            ga4Enabled,
        propertyId:         ga4PropertyId,
        serviceAccountJson: ga4ServiceJson || undefined,
        visitorIdDimension: ga4VisitorDim,
        lookbackDays:       ga4LookbackDays,
        cacheTtlMinutes:    ga4CacheTtl,
        measurementId:      ga4MeasurementId,
        visitorIdParamName: ga4VisitorParamName,
        sendMode:           ga4SendMode,
      });
      if (result.ok) {
        setGa4UpdatedAt(new Date().toISOString());
        setGa4SaveState({ mode: "success" });
        if (ga4ServiceJson) {
          setGa4HasServiceAcc(true);
          setGa4ServiceJson("");
        }
      } else {
        setGa4SaveState({ mode: "error", message: result.error });
      }
    });
  }

  function handleTestGa4() {
    startGa4TestTransition(async () => {
      setGa4TestState({ mode: "testing" });
      const result = await testGa4HistoryConnectionAction();
      setGa4TestState({ mode: "done", result });
    });
  }

  // ── "Test all" handler ──────────────────────────────────────────────────────

  function handleTestAll() {
    startTestAllTransition(async () => {
      // Reset all to testing
      setMmTestState({ mode: "testing" });
      setIpinfoTestState({ mode: "testing" });
      setLeadinfoTestState({ mode: "testing" });
      setOpenKvKTestState({ mode: "testing" });
      setNagerTestState({ mode: "testing" });
      setRgTestState({ mode: "testing" });
      setWxTestState({ mode: "testing" });

      // Run all in parallel
      const [mm, ipinfo, leadinfo, openkvk, nager, rg, wx] = await Promise.all([
        testMaxMindConnectionAction(),
        testIpinfoConnectionAction(),
        testLeadinfoConnectionAction(),
        testOpenKvKConnectionAction(openKvKTestQuery || "ING", openKvKTestCity || undefined),
        testNagerDateConnectionAction(),
        testReverseGeocodeConnectionAction(),
        testWeatherConnectionAction(),
      ]);

      setMmTestState({ mode: "done", result: mm });
      setIpinfoTestState({ mode: "done", result: ipinfo });
      setLeadinfoTestState({ mode: "done", result: leadinfo });
      setOpenKvKTestState({ mode: "done", result: openkvk });
      setNagerTestState({ mode: "done", result: nager });
      setRgTestState({ mode: "done", result: rg });
      setWxTestState({ mode: "done", result: wx });
    });
  }

  return (
    <div className="space-y-6">

      {/* ── "Test all" button ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-neutral-800">Test all integrations</p>
          <p className="text-[11px] text-neutral-400">
            Runs a quick connectivity check on every integration in parallel. Results appear inline in each card.
          </p>
        </div>
        <button
          onClick={handleTestAll}
          disabled={testAllPending}
          className="shrink-0 rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testAllPending ? "Testing all…" : "Test all"}
        </button>
      </div>

      {/* ── MaxMind GeoIP ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">MaxMind GeoIP</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                hasKey ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {hasKey ? "✓ License key configured" : "License key not set"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              IP geolocation credentials — resolves country, region, and city from IP addresses.
            </p>
          </div>
          {mmUpdatedAt && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatDate(mmUpdatedAt)}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <TextField
            label="Account ID"
            value={accountId}
            onChange={setAccountId}
            placeholder="e.g. 123456"
            hint="Your MaxMind account ID (numeric). Found at maxmind.com → Account."
          />
          <SecretField
            label="License key"
            value={licenseKey}
            onChange={setLicenseKey}
            hasExisting={hasKey}
            placeholder="abcdef123456..."
          />
        </div>

        <CardFooter>
          <SaveFooter
            isPending={mmPending}
            saveState={mmSaveState}
            onSave={handleMmSave}
            onDismiss={() => setMmSaveState({ mode: "idle" })}
          />
          <TestButton isTesting={mmTestPending || mmTestState.mode === "testing"} onTest={handleTestMaxMind} />
        </CardFooter>
        <TestResultPanel state={mmTestState} onDismiss={() => setMmTestState({ mode: "idle" })} />
      </div>

      {/* ── Clearbit Reveal ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">Clearbit Reveal</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                hasClearbit ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {hasClearbit ? "✓ Secret key configured" : "Secret key not set"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Reverse-IP firmographic lookup — identifies the company behind an IP address.
              Returns company name, domain, industry, and employee size range.
            </p>
          </div>
          {enrichUpdatedAt && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatDate(enrichUpdatedAt)}
            </span>
          )}
        </div>

        <SecretField
          label="Clearbit secret key"
          value={clearbitKey}
          onChange={setClearbitKey}
          hasExisting={hasClearbit}
          placeholder="sk_live_..."
          hint='Found at clearbit.com → API Keys. Format: "sk_live_…"'
        />

        <CardFooter>
          <SaveFooter
            isPending={enrichPending}
            saveState={enrichSaveState}
            onSave={handleEnrichSave}
            onDismiss={() => setEnrichSaveState({ mode: "idle" })}
          />
        </CardFooter>
      </div>

      {/* ── IPinfo Lite ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">IPinfo Lite</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                hasIpinfo ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {hasIpinfo ? "✓ Token configured" : "Token not set"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              ASN and network organisation enrichment — resolves the ISP or company behind an IP&apos;s
              autonomous system. Returns networkAsn, networkOrg, and networkDomain. Also provides
              geo data as a fallback when MaxMind is not configured.
            </p>
          </div>
        </div>

        <SecretField
          label="IPinfo API token"
          value={ipinfoToken}
          onChange={setIpinfoToken}
          hasExisting={hasIpinfo}
          placeholder="abc123def..."
          hint="Found at ipinfo.io → Token. Free plan: 50,000 req/month."
        />

        <CardFooter>
          <SaveFooter
            isPending={enrichPending}
            saveState={enrichSaveState}
            onSave={handleEnrichSave}
            onDismiss={() => setEnrichSaveState({ mode: "idle" })}
          />
          <TestButton isTesting={ipinfoTestPending || ipinfoTestState.mode === "testing"} onTest={handleTestIpinfo} />
        </CardFooter>
        <TestResultPanel state={ipinfoTestState} onDismiss={() => setIpinfoTestState({ mode: "idle" })} />
      </div>

      {/* ── Leadinfo ───────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">Leadinfo</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                hasLeadinfo ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {hasLeadinfo ? "✓ API key configured" : "API key not set"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Commercial IP-to-company identification, particularly strong in Western Europe.
              Returns company name, domain, industry, size, and geo information.
              Activated per-tenant via the Leadinfo toggle in each tenant&apos;s Integrations tab.
            </p>
          </div>
        </div>

        <SecretField
          label="Leadinfo API key"
          value={leadinfoKey}
          onChange={setLeadinfoKey}
          hasExisting={hasLeadinfo}
          placeholder="ld_..."
          hint="Found at app.leadinfo.com → Settings → API. Commercial plan required."
        />

        <CardFooter>
          <SaveFooter
            isPending={enrichPending}
            saveState={enrichSaveState}
            onSave={handleEnrichSave}
            onDismiss={() => setEnrichSaveState({ mode: "idle" })}
          />
          <TestButton isTesting={leadinfoTestPending || leadinfoTestState.mode === "testing"} onTest={handleTestLeadinfo} />
        </CardFooter>
        <TestResultPanel state={leadinfoTestState} onDismiss={() => setLeadinfoTestState({ mode: "idle" })} />
      </div>

      {/* ── overheid.io (OpenKvK API key) ─────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">overheid.io</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                hasOvio ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                {hasOvio ? "✓ API key configured" : "API key required"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              API key for the OpenKvK Dutch company registry endpoint (<code className="mx-1 rounded bg-neutral-100 px-1 font-mono text-[11px]">api.overheid.io/v3/openkvk</code>).
              Free account at <a href="https://overheid.io/register" target="_blank" rel="noreferrer" className="underline hover:text-neutral-700">overheid.io/register</a>.
            </p>
          </div>
        </div>

        <SecretField
          label="overheid.io API key"
          value={ovioKey}
          onChange={setOvioKey}
          hasExisting={hasOvio}
          placeholder="••••••••••••••••"
          hint="Sent as the ovio-api-key header. Required for OpenKvK company lookups."
        />

        <CardFooter>
          <SaveFooter
            isPending={enrichPending}
            saveState={enrichSaveState}
            onSave={handleEnrichSave}
            onDismiss={() => setEnrichSaveState({ mode: "idle" })}
          />
        </CardFooter>
      </div>

      {/* ── OpenKvK (Dutch company registry) ──────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">OpenKvK — Dutch Company Registry</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                openKvKMode !== "off" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {openKvKMode === "off" ? "Disabled" : openKvKMode === "nl-only" ? "NL visitors only" : "All visitors"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Looks up Dutch companies by name and resolves
              <code className="mx-1 rounded bg-neutral-100 px-1 font-mono text-[11px]">companyName</code>,
              <code className="mx-1 rounded bg-neutral-100 px-1 font-mono text-[11px]">companyDomain</code>, and
              <code className="mx-1 rounded bg-neutral-100 px-1 font-mono text-[11px]">city</code>.
              Requires a free <strong>overheid.io</strong> API key (register at overheid.io).
              Enable per-tenant via the OpenKvK toggle in each tenant&apos;s Integrations tab.
            </p>
          </div>
          {openKvKUpdatedAt && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatDate(openKvKUpdatedAt)}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <SelectField
            label="Mode"
            value={openKvKMode}
            onChange={setOpenKvKMode}
            options={[
              { value: "off",     label: "Off — stage disabled" },
              { value: "nl-only", label: "NL only — run for Dutch visitors (countryCode = NL)" },
              { value: "always",  label: "Always — run regardless of country" },
            ]}
            hint='Use "NL only" (default) for accurate results. "Always" is useful when geo is unavailable.'
          />
          <NumberField
            label="Confidence threshold"
            value={openKvKConfidence}
            onChange={setOpenKvKConfidence}
            min={0}
            max={1}
            step={0.05}
            hint="Minimum match score (0–1). Results below this threshold are discarded. Default: 0.5."
          />
          <SelectField
            label="Matching strategy (preferred query field)"
            value={openKvKStrategy}
            onChange={setOpenKvKStrategy}
            options={[
              { value: "networkOrg",    label: "networkOrg — ISP/org name from IPinfo (default)" },
              { value: "companyName",   label: "companyName — company name from prior stage" },
              { value: "networkDomain", label: "networkDomain — network domain from IPinfo" },
            ]}
            hint="Sets which upstream field is tried first. The provider always falls back through all three."
          />
        </div>

        {/* ── OpenKvK test inputs ─────────────────────────────────────────── */}
        <div className="mt-4 rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600">
            <span className="inline-flex items-center justify-center rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold text-neutral-600 tracking-wide">TEST</span>
            Test inputs
          </p>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Company name"
              value={openKvKTestQuery}
              onChange={setOpenKvKTestQuery}
              placeholder="e.g. ING"
              hint="Search query sent to OpenKvK API."
            />
            <TextField
              label="City (optional)"
              value={openKvKTestCity}
              onChange={setOpenKvKTestCity}
              placeholder="e.g. Amsterdam"
              hint="Narrows results to a city. Leave blank to search all."
            />
          </div>
        </div>

        <CardFooter>
          <SaveFooter
            isPending={openKvKPending}
            saveState={openKvKSaveState}
            onSave={handleOpenKvKSave}
            onDismiss={() => setOpenKvKSaveState({ mode: "idle" })}
          />
          <TestButton isTesting={openKvKTestPending || openKvKTestState.mode === "testing"} onTest={handleTestOpenKvK} />
        </CardFooter>
        <TestResultPanel state={openKvKTestState} onDismiss={() => setOpenKvKTestState({ mode: "idle" })} />
      </div>

      {/* ── Nager.Date / Holiday provider ─────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">Nager.Date — Public Holiday Provider</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                holidayEnabled ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {holidayEnabled ? "✓ Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              No API key required — free public API (date.nager.at). Detects public holidays for the
              visitor&apos;s country and maps them to
              <code className="mx-1 rounded bg-neutral-100 px-1 font-mono text-[11px]">seasonalEvent</code>
              values (christmas, new-year, easter). Business events (black-friday, cyber-monday,
              back-to-school) are computed without an API call and always run when enabled.
            </p>
          </div>
          {holidayUpdatedAt && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatDate(holidayUpdatedAt)}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <ToggleField
            label="Enable holiday detection"
            description="When disabled, the seasonal event stage is skipped entirely and the static seasonalEvent is used unchanged."
            checked={holidayEnabled}
            onChange={setHolidayEnabled}
          />
          <NumberField
            label="Cache TTL (hours)"
            value={holidayTtl}
            onChange={setHolidayTtl}
            min={1}
            max={720}
            step={1}
            hint="How long to cache the holiday list per country per year. Default: 24 hours. Public holiday lists are stable within a year."
          />
          <TextField
            label="Countries filter (comma-separated ISO codes)"
            value={holidayCountries}
            onChange={setHolidayCountries}
            placeholder="e.g. NL,DE,BE,GB,FR"
            hint='Leave empty to enable all countries supported by Nager.Date. Use ISO 3166-1 alpha-2 codes (e.g. "NL,DE,BE").'
          />
        </div>

        <CardFooter>
          <SaveFooter
            isPending={holidayPending}
            saveState={holidaySaveState}
            onSave={handleHolidaySave}
            onDismiss={() => setHolidaySaveState({ mode: "idle" })}
          />
          <TestButton isTesting={nagerTestPending || nagerTestState.mode === "testing"} onTest={handleTestNager} />
        </CardFooter>
        <TestResultPanel state={nagerTestState} onDismiss={() => setNagerTestState({ mode: "idle" })} />
      </div>

      {/* ── Reverse Geocode ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">Reverse Geocode — Address Enrichment</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                rgEnabled ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {rgEnabled ? "✓ Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Resolves approximate lat/lng coordinates (from MaxMind or ip-api) into human-readable
              address fields. Runs after the geo stage. Not used for company identification —
              address fields are a location hint for downstream consumers such as OpenKvK scoring.
            </p>
          </div>
          {rgUpdatedAt && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatDate(rgUpdatedAt)}
            </span>
          )}
        </div>

        <div className="mb-4 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-700">Provider chain</strong> (first success wins):{" "}
          <span className="font-medium text-neutral-700">1. LocationIQ</span> (requires key, 5 k/day free) →{" "}
          <span className="font-medium text-neutral-700">2. BigDataCloud</span> (no key, 10 k/month free) →{" "}
          <span className="font-medium text-neutral-700">3. Nominatim</span> (no key, OSM, 1 req/sec).
        </div>

        <div className="space-y-4">
          <ToggleField
            label="Enable reverse geocode enrichment"
            description="When enabled, runs after the geo stage whenever lat/lng is available and enriches addressCity, addressRegion, addressPostcode, addressFormatted, and addressSource."
            checked={rgEnabled}
            onChange={setRgEnabled}
          />
          <SecretField
            label="LocationIQ API key"
            value={rgLocationIqKey}
            onChange={setRgLocationIqKey}
            hasExisting={rgHasLocationIqKey}
            placeholder="pk.xxxx..."
            hint='Optional. Get a free key at locationiq.com. Without a key the chain starts at BigDataCloud.'
          />
          <NumberField
            label="Cache TTL (hours)"
            value={rgCacheTtl}
            onChange={setRgCacheTtl}
            min={1}
            max={720}
            step={1}
            hint="How long to cache reverse-geocode results per coordinate. Default: 6 hours. Address data is stable so a longer TTL reduces API calls."
          />
        </div>

        <CardFooter>
          <SaveFooter
            isPending={rgPending}
            saveState={rgSaveState}
            onSave={handleRgSave}
            onDismiss={() => setRgSaveState({ mode: "idle" })}
          />
          <TestButton isTesting={rgTestPending || rgTestState.mode === "testing"} onTest={handleTestReverseGeocode} />
        </CardFooter>
        <TestResultPanel state={rgTestState} onDismiss={() => setRgTestState({ mode: "idle" })} />
      </div>

      {/* ── Weather ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">Weather — Current Conditions</h2>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                wxEnabled ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}>
                {wxEnabled ? "✓ Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              No API key required — uses the free{" "}
              <span className="font-medium text-neutral-700">Open-Meteo</span> API (open-meteo.com).
              Resolves current weather conditions from the visitor&apos;s lat/lng coordinates (provided
              by the geo stage) and maps them to{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">temperatureNow</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">weatherCode</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">isRaining</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 font-mono text-[11px]">weatherSummary</code>,
              and more. Requires lat/lng — runs after the geo stage.
            </p>
          </div>
          {wxUpdatedAt && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatDate(wxUpdatedAt)}
            </span>
          )}
        </div>

        <div className="mb-4 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-700">Provider:</strong>{" "}
          <span className="font-medium text-neutral-700">Open-Meteo</span> — free, no sign-up required,
          no rate limits for reasonable usage. Data is sourced from ECMWF, GFS, and other NWP models.
          Results are cached per coordinate pair to avoid redundant API calls.
        </div>

        <div className="space-y-4">
          <ToggleField
            label="Enable weather enrichment"
            description="When enabled, runs after the geo stage whenever lat/lng is available and enriches temperatureNow, weatherCode, isRaining, precipitationProbability, windSpeed, cloudCover, weatherSummary, and weatherSource."
            checked={wxEnabled}
            onChange={setWxEnabled}
          />
          <NumberField
            label="Cache TTL (hours)"
            value={wxCacheTtl}
            onChange={setWxCacheTtl}
            min={1}
            max={168}
            step={1}
            hint="How long to cache weather results per coordinate pair. Default: 1 hour. Weather changes quickly — keep this short for fresh data, or increase to reduce API calls."
          />
        </div>

        <CardFooter>
          <SaveFooter
            isPending={wxPending}
            saveState={wxSaveState}
            onSave={handleWxSave}
            onDismiss={() => setWxSaveState({ mode: "idle" })}
          />
          <TestButton isTesting={wxTestPending || wxTestState.mode === "testing"} onTest={handleTestWeather} />
        </CardFooter>
        <TestResultPanel state={wxTestState} onDismiss={() => setWxTestState({ mode: "idle" })} />
      </div>

      {/* ── What enrichment provides ───────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
        <h3 className="text-xs font-semibold text-neutral-700">Staged enrichment pipeline</h3>
        <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
          When enabled for a tenant, the enrichment stages run sequentially — each stage sees the
          output of all prior stages. This allows later stages to branch on earlier results
          (e.g. OpenKvK only runs for Dutch visitors when configured in NL-only mode).
        </p>
        <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
          <li><strong>Stage 1 — MaxMind:</strong> <code className="rounded bg-white px-1 font-mono">countryCode</code>, <code className="rounded bg-white px-1 font-mono">region</code>, <code className="rounded bg-white px-1 font-mono">city</code></li>
          <li><strong>Stage 2 — IPinfo:</strong> <code className="rounded bg-white px-1 font-mono">networkAsn</code>, <code className="rounded bg-white px-1 font-mono">networkOrg</code>, <code className="rounded bg-white px-1 font-mono">networkDomain</code></li>
          <li><strong>Stage 3 — OpenKvK:</strong> Dutch company registry lookup — <code className="rounded bg-white px-1 font-mono">companyName</code>, <code className="rounded bg-white px-1 font-mono">companyDomain</code> (mode-gated, tenant-gated)</li>
          <li><strong>Stage 4 — Leadinfo:</strong> <code className="rounded bg-white px-1 font-mono">companyName</code>, <code className="rounded bg-white px-1 font-mono">companyDomain</code> (tenant-gated)</li>
          <li><strong>Stage 5 — HubSpot CRM:</strong> <code className="rounded bg-white px-1 font-mono">crmMatched</code>, <code className="rounded bg-white px-1 font-mono">crmLifecycleStage</code>, <code className="rounded bg-white px-1 font-mono">crmCompanyId</code> (tenant-gated)</li>
          <li><strong>Stage 6 — Nager.Date:</strong> <code className="rounded bg-white px-1 font-mono">seasonalEvent</code>, <code className="rounded bg-white px-1 font-mono">holidayName</code> (enabled above, tenant-gated)</li>
          <li><strong>Stage 7 — Reverse Geocode:</strong> <code className="rounded bg-white px-1 font-mono">addressCity</code>, <code className="rounded bg-white px-1 font-mono">addressRegion</code>, <code className="rounded bg-white px-1 font-mono">addressPostcode</code>, <code className="rounded bg-white px-1 font-mono">addressFormatted</code> (enabled above)</li>
          <li><strong>Stage 8 — Weather:</strong> <code className="rounded bg-white px-1 font-mono">temperatureNow</code>, <code className="rounded bg-white px-1 font-mono">weatherCode</code>, <code className="rounded bg-white px-1 font-mono">isRaining</code>, <code className="rounded bg-white px-1 font-mono">weatherSummary</code> (enabled above)</li>
          <li><strong>GA4 History:</strong> <code className="rounded bg-white px-1 font-mono">gaLastKnownCity</code>, <code className="rounded bg-white px-1 font-mono">gaSessionCount</code>, <code className="rounded bg-white px-1 font-mono">gaLastChannelGroup</code> (per-tenant — configure in Tenant → Integrations → GA4)</li>
        </ul>
      </div>

    </div>
  );
}
