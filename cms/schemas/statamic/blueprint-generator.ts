/**
 * Statamic Pages Blueprint Generator
 *
 * Generates the `pages.yaml` Statamic blueprint scoped to a tenant's enabled
 * context blocks (adaptive variant slots) and content blocks (free content zone).
 *
 * ─── Architecture ────────────────────────────────────────────────────────────
 *
 *   The generated blueprint has exactly 4 tabs:
 *
 *   1. Meta tab          — always present (title, meta_keywords, template)
 *   2. Card tab          — overview_image, detail_image, excerpt (for listings / mega menu)
 *   3. Page Content tab  — single `page_blocks` Replicator with grouped sets:
 *   4. SEO tab           — seo_title, seo_description, robots_noindex, robots_nofollow,
 *                          canonical_url, og_title, og_description, og_image
 *
 *        Context Slots group   — `context_slot` set (imports context_slot fieldset)
 *                                included whenever at least one context block is enabled
 *        Text & Media group    — text_section, rich_text, image, video, quote
 *        Social Proof group    — testimonial_section, logo_strip, stats
 *        Features & FAQ group  — feature_grid, process_steps, team_section, faq_section
 *        Conversion & Forms    — cta_section, form_section, contact_section
 *        Listings              — listing, related_content
 *
 *   Context slot variants are managed in a separate `adaptive_blocks` collection.
 *   They are NOT stored inline on each page entry — the page only holds the
 *   default variant key per context slot inside the `context_slot` set.
 *
 *   Each content set imports its fields from a matching Statamic fieldset
 *   (resources/fieldsets/<fieldset_name>.yaml), keeping the blueprint thin.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   import { generatePagesBlueprintYaml } from '@/cms/schemas/statamic/blueprint-generator';
 *
 *   const yaml = generatePagesBlueprintYaml(
 *     tenant.blocks.context,
 *     tenant.blocks.content,
 *   );
 *   fs.writeFileSync(blueprintPath, yaml, 'utf8');
 *
 * ─── Notes ───────────────────────────────────────────────────────────────────
 *
 *   - The "notification" ContextBlockKey is intentionally excluded from the
 *     context_slots group — it is managed via a separate mechanism.
 *   - Content block keys not mapped to a blueprint set (e.g. productOverview,
 *     mapBlock) are silently ignored — they have no CP representation yet.
 */

import { stringify } from 'yaml';
import type { ContextBlockKey, ContentBlockKey, TenantLanguageConfig } from '@/tenant/types';

// ── Types ──────────────────────────────────────────────────────────────────────

type YamlValue = string | number | boolean | null | YamlObject | YamlValue[];
type YamlObject = { [k: string]: YamlValue };

// ── Content block → set definition ────────────────────────────────────────────

type ContentGroup =
  | 'text_and_media'
  | 'social_proof'
  | 'features_and_faq'
  | 'conversion_and_forms'
  | 'listings';

interface ContentSetDef {
  group:        ContentGroup;
  /** Replicator set handle (snake_case). */
  setKey:       string;
  /** Human-readable label shown in the CP. */
  display:      string;
  /** Name of the Statamic fieldset to import (resources/fieldsets/<name>.yaml). */
  fieldsetName: string;
}

