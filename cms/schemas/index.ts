/**
 * Sanity Schema Loader
 *
 * Registers all document types and shared object types with the Sanity Studio
 * schema system.
 *
 * ─── How to use this file ─────────────────────────────────────────────────────
 *
 *   This file is the single source of truth for which schemas are active in
 *   the Studio. Import `schemaTypes` in your Sanity Studio's schema config:
 *
 *   Option A — Direct array export (recommended for Studio v3 `defineConfig`):
 *
 *   ```typescript
 *   // sanity.config.ts
 *   import { schemaTypes } from './cms/schemas'
 *
 *   export default defineConfig({
 *     schema: { types: schemaTypes },
 *   })
 *   ```
 *
 *   Option B — Via schemaTypes/index.ts (classic Studio structure):
 *
 *   ```typescript
 *   // schemaTypes/index.ts
 *   export { schemaTypes } from '../../cms/schemas'
 *   ```
 *
 * ─── Schema inventory ─────────────────────────────────────────────────────────
 *
 *   Site configuration (document types):
 *     siteSettings     Singleton — SEO defaults, logo, navigation, contact email,
 *                      and social links.
 *     navigationItem   A navigation link (label + linkType + internal/external target).
 *                      Referenced by siteSettings.mainNavigation and footerNavigation.
 *
 *   Pages (document types):
 *     page             A general-purpose CMS page with composable sections.
 *
 *   Adaptive content variants (document types):
 *     heroVariant      Hero block — headline, subtitle, CTA, eyebrow tag.
 *     proofVariant     Social proof block — section heading + array of proof items.
 *     ctaVariant       CTA block — headline, supporting copy, CTA button.
 *
 *   Content entities (document types — standalone, NOT page sections):
 *     company          A company/employer with logo, description, services, branches,
 *                      stats, and gallery images.
 *     newsArticle      A news article with headline, cover image, Portable Text body,
 *                      optional company reference, and editorial tags.
 *     vacancy          A job vacancy with job details, description (Portable Text),
 *                      requirements, process steps, and recruiter contact.
 *
 *   Page section blocks (object types — used inside page.sections):
 *     Core:
 *       textSection        Rich text with optional heading.
 *       featureGrid        Icon + title + body cards.
 *       testimonialSection Customer quote cards.
 *       faqSection         Question/answer accordion.
 *       ctaSection         Headline + CTA button(s).
 *       formSection        Platform-registered form embed.
 *     Listing / overview:
 *       listing            Item cards (title, href, excerpt, image).
 *       filterBar          Category / tag / sort controls.
 *       searchResults      Dynamic result set config.
 *     Detail (article / vacancy):
 *       articleMeta        Title, date, author, cover image, tags.
 *       articleBody        Portable Text body.
 *       relatedContent     Curated item teasers.
 *       vacancyMeta        Job metadata header.
 *       applyPanel         Application CTA panel.
 *     Search:
 *       search             Full-text search + inline results.
 *
 * ─── Adding a new schema ──────────────────────────────────────────────────────
 *
 *   1. Create cms/schemas/<schemaName>.ts (document) or
 *      cms/schemas/objects/<schemaName>.ts (object) following the conventions
 *      in this folder.
 *   2. Import it below.
 *   3. Add it to the schemaTypes array.
 *   4. Deploy the Studio.
 *
 * ─── Schema ordering note ─────────────────────────────────────────────────────
 *
 *   The order of document types in schemaTypes determines the order in the Studio
 *   sidebar (when using the default desk structure). Object types are registered
 *   but do not appear as top-level sidebar items — they appear only as options
 *   inside their parent documents' array fields.
 *
 *   Sidebar order:
 *     Site Settings → Navigation Items → Pages →
 *     Hero Variants → Proof Variants → CTA Variants →
 *     Companies → News Articles → Vacancies
 */

// ── Document types ─────────────────────────────────────────────────────────────
import siteSettings    from "./siteSettings";
import navigationItem  from "./navigationItem";
import page            from "./page";
import heroVariant     from "./heroVariant";
import proofVariant    from "./proofVariant";
import ctaVariant      from "./ctaVariant";

// ── Content entity document types ─────────────────────────────────────────────
import company         from "./company";
import newsArticle     from "./newsArticle";
import vacancy         from "./vacancy";

// ── Page section object types — core ──────────────────────────────────────────
import textSection        from "./objects/textSection";
import featureGrid        from "./objects/featureGrid";
import testimonialSection from "./objects/testimonialSection";
import faqSection         from "./objects/faqSection";
import ctaSection         from "./objects/ctaSection";
import formSection        from "./objects/formSection";

// ── Page section object types — listing / overview ────────────────────────────
import listing            from "./objects/listing";
import filterBar          from "./objects/filterBar";
import searchResults      from "./objects/searchResults";

// ── Page section object types — detail (article / vacancy) ────────────────────
import articleMeta        from "./objects/articleMeta";
import articleBody        from "./objects/articleBody";
import relatedContent     from "./objects/relatedContent";
import vacancyMeta        from "./objects/vacancyMeta";
import applyPanel         from "./objects/applyPanel";

// ── Page section object types — search ────────────────────────────────────────
import search             from "./objects/search";

// ── Page section object types — marketing / content ───────────────────────────
import logoStrip          from "./objects/logoStrip";
import stats              from "./objects/stats";
import about              from "./objects/about";
import newsList           from "./objects/newsList";

/**
 * All Sanity schema types registered for this project.
 *
 * Pass this array to `schema: { types: schemaTypes }` in `sanity.config.ts`.
 *
 * @example
 *   import { schemaTypes } from './cms/schemas'
 *   export default defineConfig({ schema: { types: schemaTypes } })
 */
export const schemaTypes = [
  // ── Site configuration (appear first in Studio sidebar) ──────────────────
  siteSettings,
  navigationItem,

  // ── Pages ────────────────────────────────────────────────────────────────
  page,

  // ── Adaptive content variants ────────────────────────────────────────────
  heroVariant,
  proofVariant,
  ctaVariant,

  // ── Content entity document types ────────────────────────────────────────
  company,
  newsArticle,
  vacancy,

  // ── Page section object types — core ─────────────────────────────────────
  textSection,
  featureGrid,
  testimonialSection,
  faqSection,
  ctaSection,
  formSection,

  // ── Page section object types — listing / overview ────────────────────────
  listing,
  filterBar,
  searchResults,

  // ── Page section object types — detail ───────────────────────────────────
  articleMeta,
  articleBody,
  relatedContent,
  vacancyMeta,
  applyPanel,

  // ── Page section object types — search ───────────────────────────────────
  search,

  // ── Page section object types — marketing / content ──────────────────────
  logoStrip,
  stats,
  about,
  newsList,
];

// Named exports for consumers who need individual schemas
export {
  siteSettings,
  navigationItem,
  page,
  heroVariant,
  proofVariant,
  ctaVariant,
  // content entity document types
  company,
  newsArticle,
  vacancy,
  // page section object types — core
  textSection,
  featureGrid,
  testimonialSection,
  faqSection,
  ctaSection,
  formSection,
  // page section object types — listing
  listing,
  filterBar,
  searchResults,
  // page section object types — detail
  articleMeta,
  articleBody,
  relatedContent,
  vacancyMeta,
  applyPanel,
  // page section object types — search
  search,
  // page section object types — marketing / content
  logoStrip,
  stats,
  about,
  newsList,
};
