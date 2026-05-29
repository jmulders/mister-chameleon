/**
 * /block-coverage
 *
 * Static reference page listing every block type and variant used on each
 * page of the Mister Chameleon marketing site, plus a coverage matrix showing
 * which variants are live vs. block-showcase-only.
 *
 * Not CMS-driven — kept as a static page so it never needs a re-seed and
 * is always in sync with the seed file comments above.
 */

import type { Metadata }    from "next";
import Link                  from "next/link";
import { Container }         from "@/components/primitives/Container";
import { Section }           from "@/components/primitives/Section";
import { Text }              from "@/components/primitives/Text";

export const metadata: Metadata = {
  title:       "Block Coverage Overview — Mister Chameleon",
  description: "Which blocks and variants are placed on which pages of the Mister Chameleon site.",
  robots:      { index: false },
};

// ── Data ──────────────────────────────────────────────────────────────────────

const PAGE_BLOCKS: { page: string; href: string; blocks: string }[] = [
  { page: "/  (home)",                         href: "/",                                blocks: "textSection:text_lead, featureGrid:feature_grid_3up ×2, textMedia:text_media_stacked, textMedia:text_media_right, stats:default, logoStrip:muted, testimonialSection:testimonial_grid ×2, processSteps:default, pricingSection:pricing_tiers, ctaSection:cta_banner" },
  { page: "/how-it-works",                     href: "/how-it-works",                   blocks: "textMedia:text_media_right, textSection:text_lead, processSteps:default, featureGrid:feature_grid_4up, ctaSection:cta_banner" },
  { page: "/why-personalisation",              href: "/why-personalisation",             blocks: "textMedia:text_media_right, textSection:text_lead, stats:default, featureGrid:feature_grid_3up, faqSection:faq_default, ctaSection:cta_banner" },
  { page: "/the-engine",                       href: "/the-engine",                     blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_4up, textMedia:text_media_left, processSteps:default, featureGrid:feature_grid_3up, ctaSection:cta_banner" },
  { page: "/manifesto",                        href: "/manifesto",                      blocks: "textSection:text_single, ctaSection:cta_banner" },
  { page: "/roadmap",                          href: "/roadmap",                        blocks: "textSection:text_lead, processSteps:default, timeline:timeline_vertical ✨, ctaSection:cta_banner" },
  { page: "/features",                         href: "/features",                       blocks: "textMedia:text_media_right, quickLinks:quicklinks_grid, featureGrid:feature_grid_4up, textMedia:text_media_right, contentSection:content_default ✨, ctaSection:cta_banner" },
  { page: "/features-segments",               href: "/features-segments",              blocks: "textSection:text_lead, featureGrid:feature_grid_3up, processSteps:default, ctaSection:cta_banner" },
  { page: "/features-intent",                 href: "/features-intent",                blocks: "textSection:text_lead, featureGrid:feature_grid_4up, textMedia:text_media_left, stats:default, ctaSection:cta_banner" },
  { page: "/features-enrichment",             href: "/features-enrichment",            blocks: "textMedia:text_media_right, featureGrid:feature_grid_3up, faqSection:faq_default, ctaSection:cta_banner" },
  { page: "/features-testing",                href: "/features-testing",               blocks: "textSection:text_lead, featureGrid:feature_grid_3up, ctaSection:cta_banner" },
  { page: "/features-analytics",              href: "/features-analytics",             blocks: "textSection:text_lead, featureGrid:feature_grid_4up, textMedia:text_media_left, stats:default, ctaSection:cta_banner" },
  { page: "/features-agency",                 href: "/features-agency",                blocks: "textMedia:text_media_right, featureGrid:feature_grid_3up, pricingSection:pricing_tiers, ctaSection:cta_banner" },
  { page: "/integrations",                     href: "/integrations",                   blocks: "textMedia:text_media_right, logoStrip:logo_grid, featureGrid:feature_grid_4up, ctaSection:cta_banner" },
  { page: "/security",                         href: "/security",                       blocks: "textMedia:text_media_right, featureGrid:feature_grid_3up, faqSection:faq_default, ctaSection:cta_banner" },
  { page: "/demo",                             href: "/demo",                           blocks: "textMedia:text_media_stacked, quickLinks:quicklinks_grid ×2, quickLinks:quicklinks_grid (dev tools) ✨" },
  { page: "/demo-controls",                   href: "/demo-controls",                  blocks: "textSection:text_lead, quickLinks:quicklinks_grid" },
  { page: "/demo/b2b/*  (12 pages)",          href: "/demo/b2b/new-visitor",           blocks: "textSection:text_lead, featureGrid:feature_grid_checklist, ctaSection:cta_banner" },
  { page: "/demo/careers/*  (6 pages)",       href: "/demo/careers/new-visitor",       blocks: "textSection:text_lead, featureGrid:feature_grid_checklist, ctaSection:cta_banner" },
  { page: "/pricing",                          href: "/pricing",                        blocks: "textMedia:text_media_right, pricingSection:pricing_tiers, logoStrip:muted, faqSection:faq_default, ctaSection:cta_banner" },
  { page: "/pricing-add-ons",                 href: "/pricing-add-ons",                blocks: "textSection:text_lead, featureGrid:feature_grid_3up, faqSection:faq_default, ctaSection:cta_banner" },
  { page: "/pricing-roi-calculator",          href: "/pricing-roi-calculator",         blocks: "textSection:text_lead, stats:default, featureGrid:feature_grid_3up, textMedia:text_media_right, formSection:form_default, ctaSection:cta_banner" },
  { page: "/order",                            href: "/order",                          blocks: "textSection:text_lead, quickLinks:quicklinks_grid, ctaSection:cta_banner" },
  { page: "/order/starter",                   href: "/order/starter",                  blocks: "cartSummary, checkoutBlock, featureGrid:feature_grid_3up" },
  { page: "/order/growth",                    href: "/order/growth",                   blocks: "cartSummary, checkoutBlock, featureGrid:feature_grid_3up" },
  { page: "/order/pro",                        href: "/order/pro",                      blocks: "cartSummary, checkoutBlock, featureGrid:feature_grid_3up" },
  { page: "/use-cases-saas",                  href: "/use-cases-saas",                 blocks: "textSection:text_lead, featureGrid:feature_grid_3up, testimonialSection:testimonial_grid, ctaSection:cta_banner" },
  { page: "/use-cases-ecommerce",             href: "/use-cases-ecommerce",            blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_3up, ctaSection:cta_banner" },
  { page: "/use-cases-recruitment",           href: "/use-cases-recruitment",          blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_3up, ctaSection:cta_banner" },
  { page: "/use-cases-real-estate",           href: "/use-cases-real-estate",          blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_3up, ctaSection:cta_banner" },
  { page: "/use-cases-agencies",              href: "/use-cases-agencies",             blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_3up, pricingSection:pricing_tiers, ctaSection:cta_banner" },
  { page: "/cases",                            href: "/cases",                          blocks: "textMedia:text_media_right, stats:default, newsList:default" },
  { page: "/cases/growlytics",                href: "/cases/growlytics",               blocks: "articleMeta:default, stats:default, articleBody:default, relatedContent:default" },
  { page: "/cases/jobbridge",                 href: "/cases/jobbridge",                blocks: "articleMeta:default, stats:default, articleBody:default, relatedContent:default" },
  { page: "/cases/frontline-agency",          href: "/cases/frontline-agency",         blocks: "articleMeta:default, stats:default, articleBody:default, relatedContent:default" },
  { page: "/blog",                             href: "/blog",                           blocks: "textMedia:text_media_right, newsList:default" },
  { page: "/blog/why-97-percent-traffic-leaves", href: "/blog/why-97-percent-traffic-leaves", blocks: "articleMeta:default, articleBody:default, relatedContent:default ×2" },
  { page: "/blog/intent-scoring-explained",   href: "/blog/intent-scoring-explained",  blocks: "articleMeta:default, articleBody:default, relatedContent:default ×2" },
  { page: "/blog/ip-to-company-enrichment-guide", href: "/blog/ip-to-company-enrichment-guide", blocks: "articleMeta:default, articleBody:default, relatedContent:default ×2" },
  { page: "/docs",                             href: "/docs",                           blocks: "textMedia:text_media_right, quickLinks:quicklinks_grid, processSteps:default, faqSection:faq_default, ctaSection:cta_banner" },
  { page: "/faq",                              href: "/faq",                            blocks: "textSection:text_single, faqSection:faq_default ×3" },
  { page: "/changelog",                        href: "/changelog",                      blocks: "textSection:text_lead" },
  { page: "/glossary",                         href: "/glossary",                       blocks: "textSection:text_lead, faqSection:faq_default" },
  { page: "/about",                            href: "/about",                          blocks: "textMedia:text_media_right, stats:default, featureGrid:feature_grid_3up, textMedia:text_media_left, testimonialSection:testimonial_grid, ctaSection:cta_banner" },
  { page: "/about-team",                      href: "/about-team",                     blocks: "textMedia:text_media_right, textSection:text_lead, teamSection:team_grid, recruiterPanel:default, ctaSection:cta_banner" },
  { page: "/jobs",                             href: "/jobs",                           blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_3up, newsList:default, recruiterPanel:default, ctaSection:cta_banner" },
  { page: "/jobs/senior-fullstack-engineer",  href: "/jobs/senior-fullstack-engineer", blocks: "vacancyMeta:default, articleBody:default, applyPanel:default" },
  { page: "/jobs/growth-marketing-manager",   href: "/jobs/growth-marketing-manager",  blocks: "vacancyMeta:default, articleBody:default, applyPanel:default" },
  { page: "/jobs/customer-success-manager",   href: "/jobs/customer-success-manager",  blocks: "vacancyMeta:default, articleBody:default, applyPanel:default" },
  { page: "/press",                            href: "/press",                          blocks: "textSection:text_single, ctaSection:cta_banner" },
  { page: "/contact",                          href: "/contact",                        blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_3up, formSection:form_default, mapBlock:default, ctaSection:cta_banner" },
  { page: "/partners",                         href: "/partners",                       blocks: "textMedia:text_media_right, textSection:text_lead, featureGrid:feature_grid_3up, ctaSection:cta_banner" },
  { page: "/cookies",                          href: "/cookies",                        blocks: "textSection:text_lead, faqSection:faq_default, featureGrid:feature_grid_3up, formSection:form_default, ctaSection:cta_banner" },
  { page: "/gdpr",                             href: "/gdpr",                           blocks: "textSection:text_lead, featureGrid:feature_grid_3up, ctaSection:cta_banner" },
  { page: "/privacy",                          href: "/privacy",                        blocks: "textSection:text_single" },
  { page: "/terms",                            href: "/terms",                          blocks: "textSection:text_single" },
  { page: "/sla",                              href: "/sla",                            blocks: "textSection:text_single" },
  { page: "/search",                           href: "/search",                         blocks: "search:search_default, filterBar:filter_default, searchResults:results_list" },
  { page: "/block-showcase",                  href: "/block-showcase",                 blocks: "All block types and all variants — reference only" },
];

type CoverageStatus = "live" | "showcase" | "na";

interface CoverageRow {
  blockType: string;
  variant:   string;
  status:    CoverageStatus;
  pages:     string;
}

const COVERAGE: CoverageRow[] = [
  // textSection
  { blockType: "textSection",       variant: "text_lead",               status: "live",     pages: "home, how-it-works, roadmap, features, …" },
  { blockType: "",                   variant: "text_single",             status: "live",     pages: "manifesto, faq, press, privacy, terms, sla" },
  { blockType: "",                   variant: "text_split",              status: "live",     pages: "about-team" },
  // richText
  { blockType: "richText",          variant: "default",                 status: "showcase", pages: "—" },
  // contentSection
  { blockType: "contentSection",    variant: "content_default",         status: "live",     pages: "/features ✨" },
  { blockType: "",                   variant: "content_split",           status: "showcase", pages: "—" },
  // featureGrid
  { blockType: "featureGrid",       variant: "feature_grid_3up",        status: "live",     pages: "home, why-personalisation, the-engine, …" },
  { blockType: "",                   variant: "feature_grid_4up",        status: "live",     pages: "how-it-works, the-engine, features, …" },
  { blockType: "",                   variant: "feature_grid_checklist",  status: "live",     pages: "all /demo/b2b/* and /demo/careers/* pages" },
  { blockType: "",                   variant: "feature_grid_cards",      status: "showcase", pages: "—" },
  { blockType: "",                   variant: "feature_grid_dark",       status: "showcase", pages: "—" },
  { blockType: "",                   variant: "feature_grid_spacious",   status: "showcase", pages: "—" },
  // processSteps
  { blockType: "processSteps",      variant: "default",                 status: "live",     pages: "home, how-it-works, the-engine, roadmap, docs, …" },
  // stats
  { blockType: "stats",             variant: "default",                 status: "live",     pages: "home, why-personalisation, features-intent, cases, about" },
  { blockType: "",                   variant: "compact",                 status: "showcase", pages: "—" },
  { blockType: "",                   variant: "dark",                    status: "showcase", pages: "—" },
  // testimonialSection
  { blockType: "testimonialSection",variant: "testimonial_grid",        status: "live",     pages: "home ×2, about, use-cases-saas" },
  { blockType: "",                   variant: "testimonial_single",      status: "showcase", pages: "—" },
  { blockType: "",                   variant: "testimonial_highlight",   status: "showcase", pages: "—" },
  { blockType: "",                   variant: "testimonial_slider",      status: "showcase", pages: "—" },
  { blockType: "",                   variant: "testimonial_featured_image", status: "showcase", pages: "—" },
  // logoStrip
  { blockType: "logoStrip",         variant: "muted",                   status: "live",     pages: "home, pricing" },
  { blockType: "",                   variant: "default",                 status: "showcase", pages: "—" },
  { blockType: "",                   variant: "logo_grid",               status: "live",     pages: "integrations" },
  { blockType: "",                   variant: "logo_wall_light",         status: "showcase", pages: "—" },
  // textMedia
  { blockType: "textMedia",         variant: "text_media_right",        status: "live",     pages: "home, how-it-works, the-engine, features, …" },
  { blockType: "",                   variant: "text_media_left",         status: "live",     pages: "the-engine, features-intent, about" },
  { blockType: "",                   variant: "text_media_stacked",      status: "live",     pages: "home, demo" },
  // faqSection
  { blockType: "faqSection",        variant: "faq_default",             status: "live",     pages: "why-personalisation, security, pricing, docs, …" },
  { blockType: "",                   variant: "faq_split",               status: "showcase", pages: "—" },
  // teamSection
  { blockType: "teamSection",       variant: "team_grid",               status: "live",     pages: "about-team" },
  { blockType: "",                   variant: "team_compact",            status: "showcase", pages: "—" },
  // ctaSection
  { blockType: "ctaSection",        variant: "cta_banner",              status: "live",     pages: "home, and virtually every page" },
  { blockType: "",                   variant: "cta_split",               status: "showcase", pages: "—" },
  { blockType: "",                   variant: "cta_card",                status: "showcase", pages: "—" },
  { blockType: "",                   variant: "cta_banner_default",      status: "showcase", pages: "—" },
  { blockType: "",                   variant: "cta_banner_compact",      status: "showcase", pages: "—" },
  { blockType: "",                   variant: "cta_glow",                status: "showcase", pages: "—" },
  { blockType: "",                   variant: "cta_soft",                status: "showcase", pages: "—" },
  { blockType: "",                   variant: "cta_media_first",         status: "showcase", pages: "—" },
  { blockType: "",                   variant: "cta_newsletter",          status: "showcase", pages: "—" },
  // formSection
  { blockType: "formSection",       variant: "form_default",            status: "live",     pages: "contact, pricing-roi-calculator, cookies" },
  { blockType: "",                   variant: "form_inline",             status: "showcase", pages: "—" },
  { blockType: "",                   variant: "form_split",              status: "showcase", pages: "—" },
  { blockType: "",                   variant: "form_panel",              status: "showcase", pages: "—" },
  // pricingSection
  { blockType: "pricingSection",    variant: "pricing_tiers",           status: "live",     pages: "home, features-agency, pricing, use-cases-agencies" },
  { blockType: "",                   variant: "pricing_compact",         status: "showcase", pages: "—" },
  { blockType: "",                   variant: "pricing_table",           status: "showcase", pages: "—" },
  // mapBlock
  { blockType: "mapBlock",          variant: "default",                 status: "live",     pages: "contact" },
  // contactSection
  { blockType: "contactSection",    variant: "contact_default",         status: "showcase", pages: "—" },
  { blockType: "",                   variant: "contact_split",           status: "showcase", pages: "—" },
  { blockType: "",                   variant: "contact_minimal",         status: "showcase", pages: "—" },
  // newsList
  { blockType: "newsList",          variant: "default",                 status: "live",     pages: "cases, blog, jobs" },
  { blockType: "",                   variant: "list",                    status: "showcase", pages: "—" },
  { blockType: "",                   variant: "news_slider",             status: "showcase", pages: "—" },
  { blockType: "",                   variant: "featured",                status: "showcase", pages: "—" },
  // listing
  { blockType: "listing",           variant: "listing_cards",           status: "showcase", pages: "—" },
  { blockType: "",                   variant: "listing_rows",            status: "showcase", pages: "—" },
  { blockType: "",                   variant: "listing_slider",          status: "showcase", pages: "—" },
  { blockType: "",                   variant: "listing_compact",         status: "showcase", pages: "—" },
  // articleMeta
  { blockType: "articleMeta",       variant: "default",                 status: "live",     pages: "all /cases/* and /blog/* detail pages" },
  { blockType: "",                   variant: "compact",                 status: "showcase", pages: "—" },
  { blockType: "",                   variant: "hero",                    status: "showcase", pages: "—" },
  // articleBody
  { blockType: "articleBody",       variant: "default",                 status: "live",     pages: "all /cases/*, /blog/*, and /jobs/* detail pages" },
  { blockType: "",                   variant: "wide",                    status: "showcase", pages: "—" },
  // relatedContent
  { blockType: "relatedContent",    variant: "default",                 status: "live",     pages: "all /cases/* and /blog/* detail pages" },
  { blockType: "",                   variant: "list",                    status: "showcase", pages: "—" },
  { blockType: "",                   variant: "related_slider",          status: "showcase", pages: "—" },
  { blockType: "",                   variant: "carousel",                status: "showcase", pages: "—" },
  // vacancyMeta
  { blockType: "vacancyMeta",       variant: "default",                 status: "live",     pages: "all /jobs/* detail pages" },
  { blockType: "",                   variant: "compact",                 status: "showcase", pages: "—" },
  { blockType: "",                   variant: "sidebar",                 status: "showcase", pages: "—" },
  // applyPanel
  { blockType: "applyPanel",        variant: "default",                 status: "live",     pages: "all /jobs/* detail pages" },
  { blockType: "",                   variant: "inline",                  status: "showcase", pages: "—" },
  { blockType: "",                   variant: "sticky",                  status: "showcase", pages: "—" },
  // recruiterPanel
  { blockType: "recruiterPanel",    variant: "default",                 status: "live",     pages: "about-team, jobs" },
  { blockType: "",                   variant: "compact",                 status: "showcase", pages: "—" },
  { blockType: "",                   variant: "card",                    status: "showcase", pages: "—" },
  // cartSummary / checkoutBlock
  { blockType: "cartSummary",       variant: "cart_summary",            status: "live",     pages: "/order/starter, /order/growth, /order/pro" },
  { blockType: "checkoutBlock",     variant: "checkout_default",        status: "live",     pages: "/order/starter, /order/growth, /order/pro" },
  // quickLinks
  { blockType: "quickLinks",        variant: "quicklinks_grid",         status: "live",     pages: "features, demo ×3, demo-controls, docs, order" },
  { blockType: "",                   variant: "quicklinks_list",         status: "showcase", pages: "—" },
  { blockType: "",                   variant: "quicklinks_compact",      status: "showcase", pages: "—" },
  // timeline
  { blockType: "timeline",          variant: "timeline_vertical",       status: "live",     pages: "/roadmap ✨" },
  { blockType: "",                   variant: "timeline_compact",        status: "showcase", pages: "—" },
  { blockType: "",                   variant: "timeline_milestones",     status: "showcase", pages: "—" },
  // filterBar / search / searchResults
  { blockType: "filterBar",         variant: "filter_default",          status: "live",     pages: "/search" },
  { blockType: "",                   variant: "compact",                 status: "showcase", pages: "—" },
  { blockType: "",                   variant: "expanded",                status: "showcase", pages: "—" },
  { blockType: "search",            variant: "search_default",          status: "live",     pages: "/search" },
  { blockType: "searchResults",     variant: "results_list",            status: "live",     pages: "/search" },
  { blockType: "",                   variant: "grid",                    status: "showcase", pages: "—" },
  // product blocks
  { blockType: "productOverview",   variant: "product_cards",           status: "showcase", pages: "—" },
  { blockType: "productDetail",     variant: "product_detail",          status: "showcase", pages: "—" },
];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CoverageStatus }) {
  if (status === "live") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "0.25rem",
        fontSize: "0.75rem", fontWeight: 600,
        color: "#16a34a",
        backgroundColor: "#dcfce7",
        border: "1px solid #bbf7d0",
        borderRadius: "0.375rem",
        padding: "0.125rem 0.5rem",
      }}>
        ✅ live
      </span>
    );
  }
  if (status === "showcase") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "0.25rem",
        fontSize: "0.75rem", fontWeight: 500,
        color: "#92400e",
        backgroundColor: "#fef3c7",
        border: "1px solid #fde68a",
        borderRadius: "0.375rem",
        padding: "0.125rem 0.5rem",
      }}>
        🟡 showcase only
      </span>
    );
  }
  return null;
}

