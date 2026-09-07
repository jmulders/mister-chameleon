import "server-only";

/**
 * Full tenant teardown — the data half of deleting a tenant.
 *
 * Most tenant-scoped tables key their rows by a PLAIN `tenant_id` column with no
 * foreign key to `tenant_settings`, so deleting `tenant_settings` does NOT remove
 * them. Left behind, they resurface when a slug is reused: a new tenant with the
 * same id inherits the old `rules_config` / `adaptive_blocks` / wallet balance /
 * visitor data. This module deletes every tenant-scoped row so a reused slug
 * starts clean.
 *
 * The table list is verified against `information_schema` (every public table
 * with a `tenant_id` column). It is used by `deleteTenantAction`.
 */

/**
 * Every public table with a `tenant_id` column (verified against
 * information_schema on the dev project), EXCEPT:
 *   - `tenant_settings`         — the caller deletes it LAST; that cascade-removes
 *                                 `tenant_dunning_settings` via its foreign key.
 *   - `tenant_dunning_settings` — omitted here because it cascades from
 *                                 `tenant_settings`.
 *
 * Deleting these by `tenant_id` is FK-safe in ANY order: every child→parent
 * foreign key among them is `ON DELETE CASCADE` / `SET NULL` (no `RESTRICT`), so
 * a delete can never be blocked by a sibling table. Keep this list in sync when a
 * new tenant-scoped table is added (a `tenant_id` column is the signal).
 */
export const TENANT_SCOPED_TABLES: readonly string[] = [
  "abm_lead_visits",
  "abm_leads",
  "abm_settings",
  "ad_conversion_events",
  "ad_sync_audience_members",
  "ad_sync_runs",
  "ad_sync_settings",
  "adaptive_blocks",
  "admin_user_tenants",
  "agency_branding",
  "ai_decision_logs",
  "audience_segments",
  "behavior_scoring_rules",
  "behavior_sequence_patterns",
  "billing_request_debug_events",
  "credit_balance",
  "credit_transactions",
  "demo_instances",
  "design_effect_sets",
  "design_token_sets",
  "email_sends",
  "enrichment_usage",
  "enrichment_usage_summary",
  "events",
  "experiments",
  "form_submissions",
  "interest_profiles",
  "lead_suppressions",
  "navigation",
  "pages",
  "personalization_sessions",
  "plan_experiments",
  "platform_cms_content",
  "rule_fire_daily",
  "served_variants",
  "session_credit_balances",
  "session_credit_ledger",
  "session_enrichment_cache",
  "site_navigation",
  "subscriptions",
  "tenant_assets",
  "tenant_domains",
  "tenant_email_transport",
  "tenant_form_overrides",
  "tenant_form_settings",
  "tenant_interest_profiles",
  "tenant_pipeline_stages",
  "tenant_search_settings",
  "tenant_site_settings_cache",
  "tenant_site_setup",
  "tenant_sites",
  "tenant_wallets",
  "usage_events",
  "usage_events_summary",
  "usage_summary",
  "visitor_behavior_state",
  "visitor_events",
  "visitor_history",
  "visitor_journey_events",
  "visitor_profiles",
  "wallet_ledger",
  "wallet_reload_attempts",
  "wallet_webhook_events",
  "webhook_deliveries",
];

/**
 * `rules_config` is a shared key-value table with NO `tenant_id` column: each
 * per-tenant config is stored under the key `<type>_<tenantId>`. These are the
 * type prefixes used across the codebase:
 *   - `homepage`         — the tenant's decision rules (load-tenant-rules.ts)
 *   - `retention`        — data-retention policy (retention-policy-store.ts)
 *   - `self_service`     — self-service settings (self-service-store.ts)
 *   - `failure_signals`  — failure-signal state (failure-signal-store.ts)
 */
export const RULES_CONFIG_KEY_PREFIXES = [
  "homepage",
  "retention",
  "self_service",
  "failure_signals",
] as const;

/**
 * The exact `rules_config` keys owned by a tenant. Deleted by EXACT match (via
 * `.in(...)`), never a `LIKE '%_<id>'` — SQL `LIKE` treats `_` as a wildcard and
 * a suffix match could delete another tenant's rows (e.g. tenant `test` vs a key
 * for tenant `x_test`). Exact keys can only ever hit this tenant.
 */
export function rulesConfigKeysForTenant(tenantId: string): string[] {
  return RULES_CONFIG_KEY_PREFIXES.map((prefix) => `${prefix}_${tenantId}`);
}

// ── DB shape ────────────────────────────────────────────────────────────────

type DeleteResponse = { error: { message: string } | null };

/** The minimal slice of the Supabase client this module uses. */
export interface TeardownDb {
  from(table: string): {
    delete(): {
      eq(column: string, value: string): PromiseLike<DeleteResponse>;
      in(column: string, values: readonly string[]): PromiseLike<DeleteResponse>;
    };
  };
}

// ── Teardown ────────────────────────────────────────────────────────────────

/**
 * Delete every tenant-scoped row for `tenantId`: all {@link TENANT_SCOPED_TABLES}
 * by `tenant_id`, plus the tenant's {@link rulesConfigKeysForTenant} in
 * `rules_config`. Does NOT delete `tenant_settings` — the caller does that last so
 * the billing cascade fires after the scoped data is gone.
 *
 * Best-effort: a per-table failure (including a table that does not exist in this
 * environment) is collected and logged, and the sweep continues — one stuck table
 * must not strand the rest. Returns the collected failures for the caller to log.
 */
export async function deleteTenantScopedData(
  db: TeardownDb,
  tenantId: string,
): Promise<{ failures: string[] }> {
  const failures: string[] = [];

  for (const table of TENANT_SCOPED_TABLES) {
    try {
      const { error } = await db.from(table).delete().eq("tenant_id", tenantId);
      if (error) failures.push(`${table}: ${error.message}`);
    } catch (err) {
      failures.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // rules_config: exact keys only (see rulesConfigKeysForTenant).
  try {
    const { error } = await db
      .from("rules_config")
      .delete()
      .in("key", rulesConfigKeysForTenant(tenantId));
    if (error) failures.push(`rules_config: ${error.message}`);
  } catch (err) {
    failures.push(`rules_config: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { failures };
}
