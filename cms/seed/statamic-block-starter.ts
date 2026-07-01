/**
 * Statamic Block Starter Content
 *
 * Builds the `content` Replicator array for a Statamic page entry during
 * site provisioning.  Each block is populated with sensible Dutch placeholder
 * copy so the site looks presentable immediately after setup — editors only
 * need to replace the dummy content with real text.
 *
 * ─── Ordering convention ─────────────────────────────────────────────────────
 *
 *   The generated Replicator array follows this order:
 *     1. before-content context slots  (hero, proof — AI-driven)
 *     2. content blocks                (fixed at design time per preset)
 *     3. after-content context slots   (cta — AI-driven)
 *
 * ─── StarterContentMode semantics ────────────────────────────────────────────
 *
 *   "fill"      — populate blocks with Dutch dummy copy (default).
 *   "overwrite" — same as fill; distinction is handled upstream by the
 *                 upsertEntry call (idempotent).
 *   "none"      — emit block stubs with type + variant only; no dummy copy.
 *
 * ─── Statamic type names ─────────────────────────────────────────────────────
 *
 *   Statamic set handles use snake_case.  The platform codebase uses camelCase
 *   ContentBlockKey names (featureGrid, testimonialSection, etc.).
 *   blockKeyToStatamicType() converts between them.
 */

import type { StarterContentMode } from "@/cms/providers/cms-provider";
import type { PagePreset, PresetBlock, PresetContextSlot } from "@/page-config/page-presets";

// ── Naming utility ────────────────────────────────────────────────────────────

/**
 * Converts a camelCase ContentBlockKey to the snake_case Statamic set handle.
 *
 * featureGrid      → feature_grid
 * testimonialSection → testimonial_section
 * cartSummary      → cart_summary
 */
