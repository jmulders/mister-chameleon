/**
 * Sanity GROQ Query Builder
 *
 * A small helper that generates the standard "fetch one variant by key" GROQ
 * query pattern shared across all variant document types.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 *   Every variant document type (heroVariant, proofVariant, ctaVariant, …)
 *   shares the same filter predicate and resolution order:
 *
 *     *[_type == "…" && key == $key && isActive == true
 *       && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))]
 *     | order(select($tenantId != null && tenantId == $tenantId => 1, 0) desc)
 *     [0] { … }
 *
 *   Without a helper, adding a new document type means copying that predicate
 *   verbatim — a typo in one copy silently breaks only that query. The helper
 *   makes the predicate a single source of truth.
 *
 * ─── What stays in the individual query files ────────────────────────────────
 *
 *   Each query file still owns:
 *   - The document type name (e.g. "heroVariant")
 *   - The GROQ projection (the field list inside { … })
 *   - The raw response TypeScript interface
 *
 *   This keeps the schema coupling local to each query file while sharing only
 *   the structural boilerplate.
 *
 * ─── Tenant-scoped variant identity ──────────────────────────────────────────
 *
 *   Variant documents are identified by the composite (tenantId, key) pair,
 *   NOT by key alone.  The same key string (e.g. "hero_direct_brand") is
 *   reusable across tenants — each tenant holds its own independent copy.
 *   Uniqueness within a tenant's key space is enforced by the Sanity Studio
 *   async rule.custom() validator on the string key field (see cms/schemas/heroVariant.ts).
 *
 *   Shared/platform variants have no tenantId set and serve as a global
 *   fallback for any tenant that hasn't created a tenant-specific document
 *   for the requested key.
 *
 * ─── String field: key ───────────────────────────────────────────────────────
 *
 *   The `key` field in all variant schemas is a plain Sanity string type (not
 *   a slug). This was changed from slug type to avoid Sanity's dataset-wide
 *   uniqueness enforcement which prevented two tenants from creating documents
 *   with the same key value.
 *
 *   GROQ comparisons use `key == $key` directly (no `.current` dereference
 *   needed). Each query's projection uses bare `key` (not `"key": key.current`).
 *
 * ─── Tenant filtering and resolution order ───────────────────────────────────
 *
 *   All variant queries include a tenant predicate:
 *
 *     && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))
 *
 *   Callers pass `{ key, tenantId }` as GROQ params:
 *     - `tenantId: null`           → no filtering (all tenants; backward-compat)
 *     - `tenantId: "workengine"`   → documents for that tenant + shared docs
 *                                    (those with no tenantId field set)
 *
 *   When both a tenant-specific document and a shared document exist for the
 *   same key, the tenant-specific document is always preferred.  Achieved via:
 *
 *     | order(select($tenantId != null && tenantId == $tenantId => 1, 0) desc)
 *
 *   Resolution priority:
 *     1. Tenant-specific variant (tenantId == $tenantId)  → priority 1
 *     2. Shared/platform variant  (!defined(tenantId))    → priority 0
 *
 *   When $tenantId == null, all documents receive priority 0 and the order is
 *   natural Sanity document order — same backward-compatible behaviour as
 *   before this ordering was introduced.
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   Documents created before the tenant-scoped model (e.g. a heroVariant with
 *   key = "hero_workengine_default" and tenantId = "workengine") continue
 *   to work without migration.  They are resolved by the existing tenantId filter
 *   whenever the caller passes `$key = "hero_workengine_default"`.  Only new
 *   provisioning and new documents use the clean key convention.
 *
 *   Documents with no tenantId field at all (pre-tenantId era) match the
 *   `!defined(tenantId)` predicate and are treated as shared platform variants.
 *
 * ─── Adding a new variant type ───────────────────────────────────────────────
 *
 *   1. Create cms/queries/sanity/<type>-queries.ts
 *   2. Call buildVariantQuery("<docType>", `<projection>`)
 *   3. Export the query constant and a SanityXxxRaw interface
 *      — use bare `key` in projections (not `"key": key.current`)
 *   4. Register the export in cms/queries/sanity/index.ts
 *
 * @example
 *   export const HERO_BY_KEY_QUERY = buildVariantQuery(
 *     "heroVariant",
 *     `
 *       _id,
 *       tenantId,
 *       key,
 *       title,
 *       subtitle,
 *       ctaLabel,
 *       ctaHref,
 *       tag
 *     `,
 *   );
 */

/**
 * Builds a GROQ query that fetches a single variant document by its `key`
 * string field, returning only documents where `isActive == true`.
 *
 * Resolution order (when tenantId is provided):
 *   1. Tenant-specific document (tenantId == $tenantId) — returned first
 *   2. Shared/platform document (!defined(tenantId))    — fallback
 *
 * ─── Parameters (passed as GROQ params to `client.fetch()`) ──────────────────
 *
 *   $key       string        Required. The variant key, e.g. "hero_google_problem".
 *   $tenantId  string | null Optional. Pass null to skip tenant filtering (all
 *                            tenants); pass a tenant slug to scope to that tenant
 *                            plus shared (tenantId-less) documents.
 *
 * ─── Tenant filter semantics ─────────────────────────────────────────────────
 *
 *   $tenantId == null          → no restriction; natural document order
 *   $tenantId == "workengine"  → tenantId == "workengine" first,
 *                                then !defined(tenantId) as fallback
 *
 * @param docType    The Sanity document `_type` value, e.g. "heroVariant".
 * @param projection GROQ field list to include in the result, indented for
 *                   readability. Do not include the surrounding `{ }` braces.
 *                   Use bare `key` (not `"key": key.current`) in projections.
 */
export function buildVariantQuery(docType: string, projection: string): string {
  return (
    // Filter: type + key (plain string OR legacy slug object) + active flag + tenant scope.
    //
    // DEFENSIVE: Accept both `key == $key` (post-migration plain string) and
    // `key.current == $key` (pre-migration slug format).  Documents that were
    // created before the slug→string migration may still carry the slug shape in
    // the dataset; the OR guard ensures they are still matched.
    `*[_type == "${docType}"` +
    ` && (key == $key || key.current == $key)` +
    ` && isActive == true` +
    ` && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))]` +
    // Locale-aware resolution order (highest score wins):
    //   3 — tenant-specific + locale match   (most specific)
    //   2 — tenant-specific + no locale      (tenant default / EN)
    //   1 — shared/platform + locale match
    //   0 — shared/platform + no locale      (global fallback)
    //
    // When $locale is null or $tenantId is null the ordering degrades
    // gracefully to the prior tenant-only (1/0) behaviour.
    ` | order(select(` +
    `   $tenantId != null && tenantId == $tenantId && $locale != null && locale == $locale => 3,` +
    `   $tenantId != null && tenantId == $tenantId => 2,` +
    `   $locale != null && locale == $locale => 1,` +
    `   0` +
    ` ) desc)` +
    `[0]` +
    ` {${projection}}`
  );
}
