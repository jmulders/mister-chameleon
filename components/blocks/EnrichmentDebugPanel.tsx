/**
 * EnrichmentDebugPanel
 *
 * Dev-only server component that renders an enrichment observability section
 * inside the homepage diagnostics panel.
 *
 * ─── What this shows ─────────────────────────────────────────────────────────
 *
 *   IP section (PART 4)
 *     • Real IP   — extracted from x-forwarded-for / x-real-ip
 *     • Effective IP — the IP actually used for geo/network lookups
 *       (real IP unless an operator override is active)
 *     • Override active indicator — highlighted when an IP override is in effect
 *
 *   Pipeline timeline (PART 2)
 *     • One row per stage in the staged enrichment pipeline
 *     • Shows label, duration, skipped/error status, and which fields it produced
 *     • When the session cache was hit, a single "session cache" row replaces the timeline
 *
 *   Session cache status
 *     • "hit" — pipeline was skipped; cached result from a prior page view was used
 *     • "miss" — pipeline ran; the miss reason explains why (no-entry, ip-changed, …)
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Render this only when NODE_ENV === "development" or ?debug=1 is set.
 *   The caller (page.tsx) is responsible for that guard.
 *   IP values are shown only in this server-rendered dev overlay and are
 *   never included in client-side bundles or analytics payloads.
 */

import type { EnrichmentDebugInfo }  from "@/decision/context/build-decision-context";
import type { StageTrace }           from "@/enrichment/types";

// ── Public props ───────────────────────────────────────────────────────────────

export interface Ga4TrackingDebugInfo {
  /** The stable visitor ID sent to GA4 as a user property (sourced from mc_session_id). */
  visitorId:          string;
  /** GA4 Measurement ID (e.g. "G-XXXXXXXXXX"), or empty when not configured. */
  measurementId:      string;
  /** GA4 user property / custom dimension name used for the visitor ID. */
  visitorIdParamName: string;
  /** Current send mode for GA4 tracking. */
  sendMode:           "off" | "client" | "server";
  /** Whether GA4 tracking is active (measurementId is set and sendMode ≠ "off"). */
  active:             boolean;
}

/**
 * Debug info for the GA4 Analytics History enricher stage.
 * Populated by app/page.tsx from the stage trace + tenant config.
 * Shows whether the stage ran, what visitor ID was looked up, what
 * custom dimension was queried, and whether GA4 returned any data.
 */
export interface Ga4HistoryDebugInfo {
  /** True when GA4 History is enabled and included in the pipeline. */
  configured: boolean;
  /** The visitor ID (mc_session_id UUID) used — or that would be used — for lookup. */
  visitorId: string | null;
  /** The GA4 custom dimension name queried, e.g. "customUser:visitor_id". */
  dimensionName: string;
  /**
   * What happened when the stage ran this request:
   *   "ran-with-data"  — stage ran and GA4 returned ≥1 row for this visitor
   *   "ran-empty"      — stage ran but GA4 returned 0 rows (visitor not seen yet)
   *   "skipped"        — shouldRun() returned false (visitor ID was null/empty)
   *   "error"          — enricher threw or timed out
   *   "session-cache"  — pipeline was skipped; enrichment came from session cache
   *   "not-configured" — stage not in pipeline (disabled or no service account)
   */
  stageStatus: "ran-with-data" | "ran-empty" | "skipped" | "error" | "session-cache" | "not-configured";
  /** Human-readable reason why the stage was skipped (when stageStatus === "skipped"). */
  skipReason?: string;
  /** Error message when stageStatus === "error". */
  error?: string;
  /** Wall-clock duration in ms (0 when skipped or not run). */
  durationMs: number;
  /** Number of date-rows returned by the GA4 Data API. 0 = no data; 1 = current only; ≥2 = current + previous. */
  rowsReturned?: number;
  /** Location / channel from the most-recent GA4 session date (row[0] ordered by date DESC). */
  gaCurrentCity?: string | null;
  gaCurrentRegion?: string | null;
  gaCurrentCountry?: string | null;
  gaCurrentChannelGroup?: string | null;
  /** Location / channel from a previous GA4 session (row[1]). Null when only one date-row exists. */
  gaLastKnownCity?: string | null;
  gaLastKnownRegion?: string | null;
  gaLastKnownCountry?: string | null;
  gaLastChannelGroup?: string | null;
}

/**
 * Debug info for the Leadinfo client-side identify integration.
 * Populated by app/page.tsx from the mc_li cookie content + tenant config.
 */
export interface LeadinfoDebugInfo {
  /** True when Leadinfo is enabled and a siteToken is configured. */
  configured: boolean;
  /** Whether the mc_li cookie is present (identify was run in a prior page load). */
  cookiePresent: boolean;
  /** Whether the Leadinfo identify call returned a company match. */
  matched: boolean | null;
  /** Company name returned by Leadinfo, if matched. */
  companyName: string | null;
  /** Company domain returned by Leadinfo, if matched. */
  companyDomain: string | null;
  /** Country code returned by Leadinfo, if matched. */
  companyCountry: string | null;
  /** Whether pushToDataLayer is enabled in tenant settings. */
  pushToDataLayer: boolean;
  /** Whether storeInContext is enabled in tenant settings. */
  storeInContext: boolean;
  /**
   * How the mc_li Leadinfo cookie data was produced.
   *
   *   "real-browser" — mc_li cookie is present; it was set by LeadinfoProvider
   *                    running in the visitor's real browser context.  Leadinfo
   *                    always identifies from the actual browser IP — the server-
   *                    side IP override cannot intercept or substitute for it.
   *   "absent"       — mc_li cookie is not present; LeadinfoProvider has not
   *                    run yet, or the identify call returned no result.
   *
   * An active IP override does NOT change this value — Leadinfo identification
   * is always real-browser, independent of any server-side IP override.
   */
  dataSource: "real-browser" | "absent";
  /**
   * Populated when this page load was opened by the "Simulate Leadinfo downstream
   * enrichment context" button in the admin integrations panel.
   *
   *   "leadinfo_downstream" — The page is a simulation tab, not a real visitor
   *     session.  The IP override is active (using testIpAddress from DB).  The
   *     LeadinfoProvider browser identify flow intentionally does NOT run.  The
   *     mc_li cookie is therefore absent by design.  The debug panel replaces the
   *     normal Leadinfo status row with a clear simulation-mode explanation.
   *
   * When undefined the page is a normal (non-simulation) visitor request.
   */
  simulationMode?: "leadinfo_downstream";
}

