/**
 * Entity-Page Assemblers
 *
 * Pure functions that convert standalone CMS entity documents
 * (NewsArticleData, VacancyData, CompanyData) into PageData objects
 * consumable by the standard mapPageDataToPageConfig() pipeline.
 *
 * ─── Architecture role ────────────────────────────────────────────────────────
 *
 *   Entity document (from CMSProvider.get*BySlug())
 *        ↓  mapNewsArticleToPageData()   ← this file
 *        ↓  mapVacancyToPageData()
 *        ↓  mapCompanyToPageData()
 *   PageData  { templateKey: "detail-page", sections: [...] }
 *        ↓  mapPageDataToPageConfig()    ← page-config-mapper.ts
 *   PageConfig  (drives rendering)
 *
 * ─── Contract ─────────────────────────────────────────────────────────────────
 *
 *   1. CMS does NOT define layout logic.
 *      Assemblers convert structured entity data into an ordered block sequence.
 *      Block variants are left unset (defaults); the block component decides
 *      presentation.  No layout values, no CSS, no hardcoded column counts.
 *
 *   2. templateKey is always "detail-page".
 *      All entity detail pages use the detail-page template (no context slots).
 *      Context slot personalisation belongs on the page that HOSTS a listing
 *      or entry point to the entity, not on the entity detail page itself.
 *
 *   3. _key values are deterministic.
 *      Section keys are derived from the entity id with a block-type suffix
 *      (e.g. `${id}-meta`, `${id}-body`) so repeated calls for the same entity
 *      always produce the same stable React keys.
 *
 *   4. Optional blocks are only included when data is present.
 *      Assemblers skip blocks whose required fields are absent to avoid
 *      rendering empty shells (e.g. no relatedContent when items is empty).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In an app/ route handler or RSC:
 *   const article = await cmsProvider.getNewsArticleBySlug(slug);
 *   if (!article) notFound();
 *   const pageData   = mapNewsArticleToPageData(article);
 *   const pageConfig = mapPageDataToPageConfig(pageData);
 *   return <TemplateRenderer pageConfig={pageConfig} />;
 */

import type {
  NewsArticleData,
  VacancyData,
  CompanyData,
  PageData,
  PageSectionData,
  ArticleMetaData,
  ArticleBodyData,
  VacancyMetaData,
  ApplyPanelData,
  TextSectionData,
  FeatureGridData,
  FeatureItemData,
} from "@/cms/types";

// ── NewsArticle → PageData ─────────────────────────────────────────────────────

/**
 * Convert a NewsArticleData document into a PageData with detail-page template.
 *
 * Block sequence:
 *   1. articleMeta  — title, publication date, author, cover image, tags
 *   2. articleBody  — Portable Text body (only when body is non-empty)
 *
 * The caller may post-process the returned PageData to append a relatedContent
 * block with sibling articles before passing it to mapPageDataToPageConfig().
 *
 * @param article  A published NewsArticleData document from the CMS.
 * @returns        PageData ready for mapPageDataToPageConfig().
 */
export function mapNewsArticleToPageData(article: NewsArticleData): PageData {
  const id = article.id;

  const sections: PageSectionData[] = [];

  // ── Article meta ───────────────────────────────────────────────────────────
  const metaSection: ArticleMetaData = {
    _key:         `${id}-meta`,
    _type:        "articleMeta",
    title:        article.title,
    publishedAt:  article.publishedAt,
    tags:         article.tags,
    summary:      article.excerpt,
    coverImageUrl: article.coverImage?.url,
    coverImageAlt: article.coverImage?.alt,
  };
  sections.push(metaSection);

  // ── Article body (only when content is present) ────────────────────────────
  if (article.body && article.body.length > 0) {
    const bodySection: ArticleBodyData = {
      _key:  `${id}-body`,
      _type: "articleBody",
      body:  article.body,
    };
    sections.push(bodySection);
  }

  return {
    id,
    title:       article.title,
    slug:        article.slug,
    seoTitle:    article.title,
    seoDescription: article.excerpt,
    templateKey: "detail-page",
    sections,
  };
}

// ── Vacancy → PageData ────────────────────────────────────────────────────────

