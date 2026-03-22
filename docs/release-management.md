# Release Management

Authoritative reference for how platform changes move from development through staging to production.

**Machine-readable model:** `releases/types.ts` and `releases/model.ts`
**Last updated:** March 2026

---

## Purpose

This document defines how the Mister Chameleon platform manages releases — not as a CI/CD pipeline specification, but as an operational process. The goal is a shared vocabulary between engineers, account managers, and eventually clients: what a "release" is, how it progresses, which tenants it affects, and how to reverse it safely.

Three problems this solves:

1. **Inconsistent rollouts.** Without a defined model, every release is a one-off. This creates unnecessary risk and makes post-mortems harder.
2. **No rollback discipline.** Rollback plans written *after* something goes wrong are worse than plans written before deployment. The model requires rollback plans before scheduling.
3. **Blurred tenant impact.** A platform with multiple tenants needs a clear answer to "which clients are affected by this release and how."

---

## Environments

### Staging

Pre-production environment. Mirrors production infrastructure. Internal traffic only.

- Hostname convention: `staging.misterchameleon.com` or `localhost`
- All non-hotfix releases deploy to staging first
- A minimum 24-hour validation window runs before production promotion
- Feature flags in staging may differ from production to test behaviour in isolation

### Production

Live environment serving real tenant traffic.

- Changes only reach production after staging validation (except hotfixes)
- Feature flags are the primary mechanism for tenant-targeted activation
- Post-deployment verification is required within 30 minutes of promotion

---

## Release Anatomy

Every release is a `ReleaseDefinition` containing:

| Field | What it captures |
|---|---|
| `id` | Stable identifier — `YYYY-MM-NNN` or `hotfix-YYYY-MM-DD` |
| `title` | Human-readable name for changelogs |
| `status` | Lifecycle state: draft → scheduled → in-progress → staged → released |
| `rolloutScope` | Which tenants are affected: `all-tenants`, `tenant-targeted`, or `platform-only` |
| `rolloutPattern` | How the release progresses: `staged-promotion`, `flag-gated`, `tenant-progressive`, or `immediate` |
| `changes` | One or more `ReleaseChange` items, each with a type, rationale, and reversibility notes |
| `tenantTargets` | For tenant-targeted releases: which tenants, in what order, with what flag changes |
| `validationChecklist` | Pre and post-deployment checks with owners and blocking status |
| `rollbackPlan` | Strategy, steps, triggers, success criteria, and data loss risk |
| `stagingValidation` | Evidence that staging was validated before production promotion |

---

## Change Types

A release can bundle multiple changes of different types:

| Type | Description |
|---|---|
| `platform-code` | Next.js application code — components, API routes, serving logic |
| `tenant-config` | Changes to a `TenantConfig` object (code-level — requires deploy) |
| `feature-flag` | Changes to `TenantFeatureFlags` values for one or more tenants |
| `cms-schema` | New or modified CMS content types, applied in the CMS |
| `decision-rules` | Updates to the rules-based decision engine configuration |
| `data-pipeline` | Analytics schema changes, KPI updates, database migrations |
| `dependency` | Third-party package upgrades |
| `documentation` | Docs and runbooks only — tracked for audit trail |

---

## Rollout Patterns

### Staged Promotion (default)

The standard pattern for all non-emergency releases.

```
development → staging (24h+ validation) → production (all tenants)
```

Use when: Platform code changes, CMS schema additions, dependency upgrades.

### Flag-Gated

Code deploys in an inactive state. The feature flag is activated per-tenant on a separate schedule.

```
code deploy (flag off) → staging validation → flag on for tenant A → monitor → flag on for others
```

Use when: Introducing new behaviour that needs to be activated per-client after readiness confirmation.

### Tenant-Progressive

Code and flags deploy together, but to one tenant first before expanding.

```
deploy → enable tenant A (canary) → [validation window] → enable tenant B → enable all
```

Use when: Higher-risk changes where tenant-by-tenant monitoring reduces blast radius.

### Immediate (hotfix)

Bypasses the standard staging window. Used only during active incidents.

```
validated fix → direct production deploy → immediate post-deploy verification
```

Use when: A confirmed production incident with an active client impact. Requires account manager approval.

---

## Feature Flag Lifecycle

Feature flags are the primary mechanism for progressive activation. A new capability follows this path:

1. **Ship behind a flag (off)** — code is in production, feature is inactive for all tenants. Safe.
2. **Enable in staging** — validate behaviour against the full production CMS dataset.
3. **Enable for one tenant (canary)** — monitor for 24–48 hours. Account manager informs client.
4. **Enable for additional tenants** — one at a time if risk is unclear, or in batch if confident.
5. **Stabilise** — once all intended tenants have the flag enabled, the flag can be promoted to a default-on value in a future cleanup release.

Feature flags in the platform are defined in `TenantFeatureFlags` (`tenant/types.ts`). Current flags:

| Flag | Default | Description |
|---|---|---|
| `diagnosticsBar` | false | Debug overlay — only on in development |
| `contactForm` | true | Enable contact form and n8n webhook |
| `abTesting` | false | Enable A/B experiment layer |
| `aiDecisionProvider` | false | Enable AI decision engine |

---

## Tenant-Targeted Rollouts

