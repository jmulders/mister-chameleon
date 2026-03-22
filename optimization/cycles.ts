/**
 * Optimization Cycle Definitions
 *
 * The four concrete optimization cycles that make up the Mister Chameleon
 * recurring service model. Each cycle is a complete, self-contained playbook
 * for a specific type of review or improvement activity.
 *
 * ─── Four cycles ─────────────────────────────────────────────────────────────
 *
 *   MONTHLY_PERFORMANCE_REVIEW    Monthly. Core delivery rhythm. Data → actions.
 *   QUARTERLY_STRATEGY_REVIEW     Quarterly. Trends → direction + QBR.
 *   EXPERIMENT_REVIEW             Triggered. A/B test conclusion → variant decision.
 *   CONTENT_REFRESH               Triggered or monthly. Staleness → updated variants.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { OPTIMIZATION_CATALOG, getCycle } from "@/optimization";
 *   import { MONTHLY_PERFORMANCE_REVIEW }     from "@/optimization";
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   optimization/types.ts   — all type definitions
 *   optimization/cycles.ts  ← YOU ARE HERE — four cycle definitions + catalog
 *   optimization/index.ts   — barrel re-export
 */

import type {
  OptimizationCycle,
  OptimizationCatalog,
  CycleSummary,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY PERFORMANCE REVIEW
// ─────────────────────────────────────────────────────────────────────────────

export const MONTHLY_PERFORMANCE_REVIEW: OptimizationCycle = {
  id: "monthly-performance-review",
  name: "Monthly Performance Review",
  tagline: "Turn last month's platform data into this month's improvements.",
  description:
    "The core delivery rhythm of the Mister Chameleon service model. Every month, " +
    "the account manager pulls platform metrics, assembles the client report, runs a " +
    "structured review session, and closes with a prioritised action backlog. The goal " +
    "is not to produce a document — it is to make at least one concrete improvement to " +
    "variant content, rule configuration, or experiment design before the next review.",

  // ── Scheduling ──────────────────────────────────────────────────────────────

  cadence: "monthly",
  annualFrequency: 12,
  typicalDuration: "2–3 hours (preparation + session + action capture)",
  triggers: ["calendar"],

  // ── People ──────────────────────────────────────────────────────────────────

  roles: [
    {
      role: "account-manager",
      label: "Account Manager (MC)",
      responsibilities: [
        "Owns the cycle end-to-end — schedules, runs, and follows through on the session",
        "Pulls the monthly report from the dashboard before the session",
        "Facilitates the review conversation and ensures at least one action owner is named",
        "Sends the report and action backlog to the client within 24 hours of the session",
      ],
      timeCommitment: "~2 hours per month (30 min prep, 60 min session, 30 min wrap-up)",
      optional: false,
    },
    {
      role: "platform-engineer",
      label: "Platform Engineer (MC)",
      responsibilities: [
        "Implements approved rule and variant changes following the review",
        "Available async to unblock data or integration questions during preparation",
      ],
      timeCommitment: "~1 hour per month (async implementation, not in session unless needed)",
      optional: true,
    },
    {
      role: "client-marketing",
      label: "Client Marketing Lead",
      responsibilities: [
        "Attends the review session and represents the client's content perspective",
        "Takes ownership of content action items arising from the review",
        "Provides context on campaigns or seasonal factors affecting performance",
      ],
      timeCommitment: "~1 hour per month (session attendance + async action follow-through)",
      optional: false,
    },
  ],

  // ── Inputs ──────────────────────────────────────────────────────────────────

  requiredInputs: [
    {
      id: "monthly-report",
      label: "Monthly Performance Report",
      description:
        "The assembled client report for the prior calendar month. Generated from " +
        "assembleReport() using live analytics data. Pull from the reporting preview " +
        "dashboard the day before the session to capture the full month.",
      type: "report",
      required: true,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/reporting-preview",
      linkedReportSection: "summary",
    },
    {
      id: "variant-performance",
      label: "Variant Performance Breakdown",
      description:
        "Per-slot, per-variant CTR and serve-share data for the review period. " +
        "Identifies which variants are winning, stagnating, or dragging performance.",
      type: "variant-data",
      required: true,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/variants",
      linkedReportSection: "variant-performance",
      linkedKpiIds: ["adaptive-cta-click-rate", "landing-cta-click-rate"],
    },
    {
      id: "kpi-snapshot",
      label: "Current KPI Snapshot",
      description:
        "Point-in-time values for the primary KPIs configured for this tenant's use case. " +
        "Used to assess whether performance is on track against targets.",
      type: "kpi-snapshot",
      required: true,
      source: "platform-data",
      linkedDashboardPath: "/dashboard",
      linkedReportSection: "conversion-metrics",
      linkedKpiIds: [
        "adaptive-personalisation-coverage",
        "adaptive-cta-click-rate",
        "landing-cta-click-rate",
        "followup-submission-rate",
      ],
    },
    {
      id: "prior-action-backlog",
      label: "Prior Month Action Backlog",
      description:
        "The list of actions agreed at the previous review, with completion status. " +
        "Opens the session by closing the loop — what was done, what wasn't, and why.",
      type: "action-backlog",
      required: false,
      source: "internal-analysis",
    },
    {
      id: "ai-rules-insights",
      label: "AI vs Rules Engine Breakdown",
      description:
        "Decision engine composition data showing how often AI vs. rules are driving " +
        "variant selection. Flags over-reliance on a single engine type.",
      type: "variant-data",
      required: false,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/reporting-preview",
      linkedReportSection: "ai-rules-insights",
    },
  ],

  // ── Outputs ─────────────────────────────────────────────────────────────────

  outputs: [
    {
      id: "monthly-client-report",
      label: "Monthly Performance Report (Client)",
      description:
        "The formatted report delivered to the client after the session. Covers " +
        "all six standard sections: summary, context segments, variant performance, " +
        "conversion metrics, engine insights, and recommendations.",
      type: "report",
      owner: "account-manager",
      isClientDeliverable: true,
      linkedReportTemplateId: "default-client-report",
      linkedServiceOfferingId: "optimisation",
    },
    {
      id: "action-plan",
      label: "Action Backlog",
      description:
        "A prioritised list of 3–6 concrete actions agreed during the session, " +
        "each with a named owner and a due date. Carried forward to the next review.",
      type: "action-plan",
      owner: "account-manager",
      isClientDeliverable: true,
      linkedServiceOfferingId: "optimisation",
    },
    {
      id: "variant-update",
      label: "Variant or Rule Update (if applicable)",
      description:
        "Any immediate platform change agreed during the session — a variant edit, " +
        "a new variant upload, or a rule adjustment. Implemented by the engineer " +
        "within 48 hours of the session.",
      type: "variant-update",
      owner: "platform-engineer",
      isClientDeliverable: false,
      linkedServiceOfferingId: "optimisation",
    },
  ],

  // ── Phases ──────────────────────────────────────────────────────────────────

  phases: [
    {
      id: "preparation",
      label: "Data Preparation",
      description:
        "The account manager pulls all required inputs before the session. This is " +
        "solo preparation — not a meeting. The goal is to arrive at the review session " +
        "with a clear hypothesis about what drove performance and what to change.",
      order: 1,
      estimatedDuration: "30–45 minutes",
      primaryRole: "account-manager",
      supportingRoles: ["platform-engineer"],
      consumedInputIds: ["monthly-report", "variant-performance", "kpi-snapshot", "prior-action-backlog"],
      producedOutputIds: [],
      checklist: [
        "Open the reporting preview at /dashboard/reporting-preview and confirm it covers the prior month",
        "Identify the 2–3 highest-impact findings (best variant, worst variant, coverage gap, missed KPI)",
        "Check the prior action backlog — note which items are complete, in progress, or stalled",
        "Flag any anomalies in the data that require context from the client (campaign, seasonal, technical)",
        "Draft 3–5 agenda items for the session in order of priority",
      ],
    },
    {
      id: "review-session",
      label: "Review Session",
      description:
        "A 45–60 minute structured meeting with the client marketing lead. Walk through " +
        "the report findings, close the loop on prior actions, and agree on this month's " +
        "priorities. The session should end with a named action owner for every item.",
      order: 2,
      estimatedDuration: "45–60 minutes",
      primaryRole: "account-manager",
      supportingRoles: ["client-marketing", "platform-engineer"],
      consumedInputIds: ["monthly-report", "prior-action-backlog", "ai-rules-insights"],
      producedOutputIds: ["action-plan"],
      checklist: [
        "Open with: 'Last month we agreed to...' — review each prior action item",
        "Present the summary section: overall CTR trend, best-performing source, coverage rate",
        "Review variant performance: name the winning and underperforming variant in each slot",
        "Discuss the engine insights: is the AI or rules engine over-concentrated?",
        "Review the top 3 recommendations from the report and agree on which to action",
        "Assign a named owner and due date for every action item before ending the call",
        "Note any client context that should inform the next report (campaigns, product launches)",
      ],
    },
    {
      id: "output-delivery",
      label: "Output Delivery",
      description:
        "Post-session wrap-up. The account manager sends the report and action backlog, " +
        "and the engineer implements any immediate platform changes. Done within 24–48 hours.",
      order: 3,
      estimatedDuration: "30 minutes (AM) + up to 2 hours (Engineer if changes needed)",
      primaryRole: "account-manager",
      supportingRoles: ["platform-engineer"],
      consumedInputIds: [],
      producedOutputIds: ["monthly-client-report", "variant-update"],
      checklist: [
        "Send the monthly report and action backlog to the client contact within 24 hours",
        "Update the internal action tracking log with agreed items and owners",
        "Brief the platform engineer on any rule or variant changes approved in the session",
        "Confirm engineer implementation within 48 hours and notify the client when live",
        "Schedule the next monthly review session before closing out this cycle",
      ],
    },
  ],

  // ── Connections ─────────────────────────────────────────────────────────────

  linkedDashboards: [
    {
      label: "Reporting Preview",
      path: "/dashboard/reporting-preview",
      description: "Primary data source for the monthly report. Pull this the day before the session.",
    },
    {
      label: "Variants",
      path: "/dashboard/variants",
      description: "Drill into per-slot variant performance. Used to identify underperforming variants.",
    },
    {
      label: "Sessions",
      path: "/dashboard/sessions",
      description: "Session volume and source breakdown. Confirms the data volume is sufficient.",
    },
    {
      label: "Content Status",
      path: "/dashboard/content-status",
      description: "Identifies stale or missing variants ahead of the review session.",
    },
  ],

  linkedReportSections: [
    "summary",
    "context-segments",
    "variant-performance",
    "conversion-metrics",
    "ai-rules-insights",
    "recommendations",
  ],

  linkedKpiIds: [
    "adaptive-cta-click-rate",
    "adaptive-personalisation-coverage",
    "adaptive-source-rule-alignment",
    "landing-cta-click-rate",
    "landing-variant-diversity",
    "followup-submission-rate",
  ],

  linkedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
    "adaptive-follow-up",
  ],

  linkedServiceOfferingId: "optimisation",

  // ── Quality gates ────────────────────────────────────────────────────────────

  successCriteria: [
    "Client has received the monthly report and confirmed receipt",
    "At least one recommendation has a named owner and a due date",
    "The action backlog is updated and ready for the next session's opening review",
    "Any approved platform changes are implemented and verified within 48 hours",
  ],

  escalationConditions: [
    "CTA click rate drops more than 20% month-over-month with no identifiable external cause",
    "Personalisation coverage falls below 60% — rule configuration likely broken",
    "Client misses two consecutive sessions — relationship risk, escalate to leadership",
    "No content or rule changes have been made in 3 consecutive monthly cycles",
  ],

  // ── Operating guidance ───────────────────────────────────────────────────────

  operatingNotes:
    "The most common failure mode is treating the monthly review as a reporting exercise " +
    "rather than a decision-making session. Sending the report is not the same as running " +
    "the cycle. The cycle only succeeds when at least one concrete change is agreed and " +
    "implemented before the next review.\n\n" +
    "For clients with low session volume (< 200 sessions in the month), lead with the " +
    "trend across the last 3 months rather than the single-month snapshot. Thin data is " +
    "not a reason to skip the session — it is a reason to focus on content quality over " +
    "statistical performance.\n\n" +
    "If the client cancels or is unavailable, do not skip the cycle. Run the preparation " +
    "phase solo, document the key findings, and send a short written summary with the " +
    "report attached. Preserve the session frequency even when the format varies.",
};

