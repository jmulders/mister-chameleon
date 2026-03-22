/**
 * CMS Mappers — barrel export
 *
 * Pure functions that translate CMS data shapes into platform-internal types.
 *
 * Import from "@/cms/mappers" to access all mappers:
 *
 *   import { mapHeroBlockData, mapProofBlockData, mapCTABlockData }
 *     from "@/cms/mappers";
 *
 *   import {
 *     mapSectionsToContentBlocks,
 *     mapContextConfigToResolvedSlots,
 *     mapPageDataToPageConfig,
 *   } from "@/cms/mappers";
 */

// ── Block data → component prop mappers ──────────────────────────────────────

export {
  mapHeroBlockData,
  mapProofBlockData,
  mapCTABlockData,
} from "./content-mappers";

// ── CMS PageData → platform PageConfig mappers ────────────────────────────────

export {
  mapSectionsToContentBlocks,
  mapContextConfigToResolvedSlots,
  mapPageDataToPageConfig,
} from "./page-config-mapper";

// ── Entity document → PageData assemblers ─────────────────────────────────────

export {
  mapNewsArticleToPageData,
  mapVacancyToPageData,
  mapCompanyToPageData,
} from "./entity-page-assemblers";
