/**
 * Context detection helpers
 *
 * Three pure utility functions consumed by detectVisitorContext().
 * Each function is independently testable, has no side effects,
 * and depends only on built-in browser/Node APIs.
 *
 *  parseReferrer  — extracts hostname + traffic source hint from a Referer header
 *  readCookies    — parses a raw Cookie header string into a Map
 *  detectDevice   — classifies a User-Agent string as mobile or desktop
 */

import type { DeviceType, TrafficSource } from "./types";

// ── parseReferrer ─────────────────────────────────────────────────────────────

export interface ParsedReferrer {
  /** Raw value passed in — preserved for logging */
  raw: string;
  /** Hostname only, lowercased. e.g. "www.linkedin.com" → "linkedin.com" */
  domain: string | null;
  /**
   * Traffic source inferred from the referrer domain alone.
   * null means "we recognise the domain but it has no special meaning yet",
   * so the caller should fall back to UTM params before defaulting to "unknown".
   */
  inferredSource: TrafficSource | null;
}

/**
 * Parse the Referer request header value.
 *
 * Returns null when the input is null/empty (i.e. direct traffic or
 * a browser that strips the header for privacy reasons).
 */
export function parseReferrer(referrerHeader: string | null): ParsedReferrer | null {
  if (!referrerHeader || referrerHeader.trim() === "") return null;

  let domain: string | null = null;

  try {
    // URL constructor is available in every modern runtime incl. Edge
    const url = new URL(referrerHeader);
    // Strip leading "www." for consistent matching
    domain = url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    // Malformed referrer — keep domain null, still return the raw value
  }

  const inferredSource = domain ? inferSourceFromDomain(domain) : null;

  return { raw: referrerHeader, domain, inferredSource };
}

/**
 * Map a referrer domain to a known TrafficSource, if possible.
 * Returns null for domains we don't have rules for.
 */
function inferSourceFromDomain(domain: string): TrafficSource | null {
  // LinkedIn — covers linkedin.com and all country subdomains
  if (domain === "linkedin.com" || domain.endsWith(".linkedin.com")) {
    return "linkedin";
  }

  // Google — covers google.com, google.co.uk, google.de, etc.
  if (domain === "google.com" || /^google\.[a-z]{2,6}(\.[a-z]{2})?$/.test(domain)) {
    return "google";
  }

  return null;
}

// ── readCookies ───────────────────────────────────────────────────────────────

/**
 * Parse the raw Cookie request header into a key→value Map.
 *
 * Handles edge cases:
 *  - Empty / null header → empty Map
 *  - Duplicate cookie names → last value wins (RFC 6265 is ambiguous; this is pragmatic)
 *  - URL-encoded values are NOT decoded here — callers should decode if needed
 *
 * @example
 *   readCookies("mc_seen=1; theme=dark")
 *   // → Map { "mc_seen" => "1", "theme" => "dark" }
 */
export function readCookies(cookieHeader: string | null): Map<string, string> {
  const map = new Map<string, string>();

  if (!cookieHeader || cookieHeader.trim() === "") return map;

  for (const pair of cookieHeader.split(";")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue; // malformed pair — skip

    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();

    if (key.length > 0) {
      map.set(key, value);
    }
  }

  return map;
}

// ── detectDevice ──────────────────────────────────────────────────────────────

/**
 * Tokens present in mobile User-Agent strings.
 * Kept as a compiled RegExp for performance (called on every request).
 *
 * Covers:
 *  iOS devices (iPhone, iPod — iPad intentionally excluded, classified as desktop)
 *  Android phones (not tablets — "Android" alone can be a tablet, so we require "Mobile")
 *  Windows Phone
 *  BlackBerry
 *  Generic "Mobile" token (Opera Mini, feature phones, etc.)
 */
const MOBILE_UA_REGEX =
  /iPhone|iPod|(Android.*Mobile)|Windows Phone|BlackBerry|Mobile Safari\/[0-9]|Mobile\/[0-9]/i;

/**
 * Classify a User-Agent string as "mobile" or "desktop".
 *
 * Defaults to "desktop" when the User-Agent is absent or unrecognised —
 * the safer assumption for content rendering.
 */
export function detectDevice(userAgent: string | null): DeviceType {
  if (!userAgent) return "desktop";
  return MOBILE_UA_REGEX.test(userAgent) ? "mobile" : "desktop";
}
