/**
 * Sanity Mappers — barrel export
 *
 * Pure functions that translate raw Sanity GROQ results into internal
 * app content types.
 *
 * Import from "@/cms/mappers/sanity":
 *   import { mapSanityHero, mapSanityProof, mapSanityCTA }
 *     from "@/cms/mappers/sanity";
 */

export {
  mapSanityHero,
  mapSanityProof,
  mapSanityCTA,
  mapSanitySiteSettings,
  mapSanityPage,
} from "./sanity-mappers";
