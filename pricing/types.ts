/**
 * Pricing Architecture Types
 *
 * Defines the pricing primitives for the Mister Chameleon platform.
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   This is product architecture, not billing or checkout logic. These types
 *   model how the platform is priced — which fees exist, how they behave, and
 *   how they compose into a coherent model — rather than how payments are
 *   collected.
 *
 *   Primary consumers:
 *     Proposal generation   Build a scoped quote from selected fee components.
 *     Internal tooling      Estimate engagement value, plan upsell paths.
 *     Package tier system   Define starter / growth / enterprise tiers from
 *                           the same primitive fee types (future step).
 *
 * ─── Five fee categories ──────────────────────────────────────────────────────
 *
 *   setup          One-time onboarding fee. Covers the implementation project
 *                  that gets the platform live for the client.
 *
 *   platform       Recurring base license for accessing the Mister Chameleon
 *                  platform. Covers the core infrastructure regardless of
 *                  which modules are active.
 *
 *   module         Recurring per-module fee. Each additional module beyond the
 *                  base (if applicable) carries its own recurring line item.
 *
 *   service        Project or retainer fee for a specific service engagement
 *                  (content modelling, optimisation, strategy). May be one-time
 *                  or ongoing depending on the service type.
 *
 *   optimization   Optional add-on for the structured recurring optimisation
 *                  service (monthly reviews, experiment management, QBRs).
 *                  Billed as a monthly or quarterly retainer.
 *
 * ─── Design notes ─────────────────────────────────────────────────────────────
 *
 *   PricingBand supports min/list/custom values so proposal tooling can produce
 *   correctly formatted scoped quotes without hardcoding client-specific prices.
 *
 *   Fees are composable. A PricingModel collects fee instances from all five
 *   categories. A PricingConfig then selects and optionally overrides specific
 *   fees for a given client or package tier.
 *
 *   Package tiers (starter, growth, enterprise) will be built as PricingModel
 *   presets in a future pricing/tiers.ts file — they reuse these same types
 *   without modification.
 *
 * ─── Connection map ───────────────────────────────────────────────────────────
 *
 *   ModuleFee.linkedModuleId       → product/types.ts (ProductModuleId)
 *   ServiceFee.linkedServiceId     → product/types.ts (ServiceOfferingId)
 *   OptimizationFee linked cycles  → optimization/types.ts (OptimizationCycleId)
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   pricing/types.ts    ← YOU ARE HERE — all type definitions
 *   pricing/model.ts    ← fee catalog + default pricing model + helpers
 *   pricing/index.ts    ← barrel re-export
 */

import type { ProductModuleId, ServiceOfferingId } from "@/product/types";
import type { OptimizationCycleId } from "@/optimization/types";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for setup fee variants.
 *
 * standard       Full onboarding implementation. One site, standard scope.
 * accelerated    Compressed timeline (e.g. 1-week sprint). Higher fee.
 * light          Minimal configuration — client provides most setup work.
 */
export type SetupFeeId =
  | "setup-standard"
  | "setup-accelerated"
  | "setup-light";

/**
 * Stable identifier for the base platform license.
 *
 * There is currently one platform fee structure.
 * Future: platform-annual may be added with a different billing treatment.
 */
export type PlatformFeeId = "platform-base";

/**
 * Stable identifiers for per-module recurring fees.
 *
 * One ModuleFeeId per ProductModuleId — module fees are named for the module
 * they cover to make the connection explicit and to avoid ambiguity.
 */
export type ModuleFeeId =
  | "module-adaptive-website"
  | "module-adaptive-landing-pages"
  | "module-adaptive-follow-up"
  | "module-context-intelligence";

/**
 * Stable identifiers for service engagement fees.
 *
 * One ServiceFeeId per ServiceOfferingId for the core catalog. Specific
 * scoped variants (e.g. "service-onboarding-enterprise") will be added when
 * the tier system is introduced.
 */
