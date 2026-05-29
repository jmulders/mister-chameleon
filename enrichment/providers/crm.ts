/**
 * CRM Match Enrichment Provider
 *
 * Resolves: crmMatched, crmLifecycleStage, crmSegment, crmAccountOwner
 *
 * ─── Provider contract ────────────────────────────────────────────────────────
 *
 *   CrmProvider is the vendor-agnostic interface. Implement for:
 *   - HubSpot Contacts API (match by email or cookie identity)
 *   - Salesforce (match via Pardot visitor ID or email)
 *   - Pipedrive / Zoho / any CRM with a contacts lookup API
 *   - An internal identity resolution layer
 *
 * ─── Match strategy ──────────────────────────────────────────────────────────
 *
 *   CRM providers typically match via:
 *   1. Session / visitor cookie (tracking pixel already set by the CRM's JS)
 *   2. Email address (from form submission stored in session)
 *   3. Company domain (probabilistic — lower confidence)
 *
 *   The `CrmLookupInput` carries the signals available at enrichment time.
 *   Providers should gracefully handle missing signals (no IP, no email, etc.).
 *
 * ─── Stub ─────────────────────────────────────────────────────────────────────
 *
 *   StubCrmProvider returns crmMatched: false (no contact found).
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // HubSpot adapter (example sketch)
 *   const hubspotProvider: CrmProvider = {
 *     match: async ({ sessionId, tenantId }) => {
 *       const contact = await hubspot.contacts.getByHubspotCookie(sessionId);
 *       if (!contact) return { crmMatched: false };
 *       return {
 *         crmMatched:        true,
 *         crmLifecycleStage: contact.properties.lifecyclestage,
 *         crmSegment:        contact.properties.hs_analytics_source,
 *         crmAccountOwner:   contact.properties.hubspot_owner_id,
 *       };
 *     },
 *   };
 */

import type { EnrichmentOutput, EnricherInput, LabeledEnricher } from "../types";

// ── CrmOutput ─────────────────────────────────────────────────────────────────

/** Fields this provider can resolve. */
export interface CrmOutput {
  crmMatched:        boolean | null;
  /** e.g. "subscriber", "lead", "mql", "sql", "opportunity", "customer" */
  crmLifecycleStage: string | null;
  /** Marketing segment label, e.g. "enterprise-prospect" */
  crmSegment:        string | null;
  /** Account owner / SDR name from the CRM */
  crmAccountOwner:   string | null;

  // ── Company match fields (HubSpot company-by-domain) ─────────────────────
  /** HubSpot Company object ID, e.g. "12345678" */
  crmCompanyId:     string | null;
  /** Company name from CRM, e.g. "Acme Corp" */
  crmCompanyName:   string | null;
  /** Primary domain from CRM, e.g. "acme.com" */
  crmCompanyDomain: string | null;
  /** Industry from CRM, e.g. "SOFTWARE", "FINANCIAL_SERVICES" */
  crmIndustry:      string | null;
  /** True when the CRM lifecycle stage is "customer" */
  crmIsCustomer:    boolean | null;

  // ── Extended contact / deal fields ────────────────────────────────────────
  /** CRM contact ID (HubSpot contact ID, Salesforce contact/lead ID). */
  crmContactId:      string | null;
  /** CRM account / company ID. */
  crmAccountId:      string | null;
  /** Current deal or opportunity stage, e.g. "Proposal", "Negotiation". */
  crmDealStage:      string | null;
  /** Subscription plan tier, e.g. "basic", "pro", "enterprise". */
  crmPlanTier:       string | null;
  /** Annual contract value in platform currency. */
  crmContractValue:  number | null;
  /** ISO-8601 date when the contact became a customer. */
  crmCustomerSince:  string | null;
  /** ISO-8601 timestamp of the most recent CRM activity. */
  crmLastActivityAt: string | null;
}

// ── CrmProvider ───────────────────────────────────────────────────────────────

/**
 * Vendor-agnostic CRM match provider interface.
 *
 * Receives the full `EnricherInput` for flexible identity resolution.
 */
export interface CrmProvider {
  /**
   * Attempt to match the visitor to a CRM contact record.
   *
   * @param input - Enricher input (sessionId, tenantId, ip, utm).
   * @returns     - Partial CRM output. `crmMatched: false` when no contact found.
   */
  match(input: EnricherInput): Promise<Partial<CrmOutput>>;
}