const CONTENT_SET_DEFS: Readonly<Partial<Record<ContentBlockKey, ContentSetDef>>> = {

  // ── Text & Media ──────────────────────────────────────────────────────────
  // fieldsetName must match the mrc_* filename written by provisionSite/syncStatamicBlueprintAction.
  textSection:        { group: 'text_and_media',        setKey: 'text_section',        display: 'Text Section',    fieldsetName: 'mrc_text_section' },
  richText:           { group: 'text_and_media',        setKey: 'rich_text',           display: 'Rich Text',       fieldsetName: 'mrc_rich_text' },
  image:              { group: 'text_and_media',        setKey: 'image',               display: 'Text + Media',    fieldsetName: 'mrc_image_block' },
  video:              { group: 'text_and_media',        setKey: 'video',               display: 'Video',           fieldsetName: 'mrc_video_block' },
  quote:              { group: 'text_and_media',        setKey: 'quote_block',         display: 'Quote',           fieldsetName: 'mrc_quote_block' },

  // ── Social Proof ──────────────────────────────────────────────────────────
  testimonialSection: { group: 'social_proof',          setKey: 'testimonial_section', display: 'Testimonials',    fieldsetName: 'mrc_testimonial_section' },
  logoStrip:          { group: 'social_proof',          setKey: 'logo_strip',          display: 'Logo Strip',      fieldsetName: 'mrc_logo_strip' },
  stats:              { group: 'social_proof',          setKey: 'stats',               display: 'Stats',           fieldsetName: 'mrc_stats_block' },

  // ── Features & FAQ ────────────────────────────────────────────────────────
  featureGrid:        { group: 'features_and_faq',      setKey: 'feature_grid',        display: 'Feature Grid',    fieldsetName: 'mrc_feature_grid' },
  processSteps:       { group: 'features_and_faq',      setKey: 'process_steps',       display: 'Process Steps',   fieldsetName: 'mrc_process_steps' },
  teamSection:        { group: 'features_and_faq',      setKey: 'team_section',        display: 'Team Section',    fieldsetName: 'mrc_team_section' },
  faqSection:         { group: 'features_and_faq',      setKey: 'faq_section',         display: 'FAQ Section',     fieldsetName: 'mrc_faq_section' },
  timeline:           { group: 'features_and_faq',      setKey: 'timeline',            display: 'Timeline',        fieldsetName: 'mrc_timeline_block' },

  // ── Conversion & Forms ────────────────────────────────────────────────────
  ctaSection:         { group: 'conversion_and_forms',  setKey: 'cta_section',         display: 'CTA Section',     fieldsetName: 'mrc_cta_section' },
  formSection:        { group: 'conversion_and_forms',  setKey: 'form_section',        display: 'Form Section',    fieldsetName: 'mrc_form_section' },
  contactSection:     { group: 'conversion_and_forms',  setKey: 'contact_section',     display: 'Contact Section', fieldsetName: 'mrc_contact_section' },

  // ── Listings ──────────────────────────────────────────────────────────────
  listing:            { group: 'listings',              setKey: 'listing',             display: 'Listing',         fieldsetName: 'mrc_listing_block' },
  relatedContent:     { group: 'listings',              setKey: 'related_content',     display: 'Related Content', fieldsetName: 'mrc_related_content' },
};

// ── Group metadata ─────────────────────────────────────────────────────────────

const CONTENT_GROUP_META: Record<ContentGroup, { display: string; order: number }> = {
  text_and_media:       { display: 'Text & Media',       order: 0 },
  social_proof:         { display: 'Social Proof',       order: 1 },
  features_and_faq:     { display: 'Features & FAQ',     order: 2 },
  conversion_and_forms: { display: 'Conversion & Forms', order: 3 },
  listings:             { display: 'Listings',           order: 4 },
};

// ── Meta tab ───────────────────────────────────────────────────────────────────

function buildMetaTab(): YamlObject {
  return {
    display: 'Meta',
    sections: [
      {
        fields: [
          { handle: 'title', field: { type: 'text', display: 'Title', validate: 'required' } },
          {
            handle: 'meta_keywords',
            field: {
              type:         'text',
              display:      'Meta Keywords',
              instructions: 'Comma-separated intent keywords for interest scoring.',
            },
          },
          {
            handle: 'template',
            field: {
              type:         'select',
              display:      'Template',
              instructions: 'Determines the page layout in Next.js.',
              options: {
                home:           'Home (marketing + personalisation)',
                marketing_page: 'Marketing Page',
                article_page:   'Article Page',
              },
              default: 'marketing_page',
            },
          },
        ],
      },
    ],
  };
}

// ── SEO tab ────────────────────────────────────────────────────────────────────
//
// Inline SEO fields — mirrors the hand-maintained blueprint files for blog,
// vacancies, cases, and team_members.  All fields defined inline (no fieldset
// import) so that provisioning never depends on the mrc_seo_fields fieldset
// being present.