export type ServiceFeeId =
  | "service-onboarding"
  | "service-content-modeling"
  | "service-optimisation-retainer"
  | "service-strategy-advisory";

/**
 * Stable identifiers for the optional optimisation add-on fee.
 *
 * monthly     Standard monthly optimisation retainer.
 * quarterly   Quarterly cycle add-on (QBR + strategy, lower monthly rate).
 */
export type OptimizationFeeId =
  | "optimization-monthly"
  | "optimization-quarterly";

/**
 * The union of all fee identifiers across all categories.
 *
 * Used when a function or data structure needs to reference any fee
 * without constraining to a specific category.
 */
export type PricingFeeId =
  | SetupFeeId
  | PlatformFeeId
  | ModuleFeeId
  | ServiceFeeId
  | OptimizationFeeId;

/**
 * Stable identifier for a pricing model definition.
 *
 * standard    The default single-tier pricing model (current).
 * Future:     starter | growth | enterprise  (package tiers, future step)
 */
export type PricingModelId = "standard";

// ─────────────────────────────────────────────────────────────────────────────
// MONETARY TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Currencies the platform pricing supports.
 *
 * GBP is the primary pricing currency (MC is UK-based).
 * USD and EUR are included for international proposals.
 */
export type PricingCurrency = "GBP" | "USD" | "EUR";

/**
 * How often a recurring fee is billed, or whether it is one-time.
 *
 * one-time     Charged once, at project initiation or on agreement signature.
 * monthly      Charged every calendar month.
 * quarterly    Charged every three months (often used for strategy retainers).
 * annually     Charged once per year. May offer a discount vs monthly.
 * project      Scoped fixed-price project. Treated as one-time for cashflow
 *              purposes but represents a bounded delivery, not a license.
 */
export type BillingCadence =
  | "one-time"
  | "monthly"
  | "quarterly"
  | "annually"
  | "project";

/**
 * How a fee's value is determined.
 *
 * fixed         A specific named amount. Standard for most fees.
 * range         A min–max band. Used when the price depends on scope.
 * custom        Negotiated per-client. No published list price.
 * included      The fee is bundled into another fee and has no separate charge.
 */
export type PricingBasis = "fixed" | "range" | "custom" | "included";

/**
 * A monetary value with currency denomination.
 *
 * All prices are stored as integer pence/cents (minor currency units) to avoid
 * floating-point rounding issues. Divide by 100 for display.
 *
 * @example
 *   { amount: 250000, currency: "GBP" }  // £2,500.00
 */
export interface MonetaryAmount {
  /** Amount in minor currency units (pence, cents). Integer. */
  amount: number;
  /** Currency denomination. */
  currency: PricingCurrency;
}

/**
 * A pricing band expressing the range of acceptable prices for a fee.
 *
 * Used in proposals and internal planning when the final price depends on
 * scope, client size, or negotiation. A fee with PricingBasis "fixed" will
 * have list === min (no range). A fee with basis "range" should have both.
 *
 * All monetary values in the same band must use the same currency.
 */
export interface PricingBand {
  /** Currency for all amounts in this band. */
  currency: PricingCurrency;

  /**
   * Standard list price in minor currency units.
   * This is the published price before any client-specific negotiation.
   */
  list: number;

  /**
   * Minimum acceptable price in minor currency units.
   * The floor below which the fee should not be discounted.
   * When undefined, the list price is also the minimum.
   */
  min?: number;

  /**
   * Optional context note for proposal tooling.
   * Examples: "subject to scope", "includes 2 rounds of revisions",
   *           "per additional module beyond first two"
   */
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five categories of fee in the Mister Chameleon pricing model.
 *
 * Used as a discriminant on all fee interfaces — every fee has a `category`
 * field that narrows it to one of these types.
 */
export type FeeCategory =
  | "setup"
  | "platform"
  | "module"
  | "service"
  | "optimization";

// ─────────────────────────────────────────────────────────────────────────────
// BASE FEE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The common structure shared by all fee types.
 *
 * TCategory is the discriminant — it narrows the type to a specific fee
 * interface when accessed through the AnyPricingFee union.
 *
 * @internal  Use the specific fee interfaces (SetupFee, PlatformFee, etc.)
 *            rather than this base interface directly.
 */
export interface PricingFeeBase<TCategory extends FeeCategory> {
  /**
   * Stable fee identifier. Never changes once published.
   * Must be unique across all fee categories.
   */
  id: PricingFeeId;

