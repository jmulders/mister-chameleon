/**
 * demo/default-block-sets.ts
 *
 * Default block sets per site type.
 *
 * These are the "safety net" fallback DemoPageSpec instances used when:
 *   1. ANTHROPIC_API_KEY is not set (no AI generation).
 *   2. AI generation fails or times out.
 *   3. The AI response fails contract validation.
 *
 * Each set is a complete DemoPageSpec — bilingual (EN + NL), with scenario
 * overrides on the hero and CTA blocks — ready to feed directly into
 * demo/block-mapper.ts without any further processing.
 *
 * ─── Site type coverage ───────────────────────────────────────────────────────
 *
 *   saas        — B2B SaaS / software platform
 *   services    — Professional services / creative agency
 *   recruitment — Talent platform / staffing agency
 *   commerce    — eCommerce / online retail
 *   real_estate — Real estate / property agency
 *
 * ─── Block selection rationale ────────────────────────────────────────────────
 *
 *   All sets open with hero → stats → features.
 *   Social proof (testimonials) and conversion (cta) are universal.
 *   Category-specific blocks (pricing, careers, contact, case_highlight)
 *   appear only where they are expected by that industry.
 *
 * Client-safe — type definitions only, no server logic.
 */

import type { DemoPageSpec, DemoBlockSpec } from "./block-contract";
import type { SiteCategory } from "./types";

// ── Builder helper ────────────────────────────────────────────────────────────

