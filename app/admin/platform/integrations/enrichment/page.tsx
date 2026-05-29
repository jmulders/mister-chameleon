/**
 * Admin — Integrations › Enrichment
 *
 * Platform-wide data enrichment settings page.
 * Accessible at /admin/platform/integrations/enrichment.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   MaxMind GeoIP  — IP geolocation (city, country, region)
 *   Clearbit       — Reverse-IP company firmographics (name, domain, industry, size)
 *   IPinfo Lite    — ASN / network org enrichment (networkAsn, networkOrg, networkDomain)
 *   Leadinfo       — IP-to-company identification (commercial, Western Europe focus)
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This server component calls the platform settings actions which strip all
 *   secret values before returning.  Only boolean flags and non-secret config
 *   (accountId) are passed to the client component.
 */

import Link                                from "next/link";
import { getPlatformSettingsAction }       from "@/app/admin/platform/settings/actions";
import {
  getEnrichmentPlatformSettingsAction,
  getOpenKvKPlatformSettingsAction,
  getHolidayPlatformSettingsAction,
  getReverseGeocodePlatformSettingsAction,
  getWeatherPlatformSettingsAction,
  getGa4HistoryPlatformSettingsAction,
} from "./actions";
import { EnrichmentPlatformClient }        from "./_components/EnrichmentPlatformClient";