  /** Fee category — used as a discriminant on the AnyPricingFee union. */
  category: TCategory;

  /** Short display label for proposals and invoices. */
  label: string;

  /**
   * One-sentence description of what this fee covers.
   * Written for a client-facing proposal context.
   */
  description: string;

  /**
   * Longer internal explanation of the fee — scope assumptions, exclusions,
   * and conditions that affect the price. Written for the account manager.
   *
   * Not included on client proposals by default — set `proposalNotes` for
   * the client-safe version.
   */
  internalNotes?: string;

  /** How the fee is billed. */
  billingCadence: BillingCadence;

  /** How the fee's value is determined. */
  basis: PricingBasis;

  /**
   * The pricing band for this fee.
   *
   * For fees with basis "custom" or "included", the band may be omitted or
   * carry a placeholder — these fees are priced at time of engagement.
   */
  band?: PricingBand;

  /**
   * Whether this fee is required in a well-formed engagement, or truly optional.
   *
   * true    This fee appears in every engagement of this type.
   * false   This fee is an optional add-on or upgrade.
   */
  required: boolean;

  /**
   * Whether this fee appears as a line item on client-facing proposals.
   *
   * false may be used for internal accounting fees or for fees that are
   * bundled into a parent line item on the proposal.
   */
  visibleOnProposal: boolean;

  /**
   * The proposal section this fee belongs to.
   *
   * Used by proposal generation tooling to group fees in the correct order.
   * one-time     Setup and project fees — billed at start.
   * recurring    Ongoing license and retainer fees — billed per period.
   */
  proposalSection: "one-time" | "recurring";
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIC FEE INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A one-time onboarding and implementation fee.
 *
 * Covers the initial configuration, integration, and launch of the platform
 * for a new client. Typically charged at contract signature or first milestone.
 *
 * Multiple setup variants may exist for different scope levels (standard,
 * accelerated, light). The proposal should include exactly one SetupFee.
 */
export interface SetupFee extends PricingFeeBase<"setup"> {
  /** Narrowed identifier type. */
  id: SetupFeeId;

  /**
   * What the setup engagement delivers.
   * Mirrors the deliverables of the associated ServiceOffering.
   * Written for proposals — concise, outcome-focused.
   */
  deliverables: readonly string[];

  /**
   * Indicative timeline for the setup engagement.
   * Examples: "1–2 weeks", "3 business days", "2–3 weeks"
   */
  timeline: string;

  /**
   * Whether this setup fee can be deferred to invoice at launch (vs. on signing).
   *
   * true    Client pays on contract signature.
   * false   Fee is invoiced at platform go-live. Useful for reducing friction
   *         in the sales process for lower-risk engagements.
   */
  payableOnSigning: boolean;
}

/**
 * The recurring base platform license fee.
 *
 * Covers access to the Mister Chameleon platform infrastructure, regardless
 * of which modules are active. Every client engagement must include this fee.
 *
 * There is typically one platform fee per client (not per module or site).
 * The platform fee may scale with usage tier in a future pricing iteration.
 */
export interface PlatformFee extends PricingFeeBase<"platform"> {
  /** Narrowed identifier type. */
  id: PlatformFeeId;

  /**
   * What the platform fee covers.
   * Used in proposal copy to justify the recurring charge.
   */
  includes: readonly string[];

  /**
   * Whether an annual commitment is available at a discounted rate.
   *
   * When true, the pricing model may include an annualBand as an alternative
   * to the monthly list price.
   */
  annualDiscountAvailable: boolean;

