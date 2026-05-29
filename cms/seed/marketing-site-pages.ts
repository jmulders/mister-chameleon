/**
 * Marketing Site Pages - browser-safe content module
 *
 * Exports all page documents for the Mister Chameleon marketing site.
 * No Node.js imports - safe to use in Sanity Studio (Vite) and the CLI seed.
 *
 * Imported by:
 *   cms/seed/marketing-site-seed.ts  - CLI runner
 *   apps/studio/plugins/seed-tool.tsx - Studio UI button
 */

// ── Portable Text helper ───────────────────────────────────────────────────────

type PTBlock = {
  _type: "block"; _key: string; style: string;
  markDefs: unknown[]; children: { _type: "span"; _key: string; text: string; marks: string[] }[];
};

function pt(...paragraphs: string[]): PTBlock[] {
  return paragraphs.map((text, i) => ({
    _type: "block", _key: `b${i}`, style: "normal", markDefs: [],
    children: [{ _type: "span", _key: `s${i}`, text, marks: [] }],
  }));
}

// ── Page document factory ──────────────────────────────────────────────────────

const TENANT = "mister-chameleon";

function page(
  id: string,
  slug: string,
  title: string,
  template: "marketing-page" | "landing-page" | "careers-page" | "article-page" | "listing-page" | "detail-page",
  seoTitle: string,
  seoDescription: string,
  sections: Record<string, unknown>[],
  contextConfig?: Record<string, unknown>,
  metaKeywords?: string[],
) {
  return {
    _id:         `mister-chameleon_page_${id}`,
    _type:       "page",
    tenantId:    TENANT,
    title,
    slug:        { _type: "slug", current: slug },
    templateKey: template,
    seoTitle,
    seoDescription,
    isPublished: true,
    ...(contextConfig ? { contextConfig } : {}),
    ...(metaKeywords && metaKeywords.length > 0 ? { metaKeywords } : {}),
    sections: sections.map((s, i) => ({ ...s, _key: s._key ?? `sec-${i}` })),
  };
}

// ── Section builders ───────────────────────────────────────────────────────────

function textSec(key: string, variant: string, heading: string, body: PTBlock[], surface?: string) {
  return { _type: "textSection", _key: key, variant, heading, body, ...(surface ? { surface } : {}) };
}

function featureGrid(key: string, heading: string, variant: string, features: { title: string; description: string; icon?: string }[], cta?: { label: string; href: string }, surface?: string) {
  return {
    _type: "featureGrid", _key: key, variant, heading,
    features: features.map((f, i) => ({ ...f, _key: `f${i}`, icon: f.icon ?? "" })),
    ...(cta ? { ctaLabel: cta.label, ctaHref: cta.href, ctaVariant: "primary" } : {}),
    ...(surface ? { surface } : {}),
  };
}

function faqSec(key: string, heading: string, items: { question: string; answer: string }[], surface?: string) {
  return {
    _type: "faqSection", _key: key, variant: "faq_default", heading,
    items: items.map((q, i) => ({ ...q, _key: `fq${i}` })),
    ...(surface ? { surface } : {}),
  };
}

function processSec(key: string, heading: string, steps: { title: string; description: string; duration?: string }[], surface?: string) {
  return {
    _type: "processSteps", _key: key, variant: "default", heading,
    steps: steps.map((s, i) => ({ ...s, _key: `st${i}` })),
    ...(surface ? { surface } : {}),
  };
}

function pricingSec(key: string, heading: string, subheading: string, tiers: Record<string, unknown>[], footnote?: string) {
  return { _type: "pricingSection", _key: key, variant: "pricing_tiers", heading, subheading, tiers, ...(footnote ? { footnote } : {}) };
}

function testimonialSec(key: string, heading: string, testimonials: { quote: string; author: string; role: string; company: string }[], surface?: string) {
  return {
    _type: "testimonialSection", _key: key, variant: "testimonial_grid", heading,
    testimonials: testimonials.map((t, i) => ({ ...t, _key: `tm${i}` })),
    ...(surface ? { surface } : {}),
  };
}

function ctaSec(key: string, title: string, description: string, ctaLabel: string, ctaHref: string) {
  return { _type: "ctaSection", _key: key, variant: "cta_banner", title, description, cta: { label: ctaLabel, href: ctaHref } };
}

function statsSec(key: string, heading: string, items: { label: string; value: string; suffix?: string; description?: string }[], surface?: string) {
  return {
    _type: "stats", _key: key, variant: "default", heading,
    items: items.map((s, i) => ({ ...s, _key: `st${i}`, prefix: "" })),
    ...(surface ? { surface } : {}),
  };
}

function quickLinks(key: string, heading: string, description: string, links: { label: string; href: string; description?: string; icon?: string }[], surface?: string) {
  return {
    _type: "quickLinks", _key: key, variant: "quicklinks_grid", heading, description,
    links: links.map((l, i) => ({ ...l, _key: `ql${i}`, icon: "" })),
    ...(surface ? { surface } : {}),
  };
}

// Media helpers - image uses legacy `mediaUrl` field which GROQ resolves via
// coalesce(image.asset->url, mediaUrl); video uses the native videoUrl field.
type TextMediaImage = { type: "image"; url: string; alt?: string; caption?: string };
type TextMediaVideo = { type: "video"; url: string; caption?: string };
type TextMediaAsset = TextMediaImage | TextMediaVideo;

function textMedia(
  key: string,
  variant: "text_media_right" | "text_media_left" | "text_media_stacked",
  eyebrow: string,
  heading: string,
  body: string,
  ctas: { label: string; href: string }[],
  media?: TextMediaAsset,
  surface?: string,
) {
  const mediaFields: Record<string, unknown> = {
    mediaType: media?.type ?? "image",
  };
  if (!media || media.type === "image") {
    if (media?.url)     mediaFields.mediaUrl = media.url;   // legacy - GROQ coalesces this
    if (media?.alt)     mediaFields.mediaAlt = media.alt;
    if (media?.caption) mediaFields.caption  = media.caption;
  } else {
    mediaFields.videoUrl = media.url;
    if (media.caption) mediaFields.caption = media.caption;
  }
  return {
    _type: "textMedia", _key: key, variant, eyebrow, heading, body,
    ...mediaFields,
    ctas: ctas.map((c, i) => ({ ...c, _key: `c${i}` })),
    ...(surface ? { surface } : {}),
  };
}

// Logo strip - logos use legacy `src` URL field for external image URLs.
// GROQ resolves via coalesce(image.asset->url, src).
function teamSec(key: string, heading: string, intro: string, members: { name: string; role: string; bio?: string; imageUrl?: string; linkedinUrl?: string; email?: string }[]) {
  return {
    _type: "teamSection", _key: key, variant: "team_grid", heading, intro,
    members: members.map((m, i) => ({ ...m, _key: `mb${i}` })),
  };
}

function formSec(key: string, title: string, intro: string, formKey: string, submitLabel?: string) {
  return { _type: "formSection", _key: key, variant: "form_default", title, intro, formKey, submitLabel: submitLabel ?? "Send message", successMessage: "Thank you - we will be in touch within one business day." };
}

function vacancyMeta(key: string, title: string, department: string, location: string, contractType: string, salaryRange?: string, hoursPerWeek?: string, level?: string) {
  return { _type: "vacancyMeta", _key: key, variant: "default", title, department, location, remote: "hybrid", contractType, ...(salaryRange ? { salaryRange } : {}), ...(hoursPerWeek ? { hoursPerWeek } : {}), ...(level ? { level } : {}), startDate: "As soon as possible", closingDate: "2026-12-31" };
}

function applyPanel(key: string, heading: string, body: string, primaryCtaLabel: string, primaryCtaHref: string) {
  return { _type: "applyPanel", _key: key, variant: "default", heading, body, closingDate: "Rolling", primaryCta: { label: primaryCtaLabel, href: primaryCtaHref }, secondaryCta: { label: "View other roles", href: "/jobs" }, formKey: "application" };
}

function articleMeta(key: string, title: string, publishedAt: string, author: { name: string; role?: string; avatarUrl?: string }, category: string, readingTime: number, summary: string, coverImageUrl?: string, tags?: string[]) {
  return { _type: "articleMeta", _key: key, variant: "default", title, publishedAt, category, readingTime, summary, ...(coverImageUrl ? { coverImageUrl } : {}), ...(tags ? { tags } : []), author: { name: author.name, role: author.role ?? "", avatarUrl: author.avatarUrl ?? "" } };
}

function articleBody(key: string, body: PTBlock[]) {
  return { _type: "articleBody", _key: key, variant: "default", body };
}

function relatedContent(key: string, heading: string, items: { title: string; href: string; image?: string; description?: string }[]) {
  return { _type: "relatedContent", _key: key, variant: "default", heading, items: items.map((it, i) => ({ _key: `rc${i}`, id: `${key}-rc${i}`, title: it.title, href: it.href, ...(it.image ? { imageUrl: it.image } : {}), ...(it.description ? { excerpt: it.description } : {}) })) };
}

function recruiterPanel(key: string, heading: string, name: string, role: string, bio: string, avatarUrl: string, email: string, phone?: string) {
  return { _type: "recruiterPanel", _key: key, variant: "default", heading, name, role, bio, avatarUrl, email, ...(phone ? { phone } : {}), ctaLabel: "Send your application", ctaHref: "mailto:" + email };
}

function mapBlock(key: string, heading: string, address: string, city: string, country: string, email: string, phone: string, embedUrl?: string) {
  return { _type: "mapBlock", _key: key, variant: "default", heading, address, city, country, email, phone, ...(embedUrl ? { embedUrl } : {}) };
}

function logoStrip(
  key: string,
  heading: string,
  logos: { name: string; src?: string; url?: string }[],
  opts?: { variant?: "default" | "muted" | "logo_grid" | "logo_wall_light"; grayscale?: boolean; showLabels?: boolean },
) {
  const { variant = "muted", grayscale = true, showLabels = false } = opts ?? {};
  return {
    _type: "logoStrip", _key: key, variant, heading,
    animationEnabled: variant !== "logo_grid",
    speed: "slow",
    grayscale,
    showLabels,
    logos: logos.map((l, i) => ({
      _key: `lg${i}`,
      name:  l.name,
      ...(l.src ? { src: l.src } : {}),
      ...(l.url ? { url: l.url } : {}),
    })),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

export const marketingPages = [

  // ── HOME ────────────────────────────────────────────────────────────────────

  page("home", "home", "Home", "marketing-page",
    "Mister Chameleon - Personalise your website for every visitor",
    "Serve the right message to the right person automatically. No engineering sprints, no data science team, no six-figure contract.",
    [
      textSec("intro", "text_lead", "Your website speaks to everyone - and converts no one.",
        pt(
          "The average website shows the same hero, the same copy, and the same CTA to every visitor - regardless of where they came from, who they work for, or how close they are to buying.",
          "Mister Chameleon changes that. In minutes, your site adapts to each visitor: different headline for the Google searcher, a warmer welcome for the returning prospect, an enterprise-grade message for the Fortune 500 visitor.",
          "No developer required. No privacy trade-offs. Just more conversations that turn into customers.",
        ),
      ),
      featureGrid("features", "Everything you need. Nothing you don't.", "feature_grid_3up", [
        { title: "Intent scoring", description: "We watch how visitors navigate - which pages they read, how long they stay, what they click - and build a real-time intent score that tells you exactly where each person sits in your funnel.", icon: "chart" },
        { title: "Company enrichment", description: "When a visitor arrives from a recognised IP, we silently look up their company name, industry, and size. Your headline can mention their sector before they've typed a word.", icon: "building" },
        { title: "Adaptive content engine", description: "Our decision engine picks the best variant for each visitor using your rules, enrichment data, and behavioural signals. The whole thing runs at the edge - zero milliseconds of extra load time.", icon: "bolt" },
      ], { label: "See all features", href: "/features" }),
      textMedia("product-video", "text_media_stacked",
        "See it in action",
        "Your website, personalising itself - live.",
        "Watch Mister Chameleon switch visitor profiles in real time. Every section - the hero, the proof block, the CTA - adapts automatically based on who's visiting and where they are in the funnel.",
        [{ label: "Try the interactive demo", href: "/demo" }, { label: "Start free trial", href: "/order/starter" }],
        { type: "video", url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "Live demo - switch visitor profiles and watch the page adapt" },
      ),
      statsSec("stats", "Trusted by growth teams across Europe", [
        { label: "Personalised sessions delivered", value: "12M", suffix: "+" },
        { label: "Average lift in lead conversion", value: "34", suffix: "%" },
        { label: "Minutes to first live variant", value: "< 15" },
        { label: "GDPR-compliant by design", value: "100", suffix: "%" },
      ]),
      logoStrip("logos", "Trusted by companies that take growth seriously", [
        { name: "HubSpot",         src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg",         url: "https://hubspot.com" },
        { name: "Salesforce",      src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg",      url: "https://salesforce.com" },
        { name: "Pipedrive",       src: "https://cdn.worldvectorlogo.com/logos/pipedrive.svg",       url: "https://pipedrive.com" },
        { name: "Intercom",        src: "https://cdn.worldvectorlogo.com/logos/intercom-1.svg",        url: "https://intercom.com" },
        { name: "Typeform",        src: "https://cdn.worldvectorlogo.com/logos/typeform.svg",        url: "https://typeform.com" },
        { name: "ActiveCampaign",  src: "https://cdn.worldvectorlogo.com/logos/activecampaign.svg", url: "https://activecampaign.com" },
        { name: "Shopify",         src: "https://cdn.worldvectorlogo.com/logos/shopify.svg",         url: "https://shopify.com" },
        { name: "Segment",         src: "https://cdn.worldvectorlogo.com/logos/segment-1.svg",         url: "https://segment.com" },
      ]),
      testimonialSec("proof", "What our customers say", [
        { quote: "We added Mister Chameleon on a Friday afternoon and by Monday our trial sign-up rate had already moved. It was the fastest win we'd had in months.", author: "Lotte van den Berg", role: "Head of Growth", company: "Stackr" },
        { quote: "The enterprise segment feature alone paid for the first year. Visitors from target accounts now see our enterprise case studies front and centre - our SDRs love the context.", author: "Pieter Claes", role: "Marketing Director", company: "Axius Systems" },
        { quote: "We were sceptical about personalisation without third-party cookies. Mister Chameleon proved you don't need them. Their first-party approach outperformed our old tag-based setup.", author: "Sara Mehta", role: "VP Digital", company: "Lumio Group" },
      ]),
      textMedia("how-it-works-teaser", "text_media_right",
        "Under 50 milliseconds",
        "Personalisation that happens before your page loads.",
        "The decision engine runs in Next.js Edge Middleware - not in the browser. By the time your visitor sees your homepage, the right variant is already selected. No flicker. No layout shift. No performance penalty.",
        [{ label: "See how the engine works", href: "/the-engine" }, { label: "How it works", href: "/how-it-works" }],
        { type: "image", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Circuit board representing edge computing technology", caption: "Edge-native: zero latency personalisation" },
      ),
      processSec("how-quick", "Live in 15 minutes", [
        { title: "Add the snippet", description: "One script tag in your site's <head>. Asynchronous - no performance impact. Works with any website or framework.", duration: "2 min" },
        { title: "Create a content variant", description: "Open Sanity Studio. Write an alternative headline for high-intent visitors. Save.", duration: "5 min" },
        { title: "Write a rule", description: "Set the condition: 'If intent score > 60, show the high-intent hero'. Activate.", duration: "3 min" },
        { title: "Watch it work", description: "Your next high-intent visitor gets the right message automatically. Check analytics to see the lift.", duration: "Live" },
      ]),
      testimonialSec("proof-2", "What our customers say", [
        { quote: "We added Mister Chameleon on a Friday afternoon and by Monday our trial sign-up rate had already moved. It was the fastest win we'd had in months.", author: "Lotte van den Berg", role: "Head of Growth", company: "Stackr" },
        { quote: "The enterprise segment feature alone paid for the first year. Visitors from target accounts now see our enterprise case studies front and centre - our SDRs love the context.", author: "Pieter Claes", role: "Marketing Director", company: "Axius Systems" },
        { quote: "We were sceptical about personalisation without third-party cookies. Mister Chameleon proved you don't need them. Their first-party approach outperformed our old tag-based setup.", author: "Sara Mehta", role: "VP Digital", company: "Lumio Group" },
      ]),
      featureGrid("use-cases", "Built for your industry", "feature_grid_3up", [
        { title: "B2B SaaS", description: "Show enterprise content to enterprise visitors, trial CTAs to high-intent researchers, and onboarding prompts to existing customers.", icon: "monitor", },
        { title: "Recruitment & HR", description: "Personalise separately for employers and candidates. Increase qualified applications and reduce employer churn in the first 90 days.", icon: "users" },
        { title: "Digital agencies", description: "Run personalisation for all your clients from a single white-label dashboard under your own brand. One Pro plan, unlimited client sites.", icon: "layout" },
      ], { label: "See all use cases", href: "/use-cases-saas" }),
      pricingSec("pricing-teaser", "Simple, honest pricing", "Start free. Scale as you grow.", [
        { _key: "t0", name: "Starter", price: "€149", period: "/month", description: "For growing teams getting started with personalisation.", highlighted: false, features: [ { _key: "f0", label: "25,000 personalised sessions/month" }, { _key: "f1", label: "Rule-based personalisation" }, { _key: "f2", label: "3 content variants per page" }, { _key: "f3", label: "14-day free trial" } ], ctaLabel: "Start free trial", ctaHref: "/order/starter" },
        { _key: "t1", name: "Growth", price: "€349", period: "/month", description: "For teams serious about conversion. CRM integration, AI decisions, full analytics.", highlighted: true, badge: "Most popular", features: [ { _key: "f0", label: "150,000 personalised sessions/month" }, { _key: "f1", label: "AI-assisted variant decisions" }, { _key: "f2", label: "CRM & ABM integration" }, { _key: "f3", label: "Full analytics dashboard" }, { _key: "f4", label: "Unlimited variants" } ], ctaLabel: "Start free trial", ctaHref: "/order/growth" },
        { _key: "t2", name: "Pro / Agency", price: "€749", period: "/month", description: "For agencies and teams running personalisation across multiple sites.", highlighted: false, badge: "Agency ready", features: [ { _key: "f0", label: "500,000 sessions/month" }, { _key: "f1", label: "Unlimited client sites" }, { _key: "f2", label: "Full white-label interface" }, { _key: "f3", label: "Custom domain per client" }, { _key: "f4", label: "Priority support" } ], ctaLabel: "Get started on Pro", ctaHref: "/order/pro" },
      ], "14-day free trial on every plan. No credit card required. Annual billing saves 20%."),
      // No ctaSection here — the adaptive CTA context slot (after-content position)
      // already renders a personalised call-to-action at the bottom of the page.
      // A static ctaSection would duplicate it immediately above the footer.
    ],
    { hero: { fallbackVariantKey: "hero_direct_brand" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["personalisation", "adaptive", "website", "conversion", "platform", "features"],
  ),

  // ── HOW IT WORKS ────────────────────────────────────────────────────────────

  page("how-it-works", "how-it-works", "How It Works", "marketing-page",
    "How Mister Chameleon works - adaptive personalisation explained",
    "See exactly how Mister Chameleon detects visitor signals, scores intent, enriches with company data, and serves the perfect variant - in under 50ms.",
    [
      // 1. Hero — speed and simplicity as the opening hook
      textMedia("hero", "text_media_right",
        "Under 50 ms from page load to personalised content.",
        "One snippet. The full personalisation pipeline.",
        "Add a single JavaScript snippet to your site. From that moment, every visitor gets an experience built from their signals - traffic source, intent score, company data, and behavioural history - all resolved before the page finishes rendering. No engineering sprints. No CMS migrations. No waiting.",
        [{ label: "Open the live demo", href: "/demo" }, { label: "Start free trial", href: "/order/starter" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Circuit board close-up representing the speed of the decision pipeline" },
      ),

      // 2. Stats — anchor the performance claims immediately
      statsSec("perf-stats", "The pipeline by the numbers", [
        { label: "Total pipeline latency", value: "<50", suffix: "ms", description: "Signal collection, enrichment, scoring, and variant selection - all before the page renders." },
        { label: "Signals evaluated per visit", value: "130", suffix: "+", description: "Behavioural, enrichment, contextual, CRM, and time-based signals combined into one decision." },
        { label: "Variant decision time", value: "<10", suffix: "ms", description: "The decision engine picks the best-matching content variant in under 10 milliseconds." },
        { label: "First-party data only", value: "100", suffix: "%", description: "No third-party cookies. No data brokers. All visitor data stays in your own database." },
      ]),

      // 3. Pipeline walkthrough — the core of the page
      processSec("pipeline", "What happens on every page load", [
        {
          title: "Visitor arrives - signals are read instantly",
          description: "The moment someone lands on your site, the edge function reads the full request context: UTM parameters, referrer, traffic source, device type, and any existing session identifier. This runs before a single byte of HTML is sent - zero blocking latency.",
          duration: "0 ms",
        },
        {
          title: "Session is recognised and history is loaded",
          description: "Returning visitors are matched to their existing behavioural profile stored first-party in your database. Pages visited, scroll depth, time on pricing, CTA clicks, form interactions, and prior variant exposures are all available for the decision engine. New visitors start a fresh profile.",
          duration: "< 5 ms",
        },
        {
          title: "Company is silently enriched from IP",
          description: "If the visitor comes from a recognisable IP range, the enrichment service looks up their company name, industry, headcount estimate, and organisation type. This runs asynchronously alongside session loading - it never blocks the page render. No cookie is set. No data is shared with the visitor.",
          duration: "< 20 ms",
        },
        {
          title: "Intent is scored and funnel stage is predicted",
          description: "The scoring engine combines all available signals - traffic source weight, behavioural depth, enrichment tier, CRM stage if available, and time context - into a single 0-100 intent score. A funnel stage label is assigned: awareness, consideration, intent, high intent, or customer. This stage drives rule matching.",
          duration: "< 5 ms",
        },
        {
          title: "Rules are evaluated in priority order",
          description: "The decision engine walks through your personalisation rules - each defined by conditions (intent score, company type, UTM source, funnel stage, behavioural patterns) and a content plan (which hero, proof section, and CTA to show). The first rule whose conditions match this visitor wins.",
          duration: "< 5 ms",
        },
        {
          title: "The best variant is served on the first render",
          description: "The winning content plan is applied. Your CMS serves the matched hero variant, proof block, and CTA - exactly right for this visitor, right now. No flicker. No layout shift. No second request. The personalised page renders on the first load.",
          duration: "< 10 ms",
        },
      ]),

      // 4. Demo video — show, don't just tell
      textMedia("demo-video", "text_media_stacked",
        "Watch it happen",
        "See the full pipeline in under two minutes.",
        "This walkthrough shows the decision engine in action: a visitor arrives from LinkedIn, the enrichment service identifies their company, the intent score is calculated, and a vision-led hero with a thought-leadership CTA is served - all before the page finishes loading.",
        [{ label: "Open the interactive demo", href: "/demo" }, { label: "Explore the engine", href: "/the-engine" }],
        { type: "video", url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "The full personalisation pipeline - from signal collection to variant selection" },
      ),

      // 5. Signals deep-dive — what feeds the engine
      textMedia("signals-intro", "text_media_left",
        "What the engine sees",
        "130+ signals. One unified visitor context.",
        "Most personalisation tools act on one or two signals - usually UTM source or device type. Mister Chameleon combines every meaningful signal into a single visitor context object that the decision engine uses holistically. The result is a richer, more accurate content decision than any single-signal approach can produce.",
        [{ label: "Explore intent scoring", href: "/features-intent" }, { label: "Explore enrichment", href: "/features-enrichment" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=900&auto=format&fit=crop&q=80", alt: "Data visualisation showing multiple signal streams converging into a single score" },
      ),

      featureGrid("signals", "Signals the engine evaluates", "feature_grid_3up", [
        { title: "Traffic source", description: "UTM parameters, referrer domain, and source classification (Google, LinkedIn, direct, email, dark social). Each source pattern implies a different visitor intent and gets a different first impression.", icon: "globe" },
        { title: "Behavioural history", description: "Pages visited in this session and historically, scroll depth, time on page, CTA clicks, form starts, form completions, and navigation sequences. Stored first-party in your database.", icon: "activity" },
        { title: "IP company enrichment", description: "Company name, industry, estimated headcount, and organisation type - looked up silently from the visitor's IP address. No cookies. No consent banner required. GDPR compliant.", icon: "briefcase" },
        { title: "Intent and engagement scores", description: "Two composite 0-100 scores: intent (how likely to convert) and engagement (how invested in your content). Both are recalculated on every page load from the full signal set.", icon: "trending-up" },
        { title: "Funnel stage", description: "A predicted lifecycle label - awareness, consideration, intent, high intent, or customer - derived from intent score, behavioural depth, and CRM data. Rules can target any stage directly.", icon: "filter" },
        { title: "Time and weather context", description: "Day of week, time of day, season, and local weather conditions. Useful for campaigns, event-driven content, and locale-specific personalisation.", icon: "clock" },
        { title: "CRM and ABM data", description: "On Growth and Pro plans, known contacts and target accounts get content matched to their CRM lifecycle stage and account tier. Synced via webhook or direct integration.", icon: "users" },
        { title: "Device and locale", description: "Device type, operating system, browser, preferred language, and geographic region. Enables device-specific layouts and locale-matched content without separate page versions.", icon: "monitor" },
        { title: "Visitor journey patterns", description: "Named behavioural sequences - homepage to product, pricing revisit, high-engagement returning visitor - matched against the visitor's full navigation history to identify advanced buying patterns.", icon: "map" },
      ]),

      // 6. Content variants — how the CMS side works
      textMedia("cms-side", "text_media_right",
        "The content side",
        "Variants live in your CMS. Marketing owns them.",
        "Every content decision the engine makes maps to a variant defined in Sanity. Your marketing team creates hero variants for different audiences, writes proof sections for different funnel stages, and sets CTA copy for different intent levels. No developer involvement after initial setup. Activate a new variant, and the engine starts using it immediately.",
        [{ label: "See all features", href: "/features" }, { label: "Open the live demo", href: "/demo" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1587620962725-abab19836a68?w=900&auto=format&fit=crop&q=80", alt: "Marketing team member editing a content variant in the Sanity CMS dashboard", caption: "Marketing creates variants in Sanity. The engine decides who sees which one." },
      ),

      // 7. Rules editor — how personalisation logic is defined
      textMedia("rules-side", "text_media_left",
        "The rules side",
        "Visual rule builder. No SQL. No code.",
        "Personalisation rules are defined in a visual editor - not in code. Each rule has a set of conditions (if intent score is above 60 and the visitor has visited pricing) and a content plan (show the high-intent hero, the case study proof block, and the book-a-meeting CTA). Rules are evaluated in priority order on every request.",
        [{ label: "Explore the engine", href: "/the-engine" }, { label: "See audience segments", href: "/features-segments" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900&auto=format&fit=crop&q=80", alt: "Visual rule editor showing conditions and variant mapping for a personalisation rule", caption: "Rules are conditions plus content plans - no code required." },
      ),

      // 8. Social proof — customers validating the explanation
      testimonialSec("proof", "What teams say after going live", [
        {
          quote: "The pipeline explanation sold it for us. Under 50ms, first-party only, no cookies - that checked every box our legal team had. We were live within an hour of signing up.",
          author: "Thomas Becker",
          role: "CTO",
          company: "Growlytics",
        },
        {
          quote: "I was expecting a week of engineering work. It was a script tag and an afternoon in the CMS. The rules editor is genuinely intuitive - I set up our first three personalisation rules myself.",
          author: "Sanne de Vries",
          role: "Head of Growth",
          company: "Frontline Agency",
        },
        {
          quote: "What surprised me most was the intent scoring. Seeing a real-time score update as I browsed the demo - and then watching the hero change when I crossed 60 - made the whole thing click instantly.",
          author: "Priya Nair",
          role: "Marketing Manager",
          company: "JobBridge",
        },
      ]),

      // 9. Setup steps — make it feel achievable
      processSec("setup", "How to go live", [
        {
          title: "Add the script tag",
          description: "Copy one JavaScript snippet from your dashboard and add it to your site's <head>. Works with any tech stack - Next.js, Webflow, WordPress, Shopify, custom HTML. No SDK to install, no build step to change.",
          duration: "2 minutes",
        },
        {
          title: "Create your first content variants",
          description: "Open Sanity and duplicate your existing hero section. Write an alternative headline and CTA for a specific audience - LinkedIn visitors, high-intent returning users, or enterprise prospects. Publish.",
          duration: "10 minutes",
        },
        {
          title: "Define a personalisation rule",
          description: "In the rule editor, set the condition (utmSource equals linkedin), map it to your new hero variant and a matching CTA, and set a priority. Publish the rule. The engine starts using it on the next page load.",
          duration: "3 minutes",
        },
        {
          title: "Watch and iterate",
          description: "Open the analytics dashboard. See how your variant performs versus the default. Use the A/B testing module to run a controlled experiment. When the result is statistically significant, promote the winner and start the next test.",
          duration: "Ongoing",
        },
      ]),

      // 10. FAQ
      faqSec("faq", "Common questions", [
        {
          question: "Does the snippet slow down my site?",
          answer: "No. The edge function runs before the page is served, not after it loads. It adds zero blocking load time. The total pipeline - signal reading, enrichment, scoring, and variant selection - completes in under 50ms and runs in parallel with your page render.",
        },
        {
          question: "What happens if no personalisation rule matches?",
          answer: "A default content plan is served - the same hero, proof section, and CTA your site currently shows. Personalisation is additive: visitors who don't match any rule see your existing content unchanged.",
        },
        {
          question: "How is visitor data stored?",
          answer: "All behavioural data is stored first-party in your own database - not on our servers. Enrichment data (company name, industry) is resolved at request time and cached briefly for performance. No third-party cookies are set. All data handling is GDPR compliant by design.",
        },
        {
          question: "Can I preview what a visitor from a specific segment will see?",
          answer: "Yes. The Scenario Control panel (available on your demo page) lets you simulate any visitor profile - UTM source, intent score, funnel stage, company type - and watch the page adapt in real time. No real visitor data is used.",
        },
        {
          question: "Does it work on my existing CMS?",
          answer: "Mister Chameleon uses Sanity as its content layer for variant storage. Your existing website CMS is untouched - you don't need to migrate content. The variant layer sits alongside your existing setup and only activates when a personalisation rule matches.",
        },
      ]),

      // 11. Final CTA — demo is the natural next step
      ctaSec("cta", "See it live in your own browser", "Our interactive demo lets you simulate any visitor profile and watch the page adapt in real time. No sign-up required.", "Open live demo", "/demo"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_platform" } },
    ["features", "platform", "integrations", "technical", "setup", "how it works"],
  ),

  // ── WHY PERSONALISATION ──────────────────────────────────────────────────────

  page("why-personalisation", "why-personalisation", "Why Personalisation?", "marketing-page",
    "Why website personalisation matters - the business case",
    "Generic websites waste 97% of their traffic. Here's the data on what personalisation actually does for conversion rates, pipeline, and revenue.",
    [
      textMedia("header-banner", "text_media_right",
        "97% of visitors leave. Here's why that's fixable.",
        "Generic websites are conversion killers.",
        "The data is unambiguous: most websites show the same content to everyone and convert under 3% of their traffic. The fix isn't more traffic or a bigger ad budget - it's showing the right message to the right visitor at the right moment.",
        [{ label: "See the business case", href: "#data" }, { label: "Start free trial", href: "/order/starter" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Analytics dashboard showing conversion rate improvement over time" },
      ),
      textSec("intro", "text_lead", "Your homepage was built for nobody.",
        pt(
          "Most websites are designed around a mythical average visitor. The problem is that no visitor is average. A first-time visitor from Google searching 'website personalisation software' is completely different from a returning CFO who's visited your pricing page three times this week.",
          "Showing them both the same headline, the same social proof, and the same CTA is the digital equivalent of a sales rep giving the same pitch to a cold lead and a board-level champion in the same breath.",
        ),
      ),
      statsSec("cost", "The cost of generic", [
        { label: "of website visitors leave without converting", value: "97", suffix: "%" },
        { label: "lift in conversion from relevant content", value: "202", suffix: "%", description: "Hubspot, 2024" },
        { label: "of B2B buyers expect personalised interactions", value: "76", suffix: "%", description: "McKinsey" },
        { label: "revenue lost to poor personalisation annually", value: "€756B", description: "Segment" },
      ]),
      textMedia("chameleon-hero", "text_media_left", "Nature got there first", "The chameleon doesn't change who it is. It adapts how it shows up.",
        "A chameleon doesn't become a different animal when its environment changes - it shows the right version of itself for the moment it's in. Your website should work the same way. Not a different site for each visitor. The right face of your product for each person's situation.",
        [{ label: "See how our engine works", href: "/how-it-works" }],
        { type: "image", url: "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=900&auto=format&fit=crop&q=80", alt: "Close-up of a vibrant chameleon showing its natural colour-changing ability", caption: "Adaptive by nature - your website, personalised for every visitor" },
      ),
      textMedia("argument", "text_media_right", "The better approach", "Match the message to the moment",
        "Personalisation doesn't mean showing every visitor a custom page built by hand. It means understanding what each visitor needs right now - and making sure your content speaks to that. A high-intent enterprise prospect needs case studies and security info. A first-time visitor needs to understand what you do in one sentence. A returning trial user needs a reason to upgrade.",
        [{ label: "See how our engine works", href: "/how-it-works" }],
        { type: "image", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80", alt: "Marketing analytics dashboard on a laptop screen", caption: "The right message, served to the right visitor - automatically" },
      ),
      featureGrid("benefits", "What personalisation actually does", "feature_grid_3up", [
        { title: "More pipeline from the same traffic", description: "When content matches intent, more visitors take the next step - without any extra ad spend. Our customers typically see a 25–40% lift in lead conversion within 60 days.", icon: "trending-up" },
        { title: "Shorter sales cycles", description: "Prospects who see relevant content from the first visit arrive at their first sales call already educated. Sales reps report shorter cycles and higher-quality conversations.", icon: "zap" },
        { title: "Better experience for everyone", description: "Personalisation feels like good service, not surveillance. When a visitor sees content that actually matches their situation, they stay longer, read more, and trust you faster.", icon: "heart" },
      ]),
      faqSec("faq", "Common questions", [
        { question: "Does personalisation require cookies or tracking?", answer: "No. Mister Chameleon uses first-party session data stored in your own database, IP-based company enrichment, and traffic source signals - none of which require third-party cookies or invasive tracking. We are GDPR-compliant by design." },
        { question: "Is this only for large companies?", answer: "Not at all. Our Starter plan is designed for growing teams who want to start personalising their highest-traffic pages without an engineering project. You can be live in an afternoon." },
        { question: "How is this different from A/B testing?", answer: "A/B testing shows different variants to different people randomly and measures which wins over time. Personalisation shows the right variant to the right person immediately, based on what you already know about them. Both have their place - but for most companies, personalisation delivers faster and more sustained results." },
      ]),
      ctaSec("cta", "See personalisation in action", "Our live demo simulates exactly what each visitor type sees on your site.", "Explore the demo", "/demo"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_cases" } },
    ["personalisation", "conversion", "use-case", "solution", "industry"],
  ),

  // ── THE ENGINE ───────────────────────────────────────────────────────────────

  page("the-engine", "the-engine", "The Engine", "marketing-page",
    "The Mister Chameleon decision engine - how it works",
    "A deep-dive into the adaptive decision engine: intent scoring, enrichment pipeline, variant resolution, and edge-first architecture.",
    [
      // 1. Hero — precision and speed as the opening statement
      textMedia("hero", "text_media_right",
        "130+ signals. One decision. Under 50 ms.",
        "The adaptive decision engine - a technical deep dive.",
        "Intent scoring, company enrichment, behavioural history, CRM context, and time-aware logic - combined in a single edge function that runs before your page finishes loading. This page explains exactly how it works, layer by layer.",
        [{ label: "Open the live demo", href: "/demo" }, { label: "How it works overview", href: "/how-it-works" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&auto=format&fit=crop&q=80", alt: "Server rack infrastructure representing a fast, distributed decision engine" },
      ),

      // 2. Performance stats — anchor the technical claims immediately
      statsSec("perf", "Engine performance", [
        { label: "Total pipeline latency", value: "<50", suffix: "ms", description: "Signal collection, enrichment, scoring, and variant selection - completed before the first byte of HTML is sent." },
        { label: "Signals evaluated per visit", value: "130", suffix: "+", description: "Request context, behavioural history, enrichment data, CRM stage, time signals, and journey patterns." },
        { label: "Variant decision time", value: "<10", suffix: "ms", description: "Rules are evaluated in priority order and a decision is reached in under 10 milliseconds." },
        { label: "Third-party cookies used", value: "0", description: "The engine operates entirely on first-party signals. No cross-site tracking. No consent banner required for the engine itself." },
      ]),

      // 3. The V8 metaphor — makes the concept visceral
      textMedia("v8", "text_media_left",
        "The V8 under your website.",
        "Fires on every request. No warm-up. No lag.",
        "A high-performance engine delivers precise power on demand - without the driver thinking about it. The Mister Chameleon decision engine works the same way. Every time a visitor loads a page, the engine fires: reads the full request context, loads the visitor's behavioural history, enriches from IP, scores intent, evaluates your rules, and selects the best-matching variant. All of this happens in under 50 milliseconds. The visitor never waits. The page never flickers.",
        [{ label: "See the demo", href: "/demo" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&auto=format&fit=crop&q=80", alt: "High-performance V8 engine block representing precision and raw processing speed", caption: "130+ signals evaluated before your page loads - zero visible latency." },
      ),

      // 4. Signal layers — the four inputs to the engine
      featureGrid("layers", "Four layers of intelligence", "feature_grid_4up", [
        {
          title: "Request layer",
          description: "Captured on every request, before any session data is loaded: UTM source and campaign, referrer domain, traffic source classification (Google, LinkedIn, direct, email, dark social), device type, operating system, preferred language, and geographic region.",
          icon: "wifi",
        },
        {
          title: "Behavioural layer",
          description: "First-party session history retrieved from your Supabase database: pages visited in this session and historically, scroll depth, time on page, CTA clicks, form starts, form completions, and recognised navigation sequences. Stored in your database, in your region.",
          icon: "layers",
        },
        {
          title: "Enrichment layer",
          description: "Server-side IP-to-company lookup: company name, industry, estimated headcount, and organisation type. Runs asynchronously - never blocks the page render. On Growth and Pro plans: CRM lifecycle stage, ABM target account matching, and weather context.",
          icon: "database",
        },
        {
          title: "Intent layer",
          description: "Composite scoring that combines all available signals into two 0-100 scores (intent and engagement) plus a predicted funnel stage (awareness, consideration, intent, high intent, or customer). Recalculated on every page load from the current full signal set.",
          icon: "trending-up",
        },
      ]),

      // 5. Decision pipeline — step-by-step with timing
      processSec("pipeline", "The decision pipeline, step by step", [
        {
          title: "Request context is read",
          description: "The edge middleware intercepts the request before any HTML is generated. UTM parameters, referrer, device type, and the session identifier are extracted from the request headers and cookies. This adds zero latency - it happens before any I/O.",
          duration: "0 ms",
        },
        {
          title: "Session history is loaded",
          description: "The session identifier is used to fetch the visitor's behavioural profile from your Supabase database. This includes all historical page visits, engagement events, prior variant exposures, intent scores from previous sessions, and journey sequence matches. New visitors get an empty profile.",
          duration: "< 5 ms",
        },
        {
          title: "Company enrichment runs",
          description: "The enrichment service performs a server-side IP lookup to resolve company name, industry, estimated size, and organisation type. This runs in parallel with session loading and is non-blocking - if enrichment takes longer than the budget allows, the decision proceeds without it and enrichment is attached to the next request.",
          duration: "< 20 ms",
        },
        {
          title: "Intent and engagement are scored",
          description: "The scoring engine combines the request layer, behavioural profile, and enrichment data using a weighted signal model. Traffic source weight, behavioural depth, enrichment tier, CRM stage, and recency are all factored in. The output is an intent score (0-100), an engagement score (0-100), and a predicted funnel stage.",
          duration: "< 5 ms",
        },
        {
          title: "Rules are evaluated in priority order",
          description: "Your personalisation rules are tested against the visitor's full context, in descending priority order. Each rule has a condition set (any combination of signal fields, scores, stages, and enrichment values) and a content plan (heroKey, proofKey, ctaKey). The first rule whose conditions all match is the winner.",
          duration: "< 5 ms",
        },
        {
          title: "Variant is selected and rendered",
          description: "The winning rule's content plan is applied. The CMS serves the matched hero variant, proof block, and CTA. The page renders server-side with the correct content on the first load - no client-side injection, no layout shift, no flicker. The decision is logged and the session profile is updated for the visitor's next visit.",
          duration: "< 10 ms",
        },
      ]),

      // 6. Edge architecture — where the engine lives
      textMedia("edge-architecture", "text_media_right",
        "Edge-native architecture",
        "Runs before a byte of HTML is sent.",
        "The entire decision pipeline runs inside Next.js Edge Middleware - a serverless function that executes at the CDN edge, geographically close to the visitor. This is not a client-side script injecting content after load. It is server-side middleware that intercepts the request, makes a decision, and serves the already-personalised page in a single response. The visitor receives personalised content with the same time-to-first-byte as a static page.",
        [{ label: "Read our security and privacy page", href: "/security" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Circuit board close-up representing edge computing infrastructure", caption: "Edge middleware: the decision happens before the response, not after the load." },
      ),

      // 7. Scoring model — how intent is calculated
      textMedia("scoring-model", "text_media_left",
        "The scoring model",
        "Intent is a composite - not a page-view count.",
        "Most intent scoring systems count page visits and call it done. The Mister Chameleon scoring model is more nuanced. Traffic source contributes a base weight - a visitor from a Google search for 'best personalisation software' starts higher than a visitor from a brand awareness LinkedIn post. Behavioural depth (total sessions, pages per session, scroll depth, time on site) compounds the score over time. CTA engagement - clicking a pricing link, opening a demo modal, or starting a form - signals proximity to decision and adds a significant weight. Form behaviour is particularly valuable: a visitor who started a form but did not submit it has revealed clear intent even without converting. Company enrichment adds a tier modifier: enterprise companies score higher by default, and named ABM target accounts score higher still.",
        [{ label: "Explore intent scoring", href: "/features-intent" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=900&auto=format&fit=crop&q=80", alt: "Data visualisation showing multiple weighted signals converging into a single intent score", caption: "Six signal categories. One 0-100 score. Updated on every page load." },
      ),

      // 8. Rules system — how marketing defines personalisation logic
      textMedia("rules-system", "text_media_right",
        "The rules system",
        "Conditions plus content plans - no code required.",
        "Personalisation rules are defined in a visual editor. Each rule has a priority number, a set of conditions, and a content plan. Conditions can target any field in the visitor context: intent score ranges, funnel stage values, UTM parameters, enrichment fields (industry equals fintech, company size greater than 500), behavioural flags (hasVisitedPricing, hasStartedForm), journey sequences, and named segment memberships. Conditions can be combined with AND and OR logic and nested to any depth. The content plan maps the matching visitor to a specific hero variant, proof block variant, and CTA variant. Rules are evaluated in priority order - the lowest priority number wins. If no rule matches, the page falls back to its configured default plan.",
        [{ label: "See audience segments", href: "/features-segments" }, { label: "Open the live demo", href: "/demo" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900&auto=format&fit=crop&q=80", alt: "Visual rule editor showing condition builder and variant mapping interface", caption: "Rules editor: conditions on the left, content plan on the right. No SQL. No code." },
      ),

      // 9. CMS integration — how variants connect to decisions
      textMedia("cms-integration", "text_media_left",
        "CMS-driven variants",
        "Marketing creates. The engine decides. No deploys.",
        "Content variants live in Sanity. A variant is simply an alternative version of a page section - a different hero headline and image, a different proof block with case study quotes instead of stats, a different CTA with 'Book a demo' instead of 'Start free trial'. Marketing creates variants in the CMS, gives them a key, and publishes them. From that moment, the rules engine can route any visitor to any variant based on their context. Adding a new variant for a new audience does not require a code change, a pull request, or a deployment. It is a CMS operation.",
        [{ label: "See all features", href: "/features" }, { label: "Read the docs", href: "/docs" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1587620962725-abab19836a68?w=900&auto=format&fit=crop&q=80", alt: "Sanity CMS interface showing a content variant editor with hero and CTA fields", caption: "Variants created in Sanity are immediately available to the decision engine." },
      ),

      // 10. Production properties — what makes it safe to trust
      featureGrid("production", "Built for production use", "feature_grid_3up", [
        {
          title: "Edge-first, zero blocking latency",
          description: "The decision pipeline runs at the CDN edge in Next.js middleware. Total overhead is under 50ms, measured from request receipt to first byte sent. Page load speed is never affected.",
          icon: "zap",
        },
        {
          title: "Privacy by architecture",
          description: "No third-party cookies. No cross-site tracking. Behavioural data is stored first-party in your own Supabase database, in your chosen region. The engine never sends visitor data to our servers.",
          icon: "shield",
        },
        {
          title: "No-flicker server-side rendering",
          description: "Personalised content is rendered server-side in the initial response. The visitor sees the correct variant on the first paint - no layout shift, no content swap, no visible flash of default content.",
          icon: "monitor",
        },
        {
          title: "Graceful fallback on every failure",
          description: "If enrichment times out, the engine proceeds without it. If the database is unreachable, the engine uses request-only signals. If no rule matches, the page default is served. The engine never blocks a page load.",
          icon: "life-buoy",
        },
        {
          title: "Variant exposure tracking",
          description: "Every decision is logged: which rule matched, which variant was served, and when. This feeds the analytics dashboard and A/B test confidence calculations. You always know which visitor saw what.",
          icon: "bar-chart-2",
        },
        {
          title: "Bot and spike protection",
          description: "The engine includes built-in rate limiting and bot detection. Scraper traffic and synthetic load is excluded from personalisation decisions and analytics - so your variant performance data reflects real visitors only.",
          icon: "alert-triangle",
        },
      ]),

      // 11. Technical testimonials — CTO and engineer voices
      testimonialSec("technical-proof", "What technical teams say", [
        {
          quote: "The edge middleware architecture was the deciding factor for us. No client-side injection, no flicker, no performance hit. It integrates with our Next.js setup exactly the way you would hope - like it was designed for it.",
          author: "Lars K.",
          role: "CTO",
          company: "JobBridge",
        },
        {
          quote: "I was sceptical about the sub-50ms claim. I ran it through our own load testing tool against a cold cache. The p95 latency added by the decision middleware was 23ms. The claim is real.",
          author: "Thomas Becker",
          role: "Lead Infrastructure Engineer",
          company: "Growlytics",
        },
        {
          quote: "The rules system is more expressive than I expected. We have rules that combine intent score thresholds, enrichment industry matching, and journey sequence detection in a single condition set. It handles complexity well.",
          author: "Anouk van Dijk",
          role: "Head of Engineering",
          company: "Frontline Agency",
        },
      ]),

      // 12. Technical FAQ — the questions engineers always ask
      faqSec("faq", "Technical questions", [
        {
          question: "Does the middleware add latency to every page load?",
          answer: "Yes, but it is minimal. The decision pipeline adds under 50ms of wall-clock time, measured at the edge, including enrichment. On pages where enrichment is not needed (returning visitors with cached profiles), the overhead is typically under 15ms. This is below the threshold of perceptible latency for page loads.",
        },
        {
          question: "What happens if the Supabase database is slow or unreachable?",
          answer: "The engine has a hard timeout on the session history fetch. If the database does not respond within the latency budget, the engine proceeds using only request-layer signals (UTM, referrer, device). The visitor sees the best variant the engine can select with available data - not a broken page.",
        },
        {
          question: "How does enrichment interact with GDPR?",
          answer: "IP-to-company lookup resolves organisational metadata only - company name, industry, estimated size, and type. This is not personal data under GDPR because it identifies the organisation, not the individual. The lookup is server-side and no data is stored beyond a short request-scoped cache. No consent is required for the enrichment itself.",
        },
        {
          question: "Can I use the engine with my existing CMS instead of Sanity?",
          answer: "The decision engine is CMS-agnostic at the rule and scoring layer. Content variants are currently stored in and served from Sanity. Integration with other CMS platforms is on the roadmap. Contact us if you have a specific CMS requirement.",
        },
        {
          question: "How does the engine handle A/B tests alongside personalisation rules?",
          answer: "A/B tests run as a special rule type with traffic splitting. A test rule has two or more variant arms with assigned traffic percentages. When a visitor matches a test rule, they are randomly assigned to an arm and that assignment is persisted in their session profile for consistent exposure. Test rules have a priority like any other rule and can be targeted to specific audiences.",
        },
        {
          question: "Is the decision engine open source?",
          answer: "The core scoring model, rule evaluator, and enrichment pipeline are proprietary. The JavaScript tracking snippet, Sanity schema definitions, and Supabase migration files are open source and available on our GitHub. The studio plugin and seed tooling are also open.",
        },
      ]),

      // 13. Final CTA — demo is the natural proof
      ctaSec("cta", "See the engine make a live decision.", "Open the interactive demo, simulate any visitor profile, and watch the engine select a variant in real time - with a full explanation of which rule matched and why.", "Open the demo", "/demo"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_platform" } },
    ["api", "technical", "architecture", "developer", "sdk", "platform"],
  ),

  // ── MANIFESTO ────────────────────────────────────────────────────────────────

  page("manifesto", "manifesto", "Manifesto", "article-page",
    "The Mister Chameleon manifesto - why we built this",
    "Why we believe the era of the one-size-fits-all website is over, and what comes next.",
    [
      textSec("body", "text_single", "We believe the era of the static website is over.",
        pt(
          "Every visitor who lands on your site is different. They came from different places, have different jobs, read different things this week, and are at completely different stages of deciding whether to trust you. Showing them all the same page is not a design choice - it's a missed opportunity, repeated a thousand times a day.",
          "We built Mister Chameleon because we believe website personalisation should be a standard tool for any growth team - not a luxury reserved for companies with large engineering budgets and a dedicated data science team.",
          "We believe privacy and personalisation are not opposites. You do not need to follow people around the internet with cookies to understand what they need. First-party data, honest signals, and a good decision engine are enough.",
          "We believe marketing teams should be able to run personalisation without filing a ticket. The content should live in a CMS. The rules should be editable without a deploy. The results should be visible in a dashboard.",
          "We believe the best personalised experience feels like good service - not surveillance. When a visitor sees content that actually speaks to their situation, they don't feel targeted. They feel understood.",
          "That is what we are building. A platform that makes adaptive websites accessible, honest, and genuinely useful - for the teams building them and the visitors experiencing them.",
          "- The Mister Chameleon team",
        ),
      ),
      ctaSec("cta", "Ready to make your website adaptive?", "Start with a free trial. No engineering sprint required.", "Get started", "/order/starter"),
    ],
    undefined,
    ["personalisation", "vision", "platform"],
  ),

  // ── ROADMAP ──────────────────────────────────────────────────────────────────

  page("roadmap", "roadmap", "Roadmap", "article-page",
    "Mister Chameleon product roadmap",
    "See what we're building next - from AI-powered recommendations to deeper CRM integrations and multi-site agency tools.",
    [
      textSec("intro", "text_lead", "What we're building next.",
        pt("We publish our roadmap openly because we think you should know what you're buying into. Here's where we're going - and roughly when."),
      ),
      processSec("phases", "Upcoming milestones", [
        { title: "AI variant recommendations", description: "Instead of writing personalisation rules by hand, our AI will suggest the highest-impact variants based on your existing traffic patterns and conversion data. Available on Growth and Pro plans.", duration: "Q3 2026" },
        { title: "Native HubSpot & Salesforce sync", description: "Two-way sync with your CRM so that known contacts and lifecycle stage automatically inform which variant each visitor sees - and so that personalisation events enrich your CRM records.", duration: "Q3 2026" },
        { title: "Visual editor", description: "A point-and-click interface for creating content variants directly on your live page - no CMS knowledge required. Design, preview, and publish in one flow.", duration: "Q4 2026" },
        { title: "Multi-domain agency dashboard", description: "Manage personalisation across all your client sites from a single dashboard. White-label the admin interface with your agency's branding.", duration: "Q4 2026" },
        { title: "Predictive next-best-action", description: "Instead of selecting a variant, the engine proactively suggests the next content piece, CTA, or action most likely to move each visitor forward - based on historical conversion patterns.", duration: "2027" },
      ]),
      { _type: "timeline", _key: "history", variant: "timeline_vertical",
        heading: "How we got here",
        description: "From side project to €4.2M-backed personalisation platform.",
        items: [
          { _key: "ti0", id: "h0", title: "Founded in Amsterdam", date: "2021", description: "Mister Chameleon started as an answer to a simple question: why does every visitor see the same website?", icon: "rocket" },
          { _key: "ti1", id: "h1", title: "First paying customers", date: "Q1 2022", description: "Ten B2B SaaS companies signed up in the first month. The rules engine shipped with three segment types and zero-code setup.", icon: "users" },
          { _key: "ti2", id: "h2", title: "Company enrichment launched", date: "Q3 2022", description: "IP-to-company enrichment went live. Visitors from recognised networks now trigger industry-matched content automatically.", icon: "building" },
          { _key: "ti3", id: "h3", title: "100 active tenants", date: "2023", description: "Reached 100 active tenants across B2B SaaS, recruitment, and digital agencies.", icon: "chart" },
          { _key: "ti4", id: "h4", title: "Series A - €4.2M", date: "March 2024", description: "Raised €4.2M to build the AI personalisation layer and expand across Europe.", icon: "trending-up" },
        ],
      },
      ctaSec("cta", "Shape the roadmap", "We build what our customers need. Tell us what's missing.", "Share feedback", "/contact"),
    ],
    undefined,
    ["features", "platform", "product"],
  ),

  // ── FEATURES ─────────────────────────────────────────────────────────────────

  page("features", "features", "Features", "marketing-page",
    "Mister Chameleon features - adaptive personalisation platform",
    "Explore every feature of the Mister Chameleon platform: intent scoring, enrichment, A/B testing, analytics, agency tools, and more.",
    [
      // 1. Hero — strong opener with dashboard visual
      textMedia("hero", "text_media_right",
        "Every tool you need to personalise at scale.",
        "One platform. Every capability your marketing team needs.",
        "Mister Chameleon is a complete adaptive personalisation platform. Every feature is designed to work together - and to be owned by your marketing team without engineering support. No sprints. No API integrations. No six-figure contract.",
        [{ label: "Start free trial", href: "/order/starter" }, { label: "See how it works", href: "/how-it-works" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Personalisation analytics dashboard" },
        "default",
      ),

      // 2. Stats bar — platform credibility at a glance
      statsSec("stats", "Numbers that matter", [
        { label: "Signals evaluated per visit", value: "130", suffix: "+", description: "Behavioural, enrichment, contextual and CRM signals - all in one decision." },
        { label: "Decision latency", value: "<10", suffix: "ms", description: "Runs at the edge. Your page speed is never affected." },
        { label: "Customers personalising today", value: "200", suffix: "+", description: "B2B SaaS, agencies, e-commerce and recruitment teams." },
        { label: "Uptime SLA", value: "99.9", suffix: "%", description: "Enterprise-grade reliability with transparent status reporting." },
      ], "subtle"),

      // 3. Quick-nav — jump to any feature detail page
      quickLinks("nav", "Explore by capability", "Each feature has its own deep-dive page with screenshots, examples, and plan details.", [
        { label: "Audience segments", href: "/features-segments", description: "Pre-built and custom visitor segments based on intent, industry, source, and behaviour." },
        { label: "Intent scoring", href: "/features-intent", description: "Real-time 0-100 score built from behavioural and enrichment signals." },
        { label: "Enrichment", href: "/features-enrichment", description: "Silent IP-to-company lookup, weather, CRM, and ABM data - all async." },
        { label: "A/B & multivariate testing", href: "/features-testing", description: "Test variants with built-in statistical confidence tracking." },
        { label: "Analytics", href: "/features-analytics", description: "Session funnel, variant performance, and conversion attribution." },
        { label: "Agency & white-label", href: "/features-agency", description: "Manage multiple client sites from one account. White-label the interface." },
      ], "default"),

      // 4. Pillar 1 — Know your visitor (signals & enrichment)
      textMedia("pillar-know", "text_media_right",
        "Know your visitor",
        "130+ signals. One clear picture of who is on your site.",
        "Before Mister Chameleon can serve the right content, it needs to understand the visitor. It evaluates behavioural signals (page views, scroll depth, CTA clicks), enrichment data (company name, industry, size from IP lookup), CRM stage, UTM source, time of day, weather, and more - all within a single edge request that adds zero latency.",
        [{ label: "Explore enrichment", href: "/features-enrichment" }, { label: "Explore intent scoring", href: "/features-intent" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80", alt: "Real-time visitor signal dashboard showing intent score and company enrichment", caption: "Every signal combined into a single visitor context - evaluated in under 10ms." },
        "subtle",
      ),

      // 5. Pillar 2 — Serve the right content (decision engine & CMS)
      textMedia("pillar-serve", "text_media_left",
        "Serve the right content",
        "A decision engine that picks the best variant - every time.",
        "The adaptive engine evaluates your audience rules in priority order and selects the best-matching hero, proof section, and CTA for each visitor. Content variants live in Sanity - your marketing team creates them, activates them, and adjusts them without writing a line of code. No sprint. No ticket. No waiting.",
        [{ label: "How the engine works", href: "/the-engine" }, { label: "Explore the CMS", href: "/docs" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=900&auto=format&fit=crop&q=80", alt: "Content variant editor in Sanity CMS showing hero and CTA variants", caption: "Marketing creates variants. The engine decides which one each visitor sees." },
        "default",
      ),

      // 6. Pillar 3 — Measure and improve (analytics & testing)
      textMedia("pillar-measure", "text_media_right",
        "Measure and improve",
        "A/B testing and analytics built in - no third-party tools required.",
        "Run controlled experiments across any content variant. The built-in analytics dashboard shows session funnels, variant performance, and conversion attribution. Statistical confidence tracking tells you when a result is real - so you can stop guessing and start compounding improvements.",
        [{ label: "Explore analytics", href: "/features-analytics" }, { label: "Explore A/B testing", href: "/features-testing" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=900&auto=format&fit=crop&q=80", alt: "A/B test results dashboard showing variant performance and statistical confidence", caption: "See exactly which variant wins - and why." },
        "subtle",
      ),

      // 7. Full feature grid — every capability listed
      featureGrid("all-features", "Every feature, in one place", "feature_grid_4up", [
        { title: "Adaptive decision engine", description: "Priority-ordered audience rules evaluated in real time. The best-matching content variant is served at the edge - no blocking requests.", icon: "cpu" },
        { title: "CMS-driven content variants", description: "Hero, proof, and CTA variants live in Sanity. Marketing creates and activates them without developer involvement.", icon: "edit-3" },
        { title: "First-party behavioural tracking", description: "Page views, scroll depth, CTA clicks, form starts, and session sequences - stored in your own database, fully GDPR compliant.", icon: "activity" },
        { title: "IP company enrichment", description: "Silent company lookup from IP: name, industry, size, and type. Works without cookies and without asking the visitor anything.", icon: "search" },
        { title: "Intent scoring", description: "A real-time 0-100 intent score calculated from combined behavioural and enrichment signals. Surfaces high-intent visitors before they leave.", icon: "trending-up" },
        { title: "Audience segments", description: "Pre-built segments for common B2B patterns (enterprise, SMB, agency, churn risk) plus a visual builder for custom segments.", icon: "users" },
        { title: "CRM & ABM integration", description: "Known contacts and target accounts get content matched to their lifecycle stage and account tier. Available on Growth and Pro.", icon: "database" },
        { title: "Weather & time context", description: "Serve weather-aware and time-appropriate content automatically - season, day segment, and local weather conditions.", icon: "cloud" },
        { title: "A/B and multivariate testing", description: "Run controlled experiments across any variant with built-in traffic splitting and statistical confidence reporting.", icon: "git-branch" },
        { title: "Analytics dashboard", description: "Session funnel, variant performance, engagement depth, and conversion attribution - all without a third-party analytics tool.", icon: "bar-chart-2" },
        { title: "Rate limiting and bot protection", description: "Spike protection ensures personalisation only runs for genuine visitors. Bots and scrapers are excluded automatically.", icon: "shield" },
        { title: "Agency and white-label mode", description: "Manage multiple client sites from one account. White-label the dashboard with your agency branding. Pro plan only.", icon: "layout" },
      ], undefined, "default"),

      // 8. Marketing-team ownership story
      textMedia("marketing-owned", "text_media_left",
        "Owned by marketing. Not blocked by engineering.",
        "Personalisation your team can run - without a single developer.",
        "Most personalisation tools end up owned by the engineering team because they require code changes to activate, adjust, or extend. Mister Chameleon is different. Content variants, audience rules, A/B tests, and analytics are all managed through interfaces designed for marketers. Your team ships personalisation on their own schedule.",
        [{ label: "How it works", href: "/how-it-works" }, { label: "See pricing", href: "/pricing" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&auto=format&fit=crop&q=80", alt: "Marketing team reviewing personalisation results on a laptop", caption: "Marketing owns the full personalisation loop - from variant creation to result analysis." },
        "subtle",
      ),

      // 9. Testimonials — feature-specific social proof
      testimonialSec("testimonials", "What customers say about specific features", [
        {
          quote: "The intent scoring alone changed how we think about our homepage. We can now show a completely different pitch to someone who has visited pricing twice versus someone arriving from a LinkedIn post.",
          author: "Sanne de Vries",
          role: "Head of Growth",
          company: "Growlytics",
        },
        {
          quote: "IP enrichment was the feature I was most sceptical about. Within the first week it identified three enterprise prospects we had no idea were evaluating us. We closed one of them.",
          author: "Marcus Bell",
          role: "VP Sales",
          company: "Frontline Agency",
        },
        {
          quote: "We run A/B tests continuously now. The statistical confidence tracking means we are not making decisions on noise - we wait for a real result and then roll it out. Our conversion rate is up 41% since we started.",
          author: "Priya Nair",
          role: "Marketing Manager",
          company: "JobBridge",
        },
      ], "default"),

      // 10. Getting started — process
      processSec("onboarding", "Live in three steps", [
        {
          title: "Install the script",
          description: "Add one script tag to your website. No framework changes, no build pipeline modifications. Works with any stack.",
          duration: "2 minutes",
        },
        {
          title: "Create your first variant",
          description: "Open the Sanity CMS and duplicate your hero section. Change the headline and CTA for a specific audience - LinkedIn visitors, returning users, enterprise prospects.",
          duration: "10 minutes",
        },
        {
          title: "Define your rule and go live",
          description: "In the rule editor, set the condition (e.g. utmSource equals linkedin) and map it to your new variant. Publish. The engine takes over immediately.",
          duration: "3 minutes",
        },
      ], "subtle"),

      // 11. FAQ — common feature questions
      faqSec("faq", "Frequently asked questions", [
        {
          question: "Do I need a developer to set up Mister Chameleon?",
          answer: "The initial script installation takes a developer about two minutes. After that, everything - variant creation, audience rules, A/B tests, analytics - is managed by your marketing team through the CMS and dashboard interfaces.",
        },
        {
          question: "How does IP enrichment work without cookies?",
          answer: "Enrichment runs a silent server-side lookup against the visitor's IP address. It returns the company name, industry, estimated size, and organisation type. No cookies are set, no personal data is stored, and it is fully GDPR compliant.",
        },
        {
          question: "Can I test two variants against each other?",
          answer: "Yes. The A/B testing module lets you split traffic between any two or more content variants and tracks conversion rates, engagement depth, and CTA clicks. Statistical confidence is calculated automatically - you see a clear signal when a result is real.",
        },
        {
          question: "What counts as a personalisation session?",
          answer: "A session is a single visitor visit where the adaptive engine evaluates signals and serves a content decision. Sessions reset after 30 minutes of inactivity. Your plan includes a monthly session allowance; overages can be topped up in bundles.",
        },
        {
          question: "Is the analytics built in or do I need a third-party tool?",
          answer: "The analytics dashboard is fully built in. It shows session volume, variant performance, funnel drop-off, engagement depth, and conversion attribution - without needing Google Analytics, Mixpanel, or any other tool alongside it.",
        },
        {
          question: "Can agencies manage multiple client sites?",
          answer: "Yes. The Pro plan includes multi-tenant agency mode, which lets you manage multiple client sites from one account. The dashboard can be white-labelled with your agency branding so clients see a seamless experience.",
        },
      ], "default"),

      // 12. Final CTA
      ctaSec("cta", "Start personalising your website today", "Free trial. No credit card. Live in 15 minutes.", "Start free trial", "/order/starter"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_platform" } },
    ["features", "functionaliteiten", "platform", "capabilities", "product"],
  ),

  // ── FEATURES / SEGMENTS ──────────────────────────────────────────────────────

  page("features-segments", "features-segments", "Audience Segments", "landing-page",
    "Audience segments - Mister Chameleon features",
    "Build or use pre-built visitor segments based on intent score, company type, traffic source, and behaviour. Target content precisely.",
    [
      textSec("intro", "text_lead", "Stop targeting everyone. Start targeting the right ones.",
        pt(
          "Audience segments let you group visitors by what they have in common - and then serve each group content written for them. Not a watered-down average. The specific message that moves this type of visitor forward.",
          "Mister Chameleon ships with 10 pre-built segments. You can activate them in seconds, or build your own with any combination of the 130+ signals the engine tracks.",
        ),
      ),
      featureGrid("built-in", "Pre-built segments - ready to use", "feature_grid_3up", [
        { title: "High-intent visitors", description: "Intent score >= 60. These visitors have shown clear buying signals. Serve them your most direct CTA and pricing-oriented content.", icon: "trending-up" },
        { title: "Enterprise prospects", description: "Company type: enterprise or mid-market, detected from IP. Show them security certifications, SLA details, and enterprise case studies.", icon: "building" },
        { title: "SMB & startup segment", description: "Smaller companies that respond to speed-to-value, simplicity, and pricing transparency.", icon: "zap" },
        { title: "LinkedIn traffic", description: "Visitors arriving from LinkedIn are usually professionals doing research. Thought-leadership content converts this segment best.", icon: "linkedin" },
        { title: "Pricing researchers", description: "Visited your pricing page or scored >= 0.4 on pricing interest. The comparison-focused content variant outperforms here.", icon: "tag" },
        { title: "Returning engagers", description: "Multi-session visitors with engagement score >= 40. They know you - give them the deeper story, not the intro.", icon: "repeat" },
        { title: "Ready to convert", description: "isReadyToConvert = true AND intent >= 50. These visitors are dual-gated: both high intent and high engagement. Show them your strongest CTA.", icon: "check-circle" },
        { title: "Paid acquisition", description: "Visitors from paid search or paid social. They clicked an ad - your message should deliver exactly what the ad promised.", icon: "dollar-sign" },
        { title: "Target accounts (ABM)", description: "Matched against your ABM list. Show account-specific content, case studies from their industry, and named reference customers.", icon: "crosshair" },
        { title: "CRM-known contacts", description: "Matched via HubSpot or Salesforce. Known contacts get content matched to their lifecycle stage - lead, MQL, SQL, customer.", icon: "users" },
      ]),
      processSec("how", "Building a custom segment", [
        { title: "Pick your signals", description: "Choose from intent score, engagement score, traffic source, company industry, company size, funnel stage, CRM status, ABM match, page visit history, or any other tracked signal." },
        { title: "Set your conditions", description: "Combine signals with AND/OR logic. 'Intent ≥ 70 AND industry = SaaS' - or as simple as 'UTM source = newsletter'." },
        { title: "Assign content variants", description: "Link your segment to any hero, proof, CTA, or feature variant in your CMS. The engine will serve matched visitors the right content automatically." },
        { title: "Monitor performance", description: "The analytics dashboard shows session counts, conversion rates, and funnel progression for every segment - so you can tune your targeting over time." },
      ]),
      ctaSec("cta", "Ready to target smarter?", "Start with the 10 pre-built segments and customise as you grow.", "Try it free", "/order/starter"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_cases" } },
    ["features", "use-case", "sector", "audience"],
  ),

  // ── FEATURES / INTENT ────────────────────────────────────────────────────────

  page("features-intent", "features-intent", "Intent Scoring", "landing-page",
    "Intent scoring - Mister Chameleon features",
    "Real-time 0–100 intent score built from 130+ behavioural and enrichment signals. Know exactly how close each visitor is to converting.",
    [
      textSec("intro", "text_lead", "Know exactly where each visitor stands - before they tell you.",
        pt(
          "Intent scoring is the single most powerful signal for personalisation. It tells you, right now, how likely a given visitor is to convert - and therefore what content will move them forward.",
          "Mister Chameleon's intent engine produces a 0–100 score for every visitor on every page load, using a combination of behavioural history, enrichment data, and real-time signals.",
        ),
      ),
      featureGrid("signals", "What goes into the score", "feature_grid_4up", [
        { title: "Page visit patterns", description: "Visiting pricing, then about, then a case study - in that order - signals much higher intent than a random browse. Sequence scoring captures this.", icon: "map" },
        { title: "Time and recency", description: "A visitor who read your pricing page yesterday and is back today is far more likely to convert than someone who visited once three weeks ago.", icon: "clock" },
        { title: "CTA engagement", description: "Clicks on demo CTAs, pricing links, and contact buttons are strong intent signals. Each interaction increments the score.", icon: "mouse-pointer" },
        { title: "Form behaviour", description: "Starting a contact form - even without submitting - is a powerful intent signal. We track it and factor it in.", icon: "edit-2" },
        { title: "Company enrichment", description: "Enterprise visitors score differently from SMBs. A known target account scores higher by default. Industry match adjusts the weighting.", icon: "building" },
        { title: "Session depth", description: "The number of sessions, pages per session, and total time on site all contribute. A deep multi-session visitor is almost always higher intent than a first-timer.", icon: "layers" },
      ]),
      textMedia("score-visual", "text_media_left",
        "Real-time scoring dashboard",
        "Watch intent build - session by session.",
        "The analytics dashboard shows how each visitor's intent score evolves over time. You can see exactly which pages, clicks, and interactions moved the needle - and use that insight to sharpen your personalisation rules.",
        [{ label: "Explore analytics features", href: "/features-analytics" }],
        { type: "image", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Analytics dashboard showing intent scores and funnel stages", caption: "Intent score trends - live, per visitor, per session" },
      ),
      statsSec("results", "What intent scoring unlocks", [
        { label: "Improvement in CTA click-through for high-intent segment", value: "47", suffix: "%" },
        { label: "Reduction in demo no-shows when booking from high-intent content", value: "31", suffix: "%" },
        { label: "Intent score accuracy vs. eventual conversion", value: "89", suffix: "%" },
      ]),
      ctaSec("cta", "See your visitors' intent scores live", "The demo shows real-time scoring as you simulate different visitor journeys.", "Open the demo", "/demo"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ["features", "intent", "scoring", "technical", "product"],
  ),

  // ── FEATURES / ENRICHMENT ────────────────────────────────────────────────────

  page("features-enrichment", "features-enrichment", "Enrichment", "landing-page",
    "Data enrichment - Mister Chameleon features",
    "Silent IP-to-company enrichment, CRM matching, ABM targeting, weather, and more - all without cookies, all async, all GDPR compliant.",
    [
      textMedia("intro-visual", "text_media_right",
        "Know who's on your site",
        "From anonymous visitor to known context - in milliseconds.",
        "Enrichment is what turns a nameless IP address into a known company. When someone from a recognisable network hits your site, we silently look up their company name, industry, headcount, and type - and make that information available to the decision engine before the page finishes loading. No cookies required.",
        [{ label: "See the enrichment pipeline", href: "/how-it-works" }],
        { type: "image", url: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&auto=format&fit=crop&q=80", alt: "Team working with data on laptops in a modern office", caption: "Company enrichment - from IP address to personalised experience" },
      ),
      featureGrid("types", "Enrichment sources", "feature_grid_3up", [
        { title: "IP-to-company", description: "Company name, domain, industry, company size, company type, and match confidence - looked up from the visitor's IP address on every request.", icon: "globe" },
        { title: "CRM matching", description: "Known contacts from HubSpot or Salesforce are matched by email (when available) or company domain. Lifecycle stage, owner, and segment are surfaced to the engine.", icon: "users" },
        { title: "ABM target accounts", description: "Upload your target account list and we'll match incoming visitors against it. Tier 1 accounts get premium content automatically.", icon: "crosshair" },
        { title: "Weather context", description: "Current weather conditions (code, temperature, precipitation, wind) for the visitor's detected location. Useful for seasonal and weather-aware content.", icon: "cloud" },
        { title: "Geo enrichment", description: "Country, region, city, timezone, and lat/lng - available for geo-targeted content without requiring consent-gated location APIs.", icon: "map-pin" },
        { title: "Client context", description: "Device type, OS, browser, viewport size, touch capability, preferred colour scheme, and language - parsed from the user agent and screen properties.", icon: "monitor" },
      ]),
      faqSec("faq", "Enrichment FAQ", [
        { question: "Is IP enrichment GDPR compliant?", answer: "Yes. IP-to-company lookup resolves to a company - not an individual person. It is treated as business data, not personal data, and therefore falls outside GDPR's consent requirements in most EU interpretations. We recommend including it in your privacy policy as a transparency measure." },
        { question: "How accurate is the IP lookup?", answer: "Match rates depend on the visitor's network. Enterprise visitors on corporate networks match at ~80–90%. SMBs and remote workers on residential or VPN connections match at lower rates. We always surface confidence scores so you can set minimum thresholds for your rules." },
        { question: "Does enrichment slow down my site?", answer: "No. All enrichment is asynchronous - it runs in parallel with your page render. By the time the visitor has scrolled past your hero section, enrichment is already complete and the decision engine has selected the best variant." },
      ]),
      ctaSec("cta", "See enrichment in action", "The enterprise scenario in our demo shows exactly what a company-enriched visitor sees.", "Try the demo", "/demo/b2b/enterprise"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_platform" } },
    ["features", "integrations", "api", "integratie", "technical"],
  ),

  // ── FEATURES / TESTING ───────────────────────────────────────────────────────

  page("features-testing", "features-testing", "A/B & Multivariate Testing", "landing-page",
    "A/B and multivariate testing - Mister Chameleon features",
    "Run controlled experiments on your personalised variants. Statistical confidence tracking built in - no third-party testing tool required.",
    [
      textSec("intro", "text_lead", "Test with confidence. Optimise continuously.",
        pt(
          "Personalisation tells the engine which variant to show each visitor based on what you know about them. Testing tells you which variant actually converts best - so you can improve your rules over time.",
          "Mister Chameleon has built-in variant testing, so you don't need a separate A/B testing tool. Run experiments on any hero, proof section, or CTA - and let the data tell you what works.",
        ),
      ),
      featureGrid("capabilities", "Testing capabilities", "feature_grid_3up", [
        { title: "A/B testing", description: "Split any traffic segment between two or more variants and measure which drives more conversions. Statistical confidence is calculated automatically.", icon: "git-branch" },
        { title: "Multivariate testing", description: "Test multiple elements simultaneously - hero headline, proof section, and CTA button text - to find the combination that converts best.", icon: "sliders" },
        { title: "Segment-aware testing", description: "Run tests within specific audience segments. The best variant for enterprise prospects may differ from the best variant for SMB visitors - test them separately.", icon: "users" },
        { title: "Holdout groups", description: "Define a control group that sees the original content, then measure the full impact of personalisation versus no personalisation.", icon: "shield" },
        { title: "Confidence tracking", description: "The analytics dashboard shows statistical significance in real time. We surface the confidence level so you know when to call a winner.", icon: "activity" },
        { title: "Auto-promotion", description: "Configure the system to automatically promote the winning variant once statistical confidence reaches your threshold - no manual intervention required.", icon: "award" },
      ]),
      ctaSec("cta", "Start optimising your content", "Set up your first A/B test in the same interface you use to manage personalisation.", "Start free trial", "/order/starter"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ["features", "a/b testing", "testing", "product"],
  ),

  // ── FEATURES / ANALYTICS ─────────────────────────────────────────────────────

  page("features-analytics", "features-analytics", "Analytics", "landing-page",
    "Analytics dashboard - Mister Chameleon features",
    "Session funnel, variant performance, conversion attribution, and audience segment breakdowns - all in one place. No extra analytics tool needed.",
    [
      textSec("intro", "text_lead", "See what's working - and why.",
        pt(
          "Personalisation without measurement is guesswork. Mister Chameleon's analytics dashboard gives you a clear picture of how each variant performs, which audience segments convert best, and where visitors are dropping out of your funnel.",
          "All of this is built in. No Google Analytics integration, no separate dashboard, no data exports.",
        ),
      ),
      featureGrid("reports", "What you can measure", "feature_grid_4up", [
        { title: "Session funnel", description: "See how visitors move from awareness to consideration to intent to conversion - by segment, traffic source, or time period.", icon: "filter" },
        { title: "Variant performance", description: "Compare conversion rates, CTA click-through, and time-on-page for every active variant across every audience segment.", icon: "bar-chart-2" },
        { title: "Daily & monthly session counts", description: "Track personalised session volume against your plan cap. See which days drive the most personalised visits.", icon: "calendar" },
        { title: "Enrichment match rates", description: "Monitor how often company enrichment produces a confident match - and which industries are most represented in your traffic.", icon: "percent" },
        { title: "A/B test results", description: "Live confidence intervals for any running experiment. Stop guessing, start measuring.", icon: "git-branch" },
        { title: "Credit & session usage", description: "Full audit trail for enrichment credit spend and session credit consumption - so billing is always transparent.", icon: "credit-card" },
      ]),
      textMedia("dashboard-visual", "text_media_left",
        "One dashboard. Everything you need.",
        "Funnel, variants, segments - in one place.",
        "The Mister Chameleon analytics dashboard gives you a single view of how your personalisation is performing. Session funnel, variant lift, enrichment match rate, and A/B confidence intervals - all live, all in one tab. No data exports, no third-party analytics tool required.",
        [{ label: "See all analytics features", href: "/features-analytics" }],
        { type: "image", url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&auto=format&fit=crop&q=80", alt: "Person working on a laptop with analytics dashboards on the screen", caption: "The full analytics view - session funnel, variant performance, and enrichment stats" },
      ),
      statsSec("stats", "Analytics that make a difference", [
        { label: "Average time to identify a winning variant", value: "< 2", suffix: " weeks" },
        { label: "Customers who find a segment surprise in month one", value: "73", suffix: "%" },
        { label: "Data points tracked per session", value: "130", suffix: "+" },
      ]),
      ctaSec("cta", "See the analytics dashboard live", "The demo includes a live analytics view built on real session data.", "Explore the demo", "/demo"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ["features", "analytics", "product", "platform"],
  ),

]; // end part 1 - continued in marketingPagesPart2

export const marketingPagesPart2 = [

  // ── FEATURES / AGENCY ────────────────────────────────────────────────────────

  page("features-agency", "features-agency", "Agency & White-Label", "landing-page",
    "Agency & white-label mode - Mister Chameleon Pro",
    "Run personalisation for all your clients from one platform. White-label the interface, manage multiple sites, and bill clients on your own terms.",
    [
      textMedia("agency-dashboard", "text_media_right",
        "One platform. Every client site.",
        "Run personalisation for every client from a single white-label dashboard.",
        "If you run personalisation for multiple clients - or want to offer it as a service - Mister Chameleon Pro gives you a single control panel for every site, with your branding on the interface your clients see.\n\nNo separate contracts per client. No tool-per-tenant sprawl. One Pro plan, unlimited client sites.",
        [{ label: "See agency pricing", href: "/features-agency" }, { label: "Book a call", href: "/contact" }],
        { type: "image", url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80", alt: "Agency team reviewing multi-client dashboards on a large monitor", caption: "The agency dashboard - all client sites, one view, your branding" },
      ),
      featureGrid("capabilities", "What agency mode includes", "feature_grid_3up", [
        { title: "Multi-site dashboard", description: "See all your client sites in one place. Session counts, conversion trends, and active variants - across every account, at a glance.", icon: "layout" },
        { title: "White-label interface", description: "Replace Mister Chameleon branding with your own logo, colours, and domain. Clients see your agency's product, not ours.", icon: "tag" },
        { title: "Per-client content isolation", description: "Each client's variants, rules, segments, and analytics are fully isolated. No data leakage between accounts.", icon: "lock" },
        { title: "Custom domains per client", description: "Each client gets their own admin URL on your domain - yourplatform.com/client/acme - with their own login.", icon: "link" },
        { title: "Agency billing controls", description: "Manage session credit allocation per client. Add top-ups centrally and distribute as needed. One invoice, one relationship." },
        { title: "Team member management", description: "Add client-side team members with appropriate permissions. Clients can view their analytics and edit their own content variants without accessing other accounts." },
      ]),
      pricingSec("pricing", "Agency mode is included on Pro", "Everything in Growth, plus unlimited client sites and white-labelling.", [
        {
          _key: "tier-pro", name: "Pro", price: "€749", period: "/month",
          description: "For agencies and teams managing personalisation across multiple client sites.",
          highlighted: true, badge: "Agency ready",
          features: [
            { _key: "f0", label: "500,000 personalised sessions/month" },
            { _key: "f1", label: "Unlimited client sites" },
            { _key: "f2", label: "Full white-label interface" },
            { _key: "f3", label: "Custom domain per client" },
            { _key: "f4", label: "All Growth features included" },
            { _key: "f5", label: "Priority support" },
          ],
          ctaLabel: "Get started on Pro", ctaHref: "/order/pro",
        },
      ], "Annual billing saves 20%. Talk to us about volume pricing for 10+ client sites."),
      ctaSec("cta", "Talk to us about your agency setup", "Tell us how many client sites you run and we'll build a plan that works.", "Book a call", "/contact"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["features", "services", "white-label", "agency", "partnership"],
  ),

  // ── INTEGRATIONS ─────────────────────────────────────────────────────────────

  page("integrations", "integrations", "Integrations", "marketing-page",
    "Integrations - Mister Chameleon connects with your stack",
    "Mister Chameleon integrates with HubSpot, Salesforce, Sanity CMS, Segment, and more. Set up in minutes, not weeks.",
    [
      textMedia("integrations-banner", "text_media_right",
        "Your stack, enriched",
        "Fits into your tools without rearranging them.",
        "You shouldn't have to rip out your existing tools to add personalisation. Mister Chameleon is designed to sit alongside your current stack - enriching it with adaptive capabilities without replacing anything you already depend on.",
        [{ label: "View all integration docs", href: "/docs/integrations" }],
        { type: "image", url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&auto=format&fit=crop&q=80", alt: "Network of connected servers and APIs representing integration infrastructure", caption: "One platform, connected to your entire stack" },
      ),
      logoStrip("partner-logos", "Works with the tools you already use", [
        { name: "Sanity",      src: "https://cdn.worldvectorlogo.com/logos/sanity.svg",       url: "https://sanity.io" },
        { name: "HubSpot",     src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg",      url: "https://hubspot.com" },
        { name: "Salesforce",  src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg", url: "https://salesforce.com" },
        { name: "Supabase",    src: "https://cdn.worldvectorlogo.com/logos/supabase.svg",     url: "https://supabase.com" },
        { name: "Stripe",      src: "https://cdn.worldvectorlogo.com/logos/stripe-2.svg",     url: "https://stripe.com" },
        { name: "Next.js",     src: "https://cdn.worldvectorlogo.com/logos/next-js.svg",      url: "https://nextjs.org" },
        { name: "Segment",     src: "https://cdn.worldvectorlogo.com/logos/segment-1.svg",    url: "https://segment.com" },
        { name: "Storyblok",   src: "https://cdn.worldvectorlogo.com/logos/storyblok-1.svg",  url: "https://storyblok.com" },
      ], { variant: "logo_grid", grayscale: false, showLabels: true }),
      featureGrid("integrations", "Available integrations", "feature_grid_4up", [
        { title: "Sanity CMS", description: "All content variants live in Sanity. Marketing teams use the Sanity Studio to create and manage personalised content - no developer needed.", icon: "edit" },
        { title: "HubSpot", description: "Sync contact lifecycle stage, owner, and custom properties. Known HubSpot contacts get content matched to their CRM record automatically.", icon: "users" },
        { title: "Salesforce", description: "Match visitors to Salesforce accounts and contacts. Surface account tier, opportunity stage, and owner to the personalisation engine.", icon: "cloud" },
        { title: "Supabase", description: "Your behavioural data, session history, and analytics all live in your own Supabase database. Full ownership, no vendor lock-in.", icon: "database" },
        { title: "Segment / CDP", description: "Push personalisation events to your CDP for downstream activation. Segment, RudderStack, and Snowplow supported.", icon: "radio" },
        { title: "Stripe", description: "Manage your Mister Chameleon subscription and session credit top-ups directly through the admin interface - Stripe handles billing securely.", icon: "credit-card" },
        { title: "Next.js", description: "Mister Chameleon is built on Next.js 15 with App Router. The decision engine runs in Edge Middleware - perfect performance, zero lock-in.", icon: "code" },
        { title: "Statamic & Storyblok", description: "Using a different CMS? Our provider architecture supports Statamic and Storyblok alongside Sanity - or your own custom CMS via the adapter interface.", icon: "layers" },
      ]),
      ctaSec("cta", "Don't see your tool?", "We're adding integrations every quarter. Tell us what you need.", "Request an integration", "/contact"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_platform" } },
    ["integrations", "integraties", "api", "technical", "platform"],
  ),

  // ── SECURITY ─────────────────────────────────────────────────────────────────

  page("security", "security", "Security & GDPR", "landing-page",
    "Security & GDPR compliance - Mister Chameleon",
    "First-party data only. No third-party cookies. GDPR compliant by design. Your data stays in your database.",
    [
      textMedia("privacy-visual", "text_media_right",
        "Privacy-first personalisation",
        "Not privacy-optional. Privacy by design.",
        "A lot of personalisation tools were built in an era when third-party cookies were the default. Mister Chameleon was not. We built from the ground up on first-party data - which means you can personalise your website without compromising your visitors' privacy or your GDPR compliance.\n\nNo cross-site tracking. No fingerprinting. No data sold or shared. Just better content for the right visitor, powered by signals they've already given you.",
        [{ label: "Read our full privacy approach", href: "/security" }],
        { type: "image", url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=900&auto=format&fit=crop&q=80", alt: "Digital security concept - padlock on a circuit board background", caption: "First-party data, your database, your region - GDPR compliant by design" },
      ),
      featureGrid("principles", "Our security and privacy principles", "feature_grid_3up", [
        { title: "No third-party cookies", description: "We use a first-party session cookie set on your own domain. No cross-site tracking, no fingerprinting, no ad network data." },
        { title: "Your data, your database", description: "All behavioural data, session history, and analytics live in your own Supabase database. We never store your visitors' data on our infrastructure." },
        { title: "IP enrichment without consent", description: "IP-to-company lookup resolves to a business entity - not a person - and therefore does not require consent under GDPR in most EU interpretations." },
        { title: "Data minimisation by default", description: "We track only the signals necessary for personalisation decisions. No behavioural profiles are sold, shared, or used outside your account." },
        { title: "Edge-first architecture", description: "The decision engine runs in Next.js Edge Middleware - your visitors' requests never leave the edge. No data reaches a central server unnecessarily." },
        { title: "SOC 2 roadmap", description: "We are working toward SOC 2 Type II certification. Enterprise customers on the Pro plan can request our current security documentation." },
      ]),
      faqSec("faq", "Security & compliance FAQ", [
        { question: "Do I need to update my cookie banner for Mister Chameleon?", answer: "In most cases, no. We use a single first-party functional cookie (mc_session_id) that is necessary for the service to function - which typically does not require explicit consent under ePrivacy Directive interpretations. We recommend disclosing it in your cookie policy as a transparency measure. Your legal team should confirm for your specific jurisdiction." },
        { question: "Where is visitor data stored?", answer: "In your own Supabase database. You choose the region (EU, US, or others). We never store your visitors' personal data on Mister Chameleon infrastructure." },
        { question: "Is Mister Chameleon GDPR compliant?", answer: "Yes. We act as a data processor under GDPR. We offer a Data Processing Agreement (DPA) for all paying customers, which documents the lawful basis for processing, your rights as controller, and our subprocessor relationships." },
        { question: "Can I request a security questionnaire or DPA?", answer: "Yes - contact us at security@misterchameleon.io and we'll respond within two business days." },
      ]),
      ctaSec("cta", "Questions about compliance?", "Our team is happy to help with security questionnaires, DPA requests, and DPIA support.", "Contact us", "/contact"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_vision" } },
    ["security", "gdpr", "privacy", "beveiliging", "compliance", "trust"],
  ),

  // ── DEMO HUB ─────────────────────────────────────────────────────────────────

  page("demo", "demo", "Live Demo", "landing-page",
    "Live demo - see Mister Chameleon adapt to every visitor",
    "Watch your website adapt in real time. Simulate any visitor profile and see exactly which content variant the engine selects - and why.",
    [
      textMedia("demo-preview", "text_media_stacked",
        "Live - not a mockup",
        "Watch your website adapt to every type of visitor.",
        "Our interactive demo runs the actual decision engine, with actual content variants and real personalisation rules. Select any visitor profile from the list below and watch every section of the page respond - hero, proof, and CTA - in real time.",
        [{ label: "Open the demo controls", href: "/demo-controls" }],
        { type: "video", url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "The demo - switch visitor profiles and watch the page respond" },
      ),
      quickLinks("b2b", "B2B SaaS scenarios", "Twelve B2B visitor profiles - see how content adapts at each stage.", [
        { label: "Cold / new visitor", href: "/demo/b2b/new-visitor", description: "First-time visit, no signals. Safe, welcoming intro content." },
        { label: "Consideration stage", href: "/demo/b2b/consideration", description: "Has browsed About and Cases - now building a shortlist." },
        { label: "Trial ready", href: "/demo/b2b/trial-ready", description: "Intent score ≥ 50, visited pricing. Push them to sign up." },
        { label: "High intent", href: "/demo/b2b/high-intent", description: "Strong funnel signals. Direct CTA, pricing-forward content." },
        { label: "Enterprise prospect", href: "/demo/b2b/enterprise", description: "Company enriched from IP. Enterprise case studies front and centre." },
        { label: "Google campaign", href: "/demo/b2b/paid-search", description: "Arrived from paid search. Message matches the ad promise." },
        { label: "Returning visitor", href: "/demo/b2b/returning", description: "Multi-session. Knows you - give them the deeper story." },
        { label: "Form drop-off", href: "/demo/b2b/form-dropoff", description: "Started a form, didn't finish. Gentle re-engagement." },
        { label: "Post-conversion", href: "/demo/b2b/converted", description: "Just signed up. Welcome and onboarding content." },
        { label: "Expansion (customer)", href: "/demo/b2b/expansion", description: "Existing Growth customer revisiting pricing. Upgrade nudge." },
        { label: "High friction", href: "/demo/b2b/high-friction", description: "Wants to buy but keeps hitting obstacles. Remove every barrier." },
        { label: "Churn risk", href: "/demo/b2b/churn-risk", description: "Disengaging customer. Re-engage with value - not a sales pitch." },
      ]),
      quickLinks("careers", "Careers site scenarios", "Six stages of the candidate journey.", [
        { label: "New job seeker", href: "/demo/careers/new-visitor", description: "First visit to your careers site. Who are you as an employer?" },
        { label: "Role explorer", href: "/demo/careers/explorer", description: "Browsing multiple roles. Culture and team content works here." },
        { label: "Job intent", href: "/demo/careers/job-intent", description: "Focused on a specific role. Highlight what makes this role great." },
        { label: "High intent applicant", href: "/demo/careers/high-intent", description: "Strong apply intent. Remove friction from the application path." },
        { label: "Application form drop-off", href: "/demo/careers/form-dropoff", description: "Started but didn't finish. Re-engage without being pushy." },
        { label: "Application submitted", href: "/demo/careers/submitted", description: "Applied. What happens next? Set expectations, build excitement." },
      ]),
      quickLinks("dev-tools", "Developer tools & resources", "Technical resources and UI references for teams evaluating the platform.", [
        { label: "Block showcase", href: "/block-showcase", description: "Browse every UI block and variant available on this platform.", icon: "layout" },
        { label: "Documentation", href: "/docs", description: "Setup guides, integration reference, and how-to articles.", icon: "book" },
        { label: "Demo controls", href: "/demo-controls", description: "Switch visitor profile and watch the page adapt in real time.", icon: "sliders" },
        { label: "Changelog", href: "/changelog", description: "See what we shipped this month.", icon: "clock" },
      ]),
      // NOTE: No explicit ctaSec here — the landing-page template renders the
      // adaptive `cta` context slot (cta_platform fallback) after content blocks.
      // Adding a ctaSec in sections[] would stack a second CTA directly above it.
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["personalisation", "demo", "use-case", "platform", "features"],
  ),

  // ── DEMO: B2B SCENARIOS (10 pages) ───────────────────────────────────────────

  ...([
    { id: "demo-b2b-new-visitor",  slug: "demo-b2b-new-visitor",  title: "Demo: Cold / New Visitor",
      seoTitle: "New visitor demo - Mister Chameleon adaptive personalisation",
      scenario: "cold_visitor", stage: "awareness", what: "A visitor with no history, no known company, and no behavioural signals. The safest content wins: a clear value proposition, low-commitment CTA, and broad social proof.",
      shows: ["Clean, welcoming hero with the core value proposition", "Generic proof section - broad industry numbers rather than specific case studies", "Low-friction CTA: 'See how it works' rather than 'Start free trial'"],
    },
    { id: "demo-b2b-consideration", slug: "demo-b2b-consideration", title: "Demo: Consideration Stage",
      seoTitle: "Consideration stage demo - Mister Chameleon",
      scenario: "consideration", stage: "consideration", what: "Has visited About and Cases in previous sessions. Building a shortlist. They know what personalisation is - they want to know if Mister Chameleon is the right choice.",
      shows: ["Comparison-focused hero: what makes us different", "Case study proof section with ROI numbers", "Mid-funnel CTA: 'Compare plans' or 'Book a demo'"],
    },
    { id: "demo-b2b-trial-ready",  slug: "demo-b2b-trial-ready", title: "Demo: Trial Ready",
      seoTitle: "Trial-ready visitor demo - Mister Chameleon",
      scenario: "trial_ready", stage: "intent", what: "Intent score ≥ 50. Has visited pricing. The decision is almost made - they just need a final push and a low-risk first step.",
      shows: ["Product-led hero: 'Start for free - up and running in 15 minutes'", "Proof focused on speed-to-value and ease of setup", "Direct CTA to the Starter plan order page"],
    },
    { id: "demo-b2b-high-intent",  slug: "demo-b2b-high-intent", title: "Demo: High Intent",
      seoTitle: "High-intent visitor demo - Mister Chameleon",
      scenario: "high_intent", stage: "high_intent", what: "Visited pricing, clicked a CTA, strong funnel signals. This is a hot lead. Content should confirm they're making the right choice and make the next step impossible to ignore.",
      shows: ["Urgency-aware hero with a clear, singular CTA", "Customer testimonials focused on fast results", "Pricing table visible without clicking - remove the friction"],
    },
    { id: "demo-b2b-enterprise",   slug: "demo-b2b-enterprise", title: "Demo: Enterprise Prospect",
      seoTitle: "Enterprise prospect demo - Mister Chameleon",
      scenario: "enterprise_returning", stage: "consideration", what: "Company enriched from IP - enterprise or mid-market company. Content shifts to match the enterprise buyer: security, compliance, SLA, and named reference customers.",
      shows: ["Enterprise-framed hero: 'Built for teams who can't afford downtime'", "Security and compliance proof section", "CTA to book a call with the sales team - not a self-serve trial"],
    },
    { id: "demo-b2b-paid-search",  slug: "demo-b2b-paid-search", title: "Demo: Google Campaign",
      seoTitle: "Paid search visitor demo - Mister Chameleon",
      scenario: "google_high_intent", stage: "intent", what: "Arrived from a paid Google search. They clicked an ad - your landing page must deliver exactly what the ad promised. No bait and switch.",
      shows: ["Problem-aware hero that mirrors the ad copy", "Specific, concrete proof: not generic claims", "CTA that continues the conversion path started in the ad"],
    },
    { id: "demo-b2b-returning",    slug: "demo-b2b-returning", title: "Demo: Returning Visitor",
      seoTitle: "Returning visitor demo - Mister Chameleon",
      scenario: "returning_visitor", stage: "consideration", what: "Multi-session visitor. Engagement score ≥ 40. They know what you do - don't introduce yourself again. Go deeper.",
      shows: ["Recognition-based hero: 'You're back - here's what's new'", "Deeper content: technical detail, integrations, advanced use cases", "CTA that acknowledges their journey: 'Ready to take the next step?'"],
    },
    { id: "demo-b2b-form-dropoff", slug: "demo-b2b-form-dropoff", title: "Demo: Form Drop-off",
      seoTitle: "Form drop-off recovery demo - Mister Chameleon",
      scenario: "form_dropoff", stage: "intent", what: "Started a contact form or trial sign-up but didn't complete it. High intent, but something got in the way. Re-engage gently without being pushy.",
      shows: ["Empathetic hero: 'No rush - we saved your spot'", "Objection-handling proof: answer the most common hesitations", "CTA back to the form they started - pre-filled where possible"],
    },
    { id: "demo-b2b-converted",    slug: "demo-b2b-converted", title: "Demo: Post-Conversion",
      seoTitle: "Post-conversion onboarding demo - Mister Chameleon",
      scenario: "post_conversion", stage: "customer", what: "Just signed up or submitted a form. Maximum confidence. The homepage becomes an onboarding launchpad - not a sales pitch.",
      shows: ["Welcome hero with their name (if available) and next steps", "Onboarding checklist or quick-start guide as proof section", "CTA to the admin dashboard or documentation"],
    },
    { id: "demo-b2b-expansion",    slug: "demo-b2b-expansion", title: "Demo: Customer Expansion",
      seoTitle: "Customer expansion demo - Mister Chameleon",
      scenario: "customer_expansion", stage: "customer", what: "Existing Growth plan customer revisiting the pricing page. They're considering upgrading. Content focuses on what Pro unlocks - without pressuring.",
      shows: ["Upgrade-aware hero: 'You're on Growth - here's what Pro adds'", "Side-by-side plan comparison with Pro features highlighted", "CTA to speak with the team about an upgrade - not a new trial"],
    },
    { id: "demo-b2b-high-friction", slug: "demo-b2b-high-friction", title: "Demo: High Friction",
      seoTitle: "High friction visitor demo - Mister Chameleon",
      scenario: "high_friction", stage: "intent", what: "High intent but something is blocking conversion - slow page load, a confusing pricing structure, or a long sign-up form. They want to buy but they keep hitting obstacles. Content should remove every possible barrier and provide immediate reassurance.",
      shows: ["Friction-aware hero: simplified messaging, no jargon, no complexity", "Objection-handling proof: fast setup, no credit card, cancel anytime", "Minimal CTA path - one button, one action, no distractions"],
    },
    { id: "demo-b2b-churn-risk",    slug: "demo-b2b-churn-risk", title: "Demo: Churn Risk",
      seoTitle: "Churn risk demo - Mister Chameleon retention personalisation",
      scenario: "churn_risk", stage: "customer", what: "An existing customer showing disengagement signals - declining session frequency, no recent feature usage, or a recent support ticket. The goal is re-engagement, not a sales pitch. Remind them of value delivered, surface underused features, and offer a conversation.",
      shows: ["Retention-focused hero: 'Here's what Mister Chameleon did for you this month'", "Value proof section: personalised sessions delivered, conversion lift, top-performing variant", "Soft CTA: 'Talk to your customer success manager' - not an upgrade push"],
    },
  ] as const).map(({ id, slug, title, seoTitle, scenario: _s, stage: _st, what, shows }) =>
    page(id, slug, title, "article-page", seoTitle,
      `${title} - watch the Mister Chameleon decision engine serve the right content for this specific visitor profile.`,
      [
        textSec("intro", "text_lead", title.replace("Demo: ", ""),
          pt(what),
        ),
        featureGrid("shows", "What this demo shows", "feature_grid_checklist",
          shows.map((s) => ({ title: s, description: "" })),
        ),
        ctaSec("cta", "Try it on your own site", "Set up takes 15 minutes. See your first personalised visitor today.", "Start free trial", "/order/starter"),
      ],
    )
  ),

  // ── DEMO: CAREERS SCENARIOS (5 pages) ────────────────────────────────────────

  ...([
    { id: "demo-careers-new-visitor", slug: "demo-careers-new-visitor", title: "Demo: Careers - New Visitor",
      what: "First-time visitor to your careers site. They don't know you as an employer yet. Lead with culture, values, and team - not just job titles.",
      shows: ["Employer brand hero: who you are and why it matters to work here", "Culture and team proof section", "CTA to explore all open roles"],
    },
    { id: "demo-careers-explorer", slug: "demo-careers-explorer", title: "Demo: Careers - Role Explorer",
      what: "Has browsed multiple job listings but hasn't focused on one. They're still deciding whether your company is the right fit overall.",
      shows: ["Team and culture content - the why before the what", "Role variety and growth path proof section", "CTA to follow the company on LinkedIn or join a talent community"],
    },
    { id: "demo-careers-job-intent", slug: "demo-careers-job-intent", title: "Demo: Careers - Job Intent",
      what: "Has spent time on a specific job detail page. Interest is focused. Content should support the decision: why this role, why now, why you.",
      shows: ["Role-specific hero with the job title prominent", "Team member quotes about working in this department", "Direct apply CTA with minimal friction"],
    },
    { id: "demo-careers-high-intent", slug: "demo-careers-high-intent", title: "Demo: Careers - High Intent Applicant",
      what: "Strong apply intent signals - returning visits, long time on job page, CTA clicks. They're ready. Get out of their way.",
      shows: ["'You've done your research - here's how to apply' hero", "Application process steps - clear, quick, honest about timeline", "Single prominent Apply button - no distractions"],
    },
    { id: "demo-careers-form-dropoff", slug: "demo-careers-form-dropoff", title: "Demo: Careers - Formulier drop-off",
      what: "Started a job application but didn't finish it. High intent - they were engaged enough to begin filling in the form. Something got in the way: the form was too long, they got distracted, or they weren't quite ready. Re-engage gently, remind them where they left off, and make it easy to pick up where they stopped.",
      shows: ["Empathetic hero: 'Still thinking it over? No rush - your application is waiting'", "Role highlights: remind them why they were interested in the first place", "Single direct CTA back to the application - minimal friction, pre-fill if possible"],
    },
    { id: "demo-careers-submitted", slug: "demo-careers-submitted", title: "Demo: Careers - Application Submitted",
      what: "Submitted an application. The sale is made - now set expectations, reduce anxiety, and start building excitement about joining the team.",
      shows: ["'We've got your application' confirmation hero", "What happens next - timeline, who reviews, when to hear back", "Suggestions for further reading: team blog, culture articles"],
    },
  ] as const).map(({ id, slug, title, what, shows }) =>
    page(id, slug, title, "article-page",
      `${title} - Mister Chameleon careers personalisation demo`,
      `${title} - see how content adapts for candidates at this stage of the hiring journey.`,
      [
        textSec("intro", "text_lead", title.replace("Demo: Careers - ", ""),
          pt(what),
        ),
        featureGrid("shows", "What this demo shows", "feature_grid_checklist",
          shows.map((s) => ({ title: s, description: "" })),
        ),
        ctaSec("cta", "Personalise your own careers site", "Mister Chameleon works for marketing sites and careers pages equally well.", "See pricing", "/pricing"),
      ],
    )
  ),

  // ── DEMO CONTROLS ────────────────────────────────────────────────────────────

  page("demo-controls", "demo-controls", "Scenario Controls", "article-page",
    "Scenario controls - switch visitor profiles live",
    "The Mister Chameleon scenario control panel. Switch between any visitor archetype and watch the page content adapt in real time.",
    [
      // Note: the intro heading + body copy and the enable/disable toggle are
      // rendered directly in app/(site)/demo-controls/page.tsx so that the
      // toggle can be placed precisely between the intro text and the links grid.
      quickLinks("all-scenarios", "All available scenarios", "Click any scenario to activate it in the demo.", [
        { label: "Cold / new visitor", href: "/demo/b2b/new-visitor", description: "Awareness stage - no signals, safe default content" },
        { label: "Consideration stage", href: "/demo/b2b/consideration", description: "Building a shortlist - comparison-focused content" },
        { label: "Trial ready", href: "/demo/b2b/trial-ready", description: "Intent ≥ 50 - push to sign up" },
        { label: "High intent", href: "/demo/b2b/high-intent", description: "Strong funnel signals - maximum directness" },
        { label: "Enterprise prospect", href: "/demo/b2b/enterprise", description: "Company enriched - enterprise framing" },
        { label: "Google campaign", href: "/demo/b2b/paid-search", description: "Paid search arrival - message matches the ad" },
        { label: "Returning visitor", href: "/demo/b2b/returning", description: "Multi-session - deeper content" },
        { label: "Form drop-off", href: "/demo/b2b/form-dropoff", description: "Re-engage without pressure" },
        { label: "Post-conversion", href: "/demo/b2b/converted", description: "Onboarding content for new customers" },
        { label: "Expansion customer", href: "/demo/b2b/expansion", description: "Upgrade nudge for existing customers" },
        { label: "Careers: new visitor", href: "/demo/careers/new-visitor", description: "Employer brand first" },
        { label: "Careers: explorer", href: "/demo/careers/explorer", description: "Culture and team focus" },
        { label: "Careers: job intent", href: "/demo/careers/job-intent", description: "Role-specific content" },
        { label: "Careers: high intent", href: "/demo/careers/high-intent", description: "Direct apply path" },
        { label: "Careers: submitted", href: "/demo/careers/submitted", description: "Post-application onboarding" },
      ]),
    ],
    undefined,
    ["technical", "platform", "features"],
  ),

  // ── PRICING ──────────────────────────────────────────────────────────────────

  page("pricing", "pricing", "Pricing", "marketing-page",
    "Mister Chameleon pricing - Starter, Growth, Pro",
    "Simple, transparent pricing. Start free. Scale as you grow. No hidden fees, no per-seat charges, no engineering costs.",
    [
      textMedia("header-banner", "text_media_right",
        "Pricing that grows with you.",
        "Three plans. One price. No hidden fees.",
        "No per-seat charges, no 'contact sales' gatekeeping, no surprise invoices. Every plan starts with a 14-day free trial - no credit card required. Pick the plan that fits your traffic today and upgrade when you're ready.",
        [{ label: "Start free trial", href: "/order/starter" }, { label: "Compare plans", href: "#plans" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&auto=format&fit=crop&q=80", alt: "Transparent pricing on a screen" },
      ),
      pricingSec("plans", "Choose your plan", "All plans include unlimited users, a 14-day free trial, and GDPR-compliant infrastructure.", [
        {
          _key: "tier-starter", name: "Starter", price: "€149", period: "/month",
          description: "For growing teams who want to start personalising their highest-traffic pages without an engineering project.",
          features: [
            { _key: "f0", label: "25,000 personalised sessions/month" },
            { _key: "f1", label: "Rule-based personalisation engine" },
            { _key: "f2", label: "IP-to-company enrichment" },
            { _key: "f3", label: "Sanity CMS integration" },
            { _key: "f4", label: "Basic analytics dashboard" },
            { _key: "f5", label: "Email support" },
          ],
          ctaLabel: "Start free trial", ctaHref: "/order/starter",
        },
        {
          _key: "tier-growth", name: "Growth", price: "€349", period: "/month",
          description: "For teams who want AI-powered decisions, CRM data, and deeper analytics to optimise their personalisation continuously.",
          highlighted: true, badge: "Most popular",
          features: [
            { _key: "f0", label: "150,000 personalised sessions/month" },
            { _key: "f1", label: "AI-powered decision engine" },
            { _key: "f2", label: "CRM & ABM enrichment (HubSpot, Salesforce)" },
            { _key: "f3", label: "Custom audience segments" },
            { _key: "f4", label: "Full analytics dashboard with funnel" },
            { _key: "f5", label: "A/B & multivariate testing" },
            { _key: "f6", label: "Custom decay profiles" },
            { _key: "f7", label: "Priority email support" },
          ],
          ctaLabel: "Start free trial", ctaHref: "/order/growth",
        },
        {
          _key: "tier-pro", name: "Pro", price: "€749", period: "/month",
          description: "For agencies and enterprise teams managing personalisation across multiple client sites.",
          features: [
            { _key: "f0", label: "500,000 personalised sessions/month" },
            { _key: "f1", label: "All Growth features" },
            { _key: "f2", label: "Multi-site agency mode" },
            { _key: "f3", label: "White-label interface & custom domain" },
            { _key: "f4", label: "Per-client content & analytics isolation" },
            { _key: "f5", label: "SLA & DPA included" },
            { _key: "f6", label: "Priority support + onboarding call" },
          ],
          ctaLabel: "Get started", ctaHref: "/order/pro",
        },
      ], "Annual billing: save 17% on Starter (€124/mo) or 20% on Growth (€279/mo) and Pro (€599/mo). Need more than 500K sessions? Talk to us."),
      logoStrip("trusted-logos", "In good company", [
        { name: "Stackr",           src: "" },
        { name: "Axius Systems",    src: "" },
        { name: "Lumio Group",      src: "" },
        { name: "HubSpot",          src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg" },
        { name: "Pipedrive",        src: "https://cdn.worldvectorlogo.com/logos/pipedrive.svg" },
        { name: "Typeform",         src: "https://cdn.worldvectorlogo.com/logos/typeform.svg" },
      ]),
      faqSec("faq", "Pricing FAQ", [
        { question: "What counts as a personalised session?", answer: "A personalised session is one unique visitor served a personalised experience in a given calendar month. If the same visitor returns five times in April, that counts as one session against your monthly allowance." },
        { question: "What happens if I exceed my session limit?", answer: "Your site keeps working - visitors just see the default content variant instead of a personalised one. You can purchase session top-up bundles (10K, 50K, or 200K) to extend your allowance without upgrading plans." },
        { question: "Can I try before I buy?", answer: "Yes. Every plan starts with a 14-day free trial. No credit card required to start. You only enter payment details when you're ready to continue." },
        { question: "What are enrichment credits?", answer: "Enrichment credits cover API-backed data lookups - company data, weather, CRM matching, and ABM targeting. Each lookup costs one credit. The Starter plan includes basic credits; Growth and Pro include more. You can buy additional packs from €6.50 for 250 credits." },
        { question: "Can I change plans mid-month?", answer: "Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the start of the next billing cycle." },
        { question: "Do you offer a non-profit or startup discount?", answer: "Yes - contact us at hello@misterchameleon.io with your organisation details and we'll discuss options." },
      ]),
      ctaSec("cta", "Not sure which plan is right?", "Book a 20-minute call and we'll tell you exactly which plan fits your traffic and goals.", "Book a call", "/contact"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["pricing", "plan", "cost", "prijs", "abonnement", "budget", "price", "tarieven"],
  ),

  // ── PRICING / ADD-ONS ────────────────────────────────────────────────────────

  page("pricing-add-ons", "pricing-add-ons", "Add-ons & Top-ups", "landing-page",
    "Add-ons & top-ups - Mister Chameleon",
    "Buy extra session credits or enrichment credits without upgrading your plan. Transparent per-unit pricing with no surprises.",
    [
      textSec("intro", "text_lead", "Extra capacity when you need it - not a forced upgrade.",
        pt("Mister Chameleon's add-ons let you extend your capacity without moving to a higher plan. Buy exactly what you need, when you need it."),
      ),
      featureGrid("addons", "Available add-ons", "feature_grid_3up", [
        { title: "Session top-ups", description: "Extra personalised session capacity for busy months or campaigns. Credits never expire. Available in three bundle sizes:\n• 10,000 sessions - €24.90\n• 50,000 sessions - €99 (€1.98/1K)\n• 200,000 sessions - €349 (€1.75/1K)", icon: "users" },
        { title: "Enrichment credits - Starter pack", description: "250 enrichment credits for €6.50 (€0.026/credit). One credit = one enrichment API call (company lookup, weather, CRM match, or ABM check). Good for low-volume or occasional enrichment.", icon: "database" },
        { title: "Enrichment credits - Growth pack", description: "1,000 enrichment credits for €22 (€0.022/credit). Recommended for sites with consistent B2B traffic that benefits from company enrichment on most visits.", icon: "database" },
        { title: "Enrichment credits - Scale pack", description: "5,000 enrichment credits for €99 (€0.020/credit). Best rate - ideal for high-traffic sites or agencies managing multiple client accounts.", icon: "database" },
      ]),
      faqSec("faq", "Add-on FAQ", [
        { question: "Do session top-ups expire?", answer: "No. Purchased session credits never expire and roll over month to month. They are consumed automatically when your personalised sessions exceed your plan's monthly allowance." },
        { question: "Do enrichment credits expire?", answer: "Enrichment credits do not expire as long as your subscription is active." },
        { question: "What is the difference between session credits and enrichment credits?", answer: "Session credits count how many unique visitors receive a personalised experience each month. Enrichment credits pay for the API calls that look up company data, weather, CRM records, and ABM matches. They are separate wallets with separate balances." },
        { question: "Can I automate top-up purchases?", answer: "Yes - the auto-reload feature on Growth and Pro plans can automatically purchase a top-up bundle when your enrichment wallet drops below a threshold you set." },
      ]),
      ctaSec("cta", "Need help choosing the right bundle?", "Our team can recommend the right package based on your traffic volume and enrichment strategy.", "Talk to us", "/contact"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ["pricing", "plan", "cost", "abonnement", "add-ons"],
  ),

  // ── ROI CALCULATOR ───────────────────────────────────────────────────────────

  page("pricing-roi-calculator", "pricing-roi-calculator", "ROI Calculator", "landing-page",
    "ROI calculator - what will personalisation earn you?",
    "Estimate the revenue impact of personalisation for your site. Input your traffic, conversion rate, and average deal size - we'll show you the numbers.",
    [
      textSec("intro", "text_lead", "What's your website currently leaving on the table?",
        pt(
          "Personalisation lifts conversion rates. The question is by how much - and whether the uplift justifies the investment. This calculator uses conservative benchmarks from our customer base to give you a realistic estimate.",
        ),
      ),
      statsSec("benchmarks", "Conservative benchmarks from our customers", [
        { label: "Average lift in lead conversion within 60 days", value: "27", suffix: "%", description: "Across B2B SaaS customers on Growth plan" },
        { label: "Average lift in demo bookings for enterprise segment", value: "41", suffix: "%", description: "When enterprise-enriched visitors see enterprise content" },
        { label: "Average lift in trial starts from paid search", value: "33", suffix: "%", description: "When landing page content matches ad copy exactly" },
        { label: "Typical payback period", value: "6–8", suffix: " weeks" },
      ]),
      featureGrid("formula", "How the calculation works", "feature_grid_3up", [
        { title: "Current monthly visitors", description: "Enter your total monthly unique visitors. This is your starting pool - the traffic personalisation will convert more of.", icon: "users" },
        { title: "Current conversion rate", description: "What percentage of your visitors currently complete your primary goal (trial start, demo booking, contact form). Even a 2% rate is typical for B2B.", icon: "percent" },
        { title: "Average customer value", description: "Your average contract value (ACV) or lifetime value. Combined with the conversion lift, this determines your incremental revenue.", icon: "dollar-sign" },
      ]),
      textMedia("roi-example", "text_media_right",
        "Example calculation",
        "10,000 visitors. 2% conversion. €5,000 ACV.",
        "A conservative 25% lift in conversion brings you from 200 to 250 conversions per month - 50 more per month. If your close rate from trial/demo to customer is 20%, that's 10 extra customers per month. At €5,000 ACV each, that's €50,000 in incremental monthly pipeline from the same traffic. Mister Chameleon Growth is €349/month. At these numbers, that's a 143x ROI.",
        [{ label: "Book a personalised ROI call", href: "/contact" }],
        { type: "image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&auto=format&fit=crop&q=80", alt: "Financial growth chart showing increasing ROI metrics", caption: "Conservative benchmarks from 200+ customer implementations" },
      ),
      formSec("roi-form", "Calculate your ROI", "Enter your numbers and we'll send you a personalised ROI projection based on your actual traffic and conversion data.", "roi-calculator", "Calculate my ROI"),
      ctaSec("cta", "Ready to calculate your own numbers?", "Book a 20-minute call and we'll walk through the calculation with your actual traffic and conversion data.", "Book a call", "/contact"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ["pricing", "cost", "budget", "roi", "calculator"],
  ),

  // ── ORDER ────────────────────────────────────────────────────────────────────

  page("order", "order", "Get Started", "landing-page",
    "Get started - choose your Mister Chameleon plan",
    "Choose a plan and get your first personalised visitor live today. 14-day free trial on every plan. No credit card required to start.",
    [
      textSec("intro", "text_lead", "Pick your plan. Be live in 15 minutes.",
        pt("Every plan starts with a 14-day free trial. No credit card required. Cancel any time."),
      ),
      quickLinks("plans", "Choose your plan", "All plans include unlimited users and GDPR-compliant infrastructure.", [
        { label: "Starter - €149/month", href: "/order/starter", description: "25K sessions/month. Rule-based personalisation. Best for teams getting started." },
        { label: "Growth - €349/month", href: "/order/growth", description: "150K sessions/month. AI decisions, CRM integration, full analytics. Most popular." },
        { label: "Pro / Agency - €749/month", href: "/order/pro", description: "500K sessions/month. Multi-site, white-label, SLA. For agencies and enterprise teams." },
      ]),
      ctaSec("cta", "Not sure which plan fits?", "Our team will help you choose - and we'll tell you honestly if we're not the right fit yet.", "Book a 20-minute call", "/contact"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["pricing", "plan", "abonnement", "order"],
  ),

  // ── ORDER / STARTER ──────────────────────────────────────────────────────────

  page("order-starter", "order/starter", "Order - Starter Plan", "landing-page",
    "Start your Mister Chameleon Starter free trial",
    "Starter plan - 25,000 personalised sessions/month. Start your 14-day free trial. No credit card required.",
    [
      {
        _type: "cartSummary", _key: "cart",
        heading:             "Your order - Starter plan",
        emptyMessage:        "Your cart is empty - pick a plan to continue.",
        checkoutHref:        "/order/starter#checkout",
        continueShoppingHref:"/pricing",
        checkoutLabel:       "Proceed to checkout",
        continueShoppingLabel: "Back to pricing",
        planId:              "starter",
      },
      {
        _type: "checkoutBlock", _key: "checkout",
        heading:         "Create your account",
        intro:           "You're starting a 14-day free trial on the Starter plan (€149/month). No credit card required - you only pay when your trial ends and you choose to continue.",
        paymentProvider: "Stripe",
        returnHref:      "/admin",
        returnLabel:     "Go to your dashboard",
        planId:          "starter",
      },
      featureGrid("starter-reassurance", "What you get on Starter", "feature_grid_3up", [
        { title: "25,000 sessions/month",     description: "Personalised experiences for up to 25,000 unique visitors each calendar month.", icon: "users" },
        { title: "Rule-based engine",          description: "Create personalisation rules based on company, location, device, referrer, and behavioural signals.", icon: "sliders" },
        { title: "14-day free trial",          description: "Full access for 14 days. No credit card needed to start. Cancel any time with one click.", icon: "calendar" },
        { title: "IP-to-company enrichment",   description: "Automatically identify the company behind anonymous visitors and personalise accordingly.", icon: "building" },
        { title: "Sanity CMS integration",     description: "Connect to your Sanity Studio in minutes. Changes in the CMS go live immediately.", icon: "layers" },
        { title: "Email support",              description: "Our team is available via email. Typical response time: same business day.", icon: "mail" },
      ]),
    ],
    undefined,
    ["pricing", "plan", "abonnement", "order"],
  ),

  // ── ORDER / GROWTH ───────────────────────────────────────────────────────────

  page("order-growth", "order/growth", "Order - Growth Plan", "landing-page",
    "Start your Mister Chameleon Growth free trial",
    "Growth plan - 150,000 personalised sessions/month. AI decisions, CRM integration, full analytics. Most popular.",
    [
      {
        _type: "cartSummary", _key: "cart",
        heading:             "Your order - Growth plan",
        emptyMessage:        "Your cart is empty - pick a plan to continue.",
        checkoutHref:        "/order/growth#checkout",
        continueShoppingHref:"/pricing",
        checkoutLabel:       "Proceed to checkout",
        continueShoppingLabel: "Back to pricing",
        planId:              "growth",
      },
      {
        _type: "checkoutBlock", _key: "checkout",
        heading:         "Create your account",
        intro:           "You're starting a 14-day free trial on the Growth plan (€349/month). No credit card required. AI-powered decisions, CRM integration, and full analytics - all included from day one.",
        paymentProvider: "Stripe",
        returnHref:      "/admin",
        returnLabel:     "Go to your dashboard",
        planId:          "growth",
      },
      featureGrid("growth-reassurance", "What you get on Growth", "feature_grid_3up", [
        { title: "150,000 sessions/month",     description: "Personalised experiences for up to 150,000 unique visitors each calendar month.", icon: "users" },
        { title: "AI decision engine",          description: "Machine-learning-powered variant selection - the platform learns which content converts best for each segment.", icon: "cpu" },
        { title: "CRM & ABM enrichment",        description: "Connect HubSpot or Salesforce. Personalise based on CRM stage, deal value, or account-based marketing lists.", icon: "database" },
        { title: "Custom audience segments",    description: "Build unlimited segments from any combination of behavioural, firmographic, and intent signals.", icon: "filter" },
        { title: "A/B & multivariate testing",  description: "Run statistically sound experiments on any page element. Auto-stop on significance.", icon: "git-branch" },
        { title: "Full analytics dashboard",    description: "Funnel visualisation, segment performance, variant lift, and revenue attribution - all in one view.", icon: "bar-chart-2" },
      ]),
    ],
    undefined,
    ["pricing", "plan", "abonnement", "order"],
  ),

  // ── ORDER / PRO ──────────────────────────────────────────────────────────────

  page("order-pro", "order/pro", "Order - Pro Plan", "landing-page",
    "Start your Mister Chameleon Pro free trial",
    "Pro plan - 500,000 personalised sessions/month. Multi-site agency mode, white-label interface, SLA included.",
    [
      {
        _type: "cartSummary", _key: "cart",
        heading:             "Your order - Pro plan",
        emptyMessage:        "Your cart is empty - pick a plan to continue.",
        checkoutHref:        "/order/pro#checkout",
        continueShoppingHref:"/pricing",
        checkoutLabel:       "Proceed to checkout",
        continueShoppingLabel: "Back to pricing",
        planId:              "pro",
      },
      {
        _type: "checkoutBlock", _key: "checkout",
        heading:         "Create your account",
        intro:           "You're starting a 14-day free trial on the Pro plan (€749/month). Everything in Growth, plus unlimited client sites, white-label interface, and SLA - all included from day one.",
        paymentProvider: "Stripe",
        returnHref:      "/admin",
        returnLabel:     "Go to your dashboard",
        planId:          "pro",
      },
      featureGrid("pro-reassurance", "What you get on Pro", "feature_grid_3up", [
        { title: "500,000 sessions/month",     description: "Personalised experiences at scale. Additional session bundles available at preferential rates.", icon: "users" },
        { title: "Unlimited client sites",      description: "Manage personalisation across all your agency clients from a single Pro account. No per-site charges.", icon: "layout" },
        { title: "White-label interface",       description: "Your logo, your colours, your domain. Clients see your product - not Mister Chameleon.", icon: "tag" },
        { title: "Custom domain per client",    description: "Each client gets their own subdomain (e.g. app.yourclient.com). Full branding isolation.", icon: "link" },
        { title: "SLA & DPA included",          description: "99.9% uptime SLA and a Data Processing Agreement included as standard. Enterprise-ready from day one.", icon: "shield" },
        { title: "Priority support + onboarding", description: "Dedicated onboarding call, Slack channel support, and a named customer success contact.", icon: "life-buoy" },
      ]),
    ],
    undefined,
    ["pricing", "plan", "abonnement", "order"],
  ),

]; // end part 2

export const marketingPagesPart3 = [

  // ── USE CASES ────────────────────────────────────────────────────────────────

  page("use-cases-saas", "use-cases-saas", "Use Case: SaaS & Software", "marketing-page",
    "Personalisation for SaaS - Mister Chameleon",
    "Show enterprise prospects your security docs, push trial-ready visitors to sign up, and welcome customers back with onboarding content. All automatically.",
    [
      textSec("intro", "text_lead", "Your SaaS website for every stage of the buyer journey.",
        pt(
          "SaaS buyers are researchers. They'll visit your site four or five times before they talk to anyone - comparing you against three competitors, reading case studies, and double-checking your pricing before they book a demo.",
          "Mister Chameleon makes each of those visits count. A first-timer gets the clear value proposition. A returning visitor gets the deeper technical story. A high-intent visitor gets your strongest CTA. And a known enterprise prospect gets your security and compliance content front and centre.",
        ),
      ),
      featureGrid("scenarios", "Common SaaS personalisation scenarios", "feature_grid_3up", [
        { title: "Enterprise vs. SMB messaging", description: "Visitors from enterprise IPs see SLA details, security certifications, and named reference customers. SMB visitors see speed-to-value, self-serve onboarding, and transparent pricing." },
        { title: "Intent-based CTAs", description: "Low-intent visitors get 'See how it works'. High-intent visitors get 'Start your free trial'. The CTA adapts - so you never ask for too much too soon." },
        { title: "Trial-to-customer nurture", description: "When a trial user visits your marketing site, show them onboarding resources and upgrade prompts instead of acquisition content. Turn passive visitors into active users." },
        { title: "Paid search landing pages", description: "Visitors from Google Ads see a landing page that mirrors the ad they clicked - consistent message, consistent CTA, no bait and switch." },
        { title: "Churn risk re-engagement", description: "When an existing customer with declining engagement visits, surface success stories, new feature announcements, and a direct line to your customer success team." },
        { title: "Competitor comparison", description: "Visitors who arrive via comparison searches (your brand vs. competitor) get a comparison-focused variant with a direct rebuttal of the most common objections." },
      ]),
      testimonialSec("proof", "SaaS teams using Mister Chameleon", [
        { quote: "Our enterprise segment now sees our SOC 2 badge, our named customer logos, and a 'speak to an expert' CTA the moment they land. Demo bookings from that segment are up 41%.", author: "Tom Bakker", role: "VP Marketing", company: "DataBridge" },
        { quote: "We used to have a single 'Start free trial' button on every page. Now it's contextual. Trial starts are up 33% and the trials that start are much higher quality.", author: "Annelies Vos", role: "Growth Lead", company: "Flowdock" },
      ]),
      ctaSec("cta", "See the SaaS demo", "Watch how content adapts across the 10 B2B buyer journey stages.", "Open demo", "/demo"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["use-case", "saas", "software", "solution", "industry"],
  ),

  page("use-cases-ecommerce", "use-cases-ecommerce", "Use Case: E-commerce", "marketing-page",
    "Personalisation for e-commerce - Mister Chameleon",
    "Show returning shoppers their browsed categories, push deal-sensitive visitors to your best offers, and personalise for high-purchase-intent customers.",
    [
      textMedia("header-banner", "text_media_right",
        "Personalise every step of the shopping journey.",
        "Every shopper is different. Your homepage shouldn't be.",
        "From first-time browsers to repeat buyers near checkout, Mister Chameleon adapts your product pages, hero banners, and CTAs to match each visitor's intent - without touching your dev team's sprint.",
        [{ label: "Start free trial", href: "/order/starter" }, { label: "See how it works", href: "/how-it-works" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&auto=format&fit=crop&q=80", alt: "Online shopping experience on a laptop and mobile device" },
      ),
      textSec("intro", "text_lead", "Every shopper is different. Your homepage shouldn't be.",
        pt(
          "The visitor browsing their third pair of running shoes is not the same as the first-timer landing from a Facebook ad. One needs discovery. The other needs a reason to commit.",
          "Mister Chameleon lets you serve the right product focus, the right offer, and the right trust signal to each type of visitor - automatically, without a personalisation engineering project.",
        ),
      ),
      featureGrid("scenarios", "E-commerce personalisation scenarios", "feature_grid_3up", [
        { title: "Deal-sensitive visitors", description: "Visitors who scroll to product pages and then bounce to search for discount codes get a targeted offer before they leave. Keep the conversion on your site." },
        { title: "Category affinity", description: "Return visitors who always browse the same category get that category front and centre - not a generic homepage hero." },
        { title: "High purchase intent", description: "Cart abandoners, wishlist adders, and multi-session browsers near checkout get your strongest trust signals: reviews, returns policy, delivery promise." },
        { title: "New vs. returning", description: "First-time visitors see your brand story and bestsellers. Returning customers see new arrivals and personalised recommendations based on their browse history." },
        { title: "Weather-aware content", description: "Promote outdoor gear on sunny days, cosy homewares when it's cold and wet. Weather-triggered content variants are ready in minutes, not sprints." },
        { title: "Device-optimised messaging", description: "Mobile visitors get tap-friendly CTAs and shorter copy. Desktop visitors get richer product photography and comparison tables." },
      ]),
      ctaSec("cta", "Build your first e-commerce variant", "Start free and have your first personalised product page live today.", "Start free trial", "/order/starter"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["use-case", "ecommerce", "commerce", "shop", "solution"],
  ),

  page("use-cases-recruitment", "use-cases-recruitment", "Use Case: Recruitment & HR", "marketing-page",
    "Personalisation for recruitment websites - Mister Chameleon",
    "Personalise your careers site for every candidate stage: new job seeker, active researcher, high-intent applicant. Fill roles faster.",
    [
      textMedia("header-banner", "text_media_right",
        "Turn every candidate visit into a tailored journey.",
        "Your careers site - personalised for every candidate stage.",
        "Employer brand for explorers. Role-specific content for focused candidates. Zero-friction apply flow for high-intent applicants. Mister Chameleon adapts your careers site automatically - without a separate ATS or careers platform.",
        [{ label: "See the careers demo", href: "/demo/careers/new-visitor" }, { label: "Start free trial", href: "/order/starter" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&auto=format&fit=crop&q=80", alt: "Modern office team meeting, representing employer brand and company culture" },
      ),
      textSec("intro", "text_lead", "Your careers site - personalised for every candidate stage.",
        pt(
          "The candidate casually browsing your employer brand is completely different from the one who's visited your Software Engineer job three times this week. One needs to be inspired. The other needs the application form.",
          "Mister Chameleon's careers site personalisation adapts your content to each stage of the candidate journey - without a separate careers platform.",
        ),
      ),
      featureGrid("scenarios", "Recruitment personalisation scenarios", "feature_grid_3up", [
        { title: "Employer brand for explorers", description: "Candidates in early exploration see culture content, team stories, and values - the why before the what." },
        { title: "Role-specific content for focused candidates", description: "Visitors who've spent time on a specific job page see content tailored to that role: team quotes, day-in-the-life stories, and a prominent apply button." },
        { title: "Frictionless apply for high-intent candidates", description: "Returning candidates with strong apply intent signals get a minimal page: role summary, application steps, and a single CTA. No distractions." },
        { title: "Post-application engagement", description: "Once a candidate has applied, the careers site becomes an onboarding tool: process timeline, team introduction, and what to expect." },
        { title: "Returning passive candidates", description: "Someone who visited six months ago and is back needs a different welcome than a first-timer. Show them what's changed and what's new." },
        { title: "Source-aware messaging", description: "LinkedIn referrals, job board clicks, and direct visits each get content matched to the intent that likely brought them." },
      ]),
      ctaSec("cta", "See the careers demo", "Five candidate scenarios - watch the content adapt at each stage.", "Open careers demo", "/demo/careers/new-visitor"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["use-case", "recruitment", "candidate", "vacatures", "hr", "careers"],
  ),

  page("use-cases-real-estate", "use-cases-real-estate", "Use Case: Real Estate", "marketing-page",
    "Personalisation for real estate websites - Mister Chameleon",
    "Show property browsers the listings they love. Push buyer-intent visitors to request a viewing. Serve investors a yield-focused experience.",
    [
      textMedia("header-banner", "text_media_right",
        "Show every buyer exactly what they're looking for.",
        "Property search is personal. Your website should be too.",
        "First-time buyer, seasoned investor, or city mover - each has different priorities, different content needs, and a different reason to contact you. Mister Chameleon adapts your property site to each of them without touching a line of code.",
        [{ label: "Start free trial", href: "/order/starter" }, { label: "See how it works", href: "/how-it-works" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=900&auto=format&fit=crop&q=80", alt: "Modern residential building exterior representing property search" },
      ),
      textSec("intro", "text_lead", "Property search is personal. Your website should be too.",
        pt(
          "A first-time buyer looking for a starter home has nothing in common with an investor comparing rental yields on commercial properties. They land on the same homepage, but they need completely different things.",
          "Mister Chameleon makes your property website adapt to each visitor - showing the right property type, the right message, and the right call to action for where they are in their journey.",
        ),
      ),
      featureGrid("scenarios", "Real estate personalisation scenarios", "feature_grid_3up", [
        { title: "Property type affinity", description: "Visitors who keep browsing apartments get apartment listings. House hunters get houses. No generic property grid - a personalised shortlist." },
        { title: "Buyer vs. investor messaging", description: "Buyers see lifestyle imagery and emotional copy. Investors see yield data, occupancy rates, and ROI calculators." },
        { title: "Viewing intent", description: "Visitors who've viewed the same listing multiple times get a 'Book a viewing' CTA front and centre - not another scroll through the gallery." },
        { title: "Geographic targeting", description: "Visitors browsing properties in a specific city or neighbourhood see local market insights, neighbourhood guides, and area specialists." },
        { title: "New vs. returning searchers", description: "First-time visitors get an introduction to your portfolio and process. Returning searchers get 'You last looked at… here's what's new nearby.'" },
        { title: "Price range awareness", description: "Behaviour on listing pages reveals price range preferences. The homepage hero can reflect the right price tier without asking." },
      ]),
      ctaSec("cta", "Personalise your property website", "Start free and have your first contextual property hero live today.", "Start free trial", "/order/starter"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["use-case", "property", "real estate", "makelaar"],
  ),

  page("use-cases-agencies", "use-cases-agencies", "Use Case: Digital Agencies", "marketing-page",
    "Mister Chameleon for digital agencies - white-label personalisation",
    "Offer personalisation as a service to your clients. Manage every site from one dashboard. White-label the platform with your agency's branding.",
    [
      textMedia("header-banner", "text_media_right",
        "Add personalisation to every client retainer.",
        "Offer personalisation as a service - without building it yourself.",
        "One platform. Every client site. Your branding on the interface they see. Mister Chameleon Pro gives agencies a white-label personalisation service that's ready to sell - without building infrastructure or managing multiple tool contracts.",
        [{ label: "Talk to us about agency pricing", href: "/contact" }, { label: "Start free trial", href: "/order/starter" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=900&auto=format&fit=crop&q=80", alt: "Agency team reviewing a client website dashboard on large monitors" },
      ),
      textSec("intro", "text_lead", "Offer personalisation as a service - without building it yourself.",
        pt(
          "Your clients are asking about personalisation. The question is whether you build your own tooling, stitch together third-party tools, or use a platform built for exactly this use case.",
          "Mister Chameleon Pro gives your agency one control panel for every client site, with your branding on the interface your clients see. You set the strategy. We handle the infrastructure.",
        ),
      ),
      featureGrid("value", "Why agencies choose Mister Chameleon", "feature_grid_3up", [
        { title: "One platform, every client", description: "Manage all your client sites from a single dashboard. No separate contracts, no tool sprawl, no per-client logins to juggle." },
        { title: "White-label interface", description: "Your logo, your colours, your domain. Clients see your agency's product - not ours. Strengthen your brand with every interaction." },
        { title: "New revenue stream", description: "Package personalisation as a monthly retainer service. Our pricing model makes it straightforward to build a profitable margin on top." },
        { title: "Faster client onboarding", description: "A new client can be live with personalised content in an afternoon. No engineering project, no integration sprint, no waiting three months to show results." },
        { title: "Client-facing analytics", description: "Share a personalisation performance dashboard with each client. Real numbers, real attribution - a conversation starter for every monthly review." },
        { title: "Content managed by the client", description: "Clients who want to manage their own content variants can do so in Sanity Studio without touching your agency's setup. You retain control of the rules and strategy." },
      ]),
      pricingSec("agency-pricing", "Agency pricing", "One Pro plan. Unlimited client sites.", [
        { _key: "tier-pro", name: "Pro", price: "€749", period: "/month", highlighted: true, badge: "Agency mode",
          description: "Everything you need to run personalisation for every client from one platform.",
          features: [
            { _key: "f0", label: "500,000 personalised sessions/month (pooled across clients)" },
            { _key: "f1", label: "Unlimited client sites" },
            { _key: "f2", label: "White-label interface with your branding" },
            { _key: "f3", label: "Per-client analytics isolation" },
            { _key: "f4", label: "Priority support + onboarding call" },
          ],
          ctaLabel: "Talk to us about agency pricing", ctaHref: "/contact",
        },
      ], "Need a custom session pool or volume pricing for 20+ client sites? Let's talk."),
      ctaSec("cta", "Book an agency onboarding call", "We'll show you the white-label setup and answer your questions about client billing.", "Book a call", "/contact"),
    ],
    { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ["use-case", "agency", "services", "white-label", "partnership"],
  ),

  page("cases", "cases", "Case Studies", "listing-page",
    "Customer case studies - Mister Chameleon",
    "Real results from real customers. See how SaaS, e-commerce, recruitment, and agency teams use Mister Chameleon to lift conversion rates.",
    [
      textMedia("header-banner", "text_media_right",
        "Real results from real customers.",
        "No made-up benchmarks. No cherry-picked outliers.",
        "Every case study below is based on a real implementation - real traffic, real variants, real outcomes. We only publish numbers we can back up with data.",
        [{ label: "Start free trial", href: "/order/starter" }, { label: "Talk to us", href: "/contact" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=900&auto=format&fit=crop&q=80", alt: "Team reviewing growth results on a dashboard" },
      ),
      statsSec("global-stats", "Across all our customers", [
        { label: "Average lift in conversion rate", value: "34", suffix: "%" },
        { label: "Average time to first personalised variant", value: "< 1", suffix: " day" },
        { label: "Customer retention rate", value: "94", suffix: "%" },
      ]),
      { _type: "newsList", _key: "cases-list", variant: "cards", heading: "Customer stories", items: [
        { _key: "c0", title: "How Growlytics lifted demo bookings by 41% with intent-based personalisation", href: "/cases/growlytics", description: "A B2B SaaS company with high traffic and low conversion. Here's how they used Mister Chameleon to personalise their hero and proof sections based on visitor intent score - and what happened next.", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", tag: "B2B SaaS" },
        { _key: "c1", title: "JobBridge increased qualified applications by 58% using company enrichment", href: "/cases/jobbridge", description: "A recruitment platform that serves both employers and candidates. See how they used company enrichment to personalise for each audience segment - and reduced time-to-hire across their client base.", imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&auto=format&fit=crop&q=80", tag: "Recruitment" },
        { _key: "c2", title: "Frontline Agency delivered 3x ROI for their clients using white-label personalisation", href: "/cases/frontline-agency", description: "A digital agency that wanted to offer personalisation to all their clients without managing 12 separate tool subscriptions. Here's how they built a white-label personalisation service on Mister Chameleon Pro.", imageUrl: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=600&auto=format&fit=crop&q=80", tag: "Agency" },
      ]},
    ],
    undefined,
    ["cases", "trust", "klanten", "case study", "reviews"],
  ),

  // ── CASE STUDY DETAIL PAGES ───────────────────────────────────────────────────

  page("case-growlytics", "cases/growlytics", "Growlytics: +41% demo bookings with intent-based personalisation", "detail-page",
    "Growlytics case study - 41% more demo bookings with Mister Chameleon",
    "How Growlytics used intent scoring and company enrichment to personalise their website for each visitor type - and lifted demo bookings by 41% in 60 days.",
    [
      articleMeta("meta", "How Growlytics lifted demo bookings by 41% with intent-based personalisation", "2026-02-20", { name: "Lucas van den Berg", role: "Co-founder & CEO", avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80" }, "Case Study", 6, "Growlytics is a B2B SaaS platform for revenue operations teams. With strong traffic and a well-designed website, they were still struggling to convert visitors into demo bookings. Here's what changed.", "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80", ["B2B SaaS", "demo bookings", "intent scoring"]),
      statsSec("results", "Results at 60 days", [
        { label: "Increase in demo bookings", value: "41", suffix: "%" },
        { label: "Improvement in time-on-site for high-intent visitors", value: "28", suffix: "%" },
        { label: "Reduction in demo no-shows (from intent-matched booking)", value: "33", suffix: "%" },
      ]),
      articleBody("body", pt(
        "Growlytics is a revenue operations platform for B2B SaaS teams. They had healthy traffic from SEO and paid channels - but a conversion rate of 1.4% from visit to demo booking. The team knew their content was strong. The problem was that it was the same content for everyone.",
        "The challenge: a CRO leader from a 500-person company visiting for the second time this week needs different content from a solo founder who found them on Google for the first time. Showing them the same hero, the same social proof, and the same CTA wasn't just inefficient - it was actively hurting the conversion rate.",
        "The approach: Growlytics used Mister Chameleon to build three content tracks, each tied to an audience segment: Track 1 (Intent score < 40): educational hero, 'how it works' proof, soft 'start a free trial' CTA. Track 2 (Intent score 40-70): social proof-led hero, ROI stats, 'book a demo' CTA. Track 3 (Intent score > 70 OR enterprise company enrichment): personalised hero referencing their industry, enterprise case study, 'talk to sales' CTA.",
        "The result: within 30 days, Growlytics saw a 22% lift in demo bookings. By day 60, it was 41%. The no-show rate for demo calls also dropped by 33% - because visitors who booked from the high-intent content were genuinely ready to have that conversation.",
        "What made it work: the combination of intent scoring (who is ready to buy) and company enrichment (who are they) gave Growlytics enough signal to personalise meaningfully without requiring any form fills or cookie consent. The setup took one afternoon. The results have been compounding ever since.",
      )),
      relatedContent("related", "More customer stories", [
        { title: "JobBridge: +58% qualified applications with company enrichment", href: "/cases/jobbridge", image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&auto=format&fit=crop&q=80", description: "A recruitment platform that personalised for employers and candidates separately." },
        { title: "Frontline Agency: 3x ROI for clients with white-label personalisation", href: "/cases/frontline-agency", image: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=400&auto=format&fit=crop&q=80", description: "How a digital agency built a personalisation service on Mister Chameleon Pro." },
        { title: "Why 97% of your website traffic leaves without converting", href: "/blog/why-97-percent-traffic-leaves", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "Generic websites are built for nobody. Here's the data on what personalisation actually does for conversion rates." },
      ]),
    ],
    undefined,
    ["cases", "trust", "case study", "klanten"],
  ),

  page("case-jobbridge", "cases/jobbridge", "JobBridge: +58% qualified applications using company enrichment", "detail-page",
    "JobBridge case study - 58% more qualified applications with Mister Chameleon",
    "A recruitment platform that used company enrichment to personalise separately for employers and candidates - and reduced time-to-hire across their client base.",
    [
      articleMeta("meta", "JobBridge increased qualified applications by 58% using company enrichment", "2026-03-05", { name: "Daan Visser", role: "Head of Product", avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80" }, "Case Study", 7, "JobBridge is a recruitment platform serving both employers and job seekers. See how they used Mister Chameleon to serve personalised experiences to each audience.", "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&auto=format&fit=crop&q=80", ["recruitment", "company enrichment", "B2B"]),
      statsSec("results", "Results at 90 days", [
        { label: "Increase in qualified applications", value: "58", suffix: "%" },
        { label: "Reduction in employer churn (first 90 days)", value: "22", suffix: "%" },
        { label: "Improvement in employer-to-job-seeker conversion", value: "31", suffix: "%" },
      ]),
      articleBody("body", pt(
        "JobBridge is a recruitment platform that serves both sides of the hiring equation: employers posting roles, and job seekers looking for opportunities. Their homepage had a fundamental problem: it needed to appeal to both audiences - and was therefore perfectly suited to neither.",
        "The approach: using Mister Chameleon's company enrichment to identify corporate network visitors (likely employers), and behavioural signals to identify job seekers (visiting job listing pages, scrolling through role descriptions), JobBridge built two completely different homepage experiences.",
        "Employer track: hero focused on 'Find candidates 3x faster', proof section with hiring manager testimonials, direct 'Post your first role free' CTA. Job seeker track: hero focused on 'Find a role that fits', proof section with successful placement stories, 'See open roles' CTA.",
        "The result: qualified applications increased by 58% within 90 days. Employer churn in the first 90 days dropped by 22%. And the conversion from employer sign-up to first job posting increased by 31%.",
        "The key insight from JobBridge's case: personalisation doesn't have to be subtle. Sometimes the right move is to show completely different content to completely different people. The engine makes this possible without any code changes after the initial setup.",
      )),
      relatedContent("related", "More customer stories", [
        { title: "Growlytics: +41% demo bookings with intent-based personalisation", href: "/cases/growlytics", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "How a B2B SaaS company used intent scoring to fill their pipeline from existing traffic." },
        { title: "Frontline Agency: 3x ROI for clients with white-label personalisation", href: "/cases/frontline-agency", image: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=400&auto=format&fit=crop&q=80", description: "How a digital agency built a personalisation service on Mister Chameleon Pro." },
        { title: "Intent scoring explained: how to know which visitors are ready to buy", href: "/blog/intent-scoring-explained", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=80", description: "A 0-100 number that tells you exactly how close each visitor is to converting." },
      ]),
    ],
    undefined,
    ["cases", "trust", "case study", "klanten"],
  ),

  page("case-frontline-agency", "cases/frontline-agency", "Frontline Agency: 3x ROI for clients with white-label personalisation", "detail-page",
    "Frontline Agency case study - 3x ROI with Mister Chameleon white-label",
    "How a digital agency used Mister Chameleon Pro to deliver personalisation-as-a-service across 12 client sites - under their own brand.",
    [
      articleMeta("meta", "Frontline Agency delivered 3x ROI for their clients using white-label personalisation", "2026-04-02", { name: "Thomas Kramer", role: "Growth & Partnerships", avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&auto=format&fit=crop&q=80" }, "Case Study", 6, "Frontline Agency is a Dutch digital agency that wanted to offer personalisation to all their clients under their own brand - without 12 separate tool subscriptions.", "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=1200&auto=format&fit=crop&q=80", ["agency", "white-label", "Pro"]),
      statsSec("results", "Across 12 client sites at 6 months", [
        { label: "Average ROI delivered to clients", value: "3x" },
        { label: "New service revenue for Frontline", value: "+€48K", suffix: "/year" },
        { label: "Client sites running personalisation", value: "12" },
      ]),
      articleBody("body", pt(
        "Frontline is a digital agency based in Rotterdam. They build and maintain websites for 20+ clients across B2B SaaS, e-commerce, and professional services. In early 2026, they wanted to add personalisation to their service offering - but didn't want to resell a tool their clients would see as a separate product.",
        "The solution: Mister Chameleon Pro's white-label mode. Frontline rebranded the admin interface with their own logo and colours, set up a custom domain (app.frontlineplatform.nl), and gave each client their own isolated environment within a single Pro subscription.",
        "From the client's perspective, they were using a Frontline product. From Frontline's perspective, they were charging each client a monthly retainer for 'adaptive website management' - a service they could now deliver without custom code on every engagement.",
        "The economics: Frontline's Pro subscription costs €749/month. They onboarded 12 clients at an average retainer of €350/month per client. Monthly service revenue from personalisation alone: €4,200. Annual: €50,400. Net of the Pro subscription: €39,492/year. And the clients are seeing results - an average of 3x ROI based on conversion improvements measured over six months.",
        "What made it work: the white-label interface meant Frontline's relationship with their clients stayed intact. Clients weren't aware of the underlying platform - they just saw better conversion numbers and a polished tool they could use to understand what was happening.",
      )),
      relatedContent("related", "More customer stories", [
        { title: "Growlytics: +41% demo bookings with intent-based personalisation", href: "/cases/growlytics", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "How a B2B SaaS company used intent scoring to fill their pipeline from existing traffic." },
        { title: "JobBridge: +58% qualified applications with company enrichment", href: "/cases/jobbridge", image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&auto=format&fit=crop&q=80", description: "A recruitment platform that personalised separately for employers and job seekers." },
        { title: "The complete guide to IP-to-company enrichment for B2B websites", href: "/blog/ip-to-company-enrichment-guide", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&auto=format&fit=crop&q=80", description: "Turn anonymous visitors into known company profiles - without cookies or GDPR issues." },
      ]),
    ],
    undefined,
    ["cases", "trust", "case study", "klanten"],
  ),

  // ── RESOURCES ────────────────────────────────────────────────────────────────

  page("blog", "blog", "Blog", "listing-page",
    "Mister Chameleon blog - personalisation, conversion, and growth",
    "Practical articles on website personalisation, conversion rate optimisation, intent scoring, and B2B growth strategy.",
    [
      // 1. Hero — editorial voice, no fluff
      textMedia("hero", "text_media_right",
        "Practical thinking on personalisation and growth.",
        "No AI filler. No content for content's sake.",
        "We write about what we know: adaptive websites, conversion rate optimisation, intent scoring, and the reality of B2B marketing. Every article is written by practitioners who use these tools every day - and includes the numbers to back it up.",
        [{ label: "Subscribe to updates", href: "/contact" }, { label: "Explore the platform", href: "/features" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=900&auto=format&fit=crop&q=80", alt: "Person writing at a laptop in a quiet, focused environment" },
      ),

      // 2. Featured article — give the best piece its own spotlight
      textMedia("featured", "text_media_left",
        "Most read",
        "Why 97% of your website traffic leaves without converting.",
        "Generic websites are built for a fictional average visitor. No real visitor is average. The companies growing fastest from their existing traffic are the ones who figured that out - and started serving the right message to the right person at the right moment. Here's the data.",
        [{ label: "Read the article", href: "/blog/why-97-percent-traffic-leaves" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80", alt: "Analytics chart showing website conversion rate drop-off", caption: "8 min read - Conversion - Lucas van den Berg, Co-founder" },
      ),

      // 3. All articles — card grid
      { _type: "newsList", _key: "posts", variant: "cards", heading: "All articles", items: [
        { _key: "p0", title: "Why 97% of your website traffic leaves without converting - and what to do about it", href: "/blog/why-97-percent-traffic-leaves", description: "Generic websites are built for nobody. Here's the data on what personalisation actually does for conversion rates.", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", tag: "Conversion" },
        { _key: "p1", title: "Intent scoring explained: how to know which visitors are ready to buy", href: "/blog/intent-scoring-explained", description: "A 0-100 number that tells you exactly how close each visitor is to converting. Here is how it works and how to use it.", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", tag: "Intent" },
        { _key: "p2", title: "The complete guide to IP-to-company enrichment for B2B websites", href: "/blog/ip-to-company-enrichment-guide", description: "How to turn anonymous visitors into known company profiles - without cookies, without forms, and without violating GDPR.", imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&auto=format&fit=crop&q=80", tag: "Enrichment" },
      ]},

      // 4. Topic categories — help readers find what's relevant
      quickLinks("topics", "Browse by topic", "We cover every layer of the personalisation stack - from the business case to the technical how-to.", [
        { label: "Conversion", href: "/blog/why-97-percent-traffic-leaves", description: "The business case for personalisation: why generic websites underperform and what the data says about fixing them." },
        { label: "Intent scoring", href: "/blog/intent-scoring-explained", description: "How to know which visitors are ready to buy - and how to use that signal to serve the right content automatically." },
        { label: "Enrichment", href: "/blog/ip-to-company-enrichment-guide", description: "Turning anonymous IP addresses into company profiles: how it works, what data you get, and how to use it safely." },
        { label: "Case studies", href: "/cases", description: "Real results from real customers: conversion lifts, pipeline growth, and ROI from adaptive personalisation." },
        { label: "Platform deep-dives", href: "/features", description: "How the Mister Chameleon platform works under the hood - decision engine, signals, rules, and CMS integration." },
        { label: "Agency and white-label", href: "/features-agency", description: "How digital agencies are building personalisation as a service on top of Mister Chameleon Pro." },
      ]),

      // 5. Meet the authors — human editorial credibility
      teamSec("authors", "Written by practitioners", "Every article on this blog is written by someone who works with personalisation tools every day - not a content team optimising for SEO.", [
        {
          name: "Lucas van den Berg",
          role: "Co-founder & CEO",
          bio: "Lucas writes about the business case for personalisation, conversion strategy, and what B2B marketing teams get wrong about their websites. He has spoken at SaaStr, MicroConf, and B2B Growth Summit.",
          imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
        },
        {
          name: "Noa Bakker",
          role: "Co-founder & CTO",
          bio: "Noa writes about intent scoring, enrichment, the decision engine, and the technical reality of building personalisation infrastructure. She believes most personalisation tools are too simple.",
          imageUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
        },
        {
          name: "Daan Visser",
          role: "Head of Product",
          bio: "Daan writes about enrichment, GDPR, data privacy, and how to build personalisation stacks that your legal team will actually sign off on. He spent five years in data engineering before joining the product side.",
          imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
        },
      ]),

      // 6. Newsletter — soft conversion before the platform CTA
      textMedia("newsletter", "text_media_right",
        "Stay sharp",
        "New articles, case studies, and platform updates - straight to your inbox.",
        "We publish two to three articles per month. No newsletters padded with industry news you've already seen. Just practical thinking on personalisation, conversion, and B2B growth - from people building in this space every day.",
        [{ label: "Subscribe via contact form", href: "/contact" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=900&auto=format&fit=crop&q=80", alt: "Inbox on a laptop screen showing a newsletter", caption: "No spam. Unsubscribe any time." },
      ),

      // 7. From articles to platform — bridge to conversion
      featureGrid("from-reading-to-doing", "From reading to doing", "feature_grid_3up", [
        { title: "Try the live demo", description: "Simulate any visitor profile and watch the page adapt in real time. No sign-up required. See intent scoring, enrichment, and variant selection working together.", icon: "play-circle" },
        { title: "Start a free trial", description: "Go live with your first personalisation rule in under 15 minutes. Free trial, no credit card, no engineering sprint required.", icon: "zap" },
        { title: "Read the case studies", description: "See how Growlytics, JobBridge, and Frontline Agency lifted conversion rates by 41-58% using the same platform you just read about.", icon: "book-open" },
      ], { label: "Explore the platform", href: "/features" }),

      // 8. CTA
      ctaSec("cta", "Ready to turn these ideas into results?", "Start your free trial and see personalisation working on your actual website - not just in a blog post.", "Start free trial", "/order/starter"),
    ],
    undefined,
    ["personalisation", "conversion", "platform"],
  ),

  // ── BLOG DETAIL PAGES ─────────────────────────────────────────────────────────

  page("blog-why-traffic-leaves", "blog/why-97-percent-traffic-leaves", "Why 97% of your website traffic leaves without converting", "detail-page",
    "Why 97% of website traffic leaves without converting - Mister Chameleon blog",
    "Generic websites are built for nobody. Here's the data on what website personalisation actually does for conversion rates, pipeline, and revenue.",
    [
      articleMeta("meta", "Why 97% of your website traffic leaves without converting - and what to do about it", "2026-03-15", { name: "Lucas van den Berg", role: "Co-founder & CEO", avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80" }, "Conversion", 8, "Generic websites are built for nobody. Here's the data on what website personalisation actually does for conversion rates, pipeline, and revenue.", "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80", ["personalisation", "conversion", "cro"]),
      articleBody("body", pt(
        "The average B2B website converts between 1% and 3% of its visitors. That means 97 out of every 100 people who found you, clicked through to your site, and spent time reading your content - left without doing anything you wanted them to do.",
        "This is treated as a fact of life. A benchmark. Something you try to nudge up with better copy, faster load times, or a new hero image. And those things help, at the margins. But they don't address the root cause.",
        "The root cause is this: your website was built for one person. A hypothetical average visitor. And no real visitor is average.",
        "A first-time visitor from Google who searched 'website personalisation software' is in a completely different headspace from a CFO who visited your pricing page three times last week and is now back again. They need different things. They respond to different proof. They're at different stages of a completely different decision process.",
        "Showing them both the same headline, the same social proof, and the same call to action isn't neutral. It's actively working against you - because the message that's right for one of them is wrong for the other.",
        "The companies that have figured this out - that match their message to the moment rather than serving a lowest-common-denominator experience - are seeing conversion lifts of 25-40% from the same traffic. Not from more ads. Not from a website redesign. From showing the right variant of their existing content to the right visitor at the right time.",
        "That's what Mister Chameleon does. And it's why we built it.",
      )),
      relatedContent("related", "Related articles", [
        { title: "Intent scoring explained: how to know which visitors are ready to buy", href: "/blog/intent-scoring-explained", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=80", description: "A 0-100 number that tells you exactly how close each visitor is to converting." },
        { title: "The complete guide to IP-to-company enrichment for B2B websites", href: "/blog/ip-to-company-enrichment-guide", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&auto=format&fit=crop&q=80", description: "Turn anonymous visitors into known company profiles - without cookies or forms." },
        { title: "Why personalisation?", href: "/why-personalisation", image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80", description: "The business case for adaptive websites - the data, the argument, and the common questions." },
      ]),
      relatedContent("customer-stories", "Customer stories", [
        { title: "Growlytics: +41% demo bookings with intent-based personalisation", href: "/cases/growlytics", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "How a B2B SaaS company used intent scoring to fill their pipeline from existing traffic." },
        { title: "JobBridge: +58% qualified applications with company enrichment", href: "/cases/jobbridge", image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&auto=format&fit=crop&q=80", description: "A recruitment platform that personalised for employers and candidates separately." },
        { title: "Frontline Agency: 3x ROI for clients with white-label personalisation", href: "/cases/frontline-agency", image: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=400&auto=format&fit=crop&q=80", description: "How a digital agency built a personalisation service on Mister Chameleon Pro." },
      ]),
    ],
    undefined,
    ["personalisation", "conversion", "use-case"],
  ),

  page("blog-intent-scoring-explained", "blog/intent-scoring-explained", "Intent scoring explained: how to know which visitors are ready to buy", "detail-page",
    "Intent scoring explained - Mister Chameleon blog",
    "A 0-100 number that tells you exactly how close each visitor is to converting. Here's how intent scoring works and how to use it in your personalisation strategy.",
    [
      articleMeta("meta", "Intent scoring explained: how to know which visitors are ready to buy", "2026-03-28", { name: "Noa Bakker", role: "Co-founder & CTO", avatarUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&auto=format&fit=crop&q=80" }, "Intent", 10, "A 0-100 number that tells you exactly how close each visitor is to converting. Here's how intent scoring works.", "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80", ["intent scoring", "personalisation", "behavioural data"]),
      articleBody("body", pt(
        "Intent scoring is the practice of assigning a numerical value - typically 0 to 100 - to each visitor on your website based on the signals they've given you. A score of 90 means 'this person is very likely to convert soon'. A score of 10 means 'this person just arrived and we don't know much yet'.",
        "Done well, intent scoring lets you personalise with precision. You don't need to guess whether a visitor is worth showing your enterprise case study or your starter plan. The score tells you.",
        "The challenge is that most scoring implementations are too simple. They count page visits and call it a day. Real intent is more nuanced than that.",
        "At Mister Chameleon, the intent engine combines six categories of signal: page visit patterns (what pages, in what order, how many times), time and recency (when did they last visit, how long did they stay), CTA engagement (did they click a pricing link, a demo CTA, a contact button), form behaviour (did they start a form, even without submitting), company enrichment (enterprise visitors score higher by default, target accounts score even higher), and session depth (total sessions, pages per session, time on site).",
        "These are combined using a weighted model to produce a single 0-100 score that updates on every page load. When a visitor's score crosses 60, we consider them high-intent. When it crosses 80, they're in the 'ready to convert' zone.",
        "The practical application: visitors with intent scores below 30 see awareness-level content - 'how it works', 'why personalisation'. Visitors between 30 and 60 see proof-oriented content - case studies, stats, testimonials. Visitors above 60 see conversion-focused content - pricing, a direct trial CTA, or a demo booking prompt. This alone - matching content tier to intent tier - is responsible for most of the conversion lift our customers see.",
        "The key insight is that intent scoring isn't a feature. It's an input. Its value comes from what you do with it - and that's where the personalisation engine takes over.",
      )),
      relatedContent("related", "Related articles", [
        { title: "Why 97% of your website traffic leaves without converting", href: "/blog/why-97-percent-traffic-leaves", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "Generic websites are built for nobody. The data on what personalisation does for conversion." },
        { title: "The complete guide to IP-to-company enrichment for B2B websites", href: "/blog/ip-to-company-enrichment-guide", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&auto=format&fit=crop&q=80", description: "Turn anonymous visitors into known company profiles - without cookies or forms." },
        { title: "Growlytics: +41% demo bookings with intent-based personalisation", href: "/cases/growlytics", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "How a B2B SaaS company put intent scoring into practice - and lifted demo bookings by 41% in 60 days." },
      ]),
      relatedContent("customer-stories", "Customer stories", [
        { title: "Growlytics: +41% demo bookings with intent-based personalisation", href: "/cases/growlytics", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "How a B2B SaaS company used intent scoring to fill their pipeline from existing traffic." },
        { title: "JobBridge: +58% qualified applications with company enrichment", href: "/cases/jobbridge", image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&auto=format&fit=crop&q=80", description: "A recruitment platform that personalised for employers and candidates separately." },
        { title: "Frontline Agency: 3x ROI for clients with white-label personalisation", href: "/cases/frontline-agency", image: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=400&auto=format&fit=crop&q=80", description: "How a digital agency built a personalisation service on Mister Chameleon Pro." },
      ]),
    ],
    undefined,
    ["features", "technical", "intent", "scoring"],
  ),

  page("blog-enrichment-guide", "blog/ip-to-company-enrichment-guide", "The complete guide to IP-to-company enrichment for B2B websites", "detail-page",
    "IP-to-company enrichment guide for B2B websites - Mister Chameleon blog",
    "How to turn anonymous visitors into known company profiles - without cookies, without forms, and without violating GDPR. A practical guide to IP enrichment.",
    [
      articleMeta("meta", "The complete guide to IP-to-company enrichment for B2B websites", "2026-04-08", { name: "Daan Visser", role: "Head of Product", avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80" }, "Enrichment", 12, "How to turn anonymous visitors into known company profiles - without cookies, forms, or GDPR issues.", "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&auto=format&fit=crop&q=80", ["ip enrichment", "B2B", "GDPR", "personalisation"]),
      articleBody("body", pt(
        "Every day, hundreds of companies visit your website. You don't know they're there. You can't see their name in your analytics. They leave, and if they don't convert, they're gone - and you have no idea who they were.",
        "IP-to-company enrichment changes this. When a visitor arrives from a recognisable corporate network, their IP address can be resolved to the company that owns it. That gives you - in real time, before the page even finishes loading - the company name, industry, size, and type.",
        "With this data, you can personalise immediately. An enterprise software company visiting your pricing page sees the enterprise case study and the security certifications. A 10-person startup sees the Starter plan and the fast-setup messaging. Without enrichment, they both see the same thing.",
        "How accurate is it? Enterprise companies on corporate networks match at 80-90%. SMBs and remote workers on residential or VPN connections match at lower rates - often 30-50%. This is fine. Even a 50% match rate means half your traffic suddenly has context attached to it.",
        "Is it GDPR compliant? Yes - with caveats. IP-to-company enrichment resolves to a company, not an individual. It's treated as business data, not personal data, under most EU legal interpretations. You should disclose it in your privacy policy. But you don't need a consent banner for it.",
        "How to implement it: with Mister Chameleon, enrichment is fully automatic. You install the snippet, and enrichment runs asynchronously on every request. You don't need to configure anything beyond specifying your data region. Match results are available to the decision engine within the same page load.",
        "The most important thing to understand about IP enrichment is that it's not a silver bullet - it's an input. It's most powerful when combined with behavioural signals (page history, CTA clicks, form interactions) and intent scoring. Together, these give you a complete picture of who's on your site and what they need from you.",
      )),
      relatedContent("related", "Related articles", [
        { title: "Why 97% of your website traffic leaves without converting", href: "/blog/why-97-percent-traffic-leaves", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "Generic websites are built for nobody. The data on what personalisation does for conversion." },
        { title: "Intent scoring explained: how to know which visitors are ready to buy", href: "/blog/intent-scoring-explained", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=80", description: "How to combine enrichment with behavioural scoring to know which visitors are ready to buy." },
        { title: "JobBridge: +58% qualified applications with company enrichment", href: "/cases/jobbridge", image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&auto=format&fit=crop&q=80", description: "A recruitment platform that used IP enrichment to personalise for employers and job seekers - and lifted qualified applications by 58%." },
      ]),
      relatedContent("customer-stories", "Customer stories", [
        { title: "Growlytics: +41% demo bookings with intent-based personalisation", href: "/cases/growlytics", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80", description: "How a B2B SaaS company used intent scoring to fill their pipeline from existing traffic." },
        { title: "JobBridge: +58% qualified applications with company enrichment", href: "/cases/jobbridge", image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&auto=format&fit=crop&q=80", description: "A recruitment platform that personalised for employers and candidates separately." },
        { title: "Frontline Agency: 3x ROI for clients with white-label personalisation", href: "/cases/frontline-agency", image: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=400&auto=format&fit=crop&q=80", description: "How a digital agency built a personalisation service on Mister Chameleon Pro." },
      ]),
    ],
    undefined,
    ["features", "technical", "api", "integratie"],
  ),

  page("docs", "docs", "Documentation", "article-page",
    "Mister Chameleon documentation - quick start, install, API reference",
    "Everything you need to set up, configure, and extend Mister Chameleon. Quick start guide, snippet install, API reference, and integration docs.",
    [
      textMedia("header-banner", "text_media_right",
        "Up and running in 15 minutes.",
        "Documentation written for the person doing the work.",
        "Clear, practical, example-driven. If something is unclear, tell us and we'll fix it. Our docs are updated with every platform release.",
        [{ label: "Quick start guide", href: "#quickstart" }, { label: "API reference", href: "/docs/api" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1542903660-eedba2cda584?w=900&auto=format&fit=crop&q=80", alt: "Developer reading documentation on a laptop" },
      ),
      quickLinks("sections", "Documentation sections", "Find what you need.", [
        { label: "Quick start", href: "/docs/quickstart", description: "Add the snippet, create your first variant, and see it live." },
        { label: "Install the snippet", href: "/docs/install", description: "One script tag. Works with any site - Next.js, Webflow, WordPress, or static HTML." },
        { label: "Create content variants", href: "/docs/variants", description: "How to create hero, proof, CTA, and feature variants in Sanity Studio." },
        { label: "Build personalisation rules", href: "/docs/rules", description: "Write rules that target visitors by intent score, company, source, behaviour, and more." },
        { label: "API reference", href: "/docs/api", description: "Full reference for the Mister Chameleon API - variant resolution, session events, and analytics." },
        { label: "Integrations", href: "/docs/integrations", description: "Setup guides for HubSpot, Salesforce, Segment, and Supabase." },
      ]),
      processSec("quickstart", "Quick start guide", [
        { title: "Step 1: Add the snippet", description: "Copy and paste one script tag into your website's <head>. Works with Next.js, Webflow, WordPress, Squarespace, and any static HTML site. The snippet is asynchronous - it won't slow down your page load.", duration: "2 minutes" },
        { title: "Step 2: Connect your Supabase database", description: "Mister Chameleon stores all behavioural data in your own Supabase database. Create a project (free tier works for getting started), run our migration script, and paste your connection string into the admin settings.", duration: "5 minutes" },
        { title: "Step 3: Create your first content variant", description: "Open Sanity Studio and navigate to your page. You'll see a 'Content variants' section next to each block. Click 'Add variant', write your alternative headline, and save. That's your first personalised version.", duration: "5 minutes" },
        { title: "Step 4: Write your first personalisation rule", description: "In the admin dashboard, go to Rules > New rule. Select your trigger (e.g. 'Intent score > 60') and your target (e.g. 'Hero - High intent variant'). Save and activate. The engine will start applying it on the next page load.", duration: "3 minutes" },
        { title: "Step 5: Verify it's working", description: "Use the Scenario Simulator (Dashboard > Simulate) to test your rule. Select a visitor profile, navigate to the page, and confirm you see the personalised variant. Check the analytics dashboard for your first session data.", duration: "2 minutes" },
      ]),
      faqSec("docs-faq", "Common setup questions", [
        { question: "Which CMS platforms are supported?", answer: "Mister Chameleon works with Sanity (native), Storyblok, and Statamic out of the box. For other CMS platforms (WordPress, Contentful, etc.), you can use our API to fetch and cache variant content server-side. Full documentation in the Integrations section." },
        { question: "Do I need to self-host anything?", answer: "No. The Mister Chameleon platform is fully managed. The only infrastructure you provide is a Supabase database (free tier available) for storing your visitor data in your own account. Everything else - the decision engine, the admin interface, the APIs - is hosted by us." },
        { question: "What happens if the Mister Chameleon service is unavailable?", answer: "Your website continues to work normally. The decision engine is designed to fail gracefully: if it cannot resolve a variant decision, it serves the default content. Your site never goes down due to a personalisation service outage." },
        { question: "Can I use Mister Chameleon with a headless CMS?", answer: "Yes. Mister Chameleon is designed to work alongside any headless CMS. Variant content can be fetched from your CMS at build time and selected by the engine at request time - no client-side JavaScript required for the decision logic." },
      ]),
      ctaSec("cta", "Something missing from the docs?", "Tell us what you need. We write what our customers actually ask for.", "Contact us", "/contact"),
    ],
    undefined,
    ["docs", "documentatie", "technical", "api", "developer"],
  ),

  page("faq", "faq", "FAQ", "landing-page",
    "Frequently asked questions - Mister Chameleon",
    "Answers to the most common questions about Mister Chameleon: setup, pricing, GDPR, enrichment, sessions, and more.",
    [
      textSec("intro", "text_single", "Frequently asked questions", pt("Everything we get asked most often - answered honestly.")),
      faqSec("general", "Getting started", [
        { question: "How long does setup take?", answer: "Most teams are live with their first personalised variant within an afternoon. You add one script tag to your site, create a variant in Sanity Studio, and write a rule that targets a visitor segment. The whole process takes 15–60 minutes depending on how much content you want to personalise on day one." },
        { question: "Do I need a developer to set up Mister Chameleon?", answer: "For the initial snippet install, yes - it's one script tag, which any developer can add in minutes. After that, marketing teams can create and manage content variants, build personalisation rules, and read analytics without any developer involvement." },
        { question: "Does Mister Chameleon work with my existing website?", answer: "Yes. Mister Chameleon is CMS-agnostic and framework-agnostic for the personalisation layer. Your existing website continues to work exactly as it does today - Mister Chameleon layers personalisation on top of it." },
      ]),
      faqSec("privacy", "Privacy & GDPR", [
        { question: "Is Mister Chameleon GDPR compliant?", answer: "Yes. We use first-party session data, IP-to-company enrichment (which resolves to business entities, not individuals), and no third-party cookies. We offer a Data Processing Agreement for all paying customers." },
        { question: "Do I need to update my cookie banner?", answer: "In most cases, no. The mc_session_id cookie is a functional first-party cookie necessary for the service. We recommend disclosing it in your cookie policy as a transparency measure. Consult your legal team for your specific jurisdiction." },
        { question: "Where is visitor data stored?", answer: "In your own Supabase database, in a region you choose. We never store your visitors' data on Mister Chameleon infrastructure." },
      ]),
      faqSec("billing", "Billing & plans", [
        { question: "What is a personalised session?", answer: "One unique visitor served a personalised experience in a calendar month. If the same visitor returns five times, it counts as one session. The monthly counter resets on the first of each month." },
        { question: "What happens when I exceed my session limit?", answer: "Visitors continue to see your website - they just receive the default (non-personalised) content instead of a personalised variant. You can purchase session top-up bundles to extend your allowance without upgrading." },
        { question: "Can I cancel any time?", answer: "Yes. Cancel from your billing settings at any time. You keep access until the end of your paid period. No penalties, no lock-in." },
      ]),
    ],
    { "proof": { fallbackVariantKey: "proof_platform" } },
    ["support", "trust", "pricing", "features", "diensten"],
  ),

  page("changelog", "changelog", "Changelog", "article-page",
    "Mister Chameleon changelog - what's new",
    "A complete history of every product update, bug fix, and new feature - in plain language.",
    [
      textSec("intro", "text_lead", "What's new in Mister Chameleon.",
        pt("We ship improvements every week. Here's everything that's changed, in reverse chronological order. Plain language - no marketing speak."),
      ),
    ],
    undefined,
    ["features", "platform", "product"],
  ),

  page("glossary", "glossary", "Glossary", "article-page",
    "Mister Chameleon glossary - personalisation terms explained",
    "Plain-language definitions of the terms used in Mister Chameleon: intent score, enrichment credit, session credit, variant, audience segment, and more.",
    [
      textSec("intro", "text_lead", "The words we use - and what they actually mean.",
        pt("We try to use plain language everywhere. But personalisation has its own vocabulary. Here's what our key terms mean."),
      ),
      faqSec("terms", "Key terms", [
        { question: "Personalised session", answer: "A unique visitor served a non-default (personalised) content variant in a given calendar month. One visitor returning five times = one session." },
        { question: "Intent score", answer: "A 0–100 number representing how likely a visitor is to convert, based on their behavioural history and enrichment signals. Higher = closer to buying." },
        { question: "Enrichment credit", answer: "One unit of spend for an API-backed data lookup - company enrichment, weather, CRM match, or ABM check. Separate from session credits." },
        { question: "Session credit", answer: "One additional personalised session above your plan's monthly allowance. Purchased in bundles (10K / 50K / 200K). Never expire." },
        { question: "Content variant", answer: "A specific version of a page section - a hero, proof block, or CTA - stored in Sanity and selected by the decision engine for a given visitor." },
        { question: "Audience segment", answer: "A defined group of visitors who share common characteristics (high intent, enterprise company, LinkedIn traffic, etc.). Variants can be targeted to specific segments." },
        { question: "Decision engine", answer: "The Mister Chameleon system that evaluates all available signals and rules to select the best content variant for each visitor on each page load." },
        { question: "Funnel stage", answer: "A predicted stage in the buyer journey: awareness → consideration → intent → high_intent → customer. Derived from behavioural and enrichment signals." },
      ]),
    ],
  ),

  // ── COMPANY ──────────────────────────────────────────────────────────────────

  page("about", "about", "About Us", "landing-page",
    "About Mister Chameleon - the team behind adaptive personalisation",
    "We built Mister Chameleon because we believe every website should adapt to its visitors - without requiring a data science team or a privacy trade-off.",
    [
      // 1. Full-width hero — visual impact first, mission second
      { _type: "about", _key: "hero-full", variant: "media_full",
        heading: "We believe every website should adapt to its visitors.",
        body: pt(
          "Not just the websites of companies with data science teams, enterprise budgets, and six-month implementation timelines. Every website. Including yours.",
          "We built Mister Chameleon to make that possible - privacy-first, CMS-driven, and usable by a marketing team without a single line of custom code.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&auto=format&fit=crop&q=80",
        imageAlt: "The Mister Chameleon team collaborating in a bright Amsterdam workspace",
        ctas: [{ _key: "c0", label: "Read our manifesto", href: "/manifesto" }, { _key: "c1", label: "Meet the team", href: "/about-team" }],
      },

      // 2. Stats — credibility anchors, immediately after the mission statement
      statsSec("stats", "The platform in numbers", [
        { label: "Personalised sessions delivered", value: "12M", suffix: "+", description: "Across 200+ websites, every single one served the right content to the right visitor." },
        { label: "Customer sites running personalisation", value: "200", suffix: "+", description: "B2B SaaS teams, digital agencies, e-commerce, and recruitment companies across Europe." },
        { label: "Countries where customers are based", value: "18", description: "Built in Amsterdam. Trusted from Lisbon to Helsinki." },
        { label: "Total pipeline latency", value: "<50", suffix: "ms", description: "Signal collection, enrichment, scoring, and variant selection - before the page renders." },
      ]),

      // 3. Origin story — the founders' pain, not a press release
      { _type: "about", _key: "origin", variant: "media_right",
        heading: "Built by people who felt the problem first.",
        body: pt(
          "We spent years building and marketing B2B SaaS products. Every time we tried to personalise our websites, it meant a developer sprint, a third-party cookie setup that felt legally precarious, and a six-month wait before we could measure anything. The tools that existed were either too complex, too expensive, or too dependent on data we couldn't legally use in Europe.",
          "We convinced ourselves the hard part was the logic - the rules engine, the signal collection, the variant matching. It wasn't. The hard part was making all of that accessible to the marketing team without requiring a developer for every change.",
          "Mister Chameleon is the platform we wished had existed. Privacy-first by architecture, not by checkbox. Operable by marketing, not owned by engineering. And fast enough to make a real difference to visitors who aren't going to wait.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Two co-founders reviewing ideas on a whiteboard in an Amsterdam office",
        ctas: [{ _key: "c0", label: "Read the full manifesto", href: "/manifesto" }],
      },

      // 4. Values — what drives every product decision
      featureGrid("values", "What we believe", "feature_grid_3up", [
        {
          title: "Privacy is not a compromise",
          description: "Every architectural decision starts with: can we do this without cookies or third-party data? The answer is almost always yes. GDPR compliance is built into the design, not bolted on at the end.",
          icon: "shield",
        },
        {
          title: "Marketing teams should own personalisation",
          description: "If activating a variant requires a developer sprint, the tool has failed. Every feature in Mister Chameleon is designed to be created, configured, and adjusted by a marketing team - independently.",
          icon: "edit-3",
        },
        {
          title: "Transparency builds trust",
          description: "We publish our pricing, our uptime, our data processing details, and our roadmap. We don't have dark patterns, misleading trials, or hidden usage caps. What you see is what you pay for.",
          icon: "eye",
        },
        {
          title: "Small teams deserve serious tools",
          description: "The conversion advantages of personalisation should not be limited to companies with data science budgets. Our Starter plan is €99/month and includes the full decision engine - not a stripped-down version of it.",
          icon: "heart",
        },
        {
          title: "Your data stays with you",
          description: "Visitor behavioural data is stored in your own Supabase database, in your chosen region. We are a data processor, not a data hoarder. You can export or delete everything at any time.",
          icon: "database",
        },
        {
          title: "The best personalisation is invisible",
          description: "Visitors shouldn't feel targeted. They should simply feel like the website understands them. Great adaptive personalisation is the implementation nobody notices - because it just feels right.",
          icon: "cpu",
        },
      ]),

      // 5. The product vision — what makes it genuinely different
      { _type: "about", _key: "product-vision", variant: "media_left",
        heading: "A decision engine that runs at the edge.",
        body: pt(
          "Most personalisation tools work by injecting content after the page loads - which causes layout flicker, slows the perceived experience, and is trivially easy for visitors to notice. We took a different approach.",
          "The Mister Chameleon decision engine runs at the edge, before a single byte of HTML is sent to the visitor. Signal collection, company enrichment, intent scoring, and variant selection all happen in under 50 milliseconds - before the page renders. The visitor sees the personalised version on the first load, with no flicker and no delay.",
          "That architectural choice changes everything. It means personalisation is invisible. It means it doesn't hurt performance. And it means the engine can use a much richer set of signals than a client-side script ever could.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Close-up of circuit board representing the speed and precision of the decision engine",
        ctas: [{ _key: "c0", label: "How the engine works", href: "/the-engine" }, { _key: "c1", label: "See all features", href: "/features" }],
      },

      // 6. Traction and momentum — where we are now
      { _type: "about", _key: "traction", variant: "media_right",
        heading: "200+ sites. 12 million sessions. Still growing.",
        body: pt(
          "Two years after writing the first line of code, Mister Chameleon runs personalisation for over 200 websites across 18 countries. We have delivered more than 12 million personalised sessions. We are profitable, independent, and have not taken outside funding.",
          "Our customers include B2B SaaS teams using intent scoring to prioritise high-fit visitors, recruitment platforms personalising for employers and candidates in the same session, and digital agencies running white-label personalisation services for their clients.",
          "We are a small team and we intend to stay that way for as long as it makes us better. Every new person we hire raises the bar - they don't lower it.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Mister Chameleon team member presenting results to colleagues around a table",
        ctas: [{ _key: "c0", label: "Read customer stories", href: "/cases" }, { _key: "c1", label: "Meet the team", href: "/about-team" }],
      },

      // 7. Customer proof — validate the company story
      testimonialSec("testimonials", "What our customers say about us", [
        {
          quote: "Mister Chameleon gave us the conversion lift we were chasing for two years - with a fraction of the effort. Setup took an afternoon. Results showed up in the first week.",
          author: "Sanne T.",
          role: "Head of Growth",
          company: "Growlytics",
        },
        {
          quote: "We were sceptical about personalisation because of GDPR. Mister Chameleon is the first tool we have found that actually handles this properly - privacy-first, not privacy-washed. Our legal team signed off without a single back-and-forth.",
          author: "Lars K.",
          role: "CTO",
          company: "JobBridge",
        },
        {
          quote: "Running personalisation for 12 clients from one white-label dashboard has changed our service model completely. It is now a core revenue stream for the agency - and the margin is excellent.",
          author: "Mila D.",
          role: "Founder",
          company: "Frontline Agency",
        },
      ]),

      // 8. Privacy commitment — a differentiator worth its own section
      { _type: "about", _key: "privacy", variant: "media_left",
        heading: "Privacy-first is an architecture decision, not a marketing claim.",
        body: pt(
          "We made a deliberate choice early on: build the entire platform without relying on third-party cookies, third-party data brokers, or data that requires explicit consent to collect. That constraint made certain things harder to build. It also made the product genuinely better.",
          "IP-to-company enrichment runs server-side and returns only organisational metadata - no personal data is involved. Behavioural tracking is first-party, stored in your database, under your control. The decision engine runs at the edge using only the signals available in the request context and your own stored data.",
          "We are a data processor under GDPR. Your visitors' data is yours. We cannot access it, sell it, or use it for any purpose outside serving your personalisation. This is written into our DPA and it is auditable.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Secure server room representing first-party data storage and privacy-first architecture",
        ctas: [{ _key: "c0", label: "Read our privacy policy", href: "/privacy" }, { _key: "c1", label: "View GDPR and DPA details", href: "/gdpr" }],
      },

      // 9. Amsterdam office — human and geographic grounding
      { _type: "about", _key: "amsterdam", variant: "media_full",
        heading: "Based in Amsterdam. Working across Europe.",
        body: pt(
          "Our office is on the Keizersgracht in Amsterdam. When the team is in town we use it for planning sessions, onboarding, and the occasional long Friday. Most days you will find us on Slack, in a Notion doc, or in a 30-minute video call that ends on time.",
          "The team is spread across the Netherlands, Belgium, Germany, and Portugal. We meet in Amsterdam three or four times a year for the things that genuinely need a whiteboard.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1512470604991-7eb6a473b052?w=1400&auto=format&fit=crop&q=80",
        imageAlt: "Amsterdam canal in daytime with historic buildings reflected in the water",
        ctas: [{ _key: "c0", label: "Get in touch", href: "/contact" }],
      },

      // 10. Explore further — bridge to adjacent pages
      quickLinks("explore", "Learn more about Mister Chameleon", "Everything worth knowing about the company, the product, and what we are building next.", [
        { label: "Our manifesto", href: "/manifesto", description: "The principles that drive every product decision - what we believe and why we built this." },
        { label: "Meet the team", href: "/about-team", description: "Photos, bios, and roles. Fourteen people building adaptive personalisation from Amsterdam." },
        { label: "The engine", href: "/the-engine", description: "A technical deep-dive into how the decision engine works - signals, scoring, and variant selection." },
        { label: "Roadmap", href: "/roadmap", description: "What we are building next - and what is already shipped. Updated every sprint." },
        { label: "Case studies", href: "/cases", description: "Growlytics, JobBridge, and Frontline Agency - real results from real personalisation." },
        { label: "Open roles", href: "/jobs", description: "We are growing. Come help us build the platform for adaptive websites." },
      ]),

      // 11. Final CTA
      ctaSec("cta", "Convinced? Try the platform.", "Free trial. No credit card. Live in 15 minutes. Cancel any time.", "Start free trial", "/order/starter"),
    ],
    { "proof": { fallbackVariantKey: "proof_vision" } },
    ["team", "cultuur", "culture", "merk", "employer brand", "about"],
  ),

  page("about-team", "about-team", "The Team", "careers-page",
    "The Mister Chameleon team",
    "Meet the people building Mister Chameleon - a small, senior team with deep roots in B2B SaaS, edge infrastructure, and product design.",
    [

      // 1. Full-width visual hero - maximum visual impact on load
      { _type: "about", _key: "hero-full", variant: "media_full",
        heading: "The people behind adaptive personalisation.",
        body: pt(
          "We're a team of engineers, designers, and growth practitioners who spent years building and scaling B2B SaaS products. Mister Chameleon is what happens when that experience meets a problem we couldn't stop thinking about.",
          "Based in Amsterdam, working remotely across Europe.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&auto=format&fit=crop&q=80",
        imageAlt: "The Mister Chameleon team gathered around a table in a bright Amsterdam workspace",
        ctas: [{ _key: "c0", label: "See open roles", href: "/jobs" }, { _key: "c1", label: "Our story", href: "/about" }],
      },

      // 2. Numbers that make the team concrete
      statsSec("team-numbers", "By the numbers", [
        { value: "2023",   label: "Founded",           description: "Born out of frustration with expensive traffic and generic websites." },
        { value: "14",     label: "Team members",      description: "Small enough for everyone to know each other. Large enough to ship fast." },
        { value: "200+",   label: "Customers",         description: "B2B SaaS teams, agencies, and recruitment companies across Europe." },
        { value: "4",      label: "Countries",         description: "Netherlands, Belgium, Germany, Portugal - fully remote-first." },
      ]),

      // 3. Founders story - media right
      { _type: "about", _key: "founders", variant: "media_right",
        heading: "Started by people who felt the problem first.",
        body: pt(
          "Lucas came from growth - he'd spent years driving traffic to websites that couldn't adapt to the visitors arriving. Noa came from infrastructure - she'd built real-time data pipelines and kept asking why the outputs weren't being used. They met at a B2B SaaS scale-up in Amsterdam and the idea started there.",
          "The thesis was simple: the hard part of personalisation isn't the logic - it's making the whole system accessible to marketing teams without requiring a developer for every change. That's what Mister Chameleon is built around.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Two co-founders discussing at a whiteboard in a bright office",
        ctas: [{ _key: "c0", label: "Read our full story", href: "/about" }],
      },

      // 4. The full team grid - photos, names, roles, bios
      teamSec("team", "Meet everyone", "No layers, no org chart complexity. This is the whole team.", [
        {
          name: "Lucas van den Berg",
          role: "Co-founder & CEO",
          bio: "Former VP Growth at a B2B SaaS scale-up. Built and broke enough generic websites to know there had to be a better way.",
          imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "lucas@misterchameleon.io",
        },
        {
          name: "Noa Bakker",
          role: "Co-founder & CTO",
          bio: "Edge computing specialist. Previously built real-time data pipelines at scale. Obsessed with sub-50ms decision latency.",
          imageUrl: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "noa@misterchameleon.io",
        },
        {
          name: "Daan Visser",
          role: "Head of Product",
          bio: "Product leader with 10 years in marketing technology. Spent five years at an enterprise ABM platform before joining us.",
          imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "daan@misterchameleon.io",
        },
        {
          name: "Sofia Martins",
          role: "Lead Engineer",
          bio: "Full-stack engineer focused on Next.js and edge infrastructure. Has strong opinions about API design and expresses them clearly.",
          imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "sofia@misterchameleon.io",
        },
        {
          name: "Thomas Kramer",
          role: "Growth & Partnerships",
          bio: "10 years in B2B SaaS sales and partnerships. Formerly ran European partnerships at a leading CRM platform.",
          imageUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "thomas@misterchameleon.io",
        },
        {
          name: "Ines de Graaf",
          role: "Design Lead",
          bio: "Product designer focused on clarity and usability. Believes the best interfaces are the ones you don't notice.",
          imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "ines@misterchameleon.io",
        },
        {
          name: "Lena Brouwer",
          role: "Head of Customer Success",
          bio: "Has onboarded over 200 customers. If your integration question has a tricky edge case, she's already seen it.",
          imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "support@misterchameleon.io",
        },
        {
          name: "Jasper Mulders",
          role: "Head of People",
          bio: "Hired for three companies before joining us. Believes the right hire is a better decision than a fast hire.",
          imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
          linkedinUrl: "https://linkedin.com",
          email: "hello@misterchameleon.io",
        },
      ]),

      // 5. How we build - media left, engineering culture
      { _type: "about", _key: "build-culture", variant: "media_left",
        heading: "We build in the open, move fast, and own our mistakes.",
        body: pt(
          "There are no shadow roadmaps or top-down feature mandates. The team that builds a feature is the team that designed it, tested it, and shipped it. That means slower consensus sometimes - and much better decisions overall.",
          "We write in public (our changelog is detailed and honest), we document decisions in Notion, and we ship to production multiple times a day. Every engineer has access to production data. Every designer talks to customers.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Developer working at a standing desk with dual monitors and a whiteboard behind",
        ctas: [{ _key: "c0", label: "See what we're building", href: "/roadmap" }],
      },

      // 6. Team principles - 3-up feature grid
      featureGrid("principles", "How we work", "feature_grid_3up", [
        {
          title: "Remote-first, not remote-only",
          description: "Everyone works from wherever they're most productive. We meet in Amsterdam three or four times a year for planning and for the things that genuinely need a whiteboard.",
          icon: "home",
        },
        {
          title: "Small team, real ownership",
          description: "We move fast because every person owns a significant part of the product. You won't spend your days in approval chains or waiting for sign-off.",
          icon: "award",
        },
        {
          title: "Honest over polite",
          description: "We give direct feedback, assume good intent, and say what we actually think. We expect the same in return. No performance reviews full of vague positives.",
          icon: "message-circle",
        },
        {
          title: "Learning budget - no strings",
          description: "Every team member gets €1,500 per year for books, courses, conferences, or whatever makes them sharper. No approval process, no justification required.",
          icon: "book-open",
        },
        {
          title: "No meeting Wednesdays",
          description: "The full day is protected for deep work. Slack goes quiet, calendars stay clear. We take this one seriously.",
          icon: "calendar",
        },
        {
          title: "Ship it, then improve it",
          description: "We'd rather have something real in front of customers than perfect in a branch. We iterate fast, we break things occasionally, and we fix them faster.",
          icon: "zap",
        },
      ]),

      // 7. What team members say - testimonial slider for authentic voice
      testimonialSec("team-quotes", "In their own words", [
        {
          quote: "I've shipped more meaningful product in 18 months here than I did in four years at my previous job. The ownership is real, not just a line in the job description.",
          author: "Sofia Martins",
          role: "Lead Engineer",
          company: "Mister Chameleon",
        },
        {
          quote: "The customer feedback loop is tighter than anywhere I've worked. I talk to customers every week and what they say actually changes what we build. That's rare.",
          author: "Daan Visser",
          role: "Head of Product",
          company: "Mister Chameleon",
        },
        {
          quote: "Remote-first sounds like a cliche until you've actually worked somewhere that means it. No commute, no open-plan noise, and I can still fly to Amsterdam when I want to be in the room.",
          author: "Thomas Kramer",
          role: "Growth & Partnerships",
          company: "Mister Chameleon",
        },
      ] as { quote: string; author: string; role: string; company: string }[]),

      // 8. Office / culture visual - full width
      { _type: "about", _key: "office-culture", variant: "media_full",
        heading: "Amsterdam headquarters. European team.",
        body: pt(
          "Our office is on the Keizersgracht in Amsterdam - a short walk from Leidseplein. When the team is in town we use it for planning sessions, onboarding new starters, and the occasional Friday afternoon that runs long.",
          "Most of the time you'll reach us on Slack, in a Notion doc, or in a 30-minute Zoom call that ends on time.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&auto=format&fit=crop&q=80",
        imageAlt: "Bright modern Amsterdam office interior with large windows and open workspace",
        ctas: [{ _key: "c0", label: "Get directions", href: "https://maps.google.com/?q=Keizersgracht+125+Amsterdam" }],
      },

      // 9. We're hiring teaser - media right, leads into vacancy listing
      { _type: "about", _key: "hiring-teaser", variant: "media_right",
        heading: "We're growing. Come help us build.",
        body: pt(
          "We hire for character and capability - not just a matching list of keywords on a CV. The things we value most: clear thinking, honest communication, and a genuine interest in the problem we're solving.",
          "We look for people who've done the work, not just managed it. Who write clearly, ask good questions, and can disagree without making it personal.",
          "Below are our open roles. If nothing fits but you think you'd contribute something the team is missing, send a note anyway.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Two colleagues reviewing code side by side on laptops in a relaxed office environment",
        ctas: [{ _key: "c0", label: "View all open roles", href: "/jobs" }],
      },

      // 10. Open vacancies - horizontal carousel
      { _type: "listing", _key: "open-roles", variant: "listing_slider",
        heading: "Open roles",
        viewAllHref: "/jobs",
        viewAllLabel: "View all roles",
        items: [
          {
            id: "role-0",
            title: "Senior Full-Stack Engineer",
            href: "/jobs/senior-fullstack-engineer",
            excerpt: "Build the edge infrastructure and admin UI that powers personalisation for 200+ sites. Next.js, TypeScript, Supabase.",
            imageUrl: "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=600&auto=format&fit=crop&q=80",
            category: "Engineering",
          },
          {
            id: "role-1",
            title: "Growth Marketing Manager",
            href: "/jobs/growth-marketing-manager",
            excerpt: "Own acquisition, conversion, and retention. You'll use Mister Chameleon on our own site - first marketer, full ownership.",
            imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
            category: "Marketing",
          },
          {
            id: "role-2",
            title: "Customer Success Manager",
            href: "/jobs/customer-success-manager",
            excerpt: "Help customers get from signup to their first successful personalisation. Then help them grow from there.",
            imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&auto=format&fit=crop&q=80",
            category: "Customer Success",
          },
        ],
      },

      // 11. Recruiter contact panel
      recruiterPanel("recruiter", "Questions about working here?", "Jasper Mulders", "Head of People",
        "Happy to tell you more about the team, the culture, or any of the open roles. Drop me a line - I respond to every message personally.",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
        "hello@misterchameleon.io",
      ),

      // 12. Final CTA
      ctaSec("cta", "Don't see exactly the right role?", "We hire for people as much as positions. Tell us what you'd build with us.", "Say hello", "/contact"),
    ],
    { "hero": { fallbackVariantKey: "hero_careers_default" }, "proof": { fallbackVariantKey: "proof_careers_default" } },
  ),

  page("jobs", "jobs", "Work With Us", "careers-page",
    "Careers at Mister Chameleon - join the team",
    "We're building the platform for adaptive websites. Come help us. We hire for character, capability, and curiosity - not just credentials.",
    [
      // 1. Full-width hero — mission-first, team image
      { _type: "about", _key: "hero-full", variant: "media_full",
        heading: "Build the platform that makes every website smarter.",
        body: pt(
          "We are a small, senior team working on a problem at the intersection of data, privacy, and marketing technology. Every person here owns a meaningful piece of the product. There are no approval chains, no roadmap politics, and no work that exists to fill a sprint.",
          "If you want to build something that gets used by real companies every day - and you want to see the impact of your work in the metrics - this is the right place.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1400&auto=format&fit=crop&q=80",
        imageAlt: "Two colleagues reviewing work side by side in a relaxed, open workspace",
        ctas: [{ _key: "c0", label: "See open roles", href: "#open-roles" }, { _key: "c1", label: "Read about the team", href: "/about-team" }],
      },

      // 2. Stats — make the team and opportunity feel real
      statsSec("team-stats", "The team in numbers", [
        { label: "Team members", value: "14", description: "Small enough for everyone to know each other. Large enough to ship fast and cover every discipline." },
        { label: "Countries", value: "4", suffix: "", description: "Netherlands, Belgium, Germany, Portugal. Remote-first from day one." },
        { label: "Annual learning budget", value: "1,500", suffix: "€", description: "Per person, per year. Books, courses, conferences - no approval required." },
        { label: "Years profitable", value: "2", suffix: "", description: "Independent, no VC pressure, no layoff risk. We grow at the pace our product earns." },
      ]),

      // 3. Why join — the honest pitch
      { _type: "about", _key: "why-join", variant: "media_right",
        heading: "A problem worth spending your career on.",
        body: pt(
          "97% of website visitors leave without converting. The average B2B site has the same conversion rate it had five years ago - despite faster load times, more content, and bigger ad budgets. The problem isn't effort. It is that websites are still built for a hypothetical average visitor instead of adapting to the real one in front of them.",
          "Mister Chameleon fixes that. We are building the infrastructure that lets any website serve the right message to the right visitor at the right moment - without cookies, without a data science team, and without a six-month implementation project.",
          "Working here means you are building something that is measurably better for the companies that use it. The conversion lifts are real. The customer stories are real. And the problem is large enough that there is years of interesting work ahead.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Person at a whiteboard with a conversion funnel diagram, illustrating the problem Mister Chameleon solves",
        ctas: [{ _key: "c0", label: "Read our manifesto", href: "/manifesto" }, { _key: "c1", label: "See what we have built", href: "/features" }],
      },

      // 4. Benefits — concrete, not vague
      featureGrid("benefits", "What working here actually means", "feature_grid_3up", [
        {
          title: "Remote-first, not remote-tolerated",
          description: "The whole team works remotely. Our async culture is built around clear written communication, Notion documentation, and Slack threads that don't require you to be online at a specific hour. You work where you are most productive.",
          icon: "home",
        },
        {
          title: "Real ownership from day one",
          description: "Every engineer owns a significant surface area of the product. Every marketer owns a channel end-to-end. There are no tickets to implement someone else's spec. You design, build, ship, and improve.",
          icon: "award",
        },
        {
          title: "No meeting Wednesdays",
          description: "The full day is protected for deep work, every week. Calendars stay clear, Slack goes quiet. We take this seriously - it is not aspirational policy, it is actual practice.",
          icon: "calendar",
        },
        {
          title: "Learning budget with no strings",
          description: "€1,500 per person per year for books, online courses, conferences, or anything that makes you sharper. No approval process, no justification required. Buy what you want to learn from.",
          icon: "book-open",
        },
        {
          title: "Honest over comfortable",
          description: "We give direct feedback, assume good intent, and say what we actually think. We expect the same in return. Performance reviews are honest conversations, not diplomatic exercises in avoiding specifics.",
          icon: "message-circle",
        },
        {
          title: "Profitable and independent",
          description: "We have not taken outside funding and we are profitable. That means no runway anxiety, no investor-driven pivots, and no sudden layoffs. We hire when the product earns it - and we keep what we build.",
          icon: "trending-up",
        },
      ]),

      // 5. How we build — engineering and process culture
      { _type: "about", _key: "how-we-build", variant: "media_left",
        heading: "We ship to production multiple times a day.",
        body: pt(
          "There are no shadow roadmaps or top-down feature mandates. The team that designs a feature is the team that builds it, ships it, and measures it. That means slower consensus sometimes - and significantly better decisions overall.",
          "We write in public. Our changelog is detailed and honest. We document architectural decisions in Notion and we keep those records updated when things change. Every engineer has access to production data, every designer talks to customers weekly, and every product decision is grounded in actual usage patterns.",
          "We would rather ship something real and iterate quickly than spend months making it perfect in a branch. We break things occasionally. We fix them faster.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Developer at a standing desk with a large monitor and code on screen",
        ctas: [{ _key: "c0", label: "See our roadmap", href: "/roadmap" }, { _key: "c1", label: "Read the changelog", href: "/changelog" }],
      },

      // 6. Team voices — authentic over polished
      testimonialSec("team-voices", "In their own words", [
        {
          quote: "I have shipped more meaningful product in 18 months here than I did in four years at my previous job. The ownership is genuine - not just a line in the job description.",
          author: "Sofia Martins",
          role: "Lead Engineer",
          company: "Mister Chameleon",
        },
        {
          quote: "The customer feedback loop is tighter than anywhere I have worked. I talk to customers every week and what they say actually changes what we build the following sprint. That is rare and it makes the work feel real.",
          author: "Daan Visser",
          role: "Head of Product",
          company: "Mister Chameleon",
        },
        {
          quote: "Remote-first sounds like a cliche until you have worked somewhere that actually means it. No commute, no open-plan noise, and I can still fly to Amsterdam when I want to be in the room. Best of both.",
          author: "Thomas Kramer",
          role: "Growth and Partnerships",
          company: "Mister Chameleon",
        },
      ]),

      // 7. Open roles — slider for scannability
      { _type: "listing", _key: "open-roles", variant: "listing_slider",
        heading: "Open roles",
        viewAllHref: "/jobs",
        viewAllLabel: "All open roles",
        items: [
          {
            id: "role-0",
            title: "Senior Full-Stack Engineer",
            href: "/jobs/senior-fullstack-engineer",
            excerpt: "Build the edge infrastructure, decision engine, and admin UI that powers personalisation for 200+ sites. Next.js, TypeScript, Supabase. €70,000-€95,000.",
            imageUrl: "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=600&auto=format&fit=crop&q=80",
            category: "Engineering",
          },
          {
            id: "role-1",
            title: "Growth Marketing Manager",
            href: "/jobs/growth-marketing-manager",
            excerpt: "Own acquisition, conversion, and retention. First marketer at the company. You will use Mister Chameleon on our own site from day one. €55,000-€75,000.",
            imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
            category: "Marketing",
          },
          {
            id: "role-2",
            title: "Customer Success Manager",
            href: "/jobs/customer-success-manager",
            excerpt: "Help customers go from signup to their first successful personalisation - then help them grow from there. €45,000-€65,000 plus expansion commission.",
            imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&auto=format&fit=crop&q=80",
            category: "Customer Success",
          },
        ],
      },

      // 8. Amsterdam office — the place behind the remote-first culture
      { _type: "about", _key: "amsterdam", variant: "media_right",
        heading: "Amsterdam headquarters. European team.",
        body: pt(
          "Our office is on the Keizersgracht in Amsterdam - a short walk from Leidseplein. When the team is in town we use it for quarterly planning sessions, onboarding new team members, and the occasional long Friday afternoon.",
          "We meet in person three to four times a year. The rest of the time you will find us on Slack, in a Notion document, or in a 30-minute video call that ends on time. Flights to Amsterdam are on us for team weeks.",
        ),
        imageUrl: "https://images.unsplash.com/photo-1512470604991-7eb6a473b052?w=900&auto=format&fit=crop&q=80",
        imageAlt: "Amsterdam canal in afternoon light with historic canal houses reflected in the water",
        ctas: [{ _key: "c0", label: "Meet the full team", href: "/about-team" }],
      },

      // 9. Our hiring approach — reduce anxiety, set expectations
      textMedia("hiring-process", "text_media_left",
        "How we hire",
        "Character and capability. Not keywords on a CV.",
        "We review every application personally - there is no automated screening. We look for people who think clearly, write honestly, and have demonstrably done the kind of work we need. A matching list of buzzwords on a CV tells us very little. A clear explanation of a hard problem you solved tells us a lot. The process is: application review, a short intro call with Jasper, a paid work sample, and a final conversation with the founding team. Total time from application to offer is typically two to three weeks.",
        [{ label: "Talk to Jasper first", href: "mailto:hello@misterchameleon.io" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=900&auto=format&fit=crop&q=80", alt: "Recruiter having a relaxed video interview call", caption: "Every application read by a person. Every candidate treated like an adult." },
      ),

      // 10. Recruiter contact
      recruiterPanel("recruiter", "Questions about working here?", "Jasper Mulders", "Head of People",
        "Happy to tell you more about the team, the culture, the process, or any of the open roles. I respond to every message personally - usually within a day.",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
        "hello@misterchameleon.io",
      ),

      // 11. No-role fallback CTA
      ctaSec("cta", "Don't see exactly the right role?", "We hire for people as much as positions. If you think you would contribute something the team is missing, send a note and tell us what you would build.", "Say hello", "/contact"),
    ],
    { "hero": { fallbackVariantKey: "hero_careers_default" }, "proof": { fallbackVariantKey: "proof_careers_default" } },
    ["vacatures", "jobs", "careers", "werken bij", "cultuur"],
  ),

  // ── VACANCY DETAIL PAGES ─────────────────────────────────────────────────────

  page("job-senior-fullstack-engineer", "jobs/senior-fullstack-engineer", "Senior Full-Stack Engineer", "detail-page",
    "Senior Full-Stack Engineer - Mister Chameleon careers",
    "We're looking for a senior engineer to help build the edge infrastructure, API layer, and admin UI that powers personalisation for growing B2B websites.",
    [
      vacancyMeta("meta", "Senior Full-Stack Engineer", "Engineering", "Amsterdam / Remote (EU)", "Full-time", "€70,000 - €95,000", "40h", "Senior"),
      articleBody("body", pt(
        "We're looking for a senior full-stack engineer to help build the core platform - the decision engine, the admin interface, and the integrations that connect Mister Chameleon to the tools our customers already use.",
        "You'll own significant parts of the product. You'll write code, review code, and help shape the technical direction of a platform that processes millions of personalisation decisions every day.",
        "What you'll work on: Edge Middleware decision logic in Next.js 15 (TypeScript). The Sanity-based CMS integration and content variant system. The admin dashboard: rules editor, analytics, billing, and white-label tooling. API endpoints consumed by the tracking snippet and third-party integrations.",
        "What we're looking for: 5+ years of professional software development. Strong TypeScript and modern React. Experience with Next.js (App Router preferred). Comfort working with databases (PostgreSQL / Supabase). Interest in edge computing, personalisation, or data infrastructure. Clear written communication - we're async-first.",
        "What we offer: Competitive salary (€70,000-€95,000 depending on experience). Equity. Remote-first - work from anywhere in Europe. 25 days holiday. Annual learning budget (€1,500). Fast decision-making - no approval chains.",
      )),
      applyPanel("apply", "Apply for this role", "Send us your CV and a short note about why you're interested. We don't need a cover letter - just tell us what excites you about this role and what you'd bring to it.", "Apply now", "mailto:hello@misterchameleon.io?subject=Application: Senior Full-Stack Engineer"),
    ],
    undefined,
    ["vacature", "functie", "solliciteren", "careers", "jobs", "apply", "werken bij"],
  ),

  page("job-growth-marketing-manager", "jobs/growth-marketing-manager", "Growth Marketing Manager", "detail-page",
    "Growth Marketing Manager - Mister Chameleon careers",
    "We're looking for a growth marketer to own acquisition, conversion, and retention for the Mister Chameleon platform. You'll build the growth engine.",
    [
      vacancyMeta("meta", "Growth Marketing Manager", "Marketing", "Amsterdam / Remote (EU)", "Full-time", "€55,000 - €75,000", "40h", "Mid-Senior"),
      articleBody("body", pt(
        "We're looking for a growth marketing manager to build and run the acquisition, conversion, and retention engine for Mister Chameleon. Ironically, you'll be personalising our own website - which means you'll use our product every day.",
        "This is an ownership role. You'll set the growth strategy, run the experiments, and report directly to the co-founders. You'll have budget, tools, and the authority to make decisions fast.",
        "What you'll work on: SEO - content strategy, technical optimisation, backlink building. Paid acquisition - search and social, with clear attribution. The website itself - you'll work with the product team to use Mister Chameleon to personalise our own conversion funnel. Email and lifecycle marketing. Analytics - you'll own our growth metrics and report them honestly.",
        "What we're looking for: 4+ years in B2B SaaS growth or digital marketing. Hands-on experience with SEO, paid search, and email. Comfortable with data - you know how to run an experiment and read its results. Strong writer - you can write clear, non-fluffy content about technical topics. Based in Europe (CET +/- 2 hours preferred).",
        "What we offer: Competitive salary (€55,000-€75,000). Equity. Remote-first. 25 days holiday. Annual learning budget. The rare opportunity to be the first marketer at a product-led B2B SaaS company.",
      )),
      applyPanel("apply", "Apply for this role", "Show us your work. Send your CV and a short note - or link to something you've built or written that shows us how you think.", "Apply now", "mailto:hello@misterchameleon.io?subject=Application: Growth Marketing Manager"),
    ],
    undefined,
    ["vacature", "functie", "solliciteren", "careers", "jobs", "apply", "werken bij"],
  ),

  page("job-customer-success-manager", "jobs/customer-success-manager", "Customer Success Manager", "detail-page",
    "Customer Success Manager - Mister Chameleon careers",
    "We're looking for a CSM to own the success of our growing customer base - from onboarding through expansion. You'll be the bridge between customers and the product team.",
    [
      vacancyMeta("meta", "Customer Success Manager", "Customer Success", "Amsterdam / Remote (EU)", "Full-time", "€45,000 - €65,000", "40h", "Mid"),
      articleBody("body", pt(
        "We're looking for a customer success manager to own the relationship with our growing base of customers - from onboarding through to expansion and renewal.",
        "You'll be the first point of contact for new customers, running onboarding calls, answering technical questions, and helping teams get their first personalised variant live. You'll also work closely with our product team to surface customer feedback and help prioritise what we build.",
        "What you'll work on: Onboarding - getting new customers live quickly and successfully. Adoption - helping customers discover more of the platform over time. Retention - identifying at-risk accounts and intervening before they churn. Expansion - identifying upsell opportunities and working with the sales team to act on them. Feedback loops - translating customer feedback into product insights.",
        "What we're looking for: 3+ years in customer success, account management, or similar. Experience with B2B SaaS - you understand the sales cycle, the onboarding journey, and the renewal motion. Technical comfort - you don't need to code, but you need to understand APIs, CMS systems, and analytics tools at a conceptual level. Empathetic communicator - you listen well and can explain complex things clearly.",
        "What we offer: Competitive salary (€45,000-€65,000). Commission on expansion. Equity. Remote-first. 25 days holiday. Annual learning budget. A small, close-knit team where your work visibly matters.",
      )),
      applyPanel("apply", "Apply for this role", "Tell us about a customer you've helped succeed and what you did to make it happen. That's the most useful thing you can share with us.", "Apply now", "mailto:hello@misterchameleon.io?subject=Application: Customer Success Manager"),
    ],
    undefined,
    ["vacature", "functie", "solliciteren", "careers", "jobs", "apply", "werken bij"],
  ),

  page("press", "press", "Press & Media", "article-page",
    "Press & media - Mister Chameleon",
    "Press mentions, media kit, and contact information for journalists covering Mister Chameleon.",
    [
      textSec("intro", "text_single", "Press & media",
        pt(
          "For press enquiries, interview requests, or media kit access, contact press@misterchameleon.io. We aim to respond within one business day.",
          "We're happy to speak about website personalisation, privacy-first data strategy, the future of adaptive marketing, and the B2B SaaS landscape.",
        ),
      ),
      ctaSec("cta", "Press enquiries", "Contact our press team directly.", "press@misterchameleon.io", "/contact"),
    ],
  ),

  page("contact", "contact", "Contact", "landing-page",
    "Contact Mister Chameleon",
    "Get in touch with the Mister Chameleon team. Sales, support, partnerships, press, or just a question - we read everything.",
    [
      // 1. Hero - visual left, text right
      textMedia("hero", "text_media_right",
        "A real team. Real responses.",
        "Talk to us - we read everything.",
        "No ticket system routed to a bot. No FAQ labyrinth. Every message lands with a real person who can actually help. Whether you want a live demo, have a technical question, or are exploring a partnership - reach out and we'll get back to you within one business day.",
        [{ label: "Send us a message", href: "#contact-form" }, { label: "Book a demo call", href: "https://cal.com/misterchameleon" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=900&auto=format&fit=crop&q=80", alt: "Team member on a video call, representing responsive human support" },
      ),

      // 2. Stats strip - builds trust immediately
      statsSec("trust-stats", "Why teams reach out to us first", [
        { value: "< 1", suffix: " day", label: "Response time", description: "Every message answered by a person within one business day - no exceptions." },
        { value: "100", suffix: "%", label: "Human responses", description: "No auto-reply templates. A real team member reads and responds to every message." },
        { value: "3", suffix: " ways", label: "To reach us", description: "Email, call booking, or the form below - use whichever fits your workflow." },
        { value: "4.9", suffix: "/5", label: "Support satisfaction", description: "Across all support interactions in the last 12 months, rated by customers." },
      ]),

      // 3. Contact channels - 3up grid with icons
      featureGrid("channels", "Choose how you'd like to connect", "feature_grid_3up", [
        { title: "Sales & demos", description: "hello@misterchameleon.io - trial questions, plan comparisons, and live product demos. We'll walk you through a real setup, not a slide deck.", icon: "mail" },
        { title: "Technical support", description: "support@misterchameleon.io - integration help, billing queries, and platform questions. Growth and Pro customers receive priority responses.", icon: "life-buoy" },
        { title: "Press & partnerships", description: "press@misterchameleon.io - media enquiries, partnership proposals, and agency programme questions. We respond to every serious enquiry.", icon: "briefcase" },
      ]),

      // 4. Demo call - visual block, image left
      textMedia("demo-callout", "text_media_left",
        "Prefer a live conversation?",
        "Book a 20-minute demo call.",
        "Pick a slot and we'll show you a live Mister Chameleon setup on a real site - not a canned walkthrough. We'll cover your specific use case, answer your pricing questions, and tell you honestly if we're the right fit for where you are today.",
        [{ label: "Book a call", href: "https://cal.com/misterchameleon" }, { label: "See what we cover", href: "/how-it-works" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=900&auto=format&fit=crop&q=80", alt: "Two people on a video call, one sharing a screen" },
      ),

      // 5. Contact form - full width
      formSec("contact-form", "Send us a message", "Fill in the form and we'll get back to you within one business day. Growth and Pro customers receive priority responses.", "contact", "Send message"),

      // 6. What happens next - process steps
      processSec("what-happens-next", "What happens after you reach out", [
        { title: "You send your message", description: "Via the form above, email, or a booked call slot. All three go to the same team - nobody falls through the cracks.", duration: "Now" },
        { title: "A real person reads it", description: "Your message lands in our shared inbox, not a ticket queue. The right team member picks it up - usually within a few hours during business hours.", duration: "Within hours" },
        { title: "We respond with something useful", description: "Not a link to the FAQ. An actual answer, a follow-up question if we need more context, or a Calendly link to go deeper.", duration: "Within 1 business day" },
        { title: "We keep you moving", description: "Whether it's a trial setup, an integration question, or a proposal - we stay involved until your question is resolved.", duration: "Ongoing" },
      ]),

      // 7. Testimonial - social proof around support experience
      testimonialSec("support-testimonials", "What our customers say about working with us", [
        {
          quote: "I sent a question about a custom integration on a Friday afternoon and had a working answer in my inbox by Saturday morning. That doesn't happen with software companies.",
          author: "Lars Hendriks",
          role: "Head of Growth",
          company: "Logixflow",
        },
        {
          quote: "The onboarding call felt like talking to a developer who actually understood our stack. We had our first rule live within two hours of signing up.",
          author: "Sophie van den Berg",
          role: "CTO",
          company: "Frontline Agency",
        },
        {
          quote: "Every time I've had a billing or plan question the response has been fast, clear, and honest. No upsell pressure. That matters a lot to us.",
          author: "Pieter de Groot",
          role: "Founder",
          company: "JobBridge",
        },
      ]),

      // 8. Meet the team who responds
      teamSec("team", "The people you'll hear from", "A small, senior team. Everyone who responds to you has been with the product from early on.",
        [
          {
            name: "Lena Brouwer",
            role: "Head of Customer Success",
            bio: "Lena has onboarded over 200 customers and built the support playbook from scratch. If your question involves a tricky integration, chances are she's solved it before.",
            imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
            email: "support@misterchameleon.io",
            linkedinUrl: "https://linkedin.com",
          },
          {
            name: "Mark Visser",
            role: "Sales & Partnerships",
            bio: "Mark handles demos, plan questions, and partnerships. He'll give you a straight answer on whether Mister Chameleon is a good fit - even if that answer is 'not yet'.",
            imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
            email: "hello@misterchameleon.io",
            linkedinUrl: "https://linkedin.com",
          },
          {
            name: "Yasmin Osei",
            role: "Technical Support",
            bio: "Yasmin is the person behind support@misterchameleon.io. She knows the codebase well enough to spot configuration issues in seconds and explain them in plain English.",
            imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
            email: "support@misterchameleon.io",
            linkedinUrl: "https://linkedin.com",
          },
        ],
      ),

      // 9. Office + map - visual anchor for the page
      textMedia("office-intro", "text_media_right",
        "Based in Amsterdam.",
        "A canal-side office, and a fully distributed team.",
        "Our headquarters are on the Keizersgracht in Amsterdam. Most of the team works distributed across the Netherlands and Belgium - which means someone is always close to a keyboard during European business hours.",
        [{ label: "Get directions", href: "https://maps.google.com/?q=Keizersgracht+125+Amsterdam" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=900&auto=format&fit=crop&q=80", alt: "Amsterdam canal with historic buildings, representing the Keizersgracht office location" },
      ),

      mapBlock("office-map", "Find us in Amsterdam", "Keizersgracht 125", "1015 CJ Amsterdam", "Netherlands", "hello@misterchameleon.io", "+31 20 123 4567", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2436.1234567890123!2d4.8895!3d52.3726!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c609b7f7f7f7f7%3A0x1234567890abcdef!2sKeizersgracht%20125%2C%201015%20CJ%20Amsterdam!5e0!3m2!1sen!2snl!4v1234567890"),

      // 10. FAQ - pre-emptive answers to common questions
      faqSec("contact-faq", "Common questions before reaching out", [
        { question: "How quickly will you respond?", answer: "Within one business day for all channels. Growth and Pro customers receive priority responses, typically within a few hours during Dutch business hours (09:00-18:00 CET)." },
        { question: "Can I get a refund or cancel my subscription?", answer: "Yes - contact support@misterchameleon.io. We process cancellations within one business day. Refunds are handled case by case; we'll always look at your situation fairly." },
        { question: "I want a custom enterprise contract. Who do I talk to?", answer: "Reach out to hello@misterchameleon.io with your company size, traffic volume, and requirements. Enterprise proposals include custom limits, SSO, a dedicated CSM, and annual invoicing." },
        { question: "Do you offer implementation support?", answer: "Yes. Every Growth and Pro plan includes an onboarding call. Pro customers also get a Slack channel with direct access to the team for the first 90 days." },
        { question: "I'm a journalist or researcher. Who do I contact?", answer: "Send your request to press@misterchameleon.io. We respond to all serious media enquiries and are happy to provide data, quotes, or spokesperson access for relevant stories." },
      ]),

      // 11. Final CTA
      ctaSec("cta", "Ready to talk?", "Book a 20-minute slot or send a message - we'll take it from there.", "Book a demo call", "https://cal.com/misterchameleon"),
    ],
    { "proof": { fallbackVariantKey: "proof_vision" } },
    ["contact", "support", "diensten", "services"],
  ),

  page("partners", "partners", "Partners", "landing-page",
    "Mister Chameleon partner programme",
    "Join the Mister Chameleon partner programme. Refer customers, build integrations, or resell personalisation as part of your agency offering.",
    [
      textMedia("header-banner", "text_media_right",
        "Build a personalisation business together.",
        "Grow with a partner programme that's built to scale.",
        "Whether you refer clients, resell under your own brand, or want to build a native integration with your platform - the Mister Chameleon partner programme gives you the margins, support, and co-marketing you need to succeed.",
        [{ label: "Apply to partner", href: "#partner-form" }, { label: "Talk to us", href: "/contact" }],
        { type: "image" as const, url: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&auto=format&fit=crop&q=80", alt: "Two colleagues shaking hands, representing a successful partnership" },
      ),
      textSec("intro", "text_lead", "Grow together.",
        pt("We work with agencies, consultants, and technology partners who want to bring personalisation to their clients or integrate Mister Chameleon into their platform."),
      ),
      featureGrid("types", "Partnership types", "feature_grid_3up", [
        { title: "Agency partners", description: "Add personalisation to your service offering. Resell Mister Chameleon under your own branding on our Pro plan - or refer clients and earn a revenue share." },
        { title: "Technology partners", description: "Build a native integration between your platform and Mister Chameleon. We provide API access, technical documentation, and co-marketing support." },
        { title: "Referral partners", description: "Know someone who'd benefit from Mister Chameleon? Our referral programme pays 20% recurring commission for the first 12 months of any customer you introduce." },
      ]),
      ctaSec("cta", "Interested in partnering?", "Tell us about your business and what you'd like to build together.", "Get in touch", "/contact"),
    ],
    { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_cases" } },
  ),

  // ── LEGAL ────────────────────────────────────────────────────────────────────

  page("privacy", "privacy", "Privacy Policy", "article-page",
    "Privacy policy - Mister Chameleon",
    "How Mister Chameleon collects, uses, and protects personal data. GDPR compliant. Last updated April 2026.",
    [
      textSec("body", "text_single", "Privacy Policy",
        pt(
          "Last updated: April 2026",
          "Mister Chameleon B.V. ('we', 'us', 'our') operates the Mister Chameleon platform. This Privacy Policy explains how we collect, use, and protect information when you use our website and services.",
          "Data we collect: We collect information you provide directly (name, email, company) when you sign up or contact us. We also collect usage data about how you interact with our platform, and technical data such as IP address, browser type, and device information.",
          "How we use data: To provide and improve the Mister Chameleon service; to communicate with you about your account; to send product updates and marketing communications (with your consent); and to comply with legal obligations.",
          "Data storage: Customer account data is stored in our infrastructure in the European Union. Your visitor personalisation data (behavioural signals, session history) is stored in your own Supabase database - we do not have access to it.",
          "Data sharing: We do not sell personal data. We share data with service providers who help us operate the platform (Supabase, Stripe, Sanity) under data processing agreements.",
          "Your rights: Under GDPR, you have the right to access, correct, delete, and port your personal data. Contact privacy@misterchameleon.io to exercise these rights.",
          "Contact: Mister Chameleon B.V., privacy@misterchameleon.io",
        ),
      ),
    ],
    undefined,
    ["privacy", "gdpr", "security", "compliance", "trust"],
  ),

  page("terms", "terms", "Terms of Service", "article-page",
    "Terms of service - Mister Chameleon",
    "The terms governing your use of the Mister Chameleon platform. Plain language where possible.",
    [
      textSec("body", "text_single", "Terms of Service",
        pt(
          "Last updated: April 2026",
          "By using Mister Chameleon, you agree to these terms. If you're using Mister Chameleon on behalf of a company, you represent that you have authority to bind that company to these terms.",
          "Service: We provide website personalisation software as a service. We aim for 99.9% uptime but do not guarantee uninterrupted access. Planned maintenance is communicated in advance.",
          "Acceptable use: You may use Mister Chameleon to personalise websites you own or operate. You may not use the platform to serve deceptive content, violate privacy laws, or infringe third-party rights.",
          "Payment: Subscription fees are charged monthly or annually in advance. Session top-ups and enrichment credit packs are charged at purchase. All fees are non-refundable except as required by law.",
          "Termination: You may cancel at any time. We may suspend or terminate accounts that violate these terms after reasonable notice.",
          "Limitation of liability: Our liability is limited to the fees you paid in the three months preceding the claim.",
          "Contact: legal@misterchameleon.io",
        ),
      ),
    ],
    undefined,
    ["privacy", "gdpr", "security", "compliance", "trust"],
  ),

  page("cookies", "cookies", "Cookie Settings", "article-page",
    "Cookie settings - Mister Chameleon",
    "What cookies Mister Chameleon uses and why. Manage your preferences here - accept all, decline non-essential, or choose individually.",
    [
      textSec("intro", "text_lead", "We keep cookies minimal. You stay in control.",
        pt(
          "Mister Chameleon uses the fewest cookies possible. Below you'll find exactly what each cookie does, why we use it, and how to manage your preferences.",
        ),
      ),
      faqSec("cookies-detail", "Cookies we use", [
        { question: "mc_session_id (Strictly necessary)", answer: "A first-party functional cookie. Stores an anonymous session identifier that allows us to recognise your browser across page loads. This is required for the personalisation service to work. It contains no personal data - it is a random UUID. Duration: 30 days. Cannot be disabled while using the service." },
        { question: "mc_consent (Preferences)", answer: "Stores your cookie consent choices so we don't ask you again. Duration: 365 days. If you decline preferences cookies, we'll ask for your consent on each visit." },
        { question: "Advertising and tracking cookies", answer: "We do not use advertising cookies, third-party tracking pixels, or analytics cookies (such as Google Analytics) on this website. We do not share data with advertising networks." },
        { question: "Cookies set by your own Mister Chameleon installation", answer: "When you install Mister Chameleon on your own website, the mc_session_id cookie is set on your domain - not ours. This is a first-party cookie from your website visitors' perspective. You should disclose it in your own cookie policy." },
      ]),
      featureGrid("controls", "Your cookie controls", "feature_grid_3up", [
        { title: "Accept all", description: "Accept the mc_session_id functional cookie and the mc_consent preferences cookie. The full personalisation experience is enabled.", icon: "check-circle" },
        { title: "Decline non-essential", description: "Accept only the strictly necessary mc_session_id cookie. We won't remember your preference - you'll be asked again next visit.", icon: "x-circle" },
        { title: "Manage individually", description: "Use the preference centre to choose exactly which cookie categories you accept. Your choices are saved in the mc_consent cookie.", icon: "sliders" },
      ]),
      formSec("cookie-preferences", "Set your preferences", "Choose which cookies you allow. Your choice is saved immediately.", "cookie-settings", "Save preferences"),
      ctaSec("cta", "Questions about our cookie use?", "Contact our privacy team at privacy@misterchameleon.io and we'll explain exactly what data is stored and how.", "Contact privacy team", "mailto:privacy@misterchameleon.io"),
    ],
    undefined,
    ["privacy", "gdpr", "security", "compliance", "trust"],
  ),

  page("gdpr", "gdpr", "GDPR & DPA", "article-page",
    "GDPR compliance and Data Processing Agreement - Mister Chameleon",
    "How Mister Chameleon meets GDPR requirements. Download our Data Processing Agreement or request a custom DPA for your organisation.",
    [
      textSec("intro", "text_lead", "GDPR compliance built in - not bolted on.",
        pt(
          "Mister Chameleon was designed with European privacy law as a baseline, not an afterthought. Here's how we comply with GDPR and what that means for you as a controller.",
        ),
      ),
      featureGrid("compliance", "Our GDPR commitments", "feature_grid_3up", [
        { title: "Data Processing Agreement", description: "We offer a standard DPA for all paying customers that documents lawful basis, sub-processors, data transfers, and your rights as controller. Available on request - contact privacy@misterchameleon.io." },
        { title: "Sub-processors", description: "Our key sub-processors are Supabase (database infrastructure), Stripe (payment processing), and Sanity (CMS). All operate under EU-compliant data processing terms." },
        { title: "Data residency", description: "Your account data is stored in the EU by default. Supabase projects are created in your chosen region. We do not transfer visitor data to third countries." },
        { title: "Data subject rights", description: "We respond to data subject requests within 30 days. Contact privacy@misterchameleon.io to submit a request or to support your own customers' rights requests." },
        { title: "No third-party cookies", description: "Mister Chameleon does not use advertising cookies or cross-site tracking. The mc_session_id cookie is a functional first-party cookie - no consent banner required in most implementations." },
        { title: "Privacy by design", description: "Personal data minimisation is built into our architecture. Visitor behavioural data is stored in your own database. We hold only what is necessary to operate the service." },
      ]),
      ctaSec("cta", "Request a DPA", "Contact our privacy team and we'll send you our standard DPA within one business day.", "Request DPA", "/contact"),
    ],
    undefined,
    ["privacy", "gdpr", "security", "compliance", "trust"],
  ),

  page("sla", "sla", "Service Level Agreement", "article-page",
    "Service Level Agreement - Mister Chameleon",
    "Mister Chameleon's service level commitments: uptime, response times, incident management, and compensation policy.",
    [
      textSec("body", "text_single", "Service Level Agreement",
        pt(
          "Last updated: April 2026. Applies to Growth and Pro plans.",
          "Uptime commitment: We target 99.9% monthly uptime for the Mister Chameleon decision engine and admin interface. Planned maintenance windows are excluded and communicated at least 48 hours in advance via status.misterchameleon.io.",
          "Incident response: P1 incidents (service unavailable) - initial response within 1 hour; P2 (degraded performance) - initial response within 4 hours; P3 (minor issues) - response within 1 business day.",
          "Compensation: If monthly uptime falls below 99.9%, customers on Growth and Pro plans are entitled to a service credit of 10% of their monthly fee per 0.5% below the target (up to 30% of monthly fees).",
          "Exclusions: The SLA does not cover downtime caused by third-party services (Supabase, Sanity, Stripe), customer-side misconfigurations, or events outside our reasonable control.",
          "Status page: Real-time and historical uptime data is available at status.misterchameleon.io.",
          "Questions: sla@misterchameleon.io",
        ),
      ),
    ],
    undefined,
    ["privacy", "gdpr", "security", "compliance", "trust"],
  ),

  // ── SEARCH ────────────────────────────────────────────────────────────────────

  page("search", "search", "Search", "article-page",
    "Search Mister Chameleon - documentation, blog, features, and more",
    "Search across documentation, blog posts, feature pages, case studies, and more.",
    [
      { _type: "search", _key: "search-main", variant: "search_full", title: "Search Mister Chameleon", placeholder: "Search docs, blog, features, case studies...", description: "Search across all content on this site.", scopes: ["blog", "docs", "features", "cases", "pages"], showFilters: true, enableInstant: true, maxResults: 20, emptyMessage: "Enter a search term to get started.", noResultsMessage: "No results found. Try a different term or browse by section." },
      { _type: "filterBar", _key: "search-filters", variant: "filter_default", placeholder: "Search...", showSearch: false, showCategoryFilter: true, showTagFilter: false,
        categories: [
          { _key: "c0", label: "All", value: "" },
          { _key: "c1", label: "Blog", value: "blog" },
          { _key: "c2", label: "Docs", value: "docs" },
          { _key: "c3", label: "Features", value: "features" },
          { _key: "c4", label: "Case studies", value: "cases" },
          { _key: "c5", label: "Pages", value: "pages" },
        ],
      },
      { _type: "searchResults", _key: "search-results", variant: "results_list", heading: "Results", emptyMessage: "No results yet - enter a search term above.", itemsPerPage: 10, enableSearch: true, enableFilter: true },
    ],
  ),

  // ── BLOCK SHOWCASE ────────────────────────────────────────────────────────────
  //
  // Template: marketing-page — renders hero + proof context slots BEFORE content
  // and cta context slot AFTER content.  Use the Scenario Control panel (bottom
  // right, dev/demo only) to switch scenarios and see context blocks change.
  //
  // Content blocks are organised by category below, each preceded by a
  // textSection "label" that names the block type and variant.

  page("block-showcase", "block-showcase", "Block Showcase", "marketing-page",
    "Block showcase - all blocks and variants - Mister Chameleon",
    "Every content block type and variant on a single page. Context blocks (hero, proof, CTA) adapt with the Scenario Control panel.",
    [

      // ── PAGE INTRO ──────────────────────────────────────────────────────────

      textSec("intro", "text_lead", "Every block. Every variant. One page.",
        pt(
          "This is the Mister Chameleon block reference. Every content block type and its canonical variants are shown below, populated with dummy content.",
          "Context blocks - hero (top), proof (below hero), and CTA (bottom) - are rendered by the decision engine via template slots. Switch the scenario in the Scenario Control panel (bottom right corner) to see them adapt in real time.",
        ),
      ),

      // ══════════════════════════════════════════════════════════════════════
      // 1. TEXT BLOCKS
      // textSection | richText | contentSection
      // ══════════════════════════════════════════════════════════════════════

      textSec("cat-text", "text_split", "Block category: Text",
        pt("Text blocks handle editorial and structured typographic content. Use textSection for headings-plus-body, richText for portable-text body drop-ins, and contentSection for marketing-structured sections with eyebrow, heading, intro, body, and CTAs."),
      ),

      // textSection / text_single
      textSec("ts-single", "text_single", "textSection / text_single",
        pt("Single-column left-aligned text. The default layout - best for articles, legal pages, and editorial content where a narrow reading column improves legibility. No heading decoration; just clean prose.")
      ),

      // textSection / text_split
      textSec("ts-split", "text_split", "textSection / text_split",
        pt("Two-column split. Heading appears on the left in a fixed-width column; body copy fills the right side. Strong structural contrast - good for feature announcements and editorial sections where the headline carries most of the weight.")
      ),

      // textSection / text_lead
      textSec("ts-lead", "text_lead", "textSection / text_lead",
        pt("Extra-large centered lead paragraph. Full-width oversized heading above a wide prose column. Use at the top of a page section when the typographic weight needs to set the editorial tone before supporting blocks follow.")
      ),

      // richText / default (no variants - single layout)
      { _type: "richText", _key: "rt-default",
        body: pt(
          "richText / default - a portable text body renderer with no variants. It renders headings, paragraphs, bold, italic, lists, and inline links from portable text data.",
          "Use richText when you need a CMS-authored long-form body drop-in that does not carry section padding or a heading of its own. It is semantically distinct from textSection: textSection is a section component with a heading prop; richText is a pure body renderer.",
        ),
      },

      // contentSection / content_default
      { _type: "contentSection", _key: "cs-default", variant: "content_default",
        eyebrow: "Block: contentSection",
        heading: "contentSection / content_default",
        intro: "Single centered or left-aligned column with optional eyebrow label, heading, intro line, rich portable-text body, and up to two CTA buttons. Good for product feature explanations and editorial sections that need structured hierarchy.",
        ctas: [{ _key: "c0", label: "Primary CTA", href: "#" }, { _key: "c1", label: "Secondary CTA", href: "#" }],
      },

      // contentSection / content_split
      { _type: "contentSection", _key: "cs-split", variant: "content_split",
        eyebrow: "Block: contentSection",
        heading: "contentSection / content_split",
        intro: "Two-column split: eyebrow and heading fill the left column; intro text, body, and CTAs fill the right. Mirrors the textSection text_split layout but adds eyebrow and CTA support for marketing sections.",
        ctas: [{ _key: "c0", label: "Learn more", href: "#" }],
      },

      // ══════════════════════════════════════════════════════════════════════
      // 2. FEATURES BLOCKS
      // featureGrid | processSteps
      // ══════════════════════════════════════════════════════════════════════

      textSec("cat-features", "text_split", "Block category: Features",
        pt("Feature blocks highlight product capabilities, benefits, or process steps. featureGrid supports icon cards in multiple grid densities and styles. processSteps is for numbered ordered sequences with optional durations."),
      ),

      // featureGrid / feature_grid_3up
      featureGrid("fg-3up", "featureGrid / feature_grid_3up", "feature_grid_3up", [
        { title: "Intent scoring", description: "Score every visitor's purchase intent in real time based on page depth, scroll behaviour, and repeat visits.", icon: "chart" },
        { title: "Company enrichment", description: "Identify the company behind anonymous IP addresses and surface their industry, size, and CRM match status.", icon: "building" },
        { title: "Adaptive content", description: "The decision engine selects the best variant for each visitor using rules, enrichment data, and behavioural signals.", icon: "bolt" },
      ], { label: "See all features", href: "/features" }),

      // featureGrid / feature_grid_4up
      featureGrid("fg-4up", "featureGrid / feature_grid_4up", "feature_grid_4up", [
        { title: "Rules engine", description: "Define visitor segments with AND/OR rule logic. No code required.", icon: "cpu" },
        { title: "Experiments", description: "Run A/B and multivariate tests on any page element.", icon: "flask" },
        { title: "Analytics", description: "Attribution-aware funnel analysis across every variant.", icon: "bar-chart" },
        { title: "Integrations", description: "Connect HubSpot, Salesforce, Segment, and 40+ platforms.", icon: "plug" },
      ]),

      // featureGrid / feature_grid_cards
      { _type: "featureGrid", _key: "fg-cards", variant: "feature_grid_cards",
        heading: "featureGrid / feature_grid_cards",
        features: [
          { _key: "f0", title: "Elevated cards", description: "Shadow-lifted white cards on a neutral background. Maximum contrast between card and section.", icon: "layers" },
          { _key: "f1", title: "Prominent icons", description: "Larger icon treatment inside a tinted badge - clear visual anchors for each benefit.", icon: "star" },
          { _key: "f2", title: "CTA-ready", description: "Each card can carry an optional learn-more link beneath the description text.", icon: "arrow-right" },
        ],
      },

      // featureGrid / feature_grid_checklist
      { _type: "featureGrid", _key: "fg-checklist", variant: "feature_grid_checklist",
        heading: "featureGrid / feature_grid_checklist",
        features: [
          { _key: "f0", title: "First benefit", description: "Horizontal icon-left row layout. Works well for long feature lists where vertical card grids become overwhelming.", icon: "check" },
          { _key: "f1", title: "Second benefit", description: "Dense information density - more features visible without scrolling. Good for comparison sections.", icon: "check" },
          { _key: "f2", title: "Third benefit", description: "Icon is a subtle check or category marker on the left. Title and description flow right.", icon: "check" },
          { _key: "f3", title: "Fourth benefit", description: "Typically used for 5-10 items where a grid would create large empty areas on the last row.", icon: "check" },
        ],
      },

      // processSteps / default
      processSec("proc-default", "processSteps / default", [
        { title: "Connect your CMS", description: "Point Mister Chameleon at your Sanity, Storyblok, or Statamic project. Takes under five minutes with the guided setup wizard.", duration: "5 minutes" },
        { title: "Define your segments", description: "Use the rules builder to create visitor segments - by source, intent score, company, or behaviour. No developer needed.", duration: "10 minutes" },
        { title: "Create content variants", description: "Write alternative hero headlines, CTAs, and proof blocks for each segment inside your CMS. Reuse existing content or create from scratch.", duration: "20 minutes" },
        { title: "Go live", description: "Enable the decision engine. Your first personalised session runs within seconds. Watch conversion lift in the analytics dashboard.", duration: "1 minute" },
      ]),

      // ══════════════════════════════════════════════════════════════════════
      // 3. SOCIAL PROOF BLOCKS
      // stats | testimonialSection | logoStrip
      // ══════════════════════════════════════════════════════════════════════

      textSec("cat-proof", "text_split", "Block category: Social proof",
        pt("Social proof blocks build visitor confidence. stats shows quantitative metrics. testimonialSection renders customer quotes. logoStrip displays brand logos to signal credibility."),
      ),

      // stats / default
      statsSec("stats-default", "stats / default", [
        { label: "Personalised sessions delivered", value: "12M", suffix: "+" },
        { label: "Average conversion lift", value: "34", suffix: "%" },
        { label: "Minutes to first live variant", value: "< 15" },
        { label: "GDPR-compliant by design", value: "100", suffix: "%" },
      ]),

      // stats / compact
      { _type: "stats", _key: "stats-compact", variant: "compact",
        heading: "stats / compact",
        items: [
          { _key: "s0", label: "Active tenants", value: "500", suffix: "+", prefix: "" },
          { _key: "s1", label: "Variants delivered", value: "12M", suffix: "", prefix: "" },
          { _key: "s2", label: "Avg. lift", value: "34", suffix: "%", prefix: "" },
          { _key: "s3", label: "Uptime SLA", value: "99.9", suffix: "%", prefix: "" },
        ],
      },

      // stats / dark
      { _type: "stats", _key: "stats-dark", variant: "dark",
        heading: "stats / dark",
        items: [
          { _key: "s0", label: "Edge locations", value: "42", suffix: "", prefix: "" },
          { _key: "s1", label: "Decision latency", value: "< 2", suffix: "ms", prefix: "" },
          { _key: "s2", label: "Data processed daily", value: "8", suffix: "TB", prefix: "" },
          { _key: "s3", label: "Models retrained", value: "Every 6", suffix: "h", prefix: "" },
        ],
      },

      // testimonialSection / testimonial_grid
      testimonialSec("tm-grid", "testimonialSection / testimonial_grid", [
        { quote: "We switched from a static hero to three Mister Chameleon variants in one afternoon. Our enterprise leads went up 22% in the first week.", author: "Sarah Chen", role: "Head of Growth", company: "Growlytics" },
        { quote: "The company enrichment feature alone justified the subscription. Knowing a Fortune 500 visitor is on our site and showing them the right case study is game-changing.", author: "Marcus Reyes", role: "VP Marketing", company: "JobBridge" },
        { quote: "Setup genuinely took 15 minutes. The rules builder is as intuitive as a form builder - no engineering ticket required.", author: "Priya Kapoor", role: "Founder", company: "Frontline Agency" },
      ]),

      // testimonialSection / testimonial_single
      { _type: "testimonialSection", _key: "tm-single", variant: "testimonial_single",
        heading: "testimonialSection / testimonial_single",
        testimonials: [
          { _key: "t0", quote: "A full-width single centered quote. Best for high-impact endorsements from recognisable names or brands. The large typographic treatment makes this variant carry significant visual weight.", author: "Alexandra Winters", role: "Chief Marketing Officer", company: "Enterprise Corp" },
        ],
      },

      // testimonialSection / testimonial_highlight
      { _type: "testimonialSection", _key: "tm-highlight", variant: "testimonial_highlight",
        heading: "testimonialSection / testimonial_highlight",
        testimonials: [
          { _key: "t0", quote: "The featured testimonial displays large, anchoring the section. This is the primary endorsement - make it your strongest quote with the most credible attribution.", author: "David Okafor", role: "CTO", company: "ScaleUp SaaS" },
          { _key: "t1", quote: "Supporting quote shown smaller below the featured item.", author: "Emma Larsen", role: "Growth Lead", company: "Nordic Tech" },
          { _key: "t2", quote: "A third quote completes the highlight layout.", author: "James Park", role: "Founder", company: "AgileStart" },
        ],
      },

      // testimonialSection / testimonial_slider
      { _type: "testimonialSection", _key: "tm-slider", variant: "testimonial_slider",
        heading: "testimonialSection / testimonial_slider",
        testimonials: [
          { _key: "t0", quote: "Auto-advancing carousel of quote cards. Useful when you have five or more testimonials and want them all visible without the page growing taller.", author: "Chloe Martin", role: "Product Lead", company: "SaaS Co" },
          { _key: "t1", quote: "Slides advance automatically and pause on hover. Visitors can also click through manually. Keeps the social proof section compact.", author: "Ben Torres", role: "Marketing Director", company: "Growth Inc" },
          { _key: "t2", quote: "Works best with 4-8 testimonials of similar length. Uneven lengths cause height shifts; aim for consistency.", author: "Anya Patel", role: "Head of Demand Gen", company: "B2B Platform" },
          { _key: "t3", quote: "The slider variant is best for mobile experiences where a grid layout would require too much vertical scroll.", author: "Tom Walsh", role: "CEO", company: "Conversion Co" },
        ],
      },

      // logoStrip / muted (animated)
      logoStrip("logos-muted", "logoStrip / muted (animated)", [
        { name: "HubSpot",    src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg" },
        { name: "Salesforce", src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg" },
        { name: "Stripe",     src: "https://cdn.worldvectorlogo.com/logos/stripe-2.svg" },
        { name: "Supabase",   src: "https://cdn.worldvectorlogo.com/logos/supabase.svg" },
        { name: "Next.js",    src: "https://cdn.worldvectorlogo.com/logos/next-js.svg" },
        { name: "Sanity",     src: "https://cdn.worldvectorlogo.com/logos/sanity.svg" },
      ], { variant: "muted", grayscale: true, showLabels: false }),

      // logoStrip / default
      logoStrip("logos-default", "logoStrip / default", [
        { name: "HubSpot",    src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg" },
        { name: "Salesforce", src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg" },
        { name: "Stripe",     src: "https://cdn.worldvectorlogo.com/logos/stripe-2.svg" },
        { name: "Supabase",   src: "https://cdn.worldvectorlogo.com/logos/supabase.svg" },
        { name: "Next.js",    src: "https://cdn.worldvectorlogo.com/logos/next-js.svg" },
        { name: "Sanity",     src: "https://cdn.worldvectorlogo.com/logos/sanity.svg" },
      ], { variant: "default", grayscale: false, showLabels: true }),

      // logoStrip / logo_grid
      logoStrip("logos-grid", "logoStrip / logo_grid (static multi-row)", [
        { name: "HubSpot",    src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg", url: "https://hubspot.com" },
        { name: "Salesforce", src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg", url: "https://salesforce.com" },
        { name: "Stripe",     src: "https://cdn.worldvectorlogo.com/logos/stripe-2.svg", url: "https://stripe.com" },
        { name: "Supabase",   src: "https://cdn.worldvectorlogo.com/logos/supabase.svg", url: "https://supabase.com" },
        { name: "Next.js",    src: "https://cdn.worldvectorlogo.com/logos/next-js.svg", url: "https://nextjs.org" },
        { name: "Sanity",     src: "https://cdn.worldvectorlogo.com/logos/sanity.svg", url: "https://sanity.io" },
        { name: "Intercom",   src: "https://cdn.worldvectorlogo.com/logos/intercom-1.svg", url: "https://intercom.com" },
        { name: "Typeform",   src: "https://cdn.worldvectorlogo.com/logos/typeform.svg", url: "https://typeform.com" },
      ], { variant: "logo_grid", grayscale: false, showLabels: true }),

      // ══════════════════════════════════════════════════════════════════════
      // 4. CONTENT BLOCKS
      // textMedia | faqSection | teamSection
      // ══════════════════════════════════════════════════════════════════════

      textSec("cat-content", "text_split", "Block category: Content",
        pt("Content blocks combine media, structured text, team profiles, and FAQ accordions. textMedia handles the image/video + text pattern. faqSection provides accordion Q&A. teamSection renders member cards."),
      ),

      // textMedia / text_media_right
      textMedia("tm-right", "text_media_right",
        "Block: textMedia",
        "textMedia / text_media_right",
        "Image or video appears on the right side of the text panel. Best for landscape images and product screenshots. The body field renders as plain text (not portable text). Supports 1-2 CTA buttons below the body.",
        [{ label: "Primary CTA", href: "#" }, { label: "Secondary CTA", href: "#" }],
        { type: "image", url: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&auto=format&fit=crop&q=80", alt: "Code on a monitor", caption: "Caption appears below the media panel" },
      ),

      // textMedia / text_media_left
      textMedia("tm-left", "text_media_left",
        "Block: textMedia",
        "textMedia / text_media_left",
        "Media panel on the left, text on the right. Good for portrait images or when the visual is the primary focal point. The text block runs right-to-left reading order which can create a pleasant visual rhythm when alternating with text_media_right.",
        [{ label: "Learn more", href: "#" }],
        { type: "image", url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=80", alt: "Abstract technology visual", caption: "Left-aligned media variant" },
      ),

      // textMedia / text_media_stacked
      textMedia("tm-stacked", "text_media_stacked",
        "Block: textMedia",
        "textMedia / text_media_stacked",
        "Text above, media below in a single centered column. Used when you want the full page width for an image or video without splitting the viewport. Works well for product demo videos and wide screenshots that lose detail in a split layout.",
        [{ label: "Watch the demo", href: "#" }],
        { type: "video", url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "YouTube embed via the stacked video variant" },
      ),

      // faqSection / faq_default
      faqSec("faq-default", "faqSection / faq_default", [
        { question: "What is faq_default?", answer: "A single-column accordion layout. Each item expands on click to reveal its answer. This is the standard FAQ layout used for objection handling, support content, and feature explanations." },
        { question: "How many items work best?", answer: "Between 4 and 8. Fewer feels underpopulated; more may be better served by a dedicated FAQ page with search." },
        { question: "Can items link to further reading?", answer: "Yes - the answer field is portable text, so you can include inline links, bold text, and lists within any answer." },
      ]),

      // faqSection / faq_split
      { _type: "faqSection", _key: "faq-split", variant: "faq_split",
        heading: "faqSection / faq_split",
        items: [
          { _key: "fq0", question: "What is faq_split?", answer: "A two-column accordion grid. Items are distributed across two columns which reduces vertical scroll on content-heavy FAQ sections." },
          { _key: "fq1", question: "When should I use faq_split?", answer: "Use faq_split when you have 6 or more FAQ items and want to keep the section compact. The two-column layout works best on desktop; it collapses to a single column on mobile." },
          { _key: "fq2", question: "How does it differ from faq_default?", answer: "The layout is the only difference - two columns instead of one. Content authoring is identical: same question and answer fields, same portable text support." },
          { _key: "fq3", question: "Are both columns equal?", answer: "Yes - items are distributed evenly across both columns, alternating left-right. The column heights may differ slightly depending on answer lengths." },
        ],
      },

      // teamSection / team_grid
      teamSec("team-grid", "teamSection / team_grid", "Three-column card grid of team members. Each card shows the member photo, name, role, and optional bio excerpt. Good for team pages and leadership sections.", [
        { name: "Alex Morgan", role: "Co-founder & CEO", bio: "10 years in B2B SaaS growth. Previously at Intercom and HubSpot.", imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80", linkedinUrl: "https://linkedin.com" },
        { name: "Sam Rivera", role: "Co-founder & CTO", bio: "Built real-time personalisation engines at scale. Former Staff Engineer at Cloudflare.", imageUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&auto=format&fit=crop&q=80", linkedinUrl: "https://linkedin.com" },
        { name: "Jordan Lee", role: "Head of Product", bio: "Obsessed with the intersection of data science and UX. Previously led product at a Series B analytics startup.", imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop&q=80", linkedinUrl: "https://linkedin.com" },
      ]),

      // teamSection / team_compact
      { _type: "teamSection", _key: "team-compact", variant: "team_compact",
        heading: "teamSection / team_compact",
        intro: "Single-column compact list. Avatar, name, and role shown inline on each row. Lower visual footprint than team_grid - useful for advisory boards, large teams, or sidebar placement.",
        members: [
          { _key: "mb0", name: "Alex Morgan", role: "Co-founder & CEO", imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80" },
          { _key: "mb1", name: "Sam Rivera", role: "Co-founder & CTO", imageUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=200&auto=format&fit=crop&q=80" },
          { _key: "mb2", name: "Jordan Lee", role: "Head of Product", imageUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80" },
          { _key: "mb3", name: "Casey Kim", role: "Head of Customer Success", imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80" },
        ],
      },

      // ══════════════════════════════════════════════════════════════════════
      // 5. CONVERSION BLOCKS
      // ctaSection | formSection
      // ══════════════════════════════════════════════════════════════════════

      textSec("cat-conversion", "text_split", "Block category: Conversion",
        pt("Conversion blocks drive visitor action. ctaSection offers multiple CTA layouts from full-bleed banners to compact inline bars. formSection provides contact/lead-capture forms in inline, split, and panel layouts."),
      ),

      // ctaSection / cta_banner
      ctaSec("cta-banner", "ctaSection / cta_banner", "Full-width brand-coloured section with centered heading and 1-2 CTA buttons. The primary high-impact conversion block. Use at the end of key landing page sections.", "Start free trial", "/order/starter"),

      // ctaSection / cta_split
      { _type: "ctaSection", _key: "cta-split", variant: "cta_split",
        title: "ctaSection / cta_split",
        description: "Heading and body text on the left, CTA button group on the right. Good for mid-page conversions where a full-bleed banner would feel too heavy but a text-only mention is too subtle.",
        cta: { label: "Get started", href: "/order/starter" },
      },

      // ctaSection / cta_card
      { _type: "ctaSection", _key: "cta-card", variant: "cta_card",
        title: "ctaSection / cta_card",
        description: "CTA content inside an elevated card on a neutral-background section. Lower visual intensity than cta_banner - lets the surrounding section design breathe. Good for secondary conversion touchpoints.",
        cta: { label: "Book a demo", href: "/demo" },
      },

      // ctaSection / cta_banner_default
      { _type: "ctaSection", _key: "cta-banner-default", variant: "cta_banner_default",
        title: "ctaSection / cta_banner_default",
        description: "Compact horizontal bar on a neutral-subtle background. Title and description on the left, CTAs on the right. Maximum information density with minimum vertical footprint.",
        cta: { label: "See pricing", href: "/pricing" },
      },

      // ctaSection / cta_banner_compact
      { _type: "ctaSection", _key: "cta-banner-compact", variant: "cta_banner_compact",
        title: "ctaSection / cta_banner_compact",
        description: "Notification-bar style on a brand background. Title inline with an inverted CTA button. Maximum compactness - used for alert-style promotions, time-limited offers, and persistent announcement banners.",
        cta: { label: "Claim offer", href: "/order/starter" },
      },

      // ctaSection / cta_glow
      { _type: "ctaSection", _key: "cta-glow", variant: "cta_glow",
        title: "ctaSection / cta_glow",
        description: "Dark near-black section with a subtle brand-coloured radial glow behind the headline. Vivid primary CTA button. Dark AI family signature variant - pairs with dark hero and dark feature grid blocks.",
        cta: { label: "Start free trial", href: "/order/starter" },
      },

      // ctaSection / cta_soft
      { _type: "ctaSection", _key: "cta-soft", variant: "cta_soft",
        title: "ctaSection / cta_soft",
        description: "Very light neutral section with no dramatic background colour. Primary CTA plus ghost secondary. Lets copy carry weight. Clean Corporate family variant - works well after editorial sections.",
        cta: { label: "Start free trial", href: "/order/starter" },
      },

      // formSection / form_inline (default)
      formSec("form-inline", "formSection / form_inline", "Full-width form on a subtle-background section. Heading and intro above, form fields below. The default form layout - suitable for contact pages, demo request pages, and general lead capture.", "contact", "Send message"),

      // formSection / form_split
      { _type: "formSection", _key: "form-split", variant: "form_split",
        title: "formSection / form_split",
        intro: "Introductory heading and supporting copy on the left; form fields on the right. Good for pages where you want to maintain editorial context alongside the form. Converts the full form section into a two-column layout.",
        formKey: "contact",
        submitLabel: "Send message",
        successMessage: "Thank you - we will be in touch within one business day.",
      },

      // formSection / form_panel
      { _type: "formSection", _key: "form-panel", variant: "form_panel",
        title: "formSection / form_panel",
        intro: "Form rendered inside an elevated card container on a neutral-background section. The panel treatment makes the form stand out without requiring the full-width section background treatment. Good for sidebar embedding and mid-content forms.",
        formKey: "contact",
        submitLabel: "Get in touch",
        successMessage: "Thank you - we will be in touch within one business day.",
      },

      // pricingSection / pricing_tiers
      pricingSec("pricing-tiers", "pricingSection / pricing_tiers", "Three transparent pricing tiers for self-serve signup. The middle tier is highlighted as the recommended option.", [
        { _key: "t0", name: "Starter", price: "Free", period: "", description: "For small sites testing personalisation for the first time.", features: ["Up to 1,000 sessions/mo", "3 rules", "1 variant per slot", "Community support"], highlighted: false },
        { _key: "t1", name: "Growth", price: "€49", period: "/month", description: "For growing businesses serious about conversion lift.", features: ["Up to 25,000 sessions/mo", "Unlimited rules", "5 variants per slot", "Company enrichment", "Email support"], highlighted: true, badge: "Most popular" },
        { _key: "t2", name: "Pro", price: "€149", period: "/month", description: "For high-traffic sites and marketing teams.", features: ["Unlimited sessions", "Unlimited rules", "Unlimited variants", "AI layer", "Priority support", "Custom domain"], highlighted: false },
      ]),

      // pricingSection / pricing_compact
      { _type: "pricingSection", _key: "pricing-compact", variant: "pricing_compact",
        heading: "pricingSection / pricing_compact",
        subheading: "Simplified row list layout with lower vertical footprint. Good for secondary pricing references or upgrade banners.",
        tiers: [
          { _key: "t0", name: "Starter", price: "Free", period: "", description: "Small sites.", features: ["1,000 sessions/mo", "3 rules"], highlighted: false },
          { _key: "t1", name: "Growth", price: "€49", period: "/month", description: "Growing teams.", features: ["25,000 sessions/mo", "Unlimited rules"], highlighted: true },
          { _key: "t2", name: "Pro", price: "€149", period: "/month", description: "Enterprise.", features: ["Unlimited sessions", "AI layer"], highlighted: false },
        ],
      },

      // applyPanel / default
      applyPanel("apply-default", "applyPanel / default", "Full-width application CTA section used at the bottom of vacancy detail pages. Renders the vacancy closing date, the primary apply CTA, and a secondary link to view other open roles.", "Apply now", "/jobs"),

      // applyPanel / inline
      { _type: "applyPanel", _key: "apply-inline", variant: "inline",
        heading: "applyPanel / inline",
        body: "Card embedded mid-page. Use when you want to surface the apply CTA part-way through a long vacancy description - before the reader reaches the end of the page.",
        closingDate: "Rolling",
        primaryCta: { label: "Apply now", href: "/jobs" },
        secondaryCta: { label: "View all roles", href: "/jobs" },
        formKey: "application",
      },

      // recruiterPanel / default
      recruiterPanel("recruiter-panel", "recruiterPanel / default", "Recruiter Lennart de Vries", "Head of Talent Acquisition", "I review every application personally. Send me a message if you have questions before applying - I reply to everyone within two working days.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80", "lennart@misterchameleon.io", "+31 20 123 4567"),

      // contactSection / contact_default
      { _type: "contactSection", _key: "contact-default", variant: "contact_default",
        heading: "contactSection / contact_default",
        description: "Stacked contact detail cards on a subtle-background section. Shows address, phone, email, and hours in a clean grid layout.",
        address: "Keizersgracht 241",
        phone: "+31 20 123 4567",
        email: "hello@misterchameleon.io",
        hours: "Mon-Fri 09:00-17:00 CET",
      },

      // contactSection / contact_split
      { _type: "contactSection", _key: "contact-split", variant: "contact_split",
        heading: "contactSection / contact_split",
        description: "Contact details on the left, map embed or image on the right. Good for pages where you want to anchor the address visually.",
        address: "Keizersgracht 241, Amsterdam",
        phone: "+31 20 123 4567",
        email: "hello@misterchameleon.io",
        hours: "Mon-Fri 09:00-17:00 CET",
        mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2436.1!2d4.892!3d52.373!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTLCsDIy!5e0!3m2!1sen!2snl!4v1",
      },

      // contactSection / contact_minimal
      { _type: "contactSection", _key: "contact-minimal", variant: "contact_minimal",
        heading: "contactSection / contact_minimal",
        description: "Compact inline contact row with no section background. Use as a footer strip or between editorial sections where a full contact block would be too heavy.",
        email: "hello@misterchameleon.io",
        phone: "+31 20 123 4567",
      },

      // cartSummary / default
      { _type: "cartSummary", _key: "cart-summary", variant: "cart_summary",
        heading: "cartSummary / default",
        emptyMessage: "Your cart is empty. Browse our plans to get started.",
        checkoutHref: "/order/starter",
        continueShoppingHref: "/pricing",
        checkoutLabel: "Proceed to checkout",
        continueShoppingLabel: "View all plans",
      },

      // checkoutBlock / checkout_default
      { _type: "checkoutBlock", _key: "checkout-block", variant: "checkout_default",
        heading: "checkoutBlock / checkout_default",
        intro: "Multi-step checkout flow with payment and shipping forms. Foundation commerce block - integrators replace the payment step with their own processor embed (Stripe, Mollie, etc.).",
        paymentProvider: "Stripe",
        returnHref: "/dashboard",
        returnLabel: "Go to dashboard",
        planId: "starter",
      },

      // ══════════════════════════════════════════════════════════════════════
      // 6. CONTENT BLOCKS (remaining)
      // about | newsList | listing | articleMeta | articleBody |
      // relatedContent | vacancyMeta | filterBar | search |
      // timeline | quickLinks | productOverview | productDetail | mapBlock
      // ══════════════════════════════════════════════════════════════════════

      textSec("cat-content2", "text_split", "Block category: Content (continued)",
        pt("Remaining content blocks: About/Split media, News list, Listing, Article meta, Article body, Related content, Vacancy meta, Filter bar, Search, Timeline, Quick links, Product overview, Product detail, and Map."),
      ),

      // about / media_right
      { _type: "about", _key: "about-media-right", variant: "media_right",
        heading: "about / media_right",
        body: pt("Split media block with image on the right and text on the left. About/Split media is the narrative version of textMedia - it carries the same image/video placement variants but is intended for brand storytelling, team introductions, and mission sections."),
        imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80",
        imageAlt: "Team working together in a bright open office",
        ctas: [{ _key: "c0", label: "Meet the team", href: "/about-team" }],
      },

      // about / media_left
      { _type: "about", _key: "about-media-left", variant: "media_left",
        heading: "about / media_left",
        body: pt("Image on the left, text on the right. Mirrors media_right - alternate when stacking multiple about blocks to create a visual zigzag rhythm down the page."),
        imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&auto=format&fit=crop&q=80",
        imageAlt: "Developer at a standing desk with monitors",
        ctas: [{ _key: "c0", label: "Our story", href: "/about" }],
      },

      // about / media_full
      { _type: "about", _key: "about-media-full", variant: "media_full",
        heading: "about / media_full",
        body: pt("Full-width image above the text column. Use when the image needs maximum visual impact - a wide team photo, office interior, or product hero shot. The text section sits centred below the image."),
        imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80",
        imageAlt: "Bright modern office interior with open floor plan",
        ctas: [{ _key: "c0", label: "Join the team", href: "/jobs" }],
      },

      // newsList / default (grid)
      { _type: "newsList", _key: "news-default", variant: "default",
        heading: "newsList / default (3-col card grid)",
        items: [
          { title: "Mister Chameleon raises Series A", url: "/blog/series-a", excerpt: "We raised €4.2M to accelerate product development and expand across Europe.", date: "2024-03-15", imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80", category: "Company" },
          { title: "How intent scoring changed our conversion rate", url: "/blog/ip-to-company-enrichment-guide", excerpt: "A deep dive into how we used our own platform to increase demo bookings by 38%.", date: "2024-02-20", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", category: "Product" },
          { title: "The case for adaptive content", url: "/blog/personalisation-without-cookies", excerpt: "Why personalisation matters more than ever - and how to do it without compromising privacy.", date: "2024-01-10", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", category: "Strategy" },
        ],
      },

      // newsList / list
      { _type: "newsList", _key: "news-list", variant: "list",
        heading: "newsList / list (single-column rows)",
        items: [
          { title: "Mister Chameleon raises Series A", url: "/blog/series-a", excerpt: "We raised €4.2M to accelerate product development and expand across Europe.", date: "2024-03-15", category: "Company" },
          { title: "How intent scoring changed our conversion rate", url: "/blog/ip-to-company-enrichment-guide", excerpt: "A deep dive into how we used our own platform to increase demo bookings by 38%.", date: "2024-02-20", category: "Product" },
          { title: "The case for adaptive content", url: "/blog/personalisation-without-cookies", excerpt: "Why personalisation matters more than ever.", date: "2024-01-10", category: "Strategy" },
        ],
      },

      // newsList / news_slider
      { _type: "newsList", _key: "news-slider", variant: "news_slider",
        heading: "newsList / news_slider (card carousel)",
        items: [
          { title: "Series A announcement", url: "/blog/series-a", excerpt: "We raised €4.2M.", date: "2024-03-15", imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80", category: "Company" },
          { title: "Intent scoring results", url: "/blog/ip-to-company-enrichment-guide", excerpt: "38% more demo bookings.", date: "2024-02-20", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", category: "Product" },
          { title: "Adaptive content guide", url: "/blog/personalisation-without-cookies", excerpt: "Privacy-first personalisation.", date: "2024-01-10", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", category: "Strategy" },
          { title: "New integrations released", url: "/blog/series-a", excerpt: "HubSpot, Salesforce, and 5 more.", date: "2023-12-01", imageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600&auto=format&fit=crop&q=80", category: "Product" },
        ],
      },

      // listing / listing_cards
      { _type: "listing", _key: "listing-cards", variant: "listing_cards",
        heading: "listing / listing_cards (3-col card grid)",
        viewAllHref: "/cases",
        viewAllLabel: "View all cases",
        items: [
          { id: "lc0", title: "Growlytics - 34% lift in enterprise leads", href: "/cases/growlytics", excerpt: "How Growlytics used company enrichment to show personalised hero copy for Fortune 500 visitors.", imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&auto=format&fit=crop&q=80", category: "B2B SaaS" },
          { id: "lc1", title: "JobBridge - serving both sides of hiring", href: "/cases/jobbridge", excerpt: "Employers and job seekers now see completely different homepage experiences.", imageUrl: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&auto=format&fit=crop&q=80", category: "Recruitment" },
          { id: "lc2", title: "Frontline Agency - 3 clients, 1 platform", href: "/cases/frontline-agency", excerpt: "White-label personalisation for three retail clients under a single agency contract.", imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&fit=crop&q=80", category: "Agency" },
        ],
      },

      // listing / listing_rows
      { _type: "listing", _key: "listing-rows", variant: "listing_rows",
        heading: "listing / listing_rows (single-column rows)",
        items: [
          { id: "lr0", title: "Growlytics - 34% lift in enterprise leads", href: "/cases/growlytics", excerpt: "How Growlytics used company enrichment to show personalised hero copy for Fortune 500 visitors.", category: "B2B SaaS", date: "2024-02-01" },
          { id: "lr1", title: "JobBridge - serving both sides of hiring", href: "/cases/jobbridge", excerpt: "Employers and job seekers now see completely different homepage experiences.", category: "Recruitment", date: "2024-01-15" },
        ],
      },

      // listing / listing_slider
      { _type: "listing", _key: "listing-slider", variant: "listing_slider",
        heading: "listing / listing_slider (horizontal carousel)",
        items: [
          { id: "ls0", title: "Growlytics", href: "/cases/growlytics", excerpt: "34% lift in enterprise leads.", imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&auto=format&fit=crop&q=80", category: "B2B SaaS" },
          { id: "ls1", title: "JobBridge", href: "/cases/jobbridge", excerpt: "Two audiences, one platform.", imageUrl: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&auto=format&fit=crop&q=80", category: "Recruitment" },
          { id: "ls2", title: "Frontline Agency", href: "/cases/frontline-agency", excerpt: "3 clients, 1 platform.", imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&auto=format&fit=crop&q=80", category: "Agency" },
        ],
      },

      // articleMeta / default
      articleMeta("article-meta-default", "articleMeta / default - editorial metadata row", "2024-03-15", { name: "Sarah Chen", role: "Head of Growth", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80" }, "Strategy", 8, "A metadata row with publication date, author attribution, reading time, and category label. Sits at the top of article detail pages before the body.", "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80", ["Personalisation", "Strategy"]),

      // articleMeta / compact
      { _type: "articleMeta", _key: "article-meta-compact", variant: "compact",
        title: "articleMeta / compact - inline pill-row",
        publishedAt: "2024-02-20",
        category: "Product",
        readingTime: 5,
        summary: "Compact pill-row variant with reduced vertical footprint. Author, date, reading time, and category appear inline on a single row with pill-style badges.",
        author: { name: "Marcus Reyes", role: "VP Marketing", avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=80&auto=format&fit=crop&q=80" },
      },

      // articleMeta / hero
      { _type: "articleMeta", _key: "article-meta-hero", variant: "hero",
        title: "articleMeta / hero - full-bleed cover with overlaid metadata",
        publishedAt: "2024-01-10",
        category: "Company",
        readingTime: 12,
        summary: "Full-bleed cover image with the article title, author, and metadata overlaid on a darkened gradient. Maximum visual impact for featured or hero articles.",
        coverImageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&auto=format&fit=crop&q=80",
        author: { name: "Jordan Lee", role: "Founder", avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&auto=format&fit=crop&q=80" },
      },

      // articleBody / default
      articleBody("article-body-default", pt(
        "articleBody / default - standard prose column. The primary editorial body renderer for blog posts and long-form articles.",
        "Renders headings, paragraphs, bold, italic, ordered and unordered lists, blockquotes, inline code, and code blocks from portable text data.",
        "Semantically distinct from richText: articleBody is scoped to article detail pages and carries the semantic weight of being the main reading body. The narrow (~70ch) prose column improves legibility for long-form reading.",
      )),

      // articleBody / wide
      { _type: "articleBody", _key: "article-body-wide", variant: "wide",
        body: pt("articleBody / wide - full content-column width instead of the narrow prose column. Use for documentation, technical guides, and reference material where tables, code blocks, and diagrams need more horizontal space."),
      },

      // relatedContent / default (grid)
      relatedContent("related-default", "relatedContent / default (3-col card grid)", [
        { title: "Growlytics case study", href: "/cases/growlytics", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&auto=format&fit=crop&q=80", description: "How Growlytics achieved a 34% lift in enterprise leads." },
        { title: "Intent scoring guide", href: "/blog/ip-to-company-enrichment-guide", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", description: "Everything you need to know about scoring visitor intent." },
        { title: "Privacy-first personalisation", href: "/blog/personalisation-without-cookies", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", description: "Personalise without compromising GDPR compliance." },
      ]),

      // relatedContent / list
      { _type: "relatedContent", _key: "related-list", variant: "list",
        heading: "relatedContent / list (single-column rows)",
        items: [
          { _key: "rc0", id: "rl0", title: "Growlytics case study", href: "/cases/growlytics", excerpt: "How Growlytics achieved a 34% lift in enterprise leads." },
          { _key: "rc1", id: "rl1", title: "Intent scoring guide", href: "/blog/ip-to-company-enrichment-guide", excerpt: "Everything you need to know about scoring visitor intent." },
        ],
      },

      // relatedContent / related_slider
      { _type: "relatedContent", _key: "related-slider", variant: "related_slider",
        heading: "relatedContent / related_slider (card carousel)",
        items: [
          { _key: "rc0", id: "rs0", title: "Growlytics case study", href: "/cases/growlytics", imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&auto=format&fit=crop&q=80", excerpt: "34% lift in enterprise leads." },
          { _key: "rc1", id: "rs1", title: "Intent scoring guide", href: "/blog/ip-to-company-enrichment-guide", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", excerpt: "Score visitor intent in real time." },
          { _key: "rc2", id: "rs2", title: "Privacy-first personalisation", href: "/blog/personalisation-without-cookies", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", excerpt: "GDPR-compliant by design." },
        ],
      },

      // vacancyMeta / default
      vacancyMeta("vacancy-meta-default", "vacancyMeta / default - job metadata card", "Engineering", "Amsterdam / Remote", "Full-time", "€70k-90k", "40h", "Senior"),

      // vacancyMeta / compact
      { _type: "vacancyMeta", _key: "vacancy-meta-compact", variant: "compact",
        title: "vacancyMeta / compact - condensed badge strip",
        department: "Product",
        location: "Remote",
        remote: "Remote-first",
        contractType: "Full-time",
        startDate: "As soon as possible",
        closingDate: "Rolling",
      },

      // filterBar / default
      { _type: "filterBar", _key: "filter-bar-default", variant: "default",
        heading: "filterBar / default",
        filters: [
          { _key: "f0", id: "category", label: "Category", type: "select", options: [{ _key: "o0", value: "all", label: "All" }, { _key: "o1", value: "b2b", label: "B2B SaaS" }, { _key: "o2", value: "ecom", label: "E-commerce" }] },
          { _key: "f1", id: "size", label: "Company size", type: "select", options: [{ _key: "o0", value: "all", label: "All sizes" }, { _key: "o1", value: "smb", label: "SMB" }, { _key: "o2", value: "enterprise", label: "Enterprise" }] },
        ],
      },

      // search / default
      { _type: "search", _key: "search-block", variant: "search_default",
        heading: "search / default",
        placeholder: "Search documentation, blog posts, and case studies...",
        enableSuggestions: true,
      },

      // timeline / timeline_vertical
      { _type: "timeline", _key: "timeline-vertical", variant: "timeline_vertical",
        heading: "timeline / timeline_vertical",
        description: "Stacked vertical timeline with alternating content panels - the default layout. Suitable for company history, product roadmaps, and onboarding sequences.",
        items: [
          { _key: "ti0", id: "tv0", title: "Founded in Amsterdam", date: "2021", description: "Mister Chameleon started as a side project: what if every visitor saw a different version of your site - the right one for them?", icon: "rocket" },
          { _key: "ti1", id: "tv1", title: "First paying customers", date: "Q1 2022", description: "Ten B2B SaaS companies signed up in the first month. The rules engine shipped with three segment types and zero-code setup.", icon: "users" },
          { _key: "ti2", id: "tv2", title: "Company enrichment launched", date: "Q3 2022", description: "IP-to-company enrichment went live. Visitors from recognised company networks now trigger industry-matched hero variants automatically.", icon: "building" },
          { _key: "ti3", id: "tv3", title: "Series A - €4.2M", date: "March 2024", description: "Raised €4.2M to build the AI personalisation layer and expand across Europe.", icon: "trending-up" },
        ],
      },

      // timeline / timeline_compact
      { _type: "timeline", _key: "timeline-compact", variant: "timeline_compact",
        heading: "timeline / timeline_compact",
        description: "Tight single-column list with lower vertical footprint. Use when you need to show 6+ milestones without dominating the page layout.",
        items: [
          { _key: "ti0", id: "tc0", title: "Founded", date: "2021" },
          { _key: "ti1", id: "tc1", title: "First 10 customers", date: "Q1 2022" },
          { _key: "ti2", id: "tc2", title: "Company enrichment", date: "Q3 2022" },
          { _key: "ti3", id: "tc3", title: "100 active tenants", date: "2023" },
          { _key: "ti4", id: "tc4", title: "Series A", date: "2024" },
        ],
      },

      // timeline / timeline_milestones
      { _type: "timeline", _key: "timeline-milestones", variant: "timeline_milestones",
        heading: "timeline / timeline_milestones",
        description: "Icon and date emphasis - suitable for company history pages and roadmap previews where the dates are the primary anchor and descriptions are secondary.",
        items: [
          { _key: "ti0", id: "tm0", title: "Company founded", date: "2021", description: "Amsterdam, Netherlands.", icon: "flag" },
          { _key: "ti1", id: "tm1", title: "Series A closed", date: "2024", description: "€4.2M raised.", icon: "star" },
          { _key: "ti2", id: "tm2", title: "AI layer launched", date: "2024 Q3", description: "Live personalisation via LLM decision engine.", icon: "cpu" },
        ],
      },

      // quickLinks / quicklinks_grid
      quickLinks("ql-grid", "quickLinks / quicklinks_grid", "Icon and label card grid - the default. Use for navigation hubs, service directories, and resource overview pages where visual scanability matters.", [
        { label: "Documentation", href: "/docs", description: "Setup guides, API reference, and how-to articles.", icon: "book" },
        { label: "Case studies", href: "/cases", description: "Real results from real customers.", icon: "bar-chart" },
        { label: "Pricing", href: "/pricing", description: "Simple plans, transparent pricing.", icon: "credit-card" },
        { label: "Book a demo", href: "/demo", description: "See Mister Chameleon live on a real site.", icon: "play" },
        { label: "Changelog", href: "/changelog", description: "What we shipped this month.", icon: "clock" },
        { label: "Contact", href: "/contact", description: "Talk to a human.", icon: "mail" },
      ]),

      // quickLinks / quicklinks_list
      { _type: "quickLinks", _key: "ql-list", variant: "quicklinks_list",
        heading: "quickLinks / quicklinks_list",
        description: "Single-column link list. Use when you have 4-8 links that each need a short description but a grid would feel too heavy.",
        links: [
          { _key: "l0", id: "ll0", label: "Documentation", href: "/docs", description: "Setup guides, API reference, and how-to articles.", icon: "book" },
          { _key: "l1", id: "ll1", label: "Case studies", href: "/cases", description: "Real results from real customers.", icon: "bar-chart" },
          { _key: "l2", id: "ll2", label: "Pricing", href: "/pricing", description: "Simple plans, transparent pricing.", icon: "credit-card" },
          { _key: "l3", id: "ll3", label: "Contact", href: "/contact", description: "Talk to a human.", icon: "mail" },
        ],
      },

      // quickLinks / quicklinks_compact
      { _type: "quickLinks", _key: "ql-compact", variant: "quicklinks_compact",
        heading: "quickLinks / quicklinks_compact",
        description: "Dense tight grid with labels only - no descriptions. Use for 8+ quick links where description text would create too much noise.",
        links: [
          { _key: "l0", id: "qc0", label: "Docs", href: "/docs", icon: "book" },
          { _key: "l1", id: "qc1", label: "Blog", href: "/blog", icon: "file-text" },
          { _key: "l2", id: "qc2", label: "Cases", href: "/cases", icon: "briefcase" },
          { _key: "l3", id: "qc3", label: "Pricing", href: "/pricing", icon: "credit-card" },
          { _key: "l4", id: "qc4", label: "Demo", href: "/demo", icon: "play" },
          { _key: "l5", id: "qc5", label: "Contact", href: "/contact", icon: "mail" },
          { _key: "l6", id: "qc6", label: "Jobs", href: "/jobs", icon: "users" },
        ],
      },

      // productOverview / product_cards
      { _type: "productOverview", _key: "product-overview", variant: "product_cards",
        heading: "productOverview / product_cards",
        intro: "Product catalogue grid with card layout. Each card shows the product image, name, price, and an add-to-cart or view-detail CTA.",
        showPrices: true,
        products: [
          { _key: "p0", id: "po0", name: "Starter Plan", price: "Free", imageUrl: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80", description: "Perfect for small sites testing personalisation.", href: "/order/starter" },
          { _key: "p1", id: "po1", name: "Growth Plan", price: "€49/mo", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", description: "For growing businesses serious about conversion lift.", href: "/order/growth" },
          { _key: "p2", id: "po2", name: "Pro Plan", price: "€149/mo", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", description: "For high-traffic sites and marketing teams.", href: "/order/pro" },
        ],
      },

      // productDetail / product_detail
      { _type: "productDetail", _key: "product-detail", variant: "product_detail",
        title: "productDetail / product_detail",
        description: "Single product detail view: gallery on one side, title, description, specs, price, and CTA on the other. Full-width variant below the fold. Foundation commerce block.",
        price: "€49/month",
        gallery: [
          { url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80", alt: "Product screenshot - analytics dashboard" },
          { url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80", alt: "Product screenshot - rules builder" },
        ],
        specs: [
          { _key: "s0", label: "Sessions/month", value: "25,000" },
          { _key: "s1", label: "Rules", value: "Unlimited" },
          { _key: "s2", label: "Variants per slot", value: "5" },
          { _key: "s3", label: "Support", value: "Email" },
        ],
        cta: { label: "Get Growth plan", href: "/order/growth" },
        secondaryCta: { label: "Compare all plans", href: "/pricing" },
      },

      // mapBlock / default
      mapBlock("map-block", "mapBlock / default", "Keizersgracht 241", "Amsterdam", "Netherlands", "hello@misterchameleon.io", "+31 20 123 4567", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2436.1!2d4.892!3d52.373!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTLCsDIy!5e0!3m2!1sen!2snl!4v1"),

      // ══════════════════════════════════════════════════════════════════════
      // 7. MISSING VARIANTS — premium family + additional layout variants
      // ══════════════════════════════════════════════════════════════════════

      textSec("cat-missing", "text_split", "Block category: Additional variants",
        pt("Premium family variants and additional layout options for blocks already shown above. These include dark/spacious feature grids, featured-image testimonials, media-first and newsletter CTAs, logo wall, pricing table, compact listing, carousel, sidebar vacancy meta, compact/expanded filter bar, sticky apply panel, processSteps layout variants, recruiterPanel compact and card, and searchResults."),
      ),

      // ── featureGrid ────────────────────────────────────────────────────────

      // featureGrid / feature_grid_dark
      { _type: "featureGrid", _key: "fg-dark", variant: "feature_grid_dark",
        heading: "featureGrid / feature_grid_dark",
        features: [
          { _key: "f0", title: "Dark section surface", description: "3-col grid on a near-black section background. Icon badges use brand-tinted glow rings. Dark AI family signature variant.", icon: "moon" },
          { _key: "f1", title: "Glow icon badges", description: "Each icon sits inside a subtle radial glow matching the brand accent. Adds depth without heavy decoration.", icon: "zap" },
          { _key: "f2", title: "Pairs with dark hero", description: "Use together with hero_minimal_dark and cta_glow for a fully dark-themed page section stack.", icon: "layers" },
        ],
      },

      // featureGrid / feature_grid_spacious
      { _type: "featureGrid", _key: "fg-spacious", variant: "feature_grid_spacious",
        heading: "featureGrid / feature_grid_spacious",
        features: [
          { _key: "f0", title: "Extra vertical padding", description: "Each card carries more breathing room than feature_grid_3up. Very subtle shadow, no card borders — whitespace does the visual separation work.", icon: "maximize" },
          { _key: "f1", title: "Clean Corporate family", description: "Designed for light-background pages where generous whitespace signals quality and confidence.", icon: "check-circle" },
          { _key: "f2", title: "Same data shape", description: "Author the same icon, title, and description fields as any other featureGrid variant. Only layout and spacing change.", icon: "copy" },
        ],
      },

      // ── testimonialSection ────────────────────────────────────────────────

      // testimonialSection / testimonial_featured_image
      { _type: "testimonialSection", _key: "tm-featured-image", variant: "testimonial_featured_image",
        heading: "testimonialSection / testimonial_featured_image",
        testimonials: [
          { _key: "t0", quote: "Large featured quote with author photo displayed alongside — not just a small avatar. The image gives the testimonial a face and adds credibility anchoring that text-only variants lack.", author: "Elena Sørensen", role: "Chief Revenue Officer", company: "Meridian SaaS", imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&auto=format&fit=crop&q=80" },
          { _key: "t1", quote: "Secondary supporting quote sits below the featured item in a compact card row.", author: "Tom Walsh", role: "CEO", company: "Conversion Co" },
        ],
      },

      // ── ctaSection ────────────────────────────────────────────────────────

      // ctaSection / cta_media_first
      { _type: "ctaSection", _key: "cta-media-first", variant: "cta_media_first",
        title: "ctaSection / cta_media_first",
        description: "Full-bleed background image with CTA content overlaid on a darkened gradient. Maximum visual impact — use for hero-scale CTAs mid-page or at section transitions where you want a cinematic pause.",
        cta: { label: "Start free trial", href: "/order/starter" },
        imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&auto=format&fit=crop&q=80",
      },

      // ctaSection / cta_newsletter
      { _type: "ctaSection", _key: "cta-newsletter", variant: "cta_newsletter",
        title: "ctaSection / cta_newsletter",
        description: "Inline email capture — heading on the left, single email input and submit button on the right. No separate href-based CTA: the form action drives conversion. Content Blog family variant.",
        formKey: "newsletter",
        submitLabel: "Subscribe",
        successMessage: "Thanks for subscribing - you will hear from us soon.",
      },

      // ── logoStrip ─────────────────────────────────────────────────────────

      // logoStrip / logo_wall_light
      logoStrip("logos-wall-light", "logoStrip / logo_wall_light", [
        { name: "HubSpot",    src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg" },
        { name: "Salesforce", src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg" },
        { name: "Stripe",     src: "https://cdn.worldvectorlogo.com/logos/stripe-2.svg" },
        { name: "Supabase",   src: "https://cdn.worldvectorlogo.com/logos/supabase.svg" },
        { name: "Next.js",    src: "https://cdn.worldvectorlogo.com/logos/next-js.svg" },
        { name: "Sanity",     src: "https://cdn.worldvectorlogo.com/logos/sanity.svg" },
        { name: "Intercom",   src: "https://cdn.worldvectorlogo.com/logos/intercom-1.svg" },
        { name: "Typeform",   src: "https://cdn.worldvectorlogo.com/logos/typeform.svg" },
      ], { variant: "logo_wall_light", grayscale: false, showLabels: true }),

      // ── pricingSection ────────────────────────────────────────────────────

      // pricingSection / pricing_table
      { _type: "pricingSection", _key: "pricing-table", variant: "pricing_table",
        heading: "pricingSection / pricing_table",
        subheading: "Comparison table layout — tiers as columns, features as rows. Lets prospects check off exactly which capabilities they need before choosing a plan.",
        tiers: [
          { _key: "t0", name: "Starter", price: "Free",    period: "",        description: "Small sites.",   features: ["1,000 sessions/mo", "3 rules", "1 variant per slot"], highlighted: false },
          { _key: "t1", name: "Growth",  price: "€49",     period: "/month",  description: "Growing teams.", features: ["25,000 sessions/mo", "Unlimited rules", "5 variants per slot", "Company enrichment", "Email support"], highlighted: true, badge: "Most popular" },
          { _key: "t2", name: "Pro",     price: "€149",    period: "/month",  description: "Enterprise.",   features: ["Unlimited sessions", "Unlimited rules", "Unlimited variants", "AI layer", "Priority support", "Custom domain"], highlighted: false },
        ],
      },

      // ── newsList ──────────────────────────────────────────────────────────

      // newsList / featured
      { _type: "newsList", _key: "news-featured", variant: "featured",
        heading: "newsList / featured (hero card + smaller grid)",
        items: [
          { title: "Mister Chameleon raises Series A", url: "/blog/series-a", excerpt: "We raised €4.2M to accelerate product development and expand across Europe. The first item is displayed large — this is your editorial hero article.", date: "2024-03-15", imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=900&auto=format&fit=crop&q=80", category: "Company" },
          { title: "Intent scoring deep dive", url: "/blog/ip-to-company-enrichment-guide", excerpt: "How we used our own platform to increase demo bookings by 38%.", date: "2024-02-20", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", category: "Product" },
          { title: "The case for adaptive content", url: "/blog/personalisation-without-cookies", excerpt: "Privacy-first personalisation strategy for modern B2B sites.", date: "2024-01-10", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", category: "Strategy" },
        ],
      },

      // ── listing ───────────────────────────────────────────────────────────

      // listing / listing_compact
      { _type: "listing", _key: "listing-compact", variant: "listing_compact",
        heading: "listing / listing_compact (dense reduced-padding list)",
        items: [
          { id: "lcp0", title: "Growlytics", href: "/cases/growlytics", excerpt: "34% lift in enterprise leads.", category: "B2B SaaS", date: "2024-02-01" },
          { id: "lcp1", title: "JobBridge", href: "/cases/jobbridge", excerpt: "Two audiences, one personalised homepage.", category: "Recruitment", date: "2024-01-15" },
          { id: "lcp2", title: "Frontline Agency", href: "/cases/frontline-agency", excerpt: "3 clients on a single white-label platform.", category: "Agency", date: "2023-12-01" },
          { id: "lcp3", title: "NordTech", href: "/cases/nordtech", excerpt: "Enterprise product tour personalised by intent score.", category: "Enterprise", date: "2023-11-01" },
        ],
      },

      // ── relatedContent ────────────────────────────────────────────────────

      // relatedContent / carousel
      { _type: "relatedContent", _key: "related-carousel", variant: "carousel",
        heading: "relatedContent / carousel (horizontal scroll strip)",
        items: [
          { _key: "rc0", id: "car0", title: "Growlytics case study", href: "/cases/growlytics", imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&auto=format&fit=crop&q=80", excerpt: "34% lift in enterprise leads." },
          { _key: "rc1", id: "car1", title: "Intent scoring guide", href: "/blog/ip-to-company-enrichment-guide", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80", excerpt: "Score visitor intent in real time." },
          { _key: "rc2", id: "car2", title: "Privacy-first personalisation", href: "/blog/personalisation-without-cookies", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80", excerpt: "GDPR-compliant personalisation." },
          { _key: "rc3", id: "car3", title: "Series A announcement", href: "/blog/series-a", imageUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80", excerpt: "€4.2M raised to build the AI layer." },
        ],
      },

      // ── vacancyMeta ───────────────────────────────────────────────────────

      // vacancyMeta / sidebar
      { _type: "vacancyMeta", _key: "vacancy-meta-sidebar", variant: "sidebar",
        title: "vacancyMeta / sidebar — float-right card for two-column detail layout",
        department: "Engineering",
        location: "Amsterdam / Remote",
        remote: "Hybrid",
        contractType: "Full-time",
        salary: "€80k–100k",
        hoursPerWeek: "40h",
        experienceLevel: "Senior",
        startDate: "ASAP",
        closingDate: "Rolling",
      },

      // ── filterBar ─────────────────────────────────────────────────────────

      // filterBar / compact
      { _type: "filterBar", _key: "filter-bar-compact", variant: "compact",
        heading: "filterBar / compact (icon-driven collapsed filter bar)",
        filters: [
          { _key: "f0", id: "category", label: "Category", type: "select", options: [{ _key: "o0", value: "all", label: "All" }, { _key: "o1", value: "b2b", label: "B2B SaaS" }, { _key: "o2", value: "ecom", label: "E-commerce" }] },
          { _key: "f1", id: "region",   label: "Region",   type: "select", options: [{ _key: "o0", value: "all", label: "All" }, { _key: "o1", value: "eu", label: "Europe" }, { _key: "o2", value: "us", label: "North America" }] },
        ],
      },

      // filterBar / expanded
      { _type: "filterBar", _key: "filter-bar-expanded", variant: "expanded",
        heading: "filterBar / expanded (all filters visible without interaction)",
        filters: [
          { _key: "f0", id: "category",    label: "Category",     type: "select", options: [{ _key: "o0", value: "all", label: "All" }, { _key: "o1", value: "b2b", label: "B2B SaaS" }, { _key: "o2", value: "ecom", label: "E-commerce" }] },
          { _key: "f1", id: "region",      label: "Region",       type: "select", options: [{ _key: "o0", value: "all", label: "All regions" }, { _key: "o1", value: "eu", label: "Europe" }, { _key: "o2", value: "us", label: "North America" }] },
          { _key: "f2", id: "companySize", label: "Company size", type: "select", options: [{ _key: "o0", value: "all", label: "All sizes" }, { _key: "o1", value: "smb", label: "SMB" }, { _key: "o2", value: "enterprise", label: "Enterprise" }] },
        ],
      },

      // ── applyPanel ────────────────────────────────────────────────────────

      // applyPanel / sticky
      { _type: "applyPanel", _key: "apply-sticky", variant: "sticky",
        heading: "applyPanel / sticky",
        body: "Sticky sidebar card fixed to the right column on desktop. Stays visible as the visitor scrolls through the vacancy description — removes friction from the application CTA by keeping it always in view.",
        closingDate: "Rolling",
        primaryCta: { label: "Apply now", href: "/jobs" },
        secondaryCta: { label: "View all roles", href: "/jobs" },
        formKey: "application",
      },

      // ── processSteps ──────────────────────────────────────────────────────

      // processSteps / accordion
      { _type: "processSteps", _key: "proc-accordion", variant: "accordion",
        heading: "processSteps / accordion",
        intro: "Each step is a collapsible details/summary element. Good for longer descriptions where showing all content at once creates a wall of text.",
        steps: [
          { _key: "s0", title: "Connect your CMS", description: "Point Mister Chameleon at your Sanity, Storyblok, or Statamic project. Takes under five minutes with the guided setup wizard.", duration: "5 minutes" },
          { _key: "s1", title: "Define your segments", description: "Use the rules builder to create visitor segments — by source, intent score, company, or behaviour. No developer needed.", duration: "10 minutes" },
          { _key: "s2", title: "Create content variants", description: "Write alternative hero headlines, CTAs, and proof blocks for each segment inside your CMS.", duration: "20 minutes" },
          { _key: "s3", title: "Go live", description: "Enable the decision engine. Your first personalised session runs within seconds.", duration: "1 minute" },
        ],
      },

      // processSteps / compact
      { _type: "processSteps", _key: "proc-compact", variant: "compact",
        heading: "processSteps / compact",
        intro: "Tight inline numbered list. Lower vertical footprint than the default. Best for 3–4 steps where brief labels are sufficient without full descriptions.",
        steps: [
          { _key: "s0", title: "Connect your CMS", duration: "5 min" },
          { _key: "s1", title: "Define segments",   duration: "10 min" },
          { _key: "s2", title: "Create variants",   duration: "20 min" },
          { _key: "s3", title: "Go live",           duration: "1 min" },
        ],
      },

      // processSteps / horizontal
      { _type: "processSteps", _key: "proc-horizontal", variant: "horizontal",
        heading: "processSteps / horizontal",
        intro: "Horizontal step track with a connecting line and numbered nodes. Ideal for short 3–5 step flows on landing pages where a vertical list would feel too heavy.",
        steps: [
          { _key: "s0", title: "Connect",  description: "Link your CMS in under 5 minutes.", duration: "5 min" },
          { _key: "s1", title: "Segment",  description: "Define visitor groups with the rules builder.", duration: "10 min" },
          { _key: "s2", title: "Variant",  description: "Author content variants in your CMS.", duration: "20 min" },
          { _key: "s3", title: "Launch",   description: "Go live with the decision engine.", duration: "1 min" },
        ],
      },

      // ── recruiterPanel ────────────────────────────────────────────────────

      // recruiterPanel / compact
      { _type: "recruiterPanel", _key: "recruiter-compact", variant: "compact",
        heading: "recruiterPanel / compact",
        name: "Lennart de Vries",
        role: "Head of Talent",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
        email: "lennart@misterchameleon.io",
        phone: "+31 20 123 4567",
      },

      // recruiterPanel / card
      { _type: "recruiterPanel", _key: "recruiter-card", variant: "card",
        heading: "recruiterPanel / card",
        name: "Lennart de Vries",
        role: "Head of Talent Acquisition",
        bio: "I review every application personally. Elevated card style — stands out when placed as a standalone block between editorial sections rather than inline within the vacancy description.",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
        email: "lennart@misterchameleon.io",
        phone: "+31 20 123 4567",
      },

      // ── searchResults ─────────────────────────────────────────────────────

      // searchResults / grid
      { _type: "searchResults", _key: "search-results-grid", variant: "grid",
        heading: "searchResults / grid",
        emptyMessage: "No results yet - enter a search term above.",
        itemsPerPage: 9,
        enableSearch: true,
        enableFilter: true,
      },

      // searchResults / list
      { _type: "searchResults", _key: "search-results-list", variant: "list",
        heading: "searchResults / list",
        emptyMessage: "No results yet - enter a search term above.",
        itemsPerPage: 10,
        enableSearch: true,
        enableFilter: true,
      },

    ],
    // contextConfig — drives the hero, proof, and CTA context blocks that render
    // above and below these content blocks via the marketing-page template slots.
    // Switch the Scenario Control panel to see these blocks adapt.
    { hero: { fallbackVariantKey: "hero_page_banner" }, proof: { fallbackVariantKey: "proof_stats" } },
  ),

];

// ══════════════════════════════════════════════════════════════════════════════
//
// ── Navigation items ──────────────────────────────────────────────────────────
//
// Two kinds of records:
//   • Leaf navItems  - point to a single page (used as dropdown children)
//   • Group navItems - top-level items that carry a `children` array
//
// ID convention matches tenant-provisioner.ts:
//   navItem_mister-chameleon_<slug-with-hyphens>
//
// Group items use a "nav-" prefix so their _id never collides with the leaf
// items that share the same slug (e.g. "nav-product" ≠ "features").

const NAV_TENANT = "mister-chameleon";

/** Stable _id for a nav item. */
function nid(slug: string): string {
  return `navItem_${NAV_TENANT}_${slug}`;
}

/** Reference entry for use inside a `children` or `mainNavigation` array. */
function nref(slug: string, key: string): Record<string, unknown> {
  return { _type: "reference", _ref: nid(slug), _key: key };
}

/** Leaf navigationItem - links to a single page doc. */
function navLeaf(
  slug:        string,
  label:       string,
  pageId:      string,
  description?: string,
): Record<string, unknown> {
  return {
    _id:          nid(slug),
    _type:        "navigationItem",
    tenantId:     NAV_TENANT,
    label,
    linkType:     "internal",
    internalPage: { _type: "reference", _ref: `mister-chameleon_page_${pageId}` },
    ...(description ? { description } : {}),
  };
}

/** External navigationItem - links to an absolute URL. */
function navLeafExternal(
  slug:        string,
  label:       string,
  url:         string,
  opts?: { openInNewTab?: boolean; description?: string },
): Record<string, unknown> {
  return {
    _id:          nid(slug),
    _type:        "navigationItem",
    tenantId:     NAV_TENANT,
    label,
    linkType:     "external",
    externalUrl:  url,
    openInNewTab: opts?.openInNewTab ?? false,
    ...(opts?.description ? { description: opts.description } : {}),
  };
}

/** Group navigationItem - links to an overview page and shows a dropdown. */
function navGroup(
  groupSlug:  string,
  label:      string,
  pageId:     string,
  childSlugs: string[],
): Record<string, unknown> {
  return {
    _id:          nid(groupSlug),
    _type:        "navigationItem",
    tenantId:     NAV_TENANT,
    label,
    linkType:     "internal",
    internalPage: { _type: "reference", _ref: `mister-chameleon_page_${pageId}` },
    children:     childSlugs.map((s, i) => nref(s, `${groupSlug}_c${i}`)),
  };
}

// ── Leaf items (dropdown children) ─────────────────────────────────────────────

const navLeaves: Record<string, unknown>[] = [
  // - Product -
  navLeaf("features",               "Features",              "features",               "Everything you can do with Mister Chameleon"),
  navLeaf("features-segments",      "Audience Segments",     "features-segments",      "Group visitors by behaviour and attributes"),
  navLeaf("features-intent",        "Intent Scoring",        "features-intent",        "Score every visitor's purchase intent in real time"),
  navLeaf("features-enrichment",    "Enrichment",            "features-enrichment",    "Enrich anonymous visitors with company data"),
  navLeaf("features-testing",       "A/B & Multivariate",    "features-testing",       "Run experiments on any page element"),
  navLeaf("features-analytics",     "Analytics",             "features-analytics",     "Understand what drives conversions"),
  navLeaf("features-agency",        "Agency & White-Label",  "features-agency",        "Resell personalisation under your own brand"),
  navLeaf("integrations",           "Integrations",          "integrations",           "Connect your CRM, CMS, and data stack"),
  navLeaf("security",               "Security & GDPR",       "security",               "Privacy-first, EU data residency"),
  // - How It Works -
  navLeaf("how-it-works",           "How It Works",          "how-it-works"),
  navLeaf("the-engine",             "The Engine",            "the-engine",             "How the decision engine works under the hood"),
  navLeaf("why-personalisation",    "Why Personalisation?",  "why-personalisation"),
  // - Demo -
  navLeaf("demo",                   "Live Demo",             "demo",                   "See Mister Chameleon in action on a live site"),
  navLeaf("demo-controls",          "Scenario Controls",     "demo-controls",          "All demo scenarios you can activate"),
  // - Pricing -
  navLeaf("pricing",                "Pricing",               "pricing"),
  navLeaf("pricing-add-ons",        "Add-ons & Top-ups",     "pricing-add-ons"),
  navLeaf("pricing-roi-calculator", "ROI Calculator",        "pricing-roi-calculator", "Estimate the revenue lift before you buy"),
  // - Resources -
  navLeaf("blog",                   "Blog",                  "blog"),
  navLeaf("cases",                  "Case Studies",          "cases"),
  navLeaf("docs",                   "Documentation",         "docs"),
  navLeaf("faq",                    "FAQ",                   "faq"),
  navLeaf("changelog",              "Changelog",             "changelog"),
  navLeaf("roadmap",                "Roadmap",               "roadmap",               "What we're building next"),
  navLeaf("block-showcase",         "Block Showcase",        "block-showcase",         "All blocks and variants"),
  navLeafExternal("block-coverage", "Block Coverage",        "/block-coverage",        { description: "Which blocks appear on which pages" }),
  // - Company -
  navLeaf("about",                  "About Us",              "about"),
  navLeaf("about-team",             "The Team",              "about-team"),
  navLeaf("jobs",                   "Work With Us",          "jobs"),
  navLeaf("press",                  "Press & Media",         "press"),
  navLeaf("partners",               "Partners",              "partners"),
  navLeaf("contact",                "Contact",               "contact"),
  // - Footer / legal -
  navLeaf("privacy",                "Privacy Policy",        "privacy"),
  navLeaf("terms",                  "Terms of Service",      "terms"),
  navLeaf("cookies",                "Cookie Settings",       "cookies"),
  navLeaf("gdpr",                   "GDPR & DPA",            "gdpr"),
  navLeaf("sla",                    "SLA",                   "sla"),
  // - Search & tools -
  navLeaf("search",                 "Search",                "search"),

  // - Utility links (header top bar) -
  navLeafExternal("util-login",     "Login",    "/admin",           { openInNewTab: false }),
  navLeafExternal("util-book-demo",  "Book a demo", "/book-demo",    { description: "See Mister Chameleon live" }),
  navLeaf("util-search",            "Search",      "search"),
];

// ── Group items (top-level main nav) ───────────────────────────────────────────

const navGroups: Record<string, unknown>[] = [
  // ── Product - mega menu ─────────────────────────────────────────────────────
  {
    _id:          nid("nav-product"),
    _type:        "navigationItem",
    tenantId:     NAV_TENANT,
    label:        "Product",
    linkType:     "internal",
    internalPage: { _type: "reference", _ref: "mister-chameleon_page_features" },
    hasMegaMenu:  true,
    megaMenu: {
      columns: [
        {
          _key:       "mm-col-0",
          title:      "Platform features",
          columnType: "links",
          linkItems: [
            { _key: "mm-l00", _type: "megaMenuLinkItem", label: "All features",       description: "Everything you can do with Mister Chameleon", linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_features" } },
            { _key: "mm-l01", _type: "megaMenuLinkItem", label: "Audience segments",   description: "Group visitors by behaviour and attributes",    linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_features-segments" } },
            { _key: "mm-l02", _type: "megaMenuLinkItem", label: "Intent scoring",      description: "Score purchase intent in real time",             linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_features-intent" } },
            { _key: "mm-l03", _type: "megaMenuLinkItem", label: "Data enrichment",     description: "Enrich anonymous visitors with company data",    linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_features-enrichment" } },
            { _key: "mm-l04", _type: "megaMenuLinkItem", label: "A/B & multivariate",  description: "Run experiments on any page element",            linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_features-testing" } },
            { _key: "mm-l05", _type: "megaMenuLinkItem", label: "Analytics",           description: "Understand what drives conversions",             linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_features-analytics" } },
          ],
        },
        {
          _key:       "mm-col-1",
          title:      "Build on it",
          columnType: "links",
          linkItems: [
            { _key: "mm-l10", _type: "megaMenuLinkItem", label: "Agency & white-label", description: "Resell personalisation under your own brand", linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_features-agency" } },
            { _key: "mm-l11", _type: "megaMenuLinkItem", label: "Integrations",         description: "Connect your CRM, CMS, and data stack",       linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_integrations" } },
            { _key: "mm-l12", _type: "megaMenuLinkItem", label: "Security & GDPR",      description: "Privacy-first, EU data residency",            linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_security" } },
            { _key: "mm-l13", _type: "megaMenuLinkItem", label: "How it works",         description: "Under the hood - the decision engine",        linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_how-it-works" } },
            { _key: "mm-l14", _type: "megaMenuLinkItem", label: "The engine",           description: "V8 real-time personalisation engine",         linkType: "internal", internalPage: { _type: "reference", _ref: "mister-chameleon_page_the-engine" } },
          ],
        },
        {
          _key:       "mm-col-2",
          title:      "See it live",
          columnType: "media",
          mediaItems: [
            {
              _key:      "mm-m20",
              _type:     "megaMenuMediaItem",
              mediaType: "image",
              assetUrl:  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
              hoverAssetUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
              alt:       "Analytics dashboard showing real-time personalisation results",
              caption:   "Watch the 90-second product tour - see personalisation adapt your site in real time.",
              linkType:  "internal",
              internalPage: { _type: "reference", _ref: "mister-chameleon_page_demo" },
            },
          ],
        },
      ],
    },
  },
  navGroup("nav-how-it-works", "How It Works", "how-it-works", [
    "how-it-works", "the-engine", "why-personalisation",
  ]),
  navGroup("nav-demo", "Demo", "demo", [
    "demo", "demo-controls",
  ]),
  navGroup("nav-pricing", "Pricing", "pricing", [
    "pricing", "pricing-add-ons", "pricing-roi-calculator",
  ]),
  navGroup("nav-resources", "Resources", "blog", [
    "blog", "cases", "docs", "faq", "changelog", "roadmap", "block-showcase", "block-coverage",
  ]),
  navGroup("nav-company", "Company", "about", [
    "about", "about-team", "jobs", "press", "partners", "contact",
  ]),
];

// ── Site Settings - mister-chameleon ──────────────────────────────────────────
//
// createOrReplace is idempotent: re-running the seed resets these values.
// Logo and other media assets must be uploaded manually in the Studio -
// binary assets cannot be seeded via the API.

const marketingSiteSettings: Record<string, unknown>[] = [
  {
    _id:      "siteSettings-mister-chameleon",
    _type:    "siteSettings",
    tenantId: NAV_TENANT,

    siteTitle:             "Mister Chameleon",
    defaultSeoTitle:       "Mister Chameleon - Adaptive Personalisation",
    defaultSeoDescription: "Personalise every visitor's experience automatically. Mister Chameleon adapts your website in real time - no developer needed.",

    headerCta: {
      label:        "Start free trial",
      href:         "/order/starter",
      style:        "primary",
      openInNewTab: false,
    },

    // Header utility links - references to navigationItem documents
    headerUtilityItems: [
      nref("util-login",     "hu0"),
      nref("util-book-demo", "hu1"),
      nref("util-search",    "hu2"),
    ],

    // Supported locales - drives language switcher in header
    locales: [
      { _key: "loc0", code: "en", label: "English" },
      { _key: "loc1", code: "nl", label: "Nederlands" },
      { _key: "loc2", code: "de", label: "Deutsch" },
    ],

    contactEmail: "hello@misterchameleon.io",

    mainNavigation: [
      nref("nav-product",      "mn0"),
      nref("nav-how-it-works", "mn1"),
      nref("nav-demo",         "mn2"),
      nref("nav-pricing",      "mn3"),
      nref("nav-resources",    "mn4"),
      nref("nav-company",      "mn5"),
    ],

    // Footer organised in columns
    footerNavigation: [
      nref("privacy", "fn0"),
      nref("terms",   "fn1"),
      nref("cookies", "fn2"),
      nref("gdpr",    "fn3"),
      nref("sla",     "fn4"),
      nref("contact", "fn5"),
    ],

    // Footer columns for a rich multi-column footer
    footerColumns: [
      {
        _key:  "fc0",
        title: "Product",
        links: [
          { _key: "fcl00", label: "Features",           href: "/features" },
          { _key: "fcl01", label: "Audience Segments",  href: "/features-segments" },
          { _key: "fcl02", label: "Intent Scoring",     href: "/features-intent" },
          { _key: "fcl03", label: "Data Enrichment",    href: "/features-enrichment" },
          { _key: "fcl04", label: "A/B Testing",        href: "/features-testing" },
          { _key: "fcl05", label: "Analytics",          href: "/features-analytics" },
          { _key: "fcl06", label: "Agency & White-Label", href: "/features-agency" },
          { _key: "fcl07", label: "Integrations",       href: "/integrations" },
        ],
      },
      {
        _key:  "fc1",
        title: "Solutions",
        links: [
          { _key: "fcl10", label: "B2B SaaS",           href: "/use-cases-saas" },
          { _key: "fcl11", label: "E-commerce",          href: "/use-cases-ecommerce" },
          { _key: "fcl12", label: "Recruitment",         href: "/use-cases-recruitment" },
          { _key: "fcl13", label: "Real Estate",         href: "/use-cases-real-estate" },
          { _key: "fcl14", label: "Agencies",            href: "/use-cases-agencies" },
          { _key: "fcl15", label: "Security & GDPR",     href: "/security" },
        ],
      },
      {
        _key:  "fc2",
        title: "Pricing",
        links: [
          { _key: "fcl20", label: "Pricing",             href: "/pricing" },
          { _key: "fcl21", label: "Add-ons & Top-ups",   href: "/pricing-add-ons" },
          { _key: "fcl22", label: "ROI Calculator",      href: "/pricing-roi-calculator" },
          { _key: "fcl23", label: "Order Starter",       href: "/order/starter" },
          { _key: "fcl24", label: "Order Growth",        href: "/order/growth" },
          { _key: "fcl25", label: "Order Pro",           href: "/order/pro" },
        ],
      },
      {
        _key:  "fc3",
        title: "Resources",
        links: [
          { _key: "fcl30", label: "Blog",                href: "/blog" },
          { _key: "fcl31", label: "Case Studies",        href: "/cases" },
          { _key: "fcl32", label: "Documentation",       href: "/docs" },
          { _key: "fcl33", label: "FAQ",                 href: "/faq" },
          { _key: "fcl34", label: "Changelog",           href: "/changelog" },
          { _key: "fcl35", label: "Glossary",            href: "/glossary" },
          { _key: "fcl36", label: "Manifesto",           href: "/manifesto" },
          { _key: "fcl37", label: "Live Demo",           href: "/demo" },
          { _key: "fcl38", label: "Roadmap",             href: "/roadmap" },
          { _key: "fcl39", label: "Block Showcase",      href: "/block-showcase" },
          { _key: "fcl3a", label: "Block Coverage",      href: "/block-coverage" },
        ],
      },
      {
        _key:  "fc4",
        title: "Company",
        links: [
          { _key: "fcl40", label: "About Us",            href: "/about" },
          { _key: "fcl41", label: "The Team",            href: "/about-team" },
          { _key: "fcl42", label: "Work With Us",        href: "/jobs" },
          { _key: "fcl43", label: "Press & Media",       href: "/press" },
          { _key: "fcl44", label: "Partners",            href: "/partners" },
          { _key: "fcl45", label: "Contact",             href: "/contact" },
        ],
      },
      {
        _key:  "fc5",
        title: "Legal",
        links: [
          { _key: "fcl50", label: "Privacy Policy",      href: "/privacy" },
          { _key: "fcl51", label: "Terms of Service",    href: "/terms" },
          { _key: "fcl52", label: "Cookie Settings",     href: "/cookies" },
          { _key: "fcl53", label: "GDPR & DPA",          href: "/gdpr" },
          { _key: "fcl54", label: "SLA",                 href: "/sla" },
        ],
      },
    ],

    footerTagline: "Personalise your website for every visitor. Privacy-first. No developer needed.",
    footerCopyright: `© ${new Date().getFullYear()} Mister Chameleon B.V. - Amsterdam, Netherlands`,

    socialLinks: [
      { _key: "sl0", label: "LinkedIn",    url: "https://linkedin.com/company/mister-chameleon" },
      { _key: "sl1", label: "Twitter / X", url: "https://twitter.com/misterchameleon" },
      { _key: "sl2", label: "GitHub",      url: "https://github.com/mister-chameleon" },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// LOCALISATION — NL (Dutch) + DE (German)
// ══════════════════════════════════════════════════════════════════════════════
//
// Each locale requires:
//   1. navigationItem docs with locale field (translated labels, same page hrefs)
//   2. siteSettings doc with locale field (references the locale nav items)
//   3. page docs with locale field (translated content, same slug)
//
// The GROQ locale fallback pattern ensures unlocalized pages are shown when no
// translated version exists:
//   (locale == $locale || !defined(locale)) | order(defined(locale) desc) [0]
//
// ─── NL navigation items ─────────────────────────────────────────────────────

/** Locale-specific nav item ID. */
function nlid(slug: string): string { return `navItem_${NAV_TENANT}_${slug}_nl`; }
function deid(slug: string): string { return `navItem_${NAV_TENANT}_${slug}_de`; }

/** Locale-specific reference. */
function nlref(slug: string, key: string): Record<string, unknown> {
  return { _type: "reference", _ref: nlid(slug), _key: key };
}
function deref(slug: string, key: string): Record<string, unknown> {
  return { _type: "reference", _ref: deid(slug), _key: key };
}

/** Locale nav leaf — points to the same (English-slug) page. */
function navLeafLocale(
  locale: "nl" | "de",
  slug:   string,
  label:  string,
  pageId: string,
  description?: string,
): Record<string, unknown> {
  const id = locale === "nl" ? nlid(slug) : deid(slug);
  return {
    _id:          id,
    _type:        "navigationItem",
    tenantId:     NAV_TENANT,
    locale,
    label,
    linkType:     "internal",
    internalPage: { _type: "reference", _ref: `mister-chameleon_page_${pageId}` },
    ...(description ? { description } : {}),
  };
}

function navLeafLocaleExternal(
  locale: "nl" | "de",
  slug:   string,
  label:  string,
  url:    string,
  openInNewTab = false,
): Record<string, unknown> {
  const id = locale === "nl" ? nlid(slug) : deid(slug);
  return {
    _id:          id,
    _type:        "navigationItem",
    tenantId:     NAV_TENANT,
    locale,
    label,
    linkType:     "external",
    externalUrl:  url,
    openInNewTab,
  };
}

function navGroupLocale(
  locale:     "nl" | "de",
  groupSlug:  string,
  label:      string,
  pageId:     string,
  childSlugs: string[],
): Record<string, unknown> {
  const id    = locale === "nl" ? nlid(groupSlug) : deid(groupSlug);
  const refFn = locale === "nl" ? nlref : deref;
  return {
    _id:          id,
    _type:        "navigationItem",
    tenantId:     NAV_TENANT,
    locale,
    label,
    linkType:     "internal",
    internalPage: { _type: "reference", _ref: `mister-chameleon_page_${pageId}` },
    children:     childSlugs.map((s, i) => refFn(s, `${groupSlug}_c${i}`)),
  };
}

// ─── NL nav items ────────────────────────────────────────────────────────────

const navItemsNL: Record<string, unknown>[] = [
  // Leaf items (shared by nav groups as children)
  navLeafLocale("nl", "features",            "Functies",                    "features",            "Alles wat u kunt doen met Mister Chameleon"),
  navLeafLocale("nl", "features-segments",   "Doelgroepen",                 "features-segments",   "Groepeer bezoekers op gedrag en kenmerken"),
  navLeafLocale("nl", "features-intent",     "Intentiesignalen",            "features-intent",     "Scoor koopintentie in realtime"),
  navLeafLocale("nl", "features-enrichment", "Dataverrijking",              "features-enrichment", "Verrijk anonieme bezoekers met bedrijfsdata"),
  navLeafLocale("nl", "features-testing",    "A/B-testen",                  "features-testing",    "Voer experimenten uit op elk pagina-element"),
  navLeafLocale("nl", "features-analytics",  "Analytics",                   "features-analytics",  "Begrijp wat conversies drijft"),
  navLeafLocale("nl", "features-agency",     "Agency & White-Label",        "features-agency",     "Personalisatie onder uw eigen merk"),
  navLeafLocale("nl", "integrations",        "Integraties",                 "integrations",        "Verbind uw CRM, CMS en datastack"),
  navLeafLocale("nl", "security",            "Beveiliging & AVG",           "security",            "Privacy-first, EU-dataopslag"),
  navLeafLocale("nl", "how-it-works",        "Hoe het werkt",               "how-it-works"),
  navLeafLocale("nl", "the-engine",          "De engine",                   "the-engine",          "Hoe de beslisengine werkt"),
  navLeafLocale("nl", "why-personalisation", "Waarom personalisatie?",      "why-personalisation"),
  navLeafLocale("nl", "demo",                "Live demo",                   "demo",                "Zie Mister Chameleon in actie"),
  navLeafLocale("nl", "demo-controls",       "Scenariobediening",           "demo-controls"),
  navLeafLocale("nl", "pricing",             "Prijzen",                     "pricing"),
  navLeafLocale("nl", "pricing-add-ons",     "Add-ons & aanvullingen",      "pricing-add-ons"),
  navLeafLocale("nl", "pricing-roi-calculator", "ROI-calculator",           "pricing-roi-calculator", "Schat de omzetgroei voor aankoop"),
  navLeafLocale("nl", "blog",                "Blog",                        "blog"),
  navLeafLocale("nl", "cases",               "Casestudies",                 "cases"),
  navLeafLocale("nl", "docs",                "Documentatie",                "docs"),
  navLeafLocale("nl", "faq",                 "Veelgestelde vragen",         "faq"),
  navLeafLocale("nl", "changelog",           "Changelog",                   "changelog"),
  navLeafLocale("nl", "roadmap",             "Routekaart",                  "roadmap",             "Wat we als volgende bouwen"),
  navLeafLocale("nl", "block-showcase",      "Block Showcase",              "block-showcase",      "Alle blocks en varianten"),
  navLeafLocaleExternal("nl", "block-coverage", "Block Coverage",           "/block-coverage"),
  navLeafLocale("nl", "about",               "Over ons",                    "about"),
  navLeafLocale("nl", "about-team",          "Ons team",                    "about-team"),
  navLeafLocale("nl", "jobs",                "Werken bij",                  "jobs"),
  navLeafLocale("nl", "press",               "Pers & media",                "press"),
  navLeafLocale("nl", "partners",            "Partners",                    "partners"),
  navLeafLocale("nl", "contact",             "Contact",                     "contact"),
  // Utility items
  navLeafLocaleExternal("nl", "util-login",  "Inloggen", "/admin"),
  navLeafLocaleExternal("nl", "util-book-demo", "Demo boeken",  "/book-demo"),
  navLeafLocale("nl", "util-search",         "Zoeken",        "search"),
  // Group items (top-level nav)
  navGroupLocale("nl", "nav-product",      "Product",           "features",    ["features","features-segments","features-intent","features-enrichment","features-testing","features-analytics","features-agency","integrations","security"]),
  navGroupLocale("nl", "nav-how-it-works", "Hoe het werkt",     "how-it-works",["how-it-works","the-engine","why-personalisation"]),
  navGroupLocale("nl", "nav-demo",         "Demo",              "demo",        ["demo","demo-controls"]),
  navGroupLocale("nl", "nav-pricing",      "Prijzen",           "pricing",     ["pricing","pricing-add-ons","pricing-roi-calculator"]),
  navGroupLocale("nl", "nav-resources",    "Resources",         "blog",        ["blog","cases","docs","faq","changelog","roadmap","block-showcase","block-coverage"]),
  navGroupLocale("nl", "nav-company",      "Over ons",          "about",       ["about","about-team","jobs","press","partners","contact"]),
];

// ─── DE nav items ────────────────────────────────────────────────────────────

const navItemsDE: Record<string, unknown>[] = [
  navLeafLocale("de", "features",            "Funktionen",                  "features",            "Alles, was Sie mit Mister Chameleon tun können"),
  navLeafLocale("de", "features-segments",   "Zielgruppen",                 "features-segments",   "Besucher nach Verhalten und Attributen gruppieren"),
  navLeafLocale("de", "features-intent",     "Kaufabsichtssignale",         "features-intent",     "Kaufabsicht in Echtzeit erkennen"),
  navLeafLocale("de", "features-enrichment", "Datenanreicherung",           "features-enrichment", "Anonyme Besucher mit Unternehmensdaten anreichern"),
  navLeafLocale("de", "features-testing",    "A/B-Tests",                   "features-testing",    "Experimente auf beliebigen Seitenelemente durchfuhren"),
  navLeafLocale("de", "features-analytics",  "Analytics",                   "features-analytics",  "Verstehen, was Conversions antreibt"),
  navLeafLocale("de", "features-agency",     "Agentur & White-Label",       "features-agency",     "Personalisierung unter Ihrer eigenen Marke"),
  navLeafLocale("de", "integrations",        "Integrationen",               "integrations",        "CRM, CMS und Datenstapel verbinden"),
  navLeafLocale("de", "security",            "Sicherheit & DSGVO",          "security",            "Privacy-first, EU-Datenspeicherung"),
  navLeafLocale("de", "how-it-works",        "So funktioniert es",          "how-it-works"),
  navLeafLocale("de", "the-engine",          "Die Engine",                  "the-engine",          "Wie die Entscheidungsengine funktioniert"),
  navLeafLocale("de", "why-personalisation", "Warum Personalisierung?",     "why-personalisation"),
  navLeafLocale("de", "demo",                "Live-Demo",                   "demo",                "Mister Chameleon in Aktion erleben"),
  navLeafLocale("de", "demo-controls",       "Szenarien",                   "demo-controls"),
  navLeafLocale("de", "pricing",             "Preise",                      "pricing"),
  navLeafLocale("de", "pricing-add-ons",     "Add-ons & Upgrades",          "pricing-add-ons"),
  navLeafLocale("de", "pricing-roi-calculator", "ROI-Rechner",              "pricing-roi-calculator", "Umsatzsteigerung vor dem Kauf abschatzen"),
  navLeafLocale("de", "blog",                "Blog",                        "blog"),
  navLeafLocale("de", "cases",               "Fallstudien",                 "cases"),
  navLeafLocale("de", "docs",                "Dokumentation",               "docs"),
  navLeafLocale("de", "faq",                 "FAQ",                         "faq"),
  navLeafLocale("de", "changelog",           "Changelog",                   "changelog"),
  navLeafLocale("de", "roadmap",             "Produkt-Roadmap",             "roadmap",             "Was wir als Nächstes bauen"),
  navLeafLocale("de", "block-showcase",      "Block Showcase",              "block-showcase",      "Alle Blöcke und Varianten"),
  navLeafLocaleExternal("de", "block-coverage", "Block Coverage",           "/block-coverage"),
  navLeafLocale("de", "about",               "Uber uns",                    "about"),
  navLeafLocale("de", "about-team",          "Unser Team",                  "about-team"),
  navLeafLocale("de", "jobs",                "Karriere",                    "jobs"),
  navLeafLocale("de", "press",               "Presse & Medien",             "press"),
  navLeafLocale("de", "partners",            "Partner",                     "partners"),
  navLeafLocale("de", "contact",             "Kontakt",                     "contact"),
  // Utility items
  navLeafLocaleExternal("de", "util-login",  "Anmelden", "/admin"),
  navLeafLocaleExternal("de", "util-book-demo", "Demo buchen",  "/book-demo"),
  navLeafLocale("de", "util-search",         "Suchen",        "search"),
  // Group items
  navGroupLocale("de", "nav-product",      "Produkt",           "features",    ["features","features-segments","features-intent","features-enrichment","features-testing","features-analytics","features-agency","integrations","security"]),
  navGroupLocale("de", "nav-how-it-works", "So funktioniert es","how-it-works",["how-it-works","the-engine","why-personalisation"]),
  navGroupLocale("de", "nav-demo",         "Demo",              "demo",        ["demo","demo-controls"]),
  navGroupLocale("de", "nav-pricing",      "Preise",            "pricing",     ["pricing","pricing-add-ons","pricing-roi-calculator"]),
  navGroupLocale("de", "nav-resources",    "Ressourcen",        "blog",        ["blog","cases","docs","faq","changelog","roadmap","block-showcase","block-coverage"]),
  navGroupLocale("de", "nav-company",      "Unternehmen",       "about",       ["about","about-team","jobs","press","partners","contact"]),
];

// ─── NL siteSettings ─────────────────────────────────────────────────────────

const siteSettingsNL: Record<string, unknown>[] = [
  {
    _id:      "siteSettings-mister-chameleon-nl",
    _type:    "siteSettings",
    tenantId: NAV_TENANT,
    locale:   "nl",

    siteTitle:             "Mister Chameleon",
    defaultSeoTitle:       "Mister Chameleon - Adaptieve Websitepersonalisatie",
    defaultSeoDescription: "Personaliseer de ervaring van elke bezoeker automatisch. Mister Chameleon past uw website in realtime aan - geen developer nodig.",

    headerCta: {
      label:        "Gratis proberen",
      href:         "/order/starter",
      style:        "primary",
      openInNewTab: false,
    },

    headerUtilityItems: [
      { _type: "reference", _ref: nlid("util-login"),     _key: "hu0" },
      { _type: "reference", _ref: nlid("util-book-demo"), _key: "hu1" },
      { _type: "reference", _ref: nlid("util-search"),    _key: "hu2" },
    ],

    locales: [
      { _key: "loc0", code: "en", label: "English" },
      { _key: "loc1", code: "nl", label: "Nederlands" },
      { _key: "loc2", code: "de", label: "Deutsch" },
    ],

    contactEmail: "hallo@misterchameleon.io",

    mainNavigation: [
      { _type: "reference", _ref: nlid("nav-product"),      _key: "mn0" },
      { _type: "reference", _ref: nlid("nav-how-it-works"), _key: "mn1" },
      { _type: "reference", _ref: nlid("nav-demo"),         _key: "mn2" },
      { _type: "reference", _ref: nlid("nav-pricing"),      _key: "mn3" },
      { _type: "reference", _ref: nlid("nav-resources"),    _key: "mn4" },
      { _type: "reference", _ref: nlid("nav-company"),      _key: "mn5" },
    ],

    footerNavigation: [
      nref("privacy", "fn0"),
      nref("terms",   "fn1"),
      nref("cookies", "fn2"),
      nref("gdpr",    "fn3"),
      nref("sla",     "fn4"),
      nref("contact", "fn5"),
    ],

    footerColumns: [
      {
        _key: "fc0", title: "Product",
        links: [
          { _key: "fcl00", label: "Functies",                href: "/features" },
          { _key: "fcl01", label: "Doelgroepen",             href: "/features-segments" },
          { _key: "fcl02", label: "Intentiesignalen",        href: "/features-intent" },
          { _key: "fcl03", label: "Dataverrijking",          href: "/features-enrichment" },
          { _key: "fcl04", label: "A/B-testen",              href: "/features-testing" },
          { _key: "fcl05", label: "Analytics",               href: "/features-analytics" },
          { _key: "fcl06", label: "Agency & White-Label",    href: "/features-agency" },
          { _key: "fcl07", label: "Integraties",             href: "/integrations" },
        ],
      },
      {
        _key: "fc1", title: "Oplossingen",
        links: [
          { _key: "fcl10", label: "B2B SaaS",                href: "/use-cases-saas" },
          { _key: "fcl11", label: "E-commerce",              href: "/use-cases-ecommerce" },
          { _key: "fcl12", label: "Recruitment",             href: "/use-cases-recruitment" },
          { _key: "fcl13", label: "Vastgoed",                href: "/use-cases-real-estate" },
          { _key: "fcl14", label: "Beveiliging & AVG",       href: "/security" },
        ],
      },
      {
        _key: "fc2", title: "Prijzen",
        links: [
          { _key: "fcl20", label: "Prijsoverzicht",          href: "/pricing" },
          { _key: "fcl21", label: "Add-ons & aanvullingen",  href: "/pricing-add-ons" },
          { _key: "fcl22", label: "ROI-calculator",          href: "/pricing-roi-calculator" },
          { _key: "fcl23", label: "Starter bestellen",       href: "/order/starter" },
          { _key: "fcl24", label: "Growth bestellen",        href: "/order/growth" },
        ],
      },
      {
        _key: "fc3", title: "Resources",
        links: [
          { _key: "fcl30", label: "Blog",                    href: "/blog" },
          { _key: "fcl31", label: "Casestudies",             href: "/cases" },
          { _key: "fcl32", label: "Documentatie",            href: "/docs" },
          { _key: "fcl33", label: "Veelgestelde vragen",     href: "/faq" },
          { _key: "fcl34", label: "Changelog",               href: "/changelog" },
          { _key: "fcl35", label: "Live demo",               href: "/demo" },
          { _key: "fcl36", label: "Routekaart",              href: "/roadmap" },
          { _key: "fcl37", label: "Block Showcase",          href: "/block-showcase" },
          { _key: "fcl38", label: "Block Coverage",          href: "/block-coverage" },
        ],
      },
      {
        _key: "fc4", title: "Bedrijf",
        links: [
          { _key: "fcl40", label: "Over ons",                href: "/about" },
          { _key: "fcl41", label: "Ons team",                href: "/about-team" },
          { _key: "fcl42", label: "Werken bij",              href: "/jobs" },
          { _key: "fcl43", label: "Contact",                 href: "/contact" },
        ],
      },
      {
        _key: "fc5", title: "Juridisch",
        links: [
          { _key: "fcl50", label: "Privacybeleid",           href: "/privacy" },
          { _key: "fcl51", label: "Gebruiksvoorwaarden",     href: "/terms" },
          { _key: "fcl52", label: "Cookie-instellingen",     href: "/cookies" },
          { _key: "fcl53", label: "AVG & DPA",               href: "/gdpr" },
          { _key: "fcl54", label: "SLA",                     href: "/sla" },
        ],
      },
    ],

    footerTagline:   "Personaliseer uw website voor elke bezoeker. Privacy-first. Geen developer nodig.",
    footerCopyright: `© ${new Date().getFullYear()} Mister Chameleon B.V. - Amsterdam, Nederland`,

    socialLinks: [
      { _key: "sl0", label: "LinkedIn",    url: "https://linkedin.com/company/mister-chameleon" },
      { _key: "sl1", label: "Twitter / X", url: "https://twitter.com/misterchameleon" },
      { _key: "sl2", label: "GitHub",      url: "https://github.com/mister-chameleon" },
    ],
  },
];

// ─── DE siteSettings ─────────────────────────────────────────────────────────

const siteSettingsDE: Record<string, unknown>[] = [
  {
    _id:      "siteSettings-mister-chameleon-de",
    _type:    "siteSettings",
    tenantId: NAV_TENANT,
    locale:   "de",

    siteTitle:             "Mister Chameleon",
    defaultSeoTitle:       "Mister Chameleon - Adaptive Website-Personalisierung",
    defaultSeoDescription: "Personalisieren Sie das Erlebnis jedes Besuchers automatisch. Mister Chameleon passt Ihre Website in Echtzeit an - kein Entwickler erforderlich.",

    headerCta: {
      label:        "Kostenlos testen",
      href:         "/order/starter",
      style:        "primary",
      openInNewTab: false,
    },

    headerUtilityItems: [
      { _type: "reference", _ref: deid("util-login"),     _key: "hu0" },
      { _type: "reference", _ref: deid("util-book-demo"), _key: "hu1" },
      { _type: "reference", _ref: deid("util-search"),    _key: "hu2" },
    ],

    locales: [
      { _key: "loc0", code: "en", label: "English" },
      { _key: "loc1", code: "nl", label: "Nederlands" },
      { _key: "loc2", code: "de", label: "Deutsch" },
    ],

    contactEmail: "hallo@misterchameleon.io",

    mainNavigation: [
      { _type: "reference", _ref: deid("nav-product"),      _key: "mn0" },
      { _type: "reference", _ref: deid("nav-how-it-works"), _key: "mn1" },
      { _type: "reference", _ref: deid("nav-demo"),         _key: "mn2" },
      { _type: "reference", _ref: deid("nav-pricing"),      _key: "mn3" },
      { _type: "reference", _ref: deid("nav-resources"),    _key: "mn4" },
      { _type: "reference", _ref: deid("nav-company"),      _key: "mn5" },
    ],

    footerNavigation: [
      nref("privacy", "fn0"),
      nref("terms",   "fn1"),
      nref("cookies", "fn2"),
      nref("gdpr",    "fn3"),
      nref("sla",     "fn4"),
      nref("contact", "fn5"),
    ],

    footerColumns: [
      {
        _key: "fc0", title: "Produkt",
        links: [
          { _key: "fcl00", label: "Funktionen",              href: "/features" },
          { _key: "fcl01", label: "Zielgruppen",             href: "/features-segments" },
          { _key: "fcl02", label: "Kaufabsichtssignale",     href: "/features-intent" },
          { _key: "fcl03", label: "Datenanreicherung",       href: "/features-enrichment" },
          { _key: "fcl04", label: "A/B-Tests",               href: "/features-testing" },
          { _key: "fcl05", label: "Analytics",               href: "/features-analytics" },
          { _key: "fcl06", label: "Agentur & White-Label",   href: "/features-agency" },
          { _key: "fcl07", label: "Integrationen",           href: "/integrations" },
        ],
      },
      {
        _key: "fc1", title: "Losungen",
        links: [
          { _key: "fcl10", label: "B2B SaaS",                href: "/use-cases-saas" },
          { _key: "fcl11", label: "E-Commerce",              href: "/use-cases-ecommerce" },
          { _key: "fcl12", label: "Personalvermittlung",     href: "/use-cases-recruitment" },
          { _key: "fcl13", label: "Sicherheit & DSGVO",      href: "/security" },
        ],
      },
      {
        _key: "fc2", title: "Preise",
        links: [
          { _key: "fcl20", label: "Preisübersicht",          href: "/pricing" },
          { _key: "fcl21", label: "Add-ons & Upgrades",      href: "/pricing-add-ons" },
          { _key: "fcl22", label: "ROI-Rechner",             href: "/pricing-roi-calculator" },
          { _key: "fcl23", label: "Starter bestellen",       href: "/order/starter" },
          { _key: "fcl24", label: "Growth bestellen",        href: "/order/growth" },
        ],
      },
      {
        _key: "fc3", title: "Ressourcen",
        links: [
          { _key: "fcl30", label: "Blog",                    href: "/blog" },
          { _key: "fcl31", label: "Fallstudien",             href: "/cases" },
          { _key: "fcl32", label: "Dokumentation",           href: "/docs" },
          { _key: "fcl33", label: "FAQ",                     href: "/faq" },
          { _key: "fcl34", label: "Changelog",               href: "/changelog" },
          { _key: "fcl35", label: "Live-Demo",               href: "/demo" },
          { _key: "fcl36", label: "Produkt-Roadmap",         href: "/roadmap" },
          { _key: "fcl37", label: "Block Showcase",          href: "/block-showcase" },
          { _key: "fcl38", label: "Block Coverage",          href: "/block-coverage" },
        ],
      },
      {
        _key: "fc4", title: "Unternehmen",
        links: [
          { _key: "fcl40", label: "Über uns",                href: "/about" },
          { _key: "fcl41", label: "Unser Team",              href: "/about-team" },
          { _key: "fcl42", label: "Karriere",                href: "/jobs" },
          { _key: "fcl43", label: "Kontakt",                 href: "/contact" },
        ],
      },
      {
        _key: "fc5", title: "Rechtliches",
        links: [
          { _key: "fcl50", label: "Datenschutzrichtlinie",   href: "/privacy" },
          { _key: "fcl51", label: "Nutzungsbedingungen",     href: "/terms" },
          { _key: "fcl52", label: "Cookie-Einstellungen",    href: "/cookies" },
          { _key: "fcl53", label: "DSGVO & DPA",             href: "/gdpr" },
          { _key: "fcl54", label: "SLA",                     href: "/sla" },
        ],
      },
    ],

    footerTagline:   "Personalisieren Sie Ihre Website fur jeden Besucher. Privacy-first. Kein Entwickler notig.",
    footerCopyright: `© ${new Date().getFullYear()} Mister Chameleon B.V. - Amsterdam, Niederlande`,

    socialLinks: [
      { _key: "sl0", label: "LinkedIn",    url: "https://linkedin.com/company/mister-chameleon" },
      { _key: "sl1", label: "Twitter / X", url: "https://twitter.com/misterchameleon" },
      { _key: "sl2", label: "GitHub",      url: "https://github.com/mister-chameleon" },
    ],
  },
];

// ─── NL home page ─────────────────────────────────────────────────────────────

const localePages: Record<string, unknown>[] = [

  // ── NL home ──────────────────────────────────────────────────────────────────
  {
    ...page("home-nl", "home", "Home - NL", "marketing-page",
      "Mister Chameleon - Personaliseer je website voor iedere bezoeker",
      "Laat automatisch de juiste boodschap zien aan de juiste bezoeker. Zonder developersprints, zonder ingewikkelde tooling en zonder third-party cookies.",
      [
        textSec("intro", "text_lead", "Jouw website hoeft niet voor iedereen hetzelfde te zijn.",
          pt(
            "Laat automatisch de juiste boodschap zien aan de juiste bezoeker.",
            "Mister Chameleon past je website realtime aan op basis van gedrag, herkomst, bedrijfstype en interesse. Zonder ingewikkelde implementaties, zonder afhankelijk te zijn van development en zonder performanceverlies.",
          ),
        ),
        featureGrid("features", "Alles wat u nodig heeft. Niets wat u niet nodig heeft.", "feature_grid_3up", [
          { title: "Intentie-scoring", description: "We analyseren hoe bezoekers navigeren - welke pagina's ze lezen, hoe lang ze blijven, wat ze klikken - en bouwen een realtime intentiescore die u precies vertelt waar iemand in uw funnel staat.", icon: "chart" },
          { title: "Bedrijfsverrijking", description: "Wanneer een bezoeker van een bekend IP-adres binnenkomt, zoeken we stil hun bedrijfsnaam, branche en grootte op. Uw kop kan hun sector vermelden voordat ze een woord hebben getypt.", icon: "building" },
          { title: "Adaptieve content engine", description: "Onze beslisengine kiest de beste variant voor elke bezoeker op basis van uw regels, verrijkingsdata en gedragssignalen. Alles draait op de edge - nul milliseconden extra laadtijd.", icon: "bolt" },
        ], { label: "Alle functies bekijken", href: "/features" }),
        textMedia("product-video", "text_media_stacked",
          "Zie het in actie",
          "Uw website, die zichzelf personaliseert - live.",
          "Bekijk hoe Mister Chameleon bezoekersprofielen in realtime wisselt. Elk onderdeel - de hero, het proof-blok, de CTA - past zich automatisch aan op basis van wie er bezoekt en waar ze zich in de funnel bevinden.",
          [{ label: "Probeer de interactieve demo", href: "/demo" }, { label: "Gratis proefperiode starten", href: "/order/starter" }],
          { type: "video" as const, url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "Live demo - wissel bezoekersprofielen en zie de pagina aanpassen" },
        ),
        statsSec("stats", "Vertrouwd door groeiteams door heel Europa", [
          { label: "Gepersonaliseerde sessies geleverd", value: "12M", suffix: "+" },
          { label: "Gemiddelde stijging in leadconversie", value: "34", suffix: "%" },
          { label: "Minuten tot eerste live variant", value: "< 15" },
          { label: "AVG-compliant by design", value: "100", suffix: "%" },
        ]),
        logoStrip("logos", "Vertrouwd door bedrijven die groei serieus nemen", [
          { name: "HubSpot",         src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg",         url: "https://hubspot.com" },
          { name: "Salesforce",      src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg",      url: "https://salesforce.com" },
          { name: "Pipedrive",       src: "https://cdn.worldvectorlogo.com/logos/pipedrive.svg",       url: "https://pipedrive.com" },
          { name: "Intercom",        src: "https://cdn.worldvectorlogo.com/logos/intercom-1.svg",        url: "https://intercom.com" },
          { name: "Typeform",        src: "https://cdn.worldvectorlogo.com/logos/typeform.svg",        url: "https://typeform.com" },
          { name: "ActiveCampaign",  src: "https://cdn.worldvectorlogo.com/logos/activecampaign.svg", url: "https://activecampaign.com" },
          { name: "Shopify",         src: "https://cdn.worldvectorlogo.com/logos/shopify.svg",         url: "https://shopify.com" },
          { name: "Segment",         src: "https://cdn.worldvectorlogo.com/logos/segment-1.svg",         url: "https://segment.com" },
        ]),
        testimonialSec("proof", "Wat onze klanten zeggen", [
          { quote: "We voegden Mister Chameleon op een vrijdagmiddag toe en tegen maandag was onze trial-aanmeldingsratio al gestegen. Het was de snelste overwinning die we in maanden hadden.", author: "Lotte van den Berg", role: "Head of Growth", company: "Stackr" },
          { quote: "De enterprise-segmentfunctie alleen al betaalde het eerste jaar terug. Bezoekers van doelaccounts zien nu onze enterprise-casestudies direct - onze SDR's zijn er blij mee.", author: "Pieter Claes", role: "Marketing Director", company: "Axius Systems" },
          { quote: "We waren sceptisch over personalisatie zonder third-party cookies. Mister Chameleon bewees dat je ze niet nodig hebt. Hun first-party aanpak overtrof onze oude tag-gebaseerde setup.", author: "Sara Mehta", role: "VP Digital", company: "Lumio Group" },
        ]),
        textMedia("how-it-works-teaser", "text_media_right",
          "Personalisatie die werkt vóór de pagina geladen is",
          "Minder dan 50 ms. Geen flikkering. Geen layoutverschuiving.",
          "De meeste personalisatietools veranderen content pas nadat de pagina zichtbaar is. Dat zorgt voor vertraging, flikkering en een onrustige ervaring.\n\nMister Chameleon werkt anders. Onze engine draait op de edge. Daardoor wordt de juiste variant gekozen voordat de pagina zichtbaar wordt. Je bezoeker ziet dus direct content die past. Minder dan 50 ms extra latency, geen trage scripts in de browser, en werkt met vrijwel iedere techstack.",
          [{ label: "Zie hoe de engine werkt", href: "/the-engine" }, { label: "Hoe het werkt", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Printplaat als beeld voor edge computing technologie", caption: "Edge-native: nul latency personalisatie" },
        ),
        processSec("how-quick", "Live in 15 minuten", [
          { title: "Voeg het snippet toe", description: "Een scripttag in de <head> van uw site. Asynchroon - geen prestatie-impact. Werkt met elke website of framework.", duration: "2 min" },
          { title: "Maak een contentvariant", description: "Open Sanity Studio. Schrijf een alternatieve kop voor bezoekers met hoge intentie. Opslaan.", duration: "5 min" },
          { title: "Schrijf een regel", description: "Stel de voorwaarde in: 'Als intentiescore > 60, toon de high-intent hero'. Activeren.", duration: "3 min" },
          { title: "Bekijk hoe het werkt", description: "Uw volgende bezoeker met hoge intentie krijgt automatisch de juiste boodschap. Bekijk analytics om de stijging te zien.", duration: "Live" },
        ]),
        testimonialSec("proof-2", "Wat onze klanten zeggen", [
          { quote: "We voegden Mister Chameleon op een vrijdagmiddag toe en tegen maandag was onze trial-aanmeldingsratio al gestegen. Het was de snelste overwinning die we in maanden hadden.", author: "Lotte van den Berg", role: "Head of Growth", company: "Stackr" },
          { quote: "De enterprise-segmentfunctie alleen al betaalde het eerste jaar terug. Bezoekers van doelaccounts zien nu onze enterprise-casestudies direct - onze SDR's zijn er blij mee.", author: "Pieter Claes", role: "Marketing Director", company: "Axius Systems" },
          { quote: "We waren sceptisch over personalisatie zonder third-party cookies. Mister Chameleon bewees dat je ze niet nodig hebt. Hun first-party aanpak overtrof onze oude tag-gebaseerde setup.", author: "Sara Mehta", role: "VP Digital", company: "Lumio Group" },
        ]),
        featureGrid("use-cases", "Gebouwd voor uw branche", "feature_grid_3up", [
          { title: "B2B SaaS", description: "Toon enterprise-content aan enterprise-bezoekers, trial-CTA's aan onderzoekers met hoge intentie, en onboarding-prompts aan bestaande klanten.", icon: "monitor" },
          { title: "Recruitment & HR", description: "Personaliseer afzonderlijk voor werkgevers en kandidaten. Vergroot het aantal gekwalificeerde sollicitaties en verminder werkgeversverloop in de eerste 90 dagen.", icon: "users" },
          { title: "Digitale bureaus", description: "Beheer personalisatie voor al uw klanten vanuit een enkel white-label dashboard onder uw eigen merk. Een Pro-plan, onbeperkte klantsites.", icon: "layout" },
        ], { label: "Alle use cases bekijken", href: "/use-cases-saas" }),
        pricingSec("pricing-teaser", "Eenvoudige, eerlijke prijzen", "Begin gratis. Schaal op naarmate u groeit.", [
          { _key: "t0", name: "Starter", price: "€149", period: "/maand", description: "Voor groeiende teams die willen beginnen met personalisatie.", highlighted: false, features: [ { _key: "f0", label: "25.000 gepersonaliseerde sessies/maand" }, { _key: "f1", label: "Regelgebaseerde personalisatie" }, { _key: "f2", label: "3 contentvarianten per pagina" }, { _key: "f3", label: "14 dagen gratis proberen" } ], ctaLabel: "Gratis proberen", ctaHref: "/order/starter" },
          { _key: "t1", name: "Growth", price: "€349", period: "/maand", description: "Voor teams die serieus zijn over conversie. CRM-integratie, AI-beslissingen, volledige analytics.", highlighted: true, badge: "Meest populair", features: [ { _key: "f0", label: "150.000 gepersonaliseerde sessies/maand" }, { _key: "f1", label: "AI-ondersteunde variantbeslissingen" }, { _key: "f2", label: "CRM- en ABM-integratie" }, { _key: "f3", label: "Volledig analyticsdashboard" }, { _key: "f4", label: "Onbeperkte varianten" } ], ctaLabel: "Gratis proberen", ctaHref: "/order/growth" },
          { _key: "t2", name: "Pro / Agency", price: "€749", period: "/maand", description: "Voor bureaus en teams die personalisatie op meerdere sites uitvoeren.", highlighted: false, badge: "Agency ready", features: [ { _key: "f0", label: "500.000 sessies/maand" }, { _key: "f1", label: "Onbeperkte klantsites" }, { _key: "f2", label: "Volledig white-label interface" }, { _key: "f3", label: "Eigen domein per klant" }, { _key: "f4", label: "Prioriteitsondersteuning" } ], ctaLabel: "Begin met Pro", ctaHref: "/order/pro" },
        ], "14 dagen gratis proberen op elk plan. Geen creditcard vereist. Jaarlijkse facturering bespaart 20%."),
      ],
      { hero: { fallbackVariantKey: "hero_direct_brand" }, proof: { fallbackVariantKey: "proof_cases" } },
    ),
    locale: "nl",
  },

  // ── DE home ──────────────────────────────────────────────────────────────────
  {
    ...page("home-de", "home", "Home - DE", "marketing-page",
      "Mister Chameleon - Personalisieren Sie Ihre Website fur jeden Besucher",
      "Senden Sie automatisch die richtige Botschaft an die richtige Person. Keine Entwickler-Sprints, kein Data-Science-Team, kein sechsstelliger Vertrag.",
      [
        textSec("intro", "text_lead", "Ihre Website spricht jeden an - und konvertiert niemanden.",
          pt(
            "Die durchschnittliche Website zeigt jedem Besucher dieselbe Hero, dieselbe Kopie und denselben CTA - unabhangig davon, woher sie kommen, fur welches Unternehmen sie arbeiten oder wie nah sie an einem Kauf sind.",
            "Mister Chameleon andert das. In Minuten passt sich Ihre Website jedem Besucher an: eine andere Uberschrift fur den Google-Sucher, eine warmere Begrussung fur den wiederkehrenden Interessenten, eine Enterprise-Botschaft fur den Fortune-500-Besucher.",
            "Kein Entwickler erforderlich. Keine Datenschutzkompromisse. Nur mehr Gesprache, die zu Kunden werden.",
          ),
        ),
        featureGrid("features", "Alles was Sie brauchen. Nichts was Sie nicht brauchen.", "feature_grid_3up", [
          { title: "Intent-Scoring", description: "Wir beobachten, wie Besucher navigieren - welche Seiten sie lesen, wie lange sie bleiben, was sie anklicken - und erstellen einen Echtzeit-Intent-Score, der Ihnen genau zeigt, wo jeder im Funnel steht.", icon: "chart" },
          { title: "Unternehmensanreicherung", description: "Wenn ein Besucher von einer bekannten IP-Adresse kommt, schlagen wir stillschweigend Firmennamen, Branche und Grosse nach. Ihre Uberschrift kann ihren Sektor erwahnen, bevor sie ein Wort geschrieben haben.", icon: "building" },
          { title: "Adaptive Content Engine", description: "Unsere Entscheidungsengine wahlt die beste Variante fur jeden Besucher basierend auf Ihren Regeln, Anreicherungsdaten und Verhaltenssignalen. Alles lauft am Edge - null Millisekunden zusatzliche Ladezeit.", icon: "bolt" },
        ], { label: "Alle Funktionen ansehen", href: "/features" }),
        textMedia("product-video", "text_media_stacked",
          "Sehen Sie es in Aktion",
          "Ihre Website, die sich selbst personalisiert - live.",
          "Sehen Sie, wie Mister Chameleon Besucherprofile in Echtzeit wechselt. Jeder Abschnitt - der Hero, der Proof-Block, der CTA - passt sich automatisch an, je nachdem wer besucht und wo sie sich im Funnel befinden.",
          [{ label: "Interaktive Demo ausprobieren", href: "/demo" }, { label: "Kostenlose Testphase starten", href: "/order/starter" }],
          { type: "video" as const, url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "Live-Demo - Besucherprofile wechseln und die Seite anpassen sehen" },
        ),
        statsSec("stats", "Vertraut von Wachstumsteams in ganz Europa", [
          { label: "Personalisierte Sitzungen geliefert", value: "12M", suffix: "+" },
          { label: "Durchschnittliche Steigerung der Lead-Conversion", value: "34", suffix: "%" },
          { label: "Minuten bis zur ersten Live-Variante", value: "< 15" },
          { label: "DSGVO-konform by Design", value: "100", suffix: "%" },
        ]),
        logoStrip("logos", "Vertraut von Unternehmen, die Wachstum ernst nehmen", [
          { name: "HubSpot",         src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg",         url: "https://hubspot.com" },
          { name: "Salesforce",      src: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg",      url: "https://salesforce.com" },
          { name: "Pipedrive",       src: "https://cdn.worldvectorlogo.com/logos/pipedrive.svg",       url: "https://pipedrive.com" },
          { name: "Intercom",        src: "https://cdn.worldvectorlogo.com/logos/intercom-1.svg",        url: "https://intercom.com" },
          { name: "Typeform",        src: "https://cdn.worldvectorlogo.com/logos/typeform.svg",        url: "https://typeform.com" },
          { name: "ActiveCampaign",  src: "https://cdn.worldvectorlogo.com/logos/activecampaign.svg", url: "https://activecampaign.com" },
          { name: "Shopify",         src: "https://cdn.worldvectorlogo.com/logos/shopify.svg",         url: "https://shopify.com" },
          { name: "Segment",         src: "https://cdn.worldvectorlogo.com/logos/segment-1.svg",         url: "https://segment.com" },
        ]),
        testimonialSec("proof", "Was unsere Kunden sagen", [
          { quote: "Wir haben Mister Chameleon an einem Freitagabend hinzugefugt und bis Montag hatte sich unsere Trial-Anmeldungsrate bereits bewegt. Es war der schnellste Erfolg, den wir seit Monaten hatten.", author: "Lotte van den Berg", role: "Head of Growth", company: "Stackr" },
          { quote: "Das Enterprise-Segment-Feature allein hat das erste Jahr bezahlt. Besucher von Zielaccounts sehen jetzt unsere Enterprise-Fallstudien direkt vorne - unsere SDRs lieben den Kontext.", author: "Pieter Claes", role: "Marketing Director", company: "Axius Systems" },
          { quote: "Wir waren skeptisch gegenuber Personalisierung ohne Third-Party-Cookies. Mister Chameleon hat bewiesen, dass man sie nicht braucht. Ihr First-Party-Ansatz ubertraf unser altes tag-basiertes Setup.", author: "Sara Mehta", role: "VP Digital", company: "Lumio Group" },
        ]),
        textMedia("how-it-works-teaser", "text_media_right",
          "Unter 50 Millisekunden",
          "Personalisierung, die stattfindet, bevor Ihre Seite ladt.",
          "Die Entscheidungsengine lauft in Next.js Edge Middleware - nicht im Browser. Wenn Ihr Besucher Ihre Homepage sieht, ist die richtige Variante bereits ausgewahlt. Kein Flackern. Kein Layout-Shift. Kein Leistungsverlust.",
          [{ label: "Sehen Sie, wie die Engine funktioniert", href: "/the-engine" }, { label: "Wie es funktioniert", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Leiterplatte als Symbol fur Edge-Computing-Technologie", caption: "Edge-nativ: Personalisierung ohne Latenz" },
        ),
        processSec("how-quick", "Live in 15 Minuten", [
          { title: "Snippet hinzufugen", description: "Ein Script-Tag im <head> Ihrer Website. Asynchron - keine Leistungseinbussen. Funktioniert mit jeder Website oder jedem Framework.", duration: "2 Min" },
          { title: "Inhaltsvariante erstellen", description: "Sanity Studio offnen. Eine alternative Uberschrift fur Besucher mit hoher Kaufabsicht schreiben. Speichern.", duration: "5 Min" },
          { title: "Regel schreiben", description: "Bedingung festlegen: 'Wenn Intent-Score > 60, hohe-Intent-Hero anzeigen'. Aktivieren.", duration: "3 Min" },
          { title: "Zusehen, wie es funktioniert", description: "Ihr nachster Besucher mit hoher Kaufabsicht bekommt automatisch die richtige Botschaft. Analytics prufen, um den Anstieg zu sehen.", duration: "Live" },
        ]),
        testimonialSec("proof-2", "Was unsere Kunden sagen", [
          { quote: "Wir haben Mister Chameleon an einem Freitagabend hinzugefugt und bis Montag hatte sich unsere Trial-Anmeldungsrate bereits bewegt. Es war der schnellste Erfolg, den wir seit Monaten hatten.", author: "Lotte van den Berg", role: "Head of Growth", company: "Stackr" },
          { quote: "Das Enterprise-Segment-Feature allein hat das erste Jahr bezahlt. Besucher von Zielaccounts sehen jetzt unsere Enterprise-Fallstudien direkt vorne - unsere SDRs lieben den Kontext.", author: "Pieter Claes", role: "Marketing Director", company: "Axius Systems" },
          { quote: "Wir waren skeptisch gegenuber Personalisierung ohne Third-Party-Cookies. Mister Chameleon hat bewiesen, dass man sie nicht braucht. Ihr First-Party-Ansatz ubertraf unser altes tag-basiertes Setup.", author: "Sara Mehta", role: "VP Digital", company: "Lumio Group" },
        ]),
        featureGrid("use-cases", "Fur Ihre Branche entwickelt", "feature_grid_3up", [
          { title: "B2B SaaS", description: "Zeigen Sie Enterprise-Inhalte an Enterprise-Besucher, Trial-CTAs an Forscher mit hoher Kaufabsicht und Onboarding-Prompts an bestehende Kunden.", icon: "monitor" },
          { title: "Recruitment & HR", description: "Personalisieren Sie getrennt fur Arbeitgeber und Kandidaten. Steigern Sie qualifizierte Bewerbungen und reduzieren Sie die Arbeitgeberfluktuation in den ersten 90 Tagen.", icon: "users" },
          { title: "Digitalagenturen", description: "Verwalten Sie Personalisierung fur alle Ihre Kunden von einem einzigen White-Label-Dashboard unter Ihrer eigenen Marke. Ein Pro-Plan, unbegrenzte Kundenseiten.", icon: "layout" },
        ], { label: "Alle Use Cases ansehen", href: "/use-cases-saas" }),
        pricingSec("pricing-teaser", "Einfache, ehrliche Preise", "Kostenlos starten. Skalieren Sie, wenn Sie wachsen.", [
          { _key: "t0", name: "Starter", price: "€149", period: "/Monat", description: "Fur wachsende Teams, die mit Personalisierung beginnen mochten.", highlighted: false, features: [ { _key: "f0", label: "25.000 personalisierte Sitzungen/Monat" }, { _key: "f1", label: "Regelbasierte Personalisierung" }, { _key: "f2", label: "3 Inhaltsvarianten pro Seite" }, { _key: "f3", label: "14 Tage kostenlos testen" } ], ctaLabel: "Kostenlos testen", ctaHref: "/order/starter" },
          { _key: "t1", name: "Growth", price: "€349", period: "/Monat", description: "Fur Teams, die es mit Konversion ernst meinen. CRM-Integration, KI-Entscheidungen, vollstandige Analytics.", highlighted: true, badge: "Beliebtester Plan", features: [ { _key: "f0", label: "150.000 personalisierte Sitzungen/Monat" }, { _key: "f1", label: "KI-gestutzte Variantenentscheidungen" }, { _key: "f2", label: "CRM- und ABM-Integration" }, { _key: "f3", label: "Vollstandiges Analytics-Dashboard" }, { _key: "f4", label: "Unbegrenzte Varianten" } ], ctaLabel: "Kostenlos testen", ctaHref: "/order/growth" },
          { _key: "t2", name: "Pro / Agentur", price: "€749", period: "/Monat", description: "Fur Agenturen und Teams, die Personalisierung auf mehreren Websites betreiben.", highlighted: false, badge: "Agentur-ready", features: [ { _key: "f0", label: "500.000 Sitzungen/Monat" }, { _key: "f1", label: "Unbegrenzte Kundenseiten" }, { _key: "f2", label: "Vollstandiges White-Label-Interface" }, { _key: "f3", label: "Eigene Domain pro Kunde" }, { _key: "f4", label: "Prioritats-Support" } ], ctaLabel: "Mit Pro starten", ctaHref: "/order/pro" },
        ], "14 Tage kostenlos testen bei jedem Plan. Keine Kreditkarte erforderlich. Jahrliche Abrechnung spart 20%."),
      ],
      { hero: { fallbackVariantKey: "hero_direct_brand" }, proof: { fallbackVariantKey: "proof_cases" } },
    ),
    locale: "de",
  },

  // ── NL about ──────────────────────────────────────────────────────────────────
  {
    ...page("about-nl", "about", "Over ons - NL", "landing-page",
      "Over Mister Chameleon - het team achter adaptieve personalisatie",
      "We bouwden Mister Chameleon omdat we vinden dat websites slimmer, persoonlijker en gebruiksvriendelijker kunnen zijn. Zonder privacy-compromissen.",
      [
        { _type: "about", _key: "hero-full", variant: "media_full",
          heading: "We geloven dat elke website zich aan zijn bezoekers moet aanpassen.",
          body: pt(
            "Niet alleen de websites van bedrijven met data science teams, enterprise budgetten en zes maanden implementatietijd. Elke website. Inclusief die van u.",
            "We bouwden Mister Chameleon om dat mogelijk te maken - privacy-first, CMS-gedreven en bedienbaar door een marketingteam zonder een regel aangepaste code.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&auto=format&fit=crop&q=80",
          imageAlt: "Het Mister Chameleon team aan het werk in een lichte Amsterdamse werkruimte",
          ctas: [{ _key: "c0", label: "Lees ons manifest", href: "/manifesto" }, { _key: "c1", label: "Ontmoet het team", href: "/about-team" }],
        },
        statsSec("stats", "Het platform in cijfers", [
          { label: "Gepersonaliseerde sessies geleverd", value: "12M", suffix: "+", description: "Op 200+ websites, elke bezoeker de juiste content geserveerd." },
          { label: "Klantsites met personalisatie", value: "200", suffix: "+", description: "B2B SaaS teams, digitale bureaus, e-commerce en recruitmentbedrijven door heel Europa." },
          { label: "Landen waar klanten gevestigd zijn", value: "18", description: "Gebouwd in Amsterdam. Vertrouwd van Lissabon tot Helsinki." },
          { label: "Totale pipeline-latency", value: "<50", suffix: "ms", description: "Signaalverzameling, verrijking, scoring en variantselectie - voordat de pagina rendert." },
        ]),
        { _type: "about", _key: "origin", variant: "media_right",
          heading: "Gebouwd door mensen die het probleem als eerste voelden.",
          body: pt(
            "We brachten jaren door met het bouwen en marketen van B2B SaaS-producten. Elke keer dat we onze websites wilden personaliseren, betekende dat een developer-sprint, een third-party cookie-setup die juridisch onzeker voelde, en een wachttijd van zes maanden voordat we iets konden meten. De tools die bestonden waren te complex, te duur, of te afhankelijk van data die we in Europa niet legaal konden gebruiken.",
            "Mister Chameleon is het platform dat we hadden willen hebben. Privacy-first door architectuur, niet door een vinkje. Bedienbaar door marketing, niet eigendom van engineering. En snel genoeg om echt verschil te maken voor bezoekers die niet gaan wachten.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Twee medeoprichters die ideen bespreken op een whiteboard in een Amsterdams kantoor",
          ctas: [{ _key: "c0", label: "Lees het volledige manifest", href: "/manifesto" }],
        },
        featureGrid("values", "Wat we geloven", "feature_grid_3up", [
          { title: "Privacy hoort standaard te zijn.", description: "Elke architectuurbeslissing begint met: kunnen we dit doen zonder cookies of third-party data? Het antwoord is bijna altijd ja. AVG-compliance zit in het ontwerp, niet er achteraf op geplakt.", icon: "shield" },
          { title: "Marketing moet zelf kunnen schakelen.", description: "Als het activeren van een variant een developer-sprint vereist, heeft het tool gefaald. Elke functie in Mister Chameleon is ontworpen om door een marketingteam gemaakt, geconfigureerd en aangepast te worden - onafhankelijk.", icon: "edit-3" },
          { title: "Transparantie bouwt vertrouwen.", description: "We publiceren onze prijzen, onze uptime, onze gegevensverwerkingsdetails en onze roadmap. Geen dark patterns, geen misleidende trials, geen verborgen gebruikslimieten. Wat je ziet is wat je betaalt.", icon: "eye" },
          { title: "Kleine teams verdienen goede tools.", description: "De conversievoordelen van personalisatie mogen niet beperkt zijn tot bedrijven met data science budgetten. Ons Starter-plan is €149/maand en bevat de volledige beslisengine.", icon: "heart" },
          { title: "Je data blijft van jou.", description: "Bezoekersgedragsdata wordt opgeslagen in jouw eigen Supabase-database, in jouw gekozen regio. We zijn een gegevensverwerker, geen dataverzamelaar. Je kunt op elk moment alles exporteren of verwijderen.", icon: "database" },
          { title: "Goede personalisatie valt eigenlijk niet op.", description: "Bezoekers moeten zich niet getarget voelen. Ze moeten gewoon het gevoel hebben dat de website hen begrijpt. Goede adaptieve personalisatie is de implementatie die niemand opmerkt - omdat het gewoon klopt.", icon: "cpu" },
        ]),
        { _type: "about", _key: "product-vision", variant: "media_left",
          heading: "Een beslisengine die op de edge draait.",
          body: pt(
            "De meeste personalisatietools werken door content te injecteren nadat de pagina geladen is - wat layoutflikkering veroorzaakt, de gepercipieerde ervaring vertraagt en voor bezoekers triviaal makkelijk te ontdekken is. We namen een andere aanpak.",
            "De Mister Chameleon beslisengine draait op de edge, voordat een enkele byte HTML naar de bezoeker wordt gestuurd. Signaalverzameling, bedrijfsverrijking, intentie-scoring en variantselectie vinden allemaal plaats in minder dan 50 milliseconden - voordat de pagina rendert. De bezoeker ziet de gepersonaliseerde versie bij de eerste lading, zonder flikkering en zonder vertraging.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Close-up van printplaat die de snelheid en precisie van de beslisengine vertegenwoordigt",
          ctas: [{ _key: "c0", label: "Hoe de engine werkt", href: "/the-engine" }, { _key: "c1", label: "Bekijk alle functies", href: "/features" }],
        },
        { _type: "about", _key: "traction", variant: "media_right",
          heading: "200+ sites. 12 miljoen sessies. Nog steeds groeiend.",
          body: pt(
            "Twee jaar na het schrijven van de eerste regel code draait Mister Chameleon personalisatie voor meer dan 200 websites in 18 landen. We hebben meer dan 12 miljoen gepersonaliseerde sessies geleverd. We zijn winstgevend, onafhankelijk en hebben geen externe financiering aangenomen.",
            "Onze klanten zijn B2B SaaS-teams die intentie-scoring gebruiken om bezoekers met hoge geschiktheid te prioriteren, recruitmentplatforms die personaliseren voor werkgevers en kandidaten in dezelfde sessie, en digitale bureaus die white-label personalisatiediensten aanbieden voor hun klanten.",
            "We zijn een klein team en we zijn van plan dat zo te blijven zolang het ons beter maakt. Elke nieuwe persoon die we aannemen verhoogt de lat - hij verlaagt hem niet.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Mister Chameleon teamlid presenteert resultaten aan collega's rondom een tafel",
          ctas: [{ _key: "c0", label: "Lees klantverhalen", href: "/cases" }, { _key: "c1", label: "Ontmoet het team", href: "/about-team" }],
        },
        testimonialSec("testimonials", "Wat onze klanten over ons zeggen", [
          { quote: "Mister Chameleon gaf ons de conversielift waar we twee jaar naar zochten - met een fractie van de inspanning. Setup duurde een middag. Resultaten verschenen in de eerste week.", author: "Sanne T.", role: "Head of Growth", company: "Growlytics" },
          { quote: "We waren sceptisch over personalisatie vanwege AVG. Mister Chameleon is het eerste tool dat we vonden dat dit echt goed aanpakt - privacy-first, niet privacy-washed. Ons juridisch team tekende zonder enige discussie.", author: "Lars K.", role: "CTO", company: "JobBridge" },
          { quote: "Personalisatie beheren voor 12 klanten vanuit een white-label dashboard heeft ons servicemodel volledig veranderd. Het is nu een kernomzetbron voor het bureau - en de marge is uitstekend.", author: "Mila D.", role: "Founder", company: "Frontline Agency" },
        ]),
        { _type: "about", _key: "privacy", variant: "media_left",
          heading: "Privacy-first is een architectuurbeslissing, geen marketingclaim.",
          body: pt(
            "We maakten vroeg een bewuste keuze: het hele platform bouwen zonder afhankelijkheid van third-party cookies, third-party datamakelaars of data die expliciete toestemming vereist om te verzamelen. Die beperking maakte bepaalde dingen moeilijker te bouwen. Het maakte het product ook echt beter.",
            "IP-naar-bedrijf verrijking draait server-side en geeft alleen organisatorische metadata terug - er zijn geen persoonsgegevens bij betrokken. Gedragsregistratie is first-party, opgeslagen in uw database, onder uw controle. De beslisengine draait op de edge met alleen de signalen die beschikbaar zijn in de aanvraagcontext en uw eigen opgeslagen data.",
            "We zijn een gegevensverwerker onder de AVG. De gegevens van uw bezoekers zijn van u. Wij kunnen ze niet inzien, verkopen of gebruiken voor andere doeleinden dan het leveren van uw personalisatie. Dit is opgenomen in onze DPA en is controleerbaar.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Beveiligde serverruimte die first-party dataopslag en privacy-first architectuur vertegenwoordigt",
          ctas: [{ _key: "c0", label: "Lees ons privacybeleid", href: "/privacy" }, { _key: "c1", label: "Bekijk AVG- en DPA-details", href: "/gdpr" }],
        },
        { _type: "about", _key: "amsterdam", variant: "media_full",
          heading: "Gevestigd in Amsterdam. Actief door heel Europa.",
          body: pt(
            "Ons kantoor is op de Keizersgracht in Amsterdam. Wanneer het team in de stad is, gebruiken we het voor planningssessies, onboarding en de occasionele lange vrijdag. De meeste dagen vindt u ons op Slack, in een Notion-document of in een 30-minuten videogesprek dat op tijd eindigt.",
            "Het team is verspreid over Nederland, Belgie, Duitsland en Portugal. We ontmoeten elkaar drie of vier keer per jaar in Amsterdam voor de dingen die echt een whiteboard nodig hebben.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1512470604991-7eb6a473b052?w=1400&auto=format&fit=crop&q=80",
          imageAlt: "Amsterdamse gracht overdag met historische gebouwen weerspiegeld in het water",
          ctas: [{ _key: "c0", label: "Neem contact op", href: "/contact" }],
        },
        quickLinks("explore", "Meer over Mister Chameleon", "Alles wat het waard is te weten over het bedrijf, het product en wat we hierna bouwen.", [
          { label: "Ons manifest", href: "/manifesto", description: "De principes die elke productbeslissing sturen - wat we geloven en waarom we dit bouwden." },
          { label: "Ontmoet het team", href: "/about-team", description: "Foto's, bios en rollen. Veertien mensen die adaptieve personalisatie bouwen vanuit Amsterdam." },
          { label: "De engine", href: "/the-engine", description: "Een technische diepduik in hoe de beslisengine werkt - signalen, scoring en variantselectie." },
          { label: "Roadmap", href: "/roadmap", description: "Wat we hierna bouwen - en wat al verzonden is. Elke sprint bijgewerkt." },
          { label: "Cases", href: "/cases", description: "Growlytics, JobBridge en Frontline Agency - echte resultaten van echte personalisatie." },
          { label: "Vacatures", href: "/jobs", description: "We groeien. Kom ons helpen het platform voor adaptieve websites te bouwen." },
        ]),
        ctaSec("cta", "Overtuigd? Probeer het platform.", "Gratis trial. Geen creditcard. Live in 15 minuten. Op elk moment opzegbaar.", "Gratis proefperiode starten", "/order/starter"),
      ],
      { "proof": { fallbackVariantKey: "proof_vision" } },
      ["team", "cultuur", "werkgever", "merk", "over ons", "employer brand"],
    ),
    locale: "nl",
  },

  // ── DE about ──────────────────────────────────────────────────────────────────
  {
    ...page("about-de", "about", "Uber uns - DE", "landing-page",
      "Uber Mister Chameleon - das Team hinter adaptiver Personalisierung",
      "Wir haben Mister Chameleon gebaut, weil wir glauben, dass sich jede Website an ihre Besucher anpassen sollte - ohne Data-Science-Team oder Datenschutzkompromiss.",
      [
        { _type: "about", _key: "hero-full", variant: "media_full",
          heading: "Wir glauben, dass sich jede Website an ihre Besucher anpassen sollte.",
          body: pt(
            "Nicht nur die Websites von Unternehmen mit Data-Science-Teams, Enterprise-Budgets und sechsmonatigen Implementierungszeitplanen. Jede Website. Einschliesslich Ihrer.",
            "Wir haben Mister Chameleon gebaut, um das moglich zu machen - Privacy-first, CMS-gesteuert und von einem Marketingteam ohne eine einzige Zeile benutzerdefiniertem Code bedienbar.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1400&auto=format&fit=crop&q=80",
          imageAlt: "Das Mister Chameleon Team bei der Arbeit in einem hellen Amsterdamer Buro",
          ctas: [{ _key: "c0", label: "Unser Manifest lesen", href: "/manifesto" }, { _key: "c1", label: "Das Team kennenlernen", href: "/about-team" }],
        },
        statsSec("stats", "Die Plattform in Zahlen", [
          { label: "Personalisierte Sitzungen geliefert", value: "12M", suffix: "+", description: "Auf 200+ Websites - jeder Besucher mit dem richtigen Inhalt bedient." },
          { label: "Kundenseiten mit Personalisierung", value: "200", suffix: "+", description: "B2B SaaS-Teams, Digitalagenturen, E-Commerce und Recruitment-Unternehmen in ganz Europa." },
          { label: "Lander mit Kunden", value: "18", description: "Entwickelt in Amsterdam. Vertraut von Lissabon bis Helsinki." },
          { label: "Gesamte Pipeline-Latenz", value: "<50", suffix: "ms", description: "Signalerfassung, Anreicherung, Scoring und Variantenauswahl - bevor die Seite rendert." },
        ]),
        { _type: "about", _key: "origin", variant: "media_right",
          heading: "Von Menschen entwickelt, die das Problem als Erste spurten.",
          body: pt(
            "Wir verbrachten Jahre damit, B2B SaaS-Produkte aufzubauen und zu vermarkten. Jedes Mal, wenn wir unsere Websites personalisieren wollten, bedeutete das einen Entwickler-Sprint, ein Drittanbieter-Cookie-Setup, das sich rechtlich preckar anfuhlte, und eine sechsmonatige Wartezeit, bevor wir irgendetwas messen konnten.",
            "Mister Chameleon ist die Plattform, die wir uns gewunscht hatten. Privacy-first durch Architektur, nicht durch ein Kontrollkastchen. Von Marketing bedienbar, nicht im Besitz des Engineering-Teams. Und schnell genug, um einen echten Unterschied fur Besucher zu machen, die nicht warten werden.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Zwei Mitgrunder diskutieren an einem Whiteboard in einem Amsterdamer Buro",
          ctas: [{ _key: "c0", label: "Das vollstandige Manifest lesen", href: "/manifesto" }],
        },
        featureGrid("values", "Was wir glauben", "feature_grid_3up", [
          { title: "Datenschutz ist kein Kompromiss", description: "Jede Architekturentscheidung beginnt mit: Konnen wir das ohne Cookies oder Drittanbieter-Daten tun? Die Antwort ist fast immer ja. DSGVO-Compliance ist im Design verankert, nicht nachtraglich hinzugefugt.", icon: "shield" },
          { title: "Marketingteams sollen Personalisierung besitzen", description: "Wenn das Aktivieren einer Variante einen Entwickler-Sprint erfordert, hat das Tool versagt. Jede Funktion in Mister Chameleon ist so konzipiert, dass sie von einem Marketingteam erstellt, konfiguriert und angepasst werden kann - unabhangig.", icon: "edit-3" },
          { title: "Transparenz schafft Vertrauen", description: "Wir veroffentlichen unsere Preise, unsere Betriebszeit, unsere Datenverarbeitungsdetails und unsere Roadmap. Keine Dark Patterns, keine irrefuhrenden Testphasen, keine versteckten Nutzungslimits.", icon: "eye" },
          { title: "Kleine Teams verdienen ernsthafte Tools", description: "Die Konversionsvorteile der Personalisierung sollten nicht auf Unternehmen mit Data-Science-Budgets beschrankt sein. Unser Starter-Plan ist €149/Monat und beinhaltet die vollstandige Entscheidungsengine.", icon: "heart" },
          { title: "Ihre Daten bleiben bei Ihnen", description: "Besucherverhaltensdaten werden in Ihrer eigenen Supabase-Datenbank in Ihrer gewunschten Region gespeichert. Wir sind ein Datenverarbeiter, kein Datenhorter.", icon: "database" },
          { title: "Die beste Personalisierung ist unsichtbar", description: "Besucher sollten sich nicht gezielt angesprochen fuhlen. Sie sollten einfach das Gefuhl haben, dass die Website sie versteht. Gute adaptive Personalisierung ist die Implementierung, die niemand bemerkt.", icon: "cpu" },
        ]),
        { _type: "about", _key: "product-vision", variant: "media_left",
          heading: "Eine Entscheidungsengine, die am Edge lauft.",
          body: pt(
            "Die meisten Personalisierungstools funktionieren, indem sie Inhalte nach dem Laden der Seite injizieren - was Layout-Flackern verursacht, die wahrgenommene Erfahrung verlangsamt und fur Besucher trivial leicht zu bemerken ist. Wir haben einen anderen Ansatz gewahlt.",
            "Die Mister Chameleon Entscheidungsengine lauft am Edge, bevor ein einziges Byte HTML an den Besucher gesendet wird. Signalerfassung, Unternehmensanreicherung, Intent-Scoring und Variantenauswahl finden alle in unter 50 Millisekunden statt - bevor die Seite rendert.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Nahaufnahme einer Leiterplatte, die die Geschwindigkeit und Prazision der Entscheidungsengine reprasentiert",
          ctas: [{ _key: "c0", label: "Wie die Engine funktioniert", href: "/the-engine" }, { _key: "c1", label: "Alle Funktionen ansehen", href: "/features" }],
        },
        { _type: "about", _key: "traction", variant: "media_right",
          heading: "200+ Websites. 12 Millionen Sitzungen. Immer noch wachsend.",
          body: pt(
            "Zwei Jahre nach dem Schreiben der ersten Codezeile betreibt Mister Chameleon Personalisierung fur uber 200 Websites in 18 Landern. Wir haben mehr als 12 Millionen personalisierte Sitzungen geliefert. Wir sind profitabel, unabhangig und haben keine externe Finanzierung angenommen.",
            "Zu unseren Kunden gehoren B2B SaaS-Teams, die Intent-Scoring einsetzen, um Besucher mit hoher Eignung zu priorisieren, Recruitment-Plattformen, die fur Arbeitgeber und Kandidaten in derselben Sitzung personalisieren, und Digitalagenturen, die White-Label-Personalisierungsdienste fur ihre Kunden anbieten.",
            "Wir sind ein kleines Team und wir haben vor, das so zu bleiben, solange es uns besser macht. Jede neue Person, die wir einstellen, hebt die Messlatte - senkt sie nicht.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Mister Chameleon Teammitglied prasentiert Ergebnisse Kollegen um einen Tisch",
          ctas: [{ _key: "c0", label: "Kundenstories lesen", href: "/cases" }, { _key: "c1", label: "Das Team kennenlernen", href: "/about-team" }],
        },
        testimonialSec("testimonials", "Was unsere Kunden uber uns sagen", [
          { quote: "Mister Chameleon gab uns den Konversionszuwachs, den wir zwei Jahre lang angestrebt hatten - mit einem Bruchteil des Aufwands. Die Einrichtung dauerte einen Nachmittag. Die Ergebnisse zeigten sich in der ersten Woche.", author: "Sanne T.", role: "Head of Growth", company: "Growlytics" },
          { quote: "Wir waren skeptisch gegenuber Personalisierung wegen der DSGVO. Mister Chameleon ist das erste Tool, das wir gefunden haben, das das wirklich richtig handhabt - Privacy-first, nicht Privacy-washed. Unser Rechtsteam stimmte ohne eine einzige Ruckfrage zu.", author: "Lars K.", role: "CTO", company: "JobBridge" },
          { quote: "Personalisierung fur 12 Kunden von einem White-Label-Dashboard aus zu verwalten, hat unser Servicemodell vollstandig verandert. Es ist jetzt eine Kerneinnahmequelle fur die Agentur - und die Marge ist ausgezeichnet.", author: "Mila D.", role: "Founder", company: "Frontline Agency" },
        ]),
        { _type: "about", _key: "privacy", variant: "media_left",
          heading: "Privacy-first ist eine Architekturentscheidung, kein Marketingversprechen.",
          body: pt(
            "Wir haben fruh eine bewusste Entscheidung getroffen: die gesamte Plattform ohne Abhangigkeit von Drittanbieter-Cookies, Drittanbieter-Datenbrokern oder Daten aufzubauen, die eine ausdruckliche Einwilligung zur Erhebung erfordern. Diese Einschrankung machte bestimmte Dinge schwieriger zu entwickeln. Sie machte das Produkt auch wirklich besser.",
            "Die IP-zu-Unternehmen-Anreicherung lauft serverseitig und gibt nur organisatorische Metadaten zuruck - es sind keine personenbezogenen Daten beteiligt. Das Verhaltens-Tracking ist First-Party, in Ihrer Datenbank gespeichert, unter Ihrer Kontrolle. Die Entscheidungsengine lauft am Edge und verwendet nur die im Anforderungskontext verfugbaren Signale und Ihre eigenen gespeicherten Daten.",
            "Wir sind ein Datenverarbeiter im Sinne der DSGVO. Die Daten Ihrer Besucher gehoren Ihnen. Wir konnen sie nicht einsehen, verkaufen oder fur andere Zwecke als die Bereitstellung Ihrer Personalisierung verwenden. Dies ist in unserer DPA verankert und ist pruftbar.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=900&auto=format&fit=crop&q=80",
          imageAlt: "Sicherer Serverraum als Symbol fur First-Party-Datenspeicherung und Privacy-first-Architektur",
          ctas: [{ _key: "c0", label: "Datenschutzerklarung lesen", href: "/privacy" }, { _key: "c1", label: "DSGVO- und DPA-Details ansehen", href: "/gdpr" }],
        },
        { _type: "about", _key: "amsterdam", variant: "media_full",
          heading: "Hauptsitz in Amsterdam. Team in ganz Europa.",
          body: pt(
            "Unser Buro befindet sich am Keizersgracht in Amsterdam. Wenn das Team in der Stadt ist, nutzen wir es fur Planungssitzungen, Onboarding und den gelegentlichen langen Freitag. Die meiste Zeit finden Sie uns auf Slack, in einem Notion-Dokument oder in einem 30-Minuten-Videoanruf, der punktlich endet.",
            "Das Team ist uber die Niederlande, Belgien, Deutschland und Portugal verteilt. Wir treffen uns drei- oder viermal im Jahr in Amsterdam fur die Dinge, die wirklich ein Whiteboard brauchen.",
          ),
          imageUrl: "https://images.unsplash.com/photo-1512470604991-7eb6a473b052?w=1400&auto=format&fit=crop&q=80",
          imageAlt: "Amsterdamer Gracht mit historischen Gebuden, die sich im Wasser spiegeln",
          ctas: [{ _key: "c0", label: "Kontakt aufnehmen", href: "/contact" }],
        },
        quickLinks("explore", "Mehr uber Mister Chameleon", "Alles Wissenswerte uber das Unternehmen, das Produkt und was wir als nachstes entwickeln.", [
          { label: "Unser Manifest", href: "/manifesto", description: "Die Prinzipien, die jede Produktentscheidung leiten - was wir glauben und warum wir das gebaut haben." },
          { label: "Das Team", href: "/about-team", description: "Fotos, Biographien und Rollen. Vierzehn Menschen, die adaptive Personalisierung aus Amsterdam aufbauen." },
          { label: "Die Engine", href: "/the-engine", description: "Ein technischer Einblick in die Funktionsweise der Entscheidungsengine - Signale, Scoring und Variantenauswahl." },
          { label: "Roadmap", href: "/roadmap", description: "Was wir als nachstes entwickeln - und was bereits ausgeliefert wurde. Jeden Sprint aktualisiert." },
          { label: "Fallstudien", href: "/cases", description: "Growlytics, JobBridge und Frontline Agency - echte Ergebnisse echter Personalisierung." },
          { label: "Offene Stellen", href: "/jobs", description: "Wir wachsen. Kommen Sie und helfen Sie uns, die Plattform fur adaptive Websites zu entwickeln." },
        ]),
        ctaSec("cta", "Uberzeugt? Testen Sie die Plattform.", "Kostenlose Testphase. Keine Kreditkarte. Live in 15 Minuten. Jederzeit kundbar.", "Kostenlose Testphase starten", "/order/starter"),
      ],
      { "proof": { fallbackVariantKey: "proof_vision" } },
      ["team", "kultur", "arbeitgeber", "marke", "über uns", "employer brand"],
    ),
    locale: "de",
  },

  // ── NL pricing ──────────────────────────────────────────────────────────────
  {
    ...page("pricing-nl", "pricing", "Prijzen", "marketing-page",
      "Mister Chameleon prijzen - Starter, Growth en Pro",
      "Duidelijke prijzen zonder verborgen kosten. Start gratis en schaal op wanneer je eraan toe bent.",
      [
        textMedia("header-banner", "text_media_right",
          "Prijzen die met u meegroeien.",
          "Drie plannen. Een prijs. Geen verborgen kosten.",
          "Geen kosten per gebruiker, geen 'neem contact op' drempel, geen verrassende facturen. Elk plan start met een gratis proefperiode van 14 dagen - geen creditcard vereist. Kies het plan dat past bij uw huidige verkeer en schakel over wanneer u er klaar voor bent.",
          [{ label: "Start gratis proefperiode", href: "/order/starter" }, { label: "Plannen vergelijken", href: "#plans" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&auto=format&fit=crop&q=80", alt: "Transparante prijzen op een scherm" },
        ),
        pricingSec("plans", "Kies uw plan", "Alle plannen bevatten onbeperkte gebruikers, een gratis proefperiode van 14 dagen en AVG-conforme infrastructuur.", [
          {
            _key: "tier-starter", name: "Starter", price: "€149", period: "/maand",
            description: "Voor groeiende teams die de hoogst bezochte pagina's willen personaliseren zonder een engineeringproject.",
            features: [
              { _key: "f0", label: "25.000 gepersonaliseerde sessies/maand" },
              { _key: "f1", label: "Regelgebaseerde personalisatie-engine" },
              { _key: "f2", label: "IP-naar-bedrijfsverrijking" },
              { _key: "f3", label: "Sanity CMS-integratie" },
              { _key: "f4", label: "Basis analysedashboard" },
              { _key: "f5", label: "E-mailondersteuning" },
            ],
            ctaLabel: "Start gratis proefperiode", ctaHref: "/order/starter",
          },
          {
            _key: "tier-growth", name: "Growth", price: "€349", period: "/maand",
            description: "Voor teams die AI-gestuurde beslissingen, CRM-data en diepere analyses willen om hun personalisatie continu te optimaliseren.",
            highlighted: true, badge: "Meest populair",
            features: [
              { _key: "f0", label: "150.000 gepersonaliseerde sessies/maand" },
              { _key: "f1", label: "AI-gestuurde beslisengine" },
              { _key: "f2", label: "CRM- en ABM-verrijking (HubSpot, Salesforce)" },
              { _key: "f3", label: "Aangepaste doelgroepsegmenten" },
              { _key: "f4", label: "Volledig analysedashboard met funnel" },
              { _key: "f5", label: "A/B- en multivariaat testen" },
              { _key: "f6", label: "Aangepaste vervalprofilen" },
              { _key: "f7", label: "Prioritaire e-mailondersteuning" },
            ],
            ctaLabel: "Start gratis proefperiode", ctaHref: "/order/growth",
          },
          {
            _key: "tier-pro", name: "Pro", price: "€749", period: "/maand",
            description: "Voor bureaus en enterprise teams die personalisatie beheren over meerdere klantwebsites.",
            features: [
              { _key: "f0", label: "500.000 gepersonaliseerde sessies/maand" },
              { _key: "f1", label: "Alle Growth-functies" },
              { _key: "f2", label: "Multi-site bureaumodus" },
              { _key: "f3", label: "White-label interface en aangepast domein" },
              { _key: "f4", label: "Per-klant content- en analyseisolatie" },
              { _key: "f5", label: "SLA en DPA inbegrepen" },
              { _key: "f6", label: "Prioritaire ondersteuning met onboardinggesprek" },
            ],
            ctaLabel: "Aan de slag", ctaHref: "/order/pro",
          },
        ], "Jaarlijkse facturering: bespaar 17% op Starter (€124/mnd) of 20% op Growth (€279/mnd) en Pro (€599/mnd). Meer dan 500K sessies nodig? Neem contact met ons op."),
        logoStrip("trusted-logos", "In goed gezelschap", [
          { name: "Stackr",           src: "" },
          { name: "Axius Systems",    src: "" },
          { name: "Lumio Group",      src: "" },
          { name: "HubSpot",          src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg" },
          { name: "Pipedrive",        src: "https://cdn.worldvectorlogo.com/logos/pipedrive.svg" },
          { name: "Typeform",         src: "https://cdn.worldvectorlogo.com/logos/typeform.svg" },
        ]),
        faqSec("faq", "Veelgestelde vragen over prijzen", [
          { question: "Wat telt als een gepersonaliseerde sessie?", answer: "Een gepersonaliseerde sessie is een unieke bezoeker die in een bepaalde kalendermaand een gepersonaliseerde ervaring krijgt. Als dezelfde bezoeker vijf keer in april terugkomt, telt dat als een sessie in uw maandelijkse limiet." },
          { question: "Wat gebeurt er als ik mijn sessielimiet overschrijd?", answer: "Uw site blijft werken - bezoekers zien alleen de standaard contentvariant in plaats van een gepersonaliseerde. U kunt sessie-topuppakketten kopen (10K, 50K of 200K) om uw limiet te verlengen zonder van plan te wisselen." },
          { question: "Kan ik het uitproberen voordat ik koop?", answer: "Ja. Elk plan start met een gratis proefperiode van 14 dagen. Geen creditcard nodig om te beginnen. U vult betalingsgegevens pas in als u wilt doorgaan." },
          { question: "Wat zijn verrijkingskrediten?", answer: "Verrijkingskrediten dekken API-gestuurde dataopzoekingen - bedrijfsdata, weer, CRM-matching en ABM-targeting. Elke opzoeking kost een krediet. Het Starterplan bevat basiskrediten; Growth en Pro bevatten meer. U kunt extra pakketten kopen vanaf €6,50 voor 250 krediten." },
          { question: "Kan ik van plan wisselen midden in een maand?", answer: "Ja. Upgrades zijn direct van kracht en worden pro rata berekend. Downgrades gaan in aan het begin van de volgende factureringsperiode." },
          { question: "Biedt u korting voor non-profits of startups?", answer: "Ja - neem contact op via hello@misterchameleon.io met uw organisatiegegevens en we bespreken de mogelijkheden." },
        ]),
        ctaSec("cta", "Niet zeker welk plan past?", "Boek een gesprek van 20 minuten en we vertellen u precies welk plan past bij uw verkeer en doelen.", "Boek een gesprek", "/contact"),
      ],
      { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
      ["pricing", "tarieven", "kosten", "abonnement", "prijs", "plan", "offerte"],
    ),
    locale: "nl",
  },

  // ── DE pricing ──────────────────────────────────────────────────────────────
  {
    ...page("pricing-de", "pricing", "Preise", "marketing-page",
      "Mister Chameleon Preise - Starter, Growth, Pro",
      "Einfache, transparente Preise. Kostenlos starten. Skalieren Sie mit Ihrem Wachstum. Keine versteckten Kosten, keine Kosten pro Nutzer, keine Engineering-Kosten.",
      [
        textMedia("header-banner", "text_media_right",
          "Preise, die mit Ihnen wachsen.",
          "Drei Plane. Ein Preis. Keine versteckten Kosten.",
          "Keine Kosten pro Nutzer, keine 'Vertrieb kontaktieren' Hurden, keine uberraschenden Rechnungen. Jeder Plan startet mit einer kostenlosen 14-Tage-Testversion - keine Kreditkarte erforderlich. Wahlen Sie den Plan, der zu Ihrem aktuellen Traffic passt, und wechseln Sie, wenn Sie bereit sind.",
          [{ label: "Kostenlos testen", href: "/order/starter" }, { label: "Plane vergleichen", href: "#plans" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&auto=format&fit=crop&q=80", alt: "Transparente Preise auf einem Bildschirm" },
        ),
        pricingSec("plans", "Wahlen Sie Ihren Plan", "Alle Plane beinhalten unbegrenzte Nutzer, eine 14-tagige kostenlose Testversion und DSGVO-konforme Infrastruktur.", [
          {
            _key: "tier-starter", name: "Starter", price: "€149", period: "/Monat",
            description: "Fur wachsende Teams, die ihre meistbesuchten Seiten personalisieren mochten - ohne Engineering-Projekt.",
            features: [
              { _key: "f0", label: "25.000 personalisierte Sitzungen/Monat" },
              { _key: "f1", label: "Regelbasierte Personalisierungs-Engine" },
              { _key: "f2", label: "IP-zu-Firmen-Anreicherung" },
              { _key: "f3", label: "Sanity CMS-Integration" },
              { _key: "f4", label: "Basis-Analyse-Dashboard" },
              { _key: "f5", label: "E-Mail-Support" },
            ],
            ctaLabel: "Kostenlos testen", ctaHref: "/order/starter",
          },
          {
            _key: "tier-growth", name: "Growth", price: "€349", period: "/Monat",
            description: "Fur Teams, die KI-gesteuerte Entscheidungen, CRM-Daten und tiefere Analysen wunschen, um ihre Personalisierung kontinuierlich zu optimieren.",
            highlighted: true, badge: "Am beliebtesten",
            features: [
              { _key: "f0", label: "150.000 personalisierte Sitzungen/Monat" },
              { _key: "f1", label: "KI-gesteuerte Entscheidungs-Engine" },
              { _key: "f2", label: "CRM- und ABM-Anreicherung (HubSpot, Salesforce)" },
              { _key: "f3", label: "Benutzerdefinierte Zielgruppensegmente" },
              { _key: "f4", label: "Vollstandiges Analyse-Dashboard mit Funnel" },
              { _key: "f5", label: "A/B- und multivariate Tests" },
              { _key: "f6", label: "Benutzerdefinierte Verfall-Profile" },
              { _key: "f7", label: "Prioritare E-Mail-Unterstutzung" },
            ],
            ctaLabel: "Kostenlos testen", ctaHref: "/order/growth",
          },
          {
            _key: "tier-pro", name: "Pro", price: "€749", period: "/Monat",
            description: "Fur Agenturen und Enterprise-Teams, die Personalisierung uber mehrere Kundenwebsites verwalten.",
            features: [
              { _key: "f0", label: "500.000 personalisierte Sitzungen/Monat" },
              { _key: "f1", label: "Alle Growth-Funktionen" },
              { _key: "f2", label: "Multi-Site-Agenturmodus" },
              { _key: "f3", label: "White-Label-Interface und benutzerdefinierte Domain" },
              { _key: "f4", label: "Pro-Kunde Content- und Analyse-Isolierung" },
              { _key: "f5", label: "SLA und DPA inklusive" },
              { _key: "f6", label: "Prioritarer Support mit Onboarding-Gesprach" },
            ],
            ctaLabel: "Jetzt starten", ctaHref: "/order/pro",
          },
        ], "Jahrliche Abrechnung: Sparen Sie 17% auf Starter (€124/Mnt.) oder 20% auf Growth (€279/Mnt.) und Pro (€599/Mnt.). Mehr als 500K Sitzungen benotigt? Sprechen Sie uns an."),
        logoStrip("trusted-logos", "In guter Gesellschaft", [
          { name: "Stackr",           src: "" },
          { name: "Axius Systems",    src: "" },
          { name: "Lumio Group",      src: "" },
          { name: "HubSpot",          src: "https://cdn.worldvectorlogo.com/logos/hubspot.svg" },
          { name: "Pipedrive",        src: "https://cdn.worldvectorlogo.com/logos/pipedrive.svg" },
          { name: "Typeform",         src: "https://cdn.worldvectorlogo.com/logos/typeform.svg" },
        ]),
        faqSec("faq", "Haufige Fragen zu den Preisen", [
          { question: "Was zahlt als personalisierte Sitzung?", answer: "Eine personalisierte Sitzung ist ein einzigartiger Besucher, der in einem bestimmten Kalendermonat eine personalisierte Erfahrung erhalt. Wenn derselbe Besucher funfmal im April zuruckkommt, zahlt das als eine Sitzung in Ihrem monatlichen Kontingent." },
          { question: "Was passiert, wenn ich mein Sitzungslimit uberschreite?", answer: "Ihre Website funktioniert weiterhin - Besucher sehen einfach die Standard-Inhaltsvariante statt einer personalisierten. Sie konnen Sitzungs-Top-up-Pakete kaufen (10K, 50K oder 200K), um Ihr Kontingent zu erhohen, ohne den Plan zu wechseln." },
          { question: "Kann ich es ausprobieren, bevor ich kaufe?", answer: "Ja. Jeder Plan startet mit einer 14-tagigen kostenlosen Testversion. Keine Kreditkarte erforderlich. Sie geben Zahlungsdaten erst ein, wenn Sie fortfahren mochten." },
          { question: "Was sind Anreicherungsgutschriften?", answer: "Anreicherungsgutschriften decken API-gestutzte Datenabfragen ab - Unternehmensdaten, Wetter, CRM-Matching und ABM-Targeting. Jede Abfrage kostet eine Gutschrift. Der Starter-Plan enthalt Basis-Gutschriften; Growth und Pro enthalten mehr. Zusatzliche Pakete ab €6,50 fur 250 Gutschriften." },
          { question: "Kann ich den Plan mitten im Monat wechseln?", answer: "Ja. Upgrades sind sofort wirksam und werden anteilig berechnet. Downgrades gelten ab Beginn des nachsten Abrechnungszeitraums." },
          { question: "Bieten Sie Rabatte fur gemeinnutzige Organisationen oder Startups?", answer: "Ja - kontaktieren Sie uns unter hello@misterchameleon.io mit Ihren Organisationsdetails und wir besprechen die Moglichkeiten." },
        ]),
        ctaSec("cta", "Nicht sicher, welcher Plan passt?", "Buchen Sie ein 20-minutiges Gesprach und wir sagen Ihnen genau, welcher Plan zu Ihrem Traffic und Ihren Zielen passt.", "Gesprach buchen", "/contact"),
      ],
      { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
      ["pricing", "preise", "kosten", "abonnement", "plan", "angebot"],
    ),
    locale: "de",
  },

  // ── NL contact ──────────────────────────────────────────────────────────────
  {
    ...page("contact-nl", "contact", "Contact", "landing-page",
      "Contact Mister Chameleon",
      "Neem contact op met het Mister Chameleon team. Voor sales, support, partnerships of gewoon een vraag.",
      [
        textMedia("hero", "text_media_right",
          "Een echt team. Echte antwoorden.",
          "Praat met ons - we lezen alles.",
          "Geen ticketsysteem naar een bot. Geen FAQ-doolhof. Elk bericht komt terecht bij een echt persoon die u daadwerkelijk kan helpen. Of u nu een live demo wilt, een technische vraag heeft of een samenwerking wilt verkennen - neem contact op en we reageren binnen een werkdag.",
          [{ label: "Stuur ons een bericht", href: "#contact-form" }, { label: "Boek een demogesprek", href: "https://cal.com/misterchameleon" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=900&auto=format&fit=crop&q=80", alt: "Teamlid in een videogesprek, als symbool voor responsieve menselijke ondersteuning" },
        ),
        statsSec("trust-stats", "Waarom teams als eerste bij ons aankloppen", [
          { value: "< 1", suffix: " dag", label: "Reactietijd", description: "Elk bericht beantwoord door een persoon binnen een werkdag - zonder uitzondering." },
          { value: "100", suffix: "%", label: "Menselijke reacties", description: "Geen automatische antwoordsjablonen. Een echt teamlid leest en beantwoordt elk bericht." },
          { value: "3", suffix: " manieren", label: "Om ons te bereiken", description: "E-mail, gespreksreservering of het formulier hieronder - gebruik wat het beste bij uw werkwijze past." },
          { value: "4,9", suffix: "/5", label: "Tevredenheid ondersteuning", description: "Over alle ondersteuningsinteracties in de afgelopen 12 maanden, beoordeeld door klanten." },
        ]),
        featureGrid("channels", "Kies hoe u verbinding wilt maken", "feature_grid_3up", [
          { title: "Sales en demo's", description: "hello@misterchameleon.io - vragen over proefperiodes, planvergelijkingen en live productdemo's. We nemen u mee door een echte opzet, geen presentatie.", icon: "mail" },
          { title: "Technische ondersteuning", description: "support@misterchameleon.io - integratiehelp, factuurvragen en platformvragen. Growth- en Pro-klanten ontvangen prioritaire reacties.", icon: "life-buoy" },
          { title: "Pers en partnerships", description: "press@misterchameleon.io - mediavragen, partnerschapsvoorstellen en vragen over het bureaupartnershipsprogramma. We reageren op elke serieuze aanvraag.", icon: "briefcase" },
        ]),
        textMedia("demo-callout", "text_media_left",
          "Liever een live gesprek?",
          "Boek een demogesprek van 20 minuten.",
          "Kies een tijdslot en we laten u een live Mister Chameleon-setup zien op een echte website - geen kant-en-klare walkthrough. We behandelen uw specifieke gebruiksscenario, beantwoorden uw prijsvragen en vertellen u eerlijk of we de juiste keuze zijn voor waar u nu staat.",
          [{ label: "Gesprek boeken", href: "https://cal.com/misterchameleon" }, { label: "Bekijk wat we bespreken", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=900&auto=format&fit=crop&q=80", alt: "Twee mensen in een videogesprek, een persoon deelt het scherm" },
        ),
        formSec("contact-form", "Stuur ons een bericht", "Vul het formulier in en we reageren binnen een werkdag. Growth- en Pro-klanten ontvangen prioritaire reacties.", "contact", "Bericht versturen"),
        processSec("what-happens-next", "Wat er gebeurt nadat u contact heeft opgenomen", [
          { title: "U stuurt uw bericht", description: "Via het bovenstaande formulier, e-mail of een geboekt tijdslot. Alle drie komen bij hetzelfde team terecht - niemand valt buiten de boot.", duration: "Nu" },
          { title: "Een echte persoon leest het", description: "Uw bericht komt in onze gedeelde inbox, niet in een ticketwachtrij. Het juiste teamlid pakt het op - meestal binnen een paar uur tijdens kantooruren.", duration: "Binnen uren" },
          { title: "We reageren met iets nuttigs", description: "Geen link naar de FAQ. Een echt antwoord, een vervolgvraag als we meer context nodig hebben, of een Calendly-link om dieper in te gaan.", duration: "Binnen 1 werkdag" },
          { title: "We houden u op gang", description: "Of het nu gaat om een proefperiode-opzet, een integratievraag of een voorstel - we blijven betrokken totdat uw vraag is opgelost.", duration: "Doorlopend" },
        ]),
        testimonialSec("support-testimonials", "Wat onze klanten zeggen over samenwerken met ons", [
          {
            quote: "Ik stuurde op vrijdagmiddag een vraag over een aangepaste integratie en had zaterdag ochtend een werkend antwoord in mijn inbox. Dat gebeurt niet bij softwarebedrijven.",
            author: "Lars Hendriks",
            role: "Head of Growth",
            company: "Logixflow",
          },
          {
            quote: "Het onboardinggesprek voelde als praten met een ontwikkelaar die onze stack echt begreep. We hadden onze eerste regel live binnen twee uur na het aanmelden.",
            author: "Sophie van den Berg",
            role: "CTO",
            company: "Frontline Agency",
          },
          {
            quote: "Elke keer dat ik een facturerings- of planvraag had, was de reactie snel, duidelijk en eerlijk. Geen upselldruk. Dat betekent veel voor ons.",
            author: "Pieter de Groot",
            role: "Oprichter",
            company: "JobBridge",
          },
        ]),
        teamSec("team", "De mensen van wie u bericht ontvangt", "Een klein, senior team. Iedereen die u antwoordt is er al bij het product van het begin af aan.",
          [
            {
              name: "Lena Brouwer",
              role: "Head of Customer Success",
              bio: "Lena heeft meer dan 200 klanten begeleid en heeft het ondersteuningsplaybook van de grond af opgebouwd. Als uw vraag een lastige integratie betreft, heeft ze die waarschijnlijk al eerder opgelost.",
              imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
              email: "support@misterchameleon.io",
              linkedinUrl: "https://linkedin.com",
            },
            {
              name: "Mark Visser",
              role: "Sales en Partnerships",
              bio: "Mark behandelt demo's, planvragen en partnerships. Hij geeft u een eerlijk antwoord of Mister Chameleon een goede keuze is - ook als dat antwoord 'nog niet' is.",
              imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
              email: "hello@misterchameleon.io",
              linkedinUrl: "https://linkedin.com",
            },
            {
              name: "Yasmin Osei",
              role: "Technische Ondersteuning",
              bio: "Yasmin is de persoon achter support@misterchameleon.io. Ze kent de codebase goed genoeg om configuratieproblemen in seconden te herkennen en ze uit te leggen in begrijpelijke taal.",
              imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
              email: "support@misterchameleon.io",
              linkedinUrl: "https://linkedin.com",
            },
          ],
        ),
        textMedia("office-intro", "text_media_right",
          "Gevestigd in Amsterdam.",
          "Een kantoor aan de gracht, en een volledig gedistribueerd team.",
          "Ons hoofdkantoor is aan de Keizersgracht in Amsterdam. Het grootste deel van het team werkt gedistribueerd door Nederland en Belgie - wat betekent dat er altijd iemand dicht bij een toetsenbord is tijdens Europese kantooruren.",
          [{ label: "Routebeschrijving", href: "https://maps.google.com/?q=Keizersgracht+125+Amsterdam" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=900&auto=format&fit=crop&q=80", alt: "Amsterdamse gracht met historische gebouwen, als symbool voor het kantoor aan de Keizersgracht" },
        ),
        mapBlock("office-map", "Vind ons in Amsterdam", "Keizersgracht 125", "1015 CJ Amsterdam", "Nederland", "hello@misterchameleon.io", "+31 20 123 4567", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2436.1234567890123!2d4.8895!3d52.3726!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c609b7f7f7f7f7%3A0x1234567890abcdef!2sKeizersgracht%20125%2C%201015%20CJ%20Amsterdam!5e0!3m2!1snl!2snl!4v1234567890"),
        faqSec("contact-faq", "Veelgestelde vragen voordat u contact opneemt", [
          { question: "Hoe snel reageert u?", answer: "Binnen een werkdag voor alle kanalen. Growth- en Pro-klanten ontvangen prioritaire reacties, doorgaans binnen een paar uur tijdens Nederlandse kantooruren (09:00-18:00 CET)." },
          { question: "Kan ik een terugbetaling krijgen of mijn abonnement opzeggen?", answer: "Ja - neem contact op via support@misterchameleon.io. We verwerken opzeggingen binnen een werkdag. Terugbetalingen worden per geval behandeld; we kijken altijd eerlijk naar uw situatie." },
          { question: "Ik wil een aangepast enterprise-contract. Met wie spreek ik?", answer: "Neem contact op via hello@misterchameleon.io met uw bedrijfsgrootte, verkeersvolume en vereisten. Enterprise-voorstellen bevatten aangepaste limieten, SSO, een toegewijde CSM en jaarlijkse facturering." },
          { question: "Biedt u implementatieondersteuning?", answer: "Ja. Elk Growth- en Pro-plan bevat een onboardinggesprek. Pro-klanten krijgen ook een Slack-kanaal met directe toegang tot het team gedurende de eerste 90 dagen." },
          { question: "Ik ben journalist of onderzoeker. Met wie neem ik contact op?", answer: "Stuur uw verzoek naar press@misterchameleon.io. We reageren op alle serieuze mediavragen en geven graag gegevens, citaten of toegang tot een woordvoerder voor relevante verhalen." },
        ]),
        ctaSec("cta", "Klaar om te praten?", "Reserveer een tijdslot van 20 minuten of stuur een bericht - wij nemen het van daar over.", "Boek een demogesprek", "https://cal.com/misterchameleon"),
      ],
      { "proof": { fallbackVariantKey: "proof_vision" } },
      ["contact", "support", "diensten", "services"],
    ),
    locale: "nl",
  },

  // ── DE contact ──────────────────────────────────────────────────────────────
  {
    ...page("contact-de", "contact", "Kontakt", "landing-page",
      "Kontakt Mister Chameleon",
      "Nehmen Sie Kontakt mit dem Mister Chameleon Team auf. Vertrieb, Support, Partnerschaften, Presse oder einfach eine Frage - wir lesen alles.",
      [
        textMedia("hero", "text_media_right",
          "Ein echtes Team. Echte Antworten.",
          "Sprechen Sie mit uns - wir lesen alles.",
          "Kein Ticketsystem, das zu einem Bot weiterleitet. Kein FAQ-Labyrinth. Jede Nachricht landet bei einer echten Person, die Ihnen tatsachlich helfen kann. Ob Sie eine Live-Demo mochten, eine technische Frage haben oder eine Partnerschaft erkunden - melden Sie sich und wir antworten innerhalb eines Werktages.",
          [{ label: "Schreiben Sie uns", href: "#contact-form" }, { label: "Demo-Gesprach buchen", href: "https://cal.com/misterchameleon" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=900&auto=format&fit=crop&q=80", alt: "Teammitglied in einem Videoanruf, als Symbol fur reaktionsschnellen menschlichen Support" },
        ),
        statsSec("trust-stats", "Warum Teams zuerst bei uns anfragen", [
          { value: "< 1", suffix: " Tag", label: "Reaktionszeit", description: "Jede Nachricht wird von einer Person innerhalb eines Werktages beantwortet - ausnahmslos." },
          { value: "100", suffix: "%", label: "Menschliche Antworten", description: "Keine automatischen Antwortvorlagen. Ein echtes Teammitglied liest und beantwortet jede Nachricht." },
          { value: "3", suffix: " Wege", label: "Um uns zu erreichen", description: "E-Mail, Gesprachsbuchung oder das untenstehende Formular - verwenden Sie, was am besten in Ihren Arbeitsablauf passt." },
          { value: "4,9", suffix: "/5", label: "Support-Zufriedenheit", description: "Uber alle Support-Interaktionen in den letzten 12 Monaten, bewertet von Kunden." },
        ]),
        featureGrid("channels", "Wahlen Sie, wie Sie sich verbinden mochten", "feature_grid_3up", [
          { title: "Vertrieb und Demos", description: "hello@misterchameleon.io - Fragen zu Testversionen, Planvergleiche und Live-Produktdemos. Wir fuhren Sie durch ein echtes Setup, keine Prasentationsfolien.", icon: "mail" },
          { title: "Technischer Support", description: "support@misterchameleon.io - Integrationshilfe, Rechnungsfragen und Plattformfragen. Growth- und Pro-Kunden erhalten prioritare Antworten.", icon: "life-buoy" },
          { title: "Presse und Partnerschaften", description: "press@misterchameleon.io - Medienanfragen, Partnerschaftsvorschlage und Fragen zum Agenturpartnerprogramm. Wir antworten auf jede ernsthafte Anfrage.", icon: "briefcase" },
        ]),
        textMedia("demo-callout", "text_media_left",
          "Bevorzugen Sie ein Live-Gesprach?",
          "Buchen Sie ein 20-minutiges Demo-Gesprach.",
          "Wahlen Sie einen Termin und wir zeigen Ihnen ein Live-Mister-Chameleon-Setup auf einer echten Website - keine vorgefertigte Prasentation. Wir behandeln Ihren spezifischen Anwendungsfall, beantworten Ihre Preisfragen und sagen Ihnen ehrlich, ob wir die richtige Wahl fur Ihre aktuelle Situation sind.",
          [{ label: "Gesprach buchen", href: "https://cal.com/misterchameleon" }, { label: "Was wir besprechen", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=900&auto=format&fit=crop&q=80", alt: "Zwei Personen in einem Videoanruf, eine Person teilt den Bildschirm" },
        ),
        formSec("contact-form", "Schreiben Sie uns", "Fullen Sie das Formular aus und wir melden uns innerhalb eines Werktages. Growth- und Pro-Kunden erhalten prioritare Antworten.", "contact", "Nachricht senden"),
        processSec("what-happens-next", "Was nach Ihrer Kontaktaufnahme passiert", [
          { title: "Sie senden Ihre Nachricht", description: "Uber das obige Formular, per E-Mail oder einen gebuchten Termin. Alle drei gehen an dasselbe Team - niemand geht verloren.", duration: "Jetzt" },
          { title: "Eine echte Person liest sie", description: "Ihre Nachricht landet in unserem gemeinsamen Posteingang, nicht in einer Ticketwarteschlange. Das richtige Teammitglied nimmt sich darum - normalerweise innerhalb weniger Stunden wahrend der Geschaftszeiten.", duration: "Innerhalb von Stunden" },
          { title: "Wir antworten mit etwas Nutzlichem", description: "Kein Link zur FAQ. Eine echte Antwort, eine Ruckfrage wenn wir mehr Kontext benotigen, oder ein Calendly-Link fur ein tieferes Gesprach.", duration: "Innerhalb 1 Werktag" },
          { title: "Wir halten Sie in Bewegung", description: "Ob es sich um ein Trial-Setup, eine Integrationsfrage oder ein Angebot handelt - wir bleiben eingebunden, bis Ihre Frage gelost ist.", duration: "Fortlaufend" },
        ]),
        testimonialSec("support-testimonials", "Was unsere Kunden uber die Zusammenarbeit mit uns sagen", [
          {
            quote: "Ich schickte am Freitagnachmittag eine Frage zu einer benutzerdefinierten Integration und hatte am Samstagmorgen eine funktionierende Antwort in meinem Posteingang. Das passiert nicht bei Softwareunternehmen.",
            author: "Lars Hendriks",
            role: "Head of Growth",
            company: "Logixflow",
          },
          {
            quote: "Das Onboarding-Gesprach fuhlte sich an wie ein Gesprach mit einem Entwickler, der unseren Stack wirklich verstand. Wir hatten unsere erste Regel innerhalb von zwei Stunden nach der Anmeldung live.",
            author: "Sophie van den Berg",
            role: "CTO",
            company: "Frontline Agency",
          },
          {
            quote: "Jedes Mal, wenn ich eine Abrechnungs- oder Planfrage hatte, war die Antwort schnell, klar und ehrlich. Kein Upsell-Druck. Das bedeutet uns sehr viel.",
            author: "Pieter de Groot",
            role: "Grunder",
            company: "JobBridge",
          },
        ]),
        teamSec("team", "Die Menschen, von denen Sie horen werden", "Ein kleines, erfahrenes Team. Jeder, der Ihnen antwortet, ist seit den Anfangen beim Produkt dabei.",
          [
            {
              name: "Lena Brouwer",
              role: "Head of Customer Success",
              bio: "Lena hat uber 200 Kunden eingearbeitet und das Support-Playbook von Grund auf aufgebaut. Wenn Ihre Frage eine knifflige Integration betrifft, hat sie sie wahrscheinlich schon gelost.",
              imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
              email: "support@misterchameleon.io",
              linkedinUrl: "https://linkedin.com",
            },
            {
              name: "Mark Visser",
              role: "Vertrieb und Partnerschaften",
              bio: "Mark kummert sich um Demos, Planfragen und Partnerschaften. Er gibt Ihnen eine direkte Antwort, ob Mister Chameleon gut zu Ihnen passt - auch wenn diese Antwort 'noch nicht' lautet.",
              imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
              email: "hello@misterchameleon.io",
              linkedinUrl: "https://linkedin.com",
            },
            {
              name: "Yasmin Osei",
              role: "Technischer Support",
              bio: "Yasmin ist die Person hinter support@misterchameleon.io. Sie kennt die Codebasis gut genug, um Konfigurationsprobleme in Sekunden zu erkennen und sie in verstandlichem Deutsch zu erklaren.",
              imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
              email: "support@misterchameleon.io",
              linkedinUrl: "https://linkedin.com",
            },
          ],
        ),
        textMedia("office-intro", "text_media_right",
          "In Amsterdam ansassig.",
          "Ein Buro am Kanal und ein vollstandig verteiltes Team.",
          "Unser Hauptsitz befindet sich an der Keizersgracht in Amsterdam. Der Grosteil des Teams arbeitet verteilt in den Niederlanden und Belgien - was bedeutet, dass wahrend der europaischen Geschaftszeiten immer jemand erreichbar ist.",
          [{ label: "Wegbeschreibung", href: "https://maps.google.com/?q=Keizersgracht+125+Amsterdam" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=900&auto=format&fit=crop&q=80", alt: "Amsterdamer Kanal mit historischen Gebauden als Symbol fur den Burostandort an der Keizersgracht" },
        ),
        mapBlock("office-map", "Finden Sie uns in Amsterdam", "Keizersgracht 125", "1015 CJ Amsterdam", "Niederlande", "hello@misterchameleon.io", "+31 20 123 4567", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2436.1234567890123!2d4.8895!3d52.3726!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c609b7f7f7f7f7%3A0x1234567890abcdef!2sKeizersgracht%20125%2C%201015%20CJ%20Amsterdam!5e0!3m2!1sde!2snl!4v1234567890"),
        faqSec("contact-faq", "Haufige Fragen vor der Kontaktaufnahme", [
          { question: "Wie schnell antworten Sie?", answer: "Innerhalb eines Werktages fur alle Kanale. Growth- und Pro-Kunden erhalten prioritare Antworten, typischerweise innerhalb weniger Stunden wahrend der niederlandischen Geschaftszeiten (09:00-18:00 MEZ)." },
          { question: "Kann ich eine Ruckerstattung erhalten oder mein Abonnement kundigen?", answer: "Ja - kontaktieren Sie support@misterchameleon.io. Wir bearbeiten Kundigungen innerhalb eines Werktages. Ruckerstattungen werden von Fall zu Fall behandelt; wir schauen immer fair auf Ihre Situation." },
          { question: "Ich mochte einen benutzerdefinierten Enterprise-Vertrag. Mit wem spreche ich?", answer: "Kontaktieren Sie hello@misterchameleon.io mit Ihrer Unternehmensgrosse, Ihrem Traffic-Volumen und Ihren Anforderungen. Enterprise-Angebote umfassen benutzerdefinierte Limits, SSO, einen dedizierten CSM und jahrliche Rechnungsstellung." },
          { question: "Bieten Sie Implementierungsunterstutzung?", answer: "Ja. Jeder Growth- und Pro-Plan beinhaltet ein Onboarding-Gesprach. Pro-Kunden erhalten auch einen Slack-Kanal mit direktem Zugang zum Team fur die ersten 90 Tage." },
          { question: "Ich bin Journalist oder Forscher. An wen wende ich mich?", answer: "Senden Sie Ihre Anfrage an press@misterchameleon.io. Wir antworten auf alle ernsthaften Medienanfragen und stellen gerne Daten, Zitate oder Zugang zu einem Sprecher fur relevante Berichte bereit." },
        ]),
        ctaSec("cta", "Bereit zum Gesprach?", "Buchen Sie einen 20-minutigen Termin oder schicken Sie eine Nachricht - wir kummern uns um den Rest.", "Demo-Gesprach buchen", "https://cal.com/misterchameleon"),
      ],
      { "proof": { fallbackVariantKey: "proof_vision" } },
      ["kontakt", "support", "dienstleistungen", "services"],
    ),
    locale: "de",
  },

  // ── NL how-it-works ──────────────────────────────────────────────────────────
  {
    ...page("how-it-works-nl", "how-it-works", "Hoe het werkt - NL", "marketing-page",
      "Hoe Mister Chameleon werkt - realtime personalisatie uitgelegd",
      "Ontdek hoe Mister Chameleon bezoekerssignalen analyseert, intentie berekent en automatisch de juiste content toont.",
      [
        textMedia("hero", "text_media_right",
          "Minder dan 50 ms van paginabezoek tot gepersonaliseerde content.",
          "Een snippet. De volledige personalisatiepipeline.",
          "Voeg een enkel JavaScript-snippet toe aan uw website. Vanaf dat moment krijgt elke bezoeker een ervaring op maat van zijn signalen - verkeersbron, intentiescore, bedrijfsdata en gedragsgeschiedenis - allemaal opgelost voordat de pagina klaar is met laden. Geen developersprints. Geen CMS-migraties. Geen wachten.",
          [{ label: "Open de live demo", href: "/demo" }, { label: "Gratis proefperiode starten", href: "/order/starter" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Printplaat als metafoor voor de snelheid van de beslissingspipeline" },
        ),
        statsSec("perf-stats", "De pipeline in cijfers", [
          { label: "Totale pipeline-latency", value: "<50", suffix: "ms", description: "Signaalverzameling, verrijking, scoring en variantselectie - alles voor het renderen van de pagina." },
          { label: "Signalen per bezoek geëvalueerd", value: "130", suffix: "+", description: "Gedrags-, verrijkings-, contextuele, CRM- en tijdgebaseerde signalen gecombineerd tot één beslissing." },
          { label: "Variantbeslissingstijd", value: "<10", suffix: "ms", description: "De beslisengine kiest de best passende contentvariant in minder dan 10 milliseconden." },
          { label: "Uitsluitend first-party data", value: "100", suffix: "%", description: "Geen third-party cookies. Geen datamakelaars. Alle bezoekersdata blijft in uw eigen database." },
        ]),
        processSec("pipeline", "Wat er bij elke paginabezoek gebeurt", [
          { title: "Bezoeker arriveert - signalen worden direct gelezen", description: "Op het moment dat iemand op uw site belandt, leest de edge-functie de volledige requestcontext: UTM-parameters, referrer, verkeersbron, apparaattype en eventuele sessie-identifier. Dit gebeurt voordat één byte HTML wordt verstuurd - nul blokkerende latency.", duration: "0 ms" },
          { title: "Sessie wordt herkend en geschiedenis geladen", description: "Terugkerende bezoekers worden gekoppeld aan hun bestaande gedragsprofiel dat first-party in uw database is opgeslagen. Bezochte pagina's, scrolldiepte, tijd op de prijspagina, CTA-klikken, formulierinteracties en eerdere variantblootstellingen zijn allemaal beschikbaar voor de beslisengine.", duration: "< 5 ms" },
          { title: "Bedrijf wordt stil verrijkt vanuit IP", description: "Als de bezoeker van een herkenbaar IP-bereik komt, zoekt de verrijkingsdienst hun bedrijfsnaam, branche, personeelsschatting en organisatietype op. Dit loopt asynchroon naast het laden van de sessie - het blokkeert het renderen van de pagina nooit.", duration: "< 20 ms" },
          { title: "Intentie wordt gescoord en funnel-fase voorspeld", description: "De scoring engine combineert alle beschikbare signalen tot een intentiescore van 0-100. Een funnel-faselabel wordt toegewezen: bewustwording, overweging, intentie, hoge intentie of klant. Deze fase stuurt de regelkoppeling.", duration: "< 5 ms" },
          { title: "Regels worden op prioriteitsvolgorde geëvalueerd", description: "De beslisengine doorloopt uw personalisatieregels - elk gedefinieerd door voorwaarden en een contentplan. De eerste regel waarvan alle voorwaarden overeenkomen met deze bezoeker wint.", duration: "< 5 ms" },
          { title: "De beste variant wordt geserveerd bij de eerste render", description: "Het winnende contentplan wordt toegepast. Uw CMS serveert de gekoppelde hero-variant, proof-blok en CTA - precies goed voor deze bezoeker, op dit moment. Geen flikkering. Geen layoutverschuiving. Geen tweede request.", duration: "< 10 ms" },
        ]),
        textMedia("demo-video", "text_media_stacked",
          "Bekijk het in actie",
          "Zie de volledige pipeline in minder dan twee minuten.",
          "Deze walkthrough toont de beslisengine in actie: een bezoeker arriveert van LinkedIn, de verrijkingsdienst identificeert hun bedrijf, de intentiescore wordt berekend en een visie-gedreven hero met een thought-leadership CTA wordt geserveerd - allemaal voordat de pagina klaar is met laden.",
          [{ label: "Open de interactieve demo", href: "/demo" }, { label: "Verken de engine", href: "/the-engine" }],
          { type: "video", url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "De volledige personalisatiepipeline - van signaalverzameling tot variantselectie" },
        ),
        textMedia("signals-intro", "text_media_left",
          "Wat de engine ziet",
          "130+ signalen. Één uniforme bezoekercontext.",
          "De meeste personalisatietools handelen op één of twee signalen - doorgaans UTM-bron of apparaattype. Mister Chameleon combineert elk zinvol signaal tot één bezoekercontextobject dat de beslisengine holistisch gebruikt. Het resultaat is een rijkere, nauwkeurigere contentbeslissing dan elke enkelvoudige aanpak kan produceren.",
          [{ label: "Verken intentie-scoring", href: "/features-intent" }, { label: "Verken verrijking", href: "/features-enrichment" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=900&auto=format&fit=crop&q=80", alt: "Datavisualisatie van meerdere signaalstromen die convergeren naar één score" },
        ),
        featureGrid("signals", "Signalen die de engine evalueert", "feature_grid_3up", [
          { title: "Verkeersbron", description: "UTM-parameters, referrerdomein en bronclassificatie (Google, LinkedIn, direct, e-mail, dark social). Elk bronpatroon impliceert een andere bezoekersintenties en krijgt een andere eerste indruk.", icon: "globe" },
          { title: "Gedragsgeschiedenis", description: "Bezochte pagina's in deze sessie en historisch, scrolldiepte, tijd op pagina, CTA-klikken, formulierstarts, formulierafronding en navigatiesequenties. Opgeslagen first-party in uw database.", icon: "activity" },
          { title: "IP-bedrijfsverrijking", description: "Bedrijfsnaam, branche, geschatte personeelsomvang en organisatietype - stil opgezocht via het IP-adres van de bezoeker. Geen cookies. Geen toestemmingsbanner vereist. AVG-compliant.", icon: "briefcase" },
          { title: "Intentie- en betrokkenheidsscores", description: "Twee samengestelde 0-100-scores: intentie (kans op conversie) en betrokkenheid (investering in uw content). Beide worden bij elke paginabezoek herberekend.", icon: "trending-up" },
          { title: "Funnel-fase", description: "Een voorspeld levenscycluslabel - bewustwording, overweging, intentie, hoge intentie of klant - afgeleid van intentiescore, gedragsdiepte en CRM-data.", icon: "filter" },
          { title: "Tijd- en weercontext", description: "Dag van de week, tijdstip, seizoen en lokale weersomstandigheden. Nuttig voor campagnes, event-gedreven content en locale-specifieke personalisatie.", icon: "clock" },
          { title: "CRM- en ABM-data", description: "Op Growth- en Pro-plannen krijgen bekende contacten en doelaccounts content die is afgestemd op hun CRM-levenscyclusfase en accountniveau.", icon: "users" },
          { title: "Apparaat en locatie", description: "Apparaattype, besturingssysteem, browser, voorkeurstaal en geografische regio. Maakt apparaatspecifieke layouts en locale-afgestemde content mogelijk.", icon: "monitor" },
          { title: "Bezoekersreispatronen", description: "Benoemde gedragssequenties - startpagina naar product, terugkeer naar prijspagina, terugkerende bezoeker met hoge betrokkenheid - gekoppeld aan de volledige navigatiegeschiedenis.", icon: "map" },
        ]),
        textMedia("cms-side", "text_media_right",
          "De contentzijde",
          "Varianten leven in uw CMS. Marketing beheert ze.",
          "Elke contentbeslissing die de engine neemt, is gekoppeld aan een variant die in Sanity is gedefinieerd. Uw marketingteam maakt hero-varianten voor verschillende doelgroepen, schrijft proof-secties voor verschillende funnelfases en stelt CTA-tekst in voor verschillende intentieniveaus. Geen developer nodig na de eerste installatie.",
          [{ label: "Alle functies bekijken", href: "/features" }, { label: "Open de live demo", href: "/demo" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1587620962725-abab19836a68?w=900&auto=format&fit=crop&q=80", alt: "Marketingmedewerker die een contentvariant bewerkt in het Sanity CMS-dashboard", caption: "Marketing maakt varianten in Sanity. De engine beslist wie welke ziet." },
        ),
        textMedia("rules-side", "text_media_left",
          "De regelszijde",
          "Visuele regelbuilder. Geen SQL. Geen code.",
          "Personalisatieregels worden gedefinieerd in een visuele editor - niet in code. Elke regel heeft een set voorwaarden en een contentplan. Regels worden op prioriteitsvolgorde geëvalueerd bij elk request.",
          [{ label: "Verken de engine", href: "/the-engine" }, { label: "Bekijk doelgroepsegmenten", href: "/features-segments" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900&auto=format&fit=crop&q=80", alt: "Visuele regeleditor met voorwaarden en variantkoppeling", caption: "Regels zijn voorwaarden plus contentplannen - geen code vereist." },
        ),
        testimonialSec("proof", "Wat teams zeggen na de lancering", [
          { quote: "De pipeline-uitleg verkocht het voor ons. Minder dan 50ms, uitsluitend first-party, geen cookies - dat vinkelde alle boxen van ons juridische team. We waren live binnen een uur na het aanmelden.", author: "Thomas Becker", role: "CTO", company: "Growlytics" },
          { quote: "Ik verwachtte een week aan engineeringwerk. Het was een scripttag en een middag in het CMS. De regeleditor is oprecht intuïtief - ik heb onze eerste drie personalisatieregels zelf ingesteld.", author: "Sanne de Vries", role: "Head of Growth", company: "Frontline Agency" },
          { quote: "Wat me het meest verraste was de intentie-scoring. Een realtime score zien bijwerken terwijl ik door de demo bladerde - en dan de hero zien veranderen toen ik 60 overschreed - maakte het allemaal meteen helder.", author: "Priya Nair", role: "Marketing Manager", company: "JobBridge" },
        ]),
        processSec("setup", "Hoe u live gaat", [
          { title: "Voeg de scripttag toe", description: "Kopieer één JavaScript-snippet van uw dashboard en voeg het toe aan de <head> van uw site. Werkt met elke techstack - Next.js, Webflow, WordPress, Shopify, aangepaste HTML. Geen SDK te installeren.", duration: "2 minuten" },
          { title: "Maak uw eerste contentvarianten", description: "Open Sanity en dupliceer uw bestaande hero-sectie. Schrijf een alternatieve kop en CTA voor een specifiek publiek - LinkedIn-bezoekers, terugkerende gebruikers met hoge intentie, of enterprise-prospects.", duration: "10 minuten" },
          { title: "Definieer een personalisatieregel", description: "Stel in de regeleditor de voorwaarde in (utmSource gelijk aan linkedin), koppel deze aan uw nieuwe hero-variant en een bijpassende CTA, en stel een prioriteit in. Publiceer de regel. De engine begint deze te gebruiken bij de volgende paginabezoek.", duration: "3 minuten" },
          { title: "Bekijk en itereer", description: "Open het analyticsdashboard. Zie hoe uw variant presteert ten opzichte van de standaard. Gebruik de A/B-testmodule om een gecontroleerd experiment uit te voeren.", duration: "Doorlopend" },
        ]),
        faqSec("faq", "Veelgestelde vragen", [
          { question: "Vertraagt het snippet mijn website?", answer: "Nee. De edge-functie wordt uitgevoerd voordat de pagina wordt geserveerd, niet nadat deze is geladen. De totale pipeline - signaalverwerking, verrijking, scoring en variantselectie - wordt voltooid in minder dan 50ms en loopt parallel aan uw paginarender." },
          { question: "Wat gebeurt er als geen personalisatieregel overeenkomt?", answer: "Er wordt een standaard contentplan geserveerd - dezelfde hero, proof-sectie en CTA die uw site momenteel toont. Personalisatie is additief: bezoekers die niet aan enige regel voldoen, zien uw bestaande content ongewijzigd." },
          { question: "Hoe wordt bezoekersdata opgeslagen?", answer: "Alle gedragsdata wordt first-party opgeslagen in uw eigen database - niet op onze servers. Verrijkingsdata wordt opgelost bij het request en kort gecacht voor prestaties. Er worden geen third-party cookies ingesteld. Alle dataverwerking is AVG-compliant by design." },
          { question: "Kan ik een voorbeeld bekijken van wat een bezoeker uit een specifiek segment ziet?", answer: "Ja. Het Scenario Control-paneel laat u elk bezoekerSprofiel simuleren - UTM-bron, intentiescore, funnelfase, bedrijfstype - en de pagina in realtime zien aanpassen." },
          { question: "Werkt het met mijn bestaande CMS?", answer: "Mister Chameleon gebruikt Sanity als contentlaag voor de opslag van varianten. Uw bestaande website-CMS blijft ongewijzigd - u hoeft geen content te migreren. De variantlaag werkt naast uw bestaande setup." },
        ]),
        ctaSec("cta", "Zie het live in uw eigen browser", "Onze interactieve demo laat u elk bezoekerSprofiel simuleren en de pagina in realtime aanpassen. Geen aanmelding vereist.", "Open live demo", "/demo"),
      ],
      undefined,
      ["features", "platform", "integraties", "technisch", "setup"],
    ),
    locale: "nl",
  },

  // ── DE how-it-works ──────────────────────────────────────────────────────────
  {
    ...page("how-it-works-de", "how-it-works", "Wie es funktioniert - DE", "marketing-page",
      "Wie Mister Chameleon funktioniert - adaptive Personalisierung erklart",
      "Erfahren Sie, wie Mister Chameleon Besuchersignale erkennt, Kaufabsichten bewertet, Unternehmensdaten anreichert und die perfekte Variante in unter 50ms ausliefert.",
      [
        textMedia("hero", "text_media_right",
          "Weniger als 50 ms vom Seitenaufruf bis zum personalisierten Inhalt.",
          "Ein Snippet. Die vollstandige Personalisierungs-Pipeline.",
          "Fugen Sie ein einzelnes JavaScript-Snippet zu Ihrer Website hinzu. Ab diesem Moment erhalt jeder Besucher eine auf seine Signale zugeschnittene Erfahrung - Verkehrsquelle, Intent-Score, Unternehmensdaten und Verhaltenshistorie - alles aufgelost, bevor die Seite fertig geladen ist. Keine Entwickler-Sprints. Keine CMS-Migrationen. Kein Warten.",
          [{ label: "Live-Demo offnen", href: "/demo" }, { label: "Kostenlose Testphase starten", href: "/order/starter" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Leiterplatte als Symbol fur die Geschwindigkeit der Entscheidungs-Pipeline" },
        ),
        statsSec("perf-stats", "Die Pipeline in Zahlen", [
          { label: "Gesamte Pipeline-Latenz", value: "<50", suffix: "ms", description: "Signalerfassung, Anreicherung, Scoring und Variantenauswahl - alles vor dem Seitenrendering." },
          { label: "Ausgewertete Signale pro Besuch", value: "130", suffix: "+", description: "Verhaltens-, Anreicherungs-, kontextuelle, CRM- und zeitbasierte Signale zu einer Entscheidung kombiniert." },
          { label: "Variantenentscheidungszeit", value: "<10", suffix: "ms", description: "Die Entscheidungsengine wahlt die am besten passende Inhaltsvariante in unter 10 Millisekunden." },
          { label: "Ausschliesslich First-Party-Daten", value: "100", suffix: "%", description: "Keine Drittanbieter-Cookies. Keine Datenmakler. Alle Besucherdaten bleiben in Ihrer eigenen Datenbank." },
        ]),
        processSec("pipeline", "Was bei jedem Seitenaufruf passiert", [
          { title: "Besucher kommt an - Signale werden sofort gelesen", description: "In dem Moment, in dem jemand Ihre Website besucht, liest die Edge-Funktion den vollstandigen Request-Kontext: UTM-Parameter, Referrer, Verkehrsquelle, Gerattyp und eventuelle Sitzungskennung. Dies geschieht, bevor ein einziges Byte HTML gesendet wird - null blockierende Latenz.", duration: "0 ms" },
          { title: "Sitzung wird erkannt und Verlauf geladen", description: "Wiederkehrende Besucher werden mit ihrem bestehenden Verhaltensprofil abgeglichen, das First-Party in Ihrer Datenbank gespeichert ist. Besuchte Seiten, Scrolltiefe, Zeit auf der Preisseite, CTA-Klicks und fruhere Variantenexposure sind alle fur die Entscheidungsengine verfugbar.", duration: "< 5 ms" },
          { title: "Unternehmen wird still aus IP angereichert", description: "Wenn der Besucher aus einem erkennbaren IP-Bereich kommt, sucht der Anreicherungsdienst den Firmennamen, die Branche, die Personalschatzung und den Organisationstyp nach. Dies lauft asynchron zum Laden der Sitzung - es blockiert niemals das Seitenrendering.", duration: "< 20 ms" },
          { title: "Kaufabsicht wird bewertet und Funnel-Phase vorhergesagt", description: "Die Scoring-Engine kombiniert alle verfugbaren Signale zu einem Intent-Score von 0-100. Ein Funnel-Phasenlabel wird zugewiesen: Bewusstsein, Erwagung, Kaufabsicht, hohe Kaufabsicht oder Kunde.", duration: "< 5 ms" },
          { title: "Regeln werden in Prioritatsreihenfolge ausgewertet", description: "Die Entscheidungsengine durchlauft Ihre Personalisierungsregeln - jede definiert durch Bedingungen und einen Inhaltsplan. Die erste Regel, deren Bedingungen mit diesem Besucher ubereinstimmen, gewinnt.", duration: "< 5 ms" },
          { title: "Die beste Variante wird beim ersten Rendering ausgeliefert", description: "Der gewinnende Inhaltsplan wird angewendet. Ihr CMS liefert die passende Hero-Variante, den Proof-Block und den CTA - genau richtig fur diesen Besucher, genau jetzt. Kein Flackern. Kein Layout-Shift. Kein zweiter Request.", duration: "< 10 ms" },
        ]),
        textMedia("demo-video", "text_media_stacked",
          "Sehen Sie es in Aktion",
          "Die vollstandige Pipeline in unter zwei Minuten.",
          "Diese Walkthrough zeigt die Entscheidungsengine in Aktion: Ein Besucher kommt von LinkedIn, der Anreicherungsdienst identifiziert sein Unternehmen, der Intent-Score wird berechnet und ein visionsorientierter Hero mit einem Thought-Leadership-CTA wird ausgeliefert - alles bevor die Seite fertig geladen ist.",
          [{ label: "Interaktive Demo offnen", href: "/demo" }, { label: "Engine erkunden", href: "/the-engine" }],
          { type: "video", url: "https://www.youtube.com/embed/ioblgpA5eTo", caption: "Die vollstandige Personalisierungs-Pipeline - von der Signalerfassung bis zur Variantenauswahl" },
        ),
        textMedia("signals-intro", "text_media_left",
          "Was die Engine sieht",
          "130+ Signale. Ein einheitlicher Besucherkontext.",
          "Die meisten Personalisierungstools handeln auf einem oder zwei Signalen - normalerweise UTM-Quelle oder Gerattyp. Mister Chameleon kombiniert jedes bedeutungsvolle Signal zu einem einzigen Besucherkontextobjekt, das die Entscheidungsengine ganzheitlich verwendet.",
          [{ label: "Intent-Scoring erkunden", href: "/features-intent" }, { label: "Anreicherung erkunden", href: "/features-enrichment" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=900&auto=format&fit=crop&q=80", alt: "Datenvisualisierung mehrerer Signalstrome, die zu einem Score konvergieren" },
        ),
        featureGrid("signals", "Signale, die die Engine auswertet", "feature_grid_3up", [
          { title: "Verkehrsquelle", description: "UTM-Parameter, Referrer-Domain und Quellenklassifizierung (Google, LinkedIn, direkt, E-Mail, Dark Social). Jedes Quellenmuster impliziert eine andere Besucherabsicht.", icon: "globe" },
          { title: "Verhaltenshistorie", description: "In dieser Sitzung und historisch besuchte Seiten, Scrolltiefe, Zeit auf der Seite, CTA-Klicks, Formularstarts, Formularabschlusse und Navigationssequenzen. First-Party in Ihrer Datenbank gespeichert.", icon: "activity" },
          { title: "IP-Unternehmensanreicherung", description: "Firmenname, Branche, geschatzte Mitarbeiterzahl und Organisationstyp - still aus der IP-Adresse des Besuchers abgerufen. Keine Cookies. Kein Einwilligungsbanner erforderlich. DSGVO-konform.", icon: "briefcase" },
          { title: "Kaufabsichts- und Engagement-Scores", description: "Zwei zusammengesetzte 0-100-Scores: Kaufabsicht (Konvertierungswahrscheinlichkeit) und Engagement (Investition in Ihre Inhalte). Beide werden bei jedem Seitenaufruf neu berechnet.", icon: "trending-up" },
          { title: "Funnel-Phase", description: "Ein vorhergesagtes Lebenszyklus-Label - Bewusstsein, Erwagung, Kaufabsicht, hohe Kaufabsicht oder Kunde - abgeleitet aus Intent-Score, Verhaltenstiefe und CRM-Daten.", icon: "filter" },
          { title: "Zeit- und Wetterkontext", description: "Wochentag, Tageszeit, Jahreszeit und lokale Wetterbedingungen. Nutzlich fur Kampagnen, event-getriebene Inhalte und lokale Personalisierung.", icon: "clock" },
          { title: "CRM- und ABM-Daten", description: "In Growth- und Pro-Planen erhalten bekannte Kontakte und Zielaccounts Inhalte, die auf ihre CRM-Lebenszyklusphase und Account-Tier abgestimmt sind.", icon: "users" },
          { title: "Gerat und Region", description: "Gerattyp, Betriebssystem, Browser, bevorzugte Sprache und geografische Region. Ermoglicht geratespezifische Layouts und regional angepasste Inhalte.", icon: "monitor" },
          { title: "Besucherreisemuster", description: "Benannte Verhaltenssequenzen - Startseite zu Produkt, Preisseiten-Revisit, hochengagierter wiederkehrender Besucher - abgeglichen mit der vollstandigen Navigationshistorie.", icon: "map" },
        ]),
        textMedia("cms-side", "text_media_right",
          "Die Inhaltsseite",
          "Varianten leben in Ihrem CMS. Marketing besitzt sie.",
          "Jede Inhaltsentscheidung der Engine ist einer in Sanity definierten Variante zugeordnet. Ihr Marketingteam erstellt Hero-Varianten fur verschiedene Zielgruppen, schreibt Proof-Abschnitte fur verschiedene Funnel-Phasen und legt CTA-Text fur verschiedene Kaufabsichtsniveaus fest. Kein Entwickler nach der Ersteinrichtung notwendig.",
          [{ label: "Alle Funktionen ansehen", href: "/features" }, { label: "Live-Demo offnen", href: "/demo" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1587620962725-abab19836a68?w=900&auto=format&fit=crop&q=80", alt: "Marketingmitarbeiter bearbeitet eine Inhaltsvariante im Sanity CMS", caption: "Marketing erstellt Varianten in Sanity. Die Engine entscheidet, wer welche sieht." },
        ),
        textMedia("rules-side", "text_media_left",
          "Die Regelseite",
          "Visueller Regelersteller. Kein SQL. Kein Code.",
          "Personalisierungsregeln werden in einem visuellen Editor definiert - nicht im Code. Jede Regel hat einen Satz von Bedingungen und einen Inhaltsplan. Regeln werden in Prioritatsreihenfolge bei jeder Anfrage ausgewertet.",
          [{ label: "Engine erkunden", href: "/the-engine" }, { label: "Zielgruppensegmente ansehen", href: "/features-segments" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900&auto=format&fit=crop&q=80", alt: "Visueller Regeleditor mit Bedingungsersteller und Variantenzuordnung", caption: "Regeln: Bedingungen plus Inhaltplane - kein Code erforderlich." },
        ),
        testimonialSec("proof", "Was Teams nach dem Go-live sagen", [
          { quote: "Die Pipeline-Erklarung hat uns uberzeugt. Unter 50ms, ausschliesslich First-Party, keine Cookies - das hat alle Anforderungen unseres Rechtsteams erfullt. Wir waren innerhalb einer Stunde nach der Anmeldung live.", author: "Thomas Becker", role: "CTO", company: "Growlytics" },
          { quote: "Ich habe eine Woche Engineering-Arbeit erwartet. Es war ein Script-Tag und ein Nachmittag im CMS. Der Regeleditor ist wirklich intuitiv - ich habe unsere ersten drei Personalisierungsregeln selbst eingerichtet.", author: "Sanne de Vries", role: "Head of Growth", company: "Frontline Agency" },
          { quote: "Was mich am meisten uberrascht hat, war das Intent-Scoring. Einen Echtzeit-Score zu sehen, der sich aktualisiert, wahrend ich die Demo durchgesurft habe - und dann den Hero zu sehen, der sich geandert hat, als ich 60 uberschritten habe - hat das Ganze sofort einleuchten lassen.", author: "Priya Nair", role: "Marketing Manager", company: "JobBridge" },
        ]),
        processSec("setup", "So gehen Sie live", [
          { title: "Script-Tag hinzufugen", description: "Kopieren Sie ein JavaScript-Snippet aus Ihrem Dashboard und fugen Sie es in den <head> Ihrer Website ein. Funktioniert mit jedem Tech-Stack - Next.js, Webflow, WordPress, Shopify, benutzerdefiniertes HTML.", duration: "2 Minuten" },
          { title: "Erste Inhaltsvarianten erstellen", description: "Offnen Sie Sanity und duplizieren Sie Ihren bestehenden Hero-Abschnitt. Schreiben Sie eine alternative Uberschrift und einen CTA fur eine bestimmte Zielgruppe - LinkedIn-Besucher, wiederkehrende Nutzer mit hoher Kaufabsicht oder Enterprise-Interessenten.", duration: "10 Minuten" },
          { title: "Personalisierungsregel definieren", description: "Setzen Sie im Regeleditor die Bedingung (utmSource gleich linkedin), ordnen Sie sie Ihrer neuen Hero-Variante zu, und legen Sie eine Prioritat fest. Regel veroffentlichen. Die Engine wendet sie beim nachsten Seitenaufruf an.", duration: "3 Minuten" },
          { title: "Beobachten und iterieren", description: "Offnen Sie das Analytics-Dashboard. Sehen Sie, wie Ihre Variante im Vergleich zum Standard abschneidet. Nutzen Sie das A/B-Test-Modul fur kontrollierte Experimente.", duration: "Fortlaufend" },
        ]),
        faqSec("faq", "Haufige Fragen", [
          { question: "Verlangsamt das Snippet meine Website?", answer: "Nein. Die Edge-Funktion lauft, bevor die Seite ausgeliefert wird, nicht nachdem sie geladen ist. Die gesamte Pipeline - Signalverarbeitung, Anreicherung, Scoring und Variantenauswahl - wird in unter 50ms abgeschlossen und lauft parallel zum Seitenrendering." },
          { question: "Was passiert, wenn keine Personalisierungsregel zutrifft?", answer: "Ein Standard-Inhaltsplan wird ausgeliefert - derselbe Hero, dieselbe Proof-Sektion und derselbe CTA, den Ihre Website derzeit anzeigt. Personalisierung ist additiv: Besucher, die keiner Regel entsprechen, sehen Ihre vorhandenen Inhalte unverandert." },
          { question: "Wie werden Besucherdaten gespeichert?", answer: "Alle Verhaltensdaten werden First-Party in Ihrer eigenen Datenbank gespeichert - nicht auf unseren Servern. Anreicherungsdaten werden bei der Anfrage aufgelost und kurz fur die Leistung gecacht. Es werden keine Drittanbieter-Cookies gesetzt. Alle Datenverarbeitung ist DSGVO-konform by Design." },
          { question: "Kann ich eine Vorschau davon sehen, was ein Besucher aus einem bestimmten Segment sieht?", answer: "Ja. Das Szenario-Kontrollfeld lasst Sie jedes Besucherprofil simulieren - UTM-Quelle, Intent-Score, Funnel-Phase, Unternehmenstyp - und die Seite in Echtzeit anpassen sehen." },
          { question: "Funktioniert es mit meinem bestehenden CMS?", answer: "Mister Chameleon verwendet Sanity als Inhaltsebene fur die Variantenspeicherung. Ihr bestehendes Website-CMS bleibt unverandert - Sie mussen keine Inhalte migrieren. Die Variantenebene arbeitet neben Ihrer bestehenden Einrichtung." },
        ]),
        ctaSec("cta", "Sehen Sie es live in Ihrem eigenen Browser", "Unsere interaktive Demo lasst Sie jedes Besucherprofil simulieren und die Seite in Echtzeit anpassen. Keine Anmeldung erforderlich.", "Live-Demo offnen", "/demo"),
      ],
      undefined,
      ["features", "platform", "integrationen", "technisch", "setup"],
    ),
    locale: "de",
  },

  // ── NL why-personalisation ────────────────────────────────────────────────────
  {
    ...page("why-personalisation-nl", "why-personalisation", "Waarom Personalisatie? - NL", "marketing-page",
      "Waarom websitepersonalisatie werkt",
      "Generieke websites laten kansen liggen. Ontdek waarom relevante content zorgt voor meer conversie en betere klantrelaties.",
      [
        textMedia("header-banner", "text_media_right",
          "97% van de bezoekers vertrekt. Dit is waarom dat oplosbaar is.",
          "Generieke websites zijn conversie-killers.",
          "De data is ondubbelzinnig: de meeste websites tonen dezelfde content aan iedereen en converteren minder dan 3% van hun traffic. De oplossing is niet meer traffic of een groter advertentiebudget - het is de juiste boodschap aan de juiste bezoeker op het juiste moment.",
          [{ label: "Bekijk de zakelijke onderbouwing", href: "#data" }, { label: "Gratis proefperiode starten", href: "/order/starter" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Analyticsdashboard met verbetering van conversieratio's" },
        ),
        textSec("intro", "text_lead", "Uw homepage is gebouwd voor niemand.",
          pt(
            "De meeste websites zijn ontworpen rondom een mythische gemiddelde bezoeker. Het probleem is dat geen enkele bezoeker gemiddeld is. Een eerstebezoeker van Google die 'website personalisatiesoftware' zoekt, is volledig anders dan een terugkerende CFO die deze week drie keer uw prijspagina heeft bezocht.",
            "Aan hen beiden dezelfde kop, dezelfde social proof en dezelfde CTA tonen, is het digitale equivalent van een salesmedewerker die hetzelfde verhaal houdt voor een koude lead en een champion op boardniveau.",
          ),
        ),
        statsSec("cost", "De kosten van generiek", [
          { label: "van websitebezoekers vertrekt zonder te converteren", value: "97", suffix: "%" },
          { label: "stijging in conversie door relevante content", value: "202", suffix: "%", description: "Hubspot, 2024" },
          { label: "van B2B-kopers verwacht gepersonaliseerde interacties", value: "76", suffix: "%", description: "McKinsey" },
          { label: "omzet verloren aan slechte personalisatie per jaar", value: "€756 miljard", description: "Segment" },
        ]),
        textMedia("chameleon-hero", "text_media_left", "De natuur was er eerder", "Het kameleon verandert niet wie het is. Het past aan hoe het zich presenteert.",
          "Een kameleon wordt geen ander dier als zijn omgeving verandert - het toont de juiste versie van zichzelf voor het moment waarin het verkeert. Uw website zou hetzelfde moeten doen. Geen andere site voor elke bezoeker. Het juiste gezicht van uw product voor de situatie van elke persoon.",
          [{ label: "Zie hoe onze engine werkt", href: "/how-it-works" }],
          { type: "image", url: "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=900&auto=format&fit=crop&q=80", alt: "Close-up van een levendig kameleon dat zijn kleurveranderend vermogen toont", caption: "Adaptief van nature - uw website, gepersonaliseerd voor elke bezoeker" },
        ),
        textMedia("argument", "text_media_right", "De betere aanpak", "Koppel de boodschap aan het moment",
          "Personalisatie betekent niet dat u voor elke bezoeker handmatig een aangepaste pagina bouwt. Het betekent begrijpen wat elke bezoeker nu nodig heeft - en ervoor zorgen dat uw content daarop inspeelt. Een enterprise-prospect met hoge intentie heeft casestudies en beveiligingsinformatie nodig. Een eerstebezoeker moet in één zin begrijpen wat u doet.",
          [{ label: "Zie hoe onze engine werkt", href: "/how-it-works" }],
          { type: "image", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80", alt: "Marketing analytics dashboard op een laptopscherm", caption: "De juiste boodschap, automatisch aan de juiste bezoeker geserveerd" },
        ),
        featureGrid("benefits", "Wat personalisatie werkelijk doet", "feature_grid_3up", [
          { title: "Meer pipeline van hetzelfde traffic", description: "Wanneer content aansluit bij intentie, nemen meer bezoekers de volgende stap - zonder extra advertentie-uitgaven. Onze klanten zien doorgaans een stijging van 25-40% in leadconversie binnen 60 dagen.", icon: "trending-up" },
          { title: "Kortere verkoopcycli", description: "Prospects die vanaf het eerste bezoek relevante content zien, komen al goed geïnformeerd aan bij hun eerste salescall. Salesmedewerkers rapporteren kortere cycli en gesprekken van hogere kwaliteit.", icon: "zap" },
          { title: "Betere ervaring voor iedereen", description: "Personalisatie voelt als goede service, niet als bewaking. Wanneer een bezoeker content ziet die echt aansluit bij zijn situatie, blijft hij langer, leest hij meer en vertrouwt hij u sneller.", icon: "heart" },
        ]),
        faqSec("faq", "Veelgestelde vragen", [
          { question: "Vereist personalisatie cookies of tracking?", answer: "Nee. Mister Chameleon gebruikt first-party sessiedata die in uw eigen database is opgeslagen, IP-gebaseerde bedrijfsverrijking en verkeersbronssignalen - geen van deze vereisen third-party cookies of invasieve tracking. Wij zijn AVG-compliant by design." },
          { question: "Is dit alleen voor grote bedrijven?", answer: "Helemaal niet. Ons Starter-plan is ontworpen voor groeiende teams die willen beginnen met het personaliseren van hun drukstbezochte pagina's zonder een engineeringproject. U kunt binnen een middag live zijn." },
          { question: "Hoe verschilt dit van A/B-testen?", answer: "A/B-testen toont willekeurig verschillende varianten aan verschillende mensen en meet welke het beste werkt. Personalisatie toont de juiste variant aan de juiste persoon direct, op basis van wat u al over hen weet. Beide hebben hun plek - maar voor de meeste bedrijven levert personalisatie snellere en duurzamere resultaten op." },
        ]),
        ctaSec("cta", "Zie personalisatie in actie", "Onze live demo simuleert precies wat elk bezoekerstype op uw site ziet.", "Verken de demo", "/demo"),
      ],
      undefined,
      ["personalisatie", "conversie", "oplossing", "sector", "industrie"],
    ),
    locale: "nl",
  },

  // ── DE why-personalisation ────────────────────────────────────────────────────
  {
    ...page("why-personalisation-de", "why-personalisation", "Warum Personalisierung? - DE", "marketing-page",
      "Warum Website-Personalisierung wichtig ist - der Business Case",
      "Generische Websites verschwenden 97% ihres Traffics. Hier sind die Daten daruber, was Personalisierung fur Konversionsraten, Pipeline und Umsatz tut.",
      [
        textMedia("header-banner", "text_media_right",
          "97% der Besucher verlassen die Seite. Das lasst sich beheben.",
          "Generische Websites sind Konversions-Killer.",
          "Die Daten sind eindeutig: Die meisten Websites zeigen jedem die gleichen Inhalte und konvertieren weniger als 3% ihres Traffics. Die Losung ist nicht mehr Traffic oder ein grosseres Werbebudget - es ist die richtige Botschaft fur den richtigen Besucher zum richtigen Zeitpunkt.",
          [{ label: "Den Business Case ansehen", href: "#data" }, { label: "Kostenlose Testphase starten", href: "/order/starter" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Analytics-Dashboard mit Konversionsraten-Verbesserung" },
        ),
        textSec("intro", "text_lead", "Ihre Homepage wurde fur niemanden gebaut.",
          pt(
            "Die meisten Websites sind um einen mythischen Durchschnittsbesucher herum gestaltet. Das Problem: Kein Besucher ist durchschnittlich. Ein Erstbesucher von Google, der nach 'Website-Personalisierungssoftware' sucht, ist grundlegend anders als ein wiederkehrender CFO, der diese Woche dreimal Ihre Preisseite besucht hat.",
            "Beiden denselben Titel, denselben Social Proof und denselben CTA zu zeigen, ist das digitale Aquivalent dazu, dass ein Vertriebler dasselbe Pitch sowohl einem kalten Lead als auch einem Board-Level-Champion halt.",
          ),
        ),
        statsSec("cost", "Die Kosten des Generischen", [
          { label: "der Website-Besucher verlassen ohne Konversion", value: "97", suffix: "%" },
          { label: "Steigerung der Konversion durch relevante Inhalte", value: "202", suffix: "%", description: "Hubspot, 2024" },
          { label: "der B2B-Kaufer erwarten personalisierte Interaktionen", value: "76", suffix: "%", description: "McKinsey" },
          { label: "Umsatz jahrlich durch schlechte Personalisierung verloren", value: "€756 Mrd.", description: "Segment" },
        ]),
        textMedia("chameleon-hero", "text_media_left", "Die Natur war zuerst da", "Das Chamaleon andert nicht, wer es ist. Es passt an, wie es sich zeigt.",
          "Ein Chamaleon wird kein anderes Tier, wenn sich seine Umgebung andert - es zeigt die richtige Version von sich selbst fur den Moment, in dem es sich befindet. Ihre Website sollte genauso funktionieren. Keine andere Website fur jeden Besucher. Das richtige Gesicht Ihres Produkts fur die jeweilige Situation.",
          [{ label: "Sehen Sie, wie unsere Engine funktioniert", href: "/how-it-works" }],
          { type: "image", url: "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=900&auto=format&fit=crop&q=80", alt: "Nahaufnahme eines lebhaften Chamaleons", caption: "Adaptiv von Natur aus - Ihre Website, personalisiert fur jeden Besucher" },
        ),
        textMedia("argument", "text_media_right", "Der bessere Ansatz", "Die Botschaft dem Moment anpassen",
          "Personalisierung bedeutet nicht, fur jeden Besucher manuell eine massgeschneiderte Seite zu erstellen. Es bedeutet zu verstehen, was jeder Besucher gerade braucht - und sicherzustellen, dass Ihre Inhalte darauf eingehen. Ein Enterprise-Interessent mit hoher Kaufabsicht braucht Fallstudien und Sicherheitsinformationen. Ein Erstbesucher muss in einem Satz verstehen, was Sie tun.",
          [{ label: "Sehen Sie, wie unsere Engine funktioniert", href: "/how-it-works" }],
          { type: "image", url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80", alt: "Marketing-Analytics-Dashboard auf einem Laptop", caption: "Die richtige Botschaft, automatisch an den richtigen Besucher ausgeliefert" },
        ),
        featureGrid("benefits", "Was Personalisierung wirklich bewirkt", "feature_grid_3up", [
          { title: "Mehr Pipeline aus demselben Traffic", description: "Wenn Inhalte zur Kaufabsicht passen, unternehmen mehr Besucher den nachsten Schritt - ohne zusatzliche Werbeausgaben. Unsere Kunden sehen typischerweise einen Anstieg von 25-40% bei der Lead-Konversion innerhalb von 60 Tagen.", icon: "trending-up" },
          { title: "Kurzere Verkaufszyklen", description: "Interessenten, die von Anfang an relevante Inhalte sehen, kommen bereits gut informiert zum ersten Vertriebsgesprach. Vertriebsmitarbeiter berichten von kurzeren Zyklen und Gesprachen von hoherer Qualitat.", icon: "zap" },
          { title: "Bessere Erfahrung fur alle", description: "Personalisierung fuhlte sich wie guter Service an, nicht wie Uberwachung. Wenn ein Besucher Inhalte sieht, die wirklich zu seiner Situation passen, bleibt er langer, liest mehr und vertraut Ihnen schneller.", icon: "heart" },
        ]),
        faqSec("faq", "Haufige Fragen", [
          { question: "Erfordert Personalisierung Cookies oder Tracking?", answer: "Nein. Mister Chameleon verwendet First-Party-Sitzungsdaten in Ihrer eigenen Datenbank, IP-basierte Unternehmensanreicherung und Verkehrsquellensignale - keines davon erfordert Drittanbieter-Cookies oder invasives Tracking. Wir sind DSGVO-konform by Design." },
          { question: "Ist das nur fur grosse Unternehmen?", answer: "Uberhaupt nicht. Unser Starter-Plan ist fur wachsende Teams konzipiert, die mit der Personalisierung ihrer meistbesuchten Seiten ohne ein Engineering-Projekt beginnen wollen. Sie konnen innerhalb eines Nachmittags live gehen." },
          { question: "Wie unterscheidet sich das von A/B-Tests?", answer: "A/B-Tests zeigen verschiedenen Personen zufallig verschiedene Varianten und messen, welche im Laufe der Zeit gewinnt. Personalisierung zeigt sofort die richtige Variante fur die richtige Person, basierend auf dem, was Sie bereits uber sie wissen. Beide haben ihren Platz - aber fur die meisten Unternehmen liefert Personalisierung schnellere und nachhaltigere Ergebnisse." },
        ]),
        ctaSec("cta", "Personalisierung in Aktion erleben", "Unsere Live-Demo simuliert genau, was jeder Besuchertyp auf Ihrer Website sieht.", "Demo erkunden", "/demo"),
      ],
      undefined,
      ["personalisierung", "konversion", "lösung", "industrie"],
    ),
    locale: "de",
  },

  // ── NL the-engine ─────────────────────────────────────────────────────────────
  {
    ...page("the-engine-nl", "the-engine", "De Engine - NL", "marketing-page",
      "De Mister Chameleon engine - hoe realtime personalisatie werkt",
      "Een technische deep dive in de realtime personalisatie-engine van Mister Chameleon.",
      [
        textMedia("hero", "text_media_right",
          "130+ signalen. Één beslissing. In minder dan 50 ms.",
          "De adaptieve beslisengine - een technische diepduik.",
          "Intentie-scoring, bedrijfsverrijking, gedragsgeschiedenis, CRM-context en tijdsbewuste logica - gecombineerd in één edge-functie die wordt uitgevoerd voordat uw pagina klaar is met laden. Deze pagina legt precies uit hoe het werkt, laag voor laag.",
          [{ label: "Open de live demo", href: "/demo" }, { label: "Overzicht hoe het werkt", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&auto=format&fit=crop&q=80", alt: "Serverrackinfrastructuur als beeld voor een snelle, gedistribueerde beslisengine" },
        ),
        statsSec("perf", "Engine-prestaties", [
          { label: "Totale pipeline-latency", value: "<50", suffix: "ms", description: "Signaalverzameling, verrijking, scoring en variantselectie - voor de eerste byte HTML wordt verstuurd." },
          { label: "Signalen per bezoek geëvalueerd", value: "130", suffix: "+", description: "Requestcontext, gedragsgeschiedenis, verrijkingsdata, CRM-fase, tijdsignalen en reispatronen." },
          { label: "Variantbeslissingstijd", value: "<10", suffix: "ms", description: "Regels worden op prioriteitsvolgorde geëvalueerd en een beslissing wordt bereikt in minder dan 10 milliseconden." },
          { label: "Gebruikte third-party cookies", value: "0", description: "De engine werkt uitsluitend op first-party signalen. Geen cross-site tracking. Geen toestemmingsbanner vereist." },
        ]),
        textMedia("v8", "text_media_left",
          "De V8 onder uw website.",
          "Vuurt bij elk request. Geen opwarmtijd. Geen vertraging.",
          "Een krachtige motor levert op verzoek precieze kracht - zonder dat de bestuurder erover nadenkt. De Mister Chameleon beslisengine werkt op dezelfde manier. Elke keer dat een bezoeker een pagina laadt, vuurt de engine: leest de volledige requestcontext, laadt de gedragsgeschiedenis van de bezoeker, verrijkt vanuit IP, scoort de intentie, evalueert uw regels en selecteert de best passende variant. Dit alles in minder dan 50 milliseconden. De bezoeker wacht nooit. De pagina flikkert nooit.",
          [{ label: "Bekijk de demo", href: "/demo" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&auto=format&fit=crop&q=80", alt: "Krachtige V8-motorblok als metafoor voor precisie en verwerkingssnelheid", caption: "130+ signalen geëvalueerd voordat uw pagina laadt - nul zichtbare latency." },
        ),
        featureGrid("layers", "Vier lagen van intelligentie", "feature_grid_4up", [
          { title: "Request-laag", description: "Vastgelegd bij elk request, vóór sessiondata wordt geladen: UTM-bron en campagne, referrerdomein, verkeersbronclassificatie, apparaattype, besturingssysteem, voorkeurstaal en geografische regio.", icon: "wifi" },
          { title: "Gedragslaag", description: "First-party sessiegeschiedenis opgehaald uit uw Supabase-database: bezochte pagina's in deze sessie en historisch, scrolldiepte, tijd op pagina, CTA-klikken, formulierstarts en herkende navigatiesequenties.", icon: "layers" },
          { title: "Verrijkingslaag", description: "Server-side IP-naar-bedrijf opzoeking: bedrijfsnaam, branche, geschatte personeelsomvang en organisatietype. Loopt asynchroon - blokkeert het renderen van de pagina nooit.", icon: "database" },
          { title: "Intentielaag", description: "Samengestelde scoring die alle beschikbare signalen combineert tot twee 0-100-scores (intentie en betrokkenheid) plus een voorspelde funnelfase. Herberekend bij elke paginabezoek.", icon: "trending-up" },
        ]),
        processSec("pipeline", "De beslispipeline, stap voor stap", [
          { title: "Requestcontext wordt gelezen", description: "De edge-middleware onderschept het request voor enige HTML wordt gegenereerd. UTM-parameters, referrer, apparaattype en de sessie-identifier worden geëxtraheerd uit de requestheaders en cookies.", duration: "0 ms" },
          { title: "Sessiegeschiedenis wordt geladen", description: "De sessie-identifier wordt gebruikt om het gedragsprofiel van de bezoeker op te halen uit uw Supabase-database.", duration: "< 5 ms" },
          { title: "Bedrijfsverrijking wordt uitgevoerd", description: "De verrijkingsdienst voert een server-side IP-opzoeking uit om bedrijfsnaam, branche, geschatte omvang en organisatietype te bepalen. Dit loopt parallel aan het laden van de sessie.", duration: "< 20 ms" },
          { title: "Intentie en betrokkenheid worden gescoord", description: "De scoring engine combineert de requestlaag, het gedragsprofiel en de verrijkingsdata. De uitvoer is een intentiescore (0-100), een betrokkenheidsscore (0-100) en een voorspelde funnelfase.", duration: "< 5 ms" },
          { title: "Regels worden geëvalueerd op prioriteitsvolgorde", description: "Uw personalisatieregels worden getest op de volledige context van de bezoeker. Elke regel heeft een voorwaardenset en een contentplan. De eerste regel waarvan alle voorwaarden overeenkomen is de winnaar.", duration: "< 5 ms" },
          { title: "Variant wordt geselecteerd en gerenderd", description: "Het contentplan van de winnende regel wordt toegepast. De pagina rendert server-side met de correcte content bij de eerste bezoek - geen client-side injectie, geen layoutverschuiving, geen flikkering.", duration: "< 10 ms" },
        ]),
        textMedia("edge-architecture", "text_media_right",
          "Edge-native architectuur",
          "Wordt uitgevoerd voordat een byte HTML wordt verstuurd.",
          "De volledige beslispipeline draait in Next.js Edge Middleware - een serverloze functie die wordt uitgevoerd op de CDN-edge, geografisch dicht bij de bezoeker. Dit is geen client-side script dat content injecteert na het laden. Het is server-side middleware die het request onderschept, een beslissing neemt en de al-gepersonaliseerde pagina serveert in één respons.",
          [{ label: "Lees onze beveiligings- en privacypagina", href: "/security" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Printplaat als beeld voor edge computing infrastructuur", caption: "Edge middleware: de beslissing gebeurt voor de respons, niet na het laden." },
        ),
        textMedia("scoring-model", "text_media_left",
          "Het scoringmodel",
          "Intentie is samengesteld - niet een paginabezoektelling.",
          "De meeste intentie-scoringsystemen tellen paginabezoeken en noemen het klaar. Het Mister Chameleon-scoringmodel is genuanceerder. Verkeersbron levert een basisgewicht - een bezoeker van een Google-zoekopdracht naar 'beste personalisatiesoftware' begint hoger dan een bezoeker van een LinkedIn-post. Gedragsdiepte vergroot de score in de loop van de tijd. CTA-engagement voegt significant gewicht toe. Bedrijfsverrijking voegt een niveaumodifier toe.",
          [{ label: "Verken intentie-scoring", href: "/features-intent" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=900&auto=format&fit=crop&q=80", alt: "Datavisualisatie van gewogen signalen die convergeren naar één intentiescore", caption: "Zes signaalcategorieën. Één 0-100-score. Bijgewerkt bij elke paginabezoek." },
        ),
        textMedia("rules-system", "text_media_right",
          "Het regelssysteem",
          "Voorwaarden plus contentplannen - geen code vereist.",
          "Personalisatieregels worden gedefinieerd in een visuele editor. Elke regel heeft een prioriteitsnummer, een set voorwaarden en een contentplan. Voorwaarden kunnen elk veld in de bezoekercontext targeten: intentiescorebereiken, funnelfasewaarden, UTM-parameters, verrijkingsvelden, gedragsvlaggen en journeysequenties.",
          [{ label: "Bekijk doelgroepsegmenten", href: "/features-segments" }, { label: "Open de live demo", href: "/demo" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900&auto=format&fit=crop&q=80", alt: "Visuele regeleditor met voorwaardenbuilder en variantkoppelingsinterface", caption: "Regeleditor: voorwaarden links, contentplan rechts. Geen SQL. Geen code." },
        ),
        textMedia("cms-integration", "text_media_left",
          "CMS-gedreven varianten",
          "Marketing maakt. De engine beslist. Geen deploys.",
          "Contentvarianten leven in Sanity. Een variant is eenvoudigweg een alternatieve versie van een paginasectie. Marketing maakt varianten in het CMS, geeft ze een sleutel en publiceert ze. Vanaf dat moment kan de regelengine elke bezoeker naar elke variant routeren op basis van hun context.",
          [{ label: "Alle functies bekijken", href: "/features" }, { label: "Lees de documentatie", href: "/docs" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1587620962725-abab19836a68?w=900&auto=format&fit=crop&q=80", alt: "Sanity CMS-interface met een contentvarianteditor", caption: "Varianten gemaakt in Sanity zijn direct beschikbaar voor de beslisengine." },
        ),
        featureGrid("production", "Gebouwd voor productiegebruik", "feature_grid_3up", [
          { title: "Edge-first, nul blokkerende latency", description: "De beslispipeline draait op de CDN-edge in Next.js middleware. Totale overhead is minder dan 50ms, gemeten vanaf ontvangst van het request tot de eerste byte verstuurd.", icon: "zap" },
          { title: "Privacy door architectuur", description: "Geen third-party cookies. Geen cross-site tracking. Gedragsdata wordt first-party opgeslagen in uw eigen Supabase-database, in uw gekozen regio.", icon: "shield" },
          { title: "Flicker-vrije server-side rendering", description: "Gepersonaliseerde content wordt server-side gerenderd in de initiële respons. De bezoeker ziet de juiste variant bij de eerste render - geen layoutverschuiving.", icon: "monitor" },
          { title: "Graceful fallback bij elke storing", description: "Als verrijking time-out geeft, gaat de engine verder zonder. Als de database onbereikbaar is, gebruikt de engine uitsluitend request-signalen. De engine blokkeert een paginabezoek nooit.", icon: "life-buoy" },
          { title: "Variantblootstellingstracking", description: "Elke beslissing wordt gelogd: welke regel overeenkwam, welke variant werd geserveerd en wanneer. Dit voedt het analyticsdashboard en A/B-testbetrouwbaarheidsberekeningen.", icon: "bar-chart-2" },
          { title: "Bot- en piekbeveiliging", description: "De engine bevat ingebouwde snelheidsbeperking en botdetectie. Scraperverkeer wordt uitgesloten van personalisatiebeslissingen en analytics.", icon: "alert-triangle" },
        ]),
        testimonialSec("technical-proof", "Wat technische teams zeggen", [
          { quote: "De edge-middleware-architectuur was de doorslaggevende factor voor ons. Geen client-side injectie, geen flikkering, geen prestatiehit. Het integreert met onze Next.js-setup precies zoals je zou hopen.", author: "Lars K.", role: "CTO", company: "JobBridge" },
          { quote: "Ik was sceptisch over de claim van minder dan 50ms. Ik heb het door onze eigen loadtesttool gehaald tegen een cold cache. De p95-latency die door de beslismiddleware wordt toegevoegd was 23ms. De claim klopt.", author: "Thomas Becker", role: "Lead Infrastructure Engineer", company: "Growlytics" },
          { quote: "Het regelssysteem is expressiever dan ik verwachtte. We hebben regels die intentiescore-drempelwaarden, verrijkingsbranche-matching en journeysequentiedetectie combineren in één voorwaardenset.", author: "Anouk van Dijk", role: "Head of Engineering", company: "Frontline Agency" },
        ]),
        faqSec("faq", "Technische vragen", [
          { question: "Voegt de middleware latency toe aan elke paginabezoek?", answer: "Ja, maar minimaal. De beslispipeline voegt minder dan 50ms wandkloktijd toe, gemeten op de edge, inclusief verrijking. Dit ligt onder de drempel van waarneembare latency." },
          { question: "Wat gebeurt er als de Supabase-database traag of onbereikbaar is?", answer: "De engine heeft een harde time-out op het ophalen van sessiegeschiedenis. Als de database niet tijdig reageert, gaat de engine verder met alleen request-laag signalen. De bezoeker ziet een gebroken pagina nooit." },
          { question: "Hoe verhoudt verrijking zich tot de AVG?", answer: "IP-naar-bedrijf opzoeking lost alleen organisatorische metadata op - geen persoonsgegevens in de zin van de AVG. De opzoeking is server-side en er worden geen gegevens opgeslagen buiten een korte request-gebonden cache." },
          { question: "Kan ik de engine gebruiken met mijn bestaande CMS in plaats van Sanity?", answer: "De beslisengine is CMS-agnostisch op de regel- en scoringlaag. Contentvarianten worden momenteel opgeslagen in en geserveerd vanuit Sanity. Integratie met andere CMS-platformen staat op de roadmap." },
          { question: "Hoe verhoudt de engine A/B-tests zich tot personalisatieregels?", answer: "A/B-tests lopen als een speciaal regeltype met trafficsplitsing. Een testregel heeft twee of meer variantarmen met toegewezen trafficrocentages." },
          { question: "Is de beslisengine open source?", answer: "Het kernscoringsmodel, de regeleval en de verrijkingspipeline zijn propriëtair. Het JavaScript-trackingsnippet, Sanity-schemadefinities en Supabase-migratiebestanden zijn open source." },
        ]),
        ctaSec("cta", "Zie de engine een live beslissing nemen.", "Open de interactieve demo, simuleer een bezoekerSprofiel en zie de engine in realtime een variant selecteren - met een volledige uitleg van welke regel overeenkwam en waarom.", "Open de demo", "/demo"),
      ],
      undefined,
      ["api", "technisch", "architectuur", "developer", "sdk", "platform"],
    ),
    locale: "nl",
  },

  // ── DE the-engine ─────────────────────────────────────────────────────────────
  {
    ...page("the-engine-de", "the-engine", "Die Engine - DE", "marketing-page",
      "Die Mister Chameleon Entscheidungsengine - wie sie funktioniert",
      "Ein technischer Deep-Dive in die adaptive Entscheidungsengine: Intent-Scoring, Anreicherungs-Pipeline, Variantenauflosung und Edge-First-Architektur.",
      [
        textMedia("hero", "text_media_right",
          "130+ Signale. Eine Entscheidung. In unter 50 ms.",
          "Die adaptive Entscheidungsengine - ein technischer Deep-Dive.",
          "Intent-Scoring, Unternehmensanreicherung, Verhaltenshistorie, CRM-Kontext und zeitbewusste Logik - kombiniert in einer einzigen Edge-Funktion, die ausgefuhrt wird, bevor Ihre Seite fertig geladen ist. Diese Seite erklart genau, wie es funktioniert, Schicht fur Schicht.",
          [{ label: "Live-Demo offnen", href: "/demo" }, { label: "Ubersicht: Wie es funktioniert", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&auto=format&fit=crop&q=80", alt: "Server-Rack-Infrastruktur als Symbol fur eine schnelle, verteilte Entscheidungsengine" },
        ),
        statsSec("perf", "Engine-Leistung", [
          { label: "Gesamte Pipeline-Latenz", value: "<50", suffix: "ms", description: "Signalerfassung, Anreicherung, Scoring und Variantenauswahl - bevor das erste Byte HTML gesendet wird." },
          { label: "Ausgewertete Signale pro Besuch", value: "130", suffix: "+", description: "Request-Kontext, Verhaltenshistorie, Anreicherungsdaten, CRM-Phase, Zeitsignale und Reisemuster." },
          { label: "Variantenentscheidungszeit", value: "<10", suffix: "ms", description: "Regeln werden in Prioritatsreihenfolge ausgewertet und eine Entscheidung in unter 10 Millisekunden getroffen." },
          { label: "Verwendete Drittanbieter-Cookies", value: "0", description: "Die Engine arbeitet ausschliesslich mit First-Party-Signalen. Kein Cross-Site-Tracking. Kein Einwilligungsbanner erforderlich." },
        ]),
        textMedia("v8", "text_media_left",
          "Der V8 unter Ihrer Website.",
          "Zundet bei jedem Request. Kein Aufwarmen. Keine Verzogerung.",
          "Ein Hochleistungsmotor liefert auf Abruf prazise Kraft - ohne dass der Fahrer daruber nachdenkt. Die Mister Chameleon Entscheidungsengine funktioniert genauso. Jedes Mal, wenn ein Besucher eine Seite ladt, zundet die Engine: liest den vollstandigen Request-Kontext, ladt die Verhaltenshistorie des Besuchers, reichert aus IP an, bewertet die Kaufabsicht, wertet Ihre Regeln aus und wahlt die am besten passende Variante. All das in unter 50 Millisekunden. Der Besucher wartet nie. Die Seite flackert nie.",
          [{ label: "Demo ansehen", href: "/demo" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&auto=format&fit=crop&q=80", alt: "V8-Motorblock als Symbol fur Prazision und Verarbeitungsgeschwindigkeit", caption: "130+ Signale ausgewertet, bevor Ihre Seite ladt - null sichtbare Latenz." },
        ),
        featureGrid("layers", "Vier Schichten der Intelligenz", "feature_grid_4up", [
          { title: "Request-Schicht", description: "Bei jeder Anfrage erfasst, bevor Sitzungsdaten geladen werden: UTM-Quelle und Kampagne, Referrer-Domain, Verkehrsquellenklassifizierung, Gerattyp, Betriebssystem, bevorzugte Sprache und geografische Region.", icon: "wifi" },
          { title: "Verhaltensschicht", description: "First-Party-Sitzungshistorie aus Ihrer Supabase-Datenbank: in dieser Sitzung und historisch besuchte Seiten, Scrolltiefe, Zeit auf der Seite, CTA-Klicks, Formularstarts und erkannte Navigationssequenzen.", icon: "layers" },
          { title: "Anreicherungsschicht", description: "Serverseitige IP-zu-Unternehmen-Suche: Firmenname, Branche, geschatzte Mitarbeiterzahl und Organisationstyp. Lauft asynchron - blockiert niemals das Seitenrendering.", icon: "database" },
          { title: "Kaufabsichtsschicht", description: "Zusammengesetztes Scoring, das alle verfugbaren Signale zu zwei 0-100-Scores (Kaufabsicht und Engagement) plus einer vorhergesagten Funnel-Phase kombiniert. Bei jedem Seitenaufruf neu berechnet.", icon: "trending-up" },
        ]),
        processSec("pipeline", "Die Entscheidungs-Pipeline, Schritt fur Schritt", [
          { title: "Request-Kontext wird gelesen", description: "Die Edge-Middleware interceptiert die Anfrage, bevor HTML generiert wird. UTM-Parameter, Referrer, Gerattyp und die Sitzungskennung werden aus den Request-Headern und Cookies extrahiert.", duration: "0 ms" },
          { title: "Sitzungshistorie wird geladen", description: "Die Sitzungskennung wird verwendet, um das Verhaltensprofil des Besuchers aus Ihrer Supabase-Datenbank abzurufen.", duration: "< 5 ms" },
          { title: "Unternehmensanreicherung wird ausgefuhrt", description: "Der Anreicherungsdienst fuhrt eine serverseitige IP-Suche durch, um Firmenname, Branche, geschatzte Grosse und Organisationstyp zu ermitteln. Dies lauft parallel zum Laden der Sitzung.", duration: "< 20 ms" },
          { title: "Kaufabsicht und Engagement werden bewertet", description: "Die Scoring-Engine kombiniert Request-Schicht, Verhaltensprofil und Anreicherungsdaten. Die Ausgabe ist ein Intent-Score (0-100), ein Engagement-Score (0-100) und eine vorhergesagte Funnel-Phase.", duration: "< 5 ms" },
          { title: "Regeln werden in Prioritatsreihenfolge ausgewertet", description: "Ihre Personalisierungsregeln werden gegen den vollstandigen Kontext des Besuchers gepruft. Jede Regel hat einen Bedingungssatz und einen Inhaltsplan. Die erste Regel, deren Bedingungen alle erfullt sind, gewinnt.", duration: "< 5 ms" },
          { title: "Variante wird ausgewahlt und gerendert", description: "Der Inhaltsplan der Gewinnerregel wird angewendet. Die Seite wird serverseitig mit dem korrekten Inhalt beim ersten Aufruf gerendert - keine clientseitige Injektion, kein Layout-Shift, kein Flackern.", duration: "< 10 ms" },
        ]),
        textMedia("edge-architecture", "text_media_right",
          "Edge-native Architektur",
          "Lauft, bevor ein Byte HTML gesendet wird.",
          "Die gesamte Entscheidungs-Pipeline lauft in Next.js Edge Middleware - einer serverlosen Funktion, die am CDN-Edge ausgefuhrt wird, geografisch nah am Besucher. Dies ist kein clientseitiges Skript, das Inhalte nach dem Laden injiziert. Es ist serverseitige Middleware, die die Anfrage abfangt, eine Entscheidung trifft und die bereits personalisierte Seite in einer einzigen Antwort liefert.",
          [{ label: "Unsere Sicherheits- und Datenschutzseite lesen", href: "/security" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80", alt: "Leiterplatte als Symbol fur Edge-Computing-Infrastruktur", caption: "Edge-Middleware: Die Entscheidung findet vor der Antwort statt, nicht nach dem Laden." },
        ),
        textMedia("scoring-model", "text_media_left",
          "Das Scoring-Modell",
          "Kaufabsicht ist zusammengesetzt - kein simpler Seitenaufruf-Zahler.",
          "Die meisten Intent-Scoring-Systeme zahlen Seitenbesuche und nennen es fertig. Das Mister Chameleon Scoring-Modell ist differenzierter. Verkehrsquelle liefert ein Basisgewicht. Verhaltenstiefe erhoht den Score im Laufe der Zeit. CTA-Engagement fugt erhebliches Gewicht hinzu. Unternehmensanreicherung fugt einen Tier-Modifikator hinzu.",
          [{ label: "Intent-Scoring erkunden", href: "/features-intent" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=900&auto=format&fit=crop&q=80", alt: "Datenvisualisierung gewichteter Signale, die zu einem Intent-Score konvergieren", caption: "Sechs Signalkategorien. Ein 0-100-Score. Bei jedem Seitenaufruf aktualisiert." },
        ),
        textMedia("rules-system", "text_media_right",
          "Das Regelsystem",
          "Bedingungen plus Inhaltplane - kein Code erforderlich.",
          "Personalisierungsregeln werden in einem visuellen Editor definiert. Jede Regel hat eine Prioritatsnummer, einen Satz von Bedingungen und einen Inhaltsplan. Bedingungen konnen jedes Feld im Besucherkontext ansprechen: Intent-Score-Bereiche, Funnel-Phasenwerte, UTM-Parameter, Anreicherungsfelder und Verhaltensflags.",
          [{ label: "Zielgruppensegmente ansehen", href: "/features-segments" }, { label: "Live-Demo offnen", href: "/demo" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900&auto=format&fit=crop&q=80", alt: "Visueller Regeleditor mit Bedingungsersteller und Variantenzuordnung", caption: "Regeleditor: Bedingungen links, Inhaltsplan rechts. Kein SQL. Kein Code." },
        ),
        textMedia("cms-integration", "text_media_left",
          "CMS-gesteuerte Varianten",
          "Marketing erstellt. Die Engine entscheidet. Keine Deployments.",
          "Inhaltsvarianten leben in Sanity. Eine Variante ist einfach eine alternative Version eines Seitenabschnitts. Marketing erstellt Varianten im CMS, gibt ihnen einen Schlussel und veroffentlicht sie. Von diesem Moment an kann die Regelengine jeden Besucher zu jeder Variante basierend auf seinem Kontext routen.",
          [{ label: "Alle Funktionen ansehen", href: "/features" }, { label: "Dokumentation lesen", href: "/docs" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1587620962725-abab19836a68?w=900&auto=format&fit=crop&q=80", alt: "Sanity CMS-Oberflache mit Inhaltsvarianten-Editor", caption: "In Sanity erstellte Varianten sind sofort fur die Entscheidungsengine verfugbar." },
        ),
        featureGrid("production", "Fur den Produktionseinsatz gebaut", "feature_grid_3up", [
          { title: "Edge-First, null blockierende Latenz", description: "Die Entscheidungs-Pipeline lauft am CDN-Edge in Next.js Middleware. Gesamtaufwand unter 50ms, gemessen vom Request-Eingang bis zum ersten gesendeten Byte.", icon: "zap" },
          { title: "Privacy durch Architektur", description: "Keine Drittanbieter-Cookies. Kein Cross-Site-Tracking. Verhaltensdaten werden First-Party in Ihrer eigenen Supabase-Datenbank, in Ihrer gewunschten Region gespeichert.", icon: "shield" },
          { title: "Flackerfreies serverseitiges Rendering", description: "Personalisierte Inhalte werden serverseitig in der initialen Antwort gerendert. Der Besucher sieht die korrekte Variante beim ersten Paint - kein Layout-Shift.", icon: "monitor" },
          { title: "Graceful Fallback bei jedem Fehler", description: "Wenn die Anreicherung eine Zeituberschreitung hat, fahrt die Engine ohne sie fort. Wenn die Datenbank nicht erreichbar ist, verwendet die Engine nur Request-Signale.", icon: "life-buoy" },
          { title: "Variantenexposure-Tracking", description: "Jede Entscheidung wird protokolliert: welche Regel ubereinstimmte, welche Variante geliefert wurde und wann. Dies speist das Analytics-Dashboard und A/B-Test-Konfidenzberechnungen.", icon: "bar-chart-2" },
          { title: "Bot- und Spitzenschutz", description: "Die Engine enthalt integrierte Ratenbegrenzung und Bot-Erkennung. Scraper-Traffic wird von Personalisierungsentscheidungen und Analytics ausgeschlossen.", icon: "alert-triangle" },
        ]),
        testimonialSec("technical-proof", "Was technische Teams sagen", [
          { quote: "Die Edge-Middleware-Architektur war fur uns der entscheidende Faktor. Keine clientseitige Injektion, kein Flackern, kein Performance-Einbussen. Sie integriert sich mit unserem Next.js-Setup genau so, wie man es erhofft.", author: "Lars K.", role: "CTO", company: "JobBridge" },
          { quote: "Ich war skeptisch gegenuber der Sub-50ms-Behauptung. Ich habe es mit unserem eigenen Load-Testing-Tool gegen einen Cold Cache getestet. Die p95-Latenz, die durch die Entscheidungs-Middleware hinzugefugt wird, betrug 23ms. Die Behauptung ist real.", author: "Thomas Becker", role: "Lead Infrastructure Engineer", company: "Growlytics" },
          { quote: "Das Regelsystem ist ausdrucksstarker als ich erwartet hatte. Wir haben Regeln, die Intent-Score-Schwellenwerte, Anreicherungs-Branche-Matching und Journey-Sequenz-Erkennung in einem einzigen Bedingungssatz kombinieren.", author: "Anouk van Dijk", role: "Head of Engineering", company: "Frontline Agency" },
        ]),
        faqSec("faq", "Technische Fragen", [
          { question: "Fugt die Middleware bei jedem Seitenaufruf Latenz hinzu?", answer: "Ja, aber minimal. Die Entscheidungs-Pipeline fugt unter 50ms Wanduhrzeit hinzu, am Edge gemessen, einschliesslich Anreicherung. Dies liegt unter der Schwelle wahrnehmbarer Latenz." },
          { question: "Was passiert, wenn die Supabase-Datenbank langsam oder nicht erreichbar ist?", answer: "Die Engine hat ein hartes Timeout beim Abrufen der Sitzungshistorie. Wenn die Datenbank nicht innerhalb des Latenzbudgets antwortet, fahrt die Engine nur mit Request-Schicht-Signalen fort. Der Besucher sieht niemals eine fehlerhafte Seite." },
          { question: "Wie verhalt sich Anreicherung zur DSGVO?", answer: "IP-zu-Unternehmen-Suche lost nur organisatorische Metadaten auf - Firmenname, Branche, geschatzte Grosse und Typ. Dies sind keine personenbezogenen Daten im Sinne der DSGVO, da es die Organisation identifiziert, nicht das Individuum." },
          { question: "Kann ich die Engine mit meinem bestehenden CMS statt Sanity verwenden?", answer: "Die Entscheidungsengine ist CMS-agnostisch auf der Regel- und Scoring-Ebene. Inhaltsvarianten werden derzeit in Sanity gespeichert und von dort ausgeliefert. Integration mit anderen CMS-Plattformen ist auf der Roadmap." },
          { question: "Wie handhabt die Engine A/B-Tests neben Personalisierungsregeln?", answer: "A/B-Tests laufen als spezieller Regeltyp mit Traffic-Splitting. Eine Testregel hat zwei oder mehr Variantenarme mit zugewiesenen Traffic-Prozentsatzen." },
          { question: "Ist die Entscheidungsengine Open Source?", answer: "Das Kern-Scoring-Modell, der Regelauswerter und die Anreicherungs-Pipeline sind proprietar. Das JavaScript-Tracking-Snippet, Sanity-Schema-Definitionen und Supabase-Migrationsdateien sind Open Source." },
        ]),
        ctaSec("cta", "Sehen Sie die Engine eine Live-Entscheidung treffen.", "Offnen Sie die interaktive Demo, simulieren Sie ein Besucherprofil und beobachten Sie, wie die Engine in Echtzeit eine Variante auswahlt - mit einer vollstandigen Erklarung, welche Regel ubereinstimmte und warum.", "Demo offnen", "/demo"),
      ],
      undefined,
      ["api", "technisch", "architektur", "developer", "sdk", "platform"],
    ),
    locale: "de",
  },

  // ── NL manifesto ─────────────────────────────────────────────────────────────
  {
    ...page("manifesto-nl", "manifesto", "Manifest - NL", "article-page",
      "Het Mister Chameleon manifest",
      "Waarom wij geloven dat websites zich moeten aanpassen aan mensen.",
      [
        textSec("body", "text_single", "Wij geloven dat het tijdperk van de statische website voorbij is.",
          pt(
            "Elke bezoeker die op uw site belandt, is anders. Ze kwamen van verschillende plaatsen, hebben verschillende banen, lazen deze week verschillende dingen en bevinden zich op totaal verschillende stadia in het beslissingsproces om u te vertrouwen. Hen allemaal dezelfde pagina tonen is geen ontwerpkeuze - het is een gemiste kans, duizend keer per dag herhaald.",
            "We bouwden Mister Chameleon omdat we geloven dat websitepersonalisatie een standaardtool moet zijn voor elk groeiteam - geen luxe voorbehouden aan bedrijven met grote engineeringbudgetten en een toegewijd data science-team.",
            "We geloven dat privacy en personalisatie geen tegengestelden zijn. U hoeft mensen niet over het internet te volgen met cookies om te begrijpen wat ze nodig hebben. First-party data, eerlijke signalen en een goede beslisengine zijn genoeg.",
            "We geloven dat marketingteams personalisatie moeten kunnen uitvoeren zonder een ticket in te dienen. De content moet in een CMS leven. De regels moeten bewerkbaar zijn zonder een deploy. De resultaten moeten zichtbaar zijn in een dashboard.",
            "We geloven dat de beste gepersonaliseerde ervaring aanvoelt als goede service - niet als surveillance. Wanneer een bezoeker content ziet die echt aansluit bij zijn situatie, voelt hij zich niet getarget. Hij voelt zich begrepen.",
            "Dat is wat wij bouwen. Een platform dat adaptieve websites toegankelijk, eerlijk en oprecht nuttig maakt - voor de teams die ze bouwen en de bezoekers die ze ervaren.",
            "- Het Mister Chameleon team",
          ),
        ),
        ctaSec("cta", "Klaar om uw website adaptief te maken?", "Start met een gratis proefperiode. Geen engineeringsprint vereist.", "Aan de slag", "/order/starter"),
      ],
      undefined,
      ["personalisatie", "visie", "platform"],
    ),
    locale: "nl",
  },

  // ── DE manifesto ─────────────────────────────────────────────────────────────
  {
    ...page("manifesto-de", "manifesto", "Manifest - DE", "article-page",
      "Das Mister Chameleon Manifest - warum wir das gebaut haben",
      "Warum wir glauben, dass das Zeitalter der Einheitswebsite vorbei ist und was als Nachstes kommt.",
      [
        textSec("body", "text_single", "Wir glauben, dass das Zeitalter der statischen Website vorbei ist.",
          pt(
            "Jeder Besucher, der auf Ihrer Website landet, ist anders. Sie kamen von verschiedenen Orten, haben verschiedene Berufe, lasen diese Woche verschiedene Dinge und befinden sich an vollig unterschiedlichen Stellen im Prozess, Ihnen zu vertrauen. Allen die gleiche Seite zu zeigen ist keine Designentscheidung - es ist eine verpasste Gelegenheit, tausendmal am Tag wiederholt.",
            "Wir haben Mister Chameleon gebaut, weil wir glauben, dass Website-Personalisierung ein Standardwerkzeug fur jedes Wachstumsteam sein sollte - kein Luxus, der Unternehmen mit grossen Engineering-Budgets und einem dedizierten Data-Science-Team vorbehalten ist.",
            "Wir glauben, dass Datenschutz und Personalisierung keine Gegensatze sind. Sie mussen Menschen nicht mit Cookies durchs Internet verfolgen, um zu verstehen, was sie brauchen. First-Party-Daten, ehrliche Signale und eine gute Entscheidungsengine reichen aus.",
            "Wir glauben, dass Marketingteams Personalisierung ohne Ticket-Einreichung durchfuhren konnen sollten. Die Inhalte sollten in einem CMS leben. Die Regeln sollten ohne Deployment bearbeitbar sein. Die Ergebnisse sollten in einem Dashboard sichtbar sein.",
            "Wir glauben, dass sich die beste personalisierte Erfahrung wie guter Service anfuhlt - nicht wie Uberwachung. Wenn ein Besucher Inhalte sieht, die wirklich zu seiner Situation passen, fuhlt er sich nicht anvisiert. Er fuhlt sich verstanden.",
            "Das ist das, was wir aufbauen. Eine Plattform, die adaptive Websites zuganglich, ehrlich und genutzlich nutzlich macht - fur die Teams, die sie erstellen, und die Besucher, die sie erleben.",
            "- Das Mister Chameleon Team",
          ),
        ),
        ctaSec("cta", "Bereit, Ihre Website adaptiv zu machen?", "Starten Sie mit einer kostenlosen Testphase. Kein Engineering-Sprint erforderlich.", "Loslegen", "/order/starter"),
      ],
    ),
    locale: "de",
  },

  // ── NL roadmap ────────────────────────────────────────────────────────────────
  {
    ...page("roadmap-nl", "roadmap", "Roadmap - NL", "article-page",
      "Mister Chameleon roadmap",
      "Bekijk waar we aan werken en welke functies eraan komen.",
      [
        textSec("intro", "text_lead", "Wat we als volgende bouwen.",
          pt("We publiceren onze roadmap openlijk omdat we vinden dat u moet weten wat u koopt. Hier is waar we naartoe gaan - en ruwweg wanneer."),
        ),
        processSec("phases", "Aankomende mijlpalen", [
          { title: "AI-variantaanbevelingen", description: "In plaats van personalisatieregels handmatig te schrijven, zal onze AI de hoogst-impactvolle varianten voorstellen op basis van uw bestaande traffi cpatronen en conversiedata. Beschikbaar op Growth- en Pro-plannen.", duration: "K3 2026" },
          { title: "Native HubSpot- en Salesforce-synchronisatie", description: "Tweewegssynchronisatie met uw CRM zodat bekende contacten en levenscyclusfase automatisch bepalen welke variant elke bezoeker ziet - en zodat personalisatiegebeurtenissen uw CRM-records verrijken.", duration: "K3 2026" },
          { title: "Visuele editor", description: "Een klik-en-sleep interface voor het maken van contentvarianten direct op uw live pagina - geen CMS-kennis vereist. Ontwerpen, bekijken en publiceren in één stroom.", duration: "K4 2026" },
          { title: "Multi-domein bureaudashboard", description: "Beheer personalisatie voor al uw klantsites vanuit één dashboard. Zet het admin-interface op wit-label met het merk van uw bureau.", duration: "K4 2026" },
          { title: "Voorspellend volgende-beste-actie", description: "In plaats van een variant te selecteren, stelt de engine proactief het volgende stuk content, de CTA of de actie voor die de meeste kans heeft om elke bezoeker vooruit te helpen.", duration: "2027" },
        ]),
        { _type: "timeline", _key: "history", variant: "timeline_vertical",
          heading: "Hoe we hier zijn gekomen",
          description: "Van zijproject tot €4,2M-gefinancierd personalisatieplatform.",
          items: [
            { _key: "ti0", id: "h0", title: "Opgericht in Amsterdam", date: "2021", description: "Mister Chameleon begon als antwoord op een eenvoudige vraag: waarom ziet elke bezoeker dezelfde website?", icon: "rocket" },
            { _key: "ti1", id: "h1", title: "Eerste betalende klanten", date: "K1 2022", description: "Tien B2B SaaS-bedrijven meldden zich aan in de eerste maand. De regelengine werd geleverd met drie segmenttypen en zero-code setup.", icon: "users" },
            { _key: "ti2", id: "h2", title: "Bedrijfsverrijking gelanceerd", date: "K3 2022", description: "IP-naar-bedrijf-verrijking ging live. Bezoekers van herkende netwerken activeren nu automatisch branche-afgestemde content.", icon: "building" },
            { _key: "ti3", id: "h3", title: "100 actieve tenants", date: "2023", description: "Bereikten 100 actieve tenants in B2B SaaS, werving en digitale bureaus.", icon: "chart" },
            { _key: "ti4", id: "h4", title: "Series A - €4,2M", date: "maart 2024", description: "€4,2M opgehaald om de AI-personalisatielaag te bouwen en te expanderen door Europa.", icon: "trending-up" },
          ],
        },
        ctaSec("cta", "Vorm de roadmap", "We bouwen wat onze klanten nodig hebben. Vertel ons wat er mist.", "Feedback delen", "/contact"),
      ],
      undefined,
      ["features", "platform", "product"],
    ),
    locale: "nl",
  },

  // ── DE roadmap ────────────────────────────────────────────────────────────────
  {
    ...page("roadmap-de", "roadmap", "Roadmap - DE", "article-page",
      "Mister Chameleon Produkt-Roadmap",
      "Sehen Sie, was wir als Nachstes bauen - von KI-Empfehlungen bis zu tieferen CRM-Integrationen und Multi-Site-Agentur-Tools.",
      [
        textSec("intro", "text_lead", "Was wir als Nachstes bauen.",
          pt("Wir veroffentlichen unsere Roadmap offen, weil wir denken, dass Sie wissen sollten, worauf Sie sich einlassen. Hier ist, wohin wir gehen - und ungefahr wann."),
        ),
        processSec("phases", "Bevorstehende Meilensteine", [
          { title: "KI-Variantenempfehlungen", description: "Anstatt Personalisierungsregeln manuell zu schreiben, schlagt unsere KI die wirkungsvollsten Varianten basierend auf Ihren bestehenden Traffic-Mustern und Konversionsdaten vor. Verfugbar in Growth- und Pro-Planen.", duration: "Q3 2026" },
          { title: "Native HubSpot- und Salesforce-Synchronisation", description: "Bidirektionale Synchronisation mit Ihrem CRM, sodass bekannte Kontakte und Lebenszyklusphasen automatisch bestimmen, welche Variante jeder Besucher sieht - und Personalisierungsereignisse Ihre CRM-Datensatze anreichern.", duration: "Q3 2026" },
          { title: "Visueller Editor", description: "Eine Point-and-Click-Oberflache zur Erstellung von Inhaltsvarianten direkt auf Ihrer Live-Seite - keine CMS-Kenntnisse erforderlich. Gestalten, Vorschau anzeigen und in einem Schritt veroffentlichen.", duration: "Q4 2026" },
          { title: "Multi-Domain-Agentur-Dashboard", description: "Verwalten Sie die Personalisierung uber alle Kundenseiten von einem einzigen Dashboard aus. Versehen Sie die Admin-Oberflache mit dem Branding Ihrer Agentur.", duration: "Q4 2026" },
          { title: "Pradiktive nachste beste Aktion", description: "Anstatt eine Variante auszuwahlen, schlagt die Engine proaktiv das nachste Inhaltsstuck, den CTA oder die Aktion vor, die am wahrscheinlichsten jeden Besucher voranbringt.", duration: "2027" },
        ]),
        { _type: "timeline", _key: "history", variant: "timeline_vertical",
          heading: "Wie wir hierher gekommen sind",
          description: "Vom Nebenprojekt zur mit €4,2M finanzierten Personalisierungsplattform.",
          items: [
            { _key: "ti0", id: "h0", title: "Grundung in Amsterdam", date: "2021", description: "Mister Chameleon begann als Antwort auf eine einfache Frage: Warum sieht jeder Besucher dieselbe Website?", icon: "rocket" },
            { _key: "ti1", id: "h1", title: "Erste zahlende Kunden", date: "Q1 2022", description: "Zehn B2B-SaaS-Unternehmen meldeten sich im ersten Monat an. Die Regelengine wurde mit drei Segmenttypen und Zero-Code-Setup ausgeliefert.", icon: "users" },
            { _key: "ti2", id: "h2", title: "Unternehmensanreicherung gestartet", date: "Q3 2022", description: "IP-zu-Unternehmen-Anreicherung ging live. Besucher aus erkannten Netzwerken aktivieren jetzt automatisch branchenabgestimmte Inhalte.", icon: "building" },
            { _key: "ti3", id: "h3", title: "100 aktive Mandanten", date: "2023", description: "100 aktive Mandanten in B2B SaaS, Personalvermittlung und digitalen Agenturen erreicht.", icon: "chart" },
            { _key: "ti4", id: "h4", title: "Series A - €4,2 Mio.", date: "Marz 2024", description: "€4,2 Mio. aufgebracht, um die KI-Personalisierungsschicht zu bauen und in Europa zu expandieren.", icon: "trending-up" },
          ],
        },
        ctaSec("cta", "Roadmap mitgestalten", "Wir bauen, was unsere Kunden brauchen. Sagen Sie uns, was fehlt.", "Feedback geben", "/contact"),
      ],
    ),
    locale: "de",
  },

  // ── FEATURES (NL) ────────────────────────────────────────────────────────────
  {
    ...page("features-nl", "features", "Features - NL", "marketing-page",
      "Mister Chameleon features - alles voor realtime personalisatie",
      "Ontdek alle mogelijkheden van Mister Chameleon: intentscoring, verrijking, analytics, testen en meer.",
      [
        textMedia("hero", "text_media_right",
          "Alles wat u nodig heeft om op schaal te personaliseren.",
          "Een platform. Elke functie die uw marketingteam nodig heeft.",
          "Mister Chameleon is een compleet adaptief personalisatieplatform. Elke functie is ontworpen om samen te werken - en beheerd te worden door uw marketingteam, zonder technische ondersteuning. Geen sprints. Geen API-integraties. Geen zes-cijferig contract.",
          [{ label: "Gratis proefperiode starten", href: "/order/starter" }, { label: "Bekijk hoe het werkt", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Personalisatie-analysedashboard" },
          "default",
        ),
        statsSec("stats", "Cijfers die ertoe doen", [
          { label: "Signalen geëvalueerd per bezoek", value: "130", suffix: "+", description: "Gedragsmatige, verrijkings-, contextuele en CRM-signalen - allemaal in één beslissing." },
          { label: "Beslissingslatentie", value: "<10", suffix: "ms", description: "Draait op de edge. Uw paginasnelheid wordt nooit beïnvloed." },
          { label: "Klanten die vandaag personaliseren", value: "200", suffix: "+", description: "B2B SaaS, bureaus, e-commerce en recruitmentteams." },
          { label: "Uptime SLA", value: "99,9", suffix: "%", description: "Betrouwbaarheid op enterprise-niveau met transparante statusrapportage." },
        ], "subtle"),
        quickLinks("nav", "Verken per functie", "Elke functie heeft een eigen verdiepingspagina met screenshots, voorbeelden en plandetails.", [
          { label: "Doelgroepsegmenten", href: "/features-segments", description: "Voorgebouwde en aangepaste bezoekersegmenten op basis van intentie, industrie, bron en gedrag." },
          { label: "Intentscoring", href: "/features-intent", description: "Realtime score van 0-100 opgebouwd uit gedrags- en verrijkingssignalen." },
          { label: "Verrijking", href: "/features-enrichment", description: "Stille IP-naar-bedrijf-opzoeking, weer, CRM- en ABM-data - allemaal asynchroon." },
          { label: "A/B- en multivariaat testen", href: "/features-testing", description: "Test varianten met ingebouwde statistische betrouwbaarheidsbewaking." },
          { label: "Analyses", href: "/features-analytics", description: "Sessiefunnel, variantprestaties en conversiestoewijzing." },
          { label: "Bureau & white-label", href: "/features-agency", description: "Beheer meerdere klantsites vanuit één account. White-label de interface." },
        ], "default"),
        textMedia("pillar-know", "text_media_right",
          "Leer uw bezoeker kennen",
          "130+ signalen. Een helder beeld van wie er op uw site is.",
          "Voordat Mister Chameleon de juiste content kan tonen, moet het de bezoeker begrijpen. Het evalueert gedragssignalen (paginaweergaven, scrolldiepte, CTA-klikken), verrijkingsdata (bedrijfsnaam, industrie, grootte via IP-opzoeking), CRM-fase, UTM-bron, tijdstip, weer en meer - allemaal binnen één edge-verzoek dat nul latentie toevoegt.",
          [{ label: "Verrijking verkennen", href: "/features-enrichment" }, { label: "Intentscoring verkennen", href: "/features-intent" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80", alt: "Realtime bezoekersignaal-dashboard met intentscore en bedrijfsverrijking", caption: "Elk signaal gecombineerd in één bezoekerscontext - geëvalueerd in minder dan 10 ms." },
          "subtle",
        ),
        textMedia("pillar-serve", "text_media_left",
          "Toon de juiste content",
          "Een beslissingsmotor die elke keer de beste variant kiest.",
          "De adaptieve motor evalueert uw doelgroepregels op prioriteitsvolgorde en selecteert de best passende hero, bewijssectie en CTA voor elke bezoeker. Contentvarianten leven in Sanity - uw marketingteam maakt ze, activeert ze en past ze aan zonder één regel code te schrijven. Geen sprint. Geen ticket. Geen wachten.",
          [{ label: "Hoe de motor werkt", href: "/the-engine" }, { label: "Verken de CMS", href: "/docs" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=900&auto=format&fit=crop&q=80", alt: "Contentvariant-editor in Sanity CMS met hero- en CTA-varianten", caption: "Marketing maakt varianten. De motor beslist welke elke bezoeker ziet." },
          "default",
        ),
        textMedia("pillar-measure", "text_media_right",
          "Meet en verbeter",
          "A/B-testen en analyses ingebouwd - geen tools van derden nodig.",
          "Voer gecontroleerde experimenten uit op elke contentvariant. Het ingebouwde analysedashboard toont sessiefunnels, variantprestaties en conversiestoewijzing. Statistische betrouwbaarheidsbewaking vertelt u wanneer een resultaat echt is - zodat u kunt stoppen met raden en kunt beginnen met compounderen.",
          [{ label: "Analyses verkennen", href: "/features-analytics" }, { label: "A/B-testen verkennen", href: "/features-testing" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=900&auto=format&fit=crop&q=80", alt: "A/B-testresultatendashboard met variantprestaties en statistische betrouwbaarheid", caption: "Zie precies welke variant wint - en waarom." },
          "subtle",
        ),
        featureGrid("all-features", "Elke functie, op één plek", "feature_grid_4up", [
          { title: "Adaptieve beslissingsmotor", description: "Prioriteitsgeordende doelgroepregels worden in realtime geëvalueerd. De best passende contentvariant wordt op de edge geleverd.", icon: "cpu" },
          { title: "CMS-gestuurde contentvarianten", description: "Hero-, bewijs- en CTA-varianten leven in Sanity. Marketing maakt en activeert ze zonder ontwikkelaarsbetrokkenheid.", icon: "edit-3" },
          { title: "Eerste-partij gedragsbewaking", description: "Paginaweergaven, scrolldiepte, CTA-klikken, formulierstarts en sessiesequenties - opgeslagen in uw eigen database, volledig AVG-conform.", icon: "activity" },
          { title: "IP-bedrijfsverrijking", description: "Stille bedrijfsopzoeking via IP: naam, industrie, grootte en type. Werkt zonder cookies en zonder de bezoeker iets te vragen.", icon: "search" },
          { title: "Intentscoring", description: "Een realtime intentscore van 0-100 berekend uit gecombineerde gedrags- en verrijkingssignalen.", icon: "trending-up" },
          { title: "Doelgroepsegmenten", description: "Voorgebouwde segmenten voor veelvoorkomende B2B-patronen plus een visuele builder voor aangepaste segmenten.", icon: "users" },
          { title: "CRM- en ABM-integratie", description: "Bekende contacten en doelaccounts krijgen content die past bij hun levenscyclusfase en accountniveau. Beschikbaar op Growth en Pro.", icon: "database" },
          { title: "Weer- en tijdcontext", description: "Lever automatisch weerbewuste en tijdgeschikte content - seizoen, dagsegment en lokale weersomstandigheden.", icon: "cloud" },
          { title: "A/B- en multivariaat testen", description: "Voer gecontroleerde experimenten uit op elke variant met ingebouwde verkeerssplitsing en statistische betrouwbaarheidsrapportage.", icon: "git-branch" },
          { title: "Analysedashboard", description: "Sessiefunnel, variantprestaties, engagementdiepte en conversiestoewijzing - zonder een externe analysetool.", icon: "bar-chart-2" },
          { title: "Snelheidsbeperking en botbeveiliging", description: "Piekbeveiliging zorgt ervoor dat personalisatie alleen wordt uitgevoerd voor echte bezoekers.", icon: "shield" },
          { title: "Bureau- en white-labelmodus", description: "Beheer meerdere klantsites vanuit één account. White-label het dashboard met uw bureaubranding. Alleen Pro-plan.", icon: "layout" },
        ], undefined, "default"),
        textMedia("marketing-owned", "text_media_left",
          "Eigendom van marketing. Niet geblokkeerd door techniek.",
          "Personalisatie die uw team zelf kan uitvoeren - zonder één ontwikkelaar.",
          "De meeste personalisatietools belanden uiteindelijk bij het technische team omdat ze codewijzigingen vereisen. Mister Chameleon is anders. Contentvarianten, doelgroepregels, A/B-tests en analyses worden allemaal beheerd via interfaces die zijn ontworpen voor marketeers. Uw team levert personalisatie op zijn eigen schema.",
          [{ label: "Hoe het werkt", href: "/how-it-works" }, { label: "Bekijk prijzen", href: "/pricing" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&auto=format&fit=crop&q=80", alt: "Marketingteam dat personalisatieresultaten bekijkt op een laptop", caption: "Marketing bezit de volledige personalisatiecyclus - van variantcreatie tot resultaatanalyse." },
          "subtle",
        ),
        testimonialSec("testimonials", "Wat klanten zeggen over specifieke functies", [
          { quote: "De intentscoring alleen al veranderde de manier waarop we over onze homepage denken. We kunnen nu een compleet andere pitch tonen aan iemand die twee keer de prijspagina heeft bezocht versus iemand die via LinkedIn komt.", author: "Sanne de Vries", role: "Head of Growth", company: "Growlytics" },
          { quote: "IP-verrijking was de functie waar ik het meest sceptisch over was. Binnen de eerste week identificeerde het drie enterprise-prospects waarvan we geen idee hadden dat ze ons evalueerden. We sloten er één.", author: "Marcus Bell", role: "VP Sales", company: "Frontline Agency" },
          { quote: "We voeren nu continu A/B-tests uit. De statistische betrouwbaarheidsbewaking betekent dat we geen beslissingen nemen op basis van ruis - we wachten op een echt resultaat en rollen het dan uit. Ons conversiepercentage is met 41% gestegen.", author: "Priya Nair", role: "Marketing Manager", company: "JobBridge" },
        ], "default"),
        processSec("onboarding", "Live in drie stappen", [
          { title: "Installeer het script", description: "Voeg één script-tag toe aan uw website. Geen framework-wijzigingen, geen aanpassingen aan de build-pipeline. Werkt met elke stack.", duration: "2 minuten" },
          { title: "Maak uw eerste variant", description: "Open de Sanity CMS en dupliceer uw hero-sectie. Wijzig de kop en CTA voor een specifiek publiek - LinkedIn-bezoekers, terugkerende gebruikers, enterprise-prospects.", duration: "10 minuten" },
          { title: "Definieer uw regel en ga live", description: "Stel in de regeleditor de conditie in (bijv. utmSource equals linkedin) en koppel deze aan uw nieuwe variant. Publiceren. De motor neemt direct het over.", duration: "3 minuten" },
        ], "subtle"),
        faqSec("faq", "Veelgestelde vragen", [
          { question: "Heb ik een ontwikkelaar nodig om Mister Chameleon in te stellen?", answer: "De initiële scriptinstallatie duurt een ontwikkelaar ongeveer twee minuten. Daarna wordt alles - variantcreatie, doelgroepregels, A/B-tests, analyses - beheerd door uw marketingteam via de CMS- en dashboard-interfaces." },
          { question: "Hoe werkt IP-verrijking zonder cookies?", answer: "Verrijking voert een stille server-side opzoeking uit op het IP-adres van de bezoeker. Het retourneert de bedrijfsnaam, industrie, geschatte grootte en organisatietype. Er worden geen cookies geplaatst, er worden geen persoonsgegevens opgeslagen en het is volledig AVG-conform." },
          { question: "Kan ik twee varianten tegen elkaar testen?", answer: "Ja. De A/B-testmodule laat u verkeer splitsen tussen twee of meer contentvarianten en meet conversiepercentages, engagementdiepte en CTA-klikken. Statistische betrouwbaarheid wordt automatisch berekend." },
          { question: "Wat telt als een personalisatiesessie?", answer: "Een sessie is een enkelvoudig bezoek waarbij de adaptieve motor signalen evalueert en een contentbeslissing neemt. Sessies worden gereset na 30 minuten inactiviteit. Uw plan bevat een maandelijkse sessietoelage; overschrijdingen kunnen worden aangevuld in bundels." },
          { question: "Is de analyse ingebouwd of heb ik een externe tool nodig?", answer: "Het analysedashboard is volledig ingebouwd. Het toont sessievolume, variantprestaties, funneluitval, engagementdiepte en conversiestoewijzing - zonder Google Analytics, Mixpanel of een andere tool." },
          { question: "Kunnen bureaus meerdere klantsites beheren?", answer: "Ja. Het Pro-plan bevat de multi-tenant bureaumodus, waarmee u meerdere klantsites vanuit één account kunt beheren. Het dashboard kan worden voorzien van uw bureaubranding zodat klanten een naadloze ervaring zien." },
        ], "default"),
        ctaSec("cta", "Begin vandaag met het personaliseren van uw website", "Gratis proefperiode. Geen creditcard. Live in 15 minuten.", "Gratis proefperiode starten", "/order/starter"),
      ],
      { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_platform" } },
      ["features", "functionaliteiten", "platform", "mogelijkheden", "product"],
    ),
    locale: "nl",
  },

  // ── FEATURES (DE) ────────────────────────────────────────────────────────────
  {
    ...page("features-de", "features", "Features - DE", "marketing-page",
      "Mister Chameleon Features - adaptives Personalisierungsplattform",
      "Entdecken Sie alle Funktionen der Mister Chameleon Plattform: Intent-Scoring, Anreicherung, A/B-Tests, Analysen, Agentur-Tools und mehr.",
      [
        textMedia("hero", "text_media_right",
          "Alles, was Sie für Personalisierung im großen Maßstab brauchen.",
          "Eine Plattform. Alle Funktionen, die Ihr Marketingteam benötigt.",
          "Mister Chameleon ist eine vollständige adaptive Personalisierungsplattform. Jede Funktion ist darauf ausgelegt, zusammenzuarbeiten - und von Ihrem Marketingteam ohne technischen Support betrieben zu werden. Keine Sprints. Keine API-Integrationen. Kein sechsstelliger Vertrag.",
          [{ label: "Kostenlos testen", href: "/order/starter" }, { label: "So funktioniert es", href: "/how-it-works" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Personalisierungs-Analyse-Dashboard" },
          "default",
        ),
        statsSec("stats", "Zahlen, die zählen", [
          { label: "Ausgewertete Signale pro Besuch", value: "130", suffix: "+", description: "Verhaltens-, Anreicherungs-, Kontext- und CRM-Signale - alle in einer Entscheidung." },
          { label: "Entscheidungslatenz", value: "<10", suffix: "ms", description: "Läuft am Edge. Ihre Seitengeschwindigkeit wird nie beeinträchtigt." },
          { label: "Kunden, die heute personalisieren", value: "200", suffix: "+", description: "B2B SaaS, Agenturen, E-Commerce und Recruiting-Teams." },
          { label: "Verfügbarkeits-SLA", value: "99,9", suffix: "%", description: "Enterprise-Zuverlässigkeit mit transparenter Statusberichterstattung." },
        ], "subtle"),
        quickLinks("nav", "Nach Funktion erkunden", "Jede Funktion hat eine eigene Detailseite mit Screenshots, Beispielen und Plandetails.", [
          { label: "Zielgruppensegmente", href: "/features-segments", description: "Vorgefertigte und benutzerdefinierte Besuchersegmente basierend auf Intent, Branche, Quelle und Verhalten." },
          { label: "Intent-Scoring", href: "/features-intent", description: "Echtzeit-Score von 0-100 aus Verhaltens- und Anreicherungssignalen." },
          { label: "Anreicherung", href: "/features-enrichment", description: "Stille IP-zu-Unternehmens-Abfrage, Wetter, CRM- und ABM-Daten - alles asynchron." },
          { label: "A/B- und multivariates Testen", href: "/features-testing", description: "Varianten testen mit integriertem statistischen Konfidenz-Tracking." },
          { label: "Analysen", href: "/features-analytics", description: "Session-Funnel, Varianten-Performance und Konversions-Attribution." },
          { label: "Agentur & White-Label", href: "/features-agency", description: "Mehrere Kunden-Sites aus einem Konto verwalten. Interface white-labeln." },
        ], "default"),
        textMedia("pillar-know", "text_media_right",
          "Ihren Besucher kennen",
          "130+ Signale. Ein klares Bild, wer auf Ihrer Website ist.",
          "Bevor Mister Chameleon den richtigen Inhalt ausliefern kann, muss es den Besucher verstehen. Es wertet Verhaltenssignale aus (Seitenaufrufe, Scrolltiefe, CTA-Klicks), Anreicherungsdaten (Unternehmensname, Branche, Größe per IP-Abfrage), CRM-Phase, UTM-Quelle, Tageszeit, Wetter und mehr - alles in einer einzigen Edge-Anfrage ohne zusätzliche Latenz.",
          [{ label: "Anreicherung erkunden", href: "/features-enrichment" }, { label: "Intent-Scoring erkunden", href: "/features-intent" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&auto=format&fit=crop&q=80", alt: "Echtzeit-Besuchersignal-Dashboard mit Intent-Score und Unternehmensanreicherung", caption: "Alle Signale in einem Besucherkontext kombiniert - ausgewertet in unter 10 ms." },
          "subtle",
        ),
        textMedia("pillar-serve", "text_media_left",
          "Den richtigen Inhalt ausliefern",
          "Eine Entscheidungsengine, die jedes Mal die beste Variante auswählt.",
          "Die adaptive Engine wertet Ihre Zielgruppenregeln in Prioritätsreihenfolge aus und wählt den am besten passenden Hero, Beweisabschnitt und CTA für jeden Besucher. Inhaltsvarianten leben in Sanity - Ihr Marketingteam erstellt, aktiviert und passt sie ohne eine einzige Zeile Code an. Kein Sprint. Kein Ticket. Kein Warten.",
          [{ label: "Wie die Engine funktioniert", href: "/the-engine" }, { label: "CMS erkunden", href: "/docs" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=900&auto=format&fit=crop&q=80", alt: "Inhaltsvarianten-Editor in Sanity CMS mit Hero- und CTA-Varianten", caption: "Marketing erstellt Varianten. Die Engine entscheidet, welche jeder Besucher sieht." },
          "default",
        ),
        textMedia("pillar-measure", "text_media_right",
          "Messen und verbessern",
          "A/B-Tests und Analysen integriert - kein externes Tool nötig.",
          "Führen Sie kontrollierte Experimente mit jeder Inhaltsvariante durch. Das integrierte Analyse-Dashboard zeigt Session-Funnels, Varianten-Performance und Konversions-Attribution. Die statistische Konfidenzüberwachung zeigt Ihnen, wann ein Ergebnis real ist.",
          [{ label: "Analysen erkunden", href: "/features-analytics" }, { label: "A/B-Tests erkunden", href: "/features-testing" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=900&auto=format&fit=crop&q=80", alt: "A/B-Testergebnisse-Dashboard mit Varianten-Performance und statistischer Konfidenz", caption: "Sehen Sie genau, welche Variante gewinnt - und warum." },
          "subtle",
        ),
        featureGrid("all-features", "Alle Funktionen auf einen Blick", "feature_grid_4up", [
          { title: "Adaptive Entscheidungsengine", description: "Prioritätsgeordnete Zielgruppenregeln werden in Echtzeit ausgewertet. Die am besten passende Inhaltsvariante wird am Edge ausgeliefert.", icon: "cpu" },
          { title: "CMS-gesteuerte Inhaltsvarianten", description: "Hero-, Beweis- und CTA-Varianten leben in Sanity. Marketing erstellt und aktiviert sie ohne Entwicklerbeteiligung.", icon: "edit-3" },
          { title: "Erstanbieter-Verhaltenserfassung", description: "Seitenaufrufe, Scrolltiefe, CTA-Klicks, Formularstarts und Session-Sequenzen - in Ihrer eigenen Datenbank gespeichert, vollständig DSGVO-konform.", icon: "activity" },
          { title: "IP-Unternehmensanreicherung", description: "Stille Unternehmensabfrage per IP: Name, Branche, Größe und Typ. Funktioniert ohne Cookies.", icon: "search" },
          { title: "Intent-Scoring", description: "Ein Echtzeit-Intent-Score von 0-100, berechnet aus kombinierten Verhaltens- und Anreicherungssignalen.", icon: "trending-up" },
          { title: "Zielgruppensegmente", description: "Vorgefertigte Segmente für häufige B2B-Muster plus ein visueller Builder für benutzerdefinierte Segmente.", icon: "users" },
          { title: "CRM- & ABM-Integration", description: "Bekannte Kontakte und Zielaccounts erhalten Inhalte, die ihrer Lifecycle-Phase und Kontoebene entsprechen. Auf Growth und Pro verfügbar.", icon: "database" },
          { title: "Wetter- & Zeitkontext", description: "Wettergerechte und zeitgemäße Inhalte automatisch ausliefern - Saison, Tagessegment und lokale Wetterbedingungen.", icon: "cloud" },
          { title: "A/B- und multivariates Testen", description: "Kontrollierte Experimente mit beliebigen Varianten und integrierter Traffic-Aufteilung und statistischer Konfidenzberichterstattung.", icon: "git-branch" },
          { title: "Analyse-Dashboard", description: "Session-Funnel, Varianten-Performance, Engagement-Tiefe und Konversions-Attribution - ohne externes Analysetool.", icon: "bar-chart-2" },
          { title: "Rate-Limiting und Bot-Schutz", description: "Spike-Schutz stellt sicher, dass Personalisierung nur für echte Besucher ausgeführt wird.", icon: "shield" },
          { title: "Agentur- und White-Label-Modus", description: "Mehrere Kunden-Sites aus einem Konto verwalten. Dashboard mit Agentur-Branding versehen. Nur Pro-Plan.", icon: "layout" },
        ], undefined, "default"),
        textMedia("marketing-owned", "text_media_left",
          "Im Besitz des Marketings. Nicht blockiert durch die IT.",
          "Personalisierung, die Ihr Team selbst betreiben kann - ohne einen einzigen Entwickler.",
          "Die meisten Personalisierungstools landen beim Engineering-Team, weil sie Codeänderungen erfordern. Mister Chameleon ist anders. Inhaltsvarianten, Zielgruppenregeln, A/B-Tests und Analysen werden alle über Interfaces verwaltet, die für Marketer konzipiert sind. Ihr Team liefert Personalisierung nach eigenem Zeitplan.",
          [{ label: "So funktioniert es", href: "/how-it-works" }, { label: "Preise ansehen", href: "/pricing" }],
          { type: "image" as const, url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&auto=format&fit=crop&q=80", alt: "Marketingteam, das Personalisierungsergebnisse auf einem Laptop überprüft", caption: "Marketing verantwortet den gesamten Personalisierungskreislauf - von der Variantenerstellung bis zur Ergebnisanalyse." },
          "subtle",
        ),
        testimonialSec("testimonials", "Was Kunden über spezifische Funktionen sagen", [
          { quote: "Das Intent-Scoring allein hat unsere Denkweise über unsere Homepage verändert. Wir können jetzt jemandem, der die Preisseite zweimal besucht hat, eine völlig andere Botschaft zeigen als jemandem, der über LinkedIn kommt.", author: "Sanne de Vries", role: "Head of Growth", company: "Growlytics" },
          { quote: "Die IP-Anreicherung war die Funktion, der ich am skeptischsten gegenüberstand. Innerhalb der ersten Woche identifizierte sie drei Enterprise-Interessenten, von denen wir nicht wussten, dass sie uns evaluierten. Einen davon haben wir abgeschlossen.", author: "Marcus Bell", role: "VP Sales", company: "Frontline Agency" },
          { quote: "Wir führen jetzt kontinuierlich A/B-Tests durch. Die statistische Konfidenzüberwachung bedeutet, dass wir keine Entscheidungen auf Basis von Rauschen treffen - wir warten auf ein echtes Ergebnis und rollen es dann aus. Unsere Konversionsrate ist um 41% gestiegen.", author: "Priya Nair", role: "Marketing Manager", company: "JobBridge" },
        ], "default"),
        processSec("onboarding", "In drei Schritten live", [
          { title: "Script installieren", description: "Fügen Sie Ihrer Website ein einziges Script-Tag hinzu. Keine Framework-Änderungen, keine Build-Pipeline-Modifikationen. Funktioniert mit jedem Stack.", duration: "2 Minuten" },
          { title: "Erste Variante erstellen", description: "Öffnen Sie das Sanity CMS und duplizieren Sie Ihren Hero-Bereich. Ändern Sie Überschrift und CTA für ein bestimmtes Publikum - LinkedIn-Besucher, wiederkehrende Nutzer, Enterprise-Interessenten.", duration: "10 Minuten" },
          { title: "Regel definieren und live gehen", description: "Stellen Sie im Regeleditor die Bedingung ein (z.B. utmSource equals linkedin) und verknüpfen Sie sie mit Ihrer neuen Variante. Veröffentlichen. Die Engine übernimmt sofort.", duration: "3 Minuten" },
        ], "subtle"),
        faqSec("faq", "Häufig gestellte Fragen", [
          { question: "Brauche ich einen Entwickler für die Einrichtung von Mister Chameleon?", answer: "Die initiale Script-Installation dauert einen Entwickler etwa zwei Minuten. Danach wird alles - Variantenerstellung, Zielgruppenregeln, A/B-Tests, Analysen - von Ihrem Marketingteam über die CMS- und Dashboard-Interfaces verwaltet." },
          { question: "Wie funktioniert IP-Anreicherung ohne Cookies?", answer: "Die Anreicherung führt eine stille serverseitige Abfrage der IP-Adresse des Besuchers durch. Sie liefert Unternehmensname, Branche, geschätzte Größe und Organisationstyp. Es werden keine Cookies gesetzt, keine personenbezogenen Daten gespeichert, und es ist vollständig DSGVO-konform." },
          { question: "Kann ich zwei Varianten gegeneinander testen?", answer: "Ja. Das A/B-Test-Modul ermöglicht es Ihnen, Traffic zwischen zwei oder mehr Inhaltsvarianten aufzuteilen und Konversionsraten, Engagement-Tiefe und CTA-Klicks zu messen. Die statistische Signifikanz wird automatisch berechnet." },
          { question: "Was zählt als Personalisierungs-Session?", answer: "Eine Session ist ein einzelner Besucherbesuch, bei dem die adaptive Engine Signale auswertet und eine Inhaltsentscheidung trifft. Sessions werden nach 30 Minuten Inaktivität zurückgesetzt. Ihr Plan beinhaltet ein monatliches Session-Kontingent; Überschreitungen können in Bundles nachgekauft werden." },
          { question: "Sind die Analysen eingebaut oder brauche ich ein externes Tool?", answer: "Das Analyse-Dashboard ist vollständig eingebaut. Es zeigt Session-Volumen, Varianten-Performance, Funnel-Abbrüche, Engagement-Tiefe und Konversions-Attribution - ohne Google Analytics, Mixpanel oder ein anderes Tool." },
          { question: "Können Agenturen mehrere Kunden-Sites verwalten?", answer: "Ja. Der Pro-Plan beinhaltet den Multi-Tenant-Agenturmodus, mit dem Sie mehrere Kunden-Sites aus einem Konto verwalten können. Das Dashboard kann mit Ihrem Agentur-Branding versehen werden, damit Kunden eine nahtlose Erfahrung sehen." },
        ], "default"),
        ctaSec("cta", "Beginnen Sie noch heute mit der Personalisierung Ihrer Website", "Kostenloser Test. Keine Kreditkarte. In 15 Minuten live.", "Kostenlos starten", "/order/starter"),
      ],
      { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_platform" } },
      ["features", "funktionen", "platform", "moglichkeiten", "produkt"],
    ),
    locale: "de",
  },

  // ── FEATURES/SEGMENTS (NL) ───────────────────────────────────────────────────
  {
    ...page("features-segments-nl", "features-segments", "Doelgroepsegmenten - NL", "landing-page",
      "Doelgroepsegmenten - Mister Chameleon",
      "Bouw slimme segmenten op basis van gedrag, intentie en bedrijfsprofiel.",
      [
        textSec("intro", "text_lead", "Stop met iedereen targeten. Begin met de juiste doelgroep.",
          pt(
            "Doelgroepsegmenten stellen u in staat bezoekers te groeperen op basis van wat ze gemeen hebben - en vervolgens elke groep content te tonen die voor hen is geschreven. Niet een verwaterd gemiddelde. De specifieke boodschap die dit type bezoeker vooruit brengt.",
            "Mister Chameleon wordt geleverd met 10 voorgebouwde segmenten. U kunt ze in seconden activeren, of zelf bouwen met elke combinatie van de 130+ signalen die de motor bijhoudt.",
          ),
        ),
        featureGrid("built-in", "Voorgebouwde segmenten - direct te gebruiken", "feature_grid_3up", [
          { title: "Bezoekers met hoge intentie", description: "Intentscore >= 60. Deze bezoekers hebben duidelijke koopsignalen getoond. Toon hen uw meest directe CTA en prijsgerichte content.", icon: "trending-up" },
          { title: "Enterprise-prospects", description: "Bedrijfstype: enterprise of mid-market, gedetecteerd via IP. Toon hen beveiligingscertificeringen, SLA-details en enterprise-casestudies.", icon: "building" },
          { title: "MKB- en startupsegment", description: "Kleinere bedrijven die reageren op snelheid-naar-waarde, eenvoud en prijstransparantie.", icon: "zap" },
          { title: "LinkedIn-verkeer", description: "Bezoekers van LinkedIn zijn doorgaans professionals die onderzoek doen. Thought-leadership-content converteert dit segment het best.", icon: "linkedin" },
          { title: "Prijsonderzoekers", description: "Bezochten uw prijspagina of scoorden >= 0,4 op prijsinteresse. De vergelijkingsgerichte contentvariant presteert hier beter.", icon: "tag" },
          { title: "Terugkerende betrokken bezoekers", description: "Multi-sessie bezoekers met engagementscore >= 40. Ze kennen u - geef hen het diepere verhaal, niet de introductie.", icon: "repeat" },
          { title: "Klaar om te converteren", description: "isReadyToConvert = true EN intentie >= 50. Deze bezoekers zijn dubbel gescreend: zowel hoge intentie als hoge betrokkenheid. Toon hen uw sterkste CTA.", icon: "check-circle" },
          { title: "Betaalde acquisitie", description: "Bezoekers van betaald zoeken of betaald sociaal. Ze klikten op een advertentie - uw boodschap moet exact leveren wat de advertentie beloofde.", icon: "dollar-sign" },
          { title: "Doelaccounts (ABM)", description: "Vergeleken met uw ABM-lijst. Toon accountspecifieke content, casestudies uit hun industrie en genoemde referentieklanten.", icon: "crosshair" },
          { title: "CRM-bekende contacten", description: "Gekoppeld via HubSpot of Salesforce. Bekende contacten krijgen content die past bij hun levenscyclusfase - lead, MQL, SQL, klant.", icon: "users" },
        ]),
        processSec("how", "Een aangepast segment bouwen", [
          { title: "Kies uw signalen", description: "Kies uit intentscore, engagementscore, verkeersbron, bedrijfsindustrie, bedrijfsgrootte, funnel-fase, CRM-status, ABM-match, paginabezoekgeschiedenis of een ander gevolgd signaal." },
          { title: "Stel uw condities in", description: "Combineer signalen met EN/OF-logica. 'Intentie >= 70 EN industrie = SaaS' - of zo eenvoudig als 'UTM-bron = nieuwsbrief'." },
          { title: "Wijs contentvarianten toe", description: "Koppel uw segment aan elke hero-, bewijs-, CTA- of functievariant in uw CMS. De motor bedient automatisch de juiste content aan overeenkomende bezoekers." },
          { title: "Monitor prestaties", description: "Het analysedashboard toont sessievolumes, conversiepercentages en funnel-progressie voor elk segment - zodat u uw targeting in de loop van de tijd kunt verfijnen." },
        ]),
        ctaSec("cta", "Klaar om slimmer te targeten?", "Begin met de 10 voorgebouwde segmenten en pas ze aan naarmate u groeit.", "Probeer gratis", "/order/starter"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_cases" } },
      ["features", "sector", "doelgroep", "use-case"],
    ),
    locale: "nl",
  },

  // ── FEATURES/SEGMENTS (DE) ───────────────────────────────────────────────────
  {
    ...page("features-segments-de", "features-segments", "Zielgruppensegmente - DE", "landing-page",
      "Zielgruppensegmente - Mister Chameleon Funktionen",
      "Erstellen oder nutzen Sie vorgefertigte Besuchersegmente basierend auf Intent-Score, Unternehmenstyp, Traffic-Quelle und Verhalten.",
      [
        textSec("intro", "text_lead", "Hören Sie auf, alle anzusprechen. Sprechen Sie die Richtigen an.",
          pt(
            "Zielgruppensegmente ermöglichen es Ihnen, Besucher nach Gemeinsamkeiten zu gruppieren - und dann jeder Gruppe Inhalte zu zeigen, die für sie geschrieben wurden. Kein verwässerter Durchschnitt. Die spezifische Botschaft, die diesen Besuchertyp voranbringt.",
            "Mister Chameleon wird mit 10 vorgefertigten Segmenten geliefert. Sie können diese in Sekunden aktivieren oder eigene mit jeder Kombination der 130+ Signale erstellen, die die Engine verfolgt.",
          ),
        ),
        featureGrid("built-in", "Vorgefertigte Segmente - sofort einsatzbereit", "feature_grid_3up", [
          { title: "High-Intent-Besucher", description: "Intent-Score >= 60. Diese Besucher haben klare Kaufsignale gezeigt. Zeigen Sie ihnen Ihren direktesten CTA und preisorientierte Inhalte.", icon: "trending-up" },
          { title: "Enterprise-Interessenten", description: "Unternehmenstyp: Enterprise oder Mid-Market, per IP erkannt. Zeigen Sie ihnen Sicherheitszertifizierungen, SLA-Details und Enterprise-Fallstudien.", icon: "building" },
          { title: "KMU- und Startup-Segment", description: "Kleinere Unternehmen, die auf Zeit-bis-Wert, Einfachheit und Preistransparenz ansprechen.", icon: "zap" },
          { title: "LinkedIn-Traffic", description: "Besucher von LinkedIn sind in der Regel Fachleute, die recherchieren. Thought-Leadership-Inhalte konvertieren dieses Segment am besten.", icon: "linkedin" },
          { title: "Preisrechercheure", description: "Haben Ihre Preisseite besucht oder >= 0,4 bei Preisinteresse bewertet. Die vergleichsorientierte Inhaltsvariante überzeugt hier.", icon: "tag" },
          { title: "Wiederkehrende Engagierte", description: "Multi-Session-Besucher mit Engagement-Score >= 40. Sie kennen Sie - geben Sie ihnen die tiefere Geschichte, nicht die Einführung.", icon: "repeat" },
          { title: "Konversionsbereit", description: "isReadyToConvert = true UND Intent >= 50. Diese Besucher sind doppelt qualifiziert: sowohl hoher Intent als auch hohes Engagement. Zeigen Sie ihnen Ihren stärksten CTA.", icon: "check-circle" },
          { title: "Bezahlte Akquisition", description: "Besucher aus bezahlter Suche oder bezahlten sozialen Medien. Sie haben auf eine Anzeige geklickt - Ihre Botschaft sollte genau das liefern, was die Anzeige versprochen hat.", icon: "dollar-sign" },
          { title: "Zielaccounts (ABM)", description: "Abgeglichen mit Ihrer ABM-Liste. Zeigen Sie kontospezifische Inhalte, Fallstudien aus ihrer Branche und namentliche Referenzkunden.", icon: "crosshair" },
          { title: "CRM-bekannte Kontakte", description: "Abgeglichen über HubSpot oder Salesforce. Bekannte Kontakte erhalten Inhalte entsprechend ihrer Lifecycle-Phase - Lead, MQL, SQL, Kunde.", icon: "users" },
        ]),
        processSec("how", "Ein benutzerdefiniertes Segment erstellen", [
          { title: "Signale auswählen", description: "Wählen Sie aus Intent-Score, Engagement-Score, Traffic-Quelle, Unternehmensbranche, Unternehmensgröße, Funnel-Phase, CRM-Status, ABM-Match, Seitenbesuchshistorie oder einem anderen verfolgten Signal." },
          { title: "Bedingungen festlegen", description: "Signale mit UND/ODER-Logik kombinieren. 'Intent >= 70 UND Branche = SaaS' - oder so einfach wie 'UTM-Quelle = Newsletter'." },
          { title: "Inhaltsvarianten zuweisen", description: "Verknüpfen Sie Ihr Segment mit beliebigen Hero-, Beweis-, CTA- oder Funktionsvarianten in Ihrem CMS. Die Engine liefert übereinstimmenden Besuchern automatisch den richtigen Inhalt." },
          { title: "Performance überwachen", description: "Das Analyse-Dashboard zeigt Session-Zahlen, Konversionsraten und Funnel-Fortschritt für jedes Segment - damit Sie Ihr Targeting im Laufe der Zeit verfeinern können." },
        ]),
        ctaSec("cta", "Bereit für smarteres Targeting?", "Starten Sie mit den 10 vorgefertigten Segmenten und passen Sie sie nach Bedarf an.", "Jetzt kostenlos testen", "/order/starter"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_cases" } },
    ),
    locale: "de",
  },

  // ── FEATURES/INTENT (NL) ─────────────────────────────────────────────────────
  {
    ...page("features-intent-nl", "features-intent", "Intentscoring - NL", "landing-page",
      "Intentscoring - realtime inzicht in koopintentie",
      "Zie realtime welke bezoekers klaar zijn om te converteren.",
      [
        textSec("intro", "text_lead", "Weet precies waar elke bezoeker staat - voordat ze het u vertellen.",
          pt(
            "Intentscoring is het krachtigste signaal voor personalisatie. Het vertelt u, op dit moment, hoe waarschijnlijk het is dat een bepaalde bezoeker converteert - en dus welke content hen vooruit brengt.",
            "De intentmotor van Mister Chameleon produceert een score van 0-100 voor elke bezoeker op elke paginalading, met behulp van een combinatie van gedragsgeschiedenis, verrijkingsdata en realtime-signalen.",
          ),
        ),
        featureGrid("signals", "Wat er in de score gaat", "feature_grid_4up", [
          { title: "Paginabezoekpatronen", description: "Prijzen bezoeken, dan over ons, dan een casestudie - in die volgorde - signaleert veel hogere intentie dan willekeurig browsen. Sequentiescoring legt dit vast.", icon: "map" },
          { title: "Tijd en recency", description: "Een bezoeker die gisteren uw prijspagina las en vandaag terug is, heeft veel meer kans op conversie dan iemand die drie weken geleden één keer bezocht.", icon: "clock" },
          { title: "CTA-betrokkenheid", description: "Klikken op demo-CTA's, prijslinks en contactknoppen zijn sterke intentiesignalen. Elke interactie verhoogt de score.", icon: "mouse-pointer" },
          { title: "Formuliergedrag", description: "Een contactformulier starten - ook zonder in te dienen - is een krachtig intentiesignaal. We volgen het en nemen het mee in de berekening.", icon: "edit-2" },
          { title: "Bedrijfsverrijking", description: "Enterprise-bezoekers scoren anders dan MKB. Een bekend doelaccount scoort standaard hoger. Industrie-match past de weging aan.", icon: "building" },
          { title: "Sessiediepte", description: "Het aantal sessies, pagina's per sessie en totale tijd op de site dragen allemaal bij. Een diepgaande multi-sessie bezoeker heeft bijna altijd hogere intentie dan een eerste bezoeker.", icon: "layers" },
        ]),
        textMedia("score-visual", "text_media_left",
          "Realtime scoringdashboard",
          "Kijk hoe intentie opbouwt - sessie voor sessie.",
          "Het analysedashboard toont hoe de intentscore van elke bezoeker zich in de loop van de tijd ontwikkelt. U kunt precies zien welke pagina's, klikken en interacties de doorslag gaven - en die inzichten gebruiken om uw personalisatieregels aan te scherpen.",
          [{ label: "Analysefuncties verkennen", href: "/features-analytics" }],
          { type: "image", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Analysedashboard met intentscores en funnel-fasen", caption: "Intentscoretrends - live, per bezoeker, per sessie" },
        ),
        statsSec("results", "Wat intentscoring mogelijk maakt", [
          { label: "Verbetering in CTA-doorklikpercentage voor het high-intent-segment", value: "47", suffix: "%" },
          { label: "Vermindering van demo no-shows bij boekingen vanuit high-intent-content", value: "31", suffix: "%" },
          { label: "Nauwkeurigheid van intentscore vs. uiteindelijke conversie", value: "89", suffix: "%" },
        ]),
        ctaSec("cta", "Bekijk live de intentscores van uw bezoekers", "De demo toont realtime scoring terwijl u verschillende bezoekersreizen simuleert.", "Open de demo", "/demo"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
      ["features", "intentscoring", "scoring", "technisch"],
    ),
    locale: "nl",
  },

  // ── FEATURES/INTENT (DE) ─────────────────────────────────────────────────────
  {
    ...page("features-intent-de", "features-intent", "Intent-Scoring - DE", "landing-page",
      "Intent-Scoring - Mister Chameleon Funktionen",
      "Echtzeit-Intent-Score von 0-100 aus 130+ Verhaltens- und Anreicherungssignalen. Wissen Sie genau, wie nah jeder Besucher an der Konversion ist.",
      [
        textSec("intro", "text_lead", "Wissen Sie genau, wo jeder Besucher steht - bevor er es Ihnen sagt.",
          pt(
            "Intent-Scoring ist das mächtigste Signal für Personalisierung. Es sagt Ihnen, genau jetzt, wie wahrscheinlich es ist, dass ein bestimmter Besucher konvertiert - und welcher Inhalt ihn voranbringt.",
            "Die Intent-Engine von Mister Chameleon erstellt für jeden Besucher bei jedem Seitenaufruf einen Score von 0-100, unter Verwendung einer Kombination aus Verhaltenshistorie, Anreicherungsdaten und Echtzeitsignalen.",
          ),
        ),
        featureGrid("signals", "Was in den Score einfließt", "feature_grid_4up", [
          { title: "Seitenbesuchsmuster", description: "Preisseite besuchen, dann Über uns, dann eine Fallstudie - in dieser Reihenfolge - signalisiert viel höheren Intent als zufälliges Stöbern. Sequenz-Scoring erfasst dies.", icon: "map" },
          { title: "Zeit und Aktualität", description: "Ein Besucher, der gestern Ihre Preisseite gelesen hat und heute wieder da ist, ist viel wahrscheinlicher zu konvertieren als jemand, der vor drei Wochen einmal besucht hat.", icon: "clock" },
          { title: "CTA-Engagement", description: "Klicks auf Demo-CTAs, Preislinks und Kontakt-Buttons sind starke Intent-Signale. Jede Interaktion erhöht den Score.", icon: "mouse-pointer" },
          { title: "Formularverhalten", description: "Ein Kontaktformular zu beginnen - auch ohne abzusenden - ist ein starkes Intent-Signal. Wir verfolgen es und beziehen es in die Berechnung ein.", icon: "edit-2" },
          { title: "Unternehmensanreicherung", description: "Enterprise-Besucher bewerten sich anders als KMU. Ein bekanntes Zielkonto bewertet standardmäßig höher. Branchen-Match passt die Gewichtung an.", icon: "building" },
          { title: "Session-Tiefe", description: "Die Anzahl der Sessions, Seiten pro Session und Gesamtzeit auf der Website tragen alle bei. Ein tiefer Multi-Session-Besucher hat fast immer höheren Intent als ein Erstbesucher.", icon: "layers" },
        ]),
        textMedia("score-visual", "text_media_left",
          "Echtzeit-Scoring-Dashboard",
          "Beobachten Sie, wie Intent wächst - Session für Session.",
          "Das Analyse-Dashboard zeigt, wie sich der Intent-Score jedes Besuchers im Laufe der Zeit entwickelt. Sie sehen genau, welche Seiten, Klicks und Interaktionen den Ausschlag gaben - und nutzen diese Erkenntnisse, um Ihre Personalisierungsregeln zu schärfen.",
          [{ label: "Analyse-Funktionen erkunden", href: "/features-analytics" }],
          { type: "image", url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop&q=80", alt: "Analyse-Dashboard mit Intent-Scores und Funnel-Phasen", caption: "Intent-Score-Trends - live, pro Besucher, pro Session" },
        ),
        statsSec("results", "Was Intent-Scoring ermöglicht", [
          { label: "Verbesserung der CTA-Klickrate für das High-Intent-Segment", value: "47", suffix: "%" },
          { label: "Reduzierung von Demo-No-Shows bei Buchungen aus High-Intent-Inhalten", value: "31", suffix: "%" },
          { label: "Intent-Score-Genauigkeit vs. tatsächliche Konversion", value: "89", suffix: "%" },
        ]),
        ctaSec("cta", "Sehen Sie die Intent-Scores Ihrer Besucher live", "Die Demo zeigt Echtzeit-Scoring, während Sie verschiedene Besucherjourneys simulieren.", "Demo öffnen", "/demo"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ),
    locale: "de",
  },

  // ── FEATURES/ENRICHMENT (NL) ─────────────────────────────────────────────────
  {
    ...page("features-enrichment-nl", "features-enrichment", "Verrijking - NL", "landing-page",
      "Dataverrijking - herken bedrijven en context realtime",
      "Herken bedrijven, branche en accounttype automatisch zonder third-party cookies.",
      [
        textMedia("intro-visual", "text_media_right",
          "Weet wie er op uw site is",
          "Van anonieme bezoeker naar bekende context - in milliseconden.",
          "Verrijking is wat een naamloze IP-adres verandert in een bekend bedrijf. Wanneer iemand van een herkenbaar netwerk uw site bezoekt, zoeken we stil hun bedrijfsnaam, industrie, personeelsbestand en type op - en maken die informatie beschikbaar voor de beslissingsmotor voordat de pagina klaar is met laden. Geen cookies vereist.",
          [{ label: "Bekijk de verrijkingspipeline", href: "/how-it-works" }],
          { type: "image", url: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&auto=format&fit=crop&q=80", alt: "Team dat werkt met data op laptops in een modern kantoor", caption: "Bedrijfsverrijking - van IP-adres naar gepersonaliseerde ervaring" },
        ),
        featureGrid("types", "Verrijkingsbronnen", "feature_grid_3up", [
          { title: "IP-naar-bedrijf", description: "Bedrijfsnaam, domein, industrie, bedrijfsgrootte, bedrijfstype en matchbetrouwbaarheid - opgezocht via het IP-adres van de bezoeker bij elk verzoek.", icon: "globe" },
          { title: "CRM-matching", description: "Bekende contacten van HubSpot of Salesforce worden gematcht op e-mail (indien beschikbaar) of bedrijfsdomein. Levenscyclusfase, eigenaar en segment worden aan de motor geleverd.", icon: "users" },
          { title: "ABM-doelaccounts", description: "Upload uw doelaccountlijst en we matchen inkomende bezoekers ertegen. Tier-1-accounts krijgen automatisch premium content.", icon: "crosshair" },
          { title: "Weercontext", description: "Huidige weersomstandigheden (code, temperatuur, neerslag, wind) voor de gedetecteerde locatie van de bezoeker. Nuttig voor seizoensgebonden en weerbewuste content.", icon: "cloud" },
          { title: "Geo-verrijking", description: "Land, regio, stad, tijdzone en lat/lng - beschikbaar voor geo-gerichte content zonder toestemmingsvereiste locatie-API's.", icon: "map-pin" },
          { title: "Clientcontext", description: "Apparaattype, besturingssysteem, browser, viewportgrootte, aanraakvermogen, voorkeurskleurenschema en taal - geparseerd uit de user agent en schermeigenschappen.", icon: "monitor" },
        ]),
        faqSec("faq", "Verrijking FAQ", [
          { question: "Is IP-verrijking AVG-conform?", answer: "Ja. IP-naar-bedrijf-opzoeking komt uit bij een bedrijf - niet bij een individueel persoon. Het wordt behandeld als bedrijfsdata, niet als persoonsgegevens, en valt daarmee buiten de toestemmingsvereisten van de AVG in de meeste EU-interpretaties. We raden aan dit te vermelden in uw privacybeleid als transparantiemaatregel." },
          { question: "Hoe nauwkeurig is de IP-opzoeking?", answer: "Matchpercentages zijn afhankelijk van het netwerk van de bezoeker. Enterprise-bezoekers op bedrijfsnetwerken matchen op ~80-90%. MKB'ers en thuiswerkers op residentiële of VPN-verbindingen matchen op lagere percentages. We tonen altijd betrouwbaarheidsscores zodat u minimumdrempels kunt instellen voor uw regels." },
          { question: "Vertraagt verrijking mijn site?", answer: "Nee. Alle verrijking is asynchroon - het draait parallel aan uw paginarender. Tegen de tijd dat de bezoeker voorbij uw hero-sectie heeft gescrold, is de verrijking al voltooid en heeft de beslissingsmotor de beste variant geselecteerd." },
        ]),
        ctaSec("cta", "Bekijk verrijking in actie", "Het enterprise-scenario in onze demo toont precies wat een bedrijfsverrijkte bezoeker ziet.", "Probeer de demo", "/demo/b2b/enterprise"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_platform" } },
      ["features", "integraties", "api", "integratie", "verrijking"],
    ),
    locale: "nl",
  },

  // ── FEATURES/ENRICHMENT (DE) ─────────────────────────────────────────────────
  {
    ...page("features-enrichment-de", "features-enrichment", "Anreicherung - DE", "landing-page",
      "Datenanreicherung - Mister Chameleon Funktionen",
      "Stille IP-zu-Unternehmens-Anreicherung, CRM-Matching, ABM-Targeting, Wetter und mehr - ohne Cookies, asynchron, DSGVO-konform.",
      [
        textMedia("intro-visual", "text_media_right",
          "Wissen Sie, wer auf Ihrer Website ist",
          "Vom anonymen Besucher zum bekannten Kontext - in Millisekunden.",
          "Anreicherung verwandelt eine namenlose IP-Adresse in ein bekanntes Unternehmen. Wenn jemand von einem erkennbaren Netzwerk Ihre Website besucht, schlagen wir still deren Unternehmensname, Branche, Mitarbeiterzahl und Typ nach - und stellen diese Information der Entscheidungsengine zur Verfügung, bevor die Seite fertig geladen ist. Keine Cookies erforderlich.",
          [{ label: "Anreicherungs-Pipeline ansehen", href: "/how-it-works" }],
          { type: "image", url: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&auto=format&fit=crop&q=80", alt: "Team, das mit Daten auf Laptops in einem modernen Büro arbeitet", caption: "Unternehmensanreicherung - von der IP-Adresse zur personalisierten Erfahrung" },
        ),
        featureGrid("types", "Anreicherungsquellen", "feature_grid_3up", [
          { title: "IP-zu-Unternehmen", description: "Unternehmensname, Domain, Branche, Unternehmensgröße, Unternehmenstyp und Match-Konfidenz - bei jeder Anfrage per IP-Adresse des Besuchers abgerufen.", icon: "globe" },
          { title: "CRM-Matching", description: "Bekannte Kontakte von HubSpot oder Salesforce werden per E-Mail (wenn verfügbar) oder Unternehmens-Domain abgeglichen. Lifecycle-Phase, Eigentümer und Segment werden der Engine gemeldet.", icon: "users" },
          { title: "ABM-Zielaccounts", description: "Laden Sie Ihre Zielkonto-Liste hoch und wir gleichen eingehende Besucher damit ab. Tier-1-Accounts erhalten automatisch Premium-Inhalte.", icon: "crosshair" },
          { title: "Wetter-Kontext", description: "Aktuelle Wetterbedingungen (Code, Temperatur, Niederschlag, Wind) für den erkannten Standort des Besuchers. Nützlich für saisonale und wettergerechte Inhalte.", icon: "cloud" },
          { title: "Geo-Anreicherung", description: "Land, Region, Stadt, Zeitzone und Lat/Lng - verfügbar für geo-zielgerichtete Inhalte ohne zustimmungspflichtige Standort-APIs.", icon: "map-pin" },
          { title: "Client-Kontext", description: "Gerätetyp, Betriebssystem, Browser, Viewport-Größe, Touch-Fähigkeit, bevorzugtes Farbschema und Sprache - aus dem User-Agent und Bildschirmeigenschaften geparst.", icon: "monitor" },
        ]),
        faqSec("faq", "Anreicherungs-FAQ", [
          { question: "Ist IP-Anreicherung DSGVO-konform?", answer: "Ja. Die IP-zu-Unternehmens-Abfrage löst zu einem Unternehmen auf - nicht zu einer Einzelperson. Es wird als Geschäftsdaten behandelt, nicht als personenbezogene Daten, und fällt daher in den meisten EU-Interpretationen außerhalb der Einwilligungsanforderungen der DSGVO. Wir empfehlen, es als Transparenzmaßnahme in Ihrer Datenschutzrichtlinie zu erwähnen." },
          { question: "Wie genau ist die IP-Abfrage?", answer: "Match-Raten hängen vom Netzwerk des Besuchers ab. Enterprise-Besucher in Unternehmensnetzwerken matchen bei ~80-90%. KMU und Remote-Arbeiter in privaten oder VPN-Verbindungen matchen zu niedrigeren Raten. Wir zeigen immer Konfidenz-Scores, damit Sie Mindestschwellen für Ihre Regeln festlegen können." },
          { question: "Verlangsamt Anreicherung meine Website?", answer: "Nein. Alle Anreicherung ist asynchron - sie läuft parallel zu Ihrem Seitenrendering. Bis der Besucher an Ihrem Hero-Bereich vorbei gescrollt hat, ist die Anreicherung bereits abgeschlossen und die Entscheidungsengine hat die beste Variante ausgewählt." },
        ]),
        ctaSec("cta", "Anreicherung in Aktion sehen", "Das Enterprise-Szenario in unserer Demo zeigt genau, was ein unternehmensangereicherter Besucher sieht.", "Demo testen", "/demo/b2b/enterprise"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_platform" } },
    ),
    locale: "de",
  },

  // ── FEATURES/TESTING (NL) ────────────────────────────────────────────────────
  {
    ...page("features-testing-nl", "features-testing", "A/B- en multivariaat testen - NL", "landing-page",
      "A/B- en multivariaat testen - Mister Chameleon",
      "Test varianten en ontdek welke content beter converteert.",
      [
        textSec("intro", "text_lead", "Test met vertrouwen. Optimaliseer continu.",
          pt(
            "Personalisatie vertelt de motor welke variant elke bezoeker te tonen op basis van wat u over hen weet. Testen vertelt u welke variant het best converteert - zodat u uw regels in de loop van de tijd kunt verbeteren.",
            "Mister Chameleon heeft ingebouwde varianttesten, zodat u geen aparte A/B-testtool nodig heeft. Voer experimenten uit op elke hero, bewijssectie of CTA - en laat de data u vertellen wat werkt.",
          ),
        ),
        featureGrid("capabilities", "Testmogelijkheden", "feature_grid_3up", [
          { title: "A/B-testen", description: "Splits elk verkeerssegment tussen twee of meer varianten en meet welke meer conversies drijft. Statistische betrouwbaarheid wordt automatisch berekend.", icon: "git-branch" },
          { title: "Multivariaat testen", description: "Test meerdere elementen tegelijkertijd - hero-kop, bewijssectie en CTA-knoptekst - om de combinatie te vinden die het best converteert.", icon: "sliders" },
          { title: "Segmentbewust testen", description: "Voer tests uit binnen specifieke doelgroepsegmenten. De beste variant voor enterprise-prospects kan verschillen van die voor MKB-bezoekers - test ze afzonderlijk.", icon: "users" },
          { title: "Holdout-groepen", description: "Definieer een controlegroep die de originele content ziet, meet dan de volledige impact van personalisatie versus geen personalisatie.", icon: "shield" },
          { title: "Betrouwbaarheidsbewaking", description: "Het analysedashboard toont statistische significantie in realtime. We tonen het betrouwbaarheidsniveau zodat u weet wanneer u een winnaar kunt uitroepen.", icon: "activity" },
          { title: "Automatische promotie", description: "Configureer het systeem om de winnende variant automatisch te promoten zodra de statistische betrouwbaarheid uw drempel bereikt - geen handmatige tussenkomst vereist.", icon: "award" },
        ]),
        ctaSec("cta", "Begin met het optimaliseren van uw content", "Stel uw eerste A/B-test in in dezelfde interface die u gebruikt voor het beheren van personalisatie.", "Gratis proefperiode starten", "/order/starter"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
      ["features", "testen", "a/b testen", "product"],
    ),
    locale: "nl",
  },

  // ── FEATURES/TESTING (DE) ────────────────────────────────────────────────────
  {
    ...page("features-testing-de", "features-testing", "A/B- und multivariates Testen - DE", "landing-page",
      "A/B- und multivariates Testen - Mister Chameleon Funktionen",
      "Kontrollierte Experimente mit Ihren personalisierten Varianten. Statistisches Konfidenz-Tracking integriert - kein externes Test-Tool erforderlich.",
      [
        textSec("intro", "text_lead", "Mit Konfidenz testen. Kontinuierlich optimieren.",
          pt(
            "Personalisierung sagt der Engine, welche Variante jedem Besucher gezeigt werden soll, basierend auf dem, was Sie über ihn wissen. Tests sagen Ihnen, welche Variante tatsächlich am besten konvertiert - damit Sie Ihre Regeln im Laufe der Zeit verbessern können.",
            "Mister Chameleon hat integriertes Varianten-Testing, sodass Sie kein separates A/B-Test-Tool benötigen. Führen Sie Experimente mit beliebigem Hero, Beweisabschnitt oder CTA durch - und lassen Sie die Daten Ihnen sagen, was funktioniert.",
          ),
        ),
        featureGrid("capabilities", "Test-Funktionen", "feature_grid_3up", [
          { title: "A/B-Tests", description: "Teilen Sie jedes Traffic-Segment auf zwei oder mehr Varianten auf und messen Sie, welche mehr Konversionen erzielt. Die statistische Konfidenz wird automatisch berechnet.", icon: "git-branch" },
          { title: "Multivariate Tests", description: "Testen Sie mehrere Elemente gleichzeitig - Hero-Überschrift, Beweisabschnitt und CTA-Button-Text - um die Kombination zu finden, die am besten konvertiert.", icon: "sliders" },
          { title: "Segmentbewusstes Testen", description: "Führen Sie Tests innerhalb bestimmter Zielgruppensegmente durch. Die beste Variante für Enterprise-Interessenten kann sich von der für KMU-Besucher unterscheiden - testen Sie sie separat.", icon: "users" },
          { title: "Holdout-Gruppen", description: "Definieren Sie eine Kontrollgruppe, die den Original-Inhalt sieht, dann messen Sie die volle Auswirkung von Personalisierung versus keine Personalisierung.", icon: "shield" },
          { title: "Konfidenz-Tracking", description: "Das Analyse-Dashboard zeigt statistische Signifikanz in Echtzeit. Wir zeigen das Konfidenzniveau, damit Sie wissen, wann Sie einen Gewinner küren können.", icon: "activity" },
          { title: "Auto-Promotion", description: "Konfigurieren Sie das System, um die Gewinner-Variante automatisch zu promoten, sobald die statistische Konfidenz Ihren Schwellenwert erreicht - keine manuelle Intervention erforderlich.", icon: "award" },
        ]),
        ctaSec("cta", "Beginnen Sie mit der Optimierung Ihrer Inhalte", "Richten Sie Ihren ersten A/B-Test in derselben Oberfläche ein, die Sie für die Verwaltung der Personalisierung verwenden.", "Kostenlos starten", "/order/starter"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ),
    locale: "de",
  },

  // ── FEATURES/ANALYTICS (NL) ──────────────────────────────────────────────────
  {
    ...page("features-analytics-nl", "features-analytics", "Analyses - NL", "landing-page",
      "Analyticsdashboard - inzicht in gedrag en conversie",
      "Meet funnelprestaties, varianten en segmenten in één dashboard.",
      [
        textSec("intro", "text_lead", "Zie wat werkt - en waarom.",
          pt(
            "Personalisatie zonder meting is gokken. Het analysedashboard van Mister Chameleon geeft u een helder beeld van hoe elke variant presteert, welke doelgroepsegmenten het best converteren en waar bezoekers uw funnel verlaten.",
            "Dit alles is ingebouwd. Geen Google Analytics-integratie, geen apart dashboard, geen data-exports.",
          ),
        ),
        featureGrid("reports", "Wat u kunt meten", "feature_grid_4up", [
          { title: "Sessiefunnel", description: "Zie hoe bezoekers van bewustwording naar overweging naar intentie naar conversie bewegen - per segment, verkeersbron of tijdperiode.", icon: "filter" },
          { title: "Variantprestaties", description: "Vergelijk conversiepercentages, CTA-doorklikpercentages en tijd-op-pagina voor elke actieve variant in elk doelgroepsegment.", icon: "bar-chart-2" },
          { title: "Dagelijkse en maandelijkse sessieaantallen", description: "Volg het gepersonaliseerde sessievolume ten opzichte van uw planlimiet. Zie welke dagen de meeste gepersonaliseerde bezoeken genereren.", icon: "calendar" },
          { title: "Verrijkingsmatchpercentages", description: "Monitor hoe vaak bedrijfsverrijking een betrouwbare match oplevert - en welke industrieën het meest vertegenwoordigd zijn in uw verkeer.", icon: "percent" },
          { title: "A/B-testresultaten", description: "Live betrouwbaarheidsintervallen voor elk lopend experiment. Stop met raden, begin met meten.", icon: "git-branch" },
          { title: "Credits- en sessiegebruik", description: "Volledig audittraject voor verrijkingscreditsbesteding en sessiecreditconsumptie - zodat facturering altijd transparant is.", icon: "credit-card" },
        ]),
        textMedia("dashboard-visual", "text_media_left",
          "Één dashboard. Alles wat u nodig heeft.",
          "Funnel, varianten, segmenten - op één plek.",
          "Het analysedashboard van Mister Chameleon geeft u één overzicht van hoe uw personalisatie presteert. Sessiefunnel, variantlift, verrijkingsmatchpercentage en A/B-betrouwbaarheidsintervallen - allemaal live, allemaal op één tabblad. Geen data-exports, geen externe analysetool vereist.",
          [{ label: "Alle analysefuncties bekijken", href: "/features-analytics" }],
          { type: "image", url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&auto=format&fit=crop&q=80", alt: "Persoon die werkt op een laptop met analysedashboards op het scherm", caption: "Het volledige analyseoverzicht - sessiefunnel, variantprestaties en verrijkingsstatistieken" },
        ),
        statsSec("stats", "Analyses die het verschil maken", [
          { label: "Gemiddelde tijd om een winnende variant te identificeren", value: "< 2", suffix: " weken" },
          { label: "Klanten die in maand één een segmentverrassing ontdekken", value: "73", suffix: "%" },
          { label: "Datapunten bijgehouden per sessie", value: "130", suffix: "+" },
        ]),
        ctaSec("cta", "Bekijk het analysedashboard live", "De demo bevat een live analyseweergave gebouwd op echte sessiedata.", "Verken de demo", "/demo"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
      ["features", "analyses", "product", "platform"],
    ),
    locale: "nl",
  },

  // ── FEATURES/ANALYTICS (DE) ──────────────────────────────────────────────────
  {
    ...page("features-analytics-de", "features-analytics", "Analysen - DE", "landing-page",
      "Analyse-Dashboard - Mister Chameleon Funktionen",
      "Session-Funnel, Varianten-Performance, Konversions-Attribution und Zielgruppensegment-Aufschlüsselungen - alles an einem Ort. Kein extra Analyse-Tool nötig.",
      [
        textSec("intro", "text_lead", "Sehen Sie, was funktioniert - und warum.",
          pt(
            "Personalisierung ohne Messung ist Raten. Das Analyse-Dashboard von Mister Chameleon gibt Ihnen ein klares Bild davon, wie jede Variante performt, welche Zielgruppensegmente am besten konvertieren und wo Besucher Ihren Funnel verlassen.",
            "All das ist integriert. Keine Google Analytics-Integration, kein separates Dashboard, keine Datenexporte.",
          ),
        ),
        featureGrid("reports", "Was Sie messen können", "feature_grid_4up", [
          { title: "Session-Funnel", description: "Sehen Sie, wie Besucher von Awareness zu Consideration zu Intent zu Konversion - nach Segment, Traffic-Quelle oder Zeitraum - bewegen.", icon: "filter" },
          { title: "Varianten-Performance", description: "Konversionsraten, CTA-Klickrate und Zeit-auf-Seite für jede aktive Variante in jedem Zielgruppensegment vergleichen.", icon: "bar-chart-2" },
          { title: "Tägliche & monatliche Session-Zahlen", description: "Personalisiertes Session-Volumen gegen Ihr Plankontingent verfolgen. Sehen Sie, welche Tage die meisten personalisierten Besuche generieren.", icon: "calendar" },
          { title: "Anreicherungs-Match-Raten", description: "Überwachen Sie, wie oft Unternehmensanreicherung einen zuverlässigen Match liefert - und welche Branchen in Ihrem Traffic am stärksten vertreten sind.", icon: "percent" },
          { title: "A/B-Test-Ergebnisse", description: "Live-Konfidenzintervalle für jedes laufende Experiment. Hören Sie auf zu raten, beginnen Sie zu messen.", icon: "git-branch" },
          { title: "Credit- & Session-Verbrauch", description: "Vollständiger Audit-Trail für Anreicherungs-Credit-Ausgaben und Session-Credit-Verbrauch - damit die Abrechnung immer transparent ist.", icon: "credit-card" },
        ]),
        textMedia("dashboard-visual", "text_media_left",
          "Ein Dashboard. Alles, was Sie brauchen.",
          "Funnel, Varianten, Segmente - an einem Ort.",
          "Das Analyse-Dashboard von Mister Chameleon gibt Ihnen einen einzigen Überblick, wie Ihre Personalisierung performt. Session-Funnel, Varianten-Lift, Anreicherungs-Match-Rate und A/B-Konfidenzintervalle - alles live, alles in einem Tab. Keine Datenexporte, kein externes Analyse-Tool erforderlich.",
          [{ label: "Alle Analyse-Funktionen ansehen", href: "/features-analytics" }],
          { type: "image", url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900&auto=format&fit=crop&q=80", alt: "Person, die auf einem Laptop mit Analyse-Dashboards auf dem Bildschirm arbeitet", caption: "Die vollständige Analyseansicht - Session-Funnel, Varianten-Performance und Anreicherungsstatistiken" },
        ),
        statsSec("stats", "Analysen, die einen Unterschied machen", [
          { label: "Durchschnittliche Zeit zur Identifizierung einer Gewinner-Variante", value: "< 2", suffix: " Wochen" },
          { label: "Kunden, die im ersten Monat eine Segment-Überraschung entdecken", value: "73", suffix: "%" },
          { label: "Datenpunkte pro Session erfasst", value: "130", suffix: "+" },
        ]),
        ctaSec("cta", "Analyse-Dashboard live ansehen", "Die Demo beinhaltet eine Live-Analyseansicht, die auf echten Session-Daten basiert.", "Demo erkunden", "/demo"),
      ],
      { "hero": { fallbackVariantKey: "hero_page_banner_awareness" }, "proof": { fallbackVariantKey: "proof_stats" } },
    ),
    locale: "de",
  },

  // ── FEATURES/AGENCY (NL) ─────────────────────────────────────────────────────
  {
    ...page("features-agency-nl", "features-agency", "Bureau & White-Label - NL", "landing-page",
      "Agency- en white-labelmodus - Mister Chameleon Pro",
      "Beheer meerdere klanten vanuit één white-label platform.",
      [
        textMedia("agency-dashboard", "text_media_right",
          "Één platform. Elke klantsite.",
          "Voer personalisatie uit voor elke klant vanuit één white-label dashboard.",
          "Als u personalisatie uitvoert voor meerdere klanten - of het als dienst wilt aanbieden - geeft Mister Chameleon Pro u één controlepaneel voor elke site, met uw branding op de interface die uw klanten zien.\n\nGeen aparte contracten per klant. Geen tool-per-tenant verspreiding. Één Pro-plan, onbeperkte klantsites.",
          [{ label: "Bureauprijs bekijken", href: "/features-agency" }, { label: "Gesprek inplannen", href: "/contact" }],
          { type: "image", url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80", alt: "Bureauteam dat multi-client dashboards bekijkt op een groot scherm", caption: "Het bureau-dashboard - alle klantsites, één overzicht, uw branding" },
        ),
        featureGrid("capabilities", "Wat bureaumodus inhoudt", "feature_grid_3up", [
          { title: "Multi-site dashboard", description: "Zie alle klantsites op één plek. Sessieaantallen, conversietrends en actieve varianten - voor elk account, in één oogopslag.", icon: "layout" },
          { title: "White-label interface", description: "Vervang de Mister Chameleon-branding door uw eigen logo, kleuren en domein. Klanten zien het product van uw bureau, niet het onze.", icon: "tag" },
          { title: "Per-klant content-isolatie", description: "De varianten, regels, segmenten en analyses van elke klant zijn volledig geïsoleerd. Geen datalekken tussen accounts.", icon: "lock" },
          { title: "Aangepaste domeinen per klant", description: "Elke klant krijgt zijn eigen admin-URL op uw domein - uwplatform.nl/klant/acme - met hun eigen login.", icon: "link" },
          { title: "Bureau-factureringscontroles", description: "Beheer sessiecredittoewijzing per klant. Voeg centraal top-ups toe en verdeel ze naar behoefte. Één factuur, één relatie.", icon: "credit-card" },
          { title: "Teamlidatenbeheer", description: "Voeg client-side teamleden toe met passende rechten. Klanten kunnen hun analyses bekijken en eigen contentvarianten bewerken zonder toegang tot andere accounts.", icon: "users" },
        ]),
        pricingSec("pricing", "Bureaumodus is inbegrepen in Pro", "Alles van Growth, plus onbeperkte klantsites en white-labelling.", [
          {
            _key: "tier-pro", name: "Pro", price: "€749", period: "/maand",
            description: "Voor bureaus en teams die personalisatie beheren voor meerdere klantsites.",
            highlighted: true, badge: "Bureau-klaar",
            features: [
              { _key: "f0", label: "500.000 gepersonaliseerde sessies/maand" },
              { _key: "f1", label: "Onbeperkte klantsites" },
              { _key: "f2", label: "Volledige white-label interface" },
              { _key: "f3", label: "Aangepast domein per klant" },
              { _key: "f4", label: "Alle Growth-functies inbegrepen" },
              { _key: "f5", label: "Prioriteitsondersteuning" },
            ],
            ctaLabel: "Aan de slag met Pro", ctaHref: "/order/pro",
          },
        ], "Jaarlijkse facturering bespaart 20%. Neem contact met ons op voor volumeprijzen voor 10+ klantsites."),
        ctaSec("cta", "Praat met ons over uw bureauopzet", "Vertel ons hoeveel klantsites u beheert en we bouwen een plan dat werkt.", "Gesprek inplannen", "/contact"),
      ],
      { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
      ["features", "diensten", "white-label", "bureau", "partnership"],
    ),
    locale: "nl",
  },

  // ── FEATURES/AGENCY (DE) ─────────────────────────────────────────────────────
  {
    ...page("features-agency-de", "features-agency", "Agentur & White-Label - DE", "landing-page",
      "Agentur- und White-Label-Modus - Mister Chameleon Pro",
      "Personalisierung für alle Ihre Kunden über eine Plattform. Interface white-labeln, mehrere Sites verwalten und Kunden zu Ihren Konditionen abrechnen.",
      [
        textMedia("agency-dashboard", "text_media_right",
          "Eine Plattform. Jede Kunden-Site.",
          "Personalisierung für jeden Kunden aus einem einzigen White-Label-Dashboard verwalten.",
          "Wenn Sie Personalisierung für mehrere Kunden durchführen - oder es als Dienstleistung anbieten möchten - gibt Ihnen Mister Chameleon Pro ein einziges Kontrollzentrum für jede Site, mit Ihrem Branding auf der Oberfläche, die Ihre Kunden sehen.\n\nKeine separaten Verträge pro Kunde. Keine Tool-pro-Mandant-Zersplitterung. Ein Pro-Plan, unbegrenzte Kunden-Sites.",
          [{ label: "Agenturpreise ansehen", href: "/features-agency" }, { label: "Termin buchen", href: "/contact" }],
          { type: "image", url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&auto=format&fit=crop&q=80", alt: "Agentur-Team, das Multi-Kunden-Dashboards auf einem großen Monitor überprüft", caption: "Das Agentur-Dashboard - alle Kunden-Sites, eine Ansicht, Ihr Branding" },
        ),
        featureGrid("capabilities", "Was der Agentur-Modus beinhaltet", "feature_grid_3up", [
          { title: "Multi-Site-Dashboard", description: "Alle Kunden-Sites an einem Ort sehen. Session-Zahlen, Konversionstrends und aktive Varianten - für jeden Account auf einen Blick.", icon: "layout" },
          { title: "White-Label-Interface", description: "Ersetzen Sie das Mister Chameleon-Branding durch Ihr eigenes Logo, Farben und Domain. Kunden sehen das Produkt Ihrer Agentur, nicht unseres.", icon: "tag" },
          { title: "Kunden-Inhaltsisolierung", description: "Varianten, Regeln, Segmente und Analysen jedes Kunden sind vollständig isoliert. Kein Datenleck zwischen Accounts.", icon: "lock" },
          { title: "Benutzerdefinierte Domains pro Kunde", description: "Jeder Kunde erhält seine eigene Admin-URL auf Ihrer Domain - ihreplattform.de/kunde/acme - mit eigenem Login.", icon: "link" },
          { title: "Agentur-Abrechnungskontrollen", description: "Session-Credit-Zuweisung pro Kunde verwalten. Top-ups zentral hinzufügen und nach Bedarf verteilen. Eine Rechnung, eine Beziehung.", icon: "credit-card" },
          { title: "Teammitglied-Verwaltung", description: "Kundenseitige Teammitglieder mit entsprechenden Berechtigungen hinzufügen. Kunden können ihre Analysen einsehen und eigene Inhaltsvarianten bearbeiten, ohne auf andere Accounts zuzugreifen.", icon: "users" },
        ]),
        pricingSec("pricing", "Agentur-Modus ist im Pro-Plan enthalten", "Alles aus Growth, plus unbegrenzte Kunden-Sites und White-Labelling.", [
          {
            _key: "tier-pro", name: "Pro", price: "€749", period: "/Monat",
            description: "Für Agenturen und Teams, die Personalisierung für mehrere Kunden-Sites verwalten.",
            highlighted: true, badge: "Agentur-bereit",
            features: [
              { _key: "f0", label: "500.000 personalisierte Sessions/Monat" },
              { _key: "f1", label: "Unbegrenzte Kunden-Sites" },
              { _key: "f2", label: "Vollständiges White-Label-Interface" },
              { _key: "f3", label: "Benutzerdefinierte Domain pro Kunde" },
              { _key: "f4", label: "Alle Growth-Funktionen enthalten" },
              { _key: "f5", label: "Prioritätssupport" },
            ],
            ctaLabel: "Mit Pro starten", ctaHref: "/order/pro",
          },
        ], "Jahresabrechnung spart 20%. Kontaktieren Sie uns für Volumenpreise bei 10+ Kunden-Sites."),
        ctaSec("cta", "Sprechen Sie mit uns über Ihr Agentur-Setup", "Sagen Sie uns, wie viele Kunden-Sites Sie verwalten, und wir bauen einen passenden Plan.", "Termin buchen", "/contact"),
      ],
      { hero: { fallbackVariantKey: "hero_page_banner_awareness" }, proof: { fallbackVariantKey: "proof_cases" } },
    ),
    locale: "de",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
//
// ── Combined export ────────────────────────────────────────────────────────────

export const allMarketingPages = [
  ...marketingPages,
  ...marketingPagesPart2,
  ...marketingPagesPart3,
  ...navLeaves,
  ...navGroups,
  ...marketingSiteSettings,
  // ── Localisation (NL + DE) ──────────────────────────────────────────────────
  ...navItemsNL,
  ...navItemsDE,
  ...siteSettingsNL,
  ...siteSettingsDE,
  ...localePages,
];
