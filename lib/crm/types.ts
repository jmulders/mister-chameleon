/**
 * CRM Layer — Core Types
 *
 * Normalized, vendor-agnostic CRM profile model and derived concepts:
 *   - CrmProfile         — normalized contact/account record
 *   - CrmLifecycleStage  — canonical lifecycle stage enum
 *   - CustomerMode       — post-conversion behavioral mode
 *   - CrmMergedState     — final merged (CRM + behavior) state used by decisions
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   CRM provider match (HubSpot / Salesforce)
 *        │
 *        ▼
 *   Raw CrmOutput (in enrichment layer)
 *        │
 *        ▼  normalizeCrmProfile()
 *   CrmProfile (normalized, vendor-agnostic)
 *        │
 *        ▼  mergeCrmWithBehavior()
 *   CrmMergedState (CRM + behavioral signals combined, with override logic)
 *        │
 *        ▼  computeCustomerMode()
 *   CustomerMode (current customer experience mode)
 *        │
 *        ▼
 *   Rules engine / adaptive decisions / debug panel
 *
 * ─── Privacy ──────────────────────────────────────────────────────────────────
 *
 *   CRM data is company-level (not personal data in the GDPR/CCPA sense when
 *   matched via company domain).  Contact-level data (email, contactId) is
 *   collected only on explicit form submission with user consent.
 *   All identity mappings are stored server-side and never sent to the client.
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   If the CRM is unavailable or the visitor is unmatched, all functions
 *   gracefully fall back to behavioral signals.  CRM failure must never
 *   break the experience.
 */

// ── CrmLifecycleStage ─────────────────────────────────────────────────────────

/**
 * Canonical platform lifecycle stage.
 *
 * Maps vendor-specific CRM stage values to a consistent set:
 *
 *   HubSpot → Platform:
 *     subscriber / contact / lead    → "lead"
 *     mql / sql                      → "lead"
 *     opportunity                    → "opportunity"
 *     customer                       → "customer"
 *     evangelist / other             → "customer"
 *     (churned — custom property)    → "churned"
 *
 *   Salesforce → Platform:
 *     Prospect                       → "lead"
 *     Qualified                      → "lead"
 *     Negotiation                    → "opportunity"
 *     Closed Won                     → "customer"
 *     Closed Lost / Churned          → "churned"
 */
export type CrmLifecycleStage =
  | "unknown"      // not matched or not available
  | "lead"         // subscriber, mql, sql, contact, prospect
  | "opportunity"  // active deal / opportunity in pipeline
  | "customer"     // won, active customer
  | "churned";     // lost or cancelled

/**
 * Maps raw CRM lifecycle stage strings (from HubSpot, Salesforce, etc.)
 * to the canonical CrmLifecycleStage.
 */
export function normalizeCrmLifecycleStage(raw: string | null | undefined): CrmLifecycleStage {
  if (!raw) return "unknown";

  const s = raw.toLowerCase().trim();

  // Customer / active
  if (s === "customer" || s === "closed_won" || s === "closedwon" ||
      s === "evangelist" || s === "closed won" || s === "won") {
    return "customer";
  }

  // Churned / lost
  if (s === "churned" || s === "closed_lost" || s === "closedlost" ||
      s === "closed lost" || s === "lost" || s === "cancelled" || s === "canceled") {
    return "churned";
  }

  // Opportunity / deal
  if (s === "opportunity" || s === "sql" || s === "negotiation" ||
      s === "proposal" || s === "demo_scheduled" || s === "demo scheduled") {
    return "opportunity";
  }

  // Lead (default for any recognized contact state)
  if (s === "lead" || s === "mql" || s === "subscriber" || s === "contact" ||
      s === "prospect" || s === "other" || s === "qualified" ||
      s === "marketing_qualified_lead" || s === "sales_qualified_lead") {
    return "lead";
  }

  // Unknown for anything else
  return "unknown";
}

// ── CustomerMode ──────────────────────────────────────────────────────────────

/**
 * Current customer experience mode — derived from CRM + behavior for customers.
 *
 * Only active when lifecycleStage === "customer" (or CRM says isCustomer).
 * Pre-customer visitors are in "acquisition" mode (handled by the main funnel).
 *
 *   onboarding_mode    — new customer, recently converted (customerSince < 30 days)
 *                        or low feature adoption signals
 *   active_usage_mode  — engaged, actively using the product, no churn signals
 *   expansion_mode     — high feature interest, potential to upgrade / add seats
 *   churn_risk_mode    — low activity, support-heavy usage, no recent engagement
 *   acquisition_mode   — not a customer yet (pre-conversion)
 */
export type CustomerMode =
  | "acquisition_mode"
  | "onboarding_mode"
  | "active_usage_mode"
  | "expansion_mode"
  | "churn_risk_mode";

// ── CrmProfile ────────────────────────────────────────────────────────────────

/**
 * Normalized CRM profile, vendor-agnostic.
 *
 * All fields are nullable — partial profiles are valid when the CRM could
 * only resolve some fields (e.g. company-by-domain gives company data but
 * not contact-level data).
 */
export interface CrmProfile {
  /** Whether a CRM record was matched for this visitor. */
  matched: boolean;

  // ── Contact-level fields ──────────────────────────────────────────────────
  /** CRM contact ID (HubSpot contact ID, Salesforce lead/contact ID). */
  contactId: string | null;
  /** Contact email address — populated from form submission, not from CRM lookup. */
  email: string | null;
  /** CRM account / company ID. */
  accountId: string | null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /** Normalized platform lifecycle stage. */
  lifecycleStage: CrmLifecycleStage;
  /** Raw CRM lifecycle stage string (before normalization). */
  rawLifecycleStage: string | null;
  /** True when the CRM definitively says this visitor is a paying customer. */
  isCustomer: boolean;