  /**
   * Annual pricing band (optional — only set if annualDiscountAvailable is true).
   * Amount represents the total annual charge (12-month equivalent).
   */
  annualBand?: PricingBand;
}

/**
 * A recurring per-module access fee.
 *
 * Charged for each product module the client has licensed beyond any base
 * module included in the platform fee. Linked to a specific ProductModuleId
 * to make the module-to-price mapping explicit.
 *
 * In the current model, modules beyond the primary are additional line items.
 * A future tier system may bundle N modules into each tier.
 */
export interface ModuleFee extends PricingFeeBase<"module"> {
  /** Narrowed identifier type. */
  id: ModuleFeeId;

  /**
   * The specific platform module this fee covers.
   * Connects the pricing model back to the product catalog.
   */
  linkedModuleId: ProductModuleId;

  /**
   * The capabilities unlocked by this module fee.
   * Used in proposal copy and sales qualification materials.
   */
  capabilities: readonly string[];

  /**
   * Whether this module requires a separate setup activity to activate.
   * When true, an additional SetupFee (or scope line) may be needed.
   */
  requiresSetup: boolean;
}

/**
 * A fee for a specific service engagement — either a one-time project or
 * an ongoing retainer linked to a ServiceOfferingId.
 *
 * Service fees are not always recurring. A content modelling engagement is
 * a project (one-time); an optimisation retainer is ongoing (monthly).
 * The billingCadence field distinguishes these cases.
 */
export interface ServiceFee extends PricingFeeBase<"service"> {
  /** Narrowed identifier type. */
  id: ServiceFeeId;

  /**
   * The service offering this fee funds.
   * Connects the pricing model back to the product service catalog.
   */
  linkedServiceId: ServiceOfferingId;

  /**
   * What the client receives in this engagement.
   * Written for proposals — one deliverable per entry.
   */
  deliverables: readonly string[];

  /**
   * Minimum engagement duration for retainer-style service fees.
   * Omit for one-time project fees.
   *
   * Examples: "3 months", "1 quarter", "6 months"
   */
  minimumTerm?: string;
}

/**
 * An optional recurring fee for the structured optimisation service.
 *
 * Covers the MC team's delivery of the optimization operating model —
 * monthly performance reviews, experiment management, quarterly strategy
 * reviews — as a managed retainer. This is what transforms the platform
 * from a tool clients operate themselves into a service MC delivers for them.
 *
 * Unlike the service fees above, the optimization fee is always optional —
 * clients may manage reviews internally without it.
 */
export interface OptimizationFee extends PricingFeeBase<"optimization"> {
  /** Narrowed identifier type. */
  id: OptimizationFeeId;

  /**
   * The specific optimization cycles included in this retainer.
   * Maps to OptimizationCycleId in optimization/types.ts.
   */
  includedCycles: readonly OptimizationCycleId[];

  /**
   * Approximate MC team hours per month included in this retainer.
   * Used in internal capacity planning and as a proposal reference.
   */
  hoursPerMonth: number;

  /**
   * What is included at this fee tier.
   * Used in proposal copy — concise, outcome-oriented statements.
   */
  includes: readonly string[];

