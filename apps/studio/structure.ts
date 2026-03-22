/**
 * Sanity Studio — Custom Desk Structure
 *
 * Organises Studio documents into a clear hierarchy:
 *
 *   ── Shared content ────────────────────────────────────────────────────────
 *     Site Settings     (singleton)
 *     Navigation Items
 *     Pages             (shared / untenanted)
 *     Hero Variants     (shared)
 *     Proof Variants    (shared)
 *     CTA Variants      (shared)
 *
 *   ── WorkEngine ────────────────────────────────────────────────────────────
 *     Pages
 *     Hero Variants
 *     Proof Variants
 *     CTA Variants
 *     Companies
 *     News Articles
 *     Vacancies
 *
 * Adding a new tenant: duplicate the WorkEngine group, change the filter to
 * `tenantId == "your-new-tenant"`, and update the titles.
 */

import type { StructureBuilder } from "sanity/structure";

// ── Helper: filter list by tenantId ───────────────────────────────────────────

function forTenant(tenantId: string) {
  return (S: StructureBuilder, schemaType: string) =>
    S.documentTypeList(schemaType)
      .title(schemaType)
      .filter(`_type == $schemaType && tenantId == $tenantId`)
      .params({ schemaType, tenantId });
}

function sharedOnly(S: StructureBuilder, schemaType: string, title: string) {
  return S.listItem()
    .title(title)
    .child(
      S.documentTypeList(schemaType)
        .title(title)
        .filter(`_type == $schemaType && !defined(tenantId)`)
        .params({ schemaType }),
    );
}

function tenantList(S: StructureBuilder, tenantId: string, schemaType: string, title: string) {
  return S.listItem()
    .title(title)
    .child(
      S.documentTypeList(schemaType)
        .title(title)
        .filter(`_type == $schemaType && tenantId == $tenantId`)
        .params({ schemaType, tenantId }),
    );
}

// ── Structure definition ───────────────────────────────────────────────────────

export const structure = (S: StructureBuilder) =>
  S.list()
    .title("All content")
    .items([
      // ── Shared / platform content ────────────────────────────────────────
      S.listItem()
        .title("Shared content")
        .child(
          S.list()
            .title("Shared content")
            .items([
              // Site Settings singleton — always the same document
              S.listItem()
                .title("Site Settings")
                .id("siteSettings")
                .child(
                  S.document()
                    .schemaType("siteSettings")
                    .documentId("siteSettings"),
                ),

              S.divider(),

              sharedOnly(S, "navigationItem", "Navigation Items"),
              sharedOnly(S, "page", "Pages (shared)"),

              S.divider(),

              sharedOnly(S, "heroVariant", "Hero Variants (shared)"),
              sharedOnly(S, "proofVariant", "Proof Variants (shared)"),
              sharedOnly(S, "ctaVariant", "CTA Variants (shared)"),

              S.divider(),

              sharedOnly(S, "company", "Companies (shared)"),
              sharedOnly(S, "newsArticle", "News Articles (shared)"),
              sharedOnly(S, "vacancy", "Vacancies (shared)"),
            ]),
        ),

      S.divider(),

      // ── WorkEngine ───────────────────────────────────────────────────────
      S.listItem()
        .title("WorkEngine")
        .child(
          S.list()
            .title("WorkEngine")
            .items([
              tenantList(S, "workengine", "page", "Pages"),
              S.divider(),
              tenantList(S, "workengine", "heroVariant", "Hero Variants"),
              tenantList(S, "workengine", "proofVariant", "Proof Variants"),
              tenantList(S, "workengine", "ctaVariant", "CTA Variants"),
              S.divider(),
              tenantList(S, "workengine", "company", "Companies"),
              tenantList(S, "workengine", "newsArticle", "News Articles"),
              tenantList(S, "workengine", "vacancy", "Vacancies"),
            ]),
        ),

      S.divider(),

      // ── All documents (flat fallback — useful for debugging) ─────────────
      S.listItem()
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
