/**
 * Release Model
 *
 * Concrete release definitions, the release log, and helpers for querying
 * and validating releases.
 *
 * ─── What lives here ──────────────────────────────────────────────────────────
 *
 *   RELEASE_LOG         Ordered log of all platform releases (most recent first).
 *                       Serves as both a deployment plan and an audit trail.
 *
 *   Example releases    Three illustrative release definitions covering the
 *                       most common rollout patterns:
 *
 *     RELEASE_2026_03_001   Platform-wide code + CMS schema update
 *                           (staged-promotion, all-tenants).
 *
 *     RELEASE_2026_03_002   AI decision provider flag rollout to a single tenant
 *                           (flag-gated, tenant-targeted).
 *
 *     RELEASE_HOTFIX_2026_03_15   Emergency rollback-and-fix for a production
 *                                 incident (immediate, platform-only).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { RELEASE_LOG, getRelease, getReleasesForTenant } from "@/releases";
 *   import { getReleasesByStatus, getReleasesWithFlagChange } from "@/releases";
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   releases/types.ts ← all type definitions
 *   releases/model.ts ← YOU ARE HERE — concrete releases + helpers
 *   releases/index.ts ← barrel re-export
 */

import type {
  ReleaseDefinition,
  ReleaseLog,
  ReleaseId,
  ReleaseStatus,
  Environment,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE RELEASE 1 — Platform-wide code + CMS schema (staged-promotion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard platform release.
 *
 * Pattern: staged-promotion, all-tenants.
 *
 * A typical fortnightly release that includes platform code changes and a
 * CMS schema addition. Deployed to staging first, validated over 24 hours,
 * then promoted to production. No tenant-specific targeting required.
 */
export const RELEASE_2026_03_001: ReleaseDefinition = {
  id: "2026-03-001",
  title: "Adaptive Landing Page Foundation + Proof Block Schema",
  description:
    "Introduces the foundational serving infrastructure for adaptive landing pages " +
    "behind a disabled feature flag, and adds the proof-block schema to Sanity. " +
    "No client-visible change in this release — the landing page flag remains off " +
    "for all tenants until content is ready. The Sanity schema addition is additive " +
    "and does not affect existing content.",

  status: "released",
  targetDate: "2026-03-12",
  releasedAt: "2026-03-12T14:30:00Z",

  rolloutScope: "all-tenants",
  rolloutPattern: "staged-promotion",
  tenantTargets: [],

  changes: [
    {
      id: "lp-infrastructure",
      type: "platform-code",
      summary: "Add adaptive landing page route and serving pipeline",
      rationale:
        "Landing pages are the next adaptive surface after the homepage. " +
        "Shipping the infrastructure behind a feature flag lets us validate the " +
        "architecture in production before enabling it for any tenant.",
      affectedAreas: [
        "app/(adaptive)/[slug]/page.tsx",
        "experience/landing-page.ts",
        "decision/providers/",
      ],
      linkedCapabilities: ["adaptive-landing-page"],
      independentlyReversible: true,
      reversalNotes:
        "Set features.adaptiveLandingPages = false in all tenant configs and redeploy. " +
        "The route will return 404 without the flag, leaving no client-visible change.",
    },
    {
      id: "proof-block-schema",
      type: "cms-schema",
      summary: "Add proof-block document type to Sanity schema",
      rationale:
        "The proof block requires a dedicated content type in Sanity to support " +
        "variant-specific social proof entries. Adding the schema now lets content " +
        "editors begin populating content before the feature goes live.",
      affectedAreas: [
        "sanity/schemas/proof-block.ts",
        "sanity/schemas/index.ts",
        "cms/sanity/queries.ts",
      ],
      linkedCapabilities: ["adaptive-homepage"],
      independentlyReversible: true,
      reversalNotes:
        "Remove proof-block schema from Sanity. Safe as long as no published content " +
        "documents exist for this type. Check Sanity dataset before removing.",
    },
  ],

  validationChecklist: [
    {
      label: "Landing page route returns 404 on staging with flag off",
      owner: "platform-engineer",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Sanity proof-block schema visible in Sanity Studio",
      owner: "platform-engineer",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Homepage variant serving unaffected on staging",
      owner: "platform-engineer",
      environment: "staging",
      blocking: true,
    },
    {
      label: "No new TypeScript errors (npx tsc --noEmit)",
      owner: "automated",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Verify homepage variant serving unaffected on production",
      owner: "platform-engineer",
      environment: "production",
      blocking: true,
    },
    {
      label: "Confirm Sanity schema deployed to production dataset",
      owner: "platform-engineer",
      environment: "production",
      blocking: false,
    },
  ],

  stagingValidation: {
    deployedAt: "2026-03-11T10:00:00Z",
    validatedAt: "2026-03-12T09:00:00Z",
    validatedBy: "platform-engineer",
    validationSummary:
      "Landing page returns 404 as expected with flag off. Sanity schema visible " +
      "and editor can create proof-block entries. Homepage serving confirmed unchanged. " +
      "Zero TypeScript errors.",
    issuesFoundAndResolved: [],
  },

  rollbackPlan: {
    strategy: "revert-deploy",
    estimatedRollbackMinutes: 10,
    steps: [
      "Identify the previous production Git ref from the deployment log.",
      "Re-deploy the previous ref via Vercel dashboard or CLI.",
      "Confirm deployment completes without error.",
      "Verify homepage variant serving is restored by testing two traffic sources.",
      "If CMS schema was also deployed: remove the proof-block document type from " +
        "Sanity (safe — no published documents yet).",
      "Post rollback confirmation in #platform-engineering with timestamp.",
    ],
    rollbackTriggers: [
      "Homepage variant serving error rate exceeds 2% in the 30 minutes post-deployment.",
      "Any serving API endpoint returns 5xx for more than 5 consecutive requests.",
      "TypeScript runtime error appears in Sentry post-deployment.",
    ],
    successCriteria: [
      "Homepage variant serving logs show the prior decision pattern restored.",
      "Sentry error rate returns to pre-deployment baseline.",
      "Canary test requests to the homepage receive the expected variant.",
    ],
    dataLossRisk: "None. The CMS schema addition creates no documents. Landing page " +
      "infrastructure adds no data. Revert has zero data implications.",
  },

  requiresClientNotification: false,

  linkedService: "onboarding",
  gitRef: "v0.8.0",
  author: "platform-engineer",
  approvedBy: "account-manager",
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE RELEASE 2 — Feature flag rollout to a single tenant (flag-gated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tenant-targeted feature flag activation.
 *
 * Pattern: flag-gated, tenant-targeted.
 *
 * The AI decision provider code shipped weeks earlier in 2026-03-001.
 * This release activates it for a single tenant by flipping two flags.
 * No code deployment is required — this is a config change only.
 * A 48-hour monitoring window follows before any broader rollout.
 */
export const RELEASE_2026_03_002: ReleaseDefinition = {
  id: "2026-03-002",
  title: "AI Decision Provider — Phase 1 Activation (Acme Corp)",
  description:
    "Activates the AI decision provider for the Acme Corp tenant by enabling " +
    "aiDecisionProvider and abTesting feature flags in their tenant config. " +
    "The AI provider code has been live in production since 2026-03-001 — " +
    "this release is a config change only. A 48-hour monitoring window will " +
    "run before the flags are considered stable. Rollback is a single flag " +
    "revert if behaviour is unexpected.",

  status: "scheduled",
  targetDate: "2026-03-20",

  rolloutScope: "tenant-targeted",
  rolloutPattern: "flag-gated",
  tenantTargets: [
    {
      tenantId: "acme-corp",
      isCanary: true,
      validationWindowHours: 48,
      flagChanges: {
        aiDecisionProvider: true,
        abTesting: true,
      },
      notes:
        "Acme Corp requested AI decisioning in the March QBR. Their CMS has " +
        "content for all required variant keys. Decision rules have been reviewed.",
    },
  ],

  changes: [
    {
      id: "acme-ai-flag",
      type: "feature-flag",
      summary: "Enable aiDecisionProvider and abTesting flags for Acme Corp",
      rationale:
        "Acme Corp is the first client to activate AI-driven adaptive content. " +
        "Enabling their flags separately from other tenants allows close monitoring " +
        "before the feature is offered to additional clients.",
      affectedAreas: [
        "tenant/acme-corp-config.ts",
      ],
      linkedCapabilities: ["ai-decisioning", "experiment-support"],
      independentlyReversible: true,
      reversalNotes:
        "Set aiDecisionProvider: false and abTesting: false in acme-corp-config.ts " +
        "and redeploy. Variant serving will immediately fall back to rules-decisioning. " +
        "No data loss — all session and variant records are retained.",
    },
  ],

  validationChecklist: [
    {
      label: "Confirm Acme Corp CMS has content for all 12 variant keys",
      owner: "content-strategist",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Verify AI decision provider returns valid variant decisions in staging",
      owner: "platform-engineer",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Confirm fallback to rules provider when AI confidence is below threshold",
      owner: "platform-engineer",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Check analytics events are attributed correctly to AI vs rules decisions",
      owner: "platform-engineer",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Account manager confirms Acme Corp is expecting this change today",
      owner: "account-manager",
      environment: "production",
      blocking: true,
    },
    {
      label: "Post-activation: verify variant serving in production within 15 minutes",
      owner: "platform-engineer",
      environment: "production",
      blocking: true,
    },
    {
      label: "Post-activation: monitor Acme Corp error rate for 2 hours",
      owner: "platform-engineer",
      environment: "production",
      blocking: false,
    },
  ],

  rollbackPlan: {
    strategy: "flag-revert",
    estimatedRollbackMinutes: 5,
    steps: [
      "Open tenant/acme-corp-config.ts.",
      "Set features.aiDecisionProvider to false.",
      "Set features.abTesting to false.",
      "Commit and push. Vercel will auto-deploy within ~60 seconds.",
      "Verify serving logs show acme-corp tenants now receiving rules-based decisions.",
      "Notify account manager so they can communicate with Acme Corp.",
    ],
    rollbackTriggers: [
      "Acme Corp homepage error rate exceeds 1% in the 2 hours post-activation.",
      "AI decision provider returns the same variant for >90% of sessions " +
        "(likely stuck on a single decision — loss of adaptive behaviour).",
      "Acme Corp's account manager receives a complaint about unexpected content changes.",
      "Any session data loss or attribution gap detected in analytics.",
    ],
    successCriteria: [
      "Acme Corp serving logs show rules-decisioning variant keys.",
      "Error rate returns to pre-activation baseline.",
      "Account manager has confirmed the revert with the client.",
    ],
    dataLossRisk:
      "None. Session and event records created during the AI provider window " +
      "are retained. Historical variant attribution will show 'ai' for that window, " +
      "which is accurate. No data migration required for the rollback.",
  },

  requiresClientNotification: true,
  clientNotificationTemplate:
    "Hi [name], we're activating the AI-powered adaptive content for your site today " +
    "as discussed in our March review. The change will go live around [time]. You may " +
    "notice the content adapting more dynamically to different visitor types. We'll be " +
    "monitoring closely over the next 48 hours. Let us know if you see anything unexpected.",

  linkedService: "optimisation",
  author: "platform-engineer",
};

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE RELEASE 3 — Hotfix (immediate, platform-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emergency hotfix release.
 *
 * Pattern: immediate, all-tenants.
 *
 * A production incident caused by a broken CMS query after a Sanity API
 * version change. The fix is a one-line query correction. No staging window —
 * the incident is active and the fix is targeted and low-risk.
 */
export const RELEASE_HOTFIX_2026_03_15: ReleaseDefinition = {
  id: "hotfix-2026-03-15",
  title: "Hotfix: Sanity Query Compatibility — API Version Mismatch",
  description:
    "Emergency fix for a production incident where the Sanity CMS query for " +
    "hero block content began returning null after a Sanity API version change " +
    "on their infrastructure. Affected all Sanity-backed tenants. The fix updates " +
    "the query to use the new API response shape. Validated locally against the " +
    "production Sanity dataset before deployment. Standard staging window bypassed " +
    "due to active production impact.",

  status: "released",
  targetDate: "2026-03-15",
  releasedAt: "2026-03-15T11:45:00Z",

  rolloutScope: "all-tenants",
  rolloutPattern: "immediate",
  tenantTargets: [],

  changes: [
    {
      id: "sanity-query-fix",
      type: "platform-code",
      summary: "Fix Sanity hero block query for new API response envelope",
      rationale:
        "Sanity silently changed their API response envelope format in a minor " +
        "API version update. The hero block query was destructuring the old " +
        "shape, causing null returns and fallback variant serving for all visitors.",
      affectedAreas: [
        "cms/sanity/queries.ts",
        "cms/sanity/hero-query.ts",
      ],
      linkedCapabilities: ["adaptive-homepage"],
      independentlyReversible: false,
      reversalNotes:
        "Rollback via revert-deploy — this is a one-line fix in a shared query file. " +
        "Independent reversion is not possible without re-introducing the null return.",
    },
  ],

  validationChecklist: [
    {
      label: "Query returns non-null hero block data against production Sanity dataset locally",
      owner: "platform-engineer",
      environment: "staging",
      blocking: true,
    },
    {
      label: "Variant serving restored on production within 5 minutes of deploy",
      owner: "platform-engineer",
      environment: "production",
      blocking: true,
    },
    {
      label: "Sentry error rate returns to zero for hero block query errors",
      owner: "automated",
      environment: "production",
      blocking: true,
    },
  ],

  rollbackPlan: {
    strategy: "revert-deploy",
    estimatedRollbackMinutes: 5,
    steps: [
      "If the hotfix makes things worse: identify the ref from immediately before " +
        "the hotfix deployment in the Vercel deployment log.",
      "Trigger a revert deployment to that ref via Vercel dashboard.",
      "Confirm hero block is null-returning again (pre-hotfix state).",
      "This returns to the incident state — escalate to find an alternative fix.",
    ],
    rollbackTriggers: [
      "Post-hotfix deployment causes new error types not seen in the incident.",
      "Variant serving does not restore within 10 minutes of deployment.",
    ],
    successCriteria: [
      "Hero block null error rate drops to zero in Sentry.",
      "Variant serving logs show all traffic receiving a non-fallback variant.",
    ],
    dataLossRisk:
      "None for the hotfix itself. During the incident window, all affected sessions " +
      "received the default fallback variant. That session data is retained but shows " +
      "reduced variant diversity. No writes were affected.",
  },

  requiresClientNotification: true,
  clientNotificationTemplate:
    "Hi [name], we identified and resolved a content serving issue this morning " +
    "caused by an API change on Sanity's end. The fix was deployed at [time] and " +
    "adaptive content is now fully restored. The issue affected approximately [N] " +
    "minutes of traffic. We'll include a full summary in your next monthly review.",

  linkedService: "optimisation",
  linkedSupportProcessType: "incident",
  gitRef: "hotfix/sanity-query-2026-03-15",
  author: "platform-engineer",
  approvedBy: "account-manager",
};

// ─────────────────────────────────────────────────────────────────────────────
// RELEASE LOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered log of all platform releases, most recent first.
 *
 * Add new releases to the top of this array.
 * Never remove entries — released and rolled-back releases remain in the log
 * as an audit trail.
 *
 * @example
 *   import { RELEASE_LOG } from "@/releases";
 *   const pending = RELEASE_LOG.filter(r => r.status === "scheduled");
 */
export const RELEASE_LOG: ReleaseLog = [
  RELEASE_HOTFIX_2026_03_15,
  RELEASE_2026_03_002,
  RELEASE_2026_03_001,
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a release by its ID. Returns undefined if not found.
 *
 * @example
 *   const r = getRelease("2026-03-001");
 */
export function getRelease(id: ReleaseId): ReleaseDefinition | undefined {
  return RELEASE_LOG.find((r) => r.id === id);
}

/**
 * Get all releases with the given status.
 *
 * @example
 *   const pending = getReleasesByStatus("scheduled");
 */
export function getReleasesByStatus(
  status: ReleaseStatus
): readonly ReleaseDefinition[] {
  return RELEASE_LOG.filter((r) => r.status === status);
}

/**
 * Get all releases that include a change targeting a specific environment.
 * Returns releases whose validationChecklist has at least one item
 * for the given environment.
 */
export function getReleasesByEnvironment(
  env: Environment
): readonly ReleaseDefinition[] {
  return RELEASE_LOG.filter((r) =>
    r.validationChecklist.some((c) => c.environment === env)
  );
}

/**
 * Get all releases that target a specific tenant.
 *
 * @example
 *   const acmeReleases = getReleasesForTenant("acme-corp");
 */
export function getReleasesForTenant(
  tenantId: string
): readonly ReleaseDefinition[] {
  return RELEASE_LOG.filter((r) =>
    r.rolloutScope === "all-tenants" ||
    r.tenantTargets.some((t) => t.tenantId === tenantId)
  );
}

/**
 * Get all releases that include a feature flag change.
 * Useful for auditing which releases touched flag state.
 *
 * @example
 *   const flagReleases = getReleasesWithFlagChange();
 */
export function getReleasesWithFlagChange(): readonly ReleaseDefinition[] {
  return RELEASE_LOG.filter((r) =>
    r.changes.some((c) => c.type === "feature-flag") ||
    r.tenantTargets.some((t) => t.flagChanges !== undefined)
  );
}

/**
 * Get the flag changes scheduled for a specific tenant across all
 * non-cancelled, non-rolled-back releases.
 *
 * Returns the cumulative set of flag deltas, in chronological order
 * (oldest first — last write wins for any given flag).
 *
 * Useful for understanding what flag state a tenant should currently have.
 *
 * @example
 *   const planned = getPlannedFlagChangesForTenant("acme-corp");
 */
export function getPlannedFlagChangesForTenant(
  tenantId: string
): readonly { releaseId: ReleaseId; flagChanges: Record<string, unknown> }[] {
  const results: { releaseId: ReleaseId; flagChanges: Record<string, unknown> }[] = [];

  // Iterate oldest-first (reverse of RELEASE_LOG which is newest-first)
  const chronological = [...RELEASE_LOG].reverse();

  for (const release of chronological) {
    if (release.status === "cancelled" || release.status === "rolled-back") {
      continue;
    }
    for (const target of release.tenantTargets) {
      if (target.tenantId === tenantId && target.flagChanges) {
        results.push({
          releaseId: release.id,
          flagChanges: target.flagChanges as Record<string, unknown>,
        });
      }
    }
  }

  return results;
}

/**
 * Get all releases that need client notification but have not yet been
 * marked as released or cancelled.
 *
 * @example
 *   const toNotify = getPendingClientNotifications();
 */
export function getPendingClientNotifications(): readonly ReleaseDefinition[] {
  return RELEASE_LOG.filter(
    (r) =>
      r.requiresClientNotification &&
      r.status !== "released" &&
      r.status !== "cancelled" &&
      r.status !== "rolled-back"
  );
}

/**
 * Get all releases associated with a specific service offering.
 *
 * @example
 *   const onboardingReleases = getReleasesByService("onboarding");
 */
export function getReleasesByService(
  serviceId: import("@/product/types").ServiceOfferingId
): readonly ReleaseDefinition[] {
  return RELEASE_LOG.filter((r) => r.linkedService === serviceId);
}

/**
 * Validate that a release definition has the required fields for scheduling.
 *
 * Returns an array of validation errors. Empty array = ready to schedule.
 * This is a structural check — it does not validate business logic.
 *
 * @example
 *   const errors = validateReleaseForScheduling(myRelease);
 *   if (errors.length > 0) console.error(errors);
 */
export function validateReleaseForScheduling(
  release: ReleaseDefinition
): readonly string[] {
  const errors: string[] = [];

  if (release.changes.length === 0) {
    errors.push("A release must include at least one change.");
  }

  if (release.rollbackPlan.steps.length === 0) {
    errors.push("A rollback plan with at least one step is required before scheduling.");
  }

  if (release.rollbackPlan.rollbackTriggers.length === 0) {
    errors.push("At least one rollback trigger must be defined.");
  }

  if (release.rollbackPlan.successCriteria.length === 0) {
    errors.push("At least one rollback success criterion must be defined.");
  }

  if (
    release.rolloutScope === "tenant-targeted" &&
    release.tenantTargets.length === 0
  ) {
    errors.push("Tenant-targeted releases must specify at least one tenantTarget.");
  }

  if (
    release.rolloutPattern === "staged-promotion" &&
    !release.stagingValidation &&
    release.status !== "draft" &&
    release.status !== "scheduled"
  ) {
    errors.push(
      "Staged-promotion releases require a stagingValidation record before production deployment."
    );
  }

  if (release.requiresClientNotification && !release.clientNotificationTemplate) {
    errors.push(
      "Releases requiring client notification should include a clientNotificationTemplate."
    );
  }

  return errors;
}