  /**
   * Minimum commitment term for the optimisation retainer.
   * Optimisation only produces value with sustained data — short terms
   * rarely justify the investment for either party.
   *
   * Examples: "3 months", "6 months", "1 quarter minimum then rolling"
   */
  minimumTerm: string;
}

/**
 * Discriminated union of all fee types.
 *
 * Use this when a function or data structure needs to work with any fee
 * without knowing the specific category in advance.
 *
 * TypeScript narrows to the correct interface when you check `.category`:
 *   if (fee.category === "module") { fee.linkedModuleId; // ✓ }
 */
export type AnyPricingFee =
  | SetupFee
  | PlatformFee
  | ModuleFee
  | ServiceFee
  | OptimizationFee;

// ─────────────────────────────────────────────────────────────────────────────
// PRICING MODEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complete, composable pricing model.
 *
 * A PricingModel is a named, versioned collection of fee instances that
 * defines the pricing architecture for a delivery type or product tier.
 *
 * In the current single-tier model, there is one PricingModel ("standard").
 * When package tiers are introduced, each tier will be its own PricingModel
 * (or a PricingModel variant) — all using the same underlying fee types.
 *
 * ─── How fees compose ────────────────────────────────────────────────────────
 *
 *   A typical MC engagement includes:
 *
 *     1× SetupFee          (one-time, on signing)
 *     1× PlatformFee       (recurring monthly base)
 *     1–4× ModuleFee       (recurring per licensed module)
 *     0–2× ServiceFee      (project or retainer for service work)
 *     0–1× OptimizationFee (optional monthly/quarterly retainer)
 *
 *   The PricingConfig type (below) captures the per-client selection from
 *   this catalog.
 */
export interface PricingModel {
  /** Stable model identifier. */
  id: PricingModelId;

  /**
   * Human-readable model name.
   * Example: "Standard Engagement Model"
   */
  name: string;

  /** One-sentence description of what this model covers. */
  description: string;

  /**
   * Semantic version of this model definition.
   * Used to detect when a client's pricing config references a stale model.
   *
   * Format: "MAJOR.MINOR" — bump MAJOR on breaking changes (fee removals,
   * ID renames), MINOR on additive changes (new fee variants added).
   */
  version: string;

  /**
   * The default pricing currency for this model.
   * Individual fees may declare a different currency in their band.
   */
  defaultCurrency: PricingCurrency;

  // ── Fee catalogs ─────────────────────────────────────────────────────────────
  //
  // These arrays define what is *available* in this model — not what any
  // specific client pays. PricingConfig (below) selects from these catalogs.

  /** All setup fee variants available in this model. */
  setupFees: readonly SetupFee[];

  /** The platform base license fee. Every engagement includes this. */
  platformFee: PlatformFee;

  /** Per-module recurring fees for all available modules. */
  moduleFees: readonly ModuleFee[];

  /** Service engagement fees (project and retainer variants). */
  serviceFees: readonly ServiceFee[];

