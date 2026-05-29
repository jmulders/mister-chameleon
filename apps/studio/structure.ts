/**
 * Sanity Studio — Custom Desk Structure
 *
 * Clean multi-tenant workspace for internal operators.
 *
 * ─── Top-level hierarchy ──────────────────────────────────────────────────────
 *
 *   Shared content
 *     Site Settings  (singleton)
 *     Navigation Items
 *     Pages (shared)
 *     Hero Variants (shared)
 *     Proof Variants (shared)
 *     CTA Variants (shared)
 *     Feature Variants (shared)
 *     Conversion Variants (shared)
 *     Companies (shared)
 *     News Articles (shared)
 *     Vacancies (shared)
 *
 *   Tenants                         ← one entry per discovered tenant, A–Z
 *     <Tenant Label>
 *       Pages
 *       Hero Variants
 *       Proof Variants
 *       CTA Variants
 *       Feature Variants
 *       Conversion Variants
 *       Companies
 *       News Articles
 *       Vacancies
 *
 *   All documents                   ← flat fallback; useful for debugging
 *
 * ─── Tenant discovery ─────────────────────────────────────────────────────────
 *
 *   At Studio boot the structure function issues a single GROQ query:
 *
 *     array::unique(*[
 *       _type in ["page","heroVariant","proofVariant","ctaVariant",
 *                 "featureVariant","conversionVariant",
 *                 "company","newsArticle","vacancy"]
 *       && defined(tenantId) && tenantId != ""
 *     ].tenantId)
 *
 *   Results are sorted A–Z in TypeScript.  If the query fails (bad token,
 *   network issue) the Studio falls back gracefully: Shared content and
 *   All documents remain fully accessible; the Tenants section is empty.
 *
 * ─── Tenant label resolution ──────────────────────────────────────────────────
 *
 *   1. Check TENANT_DISPLAY_NAMES registry (tenant/display-names.ts)
 *   2. Fall back to title-casing each hyphen-separated slug word:
 *        "mister-chameleon" → "Mister Chameleon"
 *        "workengine"       → "Workengine"
 *
 * ─── Explicit pane IDs ────────────────────────────────────────────────────────
 *
 *   Every list item uses an explicit .id() call so that:
 *
 *   a) The Studio URL structure is stable and deterministic regardless of
 *      display-name changes (Sanity generates IDs from titles when no .id() is
 *      set, so a renamed tenant label could silently change the pane URL).
 *
 *   b) The neutral-landing plugin can reliably detect deep-link paths using
 *      a simple regex rather than having to know the auto-generated IDs.
 *
 *   Top-level IDs:
 *     "shared-content"   → /structure/shared-content
 *     "tenants"          → /structure/tenants
 *     "all-documents"    → /structure/all-documents
 *
 *   Per-tenant IDs:
 *     The tenant's own tenantId value (e.g. "workEngine") is used directly
 *     so the URL segment matches what operators already see in the platform.
 *
 * ─── Internal-only note ───────────────────────────────────────────────────────
 *
 *   This Studio is operator-facing only.  All documents is intentionally
 *   kept as a debugging escape hatch.  The Studio is not a security boundary.
 */

import type { StructureBuilder } from "sanity/structure";
import { getTenantDisplayName }  from "../../tenant/display-names";

// ── Minimal context interface ─────────────────────────────────────────────────
//
// We only use `getClient` from the full Sanity ConfigContext.
// A minimal local interface avoids importing from "sanity" (which drags in
// the entire Studio dependency tree) while remaining structurally compatible.

interface StudioContext {
  getClient: (options: { apiVersion: string }) => {
    fetch: <T = unknown>(query: string, params?: Record<string, unknown>) => Promise<T>;
  };
}

// ── Shared-content helpers ────────────────────────────────────────────────────

/**
 * A list item that shows documents of `schemaType` that have NO tenantId
 * (i.e. platform-wide / shared documents).
 */
function sharedList(S: StructureBuilder, schemaType: string, title: string) {
  return S.listItem()
    .id(schemaType)
    .title(title)
    .child(
      S.documentTypeList(schemaType)
        .title(title)
        .filter(`_type == $schemaType && !defined(tenantId)`)
        .params({ schemaType }),
    );
}

// ── Per-tenant helpers ────────────────────────────────────────────────────────

/**
 * A list item that shows documents of `schemaType` scoped to `tenantId`.
 *
 * The pane ID uses `{schemaType}` so it is stable even if the label changes.
 */
function tenantList(
  S:          StructureBuilder,
  tenantId:   string,
  schemaType: string,
  title:      string,
) {
  return S.listItem()
    .id(schemaType)
    .title(title)
    .child(
      S.documentTypeList(schemaType)
        .title(title)
        .filter(`_type == $schemaType && tenantId == $tenantId`)
        .params({ schemaType, tenantId }),
    );
}

/**
 * A list item that opens the tenant's siteSettings singleton document.
 *
 * Document ID convention: `siteSettings-{tenantId}`
 * This is the same convention used by the tenant provisioner.
 */
function tenantSiteSettingsItem(S: StructureBuilder, tenantId: string) {
  return S.listItem()
    .id(`${tenantId}-siteSettings`)
    .title("Site Settings")
    .child(
      S.document()
        .schemaType("siteSettings")
        .documentId(`siteSettings-${tenantId}`),
    );
}

