/**
 * Ad-platform audience sync — shared types.
 *
 * The tenant-facing config (segment definition + per-platform credentials) and
 * the normalized "audience member" shape that every platform client consumes.
 *
 * See docs/lead-base-design.md (Retargeting / ad-audience sync).
 */

import type { IdentityLevel, ProfileStatus } from "@/lib/lead-base/profile-gate";

export type AdPlatform = "google" | "meta" | "linkedin";

export const AD_PLATFORMS: readonly AdPlatform[] = ["google", "meta", "linkedin"] as const;

// ── Segment definition ─────────────────────────────────────────────────────────

/**
 * Which leads land in the retargeting audience. All criteria are ANDed. Empty =
 * every lead that carries a matchable identifier (email). `requireConsent`
 * restricts to leads whose consent state permits marketing use of their data.
 */
export interface AdSyncSegment {
  /** Minimum identity level, ordered anonymous < recognised < known < customer. */
  minIdentityLevel?: IdentityLevel;
  /** Exact profile status match, e.g. only "mql" / "sql". */
  status?:           ProfileStatus;
  /** Minimum stored intent score (visitor_profiles.intent_score). */
  minIntent?:        number;
  /** Minimum computed 0–100 hot score (identity + intent + recency + engagement). */
  minScore?:         number;
  /** Optional audience_segments key the profile must carry in segment_ids. */
  segmentKey?:       string;
  /**
   * When true, only include leads whose consent_state is "granted" OR who are
   * first-party self-identified ABM leads (legitimate interest). Default true.
   */
  requireConsent?:   boolean;
}

// ── Per-platform credentials ────────────────────────────────────────────────────

export interface GoogleAdsConfig {
  /** @deprecated Not used by the Data Manager API path (kept for stored data). */
  developerToken?:   string;
  loginCustomerId?:  string;   // MCC id (digits only) → Destination.loginAccount
  customerId?:       string;   // target Ads account id (digits) → Destination.operatingAccount
  clientId?:         string;   // OAuth2 client
  clientSecret?:     string;
  refreshToken?:     string;   // OAuth2 refresh token, scope: .../auth/datamanager
  userListId?:       string;   // Customer Match user list id → Destination.productDestinationId
}

export interface MetaConfig {
  accessToken?:  string;   // long-lived system-user token, ads_management scope
  adAccountId?:  string;   // act_XX…  (with or without the act_ prefix)
  audienceId?:   string;   // target Custom Audience id
}

export interface LinkedInConfig {
  accessToken?:   string;  // OAuth2 access token, r_ads + rw_dmp_segments
  adAccountId?:   string;  // sponsored account id (digits only)
  dmpSegmentId?:  string;  // target DMP Segment id (numeric)
}

export interface AdSyncSettings {
  tenantId:  string;
  enabled:   boolean;
  segment:   AdSyncSegment;
  google:    GoogleAdsConfig | null;
  meta:      MetaConfig | null;
  linkedin:  LinkedInConfig | null;
  lastRunAt: string | null;
}

// ── Audience member (pre-hash) ─────────────────────────────────────────────────

/**
 * One matchable person, resolved from the Lead Base. Raw PII — hashed by each
 * client immediately before sending; never logged, never leaves the server raw.
 */
export interface AudienceMember {
  email?:      string | null;
  phone?:      string | null;   // E.164 preferred
  firstName?:  string | null;
  lastName?:   string | null;
  country?:    string | null;   // ISO-3166 alpha-2, aids Google/Meta match
}

// ── Result shapes ──────────────────────────────────────────────────────────────

export interface PlatformSyncResult {
  ok:              boolean;
  platform:        AdPlatform;
  status:          "ok" | "error" | "skipped";
  membersTotal:    number;   // matchable members currently in the segment
  membersSent:     number;   // members added this run
  membersRemoved?: number;   // members removed this run (reconcile / erasure)
  error?:          string;
}

/** One recorded push to one platform (row of ad_sync_runs), for the admin log. */
export interface AdSyncRun {
  id:             string;
  platform:       AdPlatform;
  status:         "ok" | "error" | "skipped";
  membersTotal:   number;
  membersSent:    number;
  membersRemoved: number;
  trigger:        "cron" | "manual";
  error:          string | null;
  createdAt:      string;
}
