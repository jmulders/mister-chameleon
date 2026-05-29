/**
 * Sanity → Internal Type Mappers
 *
 * Pure functions that translate raw Sanity GROQ results into the internal
 * app content types (HeroBlockData, ProofBlockData, CTABlockData).
 *
 * ─── Why a separate mapper layer? ────────────────────────────────────────────
 *
 *   Sanity schema field names (ctaLabel, ctaHref) differ from the internal
 *   app types (cta: { label, href }). This layer is the single place where
 *   that translation lives — neither the provider nor the components know
 *   about the CMS schema's naming conventions.
 *
 *   This also means Sanity schema renames only require a mapper change,
 *   not a cascade through the app.
 *
 * ─── Mapping tables ──────────────────────────────────────────────────────────
 *
 *   SanityHeroRaw              →  HeroBlockData
 *   ─────────────────────         ──────────────────────────
 *   _id                       →  id
 *   key                       →  (unused — id carries the variant key)
 *   title                     →  title
 *   subtitle                  →  subtitle
 *   ctas[].label              →  ctas[].label  (preferred)
 *   ctas[].href               →  ctas[].href
 *   ctas[].variant            →  ctas[].variant
 *   ctaLabel                  →  cta.label     (legacy fallback)
 *   ctaHref                   →  cta.href      (legacy fallback)
 *   tag                       →  tag
 *   proofItems[].metric       →  proofItems[].metric
 *   proofItems[].label        →  proofItems[].label
 *
 *   SanityProofRaw        →  ProofBlockData
 *   ─────────────────────    ──────────────────────────
 *   _id                  →  id
 *   title                →  title
 *   items[].title        →  items[].title
 *   items[].text         →  items[].text
 *
 *   SanityCTARaw          →  CTABlockData
 *   ─────────────────────    ──────────────────────────
 *   _id                  →  id
 *   title                →  title
 *   text                 →  text
 *   ctaLabel             →  cta.label
 *   ctaHref              →  cta.href
 *
 *   SanityFeatureRaw      →  FeatureBlockData
 *   ─────────────────────    ──────────────────────────
 *   _id                  →  id
 *   title                →  title
 *   subtitle             →  subtitle
 *   items[].title        →  items[].title
 *   items[].body         →  items[].body
 *   items[].icon         →  items[].icon
 *
 *   SanityConversionRaw   →  ConversionBlockData
 *   ─────────────────────    ──────────────────────────
 *   _id                  →  id
 *   title                →  title
 *   text                 →  text
 *   ctas[].label         →  ctas[].label
 *   ctas[].href          →  ctas[].href
 *   ctas[].variant       →  ctas[].variant
 *   formKey              →  formKey
 *   urgencyLabel         →  urgencyLabel
 */

import type { BlockSurface } from "@/lib/surface";
import type {
  HeroBlockData,
  HeroBannerMedia,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
  AdaptiveBlockData,
  AdaptiveVariantContent,
  AdaptiveVariantEntry,
  SiteSettingsData,
  NavigationItemData,
  MegaMenuData,
  MegaMenuColumnData,
  MegaMenuColumnItemData,
  FooterColumnData,
  FooterLinkData,
  SocialLinkData,
  HeaderCtaData,
  LocaleEntry,
  PageData,
  PageSectionData,
  CmsPageContextConfig,
} from "../../types";
import type {
  SanityHeroRaw,
  SanityHeroMediaRaw,
  SanityProofRaw,
  SanityCTARaw,
  SanityFeatureRaw,
  SanityConversionRaw,
  SanityNotificationRaw,
  SanityAdaptiveHeroRaw,
  SanityAdaptiveVariantContent,
  SanitySiteSettingsRaw,
  SanityNavItemRaw,
  SanityNavItemChildRaw,
  SanityMegaMenuRaw,
  SanityFooterColumnRaw,
  SanityLogoRaw,
  SanityPageRaw,
  SanityPageSectionRaw,
  SanityContextConfigRaw,
  SanityListingSectionRaw,
  SanityFilterBarSectionRaw,
  SanitySearchResultsSectionRaw,
  SanityArticleMetaSectionRaw,
  SanityArticleBodySectionRaw,
  SanityRelatedContentSectionRaw,
  SanityVacancyMetaSectionRaw,
  SanityApplyPanelSectionRaw,
  SanitySearchSectionRaw,
  SanityLogoStripSectionRaw,
  SanityTextMediaSectionRaw,
  SanityStatsSectionRaw,
  SanityAboutSectionRaw,
  SanityNewsListSectionRaw,
  SanityFormSectionRaw,
  SanityUniversalItemRaw,
  SanityMapBlockSectionRaw,
  SanityCartSummarySectionRaw,
  SanityCheckoutBlockSectionRaw,
  SanityProcessStepsSectionRaw,
  SanityPricingSectionRaw,
  SanityTeamSectionRaw,
} from "../../queries/sanity";

// ── Hero media helper ─────────────────────────────────────────────────────────

/**
 * Translate the flat `media` object from a Sanity GROQ projection into the
 * discriminated HeroBannerMedia union used by HeroBlock.
 *
 * Returns undefined when:
 *   - the media field is absent or null (document predates the field)
 *   - mediaType is "none" or unrecognised
 *   - required sub-fields are missing (e.g. no image asset uploaded yet)
 *
 * All null-to-undefined coercions happen here so the rest of the mapper
 * never has to deal with null media sub-fields.
 */