export default async function IntegrationsEnrichmentPage() {
  const [platformResult, enrichmentResult, openKvKResult, holidayResult, reverseGeocodeResult, weatherResult, ga4HistoryResult] = await Promise.all([
    getPlatformSettingsAction(),
    getEnrichmentPlatformSettingsAction(),
    getOpenKvKPlatformSettingsAction(),
    getHolidayPlatformSettingsAction(),
    getReverseGeocodePlatformSettingsAction(),
    getWeatherPlatformSettingsAction(),
    getGa4HistoryPlatformSettingsAction(),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Enrichment — Platform Credentials</h1>
        <p className="mt-1 text-sm text-neutral-500">
          API keys for IP enrichment providers. This page stores <strong>secrets only</strong> —
          which providers are active for each tenant is configured in each tenant&apos;s
          Integrations workspace tab.
        </p>
      </div>

      {/* Delegation note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Enable enrichment per tenant</strong> in each tenant&apos;s{" "}
        <Link href="/admin/tenants" className="font-medium text-brand-600 hover:underline">
          Integrations workspace tab
        </Link>
        . The credentials here are shared; tenant toggles control which providers run for each tenant.
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Secrets stay server-side.</strong> API keys are stored encrypted
        at rest and never returned to the browser after saving.
        The UI shows only whether a key is configured, not its value.
      </div>

      {/* Error loading MaxMind settings */}
      {!platformResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load MaxMind settings</p>
          <p className="mt-1 text-xs text-red-700">{platformResult.error}</p>
        </div>
      )}

      {/* Error loading enrichment settings */}
      {!enrichmentResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load enrichment provider settings</p>
          <p className="mt-1 text-xs text-red-700">{enrichmentResult.error}</p>
        </div>
      )}

      {/* Error loading OpenKvK settings */}
      {!openKvKResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load OpenKvK settings</p>
          <p className="mt-1 text-xs text-red-700">{openKvKResult.error}</p>
        </div>
      )}

      {/* Error loading holiday settings */}
      {!holidayResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load holiday provider settings</p>
          <p className="mt-1 text-xs text-red-700">{holidayResult.error}</p>
        </div>
      )}

      {/* Error loading reverse geocode settings */}
      {!reverseGeocodeResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load reverse geocode settings</p>
          <p className="mt-1 text-xs text-red-700">{reverseGeocodeResult.error}</p>
        </div>
      )}

      {/* Error loading weather settings */}
      {!weatherResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load weather settings</p>
          <p className="mt-1 text-xs text-red-700">{weatherResult.error}</p>
        </div>
      )}

      {/* Error loading GA4 History settings */}
      {!ga4HistoryResult.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load GA4 History settings</p>
          <p className="mt-1 text-xs text-red-700">{ga4HistoryResult.error}</p>
        </div>
      )}

      {/* Settings forms */}
      <EnrichmentPlatformClient
        // MaxMind
        accountId={platformResult.ok ? (platformResult.maxmind.accountId ?? "") : ""}
        hasLicenseKey={platformResult.ok ? platformResult.maxmind.hasLicenseKey : false}
        updatedAt={platformResult.ok ? (platformResult.maxmind.updatedAt ?? null) : null}
        // Clearbit
        hasClearbitKey={enrichmentResult.ok ? enrichmentResult.hasClearbitKey : false}
        // IPinfo
        hasIpinfoToken={enrichmentResult.ok ? enrichmentResult.hasIpinfoToken : false}
        // Leadinfo
        hasLeadinfoKey={enrichmentResult.ok ? enrichmentResult.hasLeadinfoKey : false}
        // overheid.io (OpenKvK)
        hasOvioApiKey={enrichmentResult.ok ? enrichmentResult.hasOvioApiKey : false}
        enrichmentUpdatedAt={enrichmentResult.ok ? enrichmentResult.updatedAt : null}
        // OpenKvK
        openKvKMode={openKvKResult.ok ? openKvKResult.mode : "off"}
        openKvKConfidenceThreshold={openKvKResult.ok ? openKvKResult.confidenceThreshold : 0.5}
        openKvKMatchingStrategy={openKvKResult.ok ? openKvKResult.matchingStrategy : "networkOrg"}
        openKvKUpdatedAt={openKvKResult.ok ? openKvKResult.updatedAt : null}
        // Holidays / Nager.Date
        holidayEnabled={holidayResult.ok ? holidayResult.enabled : false}
        holidayCacheTtlHours={holidayResult.ok ? holidayResult.cacheTtlHours : 24}
        holidayCountriesFilter={holidayResult.ok ? holidayResult.countriesFilter : ""}
        holidayUpdatedAt={holidayResult.ok ? holidayResult.updatedAt : null}
        // Reverse Geocode
        reverseGeocodeEnabled={reverseGeocodeResult.ok ? reverseGeocodeResult.enabled : false}
        reverseGeocodeHasLocationIqKey={reverseGeocodeResult.ok ? reverseGeocodeResult.hasLocationIqApiKey : false}
        reverseGeocodeCacheTtlHours={reverseGeocodeResult.ok ? reverseGeocodeResult.cacheTtlHours : 6}
        reverseGeocodeUpdatedAt={reverseGeocodeResult.ok ? reverseGeocodeResult.updatedAt : null}
        // Weather
        weatherEnabled={weatherResult.ok ? weatherResult.enabled : false}
        weatherCacheTtlHours={weatherResult.ok ? weatherResult.cacheTtlHours : 1}
        weatherUpdatedAt={weatherResult.ok ? weatherResult.updatedAt : null}
        // GA4 Analytics History
        ga4HistoryEnabled={ga4HistoryResult.ok ? ga4HistoryResult.enabled : false}
        ga4HistoryHasServiceAccount={ga4HistoryResult.ok ? ga4HistoryResult.hasServiceAccount : false}
        ga4HistoryPropertyId={ga4HistoryResult.ok ? ga4HistoryResult.propertyId : ""}
        ga4HistoryVisitorIdDimension={ga4HistoryResult.ok ? ga4HistoryResult.visitorIdDimension : "visitor_id"}
        ga4HistoryLookbackDays={ga4HistoryResult.ok ? ga4HistoryResult.lookbackDays : 90}
        ga4HistoryCacheTtlMinutes={ga4HistoryResult.ok ? ga4HistoryResult.cacheTtlMinutes : 30}
        ga4HistoryMeasurementId={ga4HistoryResult.ok ? ga4HistoryResult.measurementId : ""}
        ga4HistoryVisitorIdParamName={ga4HistoryResult.ok ? ga4HistoryResult.visitorIdParamName : "visitor_id"}
        ga4HistorySendMode={ga4HistoryResult.ok ? ga4HistoryResult.sendMode : "off"}
        ga4HistoryUpdatedAt={ga4HistoryResult.ok ? ga4HistoryResult.updatedAt : null}
      />

    </div>
  );
}