// ─────────────────────────────────────────────────────────────────────────────
// QUARTERLY STRATEGY REVIEW
// ─────────────────────────────────────────────────────────────────────────────

export const QUARTERLY_STRATEGY_REVIEW: OptimizationCycle = {
  id: "quarterly-strategy-review",
  name: "Quarterly Strategy Review",
  tagline: "Zoom out. Set direction. Align on what the next quarter should achieve.",
  description:
    "The QBR equivalent for Mister Chameleon engagements. Where the monthly review " +
    "focuses on last month's data and near-term actions, the quarterly review zooms out " +
    "to examine 90-day trends, assess the variant and content strategy, and set KPI " +
    "targets and priorities for the next quarter. Client leadership participates. " +
    "The output is a strategic direction document, not just an action list.",

  // ── Scheduling ──────────────────────────────────────────────────────────────

  cadence: "quarterly",
  annualFrequency: 4,
  typicalDuration: "Half-day (3–4 hours preparation + 90-minute session)",
  triggers: ["calendar"],

  // ── People ──────────────────────────────────────────────────────────────────

  roles: [
    {
      role: "account-manager",
      label: "Account Manager (MC)",
      responsibilities: [
        "Leads the session and owns the strategy memo output",
        "Prepares the 90-day trend narrative before the session",
        "Facilitates alignment between client leadership and the MC team on priorities",
        "Sets revised KPI targets for the next quarter",
      ],
      timeCommitment: "~4 hours per quarter (2 hr prep, 90 min session, 30 min wrap-up)",
      optional: false,
    },
    {
      role: "platform-engineer",
      label: "Platform Engineer (MC)",
      responsibilities: [
        "Prepares the technical performance summary — experiment results, engine health",
        "Advises on what is technically feasible for the next quarter's planned experiments",
        "Attends the session to field technical questions from client leadership",
      ],
      timeCommitment: "~2 hours per quarter (30 min prep, 90 min session attendance)",
      optional: false,
    },
    {
      role: "content-strategist",
      label: "Content Strategist (MC)",
      responsibilities: [
        "Leads the variant content strategy assessment",
        "Identifies content gaps, refresh candidates, and new variant opportunities",
        "Briefs client marketing on content priorities for the next quarter",
      ],
      timeCommitment: "~2 hours per quarter (1 hr prep, 90 min session attendance)",
      optional: true,
    },
    {
      role: "client-leadership",
      label: "Client Leadership (GM, CMO, or Founder)",
      responsibilities: [
        "Sets business priorities and constraints for the next quarter",
        "Approves the KPI targets and strategic direction",
        "Provides context on upcoming campaigns, product launches, or market shifts",
      ],
      timeCommitment: "~90 minutes per quarter (session attendance only)",
      optional: false,
    },
    {
      role: "client-marketing",
      label: "Client Marketing Lead",
      responsibilities: [
        "Attends the session and represents day-to-day content and campaign context",
        "Takes ownership of content priorities emerging from the strategy review",
      ],
      timeCommitment: "~2 hours per quarter (light prep + session attendance)",
      optional: false,
    },
  ],

  // ── Inputs ──────────────────────────────────────────────────────────────────

  requiredInputs: [
    {
      id: "quarterly-report",
      label: "90-Day Performance Report",
      description:
        "A report covering the full prior quarter — three months of data assembled " +
        "into a single view. Run assembleReport() with a 90-day period window. " +
        "This is the primary analytical input for the strategy session.",
      type: "report",
      required: true,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/reporting-preview",
      linkedReportSection: "summary",
    },
    {
      id: "quarterly-variant-trends",
      label: "Quarterly Variant Trend Data",
      description:
        "Variant performance across the full quarter — which variants improved, " +
        "which declined, and whether serve-share distribution is healthy. Identifies " +
        "content strategy patterns not visible in a single month.",
      type: "variant-data",
      required: true,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/variants",
      linkedReportSection: "variant-performance",
      linkedKpiIds: ["adaptive-cta-click-rate", "landing-cta-click-rate", "landing-variant-diversity"],
    },
    {
      id: "kpi-target-review",
      label: "Prior Quarter KPI Targets vs. Actuals",
      description:
        "The KPI targets set at the start of the quarter compared to actual achieved " +
        "values. Drives the conversation about whether targets were realistic and what " +
        "the next quarter's targets should be.",
      type: "kpi-snapshot",
      required: true,
      source: "internal-analysis",
      linkedKpiIds: [
        "adaptive-cta-click-rate",
        "adaptive-personalisation-coverage",
        "landing-cta-click-rate",
        "landing-campaign-conversion-rate",
        "followup-submission-rate",
        "followup-pipeline-conversion-rate",
      ],
    },
    {
      id: "experiment-log",
      label: "Experiment Log (Quarter)",
      description:
        "Summary of all A/B experiments run in the quarter — which concluded, which " +
        "are still running, and what decisions were made. Grounds the strategy conversation " +
        "in the actual learning cadence.",
      type: "experiment-data",
      required: false,
      source: "internal-analysis",
      linkedReportSection: "ai-rules-insights",
    },
    {
      id: "client-brief-quarterly",
      label: "Client Business Brief",
      description:
        "Client-provided context on business priorities, upcoming campaigns, new " +
        "products, or market changes that should shape the next quarter's variant strategy.",
      type: "client-brief",
      required: false,
      source: "client",
    },
    {
      id: "prior-quarter-actions",
      label: "Quarterly Action Backlog Status",
      description:
        "All action items from the three monthly reviews in the prior quarter — what " +
        "was actioned, what was deferred, and what remains outstanding. The QBR is the " +
        "definitive closure point for outstanding items.",
      type: "action-backlog",
      required: true,
      source: "internal-analysis",
    },
  ],

  // ── Outputs ─────────────────────────────────────────────────────────────────

  outputs: [
    {
      id: "strategy-memo",
      label: "Quarterly Strategy Memo",
      description:
        "A concise written document capturing the strategic direction agreed for " +
        "the next quarter: priorities, content focus areas, experiment plan, and " +
        "any platform configuration changes. 1–2 pages. Shared with client leadership.",
      type: "strategy-memo",
      owner: "account-manager",
      isClientDeliverable: true,
      linkedServiceOfferingId: "strategy",
    },
    {
      id: "kpi-targets",
      label: "Next Quarter KPI Targets",
      description:
        "Agreed performance targets for the next quarter's primary KPIs. " +
        "Sets the benchmark against which the next QBR will evaluate success.",
      type: "kpi-target-revision",
      owner: "account-manager",
      isClientDeliverable: true,
      linkedServiceOfferingId: "strategy",
    },
    {
      id: "experiment-briefs",
      label: "Experiment Brief(s)",
      description:
        "Specifications for the 1–2 A/B experiments planned for the next quarter, " +
        "including hypothesis, variant keys, minimum session count, and success metric.",
      type: "experiment-brief",
      owner: "platform-engineer",
      isClientDeliverable: false,
      linkedServiceOfferingId: "optimisation",
    },
    {
      id: "content-brief-quarterly",
      label: "Content Priorities Brief",
      description:
        "Instructions for the client on which variant slots to refresh, which new " +
        "content themes to develop, and what quality bar each variant should meet.",
      type: "content-brief",
      owner: "content-strategist",
      isClientDeliverable: true,
      linkedServiceOfferingId: "content-modeling",
    },
    {
      id: "quarterly-report-deliverable",
      label: "Quarterly Performance Report (Client)",
      description:
        "The 90-day report formatted for client-facing delivery. Accompanies the " +
        "strategy memo as a data foundation for the strategic discussion.",
      type: "report",
      owner: "account-manager",
      isClientDeliverable: true,
      linkedReportTemplateId: "default-client-report",
      linkedServiceOfferingId: "optimisation",
    },
  ],

  // ── Phases ──────────────────────────────────────────────────────────────────

  phases: [
    {
      id: "pre-qbr-analysis",
      label: "Pre-QBR Analysis",
      description:
        "Deep preparation phase done 2–3 days before the session. The MC team assembles " +
        "the 90-day report, reviews the experiment log, evaluates KPI attainment, and drafts " +
        "the strategic recommendations that will anchor the session.",
      order: 1,
      estimatedDuration: "2–3 hours",
      primaryRole: "account-manager",
      supportingRoles: ["platform-engineer", "content-strategist"],
      consumedInputIds: [
        "quarterly-report",
        "quarterly-variant-trends",
        "kpi-target-review",
        "experiment-log",
        "prior-quarter-actions",
      ],
      producedOutputIds: [],
      checklist: [
        "Assemble the 90-day performance report using the reporting preview",
        "Document KPI attainment: for each primary KPI, note actual vs. target and the delta",
        "Identify the top 3 strategic findings — patterns that go beyond any single month",
        "Review all experiments run in the quarter — which concluded, which are inconclusive",
        "Close out all outstanding monthly action items and note any that warrant QBR discussion",
        "Draft the next quarter's proposed KPI targets based on trend trajectory",
        "Prepare 2–3 strategic questions to put to client leadership in the session",
      ],
    },
    {
      id: "strategy-session",
      label: "Quarterly Strategy Session",
      description:
        "A 90-minute structured meeting with the full engagement team including client " +
        "leadership. Reviews the 90-day performance narrative, closes the prior quarter, " +
        "and sets strategic direction for the next 90 days.",
      order: 2,
      estimatedDuration: "90 minutes",
      primaryRole: "account-manager",
      supportingRoles: ["platform-engineer", "content-strategist", "client-leadership", "client-marketing"],
      consumedInputIds: [
        "quarterly-report",
        "client-brief-quarterly",
        "kpi-target-review",
        "prior-quarter-actions",
      ],
      producedOutputIds: ["kpi-targets"],
      checklist: [
        "Open with a 90-day performance narrative — context first, then numbers",
        "Close the prior quarter: review all outstanding actions, declare them done or deferred",
        "Present the top 3 strategic findings and invite client leadership to respond",
        "Discuss the next quarter's priorities — what should the platform be optimised for?",
        "Agree on KPI targets for the next quarter, with explicit rationale for each",
        "Agree on 1–2 experiments to run next quarter, with hypotheses clearly stated",
        "Identify content gaps and agree on the content priority brief",
        "Confirm the monthly review schedule for the next quarter before ending",
      ],
    },
    {
      id: "post-qbr-delivery",
      label: "Post-QBR Delivery",
      description:
        "The account manager writes and distributes the strategy memo within 48 hours " +
        "of the session. The engineer briefs on any experiment setup required. " +
        "The content strategist delivers the content brief to the client.",
      order: 3,
      estimatedDuration: "3–5 business days",
      primaryRole: "account-manager",
      supportingRoles: ["platform-engineer", "content-strategist"],
      consumedInputIds: [],
      producedOutputIds: [
        "strategy-memo",
        "experiment-briefs",
        "content-brief-quarterly",
        "quarterly-report-deliverable",
      ],
      checklist: [
        "Write the strategy memo: priorities, content focus, experiment plan, configuration changes",
        "Send the strategy memo and 90-day report to the client within 48 hours",
        "Hand off the experiment brief(s) to the platform engineer",
        "Send the content priorities brief to the client marketing lead",
        "Update internal KPI target tracking with the agreed next-quarter targets",
        "Confirm the next QBR date in the calendar before closing out",
      ],
    },
  ],

  // ── Connections ─────────────────────────────────────────────────────────────

  linkedDashboards: [
    {
      label: "Reporting Preview",
      path: "/dashboard/reporting-preview",
      description:
        "Run with a 90-day window to generate the quarterly report. The primary " +
        "analytical foundation for the strategy session.",
    },
    {
      label: "Variants",
      path: "/dashboard/variants",
      description:
        "90-day variant trend view. Used to identify strategy-level patterns — " +
        "not just last month's winners but the content themes that consistently outperform.",
    },
    {
      label: "Sessions",
      path: "/dashboard/sessions",
      description:
        "Quarterly session volume and source mix. Confirms whether ICP targeting " +
        "is improving and whether source rules are aligned with business goals.",
    },
    {
      label: "Overview",
      path: "/dashboard",
      description:
        "High-level platform health snapshot for the opening context of the session.",
    },
  ],

  linkedReportSections: [
    "summary",
    "context-segments",
    "variant-performance",
    "conversion-metrics",
    "ai-rules-insights",
    "recommendations",
  ],

  linkedKpiIds: [
    "adaptive-cta-click-rate",
    "adaptive-personalisation-coverage",
    "adaptive-source-rule-alignment",
    "adaptive-return-visit-rate",
    "landing-cta-click-rate",
    "landing-variant-diversity",
    "landing-campaign-conversion-rate",
    "followup-submission-rate",
    "followup-pipeline-conversion-rate",
  ],

  linkedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
    "adaptive-follow-up",
    "context-intelligence",
  ],

  linkedServiceOfferingId: "strategy",

  // ── Quality gates ────────────────────────────────────────────────────────────

  successCriteria: [
    "Client leadership has approved the next quarter's KPI targets",
    "The strategy memo has been sent and acknowledged by the client",
    "At least one experiment brief is documented and handed to the engineer",
    "The content priorities brief has been sent to the client marketing lead",
    "All prior-quarter action items are explicitly closed or formally deferred",
  ],

  escalationConditions: [
    "Primary KPI misses target by more than 30% with no identifiable cause — requires deeper diagnostic",
    "Client leadership expresses dissatisfaction with the platform value — escalate to MC leadership",
    "The platform has not driven a measurable conversion improvement in two consecutive quarters",
    "Client has not produced any new variant content in the quarter — content debt is accumulating",
  ],

  // ── Operating guidance ───────────────────────────────────────────────────────

  operatingNotes:
    "The QBR is the highest-leverage session in the engagement model — client leadership " +
    "is in the room, and the decisions made here set the direction for the next 90 days. " +
    "Resist the temptation to turn it into a longer version of the monthly review. The " +
    "session should spend less time on last month's data and more time on: what are we " +
    "learning over time, and what does that mean for strategy?\n\n" +
    "Lead the narrative, not the data. Present findings as a story ('What we saw was..., " +
    "which tells us...') rather than a slideshow of charts. Client leadership engages with " +
    "narrative far more than metric tables.\n\n" +
    "The KPI target conversation is often the most valuable part. Push back on targets that " +
    "are set too low (sandbagging) or too high (unrealistic). The right target is one that " +
    "requires deliberate effort to hit but is achievable with the planned improvements.\n\n" +
    "If the client has not engaged with the monthly reviews between QBRs, do not paper " +
    "over the gap. Name it explicitly: 'We noticed the monthly cadence dropped off — " +
    "let's agree how to protect it next quarter.'",
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIMENT REVIEW
// ─────────────────────────────────────────────────────────────────────────────