function mapSanityHeroMedia(raw: SanityHeroMediaRaw | null | undefined): HeroBannerMedia | undefined {
  if (!raw || !raw.mediaType || raw.mediaType === "none") return undefined;

  // ── Image ──────────────────────────────────────────────────────────────────
  if (raw.mediaType === "image") {
    // No asset uploaded yet — treat as no media rather than crashing.
    if (!raw.imageUrl) return undefined;
    return {
      kind: "image",
      url:  raw.imageUrl,
      alt:  raw.imageAlt ?? "",
    };
  }

  // ── Video ──────────────────────────────────────────────────────────────────
  if (raw.mediaType === "video") {
    if (!raw.videoSource) return undefined;

    if (raw.videoSource === "upload") {
      if (!raw.videoFileUrl) return undefined; // file not uploaded yet
      return {
        kind:  "video",
        video: {
          source:    "upload",
          url:       raw.videoFileUrl,
          poster:    raw.videoPosterUrl  ?? undefined,
          autoplay:  raw.videoAutoplay   ?? undefined,
          muted:     raw.videoMuted      ?? undefined,
          loop:      raw.videoLoop       ?? undefined,
          controls:  raw.videoControls   ?? undefined,
        },
      };
    }

    if (raw.videoSource === "youtube") {
      if (!raw.videoId) return undefined;
      return {
        kind:  "video",
        video: { source: "youtube", videoId: raw.videoId },
      };
    }

    if (raw.videoSource === "vimeo") {
      if (!raw.videoId) return undefined;
      return {
        kind:  "video",
        video: { source: "vimeo", videoId: raw.videoId },
      };
    }
  }

  return undefined;
}

// ── Hero mapper ───────────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity heroVariant document into a HeroBlockData.
 *
 * @param raw  The GROQ projection result from HERO_BY_KEY_QUERY.
 * @returns    A HeroBlockData ready for the experience composer.
 */
export function mapSanityHero(raw: SanityHeroRaw): HeroBlockData {
  // Prefer the new ctas array; fall back to the legacy flat fields for
  // documents that have not yet been migrated in Sanity Studio.
  const ctas: HeroBlockData["ctas"] =
    raw.ctas && raw.ctas.length > 0
      ? raw.ctas.map((c) => ({
          label:   c.label,
          href:    c.href,
          variant: c.variant,
        }))
      : raw.ctaLabel
        ? [{ label: raw.ctaLabel, href: raw.ctaHref ?? "" }]
        : [];

  // Map proof bar items — undefined when absent so the component uses its defaults.
  const proofItems =
    raw.proofItems && raw.proofItems.length > 0
      ? raw.proofItems.map((item) => ({ metric: item.metric, label: item.label }))
      : undefined;

  return {
    id:            raw.key,
    layoutVariant: raw.layoutVariant,
    contentAlign:  raw.contentAlign ?? undefined,
    title:         raw.title,
    subtitle:      raw.subtitle,
    ctas,
    tag:           raw.tag,
    proofItems,
    media:         mapSanityHeroMedia(raw.media),
  };
}

// ── Proof mapper ──────────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity proofVariant document into a ProofBlockData.
 *
 * @param raw  The GROQ projection result from PROOF_BY_KEY_QUERY.
 * @returns    A ProofBlockData ready for the experience composer.
 */
export function mapSanityProof(raw: SanityProofRaw): ProofBlockData {
  return {
    id:            raw.key,
    layoutVariant: raw.layoutVariant,
    title:         raw.title,
    items:         (raw.items ?? []).map((item) => ({
      title: item.title,
      text:  item.text,
    })),
  };
}

// ── CTA mapper ────────────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity ctaVariant document into a CTABlockData.
 *
 * @param raw  The GROQ projection result from CTA_BY_KEY_QUERY.
 * @returns    A CTABlockData ready for the experience composer.
 */
export function mapSanityCTA(raw: SanityCTARaw): CTABlockData {
  // Prefer the new ctas[] array; fall back to the legacy flat fields for
  // documents that pre-date the migration to the ctas array.
  const primaryCta =
    raw.ctas && raw.ctas.length > 0
      ? { label: raw.ctas[0].label, href: raw.ctas[0].href }
      : { label: raw.ctaLabel ?? "", href: raw.ctaHref ?? "" };

  return {
    id:            raw.key,
    layoutVariant: raw.layoutVariant,
    title:         raw.title,
    text:          raw.text,
    cta:           primaryCta,
  };
}

// ── Feature mapper ────────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity featureVariant document into a FeatureBlockData.
 *
 * @param raw  The GROQ projection result from FEATURE_BY_KEY_QUERY.
 * @returns    A FeatureBlockData ready for the experience composer.
 */
export function mapSanityFeature(raw: SanityFeatureRaw): FeatureBlockData {
  return {
    id:            raw.key,
    layoutVariant: raw.layoutVariant,
    title:         raw.title,
    subtitle:      raw.subtitle ?? undefined,
    items:         (raw.items ?? []).map((item) => ({
      title: item.title,
      body:  item.body,
      icon:  item.icon ?? undefined,
    })),
  };
}

// ── Conversion mapper ─────────────────────────────────────────────────────────

/**
 * Translate a raw Sanity conversionVariant document into a ConversionBlockData.
 *
 * @param raw  The GROQ projection result from CONVERSION_BY_KEY_QUERY.
 * @returns    A ConversionBlockData ready for the experience composer.
 */
export function mapSanityConversion(raw: SanityConversionRaw): ConversionBlockData {
  const ctas: ConversionBlockData["ctas"] =
    raw.ctas && raw.ctas.length > 0
      ? raw.ctas.map((c) => ({
          label:   c.label,
          href:    c.href,
          variant: c.variant,
        }))
      : [];

  return {
    id:            raw.key,
    layoutVariant: raw.layoutVariant,
    title:         raw.title,
    text:          raw.text,
    ctas,
    formKey:       raw.formKey      ?? undefined,
    urgencyLabel:  raw.urgencyLabel ?? undefined,
  };
}

// ── Notification mapper ───────────────────────────────────────────────────────

/**
 * Translate a raw Sanity notificationVariant document into a NotificationBlockData.
 *
 * @param raw  The GROQ projection result from NOTIFICATION_BY_KEY_QUERY.
 * @returns    A NotificationBlockData ready for the experience composer.
 */
