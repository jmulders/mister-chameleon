/**
 * Enrichment Layer — IP Classification Utilities
 *
 * Provides two capabilities consumed by the staged enrichment pipeline:
 *
 * ─── 1. IP version detection ──────────────────────────────────────────────────
 *
 *   `detectIpVersion(ip)` classifies an IP address as "ipv4" or "ipv6".
 *
 *   Detection rule: IPv6 addresses contain at least one colon character.
 *   IPv4-mapped IPv6 addresses ("::ffff:a.b.c.d") are classified as "ipv6"
 *   because the transport-layer address IS an IPv6 address; the embedded IPv4
 *   payload is a higher-level concern.
 *
 *   Used by `createIpClassificationEnricher` to write `ipVersion` into the
 *   accumulated enrichment context so downstream rules and AI context can
 *   branch on address family.
 *
 * ─── 2. Cloud / datacenter IP detection ──────────────────────────────────────
 *
 *   `isCloudProviderIp(networkOrg, networkAsn)` returns true when the network
 *   signals produced by IPinfo Lite indicate that the IP belongs to a major
 *   cloud hosting provider, CDN, or datacenter — not a genuine end-user network.
 *
 *   Detection is two-pronged:
 *     a) ASN allowlist  — an exact-match Set of well-known datacenter ASNs
 *     b) Org name regex — pattern matching against the human-readable org name
 *
 *   Either signal alone is sufficient to flag the IP as a cloud provider.
 *
 *   Why this matters:
 *     Automated crawlers, CI pipelines, and bot traffic often arrive from cloud
 *     ranges.  Running company-identification enrichment (OpenKvK, Leadinfo) on
 *     these IPs wastes API quota and produces misleading results (the "company"
 *     would be the cloud provider, not the actual visitor's employer).  Setting
 *     `isCloudProvider = true` lets downstream gates skip those stages cleanly.
 *
 * ─── Staged enrichers ─────────────────────────────────────────────────────────
 *
 *   `createIpClassificationEnricher()` — Stage 0 in the pipeline.
 *     Reads `input.ip` (the raw request IP, not the dev substitute) and writes
 *     `ipVersion` into the accumulated context.  Zero-latency: no I/O.
 *
 *   `createCloudDetectionEnricher()` — Runs after IPinfo Lite.
 *     Reads `accumulated.networkOrg` and `accumulated.networkAsn` (populated by
 *     the IPinfo stage) and writes `isCloudProvider`.  Zero-latency: in-memory
 *     pattern match only.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput } from "./types";

// ── IP version detection ───────────────────────────────────────────────────────

/**
 * Classify an IP address as IPv4 or IPv6.
 *
 * Rule: any address containing `:` is IPv6 — this covers full-form
 * `2001:4860:7:21f::ff`, compressed `::1`, and IPv4-mapped `::ffff:1.2.3.4`.
 * Addresses without `:` are treated as IPv4 (dotted-decimal notation).
 *
 * Returns `null` when `ip` is null or an empty string.
 */
export function detectIpVersion(ip: string | null): "ipv4" | "ipv6" | null {
  if (!ip || !ip.trim()) return null;
  return ip.includes(":") ? "ipv6" : "ipv4";
}

// ── Cloud / datacenter ASN allowlist ──────────────────────────────────────────
//
// Covers the major hyperscalers, CDNs, and datacenter hosting providers whose
// IP ranges are used almost exclusively for automated/cloud workloads rather
// than genuine end-user browsing.
//
// Format: "AS" prefix + numeric ASN, matching IPinfo's `networkAsn` field.
// e.g. "AS15169" (Google), "AS16509" (Amazon), "AS13335" (Cloudflare).