export interface RulesDebugInfo {
  /**
   * Whether the tenant-level rules master switch is on.
   * false → all rules were skipped; default plan was used.
   */
  rulesEnabled: boolean;
  /**
   * IDs of rules that were individually disabled and skipped.
   * Empty when all rules are enabled or when rulesEnabled=false.
   */
  disabledRuleIds: string[];
}

export interface EnrichmentDebugPanelProps {
  info: EnrichmentDebugInfo;
  /** Optional GA4 tracking status — shown when GA4 tracking is configured. */
  ga4Tracking?: Ga4TrackingDebugInfo;
  /** Optional GA4 Analytics History enricher status. */
  ga4History?: Ga4HistoryDebugInfo;
  /** Optional Leadinfo client-side enrichment status. */
  leadinfoDebug?: LeadinfoDebugInfo;
  /** Optional rules engine status — shown when tenant-specific rules are loaded. */
  rulesDebug?: RulesDebugInfo;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EnrichmentDebugPanel({ info, ga4Tracking, ga4History, leadinfoDebug, rulesDebug }: EnrichmentDebugPanelProps) {
  const {
    realIp,
    effectiveIp,
    ipOverrideActive,
    enrichmentSource,
    sessionCacheMissReason,
    stageTrace,
  } = info;

  // Capture ipOverrideActive in a local so the Leadinfo section can reference it.
  const overrideActive = ipOverrideActive;

  const isSessionHit = enrichmentSource === "session-cache";

  return (
    <details
      open
      style={{
        margin:       "0.75rem 0",
        border:       "1px solid #e5e7eb",
        borderRadius: "6px",
        overflow:     "hidden",
        fontFamily:   "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
        fontSize:     "12px",
      }}
    >
      {/* ── Panel header ──────────────────────────────────────────────────── */}
      <summary
        style={{
          cursor:     "pointer",
          padding:    "0.5rem 0.75rem",
          background: "#1e293b",
          color:      "#f1f5f9",
          display:    "flex",
          alignItems: "center",
          gap:        "0.75rem",
          listStyle:  "none",
          userSelect: "none",
        }}
      >
        <span
          style={{
            background:    "#be185d",
            color:         "#fff",
            borderRadius:  "3px",
            padding:       "0 5px",
            fontWeight:    700,
            fontSize:      "10px",
            letterSpacing: "0.05em",
          }}
        >
          ENR
        </span>

        <span style={{ fontWeight: 600 }}>Enrichment Pipeline</span>

        {/* Cache status pill */}
        <span
          style={{
            padding:      "1px 6px",
            borderRadius: "9999px",
            background:   isSessionHit ? "#d1fae5" : "#fef3c7",
            color:        isSessionHit ? "#065f46" : "#92400e",
            fontSize:     "10px",
            fontWeight:   600,
          }}
        >
          {isSessionHit ? "▸ session cache hit" : "▸ pipeline ran"}
        </span>

        {/* IP override indicator */}
        {ipOverrideActive && (
          <span
            style={{
              padding:      "1px 6px",
              borderRadius: "9999px",
              background:   "#fde68a",
              color:        "#78350f",
              fontSize:     "10px",
              fontWeight:   700,
              border:       "1px solid #f59e0b",
            }}
          >
            ⚠ IP OVERRIDE ACTIVE
          </span>
        )}

        {/* Simulation mode indicator — shown when page was opened via simulation button */}
        {leadinfoDebug?.simulationMode === "leadinfo_downstream" && (
          <span
            style={{
              padding:      "1px 8px",
              borderRadius: "9999px",
              background:   "#ede9fe",
              color:        "#4c1d95",
              fontSize:     "10px",
              fontWeight:   700,
              border:       "1px solid #c4b5fd",
              letterSpacing: "0.04em",
            }}
          >
            ⚙ SIMULATION: leadinfo_downstream
          </span>
        )}

        {/* Stage count summary */}
        {!isSessionHit && stageTrace.length > 0 && (
          <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: "11px" }}>
            {stageTrace.filter((s) => !s.skipped && !s.error).length} / {stageTrace.length} stages ran
          </span>
        )}
      </summary>

      <div style={{ background: "#ffffff" }}>

        {/* ── IP section (PART 4) ───────────────────────────────────────── */}
        <div
          style={{
            padding:     "0.5rem 0.75rem",
            borderBottom: "1px solid #f1f5f9",
            display:     "flex",
            gap:         "1.5rem",
            flexWrap:    "wrap",
            alignItems:  "center",
          }}
        >
          <IpField
            label="Real IP"
            value={realIp}
            dimmed={ipOverrideActive}
            tooltip="Extracted from x-forwarded-for / x-real-ip request headers"
          />