// ── StubCrmProvider ───────────────────────────────────────────────────────────

/**
 * No-op CRM provider for development and testing.
 * Returns no match without making any network call.
 */
export class StubCrmProvider implements CrmProvider {
  async match(_input: EnricherInput): Promise<Partial<CrmOutput>> {
    return { crmMatched: false };
  }
}

// ── MockCrmProvider ───────────────────────────────────────────────────────────

/**
 * Static email-to-CRM mapping for local development and automated tests.
 *
 * Accepts a record of `email → Partial<CrmOutput>` at construction time.
 * When the input email matches an entry, returns `crmMatched: true` plus the
 * mapped fields.  Falls back to `crmMatched: false` for unrecognised emails
 * or when no email is present.
 *
 * Lookup is case-insensitive on the full email address.
 *
 * ─── Why use this instead of StubCrmProvider ─────────────────────────────────
 *
 *   StubCrmProvider always returns no match, so CRM-gated rules never fire in
 *   development.  MockCrmProvider lets you define fixtures to exercise every
 *   lifecycle stage, segment, and account-owner path without a real CRM.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   const mock = new MockCrmProvider({
 *     "alice@acme.com": { crmLifecycleStage: "mql",      crmSegment: "enterprise-prospect" },
 *     "bob@startup.io": { crmLifecycleStage: "customer", crmSegment: "smb" },
 *   });
 *
 *   const enrichers = [createCrmEnricher(mock)];
 */
export class MockCrmProvider implements CrmProvider {
  private readonly map: Map<string, Partial<CrmOutput>>;

  constructor(fixtures: Record<string, Partial<CrmOutput>> = {}) {
    this.map = new Map(
      Object.entries(fixtures).map(([email, data]) => [
        email.toLowerCase().trim(),
        data,
      ]),
    );
  }

  async match(input: EnricherInput): Promise<Partial<CrmOutput>> {
    if (!input.email) return { crmMatched: false };

    const key  = input.email.toLowerCase().trim();
    const data = this.map.get(key);
    if (!data)  return { crmMatched: false };

    return {
      crmMatched:        true,
      crmLifecycleStage: data.crmLifecycleStage ?? null,
      crmSegment:        data.crmSegment        ?? null,
      crmAccountOwner:   data.crmAccountOwner   ?? null,
    };
  }
}

// ── createCrmEnricher ─────────────────────────────────────────────────────────

/**
 * Adapts a `CrmProvider` into a generic `LabeledEnricher` for the pipeline.
 *
 * @param provider - Any CrmProvider implementation.
 * @returns        - A LabeledEnricher ready to pass to runEnrichmentPipeline().
 *
 * @example
 * import { createCrmEnricher, StubCrmProvider } from "@/enrichment/providers/crm";
 *
 * const enrichers = [
 *   createCrmEnricher(new StubCrmProvider()),
 * ];
 */
export function createCrmEnricher(provider: CrmProvider): LabeledEnricher {
  return {
    label: "crm",
    enricher: async (input: EnricherInput): Promise<Partial<EnrichmentOutput>> => {
      const result = await provider.match(input);
      return {
        crmMatched:         result.crmMatched         ?? null,
        crmLifecycleStage:  result.crmLifecycleStage  ?? null,
        crmSegment:         result.crmSegment          ?? null,
        crmAccountOwner:    result.crmAccountOwner     ?? null,
        crmCompanyId:       result.crmCompanyId        ?? null,
        crmCompanyName:     result.crmCompanyName      ?? null,
        crmCompanyDomain:   result.crmCompanyDomain    ?? null,
        crmIndustry:        result.crmIndustry         ?? null,
        crmIsCustomer:      result.crmIsCustomer       ?? null,
        // Extended fields
        crmContactId:       result.crmContactId        ?? null,
        crmAccountId:       result.crmAccountId        ?? null,
        crmDealStage:       result.crmDealStage        ?? null,
        crmPlanTier:        result.crmPlanTier         ?? null,
        crmContractValue:   result.crmContractValue    ?? null,
        crmCustomerSince:   result.crmCustomerSince    ?? null,
        crmLastActivityAt:  result.crmLastActivityAt   ?? null,
      };
    },
  };
}
