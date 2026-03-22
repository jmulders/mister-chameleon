/**
 * Standard Onboarding Flow
 *
 * The authoritative definition of how every new client is onboarded onto the
 * Mister Chameleon platform. Five sequential phases, each with specific inputs,
 * outputs, checklist items, and acceptance criteria.
 *
 * ─── Reading this file ────────────────────────────────────────────────────────
 *
 *   INTAKE_STEP               → Phase 1: capture context and goals
 *   CONTEXT_MAPPING_STEP      → Phase 2: map traffic to decisioning vocabulary
 *   CONTENT_MAPPING_STEP      → Phase 3: define variant strategy and copy briefs
 *   TECHNICAL_SETUP_STEP      → Phase 4: configure, connect, and validate
 *   LAUNCH_OPTIMISATION_STEP  → Phase 5: go live and establish the feedback loop
 *
 *   STANDARD_ONBOARDING_FLOW  → assembled flow definition
 *   ONBOARDING_STEP_INDEX     → O(1) lookup map
 *
 * ─── Artifacts produced ──────────────────────────────────────────────────────
 *
 *   Step 1 Intake
 *     • Client intake brief
 *     • Provisional onboarding timeline
 *
 *   Step 2 Context Mapping
 *     • Traffic source map
 *     • Use case fit summary
 *     • Decision rule recommendation
 *     • Variant dimension brief
 *
 *   Step 3 Content Mapping
 *     • Variant matrix
 *     • Copy briefs per variant key
 *     • CMS schema recommendation
 *     • Content status tracker
 *
 *   Step 4 Technical Setup
 *     • Tenant config file
 *     • CMS variant entries (published)
 *     • n8n workflow (connected and tested)
 *     • Validated platform diagnostics
 *
 *   Step 5 Launch and Optimisation
 *     • Live adaptive site
 *     • Variant performance baseline
 *     • Optimisation backlog
 *     • Client handover document
 *
 * ─── Connection to the product model ─────────────────────────────────────────
 *
 *   Each step references:
 *     relatedServiceOffering → product/types.ts ServiceOfferingId
 *     activatedModules       → product/types.ts ProductModuleId[]
 *
 *   This means:
 *     getStepServiceOffering(step) resolves to the full ServiceOffering object.
 *     getStepActivatedModules(step) resolves to the full ProductModule objects.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   onboarding/types.ts  → all type definitions
 *   onboarding/flow.ts   ← YOU ARE HERE
 *   onboarding/index.ts  → barrel re-export
 */

import type {
  OnboardingStep,
  OnboardingFlow,
  OnboardingStepIndex,
} from "./types";

import { SERVICE_INDEX, MODULE_INDEX } from "@/product/catalog";
import type { ServiceOffering, ProductModule } from "@/product/types";

// ─────────────────────────────────────────────────────────────────────────────
// STEP DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── Phase 1: Intake ───────────────────────────────────────────────────────────