  /** Optional optimisation add-on fees. */
  optimizationFees: readonly OptimizationFee[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A per-client or per-proposal configuration selecting specific fees
 * from a PricingModel.
 *
 * PricingConfig is not a contract — it is a structured description of what
 * a specific client engagement includes and at what price point. It powers
 * proposal generation and internal engagement planning.
 *
 * One PricingConfig per client proposal or engagement. Multiple configs
 * may reference the same PricingModel (the catalog) while varying their
 * selections and overrides.
 */
export interface PricingConfig {
  /**
   * Config identifier — unique per proposal or client engagement.
   * Suggested format: "client-slug-YYYY-MM" or a UUID.
   */
  id: string;

  /**
   * Which pricing model this config draws from.
   * All selected fee IDs must be valid within the referenced model.
   */
  modelId: PricingModelId;

  /**
   * The version of the model this config was built against.
   * Compare against PricingModel.version to detect staleness.
   */
  modelVersion: string;

  /** Currency for this engagement. Overrides model default if different. */
  currency: PricingCurrency;

  // ── Fee selections ────────────────────────────────────────────────────────────

  /**
   * The setup fee selected for this engagement.
   * Must be a valid SetupFeeId from the referenced model.
   */
  selectedSetupFeeId: SetupFeeId;

  /**
   * The module fees included in this engagement.
   * Must be valid ModuleFeeIds from the referenced model.
   */
  selectedModuleFeeIds: readonly ModuleFeeId[];

  /**
   * Service fees included in this engagement.
   * May be empty if the client is not taking any service offering.
   */
  selectedServiceFeeIds: readonly ServiceFeeId[];

  /**
   * Optional optimisation retainer selected for this engagement.
   * Omit if the client is not taking the optimisation add-on.
   */
  selectedOptimizationFeeId?: OptimizationFeeId;

  // ── Price overrides ────────────────────────────────────────────────────────────
  //
  // Overrides allow per-client pricing without modifying the shared fee catalog.
  // Only override when a specific negotiated price differs from the list band.
  // Overrides must not go below the fee's band.min.

  /**
   * Per-fee price overrides. The key is a PricingFeeId; the value is the
   * agreed MonetaryAmount for this engagement specifically.
   *
   * When a fee is not overridden, the model's list price applies.
   */
  priceOverrides?: Partial<Record<PricingFeeId, MonetaryAmount>>;

  // ── Proposal metadata ─────────────────────────────────────────────────────────

  /**
   * Optional free-text notes for the proposal — scope caveats, inclusion
   * notes, or client-specific context that affects the pricing rationale.
   */
  proposalNotes?: string;

  /**
   * When this config was created (ISO 8601 date string).
   */
  createdAt?: string;

  /**
   * Optional label for this configuration — useful when multiple scenarios
   * are being compared for the same client.
   *
   * Example: "Starter option", "Full stack proposal", "Phase 1 only"
   */
  scenarioLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL LINE ITEM  (output type for proposal generation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A resolved, display-ready line item for a proposal.
 *
 * ProposalLineItem is the output of rendering a PricingConfig — it is what
 * the proposal template actually renders. Each fee selected in the config
 * produces one ProposalLineItem.
 *
 * Generated by the `buildProposalLineItems()` helper in pricing/model.ts.
 */
export interface ProposalLineItem {
  /** The fee this line item represents. */
  feeId: PricingFeeId;

  /** Fee category — used to group line items in the proposal. */
  category: FeeCategory;

  /** Display label for the line item. */
  label: string;

  /** Short description for the proposal. */
  description: string;

  /** How often this fee is charged. */
  billingCadence: BillingCadence;

  /**
   * The resolved price for this line item.
   * Reflects any override from PricingConfig.priceOverrides, otherwise
   * uses the fee's band.list price.
   */
  price: MonetaryAmount;

  /**
   * Whether the price was overridden from list for this engagement.
   * Useful for internal review of discounting.
   */
  isOverridden: boolean;

  /** Which proposal section this line item belongs to. */
  proposalSection: "one-time" | "recurring";
}

/**
 * A fully resolved proposal — the top-level output of rendering a PricingConfig.
 *
 * Contains one-time and recurring line items, totals for each, and metadata.
 * Suitable for generating a formatted proposal document or PDF.
 */
export interface ResolvedProposal {
  /** The config that produced this proposal. */
  configId: string;

  /** Human-readable scenario label (from PricingConfig.scenarioLabel). */
  scenarioLabel?: string;

  /** Currency for all amounts in this proposal. */
  currency: PricingCurrency;

  /** One-time fees (setup, scoped projects). */
  oneTimeItems: readonly ProposalLineItem[];

  /** Recurring fees (platform, modules, retainers). */
  recurringItems: readonly ProposalLineItem[];

  /**
   * Total of all one-time fees.
   * The client pays this amount at engagement start.
   */
  oneTimeTotal: MonetaryAmount;

  /**
   * Total of all monthly recurring fees, expressed as a monthly figure.
   * Quarterly and annual fees are converted to their monthly equivalent.
   */
  monthlyRecurringTotal: MonetaryAmount;

  /**
   * Optional notes from PricingConfig.proposalNotes.
   * Rendered as a footnote or caveat section on the proposal.
   */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX TYPES  (for fast lookup tooling)
// ─────────────────────────────────────────────────────────────────────────────

/** Index type for fast module fee lookup by module ID. */
export type ModuleFeeIndex = Readonly<Record<ModuleFeeId, ModuleFee>>;

/** Index type for fast service fee lookup by service fee ID. */
export type ServiceFeeIndex = Readonly<Record<ServiceFeeId, ServiceFee>>;
