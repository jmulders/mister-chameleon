/**
 * Statamic location-showcase rules (demo).
 *
 * A small set of example StoredRules that map the NOW-LIVE location-enrichment
 * signals to existing variant keys (ALLOWED_HERO/PROOF/CTA_KEYS), so the
 * scenario console can demonstrate that location enrichment drives REAL
 * personalization on the real rule path: a persona sets the signals → the rule
 * fires (first-match by priority) → the mapped variant appears.
 *
 * Every field used here is a registered RuleFieldKey (validateStoredConfig rejects
 * unknown fields), and every variant key is in the platform ALLOWED_* whitelist.
 * Priorities are unique within the statamic config (free slots 30/31/37/44 at the
 * time of seeding) and sit in the medium_segmentation tier (20–49), below the
 * tenant's hard-state / high-intent rules.
 *
 * These use only fields registered as of D5 Fase 0/1 + netbeheer. More stories
 * (netbeheer PC6, CBS demografie, EP-Online band) can be added once those field
 * registrations are merged — see docs/showcase-location-rules.md.
 */

import type { StoredRule } from "@/decision/rules/stored-rule";

export const STATAMIC_LOCATION_SHOWCASE_RULES: readonly StoredRule[] = [
  // 1. Verduurzaming-B2B: an office building that either uses a lot of gas OR has
  //    little solar → sustainability / enterprise angle. Most specific → fires first.
  {
    id:              "loc_showcase_verduurzaming_b2b",
    priority:        30,
    label:           "Locatie: verduurzaming B2B (kantoor, hoog gas / laag zon)",
    source:          "blueprint",
    packId:          "pack_location_showcase",
    precedenceLevel: "medium_segmentation",
    condition: {
      type:  "group",
      logic: "and",
      conditions: [
        { type: "field", field: "locationBuildingUse", operator: "equals", value: "kantoorfunctie" },
        {
          type:  "group",
          logic: "or",
          conditions: [
            { type: "field", field: "locationAvgGasUsage", operator: "greater_than", value: 1500 },
            { type: "field", field: "locationSolarPct",    operator: "less_than", value: 5 },
          ],
        },
      ],
    },
    plan:   { heroKey: "hero_enterprise", proofKey: "proof_platform", ctaKey: "cta_demo" },
    reason: "Office building with high gas use / low solar → verduurzamings- en enterprise-hoek.",
  },
  // 2. Business-services buurt → B2B-SaaS angle.
  {
    id:              "loc_showcase_business_services",
    priority:        31,
    label:           "Locatie: zakelijke-dienstverlening-buurt (B2B SaaS)",
    source:          "blueprint",
    packId:          "pack_location_showcase",
    precedenceLevel: "medium_segmentation",
    condition: { type: "field", field: "locationDominantBusinessSector", operator: "equals", value: "business_services" },
    plan:   { heroKey: "hero_saas_default", proofKey: "proof_saas_default", ctaKey: "cta_saas_demo" },
    reason: "Dominant sector = zakelijke dienstverlening → B2B-SaaS-hoek.",
  },
  // 3. Affluent buurt (high income band OR high WOZ) → premium / enterprise variant.
  {
    id:              "loc_showcase_affluent",
    priority:        37,
    label:           "Locatie: welvarende buurt (premium/enterprise)",
    source:          "blueprint",
    packId:          "pack_location_showcase",
    precedenceLevel: "medium_segmentation",
    condition: {
      type:  "group",
      logic: "or",
      conditions: [
        { type: "field", field: "locationIncomeBand",   operator: "equals", value: "high" },
        { type: "field", field: "locationAvgWozValue",  operator: "greater_than",     value: 400000 },
      ],
    },
    plan:   { heroKey: "hero_enterprise", proofKey: "proof_stats", ctaKey: "cta_meeting" },
    reason: "High income band / WOZ value → premium/enterprise-variant.",
  },
  // 4. Solar-rich buurt → owner / verduurzaming angle.
  {
    id:              "loc_showcase_solar_rich",
    priority:        44,
    label:           "Locatie: zonne-rijke buurt (eigenaar/verduurzaming)",
    source:          "blueprint",
    packId:          "pack_location_showcase",
    precedenceLevel: "medium_segmentation",
    condition: { type: "field", field: "locationSolarPct", operator: "greater_than", value: 25 },
    plan:   { heroKey: "hero_consideration", proofKey: "proof_reassurance", ctaKey: "cta_guide" },
    reason: "High solar-panel adoption in the buurt → eigenaar/verduurzaming-hoek.",
  },
] as const;