const INTAKE_STEP: OnboardingStep = {
  id: "intake",
  name: "Intake",
  description:
    "Capture everything needed to plan the engagement: the client's business " +
    "context, ICP, primary traffic sources, existing tech stack, and the " +
    "agreed platform package. Sets the scope for all subsequent phases.",
  objective:
    "A completed intake brief is reviewed and approved by both parties, " +
    "and a provisional engagement timeline is signed off.",
  ownerRole: "joint",
  validStatuses: [
    "not-started",
    "in-progress",
    "awaiting-client",
    "awaiting-review",
    "complete",
  ],
  canBeSkipped: false,
  estimatedDuration: "1–3 days",
  relatedServiceOffering: "onboarding",
  prerequisiteSteps: [],

  requiredInputs: [
    {
      id: "company-overview",
      label: "Company overview and ICP brief",
      description:
        "A short description of the business, its ideal customer profile, and " +
        "what a 'qualified lead' looks like. Used to calibrate variant messaging.",
      source: "client",
      required: true,
      format: "Google Doc or email summary (200–500 words)",
    },
    {
      id: "primary-traffic-sources",
      label: "Primary traffic sources",
      description:
        "Which channels drive the most valuable inbound traffic — Google organic, " +
        "Google Ads, LinkedIn, direct, referral. Even rough percentages help. " +
        "GA access or a screenshot of channel breakdown is ideal.",
      source: "client",
      required: true,
      format: "GA screenshot or written summary",
    },
    {
      id: "cms-status",
      label: "CMS system and status",
      description:
        "Which CMS the client uses (Sanity, Storyblok, Statamic, or none), " +
        "whether it is already provisioned, and who manages it. If no CMS exists, " +
        "document the decision to start with mock content.",
      source: "client",
      required: true,
      format: "Written answer — 2–3 sentences",
    },
    {
      id: "crm-workflow",
      label: "CRM and sales workflow",
      description:
        "How contact submissions currently reach the sales team: inbox, HubSpot, " +
        "Pipedrive, Slack, etc. Needed to configure the n8n dispatch correctly.",
      source: "client",
      required: true,
      format: "Written answer — describe the current contact-to-CRM path",
    },
    {
      id: "package-selection",
      label: "Agreed platform package",
      description:
        "Which package the client has signed: essential, growth, or scale. " +
        "This determines which modules are activated in technical setup.",
      source: "internal",
      required: true,
      format: "PackageId — essential | growth | scale",
    },
    {
      id: "baseline-metrics",
      label: "Current website performance metrics",
      description:
        "Existing conversion rate, monthly traffic, and any other KPIs the " +
        "client tracks today. Used to establish a pre-platform baseline for " +
        "post-launch improvement measurement. Not blocking — improves reporting.",
      source: "client",
      required: false,
      format: "GA export or written summary",
    },
    {
      id: "target-launch-date",
      label: "Target launch date",
      description:
        "When the client wants the platform live. Used to work backwards through " +
        "the onboarding timeline and flag any scheduling risks.",
      source: "client",
      required: false,
      format: "Date or date range",
    },
  ],

  outputArtifacts: [
    {
      id: "intake-brief",
      label: "Client Intake Brief",
      description:
        "A single document summarising the client's business context, ICP, " +
        "traffic sources, tech stack, agreed package, and target timeline. " +
        "Reviewed and approved by the client before phase 2 begins. " +
        "Serves as the source of truth for all subsequent phases.",
      artifactType: "document",
      blocksNextStep: true,
      templateReference: "docs/new-tenant-setup.md",
    },
    {
      id: "onboarding-timeline",
      label: "Provisional Onboarding Timeline",
      description:
        "A phase-by-phase schedule with estimated completion dates, key " +
        "milestones, and named owners (MC and client side). Updated if scope " +
        "or client responsiveness changes during the engagement.",
      artifactType: "document",
      blocksNextStep: false,
    },
  ],

  checklistItems: [
    { id: "kickoff-scheduled",     label: "Kick-off call scheduled and confirmed",                       owner: "internal", required: true  },
    { id: "company-brief-received",label: "Company overview and ICP brief received from client",         owner: "client",   required: true  },
    { id: "traffic-sources-shared",label: "Primary traffic sources shared (GA access or summary)",       owner: "client",   required: true  },
    { id: "cms-confirmed",         label: "CMS system confirmed and access path agreed",                 owner: "client",   required: true  },
    { id: "crm-documented",        label: "CRM and sales workflow documented",                           owner: "internal", required: true  },
    { id: "package-confirmed",     label: "Package selection confirmed in writing",                      owner: "internal", required: true  },
    { id: "intake-brief-drafted",  label: "Intake brief drafted and sent to client for review",         owner: "internal", required: true  },
    { id: "intake-brief-approved", label: "Intake brief approved by client",                            owner: "client",   required: true  },
    { id: "timeline-shared",       label: "Provisional timeline shared and acknowledged",               owner: "internal", required: true  },
    { id: "baseline-metrics",      label: "Pre-platform baseline metrics captured (if available)",      owner: "client",   required: false },
  ],
};

// ── Phase 2: Context Mapping ──────────────────────────────────────────────────