export function mapSanityNotification(raw: SanityNotificationRaw): NotificationBlockData {
  return {
    id:            raw.key,
    message:       raw.message,
    severity:      raw.severity,
    ctaLabel:      raw.ctaLabel  ?? undefined,
    ctaHref:       raw.ctaHref   ?? undefined,
    position:      raw.position,
    dismissible:   raw.dismissible  ?? true,
    autoDismissMs: raw.autoDismissMs ?? 0,
  };
}

// ── Adaptive hero (Content Matrix) mapper ────────────────────────────────────

/**
 * Maps a raw Sanity adaptiveHero document to the CMS-agnostic AdaptiveBlockData.
 *
 * The mapper normalises:
 *   - The slug-typed `key` to a plain string
 *   - CTA arrays (may be undefined in Sanity) to empty array fallback
 *   - Optional image to flat imageUrl/imageAlt fields
 */
function mapAdaptiveVariantContent(raw: SanityAdaptiveVariantContent): AdaptiveVariantContent {
  return {
    title:    raw.title,
    subtitle: raw.subtitle,
    tag:      raw.tag ?? undefined,
    ctas:     (raw.ctas ?? []).map((cta) => ({
      label:   cta.label,
      href:    cta.href,
      variant: cta.variant ?? undefined,
    })),
    imageUrl: raw.image?.asset?.url ?? undefined,
    imageAlt: raw.image?.alt        ?? undefined,
  };
}

export function mapSanityAdaptiveHero(raw: SanityAdaptiveHeroRaw): AdaptiveBlockData {
  const adaptiveVariants: AdaptiveVariantEntry[] = (raw.adaptiveVariants ?? []).map((v) => ({
    variantKey: v.variantKey,
    label:      v.label ?? undefined,
    content:    mapAdaptiveVariantContent(v.content),
  }));

  return {
    id:               raw._id,
    key:              raw.key.current,
    tenantId:         raw.tenantId ?? null,
    isActive:         raw.is_active,
    defaultVariant:   mapAdaptiveVariantContent(raw.defaultVariant),
    adaptiveVariants,
  };
}

// ── Site settings mapper ───────────────────────────────────────────────────────

/**
 * Map a raw SanityMegaMenuRaw into a typed MegaMenuData.
 *
 * Filters out empty columns (no items) and maps each item based on its
 * _type discriminant to either MegaMenuLinkItemData or MegaMenuMediaItemData.
 */
function mapMegaMenu(raw: SanityMegaMenuRaw): MegaMenuData {
  const columns = (raw.columns ?? [])
    .filter((col) => col.items && col.items.length > 0)
    .map((col): MegaMenuColumnData => ({
      _key:       col._key,
      title:      col.title ?? null,
      columnType: col.columnType,
      items: (col.items ?? []).map(
        (item): MegaMenuColumnItemData => {
          if (item._type === "megaMenuMediaItem") {
            return {
              _key:             item._key,
              type:             "megaMenuMediaItem",
              mediaType:        (item.mediaType as "image" | "gif" | "video") ?? "image",
              assetUrl:         item.assetUrl ?? null,
              alt:              item.alt      ?? null,
              hoverAssetUrl:    item.hoverAssetUrl ?? null,
              caption:          item.caption   ?? null,
              linkUrl:          item.linkUrl   ?? null,
              linkOpenInNewTab: item.linkOpenInNewTab ?? false,
              videoUrl:         item.videoUrl  ?? null,
            };
          }
          // Default: megaMenuLinkItem
          return {
            _key:         item._key,
            type:         "megaMenuLinkItem",
            label:        item.label ?? "",
            href:         item.href  ?? "#",
            description:  item.description   ?? null,
            openInNewTab: item.openInNewTab   ?? false,
          };
        },
      ),
    }));

  return { columns };
}

/**
 * Translate a single resolved Sanity navigation item into a NavigationItemData.
 *
 * The `href` field is already resolved at query time by GROQ's `select()`,
 * so no URL derivation happens here.
 */
function mapNavItem(raw: SanityNavItemRaw): NavigationItemData {
  const base: NavigationItemData = {
    id:    raw._id,
    label: raw.label,
    href:  raw.href,
    ...(raw.description   ? { description:   raw.description }           : {}),
    ...(raw.openInNewTab  ? { openInNewTab:   raw.openInNewTab }          : {}),
  };
  // hasMegaMenu=false lets editors disable the mega menu without deleting
  // column data — the saved columns are preserved but not rendered.
  if (raw.hasMegaMenu !== false && raw.megaMenu?.columns && raw.megaMenu.columns.length > 0) {
    base.megaMenu = mapMegaMenu(raw.megaMenu);
  }
  if (raw.children && raw.children.length > 0) {
    base.children = raw.children.map((child) => mapNavItemChild(child));
  }
  return base;
}

function mapNavItemChild(raw: SanityNavItemChildRaw): NavigationItemData {
  const base: NavigationItemData = {
    id:    raw._id,
    label: raw.label,
    href:  raw.href,
    ...(raw.description   ? { description:  raw.description }  : {}),
    ...(raw.openInNewTab  ? { openInNewTab: raw.openInNewTab }  : {}),
  };
  if (raw.children && raw.children.length > 0) {
    base.children = raw.children.map((leaf) => ({
      id:    leaf._id,
      label: leaf.label,
      href:  leaf.href,
    }));
  }
  return base;
}

function mapFooterColumn(raw: SanityFooterColumnRaw): FooterColumnData {
  return {
    ...(raw.title ? { title: raw.title } : {}),
    links: (raw.links ?? []).map((link): FooterLinkData => ({
      label: link.label,
      href:  link.href,
      ...(link.openInNewTab ? { openInNewTab: true } : {}),
    })),
  };
}

