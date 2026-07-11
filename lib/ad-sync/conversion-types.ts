/**
 * Ad-platform conversion feedback — shared types.
 *
 * The counterpart to the retargeting audience sync: a conversion (a lead that
 * qualified / submitted a form / became a customer) is sent server-side back to
 * the ad platforms so their bidding optimizes toward real leads.
 *
 * Credentials are reused from AdSyncSettings (google OAuth, meta.accessToken,
 * linkedin.accessToken). This config holds only the conversion *targets*.
 */

/** Per-tenant conversion feedback config (stored in ad_sync_settings.conversions). */
export interface ConversionConfig {
  enabled:       boolean;
  /** Human event name (Meta/LinkedIn label), e.g. "Lead". */
  eventName:     string;
  /** Default monetary value per conversion when the event carries none. */
  defaultValue?: number | null;
  /** ISO-4217 currency, e.g. "EUR". */
  currency?:     string | null;
  /** Google Ads UPLOAD_CLICKS conversion action id (enhanced conversions for leads). */
  google?:       { conversionActionId?: string } | null;
  /** Meta pixel / dataset id (Conversions API). */
  meta?:         { pixelId?: string } | null;
  /** LinkedIn conversion rule id (numeric part of urn:lla:llaPartnerConversion:ID). */
  linkedin?:     { conversionId?: string } | null;
}

/** One conversion to report. Email is raw; clients hash it before sending. */
export interface ConversionEvent {
  email:          string;
  gclid?:         string | null;
  fbclid?:        string | null;
  value?:         number | null;
  currency?:      string | null;
  eventName?:     string | null;
  /** Epoch milliseconds; defaults to now. */
  eventTimeMs?:   number;
  /** Dedup id shared with the on-site tag when present. */
  transactionId?: string;
}

export interface ConversionSendResult {
  ok:       boolean;
  platform: "google" | "meta" | "linkedin";
  status:   "ok" | "error" | "skipped";
  error?:   string;
}