When `rolloutScope` is `"tenant-targeted"`, the release carries a `tenantTargets` array. Each entry specifies:

- `tenantId` — must match a registered tenant in `resolve-tenant.ts`
- `flagChanges` — the specific flags being toggled for this tenant (delta only)
- `isCanary` — whether this tenant is the first-in-sequence canary
- `validationWindowHours` — how long to monitor before expanding the rollout
- `notes` — context for why this tenant is included

### Rollout ordering

For `tenant-progressive` releases, tenants are applied in array order. The canary tenant (marked `isCanary: true`) is always first.

### Flag audit trail

Use `getPlannedFlagChangesForTenant(tenantId)` to see the cumulative flag changes scheduled for a tenant across all active releases. This gives a clear picture of what flag state a tenant should be in after all pending releases are applied.

---

## Rollback Strategy

Every release requires a `RollbackPlan` before it can be scheduled. The plan specifies:

### Strategies

| Strategy | When to use |
|---|---|
| `revert-deploy` | Platform code changes. Re-deploy the previous Git ref. ~5–10 minutes. |
| `config-restore` | Tenant config or decision rules changes. Restore from Git. ~5 minutes. |
| `flag-revert` | Feature flag activations. Set flags back to prior values. ~2–5 minutes. |
| `cms-schema-rollback` | CMS schema changes. Remove document type via CMS dashboard. Use only with no published content. |
| `data-migration-down` | Database schema migrations. High-risk — requires explicit sign-off. |
| `manual` | Complex multi-step rollbacks. Must be fully documented in `steps`. |

### Required plan components

Before a release can be scheduled, the rollback plan must define:

- At least one concrete rollback step (written as an unambiguous imperative)
- At least one rollback trigger (the condition that initiates the rollback decision)
- At least one success criterion (how to confirm the rollback worked)
- An honest `dataLossRisk` statement (can be "None" if there is genuinely no risk)

---

## Release ID Convention

| Pattern | Example | When |
|---|---|---|
| `YYYY-MM-NNN` | `2026-03-001` | Scheduled fortnightly release |
| `hotfix-YYYY-MM-DD` | `hotfix-2026-03-15` | Emergency production fix |
| `hotfix-YYYY-MM-DD-N` | `hotfix-2026-03-15-2` | Second hotfix on the same day |
| `rollback-<id>` | `rollback-2026-03-001` | Formal rollback of a prior release |

---

## Example Rollout Structures

### 1. Standard code release (all tenants)

`2026-03-001` — Adaptive Landing Page Foundation + Proof Block Schema

- **Scope:** all-tenants
- **Pattern:** staged-promotion
- **Changes:** platform-code (landing page infrastructure) + cms-schema (proof block)
- **Staging window:** 24 hours
- **Client notification:** not required (behind a flag, no visible change)
- **Rollback:** revert-deploy, ~10 minutes

Key principle: The landing page infrastructure ships disabled. No visible change means no client communication needed.

### 2. Feature flag activation (single tenant)

`2026-03-002` — AI Decision Provider — Phase 1 Activation (Acme Corp)

- **Scope:** tenant-targeted (acme-corp only)
- **Pattern:** flag-gated
- **Changes:** feature-flag (`aiDecisionProvider: true`, `abTesting: true`)
- **Validation window:** 48 hours post-activation
- **Client notification:** required — account manager notifies client same day
- **Rollback:** flag-revert, ~5 minutes

Key principle: Code was shipped weeks earlier. This release is a config change only. The fastest possible rollback path is a flag revert.

### 3. Emergency hotfix

`hotfix-2026-03-15` — Sanity Query Compatibility

- **Scope:** all-tenants
- **Pattern:** immediate (staging bypassed — active incident)
- **Changes:** platform-code (one-line CMS query fix)
- **Staging:** validated locally against production dataset; full staging window bypassed
- **Client notification:** required — account manager communicates after resolution
- **Rollback:** revert-deploy, ~5 minutes

Key principle: Speed is the priority. The fix is targeted and low-risk. Account manager signs off on bypassing staging.

---

## Validation Checklist Ownership

| Owner | Responsibilities |
|---|---|
| `platform-engineer` | Technical checks: serving correctness, error rates, TypeScript, migrations |
| `account-manager` | Client communication confirmation, business impact assessment |
| `content-strategist` | Variant content completeness, CMS entry validation |
| `automated` | CI checks, TypeScript compilation, error rate monitoring alerts |

Checks marked `blocking: true` must pass before the release proceeds to the next stage. Blocking failures halt the release.

---

## Maintenance

This document and the machine-readable model should be updated together.

- **Adding a new rollout pattern:** add to `RolloutPattern` in `types.ts` and document here.
- **Adding a new change type:** add to `ChangeType` in `types.ts` and add a row to the table above.
- **Adding a new release:** create a `ReleaseDefinition` constant in `model.ts` and prepend to `RELEASE_LOG`.
- **Archiving old releases:** never remove from `RELEASE_LOG`. Change status to `"released"`, `"rolled-back"`, or `"cancelled"`. The log is an audit trail.

---

*For support events connected to releases, see `support/processes.ts` (incident process).*
*For tenant configuration, see `tenant/types.ts` and `tenant/mister-chameleon-config.ts`.*
*For feature capability boundaries, see `docs/product-boundaries.md`.*