// ── Shared table styles ────────────────────────────────────────────────────────

const TH_STYLE: React.CSSProperties = {
  padding: "0.625rem 0.875rem",
  textAlign: "left",
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  borderBottom: "2px solid var(--card-border)",
  whiteSpace: "nowrap",
  backgroundColor: "var(--bg-subtle)",
};

const TD_STYLE: React.CSSProperties = {
  padding: "0.5rem 0.875rem",
  fontSize: "0.8125rem",
  color: "var(--text)",
  borderBottom: "1px solid var(--card-border)",
  verticalAlign: "top",
};

const TD_MUTED: React.CSSProperties = {
  ...TD_STYLE,
  color: "var(--text-muted)",
};

const CODE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, 'Cascadia Code', monospace)",
  fontSize: "0.75rem",
  backgroundColor: "var(--bg-subtle)",
  border: "1px solid var(--card-border)",
  borderRadius: "0.25rem",
  padding: "0.0625rem 0.3rem",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BlockCoveragePage() {
  const liveCt     = COVERAGE.filter((r) => r.status === "live").length;
  const showcaseCt = COVERAGE.filter((r) => r.status === "showcase").length;

  return (
    <>
      {/* ── Header ── */}
      <Section spacing="lg" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--card-border)" }}>
        <Container size="xl">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link
                href="/block-showcase"
                style={{
                  fontSize: "0.8125rem", color: "var(--primary)",
                  textDecoration: "none", fontWeight: 500,
                }}
              >
                ← Block showcase
              </Link>
              <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>/</span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>Block Coverage Overview</span>
            </div>
            <Text variant="h1" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}>
              Block Coverage Overview
            </Text>
            <Text variant="body" color="muted">
              Which blocks and variants are placed on which pages of the Mister Chameleon marketing site.
              Last updated: April 2026.
            </Text>

            {/* Summary pills */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
              {[
                { label: `${liveCt} variants live on real pages`,       bg: "#dcfce7", border: "#bbf7d0", color: "#15803d" },
                { label: `${showcaseCt} variants block-showcase only`,  bg: "#fef3c7", border: "#fde68a", color: "#92400e" },
                { label: "0 variants not implemented",                   bg: "var(--bg-subtle)", border: "var(--card-border)", color: "var(--text-muted)" },
              ].map((p) => (
                <span
                  key={p.label}
                  style={{
                    fontSize: "0.8125rem", fontWeight: 600,
                    color: p.color, backgroundColor: p.bg,
                    border: `1px solid ${p.border}`,
                    borderRadius: "2rem", padding: "0.25rem 0.875rem",
                  }}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      {/* ── Table 1: blocks per page ── */}
      <Section spacing="xl" style={{ background: "var(--bg)" }}>
        <Container size="xl">
          <div style={{ marginBottom: "1.5rem" }}>
            <Text variant="h2" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}>
              Block types used per page
            </Text>
            <Text variant="body-sm" color="muted" style={{ marginTop: "0.375rem" }}>
              Click any page URL to open it. ✨ marks blocks newly added to that page.
            </Text>
          </div>

          <div style={{
            border: "1px solid var(--card-border)",
            borderRadius: "var(--card-radius, 0.5rem)",
            overflow: "hidden",
            overflowX: "auto",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, width: "220px" }}>Page</th>
                  <th style={TH_STYLE}>Blocks &amp; variants used</th>
                </tr>
              </thead>
              <tbody>
                {PAGE_BLOCKS.map((row, i) => (
                  <tr
                    key={row.href + i}
                    style={{ backgroundColor: i % 2 === 0 ? "var(--card-bg)" : "var(--bg-subtle)" }}
                  >
                    <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>
                      <Link
                        href={row.href}
                        style={{
                          color: "var(--primary)",
                          textDecoration: "none",
                          fontFamily: "var(--font-mono, ui-monospace, monospace)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                        }}
                      >
                        {row.page}
                      </Link>
                    </td>
                    <td style={TD_MUTED}>
                      {row.blocks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* ── Table 2: block coverage by type ── */}
      <Section spacing="xl" style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--card-border)" }}>
        <Container size="xl">
          <div style={{ marginBottom: "1.5rem" }}>
            <Text variant="h2" style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}>
              Block coverage by type
            </Text>
            <Text variant="body-sm" color="muted" style={{ marginTop: "0.375rem" }}>
              Showing which variants from{" "}
              <Link href="/block-showcase" style={{ color: "var(--primary)", textDecoration: "none" }}>
                /block-showcase
              </Link>{" "}
              are live on real pages vs. showcase-only.
            </Text>
          </div>

          <div style={{
            border: "1px solid var(--card-border)",
            borderRadius: "var(--card-radius, 0.5rem)",
            overflow: "hidden",
            overflowX: "auto",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, width: "180px" }}>Block type</th>
                  <th style={{ ...TH_STYLE, width: "220px" }}>Variant</th>
                  <th style={{ ...TH_STYLE, width: "160px" }}>Status</th>
                  <th style={TH_STYLE}>Page(s)</th>
                </tr>
              </thead>
              <tbody>
                {COVERAGE.map((row, i) => (
                  <tr
                    key={`${row.blockType}-${row.variant}-${i}`}
                    style={{ backgroundColor: i % 2 === 0 ? "var(--card-bg)" : "var(--bg-subtle)" }}
                  >
                    <td style={{ ...TD_STYLE, fontWeight: row.blockType ? 600 : 400 }}>
                      {row.blockType
                        ? <code style={CODE_STYLE}>{row.blockType}</code>
                        : null}
                    </td>
                    <td style={TD_STYLE}>
                      <code style={CODE_STYLE}>{row.variant}</code>
                    </td>
                    <td style={TD_STYLE}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={TD_MUTED}>{row.pages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* ── Footer note ── */}
      <Section spacing="lg" style={{ background: "var(--bg)", borderTop: "1px solid var(--card-border)" }}>
        <Container size="xl">
          <Text variant="body-sm" color="muted">
            <strong>All block types have at least one variant on a real page.</strong> The 🟡 showcase-only variants are
            intentional alternates your CMS authors can choose from — they are implemented and working, just not yet placed
            on any page. The most likely next additions: more <code style={CODE_STYLE}>ctaSection</code> variants (cta_split,
            cta_newsletter), the remaining <code style={CODE_STYLE}>testimonialSection</code> layouts, and{" "}
            <code style={CODE_STYLE}>listing</code> variants for search and blog use cases.
          </Text>
        </Container>
      </Section>
    </>
  );
}
