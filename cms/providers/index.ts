/**
 * CMS Providers — barrel export
 *
 * Exports the CMSProvider interface, all concrete implementations,
 * and the environment-driven factory function.
 *
 * Implementations:
 *   MockCMSProvider      — in-memory hardcoded data (dev / testing)
 *   SanityProvider       — Sanity.io CDN + GROQ (production, first priority)
 *   StoryblokProvider    — Storyblok CDN REST API (production, second priority)
 *   StatamicProvider     — Statamic REST API (production, third priority)
 *
 * Provider selection priority:
 *   SANITY_PROJECT_ID set        →  SanityProvider
 *   STORYBLOK_ACCESS_TOKEN set   →  StoryblokProvider
 *   STATAMIC_API_URL set         →  StatamicProvider
 *   None set                     →  MockCMSProvider
 *
 * Environment variables for SanityProvider:
 *   SANITY_PROJECT_ID    required
 *   SANITY_DATASET       required
 *   SANITY_API_VERSION   required
 *   SANITY_READ_TOKEN    optional (draft/preview content only)
 *
 * Environment variables for StoryblokProvider:
 *   STORYBLOK_ACCESS_TOKEN  required
 *   STORYBLOK_REGION        optional ("eu" | "us" | "ap" | "ca" | "cn", default: "eu")
 *   STORYBLOK_VERSION       optional ("published" | "draft", default: "published")
 *
 * Environment variables for StatamicProvider:
 *   STATAMIC_API_URL     required (base URL of Statamic site)
 *   STATAMIC_API_KEY     optional (Bearer token for protected collections)
 */

export type { CMSProvider } from "./cms-provider";
export { MockCMSProvider } from "./mock-provider";
export { SanityProvider } from "./sanity-provider";
export { StoryblokProvider } from "./storyblok-provider";
export { StatamicProvider } from "./statamic-provider";
export { createCMSProvider } from "./create-cms-provider";
