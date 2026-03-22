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
 *     *[_type == "…" && key.current == $key && isActive == true
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
 * ─── Slug field: key.current ─────────────────────────────────────────────────
 *
 *   The `key` field in all variant schemas is a Sanity slug type:
 *
 *     { _type: "slug", current: "hero_google_problem" }
 *
 *   GROQ comparisons must use `key.current == $key` (not `key == $key`) to
 *   compare the nested string value rather than the slug object itself.
 *   Each query's projection must also dereference: `"key": key.current`.
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
 * ─── Adding a new variant type ───────────────────────────────────────────────
 *
 *   1. Create cms/queries/sanity/<type>-queries.ts
 *   2. Call buildVariantQuery("<docType>", `<projection>`)
 *   3. Export the query constant and a SanityXxxRaw interface
 *      — remember to project key as `"key": key.current` in the projection
 *   4. Register the export in cms/queries/sanity/index.ts
 *
 * @example
 *   export const HERO_BY_KEY_QUERY = buildVariantQuery(
 *     "heroVariant",
 *     `
 *       _id,
 *       tenantId,
 *       "key": key.current,
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
 * slug field, returning only documents where `isActive == true`.
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
 *                   Use `"key": key.current` (not bare `key`) in projections.
 */
export function buildVariantQuery(docType: string, projection: string): string {
  return (
    // Filter: type + key (slug dereference) + active flag + tenant scope
    `*[_type == "${docType}" && key.current == $key && isActive == true` +
    ` && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))]` +
    // Order: tenant-specific (priority 1) before shared/platform (priority 0).
    // When $tenantId == null, all docs score 0 → natural Sanity order preserved.
    ` | order(select($tenantId != null && tenantId == $tenantId => 1, 0) desc)` +
    `[0]` +
    ` {${projection}}`
  );
}