/**
 * Convert a VacancyData document into a PageData with detail-page template.
 *
 * Block sequence:
 *   1. vacancyMeta  — job title, location, contract type, salary, dates
 *   2. articleBody  — job description as Portable Text (when present)
 *   3. applyPanel   — application CTA with optional closing date
 *
 * @param vacancy  A published VacancyData document from the CMS.
 * @returns        PageData ready for mapPageDataToPageConfig().
 */
export function mapVacancyToPageData(vacancy: VacancyData): PageData {
  const id = vacancy.id;

  const sections: PageSectionData[] = [];

  // ── Vacancy meta ───────────────────────────────────────────────────────────
  const metaSection: VacancyMetaData = {
    _key:         `${id}-meta`,
    _type:        "vacancyMeta",
    title:        vacancy.title,
    department:   vacancy.department,
    location:     vacancy.location,
    remote:       vacancy.remote,
    contractType: vacancy.contractType,
    hoursPerWeek: vacancy.hoursPerWeek,
    salaryRange:  vacancy.salaryRange,
    startDate:    vacancy.startDate,
    closingDate:  vacancy.closingDate,
  };
  sections.push(metaSection);

  // ── Job description body (when present) ────────────────────────────────────
  if (vacancy.description && vacancy.description.length > 0) {
    const bodySection: ArticleBodyData = {
      _key:  `${id}-body`,
      _type: "articleBody",
      body:  vacancy.description,
    };
    sections.push(bodySection);
  }

  // ── Apply panel ────────────────────────────────────────────────────────────
  const applySection: ApplyPanelData = {
    _key:         `${id}-apply`,
    _type:        "applyPanel",
    heading:      "Solliciteer",
    closingDate:  vacancy.closingDate,
    primaryCta:   { label: "Solliciteer nu", href: `/${vacancy.slug}/apply` },
  };
  sections.push(applySection);

  return {
    id,
    title:    vacancy.title,
    slug:     vacancy.slug,
    seoTitle: vacancy.title,
    seoDescription: vacancy.company
      ? `${vacancy.title} bij ${vacancy.company.name}${vacancy.location ? ` in ${vacancy.location}` : ""}`
      : vacancy.title,
    templateKey: "detail-page",
    sections,
  };
}

// ── Company → PageData ────────────────────────────────────────────────────────

/**
 * Convert a CompanyData document into a PageData with detail-page template.
 *
 * Block sequence:
 *   1. textSection  — company description as plain text intro (when present)
 *   2. featureGrid  — services as feature cards (when at least one service exists)
 *
 * The caller may post-process the returned PageData to append a listing block
 * of associated vacancies or news articles before passing it to
 * mapPageDataToPageConfig().
 *
 * @param company  A published CompanyData document from the CMS.
 * @returns        PageData ready for mapPageDataToPageConfig().
 */
export function mapCompanyToPageData(company: CompanyData): PageData {
  const id = company.id;

  const sections: PageSectionData[] = [];

  // ── Description (when present) ─────────────────────────────────────────────
  if (company.description) {
    const descSection: TextSectionData = {
      _key:    `${id}-desc`,
      _type:   "textSection",
      heading: company.name,
      // Wrap plain description string in a minimal Portable Text block so
      // the renderer's PortableTextRenderer can handle it without adapters.
      body: [
        {
          _type:    "block",
          _key:     `${id}-desc-p0`,
          style:    "normal",
          children: [{ _type: "span", text: company.description, marks: [] }],
        },
      ],
    };
    sections.push(descSection);
  }

  // ── Services as feature cards (when at least one service exists) ───────────
  const serviceLabels = (company.services ?? [])
    .map((s) => (typeof s === "string" ? s : (s as { label: string }).label))
    .filter(Boolean);

  if (serviceLabels.length > 0) {
    const features: FeatureItemData[] = serviceLabels.map((label) => ({
      title:       label,
      description: "",
    }));

    const servicesSection: FeatureGridData = {
      _key:     `${id}-services`,
      _type:    "featureGrid",
      heading:  "Diensten",
      features,
    };
    sections.push(servicesSection);
  }

  return {
    id,
    title:       company.name,
    slug:        company.slug,
    seoTitle:    company.name,
    seoDescription: company.description,
    templateKey: "detail-page",
    sections,
  };
}
