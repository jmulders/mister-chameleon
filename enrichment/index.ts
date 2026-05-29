/**
 * Enrichment Layer — Barrel Export
 *
 * Public API for the enrichment layer.
 * Import from "@/enrichment" to access types, the pipeline, and providers.
 *
 * ─── Module structure ────────────────────────────────────────────────────────
 *
 *   types.ts                      — core interfaces (no project imports)
 *   pipeline.ts                   — runEnrichmentPipeline()
 *   providers/geo.ts              — GeoProvider + adapter
 *   providers/company.ts          — CompanyProvider + adapter
 *   providers/ads-attribution.ts  — AdsAttributionProvider + adapter
 *   providers/crm.ts              — CrmProvider + adapter
 *   providers/account-list.ts     — AccountListProvider + adapter
 *
 * ─── Minimal wiring example ──────────────────────────────────────────────────
 *
 *   import {
 *     runEnrichmentPipeline, buildEnricherInput,
 *     createGeoEnricher,          StubGeoProvider,
 *     createCompanyEnricher,      StubCompanyProvider,
 *     createAdsAttributionEnricher, UtmAdsAttributionProvider,
 *     createCrmEnricher,          StubCrmProvider,
 *     createAccountListEnricher,  StubAccountListProvider,
 *   } from "@/enrichment";
 *
 *   const enrichers = [
 *     createGeoEnricher(new StubGeoProvider()),
 *     createCompanyEnricher(new StubCompanyProvider()),
 *     createAdsAttributionEnricher(new UtmAdsAttributionProvider()),
 *     createCrmEnricher(new StubCrmProvider()),
 *     createAccountListEnricher(new StubAccountListProvider()),
 *   ];
 *
 *   const input  = buildEnricherInput({ ip, tenantId, sessionId, utmParams });
 *   const result = await runEnrichmentPipeline(enrichers, input);
 *   const ctx    = applyEnrichment(baseCtx, result.output);
 */

// ── Core types ────────────────────────────────────────────────────────────────

export type {
  EnrichmentOutput,
  EnricherInput,
  Enricher,
  LabeledEnricher,
  PipelineOptions,
  EnrichmentLogEntry,
  EnrichmentPipelineResult,
  // Staged pipeline types
  StagedEnricher,
  StageTrace,
  StagedPipelineResult,
} from "./types";

// ── Pipeline (parallel) ───────────────────────────────────────────────────────

export { runEnrichmentPipeline, buildEnricherInput } from "./pipeline";

// ── Staged pipeline (sequential) ─────────────────────────────────────────────

export { runStagedPipeline } from "./staged-pipeline";
export type { StagedPipelineOptions } from "./staged-pipeline";

// ── Geo provider ──────────────────────────────────────────────────────────────

export type { GeoOutput, GeoProvider } from "./providers/geo";
export { StubGeoProvider, createGeoEnricher } from "./providers/geo";

// ── Company provider ──────────────────────────────────────────────────────────

export type { CompanyOutput, CompanyProvider } from "./providers/company";
export {
  StubCompanyProvider,
  MockCompanyProvider,
  normalizeCompanyOutput,
  createCompanyEnricher,
} from "./providers/company";

// ── Clearbit Reveal company provider ──────────────────────────────────────────

export { ClearbitCompanyProvider } from "./providers/clearbit-company";

// ── Ads attribution provider ──────────────────────────────────────────────────

export type {
  AdsAttributionOutput,
  AdsAttributionProvider,
} from "./providers/ads-attribution";
export {
  UtmAdsAttributionProvider,
  StubAdsAttributionProvider,
  createAdsAttributionEnricher,
} from "./providers/ads-attribution";

// ── CRM provider ──────────────────────────────────────────────────────────────

export type { CrmOutput, CrmProvider } from "./providers/crm";
export { StubCrmProvider, MockCrmProvider, createCrmEnricher } from "./providers/crm";
export { HubSpotCrmProvider } from "./providers/hubspot-crm";

// ── IP → Company → HubSpot sequential enricher (legacy) ─────────────────────

export { createIpCompanyHubSpotEnricher } from "./providers/ip-company-hubspot-enricher";

// ── New staged providers ───────────────────────────────────────────────────────

export { IpInfoProvider, createIpInfoStagedEnricher } from "./providers/ipinfo";
export type { IpInfoProviderOptions } from "./providers/ipinfo";

export { OpenKvKProvider, createOpenKvKStagedEnricher } from "./providers/openkvk";
export type { OpenKvKProviderOptions } from "./providers/openkvk";

export { LeadinfoProvider, createLeadinfoStagedEnricher } from "./providers/leadinfo";
export type { LeadinfoProviderOptions } from "./providers/leadinfo";

export { buildCompanyCrmChain } from "./providers/staged-company-crm-chain";
export type { CompanyCrmChainOptions } from "./providers/staged-company-crm-chain";

// ── Reverse Geocode provider ──────────────────────────────────────────────────

export { createReverseGeocodeStagedEnricher } from "./providers/reverse-geocode";
export type {
  ReverseGeocodeOptions,
  ReverseGeocodeProvider,
  ReverseGeocodeAddress,
} from "./providers/reverse-geocode";

// ── Weather provider ──────────────────────────────────────────────────────────

export { createWeatherStagedEnricher } from "./providers/weather";
export type { WeatherEnricherOptions } from "./providers/weather";

// ── Provider cache (shared utility) ──────────────────────────────────────────

export { ProviderCache } from "./provider-cache";
export type { CacheResult } from "./provider-cache";

// ── Session enrichment cache ──────────────────────────────────────────────────

export {
  getSessionEnrichment,
  setSessionEnrichment,
  invalidateSessionEnrichment,
  getSessionEnrichmentMeta,
} from "./session-enrichment-cache";
export type {
  SessionCacheHit,
  SessionCacheMiss,
  SessionCacheResult,
} from "./session-enrichment-cache";

// ── Seasonal event provider ───────────────────────────────────────────────────

export {
  NagerDateHolidayProvider,
  createSeasonalEventStagedEnricher,
} from "./providers/seasonal-event";
export type {
  HolidayProvider,
  NagerDateHolidayProviderOptions,
  SeasonalEventEnricherOptions,
} from "./providers/seasonal-event";

// ── Account list provider ─────────────────────────────────────────────────────

export type {
  AccountListOutput,
  AccountListLookupInput,
  AccountListProvider,
} from "./providers/account-list";
export {
  StubAccountListProvider,
  createAccountListEnricher,
} from "./providers/account-list";
