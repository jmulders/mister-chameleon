/**
 * Support Process Definitions
 *
 * Concrete process definitions for all six support process types.
 *
 * Each definition captures the standard flow, ownership, SLA targets, and
 * escalation path for a category of platform support event. These are
 * templates — specific events will extend them with tenant, timestamp, and
 * severity detail.
 *
 * ─── Process types ────────────────────────────────────────────────────────────
 *
 *   incident             Platform failure. Sentry or manual alert. PE-led.
 *   content-issue        Variant serving incorrectly. CS-led diagnosis.
 *   cms-issue            CMS connectivity or schema. PE-led, client-technical in.
 *   tracking-data-issue  Analytics gap or misfiring. PE-led investigation.
 *   tenant-config-issue  Wrong flag/rule/theme. PE-led, AM client comms.
 *   feature-request      New behaviour requested. AM-led intake, PM triage.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   support/types.ts     — all type definitions
 *   support/processes.ts ← YOU ARE HERE — concrete definitions + catalog
 *   support/index.ts     — barrel re-export
 */

import type {
  SupportProcessDefinition,
  SupportProcessTypeId,
  SupportProcessCatalog,
  ResponseSLA,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SLA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** SLA targets for critical severity (live platform failure). */
const CRITICAL_SLA: ResponseSLA = {
  firstResponseHours: 1,
  resolutionTargetHours: 4,
  updateCadenceHours: 1,
};

/** SLA targets for high severity (significant degradation, client-visible). */
const HIGH_SLA: ResponseSLA = {
  firstResponseHours: 4,
  resolutionTargetHours: 8,
  updateCadenceHours: 4,
};

/** SLA targets for medium severity (notable issue, workaround available). */
const MEDIUM_SLA: ResponseSLA = {
  firstResponseHours: 8,
  resolutionTargetHours: 16,
  updateCadenceHours: 8,
};

/** SLA targets for low severity (minor issue, minimal client impact). */
const LOW_SLA: ResponseSLA = {
  firstResponseHours: 16,
  resolutionTargetHours: 40,
  updateCadenceHours: 24,
};

/** SLA targets for advisory (no immediate action, tracked for patterns). */
const ADVISORY_SLA: ResponseSLA = {
  firstResponseHours: 24,
  resolutionTargetHours: null,
  updateCadenceHours: 48,
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS: INCIDENT
// ─────────────────────────────────────────────────────────────────────────────

export const INCIDENT_PROCESS: SupportProcessDefinition = {
  id: "incident",
  label: "Incident",
  description:
    "A platform or integration failure that causes live traffic to be served " +
    "incorrectly, experience degraded performance, or produce errors. Incidents " +
    "are the highest-priority support type and require immediate team coordination. " +
    "They include: serving layer failures, decision engine errors, CMS API outages, " +
    "analytics pipeline interruptions, and third-party integration failures.",

  defaultSeverity: "high",
  applicableSeverities: ["critical", "high", "medium"],

  slaByServerity: {
    critical: CRITICAL_SLA,
    high: HIGH_SLA,
    medium: MEDIUM_SLA,
  },

  primaryOwner: "platform-engineer",
  defaultParticipants: ["account-manager", "platform-engineer"],

  typicalChannels: ["platform-monitor", "slack-alert", "client-email"],

  triageChecklist: [
    "Confirm the affected tenant(s) and page type(s).",
    "Determine whether the failure is platform-wide or tenant-specific.",
    "Identify which module or integration layer is implicated.",
    "Assess live traffic impact: are visitors seeing errors or degraded content?",
    "Check Sentry / uptime monitor for first-seen timestamp and error rate.",
    "Confirm whether a recent deployment or config change preceded the incident.",
  ],

  responsePath: {
    initialNotification: ["platform-engineer", "account-manager"],
    steps: [
      {
        step: 1,
        label: "Acknowledge and assign",
        description:
          "Platform engineer acknowledges the alert, confirms ownership, and " +
          "posts a triage update in #support within the first-response SLA window.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 2,
        label: "Client acknowledgement",
        description:
          "Account manager sends a brief acknowledgement to the client confirming " +
          "the team is investigating, with an initial expected update time.",
        owner: "account-manager",
        clientFacing: true,
      },
      {
        step: 3,
        label: "Diagnose root cause",
        description:
          "Platform engineer identifies the root cause — whether serving layer, " +
          "decision engine, CMS API, analytics pipeline, or integration. Documents " +
          "findings in the incident thread.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 4,
        label: "Apply fix or workaround",
        description:
          "Deploy a targeted fix, roll back a breaking change, or enable a failsafe " +
          "mode. For externally-caused outages (e.g. CMS API down), notify client and " +
          "set expectations for resolution dependency.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 5,
        label: "Verify resolution in production",
        description:
          "Confirm the fix is live and that normal serving behaviour has been restored " +
          "across affected tenants. Check error rates and variant serving logs.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 6,
        label: "Client resolution update",
        description:
          "Account manager sends a resolution summary to the client: what happened, " +
          "what was done, and what the team is doing to prevent recurrence.",
        owner: "account-manager",
        clientFacing: true,
      },
      {
        step: 7,
        label: "Post-incident review",
        description:
          "For critical and high-severity incidents: document a short post-incident " +
          "review covering root cause, timeline, fix, and prevention. Shared internally " +
          "and summarised for the client in the next monthly review.",
        owner: "platform-engineer",
        clientFacing: false,
      },
    ],
  },

  escalationPath: [
    {
      step: 1,
      role: "account-manager",
      action:
        "Escalate client communication to ensure the client's leadership team is " +
        "informed and expectations are managed. Offer a call if impact is high.",
      triggers: ["client-impact-grows", "sla-breach"],
      notifyClient: true,
    },
    {
      step: 2,
      role: "platform-engineer",
      action:
        "Engage a second platform engineer or senior technical resource to support " +
        "diagnosis if root cause is unclear after the standard response window.",
      triggers: ["no-diagnosis", "sla-breach"],
      notifyClient: false,
    },
    {
      step: 3,
      role: "client-technical",
      action:
        "Bring in the client's technical team if the incident requires access to " +
        "client-side credentials, CMS configuration, or hosting infrastructure.",
      triggers: ["external-dependency", "no-diagnosis"],
      notifyClient: true,
    },
  ],

  linkedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
    "adaptive-follow-up",
    "context-intelligence",
  ],
  linkedServices: ["onboarding", "optimisation"],

  toolingNotes: {
    linear:
      "Create as a Linear issue in the 'Platform' team with label 'Incident'. " +
      "Set priority to Urgent for critical, High for high, Medium for medium. " +
      "Link to any related deployment or config change issues.",
    slack:
      "Route platform-monitor alerts to #incidents. For critical severity, " +
      "page the on-call platform engineer via Slack workflow. Post all status " +
      "updates to the incident thread to maintain a single audit trail.",
    automation:
      "Sentry error rate alerts and uptime monitor webhooks can auto-create " +
      "incident tickets and post to #incidents. Threshold: >5% error rate on " +
      "any serving endpoint for >2 minutes triggers a critical alert.",
    clientPortal:
      "Future: client-visible incident status page with real-time updates. " +
      "Clients subscribe to notifications for their tenant.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS: CONTENT ISSUE
// ─────────────────────────────────────────────────────────────────────────────

export const CONTENT_ISSUE_PROCESS: SupportProcessDefinition = {
  id: "content-issue",
  label: "Content Issue",
  description:
    "A variant content problem that causes visitors to be served incorrect, " +
    "missing, outdated, or malformed content. Content issues are distinct from " +
    "platform incidents — the serving layer is working correctly, but the content " +
    "it is serving does not meet the intended experience. Examples: missing variant " +
    "copy for a segment, outdated CTA text post-campaign, broken image reference, " +
    "or a fallback variant serving when it should not.",

  defaultSeverity: "medium",
  applicableSeverities: ["high", "medium", "low", "advisory"],

  slaByServerity: {
    high: HIGH_SLA,
    medium: MEDIUM_SLA,
    low: LOW_SLA,
    advisory: ADVISORY_SLA,
  },

  primaryOwner: "content-strategist",
  defaultParticipants: ["content-strategist", "account-manager"],

  typicalChannels: ["client-email", "slack-alert", "internal-review"],

  triageChecklist: [
    "Identify the affected page type and variant key.",
    "Confirm whether the issue is a missing variant, wrong content, or serving error.",
    "Check CMS entry for the affected tenant — is the content present and published?",
    "Determine whether the issue is isolated to one tenant or shared across tenants.",
    "Establish the first-seen date and estimated visitor impact.",
    "Confirm whether this is a regression (was working before) or a gap (never set up).",
  ],

  responsePath: {
    initialNotification: ["content-strategist", "account-manager"],
    steps: [
      {
        step: 1,
        label: "Triage and classify",
        description:
          "Content strategist reviews the report, identifies the affected variant " +
          "key(s), and classifies the issue as missing content, wrong content, or " +
          "a serving configuration gap.",
        owner: "content-strategist",
        clientFacing: false,
      },
      {
        step: 2,
        label: "Client acknowledgement",
        description:
          "Account manager acknowledges the issue to the client, confirms it is " +
          "being investigated, and provides an initial timeline.",
        owner: "account-manager",
        clientFacing: true,
      },
      {
        step: 3,
        label: "Diagnose content gap",
        description:
          "Content strategist determines whether the fix requires: updating CMS " +
          "content (client task), updating variant configuration (MC task), or " +
          "raising a content brief for new variant copy.",
        owner: "content-strategist",
        clientFacing: false,
      },
      {
        step: 4,
        label: "Resolve or brief",
        description:
          "If MC-owned: content strategist or platform engineer updates the affected " +
          "variant. If client-owned: content strategist issues a content brief to the " +
          "client's marketing team with clear fields and deadlines.",
        owner: "content-strategist",
        clientFacing: false,
      },
      {
        step: 5,
        label: "Verify content is live",
        description:
          "Confirm the corrected variant is published in CMS and serving correctly " +
          "in the live environment. Check serving logs for the affected variant key.",
        owner: "content-strategist",
        clientFacing: false,
      },
      {
        step: 6,
        label: "Close with client update",
        description:
          "Account manager confirms resolution to the client and notes any action " +
          "items to prevent recurrence (e.g. variant audit, content governance).",
        owner: "account-manager",
        clientFacing: true,
      },
    ],
  },

  escalationPath: [
    {
      step: 1,
      role: "platform-engineer",
      action:
        "Bring in platform engineer if the content issue appears to be caused by " +
        "a variant routing or serving configuration error rather than a content gap.",
      triggers: ["scope-unclear", "no-diagnosis"],
      notifyClient: false,
    },
    {
      step: 2,
      role: "client-marketing",
      action:
        "Chase client marketing team directly if a content brief has been issued " +
        "but not actioned within the agreed deadline.",
      triggers: ["sla-breach", "repeat-occurrence"],
      notifyClient: true,
    },
  ],

  linkedModules: ["adaptive-website", "adaptive-landing-pages"],
  linkedServices: ["content-modeling", "optimisation"],

  toolingNotes: {
    linear:
      "Create in the 'Content' team with label 'Content Issue'. Link to the " +
      "relevant CMS entry and variant key in the issue description. For recurring " +
      "content gaps, link issues to the content-modeling service in the backlog.",
    slack:
      "Client reports typically arrive via #support. Tag the content strategist " +
      "and account manager. Use a thread for diagnosis notes to keep #support clean.",
    automation:
      "Future: variant serving monitor that detects when a variant key resolves " +
      "to the default fallback unexpectedly (i.e. expected variant is missing from CMS). " +
      "Alert threshold: fallback rate >20% for >30 minutes on a non-new page.",
    clientPortal:
      "Future: client can submit content issue reports directly, attaching a " +
      "screenshot and page URL. Pre-fills the tenant and page context automatically.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS: CMS ISSUE
// ─────────────────────────────────────────────────────────────────────────────

export const CMS_ISSUE_PROCESS: SupportProcessDefinition = {
  id: "cms-issue",
  label: "CMS Issue",
  description:
    "A problem with the CMS integration layer — including connectivity failures, " +
    "schema mismatches between the CMS and the platform's expected content model, " +
    "content modelling gaps (missing schemas, incorrect field types), or " +
    "authentication and access errors. CMS issues may block content serving or " +
    "content editing workflows. They often require coordination with the client's " +
    "technical team who manage CMS access credentials and custom field config.",

  defaultSeverity: "high",
  applicableSeverities: ["critical", "high", "medium", "low"],

  slaByServerity: {
    critical: CRITICAL_SLA,
    high: HIGH_SLA,
    medium: MEDIUM_SLA,
    low: LOW_SLA,
  },

  primaryOwner: "platform-engineer",
  defaultParticipants: ["platform-engineer", "account-manager", "client-technical"],

  typicalChannels: ["platform-monitor", "slack-alert", "client-email"],

  triageChecklist: [
    "Confirm which CMS provider is affected (Sanity, Storyblok, Statamic).",
    "Determine whether the issue is authentication, connectivity, or schema-level.",
    "Check whether the CMS API is returning errors or the platform is failing to parse responses.",
    "Identify whether the issue affects one tenant or all tenants on this CMS.",
    "Confirm whether content serving is degraded or if this is an editorial workflow issue.",
    "Establish whether the client's technical team need to be involved for credential or CMS config access.",
  ],

  responsePath: {
    initialNotification: ["platform-engineer", "account-manager"],
    steps: [
      {
        step: 1,
        label: "Triage and isolate",
        description:
          "Platform engineer identifies whether the issue is at the API " +
          "connectivity layer, authentication layer, or schema mapping layer. " +
          "Checks CMS provider status page if connectivity is suspected.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 2,
        label: "Client acknowledgement",
        description:
          "Account manager acknowledges the issue to the client. If the client's " +
          "technical team is likely needed, flag this in the first message.",
        owner: "account-manager",
        clientFacing: true,
      },
      {
        step: 3,
        label: "Engage client technical if needed",
        description:
          "If the issue requires CMS-side access (credential rotation, schema " +
          "changes, webhook configuration), bring in the client's technical team " +
          "with a specific action request and deadline.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 4,
        label: "Implement fix",
        description:
          "Apply the fix at the appropriate layer: update platform CMS adapter, " +
          "correct schema mapping, regenerate credentials, or document a CMS " +
          "configuration change for the client to apply.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 5,
        label: "Verify CMS connectivity and content serving",
        description:
          "Confirm the CMS API is responding correctly, the schema mapping is " +
          "valid, and content is serving as expected in the live environment.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 6,
        label: "Document schema change if applicable",
        description:
          "If the fix involved a schema update, update the CMS integration " +
          "documentation for this tenant. Flag for inclusion in the next content " +
          "modeling service review.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 7,
        label: "Close with client resolution summary",
        description:
          "Account manager sends a resolution summary. Include what changed, " +
          "whether any client-side CMS configuration was updated, and any " +
          "maintenance steps the client should be aware of.",
        owner: "account-manager",
        clientFacing: true,
      },
    ],
  },

  escalationPath: [
    {
      step: 1,
      role: "client-technical",
      action:
        "Escalate to client technical team with a clear, specific request " +
        "(credential rotation, schema change, webhook update). Provide exact " +
        "steps and expected outcome to minimise back-and-forth.",
      triggers: ["external-dependency", "no-diagnosis"],
      notifyClient: true,
    },
    {
      step: 2,
      role: "account-manager",
      action:
        "Escalate client communication if the client technical team is not " +
        "responding within the agreed window. May require escalation to client " +
        "leadership to unblock technical access.",
      triggers: ["sla-breach", "repeat-occurrence"],
      notifyClient: true,
    },
  ],

  linkedModules: ["adaptive-website", "adaptive-landing-pages", "context-intelligence"],
  linkedServices: ["onboarding", "content-modeling"],

  toolingNotes: {
    linear:
      "Create in 'Platform' team with label 'CMS Integration'. Note the CMS provider " +
      "and whether client-technical involvement is required. Link to the tenant " +
      "config record and CMS adapter version.",
    slack:
      "Route to #platform-engineering. If client-technical involvement is needed, " +
      "create a shared Slack channel with the client for coordination (if not already existing).",
    automation:
      "CMS API health checks can run on a 5-minute cron. Failure to fetch any " +
      "live tenant's content schema triggers an automatic 'cms-issue' alert. " +
      "Stale CMS token detection (>90 days since rotation) can surface a low-severity advisory.",
    clientPortal:
      "Future: client technical team can report CMS issues directly via portal, " +
      "with pre-filled CMS provider and tenant fields.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS: TRACKING / DATA ISSUE
// ─────────────────────────────────────────────────────────────────────────────

export const TRACKING_DATA_ISSUE_PROCESS: SupportProcessDefinition = {
  id: "tracking-data-issue",
  label: "Tracking / Data Issue",
  description:
    "A problem with analytics event collection, session tracking, KPI " +
    "calculation, or data pipeline integrity. Tracking issues may cause " +
    "dashboards to show incorrect metrics, missing sessions, or inflated/deflated " +
    "conversion rates. They are often silent — the platform continues serving " +
    "content, but the data used to measure and optimise performance is unreliable. " +
    "Examples: events not firing, incorrect variant attribution, missing UTM " +
    "passthrough, broken session stitching.",

  defaultSeverity: "medium",
  applicableSeverities: ["high", "medium", "low", "advisory"],

  slaByServerity: {
    high: HIGH_SLA,
    medium: MEDIUM_SLA,
    low: LOW_SLA,
    advisory: ADVISORY_SLA,
  },

  primaryOwner: "platform-engineer",
  defaultParticipants: ["platform-engineer", "account-manager"],

  typicalChannels: ["internal-review", "slack-alert", "client-email"],

  triageChecklist: [
    "Identify which analytics event or metric is affected.",
    "Determine the first-seen date and estimated scope of missing/incorrect data.",
    "Check whether the issue is in event firing, data ingestion, or dashboard calculation.",
    "Confirm whether the issue is global or isolated to a specific page type or tenant.",
    "Assess whether historical data is recoverable or if the gap is permanent.",
    "Check for any recent deployment, configuration change, or third-party script update that could have caused the regression.",
  ],

  responsePath: {
    initialNotification: ["platform-engineer", "account-manager"],
    steps: [
      {
        step: 1,
        label: "Identify affected data layer",
        description:
          "Platform engineer traces the issue to the specific layer: event firing " +
          "(client-side tracking script), event ingestion (data pipeline), " +
          "data transformation, or dashboard query.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 2,
        label: "Client acknowledgement",
        description:
          "Account manager notifies the client that a data integrity issue has " +
          "been identified. Clearly state which metrics are affected and that the " +
          "team is investigating. Do not share raw investigation findings.",
        owner: "account-manager",
        clientFacing: true,
      },
      {
        step: 3,
        label: "Implement and deploy fix",
        description:
          "Fix the identified layer: correct event payload, repair pipeline step, " +
          "fix query logic, or update dashboard configuration. Deploy and confirm " +
          "new events are flowing correctly.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 4,
        label: "Assess data recoverability",
        description:
          "Determine whether missing or incorrect historical data can be backfilled " +
          "or corrected. Document the data gap period with start and end timestamps. " +
          "Confirm with account manager before communicating to client.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 5,
        label: "Update client with data quality assessment",
        description:
          "Account manager provides a clear summary: what was wrong, when it was " +
          "fixed, which date range is affected, and whether historical data is " +
          "recoverable. Adjust any in-flight reporting that used affected metrics.",
        owner: "account-manager",
        clientFacing: true,
      },
    ],
  },

  escalationPath: [
    {
      step: 1,
      role: "account-manager",
      action:
        "Escalate client communication proactively if the data gap affects an " +
        "active reporting period or ongoing A/B experiment. Frame clearly for client " +
        "without speculative root cause attribution.",
      triggers: ["client-impact-grows", "sla-breach"],
      notifyClient: true,
    },
    {
      step: 2,
      role: "client-technical",
      action:
        "Bring in client technical team if the issue is traced to a third-party " +
        "tag manager, GTM configuration, or client-side script conflict.",
      triggers: ["external-dependency", "no-diagnosis"],
      notifyClient: true,
    },
  ],

  linkedModules: ["context-intelligence", "adaptive-website"],
  linkedServices: ["optimisation", "strategy"],

  toolingNotes: {
    linear:
      "Create in 'Platform' team with label 'Data Integrity'. Note the affected " +
      "metric(s) and date range in the issue title. Link to the relevant dashboard " +
      "and data pipeline step.",
    slack:
      "Route to #platform-engineering with a mention of the account manager. " +
      "For high-severity issues, post a brief impact statement to #support so " +
      "the full team is aware.",
    automation:
      "Data pipeline health checks should run hourly. Alerts should trigger on: " +
      "zero events in any 30-minute window, >50% drop in session volume vs prior " +
      "7-day average, or NULL variant attribution on >10% of events. Auto-open " +
      "a tracking-data-issue ticket at medium severity.",
    clientPortal:
      "Future: dashboard annotations can flag known data gap periods so clients " +
      "see inline context when reviewing metrics affected by a resolved issue.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS: TENANT CONFIG ISSUE
// ─────────────────────────────────────────────────────────────────────────────

export const TENANT_CONFIG_ISSUE_PROCESS: SupportProcessDefinition = {
  id: "tenant-config-issue",
  label: "Tenant Config Issue",
  description:
    "A misconfiguration in the tenant's platform settings — including feature " +
    "flags, decision rules, theme overrides, block configuration, or page-level " +
    "settings. Tenant config issues cause the platform to behave differently from " +
    "the intended design for that tenant. They are typically low-risk to fix but " +
    "require careful validation to avoid introducing new behaviour regressions. " +
    "Examples: wrong decision rule active, feature flag incorrectly enabled, " +
    "theme colour token not propagating, block config serving wrong variant set.",

  defaultSeverity: "medium",
  applicableSeverities: ["high", "medium", "low"],

  slaByServerity: {
    high: HIGH_SLA,
    medium: MEDIUM_SLA,
    low: LOW_SLA,
  },

  primaryOwner: "platform-engineer",
  defaultParticipants: ["platform-engineer", "account-manager"],

  typicalChannels: ["slack-alert", "client-email", "internal-review"],

  triageChecklist: [
    "Identify the specific config setting(s) that are incorrect.",
    "Confirm the tenant and environment (production vs staging).",
    "Determine whether the misconfiguration was introduced by a recent change or is a pre-existing gap.",
    "Assess the visible impact: is wrong content being served, or is this a background config gap?",
    "Confirm whether a config audit is needed to check for related misconfigurations.",
    "Identify who made the last configuration change and when.",
  ],

  responsePath: {
    initialNotification: ["platform-engineer", "account-manager"],
    steps: [
      {
        step: 1,
        label: "Identify the misconfiguration",
        description:
          "Platform engineer locates the incorrect config value and documents " +
          "the current value, the expected value, and the impact of the discrepancy.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 2,
        label: "Validate intended state",
        description:
          "Confirm with the account manager what the correct configuration " +
          "should be, cross-referencing the onboarding brief, strategy doc, or " +
          "prior client communication. Never assume intended state from context alone.",
        owner: "account-manager",
        clientFacing: false,
      },
      {
        step: 3,
        label: "Apply configuration fix",
        description:
          "Update the config value to the validated correct state. Document " +
          "the change with before/after values and a reference to the source " +
          "of truth used to confirm the intended state.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 4,
        label: "Verify behaviour in production",
        description:
          "Confirm the platform is behaving as expected after the config change. " +
          "Check: variant serving is correct, rules are firing appropriately, " +
          "theme tokens are applying, and no adjacent config is affected.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 5,
        label: "Close and document",
        description:
          "Account manager informs the client of the fix. Platform engineer " +
          "updates the tenant config log. If the misconfiguration was caused by " +
          "a process gap (e.g. no config review step in onboarding), flag for " +
          "process improvement.",
        owner: "account-manager",
        clientFacing: true,
      },
    ],
  },

  escalationPath: [
    {
      step: 1,
      role: "account-manager",
      action:
        "Escalate to account manager for confirmation of intended state when " +
        "the correct configuration cannot be determined from existing documentation.",
      triggers: ["scope-unclear"],
      notifyClient: false,
    },
    {
      step: 2,
      role: "platform-engineer",
      action:
        "Escalate to senior platform engineer if the config change has unexpected " +
        "side effects or if the correct fix requires architectural review.",
      triggers: ["no-diagnosis", "repeat-occurrence"],
      notifyClient: false,
    },
  ],

  linkedModules: ["adaptive-website", "adaptive-landing-pages", "context-intelligence"],
  linkedServices: ["onboarding", "optimisation"],

  toolingNotes: {
    linear:
      "Create in 'Platform' team with label 'Tenant Config'. Include tenant ID " +
      "and the specific config key in the issue title. Link to the relevant " +
      "onboarding or strategy documentation.",
    slack:
      "Route to #platform-engineering. For high-severity config issues affecting " +
      "live variant serving, also post to #support for AM awareness.",
    automation:
      "Future: config validation pipeline that runs on every tenant config change. " +
      "Flags: feature flags enabled without corresponding CMS content, decision rules " +
      "referencing inactive variant keys, theme tokens outside the permitted range.",
    clientPortal:
      "Future: account managers can view and request changes to specific tenant " +
      "config values via the portal, with platform engineer approval workflow.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS: FEATURE REQUEST
// ─────────────────────────────────────────────────────────────────────────────

export const FEATURE_REQUEST_PROCESS: SupportProcessDefinition = {
  id: "feature-request",
  label: "Feature Request",
  description:
    "A request from a client or internal team member for new platform behaviour, " +
    "capability extension, or integration support that does not currently exist. " +
    "Feature requests are not bugs — the platform is working as designed. They " +
    "represent signal about where the roadmap should evolve. All feature requests " +
    "are captured, triaged, and assessed for roadmap fit before any commitment is " +
    "made. Clients should never receive an implied 'yes' without a scoping review.",

  defaultSeverity: "low",
  applicableSeverities: ["low", "advisory"],

  slaByServerity: {
    low: LOW_SLA,
    advisory: ADVISORY_SLA,
  },

  primaryOwner: "account-manager",
  defaultParticipants: ["account-manager", "platform-engineer"],

  typicalChannels: ["client-email", "slack-alert", "internal-review"],

  triageChecklist: [
    "Capture the request in full — what the client wants, why they want it, and what problem it solves.",
    "Confirm whether this is net-new capability or an extension of something that already exists.",
    "Check the product backlog and boundaries documentation to see if this is already planned or explicitly out of scope.",
    "Assess whether the request is platform-level (product decision) or tenant-level (config or content work).",
    "Note whether multiple clients have made similar requests (repeat requests = higher priority signal).",
    "Do not make any commitment to delivery timeline or scope before platform engineer triage.",
  ],

  responsePath: {
    initialNotification: ["account-manager"],
    steps: [
      {
        step: 1,
        label: "Capture and acknowledge",
        description:
          "Account manager captures the full request in writing and acknowledges " +
          "receipt to the client. State clearly that the request will be reviewed " +
          "but make no commitment to timeline or delivery.",
        owner: "account-manager",
        clientFacing: true,
      },
      {
        step: 2,
        label: "Assess against platform boundaries",
        description:
          "Account manager or platform engineer reviews the request against the " +
          "product boundaries documentation. Classify as: already supported (close " +
          "with config guidance), planned (share roadmap intent), conditional " +
          "(requires commercial discussion), or out of scope (decline with reason).",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 3,
        label: "Log in product backlog",
        description:
          "Regardless of classification, log the request in the product backlog " +
          "with client attribution. This creates a signal record even for items " +
          "that will not be built — repeat requests surface priority.",
        owner: "platform-engineer",
        clientFacing: false,
      },
      {
        step: 4,
        label: "Respond to client with classification",
        description:
          "Account manager responds with a clear, honest assessment: whether the " +
          "feature is on the roadmap, requires a scoping conversation, or falls " +
          "outside the platform's scope with an explanation of why.",
        owner: "account-manager",
        clientFacing: true,
      },
      {
        step: 5,
        label: "Commercial scoping if applicable",
        description:
          "For requests that are conditionally in-scope or commercially viable " +
          "add-ons: account manager initiates a scoping conversation. Do not let " +
          "feature requests stall without a clear next step for the client.",
        owner: "account-manager",
        clientFacing: true,
      },
    ],
  },

  escalationPath: [
    {
      step: 1,
      role: "platform-engineer",
      action:
        "Escalate to platform engineer for technical assessment if the account " +
        "manager cannot determine whether the request is within platform scope or " +
        "requires architectural changes.",
      triggers: ["scope-unclear"],
      notifyClient: false,
    },
  ],

  linkedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
    "adaptive-follow-up",
    "context-intelligence",
  ],
  linkedServices: ["strategy", "optimisation"],

  toolingNotes: {
    linear:
      "Create in 'Product' team with label 'Feature Request'. Tag with the " +
      "requesting client's name. If multiple clients have raised the same request, " +
      "link them to the same Linear issue and note the cumulative signal. " +
      "Priority reflects frequency and strategic alignment, not urgency.",
    slack:
      "Route to #product-feedback. Monthly review of the #product-feedback " +
      "backlog by the account team should surface recurring themes for roadmap " +
      "discussion.",
    clientPortal:
      "Future: dedicated feature request form in the client portal. Clients can " +
      "submit requests with structured fields (problem statement, desired outcome, " +
      "frequency of need). Submitted requests feed directly into the product backlog " +
      "with client attribution preserved.",
    automation:
      "Future: automatically link duplicate feature requests using semantic " +
      "similarity matching. Surface 'this has been requested N times before' " +
      "signal to the platform engineer during triage.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All six support process definitions, indexed by SupportProcessTypeId.
 *
 * @example
 *   import { SUPPORT_PROCESS_CATALOG } from "@/support";
 *   const process = SUPPORT_PROCESS_CATALOG["incident"];
 *   const owner = process.primaryOwner;
 *   const sla = process.slaByServerity["critical"];
 */
export const SUPPORT_PROCESS_CATALOG: SupportProcessCatalog = {
  "incident":             INCIDENT_PROCESS,
  "content-issue":        CONTENT_ISSUE_PROCESS,
  "cms-issue":            CMS_ISSUE_PROCESS,
  "tracking-data-issue":  TRACKING_DATA_ISSUE_PROCESS,
  "tenant-config-issue":  TENANT_CONFIG_ISSUE_PROCESS,
  "feature-request":      FEATURE_REQUEST_PROCESS,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a process definition by its type ID.
 *
 * @example
 *   const def = getSupportProcess("cms-issue");
 */
export function getSupportProcess(
  typeId: SupportProcessTypeId
): SupportProcessDefinition {
  return SUPPORT_PROCESS_CATALOG[typeId];
}

/**
 * Get all process definitions ordered by default severity (critical first).
 */
export function getProcessesBySeverity(): readonly SupportProcessDefinition[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    advisory: 4,
  };

  return Object.values(SUPPORT_PROCESS_CATALOG).sort(
    (a, b) =>
      (severityOrder[a.defaultSeverity] ?? 99) -
      (severityOrder[b.defaultSeverity] ?? 99)
  );
}

/**
 * Get all process definitions for which the given role is the primary owner.
 */
export function getProcessesOwnedBy(
  role: SupportProcessDefinition["primaryOwner"]
): readonly SupportProcessDefinition[] {
  return Object.values(SUPPORT_PROCESS_CATALOG).filter(
    (p) => p.primaryOwner === role
  );
}

/**
 * Get the SLA for a given process type and severity.
 *
 * Returns undefined if the severity is not applicable to this process type.
 *
 * @example
 *   const sla = getProcessSLA("incident", "critical");
 *   console.log(sla?.firstResponseHours); // 1
 */
export function getProcessSLA(
  typeId: SupportProcessTypeId,
  severity: import("./types").SupportSeverity
): ResponseSLA | undefined {
  return SUPPORT_PROCESS_CATALOG[typeId].slaByServerity[severity];
}

/**
 * Get all process types that a given channel is the primary channel for.
 */
export function getProcessesForChannel(
  channel: import("./types").SupportChannelId
): readonly SupportProcessDefinition[] {
  return Object.values(SUPPORT_PROCESS_CATALOG).filter((p) =>
    p.typicalChannels[0] === channel
  );
}

/**
 * Get all process types that list a given module as linked.
 */
export function getProcessesForModule(
  moduleId: import("@/product/types").ProductModuleId
): readonly SupportProcessDefinition[] {
  return Object.values(SUPPORT_PROCESS_CATALOG).filter((p) =>
    (p.linkedModules as readonly string[]).includes(moduleId)
  );
}
