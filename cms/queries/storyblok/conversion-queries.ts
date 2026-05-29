/**
 * Conversion Variant — Storyblok content type and slug builder
 *
 * Defines:
 *   StoryblokConversionContent  — the content field shape of a conversion_variant story
 *   StoryblokConversionCTAItem  — a single CTA inside the ctas bloks array
 *   conversionVariantSlug()     — builds the full slug for a conversion variant story
 *
 * ─── Storyblok component: conversion_variant ─────────────────────────────────
 *
 *   Stories are stored in the "conversion-variants" folder:
 *     conversion-variants/conversion_demo
 *     conversion-variants/conversion_contact
 *     conversion-variants/conversion_signup
 *
 * ─── Field name mapping ────────────────────────────────────────────────────────
 *
 *   StoryblokConversionContent  →  ConversionBlockData
 *   ──────────────────────         ──────────────────────
 *   key                        →  id
 *   title                      →  title
 *   text                       →  text
 *   layout_variant             →  layoutVariant
 *   ctas[].label               →  ctas[].label
 *   ctas[].href                →  ctas[].href
 *   ctas[].variant             →  ctas[].variant
 *   form_key                   →  formKey
 *   urgency_label              →  urgencyLabel
 */

// ── Storyblok folder slug ─────────────────────────────────────────────────────

export const CONVERSION_VARIANTS_FOLDER = "conversion-variants" as const;

// ── Content types ─────────────────────────────────────────────────────────────

/** A single CTA item inside a conversion_variant.ctas bloks array. */
export interface StoryblokConversionCTAItem {
  _uid?:      string;
  component?: string;
  label:      string;
  href:       string;
  variant?:   "primary" | "secondary" | "outline" | "ghost";
}

/**
 * Content fields of a Storyblok `conversion_variant` story.
 *
 * Field names use Storyblok's snake_case convention.
 * The mapper (mapStoryblokConversion) translates these to ConversionBlockData.
 */
export interface StoryblokConversionContent {
  /** Variant identifier — matches the story slug and the ConversionVariantKey */
  key:              string;
  /** Soft-disable flag — false means the slot returns null */
  is_active:        boolean;
  /** Large display headline */
  title:            string;
  /** Supporting paragraph beneath the headline */
  text:             string;
  /**
   * Layout variant for the conversion block.
   *   conversion_split  — two-column layout with form on the right
   *   conversion_card   — centred card layout
   *   conversion_banner — full-width banner (default)
   */
  layout_variant?:  string;
  /** 1–2 CTA buttons */
  ctas?:            StoryblokConversionCTAItem[];
  /**
   * Optional key of a platform-registered form embed.
   * When set, the block renders an embedded form widget.
   */
  form_key?:        string;
  /**
   * Optional short urgency label shown near the CTA,
   * e.g. "No obligation", "Free — no email gate".
   */
  urgency_label?:   string;
}

// ── Slug builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full Storyblok story slug for a conversion variant.
 *
 * @param key  The variant key, e.g. "conversion_demo"
 * @returns    The full story slug, e.g. "conversion-variants/conversion_demo"
 */
export function conversionVariantSlug(key: string): string {
  return `${CONVERSION_VARIANTS_FOLDER}/${key}`;
}
