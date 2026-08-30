"use client";

/**
 * TenantIntegrationsClient
 *
 * Comprehensive client component for the tenant Integrations workspace tab.
 *
 * ─── Sections ─────────────────────────────────────────────────────────────────
 *
 *   CMS        — provider selection + per-tenant non-secret provider config
 *   CRM        — HubSpot enrichment enablement
 *   AI         — mode (disabled/shadow/live), provider, model, threshold
 *   Enrichment — MaxMind geo enrichment enablement
 *   Domains    — Vercel project mapping + domain list
 *
 * ─── Layering contract ─────────────────────────────────────────────────────────
 *
 *   This component manages USAGE / CONFIG only.
 *
 *   Secrets (API keys, write tokens, access tokens) are NOT in this component.
 *   They live at /admin/platform/integrations/* and are never passed as props.
 *
 *   Secret preservation is handled server-side in saveTenantIntegrationsAction:
 *   the action re-reads the stored record and merges non-secret updates on top,
 *   so secrets cannot be lost when this form saves.
 *
 * ─── Platform availability ────────────────────────────────────────────────────
 *
 *   `platform*Available` props signal whether the underlying platform-level
 *   credential exists.  Integrations whose platform credential is absent are
 *   shown with a warning and their toggles are disabled — the operator needs
 *   to configure the secret in Platform → Integrations first.
 */

import { useState, useTransition } from "react";
import { saveTenantIntegrationsAction } from "../actions";
import type { TenantIntegrationsPayload } from "../actions";
import {
  testTenantGa4TrackingAction,
  testTenantGa4HistoryAction,
  type TestConnectionResult,
} from "../test-actions";
import type { CMSProviderName, TenantAiProviderName } from "@/tenant/types";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TenantIntegrationsClientProps {
  tenantId: string;

  // ── CMS ─────────────────────────────────────────────────────────────────────
  cms: {
    provider:          CMSProviderName;
    projectId:         string;
    dataset:           string;
    storyblokRegion:   string;
    storyblokVersion:  string;
    statamicBaseUrl:   string;
    hasWriteToken:     boolean;  // whether a write token is stored (read-only indicator)
  };
  /** Platform CMS availability flags (any provider configured at platform level) */
  platformCmsAvailable: boolean;

  // ── CRM ─────────────────────────────────────────────────────────────────────
  crm: {
    enabled:          boolean;
    useCrmEnrichment: boolean;
  };
  platformCrmAvailable: boolean;

  // ── AI ──────────────────────────────────────────────────────────────────────
  ai: {
    mode:                 "disabled" | "shadow" | "live";
    confidenceThreshold:  string;   // string for <input type="number">
    liveProvider: {
      name:  TenantAiProviderName | "";
      model: string;
    };
    shadowProvider: {
      name:  TenantAiProviderName | "";
      model: string;
    };
  };
  platformAiAvailable: boolean;   // any AI key at platform level

  // ── Enrichment ────────────────────────────────────────────────────────────
  enrichment: {
    enabled:                boolean;
    useGeoEnrichment:       boolean;
    // Provider flags — optional for backward compat with older server data
    useIpinfoLite?:          boolean;
    useOpenKvK?:             boolean;
    useLeadinfo?:            boolean;
    useIpCompanyEnrichment?: boolean;
    useSeasonalEvents?:      boolean;
    // Test IP override — persisted per tenant for QA and geo-targeting verification
    testIpEnabled?:          boolean;
    testIpAddress?:          string;
    // How long a recognised visitor's firmographics stay "fresh" (days).
    firmographicFreshnessDays?: number;
    leadScoreHotThreshold?: number;
    personalizationHoldoutPct?: number;
    leadScoring?: {
      weights?: { level?: number; intent?: number; recency?: number; engagement?: number };
      decayHalfLifeDays?: number;
    };
  };
  platformEnrichmentAvailable: boolean;  // MaxMind key at platform level

  // ── Domains ───────────────────────────────────────────────────────────────
  domains: {
    vercelProjectId:   string;
    primaryDomain:     string;
    additionalDomains: string;   // newline-separated
  };
  platformDomainsAvailable: boolean;   // Vercel token at platform level

  // ── Leadinfo ──────────────────────────────────────────────────────────────
  leadinfo: {
    enabled:         boolean;
    siteToken:       string;
    pushToDataLayer: boolean;
    storeInContext:  boolean;
  };

  // ── Google Tag Manager ─────────────────────────────────────────────────────
  gtm: {
    containerId: string;
  };

  // ── GA4 ───────────────────────────────────────────────────────────────────
  ga4: {
    tracking: {
      enabled:            boolean;
      measurementId:      string;
      sendMode:           "off" | "client" | "server";
      visitorIdParamName: string;
      hasApiSecret:       boolean;  // presence flag only — secret never crosses boundary
    };
    history: {
      enabled:            boolean;
      propertyId:         string;
      visitorIdDimension: string;
      lookbackDays:       number;
      cacheTtlMinutes:    number;
      hasServiceAccount:  boolean;  // presence flag only — secret never crosses boundary
    };
  };
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

// ── Shared primitives ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title:       string;
  description: string;
  children:    React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">{description}</p>
      </div>
      {children}
    </div>
  );
}

function PlatformMissingBanner({ section, href }: { section: string; href: string }) {
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      Platform {section} credentials are not yet configured.{" "}
      <a href={href} className="font-medium underline hover:text-amber-900">
        Configure them here →
      </a>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  disabled,
}: {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  hint?:        string;
  disabled?:    boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-neutral-50 disabled:text-neutral-400"
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
          <span className="font-mono text-xs tracking-widest text-neutral-400">••••••••••••••••••••••••••••••••</span>
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
        {hint ?? "Leave blank to keep the existing value. Stored server-side only, never echoed back."}
      </p>
    </div>
  );
}

// ── Test connection UI ─────────────────────────────────────────────────────────

type TestState =
  | { mode: "idle" }
  | { mode: "testing" }
  | { mode: "done"; result: TestConnectionResult };

// ── Leadinfo client-side test types ───────────────────────────────────────────
//
// The Leadinfo test loads the site in a hidden same-origin iframe so that
// LeadinfoProvider executes in a real browser context with the visitor's
// real IP.  Direct fetch() calls to api.leadinfo.com from the admin page
// fail with CORS errors because Leadinfo restricts cross-origin API access —
// the identify flow is only valid when it originates from the registered domain.
//
// The admin polls GET /api/enrichment/leadinfo/status every 1.5 s to check
// whether LeadinfoProvider wrote the mc_li cookie.  The status endpoint reads
// the httpOnly cookie server-side and returns decoded fields.

/** Decoded fields returned by GET /api/enrichment/leadinfo/status. */
interface LeadinfoStatusData {
  matched:        boolean;
  companyName:    string | null;
  companyDomain:  string | null;
  companyCountry: string | null;
}

interface LeadinfoStatusResponse {
  present: boolean;
  data:    LeadinfoStatusData | null;
}

interface LeadinfoTestResult {
  /** True when the hidden iframe was successfully injected. */
  providerInitialized: boolean;
  /** True when the LeadinfoProvider identify flow was attempted in the iframe. */
  identifyAttempted: boolean;
  /** True when the mc_li cookie was written within the 20 s polling window. */
  cookiePresent: boolean;
  /** From decoded mc_li cookie — null when no cookie was written. */
  matched:        boolean | null;
  companyName:    string | null;
  companyDomain:  string | null;
  companyCountry: string | null;
  /**
   * Always null: dataLayer events occur inside the iframe's window scope
   * and cannot be observed from the admin page without a custom postMessage
   * bridge.  Verify via DevTools → Console → window.dataLayer.
   */
  dataLayerPushed: null;
  /** True when the 20 s polling window elapsed before the cookie appeared. */
  timedOut: boolean;
  /** Total elapsed time in milliseconds. */
  latencyMs: number;
  /** Human-readable error description, or null on clean success. */
  error: string | null;
}