export const EXPERIMENT_REVIEW: OptimizationCycle = {
  id: "experiment-review",
  name: "Experiment Review",
  tagline: "A test concluded. Make the call: ship it, kill it, or iterate.",
  description:
    "Triggered whenever an A/B experiment meets its minimum session count and duration " +
    "requirements. The experiment review is a focused, fast-turnaround cycle — its sole " +
    "purpose is to evaluate the test results and make a clear variant decision: promote " +
    "the winner, retire the loser, or run a follow-up test. This is where the platform's " +
    "data becomes a permanent improvement.",

  // ── Scheduling ──────────────────────────────────────────────────────────────

  cadence: "triggered",
  annualFrequency: "variable",
  typicalDuration: "1–2 hours (review + decision + implementation)",
  triggers: ["experiment-concluded"],

  // ── People ──────────────────────────────────────────────────────────────────

  roles: [
    {
      role: "account-manager",
      label: "Account Manager (MC)",
      responsibilities: [
        "Receives the experiment conclusion signal and initiates the review",
        "Presents the experiment results to the client and facilitates the decision",
        "Documents the decision and rationale in the learnings log",
      ],
      timeCommitment: "~1 hour per experiment (async review + 30-min decision call)",
      optional: false,
    },
    {
      role: "platform-engineer",
      label: "Platform Engineer (MC)",
      responsibilities: [
        "Validates the experiment data quality — confirms sufficient sessions and clean split",
        "Implements the approved variant decision (promotion, retirement, or config update)",
        "Sets up the follow-up experiment if one is agreed",
      ],
      timeCommitment: "~1 hour per experiment (data validation + implementation)",
      optional: false,
    },
    {
      role: "client-marketing",
      label: "Client Marketing Lead",
      responsibilities: [
        "Reviews the experiment results and provides business context for the decision",
        "Produces replacement content if the losing variant is retired",
      ],
      timeCommitment: "~30 minutes per experiment (async review + decision call)",
      optional: false,
    },
  ],

  // ── Inputs ──────────────────────────────────────────────────────────────────

  requiredInputs: [
    {
      id: "experiment-results",
      label: "Experiment Results Data",
      description:
        "Per-bucket CTR, session counts, and confidence metrics for the concluded " +
        "experiment. Must have at least 100 sessions per bucket and run for at least " +
        "7 days to be considered statistically informative.",
      type: "experiment-data",
      required: true,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/variants",
      linkedReportSection: "variant-performance",
      linkedKpiIds: ["adaptive-cta-click-rate", "landing-cta-click-rate"],
    },
    {
      id: "experiment-hypothesis",
      label: "Original Experiment Hypothesis",
      description:
        "The documented hypothesis and success criteria agreed when the experiment " +
        "was set up. Grounds the evaluation — the question is not 'which variant won?' " +
        "but 'did it win on the metric we said mattered?'",
      type: "experiment-data",
      required: true,
      source: "internal-analysis",
    },
    {
      id: "variant-content-inventory",
      label: "Current Variant Content State",
      description:
        "The CMS state for the variants involved in the experiment — confirms what " +
        "content exists, what keys are valid, and what a promotion or retirement " +
        "would affect downstream.",
      type: "content-inventory",
      required: false,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/content-status",
    },
  ],

  // ── Outputs ─────────────────────────────────────────────────────────────────

  outputs: [
    {
      id: "variant-decision",
      label: "Variant Decision (Promote / Retire / Iterate)",
      description:
        "A clear, documented decision for each variant in the experiment: promote to " +
        "default, retire from the platform, or iterate with a follow-up test.",
      type: "variant-update",
      owner: "platform-engineer",
      isClientDeliverable: false,
      linkedServiceOfferingId: "optimisation",
    },
    {
      id: "learnings-log-entry",
      label: "Learnings Log Entry",
      description:
        "A brief written record of the experiment: what was tested, what was found, " +
        "what decision was made, and what hypothesis this invalidates or confirms. " +
        "Feeds the organisation's growing knowledge base.",
      type: "learnings-log",
      owner: "account-manager",
      isClientDeliverable: true,
      linkedServiceOfferingId: "optimisation",
    },
    {
      id: "follow-up-experiment-brief",
      label: "Follow-up Experiment Brief (if applicable)",
      description:
        "If the experiment is inconclusive or opens a new question, a brief for the " +
        "next test. Keeps the learning velocity high rather than leaving unresolved " +
        "questions dormant.",
      type: "experiment-brief",
      owner: "platform-engineer",
      isClientDeliverable: false,
      linkedServiceOfferingId: "optimisation",
    },
  ],

  // ── Phases ──────────────────────────────────────────────────────────────────

  phases: [
    {
      id: "results-validation",
      label: "Results Validation",
      description:
        "Before evaluating the outcome, validate that the experiment is trustworthy. " +
        "Confirm session counts, split integrity, and duration minimums. A result from " +
        "a poorly run experiment should not drive a variant decision.",
      order: 1,
      estimatedDuration: "20–30 minutes",
      primaryRole: "platform-engineer",
      supportingRoles: ["account-manager"],
      consumedInputIds: ["experiment-results", "experiment-hypothesis"],
      producedOutputIds: [],
      checklist: [
        "Confirm each bucket has at least 100 sessions (ideally 200+)",
        "Confirm the experiment ran for at least 7 calendar days",
        "Verify the traffic split was consistent — no mid-experiment rule changes",
        "Check for Simpson's paradox risk: do results hold across major source segments?",
        "Note the observed lift: bucket A vs. bucket B CTR delta, and the direction",
        "If data is insufficient, flag as inconclusive and do not escalate to a decision call",
      ],
    },
    {
      id: "decision-call",
      label: "Decision Call",
      description:
        "A 30-minute call with the account manager and client marketing lead. Present " +
        "the results against the original hypothesis and make a clear decision. " +
        "The call should end with a named action owner and a delivery date.",
      order: 2,
      estimatedDuration: "30 minutes",
      primaryRole: "account-manager",
      supportingRoles: ["client-marketing", "platform-engineer"],
      consumedInputIds: ["experiment-results", "experiment-hypothesis", "variant-content-inventory"],
      producedOutputIds: ["learnings-log-entry"],
      checklist: [
        "Present the results: 'We tested X vs. Y. We saw Z. Against our hypothesis of W...'",
        "Make the explicit call: promote, retire, or run a follow-up",
        "If promoting: confirm implementation timeline with the engineer",
        "If retiring: agree on replacement content timeline with client marketing",
        "If iterating: agree the new hypothesis before ending the call",
        "Document the decision rationale in the learnings log immediately after the call",
      ],
    },
    {
      id: "implementation",
      label: "Implementation",
      description:
        "The engineer implements the approved decision within 48 hours. A variant " +
        "promotion or retirement is a platform configuration change — it should be " +
        "tracked and confirmed, not assumed.",
      order: 3,
      estimatedDuration: "30 minutes – 2 hours (depending on complexity)",
      primaryRole: "platform-engineer",
      supportingRoles: ["account-manager"],
      consumedInputIds: [],
      producedOutputIds: ["variant-decision", "follow-up-experiment-brief"],
      checklist: [
        "Implement the variant decision: promote, retire, or configure the follow-up test",
        "Verify the change is live and functioning — check the content status dashboard",
        "Notify the account manager when implementation is confirmed",
        "If a follow-up experiment is planned, hand off the brief to the AM for client alignment",
        "Add the experiment outcome to the running experiment log for quarterly review",
      ],
    },
  ],

  // ── Connections ─────────────────────────────────────────────────────────────

  linkedDashboards: [
    {
      label: "Variants",
      path: "/dashboard/variants",
      description:
        "Per-variant CTR and serve-share data. The primary view for evaluating " +
        "experiment bucket performance.",
    },
    {
      label: "Content Status",
      path: "/dashboard/content-status",
      description:
        "Confirms which variant keys are live before and after the implementation " +
        "decision. Used to verify the change is correctly reflected in CMS state.",
    },
    {
      label: "Sessions",
      path: "/dashboard/sessions",
      description:
        "Validates session volume and source distribution for the experiment period.",
    },
  ],

  linkedReportSections: [
    "variant-performance",
    "ai-rules-insights",
  ],

  linkedKpiIds: [
    "adaptive-cta-click-rate",
    "landing-cta-click-rate",
    "adaptive-personalisation-coverage",
    "landing-variant-diversity",
  ],

  linkedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
  ],

  linkedServiceOfferingId: "optimisation",

  // ── Quality gates ────────────────────────────────────────────────────────────

  successCriteria: [
    "A clear promote / retire / iterate decision is documented with rationale",
    "The approved variant decision is implemented and verified in the platform",
    "The learnings log entry is written and shared with the client",
    "If inconclusive, a follow-up experiment brief is drafted within 5 business days",
  ],

  escalationConditions: [
    "Experiment is inconclusive after 500 sessions per bucket — hypothesis may be wrong",
    "The winning variant underperforms the control by more than 15% — review rule configuration",
    "Three consecutive experiments on the same slot are inconclusive — content strategy issue",
  ],

  // ── Operating guidance ───────────────────────────────────────────────────────

  operatingNotes:
    "Speed is the primary value of this cycle. The experiment has concluded — a decision " +
    "delayed is a learning wasted. The goal is a clear decision within 5 business days of " +
    "the experiment meeting its thresholds.\n\n" +
    "The most common trap is over-indexing on statistical significance. With the session " +
    "volumes most MC clients generate, you will rarely reach 95% confidence. Make the " +
    "decision on directional signal and documented rationale — 'the data points this way, " +
    "the risk of being wrong is low, we proceed.' Document the uncertainty explicitly.\n\n" +
    "If the result contradicts the hypothesis (the variant you expected to win, lost), " +
    "spend the extra 10 minutes in the decision call exploring why. This is the highest-" +
    "value learning — it tells you something you believed about your audience was wrong.",
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT REFRESH CYCLE
// ─────────────────────────────────────────────────────────────────────────────