const CONTEXT_MAPPING_STEP: OnboardingStep = {
  id: "context-mapping",
  name: "Context Mapping",
  description:
    "Translate the client's traffic reality into the platform's decisioning " +
    "vocabulary: which traffic sources map to which visitor intents, which " +
    "use case fits their scenario, and which decision rules should fire and " +
    "in what priority order.",
  objective:
    "A variant dimension brief is produced and agreed, specifying the hero, " +
    "proof, and CTA axes the platform will personalise and which decision rules " +
    "will govern the selection.",
  ownerRole: "joint",
  validStatuses: [
    "not-started",
    "in-progress",
    "awaiting-client",
    "awaiting-review",
    "complete",
    "skipped",
  ],
  canBeSkipped: true,
  estimatedDuration: "2–4 days",
  relatedServiceOffering: "content-modeling",
  prerequisiteSteps: ["intake"],

  requiredInputs: [
    {
      id: "intake-brief",
      label: "Approved intake brief",
      description:
        "The intake brief from phase 1 — provides company context, ICP, " +
        "and traffic source breakdown that this phase builds on.",
      source: "internal",
      required: true,
      format: "Document produced in intake step",
    },
    {
      id: "analytics-access",
      label: "Analytics access or traffic export",
      description:
        "Read access to Google Analytics (or equivalent) or an exported report " +
        "showing sessions by channel, top landing pages, and bounce rates. " +
        "Used to validate the traffic source assumptions from intake.",
      source: "client",
      required: false,
      format: "GA read access or CSV/spreadsheet export",
    },
    {
      id: "existing-copy",
      label: "Current homepage copy and best-performing assets",
      description:
        "The current homepage copy — headlines, subheadlines, CTAs — plus any " +
        "ad copy or email subject lines the client knows convert well. " +
        "Provides raw material for the variant briefs in phase 3.",
      source: "client",
      required: false,
      format: "Text, URL, or screenshot",
    },
    {
      id: "persona-docs",
      label: "Existing persona or audience segmentation work",
      description:
        "Any ICP documentation, buyer persona profiles, or audience segmentation " +
        "the client already has. Significantly shortens this phase if present.",
      source: "client",
      required: false,
      format: "Any format — Google Doc, PDF, deck slide",
    },
  ],

  outputArtifacts: [
    {
      id: "traffic-source-map",
      label: "Traffic Source Map",
      description:
        "A table mapping each significant traffic source (Google organic, " +
        "Google Ads, LinkedIn organic, LinkedIn Ads, direct, referral) to its " +
        "estimated share of traffic, the likely visitor intent, and the " +
        "platform's source detection value (e.g. 'google', 'linkedin', 'direct'). " +
        "Directly informs which decision rules to activate.",
      artifactType: "document",
      blocksNextStep: true,
    },
    {
      id: "use-case-fit",
      label: "Use Case Fit Summary",
      description:
        "A one-page summary identifying which Mister Chameleon use case best " +
        "matches the client's scenario (e.g. 'b2b-lead-gen', 'account-based-marketing') " +
        "and the rationale. Sets the strategic framing for the platform deployment.",
      artifactType: "document",
      blocksNextStep: false,
    },
    {
      id: "decision-rule-recommendation",
      label: "Decision Rule Recommendation",
      description:
        "A prioritised list of which decision rules to activate: source-based " +
        "(Google, LinkedIn, direct) and history-based (returning visitor, CTA " +
        "clicked, high page-view count). Includes recommended rule priority " +
        "order and rationale for any rules intentionally excluded.",
      artifactType: "document",
      blocksNextStep: true,
    },
    {
      id: "variant-dimension-brief",
      label: "Variant Dimension Brief",
      description:
        "Defines the three variant axes for the deployment: hero intent " +
        "(problem/vision/brand), proof angle (cases/vision/platform), and " +
        "CTA escalation level (guide/platform/meeting). Maps each source/history " +
        "rule to the variant keys it should select. This brief is the primary " +
        "input to content mapping in phase 3.",
      artifactType: "document",
      blocksNextStep: true,
      templateReference: "docs/new-tenant-setup.md",
    },
  ],

  checklistItems: [
    { id: "analytics-reviewed",       label: "Traffic source data reviewed (GA or export)",                         owner: "internal", required: true  },
    { id: "source-map-drafted",       label: "Traffic source map drafted",                                          owner: "internal", required: true  },
    { id: "source-map-reviewed",      label: "Traffic source map reviewed and agreed with client",                  owner: "client",   required: true  },
    { id: "use-case-identified",      label: "Best-fit use case identified and documented",                         owner: "internal", required: true  },
    { id: "rule-set-defined",         label: "Decision rule set defined with priority order",                       owner: "internal", required: true  },
    { id: "variant-axes-agreed",      label: "Variant axes (hero × proof × CTA) agreed with client",               owner: "client",   required: true  },
    { id: "variant-brief-signed-off", label: "Variant dimension brief signed off by both parties",                 owner: "client",   required: true  },
  ],
};

// ── Phase 3: Content Mapping ──────────────────────────────────────────────────