/**
 * Translate a raw Sanity siteSettings document into a SiteSettingsData.
 *
 * ─── Mapping table ────────────────────────────────────────────────────────────
 *
 *   SanitySiteSettingsRaw          →  SiteSettingsData
 *   ─────────────────────────────     ──────────────────────────────────────────
 *   siteTitle                     →  siteTitle
 *   logo.url                      →  logo.url
 *   logo.alt                      →  logo.alt
 *   logo (null when not uploaded) →  logo: null
 *   mainNavigation[]._id          →  mainNavigation[].id
 *   mainNavigation[].label        →  mainNavigation[].label
 *   mainNavigation[].href         →  mainNavigation[].href  (pre-resolved)
 *   mainNavigation[].children     →  mainNavigation[].children
 *   footerNavigation (same)       →  footerNavigation (same)
 *
 * @param raw  The GROQ projection result from SITE_SETTINGS_QUERY.
 * @returns    A SiteSettingsData ready for the site shell layout.
 */
export function mapSanitySiteSettings(raw: SanitySiteSettingsRaw): SiteSettingsData {
  // ── Logo helpers ─────────────────────────────────────────────────────────
  const mapLogo = (logo: SanityLogoRaw | null | undefined) =>
    logo?.url ? { url: logo.url, alt: logo.alt ?? "" } : null;

  // ── Header CTA ───────────────────────────────────────────────────────────
  const headerCta: HeaderCtaData | null = raw.headerCta?.label
    ? {
        label:       raw.headerCta.label,
        href:        raw.headerCta.href,
        ...(raw.headerCta.style       ? { style:        raw.headerCta.style as HeaderCtaData["style"] }  : {}),
        ...(raw.headerCta.openInNewTab ? { openInNewTab: raw.headerCta.openInNewTab }                     : {}),
      }
    : null;

  // ── Social links ─────────────────────────────────────────────────────────
  const socialLinks: SocialLinkData[] = (raw.socialLinks ?? []).map(
    (s): SocialLinkData => ({ label: s.label, url: s.url }),
  );

  // ── Locales ──────────────────────────────────────────────────────────────
  const locales: LocaleEntry[] = (raw.locales ?? []).map(
    (l): LocaleEntry => ({ code: l.code, label: l.label }),
  );

  return {
    siteTitle:        raw.siteTitle,
    logo:             mapLogo(raw.logo),
    logoDark:         mapLogo(raw.logoDark),
    logoLight:        mapLogo(raw.logoLight),
    headerCta:        headerCta,
    utilityLinks:     (raw.headerUtilityItems ?? []).map(mapNavItem),
    locales:          locales.length > 0 ? locales : undefined,
    mainNavigation:   (raw.mainNavigation ?? []).map(mapNavItem),
    footerColumns:    raw.footerColumns && raw.footerColumns.length > 0
                        ? raw.footerColumns.map(mapFooterColumn)
                        : undefined,
    footerNavigation: (raw.footerNavigation ?? []).map(mapNavItem),
    contactEmail:     raw.contactEmail ?? null,
    contactPhone:     raw.contactPhone ?? null,
    socialLinks:      socialLinks.length > 0 ? socialLinks : undefined,
  };
}

// ── Page mapper ────────────────────────────────────────────────────────────────

/**
 * Translate a single raw Sanity page section into a PageSectionData.
 *
 * GROQ projects all possible fields onto every section object, filling
 * absent fields with null. The switch narrows the discriminated union and
 * discards nulls, passing only the fields that belong to each section type.
 *
 * ─── Unknown section types ────────────────────────────────────────────────────
 *
 *   SanityPageSectionRaw only declares the five section types this mapper
 *   currently handles.  The Sanity GROQ query fetches ALL sections from the
 *   page document regardless of _type — so at runtime this function may receive
 *   objects whose _type is not in the union (e.g. "about", "stats", "logoStrip",
 *   and the 15+ other types the tenant provisioner can write to Sanity).
 *
 *   Using `(raw._type as string)` in the switch makes TypeScript treat the
 *   discriminant as an arbitrary string, ensuring the `default` branch is
 *   reachable at both type-check and runtime.  The default returns undefined;
 *   mapSanityPage() filters those out so they never enter PageData.sections.
 *
 *   Long-term fix: expand SanityPageSectionRaw and the GROQ projection to cover
 *   all section types.  Until then this function is intentionally incomplete
 *   but safe.
 */