export const CONTENT_REFRESH: OptimizationCycle = {
  id: "content-refresh",
  name: "Content Refresh Cycle",
  tagline: "Stale variants erode performance. Refresh before the data forces you to.",
  description:
    "A focused cycle for reviewing and updating variant content before staleness " +
    "materially affects performance. Can be triggered by content age (> 90 days since " +
    "last update), underperformance detection (variant CTR below threshold for 30+ days), " +
    "or proactively as part of a monthly review recommendation. The output is updated " +
    "variant content live in the platform — not a report, but a platform improvement.",

  // ── Scheduling ──────────────────────────────────────────────────────────────

  cadence: "triggered",
  annualFrequency: "variable",
  typicalDuration: "3–5 business days (brief → production → upload → verify)",
  triggers: ["content-staleness", "threshold-breach", "calendar"],

  // ── People ──────────────────────────────────────────────────────────────────

  roles: [
    {
      role: "content-strategist",
      label: "Content Strategist (MC)",
      responsibilities: [
        "Leads the content audit and identifies which variants need refreshing",
        "Writes or reviews the content brief for each variant requiring an update",
        "Reviews client-submitted content before upload to confirm quality bar is met",
      ],
      timeCommitment: "~2–3 hours per refresh cycle (audit + brief writing + review)",
      optional: true,
    },
    {
      role: "account-manager",
      label: "Account Manager (MC)",
      responsibilities: [
        "Initiates the cycle when triggered by performance data or the content status dashboard",
        "Communicates the content brief to the client and tracks production progress",
        "Confirms the refresh is complete before closing the cycle",
      ],
      timeCommitment: "~1 hour per refresh cycle (coordination and sign-off)",
      optional: false,
    },
    {
      role: "client-marketing",
      label: "Client Marketing Lead",
      responsibilities: [
        "Produces the updated variant content according to the brief",
        "Delivers content to MC in the agreed format within the agreed timeline",
      ],
      timeCommitment: "~2–4 hours per refresh cycle (content production)",
      optional: false,
    },
    {
      role: "platform-engineer",
      label: "Platform Engineer (MC)",
      responsibilities: [
        "Uploads the approved content to the CMS and verifies it is correctly live",
        "Confirms the content status dashboard reflects the updated variant state",
      ],
      timeCommitment: "~30 minutes per refresh cycle (upload and verification)",
      optional: false,
    },
  ],

  // ── Inputs ──────────────────────────────────────────────────────────────────

  requiredInputs: [
    {
      id: "content-staleness-report",
      label: "Content Status Report",
      description:
        "The current state of all variant content — which keys exist, when they were " +
        "last updated, and which are flagged as stale (> 90 days) or missing. " +
        "The starting point for every content refresh cycle.",
      type: "content-inventory",
      required: true,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/content-status",
    },
    {
      id: "underperforming-variants",
      label: "Underperforming Variant List",
      description:
        "Variants with CTR below the client's warning threshold for 30+ consecutive days. " +
        "Identifies refresh candidates by performance signal rather than age alone.",
      type: "variant-data",
      required: false,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/variants",
      linkedReportSection: "variant-performance",
      linkedKpiIds: ["adaptive-cta-click-rate", "landing-cta-click-rate"],
    },
    {
      id: "content-brief-input",
      label: "Existing Content Brief (if available)",
      description:
        "The original content brief or messaging guidelines used when the variant " +
        "was first created. Ensures the refresh is consistent with the original " +
        "strategic intent, not a drift into off-brand territory.",
      type: "client-brief",
      required: false,
      source: "client",
    },
    {
      id: "rule-config-check",
      label: "Rule Configuration (for slot mapping)",
      description:
        "Current decision rules to confirm which variant keys are actively referenced " +
        "by the engine. Prevents refreshing variants that are no longer in active use.",
      type: "rule-config",
      required: false,
      source: "platform-data",
      linkedDashboardPath: "/dashboard/rules",
    },
  ],

  // ── Outputs ─────────────────────────────────────────────────────────────────

  outputs: [
    {
      id: "content-brief-output",
      label: "Variant Content Brief",
      description:
        "Instructions for the client on what to update, the tone and message guidance " +
        "for each variant, and the format requirements for CMS upload. " +
        "One brief per variant slot being refreshed.",
      type: "content-brief",
      owner: "content-strategist",
      isClientDeliverable: true,
      linkedServiceOfferingId: "content-modeling",
    },
    {
      id: "updated-variants",
      label: "Updated Variants (Live in Platform)",
      description:
        "The refreshed variant content uploaded to the CMS and verified as live. " +
        "This is the primary output — a real platform improvement, not a document.",
      type: "variant-update",
      owner: "platform-engineer",
      isClientDeliverable: false,
      linkedServiceOfferingId: "optimisation",
    },
    {
      id: "refresh-learnings",
      label: "Refresh Notes",
      description:
        "A brief internal record of what was refreshed and why — captures the " +
        "strategic reasoning for future account managers and content strategists.",
      type: "learnings-log",
      owner: "account-manager",
      isClientDeliverable: false,
      linkedServiceOfferingId: "optimisation",
    },
  ],

  // ── Phases ──────────────────────────────────────────────────────────────────

  phases: [
    {
      id: "content-audit",
      label: "Content Audit",
      description:
        "Identify which variant slots need refreshing and why. Combines age-based " +
        "staleness from the content status dashboard with performance-based signals " +
        "from the variant performance data. Produces a prioritised refresh list.",
      order: 1,
      estimatedDuration: "30–60 minutes",
      primaryRole: "content-strategist",
      supportingRoles: ["account-manager"],
      consumedInputIds: [
        "content-staleness-report",
        "underperforming-variants",
        "rule-config-check",
      ],
      producedOutputIds: [],
      checklist: [
        "Open /dashboard/content-status and export all stale variant flags (> 90 days)",
        "Cross-reference against /dashboard/variants — which stale variants are also underperforming?",
        "Confirm each flagged variant is still referenced in the active rule config",
        "Prioritise refresh candidates: underperforming + stale > stale only > underperforming only",
        "Confirm the refresh scope with the account manager before briefing the client",
      ],
    },
    {
      id: "brief-and-production",
      label: "Brief & Production",
      description:
        "The content strategist writes the variant brief and shares it with the client " +
        "marketing lead. The client produces the updated content. " +
        "This is the longest phase — production timelines vary by client capacity.",
      order: 2,
      estimatedDuration: "1–3 business days",
      primaryRole: "content-strategist",
      supportingRoles: ["account-manager", "client-marketing"],
      consumedInputIds: ["content-brief-input"],
      producedOutputIds: ["content-brief-output"],
      checklist: [
        "Write a content brief for each variant slot in the refresh scope",
        "Include: current variant copy, why it is being refreshed, message direction, tone, CTA guidance",
        "Confirm the CMS format requirements: character limits, image specs, key naming conventions",
        "Send the brief to the client marketing lead with a clear production deadline",
        "Set a calendar reminder for the deadline — follow up if content is not received",
      ],
    },
    {
      id: "review-and-upload",
      label: "Review & Upload",
      description:
        "The content strategist reviews the submitted content against the brief. " +
        "If it meets the quality bar, the engineer uploads it to the CMS and verifies " +
        "it is live and correctly routed by the rules engine.",
      order: 3,
      estimatedDuration: "1–2 hours",
      primaryRole: "platform-engineer",
      supportingRoles: ["content-strategist", "account-manager"],
      consumedInputIds: [],
      producedOutputIds: ["updated-variants", "refresh-learnings"],
      checklist: [
        "Review submitted content against the brief — confirm message direction and quality",
        "Return with feedback if it does not meet the brief (do not upload off-brief content)",
        "Upload approved content to the CMS under the correct variant keys",
        "Verify the content status dashboard shows the variants as current (not stale)",
        "Confirm the rules engine is serving the updated variants — spot-check via the variants dashboard",
        "Notify the account manager and client that the refresh is live",
        "Write a brief refresh note capturing what was updated and why",
      ],
    },
  ],

  // ── Connections ─────────────────────────────────────────────────────────────

  linkedDashboards: [
    {
      label: "Content Status",
      path: "/dashboard/content-status",
      description:
        "Primary trigger dashboard. Identifies stale variants by age and missing " +
        "content by slot. The starting point for every content refresh cycle.",
    },
    {
      label: "Variants",
      path: "/dashboard/variants",
      description:
        "Performance context for the refresh — confirms which stale variants are " +
        "also underperforming, making them the highest-priority refresh candidates.",
    },
    {
      label: "Rules Editor",
      path: "/dashboard/rules",
      description:
        "Confirms which variant keys are actively referenced by decision rules " +
        "before investing in a refresh — avoids updating variants no longer in use.",
    },
  ],

  linkedReportSections: [
    "variant-performance",
    "recommendations",
  ],

  linkedKpiIds: [
    "adaptive-cta-click-rate",
    "landing-cta-click-rate",
    "adaptive-personalisation-coverage",
    "landing-variant-diversity",
  ],

  linkedModules: [
    "adaptive-website",
    "adaptive-landing-pages",
  ],

  linkedServiceOfferingId: "content-modeling",

  // ── Quality gates ────────────────────────────────────────────────────────────

  successCriteria: [
    "All flagged stale variants have been refreshed or explicitly deferred with a reason",
    "Updated variants are live in the CMS and confirmed by the content status dashboard",
    "The rules engine is confirmed to be serving the updated variants correctly",
    "A refresh notes entry is written and saved for the next account manager",
  ],

  escalationConditions: [
    "Client has not delivered content within 5 business days of the brief — risk of ongoing staleness",
    "Refreshed variant underperforms the previous version after 100+ sessions — revert and review",
    "More than 30% of variant slots are stale simultaneously — content strategy review needed",
  ],

  // ── Operating guidance ───────────────────────────────────────────────────────

  operatingNotes:
    "Content staleness is the most common silent killer of platform performance. " +
    "Variants that haven't been updated in 90 days are rarely well-suited to the " +
    "current visitor context — the world changes, and the content doesn't. Don't " +
    "wait for performance to collapse before triggering this cycle.\n\n" +
    "The content brief is the most important output of this cycle — not the uploaded " +
    "content itself. A well-written brief produces good content; a vague brief produces " +
    "off-brand content that damages performance. Invest the time in the brief.\n\n" +
    "The most common client failure mode is treating the content brief as optional " +
    "guidance. Be explicit: 'We need copy that does X, in Y words, with Z call-to-action.' " +
    "Review submitted content before uploading — do not accept content that doesn't meet " +
    "the brief just because a deadline is due.\n\n" +
    "For high-volume clients (5+ active variants per slot), a rolling refresh model " +
    "works better than a single large refresh event. Refresh 2–3 variants per month " +
    "as part of the monthly review cycle rather than accumulating a large refresh backlog.",
};

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMIZATION CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete optimization catalog — all four defined cycles in one structure.
 *
 * Ordered from highest frequency (monthly) to triggered/variable cadence.
 */