const CLOUD_ASNS = new Set<string>([
  // Google Cloud / Google LLC
  "AS15169", "AS396982", "AS36385", "AS36040", "AS36492",
  // Amazon / AWS
  "AS16509", "AS14618", "AS38895",
  // Microsoft / Azure
  "AS8075", "AS8068", "AS8069", "AS8070", "AS8071", "AS8072",
  // Cloudflare
  "AS13335",
  // Fastly (CDN)
  "AS54113",
  // Akamai
  "AS20940", "AS16625", "AS18717", "AS17204",
  // DigitalOcean
  "AS14061",
  // Linode / Akamai Cloud
  "AS63949", "AS394383",
  // OVH / OVHcloud
  "AS16276", "AS35540",
  // Hetzner Online
  "AS24940",
  // Vultr
  "AS20473",
  // Oracle Cloud
  "AS31898", "AS31836",
  // IBM / SoftLayer
  "AS36459", "AS36351",
  // Zscaler
  "AS22616", "AS62041",
  // Netlify
  "AS394192",
  // Vercel
  "AS270672", "AS140419",
  // GitHub
  "AS36459",
  // Salesforce
  "AS41898",
]);

// ── Cloud / datacenter org name patterns ──────────────────────────────────────
//
// Applied case-insensitively to IPinfo's `networkOrg` field (e.g. "Google LLC",
// "Amazon.com, Inc.", "MICROSOFT-CORP-MSN-AS-BLOCK").
// Word-boundary anchors avoid false positives on org names that merely contain
// a common word (e.g. "Azure Consultants BV" is NOT Microsoft Azure).

const CLOUD_ORG_PATTERN =
  /\b(google|amazon|amazon\.com|aws|microsoft|azure|cloudflare|fastly|akamai|digitalocean|linode|ovh|hetzner|vultr|oracle cloud|softlayer|ibm cloud|zscaler|netlify|vercel|github|salesforce|rackspace|maxcdn|cdn77|bunnycdn|leaseweb|serverius|selectel|hostwinds|choopa|quadranet|psychz|tzulo)\b/i;

/**
 * Returns true when the network signals indicate a cloud hosting provider,
 * CDN, or datacenter — rather than a genuine end-user residential or
 * corporate network.
 *
 * @param networkOrg — human-readable org name from IPinfo (e.g. "Google LLC")
 * @param networkAsn — ASN string from IPinfo (e.g. "AS15169")
 */
export function isCloudProviderIp(
  networkOrg: string | null | undefined,
  networkAsn: string | null | undefined,
): boolean {
  if (networkAsn && CLOUD_ASNS.has(networkAsn)) return true;
  if (networkOrg && CLOUD_ORG_PATTERN.test(networkOrg))  return true;
  return false;
}

// ── Stage: IP Classification ──────────────────────────────────────────────────

/**
 * Creates a zero-latency staged enricher that classifies the request IP's
 * address family and writes `ipVersion` into the accumulated context.
 *
 * Must run as the **first stage** (before MaxMind / IPinfo) so that all
 * subsequent stages and debug output have the IP version available.
 *
 * Uses `input.ip` — the raw request IP — rather than `input.effectiveIp` so
 * that the dev-fallback substitution (8.8.8.8) never misrepresents the actual
 * address family of the incoming connection.
 */
export function createIpClassificationEnricher(): StagedEnricher {
  return {
    label: "IP Classification",

    enricher: async (
      input: EnricherInput,
    ): Promise<Partial<EnrichmentOutput>> => {
      const ipVersion = detectIpVersion(input.ip);
      return { ipVersion };
    },
  };
}

// ── Stage: Cloud Provider Detection ──────────────────────────────────────────

/**
 * Creates a zero-latency staged enricher that detects cloud / datacenter IPs
 * and writes `isCloudProvider` into the accumulated context.
 *
 * Must run **after** the IPinfo Lite stage so that `accumulated.networkOrg`
 * and `accumulated.networkAsn` are available.
 *
 * When `isCloudProvider` is true, downstream stages that perform company
 * identification (OpenKvK, Leadinfo) should skip — they would only return the
 * cloud provider's own company record, which is meaningless for personalisation.
 */
export function createCloudDetectionEnricher(options?: { isDev?: boolean }): StagedEnricher {
  const isDev = options?.isDev ?? false;

  return {
    label: "Cloud Detection",

    enricher: async (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): Promise<Partial<EnrichmentOutput>> => {
      const result = isCloudProviderIp(accumulated.networkOrg, accumulated.networkAsn);

      if (isDev && result) {
        console.debug("[cloud-detection] flagged as cloud/datacenter IP", {
          networkOrg: accumulated.networkOrg,
          networkAsn: accumulated.networkAsn,
        });
      }

      return { isCloudProvider: result };
    },
  };
}