type LeadinfoTestState =
  | { mode: "idle" }
  | { mode: "testing" }
  | { mode: "done"; result: LeadinfoTestResult };

function TestButton({ isTesting, onTest }: { isTesting: boolean; onTest: () => void }) {
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

function TestResultPanel({ state, onDismiss }: { state: TestState; onDismiss: () => void }) {
  if (state.mode === "idle") return null;
  if (state.mode === "testing") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        Testing connection…
      </div>
    );
  }
  const { result } = state;
  if (result.ok) {
    return (
      <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-green-700">✓ Connected</span>
          <span className="text-[11px] text-green-600">{result.latencyMs} ms</span>
          <button onClick={onDismiss} className="ml-auto text-[11px] text-neutral-400 underline hover:text-neutral-600">Dismiss</button>
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
  return (
    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
          {result.errorType === "config" ? "Not configured" : result.errorType === "auth" ? "Auth error" : "Error"}
        </span>
        <span className="text-[11px] text-neutral-400">{result.latencyMs} ms</span>
        <button onClick={onDismiss} className="ml-auto text-[11px] text-neutral-400 underline hover:text-neutral-600">Dismiss</button>
      </div>
      <p className="text-[11px] leading-relaxed text-red-800">{result.message}</p>
    </div>
  );
}

// ── Leadinfo test result panel ─────────────────────────────────────────────────
//
// Separate from the generic TestResultPanel because the Leadinfo test has a
// different (richer) result shape and custom field semantics.

function LeadinfoTestResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[11px]">
      <dt className="w-36 shrink-0 font-medium text-neutral-600">{label}:</dt>
      <dd className="break-all text-neutral-700">{value}</dd>
    </div>
  );
}