const CONTENT_MAPPING_STEP: OnboardingStep = {
  id: "content-mapping",
  name: "Content Mapping",
  description:
    "Define the specific variant content that will be created in the CMS: " +
    "the variant keys to populate, the messaging angle for each, and who " +
    "writes what. Produces a copy brief for each key and a content tracker " +
    "to manage delivery.",
  objective:
    "Every variant key in the agreed set has a written copy brief, the CMS " +
    "schema is defined, and a content status tracker shows who is responsible " +
    "for writing each entry and by when.",
  ownerRole: "joint",
  validStatuses: [
    "not-started",
    "in-progress",
    "awaiting-client",
    "awaiting-review",
    "complete",
    "skipped",
  ],
  canBeSkipped: true,
  estimatedDuration: "3–7 days",
  relatedServiceOffering: "content-modeling",
  prerequisiteSteps: ["intake", "context-mapping"],
  activatedModules: ["adaptive-website"],

  requiredInputs: [
    {
      id: "variant-dimension-brief",
      label: "Variant dimension brief",
      description:
        "The brief produced in context mapping that defines the hero × proof × " +
        "CTA axes and maps each rule to variant keys. This is the primary " +
        "specification for the copy briefs produced here.",
      source: "internal",
      required: true,
      format: "Document from context-mapping step",
    },
    {
      id: "brand-voice-guidelines",
      label: "Brand voice and tone guidelines",
      description:
        "The client's brand guidelines covering tone of voice, vocabulary " +
        "preferences, and any words or phrases to avoid. Ensures variant copy " +
        "stays on-brand even when personalised.",
      source: "client",
      required: false,
      format: "PDF, Google Doc, or brand guidelines URL",
    },
    {
      id: "existing-homepage-copy",
      label: "Existing homepage copy for reference/adaptation",
      description:
        "The current live homepage copy, especially if it contains sections " +
        "that can be adapted (rather than rewritten from scratch) for variants.",
      source: "client",
      required: false,
      format: "URL or pasted text",
    },
    {
      id: "cms-credentials",
      label: "CMS credentials or setup access",
      description:
        "Access to the client's CMS (Sanity, Storyblok, Statamic) for schema " +
        "review and eventually content entry. If CMS is not yet provisioned, " +
        "document the plan for provisioning before technical setup begins.",
      source: "client",
      required: false,
      format: "Credentials, invite, or API token — per CMS provider",
    },
  ],

  outputArtifacts: [
    {
      id: "variant-matrix",
      label: "Variant Matrix",
      description:
        "A table of all variant key combinations (hero × proof × CTA) that " +
        "the platform will use, each mapped to the source/history condition " +
        "that triggers it. This is the canonical reference for the tenant's " +
        "TenantVariantConfig and the copy briefs below.",
      artifactType: "document",
      blocksNextStep: true,
    },
    {
      id: "copy-briefs",
      label: "Copy Brief per Variant Key",
      description:
        "One brief per variant key in the matrix (typically 3 hero + 3 proof + " +
        "3 CTA = 9 briefs for a full set). Each brief specifies: headline " +
        "direction and intent, proof angle and evidence type, CTA label and " +
        "escalation level, and the audience it speaks to. The client's " +
        "copywriter or MC produces the actual copy from these briefs.",
      artifactType: "document",
      blocksNextStep: true,
    },
    {
      id: "cms-schema-recommendation",
      label: "CMS Schema Recommendation",
      description:
        "Documentation of how variant keys should be structured in the chosen " +
        "CMS: the content model (fields, slugs, content types) that makes each " +
        "variant key queryable by the adaptive rendering layer. References the " +
        "CMS provider's documentation conventions.",
      artifactType: "document",
      blocksNextStep: false,
      templateReference: "docs/sanity-content-setup.md",
    },
    {
      id: "content-status-tracker",
      label: "Content Status Tracker",
      description:
        "A lightweight tracking document (spreadsheet or table) listing every " +
        "variant key, its writing status (not-started / in-progress / " +
        "draft-review / published), the assigned writer, and the deadline. " +
        "Used to unblock technical setup as soon as the first keys are ready.",
      artifactType: "document",
      blocksNextStep: false,
    },
  ],

  checklistItems: [
    { id: "variant-matrix-drafted",    label: "Variant matrix drafted and all keys identified",                       owner: "internal", required: true  },
    { id: "variant-matrix-approved",   label: "Variant matrix approved by client",                                    owner: "client",   required: true  },
    { id: "copy-briefs-written",       label: "Copy brief written for every variant key",                             owner: "internal", required: true  },
    { id: "copy-briefs-approved",      label: "Copy briefs reviewed and approved by client",                          owner: "client",   required: true  },
    { id: "cms-schema-documented",     label: "CMS schema recommendation documented",                                 owner: "internal", required: true  },
    { id: "content-tracker-created",   label: "Content status tracker created and shared with client",               owner: "internal", required: true  },
    { id: "copy-writing-assigned",     label: "Copy writing responsibility assigned (MC or client copywriter)",       owner: "joint",    required: true  },
    { id: "copy-writing-started",      label: "Variant copy writing started (at least first key in draft)",          owner: "client",   required: false },
    { id: "brand-guidelines-reviewed", label: "Brand voice guidelines reviewed and applied to brief direction",       owner: "internal", required: false },
  ],
};