function buildSeoTab(): YamlObject {
  return {
    display: 'SEO',
    sections: [
      {
        fields: [
          {
            handle: 'seo_title',
            field: {
              type:         'text',
              display:      'SEO title',
              instructions: 'Page title shown in search results. Leave empty to use the entry title.',
            },
          },
          {
            handle: 'seo_description',
            field: {
              type:         'textarea',
              display:      'SEO description',
              instructions: 'Meta description shown in search results (max 160 chars).',
            },
          },
          {
            handle: 'robots_noindex',
            field: {
              type:         'toggle',
              display:      'No-index',
              default:      false,
              instructions: 'Prevent search engines from indexing this page.',
            },
          },
          {
            handle: 'robots_nofollow',
            field: {
              type:         'toggle',
              display:      'No-follow',
              default:      false,
              instructions: 'Prevent search engines from following links on this page.',
            },
          },
          {
            handle: 'canonical_url',
            field: {
              type:         'text',
              display:      'Canonical URL',
              instructions: 'Override the default canonical URL. Leave empty to use the page URL.',
            },
          },
          {
            handle: 'og_title',
            field: {
              type:         'text',
              display:      'Social title',
              instructions: 'Title shown when shared on social media. Falls back to SEO title or entry title.',
            },
          },
          {
            handle: 'og_description',
            field: {
              type:         'textarea',
              display:      'Social description',
              instructions: 'Description shown when shared on social media. Falls back to SEO description.',
            },
          },
          {
            handle: 'og_image',
            field: {
              type:         'assets',
              display:      'Social image',
              max_files:    1,
              instructions: 'Image shown when shared on social media. Recommended: 1200x630px.',
            },
          },
        ],
      },
    ],
  };
}

// ── Card tab ───────────────────────────────────────────────────────────────────
//
// The Card tab surfaces the fields that drive listing cards, related content
// blocks, mega-menu feature columns, and search result snippets:
//
//   overview_image       — card thumbnail (default / inactive state)
//   overview_image_hover — optional GIF / action screenshot swapped in on hover
//   detail_image         — full-width hero for detail views
//   excerpt              — ≤ 160 chars used below titles in cards / mega menu
//
// Fields are imported from the `mrc_card_fields` fieldset so that:
//   • The definition is a single source of truth (fieldset file, not inline YAML)
//   • `overview_image_hover` is always present — inline generation previously
//     omitted it, which silently removed the hover-image field from the CMS
//     blueprint every time syncStatamicBlueprintAction() was called.
//   • Adding/changing a card field only requires editing the fieldset, not
//     every blueprint that imports it.
//
// This mirrors exactly what provisionSite() writes when first seeding the CMS.

function buildCardTab(): YamlObject {
  return {
    display: 'Card',
    sections: [
      {
        fields: [
          { import: 'mrc_card_fields' },
        ],
      },
    ],
  };
}

// ── Page Content tab ───────────────────────────────────────────────────────────

/**
 * Builds the Page Content tab containing a single `page_blocks` Replicator.
 *
 * The Replicator has a "Context Slots" group (always present when context blocks
 * are enabled) followed by one group per enabled content block category.
 * Every set uses `{ import: fieldset_name }` — fields are defined in fieldsets,
 * not inlined in the blueprint.
 */
