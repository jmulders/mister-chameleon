/**
 * Functionality Modules
 *
 * Opt-in platform capabilities shown in the site setup wizard (step 3).
 * Each module groups a set of content blocks + optional external integrations
 * that work together to deliver a specific feature area (e.g. appointment
 * booking, cart + checkout, vacancy applications).
 *
 * ─── Phase 1 semantics ───────────────────────────────────────────────────────
 *
 *   In phase 1 modules are informational: they are stored on TenantSettings
 *   and shown in the wizard to help operators think about what they need.
 *   The provisioner uses `enabledBlocks` to conditionally include module-
 *   specific pages in the block composition.
 *
 *   Future phases can use the stored module list to:
 *     • gate block rendering per tenant
 *     • pre-wire the required integrations during provisioning
 *     • filter the block catalogue in the content editor
 *
 * ─── siteTypeRelevance ───────────────────────────────────────────────────────
 *
 *   An empty array means the module is relevant for ALL site types.
 *   A non-empty array means the module is shown first / highlighted for those
 *   types, but is never hidden — operators can always select it.
 */

import type { SiteType } from "./site-presets";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Stable identifier for a functionality module. */
export type FunctionalityModuleKey =
  | "appointment_booking"
  | "cart_checkout"
  | "vacancy_apply"
  | "contact_forms"
  | "google_maps"
  | "site_search";

/** A single opt-in platform capability module. */
export interface FunctionalityModule {
  /** Stable identifier — stored as-is in TenantSettings.selectedModules. */
  readonly key: FunctionalityModuleKey;

  /** Short display label for the wizard checkbox card (NL). */
  readonly label: string;

  /** One-sentence description of the module's purpose (NL). */
  readonly description: string;

  /**
   * Lucide icon name resolved by the render layer.
   * Keep as a plain string so this file stays free of React imports.
   */
  readonly icon: string;

  /**
   * ContentBlockKey values that this module activates.
   * Used by the provisioner to conditionally include module-specific block
   * content when building page Replicator arrays.
   */
  readonly enabledBlocks: readonly string[];

  /**
   * External integration slugs required for this module (e.g. "google_calendar").
   * Shown as chips in the wizard card so the operator knows what they need.
   * Absent when the module has no external dependency.
   */
  readonly requiredIntegrations?: readonly string[];

  /**
   * Optional short setup note displayed below the description in the wizard.
   * Used to surface integration prerequisites early (e.g. "Vereist Stripe").
   */
  readonly setupNote?: string;

  /**
   * Site types for which this module is most relevant.
   * Empty array = shown for all site types.
   */
  readonly siteTypeRelevance: readonly SiteType[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const FUNCTIONALITY_MODULES: readonly FunctionalityModule[] = [
  {
    key:               "appointment_booking",
    label:             "Afspraak plannen",
    description:       "Laat bezoekers direct een afspraak inplannen via Google Calendar.",
    icon:              "CalendarDays",
    enabledBlocks:     ["formSection"],
    requiredIntegrations: ["google_calendar"],
    setupNote:         "Vereist een gekoppeld Google Calendar-account.",
    siteTypeRelevance: ["corporate", "recruitment", "saas"],
  },
  {
    key:               "cart_checkout",
    label:             "Winkelwagen & checkout",
    description:       "Voeg productpagina's, een winkelwagen en Stripe-checkout toe.",
    icon:              "ShoppingCart",
    enabledBlocks:     ["cartSummary", "checkoutBlock", "productOverview", "productDetail"],
    requiredIntegrations: ["stripe"],
    setupNote:         "Vereist een Stripe-account voor betalingen.",
    siteTypeRelevance: ["shop"],
  },
  {
    key:               "vacancy_apply",
    label:             "Vacatures & solliciteren",
    description:       "Publiceer vacatures met sollicitatieformulier en recruiterprofiel.",
    icon:              "Briefcase",
    enabledBlocks:     ["vacancyMeta", "applyPanel", "recruiterPanel", "filterBar"],
    siteTypeRelevance: ["recruitment"],
  },
  {
    key:               "contact_forms",
    label:             "Contactformulieren",
    description:       "Voeg een contactpagina met formulier toe voor leads en vragen.",
    icon:              "Mail",
    enabledBlocks:     ["formSection", "contactSection"],
    siteTypeRelevance: [],
  },
  {
    key:               "google_maps",
    label:             "Locatie & kaart",
    description:       "Toon uw vestiging(en) op een interactieve Google Maps-kaart.",
    icon:              "MapPin",
    enabledBlocks:     ["mapBlock"],
    requiredIntegrations: ["google_maps"],
    setupNote:         "Vereist een Google Maps API-sleutel.",
    siteTypeRelevance: ["corporate", "recruitment"],
  },
  {
    key:               "site_search",
    label:             "Zoekfunctie",
    description:       "Geef bezoekers een zoekbalk om snel door al uw inhoud te navigeren.",
    icon:              "Search",
    enabledBlocks:     ["search", "searchResults", "filterBar"],
    siteTypeRelevance: ["content", "shop"],
  },
];

// ── Derived maps + helpers ────────────────────────────────────────────────────

export const FUNCTIONALITY_MODULE_MAP: Readonly<Record<FunctionalityModuleKey, FunctionalityModule>> =
  Object.fromEntries(FUNCTIONALITY_MODULES.map((m) => [m.key, m])) as
    Readonly<Record<FunctionalityModuleKey, FunctionalityModule>>;

/** Returns the module for the given key, or undefined for unknown keys. */
export function getFunctionalityModule(key: string): FunctionalityModule | undefined {
  return FUNCTIONALITY_MODULE_MAP[key as FunctionalityModuleKey];
}

/**
 * Returns all modules relevant for a given site type.
 * Modules with an empty `siteTypeRelevance` array are always included.
 */
export function getModulesForSiteType(siteType: SiteType): readonly FunctionalityModule[] {
  return FUNCTIONALITY_MODULES.filter(
    (m) => m.siteTypeRelevance.length === 0 || m.siteTypeRelevance.includes(siteType),
  );
}

/**
 * Returns all content block keys enabled by the given set of module keys.
 * Deduplicates across modules.
 */
export function getBlocksEnabledByModules(moduleKeys: readonly string[]): readonly string[] {
  const blocks = new Set<string>();
  for (const key of moduleKeys) {
    const mod = getFunctionalityModule(key);
    if (mod) mod.enabledBlocks.forEach((b) => blocks.add(b));
  }
  return Array.from(blocks);
}