  // ── Deal / opportunity ────────────────────────────────────────────────────
  /** Current deal or opportunity stage, e.g. "Proposal", "Negotiation". */
  dealStage: string | null;

  // ── Account / plan ────────────────────────────────────────────────────────
  /** Subscription plan tier, e.g. "basic", "pro", "enterprise". */
  planTier: string | null;
  /** Annual contract value in USD/EUR (or platform currency). */
  contractValue: number | null;

  // ── Temporal ─────────────────────────────────────────────────────────────
  /**
   * ISO-8601 date/timestamp when the contact became a customer.
   * Used to derive onboarding vs. established customer mode.
   */
  customerSince: string | null;
  /** ISO-8601 timestamp of the most recent CRM activity. */
  lastActivityAt: string | null;

  // ── Firmographics (from company-by-domain) ────────────────────────────────
  /** Company name from CRM, e.g. "Acme Corp". */
  companyName: string | null;
  /** Company domain, e.g. "acme.com". */
  companyDomain: string | null;
  /** Industry vertical, e.g. "Software", "Financial Services". */
  industry: string | null;
  /** Segment label, e.g. "enterprise-prospect". */
  segment: string | null;
}

/** Safe empty CrmProfile for unmatched visitors. */
export function emptyCrmProfile(): CrmProfile {
  return {
    matched:           false,
    contactId:         null,
    email:             null,
    accountId:         null,
    lifecycleStage:    "unknown",
    rawLifecycleStage: null,
    isCustomer:        false,
    dealStage:         null,
    planTier:          null,
    contractValue:     null,
    customerSince:     null,
    lastActivityAt:    null,
    companyName:       null,
    companyDomain:     null,
    industry:          null,
    segment:           null,
  };
}

// ── CrmMergedState ────────────────────────────────────────────────────────────

/**
 * The final merged lifecycle and customer state after combining CRM data
 * with behavioral signals.
 *
 * This is the authoritative state used by the rules engine, adaptive
 * decision pipeline, and debug panel.
 *
 * ─── Override hierarchy ───────────────────────────────────────────────────────
 *
 *   1. CRM (high confidence)    — CRM says "customer" → override behavioral stage
 *   2. Behavioral signals       — used when CRM is absent or unmatched
 *   3. Fallback                 — empty/zero state when both are unavailable
 *
 * ─── Double-counting prevention ──────────────────────────────────────────────
 *
 *   CRM provides STATE (what the visitor is).
 *   Behavior provides SIGNAL (what the visitor does).
 *   They are never summed — CRM overrides behavioral inference when available.
 *   Behavioral signals are only used to DERIVE state when CRM is absent.
 */
export interface CrmMergedState {
  /**
   * Final lifecycle stage used for decisions.
   * Sourced from CRM when matched; derived from behavioral signals otherwise.
   */
  lifecycleStage: CrmLifecycleStage;

  /**
   * The source that determined the final lifecycleStage.
   *   "crm"       — CRM was matched and provided the stage
   *   "behavior"  — no CRM match; stage derived from behavioral funnel
   *   "fallback"  — no data available; defaults to "unknown"
   */
  lifecycleSource: "crm" | "behavior" | "fallback";

  /**
   * True when the visitor is definitively identified as a paying customer.
   * True if CRM says isCustomer OR behavioral funnelStage === "customer".
   */
  isCustomer: boolean;

  /**
   * Current customer experience mode.
   * "acquisition_mode" for non-customers; one of the customer modes otherwise.
   */
  customerMode: CustomerMode;

  /**
   * The resolved CRM profile (may be empty if CRM is unavailable).
   */
  crm: CrmProfile;

  /**
   * Number of days since this visitor became a customer.
   * Null when customerSince is unknown or visitor is not a customer.
   */
  customerAgeDays: number | null;

  /**
   * True when the CRM override changed the lifecycleStage vs. what
   * behavioral signals alone would have suggested.
   * Used by the debug panel to highlight CRM-driven decisions.
   */
  crmOverrodeStage: boolean;

  /**
   * Human-readable reasons for the merged state (shown in debug panel).
   */
  reasons: string[];
}

/** Safe empty CrmMergedState when no data is available. */
export function emptyCrmMergedState(): CrmMergedState {
  return {
    lifecycleStage:   "unknown",
    lifecycleSource:  "fallback",
    isCustomer:       false,
    customerMode:     "acquisition_mode",
    crm:              emptyCrmProfile(),
    customerAgeDays:  null,
    crmOverrodeStage: false,
    reasons:          ["No CRM data available — using behavioral signals only."],
  };
}

// ── Identity mapping ──────────────────────────────────────────────────────────

/**
 * Persisted mapping between a visitor session and a CRM contact.
 * Written to visitor_crm_identity table when identity is resolved.
 *
 * Identity resolution triggers:
 *   1. Form submit — email captured → CRM contact lookup by email
 *   2. CRM tracking cookie match — e.g. HubSpot's __hstc cookie
 */
export interface VisitorCrmIdentity {
  /** Visitor session ID (mc_session_id cookie). */
  sessionId:     string;
  /** Tenant scope. */
  tenantId:      string;
  /** CRM contact ID. */
  contactId:     string;
  /** CRM account / company ID. */
  accountId:     string | null;
  /** Email used to resolve the identity. */
  email:         string | null;
  /** When the identity was first resolved. */
  resolvedAt:    string;
  /** How the identity was resolved. */
  resolvedVia:   "email" | "crm_cookie" | "manual";
  /** Source CRM system. */
  crmSource:     "hubspot" | "salesforce" | "other";
}