export const OPTIMIZATION_CATALOG: OptimizationCatalog = {
  cycles: [
    MONTHLY_PERFORMANCE_REVIEW,
    QUARTERLY_STRATEGY_REVIEW,
    EXPERIMENT_REVIEW,
    CONTENT_REFRESH,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the cycle with the given ID, or undefined if not found.
 *
 * @example
 *   const cycle = getCycle("monthly-performance-review");
 */
export function getCycle(
  id: OptimizationCycle["id"],
): OptimizationCycle | undefined {
  return OPTIMIZATION_CATALOG.cycles.find((c) => c.id === id);
}

/**
 * Returns all cycles that can be triggered by a given trigger type.
 *
 * @example
 *   const triggered = getCyclesByTrigger("experiment-concluded");
 *   // → [EXPERIMENT_REVIEW]
 */
export function getCyclesByTrigger(
  trigger: OptimizationCycle["triggers"][number],
): readonly OptimizationCycle[] {
  return OPTIMIZATION_CATALOG.cycles.filter((c) =>
    (c.triggers as readonly string[]).includes(trigger),
  );
}

/**
 * Returns all cycles that are linked to a given product module.
 *
 * @example
 *   const cycles = getCyclesByModule("adaptive-landing-pages");
 */
export function getCyclesByModule(
  moduleId: OptimizationCycle["linkedModules"][number],
): readonly OptimizationCycle[] {
  return OPTIMIZATION_CATALOG.cycles.filter((c) =>
    (c.linkedModules as readonly string[]).includes(moduleId),
  );
}

/**
 * Returns all client-deliverable outputs across all cycles (or a specific cycle).
 *
 * @param cycleId  Optional. If provided, returns deliverables for that cycle only.
 *
 * @example
 *   const allDeliverables = getDeliverables();
 *   const monthlyDeliverables = getDeliverables("monthly-performance-review");
 */
export function getDeliverables(
  cycleId?: OptimizationCycle["id"],
): ReadonlyArray<{ cycleId: string; output: OptimizationCycle["outputs"][number] }> {
  const cycles = cycleId
    ? OPTIMIZATION_CATALOG.cycles.filter((c) => c.id === cycleId)
    : OPTIMIZATION_CATALOG.cycles;

  return cycles.flatMap((cycle) =>
    cycle.outputs
      .filter((o) => o.isClientDeliverable)
      .map((output) => ({ cycleId: cycle.id, output })),
  );
}

/**
 * Returns a lightweight CycleSummary for each cycle — useful for list views
 * and calendar views without loading full cycle definitions.
 *
 * @example
 *   const summaries = summarizeCycles();
 *   // → [{ id: "monthly-performance-review", name: "...", ... }, ...]
 */
export function summarizeCycles(): readonly CycleSummary[] {
  return OPTIMIZATION_CATALOG.cycles.map((cycle) => {
    // The primaryRole is the role who drives the most phases of the cycle.
    // Fall back to the first role in the roles list if phases are not set.
    const phasePrimaryRoles = cycle.phases.map((p) => p.primaryRole);
    const primaryRole =
      phasePrimaryRoles.length > 0
        ? (phasePrimaryRoles
            .sort(
              (a, b) =>
                phasePrimaryRoles.filter((r) => r === b).length -
                phasePrimaryRoles.filter((r) => r === a).length,
            )
            .at(0) ?? cycle.roles[0]?.role ?? "account-manager")
        : cycle.roles[0]?.role ?? "account-manager";

    return {
      id: cycle.id,
      name: cycle.name,
      tagline: cycle.tagline,
      cadence: cycle.cadence,
      annualFrequency: cycle.annualFrequency,
      typicalDuration: cycle.typicalDuration,
      primaryRole,
      outputCount: cycle.outputs.length,
      phaseCount: cycle.phases.length,
    };
  });
}