function buildPageContentTab(
  enabledContextBlocks: readonly ContextBlockKey[],
  enabledContentBlocks: readonly ContentBlockKey[],
): YamlObject {
  const sets: YamlObject = {};

  // ── Context Slots group ────────────────────────────────────────────────────
  // Include whenever at least one non-notification context block is enabled.
  const hasContextBlocks = enabledContextBlocks.some((k) => k !== 'notification');
  if (hasContextBlocks) {
    sets.context_slots = {
      display: 'Context Slots',
      sets: {
        context_slot: {
          display: 'Context Slot',
          fields: [{ import: 'context_slot' }],
        },
      },
    };
  }

  // ── Content groups ─────────────────────────────────────────────────────────
  const groupSets: Partial<Record<ContentGroup, ContentSetDef[]>> = {};

  for (const key of enabledContentBlocks) {
    const def = CONTENT_SET_DEFS[key];
    if (!def) continue; // not a blueprintable block yet

    const list = groupSets[def.group] ?? (groupSets[def.group] = []);
    list.push(def);
  }

  const orderedGroups = (Object.keys(CONTENT_GROUP_META) as ContentGroup[])
    .filter((g) => groupSets[g] && groupSets[g]!.length > 0)
    .sort((a, b) => CONTENT_GROUP_META[a].order - CONTENT_GROUP_META[b].order);

  for (const group of orderedGroups) {
    const meta = CONTENT_GROUP_META[group];
    const groupObj: YamlObject = {
      display: meta.display,
      sets:    {} as YamlObject,
    };

    for (const setDef of groupSets[group]!) {
      (groupObj.sets as YamlObject)[setDef.setKey] = {
        display: setDef.display,
        fields:  [{ import: setDef.fieldsetName }],
      };
    }

    sets[group] = groupObj;
  }

  return {
    display: 'Page Content',
    sections: [
      {
        instructions:
          'Build the page by placing content around the fixed Context Slots. ' +
          'Context Slots are anchor points for personalised blocks — editors can ' +
          'only change the default variant key and toggle them on/off. ' +
          'Add, reorder, toggle, and delete content blocks freely.',
        fields: [
          {
            handle: 'page_blocks',
            field: {
              type:         'replicator',
              display:      'Page Blocks',
              collapse:     true,
              button_label: 'Add content block',
              sets,
            },
          },
        ],
      },
    ],
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate the YAML content for the Statamic `pages.yaml` blueprint.
 *
 * The output has exactly 4 tabs:
 *   - Meta         — always present (title, meta_keywords, template)
 *   - Card         — imports mrc_card_fields (overview_image, overview_image_hover, detail_image, excerpt)
 *   - Page Content — `page_blocks` Replicator with context slots + enabled content groups
 *   - SEO          — seo_title, seo_description, robots_noindex, robots_nofollow,
 *                    canonical_url, og_title, og_description, og_image
 *
 * Only includes:
 *   - The context_slot set when at least one ContextBlockKey (≠ "notification") is enabled
 *   - Content replicator sets only for mapped ContentBlockKeys in `contentBlocks`
 *
 * @param contextBlocks  Enabled adaptive context block keys for this tenant.
 * @param contentBlocks  Enabled free-zone content block keys for this tenant.
 * @returns  Valid YAML string suitable for writing to
 *           `resources/blueprints/collections/pages/pages.yaml`.
 */
export function generatePagesBlueprintYaml(
  contextBlocks: readonly ContextBlockKey[],
  contentBlocks: readonly ContentBlockKey[],
): string {
  const tabs: YamlObject = {};

  // 1. Meta tab — always present
  tabs.meta = buildMetaTab();

  // 2. Card tab — overview_image, detail_image, excerpt (listings + mega menu)
  tabs.card = buildCardTab();

  // 3. Page Content tab — page_blocks replicator with context slots + content groups
  tabs.content = buildPageContentTab(contextBlocks, contentBlocks);

  // 4. SEO tab — inline SEO fields (mirrors all other collection blueprints)
  tabs.seo = buildSeoTab();

  const blueprint = { title: 'Page', tabs };

  return stringify(blueprint, {
    indent:            2,
    lineWidth:         0,   // no line wrapping
    defaultKeyType:    'PLAIN',
    defaultStringType: 'PLAIN',
  });
}

// ── Sites YAML generator ───────────────────────────────────────────────────────

/**
 * Generates the content of `resources/sites.yaml` from a tenant language list.
 *
 * Statamic multi-site configuration — each language maps to one Statamic "site":
 *
 *   nl:
 *     name: Nederlands
 *     locale: nl_NL
 *     url: /
 *     attributes:
 *       showSite: 'true'
 *   en-gb:
 *     name: English
 *     locale: en_GB
 *     url: /en-gb
 *     attributes:
 *       showSite: 'false'
 *
 * `showSite: 'false'` means the site is defined and translatable in the CP
 * but not publicly visible.  The Next.js frontend reads this attribute to
 * conditionally show/hide the language switcher option.
 *
 * The default language (isDefault: true) always gets `url: /`; all others
 * get `url: /{code}`.
 *
 * When `languages` is empty or contains only one entry the generated YAML
 * is still valid — Statamic treats a single-site config as mono-lingual.
 *
 * @param languages  Ordered language list from tenant settings.
 * @returns  Valid YAML string for `resources/sites.yaml`.
 */
export function generateSitesYaml(languages: readonly TenantLanguageConfig[]): string {
  if (languages.length === 0) return '';

  const lines: string[] = [];
  for (const lang of languages) {
    const url = lang.isDefault ? '/' : `/${lang.code}`;
    lines.push(`${lang.code}:`);
    lines.push(`  name: ${lang.name}`);
    lines.push(`  locale: ${lang.locale}`);
    lines.push(`  url: ${url}`);
    lines.push(`  attributes:`);
    lines.push(`    showSite: '${lang.enabled ? 'true' : 'false'}'`);
  }
  lines.push('');   // trailing newline
  return lines.join('\n');
}