export function blockKeyToStatamicType(blockKey: string): string {
  return blockKey
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

// ── Dutch starter content per block type ──────────────────────────────────────

/**
 * Returns Dutch placeholder field data for a given Statamic block type
 * (snake_case) and optional variant key.
 *
 * Returns `{}` for unknown block types — the block is still emitted in the
 * Replicator but has no pre-filled content, which is safe and lets editors
 * fill it in via the CMS.
 */
export function getBlockStarterContent(
  statamicType: string,
  variant?:     string,
): Record<string, unknown> {
  switch (statamicType) {

    // ── Text ────────────────────────────────────────────────────────────────

    case "text_section":
      return {
        heading: "Alles wat u nodig heeft",
        body:    "<p>Ontdek waarom honderden bedrijven kiezen voor onze oplossing. " +
                 "Wij maken personalisatie eenvoudig, effectief en volledig GDPR-vriendelijk.</p>",
      };

    case "rich_text":
      return {
        body: "<p>Begin hier met schrijven. Gebruik koppen, vetgedrukte tekst en " +
              "links om uw verhaal te vertellen.</p>",
      };

    case "article_body":
      return {
        body: "<p>Begin hier met schrijven...</p>",
      };

    // ── Media ───────────────────────────────────────────────────────────────

    case "image":
      return {
        heading: "Gebouwd voor groei",
        body:    "Onze oplossing past zich aan elke bezoeker aan, op basis van wie ze zijn " +
                 "en waarom ze komen. Geen handmatige segmentatie, geen complexe regels — " +
                 "gewoon relevante content op het juiste moment.",
        ctas:    [{ label: "Meer over ons", href: "/about" }],
        alt:     "Afbeelding",
      };

    case "video":
      return { title: "Video" };

    case "slider":
      return {
        slides: [
          { title: "Slide 1", body: "Beschrijving van slide één." },
          { title: "Slide 2", body: "Beschrijving van slide twee." },
        ],
      };

    // ── Social proof ────────────────────────────────────────────────────────

    case "testimonial_section":
      return {
        heading: "Wat onze klanten zeggen",
        items: [
          {
            type:    "testimonial",
            quote:   "Eindelijk personalisatie die écht werkt. Onze conversie is in een week verdubbeld.",
            author:  "Marie van den Berg",
            role:    "Marketing Manager",
            company: "Voorbeeld B.V.",
          },
          {
            type:    "testimonial",
            quote:   "De implementatie was verrassend eenvoudig. Binnen een dag de eerste resultaten.",
            author:  "Thomas Jansen",
            role:    "CTO",
            company: "Tech Startup",
          },
          {
            type:    "testimonial",
            quote:   "We zien nu precies wat werkt voor welke bezoeker. Onmisbaar geworden.",
            author:  "Lisa de Vries",
            role:    "Growth Lead",
            company: "Scale-up",
          },
        ],
      };

    case "quote":
      return {
        quote:  "Het beste product dat we ooit hebben aangeschaft.",
        author: "Jan de Vries",
        role:   "Directeur, Voorbeeldbedrijf",
      };

    case "logo_strip":
      return {
        heading: "Vertrouwd door toonaangevende bedrijven",
        logos:   [],
      };

    case "stats":
      return {
        items: [
          { value: "250+",  label: "tevreden klanten" },
          { value: "3×",    label: "hogere conversie" },
          { value: "< 1 dag", label: "implementatietijd" },
          { value: "100%",  label: "GDPR-compliant" },
        ],
      };

    // ── Features ────────────────────────────────────────────────────────────

    case "feature_grid":
      return {
        heading:  "Waarom kiezen voor ons",
        subtitle: "De voordelen die het verschil maken",
        items: [
          { type: "feature", icon: "Zap",        title: "Snel van start",          body: "Live in één middag — geen lange implementaties." },
          { type: "feature", icon: "Shield",     title: "Privacy-vriendelijk",      body: "Geen cookies, geen toestemming nodig." },
          { type: "feature", icon: "TrendingUp", title: "Meetbare resultaten",      body: "Gemiddeld 3× hogere conversie." },
          { type: "feature", icon: "Settings",   title: "Eenvoudig beheer",         body: "Content beheren in uw vertrouwde CMS." },
          { type: "feature", icon: "Users",      title: "Persoonlijke aanpak",      body: "Elke bezoeker krijgt de meest relevante boodschap." },
          { type: "feature", icon: "BarChart2",  title: "Inzicht & rapportage",     body: "Realtime inzicht in prestaties per segment." },
        ],
      };

    case "product_overview":
      return {
        heading: "Onze producten",
        items:   [],
      };

    // ── Content ─────────────────────────────────────────────────────────────

    case "faq_section":
      return {
        heading: "Veelgestelde vragen",
        items: [
          {
            question: "Hoe werkt de personalisatie?",
            answer:   "De beslissingsengine analyseert bezoekersignalen en kiest de meest relevante " +
                      "variant op het moment van renderen — volledig server-side.",
          },
          {
            question: "Heb ik technische kennis nodig?",
            answer:   "Nee. U plakt één snippet en verbindt uw CMS — geen engineering sprint vereist.",
          },
          {
            question: "Is het GDPR-compliant?",
            answer:   "Ja. Alle logica draait server-side. Geen cookies, geen toestemming nodig.",
          },
          {
            question: "Welke CMS-systemen worden ondersteund?",
            answer:   "Statamic, Storyblok en Sanity zijn standaard beschikbaar.",
          },
        ],
      };

    case "text_media":
      return {
        heading:   "Uw voordeel in één oogopslag",
        body:      "<p>Combineer krachtige content met een aansprekende visual om uw " +
                   "boodschap direct over te brengen.</p>",
        cta_label: "Lees meer",
        cta_href:  "#",
      };

    case "news_list":
      return { heading: "Laatste nieuws" };

    case "case_highlight":
      return { heading: "Klantverhaal" };

    case "listing":
      return { heading: "Overzicht" };

    case "article_meta":
      return {};

    case "related_content":
      return { heading: "Lees ook" };

    case "vacancy_meta":
      return {};

    case "apply_panel":
      return {
        heading:   "Solliciteer direct",
        body:      "Stuur uw cv en motivatie via onderstaand formulier.",
        cta_label: "Solliciteer nu",
      };

    case "filter_bar":
      return {};

    case "search":
      return {
        heading:     "Zoeken",
        placeholder: "Zoek in onze content...",
      };

    case "process_steps":
      return {
        heading: "Zo werkt het",
        steps: [
          { type: "step", number: "01", title: "Snippet plaatsen",    body: "Plak de code in uw website-header. Klaar in 5 minuten." },
          { type: "step", number: "02", title: "CMS verbinden",       body: "Verbind Statamic, Storyblok of Sanity met één API-sleutel." },
          { type: "step", number: "03", title: "Varianten aanmaken",  body: "Schrijf content voor elk bezoekerssegment in uw CMS." },
          { type: "step", number: "04", title: "Resultaten meten",    body: "Bekijk de conversies per segment in het dashboard." },
        ],
      };

    case "content_section":
      return {
        heading: "Onze aanpak",
        body:    "<p>Hier kunt u uw verhaal kwijt in een uitgebreid redactioneel formaat.</p>",
      };

    case "team_section":
      return {
        heading:  "Ons team",
        subtitle: "De mensen achter het platform.",
        members:  [],
      };

    case "timeline":
      return {
        heading: "Onze geschiedenis",
        items: [
          { date: "2020", title: "Opgericht",    description: "Het bedrijf werd opgericht met één missie: personalisatie toegankelijk maken." },
          { date: "2022", title: "Eerste klant", description: "De eerste enterprise-klant ging live met het platform." },
          { date: "2024", title: "Schaalsprong", description: "Het platform verwerkt nu miljoenen bezoekerssessies per maand." },
        ],
      };

    case "quick_links":
      return {
        heading: "Snel navigeren",
        links:   [
          { label: "Over ons",    href: "/about" },
          { label: "Diensten",    href: "/services" },
          { label: "Contact",     href: "/contact" },
        ],
      };

    // ── Conversion ──────────────────────────────────────────────────────────

    case "cta_section":
      return {
        heading:       "Klaar om te starten?",
        body:          "Sluit u aan bij honderden bedrijven die al personaliseren.",
        // Group fieldtype — stored as nested object in Statamic YAML.
        primary_cta:   { label: "Gratis proberen",  href: "/contact" },
        secondary_cta: { label: "Demo aanvragen",   href: "/contact" },
      };

    case "form_section":
      return {
        variant:  "form_inline",
        heading:  "Stuur ons een bericht",
        subtitle: "We reageren binnen één werkdag.",
        // `form` uses Statamic's native form fieldtype (stores the form handle).
        // Falls back to `form_key` for backward compatibility with old entries.
        form:     "contact",
      };

    case "contact_section":
      return {
        heading:     "Neem contact op",
        description: "Heeft u vragen of wilt u een demo? Neem gerust contact met ons op.",
        address:     "Keizersgracht 1, 1015 CN Amsterdam",
        phone:       "+31 20 123 4567",
        email:       "info@uw-bedrijf.nl",
        hours:       "Ma–Vr 9:00–17:00",
      };

    case "recruiter_panel":
      return { heading: "Uw recruiter" };

    case "pricing_section":
      return {
        heading:  "Kies het juiste plan",
        subtitle: "Transparante prijzen, geen verrassingen.",
      };

    case "map_block":
      return {
        address: "Keizersgracht 1, 1015 CN Amsterdam",
        email:   "info@voorbeeld.nl",
        phone:   "+31 20 000 0000",
      };

    case "cart_summary":
    case "checkout_block":
    case "product_detail":
    case "search_results":
      return {};

    default:
      return {};
  }
}

// ── Replicator builder ────────────────────────────────────────────────────────

/**
 * @deprecated Use buildPageStructuredEntry() instead.
 * Kept for backward compatibility with any external callers that still use the
 * old single-array `content` format.
 *
 * Converts a PresetContextSlot to a Statamic Replicator set entry.
 * Context slots use the slot id as the Statamic type (e.g. "hero", "proof").
 */
function contextSlotToEntry(slot: PresetContextSlot): Record<string, unknown> {
  return {
    type:      slot.slotId,
    enabled:   true,
    key:       slot.variantKey ?? `${slot.slotId}_default`,
    is_active: true,
  };
}

/**
 * Converts a PresetBlock to a Statamic Replicator set entry, optionally
 * including Dutch starter content.
 */
function presetBlockToEntry(
  block: PresetBlock,
  fill:  boolean,
): Record<string, unknown> {
  const statamicType = blockKeyToStatamicType(block.blockType);
  const starterData  = fill ? getBlockStarterContent(statamicType, block.variant) : {};

  return {
    type:    statamicType,
    enabled: true,
    ...(block.variant ? { variant: block.variant } : {}),
    ...starterData,
  };
}

/**
 * @deprecated Use buildPageStructuredEntry() instead.
 * Builds the full Statamic `content` Replicator array for a page using the old
 * single-array format.  Retained only for backward compatibility.
 */
export function buildPageReplicatorContent(
  preset: PagePreset | undefined,
  mode:   StarterContentMode,
): Record<string, unknown>[] {
  if (!preset) return [];

  const fill        = mode !== "none";
  const beforeSlots = preset.contextSlots.filter((s) => s.position === "before-content");
  const afterSlots  = preset.contextSlots.filter((s) => s.position === "after-content");

  return [
    ...beforeSlots.map(contextSlotToEntry),
    ...preset.blocks.map((b) => presetBlockToEntry(b, fill)),
    ...afterSlots.map(contextSlotToEntry),
  ];
}

// ── New structured entry builder ───────────────────────────────────────────────

/**
 * Shape of the page entry written by the new architecture.
 *
 * Uses the unified page_blocks Replicator introduced in Task #120.
 * Context slots are fixed anchor points — they carry only a `variant_key`
 * (which default variant to show) and `is_active`.  Variant content lives in
 * the adaptive_blocks catalog (DB or Statamic adaptive_blocks collection).
 * Content blocks are freely insertable before, between, and after context slots.
 */
export interface StatamicPageStructuredEntry {
  page_blocks: Record<string, unknown>[];
}

/**
 * @deprecated Shape used by the old typed-arrays architecture.
 * Kept for backward compatibility with any callers that have not yet migrated.
 */
export interface StatamicPageStructuredEntryLegacy {
  adaptive_slots: {
    hero_key:       string;
    proof_key:      string;
    cta_key:        string;
    feature_key:    string;
    conversion_key: string;
  };
  hero_variants:       Record<string, unknown>[];
  proof_variants:      Record<string, unknown>[];
  cta_variants:        Record<string, unknown>[];
  feature_variants:    Record<string, unknown>[];
  conversion_variants: Record<string, unknown>[];
  content:             Record<string, unknown>[];
}

/**
 * Builds the structured Statamic page entry for the new blueprint architecture.
 *
 * ─── Architecture (new page_blocks Replicator) ─────────────────────────────────
 *
 *   The page entry contains a single `page_blocks` Replicator with:
 *     - `context_slot` items   — fixed anchors, one per adaptive slot in the preset.
 *                                Editors can only change `variant_key` and `is_active`.
 *     - Content block items    — freely insertable before / between / after slots.
 *
 *   Variant CONTENT lives in the adaptive_blocks catalog (DB or Statamic
 *   adaptive_blocks collection), NOT in the page entry.  The decision engine
 *   looks up the variant at render time using the `variant_key` from the slot.
 *
 * ─── Context slot canonical order ─────────────────────────────────────────────
 *
 *   hero → proof → cta → feature → conversion
 *
 *   Slots not present in the preset are omitted entirely (not set to inactive)
 *   so the CP shows only the slots the template actually uses.
 *
 * StarterContentMode:
 *   "fill" / "overwrite" → free-content blocks include Dutch placeholder copy.
 *   "none"               → blocks are emitted as type-only stubs (no dummy text).
 */
export function buildPageStructuredEntry(
  preset: PagePreset | undefined,
  mode:   StarterContentMode,
): StatamicPageStructuredEntry {
  if (!preset) return { page_blocks: [] };

  const fill = mode !== "none";

  // Canonical slot order — only include slots defined in this preset.
  const CANONICAL_ORDER = ["hero", "proof", "cta", "feature", "conversion"] as const;
  const pageBlocks: Record<string, unknown>[] = [];

  for (const slotId of CANONICAL_ORDER) {
    const slot = preset.contextSlots.find((s) => s.slotId === slotId);
    if (!slot) continue;

    const variantKey = slot.variantKey ?? `${slotId}_default`;
    pageBlocks.push({
      id:          `ctx_${slotId}`,
      type:        "context_slot",
      slot_type:   slotId,
      variant_key: variantKey,
      is_active:   true,
    });
  }

  // Append free-content blocks after the context slot anchors.
  for (const block of preset.blocks) {
    pageBlocks.push(presetBlockToEntry(block, fill));
  }

  return { page_blocks: pageBlocks };
}
