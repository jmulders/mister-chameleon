/**
 * Site Models — Public API
 *
 * This is the single import point for the composable site model system.
 *
 * ─── Exports ──────────────────────────────────────────────────────────────────
 *
 *   Types          SiteModel, SiteModelKey, PageType, PageTypeKey,
 *                  BlueprintCompositionMeta, SiteModelPage
 *
 *   Models         SERVICE_MODEL, PRODUCT_SAAS_MODEL, CAREERS_MODEL,
 *                  CATALOG_MODEL, COMMERCE_MODEL
 *
 *   Page types     HOMEPAGE_PAGE_TYPE, OVERVIEW_PAGE_TYPE, DETAIL_PAGE_TYPE,
 *                  FORM_PAGE_TYPE, PROCESS_PAGE_TYPE, PAGE_TYPE_LIBRARY
 *
 *   Composition    composeBlueprint()
 *
 *   Registry       SITE_MODEL_REGISTRY, SITE_MODEL_CATALOG,
 *                  getSiteModel(), getSiteModelsForIndustry()
 *
 * ─── Quick example ────────────────────────────────────────────────────────────
 *
 *   import { composeBlueprint, SERVICE_MODEL } from "@/blueprints/site-models";
 *
 *   export const lawFirmBlueprint = composeBlueprint({
 *     key:         "law_firm",
 *     name:        "Advocatenkantoor",
 *     description: "Vertrouwenwekkend startpunt voor advocatenkantoren en juridische dienstverleners.",
 *     industry:    "professional_services",
 *     models:      [SERVICE_MODEL],
 *     recommendedThemePreset: "editorial-classic",
 *     recommendedThemeFamily: "Editorial Authority",
 *   });
 */

// ── Type exports ──────────────────────────────────────────────────────────────

export type {
  PageTypeKey,
  SiteModelKey,
  PageType,
  PageTypeBlock,
  SiteModel,
  SiteModelPage,
  BlueprintCompositionMeta,
} from "./types";

// ── Page template library ─────────────────────────────────────────────────────

export {
  HOMEPAGE_PAGE_TYPE,
  OVERVIEW_PAGE_TYPE,
  DETAIL_PAGE_TYPE,
  FORM_PAGE_TYPE,
  PROCESS_PAGE_TYPE,
  PAGE_TYPE_LIBRARY,
  getPageType,
} from "./page-template-library";

// ── Site models ───────────────────────────────────────────────────────────────

export { SERVICE_MODEL }      from "./service";
export { PRODUCT_SAAS_MODEL } from "./product-saas";
export { CAREERS_MODEL }      from "./careers";
export { CATALOG_MODEL }      from "./catalog";
export { COMMERCE_MODEL }     from "./commerce";

// ── Blueprint composer ────────────────────────────────────────────────────────

export { composeBlueprint } from "./compose";

// ── Registry ──────────────────────────────────────────────────────────────────

import type { SiteModel, SiteModelKey }  from "./types";
import type { BlueprintIndustry }        from "../blueprint-types";
import { SERVICE_MODEL }                 from "./service";
import { PRODUCT_SAAS_MODEL }            from "./product-saas";
import { CAREERS_MODEL }                 from "./careers";
import { CATALOG_MODEL }                 from "./catalog";
import { COMMERCE_MODEL }                from "./commerce";

/**
 * Ordered registry of all site models.
 * Used by the admin setup wizard ("Initialize Site") to display model cards.
 */
export const SITE_MODEL_REGISTRY: readonly SiteModel[] = [
  SERVICE_MODEL,
  PRODUCT_SAAS_MODEL,
  CAREERS_MODEL,
  CATALOG_MODEL,
  COMMERCE_MODEL,
] as const;

/**
 * Lookup map: SiteModelKey → SiteModel.
 */
export const SITE_MODEL_CATALOG: Readonly<Record<SiteModelKey, SiteModel>> = {
  "service":      SERVICE_MODEL,
  "product-saas": PRODUCT_SAAS_MODEL,
  "careers":      CAREERS_MODEL,
  "catalog":      CATALOG_MODEL,
  "commerce":     COMMERCE_MODEL,
};

/**
 * Retrieve a SiteModel by key.
 * Throws if the key is not found (indicates a programming error).
 */
export function getSiteModel(key: SiteModelKey): SiteModel {
  const model = SITE_MODEL_CATALOG[key];
  if (!model) throw new Error(`[site-models] Unknown SiteModelKey: "${key}"`);
  return model;
}

/**
 * Return all site models that list the given industry as a compatible fit.
 * Useful for auto-suggestion in the blueprint setup wizard.
 */
export function getSiteModelsForIndustry(industry: BlueprintIndustry): SiteModel[] {
  return SITE_MODEL_REGISTRY.filter((m) => m.industries.includes(industry));
}