/**
 * The full content workspace for a single tenant.
 *
 * The pane ID is set to the raw tenantId so the URL path segment matches the
 * platform tenantId — e.g. /structure/tenants;workEngine — without depending
 * on how the display name is formatted or whether it changes.
 *
 * Groups:
 *   Site Settings (singleton)  ← tenant-first: site identity always at the top
 *   Navigation Items           ← tenant-scoped nav items
 *   ─────
 *   Pages
 *   ─────
 *   Hero Variants · Proof Variants · CTA Variants · Feature Variants · Conversion Variants
 *   ─────
 *   Companies · News Articles · Vacancies
 */
function tenantSection(S: StructureBuilder, id: string, label: string) {
  return S.listItem()
    .id(id)          // use raw tenantId as the stable pane ID
    .title(label)
    .child(
      S.list()
        .title(label)
        .items([
          // ── Site identity (tenant-first) ────────────────────────────────
          tenantSiteSettingsItem(S, id),
          tenantList(S, id, "navigationItem", "Navigation Items"),

          S.divider(),

          tenantList(S, id, "page", "Pages"),

          S.divider(),

          tenantList(S, id, "heroVariant",         "Hero Variants"),
          tenantList(S, id, "proofVariant",       "Proof Variants"),
          tenantList(S, id, "ctaVariant",         "CTA Variants"),
          tenantList(S, id, "featureVariant",     "Feature Variants"),
          tenantList(S, id, "conversionVariant",  "Conversion Variants"),
          tenantList(S, id, "notificationVariant","Notification Variants"),

          S.divider(),

          tenantList(S, id, "company",      "Companies"),
          tenantList(S, id, "newsArticle",  "News Articles"),
          tenantList(S, id, "vacancy",      "Vacancies"),
        ]),
    );
}

// ── Structure definition ──────────────────────────────────────────────────────

/**
 * Async structure builder.
 *
 * Sanity Studio v3 supports async structure functions.  The async call here
 * issues a single GROQ query at boot time to discover all tenantIds in the
 * dataset.  The result is injected into the Tenants section.
 */
export const structure = async (S: StructureBuilder, context: StudioContext) => {

  // ── 1. Discover tenants ─────────────────────────────────────────────────────

  let tenantIds: string[] = [];

  try {
    const client = context.getClient({ apiVersion: "2024-01-01" });

    const raw = await client.fetch<string[]>(
      `array::unique(*[
        _type in ["siteSettings", "navigationItem",
                  "page", "heroVariant", "proofVariant", "ctaVariant",
                  "featureVariant", "conversionVariant", "notificationVariant",
                  "company", "newsArticle", "vacancy"]
        && defined(tenantId)
        && tenantId != ""
      ].tenantId)`,
    );

    // Sort alphabetically so the sidebar order is deterministic.
    tenantIds = [...raw].sort();
  } catch (err) {
    // Non-fatal — the Studio remains fully usable.
    // Shared content and All documents are always available.
    console.warn(
      "[studio/structure] Could not fetch tenant IDs — Tenants section will be empty.",
      err,
    );
  }

  // ── 2. Build per-tenant items (with inter-tenant dividers) ──────────────────

  const tenantItems = tenantIds.flatMap((id, i) => [
    tenantSection(S, id, getTenantDisplayName(id)),
    ...(i < tenantIds.length - 1 ? [S.divider()] : []),
  ]);

  // ── 3. Assemble the full structure ──────────────────────────────────────────

  return S.list()
    .title("Content")
    .items([

      // ── Shared / platform-wide content ──────────────────────────────────────
      //   Pane ID: "shared-content"
      //   URL:     /structure/shared-content
      S.listItem()
        .id("shared-content")
        .title("Shared content")
        .child(
          S.list()
            .title("Shared content")
            .items([
              // Site Settings — always the same singleton document
              S.listItem()
                .title("Site Settings")
                .id("siteSettings")
                .child(
                  S.document()
                    .schemaType("siteSettings")
                    .documentId("siteSettings"),
                ),

              S.divider(),

              sharedList(S, "navigationItem", "Navigation Items"),
              sharedList(S, "page",           "Pages"),

              S.divider(),

              sharedList(S, "heroVariant",          "Hero Variants"),
              sharedList(S, "proofVariant",         "Proof Variants"),
              sharedList(S, "ctaVariant",           "CTA Variants"),
              sharedList(S, "featureVariant",       "Feature Variants"),
              sharedList(S, "conversionVariant",    "Conversion Variants"),
              sharedList(S, "notificationVariant",  "Notification Variants"),

              S.divider(),

              sharedList(S, "company",     "Companies"),
              sharedList(S, "newsArticle", "News Articles"),
              sharedList(S, "vacancy",     "Vacancies"),
            ]),
        ),

      S.divider(),

      // ── Tenants (auto-discovered from dataset at Studio boot) ────────────────
      //   Pane ID: "tenants"
      //   URL:     /structure/tenants
      //   Each tenant: /structure/tenants;{tenantId}
      S.listItem()
        .id("tenants")
        .title("Tenants")
        .child(
          S.list()
            .title("Tenants")
            .items(
              tenantItems.length > 0
                ? tenantItems
                // Graceful empty state when no tenant content exists yet
                : [
                    S.listItem()
                      .id("__no-tenants")
                      .title("No tenants found")
                      .child(
                        S.list().title("No tenants found").items([]),
                      ),
                  ],
            ),
        ),

      S.divider(),

      // ── All documents (flat fallback — debugging / data rescue) ──────────────
      //   Pane ID: "all-documents"
      //   URL:     /structure/all-documents
      S.listItem()
        .id("all-documents")
        .title("All documents")
        .child(
          S.list()
            .title("All documents")
            .items([
              ...S.documentTypeListItems().filter(
                (item) => item.getId() !== "__experimental_omnisearch_statistics",
              ),
            ]),
        ),

    ]);
};