          <IpField
            label="Effective IP"
            value={effectiveIp}
            highlight={ipOverrideActive}
            tooltip={
              ipOverrideActive
                ? "⚠ Operator IP override is active — this IP is used for all geo/network lookups"
                : "Same as real IP (no override active)"
            }
          />

          {ipOverrideActive && (
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: "4px",
                background:   "#fef3c7",
                color:        "#92400e",
                fontSize:     "11px",
                fontWeight:   600,
                border:       "1px solid #fde68a",
              }}
            >
              Override active — enrichment results reflect the override IP, not the real visitor IP
            </span>
          )}
        </div>

        {/* ── Session cache status ──────────────────────────────────────── */}
        {!isSessionHit && sessionCacheMissReason && (
          <div
            style={{
              padding:      "0.35rem 0.75rem",
              borderBottom: "1px solid #f1f5f9",
              background:   "#fffbeb",
              color:        "#92400e",
              fontSize:     "11px",
            }}
          >
            Session cache miss: <strong>{sessionCacheMissReason}</strong>
            {" "}—{" "}
            {SESSION_MISS_EXPLANATIONS[sessionCacheMissReason] ?? "pipeline re-ran"}
          </div>
        )}

        {isSessionHit && (
          <div
            style={{
              padding:      "0.35rem 0.75rem",
              borderBottom: "1px solid #f1f5f9",
              background:   "#ecfdf5",
              color:        "#065f46",
              fontSize:     "11px",
            }}
          >
            Session cache hit — pipeline skipped for this page view. Enrichment data reused from a prior request in this session.
          </div>
        )}

        {/* ── Pipeline stage timeline (PART 2) ─────────────────────────── */}
        {stageTrace.length > 0 && (
          <details open style={{ borderBottom: "1px solid #f1f5f9" }}>
            <summary
              style={{
                cursor:      "pointer",
                padding:     "0.35rem 0.75rem",
                background:  "#fdf2f8",
                borderLeft:  "3px solid #be185d",
                color:       "#be185d",
                fontWeight:  600,
                fontSize:    "11px",
                listStyle:   "none",
                userSelect:  "none",
                display:     "flex",
                alignItems:  "center",
                gap:         "0.5rem",
              }}
            >
              Pipeline Stages
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                (total: {stageTrace.reduce((acc, s) => acc + s.durationMs, 0)} ms)
              </span>
            </summary>

            <table
              style={{
                width:          "100%",
                borderCollapse: "collapse",
                fontSize:       "11px",
                tableLayout:    "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "50%" }} />
              </colgroup>
              <thead>
                <tr
                  style={{
                    background:   "#f8fafc",
                    borderBottom: "1px solid #e5e7eb",
                    color:        "#94a3b8",
                  }}
                >
                  <th style={{ padding: "3px 8px", textAlign: "left", fontWeight: 600 }}>stage</th>
                  <th style={{ padding: "3px 8px", textAlign: "right", fontWeight: 600 }}>ms</th>
                  <th style={{ padding: "3px 8px", textAlign: "center", fontWeight: 600 }}>status</th>
                  <th style={{ padding: "3px 8px", textAlign: "left", fontWeight: 600 }}>fields produced</th>
                </tr>
              </thead>
              <tbody>
                {stageTrace.map((stage, i) => (
                  <StageRow key={i} stage={stage} isEven={i % 2 === 0} />
                ))}
              </tbody>
            </table>
          </details>
        )}

      </div>

      {/* ── Rules engine debug ───────────────────────────────────────────── */}
      {rulesDebug && (
        <div
          style={{
            padding:      "0.5rem 0.75rem",
            borderTop:    "1px solid #e5e7eb",
            background:   rulesDebug.rulesEnabled ? "#f8fafc" : "#fefce8",
            display:      "flex",
            gap:          "1.5rem",
            flexWrap:     "wrap",
            alignItems:   "center",
          }}
        >
          {/* Rules status pill */}
          <span
            style={{
              padding:      "1px 7px",
              borderRadius: "9999px",
              background:   rulesDebug.rulesEnabled ? "#f1f5f9" : "#fef9c3",
              color:        rulesDebug.rulesEnabled ? "#334155" : "#854d0e",
              fontSize:     "10px",
              fontWeight:   700,
              border:       rulesDebug.rulesEnabled ? "1px solid #e2e8f0" : "1px solid #fde047",
            }}
          >
            {rulesDebug.rulesEnabled ? "▸ Rules engine enabled" : "▸ Rules engine DISABLED"}
          </span>

          {!rulesDebug.rulesEnabled && (
            <span style={{ color: "#a16207", fontSize: "11px" }}>
              All rules skipped — default plan served
            </span>
          )}

          {rulesDebug.rulesEnabled && rulesDebug.disabledRuleIds.length > 0 && (
            <span style={{ color: "#6b7280", fontSize: "11px" }}>
              {rulesDebug.disabledRuleIds.length} rule{rulesDebug.disabledRuleIds.length === 1 ? "" : "s"} individually disabled:&nbsp;
              <span style={{ fontFamily: "monospace", color: "#ef4444" }}>
                {rulesDebug.disabledRuleIds.join(", ")}
              </span>
            </span>
          )}
        </div>
      )}

      {/* ── GA4 Tracking debug ────────────────────────────────────────────── */}
      {ga4Tracking && (
        <div
          style={{
            padding:      "0.5rem 0.75rem",
            borderTop:    "1px solid #e5e7eb",
            background:   ga4Tracking.active ? "#f0fdf4" : "#fafafa",
            display:      "flex",
            gap:          "1.5rem",
            flexWrap:     "wrap",
            alignItems:   "center",
          }}
        >
          {/* GA4 status pill */}
          <span
            style={{
              padding:      "1px 7px",
              borderRadius: "9999px",
              background:   ga4Tracking.active ? "#dcfce7" : "#f1f5f9",
              color:        ga4Tracking.active ? "#166534" : "#64748b",
              fontSize:     "10px",
              fontWeight:   700,
              border:       ga4Tracking.active ? "1px solid #86efac" : "1px solid #e2e8f0",
            }}
          >
            {ga4Tracking.active ? "▸ GA4 tracking active" : "▸ GA4 tracking off"}
          </span>

          <Ga4Field label="visitor_id" value={ga4Tracking.visitorId} />
          <Ga4Field label="measurementId" value={ga4Tracking.measurementId || "—"} />
          <Ga4Field label="param" value={ga4Tracking.visitorIdParamName} />
          <Ga4Field label="sendMode" value={ga4Tracking.sendMode} />
        </div>
      )}

      {/* ── GA4 Analytics History debug ───────────────────────────────────── */}
      {ga4History && (
        <div
          style={{
            padding:      "0.5rem 0.75rem",
            borderTop:    "1px solid #e5e7eb",
            background:   ga4History.stageStatus === "ran-with-data" ? "#f0fdf4"
                        : ga4History.stageStatus === "error"          ? "#fef2f2"
                        : ga4History.stageStatus === "not-configured" ? "#fafafa"
                        : "#fffbeb",
            display:      "flex",
            gap:          "1.5rem",
            flexWrap:     "wrap",
            alignItems:   "flex-start",
          }}
        >
          {/* Status pill */}
          <span
            style={{
              padding:      "1px 7px",
              borderRadius: "9999px",
              fontSize:     "10px",
              fontWeight:   700,
              border:       "1px solid",
              ...(ga4History.stageStatus === "ran-with-data"  ? { background: "#dcfce7", color: "#166534", borderColor: "#86efac" } :
                  ga4History.stageStatus === "ran-empty"      ? { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" } :
                  ga4History.stageStatus === "skipped"        ? { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" } :
                  ga4History.stageStatus === "error"          ? { background: "#fee2e2", color: "#991b1b", borderColor: "#fca5a5" } :
                  ga4History.stageStatus === "session-cache"  ? { background: "#e0f2fe", color: "#0c4a6e", borderColor: "#7dd3fc" } :
                  /* not-configured */                          { background: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" }),
            }}
          >
            {ga4History.stageStatus === "ran-with-data"  ? "▸ GA4 history: data found"
           : ga4History.stageStatus === "ran-empty"      ? "▸ GA4 history: 0 rows (no data yet)"
           : ga4History.stageStatus === "skipped"        ? "▸ GA4 history: skipped"
           : ga4History.stageStatus === "error"          ? "▸ GA4 history: error"
           : ga4History.stageStatus === "session-cache"  ? "▸ GA4 history: session cache"
           :                                               "▸ GA4 history: not configured"}
          </span>

          {/* Visitor ID */}
          <Ga4Field
            label="lookup visitor_id"
            value={ga4History.visitorId ?? "— (null — stage will skip)"}
          />

          {/* Custom dimension */}
          <Ga4Field label="GA4 dimension" value={ga4History.dimensionName} />

          {/* Duration (only when stage ran) */}
          {ga4History.durationMs > 0 && (
            <Ga4Field label="duration" value={`${ga4History.durationMs} ms`} />
          )}

          {/* Row count */}
          {ga4History.rowsReturned !== undefined && (
            <Ga4Field label="rows returned" value={String(ga4History.rowsReturned)} />
          )}

          {/* Current session data (row[0] — most recent date) */}
          {ga4History.stageStatus === "ran-with-data" && (
            <>
              <Ga4Field
                label="current city"
                value={ga4History.gaCurrentCity ?? "—"}
              />
              <Ga4Field
                label="current country"
                value={ga4History.gaCurrentCountry ?? "—"}
              />
              {ga4History.gaCurrentChannelGroup && (
                <Ga4Field label="current channel" value={ga4History.gaCurrentChannelGroup} />
              )}
              {/* Previous session data (row[1] — only present when ≥2 rows returned) */}
              {(ga4History.rowsReturned ?? 0) >= 2 ? (
                <>
                  <Ga4Field
                    label="prev city"
                    value={ga4History.gaLastKnownCity ?? "—"}
                  />
                  <Ga4Field
                    label="prev country"
                    value={ga4History.gaLastKnownCountry ?? "—"}
                  />
                  {ga4History.gaLastChannelGroup && (
                    <Ga4Field label="prev channel" value={ga4History.gaLastChannelGroup} />
                  )}
                  <span style={{ color: "#15803d", fontSize: "11px", flexBasis: "100%" }}>
                    <strong>current*</strong> = most-recent GA4 session date (row 1 of {ga4History.rowsReturned}, ordered by date DESC).{" "}
                    <strong>prev*</strong> = previous session date (row 2) — the visitor was seen before, location may have changed.
                  </span>
                </>
              ) : (
                <span style={{ color: "#15803d", fontSize: "11px", flexBasis: "100%" }}>
                  Only 1 date-row returned — <strong>current*</strong> is the visitor&apos;s first (and only) known GA4 session.
                  No previous session data available; <strong>gaLastKnown*</strong> fields are null.
                </span>
              )}
            </>
          )}

          {/* Contextual explanation */}
          {ga4History.stageStatus === "skipped" && ga4History.skipReason && (
            <span style={{ color: "#92400e", fontSize: "11px", flexBasis: "100%" }}>
              ⚠ Skipped: {ga4History.skipReason}
            </span>
          )}
          {ga4History.stageStatus === "ran-empty" && (
            <span style={{ color: "#92400e", fontSize: "11px", flexBasis: "100%" }}>
              GA4 returned 0 rows for this visitor ID. The visitor has not yet been seen by GA4,
              or the custom dimension <code>{ga4History.dimensionName}</code> is not registered in
              GA4 Admin → Custom Definitions. Check that GA4 Tracking is active and has sent at
              least one event with this visitor ID.
            </span>
          )}
          {ga4History.stageStatus === "error" && ga4History.error && (
            <span style={{ color: "#991b1b", fontSize: "11px", flexBasis: "100%" }}>
              Error: {ga4History.error}
            </span>
          )}
          {ga4History.stageStatus === "session-cache" && (
            <span style={{ color: "#0c4a6e", fontSize: "11px" }}>
              Enrichment served from session cache — GA4 History stage did not re-run this request.
            </span>
          )}
          {ga4History.stageStatus === "not-configured" && (
            <span style={{ color: "#64748b", fontSize: "11px" }}>
              GA4 History not enabled for this tenant. Configure it in Admin → Tenants → [tenant] → Integrations → GA4.
            </span>
          )}
        </div>
      )}

      {/* ── Location source resolution (PARTS 5, 11, 12) ────────────────── */}
      {/*
        Shows clearly:
          - currentCity / region / country (the normalized "best" values)
          - currentLocationSource ("ga4" or "ip_geo")
          - whether IP geo still ran for coordinates (independent of GA4 location)
      */}
      <div
        style={{
          padding:      "0.5rem 0.75rem",
          borderTop:    "1px solid #e5e7eb",
          background:   info.currentLocationSource === "ga4"    ? "#f0fdf4"
                      : info.currentLocationSource === "ip_geo" ? "#f8fafc"
                      : "#fafafa",
          display:      "flex",
          gap:          "1.5rem",
          flexWrap:     "wrap",
          alignItems:   "flex-start",
        }}
      >
        {/* Source label */}
        <span
          style={{
            padding:      "1px 7px",
            borderRadius: "9999px",
            fontSize:     "10px",
            fontWeight:   700,
            border:       "1px solid",
            flexShrink:   0,
            ...(info.currentLocationSource === "ga4"
              ? { background: "#dcfce7", color: "#166534", borderColor: "#86efac" }
              : info.currentLocationSource === "ip_geo"
              ? { background: "#e0f2fe", color: "#0c4a6e", borderColor: "#7dd3fc" }
              : { background: "#f1f5f9", color: "#94a3b8", borderColor: "#e2e8f0" }),
          }}
        >
          {info.currentLocationSource === "ga4"
            ? "▸ Location source: GA4 (preferred)"
            : info.currentLocationSource === "ip_geo"
            ? "▸ Location source: IP geo (fallback)"
            : "▸ Location source: none resolved"}
        </span>

        {/* Normalized current* fields */}
        {info.currentCity    && <Ga4Field label="currentCity"    value={info.currentCity} />}
        {info.currentRegion  && <Ga4Field label="currentRegion"  value={info.currentRegion} />}
        {info.currentCountry && <Ga4Field label="currentCountry" value={info.currentCountry} />}

        {/* IP geo coordinates indicator */}
        <span
          style={{
            padding:      "1px 7px",
            borderRadius: "9999px",
            fontSize:     "10px",
            fontWeight:   700,
            border:       "1px solid",
            flexShrink:   0,
            ...(info.ipGeoHasCoordinates
              ? { background: "#dbeafe", color: "#1e40af", borderColor: "#93c5fd" }
              : { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }),
          }}
        >
          {info.ipGeoHasCoordinates
            ? "▸ IP geo: coordinates resolved (lat/lng available)"
            : "▸ IP geo: no coordinates (lat/lng null)"}
        </span>

        {/* ── Geo provenance & coherence (which provider set city vs coords) ── */}
        {(info.geoCitySource || info.geoCoordsSource || info.locationConfidence) && (
          <span style={{ flexBasis: "100%", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginTop: "2px" }}>
            <Ga4Field label="city ←"   value={info.geoCitySource   ?? "—"} />
            <Ga4Field label="coords ←" value={info.geoCoordsSource ?? "—"} />
            {info.locationConfidence && (
              <span
                style={{
                  padding: "1px 7px", borderRadius: "9999px", fontSize: "10px", fontWeight: 700, border: "1px solid", flexShrink: 0,
                  ...(info.locationConfidence === "high"
                    ? { background: "#dcfce7", color: "#166534", borderColor: "#86efac" }
                    : { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }),
                }}
              >
                ▸ location confidence: {info.locationConfidence}
              </span>
            )}
            {info.locationCityCoordMismatch && (
              <span style={{ color: "#b45309", fontSize: "11px", flexBasis: "100%" }}>
                ⚠ City and coordinates came from different providers and disagreed
                ({info.geoCitySource ?? "?"} city vs {info.geoCoordsSource ?? "?"} coords) —
                the CBS buurt was resolved via the <strong>city</strong> (coarse), not the coordinates.
              </span>
            )}
          </span>
        )}

        {/* Explanatory note */}
        <span style={{ color: "#64748b", fontSize: "11px", flexBasis: "100%" }}>
          {info.currentLocationSource === "ga4" ? (
            <>
              <strong>currentCity / currentRegion / currentCountry</strong> populated from GA4 Analytics History (most-recent session).{" "}
              IP-based geo still ran independently — latitude, longitude, networkAsn, networkOrg,
              networkDomain, and company enrichment continue to use IP geo signals.
              {!info.ipGeoHasCoordinates && (
                <> <span style={{ color: "#92400e" }}>⚠ IP geo did not resolve coordinates — weather and reverse geocode will be skipped.</span></>
              )}
            </>
          ) : info.currentLocationSource === "ip_geo" ? (
            <>
              GA4 history was unavailable (not configured, stage skipped, or 0 rows returned).{" "}
              <strong>currentCity / currentRegion / currentCountry</strong> populated from IP-based geo.{" "}
              Note: <strong>currentCountry</strong> is an ISO 2-letter code (e.g. &quot;NL&quot;) when sourced from IP geo.
            </>
          ) : (
            <>No location data resolved from either GA4 history or IP geo. All current* fields are null.</>
          )}
        </span>
      </div>

      {/* ── Leadinfo client-side enrichment ──────────────────────────────── */}
      {leadinfoDebug && leadinfoDebug.simulationMode === "leadinfo_downstream" ? (
        /* ── SIMULATION MODE — Leadinfo downstream enrichment context ──────
           This tab was opened by the "Simulate Leadinfo downstream enrichment
           context" button.  Real Leadinfo browser identify is intentionally
           NOT running.  We show a dedicated panel that:
             1. Confirms simulation mode + what is actually being tested
             2. Explains why mc_li is absent and not expected
             3. Shows which downstream enrichers ran and their result
        ────────────────────────────────────────────────────────────────── */
        <div
          style={{
            borderTop:  "1px solid #e5e7eb",
            background: "#faf5ff",
          }}
        >
          {/* ── Simulation mode banner ───────────────────────────────────── */}
          <div
            style={{
              padding:      "0.5rem 0.75rem",
              background:   "#ede9fe",
              borderBottom: "1px solid #c4b5fd",
              display:      "flex",
              flexWrap:     "wrap",
              gap:          "0.5rem",
              alignItems:   "center",
            }}
          >
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: "4px",
                fontSize:     "11px",
                fontWeight:   700,
                background:   "#7c3aed",
                color:        "#fff",
                border:       "none",
                flexShrink:   0,
              }}
            >
              ⚙ SIMULATION MODE
            </span>
            <span
              style={{
                fontSize:   "11px",
                fontWeight: 600,
                color:      "#4c1d95",
              }}
            >
              simulationMode: leadinfo_downstream
            </span>
            <span
              style={{
                fontSize: "11px",
                color:    "#5b21b6",
                flexBasis: "100%",
              }}
            >
              This tab is testing <strong>server-side downstream enrichment only</strong> using the configured
              Test IP Override. It is <strong>not</strong> a real visitor session and does not run Leadinfo browser identification.
            </span>
          </div>

          {/* ── What IS being tested ─────────────────────────────────────── */}
          <div
            style={{
              padding:      "0.5rem 0.75rem",
              borderBottom: "1px solid #e9d5ff",
              display:      "flex",
              flexWrap:     "wrap",
              gap:          "1.5rem",
              alignItems:   "flex-start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "#94a3b8", fontSize: "10px", fontWeight: 600 }}>
                EFFECTIVE IP (test override)
              </span>
              <span
                style={{
                  color:        "#4c1d95",
                  fontWeight:   700,
                  fontFamily:   "monospace",
                  background:   "#ede9fe",
                  padding:      "1px 6px",
                  borderRadius: "3px",
                  border:       "1px solid #c4b5fd",
                }}
              >
                {effectiveIp ?? "—"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "#94a3b8", fontSize: "10px", fontWeight: 600 }}>
                DOWNSTREAM ENRICHERS UNDER TEST
              </span>
              <span style={{ color: "#5b21b6", fontSize: "11px" }}>
                MaxMind · IPinfo · Reverse Geocode · Weather · OpenKvK · HubSpot
              </span>
            </div>
          </div>

          {/* ── Leadinfo real identify: explicitly skipped ───────────────── */}
          <div
            style={{
              padding:      "0.5rem 0.75rem",
              borderBottom: "1px solid #e9d5ff",
              display:      "flex",
              flexWrap:     "wrap",
              gap:          "0.5rem",
              alignItems:   "center",
            }}
          >
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: "4px",
                fontSize:     "11px",
                fontWeight:   600,
                background:   "#f3f4f6",
                color:        "#6b7280",
                border:       "1px solid #e5e7eb",
                flexShrink:   0,
              }}
            >
              ▸ Leadinfo real identify: skipped in simulation mode
            </span>
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: "4px",
                fontSize:     "10px",
                fontWeight:   700,
                background:   "#f1f5f9",
                color:        "#94a3b8",
                border:       "1px solid #e2e8f0",
                flexShrink:   0,
              }}
            >
              realLeadinfoIdentifyExecuted: false
            </span>

            <span
              style={{
                color:        "#6b7280",
                fontSize:     "11px",
                flexBasis:    "100%",
                marginTop:    "2px",
              }}
            >
              Leadinfo identification is a <strong>client-side browser flow</strong> — the browser calls
              api.leadinfo.com directly with the real visitor IP.  It does not run when this tab was
              opened as a simulation.  Use the <em>Real-browser identify test</em> section in Admin
              → Integrations → Leadinfo for real Leadinfo testing.
            </span>
          </div>

          {/* ── mc_li cookie: not expected in simulation mode ────────────── */}
          <div
            style={{
              padding:    "0.5rem 0.75rem",
              display:    "flex",
              flexWrap:   "wrap",
              gap:        "0.5rem",
              alignItems: "center",
            }}
          >
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: "4px",
                fontSize:     "11px",
                fontWeight:   600,
                background:   "#f8fafc",
                color:        "#94a3b8",
                border:       "1px solid #e2e8f0",
                flexShrink:   0,
              }}
            >
              mc_li cookie: {leadinfoDebug.cookiePresent ? "present (from prior real-browser session)" : "absent — not expected in simulation"}
            </span>
            {!leadinfoDebug.cookiePresent && (
              <span style={{ color: "#9ca3af", fontSize: "11px" }}>
                mc_li is set exclusively by LeadinfoProvider running in the visitor&apos;s real browser.
                Its absence here is correct — the simulation only exercises downstream server-side enrichers.
              </span>
            )}
            {leadinfoDebug.cookiePresent && (
              <span style={{ color: "#374151", fontSize: "11px" }}>
                A prior real-browser Leadinfo session is present. Its data may appear in the enrichment
                pipeline output above, but it was not produced by this simulation run.
              </span>
            )}
          </div>
        </div>
      ) : leadinfoDebug ? (
        /* ── NORMAL MODE — real visitor session Leadinfo status ─────────── */
        <div
          style={{
            padding:    "0.5rem 0.75rem",
            background: leadinfoDebug.matched === true  ? "#f0fdf4"
                      : leadinfoDebug.matched === false ? "#fefce8"
                      : leadinfoDebug.cookiePresent     ? "#f0fdf4"
                      : leadinfoDebug.configured        ? "#fafafa"
                      : "#fafafa",
            borderTop:  "1px solid #e5e7eb",
            display:    "flex",
            flexWrap:   "wrap",
            gap:        "0.5rem",
            alignItems: "flex-start",
          }}
        >
          {/* Status badge */}
          <span
            style={{
              padding:      "2px 8px",
              borderRadius: "4px",
              fontSize:     "11px",
              fontWeight:   600,
              border:       "1px solid",
              flexShrink:   0,
              ...(leadinfoDebug.matched === true
                ? { background: "#dcfce7", color: "#166534", borderColor: "#86efac" }
                : leadinfoDebug.matched === false
                ? { background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }
                : leadinfoDebug.configured
                ? { background: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" }
                : { background: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" }),
            }}
          >
            {leadinfoDebug.matched === true  ? "▸ Leadinfo: matched"
           : leadinfoDebug.matched === false ? "▸ Leadinfo: no match"
           : leadinfoDebug.cookiePresent     ? "▸ Leadinfo: cookie present"
           : leadinfoDebug.configured        ? "▸ Leadinfo: enabled, not yet run"
           : "▸ Leadinfo: not configured"}
          </span>

          {/* Data source badge — always shown when configured */}
          {leadinfoDebug.configured && (
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: "4px",
                fontSize:     "10px",
                fontWeight:   700,
                border:       "1px solid",
                flexShrink:   0,
                letterSpacing: "0.03em",
                ...(leadinfoDebug.dataSource === "real-browser"
                  ? { background: "#dbeafe", color: "#1e40af", borderColor: "#93c5fd" }
                  : { background: "#f1f5f9", color: "#94a3b8", borderColor: "#e2e8f0" }),
              }}
            >
              {leadinfoDebug.dataSource === "real-browser"
                ? "source: real browser"
                : "source: not set"}
            </span>
          )}

          {/* Company fields when matched */}
          {leadinfoDebug.matched === true && (
            <>
              {leadinfoDebug.companyName   && <Ga4Field label="company" value={leadinfoDebug.companyName} />}
              {leadinfoDebug.companyDomain && <Ga4Field label="domain"  value={leadinfoDebug.companyDomain} />}
              {leadinfoDebug.companyCountry && <Ga4Field label="country" value={leadinfoDebug.companyCountry} />}
            </>
          )}

          {/* Config flags */}
          <Ga4Field label="dataLayer" value={leadinfoDebug.pushToDataLayer ? "yes" : "no"} />
          <Ga4Field label="storeCtx"  value={leadinfoDebug.storeInContext  ? "yes" : "no"} />
          <Ga4Field label="cookie"    value={leadinfoDebug.cookiePresent   ? "present" : "absent"} />

          {/* Explanatory hint when not yet run */}
          {leadinfoDebug.configured && !leadinfoDebug.cookiePresent && (
            <span style={{ color: "#64748b", fontSize: "11px", flexBasis: "100%" }}>
              LeadinfoProvider is enabled but mc_li cookie not set yet — identify runs on first client load.
            </span>
          )}
          {!leadinfoDebug.configured && (
            <span style={{ color: "#64748b", fontSize: "11px", flexBasis: "100%" }}>
              Leadinfo not enabled for this tenant. Configure it in Admin → Tenants → [tenant] → Integrations → Leadinfo.
            </span>
          )}

          {/* ── IP override + Leadinfo clarification ──────────────────────
              Shown whenever the IP override is active so it's explicit that
              the override has no effect on Leadinfo identification.         */}
          {overrideActive && leadinfoDebug.configured && (
            <span
              style={{
                color:        "#92400e",
                fontSize:     "11px",
                flexBasis:    "100%",
                marginTop:    "2px",
                padding:      "4px 6px",
                background:   "#fef3c7",
                borderRadius: "4px",
                border:       "1px solid #fde68a",
              }}
            >
              <strong>⚠ IP override is active</strong> — Leadinfo identification runs{" "}
              <strong>client-side in the browser</strong> and always uses the real visitor IP.
              The IP override only affects server-side enrichers (MaxMind, IPinfo, OpenKvK, etc.).
              {leadinfoDebug.cookiePresent
                ? " The mc_li cookie above was set by real-browser LeadinfoProvider in a previous page load — not by the IP override."
                : " No mc_li cookie is present; server-side enrichers below are using the override IP."}
            </span>
          )}
        </div>
      ) : null}

      {/* ── Footer legend ────────────────────────────────────────────────── */}
      <div
        style={{
          padding:    "0.35rem 0.75rem",
          background: "#f8fafc",
          borderTop:  "1px solid #e5e7eb",
          color:      "#94a3b8",
          fontSize:   "10px",
          display:    "flex",
          gap:        "1rem",
          flexWrap:   "wrap",
        }}
      >
        <span>● green = cache hit  ● amber = fresh pipeline run  ● red = error</span>
        <span>IP override requires NODE_ENV=development or ENABLE_DEBUG_IP_OVERRIDE=true</span>
      </div>
    </details>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IpField({
  label,
  value,
  tooltip,
  highlight = false,
  dimmed    = false,
}: {
  label:      string;
  value:      string | null;
  tooltip?:   string;
  highlight?: boolean;
  dimmed?:    boolean;
}) {
  return (
    <span
      title={tooltip}
      style={{ display: "flex", flexDirection: "column", gap: "1px" }}
    >
      <span style={{ color: "#94a3b8", fontSize: "10px", fontWeight: 600 }}>
        {label}
      </span>
      <span
        style={{
          color:      highlight ? "#92400e" : dimmed ? "#9ca3af" : "#1e293b",
          fontWeight: highlight ? 700 : 400,
          background: highlight ? "#fef3c7" : "transparent",
          padding:    highlight ? "0 4px" : "0",
          borderRadius: "3px",
        }}
      >
        {value ?? "—"}
      </span>
    </span>
  );
}