function LeadinfoTestResultPanel({
  state,
  onDismiss,
  onClear,
}: {
  state:     LeadinfoTestState;
  onDismiss: () => void;
  onClear:   () => void;
}) {
  if (state.mode === "idle") return null;

  if (state.mode === "testing") {
    return (
      <div className="mt-3 space-y-1.5 rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5">
        <p className="text-xs font-medium text-blue-700">
          Loading site in hidden iframe…
        </p>
        <p className="text-[11px] leading-relaxed text-blue-600">
          Leadinfo can only be tested via a real browser context. Direct API calls
          fail due to CORS restrictions. The identify flow is running in a sandboxed
          iframe using your configured site token. Polling for the mc_li cookie
          (up to 20 s).
        </p>
      </div>
    );
  }

  const { result } = state;

  // Colour scheme: green = matched, amber = timed out, neutral = no match, red = not configured.
  const borderCls = !result.providerInitialized
    ? "border-red-200 bg-red-50"
    : result.timedOut
    ? "border-amber-200 bg-amber-50"
    : result.matched
    ? "border-green-200 bg-green-50"
    : "border-neutral-200 bg-neutral-50";

  const headingCls = !result.providerInitialized
    ? "text-red-700"
    : result.timedOut
    ? "text-amber-700"
    : result.matched
    ? "text-green-700"
    : "text-neutral-600";

  const headingText = !result.providerInitialized
    ? "Not configured"
    : result.timedOut
    ? "⏱ No result, mc_li not written"
    : result.matched
    ? "✓ Company matched"
    : "○ No match for this IP";

  return (
    <div className={`mt-3 rounded-md border px-3 py-2.5 ${borderCls}`}>
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`text-xs font-semibold ${headingCls}`}>{headingText}</span>
        <span className="text-[11px] text-neutral-400">{result.latencyMs} ms</span>
        <button
          onClick={onDismiss}
          className="ml-auto text-[11px] text-neutral-400 underline hover:text-neutral-600"
        >
          Dismiss
        </button>
      </div>

      {/* Timeout / error explanation */}
      {result.error && (
        <p className="mb-2 text-[11px] leading-relaxed text-amber-800">{result.error}</p>
      )}

      {/* Structured field table */}
      <dl className="space-y-0.5">
        <LeadinfoTestResultField
          label="Script loaded"
          value={result.providerInitialized ? "yes (LeadinfoProvider in iframe)" : "no"}
        />
        <LeadinfoTestResultField
          label="Identify attempted"
          value={result.identifyAttempted ? "yes (via iframe)" : "no"}
        />
        <LeadinfoTestResultField
          label="mc_li cookie written"
          value={result.cookiePresent ? "yes ✓" : "no ✗"}
        />
        <LeadinfoTestResultField
          label="Company matched"
          value={result.matched === null ? ", " : result.matched ? "yes" : "no"}
        />
        {result.matched && (
          <>
            <LeadinfoTestResultField label="Company name"   value={result.companyName   ?? "(none)"} />
            <LeadinfoTestResultField label="Company domain" value={result.companyDomain ?? "(none)"} />
            <LeadinfoTestResultField label="Country"        value={result.companyCountry ?? "(none)"} />
          </>
        )}
        <LeadinfoTestResultField
          label="dataLayer push"
          value="cannot detect across iframe boundary. Verify via DevTools → Console → window.dataLayer"
        />
      </dl>

      {/* Cookie reset helper */}
      <div className="mt-2 border-t border-neutral-200 pt-2">
        <button
          onClick={onClear}
          className="text-[11px] text-neutral-500 underline hover:text-neutral-700"
        >
          Clear mc_li cookie &amp; reset for next test
        </button>
      </div>
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  id:          string;
  checked:     boolean;
  onChange:    (v: boolean) => void;
  disabled?:   boolean;
  label:       string;
  description: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        disabled
          ? "border-neutral-100 bg-neutral-50 cursor-not-allowed opacity-60"
          : "border-neutral-200 bg-white cursor-pointer hover:bg-neutral-50"
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-neutral-900">{label}</p>
        <p className="text-[11px] text-neutral-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

// ── CMS provider options ───────────────────────────────────────────────────────

const CMS_PROVIDERS: { value: CMSProviderName; label: string; note: string }[] = [
  { value: "sanity",    label: "Sanity",    note: "Requires SANITY_PROJECT_ID env var or platform config" },
  { value: "storyblok", label: "Storyblok", note: "Requires STORYBLOK_ACCESS_TOKEN env var or platform config" },
  { value: "statamic",  label: "Statamic",  note: "Requires STATAMIC_API_URL env var or platform config" },
  { value: "mock",      label: "Mock",      note: "In-memory dev data, no live CMS connection" },
];

// ── AI constants ───────────────────────────────────────────────────────────────

const AI_MODES: { value: "disabled" | "shadow" | "live"; label: string; note: string }[] = [
  { value: "disabled", label: "Disabled",          note: "Rules engine is the sole decision source" },
  { value: "shadow",   label: "Shadow (observe)",  note: "AI runs but result is logged, not served" },
  { value: "live",     label: "Live (serve AI)",   note: "AI may override the rules plan when confident" },
];

const AI_PROVIDERS: { value: TenantAiProviderName | ""; label: string }[] = [
  { value: "",       label: ": Use platform default, " },
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini (Google), adapter pending" },
];

// ── Root component ─────────────────────────────────────────────────────────────

export function TenantIntegrationsClient({
  tenantId,
  cms:    initialCms,
  crm:    initialCrm,
  ai:     initialAi,
  enrichment:  initialEnrichment,
  domains:     initialDomains,
  leadinfo:    initialLeadinfo,
  gtm:         initialGtm,
  ga4:         initialGa4,
  platformCmsAvailable,
  platformCrmAvailable,
  platformAiAvailable,
  platformEnrichmentAvailable,
  platformDomainsAvailable,
}: TenantIntegrationsClientProps) {

  // ── CMS state ──────────────────────────────────────────────────────────────
  const [cmsProvider,        setCmsProvider]        = useState<CMSProviderName>(initialCms.provider);
  const [cmsProjectId,       setCmsProjectId]       = useState(initialCms.projectId);
  const [cmsDataset,         setCmsDataset]         = useState(initialCms.dataset);
  const [storyblokRegion,    setStoryblokRegion]    = useState(initialCms.storyblokRegion);
  const [storyblokVersion,   setStoryblokVersion]   = useState(initialCms.storyblokVersion);
  const [statamicBaseUrl,    setStatamicBaseUrl]    = useState(initialCms.statamicBaseUrl);

  // ── CRM state ──────────────────────────────────────────────────────────────
  const [crmEnabled,         setCrmEnabled]         = useState(initialCrm.enabled);
  const [crmEnrichment,      setCrmEnrichment]      = useState(initialCrm.useCrmEnrichment);

  // ── AI state ───────────────────────────────────────────────────────────────
  const [aiMode,             setAiMode]             = useState(initialAi.mode);
  const [aiThreshold,        setAiThreshold]        = useState(initialAi.confidenceThreshold);
  const [liveProviderName,   setLiveProviderName]   = useState<TenantAiProviderName | "">(initialAi.liveProvider.name);
  const [liveProviderModel,  setLiveProviderModel]  = useState(initialAi.liveProvider.model);
  const [shadowProviderName, setShadowProviderName] = useState<TenantAiProviderName | "">(initialAi.shadowProvider.name);
  const [shadowProviderModel,setShadowProviderModel]= useState(initialAi.shadowProvider.model);

  // ── Enrichment state ───────────────────────────────────────────────────────
  const [enrichmentEnabled,   setEnrichmentEnabled]   = useState(initialEnrichment.enabled);
  const [useGeoEnrichment,    setUseGeoEnrichment]    = useState(initialEnrichment.useGeoEnrichment);
  const [useOpenKvK,          setUseOpenKvK]          = useState(initialEnrichment.useOpenKvK          ?? false);
  const [useLeadinfo,         setUseLeadinfo]         = useState(initialEnrichment.useLeadinfo         ?? false);
  const [useSeasonalEvents,   setUseSeasonalEvents]   = useState(initialEnrichment.useSeasonalEvents   ?? false);
  const [testIpEnabled,       setTestIpEnabled]       = useState(initialEnrichment.testIpEnabled       ?? false);
  const [testIpAddress,       setTestIpAddress]       = useState(initialEnrichment.testIpAddress       ?? "");
  const [firmoFreshnessDays,  setFirmoFreshnessDays]  = useState(String(initialEnrichment.firmographicFreshnessDays ?? 30));
  const [hotThreshold,        setHotThreshold]        = useState(String(initialEnrichment.leadScoreHotThreshold ?? 60));
  const [holdoutPct,          setHoldoutPct]          = useState(String(initialEnrichment.personalizationHoldoutPct ?? 0));
  const [wLevel,              setWLevel]              = useState(String(initialEnrichment.leadScoring?.weights?.level      ?? 1));
  const [wIntent,             setWIntent]             = useState(String(initialEnrichment.leadScoring?.weights?.intent     ?? 1));
  const [wRecency,            setWRecency]            = useState(String(initialEnrichment.leadScoring?.weights?.recency    ?? 1));
  const [wEngagement,         setWEngagement]         = useState(String(initialEnrichment.leadScoring?.weights?.engagement ?? 1));
  const [decayHalfLife,       setDecayHalfLife]       = useState(String(initialEnrichment.leadScoring?.decayHalfLifeDays   ?? 0));

  // ── Leadinfo state ─────────────────────────────────────────────────────────
  const [liEnabled,          setLiEnabled]          = useState(initialLeadinfo.enabled);
  const [liSiteToken,        setLiSiteToken]        = useState(initialLeadinfo.siteToken);
  const [liPushToDataLayer,  setLiPushToDataLayer]  = useState(initialLeadinfo.pushToDataLayer);
  const [liStoreInContext,   setLiStoreInContext]   = useState(initialLeadinfo.storeInContext);
  const [liTestState,        setLiTestState]        = useState<LeadinfoTestState>({ mode: "idle" });

  // ── GTM state ──────────────────────────────────────────────────────────────
  const [gtmContainerId,     setGtmContainerId]     = useState(initialGtm.containerId);

  // ── Domains state ──────────────────────────────────────────────────────────
  const [vercelProjectId,    setVercelProjectId]    = useState(initialDomains.vercelProjectId);

  // ── GA4 Tracking state ─────────────────────────────────────────────────────
  const [ga4TrackEnabled,    setGa4TrackEnabled]    = useState(initialGa4.tracking.enabled);
  const [ga4MeasurementId,   setGa4MeasurementId]   = useState(initialGa4.tracking.measurementId);
  const [ga4SendMode,        setGa4SendMode]        = useState<"off" | "client" | "server">(initialGa4.tracking.sendMode);
  const [ga4VisitorParam,    setGa4VisitorParam]    = useState(initialGa4.tracking.visitorIdParamName);
  const [ga4ApiSecret,       setGa4ApiSecret]       = useState("");   // write-only; never shown
  const [ga4TrackTestState,  setGa4TrackTestState]  = useState<TestState>({ mode: "idle" });

  // ── GA4 History state ──────────────────────────────────────────────────────
  const [ga4HistEnabled,     setGa4HistEnabled]     = useState(initialGa4.history.enabled);
  const [ga4PropertyId,      setGa4PropertyId]      = useState(initialGa4.history.propertyId);
  const [ga4VisitorDim,      setGa4VisitorDim]      = useState(initialGa4.history.visitorIdDimension);
  const [ga4LookbackDays,    setGa4LookbackDays]    = useState(String(initialGa4.history.lookbackDays));
  const [ga4CacheTtl,        setGa4CacheTtl]        = useState(String(initialGa4.history.cacheTtlMinutes));
  const [ga4ServiceJson,     setGa4ServiceJson]     = useState("");   // write-only; never shown
  const [ga4HistTestState,   setGa4HistTestState]   = useState<TestState>({ mode: "idle" });

  // ── Save state ─────────────────────────────────────────────────────────────
  const [saveState,   setSaveState]   = useState<SaveState>({ mode: "idle" });
  const [isPending,   startTransition] = useTransition();

  // ── Derived: CMS provider changed? Show provider-specific fields ───────────
  const showSanityFields    = cmsProvider === "sanity";
  const showStoryblokFields = cmsProvider === "storyblok";
  const showStatamicFields  = cmsProvider === "statamic";

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleCrmEnabled(v: boolean) {
    setCrmEnabled(v);
    if (!v) setCrmEnrichment(false);
  }

  function handleEnrichmentEnabled(v: boolean) {
    setEnrichmentEnabled(v);
    if (!v) setUseGeoEnrichment(false);
  }

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });

      const payload: TenantIntegrationsPayload = {
        cms: {
          provider:        cmsProvider,
          projectId:       cmsProjectId  || undefined,
          dataset:         cmsDataset    || undefined,
          storyblokRegion:   storyblokRegion  || undefined,
          storyblokVersion:  storyblokVersion || undefined,
          statamicBaseUrl:   statamicBaseUrl  || undefined,
        },
        crm: {
          enabled:          crmEnabled,
          useCrmEnrichment: crmEnrichment,
        },
        ai: {
          mode:                 aiMode,
          confidenceThreshold:  aiThreshold ? parseFloat(aiThreshold) : undefined,
          liveProvider:   liveProviderName
            ? { name: liveProviderName, model: liveProviderModel || undefined }
            : undefined,
          shadowProvider: shadowProviderName
            ? { name: shadowProviderName, model: shadowProviderModel || undefined }
            : undefined,
        },
        enrichment: {
          enabled:                enrichmentEnabled,
          useGeoEnrichment:       useGeoEnrichment,
          useOpenKvK:             useOpenKvK,
          useSeasonalEvents:      useSeasonalEvents,
          // Preserve existing values for flags without UI controls in this form
          useIpinfoLite:          initialEnrichment.useIpinfoLite          ?? false,
          useLeadinfo:            useLeadinfo,
          useIpCompanyEnrichment: initialEnrichment.useIpCompanyEnrichment ?? false,
          // Test IP override
          testIpEnabled,
          testIpAddress:          testIpAddress.trim() || undefined,
          // Firmographics freshness window (days); clamp to a sane 1–365, default 30.
          firmographicFreshnessDays: Math.min(365, Math.max(1, parseInt(firmoFreshnessDays, 10) || 30)),
          leadScoreHotThreshold:     Math.min(100, Math.max(0, parseInt(hotThreshold, 10) || 60)),
          personalizationHoldoutPct: Math.min(50, Math.max(0, parseInt(holdoutPct, 10) || 0)),
          leadScoring: {
            weights: {
              level:      Math.min(5, Math.max(0, parseFloat(wLevel)      || 1)),
              intent:     Math.min(5, Math.max(0, parseFloat(wIntent)     || 1)),
              recency:    Math.min(5, Math.max(0, parseFloat(wRecency)    || 1)),
              engagement: Math.min(5, Math.max(0, parseFloat(wEngagement) || 1)),
            },
            decayHalfLifeDays: Math.min(365, Math.max(0, parseInt(decayHalfLife, 10) || 0)),
          },
        },
        domains: {
          vercelProjectId: vercelProjectId || undefined,
        },
        leadinfo: {
          enabled:         liEnabled,
          siteToken:       liSiteToken.trim() || undefined,
          pushToDataLayer: liPushToDataLayer,
          storeInContext:  liStoreInContext,
        },
        gtm: {
          containerId: gtmContainerId.trim() || undefined,
        },
        ga4: {
          tracking: {
            enabled:            ga4TrackEnabled,
            measurementId:      ga4MeasurementId || undefined,
            sendMode:           ga4SendMode,
            visitorIdParamName: ga4VisitorParam  || undefined,
            // Only include when a new value was entered — blank means "keep existing".
            ...(ga4ApiSecret.trim() ? { apiSecret: ga4ApiSecret.trim() } : {}),
          },
          history: {
            enabled:             ga4HistEnabled,
            propertyId:          ga4PropertyId  || undefined,
            visitorIdDimension:  ga4VisitorDim  || undefined,
            lookbackDays:        ga4LookbackDays ? Number(ga4LookbackDays) : undefined,
            cacheTtlMinutes:     ga4CacheTtl    ? Number(ga4CacheTtl)     : undefined,
            // Only include when a new value was entered — blank means "keep existing".
            ...(ga4ServiceJson.trim() ? { serviceAccountJson: ga4ServiceJson.trim() } : {}),
          },
        },
      };

      const result = await saveTenantIntegrationsAction(tenantId, payload);

      if (result.ok) {
        setSaveState({ mode: "success" });
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  // ── GA4 test handlers ─────────────────────────────────────────────────────
  function handleTestGa4Tracking() {
    setGa4TrackTestState({ mode: "testing" });
    testTenantGa4TrackingAction(tenantId).then((result) => {
      setGa4TrackTestState({ mode: "done", result });
    });
  }

  function handleTestGa4History() {
    setGa4HistTestState({ mode: "testing" });
    testTenantGa4HistoryAction(tenantId).then((result) => {
      setGa4HistTestState({ mode: "done", result });
    });
  }

  // ── Leadinfo test handlers ─────────────────────────────────────────────────
  //
  // Direct fetch() to api.leadinfo.com from the admin page fails with CORS
  // because Leadinfo restricts cross-origin identify calls to the registered
  // domain.  The correct approach is to run the identify flow via a hidden
  // same-origin iframe that loads the real site — exactly as it runs in
  // production for actual visitors.
  //
  // Test flow:
  //   1. DELETE /api/enrichment/leadinfo  — clear existing mc_li for clean baseline.
  //   2. Inject a hidden <iframe src="/?leadinfo_test=1">.
  //      The iframe has its own sessionStorage so mc_li_sent is not seen;
  //      LeadinfoProvider in the root layout runs the identify flow naturally.
  //   3. Poll GET /api/enrichment/leadinfo/status every 1.5 s for up to 20 s.
  //      The status endpoint reads the httpOnly mc_li cookie server-side.
  //   4. Remove the iframe; show the decoded cookie content as the result.

  async function handleTestLeadinfo() {
    const siteToken = liSiteToken.trim();
    if (!siteToken) {
      setLiTestState({
        mode: "done",
        result: {
          providerInitialized: false,
          identifyAttempted:   false,
          cookiePresent:       false,
          matched:             null,
          companyName:         null,
          companyDomain:       null,
          companyCountry:      null,
          dataLayerPushed:     null,
          timedOut:            false,
          latencyMs:           0,
          error:               "Site Token is not configured. Enter a token and save settings before testing.",
        },
      });
      return;
    }

    setLiTestState({ mode: "testing" });
    const start = Date.now();

    // Step 1 — clear the existing mc_li cookie for a clean baseline.
    try {
      await fetch("/api/enrichment/leadinfo", { method: "DELETE" });
    } catch { /* ignore — test continues even if DELETE fails */ }

    // Step 2 — inject hidden same-origin iframe.
    // The iframe has its own sessionStorage, so mc_li_sent is not inherited.
    // LeadinfoProvider in the root layout will run the identify flow naturally.
    const iframe = document.createElement("iframe");
    iframe.src = `/?leadinfo_test=1&t=${Date.now()}`;
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;" +
      "opacity:0;pointer-events:none;border:none;";
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabIndex", "-1");
    document.body.appendChild(iframe);

    // Step 3 — poll the status endpoint while LeadinfoProvider runs.
    // Next.js SSR + React hydration + async fetch can take several seconds.
    // Allow up to 20 s total, checking every 1.5 s.
    const POLL_INTERVAL_MS = 1_500;
    const MAX_WAIT_MS      = 20_000;
    let cookiePresent = false;
    let statusData: LeadinfoStatusData | null = null;

    while (Date.now() - start < MAX_WAIT_MS) {
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const resp = await fetch("/api/enrichment/leadinfo/status");
        if (resp.ok) {
          const body = (await resp.json()) as LeadinfoStatusResponse;
          if (body.present && body.data) {
            cookiePresent = true;
            statusData    = body.data;
            break;
          }
        }
      } catch { /* continue polling */ }
    }

    // Step 4 — remove the iframe and display the result.
    try { document.body.removeChild(iframe); } catch { /* ignore */ }

    const latencyMs = Date.now() - start;
    const timedOut  = !cookiePresent;

    setLiTestState({
      mode: "done",
      result: {
        providerInitialized: true,
        identifyAttempted:   true,
        cookiePresent,
        matched:      statusData?.matched      ?? null,
        companyName:  statusData?.companyName  ?? null,
        companyDomain: statusData?.companyDomain ?? null,
        companyCountry: statusData?.companyCountry ?? null,
        dataLayerPushed: null,
        timedOut,
        latencyMs,
        error: timedOut
          ? "mc_li cookie not written within 20 s. Likely reasons: IP not in Leadinfo database " +
            "(residential/office IPs are often unrecognised); domain not registered in Leadinfo " +
            "dashboard; or CORS restriction for this environment (e.g. localhost)."
          : null,
      },
    });
  }

  function handleClearLeadinfoCookie() {
    // Clear the httpOnly cookie server-side.
    void fetch("/api/enrichment/leadinfo", { method: "DELETE" });
    // Also clear the sessionStorage dedup flag so the normal provider re-runs.
    try { sessionStorage.removeItem("mc_li_sent"); } catch { /* ignore */ }
    // If a test result is showing, reset so the user knows the slate is clean.
    setLiTestState({ mode: "idle" });
  }

  return (
    <div className="space-y-5">

      {/* ─────────────────────────── CMS ────────────────────────────────── */}
      <SectionCard
        title="CMS"
        description="Which content management system this tenant uses. Provider-specific non-secret config (project ID, dataset, region) can be overridden here from the platform defaults. Write tokens and access tokens are managed in Platform → Integrations → CMS."
      >
        {/* Provider selection */}
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {CMS_PROVIDERS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                cmsProvider === opt.value
                  ? "border-brand-400 bg-brand-50"
                  : "border-neutral-200 bg-white hover:bg-neutral-50"
              }`}
            >
              <input
                type="radio"
                name="cmsProvider"
                value={opt.value}
                checked={cmsProvider === opt.value}
                onChange={() => setCmsProvider(opt.value)}
                className="mt-0.5 h-4 w-4 border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className={`text-xs font-semibold ${cmsProvider === opt.value ? "text-brand-700" : "text-neutral-900"}`}>
                  {opt.label}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">{opt.note}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Provider-specific non-secret config */}
        {showSanityFields && (
          <div className="space-y-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Sanity per-tenant config
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Project ID"
                value={cmsProjectId}
                onChange={setCmsProjectId}
                placeholder="Override platform default…"
                hint="Leave blank to use the platform-level project ID"
              />
              <TextField
                label="Dataset"
                value={cmsDataset}
                onChange={setCmsDataset}
                placeholder="e.g. production"
                hint="Leave blank to use the platform-level dataset"
              />
            </div>
            {initialCms.hasWriteToken && (
              <p className="text-[11px] text-green-600 font-medium">
                ✓ Write token configured (managed in Platform → Integrations → CMS)
              </p>
            )}
          </div>
        )}

        {showStoryblokFields && (
          <div className="space-y-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Storyblok per-tenant config
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Space ID"
                value={cmsProjectId}
                onChange={setCmsProjectId}
                placeholder="Override platform default…"
                hint="Leave blank to use the platform-level space"
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Region</label>
                <select
                  value={storyblokRegion}
                  onChange={(e) => setStoryblokRegion(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                >
                  <option value="">: Platform default: </option>
                  <option value="eu">EU</option>
                  <option value="us">US</option>
                  <option value="ap">AP</option>
                  <option value="ca">CA</option>
                  <option value="cn">CN</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700">Content version</label>
                <select
                  value={storyblokVersion}
                  onChange={(e) => setStoryblokVersion(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                >
                  <option value="">: Platform default: </option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {showStatamicFields && (
          <div className="space-y-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Statamic per-tenant config
            </p>
            <TextField
              label="Base URL"
              value={statamicBaseUrl}
              onChange={setStatamicBaseUrl}
              placeholder="https://cms.example.com"
              hint="Override the platform-level STATAMIC_API_URL for this tenant"
            />
          </div>
        )}
      </SectionCard>

      {/* ─────────────────────────── CRM ────────────────────────────────── */}
      <SectionCard
        title="CRM"
        description="Controls whether HubSpot company-by-domain enrichment runs for this tenant's visitor traffic. The HubSpot access token is configured in Platform → Integrations → CRM."
      >
        {!platformCrmAvailable && (
          <PlatformMissingBanner
            section="CRM (HubSpot)"
            href="/admin/platform/integrations/crm"
          />
        )}
        <div className="space-y-2">
          <Toggle
            id="crm-enabled"
            checked={crmEnabled}
            onChange={handleCrmEnabled}
            disabled={!platformCrmAvailable}
            label="Enable CRM integration"
            description="Activates HubSpot company-by-domain lookup for this tenant's visitor traffic."
          />
          <Toggle
            id="crm-enrichment"
            checked={crmEnrichment}
            onChange={setCrmEnrichment}
            disabled={!crmEnabled || !platformCrmAvailable}
            label="Use CRM data in decisioning"
            description="Exposes CRM-derived fields (crmMatched, crmIsCustomer, crmIndustry…) to the rules engine and AI provider. Requires CRM enabled."
          />
        </div>
      </SectionCard>

      {/* ─────────────────────────── AI ─────────────────────────────────── */}
      <SectionCard
        title="AI"
        description="AI decision layer configuration for this tenant. Controls the mode (disabled / shadow / live), which provider and model to use, and the confidence threshold. Platform-level API keys are in Platform → Integrations → AI."
      >
        {!platformAiAvailable && aiMode !== "disabled" && (
          <PlatformMissingBanner
            section="AI (Anthropic / OpenAI)"
            href="/admin/platform/integrations/ai"
          />
        )}

        {/* Mode */}
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Mode</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_MODES.map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                  aiMode === m.value
                    ? "border-brand-400 bg-brand-50"
                    : "border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              >
                <input
                  type="radio"
                  name="aiMode"
                  value={m.value}
                  checked={aiMode === m.value}
                  onChange={() => setAiMode(m.value)}
                  className="mt-0.5 h-4 w-4 border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className={`text-[11px] font-semibold ${aiMode === m.value ? "text-brand-700" : "text-neutral-900"}`}>
                    {m.label}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5 leading-tight">{m.note}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Provider slots — only relevant when mode is not disabled */}
        {aiMode !== "disabled" && (
          <div className="space-y-4 rounded-md border border-neutral-100 bg-neutral-50 p-3">
            {/* Live provider */}
            <div>
              <p className="mb-2 text-[11px] font-semibold text-neutral-500">Live provider</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Provider</label>
                  <select
                    value={liveProviderName}
                    onChange={(e) => setLiveProviderName(e.target.value as TenantAiProviderName | "")}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <TextField
                  label="Model override"
                  value={liveProviderModel}
                  onChange={setLiveProviderModel}
                  placeholder="e.g. claude-3-5-haiku-20241022"
                  hint="Leave blank to use the provider default"
                />
              </div>
            </div>

            {/* Shadow provider (only relevant when mode is shadow or live) */}
            <div>
              <p className="mb-2 text-[11px] font-semibold text-neutral-500">Shadow provider</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Provider</label>
                  <select
                    value={shadowProviderName}
                    onChange={(e) => setShadowProviderName(e.target.value as TenantAiProviderName | "")}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <TextField
                  label="Model override"
                  value={shadowProviderModel}
                  onChange={setShadowProviderModel}
                  placeholder="e.g. gpt-4o-mini"
                  hint="Leave blank to use the provider default"
                />
              </div>
            </div>

            {/* Confidence threshold — always visible when AI is enabled (shadow or live) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Confidence threshold
                <span className="ml-1 font-normal text-neutral-400">(0.0-1.0; default 0.75)</span>
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={aiThreshold}
                onChange={(e) => setAiThreshold(e.target.value)}
                placeholder="0.75"
                className="w-32 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <p className="mt-0.5 text-[11px] text-neutral-400">
                Applied to the composite final confidence score (AI confidence ×0.60 + validation
                ×0.20 + context strength ×0.20).{" "}
                {aiMode === "shadow"
                  ? "In shadow mode the threshold is evaluated and logged but never affects the served plan."
                  : "In live mode the AI plan is served only when final confidence meets or exceeds this threshold."}
              </p>
            </div>
          </div>
        )}

        <p className="mt-3 text-[11px] text-neutral-400">
          Per-tenant API key overrides (for clients providing their own keys) are
          managed in the <a href={`/admin/tenants/${tenantId}`} className="text-brand-600 hover:underline">Overview</a> settings form.
        </p>
      </SectionCard>

      {/* ─────────────────────────── Enrichment ─────────────────────────── */}
      <SectionCard
        title="Enrichment"
        description="Controls which IP enrichment providers run for this tenant's visitors. Credentials are configured in Platform → Integrations → Enrichment."
      >
        {!platformEnrichmentAvailable && (
          <PlatformMissingBanner
            section="Enrichment (MaxMind)"
            href="/admin/platform/integrations/enrichment"
          />
        )}
        <div className="space-y-2">
          <Toggle
            id="enrichment-enabled"
            checked={enrichmentEnabled}
            onChange={handleEnrichmentEnabled}
            disabled={!platformEnrichmentAvailable}
            label="Enable enrichment"
            description="Activates the enrichment pipeline for this tenant. Without this, no IP or geo lookups are performed."
          />
          <Toggle
            id="geo-enrichment"
            checked={useGeoEnrichment}
            onChange={setUseGeoEnrichment}
            disabled={!enrichmentEnabled || !platformEnrichmentAvailable}
            label="Use geo (MaxMind) enrichment"
            description="Queries MaxMind GeoIP for visitor city, country, ISP, and VPN status. Populates geoCity, geoCountry, geoOrg, geoIsVpn context fields. Requires enrichment enabled."
          />
          <Toggle
            id="openkvk-enrichment"
            checked={useOpenKvK}
            onChange={setUseOpenKvK}
            disabled={!enrichmentEnabled || !platformEnrichmentAvailable}
            label="Use OpenKvK (Dutch company registry)"
            description="Looks up Dutch companies by name from the public OpenKvK API. No API key required. Runs for NL visitors by default (configurable in Platform → Integrations → Enrichment). Requires enrichment enabled."
          />
          <Toggle
            id="leadinfo-server-enrichment"
            checked={useLeadinfo}
            onChange={setUseLeadinfo}
            disabled={!enrichmentEnabled || !platformEnrichmentAvailable}
            label="Use Leadinfo (server-side IP-to-company)"
            description="Server-side reverse-IP company identification via Leadinfo. Populates companyName, companyIndustry, companyDomain and companySize context fields (used by rules, lead-base and rule webhooks). Requires a platform Leadinfo key (Platform → Integrations → Enrichment) and enrichment consent; business (non-cloud) IPs only. This is separate from the client-side Leadinfo tracking script below."
          />
          <Toggle
            id="seasonal-events"
            checked={useSeasonalEvents}
            onChange={setUseSeasonalEvents}
            disabled={!enrichmentEnabled}
            label="Use seasonal event detection"
            description="Detects public holidays (via Nager.Date) and business events (black-friday, cyber-monday) for the visitor's country and populates the seasonalEvent context variable. Enable the holiday provider in Platform → Integrations → Enrichment first."
          />
        </div>

        {/* ── Firmographics freshness ─────────────────────────────────────── */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="firmo-freshness" className="block text-sm font-medium text-slate-800">
            Firmographics freshness (days)
          </label>
          <p className="mt-1 text-xs text-slate-500">
            How long a recognised visitor&apos;s company data (name, domain, industry,
            size) is reused before re-checking. Within this window the company lookups
            (KvK, CRM) are skipped on repeat visits (saving calls and recognition
            credits) while current location and weather still refresh every visit.
            Default 30.
          </p>
          <input
            id="firmo-freshness"
            type="number"
            min={1}
            max={365}
            value={firmoFreshnessDays}
            onChange={(e) => setFirmoFreshnessDays(e.target.value)}
            disabled={!enrichmentEnabled}
            className="mt-2 w-28 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>

        {/* ── Hot-lead score threshold ────────────────────────────────────── */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="hot-threshold" className="block text-sm font-medium text-slate-800">
            Hot-lead score threshold
          </label>
          <p className="mt-1 text-xs text-slate-500">
            The lead score (0-100) at or above which a returning visitor counts as a hot
            lead, which drives the <code className="font-mono">isHotLead</code> personalization
            signal, the &quot;Hot leads&quot; segment, and the ABM dashboard&apos;s hot
            count/filter. Default 60.
          </p>
          <input
            id="hot-threshold"
            type="number"
            min={0}
            max={100}
            value={hotThreshold}
            onChange={(e) => setHotThreshold(e.target.value)}
            className="mt-2 w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>

        {/* ── Personalization holdout ─────────────────────────────────────── */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="holdout-pct" className="block text-sm font-medium text-slate-800">
            Personalization holdout (%)
          </label>
          <p className="mt-1 text-xs text-slate-500">
            A control group: this % of visitors is deterministically held out and served the
            default (non-personalized) experience, so the Leads → Personalization performance
            report can measure the <strong>true causal lift</strong> of personalization. 0 = off
            (everyone personalized). Max 50.
          </p>
          <input
            id="holdout-pct"
            type="number"
            min={0}
            max={50}
            value={holdoutPct}
            onChange={(e) => setHoldoutPct(e.target.value)}
            className="mt-2 w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>

        {/* ── Lead-score tuning ───────────────────────────────────────────── */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="block text-sm font-medium text-slate-800">Lead-score tuning</div>
          <p className="mt-1 text-xs text-slate-500">
            Weight multipliers (0-5, default 1) for each score component, and an optional
            time-decay half-life in days (0 = off; the score halves every N days as a lead cools).
            Drives the lead score everywhere (list, segment, dashboard, alerts).
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            {[
              { label: "Identity",   value: wLevel,      set: setWLevel },
              { label: "Intent",     value: wIntent,     set: setWIntent },
              { label: "Recency",    value: wRecency,    set: setWRecency },
              { label: "Engagement", value: wEngagement, set: setWEngagement },
            ].map((f) => (
              <label key={f.label} className="text-xs text-slate-600">
                <span className="block">{f.label}</span>
                <input type="number" min={0} max={5} step={0.1} value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className="mt-1 w-20 rounded-md border border-slate-300 px-2 py-1 text-sm" />
              </label>
            ))}
            <label className="text-xs text-slate-600">
              <span className="block">Decay half-life (days)</span>
              <input type="number" min={0} max={365} value={decayHalfLife}
                onChange={(e) => setDecayHalfLife(e.target.value)}
                className="mt-1 w-28 rounded-md border border-slate-300 px-2 py-1 text-sm" />
            </label>
          </div>
        </div>

        {/* ── Test IP override ────────────────────────────────────────────── */}
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Test IP Override
          </p>
          <p className="mb-3 text-xs text-amber-800">
            Substitute a fixed IP address for the <strong>server-side</strong> enrichment pipeline on this tenant:
            MaxMind GeoIP, IPinfo, Reverse Geocode, Weather, OpenKvK, and HubSpot CRM domain lookup.
            Useful for verifying geo-targeting rules without changing your network location.
            Only active in development mode or when{" "}
            <code className="font-mono">ENABLE_DEBUG_IP_OVERRIDE=true</code> is set.
          </p>
          <p className="mb-3 rounded border border-amber-300 bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
            <strong>Leadinfo is not affected.</strong>{" "}
            Leadinfo performs client-side identification directly from the real browser IP. A server-side IP
            override cannot substitute for it. Use the Leadinfo test below to verify real browser identification.
          </p>
          <div className="space-y-2">
            <Toggle
              id="test-ip-enabled"
              checked={testIpEnabled}
              onChange={(v) => {
                setTestIpEnabled(v);
                if (!v) setTestIpAddress("");
              }}
              label="Enable test IP override"
              description="When on, the IP address below replaces the real visitor IP for all enrichment stages on this tenant."
            />
            <div className="mt-1">
              <label
                htmlFor="test-ip-address"
                className="mb-1 block text-xs font-medium text-neutral-700"
              >
                Test IP address
              </label>
              <input
                id="test-ip-address"
                type="text"
                value={testIpAddress}
                onChange={(e) => setTestIpAddress(e.target.value)}
                disabled={!testIpEnabled}
                placeholder="e.g. 8.8.8.8 or 2001:4860:4860::8888"
                className={[
                  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2",
                  "font-mono text-sm text-neutral-900 placeholder:text-neutral-400",
                  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
                  "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
                ].join(" ")}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ──────────────────────────── Leadinfo ──────────────────────────── */}
      <SectionCard
        title="Leadinfo"
        description="Client-side B2B visitor identification. Leadinfo's script runs inside the visitor's real browser. It uses the actual browser IP and cannot be replaced by a server-side IP override. The company result is stored in the mc_li cookie and is available to the server on subsequent page loads."
      >
        <Toggle
          id="li-enabled"
          label="Enable Leadinfo client-side identification"
          description="Injects the LeadinfoProvider component into the page. Runs once per browser session."
          checked={liEnabled}
          onChange={setLiEnabled}
        />

        {liEnabled && (
          <div className="mt-4 space-y-3">

            {/* ── Why there is no IP override field here ─────────────────── */}
            {/*
              Leadinfo is intentionally different from the server-side enrichers
              (MaxMind, IPinfo, Reverse Geocode, Weather, OpenKvK, HubSpot).
              Those run inside the Next.js server process and read `req.ip`, so a
              server-side IP override can substitute any address before the lookup.

              Leadinfo's identify call originates from the visitor's browser and
              goes directly to api.leadinfo.com, the server never touches that
              request.  A fake IP stored in the database cannot intercept a
              browser-to-CDN HTTP call.  This is why:
                • the Enrichment section's "Test IP Override" callout explicitly
                  says "Leadinfo is not affected".
                • there is no IP input field inside this Leadinfo card.
                • testing here always uses the real browser IP.
            */}
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5">
              <p className="mb-1 text-[11px] font-semibold text-blue-700">
                No IP override field. Leadinfo always uses your real browser IP
              </p>
              <p className="text-[11px] leading-relaxed text-blue-700">
                Leadinfo's identify script runs <strong>client-side</strong>. The browser calls
                Leadinfo's CDN directly, and Leadinfo reads the real visitor IP from that
                network connection. A server-side fake-IP override cannot intercept or
                substitute for this flow.
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-blue-700">
                To test from a specific IP address or country, use a VPN or a dedicated
                browser profile from that network. The test below runs the real identify
                flow from <em>your current browser location</em>.
              </p>
              <p className="mt-1.5 text-[11px] text-blue-600">
                The <strong>Test IP Override</strong> in the Enrichment section above applies
                only to server-side enrichers (MaxMind, IPinfo, Reverse Geocode, Weather,
                OpenKvK, HubSpot). It does not affect Leadinfo.
              </p>
            </div>

            {/* ── Simulated downstream enrichment (Leadinfo simulation mode) ── */}
            {/*
              This section is NOT a real Leadinfo test.

              Leadinfo runs client-side: the browser calls api.leadinfo.com
              directly with the real visitor IP, and the server never touches
              that flow.  A server-side IP override cannot intercept it.

              What this DOES simulate:
              Opens the homepage with the configured Test IP Override active
              (?_ip=<testIpAddress>&_ip_override=1).  The server-side enrichment
              pipeline (MaxMind, IPinfo, OpenKvK, HubSpot, etc.) then resolves
              context for that IP, exactly as it would for a visitor whose
              Leadinfo cookie had already been set.  The enrichment debug panel
              at the bottom of the page shows the full downstream context.

              This lets operators answer: "Given a visitor from IP X whose
              Leadinfo cookie is already set, what server-side enrichment context
              does the decision engine have?"

              Uses the Test IP Override configured in the Enrichment section above.
              To change the IP, update it there and save first.
            */}
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold text-amber-800">
                  Simulate Leadinfo downstream enrichment context
                </p>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Simulation only
                </span>
              </div>

              <p className="mb-2 text-[11px] leading-relaxed text-amber-700">
                <strong>Not real Leadinfo identification.</strong>{" "}
                Opens the homepage with the configured{" "}
                <strong>Test IP Override</strong> active, so the server-side
                enrichment pipeline (MaxMind, IPinfo, OpenKvK, HubSpot, etc.)
                resolves downstream context for that IP. The enrichment debug
                panel at the bottom of the opened tab shows the full result.
              </p>
              <p className="mb-2.5 text-[11px] text-amber-700">
                Leadinfo identification is always <strong>client-side</strong> from
                the real browser IP. This simulation does not replicate it. Use the{" "}
                <em>Real-browser identify test</em> below to test real Leadinfo.
              </p>

              {testIpEnabled && testIpAddress.trim() ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-amber-800">
                    IP:{" "}
                    <strong>{testIpAddress.trim()}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const ip = testIpAddress.trim();
                      window.open(
                        `/?_ip=${encodeURIComponent(ip)}&_ip_override=1&_sim=downstream`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    className="rounded border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
                  >
                    Open enrichment simulation →
                  </button>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-amber-700">
                  ⚠ Test IP Override is not configured. Enable it and enter an IP
                  address in the <strong>Enrichment</strong> section above, then save.
                  The simulation button will appear here.
                </p>
              )}
            </div>

            <TextField
              label="Site Token"
              hint="Non-secret public identifier from the Leadinfo dashboard → Script Settings."
              value={liSiteToken}
              onChange={setLiSiteToken}
              placeholder="e.g. abc123def456"
            />
            <Toggle
              id="li-push-to-datalayer"
              label="Push to dataLayer"
              description="When enabled, pushes a leadinfo_identified event with company fields to window.dataLayer after a successful identify call."
              checked={liPushToDataLayer}
              onChange={setLiPushToDataLayer}
            />
            <Toggle
              id="li-store-in-context"
              label="Store in context (mc_li cookie)"
              description="When enabled, persists the Leadinfo result in the mc_li httpOnly cookie via /api/enrichment/leadinfo. Required for server-side enrichment on subsequent requests."
              checked={liStoreInContext}
              onChange={setLiStoreInContext}
            />

            {/* ── Real-browser test flow ───────────────────────────────────── */}
            {/*
              Direct fetch() to api.leadinfo.com from this admin page would fail
              with CORS errors: Leadinfo only allows identify calls that originate
              from the registered domain.  The test therefore loads the real site
              in a hidden same-origin iframe so LeadinfoProvider runs naturally,
              exactly as it does for a real visitor.
            */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold text-neutral-700">
                  Real-browser identify test
                </p>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  Real browser IP
                </span>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-neutral-500">
                Loads the site in a hidden same-origin iframe so the LeadinfoProvider
                script runs in a real browser context with your <em>actual IP address</em>.
                This is the only valid way to test Leadinfo. The Test IP Override in
                the Enrichment section does not apply here. To test from a different
                location, connect via VPN before running this test.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleTestLeadinfo()}
                  disabled={liTestState.mode === "testing"}
                  className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {liTestState.mode === "testing" ? "Testing…" : "Run identify test"}
                </button>
                <button
                  onClick={handleClearLeadinfoCookie}
                  disabled={liTestState.mode === "testing"}
                  className="rounded border border-neutral-100 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:border-neutral-200 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear mc_li &amp; reset
                </button>
              </div>

              <LeadinfoTestResultPanel
                state={liTestState}
                onDismiss={() => setLiTestState({ mode: "idle" })}
                onClear={handleClearLeadinfoCookie}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ─────────────────────────── GTM ─────────────────────────────── */}
      <SectionCard
        title="Google Tag Manager"
        description="Per-tenant GTM container. When set, the GTM snippet is loaded on the site, which establishes window.dataLayer, required for GTM tags and any dataLayer-based integration (e.g. Leadinfo's dataLayer push). Leave empty to disable."
      >
        <TextField
          label="Container ID"
          hint="Format GTM-XXXXXXX (found in your GTM workspace). An invalid value is ignored."
          value={gtmContainerId}
          onChange={setGtmContainerId}
          placeholder="GTM-ABC1234"
        />
      </SectionCard>

      {/* ─────────────────────────── GA4 ─────────────────────────────── */}
      <SectionCard
        title="Google Analytics 4"
        description="Per-tenant GA4 integration. Tracking (send) controls client-side gtag.js or server-side Measurement Protocol event forwarding. Analytics History queries the GA4 Data API to enrich returning visitors with historical session signals."
      >
        {/* ── GA4 Tracking ──────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-xs font-semibold text-neutral-700">Tracking (send)</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              ga4TrackEnabled ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
            }`}>
              {ga4TrackEnabled ? "✓ Enabled" : "Disabled"}
            </span>
          </div>

          <div className="space-y-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
            <Toggle
              id="ga4-track-enabled"
              checked={ga4TrackEnabled}
              onChange={setGa4TrackEnabled}
              label="Enable GA4 event tracking"
              description="Send visitor interaction events to Google Analytics 4 for this tenant."
            />

            {ga4TrackEnabled && (
              <div className="space-y-3 pt-1">
                <TextField
                  label="Measurement ID"
                  value={ga4MeasurementId}
                  onChange={setGa4MeasurementId}
                  placeholder="G-XXXXXXXXXX"
                  hint="GA4 Measurement ID from Admin → Data Streams → Web stream. Required for tracking."
                />

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Send mode</label>
                  <select
                    value={ga4SendMode}
                    onChange={(e) => setGa4SendMode(e.target.value as "off" | "client" | "server")}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    <option value="off">Off (no events sent)</option>
                    <option value="client">Client (inject gtag.js in the browser)</option>
                    <option value="server">Server (Measurement Protocol via API route)</option>
                  </select>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    Client mode injects gtag.js; server mode sends via the Measurement Protocol (requires API Secret below).
                  </p>
                </div>

                <TextField
                  label="Visitor ID param name"
                  value={ga4VisitorParam}
                  onChange={setGa4VisitorParam}
                  placeholder="visitor_id"
                  hint='Name of the GA4 user property / custom dimension that stores the visitor ID. Default: "visitor_id".'
                />

                {ga4SendMode === "server" && (
                  <SecretField
                    label="API Secret"
                    value={ga4ApiSecret}
                    onChange={setGa4ApiSecret}
                    hasExisting={initialGa4.tracking.hasApiSecret}
                    placeholder="Paste API Secret from GA4 Admin → Data Streams → Measurement Protocol API secrets…"
                    hint="Required for server-side Measurement Protocol sends. Never echoed back after saving."
                  />
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <TestButton
              isTesting={ga4TrackTestState.mode === "testing"}
              onTest={handleTestGa4Tracking}
            />
          </div>
          <TestResultPanel
            state={ga4TrackTestState}
            onDismiss={() => setGa4TrackTestState({ mode: "idle" })}
          />
        </div>

        {/* ── GA4 Analytics History ──────────────────────────────────────── */}
        <div className="border-t border-neutral-100 pt-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-xs font-semibold text-neutral-700">Analytics History</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              ga4HistEnabled ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
            }`}>
              {ga4HistEnabled ? "✓ Enabled" : "Disabled"}
            </span>
            {initialGa4.history.hasServiceAccount && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-100 text-green-700">
                ✓ Service account configured
              </span>
            )}
          </div>

          <p className="mb-3 text-[11px] text-neutral-500">
            Queries the GA4 Data API to enrich returning visitors with historical signals (session count, last-known city, channel group). Requires a service account with <strong>Viewer</strong> access to the GA4 property, and a User-scoped custom dimension matching the visitor ID param name above.
          </p>

          <div className="space-y-3 rounded-md border border-neutral-100 bg-neutral-50 p-3">
            <Toggle
              id="ga4-hist-enabled"
              checked={ga4HistEnabled}
              onChange={setGa4HistEnabled}
              label="Enable GA4 Analytics History enrichment"
              description="Runs the GA4 Data API history lookup for returning visitors."
            />

            {ga4HistEnabled && (
              <div className="space-y-3 pt-1">
                <TextField
                  label="GA4 Property ID"
                  value={ga4PropertyId}
                  onChange={setGa4PropertyId}
                  placeholder="e.g. 123456789"
                  hint="Numeric property ID from GA4 Admin → Property Settings. Not the measurement ID (G-XXXXXXXX)."
                />

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Service Account JSON</label>
                  {initialGa4.history.hasServiceAccount && !ga4ServiceJson && (
                    <div className="mb-1.5 flex items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5">
                      <span className="font-mono text-xs tracking-widest text-neutral-400">••••••••••••••••••••••••••••••••</span>
                      <span className="ml-auto text-[11px] text-green-600 font-medium">configured</span>
                    </div>
                  )}
                  <textarea
                    value={ga4ServiceJson}
                    onChange={(e) => setGa4ServiceJson(e.target.value)}
                    rows={4}
                    placeholder={
                      initialGa4.history.hasServiceAccount
                        ? "Paste new JSON key to replace existing…"
                        : '{"type":"service_account","project_id":"…","private_key":"…","client_email":"…"}'
                    }
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    Leave blank to keep the existing value. Paste the full JSON key file from the Google Cloud Console.
                  </p>
                </div>

                <TextField
                  label="Visitor ID dimension name"
                  value={ga4VisitorDim}
                  onChange={setGa4VisitorDim}
                  placeholder="visitor_id"
                  hint='User-scoped custom dimension in GA4 that stores the visitor ID. The "customUser:" prefix is added automatically. Default: visitor_id'
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Lookback days</label>
                    <input
                      type="number"
                      value={ga4LookbackDays}
                      onChange={(e) => setGa4LookbackDays(e.target.value)}
                      min={1}
                      max={365}
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <p className="mt-0.5 text-[11px] text-neutral-400">How far back to query GA4 history (days). Default: 90</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Cache TTL (minutes)</label>
                    <input
                      type="number"
                      value={ga4CacheTtl}
                      onChange={(e) => setGa4CacheTtl(e.target.value)}
                      min={1}
                      max={1440}
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <p className="mt-0.5 text-[11px] text-neutral-400">How long to cache GA4 results per visitor. Default: 30</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <TestButton
              isTesting={ga4HistTestState.mode === "testing"}
              onTest={handleTestGa4History}
            />
          </div>
          <TestResultPanel
            state={ga4HistTestState}
            onDismiss={() => setGa4HistTestState({ mode: "idle" })}
          />
        </div>
      </SectionCard>

      {/* ─────────────────────────── Domains ────────────────────────────── */}
      <SectionCard
        title="Domains"
        description="Vercel deployment mapping for this tenant. Hostnames (primaryDomain, additionalDomains) are configured in the Overview settings. The Vercel API token is in Platform → Integrations → Domains."
      >
        {!platformDomainsAvailable && (
          <PlatformMissingBanner
            section="Domains (Vercel)"
            href="/admin/platform/integrations/domains"
          />
        )}

        <TextField
          label="Vercel project ID"
          value={vercelProjectId}
          onChange={setVercelProjectId}
          placeholder="e.g. my-project or prj_abc123"
          hint="The Vercel project this tenant maps to for domain provisioning. Leave blank to use the platform default."
          disabled={!platformDomainsAvailable}
        />

        {/* Domain summary (read-only) */}
        {(initialDomains.primaryDomain || initialDomains.additionalDomains) && (
          <div className="mt-4 rounded-md border border-neutral-100 bg-neutral-50 p-3">
            <p className="mb-2 text-[11px] font-semibold text-neutral-500">Configured domains</p>
            {initialDomains.primaryDomain && (
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-neutral-200 text-neutral-600">
                  primary
                </span>
                <code className="font-mono text-neutral-700">{initialDomains.primaryDomain}</code>
              </div>
            )}
            {initialDomains.additionalDomains && (
              <div className="mt-1.5 space-y-1">
                {initialDomains.additionalDomains.split("\n").filter(Boolean).map((d) => (
                  <div key={d} className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-neutral-200 text-neutral-500">
                      alias
                    </span>
                    <code className="font-mono text-neutral-700">{d}</code>
                  </div>
                ))}
              </div>
            )}
            <a
              href={`/admin/tenants/${tenantId}`}
              className="mt-2 inline-block text-[11px] text-brand-600 hover:underline"
            >
              Edit domains in Overview →
            </a>
          </div>
        )}
      </SectionCard>

      {/* ─────────────────────────── Save ───────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save all settings"}
        </button>

        {saveState.mode === "success" && (
          <span className="flex items-center gap-1.5 text-xs text-green-700">
            ✓ Settings saved
            <button
              onClick={() => setSaveState({ mode: "idle" })}
              className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
            >
              Dismiss
            </button>
          </span>
        )}

        {saveState.mode === "error" && (
          <span className="text-xs text-red-700">
            {saveState.message}
            <button
              onClick={() => setSaveState({ mode: "idle" })}
              className="ml-2 text-[11px] text-neutral-400 underline hover:text-neutral-600"
            >
              Dismiss
            </button>
          </span>
        )}
      </div>

    </div>
  );
}
