/**
 * Page store seed — pages/seed.ts
 *
 * Builds the initial set of EditablePages used to populate the page store on
 * first run.  Pages are derived from the MockCMSProvider so the seed content
 * stays in sync with the mock data without duplication.
 *
 * ─── Seeded pages ─────────────────────────────────────────────────────────────
 *
 *   home       — marketing-page with context slots (hero/proof/cta) + 8 blocks
 *   companies  — listing-page (filter bar + company grid)
 *   news       — listing-page (filter bar + article grid)
 *   careers    — listing-page (filter bar + vacancy list + team + FAQ)
 *   contact    — detail-page  (search + filter bar + address + contact form)
 *   join       — article-page (benefits + stats + process + companies + form)
 *
 * ─── Homepage context slots ───────────────────────────────────────────────────
 *
 *   The homepage uses the "marketing-page" template which provides three
 *   adaptive context slots handled by the decision engine at runtime.
 *   The seed records fallback variant keys that activate when no decision
 *   engine assignment is present (e.g. in the admin preview).
 *
 *   hero  → "hero_direct_brand"  (before-content)
 *   proof → "proof_cases"        (before-content)
 *   cta   → "cta_direct_brand"   (after-content)
 *
 * ─── Architecture note ────────────────────────────────────────────────────────
 *
 *   This module imports from MockCMSProvider and the page-config mapper.
 *   The dependency chain is:
 *     pages/seed → cms/providers/mock-provider  (CMS layer, no rendering)
 *     pages/seed → cms/mappers/page-config-mapper (conversion)
 *     pages/seed → pages/types  (EditablePage model)
 *
 *   No circular dependencies are introduced.
 */

import { MockCMSProvider }          from "@/cms/providers/mock-provider";
import { mapPageDataToPageConfig }  from "@/cms/mappers/page-config-mapper";
import type { EditablePage, EditableContextSlot }  from "./types";
import { fromPageConfig }           from "./types";

// ── Context slot defaults for the homepage ────────────────────────────────────

/**
 * Fallback context slots for the "marketing-page" template.
 *
 * These keys match live HERO_VARIANTS / PROOF_VARIANTS / CTA_VARIANTS in
 * MockCMSProvider.  When the decision engine is not involved (e.g. admin
 * preview), these keys are served directly.
 */
const HOMEPAGE_CONTEXT_SLOTS: EditableContextSlot[] = [
  { slotId: "hero",  variantKey: "hero_direct_brand",  position: "before-content" },
  { slotId: "proof", variantKey: "proof_cases",         position: "before-content" },
  { slotId: "cta",   variantKey: "cta_direct_brand",    position: "after-content"  },
];

// ── Seed builder ──────────────────────────────────────────────────────────────

/**
 * Build the initial set of EditablePages from MockCMSProvider data.
 *
 * Called once by the page store on first run.  Each page is fetched via
 * getPageBySlug(), mapped to PageConfig, then converted to EditablePage.
 * The homepage receives special treatment to attach context slots.
 *
 * @returns Ordered array of EditablePages ready for persistence.
 */
export async function getSeedPages(): Promise<EditablePage[]> {
  const provider = new MockCMSProvider();

  // Slugs to seed in display order.
  // These map directly to mock provider routes.
  const slugs = ["home", "companies", "news", "careers", "contact", "join"] as const;

  const results = await Promise.all(
    slugs.map(async (slug) => {
      const pageData = await provider.getPageBySlug(slug);
      if (!pageData) return null;

      // Convert CMS PageData → platform PageConfig → EditablePage.
      const config    = mapPageDataToPageConfig(pageData);
      const editable  = fromPageConfig(config, { tenantId: "workengine" });

      // ── Homepage: attach context slots ──────────────────────────────────────
      //
      // The homepage PageData in MockCMSProvider has no contextConfig (context
      // slots are assigned at request-time by the decision engine on the live
      // site).  For the admin editor we supply the fallback variant keys
      // directly so the preview can render a complete, representative page.
      if (slug === "home") {
        editable.templateKey  = "marketing-page";
        editable.contextSlots = HOMEPAGE_CONTEXT_SLOTS;
      }

      return editable;
    }),
  );

  // Filter out any null results (slugs not found in provider).
  return results.filter((p): p is EditablePage => p !== null);
}