// ── Phase 4: Technical Setup ──────────────────────────────────────────────────

const TECHNICAL_SETUP_STEP: OnboardingStep = {
  id: "technical-setup",
  name: "Technical Setup",
  description:
    "Configure the full platform pipeline: create the tenant config file, " +
    "connect the CMS and populate variant entries, configure and test the " +
    "n8n workflow, and validate the end-to-end adaptive experience using " +
    "the diagnostics bar before sign-off.",
  objective:
    "The diagnostics bar confirms correct variant selection for at least three " +
    "distinct traffic source conditions, the contact form submits successfully " +
    "and dispatches an enriched payload to n8n, and both parties have reviewed " +
    "the live diagnostics output.",
  ownerRole: "internal-led",
  validStatuses: [
    "not-started",
    "in-progress",
    "awaiting-client",
    "awaiting-review",
    "complete",
  ],
  canBeSkipped: false,
  estimatedDuration: "3–7 days",
  relatedServiceOffering: "onboarding",
  prerequisiteSteps: ["intake", "context-mapping", "content-mapping"],
  activatedModules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
  ],

  requiredInputs: [
    {
      id: "tenant-config-params",
      label: "Tenant configuration parameters",
      description:
        "All values needed to build the tenant config file: tenantId slug, " +
        "display name, canonical hostname, agreed CMS provider, decision provider " +
        "(rules or ai), and which feature flags to enable for the package.",
      source: "internal",
      required: true,
      format: "Derived from intake brief and package selection",
    },
    {
      id: "brand-theme",
      label: "Brand theme values",
      description:
        "The client's brand primary colour, hover/active states, radius " +
        "preference (sharp/balanced/soft), and brand metadata (name, tagline, " +
        "favicon path). Used to build the TenantTheme for the config.",
      source: "client",
      required: true,
      format: "Hex values + design token decisions",
    },
    {
      id: "cms-access",
      label: "CMS credentials and access",
      description:
        "API access to the configured CMS provider with permission to create " +
        "and publish content. If Sanity: project ID, dataset, and API token. " +
        "If Storyblok: access token. If Statamic: API URL and key.",
      source: "client",
      required: true,
      format: "Environment variable values per provider",
    },
    {
      id: "variant-copy",
      label: "Published variant copy in CMS",
      description:
        "At least the first pass of variant content published in the CMS " +
        "against the agreed variant keys. Technical setup can begin with a " +
        "partial key set (first hero + proof + CTA), but all keys must be " +
        "published before the launch sign-off in phase 5.",
      source: "client",
      required: true,
      format: "Content published in CMS matching keys in variant matrix",
    },
    {
      id: "n8n-access",
      label: "n8n webhook URL or setup access",
      description:
        "Either the n8n webhook URL to connect to (if the client runs their " +
        "own n8n instance) or confirmation to use the platform-level " +
        "N8N_CONTACT_WEBHOOK_URL environment variable.",
      source: "client",
      required: true,
      format: "URL string or written confirmation",
    },
    {
      id: "deployment-access",
      label: "Deployment environment access",
      description:
        "Access to the deployment platform (Vercel, etc.) to configure " +
        "environment variables: NEXT_PUBLIC_SITE_URL, SANITY_PROJECT_ID (or " +
        "equivalent), N8N_CONTACT_WEBHOOK_URL. Required to make the tenant " +
        "config take effect in production.",
      source: "client",
      required: true,
      format: "Vercel project invite or environment variable access",
    },
  ],

  outputArtifacts: [
    {
      id: "tenant-config-file",
      label: "Tenant Configuration File",
      description:
        "The TypeScript tenant config file at tenant/templates/<slug>-config.ts, " +
        "built using createTenantConfig() with the client's theme, CMS provider, " +
        "decision provider, variant set, and feature flags. Registered in " +
        "resolve-tenant.ts with all known hostnames (production, www, staging).",
      artifactType: "config",
      blocksNextStep: true,
      templateReference: "tenant/templates/acme-growth-config.ts",
    },
    {
      id: "cms-variant-entries",
      label: "CMS Variant Entries (Published)",
      description:
        "All variant keys in the agreed variant matrix have corresponding " +
        "published entries in the client's CMS, each containing headline, " +
        "subheadline, proof copy, and CTA label matching the copy briefs. " +
        "Keys are verified by the adaptive rendering layer returning non-fallback " +
        "content for each key in development.",
      artifactType: "cms-content",
      blocksNextStep: true,
    },
    {
      id: "n8n-workflow",
      label: "n8n Workflow (Connected and Tested)",
      description:
        "The n8n contact intake workflow is connected to the platform's " +
        "POST /api/contact route and has received at least one successful test " +
        "submission. The payload contains source, session context, served " +
        "variant, and visitor history fields. Screenshots of the test execution " +
        "are saved as evidence.",
      artifactType: "workflow",
      blocksNextStep: true,
    },
    {
      id: "diagnostics-validation",
      label: "Validated Platform Diagnostics",
      description:
        "Screenshots or a screen recording of the diagnostics bar confirming: " +
        "(1) Google source → correct variant selected, (2) LinkedIn source → " +
        "correct variant selected, (3) direct source → correct variant selected. " +
        "Signed off by the client before phase 5 begins.",
      artifactType: "validated-state",
      blocksNextStep: true,
    },
  ],

  checklistItems: [
    { id: "tenant-config-created",      label: "Tenant config file created with theme, CMS provider, and feature flags", owner: "internal", required: true  },
    { id: "tenant-registered",          label: "Tenant registered in resolve-tenant.ts with all hostnames",              owner: "internal", required: true  },
    { id: "env-vars-configured",        label: "Environment variables configured in deployment platform",                owner: "internal", required: true  },
    { id: "cms-connected",              label: "CMS provider connected and first variant key returns content",           owner: "internal", required: true  },
    { id: "all-variant-keys-published", label: "All variant keys in matrix published in CMS",                           owner: "client",   required: true  },
    { id: "rules-validated",            label: "Decision rules tested for each traffic source condition",                owner: "internal", required: true  },
    { id: "cta-tracking-verified",      label: "CTA click events recording correctly in tracking layer",                owner: "internal", required: true  },
    { id: "contact-form-tested",        label: "Contact form submits and n8n receives enriched payload",                 owner: "internal", required: true  },
    { id: "diagnostics-screenshot",     label: "Diagnostics bar screenshots taken for Google / LinkedIn / direct",      owner: "internal", required: true  },
    { id: "client-diagnostics-review",  label: "Client has reviewed diagnostics and confirmed variant selection",        owner: "client",   required: true  },
    { id: "staging-deployed",           label: "Staging environment deployed for client review before production",       owner: "internal", required: false },
  ],
};