function block(
  id:        string,
  type:      DemoBlockSpec["type"],
  variant:   string,
  en:        DemoBlockSpec["content"]["en"],
  nl?:       DemoBlockSpec["content"]["nl"],
  media?:    DemoBlockSpec["media"],
  overrides?: DemoBlockSpec["scenarioOverrides"],
): DemoBlockSpec {
  return {
    id,
    type,
    variant,
    content: { en, nl },
    ...(media    ? { media }               : {}),
    ...(overrides ? { scenarioOverrides: overrides } : {}),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// SAAS — B2B Software / SaaS Platform
// ═════════════════════════════════════════════════════════════════════════════

export const SAAS_PAGE_SPEC: DemoPageSpec = {
  slug:     "/",
  title:    "Homepage",
  template: "marketing-page",
  seo: {
    title:       "The smarter way to grow your pipeline",
    description: "AI-powered personalisation for B2B sales teams.",
  },
  blocks: [
    block(
      "hero-main", "hero", "hero_split",
      {
        headline:     "Close more deals with intelligent personalisation",
        subheadline:  "Our AI adapts every visitor's experience in real time — so your best message always reaches the right prospect.",
        primaryCta:   { label: "Start free trial",  href: "#" },
        secondaryCta: { label: "Watch 2-min demo",  href: "#" },
        tag:          "Now with AI-powered personalisation",
      },
      {
        headline:     "Sluit meer deals met intelligente personalisatie",
        subheadline:  "Onze AI past elke bezoekersergaring realtime aan — zodat je beste boodschap altijd de juiste prospect bereikt.",
        primaryCta:   { label: "Start gratis proefperiode", href: "#" },
        secondaryCta: { label: "Bekijk demo van 2 min",     href: "#" },
        tag:          "Nu met AI-personalisatie",
      },
      { stockQuery: "modern saas dashboard analytics team office" },
      {
        new_visitor: {
          headline:    "See what intelligent personalisation can do",
          subheadline: "Thousands of B2B teams use us to make every visit count.",
          primaryCta:  { label: "Try it free", href: "#" },
        },
        high_intent: {
          headline:    "Ready to see results in 14 days?",
          subheadline: "Most customers see a 30 % lift in pipeline within two weeks.",
          primaryCta:  { label: "Get started now", href: "#" },
        },
        returning_visitor: {
          headline:    "Welcome back — pick up where you left off",
          subheadline: "Your personalisation playbook is waiting.",
          primaryCta:  { label: "Continue setup", href: "#" },
        },
        evening: {
          headline:    "Explore at your own pace",
          subheadline: "No sales calls needed. Browse docs, case studies, and pricing whenever you're ready.",
          primaryCta:  { label: "Browse resources", href: "#" },
        },
      },
    ),

    block(
      "stats-proof", "stats", "default",
      {
        heading: "Trusted by growth-stage B2B teams worldwide",
        items: [
          { value: "3.2×",    label: "Average pipeline lift" },
          { value: "94 %",    label: "Customer retention" },
          { value: "14 days", label: "Median time to first result" },
        ],
      },
      {
        heading: "Vertrouwd door groeibedrijven wereldwijd",
        items: [
          { value: "3,2×",    label: "Gemiddelde pipeline-groei" },
          { value: "94 %",    label: "Klantbehoud" },
          { value: "14 dagen",label: "Gemiddelde tijd tot eerste resultaat" },
        ],
      },
    ),

    block(
      "features-main", "features", "feature_grid_4up",
      {
        heading:    "Everything your sales team needs to convert",
        subheading: "From first touch to closed-won — every step, personalised.",
        items: [
          { icon: "lightning",   title: "Real-time decisioning",   description: "Serve the right block to every visitor based on intent, segment, and behaviour signals." },
          { icon: "chart",       title: "Pipeline analytics",      description: "Track which personalisation variants drive the most qualified leads and closed revenue." },
          { icon: "shield",      title: "GDPR-first architecture", description: "Cookie-free intent scoring and fully compliant visitor segmentation out of the box." },
          { icon: "integration", title: "CRM integrations",        description: "Connect HubSpot, Salesforce, Marketo, and 40+ more in minutes, no engineering needed." },
        ],
      },
      {
        heading:    "Alles wat je salesteam nodig heeft om te converteren",
        subheading: "Van eerste bezoek tot closed-won — elke stap gepersonaliseerd.",
        items: [
          { icon: "lightning",   title: "Realtime beslissingen",    description: "Serveer het juiste blok aan elke bezoeker op basis van intent, segment en gedragssignalen." },
          { icon: "chart",       title: "Pipeline-analytics",       description: "Volg welke varianten de meeste gekwalificeerde leads en omzet genereren." },
          { icon: "shield",      title: "GDPR-first architectuur",  description: "Cookie-vrije intentscoring en volledig conforme bezoekersegmentatie." },
          { icon: "integration", title: "CRM-integraties",          description: "Verbind HubSpot, Salesforce, Marketo en 40+ meer in minuten." },
        ],
      },
    ),

    block(
      "testimonials-main", "testimonials", "testimonial_highlight",
      {
        heading: "What our customers say",
        items: [
          { quote: "We saw a 40 % lift in demo bookings in the first month. Setup took a single afternoon.", author: "Sarah K.", role: "VP Marketing", company: "GrowthCo" },
          { quote: "Finally a tool that works with our existing CRM rather than replacing it.", author: "Markus L.", role: "Head of Sales", company: "Dealflow BV" },
          { quote: "The GDPR-first approach was the deciding factor for our legal team.", author: "Priya M.", role: "CTO", company: "ScaleStack" },
        ],
      },
      {
        heading: "Wat onze klanten zeggen",
        items: [
          { quote: "We zagen 40 % meer demo-boekingen in de eerste maand. De setup kostte één middag.", author: "Sarah K.", role: "VP Marketing", company: "GrowthCo" },
          { quote: "Eindelijk een tool die samenwerkt met ons bestaande CRM.", author: "Markus L.", role: "Head of Sales", company: "Dealflow BV" },
          { quote: "De GDPR-first aanpak was de doorslaggevende factor voor ons juridisch team.", author: "Priya M.", role: "CTO", company: "ScaleStack" },
        ],
      },
    ),

    block(
      "pricing-main", "pricing", "pricing_tiers",
      {
        heading:    "Simple, transparent pricing",
        subheading: "Start free. Scale when you need to.",
        tiers: [
          {
            name: "Starter", price: "Free", period: "forever",
            description: "Perfect for testing the platform.",
            features: ["Up to 1,000 visitors/month", "3 personalisation rules", "Basic analytics", "Email support"],
            ctaLabel: "Get started free", highlighted: false,
          },
          {
            name: "Growth", price: "€149", period: "/month",
            description: "For teams serious about pipeline.",
            features: ["Unlimited visitors", "Unlimited rules", "Advanced analytics", "CRM integrations", "Priority support"],
            ctaLabel: "Start 14-day trial", highlighted: true, badge: "Most popular",
          },
          {
            name: "Enterprise", price: "Custom", period: "",
            description: "For large teams with custom requirements.",
            features: ["Everything in Growth", "SSO & SCIM", "SLA guarantees", "Dedicated CSM", "Custom integrations"],
            ctaLabel: "Talk to sales", highlighted: false,
          },
        ],
      },
      {
        heading:    "Eenvoudige, transparante prijzen",
        subheading: "Start gratis. Schaal op wanneer nodig.",
        tiers: [
          {
            name: "Starter", price: "Gratis", period: "voor altijd",
            description: "Ideaal om te verkennen.",
            features: ["Tot 1.000 bezoekers/maand", "3 personalisatieregels", "Basisanalytics", "E-mailondersteuning"],
            ctaLabel: "Start gratis", highlighted: false,
          },
          {
            name: "Growth", price: "€149", period: "/maand",
            description: "Voor teams die serieus groeien.",
            features: ["Onbeperkt bezoekers", "Onbeperkt regels", "Geavanceerde analytics", "CRM-integraties", "Prioriteitsondersteuning"],
            ctaLabel: "Start 14-daagse proef", highlighted: true, badge: "Meest populair",
          },
          {
            name: "Enterprise", price: "Op maat", period: "",
            description: "Voor grote teams met maatwerkvereisten.",
            features: ["Alles uit Growth", "SSO & SCIM", "SLA-garanties", "Dedicated CSM", "Maatwerk-integraties"],
            ctaLabel: "Neem contact op", highlighted: false,
          },
        ],
      },
    ),

    block(
      "cta-main", "cta", "cta_split",
      {
        heading:      "Ready to personalise your pipeline?",
        body:         "Join 1,200+ B2B teams already using intelligent personalisation to close more deals.",
        primaryCta:   { label: "Start free trial", href: "#" },
        secondaryCta: { label: "Book a demo",      href: "#" },
        background:   "brand",
      },
      {
        heading:      "Klaar om je pipeline te personaliseren?",
        body:         "Sluit je aan bij 1.200+ B2B-teams die al intelligente personalisatie gebruiken.",
        primaryCta:   { label: "Start gratis proefperiode", href: "#" },
        secondaryCta: { label: "Plan een demo",             href: "#" },
        background:   "brand",
      },
      undefined,
      {
        high_intent: {
          heading:    "Let's get you set up today.",
          body:       "Your first personalisation campaign can be live within the hour.",
          primaryCta: { label: "Start now — it's free", href: "#" },
        },
        careers: {
          heading:    "Come build with us",
          body:       "We're a fast-moving team building the future of B2B personalisation.",
          primaryCta: { label: "View open roles", href: "#" },
        },
      },
    ),
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// SERVICES — Professional Services / Creative Agency
// ═════════════════════════════════════════════════════════════════════════════

export const SERVICES_PAGE_SPEC: DemoPageSpec = {
  slug:     "/",
  title:    "Homepage",
  template: "marketing-page",
  blocks: [
    block(
      "hero-main", "hero", "hero_default",
      {
        headline:     "Strategy, design, and execution that moves the needle",
        subheadline:  "We partner with ambitious brands to build digital experiences their customers actually want.",
        primaryCta:   { label: "See our work",   href: "#" },
        secondaryCta: { label: "Book a call",    href: "#" },
      },
      {
        headline:     "Strategie, design en executie die het verschil maken",
        subheadline:  "We werken samen met ambitieuze merken aan digitale ervaringen die hun klanten écht willen.",
        primaryCta:   { label: "Bekijk ons werk",  href: "#" },
        secondaryCta: { label: "Plan een gesprek", href: "#" },
      },
      { stockQuery: "creative agency studio modern design team presentation" },
      {
        new_visitor: {
          headline:    "Hello — welcome to our studio",
          subheadline: "We build websites, brands, and campaigns that convert.",
          primaryCta:  { label: "Explore our work", href: "#" },
        },
        high_intent: {
          headline:    "Let's build something great together",
          subheadline: "Tell us about your project and we'll have a proposal within 48 hours.",
          primaryCta:  { label: "Start your brief", href: "#" },
        },
      },
    ),

    block(
      "stats-proof", "stats", "default",
      {
        items: [
          { value: "120+",    label: "Projects delivered" },
          { value: "8 years", label: "In business" },
          { value: "4.9/5",   label: "Client satisfaction" },
        ],
      },
      {
        items: [
          { value: "120+",    label: "Projecten opgeleverd" },
          { value: "8 jaar",  label: "Actief in het vak" },
          { value: "4,9/5",   label: "Klanttevredenheid" },
        ],
      },
    ),

    block(
      "features-services", "features", "feature_grid_3up",
      {
        heading: "Our services",
        items: [
          { icon: "palette",    title: "Brand & identity",   description: "Logo, visual system, and brand guidelines that work across every touchpoint." },
          { icon: "code",       title: "Web design & build", description: "Performance-first websites on a headless CMS stack — fast, flexible, and scalable." },
          { icon: "megaphone",  title: "Growth marketing",   description: "SEO, paid media, and conversion optimisation tied directly to revenue metrics." },
        ],
      },
      {
        heading: "Onze diensten",
        items: [
          { icon: "palette",   title: "Merk & identiteit",  description: "Logo, visueel systeem en merkrichtlijnen die werken op elk touchpoint." },
          { icon: "code",      title: "Webdesign & -bouw",  description: "Performance-first websites op een headless CMS-stack — snel, flexibel en schaalbaar." },
          { icon: "megaphone", title: "Groeimarketing",     description: "SEO, betaalde media en conversieverbetering direct gekoppeld aan omzetmetrics." },
        ],
      },
    ),

    block(
      "case-feature", "case_highlight", "default",
      {
        client:    "A leading fintech scale-up",
        challenge: "Needed a complete brand refresh and website to support Series B fundraising.",
        outcome:   "Launched new brand and site in 8 weeks. Conversion rate improved by 62 %.",
        metrics:   [{ label: "Conversion lift", value: "+62 %" }, { label: "Delivery time", value: "8 weeks" }],
        ctaLabel:  "Read the full case study",
      },
      {
        client:    "Een toonaangevende fintech scale-up",
        challenge: "Had een complete merkvernieuwing en website nodig voor Series B-fondsenwerving.",
        outcome:   "Nieuw merk en site gelanceerd in 8 weken. Conversieratio verbeterd met 62 %.",
        metrics:   [{ label: "Conversiegroei", value: "+62 %" }, { label: "Doorlooptijd", value: "8 weken" }],
        ctaLabel:  "Lees de volledige case study",
      },
      { stockQuery: "fintech startup branding office laptop presentation" },
    ),

    block(
      "process-main", "process", "default",
      {
        heading: "How we work",
        steps: [
          { title: "Discovery",   description: "We audit your current position and align on measurable goals for the project.", duration: "Week 1" },
          { title: "Strategy",    description: "We translate goals into a clear creative and technical brief.", duration: "Week 2" },
          { title: "Design",      description: "Rapid prototyping and design iterations with weekly client reviews.", duration: "Weeks 3–5" },
          { title: "Build",       description: "Development against the approved designs with automated testing.", duration: "Weeks 6–8" },
          { title: "Launch",      description: "QA, performance audit, and handover — with 30 days post-launch support.", duration: "Week 9" },
        ],
      },
      {
        heading: "Hoe wij werken",
        steps: [
          { title: "Discovery",   description: "We auditen je huidige positie en stemmen af op meetbare doelen.", duration: "Week 1" },
          { title: "Strategie",   description: "We vertalen doelen naar een heldere creatieve en technische briefing.", duration: "Week 2" },
          { title: "Design",      description: "Snelle prototyping en designiteraties met wekelijkse klantreviews.", duration: "Week 3–5" },
          { title: "Bouw",        description: "Ontwikkeling op basis van goedgekeurde designs met geautomatiseerde tests.", duration: "Week 6–8" },
          { title: "Lancering",   description: "QA, performance-audit en overdracht — met 30 dagen post-launch support.", duration: "Week 9" },
        ],
      },
    ),

    block(
      "cta-main", "cta", "cta_card",
      {
        heading:      "Got a project in mind?",
        body:         "Drop us a brief and we'll respond within one business day.",
        primaryCta:   { label: "Start a project", href: "#" },
        secondaryCta: { label: "See pricing",     href: "#" },
        background:   "brand",
      },
      {
        heading:      "Een project in gedachten?",
        body:         "Stuur ons een briefing en we reageren binnen één werkdag.",
        primaryCta:   { label: "Start een project", href: "#" },
        secondaryCta: { label: "Bekijk tarieven",   href: "#" },
        background:   "brand",
      },
    ),
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// RECRUITMENT — Talent & Staffing Platform
// ═════════════════════════════════════════════════════════════════════════════

export const RECRUITMENT_PAGE_SPEC: DemoPageSpec = {
  slug:     "/",
  title:    "Homepage",
  template: "marketing-page",
  blocks: [
    block(
      "hero-main", "hero", "hero_proof",
      {
        headline:     "Find your next great hire in half the time",
        subheadline:  "Our talent platform combines AI matching, structured interviews, and compliant offer management — all in one workflow.",
        primaryCta:   { label: "Post a vacancy",   href: "#" },
        secondaryCta: { label: "See how it works", href: "#" },
      },
      {
        headline:     "Vind je volgende topkandidaat in half de tijd",
        subheadline:  "Ons talentplatform combineert AI-matching, gestructureerde interviews en compliant aanbiedbeheer — in één workflow.",
        primaryCta:   { label: "Vacature plaatsen",   href: "#" },
        secondaryCta: { label: "Bekijk hoe het werkt", href: "#" },
      },
      { stockQuery: "professional confident business person interview hiring" },
      {
        careers: {
          headline:    "We're hiring — join a fast-growing team",
          subheadline: "Help us reshape how companies find and hire the best talent.",
          primaryCta:  { label: "View open roles", href: "#" },
        },
        high_intent: {
          headline:    "Ready to close your open roles?",
          subheadline: "Start a free trial and post your first vacancy in under 5 minutes.",
          primaryCta:  { label: "Start free trial", href: "#" },
        },
      },
    ),

    block(
      "stats-proof", "stats", "default",
      {
        items: [
          { value: "2.4×",  label: "Faster time-to-hire" },
          { value: "89 %",  label: "Offer acceptance rate" },
          { value: "50 k+", label: "Active candidates" },
        ],
      },
      {
        items: [
          { value: "2,4×",  label: "Sneller time-to-hire" },
          { value: "89 %",  label: "Aanbodacceptatiepercentage" },
          { value: "50k+",  label: "Actieve kandidaten" },
        ],
      },
    ),

    block(
      "features-main", "features", "feature_grid_4up",
      {
        heading: "Everything you need to hire better",
        items: [
          { icon: "search",       title: "AI candidate matching",  description: "Rank applicants by fit score based on skills, experience, and culture signals." },
          { icon: "calendar",     title: "Interview scheduling",   description: "Automated scheduling syncs with everyone's calendars — no more back-and-forth." },
          { icon: "file",         title: "Structured assessments", description: "Customisable scorecards and competency frameworks built for every role type." },
          { icon: "check-circle", title: "Compliant offer letters",description: "Generate and send legally reviewed offer letters in 60 seconds." },
        ],
      },
      {
        heading: "Alles wat je nodig hebt om beter te werven",
        items: [
          { icon: "search",       title: "AI-kandidaatmatching",    description: "Rangschik sollicitanten op fit-score op basis van vaardigheden en cultuursignalen." },
          { icon: "calendar",     title: "Interview-planning",      description: "Geautomatiseerde planning synchroniseert met ieders agenda." },
          { icon: "file",         title: "Gestructureerde assessments", description: "Aanpasbare scorecards voor elk functietype." },
          { icon: "check-circle", title: "Conforme aanbiedbrieven", description: "Genereer en verstuur juridisch getoetste aanbiedbrieven in 60 seconden." },
        ],
      },
    ),

    block(
      "careers-section", "careers", "content_default",
      {
        heading:  "Join our team",
        eyebrow:  "We're hiring",
        body:     "We're a distributed team building tools that make hiring more human. We value autonomy, transparency, and the belief that great teams change everything.",
        roles: [
          { title: "Senior Full-Stack Engineer", department: "Engineering", location: "Remote (EU)" },
          { title: "Product Designer",           department: "Design",       location: "Amsterdam" },
          { title: "Customer Success Manager",   department: "Success",      location: "Remote (EU)" },
        ],
        ctaLabel: "View all open roles",
      },
      {
        heading:  "Sluit je bij ons aan",
        eyebrow:  "We zijn aan het werven",
        body:     "We zijn een gedistribueerd team dat tools bouwt die werving menselijker maken. We waarderen autonomie, transparantie en geweldige teams.",
        roles: [
          { title: "Senior Full-Stack Engineer", department: "Engineering", location: "Remote (EU)" },
          { title: "Product Designer",           department: "Design",       location: "Amsterdam" },
          { title: "Customer Success Manager",   department: "Success",      location: "Remote (EU)" },
        ],
        ctaLabel: "Bekijk alle openstaande functies",
      },
    ),

    block(
      "cta-main", "cta", "cta_banner",
      {
        heading:      "Post your first vacancy today",
        body:         "Free for the first 30 days. No credit card required.",
        primaryCta:   { label: "Get started free", href: "#" },
        secondaryCta: { label: "Talk to sales",    href: "#" },
        background:   "brand",
      },
      {
        heading:      "Plaats vandaag je eerste vacature",
        body:         "Gratis de eerste 30 dagen. Geen creditcard nodig.",
        primaryCta:   { label: "Start gratis",    href: "#" },
        secondaryCta: { label: "Praat met sales", href: "#" },
        background:   "brand",
      },
    ),
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// COMMERCE — eCommerce / Online Retail
// ═════════════════════════════════════════════════════════════════════════════

export const COMMERCE_PAGE_SPEC: DemoPageSpec = {
  slug:     "/",
  title:    "Homepage",
  template: "marketing-page",
  blocks: [
    block(
      "hero-main", "hero", "hero_background",
      {
        headline:     "Style that speaks for itself",
        subheadline:  "Discover the new collection — free shipping on all orders above €75.",
        primaryCta:   { label: "Shop new arrivals",   href: "#" },
        secondaryCta: { label: "Explore collections", href: "#" },
      },
      {
        headline:     "Stijl die voor zichzelf spreekt",
        subheadline:  "Ontdek de nieuwe collectie — gratis verzending op alle bestellingen boven €75.",
        primaryCta:   { label: "Shop nieuwe arrivals", href: "#" },
        secondaryCta: { label: "Verken collecties",    href: "#" },
      },
      { stockQuery: "fashion lifestyle product photography editorial", aspectRatio: "16:9" },
    ),

    block(
      "features-usp", "features", "feature_grid_checklist",
      {
        items: [
          { icon: "truck",      title: "Free shipping over €75",  description: "Fast, tracked delivery — always free when you spend €75 or more." },
          { icon: "rotate-ccw", title: "30-day free returns",     description: "Changed your mind? Free returns within 30 days, no questions asked." },
          { icon: "shield",     title: "Secure checkout",         description: "Encrypted payments via iDEAL, Mastercard, and PayPal." },
          { icon: "star",       title: "Loyalty rewards",         description: "Earn points on every order. Redeem for discounts on future purchases." },
        ],
      },
      {
        items: [
          { icon: "truck",      title: "Gratis verzending boven €75",  description: "Snelle, getraceerde levering — altijd gratis bij besteding van €75 of meer." },
          { icon: "rotate-ccw", title: "30 dagen gratis retourneren",  description: "Van gedachten veranderd? Geen probleem. Gratis retour binnen 30 dagen." },
          { icon: "shield",     title: "Veilig afrekenen",             description: "Versleuteld betalen via iDEAL, Mastercard en PayPal." },
          { icon: "star",       title: "Loyaliteitsbeloningen",        description: "Spaar punten bij elke bestelling en wissel ze in voor kortingen." },
        ],
      },
    ),

    block(
      "stats-proof", "stats", "compact",
      {
        items: [
          { value: "50 k+",    label: "Happy customers" },
          { value: "4.8 ★",    label: "Average review" },
          { value: "< 3 days", label: "Average delivery" },
        ],
      },
      {
        items: [
          { value: "50k+",     label: "Tevreden klanten" },
          { value: "4,8 ★",    label: "Gemiddelde beoordeling" },
          { value: "< 3 dagen",label: "Gemiddelde levering" },
        ],
      },
    ),

    block(
      "testimonials-main", "testimonials", "testimonial_grid",
      {
        heading: "What our customers are saying",
        items: [
          { quote: "Absolutely love the quality. My order arrived in two days and the packaging was beautiful.", author: "Emma V.", company: "Amsterdam" },
          { quote: "The return process was effortless — the new item arrived before I'd posted the return.", author: "Jonas R.", company: "Berlin" },
          { quote: "Best customer service from an online shop. They went above and beyond.", author: "Claire D.", company: "Brussels" },
        ],
      },
      {
        heading: "Wat onze klanten zeggen",
        items: [
          { quote: "Absoluut van de kwaliteit. Mijn bestelling arriveerde in twee dagen in prachtige verpakking.", author: "Emma V.", company: "Amsterdam" },
          { quote: "Het retourproces was moeiteloos — het nieuwe artikel arriveerde sneller dan mijn retour.", author: "Jonas R.", company: "Berlijn" },
          { quote: "Beste klantenservice van een webwinkel die ik ooit heb gehad.", author: "Claire D.", company: "Brussel" },
        ],
      },
    ),

    block(
      "cta-main", "cta", "cta_banner_default",
      {
        heading:      "New arrivals just dropped",
        body:         "The summer collection is here. Free shipping on your first order with code SUMMER25.",
        primaryCta:   { label: "Shop now",          href: "#" },
        secondaryCta: { label: "See the lookbook",  href: "#" },
        background:   "brand",
      },
      {
        heading:      "Nieuwe arrivals zijn er",
        body:         "De zomercollectie is beschikbaar. Gratis verzending op je eerste bestelling met code ZOMER25.",
        primaryCta:   { label: "Shop nu",              href: "#" },
        secondaryCta: { label: "Bekijk het lookbook",  href: "#" },
        background:   "brand",
      },
    ),
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// REAL ESTATE — Property Agency
// ═════════════════════════════════════════════════════════════════════════════

export const REAL_ESTATE_PAGE_SPEC: DemoPageSpec = {
  slug:     "/",
  title:    "Homepage",
  template: "marketing-page",
  blocks: [
    block(
      "hero-main", "hero", "hero_background",
      {
        headline:     "Find a home you'll love for life",
        subheadline:  "Hundreds of verified listings across the Netherlands. Expert guidance from first viewing to final handover.",
        primaryCta:   { label: "Browse properties", href: "#" },
        secondaryCta: { label: "Speak to an agent", href: "#" },
      },
      {
        headline:     "Vind een huis waar je van houdt",
        subheadline:  "Honderden geverifieerde woningen in heel Nederland. Deskundige begeleiding van eerste bezichtiging tot sleuteloverdracht.",
        primaryCta:   { label: "Bekijk woningen",       href: "#" },
        secondaryCta: { label: "Praat met een makelaar", href: "#" },
      },
      { stockQuery: "modern house architecture property interior design", aspectRatio: "16:9" },
      {
        new_visitor: {
          headline:    "Start your search with a team you can trust",
          subheadline: "We've helped 1,400+ families find their perfect home.",
          primaryCta:  { label: "Browse listings", href: "#" },
        },
        high_intent: {
          headline:    "Ready to take the next step?",
          subheadline: "Speak to one of our agents today — no obligation, no pressure.",
          primaryCta:  { label: "Book a free call", href: "#" },
        },
      },
    ),

    block(
      "features-services", "features", "feature_grid_3up",
      {
        heading: "How we help you find the right property",
        items: [
          { icon: "search", title: "Curated listings",        description: "Every property is personally verified — no off-market surprises." },
          { icon: "users",  title: "Dedicated agent support", description: "One point of contact who knows your criteria and brings you options proactively." },
          { icon: "key",    title: "End-to-end guidance",     description: "From mortgage advice to notary coordination — we handle the complexity." },
        ],
      },
      {
        heading: "Hoe we je helpen de juiste woning te vinden",
        items: [
          { icon: "search", title: "Gecureerde woningen",         description: "Elke woning wordt persoonlijk geverifieerd — geen verrassingen." },
          { icon: "users",  title: "Vaste makelaarsbegeleiding",  description: "Eén vast aanspreekpunt dat je criteria kent en opties proactief aandraagt." },
          { icon: "key",    title: "Alles onder één dak",         description: "Van hypotheekadvies tot notariscoördinatie — wij regelen de complexiteit." },
        ],
      },
    ),

    block(
      "stats-proof", "stats", "default",
      {
        items: [
          { value: "1,400+", label: "Properties sold" },
          { value: "98 %",   label: "Client satisfaction" },
          { value: "€0",     label: "Hidden fees" },
        ],
      },
      {
        items: [
          { value: "1.400+", label: "Verkochte woningen" },
          { value: "98 %",   label: "Klanttevredenheid" },
          { value: "€0",     label: "Verborgen kosten" },
        ],
      },
    ),

    block(
      "testimonials-main", "testimonials", "testimonial_single",
      {
        heading: "Trusted by hundreds of homebuyers",
        items: [
          { quote: "We found our dream home in six weeks. Our agent was patient, thorough, and always available. I'd recommend them to anyone.", author: "Peter & Anna M.", company: "Utrecht" },
        ],
      },
      {
        heading: "Vertrouwd door honderden woningzoekers",
        items: [
          { quote: "We vonden ons droomhuis in zes weken. Onze makelaar was geduldig, grondig en altijd beschikbaar. Ik beveel ze iedereen aan.", author: "Peter & Anna M.", company: "Utrecht" },
        ],
      },
    ),

    block(
      "contact-main", "contact", "contact_split",
      {
        heading:     "Talk to a local property expert",
        description: "We cover Amsterdam, Rotterdam, Utrecht, and The Hague. Drop us a message or call directly.",
        email:       "hello@example.com",
        phone:       "+31 20 123 4567",
        address:     "Keizersgracht 123, 1015 CJ Amsterdam",
        hours:       "Mon–Fri 09:00–18:00",
        ctas:        [{ label: "Send a message", href: "#" }],
      },
      {
        heading:     "Praat met een lokale vastgoedexpert",
        description: "We zijn actief in Amsterdam, Rotterdam, Utrecht en Den Haag.",
        email:       "hallo@example.com",
        phone:       "+31 20 123 4567",
        address:     "Keizersgracht 123, 1015 CJ Amsterdam",
        hours:       "Ma–Vr 09:00–18:00",
        ctas:        [{ label: "Stuur een bericht", href: "#" }],
      },
    ),

    block(
      "cta-main", "cta", "cta_card",
      {
        heading:      "Ready to start your search?",
        body:         "Browse current listings or register to be first to hear about new properties matching your criteria.",
        primaryCta:   { label: "Browse properties",  href: "#" },
        secondaryCta: { label: "Register interest",  href: "#" },
        background:   "brand",
      },
      {
        heading:      "Klaar om te zoeken?",
        body:         "Bekijk onze woningen of registreer je om als eerste te horen over nieuwe woningen.",
        primaryCta:   { label: "Bekijk woningen",       href: "#" },
        secondaryCta: { label: "Registreer interesse",  href: "#" },
        background:   "brand",
      },
    ),
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// REGISTRY
// ═════════════════════════════════════════════════════════════════════════════

export type DefaultBlockSetKey =
  | "saas"
  | "services"
  | "recruitment"
  | "commerce"
  | "real_estate";

/** Complete registry of default block sets keyed by site type */
export const DEFAULT_BLOCK_SETS: Record<DefaultBlockSetKey, DemoPageSpec> = {
  saas:        SAAS_PAGE_SPEC,
  services:    SERVICES_PAGE_SPEC,
  recruitment: RECRUITMENT_PAGE_SPEC,
  commerce:    COMMERCE_PAGE_SPEC,
  real_estate: REAL_ESTATE_PAGE_SPEC,
} as const;

/**
 * Map a SiteCategory to the closest DefaultBlockSetKey and return its DemoPageSpec.
 *
 * Used as the template fallback by the content generator when:
 *   - ANTHROPIC_API_KEY is absent
 *   - AI generation fails or times out
 *   - The AI response fails contract validation
 *
 * The calling code replaces headline/CTA/proof text with AI-generated copy
 * (or analysis-derived copy) before passing the result to the mapper.
 */
export function getDefaultBlockSet(category: SiteCategory | string): DemoPageSpec {
  const MAP: Record<string, DefaultBlockSetKey> = {
    b2b_saas:    "saas",
    agency:      "services",
    recruitment: "recruitment",
    ecommerce:   "commerce",
    general:     "services",
  };
  const key = MAP[category] ?? "services";
  return DEFAULT_BLOCK_SETS[key];
}
