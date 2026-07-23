/**
 * Ad-network types.
 *
 * An advertiser tenant serves ads (block-variant creatives) to approved
 * publisher sites. See supabase/migrations/…_ad_network_mvp.sql and
 * docs/design/ad-network-plan.md.
 */

export type AdSlotType =
  | "hero" | "proof" | "cta" | "feature" | "conversion" | "notification";

export type AdPricingModel = "cpm" | "cpc";
export type AdStatus = "active" | "paused" | "ended";

/** One row of the `ads` table. */
export interface Ad {
  id:            string;
  ad_tenant_id:  string;
  name:          string;
  slot_type:     AdSlotType;
  /** Block-variant data in the renderBlockHtml() shape. */
  creative:      Record<string, unknown>;
  /** Advertiser landing URL — the only place /api/ad/click will redirect. */
  click_url:     string | null;
  /** Optional targeting: a rules_config-style condition tree, or {} for all. */
  targeting:     Record<string, unknown>;
  pricing_model: AdPricingModel;
  /** CPM: price per 1000 impressions (cents). CPC: price per click (cents). */
  rate_cents:    number;
  /** Campaign budget cap (cents). 0 = unlimited. */
  budget_cents:  number;
  spent_cents:   number;
  weight:        number;
  status:        AdStatus;
  start_at:      string | null;
  end_at:        string | null;
}

/** One approved publisher domain for an advertiser tenant. */
export interface AdPublisher {
  id:               string;
  ad_tenant_id:     string;
  publisher_domain: string;
  status:           "pending" | "approved" | "blocked";
  revshare_pct:     number;
}

export type AdEventType = "impression" | "click";
