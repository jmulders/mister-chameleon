/**
 * CMS Queries
 *
 * All GROQ queries for Sanity are defined here as named constants.
 * Keeping queries co-located makes them easy to audit and test.
 *
 * Naming convention: <ENTITY>_<OPERATION>_QUERY
 * e.g. EXPERIENCE_BY_KEY_QUERY, PAGE_BY_SLUG_QUERY
 *
 * TODO: Implement queries once Sanity schema is defined.
 */

/** Placeholder — returns all experience documents. */
export const ALL_EXPERIENCES_QUERY = `*[_type == "experience"]` as const;

/** Placeholder — returns a single experience by its key. */
export const EXPERIENCE_BY_KEY_QUERY = `
  *[_type == "experience" && key == $key][0]
` as const;