// ── Phase 5: Launch and Optimisation ─────────────────────────────────────────

const LAUNCH_OPTIMISATION_STEP: OnboardingStep = {
  id: "launch-optimisation",
  name: "Launch and Optimisation",
  description:
    "Move the platform live on the client's production domain, establish a " +
    "two-week performance baseline, and hand over the platform with a clear " +
    "playbook for ongoing iteration. Transitions the engagement from setup " +
    "to the ongoing optimisation rhythm.",
  objective:
    "The adaptive platform is live on production, a two-week variant " +
    "performance baseline is read, an optimisation backlog is agreed, and " +
    "the client has the knowledge and access to manage the platform day-to-day.",
  ownerRole: "internal-led",
  validStatuses: [
    "not-started",
    "in-progress",
    "awaiting-client",
    "awaiting-review",
    "complete",
  ],
  canBeSkipped: false,
  estimatedDuration: "2–3 weeks (including baseline measurement window)",
  relatedServiceOffering: "optimisation",
  prerequisiteSteps: ["intake", "context-mapping", "content-mapping", "technical-setup"],
  activatedModules: [
    "adaptive-website",
    "context-intelligence",
    "adaptive-follow-up",
  ],

  requiredInputs: [
    {
      id: "all-technical-artifacts",
      label: "All phase 4 artifacts complete",
      description:
        "Tenant config live, all variant keys published, n8n connected, and " +
        "diagnostics validated. No gaps — partial variant key sets are not " +
        "acceptable for production launch.",
      source: "internal",
      required: true,
      format: "Confirmed from technical-setup checklist",
    },
    {
      id: "client-launch-sign-off",
      label: "Client sign-off on variant content",
      description:
        "The client has reviewed the live variant experiences (ideally in staging) " +
        "and given written approval for production deployment. Prevents post-launch " +
        "rollbacks due to copy concerns.",
      source: "client",
      required: true,
      format: "Written confirmation (email or comment in tracker)",
    },
    {
      id: "analytics-configured",
      label: "Analytics configured for post-launch monitoring",
      description:
        "GA (or equivalent) is confirmed to be tracking the production domain " +
        "correctly. Any custom events or goals needed for variant conversion " +
        "measurement are set up.",
      source: "client",
      required: false,
      format: "Confirmation that GA is live on production domain",
    },
  ],

  outputArtifacts: [
    {
      id: "live-platform",
      label: "Live Adaptive Platform",
      description:
        "The Mister Chameleon adaptive pipeline is active on the client's " +
        "production domain. Variant selection is live, CTA tracking is recording, " +
        "and contact form submissions are dispatching to n8n.",
      artifactType: "validated-state",
      blocksNextStep: true,
    },
    {
      id: "variant-performance-baseline",
      label: "Variant Performance Baseline",
      description:
        "A two-week post-launch report showing variant selection distribution " +
        "(how often each rule fired), CTA click rate per variant, and contact " +
        "form conversion by traffic source. This is the 'before' for all future " +
        "optimisation comparisons.",
      artifactType: "document",
      blocksNextStep: false,
    },
    {
      id: "optimisation-backlog",
      label: "Optimisation Backlog",
      description:
        "An initial list of variant iterations to test in the next 30–60 days, " +
        "derived from the baseline data and the client's business priorities. " +
        "Typically three to five items: a headline test, a proof angle test, " +
        "and a CTA escalation threshold test.",
      artifactType: "document",
      blocksNextStep: false,
    },
    {
      id: "handover-document",
      label: "Client Handover Document",
      description:
        "A practical reference for the client covering: how to add or update " +
        "variant content in the CMS, how to read the diagnostics bar, what " +
        "the decision rules are and how to request a rule change, and how to " +
        "interpret the variant performance baseline. Written for a non-technical " +
        "marketing team member.",
      artifactType: "document",
      blocksNextStep: false,
      templateReference: "docs/new-tenant-setup.md",
    },
  ],

  checklistItems: [
    { id: "production-deployment",        label: "Production deployment completed and domain resolving",                   owner: "internal", required: true  },
    { id: "production-diagnostics",       label: "Diagnostics bar confirmed correct on production domain",                 owner: "internal", required: true  },
    { id: "launch-announced",             label: "Launch announced to client stakeholders",                                owner: "client",   required: true  },
    { id: "baseline-window-started",      label: "Two-week baseline measurement window started",                           owner: "internal", required: true  },
    { id: "baseline-report-produced",     label: "Variant performance baseline report produced after 2 weeks",             owner: "internal", required: true  },
    { id: "baseline-reviewed",            label: "Baseline reviewed with client in a call or async",                       owner: "joint",    required: true  },
    { id: "optimisation-backlog-drafted", label: "Optimisation backlog drafted from baseline insights",                    owner: "internal", required: true  },
    { id: "backlog-prioritised",          label: "Optimisation backlog prioritised with client",                           owner: "client",   required: true  },
    { id: "handover-document-delivered",  label: "Handover document delivered and client acknowledged receipt",           owner: "internal", required: true  },
    { id: "ongoing-cadence-agreed",       label: "Ongoing optimisation cadence agreed (if on retainer)",                  owner: "joint",    required: false },
    { id: "cta-click-verification",       label: "CTA click events confirmed recording in production (not just staging)", owner: "internal", required: true  },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLED FLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The standard Mister Chameleon onboarding flow.
 *
 * Five sequential phases that take a client from signed contract to live
 * adaptive platform with an established optimisation rhythm.
 *
 * This is the TEMPLATE. Per-client progress is tracked in an OnboardingRecord
 * (future admin tooling) that references this flow and holds step instance state.
 *
 * @example
 *   STANDARD_ONBOARDING_FLOW.steps.forEach(step => {
 *     console.log(step.name, step.estimatedDuration);
 *   });
 */
export const STANDARD_ONBOARDING_FLOW: OnboardingFlow = {
  id: "standard",
  name: "Standard Onboarding",
  summary:
    "Takes a new client from signed contract to live adaptive platform in " +
    "three to five weeks, with a performance baseline and optimisation backlog " +
    "established at launch.",
  steps: [
    INTAKE_STEP,
    CONTEXT_MAPPING_STEP,
    CONTENT_MAPPING_STEP,
    TECHNICAL_SETUP_STEP,
    LAUNCH_OPTIMISATION_STEP,
  ],
  estimatedTotalDuration: "3–5 weeks",
  minimumPackage: "essential",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP INDEX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Index of all onboarding steps by ID for O(1) access.
 *
 * @example
 *   const step = ONBOARDING_STEP_INDEX["technical-setup"];
 *   console.log(step.outputArtifacts);
 */
export const ONBOARDING_STEP_INDEX: OnboardingStepIndex = Object.fromEntries(
  STANDARD_ONBOARDING_FLOW.steps.map((s) => [s.id, s]),
) as OnboardingStepIndex;

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the ServiceOffering object associated with the given step.
 * Returns null for steps without a relatedServiceOffering (launch-optimisation
 * spans the ongoing retainer rather than mapping to a single offering).
 *
 * @example
 *   const svc = getStepServiceOffering("content-mapping");
 *   console.log(svc?.label);  // "Content Modelling"
 */
export function getStepServiceOffering(
  stepId: OnboardingStep["id"],
): ServiceOffering | null {
  const step = ONBOARDING_STEP_INDEX[stepId];
  if (!step.relatedServiceOffering) return null;
  return SERVICE_INDEX[step.relatedServiceOffering];
}

/**
 * Returns the ProductModule objects activated by the given step.
 * Returns an empty array for steps (intake, context-mapping) that do not
 * directly activate modules.
 *
 * @example
 *   const modules = getStepActivatedModules("technical-setup");
 *   modules.forEach(m => console.log(m.label, m.status));
 */
export function getStepActivatedModules(
  stepId: OnboardingStep["id"],
): ProductModule[] {
  const step = ONBOARDING_STEP_INDEX[stepId];
  if (!step.activatedModules) return [];
  return step.activatedModules.map((id) => MODULE_INDEX[id]);
}

/**
 * Returns all output artifacts from the given step that block the next step.
 * Used by admin tooling to show what must exist before marking a step complete.
 *
 * @example
 *   const blockers = getBlockingArtifacts("technical-setup");
 *   // → [tenant-config-file, cms-variant-entries, n8n-workflow, diagnostics-validation]
 */
export function getBlockingArtifacts(
  stepId: OnboardingStep["id"],
) {
  return ONBOARDING_STEP_INDEX[stepId].outputArtifacts.filter(
    (a) => a.blocksNextStep,
  );
}

/**
 * Returns all required inputs for the given step that the client must supply.
 * Used to generate client-facing request lists and kick-off email content.
 *
 * @example
 *   const clientInputs = getClientInputsForStep("intake");
 *   clientInputs.forEach(i => console.log(`• ${i.label} (${i.format})`));
 */
export function getClientInputsForStep(
  stepId: OnboardingStep["id"],
) {
  return ONBOARDING_STEP_INDEX[stepId].requiredInputs.filter(
    (i) => i.source === "client",
  );
}

/**
 * Returns all required checklist items for the given step that are owned
 * by the client (not internal). Used to generate client task lists.
 *
 * @example
 *   const clientTasks = getClientChecklistItems("content-mapping");
 */
export function getClientChecklistItems(
  stepId: OnboardingStep["id"],
) {
  return ONBOARDING_STEP_INDEX[stepId].checklistItems.filter(
    (c) => c.owner === "client" && c.required,
  );
}

/**
 * Returns all steps that must be complete before the given step can begin.
 * Resolves prerequisiteSteps IDs to full OnboardingStep objects.
 *
 * @example
 *   const prereqs = getPrerequisiteSteps("technical-setup");
 *   // → [INTAKE_STEP, CONTEXT_MAPPING_STEP, CONTENT_MAPPING_STEP]
 */
export function getPrerequisiteSteps(
  stepId: OnboardingStep["id"],
): OnboardingStep[] {
  return ONBOARDING_STEP_INDEX[stepId].prerequisiteSteps.map(
    (id) => ONBOARDING_STEP_INDEX[id],
  );
}

/**
 * Returns all steps that can be skipped (canBeSkipped: true).
 * Used by admin tooling to know which steps may be bypassed for a client
 * with mature positioning or content already in place.
 *
 * @example
 *   const optional = getSkippableSteps();
 *   // → [CONTEXT_MAPPING_STEP, CONTENT_MAPPING_STEP]
 */
export function getSkippableSteps(): OnboardingStep[] {
  return STANDARD_ONBOARDING_FLOW.steps.filter((s) => s.canBeSkipped);
}

/**
 * Returns a flat list of all output artifacts across the entire flow,
 * optionally filtered by artifact type.
 *
 * @example
 *   const allDocs = getAllArtifacts("document");
 *   const allConfigs = getAllArtifacts("config");
 *   const everything = getAllArtifacts();
 */
export function getAllArtifacts(type?: OnboardingStep["outputArtifacts"][number]["artifactType"]) {
  const all = STANDARD_ONBOARDING_FLOW.steps.flatMap((s) =>
    s.outputArtifacts.map((a) => ({ ...a, stepId: s.id, stepName: s.name })),
  );
  return type ? all.filter((a) => a.artifactType === type) : all;
}