function Ga4Field({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      <span style={{ color: "#94a3b8", fontSize: "10px", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#1e293b", fontFamily: "inherit" }}>{value}</span>
    </span>
  );
}

function StageRow({ stage, isEven }: { stage: StageTrace; isEven: boolean }) {
  const status = stage.skipped ? "skipped"
    : stage.error             ? "error"
    : "ok";

  const statusColour =
    status === "ok"      ? "#059669" :
    status === "skipped" ? "#94a3b8" :
    "#dc2626";

  const statusLabel =
    status === "ok"      ? "✓" :
    status === "skipped" ? "—" :
    "✗";

  // Collect non-null field keys from the stage output delta.
  const fieldsProduced = Object.entries(stage.output)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k]) => k);

  return (
    <tr
      style={{
        background:   isEven ? "#ffffff" : "#fafafa",
        borderBottom: "1px solid #f1f5f9",
        opacity:      stage.skipped ? 0.5 : 1,
      }}
    >
      {/* label */}
      <td
        style={{
          padding:      "4px 8px",
          color:        "#1e293b",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}
      >
        {stage.label}
      </td>

      {/* duration */}
      <td style={{ padding: "4px 8px", textAlign: "right", color: "#64748b" }}>
        {stage.skipped ? "—" : `${stage.durationMs}`}
      </td>

      {/* status */}
      <td style={{ padding: "4px 8px", textAlign: "center", color: statusColour, fontWeight: 700 }}>
        {statusLabel}
        {stage.error && (
          <span
            title={stage.error}
            style={{ marginLeft: "4px", fontSize: "9px", cursor: "help" }}
          >
            ⓘ
          </span>
        )}
      </td>

      {/* fields produced */}
      <td
        style={{
          padding:  "4px 8px",
          overflow: "hidden",
        }}
      >
        {fieldsProduced.length > 0 ? (
          <span style={{ display: "flex", gap: "3px", flexWrap: "wrap", alignItems: "center" }}>
            {fieldsProduced.map((f) => (
              <FieldChip key={f} field={f} stage={stage} />
            ))}
            {stage.note && (
              <span style={{ color: "#9ca3af", fontSize: "9px" }} title={stage.note}>· {stage.note}</span>
            )}
          </span>
        ) : (
          // A stage that produced no output still explains WHY when it set a note
          // (e.g. cbs-location: resolved buurtcode + cbs hit/empty) — no silent null.
          <span
            title={stage.note}
            style={{ color: stage.note ? "#6b7280" : "#d1d5db", fontStyle: stage.note ? "normal" : "italic", fontSize: "10px" }}
          >
            {stage.note ?? (stage.skipped ? "stage skipped" : stage.error ? "error" : "no output")}
          </span>
        )}
      </td>
    </tr>
  );
}

function FieldChip({ field, stage }: { field: string; stage: StageTrace }) {
  const value = (stage.output as Record<string, unknown>)[field];
  const displayVal = value === null ? "null"
    : typeof value === "string" ? value
    : String(value);

  return (
    <span
      title={`${field} = ${displayVal}`}
      style={{
        padding:      "1px 5px",
        borderRadius: "3px",
        background:   "#fdf2f8",
        color:        "#be185d",
        fontSize:     "9px",
        fontWeight:   600,
        whiteSpace:   "nowrap",
        cursor:       "default",
      }}
    >
      {field}
    </span>
  );
}

// ── Session miss reason explanations ──────────────────────────────────────────

const SESSION_MISS_EXPLANATIONS: Record<string, string> = {
  "no-entry":       "first page view in this server process for this session",
  "ttl-expired":    "4-hour cache TTL exceeded; entry evicted",
  "ip-changed":     "visitor IP changed since last cache write (network switch / VPN toggle)",
  "tenant-changed": "serving a different tenant than when the entry was cached",
};