function mapSanitySection(
  raw: SanityPageSectionRaw | null | undefined,
): PageSectionData | undefined {
  // Guard against null entries in raw.sections (malformed Sanity inline objects).
  if (raw == null) return undefined;

  // Cast _type to string so TypeScript treats the switch as non-exhaustive and
  // the default branch is reachable for unhandled section types at runtime.
  switch (raw._type as string) {
    case "textSection": {
      const r = raw as Extract<SanityPageSectionRaw, { _type: "textSection" }>;
      return {
        _type:   "textSection",
        _key:    r._key,
        variant: r.variant ?? undefined,
        surface: (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading: r.heading ?? undefined,
        body:    r.body    ?? undefined,
      };
    }

    case "featureGrid": {
      const r = raw as Extract<SanityPageSectionRaw, { _type: "featureGrid" }>;
      // Build the CTA from the flat ctaLabel/ctaHref/ctaVariant fields.
      // Only populated when ctaLabel is present (a label is the minimum).
      const cta = r.ctaLabel
        ? {
            label:   r.ctaLabel,
            href:    r.ctaHref    ?? "",
            variant: (r.ctaVariant ?? "primary") as "primary" | "secondary" | "outline" | "ghost",
          }
        : undefined;
      return {
        _type:    "featureGrid",
        _key:     r._key,
        variant:  r.variant  ?? undefined,
        surface:  (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:  r.heading  ?? undefined,
        features: (r.features ?? []).map((f) => ({
          title:       f.title,
          description: f.description,
          icon:        f.icon ?? undefined,
        })),
        cta,
      };
    }

    case "testimonialSection": {
      const r = raw as Extract<SanityPageSectionRaw, { _type: "testimonialSection" }>;
      return {
        _type:        "testimonialSection",
        _key:         r._key,
        variant:      r.variant ?? undefined,
        surface:      (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:      r.heading ?? undefined,
        testimonials: (r.testimonials ?? []).map((t) => ({
          quote:     t.quote,
          author:    t.author,
          role:      t.role      ?? undefined,
          company:   t.company   ?? undefined,
          avatarUrl: t.avatarUrl ?? undefined,
        })),
      };
    }

    case "faqSection": {
      const r = raw as Extract<SanityPageSectionRaw, { _type: "faqSection" }>;
      return {
        _type:   "faqSection",
        _key:    r._key,
        variant: r.variant  ?? undefined,
        surface: (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading: r.heading  ?? undefined,
        items:   (r.items ?? []).map((item) => ({
          question: item.question,
          answer:   item.answer,
        })),
      };
    }

    case "ctaSection": {
      const r = raw as Extract<SanityPageSectionRaw, { _type: "ctaSection" }>;
      return {
        _type:        "ctaSection",
        _key:         r._key,
        variant:      r.variant        ?? undefined,
        surface:      (r as Record<string, unknown>).surface as BlockSurface | undefined,
        title:        r.title          ?? undefined,
        description:  r.description    ?? undefined,
        // Prefer the structured cta object; keep legacy flat fields for backward compat.
        cta:          r.cta            ?? undefined,
        buttonLabel:  r.buttonLabel    ?? undefined,
        buttonHref:   r.buttonHref     ?? undefined,
      };
    }

    // ── Listing ──────────────────────────────────────────────────────────────

    case "listing": {
      const r = raw as SanityListingSectionRaw;
      return {
        _type:         "listing",
        _key:          r._key,
        variant:       r.variant      ?? undefined,
        surface:       (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:       r.heading      ?? undefined,
        maxItems:      r.maxItems     ?? undefined,
        viewAllHref:   r.viewAllHref  ?? undefined,
        viewAllLabel:  r.viewAllLabel ?? undefined,
        items: (r.items ?? []).map((item: SanityUniversalItemRaw) => ({
          _key:      item._key,
          title:     item.title    ?? "",
          href:      item.href     ?? "",
          excerpt:   item.excerpt  ?? undefined,
          date:      item.date     ?? undefined,
          category:  item.category ?? undefined,
          tags:      item.tags     ?? undefined,
          imageUrl:  item.imageUrl ?? undefined,
          imageAlt:  item.imageAlt ?? undefined,
        })),
      };
    }

    case "filterBar": {
      const r = raw as SanityFilterBarSectionRaw;
      const mapOpts = (arr: typeof r.categories) =>
        (arr ?? []).map((o) => ({ _key: o._key, label: o.label, value: o.value, count: o.count ?? undefined }));
      return {
        _type:               "filterBar",
        _key:                r._key,
        variant:             r.variant             ?? undefined,
        surface:             (r as Record<string, unknown>).surface as BlockSurface | undefined,
        placeholder:         r.placeholder         ?? undefined,
        showSearch:          r.showSearch          ?? undefined,
        showCategoryFilter:  r.showCategoryFilter  ?? undefined,
        showTagFilter:       r.showTagFilter        ?? undefined,
        categories:          mapOpts(r.categories),
        tags:                mapOpts(r.tags),
        sortOptions:         mapOpts(r.sortOptions),
      };
    }

    case "searchResults": {
      const r = raw as SanitySearchResultsSectionRaw;
      return {
        _type:          "searchResults",
        _key:           r._key,
        variant:        r.variant       ?? undefined,
        surface:        (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:        r.heading       ?? undefined,
        emptyMessage:   r.emptyMessage  ?? undefined,
        itemsPerPage:   r.itemsPerPage  ?? undefined,
        enableSearch:   r.enableSearch  ?? undefined,
        enableFilter:   r.enableFilter  ?? undefined,
        items: (r.items ?? []).map((item: SanityUniversalItemRaw) => ({
          _key:      item._key,
          title:     item.title    ?? "",
          href:      item.href     ?? "",
          excerpt:   item.excerpt  ?? undefined,
          date:      item.date     ?? undefined,
          category:  item.category ?? undefined,
          imageUrl:  item.imageUrl ?? undefined,
          imageAlt:  item.imageAlt ?? undefined,
        })),
      };
    }

    // ── Detail ───────────────────────────────────────────────────────────────

    case "articleMeta": {
      const r = raw as SanityArticleMetaSectionRaw;
      return {
        _type:          "articleMeta",
        _key:           r._key,
        variant:        r.variant       ?? undefined,
        surface:        (r as Record<string, unknown>).surface as BlockSurface | undefined,
        title:          r.title         ?? undefined,
        publishedAt:    r.publishedAt   ?? undefined,
        updatedAt:      r.updatedAt     ?? undefined,
        category:       r.category      ?? undefined,
        readingTime:    r.readingTime   ?? undefined,
        summary:        r.summary       ?? undefined,
        tags:           r.tags          ?? undefined,
        coverImageUrl:  r.coverImageUrl ?? undefined,
        coverImageAlt:  r.coverImageAlt ?? undefined,
        author: r.author
          ? {
              name:      r.author.name      ?? "",
              role:      r.author.role      ?? undefined,
              href:      r.author.href      ?? undefined,
              avatarUrl: r.author.avatarUrl ?? undefined,
            }
          : undefined,
      };
    }

    case "articleBody": {
      const r = raw as SanityArticleBodySectionRaw;
      return {
        _type:   "articleBody",
        _key:    r._key,
        variant: r.variant ?? undefined,
        surface: (r as Record<string, unknown>).surface as BlockSurface | undefined,
        body:    r.body    ?? [],
      };
    }

    case "relatedContent": {
      const r = raw as SanityRelatedContentSectionRaw;
      return {
        _type:    "relatedContent",
        _key:     r._key,
        variant:  r.variant  ?? undefined,
        surface:  (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:  r.heading  ?? undefined,
        maxItems: r.maxItems ?? undefined,
        items: (r.items ?? []).map((item: SanityUniversalItemRaw) => ({
          _key:      item._key,
          id:        item.id       ?? item._key,
          title:     item.title    ?? "",
          href:      item.href     ?? "",
          excerpt:   item.excerpt  ?? undefined,
          category:  item.category ?? undefined,
          date:      item.date     ?? undefined,
          imageUrl:  item.imageUrl ?? undefined,
          imageAlt:  item.imageAlt ?? undefined,
        })),
      };
    }

    case "vacancyMeta": {
      const r = raw as SanityVacancyMetaSectionRaw;
      return {
        _type:         "vacancyMeta",
        _key:          r._key,
        variant:       r.variant      ?? undefined,
        surface:       (r as Record<string, unknown>).surface as BlockSurface | undefined,
        title:         r.title        ?? undefined,
        department:    r.department   ?? undefined,
        location:      r.location     ?? undefined,
        remote:        (r.remote      ?? undefined) as ("on-site" | "hybrid" | "remote" | undefined),
        contractType:  (r.contractType ?? undefined) as ("full-time" | "part-time" | "contract" | "internship" | "freelance" | undefined),
        hoursPerWeek:  r.hoursPerWeek ?? undefined,
        salaryRange:   r.salaryRange  ?? undefined,
        startDate:     r.startDate    ?? undefined,
        closingDate:   r.closingDate  ?? undefined,
        level:         r.level        ?? undefined,
      };
    }

    case "applyPanel": {
      const r = raw as SanityApplyPanelSectionRaw;
      return {
        _type:        "applyPanel",
        _key:         r._key,
        variant:      r.variant     ?? undefined,
        surface:      (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:      r.heading     ?? undefined,
        body:         r.body        ?? undefined,
        closingDate:  r.closingDate ?? undefined,
        formKey:      r.formKey     ?? undefined,
        primaryCta:   r.primaryCta?.label
          ? { label: r.primaryCta.label, href: r.primaryCta.href ?? "" }
          : undefined,
        secondaryCta: r.secondaryCta?.label
          ? { label: r.secondaryCta.label, href: r.secondaryCta.href ?? "" }
          : undefined,
      };
    }

    // ── Search ───────────────────────────────────────────────────────────────

    case "search": {
      const r = raw as SanitySearchSectionRaw;
      return {
        _type:            "search",
        _key:             r._key,
        variant:          r.variant          ?? undefined,
        surface:          (r as Record<string, unknown>).surface as BlockSurface | undefined,
        title:            r.title            ?? undefined,
        placeholder:      r.placeholder      ?? undefined,
        description:      r.description      ?? undefined,
        scopes:           r.scopes           ?? undefined,
        showFilters:      r.showFilters       ?? undefined,
        enableInstant:    r.enableInstant     ?? undefined,
        maxResults:       r.maxResults        ?? undefined,
        emptyMessage:     r.emptyMessage      ?? undefined,
        noResultsMessage: r.noResultsMessage  ?? undefined,
      };
    }

    // ── Marketing ────────────────────────────────────────────────────────────

    case "logoStrip": {
      const r = raw as SanityLogoStripSectionRaw;
      return {
        _type:            "logoStrip",
        _key:             r._key,
        variant:          r.variant          ?? undefined,
        surface:          (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:          r.heading          ?? undefined,
        animationEnabled: r.animationEnabled ?? undefined,
        speed:            r.speed            ?? undefined,
        grayscale:        r.grayscale        ?? undefined,
        showLabels:       r.showLabels       ?? undefined,
        logos:   (r.logos ?? []).map((l) => ({
          _key:  l._key,
          name:  l.name,
          src:   l.src,
          url:   l.url ?? undefined,
        })),
      };
    }

    case "textMedia": {
      const r = raw as SanityTextMediaSectionRaw;
      // Resolve the primary media URL:
      //   • video → use videoUrl (YouTube embed or CDN video URL)
      //   • image → use mediaUrl (resolved from coalesce(image.asset->url, mediaUrl) by GROQ)
      const resolvedMediaUrl =
        r.mediaType === "video" ? (r.videoUrl ?? undefined) : (r.mediaUrl ?? undefined);
      return {
        _type:     "textMedia",
        _key:      r._key,
        variant:   r.variant   ?? undefined,
        surface:   (r as Record<string, unknown>).surface as BlockSurface | undefined,
        eyebrow:   r.eyebrow   ?? undefined,
        heading:   r.heading   ?? undefined,
        body:      r.body      ?? undefined,
        mediaType: r.mediaType ?? undefined,
        mediaUrl:  resolvedMediaUrl,
        mediaAlt:  r.mediaAlt  ?? undefined,
        caption:   r.caption   ?? undefined,
        ctas: (r.ctas ?? []).map((c, i) => ({
          _key:  c._key  ?? `tm-cta-${i}`,
          label: c.label ?? "",
          href:  c.href  ?? "",
        })),
      };
    }

    case "stats": {
      const r = raw as SanityStatsSectionRaw;
      return {
        _type:   "stats",
        _key:    r._key,
        variant: r.variant ?? undefined,
        surface: (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading: r.heading ?? undefined,
        items:   (r.items ?? []).map((item: SanityUniversalItemRaw) => ({
          _key:        item._key,
          label:       item.label       ?? "",
          value:       item.value       ?? "",
          prefix:      item.prefix      ?? undefined,
          suffix:      item.suffix      ?? undefined,
          description: item.description ?? undefined,
        })),
      };
    }

    case "about": {
      const r = raw as SanityAboutSectionRaw;
      return {
        _type:    "about",
        _key:     r._key,
        variant:  r.variant  ?? undefined,
        surface:  (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:  r.heading  ?? undefined,
        body:     r.body     ?? undefined,
        imageUrl: r.imageUrl ?? undefined,
        imageAlt: r.imageAlt ?? undefined,
        ctas: (r.ctas ?? []).map((c) => ({
          _key:    c._key    ?? undefined,
          label:   c.label   ?? "",
          href:    c.href    ?? "",
          variant: (c.variant ?? undefined) as ("primary" | "secondary" | "outline" | "ghost" | undefined),
        })),
        teamMembers: (r.teamMembers ?? []).map((m) => ({
          _key:        m._key,
          name:        m.name        ?? "",
          role:        m.role        ?? "",
          bio:         m.bio         ?? undefined,
          imageUrl:    m.imageUrl    ?? undefined,
          profileHref: m.profileHref ?? undefined,
        })),
      };
    }

    case "newsList": {
      const r = raw as SanityNewsListSectionRaw;
      return {
        _type:    "newsList",
        _key:     r._key,
        variant:  r.variant  ?? undefined,
        surface:  (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:  r.heading  ?? undefined,
        maxItems: r.maxItems ?? undefined,
        items: (r.items ?? []).map((item: SanityUniversalItemRaw) => ({
          _key:      item._key,
          title:     item.title    ?? "",
          // `url` is the canonical field; fall back to `href` which is used by the
          // marketing seed builder functions (newsList items set `href`, not `url`).
          url:       item.url || (item as Record<string, unknown>).href as string || "",
          excerpt:   item.excerpt  ?? undefined,
          date:      item.date     ?? undefined,
          imageUrl:  item.imageUrl ?? undefined,
          category:  item.category ?? undefined,
        })),
      };
    }

    case "formSection": {
      const r = raw as SanityFormSectionRaw;
      return {
        _type:          "formSection",
        _key:           r._key,
        variant:        r.variant        ?? undefined,
        surface:        (r as Record<string, unknown>).surface as BlockSurface | undefined,
        formKey:        r.formKey        ?? "contact",
        title:          r.title          ?? undefined,
        intro:          r.intro          ?? undefined,
        submitLabel:    r.submitLabel    ?? undefined,
        successMessage: r.successMessage ?? undefined,
      };
    }

    case "productOverview": {
      const r = raw as Extract<SanityPageSectionRaw, { _type: "productOverview" }>;
      // Build the section-level CTA.
      const sectionCta = r.ctaLabel
        ? {
            label:   r.ctaLabel,
            href:    r.ctaHref    ?? "",
            variant: (r.ctaVariant ?? "primary") as "primary" | "secondary" | "outline" | "ghost",
          }
        : undefined;
      return {
        _type:      "productOverview",
        _key:       r._key,
        variant:    r.variant    ?? undefined,
        heading:    r.heading    ?? undefined,
        intro:      r.intro      ?? undefined,
        showPrices: r.showPrices ?? true,
        products: (r.products ?? []).map((p) => ({
          title:       p.title,
          description: p.description,
          price:       p.price    ?? undefined,
          badge:       p.badge    ?? undefined,
          imageUrl:    (p as unknown as { imageUrl?: string }).imageUrl ?? undefined,
          imageAlt:    (p as unknown as { imageAlt?: string }).imageAlt ?? undefined,
          cta: p.ctaLabel
            ? { label: p.ctaLabel, href: p.ctaHref ?? "", variant: (p.ctaVariant ?? "primary") as "primary" | "secondary" | "outline" | "ghost" }
            : undefined,
        })),
        cta: sectionCta,
      };
    }

    case "productDetail": {
      const r = raw as Extract<SanityPageSectionRaw, { _type: "productDetail" }>;
      return {
        _type:       "productDetail",
        _key:        r._key,
        variant:     r.variant     ?? undefined,
        title:       r.title       ?? "",
        description: r.description ?? undefined,
        price:       r.price       ?? undefined,
        badge:       r.badge       ?? undefined,
        gallery: (r.gallery ?? []).map((g) => ({
          url: (g as unknown as { url?: string }).url ?? "",
          alt: g.alt ?? "",
        })),
        specs: (r.specs ?? []).map((s) => ({
          label: s.label,
          value: s.value,
        })),
        cta: r.ctaLabel
          ? { label: r.ctaLabel, href: r.ctaHref ?? "", variant: (r.ctaVariant ?? "primary") as "primary" | "secondary" | "outline" | "ghost" }
          : undefined,
        secondaryCta: r.secondaryCtaLabel
          ? { label: r.secondaryCtaLabel, href: r.secondaryCtaHref ?? "", variant: (r.secondaryCtaVariant ?? "outline") as "primary" | "secondary" | "outline" | "ghost" }
          : undefined,
        relatedProducts: (r.relatedProducts ?? []).map((p) => ({
          title:       p.title,
          description: p.description,
          price:       p.price    ?? undefined,
          badge:       p.badge    ?? undefined,
          cta: p.ctaLabel
            ? { label: p.ctaLabel, href: p.ctaHref ?? "", variant: (p.ctaVariant ?? "primary") as "primary" | "secondary" | "outline" | "ghost" }
            : undefined,
        })),
      };
    }

    case "mapBlock": {
      const r = raw as SanityMapBlockSectionRaw;
      return {
        _type:    "mapBlock",
        _key:     r._key,
        variant:  r.variant  ?? undefined,
        heading:  r.heading  ?? undefined,
        address:  r.address  ?? undefined,
        city:     r.city     ?? undefined,
        country:  r.country  ?? undefined,
        email:    r.email    ?? undefined,
        phone:    r.phone    ?? undefined,
        embedUrl: r.embedUrl ?? undefined,
      };
    }

    case "cartSummary": {
      const r = raw as SanityCartSummarySectionRaw;
      return {
        _type:                "cartSummary",
        _key:                 r._key,
        variant:              r.variant              ?? undefined,
        heading:              r.heading              ?? undefined,
        emptyMessage:         r.emptyMessage         ?? undefined,
        checkoutHref:         r.checkoutHref         ?? undefined,
        continueShoppingHref: r.continueShoppingHref ?? undefined,
        checkoutLabel:        r.checkoutLabel        ?? undefined,
        continueShoppingLabel: r.continueShoppingLabel ?? undefined,
        planId:               r.planId               ?? undefined,
      };
    }

    case "checkoutBlock": {
      const r = raw as SanityCheckoutBlockSectionRaw;
      return {
        _type:           "checkoutBlock",
        _key:            r._key,
        variant:         r.variant         ?? undefined,
        heading:         r.heading         ?? undefined,
        intro:           r.intro           ?? undefined,
        paymentProvider: r.paymentProvider ?? undefined,
        returnHref:      r.returnHref      ?? undefined,
        returnLabel:     r.returnLabel     ?? undefined,
        planId:          r.planId          ?? undefined,
      };
    }

    case "processSteps": {
      const r = raw as SanityProcessStepsSectionRaw;
      return {
        _type:   "processSteps",
        _key:    r._key,
        variant: r.variant ?? undefined,
        surface: (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading: r.heading ?? undefined,
        steps: (r.steps ?? []).map((s) => ({
          _key:        s._key,
          title:       s.title       ?? "",
          description: s.description ?? undefined,
          duration:    s.duration    ?? undefined,
        })),
      };
    }

    case "teamSection": {
      const r = raw as SanityTeamSectionRaw;
      return {
        _type:   "teamSection",
        _key:    r._key,
        variant: r.variant ?? undefined,
        surface: (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading: r.heading ?? undefined,
        intro:   r.intro   ?? undefined,
        members: (r.members ?? []).map((m) => ({
          _key:        m._key,
          name:        m.name        ?? "",
          role:        m.role        ?? "",
          bio:         m.bio         ?? undefined,
          imageUrl:    m.imageUrl    ?? undefined,
          profileHref: m.profileHref ?? undefined,
          socials: (m.linkedinUrl || m.twitterUrl || m.githubUrl) ? {
            linkedin: m.linkedinUrl ?? undefined,
            twitter:  m.twitterUrl  ?? undefined,
            github:   m.githubUrl   ?? undefined,
          } : undefined,
        })),
      };
    }

    case "pricingSection": {
      const r = raw as SanityPricingSectionRaw;
      return {
        _type:      "pricingSection",
        _key:       r._key,
        variant:    r.variant    ?? undefined,
        surface:    (r as Record<string, unknown>).surface as BlockSurface | undefined,
        heading:    r.heading    ?? undefined,
        subheading: r.subheading ?? undefined,
        footnote:   r.footnote   ?? undefined,
        tiers: (r.tiers ?? []).map((t) => ({
          _key:        t._key,
          name:        t.name        ?? "",
          price:       t.price       ?? "",
          period:      t.period      ?? undefined,
          description: t.description ?? undefined,
          // features are objects {_key, label} in Sanity — extract the label strings
          features:    (t.features ?? []).map((f) => f.label ?? "").filter(Boolean) as string[],
          ctaLabel:    t.ctaLabel    ?? "",
          ctaHref:     t.ctaHref     ?? "",
          highlighted: t.highlighted ?? false,
          badge:       t.badge       ?? undefined,
        })),
      };
    }

    default:
      // Unknown _type — return undefined so mapSanityPage() filters it out.
      return undefined;
  }
}

// ── Context config mapper ──────────────────────────────────────────────────────

/**
 * Translate a raw Sanity contextConfig object into a CmsPageContextConfig.
 * Returns undefined when the raw value is absent or empty.
 */
function mapContextConfig(raw: SanityContextConfigRaw | null | undefined): CmsPageContextConfig | undefined {
  if (!raw) return undefined;

  // Build the object as a plain (non-readonly) record first so assignments
  // don't violate the readonly constraint on CmsPageContextConfig.
  const result: Record<string, { fallbackVariantKey?: string }> = {};

  if (raw.hero?.fallbackVariantKey) {
    result.hero = { fallbackVariantKey: raw.hero.fallbackVariantKey };
  }
  if (raw.proof?.fallbackVariantKey) {
    result.proof = { fallbackVariantKey: raw.proof.fallbackVariantKey };
  }
  if (raw.cta?.fallbackVariantKey) {
    result.cta = { fallbackVariantKey: raw.cta.fallbackVariantKey };
  }

  // Return undefined when nothing was set to avoid polluting PageData with
  // an empty contextConfig object that signals intent without content.
  return Object.keys(result).length > 0 ? (result as CmsPageContextConfig) : undefined;
}

/**
 * Translate a raw Sanity page document into a PageData.
 *
 * ─── Mapping table ────────────────────────────────────────────────────────────
 *
 *   SanityPageRaw           →  PageData
 *   ──────────────────────     ──────────────────────────────
 *   _id                    →  id
 *   title                  →  title
 *   slug (plain string)    →  slug
 *   templateKey            →  templateKey
 *   seoTitle               →  seoTitle
 *   seoDescription         →  seoDescription
 *   contextConfig          →  contextConfig   (via mapContextConfig)
 *   sections[]             →  sections[]      (via mapSanitySection, with
 *                                              undefined entries filtered out)
 *
 * @param raw  The GROQ projection result from PAGE_BY_SLUG_QUERY.
 * @returns    A PageData ready for the dynamic page route.
 */
export function mapSanityPage(raw: SanityPageRaw): PageData {
  return {
    id:            raw._id,
    title:         raw.title,
    slug:          raw.slug,
    templateKey:   raw.templateKey    ?? undefined,
    seoTitle:       raw.seoTitle        ?? undefined,
    seoDescription: raw.seoDescription  ?? undefined,
    metaKeywords:   raw.metaKeywords?.length ? raw.metaKeywords : undefined,
    contextConfig: mapContextConfig(raw.contextConfig),
    // mapSanitySection returns undefined for section types not yet declared in
    // SanityPageSectionRaw (e.g. "about", "stats", "logoStrip").  Filter those
    // out here so PageData.sections never contains undefined — keeping the
    // type honest and preventing crashes downstream (filterSectionsByTenant,
    // mapSectionsToContentBlocks).
    sections: (raw.sections ?? [])
      .map(mapSanitySection)
      .filter((s): s is PageSectionData => s !== undefined),
  };
}
