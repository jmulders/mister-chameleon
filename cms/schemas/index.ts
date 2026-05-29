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
 *     heroVariant        Hero block — headline, subtitle, CTA, eyebrow tag.
 *     proofVariant       Social proof block — section heading + array of proof items.
 *     ctaVariant         CTA block — headline, supporting copy, CTA button.
 *     featureVariant     Feature highlights / benefit grid — section heading + items.
 *     conversionVariant  Conversion section — headline, copy, CTAs, optional form.
 *
 *   Content entities (document types — standalone, NOT page sections):
 *     company          A company/employer with logo, description, services, branches,
 *                      stats, and gallery images.
 *     newsArticle      A news article with headline, cover image, Portable Text body,
 *                      optional company reference, and editorial tags.
 *     vacancy          A job vacancy with job details, description (Portable Text),
 *                      requirements, process steps, and recruiter contact.
 *     eventEntry       An event with name, start/end dates, location, cover image,
 *                      Portable Text description, and a registration URL.
 *     formDefinition   A reusable CMS-managed form with field definitions, success
 *                      behaviour, and email actions (confirmation + backoffice).
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
 *       recruiterPanel     Recruiter / contact-person spotlight.
 *     Search:
 *       search             Full-text search + inline results.
 *     Rich editorial / marketing:
 *       contentSection     Eyebrow + heading + intro + body + CTAs.
 *       textMedia          Text + image/video split block.
 *       teamSection        Team member card grid or compact list.
 *       timeline           Ordered milestones / history entries.
 *       quickLinks         Navigation hub / resource directory.
 *       processSteps       Ordered step-by-step process list.
 *       pricingSection     Pricing tiers / plans.
 *       contactSection     Contact details + optional map.
 *     Commerce / product:
 *       productOverview    Product card grid with optional prices, badges, and CTAs.
 *       productDetail      Full product detail view with gallery, specs, and price.
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
 *     Feature Variants → Conversion Variants →
 *     Companies → News Articles → Vacancies → Events
 */

// ── Document types ─────────────────────────────────────────────────────────────
import siteSettings    from "./siteSettings";
import navigationItem  from "./navigationItem";
import page            from "./page";
import heroVariant        from "./heroVariant";
import proofVariant       from "./proofVariant";
import ctaVariant         from "./ctaVariant";
import featureVariant     from "./featureVariant";
import conversionVariant      from "./conversionVariant";
import notificationVariant    from "./notificationVariant";

// ── Content entity document types ─────────────────────────────────────────────
import company         from "./company";
import newsArticle     from "./newsArticle";
import vacancy         from "./vacancy";
import eventEntry      from "./eventEntry";
import formDefinition  from "./formDefinition";

// ── Form definition object types (embedded inside formDefinition documents) ────
import formFieldDef from "./objects/formFieldDef";
import emailAction  from "./objects/emailAction";

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
import recruiterPanel     from "./objects/recruiterPanel";

// ── Page section object types — search ────────────────────────────────────────
import search             from "./objects/search";

// ── Page section object types — marketing / content ───────────────────────────
import logoStrip          from "./objects/logoStrip";
import stats              from "./objects/stats";
import about              from "./objects/about";
import newsList           from "./objects/newsList";

// ── Page section object types — rich editorial / marketing ────────────────────
import contentSection     from "./objects/contentSection";
import textMedia          from "./objects/textMedia";
import teamSection        from "./objects/teamSection";
import timeline           from "./objects/timeline";
import quickLinks         from "./objects/quickLinks";
import processSteps       from "./objects/processSteps";
import pricingSection     from "./objects/pricingSection";
import contactSection     from "./objects/contactSection";

// ── Page section object types — commerce / product ────────────────────────────
import productOverview     from "./objects/productOverview";
import productDetail       from "./objects/productDetail";

// ── AI decision metadata object type ─────────────────────────────────────────
import variantDecisionMeta from "./objects/variantDecisionMeta";

// ── Mega menu object types ─────────────────────────────────────────────────────
import megaMenuColumn, { megaMenuLinkItem, megaMenuMediaItem } from "./objects/megaMenuColumn";

// ── Footer structure object types ─────────────────────────────────────────────
import footerColumn, { footerLinkSchema } from "./objects/footerColumn";

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
  featureVariant,
  conversionVariant,
  notificationVariant,

  // ── Content entity document types ────────────────────────────────────────
  company,
  newsArticle,
  vacancy,
  eventEntry,
  formDefinition,

  // ── Form definition object types (embedded inside formDefinition) ─────────
  formFieldDef,
  emailAction,

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
  recruiterPanel,

  // ── Page section object types — search ───────────────────────────────────
  search,

  // ── Page section object types — marketing / content ──────────────────────
  logoStrip,
  stats,
  about,
  newsList,

  // ── Page section object types — rich editorial / marketing ───────────────
  contentSection,
  textMedia,
  teamSection,
  timeline,
  quickLinks,
  processSteps,
  pricingSection,
  contactSection,

  // ── Page section object types — commerce / product ───────────────────────
  productOverview,
  productDetail,

  // ── Mega menu object types (embedded — not top-level documents) ─────────────
  megaMenuLinkItem,
  megaMenuMediaItem,
  megaMenuColumn,

  // ── Footer structure object types (embedded — not top-level documents) ──────
  footerLinkSchema,
  footerColumn,

  // ── AI decision metadata (embedded object — not a top-level document) ─────
  variantDecisionMeta,
];

// Named exports for consumers who need individual schemas
export {
  siteSettings,
  navigationItem,
  page,
  heroVariant,
  proofVariant,
  ctaVariant,
  featureVariant,
  conversionVariant,
  notificationVariant,
  // content entity document types
  company,
  newsArticle,
  vacancy,
  eventEntry,
  formDefinition,
  // form definition object types
  formFieldDef,
  emailAction,
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
  // page section object types — rich editorial / marketing
  contentSection,
  textMedia,
  teamSection,
  timeline,
  quickLinks,
  processSteps,
  pricingSection,
  contactSection,
  recruiterPanel,
  // page section object types — commerce / product
  productOverview,
  productDetail,
  // footer structure object types
  footerLinkSchema,
  footerColumn,
  // AI decision metadata object type
  variantDecisionMeta,
};
