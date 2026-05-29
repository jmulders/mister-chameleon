/**
 * Marketing Site Variants — Mister Chameleon Tenant
 *
 * All adaptive content variant documents for the mister-chameleon tenant.
 * These are NOT shared platform documents — every document carries
 * `tenantId: "mister-chameleon"` so they are scoped exclusively to this site.
 *
 * ─── ID convention ────────────────────────────────────────────────────────────
 *
 *   Sanity `_id`:  "mister-chameleon_{variantKey}"
 *     e.g. "mister-chameleon_hero_direct_brand"
 *
 *   The `key` field stays clean (e.g. "hero_direct_brand") — this is the value
 *   the decision engine and contextConfig reference.  GROQ resolves the correct
 *   document by filtering on `tenantId == "mister-chameleon"` first, then
 *   falling back to shared documents (!defined(tenantId)) if absent.
 *
 *   Because every document here has an explicit tenantId, they are never
 *   returned for queries scoped to other tenants, and other tenants can define
 *   their own variants with the same key names without conflict.
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   1. Tenant-specific (tenantId == "mister-chameleon")  — this file
 *   2. Shared/platform (!defined(tenantId))              — last resort fallback
 *
 * ─── What is seeded ───────────────────────────────────────────────────────────
 *
 *   Hero variants
 *     hero_default                   Generic fallback — works for all traffic sources
 *     hero_google_problem            Problem-aware copy for Google traffic
 *     hero_linkedin_vision           Vision-forward copy for LinkedIn traffic
 *     hero_direct_brand              Brand clarity — fallback for awareness, form-dropoff, expansion, default
 *     hero_consideration             Returning / consideration / high-engagement visitors
 *     hero_intent_direct             High-intent and trial-ready visitors
 *     hero_customer_onboarding       Newly converted customers entering onboarding
 *     hero_saas_default              First-time SaaS-context visitor
 *     hero_saas_consideration        SaaS visitor in consideration — evaluated pricing/features
 *     hero_saas_intent               SaaS visitor with strong purchase intent
 *     hero_saas_trial                Visitor who has started or is close to a free trial
 *     hero_saas_customer_onboarding  Newly converted SaaS customer entering onboarding
 *     hero_careers_default           First-time careers visitor
 *     hero_careers_job_match         Visitor who browsed the job listing
 *     hero_careers_high_intent       Viewed a role detail AND clicked apply
 *     hero_careers_reassurance       Application drop-off or submitted
 *
 *   Page banner variants (hero_page_banner_*)
 *     hero_page_banner               Generic fallback (legal, changelog, docs pages)
 *     hero_page_banner_awareness      Visitor-adaptive: awareness / default fallback
 *     hero_page_banner_consideration  Visitor-adaptive: consideration funnel stage
 *     hero_page_banner_high_intent    Visitor-adaptive: high-intent funnel stage
 *     hero_page_banner_returning      Visitor-adaptive: returning visitor
 *     hero_page_banner_enterprise     Visitor-adaptive: enterprise / customer expansion signal
 *     hero_page_banner_friction       Visitor-adaptive: form drop-off recovery
 *
 *   Proof variants
 *     proof_default               Broad credibility for new visitors
 *     proof_cases                 Concrete case studies and ROI numbers
 *     proof_vision                Analyst quotes and industry recognition
 *     proof_platform              Platform scale and reliability stats
 *     proof_stats                 Hard numbers for high-intent buyers
 *     proof_reassurance           Safety and social proof for friction/doubt
 *     proof_saas_default          SaaS-audience general credibility
 *     proof_saas_consideration    Why SaaS teams choose Mister Chameleon over DIY
 *     proof_saas_intent           High-intent conversion-focused proof
 *     proof_saas_reassurance      Privacy, uptime, and no lock-in reassurance
 *     proof_careers_default       Employer brand proof for careers visitors
 *     proof_careers_team          Team quality for role-interested visitors
 *     proof_careers_reassurance   Fair hiring process for drop-off visitors
 *
 *   CTA variants
 *     cta_default             Generic fallback — works for all visitors
 *     cta_guide               Low-friction nurture: free playbook download
 *     cta_platform            Product-led: start for free
 *     cta_meeting             Sales-led: book a demo
 *     cta_demo                Consideration-stage: see it in action
 *     cta_onboarding          Newly converted customers: first value fast
 *     cta_expansion           Active customers revisiting pricing
 *     cta_saas_default        SaaS-audience generic CTA
 *     cta_saas_demo           SaaS consideration: personalised demo offer
 *     cta_saas_trial          SaaS trial-ready: low-friction signup nudge
 *     cta_saas_onboarding     SaaS newly converted: activate first experience
 *     cta_saas_expansion      SaaS active customers: upgrade prompt
 *     cta_careers_browse      Careers visitors: no specific role interest yet
 *     cta_careers_apply       High-intent candidates: viewed a role and clicked apply
 *     cta_careers_open        Application drop-off: open application path
 *     cta_careers_contact     Post-conversion: application received
 *
 *   Feature variants
 *     feature_core            Core platform capabilities overview
 *     feature_grid_primary    Full 6-item grid
 *     feature_highlights      Three key differentiators (alternating layout)
 *     feature_comparison      Side-by-side comparison table
 *
 *   Conversion variants
 *     conversion_signup       Product-led account creation entry point
 *     conversion_demo         Sales-led: book a screen-share
 *     conversion_contact      Open channel: human contact over automation
 */

// ── Tenant constant ────────────────────────────────────────────────────────────

const TENANT = "mister-chameleon";

/** Stable Sanity _id for a mister-chameleon variant document */
function variantId(key: string): string {
  return `${TENANT}_${key}`;
}

// ── Variant documents ──────────────────────────────────────────────────────────

export const marketingSiteVariants = [

  // ── Hero variants ─────────────────────────────────────────────────────────

  /**
   * hero_google_problem
   * Audience: searchers who typed a problem into Google.
   * Framing:  Urgency. Name the pain before offering the solution.
   */
  {
    _id:      variantId("hero_google_problem"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_google_problem",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Google Search \u2014 Problem Aware",
      decisionSummary: "Urgency-led copy for search visitors who typed a problem keyword. Names the pain before offering the solution.",
      intendedAudience: "Visitors arriving from Google organic or paid search who searched a pain-specific query.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google"],
      tone: "direct",
      primaryGoal: "Mirror the searcher's pain to capture attention, then drive them to the how-it-works page.",
    },
    sourceTags: ["google-organic", "google-paid"],
    stageTags: ["Awareness", "Consideration"],
    tag:      "Stop sending every visitor to the same page",
    title:    "Your website speaks to no one. {{company_short}} deserves better.",
    subtitle:
      "Most visitors leave because your homepage wasn't written for them. " +
      "Mister Chameleon detects where they came from — including visitors from " +
      "{{company_short}} — and instantly serves the version of your site that converts.",
    ctas: [
      { _key: "cta-google-1", label: "See how it works", href: "/how-it-works", variant: "primary" },
    ],
  },

  /**
   * hero_linkedin_vision
   * Audience: professionals scrolling a thought-leadership feed.
   * Framing:  Vision. Speak to where the industry is going, not the pain.
   */
  {
    _id:      variantId("hero_linkedin_vision"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_linkedin_vision",
    isActive: true,
    decisionMeta: {
      decisionLabel: "LinkedIn \u2014 Vision Forward",
      decisionSummary: "Aspirational copy for professionals scrolling a thought-leadership feed. Speaks to where the industry is going.",
      intendedAudience: "Professionals who clicked through from a LinkedIn post, ad, or shared article.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["linkedin"],
      tone: "inspiring",
      primaryGoal: "Establish thought-leadership and brand credibility for LinkedIn-sourced professionals.",
      supportingGoals: ["Drive engagement to the platform or use-case pages"],
    },
    sourceTags: ["linkedin"],
    stageTags: ["Awareness"],
    tag:      "The future of {{industry}} websites is contextual",
    title:    "Your website, ever-adapting.",
    subtitle:
      "Mister Chameleon is the platform for {{industry}} growth teams who believe " +
      "personalisation shouldn't require an engineering sprint, a data science team, " +
      "or a six-figure enterprise contract. You found us via {{source}} — now see what we do.",
    ctas: [
      { _key: "cta-li-1", label: "Explore the platform", href: "/platform", variant: "primary" },
    ],
  },

  /**
   * hero_direct_brand
   * Audience: typed URL, bookmark, or dark social - intent unknown.
   * Framing:  Brand clarity. Lead with the core value proposition.
   * Also used as the last-resort FALLBACK_PLAN heroKey.
   */
  {
    _id:           variantId("hero_direct_brand"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_direct_brand",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Direct \u2014 Brand Clarity Fallback",
      decisionSummary: "Brand clarity copy for typed-URL or dark-social visitors. Leads with the core value prop. Also used as the ultimate fallback variant.",
      intendedAudience: "Visitors arriving via typed URL, bookmark, or dark social with unknown source.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Communicate the core value proposition clearly to visitors with no detectable source signal.",
      exclusions: ["Do not show to known customers — use hero_customer_onboarding instead."],
    },
    sourceTags: ["direct"],
    stageTags: ["Awareness", "Consideration"],
    layoutVariant: "hero_background",
    contentAlign:  "center",
    tag:           "Adaptive websites, without the complexity",
    title:         "Your website, tailored to every visitor.",
    subtitle:
      "Mister Chameleon delivers the right message to the right person - automatically. " +
      "No A/B testing required. No engineering sprints. No excuses.",
    ctas: [
      { _key: "cta-direct-1", label: "Start for free",   href: "/signup",        variant: "primary"   },
      { _key: "cta-direct-2", label: "See how it works", href: "/how-it-works",  variant: "secondary" },
    ],
    media: {
      mediaType:   "video",
      videoSource: "youtube",
      videoId:     "ioblgpA5eTo",
    },
  },

  /**
   * hero_consideration
   * Audience: returning visitors in consideration stage (multiple sessions, no conversion).
   * Framing:  Re-engagement. Acknowledge their familiarity, deepen the value pitch.
   */
  {
    _id:      variantId("hero_consideration"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_consideration",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Returning Visitor \u2014 Consideration Re-engagement",
      decisionSummary: "Re-engagement copy for returning visitors in consideration. Acknowledges their familiarity and deepens the value pitch.",
      intendedAudience: "Returning visitors who have explored the platform across multiple sessions without converting.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "linkedin", "unknown"],
      tone: "persuasive",
      primaryGoal: "Break through evaluation paralysis by making getting started feel concrete and fast.",
      supportingGoals: ["Drive demo bookings", "Surface case studies"],
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    tag:      "You've seen what we do for {{industry}} teams. Here's why it works.",
    title:    "More visits shouldn't mean more confusion.",
    subtitle:
      "You've explored the platform. The question isn't whether adaptive websites work — " +
      "it's how quickly {{company_short}} can get one live. Most teams do it in an afternoon.",
    ctas: [
      { _key: "cta-con-1", label: "Book a quick demo",  href: "/demo",    variant: "primary"   },
      { _key: "cta-con-2", label: "See live examples",  href: "/cases",   variant: "secondary" },
    ],
  },

  /**
   * hero_intent_direct
   * Audience: pricing visitors, trial-ready, high-intent visitors (intent >= 50).
   * Framing:  Directness. Mirror their intent with urgency and specificity.
   */
  {
    _id:      variantId("hero_intent_direct"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_intent_direct",
    isActive: true,
    decisionMeta: {
      decisionLabel: "High Intent \u2014 Direct Conversion Push",
      decisionSummary: "Direct, urgency-led copy for pricing-page visitors and trial-ready visitors with intent score \u2265 50.",
      intendedAudience: "Visitors who have visited the pricing page, started a trial, or accumulated high intent signals in the current session.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert high-intent visitors to trial signup or sales conversation.",
      exclusions: ["Do not show to visitors with friction score ≥ 60 — use a lower-pressure variant instead."],
    },
    sourceTags: ["google-organic", "google-paid", "direct"],
    stageTags: ["Decision"],
    tag:      "{{company_short}}: your next experiment is already waiting",
    title:    "High intent deserves a high-impact message.",
    subtitle:
      "Visitors from {{company_short}} convert when the message matches the moment. " +
      "Mister Chameleon identifies them automatically and shows exactly the right version " +
      "of your site — no A/B test setup, no engineering ticket.",
    ctas: [
      { _key: "cta-int-1", label: "Start your free trial", href: "/signup", variant: "primary"   },
      { _key: "cta-int-2", label: "Talk to sales",         href: "/demo",   variant: "secondary" },
    ],
  },

  /**
   * hero_customer_onboarding
   * Audience: newly converted customers entering onboarding, or active customers
   *           revisiting pricing (expansion signal).
   * Framing:  Welcome and momentum. Celebrate the conversion, drive first value.
   */
  {
    _id:      variantId("hero_customer_onboarding"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_customer_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Post-Conversion \u2014 Onboarding Welcome",
      decisionSummary: "Welcome and momentum copy for newly converted customers or active customers revisiting pricing.",
      intendedAudience: "Visitors who have submitted a form (customer funnel stage) or active customers returning to the pricing page.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "google", "linkedin", "unknown"],
      tone: "direct",
      primaryGoal: "Drive immediate first-value activation \u2014 connect domain, define first rules, go live.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    tag:      "You're in - let's ship your first experience",
    title:    "Welcome to Mister Chameleon. Your engine is ready.",
    subtitle:
      "Connect your domain, define your first two rules, and your adaptive homepage " +
      "goes live in minutes. No engineering sprint. No waiting.",
    ctas: [
      { _key: "cta-onb-1", label: "Open the quick-start guide", href: "/docs/quickstart", variant: "primary" },
    ],
  },

  /**
   * hero_default
   * Audience: any visitor where no more specific variant matches.
   * Framing:  Generic value proposition — works for all traffic sources.
   * This is the ultimate fallback across all blueprints.
   */
  {
    _id:      variantId("hero_default"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Default \u2014 Generic Value Proposition",
      decisionSummary: "Generic value prop fallback. Works for all traffic sources when no more specific variant matches.",
      intendedAudience: "Any visitor where no more specific variant matches based on source, stage, or intent signals.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration", "decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Communicate the platform's core benefit clearly to any unqualified visitor.",
    },
    sourceTags: ["google-organic", "google-paid", "linkedin", "direct"],
    stageTags: ["Awareness", "Consideration"],
    tag:      "Adaptive websites that convert",
    title:    "Your website, personalised for every visitor.",
    subtitle:
      "Mister Chameleon detects who's visiting and automatically serves the version " +
      "of your site that converts them — without A/B tests, engineering sprints, or guesswork.",
    ctas: [
      { _key: "cta-def-1", label: "Start for free",   href: "/signup",       variant: "primary"   },
      { _key: "cta-def-2", label: "See how it works", href: "/how-it-works", variant: "secondary" },
    ],
  },

  // ── B2B SaaS hero variants ────────────────────────────────────────────────

  /**
   * hero_saas_default
   * Audience: first-time SaaS-context visitor with no further qualification.
   * Framing:  Product-led clarity. Lead with the core SaaS value prop.
   */
  {
    _id:      variantId("hero_saas_default"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_saas_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "B2B SaaS \u2014 First Visit Default",
      decisionSummary: "Product-led clarity for first-time SaaS-context visitors. Leads with the core SaaS value prop.",
      intendedAudience: "First-time visitors in a SaaS industry context with no further qualification signal.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Drive SaaS visitors to start a free trial or watch a live example.",
    },
    sourceTags: ["google-organic", "google-paid", "linkedin"],
    stageTags: ["Awareness"],
    tag:      "The personalisation platform for SaaS growth teams",
    title:    "Turn one homepage into a hundred — automatically.",
    subtitle:
      "Mister Chameleon lets SaaS teams serve the right hero, proof, and CTA to every " +
      "visitor segment without touching the codebase. Connect, configure, ship — same afternoon.",
    ctas: [
      { _key: "cta-sdef-1", label: "Start free trial",    href: "/signup", variant: "primary"   },
      { _key: "cta-sdef-2", label: "See a live example",  href: "/demo",   variant: "secondary" },
    ],
  },

  /**
   * hero_saas_consideration
   * Audience: SaaS visitor in consideration — multiple sessions, evaluated pricing/features.
   * Framing:  Deepen the value, address the objections, reduce friction to trial.
   */
  {
    _id:      variantId("hero_saas_consideration"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_saas_consideration",
    isActive: true,
    decisionMeta: {
      decisionLabel: "B2B SaaS \u2014 Consideration Stage",
      decisionSummary: "Deepen the value pitch for SaaS visitors who have had multiple sessions and evaluated pricing/features.",
      intendedAudience: "SaaS visitor in consideration stage \u2014 multiple sessions, evaluated pricing or feature content.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Reduce friction to trial by making the path to first value feel short and low-commitment.",
      supportingGoals: ["Address objections proactively"],
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    tag:      "You've seen what {{company_short}} teams get from personalisation",
    title:    "Still evaluating? Here's what moves the needle.",
    subtitle:
      "Most {{industry}} growth teams see their first meaningful lift within two weeks. " +
      "No engineering ticket needed. No contract required. Just connect and start testing.",
    ctas: [
      { _key: "cta-scon-1", label: "Start your free trial", href: "/signup", variant: "primary"   },
      { _key: "cta-scon-2", label: "Talk to a human first", href: "/demo",   variant: "secondary" },
    ],
  },

  /**
   * hero_saas_intent
   * Audience: SaaS visitor with strong purchase intent — visited pricing, high engagement.
   * Framing:  Urgency and specificity. Mirror the intent.
   */
  {
    _id:      variantId("hero_saas_intent"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_saas_intent",
    isActive: true,
    decisionMeta: {
      decisionLabel: "B2B SaaS \u2014 High Intent",
      decisionSummary: "Urgency and specificity for SaaS visitors with strong purchase intent \u2014 visited pricing, high engagement.",
      intendedAudience: "SaaS visitors who have visited the pricing page and shown strong engagement signals.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert high-intent SaaS visitors before they evaluate competitors.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    tag:      "{{company_short}} is one rule away from a better homepage",
    title:    "You've done the research. Let's ship.",
    subtitle:
      "High-intent SaaS buyers move fast — and so should your onboarding. " +
      "Start your trial now and have your first adaptive experience live today, " +
      "on {{device}}.",
    ctas: [
      { _key: "cta-sint-1", label: "Start free trial now", href: "/signup", variant: "primary"   },
      { _key: "cta-sint-2", label: "Talk to sales",        href: "/demo",   variant: "secondary" },
    ],
  },

  /**
   * hero_saas_trial
   * Audience: visitor who has started or is close to starting a free trial.
   * Framing:  Momentum and activation. Get to first value fast.
   */
  {
    _id:      variantId("hero_saas_trial"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_saas_trial",
    isActive: true,
    decisionMeta: {
      decisionLabel: "B2B SaaS \u2014 Trial Ready",
      decisionSummary: "Low-friction trial prompt for SaaS visitors who have started or are very close to a free trial.",
      intendedAudience: "SaaS visitors who have started a free trial flow or are on trial-related pages.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the trial signup with minimal friction \u2014 remove doubt, emphasise ease of start.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Decision"],
    tag:      "Your trial starts now — first value in under 5 minutes",
    title:    "One connection. Your first adaptive experience, live today.",
    subtitle:
      "Connect your domain, define two rules, and Mister Chameleon does the rest. " +
      "Most SaaS trial teams ship their first personalised hero before their next standup.",
    ctas: [
      { _key: "cta-stri-1", label: "Open the quick-start guide", href: "/docs/quickstart", variant: "primary"   },
      { _key: "cta-stri-2", label: "Book onboarding call",       href: "/demo",            variant: "secondary" },
    ],
  },

  /**
   * hero_saas_customer_onboarding
   * Audience: newly converted SaaS customer entering onboarding flow.
   * Framing:  Welcome and activation. Drive to first meaningful outcome.
   */
  {
    _id:      variantId("hero_saas_customer_onboarding"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_saas_customer_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "B2B SaaS \u2014 Customer Onboarding",
      decisionSummary: "Onboarding welcome for newly converted SaaS customers.",
      intendedAudience: "Newly converted SaaS customers entering the onboarding flow.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "direct",
      primaryGoal: "Drive immediate first-value activation: first integration, first rule, first live variant.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    tag:      "Welcome to Mister Chameleon — your engine is live",
    title:    "Let's build your first adaptive experience.",
    subtitle:
      "You're in. Now let's get you from zero to personalised in one session. " +
      "The quick-start guide takes 12 minutes. Your visitors will notice immediately.",
    ctas: [
      { _key: "cta-sonb-1", label: "Start the quick-start guide", href: "/docs/quickstart", variant: "primary"   },
      { _key: "cta-sonb-2", label: "Chat with your CSM",          href: "/contact",         variant: "secondary" },
    ],
  },

  /**
   * hero_careers_default
   * Audience: first-time visitor to the careers / werken-bij site.
   * Framing:  Brand clarity. Communicate the company mission and role opportunity.
   */
  {
    _id:      variantId("hero_careers_default"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_careers_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 First Visit",
      decisionSummary: "Employer brand copy for first-time careers visitors with no specific role interest yet.",
      intendedAudience: "First-time visitors to the careers section who have not yet viewed a specific role.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Build employer brand appeal and encourage visitors to browse open roles.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    tag:      "Work that shapes the future of the web",
    title:    "Build the engine that makes every website smarter.",
    subtitle:
      "Mister Chameleon is a small, ambitious team creating the personalisation " +
      "infrastructure that growth teams rely on. Remote-first, ownership-heavy, " +
      "mission-driven.",
    ctas: [
      { _key: "cta-car-d1", label: "See open roles",          href: "/vacatures",  variant: "primary"   },
      { _key: "cta-car-d2", label: "Learn about our culture", href: "/over-ons",   variant: "secondary" },
    ],
  },

  /**
   * hero_careers_job_match
   * Audience: visitor who browsed the job listing or viewed a role detail.
   * Framing:  Relevance. Show them their interest is noticed and roles are real.
   */
  {
    _id:      variantId("hero_careers_job_match"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_careers_job_match",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 Role Browser",
      decisionSummary: "Role-focused copy for candidates who have browsed the job listing page.",
      intendedAudience: "Candidates who have visited the jobs listing and are evaluating whether to apply.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Drive candidates from job listing browse to specific role detail pages.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Consideration"],
    tag:      "Roles that grow with you",
    title:    "There's a role here that fits where you want to go.",
    subtitle:
      "Whether you're an engineer, designer, or growth specialist - we're expanding " +
      "into every discipline. Find the opening that matches your ambition.",
    ctas: [
      { _key: "cta-car-m1", label: "Browse all open roles", href: "/vacatures", variant: "primary" },
    ],
  },

  /**
   * hero_careers_high_intent
   * Audience: viewed a role detail AND clicked apply / browse CTA.
   * Framing:  Momentum. Reinforce the decision, reduce friction.
   */
  {
    _id:      variantId("hero_careers_high_intent"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_careers_high_intent",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 High Intent Applicant",
      decisionSummary: "Application-ready copy for candidates who have viewed a role detail AND clicked apply.",
      intendedAudience: "Candidates who viewed a specific role detail page and clicked the apply button.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the application action \u2014 remove friction and reinforce why this is the right move.",
    },
    sourceTags: ["linkedin", "google-organic", "direct"],
    stageTags: ["Decision"],
    tag:      "One step away from your next chapter",
    title:    "Ready to apply? We're ready for you.",
    subtitle:
      "You've done your research - now let's make it official. Our hiring process is " +
      "fast, transparent, and designed to respect your time.",
    ctas: [
      { _key: "cta-car-h1", label: "Apply now",          href: "/vacatures", variant: "primary"   },
      { _key: "cta-car-h2", label: "Ask us a question",  href: "/contact",   variant: "secondary" },
    ],
  },

  /**
   * hero_careers_reassurance
   * Audience: application drop-off or successfully submitted application.
   * Framing:  Calm and supportive. Remove pressure, confirm next steps.
   */
  {
    _id:      variantId("hero_careers_reassurance"),
    _type:    "heroVariant",
    tenantId: TENANT,
    key:      "hero_careers_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 Application Drop-off Recovery",
      decisionSummary: "Reassurance copy for visitors who dropped off mid-application or submitted and are re-visiting.",
      intendedAudience: "Candidates who started but did not complete an application, or who already submitted and returned.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates by reducing anxiety about the application process.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration", "Retention"],
    tag:      "No pressure. Genuine opportunity.",
    title:    "Still thinking? That's completely fine.",
    subtitle:
      "Big decisions deserve careful thought. Browse roles at your own pace - or " +
      "just let us know what you're looking for and we'll reach out when something fits.",
    ctas: [
      { _key: "cta-car-r1", label: "Browse open roles",   href: "/vacatures",  variant: "primary"   },
      { _key: "cta-car-r2", label: "Send an open letter", href: "/open-brief", variant: "secondary" },
    ],
  },

  // ── Page banner variants ───────────────────────────────────────────────────
  //
  // Generic fallback banner for pages that don't have a specific adaptive
  // variant (legal pages, changelog, glossary, etc.).

  {
    _id:           variantId("hero_page_banner"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_page_banner",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Generic Fallback",
      decisionSummary: "Neutral page banner for legal, changelog, and documentation pages with no personalisation signal needed.",
      intendedAudience: "Any visitor viewing a static utility or documentation page.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration", "decision", "retention"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide neutral page context without injecting a sales message.",
    },
    sourceTags: [],
    stageTags: ["Awareness", "Consideration", "Decision", "Retention"],
    layoutVariant: "hero_page_banner",
    tag:           "Mister Chameleon",
    title:         "Adaptive personalisation for the modern web.",
    subtitle:      "Every visitor is different. Your website should be too.",
    ctas: [],
  },

  // ── Visitor-adaptive cross-page banners ───────────────────────────────────
  //
  // These four variants are chosen by the decision engine via pageBannerKey and
  // override the page-specific fallback banner on CMS slug pages when the rule
  // fires. They work across ALL inner pages.

  {
    _id:           variantId("hero_page_banner_high_intent"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_page_banner_high_intent",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 High Intent",
      decisionSummary: "Conversion-nudging page banner for high-intent visitors showing strong purchase signals.",
      intendedAudience: "Visitors with intent score \u2265 50 or who have visited the pricing page.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "urgency",
      primaryGoal: "Nudge high-intent visitors toward a conversion action (trial or demo).",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    layoutVariant: "hero_page_banner",
    tag:           "Ready to start?",
    title:         "You are this close to your first adaptive visitor.",
    subtitle:
      "Setup takes 15 minutes on {{device}}. Your first personalised experience " +
      "could go live today — no engineering ticket required.",
    ctas: [
      { _key: "pb-hi-1", label: "Start free trial", href: "/order/starter", variant: "primary"   },
      { _key: "pb-hi-2", label: "Book a demo call", href: "/contact",       variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_consideration"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_page_banner_consideration",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Consideration Stage",
      decisionSummary: "Value-reinforcing page banner for consideration-stage visitors.",
      intendedAudience: "Visitors in consideration stage who have explored multiple pages across multiple sessions.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Reinforce value and reduce evaluation friction for returning visitors.",
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "See it in action",
    title:         "See how teams like yours are converting more visitors.",
    subtitle:
      "Real results, real customers - no guesswork. Watch the demo and decide for yourself.",
    ctas: [
      { _key: "pb-co-1", label: "Watch the demo",      href: "/demo",   variant: "primary"   },
      { _key: "pb-co-2", label: "Read case studies",   href: "/cases",  variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_returning"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_page_banner_returning",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Returning Visitor",
      decisionSummary: "Familiarity-acknowledging page banner for visitors on their second or later session.",
      intendedAudience: "Returning visitors across any funnel stage.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "google", "unknown"],
      tone: "persuasive",
      primaryGoal: "Acknowledge returning visitor status and deepen engagement.",
    },
    sourceTags: ["direct"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "Welcome back",
    title:         "Good to see you again, {{company_short}}.",
    subtitle:
      "You're back on {{device}} — pick up where you left off, or explore a part " +
      "of the platform you haven't seen yet.",
    ctas: [
      { _key: "pb-re-1", label: "Continue to demo", href: "/demo",      variant: "primary"   },
      { _key: "pb-re-2", label: "See what's new",   href: "/changelog", variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_enterprise"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_page_banner_enterprise",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Enterprise Visitor",
      decisionSummary: "Enterprise-grade credibility banner for visitors from large companies or showing expansion signals.",
      intendedAudience: "Visitors enriched as enterprise-size companies, or active customers revisiting pricing.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Signal platform readiness for enterprise scale and compliance needs.",
    },
    sourceTags: ["linkedin", "direct"],
    stageTags: ["Consideration", "Decision"],
    layoutVariant: "hero_page_banner",
    tag:           "Enterprise personalisation for {{industry}}",
    title:         "{{company_name}}: personalisation at scale, without the setup cost.",
    subtitle:
      "Dedicated onboarding, SLA support, white-label options, and a team that " +
      "picks up the phone — built for {{industry}} organisations like yours.",
    ctas: [
      { _key: "pb-en-1", label: "Book an enterprise call", href: "/contact", variant: "primary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_awareness"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_page_banner_awareness",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Awareness Stage",
      decisionSummary: "Lightly adaptive page banner for awareness-stage visitors or unqualified defaults.",
      intendedAudience: "First-time or unqualified visitors viewing inner pages.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Orient awareness-stage visitors and gently introduce the platform proposition.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Awareness"],
    layoutVariant: "hero_page_banner",
    tag:           "Discover Mister Chameleon",
    title:         "Your website, personalised for every visitor.",
    subtitle:
      "Mister Chameleon adapts headlines, proof, and CTAs in real time - " +
      "no code changes, no privacy trade-offs.",
    ctas: [
      { _key: "pb-aw-1", label: "Start free trial", href: "/order/starter", variant: "primary"   },
      { _key: "pb-aw-2", label: "Watch the demo",   href: "/demo",          variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  /**
   * hero_page_banner_friction
   * Audience: form drop-off visitors with high friction score.
   * Framing:  Reassurance. Remove urgency, reduce perceived commitment.
   *           The goal is to keep them in the funnel without pushing harder.
   */
  {
    _id:           variantId("hero_page_banner_friction"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    key:           "hero_page_banner_friction",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Form Drop-off Recovery",
      decisionSummary: "Low-pressure re-engagement banner for visitors who dropped off a form or showed hesitation signals.",
      intendedAudience: "Visitors who started but did not complete a form or CTA, or who have a friction score \u2265 40.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage hesitant visitors with a lower-friction path back to conversion.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "No rush",
    title:         "Still weighing it up? That is completely fine.",
    subtitle:
      "Most teams try one rule, see the lift, and never look back. " +
      "But the decision has to feel right first. " +
      "Talk to someone, read how it works, or just keep exploring.",
    ctas: [
      { _key: "pb-fr-1", label: "Talk to someone first", href: "/contact",       variant: "primary"   },
      { _key: "pb-fr-2", label: "See how it works",      href: "/how-it-works",  variant: "secondary" },
    ],
  },

  // ── Proof variants ────────────────────────────────────────────────────────

  {
    _id:      variantId("proof_cases"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_cases",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Case Studies & ROI",
      decisionSummary: "Concrete case studies and ROI numbers for visitors evaluating real-world results.",
      intendedAudience: "Visitors who have browsed case study pages or are in consideration/decision stage.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Convert sceptical evaluators with measurable outcome proof.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration", "Decision"],
    title:    "Conversion lifts for {{industry}} teams that speak for themselves",
    items: [
      {
        _key:  "cases-item-1",
        title: "3.2x more qualified leads",
        text:
          "SaaS teams using Mister Chameleon see an average 3.2x lift in demo " +
          "requests within 30 days of going live - no engineering changes required.",
      },
      {
        _key:  "cases-item-2",
        title: "First experience live in under 5 minutes",
        text:
          "Connect your domain, define two rules, and your first adaptive experience " +
          "is live. Most teams are shipping within a single afternoon.",
      },
      {
        _key:  "cases-item-3",
        title: "12 visitor signals, evaluated in real time",
        text:
          "Source, device, campaign, recency, and more - every visit triggers a silent " +
          "evaluation so the right experience loads before the page paints.",
      },
    ],
  },

  {
    _id:      variantId("proof_vision"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_vision",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Analyst & Industry Recognition",
      decisionSummary: "Analyst quotes and industry recognition for vision-led visitors, particularly from LinkedIn.",
      intendedAudience: "Professionals and executives who respond to thought-leadership and industry validation.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["linkedin"],
      tone: "inspiring",
      primaryGoal: "Establish platform credibility with analyst and industry validation.",
    },
    sourceTags: ["linkedin"],
    stageTags: ["Awareness"],
    title:    "What the industry is saying",
    items: [
      {
        _key:  "vision-item-1",
        title: "Recognised by Product Hunt",
        text:
          "#1 Product of the Day - 'Mister Chameleon is what adaptive marketing " +
          "infrastructure should look like. Finally, personalisation without the platform tax.'",
      },
      {
        _key:  "vision-item-2",
        title: "Built for the next decade of growth",
        text:
          "Purpose-built for the era when every visitor expects a tailored experience, " +
          "but engineering bandwidth is the scarcest resource on the team.",
      },
      {
        _key:  "vision-item-3",
        title: "Zero-engineer personalisation - at scale",
        text:
          "The only platform that brings decision-engine-grade adaptivity to marketing " +
          "and product teams who don't have a machine learning department.",
      },
    ],
  },

  {
    _id:      variantId("proof_platform"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_platform",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Platform Scale & Reliability",
      decisionSummary: "Platform scale and reliability stats for technical visitors evaluating infrastructure.",
      intendedAudience: "Technical evaluators and developers assessing platform scalability and reliability.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Reassure technical decision-makers on platform scale, uptime, and reliability.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration", "Decision"],
    title:    "Infrastructure you can trust",
    items: [
      {
        _key:  "platform-item-1",
        title: "Edge-native decision engine",
        text:
          "Context detection and experience resolution happen at the CDN edge - " +
          "sub-5ms latency with no origin round-trip, regardless of visitor location.",
      },
      {
        _key:  "platform-item-2",
        title: "99.99% uptime SLA",
        text:
          "Deployed across a global active-active edge network with automatic failover, " +
          "zero-downtime deployments, and a public status page.",
      },
      {
        _key:  "platform-item-3",
        title: "GDPR & CCPA compliant by default",
        text:
          "No PII is collected or stored. Every signal is evaluated ephemerally, in " +
          "memory, in real time. Your visitors' privacy is preserved automatically.",
      },
    ],
  },

  {
    _id:      variantId("proof_default"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Broad Credibility",
      decisionSummary: "General credibility block for new visitors with no specific segment signal.",
      intendedAudience: "Any new visitor where no more specific proof variant matches.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Establish baseline trust and credibility for unqualified visitors.",
    },
    sourceTags: ["google-organic", "linkedin", "direct"],
    stageTags: ["Awareness", "Consideration"],
    title:    "Trusted by {{industry}} growth teams worldwide",
    items: [
      {
        _key:  "def-item-1",
        title: "2,000+ teams already adapting",
        text:
          "From early-stage SaaS startups to enterprise marketing teams, Mister Chameleon " +
          "powers adaptive experiences across industries - without a single engineering sprint.",
      },
      {
        _key:  "def-item-2",
        title: "Live in under 5 minutes",
        text:
          "Connect your domain, write two rules, and your first adaptive experience is " +
          "live before your next meeting. Most teams ship the same afternoon.",
      },
      {
        _key:  "def-item-3",
        title: "Zero PII. Full compliance.",
        text:
          "Mister Chameleon never stores visitor data. Every signal is evaluated " +
          "ephemerally at the edge - GDPR and CCPA compliant without lifting a finger.",
      },
    ],
  },

  {
    _id:      variantId("proof_stats"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_stats",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Hard Numbers for Buyers",
      decisionSummary: "Hard numbers and conversion statistics for high-intent buyers who need quantitative justification.",
      intendedAudience: "High-intent visitors in decision stage who respond to data-driven proof.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Provide the statistical justification a high-intent buyer needs to proceed.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "The numbers that matter",
    items: [
      {
        _key:  "stats-item-1",
        title: "3.2x more qualified leads, on average",
        text:
          "Teams that run Mister Chameleon for 30 days see an average 3.2x increase in " +
          "demo requests - without changing ad spend or redesigning the site.",
      },
      {
        _key:  "stats-item-2",
        title: "Sub-5 ms context evaluation at the edge",
        text:
          "Every visit is evaluated in real time before the first byte is served. " +
          "Zero latency impact. Zero impact on Core Web Vitals.",
      },
      {
        _key:  "stats-item-3",
        title: "12 visitor signals, evaluated simultaneously",
        text:
          "Source, device, geo, company, campaign, recency, intent score, and more - " +
          "all combined into a single context snapshot that drives the experience decision.",
      },
    ],
  },

  {
    _id:      variantId("proof_reassurance"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Safety & Social Proof",
      decisionSummary: "Safety and social proof for visitors with doubt, hesitation, or high friction signals.",
      intendedAudience: "Visitors with elevated friction scores, form drop-offs, or hesitation behaviour.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Remove doubt and rebuild trust for hesitant visitors.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    title:    "Trusted by teams who've been in your position",
    items: [
      {
        _key:  "reas-item-1",
        title: "No lock-in. Cancel any time.",
        text:
          "Mister Chameleon runs alongside your existing site - no rip-and-replace, " +
          "no six-month implementation. Walk away any time without losing a line of content.",
      },
      {
        _key:  "reas-item-2",
        title: "Onboarding support included",
        text:
          "Every new account gets a 30-minute onboarding call. Our team helps you " +
          "identify your top 3 visitor segments and write your first rules - at no extra cost.",
      },
      {
        _key:  "reas-item-3",
        title: "Used by teams just like yours",
        text:
          "Most of our customers came to us after being frustrated by tools that were " +
          "either too complex or too simple. Mister Chameleon was built for exactly that gap.",
      },
    ],
  },

  // ── B2B SaaS proof variants ───────────────────────────────────────────────

  {
    _id:      variantId("proof_saas_default"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_saas_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof SaaS \u2014 Broad Credibility",
      decisionSummary: "General credibility block for new SaaS-context visitors.",
      intendedAudience: "First-time SaaS visitors where no more specific proof variant matches.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Establish baseline trust for unqualified SaaS visitors.",
    },
    sourceTags: ["google-organic", "linkedin", "direct"],
    stageTags: ["Awareness", "Consideration"],
    title:    "SaaS teams trust Mister Chameleon to convert more visitors",
    items: [
      {
        _key:  "saas-def-1",
        title: "Deployed by 1,400+ SaaS growth teams",
        text:
          "From Series A startups to public SaaS companies, growth teams use Mister Chameleon " +
          "to serve the right variant to every visitor — without touching the codebase.",
      },
      {
        _key:  "saas-def-2",
        title: "Average 2.8x lift in trial signups",
        text:
          "SaaS teams that personalise their hero and CTA by traffic source see a median " +
          "2.8x increase in free trial starts within 30 days of going live.",
      },
      {
        _key:  "saas-def-3",
        title: "Integrates with your existing stack in minutes",
        text:
          "One script tag. Works alongside your CMS, analytics, and A/B testing tools. " +
          "No new infrastructure, no engineering sprint, no renegotiating contracts.",
      },
    ],
  },

  {
    _id:      variantId("proof_saas_consideration"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_saas_consideration",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof SaaS \u2014 Consideration",
      decisionSummary: "Proof block addressing SaaS teams evaluating Mister Chameleon vs DIY approaches.",
      intendedAudience: "SaaS visitors in consideration stage evaluating the platform against alternatives.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Differentiate Mister Chameleon from DIY personalisation for SaaS evaluators.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration"],
    title:    "Why {{industry}} teams choose Mister Chameleon over DIY personalisation",
    items: [
      {
        _key:  "saas-con-1",
        title: "No engineering time required",
        text:
          "Every personalisation rule, variant, and experiment is managed in the CMS. " +
          "Your growth team ships new experiences without opening a Jira ticket.",
      },
      {
        _key:  "saas-con-2",
        title: "Segment by source, intent, company, and more",
        text:
          "Combine up to 12 visitor signals — including reverse-IP company name, UTM source, " +
          "and return visit count — to target exactly the segments that convert.",
      },
      {
        _key:  "saas-con-3",
        title: "Full observability, zero guesswork",
        text:
          "Every variant decision is logged. You'll know exactly which rule fired, which " +
          "variant was served, and how each segment converted — in real time.",
      },
    ],
  },

  {
    _id:      variantId("proof_saas_intent"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_saas_intent",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof SaaS \u2014 High Intent",
      decisionSummary: "High-impact proof for SaaS visitors with strong purchase intent showing measurable outcomes.",
      intendedAudience: "High-intent SaaS visitors who have visited pricing and shown strong engagement.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Provide quantitative justification to high-intent SaaS buyers ready to commit.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "High-intent visitors deserve a high-impact experience",
    items: [
      {
        _key:  "saas-int-1",
        title: "3.2x more demo requests from high-intent segments",
        text:
          "When pricing-page visitors see a message that matches their intent — not a generic " +
          "hero written for everyone — demo request rates increase by an average of 3.2x.",
      },
      {
        _key:  "saas-int-2",
        title: "Live in under 5 minutes",
        text:
          "Start a free trial, connect your domain, and deploy your first intent-based variant " +
          "before your next meeting. No implementation partner needed.",
      },
      {
        _key:  "saas-int-3",
        title: "Used by {{industry}} teams at Series A through IPO",
        text:
          "Whether you're closing your first 100 customers or scaling to 10,000, the variant " +
          "engine adapts to your funnel stage without needing a rebuild.",
      },
    ],
  },

  {
    _id:      variantId("proof_saas_reassurance"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_saas_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof SaaS \u2014 Reassurance",
      decisionSummary: "Privacy, uptime, and no lock-in proof for SaaS visitors with hesitation signals.",
      intendedAudience: "SaaS visitors with elevated friction scores or privacy/compliance concerns.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Remove trust barriers for hesitant SaaS evaluators by emphasising compliance and flexibility.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    title:    "Trusted, private, and compliant by default",
    items: [
      {
        _key:  "saas-rea-1",
        title: "No PII collected. Ever.",
        text:
          "Every visitor signal is evaluated ephemerally at the edge — nothing is stored, " +
          "nothing is tracked. GDPR and CCPA compliant out of the box.",
      },
      {
        _key:  "saas-rea-2",
        title: "99.99% uptime — your homepage never drops",
        text:
          "Mister Chameleon runs at the CDN edge with automatic failover. If anything " +
          "goes wrong, your default variant is served instantly. No outage risk.",
      },
      {
        _key:  "saas-rea-3",
        title: "Cancel any time. Keep your content.",
        text:
          "All variant copy lives in your CMS. If you ever move on, you own everything " +
          "you wrote. No lock-in, no export fees, no hidden conditions.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_default"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_careers_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Employer Brand",
      decisionSummary: "Employer brand proof for first-time careers visitors highlighting culture and team.",
      intendedAudience: "First-time careers visitors with no specific role interest yet.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Build employer brand appeal for unqualified careers visitors.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    title:    "Life at Mister Chameleon",
    items: [
      {
        _key:  "car-def-1",
        title: "Small team, big ownership",
        text:
          "We're a tight-knit team where every person owns a meaningful slice of the " +
          "product. No ticket queues, no middle management. Just you, your craft, and impact.",
      },
      {
        _key:  "car-def-2",
        title: "Remote-first, async-friendly",
        text:
          "Work from anywhere in Europe. Our culture is built around clear writing, " +
          "focused work, and the occasional team week when we actually like each other more.",
      },
      {
        _key:  "car-def-3",
        title: "Backed by a mission worth talking about",
        text:
          "We believe every website should speak to each visitor like a human would. " +
          "If that sentence makes you want to build something, you'll fit right in.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_team"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_careers_team",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Team Quality",
      decisionSummary: "Team culture and quality proof for candidates evaluating role fit.",
      intendedAudience: "Candidates who have viewed a specific role detail and are evaluating team fit.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Convince role-interested candidates that the team is worth joining.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Consideration"],
    title:    "The people you'd work with",
    items: [
      {
        _key:  "car-team-1",
        title: "Engineers who care about craft",
        text:
          "Our engineering team cares deeply about the quality of what they build. " +
          "Code reviews are thorough, documentation is real, and technical debt is tracked.",
      },
      {
        _key:  "car-team-2",
        title: "Growth people who think in systems",
        text:
          "Our growth team combines data intuition with creative instinct. " +
          "We run experiments, not campaigns - and we share results, including the failed ones.",
      },
      {
        _key:  "car-team-3",
        title: "A culture of honest feedback",
        text:
          "We give direct, kind feedback - and expect it in return. Nobody grows in an " +
          "echo chamber. We'd rather be honest than comfortable.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_reassurance"),
    _type:    "proofVariant",
    tenantId: TENANT,
    key:      "proof_careers_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Fair Hiring Process",
      decisionSummary: "Reassurance proof for application drop-off candidates emphasising fair and transparent process.",
      intendedAudience: "Candidates who started but did not complete an application or who are hesitating.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates by emphasising a transparent, low-pressure hiring process.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration", "Retention"],
    title:    "A process designed for real people",
    items: [
      {
        _key:  "car-reas-1",
        title: "3 stages, no surprises",
        text:
          "Intro call, skills conversation, offer. No take-home assignments that eat " +
          "your weekend. No whiteboard puzzles. Just real conversations about real work.",
      },
      {
        _key:  "car-reas-2",
        title: "We give feedback, always",
        text:
          "Every candidate gets a personal response, and every rejection includes specific " +
          "feedback. We believe that's the minimum standard for respecting your time.",
      },
      {
        _key:  "car-reas-3",
        title: "Questions are welcome at every stage",
        text:
          "You're evaluating us as much as we're evaluating you. Ask anything - about the " +
          "role, the team, the product, the salary, the roadmap. We'll answer honestly.",
      },
    ],
  },

  // ── CTA variants ──────────────────────────────────────────────────────────

  {
    _id:      variantId("cta_guide"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_guide",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Nurture: Free Playbook",
      decisionSummary: "Low-friction nurture CTA offering a free playbook download for early-stage visitors.",
      intendedAudience: "Awareness or early-consideration visitors not yet ready for a trial or demo.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "unknown"],
      tone: "educational",
      primaryGoal: "Capture email via playbook download to start nurture sequence.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Awareness"],
    title:    "Get the Adaptive Website Playbook",
    text:
      "A practical, no-fluff guide to personalising your homepage for your three " +
      "highest-value traffic sources. Free. No email gate.",
    ctas: [
      { _key: "cta-guide-1", label: "Download the playbook", href: "/playbook", variant: "primary" },
    ],
  },

  {
    _id:      variantId("cta_platform"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_platform",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Product-led: Start Free",
      decisionSummary: "Product-led signup CTA for visitors showing platform evaluation intent.",
      intendedAudience: "Visitors who have explored features or platform pages and are evaluating signing up.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Drive free trial signup with minimal friction.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Consideration"],
    title:    "Start building for free",
    text:
      "Your first adaptive experience is free, forever. No credit card, no sales call, " +
      "no six-month onboarding. Just connect, configure, and ship.",
    ctas: [
      { _key: "cta-platform-1", label: "Create your free account", href: "/signup",       variant: "primary"   },
      { _key: "cta-platform-2", label: "See how it works",         href: "/how-it-works", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_meeting"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_meeting",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Sales: Book Demo",
      decisionSummary: "Sales-led demo booking CTA for visitors ready for a human conversation.",
      intendedAudience: "Consideration or decision-stage visitors who prefer a guided walkthrough over self-serve.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Book a demo call to begin the sales conversation.",
    },
    sourceTags: ["linkedin", "google-paid"],
    stageTags: ["Consideration", "Decision"],
    title:    "See Mister Chameleon in action",
    text:
      "Book a 20-minute live demo. We'll show you exactly how your homepage would " +
      "look to your three most important visitor segments.",
    ctas: [
      { _key: "cta-meeting-1", label: "Book a demo",    href: "/demo",   variant: "primary"   },
      { _key: "cta-meeting-2", label: "Start for free", href: "/signup", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_demo"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_demo",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Consideration: See It In Action",
      decisionSummary: "Interactive demo CTA for consideration-stage visitors who want to experience the product before committing.",
      intendedAudience: "Consideration-stage visitors who want to see the product in action before signing up.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Drive demo engagement to convert consideration-stage visitors.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "See exactly how it would look for your site",
    text:
      "Book a 20-minute screen-share. We'll show you a live adaptive experience " +
      "built around your three most important visitor segments. No pitch deck.",
    ctas: [
      { _key: "cta-demo-1", label: "Book a 20-minute demo",   href: "/demo",   variant: "primary"   },
      { _key: "cta-demo-2", label: "Read case studies first", href: "/cases",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_onboarding"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Customer: First Value Fast",
      decisionSummary: "Onboarding-focused CTA for newly converted customers to reach first value quickly.",
      intendedAudience: "Newly converted customers entering the onboarding flow.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "direct",
      primaryGoal: "Drive first-value activation: connect domain and launch first live variant.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Your first adaptive experience is one step away",
    text:
      "Follow the quick-start guide to connect your domain, set your first two rules, " +
      "and watch the engine go live - usually in under 10 minutes.",
    ctas: [
      { _key: "cta-onb-1", label: "Open quick-start guide",      href: "/docs/quickstart", variant: "primary"   },
      { _key: "cta-onb-2", label: "Talk to onboarding support",  href: "/contact",         variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_expansion"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_expansion",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Active Customer: Upgrade Prompt",
      decisionSummary: "Expansion CTA for active customers revisiting pricing, showing upgrade/upsell intent.",
      intendedAudience: "Active customers (customer funnel stage) who are revisiting pricing or feature pages.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert expansion intent into an upgrade or upsell conversation.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Ready to unlock the next level?",
    text:
      "Your current plan is doing the work. But if you're hitting limits on rules, " +
      "variants, or tenants - it's time to talk. Upgrading takes less than 5 minutes.",
    ctas: [
      { _key: "cta-exp-1", label: "View upgrade options",        href: "/pricing", variant: "primary"   },
      { _key: "cta-exp-2", label: "Talk to your account manager", href: "/contact", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_default"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Generic Fallback",
      decisionSummary: "Generic dual-path CTA working for all visitor segments with no specific signal.",
      intendedAudience: "Any visitor where no more specific CTA variant matches.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Offer two clear paths: low-friction resource and primary conversion.",
    },
    sourceTags: [],
    stageTags: ["Awareness", "Consideration"],
    title:    "Ready to see what a personalised homepage can do?",
    text:
      "Join thousands of growth teams who use Mister Chameleon to serve the right message " +
      "to the right visitor — automatically, without engineering involvement.",
    ctas: [
      { _key: "cta-cdef-1", label: "Start for free",   href: "/signup", variant: "primary"   },
      { _key: "cta-cdef-2", label: "Book a demo",       href: "/demo",   variant: "secondary" },
    ],
  },

  // ── B2B SaaS CTA variants ─────────────────────────────────────────────────

  {
    _id:      variantId("cta_saas_default"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_saas_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA SaaS \u2014 Generic Fallback",
      decisionSummary: "Generic dual-path CTA for SaaS visitors with no specific signal.",
      intendedAudience: "SaaS visitors where no more specific CTA variant matches.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Offer trial and demo paths for unqualified SaaS visitors.",
    },
    sourceTags: ["google-organic", "google-paid", "linkedin"],
    stageTags: ["Awareness", "Consideration"],
    title:    "The adaptive homepage platform built for SaaS",
    text:
      "Mister Chameleon lets SaaS growth teams personalise without code. " +
      "One script tag, CMS-managed variants, and real-time context evaluation at the edge.",
    ctas: [
      { _key: "cta-ssd-1", label: "Start free trial",  href: "/signup", variant: "primary"   },
      { _key: "cta-ssd-2", label: "See a live demo",   href: "/demo",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_saas_demo"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_saas_demo",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA SaaS \u2014 Consideration: Personalised Demo",
      decisionSummary: "Demo-focused CTA for SaaS consideration-stage visitors wanting a tailored walkthrough.",
      intendedAudience: "SaaS visitors in consideration who prefer a guided walkthrough over self-serve trial.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Book a personalised demo to convert SaaS consideration visitors.",
    },
    sourceTags: ["linkedin", "google-paid"],
    stageTags: ["Consideration"],
    title:    "See exactly how Mister Chameleon fits your SaaS funnel",
    text:
      "Book a 20-minute screen-share. We'll walk through your top three visitor segments " +
      "and show you a live adaptive experience built around your actual homepage.",
    ctas: [
      { _key: "cta-sdmo-1", label: "Book a personalised demo", href: "/demo",   variant: "primary"   },
      { _key: "cta-sdmo-2", label: "Start free trial instead", href: "/signup", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_saas_trial"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_saas_trial",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA SaaS \u2014 Trial Ready: Low Friction",
      decisionSummary: "Low-friction trial signup nudge for SaaS visitors very close to starting.",
      intendedAudience: "SaaS visitors in decision stage ready to start a free trial.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the trial signup with minimal friction.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "Start your free trial — first experience live in minutes",
    text:
      "No credit card. No sales call. No 6-month onboarding. " +
      "Connect your domain and deploy your first adaptive hero before your next standup.",
    ctas: [
      { _key: "cta-strl-1", label: "Create free account",     href: "/signup",        variant: "primary"   },
      { _key: "cta-strl-2", label: "Read the quick-start guide", href: "/docs/quickstart", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_saas_onboarding"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_saas_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA SaaS \u2014 Customer Onboarding: Activate First Experience",
      decisionSummary: "Onboarding CTA for newly converted SaaS customers to activate their first adaptive experience.",
      intendedAudience: "Newly converted SaaS customers entering the onboarding flow.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "direct",
      primaryGoal: "Drive first-value activation for newly converted SaaS customers.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "You're in — let's activate your first experience",
    text:
      "Your account is ready. Now connect your domain, write two rules, and watch " +
      "Mister Chameleon serve the right variant to every visitor automatically.",
    ctas: [
      { _key: "cta-sonb-c1", label: "Open quick-start guide", href: "/docs/quickstart", variant: "primary"   },
      { _key: "cta-sonb-c2", label: "Book onboarding call",   href: "/demo",            variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_saas_expansion"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_saas_expansion",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA SaaS \u2014 Active Customer: Upgrade",
      decisionSummary: "Upgrade/expansion CTA for active SaaS customers revisiting pricing.",
      intendedAudience: "Active SaaS customers (customer funnel stage) revisiting pricing or feature pages.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert expansion intent into an upgrade or upsell conversation for SaaS customers.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Ready to do more with Mister Chameleon?",
    text:
      "You've seen what personalisation can do. Unlock more rules, more variants, and " +
      "multi-tenant support — and keep compounding the conversion lift.",
    ctas: [
      { _key: "cta-sexp-1", label: "Explore upgrade options",     href: "/pricing", variant: "primary"   },
      { _key: "cta-sexp-2", label: "Talk to your account manager", href: "/contact", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_browse"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_careers_browse",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Browse Open Roles",
      decisionSummary: "Role browsing CTA for careers visitors with no specific role interest yet.",
      intendedAudience: "First-time careers visitors who have not yet viewed a specific role.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Drive careers visitors from homepage to the jobs listing page.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    title:    "Find the role that fits your next chapter",
    text:
      "We're hiring across engineering, growth, design, and customer success. " +
      "Browse what's open - or send an open application if nothing fits yet.",
    ctas: [
      { _key: "cta-cbr-1", label: "See all open roles",  href: "/vacatures",  variant: "primary"   },
      { _key: "cta-cbr-2", label: "Send an open letter", href: "/open-brief", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_apply"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_careers_apply",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 High Intent: Apply Now",
      decisionSummary: "Application CTA for candidates who have viewed a role and are ready to apply.",
      intendedAudience: "Candidates who viewed a specific role detail page and clicked the apply button.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the application action with minimal friction.",
    },
    sourceTags: ["linkedin", "google-organic", "direct"],
    stageTags: ["Decision"],
    title:    "You've found your role. Let's make it official.",
    text:
      "The application takes about 10 minutes. No cover letter required - just tell us " +
      "what you've built and what you want to build next.",
    ctas: [
      { _key: "cta-cap-1", label: "Apply now",               href: "/vacatures", variant: "primary"   },
      { _key: "cta-cap-2", label: "Ask us a question first", href: "/contact",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_open"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_careers_open",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Open Application",
      decisionSummary: "Low-pressure open application CTA for candidates not yet ready to apply to a specific role.",
      intendedAudience: "Candidates who started but did not complete an application or who dropped off.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates via a lower-commitment open application path.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    title:    "Not quite ready? Just introduce yourself.",
    text:
      "Send us an open letter. Tell us what you do, what you're looking for, and " +
      "why Mister Chameleon caught your eye. No role required.",
    ctas: [
      { _key: "cta-cop-1", label: "Send an open letter", href: "/open-brief",  variant: "primary"   },
      { _key: "cta-cop-2", label: "Browse open roles",   href: "/vacatures",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_contact"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    key:      "cta_careers_contact",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Post-Conversion: Application Received",
      decisionSummary: "Post-application CTA confirming receipt and offering a direct contact channel.",
      intendedAudience: "Candidates who have already submitted an application and are revisiting the site.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Confirm application status and provide a human contact channel to reduce post-submission anxiety.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Application received. We'll be in touch.",
    text:
      "You'll hear from us within 5 business days. In the meantime, feel free to reach " +
      "out if you have questions about the role, the process, or the team.",
    ctas: [
      { _key: "cta-cco-1", label: "Reach out directly", href: "/contact", variant: "primary" },
    ],
  },

  // ── Feature variants ──────────────────────────────────────────────────────

  {
    _id:      variantId("feature_core"),
    _type:    "featureVariant",
    tenantId: TENANT,
    key:      "feature_core",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Core Platform Capabilities",
      decisionSummary: "Three core platform capabilities overview for consideration-stage visitors evaluating the platform.",
      intendedAudience: "Visitors in consideration who want a concise overview of platform capabilities.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Communicate the three core platform capabilities clearly.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Everything you need to personalise at scale",
    subtitle: "Three capabilities, one platform - no engineering sprints required.",
    items: [
      {
        _key:  "feat-core-1",
        title: "Adaptive decision engine",
        body:
          "Real-time visitor context - source, device, geo, company, and campaign - " +
          "evaluated at the edge in under 5 ms. No cookies. No PII.",
        icon:  "zap",
      },
      {
        _key:  "feat-core-2",
        title: "CMS-powered variant library",
        body:
          "Write hero, proof, and CTA variants once in Sanity Studio. " +
          "The engine selects the right one for every visitor automatically.",
        icon:  "layers",
      },
      {
        _key:  "feat-core-3",
        title: "Experiment and analytics layer",
        body:
          "A/B test any variant slot without code. Track served variants and " +
          "conversion lift with built-in analytics - no third-party tools needed.",
        icon:  "bar-chart-2",
      },
    ],
  },

  {
    _id:           variantId("feature_grid_primary"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    key:           "feature_grid_primary",
    layoutVariant: "feature_grid",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Full Grid Overview",
      decisionSummary: "Full six-item feature grid for consideration-stage visitors doing thorough platform evaluation.",
      intendedAudience: "Visitors in detailed evaluation mode who want comprehensive feature coverage.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide complete feature coverage for thorough platform evaluators.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration"],
    title:    "Everything you need to personalise at scale",
    subtitle: "Three capabilities. One platform. Zero engineering sprints.",
    items: [
      {
        _key:  "fg-1",
        title: "Adaptive decision engine",
        body:
          "Real-time visitor context - source, device, geo, company, and campaign - " +
          "evaluated at the edge in under 5 ms. No cookies. No PII.",
        icon:  "zap",
      },
      {
        _key:  "fg-2",
        title: "CMS-powered variant library",
        body:
          "Write hero, proof, and CTA variants once in Sanity Studio. " +
          "The engine selects the right one for every visitor, automatically.",
        icon:  "layers",
      },
      {
        _key:  "fg-3",
        title: "Experiment and analytics layer",
        body:
          "A/B test any variant slot without writing code. Track served variants and " +
          "conversion lift with built-in analytics - no third-party tools required.",
        icon:  "bar-chart-2",
      },
      {
        _key:  "fg-4",
        title: "Multi-tenant architecture",
        body:
          "Run adaptive experiences for multiple brands or products from a single " +
          "platform. Tenant-scoped rules, content, and analytics - all in one place.",
        icon:  "globe",
      },
      {
        _key:  "fg-5",
        title: "No-code rule builder",
        body:
          "Define conditions and assign variant plans using a point-and-click interface. " +
          "No SQL, no regex, no engineering tickets - just logical, readable rules.",
        icon:  "sliders",
      },
      {
        _key:  "fg-6",
        title: "Edge-native, globally fast",
        body:
          "Every decision runs at the CDN edge - sub-5 ms latency regardless of where " +
          "your visitor is. Core Web Vitals stay green. Conversions go up.",
        icon:  "shield",
      },
    ],
  },

  {
    _id:           variantId("feature_highlights"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    key:           "feature_highlights",
    layoutVariant: "feature_highlights",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Key Differentiators",
      decisionSummary: "Three key differentiators for consideration-stage visitors comparing alternatives.",
      intendedAudience: "Visitors in consideration who are comparing Mister Chameleon to alternatives.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Differentiate Mister Chameleon on the three dimensions that matter most to evaluators.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Why growth teams choose Mister Chameleon",
    subtitle: "Personalisation that works without a machine learning team.",
    items: [
      {
        _key:  "fh-1",
        title: "Context-aware, not cookie-dependent",
        body:
          "Mister Chameleon reads 12 visitor signals - source, company, device, recency, " +
          "and intent - at the edge in real time. No cookies needed. No consent banner required. " +
          "GDPR-compliant by design.",
        icon:  "eye",
      },
      {
        _key:  "fh-2",
        title: "Rules you can read, write, and trust",
        body:
          "Every experience decision is driven by a rule you defined in plain language. " +
          "No black-box ML model you can't explain to your CEO. " +
          "Every variant served is logged and auditable.",
        icon:  "check-circle",
      },
      {
        _key:  "fh-3",
        title: "Integrates with your CMS in minutes",
        body:
          "Connect Sanity, Storyblok, or a headless CMS you already use. " +
          "Write variant copy in the CMS you know - Mister Chameleon handles the routing " +
          "and serving automatically.",
        icon:  "plug",
      },
    ],
  },

  {
    _id:           variantId("feature_comparison"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    key:           "feature_comparison",
    layoutVariant: "feature_comparison",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Comparison Table",
      decisionSummary: "Side-by-side comparison for decision-stage visitors doing final competitive evaluation.",
      intendedAudience: "Decision-stage visitors doing final comparison against competing platforms.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Win the final comparison moment by demonstrating clear advantage on key criteria.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Decision"],
    title:    "How Mister Chameleon compares",
    subtitle: "Not all personalisation platforms are built the same.",
    items: [
      {
        _key:  "fc-1",
        title: "No-code rule builder",
        body:
          "Mister Chameleon: yes - point-and-click condition editor, readable in plain English. " +
          "Most platforms: requires developer config or a data science pipeline.",
        icon:  "sliders",
      },
      {
        _key:  "fc-2",
        title: "Edge-native evaluation",
        body:
          "Mister Chameleon: decisions run at the CDN edge, sub-5 ms. " +
          "Most platforms: server-side evaluation adds 100-400 ms per page load.",
        icon:  "zap",
      },
      {
        _key:  "fc-3",
        title: "Cookie-free and GDPR-compliant",
        body:
          "Mister Chameleon: no PII stored, no consent banner required. " +
          "Most platforms: require cookie consent and data processing agreements.",
        icon:  "shield",
      },
      {
        _key:  "fc-4",
        title: "Multi-tenant out of the box",
        body:
          "Mister Chameleon: tenant-scoped rules, content, and analytics included on all plans. " +
          "Most platforms: multi-tenancy is an enterprise add-on at 3-10x the price.",
        icon:  "globe",
      },
    ],
  },

  // ── Conversion variants ────────────────────────────────────────────────────

  {
    _id:      variantId("conversion_signup"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    key:      "conversion_signup",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Product-led Signup",
      decisionSummary: "Product-led account creation entry point for decision-stage visitors ready to start.",
      intendedAudience: "Decision-stage visitors ready to create an account and start the trial.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Drive account creation with minimal friction.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "Start free. Upgrade when you're ready.",
    text:
      "Create your account in under 60 seconds. No credit card, no sales call, " +
      "no six-month onboarding. Your first adaptive experience ships today.",
    ctas: [
      { _key: "conv-signup-1", label: "Create your free account", href: "/signup", variant: "primary"   },
      { _key: "conv-signup-2", label: "See a live demo",          href: "/demo",   variant: "secondary" },
    ],
    urgencyLabel: "Join 2,000+ growth teams already using Mister Chameleon",
  },

  {
    _id:      variantId("conversion_demo"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    key:      "conversion_demo",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Book a Demo",
      decisionSummary: "Sales-led demo booking for consideration-stage visitors who prefer a guided walkthrough.",
      intendedAudience: "Consideration-stage visitors who prefer a human walkthrough before committing.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Book a demo call to begin the guided sales process.",
    },
    sourceTags: ["linkedin", "google-paid"],
    stageTags: ["Consideration"],
    title:    "See your site, personalised. Live.",
    text:
      "Book a 20-minute screen-share and we'll show you exactly how Mister Chameleon " +
      "would serve your three highest-value visitor segments. Bring your real site.",
    ctas: [
      { _key: "conv-demo-1", label: "Book a live demo",   href: "/demo",   variant: "primary"   },
      { _key: "conv-demo-2", label: "Start free instead", href: "/signup", variant: "secondary" },
    ],
    urgencyLabel: "Usually scheduled within 24 hours",
  },

  {
    _id:      variantId("conversion_contact"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    key:      "conversion_contact",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Open Contact",
      decisionSummary: "Open contact channel for consideration-stage visitors who want human contact over automation.",
      intendedAudience: "Consideration-stage visitors with specific questions or concerns before converting.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide a human contact path for visitors with unanswered questions.",
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    title:    "Have a question? We're here.",
    text:
      "Whether you're evaluating the platform, need help with setup, or just want to " +
      "talk to a human - drop us a message and we'll respond within one business day.",
    ctas: [
      { _key: "conv-con-1", label: "Send a message", href: "/contact", variant: "primary" },
    ],
    urgencyLabel: "Response within one business day",
  },


  // ── NL (Dutch) locale variants ─────────────────────────────────────────────
  //
  // Each document carries locale: "nl" and the same `key` as its EN counterpart.
  // GROQ resolution order scores tenant+locale match at 3, so these are returned
  // in preference to the EN defaults when $locale == "nl".

  // Hero variants (NL)

  {
    _id:      variantId("hero_google_problem_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_google_problem",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Google Search \u2014 Problem Aware",
      decisionSummary: "Urgency-led copy for search visitors who typed a problem keyword. Names the pain before offering the solution.",
      intendedAudience: "Visitors arriving from Google organic or paid search who searched a pain-specific query.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google"],
      tone: "direct",
      primaryGoal: "Mirror the searcher's pain to capture attention, then drive them to the how-it-works page.",
    },
    sourceTags: ["google-organic", "google-paid"],
    stageTags: ["Awareness", "Consideration"],
    tag:      "Stop met elke bezoeker dezelfde pagina sturen",
    title:    "Jouw website spreekt niemand aan. Los dat op in minuten.",
    subtitle:
      "De meeste bezoekers vertrekken omdat jouw homepage niet voor hen geschreven is. " +
      "Mister Chameleon detecteert waar ze vandaan komen en toont direct de versie van " +
      "jouw site die converteert.",
    ctas: [
      { _key: "cta-google-1-nl", label: "Zie hoe het werkt", href: "/how-it-works", variant: "primary" },
    ],
  },

  {
    _id:      variantId("hero_linkedin_vision_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_linkedin_vision",
    isActive: true,
    decisionMeta: {
      decisionLabel: "LinkedIn \u2014 Vision Forward",
      decisionSummary: "Aspirational copy for professionals scrolling a thought-leadership feed. Speaks to where the industry is going.",
      intendedAudience: "Professionals who clicked through from a LinkedIn post, ad, or shared article.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["linkedin"],
      tone: "inspiring",
      primaryGoal: "Establish thought-leadership and brand credibility for LinkedIn-sourced professionals.",
      supportingGoals: ["Drive engagement to the platform or use-case pages"],
    },
    sourceTags: ["linkedin"],
    stageTags: ["Awareness"],
    tag:      "De toekomst van websites is contextueel",
    title:    "Jouw website, altijd in aanpassing.",
    subtitle:
      "Mister Chameleon is het platform voor groeiteams die geloven dat personalisatie " +
      "geen engineeringsprint, datascience-team of enterprise contract vereist.",
    ctas: [
      { _key: "cta-li-1-nl", label: "Verken het platform", href: "/platform", variant: "primary" },
    ],
  },

  {
    _id:           variantId("hero_direct_brand_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_direct_brand",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Direct \u2014 Brand Clarity Fallback",
      decisionSummary: "Brand clarity copy for typed-URL or dark-social visitors. Leads with the core value prop. Also used as the ultimate fallback variant.",
      intendedAudience: "Visitors arriving via typed URL, bookmark, or dark social with unknown source.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Communicate the core value proposition clearly to visitors with no detectable source signal.",
      exclusions: ["Do not show to known customers — use hero_customer_onboarding instead."],
    },
    sourceTags: ["direct"],
    stageTags: ["Awareness", "Consideration"],
    layoutVariant: "hero_background",
    contentAlign:  "center",
    tag:           "Adaptieve websites, zonder de complexiteit",
    title:         "Jouw website, op maat voor elke bezoeker.",
    subtitle:
      "Mister Chameleon levert automatisch de juiste boodschap aan de juiste persoon. " +
      "Geen A/B-testen vereist. Geen engineeringsprints. Geen smoesjes.",
    ctas: [
      { _key: "cta-direct-1-nl", label: "Gratis starten",      href: "/signup",       variant: "primary"   },
      { _key: "cta-direct-2-nl", label: "Zie hoe het werkt",   href: "/how-it-works", variant: "secondary" },
    ],
    media: {
      mediaType:   "video",
      videoSource: "youtube",
      videoId:     "ioblgpA5eTo",
    },
  },

  {
    _id:      variantId("hero_consideration_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_consideration",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Returning Visitor \u2014 Consideration Re-engagement",
      decisionSummary: "Re-engagement copy for returning visitors in consideration. Acknowledges their familiarity and deepens the value pitch.",
      intendedAudience: "Returning visitors who have explored the platform across multiple sessions without converting.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "linkedin", "unknown"],
      tone: "persuasive",
      primaryGoal: "Break through evaluation paralysis by making getting started feel concrete and fast.",
      supportingGoals: ["Drive demo bookings", "Surface case studies"],
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    tag:      "Je hebt gezien wat we doen. Hier is waarom het werkt.",
    title:    "Meer bezoeken zouden niet meer verwarring moeten betekenen.",
    subtitle:
      "Je hebt het platform verkend. De vraag is niet of adaptieve websites werken - " +
      "maar hoe snel je er een live kunt krijgen. De meeste teams doen het in een middag.",
    ctas: [
      { _key: "cta-con-1-nl", label: "Boek een snelle demo",    href: "/demo",   variant: "primary"   },
      { _key: "cta-con-2-nl", label: "Bekijk live voorbeelden", href: "/cases",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_intent_direct_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_intent_direct",
    isActive: true,
    decisionMeta: {
      decisionLabel: "High Intent \u2014 Direct Conversion Push",
      decisionSummary: "Direct, urgency-led copy for pricing-page visitors and trial-ready visitors with intent score \u2265 50.",
      intendedAudience: "Visitors who have visited the pricing page, started a trial, or accumulated high intent signals in the current session.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert high-intent visitors to trial signup or sales conversation.",
      exclusions: ["Do not show to visitors with friction score ≥ 60 — use a lower-pressure variant instead."],
    },
    sourceTags: ["google-organic", "google-paid", "direct"],
    stageTags: ["Decision"],
    tag:      "Je bent er bijna - een beter conversiepercentage",
    title:    "Je volgende experiment staat al klaar.",
    subtitle:
      "Bezoekers met hoge intentie converteren wanneer de boodschap bij het moment past. " +
      "Mister Chameleon identificeert hen automatisch en toont precies de juiste versie " +
      "van jouw site - geen A/B-test configuratie, geen engineering ticket.",
    ctas: [
      { _key: "cta-int-1-nl", label: "Start je gratis proefperiode", href: "/signup", variant: "primary"   },
      { _key: "cta-int-2-nl", label: "Praat met sales",              href: "/demo",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_customer_onboarding_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_customer_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Post-Conversion \u2014 Onboarding Welcome",
      decisionSummary: "Welcome and momentum copy for newly converted customers or active customers revisiting pricing.",
      intendedAudience: "Visitors who have submitted a form (customer funnel stage) or active customers returning to the pricing page.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "google", "linkedin", "unknown"],
      tone: "direct",
      primaryGoal: "Drive immediate first-value activation \u2014 connect domain, define first rules, go live.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    tag:      "Je bent erin - laten we je eerste ervaring uitrollen",
    title:    "Welkom bij Mister Chameleon. Je engine is klaar.",
    subtitle:
      "Verbind je domein, definieer je eerste twee regels en je adaptieve homepage " +
      "gaat in minuten live. Geen engineeringsprint. Geen wachten.",
    ctas: [
      { _key: "cta-onb-1-nl", label: "Open de snelstartgids", href: "/docs/quickstart", variant: "primary" },
    ],
  },

  {
    _id:      variantId("hero_careers_default_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_careers_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 First Visit",
      decisionSummary: "Employer brand copy for first-time careers visitors with no specific role interest yet.",
      intendedAudience: "First-time visitors to the careers section who have not yet viewed a specific role.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Build employer brand appeal and encourage visitors to browse open roles.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    tag:      "Werk dat de toekomst van het web vormgeeft",
    title:    "Bouw de engine die elke website slimmer maakt.",
    subtitle:
      "Mister Chameleon is een klein, ambitieus team dat de personalisatie-infrastructuur " +
      "creëert waarop groeiteams vertrouwen. Remote-first, vol eigenaarschap, doelgedreven.",
    ctas: [
      { _key: "cta-car-d1-nl", label: "Bekijk open rollen",        href: "/vacatures", variant: "primary"   },
      { _key: "cta-car-d2-nl", label: "Leer over onze cultuur",    href: "/over-ons",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_careers_job_match_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_careers_job_match",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 Role Browser",
      decisionSummary: "Role-focused copy for candidates who have browsed the job listing page.",
      intendedAudience: "Candidates who have visited the jobs listing and are evaluating whether to apply.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Drive candidates from job listing browse to specific role detail pages.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Consideration"],
    tag:      "Rollen die met je meegroein",
    title:    "Er is hier een rol die past bij waar jij naartoe wilt.",
    subtitle:
      "Of je nu engineer, designer of groeispecia ist bent - we breiden uit naar elk vakgebied. " +
      "Vind de functie die aansluit bij jouw ambitie.",
    ctas: [
      { _key: "cta-car-m1-nl", label: "Bekijk alle open rollen", href: "/vacatures", variant: "primary" },
    ],
  },

  {
    _id:      variantId("hero_careers_high_intent_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_careers_high_intent",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 High Intent Applicant",
      decisionSummary: "Application-ready copy for candidates who have viewed a role detail AND clicked apply.",
      intendedAudience: "Candidates who viewed a specific role detail page and clicked the apply button.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the application action \u2014 remove friction and reinforce why this is the right move.",
    },
    sourceTags: ["linkedin", "google-organic", "direct"],
    stageTags: ["Decision"],
    tag:      "Één stap verwijderd van je volgende hoofdstuk",
    title:    "Klaar om te solliciteren? Wij staan klaar voor jou.",
    subtitle:
      "Je hebt je huiswerk gedaan - laten we het nu officieel maken. Ons sollicitatieproces " +
      "is snel, transparant en ontworpen om jouw tijd te respecteren.",
    ctas: [
      { _key: "cta-car-h1-nl", label: "Solliciteer nu",        href: "/vacatures", variant: "primary"   },
      { _key: "cta-car-h2-nl", label: "Stel ons een vraag",    href: "/contact",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_careers_reassurance_nl"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "hero_careers_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 Application Drop-off Recovery",
      decisionSummary: "Reassurance copy for visitors who dropped off mid-application or submitted and are re-visiting.",
      intendedAudience: "Candidates who started but did not complete an application, or who already submitted and returned.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates by reducing anxiety about the application process.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration", "Retention"],
    tag:      "Geen haast. Echte kansen.",
    title:    "Nog aan het nadenken? Dat is prima.",
    subtitle:
      "Grote beslissingen verdienen zorgvuldige overweging. Blader op jouw tempo door " +
      "rollen - of laat ons weten wat je zoekt en we nemen contact op wanneer er iets past.",
    ctas: [
      { _key: "cta-car-r1-nl", label: "Bekijk open rollen",   href: "/vacatures",  variant: "primary"   },
      { _key: "cta-car-r2-nl", label: "Stuur een open brief", href: "/open-brief", variant: "secondary" },
    ],
  },

  // Page banner variants (NL)

  {
    _id:           variantId("hero_page_banner_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_page_banner",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Generic Fallback",
      decisionSummary: "Neutral page banner for legal, changelog, and documentation pages with no personalisation signal needed.",
      intendedAudience: "Any visitor viewing a static utility or documentation page.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration", "decision", "retention"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide neutral page context without injecting a sales message.",
    },
    sourceTags: [],
    stageTags: ["Awareness", "Consideration", "Decision", "Retention"],
    layoutVariant: "hero_page_banner",
    tag:           "Mister Chameleon",
    title:         "Adaptieve personalisatie voor het moderne web.",
    subtitle:      "Elke bezoeker is anders. Jouw website ook.",
    ctas: [],
  },

  {
    _id:           variantId("hero_page_banner_high_intent_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_page_banner_high_intent",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 High Intent",
      decisionSummary: "Conversion-nudging page banner for high-intent visitors showing strong purchase signals.",
      intendedAudience: "Visitors with intent score \u2265 50 or who have visited the pricing page.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "urgency",
      primaryGoal: "Nudge high-intent visitors toward a conversion action (trial or demo).",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    layoutVariant: "hero_page_banner",
    tag:           "Klaar om te beginnen?",
    title:         "Je bent er bijna - je eerste adaptieve bezoeker.",
    subtitle:
      "Setup duurt 15 minuten. Je eerste gepersonaliseerde ervaring kan vandaag live gaan.",
    ctas: [
      { _key: "pb-hi-1-nl", label: "Gratis proefperiode starten", href: "/order/starter", variant: "primary"   },
      { _key: "pb-hi-2-nl", label: "Boek een democall",           href: "/contact",        variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_consideration_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_page_banner_consideration",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Consideration Stage",
      decisionSummary: "Value-reinforcing page banner for consideration-stage visitors.",
      intendedAudience: "Visitors in consideration stage who have explored multiple pages across multiple sessions.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Reinforce value and reduce evaluation friction for returning visitors.",
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "Zie het in actie",
    title:         "Zie hoe teams zoals het jouwe meer bezoekers converteren.",
    subtitle:
      "Echte resultaten, echte klanten - geen giswerk. Bekijk de demo en oordeel zelf.",
    ctas: [
      { _key: "pb-co-1-nl", label: "Bekijk de demo",      href: "/demo",   variant: "primary"   },
      { _key: "pb-co-2-nl", label: "Lees casestudies",    href: "/cases",  variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_returning_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_page_banner_returning",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Returning Visitor",
      decisionSummary: "Familiarity-acknowledging page banner for visitors on their second or later session.",
      intendedAudience: "Returning visitors across any funnel stage.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "google", "unknown"],
      tone: "persuasive",
      primaryGoal: "Acknowledge returning visitor status and deepen engagement.",
    },
    sourceTags: ["direct"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "Welkom terug",
    title:         "Fijn je weer te zien.",
    subtitle:
      "Ga verder waar je gebleven was - of ontdek een deel van het platform dat je nog niet hebt gezien.",
    ctas: [
      { _key: "pb-re-1-nl", label: "Ga verder naar demo", href: "/demo",      variant: "primary"   },
      { _key: "pb-re-2-nl", label: "Bekijk wat nieuw is", href: "/changelog", variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_enterprise_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_page_banner_enterprise",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Enterprise Visitor",
      decisionSummary: "Enterprise-grade credibility banner for visitors from large companies or showing expansion signals.",
      intendedAudience: "Visitors enriched as enterprise-size companies, or active customers revisiting pricing.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Signal platform readiness for enterprise scale and compliance needs.",
    },
    sourceTags: ["linkedin", "direct"],
    stageTags: ["Consideration", "Decision"],
    layoutVariant: "hero_page_banner",
    tag:           "Enterprise personalisatie",
    title:         "Personalisatie op schaal, zonder de enterprise-installatiekosten.",
    subtitle:
      "Dedicated onboarding, SLA-ondersteuning, white-label opties en een team dat de telefoon opneemt.",
    ctas: [
      { _key: "pb-en-1-nl", label: "Boek een enterprise gesprek", href: "/contact", variant: "primary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_awareness_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_page_banner_awareness",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Awareness Stage",
      decisionSummary: "Lightly adaptive page banner for awareness-stage visitors or unqualified defaults.",
      intendedAudience: "First-time or unqualified visitors viewing inner pages.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Orient awareness-stage visitors and gently introduce the platform proposition.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Awareness"],
    layoutVariant: "hero_page_banner",
    tag:           "Ontdek Mister Chameleon",
    title:         "Jouw website, gepersonaliseerd voor elke bezoeker.",
    subtitle:
      "Mister Chameleon past koppen, bewijs en CTA's in realtime aan - " +
      "geen code-aanpassingen, geen privacycompromissen.",
    ctas: [
      { _key: "pb-aw-1-nl", label: "Gratis proefperiode starten", href: "/order/starter", variant: "primary"   },
      { _key: "pb-aw-2-nl", label: "Bekijk de demo",              href: "/demo",           variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_friction_nl"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "hero_page_banner_friction",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Form Drop-off Recovery",
      decisionSummary: "Low-pressure re-engagement banner for visitors who dropped off a form or showed hesitation signals.",
      intendedAudience: "Visitors who started but did not complete a form or CTA, or who have a friction score \u2265 40.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage hesitant visitors with a lower-friction path back to conversion.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "Geen haast",
    title:         "Nog aan het afwegen? Dat is helemaal prima.",
    subtitle:
      "De meeste teams proberen één regel, zien de stijging en kijken nooit meer achterom. " +
      "Maar de beslissing moet eerst goed voelen. " +
      "Praat met iemand, lees hoe het werkt, of blijf gewoon verkennen.",
    ctas: [
      { _key: "pb-fr-1-nl", label: "Praat eerst met iemand", href: "/contact",      variant: "primary"   },
      { _key: "pb-fr-2-nl", label: "Zie hoe het werkt",      href: "/how-it-works", variant: "secondary" },
    ],
  },

  // Proof variants (NL)

  {
    _id:      variantId("proof_cases_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_cases",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Case Studies & ROI",
      decisionSummary: "Concrete case studies and ROI numbers for visitors evaluating real-world results.",
      intendedAudience: "Visitors who have browsed case study pages or are in consideration/decision stage.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Convert sceptical evaluators with measurable outcome proof.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration", "Decision"],
    title:    "Conversieverbeteringen die voor zich spreken",
    items: [
      {
        _key:  "cases-item-1-nl",
        title: "3,2x meer gekwalificeerde leads",
        text:
          "SaaS-teams die Mister Chameleon gebruiken zien gemiddeld een 3,2x stijging in " +
          "demo-aanvragen binnen 30 dagen na livegang - zonder engineeringaanpassingen.",
      },
      {
        _key:  "cases-item-2-nl",
        title: "Eerste ervaring live in minder dan 5 minuten",
        text:
          "Verbind je domein, definieer twee regels en je eerste adaptieve ervaring is live. " +
          "De meeste teams leveren binnen één middag.",
      },
      {
        _key:  "cases-item-3-nl",
        title: "12 bezoekerssignalen, realtime geëvalueerd",
        text:
          "Bron, apparaat, campagne, recency en meer - elk bezoek triggert een stille evaluatie " +
          "zodat de juiste ervaring laadt voordat de pagina wordt weergegeven.",
      },
    ],
  },

  {
    _id:      variantId("proof_vision_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_vision",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Analyst & Industry Recognition",
      decisionSummary: "Analyst quotes and industry recognition for vision-led visitors, particularly from LinkedIn.",
      intendedAudience: "Professionals and executives who respond to thought-leadership and industry validation.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["linkedin"],
      tone: "inspiring",
      primaryGoal: "Establish platform credibility with analyst and industry validation.",
    },
    sourceTags: ["linkedin"],
    stageTags: ["Awareness"],
    title:    "Wat de industrie zegt",
    items: [
      {
        _key:  "vision-item-1-nl",
        title: "Erkend door Product Hunt",
        text:
          "#1 Product van de Dag - 'Mister Chameleon is wat adaptieve marketinginfrastructuur " +
          "zou moeten zijn. Eindelijk personalisatie zonder de platformbelasting.'",
      },
      {
        _key:  "vision-item-2-nl",
        title: "Gebouwd voor het volgende decennium van groei",
        text:
          "Speciaal gebouwd voor het tijdperk waarin elke bezoeker een gepersonaliseerde " +
          "ervaring verwacht, maar engineeringcapaciteit de schaarsste resource in het team is.",
      },
      {
        _key:  "vision-item-3-nl",
        title: "Personalisatie zonder engineers - op schaal",
        text:
          "Het enige platform dat decision-engine-grade adaptiviteit brengt naar marketing- " +
          "en productteams zonder een machine learning-afdeling.",
      },
    ],
  },

  {
    _id:      variantId("proof_platform_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_platform",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Platform Scale & Reliability",
      decisionSummary: "Platform scale and reliability stats for technical visitors evaluating infrastructure.",
      intendedAudience: "Technical evaluators and developers assessing platform scalability and reliability.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Reassure technical decision-makers on platform scale, uptime, and reliability.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration", "Decision"],
    title:    "Infrastructuur waarop je kunt vertrouwen",
    items: [
      {
        _key:  "platform-item-1-nl",
        title: "Edge-native beslissingsengine",
        text:
          "Contextdetectie en ervaringsresolutie vinden plaats aan de CDN-edge - " +
          "sub-5ms latency zonder origin round-trip, ongeacht de locatie van de bezoeker.",
      },
      {
        _key:  "platform-item-2-nl",
        title: "99,99% uptime SLA",
        text:
          "Ingezet op een globaal actief-actief edge-netwerk met automatische failover, " +
          "zero-downtime implementaties en een openbare statuspagina.",
      },
      {
        _key:  "platform-item-3-nl",
        title: "Standaard GDPR- en CCPA-compliant",
        text:
          "Er worden geen persoonsgegevens verzameld of opgeslagen. Elk signaal wordt " +
          "ephemeral geëvalueerd, in het geheugen, in realtime. De privacy van je bezoekers " +
          "wordt automatisch beschermd.",
      },
    ],
  },

  {
    _id:      variantId("proof_default_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Broad Credibility",
      decisionSummary: "General credibility block for new visitors with no specific segment signal.",
      intendedAudience: "Any new visitor where no more specific proof variant matches.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Establish baseline trust and credibility for unqualified visitors.",
    },
    sourceTags: ["google-organic", "linkedin", "direct"],
    stageTags: ["Awareness", "Consideration"],
    title:    "Vertrouwd door groeiteams wereldwijd",
    items: [
      {
        _key:  "def-item-1-nl",
        title: "2.000+ teams passen zich al aan",
        text:
          "Van vroege SaaS-startups tot enterprise marketingteams - Mister Chameleon drijft " +
          "adaptieve ervaringen in verschillende sectoren, zonder een enkele engineeringsprint.",
      },
      {
        _key:  "def-item-2-nl",
        title: "Live in minder dan 5 minuten",
        text:
          "Verbind je domein, schrijf twee regels en je eerste adaptieve ervaring is live " +
          "vóór je volgende vergadering. De meeste teams leveren dezelfde middag.",
      },
      {
        _key:  "def-item-3-nl",
        title: "Geen persoonsgegevens. Volledige compliance.",
        text:
          "Mister Chameleon slaat nooit bezoekersdata op. Elk signaal wordt ephemeral " +
          "geëvalueerd aan de edge - GDPR- en CCPA-compliant zonder een vinger uit te steken.",
      },
    ],
  },

  {
    _id:      variantId("proof_stats_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_stats",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Hard Numbers for Buyers",
      decisionSummary: "Hard numbers and conversion statistics for high-intent buyers who need quantitative justification.",
      intendedAudience: "High-intent visitors in decision stage who respond to data-driven proof.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Provide the statistical justification a high-intent buyer needs to proceed.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "De cijfers die ertoe doen",
    items: [
      {
        _key:  "stats-item-1-nl",
        title: "Gemiddeld 3,2x meer gekwalificeerde leads",
        text:
          "Teams die Mister Chameleon 30 dagen gebruiken zien gemiddeld een 3,2x stijging " +
          "in demo-aanvragen - zonder advertentiebudget te verhogen of de site opnieuw te ontwerpen.",
      },
      {
        _key:  "stats-item-2-nl",
        title: "Sub-5 ms contextevaluatie aan de edge",
        text:
          "Elk bezoek wordt in realtime geëvalueerd voordat de eerste byte wordt verstuurd. " +
          "Nul latency-impact. Nul impact op Core Web Vitals.",
      },
      {
        _key:  "stats-item-3-nl",
        title: "12 bezoekerssignalen, gelijktijdig geëvalueerd",
        text:
          "Bron, apparaat, geo, bedrijf, campagne, recency, intentiescore en meer - " +
          "gecombineerd tot één context-snapshot dat de ervaringsbeslissing stuurt.",
      },
    ],
  },

  {
    _id:      variantId("proof_reassurance_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Safety & Social Proof",
      decisionSummary: "Safety and social proof for visitors with doubt, hesitation, or high friction signals.",
      intendedAudience: "Visitors with elevated friction scores, form drop-offs, or hesitation behaviour.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Remove doubt and rebuild trust for hesitant visitors.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    title:    "Vertrouwd door teams die in jouw positie waren",
    items: [
      {
        _key:  "reas-item-1-nl",
        title: "Geen lock-in. Op elk moment annuleren.",
        text:
          "Mister Chameleon werkt naast je bestaande site - geen sloop-en-vervanging, " +
          "geen implementatie van zes maanden. Stap op elk moment weg zonder één regel content te verliezen.",
      },
      {
        _key:  "reas-item-2-nl",
        title: "Onboarding-ondersteuning inbegrepen",
        text:
          "Elk nieuw account krijgt een onboarding-gesprek van 30 minuten. Ons team helpt " +
          "je je top 3 bezoekersegmenten te identificeren en je eerste regels te schrijven - " +
          "zonder extra kosten.",
      },
      {
        _key:  "reas-item-3-nl",
        title: "Gebruikt door teams zoals het jouwe",
        text:
          "De meeste van onze klanten kwamen naar ons na frustratie met tools die te complex " +
          "of te eenvoudig waren. Mister Chameleon is gebouwd voor precies dat gat.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_default_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_careers_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Employer Brand",
      decisionSummary: "Employer brand proof for first-time careers visitors highlighting culture and team.",
      intendedAudience: "First-time careers visitors with no specific role interest yet.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Build employer brand appeal for unqualified careers visitors.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    title:    "Leven bij Mister Chameleon",
    items: [
      {
        _key:  "car-def-1-nl",
        title: "Klein team, groot eigenaarschap",
        text:
          "We zijn een hecht team waarbij iedereen een betekenisvol stuk van het product bezit. " +
          "Geen ticket-wachtrijen, geen midden-management. Alleen jij, je vakmanschap en impact.",
      },
      {
        _key:  "car-def-2-nl",
        title: "Remote-first, async-vriendelijk",
        text:
          "Werk van overal in Europa. Onze cultuur is gebouwd op heldere communicatie, " +
          "gefocust werk en de occasionele teamweek waarop we elkaar nog meer waarderen.",
      },
      {
        _key:  "car-def-3-nl",
        title: "Gedragen door een missie die het waard is te delen",
        text:
          "We geloven dat elke website met elke bezoeker zou moeten praten zoals een mens dat doet. " +
          "Als die zin je aanzet om iets te bouwen, pas jij precies bij ons.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_team_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_careers_team",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Team Quality",
      decisionSummary: "Team culture and quality proof for candidates evaluating role fit.",
      intendedAudience: "Candidates who have viewed a specific role detail and are evaluating team fit.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Convince role-interested candidates that the team is worth joining.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Consideration"],
    title:    "De mensen met wie je zou werken",
    items: [
      {
        _key:  "car-team-1-nl",
        title: "Engineers die vakmanschap waarderen",
        text:
          "Ons engineeringteam geeft diepgaand om de kwaliteit van wat ze bouwen. " +
          "Code reviews zijn grondig, documentatie is echt en technische schuld wordt bijgehouden.",
      },
      {
        _key:  "car-team-2-nl",
        title: "Groeimensen die denken in systemen",
        text:
          "Ons groeiteam combineert data-intuïtie met creatief instinct. " +
          "We draaien experimenten, geen campagnes - en we delen resultaten, ook de mislukte.",
      },
      {
        _key:  "car-team-3-nl",
        title: "Een cultuur van eerlijke feedback",
        text:
          "We geven directe, vriendelijke feedback - en verwachten dat terug. " +
          "Niemand groeit in een echokamer. We zijn liever eerlijk dan comfortabel.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_reassurance_nl"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "proof_careers_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Fair Hiring Process",
      decisionSummary: "Reassurance proof for application drop-off candidates emphasising fair and transparent process.",
      intendedAudience: "Candidates who started but did not complete an application or who are hesitating.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates by emphasising a transparent, low-pressure hiring process.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration", "Retention"],
    title:    "Een proces ontworpen voor echte mensen",
    items: [
      {
        _key:  "car-reas-1-nl",
        title: "3 fases, geen verrassingen",
        text:
          "Introgesprek, vaardigheidsgesprek, aanbod. Geen thuisopdrachten die je weekend opslokken. " +
          "Geen whiteboard-puzzels. Gewoon echte gesprekken over echt werk.",
      },
      {
        _key:  "car-reas-2-nl",
        title: "We geven altijd feedback",
        text:
          "Elke kandidaat krijgt een persoonlijke reactie en elke afwijzing bevat specifieke " +
          "feedback. We geloven dat dat het minimumstandaard is om jouw tijd te respecteren.",
      },
      {
        _key:  "car-reas-3-nl",
        title: "Vragen zijn welkom in elke fase",
        text:
          "Jij evalueert ons net zo goed als wij jou evalueren. Vraag alles - over de rol, " +
          "het team, het product, het salaris, de roadmap. We antwoorden eerlijk.",
      },
    ],
  },

  // CTA variants (NL)

  {
    _id:      variantId("cta_guide_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_guide",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Nurture: Free Playbook",
      decisionSummary: "Low-friction nurture CTA offering a free playbook download for early-stage visitors.",
      intendedAudience: "Awareness or early-consideration visitors not yet ready for a trial or demo.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "unknown"],
      tone: "educational",
      primaryGoal: "Capture email via playbook download to start nurture sequence.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Awareness"],
    title:    "Download het Adaptieve Website Draaiboek",
    text:
      "Een praktische, no-nonsense gids voor het personaliseren van je homepage voor je " +
      "drie waardevolste verkeersbronnen. Gratis. Geen e-mailgate.",
    ctas: [
      { _key: "cta-guide-1-nl", label: "Download het draaiboek", href: "/playbook", variant: "primary" },
    ],
  },

  {
    _id:      variantId("cta_platform_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_platform",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Product-led: Start Free",
      decisionSummary: "Product-led signup CTA for visitors showing platform evaluation intent.",
      intendedAudience: "Visitors who have explored features or platform pages and are evaluating signing up.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Drive free trial signup with minimal friction.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Consideration"],
    title:    "Begin gratis met bouwen",
    text:
      "Je eerste adaptieve ervaring is gratis, voor altijd. Geen creditcard, geen salesgesprek, " +
      "geen onboarding van zes maanden. Verbind, configureer en lever.",
    ctas: [
      { _key: "cta-platform-1-nl", label: "Maak je gratis account aan", href: "/signup",       variant: "primary"   },
      { _key: "cta-platform-2-nl", label: "Zie hoe het werkt",          href: "/how-it-works", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_meeting_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_meeting",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Sales: Book Demo",
      decisionSummary: "Sales-led demo booking CTA for visitors ready for a human conversation.",
      intendedAudience: "Consideration or decision-stage visitors who prefer a guided walkthrough over self-serve.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Book a demo call to begin the sales conversation.",
    },
    sourceTags: ["linkedin", "google-paid"],
    stageTags: ["Consideration", "Decision"],
    title:    "Zie Mister Chameleon in actie",
    text:
      "Boek een live demo van 20 minuten. We laten je precies zien hoe je homepage er " +
      "voor je drie belangrijkste bezoekerssegmenten uit zou zien.",
    ctas: [
      { _key: "cta-meeting-1-nl", label: "Boek een demo",   href: "/demo",   variant: "primary"   },
      { _key: "cta-meeting-2-nl", label: "Gratis starten",  href: "/signup", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_demo_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_demo",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Consideration: See It In Action",
      decisionSummary: "Interactive demo CTA for consideration-stage visitors who want to experience the product before committing.",
      intendedAudience: "Consideration-stage visitors who want to see the product in action before signing up.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Drive demo engagement to convert consideration-stage visitors.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Zie precies hoe het er voor jouw site uit zou zien",
    text:
      "Boek een scherm-share van 20 minuten. We laten je een live adaptieve ervaring zien " +
      "die is gebouwd rondom je drie belangrijkste bezoekerssegmenten. Geen presentaties.",
    ctas: [
      { _key: "cta-demo-1-nl", label: "Boek een demo van 20 minuten",  href: "/demo",   variant: "primary"   },
      { _key: "cta-demo-2-nl", label: "Lees eerst casestudies",        href: "/cases",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_onboarding_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Customer: First Value Fast",
      decisionSummary: "Onboarding-focused CTA for newly converted customers to reach first value quickly.",
      intendedAudience: "Newly converted customers entering the onboarding flow.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "direct",
      primaryGoal: "Drive first-value activation: connect domain and launch first live variant.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Je eerste adaptieve ervaring is één stap verwijderd",
    text:
      "Volg de snelstartgids om je domein te verbinden, je eerste twee regels in te stellen " +
      "en de engine live te zien gaan - meestal in minder dan 10 minuten.",
    ctas: [
      { _key: "cta-onb-1-nl", label: "Open snelstartgids",                  href: "/docs/quickstart", variant: "primary"   },
      { _key: "cta-onb-2-nl", label: "Praat met onboarding-ondersteuning",  href: "/contact",         variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_expansion_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_expansion",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Active Customer: Upgrade Prompt",
      decisionSummary: "Expansion CTA for active customers revisiting pricing, showing upgrade/upsell intent.",
      intendedAudience: "Active customers (customer funnel stage) who are revisiting pricing or feature pages.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert expansion intent into an upgrade or upsell conversation.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Klaar voor het volgende niveau?",
    text:
      "Je huidige plan doet het werk. Maar als je tegen limieten aanloopt voor regels, " +
      "varianten of tenants - is het tijd om te praten. Upgraden duurt minder dan 5 minuten.",
    ctas: [
      { _key: "cta-exp-1-nl", label: "Bekijk upgrade-opties",          href: "/pricing", variant: "primary"   },
      { _key: "cta-exp-2-nl", label: "Praat met je accountmanager",    href: "/contact", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_browse_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_careers_browse",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Browse Open Roles",
      decisionSummary: "Role browsing CTA for careers visitors with no specific role interest yet.",
      intendedAudience: "First-time careers visitors who have not yet viewed a specific role.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Drive careers visitors from homepage to the jobs listing page.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    title:    "Vind de rol die bij je volgende hoofdstuk past",
    text:
      "We werven in engineering, groei, design en klantsucces. " +
      "Bekijk wat open staat - of stuur een open sollicitatie als er nog niets past.",
    ctas: [
      { _key: "cta-cbr-1-nl", label: "Bekijk alle open rollen",  href: "/vacatures",  variant: "primary"   },
      { _key: "cta-cbr-2-nl", label: "Stuur een open brief",     href: "/open-brief", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_apply_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_careers_apply",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 High Intent: Apply Now",
      decisionSummary: "Application CTA for candidates who have viewed a role and are ready to apply.",
      intendedAudience: "Candidates who viewed a specific role detail page and clicked the apply button.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the application action with minimal friction.",
    },
    sourceTags: ["linkedin", "google-organic", "direct"],
    stageTags: ["Decision"],
    title:    "Je hebt je rol gevonden. Laten we het officieel maken.",
    text:
      "De sollicitatie duurt ongeveer 10 minuten. Geen motivatiebrief vereist - " +
      "vertel ons gewoon wat je hebt gebouwd en wat je daarna wilt bouwen.",
    ctas: [
      { _key: "cta-cap-1-nl", label: "Solliciteer nu",               href: "/vacatures", variant: "primary"   },
      { _key: "cta-cap-2-nl", label: "Stel ons eerst een vraag",     href: "/contact",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_open_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_careers_open",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Open Application",
      decisionSummary: "Low-pressure open application CTA for candidates not yet ready to apply to a specific role.",
      intendedAudience: "Candidates who started but did not complete an application or who dropped off.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates via a lower-commitment open application path.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    title:    "Nog niet helemaal klaar? Stel jezelf gewoon voor.",
    text:
      "Stuur ons een open brief. Vertel ons wat je doet, wat je zoekt en waarom " +
      "Mister Chameleon je aandacht trok. Geen vereiste rol.",
    ctas: [
      { _key: "cta-cop-1-nl", label: "Stuur een open brief", href: "/open-brief", variant: "primary"   },
      { _key: "cta-cop-2-nl", label: "Bekijk open rollen",   href: "/vacatures",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_contact_nl"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "cta_careers_contact",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Post-Conversion: Application Received",
      decisionSummary: "Post-application CTA confirming receipt and offering a direct contact channel.",
      intendedAudience: "Candidates who have already submitted an application and are revisiting the site.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Confirm application status and provide a human contact channel to reduce post-submission anxiety.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Sollicitatie ontvangen. We nemen contact op.",
    text:
      "Je hoort van ons binnen 5 werkdagen. In de tussentijd kun je gerust contact opnemen " +
      "als je vragen hebt over de rol, het proces of het team.",
    ctas: [
      { _key: "cta-cco-1-nl", label: "Neem direct contact op", href: "/contact", variant: "primary" },
    ],
  },

  // Feature variants (NL)

  {
    _id:      variantId("feature_core_nl"),
    _type:    "featureVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "feature_core",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Core Platform Capabilities",
      decisionSummary: "Three core platform capabilities overview for consideration-stage visitors evaluating the platform.",
      intendedAudience: "Visitors in consideration who want a concise overview of platform capabilities.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Communicate the three core platform capabilities clearly.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Alles wat je nodig hebt om op schaal te personaliseren",
    subtitle: "Drie mogelijkheden, één platform - geen engineeringsprints vereist.",
    items: [
      {
        _key:  "feat-core-1-nl",
        title: "Adaptieve beslissingsengine",
        body:
          "Realtime bezoekerscontext - bron, apparaat, geo, bedrijf en campagne - " +
          "geëvalueerd aan de edge in minder dan 5 ms. Geen cookies. Geen persoonsgegevens.",
        icon:  "zap",
      },
      {
        _key:  "feat-core-2-nl",
        title: "CMS-aangedreven variantenbibliotheek",
        body:
          "Schrijf hero-, bewijs- en CTA-varianten eenmalig in Sanity Studio. " +
          "De engine selecteert automatisch de juiste voor elke bezoeker.",
        icon:  "layers",
      },
      {
        _key:  "feat-core-3-nl",
        title: "Experiment- en analyselaag",
        body:
          "A/B-test elke variantslot zonder code. Volg geserveerde varianten en " +
          "conversieverbeteringen met ingebouwde analyses - geen externe tools nodig.",
        icon:  "bar-chart-2",
      },
    ],
  },

  {
    _id:           variantId("feature_grid_primary_nl"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "feature_grid_primary",
    layoutVariant: "feature_grid",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Full Grid Overview",
      decisionSummary: "Full six-item feature grid for consideration-stage visitors doing thorough platform evaluation.",
      intendedAudience: "Visitors in detailed evaluation mode who want comprehensive feature coverage.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide complete feature coverage for thorough platform evaluators.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration"],
    title:    "Alles wat je nodig hebt om op schaal te personaliseren",
    subtitle: "Drie mogelijkheden. Één platform. Nul engineeringsprints.",
    items: [
      {
        _key:  "fg-1-nl",
        title: "Adaptieve beslissingsengine",
        body:
          "Realtime bezoekerscontext - bron, apparaat, geo, bedrijf en campagne - " +
          "geëvalueerd aan de edge in minder dan 5 ms. Geen cookies. Geen persoonsgegevens.",
        icon:  "zap",
      },
      {
        _key:  "fg-2-nl",
        title: "CMS-aangedreven variantenbibliotheek",
        body:
          "Schrijf hero-, bewijs- en CTA-varianten eenmalig in Sanity Studio. " +
          "De engine selecteert automatisch de juiste voor elke bezoeker.",
        icon:  "layers",
      },
      {
        _key:  "fg-3-nl",
        title: "Experiment- en analyselaag",
        body:
          "A/B-test elke variantslot zonder code te schrijven. Volg geserveerde varianten " +
          "en conversieverbeteringen met ingebouwde analyses - geen externe tools vereist.",
        icon:  "bar-chart-2",
      },
      {
        _key:  "fg-4-nl",
        title: "Multi-tenant architectuur",
        body:
          "Voer adaptieve ervaringen uit voor meerdere merken of producten vanaf één platform. " +
          "Tenant-scoped regels, content en analyses - allemaal op één plek.",
        icon:  "globe",
      },
      {
        _key:  "fg-5-nl",
        title: "Regelbuilder zonder code",
        body:
          "Definieer condities en wijs variantplannen toe via een klik-interface. " +
          "Geen SQL, geen regex, geen engineering-tickets - gewoon logische, leesbare regels.",
        icon:  "sliders",
      },
      {
        _key:  "fg-6-nl",
        title: "Edge-native, globaal snel",
        body:
          "Elke beslissing draait aan de CDN-edge - sub-5 ms latency ongeacht waar je bezoeker is. " +
          "Core Web Vitals blijven groen. Conversies stijgen.",
        icon:  "shield",
      },
    ],
  },

  {
    _id:           variantId("feature_highlights_nl"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "feature_highlights",
    layoutVariant: "feature_highlights",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Key Differentiators",
      decisionSummary: "Three key differentiators for consideration-stage visitors comparing alternatives.",
      intendedAudience: "Visitors in consideration who are comparing Mister Chameleon to alternatives.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Differentiate Mister Chameleon on the three dimensions that matter most to evaluators.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Waarom groeiteams voor Mister Chameleon kiezen",
    subtitle: "Personalisatie die werkt zonder een machine learning-team.",
    items: [
      {
        _key:  "fh-1-nl",
        title: "Context-bewust, niet cookie-afhankelijk",
        body:
          "Mister Chameleon leest 12 bezoekerssignalen - bron, bedrijf, apparaat, recency " +
          "en intentie - aan de edge in realtime. Geen cookies nodig. Geen cookiebanner vereist. " +
          "GDPR-compliant by design.",
        icon:  "eye",
      },
      {
        _key:  "fh-2-nl",
        title: "Regels die je kunt lezen, schrijven en vertrouwen",
        body:
          "Elke ervaringsbeslissing wordt gestuurd door een regel die je in gewone taal hebt gedefinieerd. " +
          "Geen black-box ML-model dat je niet aan je CEO kunt uitleggen. " +
          "Elke geserveerde variant wordt gelogd en auditeerbaar.",
        icon:  "check-circle",
      },
      {
        _key:  "fh-3-nl",
        title: "Integreert met je CMS in minuten",
        body:
          "Verbind Sanity, Storyblok of een headless CMS dat je al gebruikt. " +
          "Schrijf varianttekst in het CMS dat je kent - Mister Chameleon regelt de " +
          "routing en het serveren automatisch.",
        icon:  "plug",
      },
    ],
  },

  {
    _id:           variantId("feature_comparison_nl"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    locale:        "nl",
    key:           "feature_comparison",
    layoutVariant: "feature_comparison",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Comparison Table",
      decisionSummary: "Side-by-side comparison for decision-stage visitors doing final competitive evaluation.",
      intendedAudience: "Decision-stage visitors doing final comparison against competing platforms.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Win the final comparison moment by demonstrating clear advantage on key criteria.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Decision"],
    title:    "Hoe Mister Chameleon zich verhoudt",
    subtitle: "Niet alle personalisatieplatforms zijn gelijk gebouwd.",
    items: [
      {
        _key:  "fc-1-nl",
        title: "Regelbuilder zonder code",
        body:
          "Mister Chameleon: ja - punt-en-klik conditie-editor, leesbaar in gewone taal. " +
          "De meeste platforms: vereist developer-configuratie of een datascience-pipeline.",
        icon:  "sliders",
      },
      {
        _key:  "fc-2-nl",
        title: "Edge-native evaluatie",
        body:
          "Mister Chameleon: beslissingen draaien aan de CDN-edge, sub-5 ms. " +
          "De meeste platforms: server-side evaluatie voegt 100-400 ms toe per paginalading.",
        icon:  "zap",
      },
      {
        _key:  "fc-3-nl",
        title: "Cookie-vrij en GDPR-compliant",
        body:
          "Mister Chameleon: geen persoonsgegevens opgeslagen, geen cookiebanner vereist. " +
          "De meeste platforms: vereisen cookietoestemming en dataverwerkingsovereenkomsten.",
        icon:  "shield",
      },
      {
        _key:  "fc-4-nl",
        title: "Multi-tenant standaard",
        body:
          "Mister Chameleon: tenant-scoped regels, content en analyses inbegrepen in alle plannen. " +
          "De meeste platforms: multi-tenancy is een enterprise add-on tegen 3-10x de prijs.",
        icon:  "globe",
      },
    ],
  },

  // Conversion variants (NL)

  {
    _id:      variantId("conversion_signup_nl"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "conversion_signup",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Product-led Signup",
      decisionSummary: "Product-led account creation entry point for decision-stage visitors ready to start.",
      intendedAudience: "Decision-stage visitors ready to create an account and start the trial.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Drive account creation with minimal friction.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "Start gratis. Upgrade wanneer je klaar bent.",
    text:
      "Maak je account aan in minder dan 60 seconden. Geen creditcard, geen salesgesprek, " +
      "geen onboarding van zes maanden. Je eerste adaptieve ervaring wordt vandaag geleverd.",
    ctas: [
      { _key: "conv-signup-1-nl", label: "Maak je gratis account aan", href: "/signup", variant: "primary"   },
      { _key: "conv-signup-2-nl", label: "Bekijk een live demo",        href: "/demo",   variant: "secondary" },
    ],
    urgencyLabel: "Sluit je aan bij 2.000+ groeiteams die Mister Chameleon al gebruiken",
  },

  {
    _id:      variantId("conversion_demo_nl"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "conversion_demo",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Book a Demo",
      decisionSummary: "Sales-led demo booking for consideration-stage visitors who prefer a guided walkthrough.",
      intendedAudience: "Consideration-stage visitors who prefer a human walkthrough before committing.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Book a demo call to begin the guided sales process.",
    },
    sourceTags: ["linkedin", "google-paid"],
    stageTags: ["Consideration"],
    title:    "Zie jouw site, gepersonaliseerd. Live.",
    text:
      "Boek een scherm-share van 20 minuten en we laten je exact zien hoe Mister Chameleon " +
      "jouw drie meest waardevolle bezoekerssegmenten zou bedienen. Neem je echte site mee.",
    ctas: [
      { _key: "conv-demo-1-nl", label: "Boek een live demo",    href: "/demo",   variant: "primary"   },
      { _key: "conv-demo-2-nl", label: "Begin liever gratis",   href: "/signup", variant: "secondary" },
    ],
    urgencyLabel: "Meestal ingepland binnen 24 uur",
  },

  {
    _id:      variantId("conversion_contact_nl"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    locale:   "nl",
    key:      "conversion_contact",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Open Contact",
      decisionSummary: "Open contact channel for consideration-stage visitors who want human contact over automation.",
      intendedAudience: "Consideration-stage visitors with specific questions or concerns before converting.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide a human contact path for visitors with unanswered questions.",
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    title:    "Heb je een vraag? We zijn er voor je.",
    text:
      "Of je nu het platform evalueert, hulp nodig hebt bij de setup, of gewoon met een " +
      "mens wilt praten - stuur ons een bericht en we reageren binnen één werkdag.",
    ctas: [
      { _key: "conv-con-1-nl", label: "Stuur een bericht", href: "/contact", variant: "primary" },
    ],
    urgencyLabel: "Reactie binnen één werkdag",
  },

  // ── DE (German) locale variants ────────────────────────────────────────────
  //
  // Same structure as NL variants above, with locale: "de".

  // Hero variants (DE)

  {
    _id:      variantId("hero_google_problem_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_google_problem",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Google Search \u2014 Problem Aware",
      decisionSummary: "Urgency-led copy for search visitors who typed a problem keyword. Names the pain before offering the solution.",
      intendedAudience: "Visitors arriving from Google organic or paid search who searched a pain-specific query.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google"],
      tone: "direct",
      primaryGoal: "Mirror the searcher's pain to capture attention, then drive them to the how-it-works page.",
    },
    sourceTags: ["google-organic", "google-paid"],
    stageTags: ["Awareness", "Consideration"],
    tag:      "Schluss damit, jeden Besucher auf dieselbe Seite zu schicken",
    title:    "Deine Website spricht niemanden an. Ändere das in Minuten.",
    subtitle:
      "Die meisten Besucher verlassen deine Seite, weil deine Homepage nicht für sie " +
      "geschrieben wurde. Mister Chameleon erkennt, woher sie kommen, und liefert sofort " +
      "die Version deiner Website, die konvertiert.",
    ctas: [
      { _key: "cta-google-1-de", label: "So funktioniert es", href: "/how-it-works", variant: "primary" },
    ],
  },

  {
    _id:      variantId("hero_linkedin_vision_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_linkedin_vision",
    isActive: true,
    decisionMeta: {
      decisionLabel: "LinkedIn \u2014 Vision Forward",
      decisionSummary: "Aspirational copy for professionals scrolling a thought-leadership feed. Speaks to where the industry is going.",
      intendedAudience: "Professionals who clicked through from a LinkedIn post, ad, or shared article.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["linkedin"],
      tone: "inspiring",
      primaryGoal: "Establish thought-leadership and brand credibility for LinkedIn-sourced professionals.",
      supportingGoals: ["Drive engagement to the platform or use-case pages"],
    },
    sourceTags: ["linkedin"],
    stageTags: ["Awareness"],
    tag:      "Die Zukunft von Websites ist kontextuell",
    title:    "Deine Website - immer anpassungsfähig.",
    subtitle:
      "Mister Chameleon ist die Plattform für Wachstumsteams, die glauben, dass " +
      "Personalisierung keinen Engineering-Sprint, kein Data-Science-Team und keinen " +
      "sechsstelligen Enterprise-Vertrag erfordert.",
    ctas: [
      { _key: "cta-li-1-de", label: "Plattform erkunden", href: "/platform", variant: "primary" },
    ],
  },

  {
    _id:           variantId("hero_direct_brand_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_direct_brand",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Direct \u2014 Brand Clarity Fallback",
      decisionSummary: "Brand clarity copy for typed-URL or dark-social visitors. Leads with the core value prop. Also used as the ultimate fallback variant.",
      intendedAudience: "Visitors arriving via typed URL, bookmark, or dark social with unknown source.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Communicate the core value proposition clearly to visitors with no detectable source signal.",
      exclusions: ["Do not show to known customers — use hero_customer_onboarding instead."],
    },
    sourceTags: ["direct"],
    stageTags: ["Awareness", "Consideration"],
    layoutVariant: "hero_background",
    contentAlign:  "center",
    tag:           "Adaptive Websites - ohne Komplexität",
    title:         "Deine Website, zugeschnitten auf jeden Besucher.",
    subtitle:
      "Mister Chameleon liefert automatisch die richtige Botschaft an die richtige Person. " +
      "Kein A/B-Testing erforderlich. Keine Engineering-Sprints. Keine Ausreden.",
    ctas: [
      { _key: "cta-direct-1-de", label: "Kostenlos starten",  href: "/signup",       variant: "primary"   },
      { _key: "cta-direct-2-de", label: "So funktioniert es", href: "/how-it-works", variant: "secondary" },
    ],
    media: {
      mediaType:   "video",
      videoSource: "youtube",
      videoId:     "ioblgpA5eTo",
    },
  },

  {
    _id:      variantId("hero_consideration_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_consideration",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Returning Visitor \u2014 Consideration Re-engagement",
      decisionSummary: "Re-engagement copy for returning visitors in consideration. Acknowledges their familiarity and deepens the value pitch.",
      intendedAudience: "Returning visitors who have explored the platform across multiple sessions without converting.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "linkedin", "unknown"],
      tone: "persuasive",
      primaryGoal: "Break through evaluation paralysis by making getting started feel concrete and fast.",
      supportingGoals: ["Drive demo bookings", "Surface case studies"],
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    tag:      "Du hast gesehen, was wir tun. Hier ist, warum es funktioniert.",
    title:    "Mehr Besuche sollten nicht mehr Verwirrung bedeuten.",
    subtitle:
      "Du hast die Plattform erkundet. Die Frage ist nicht ob adaptive Websites " +
      "funktionieren - sondern wie schnell du eine live schalten kannst. " +
      "Die meisten Teams schaffen es an einem Nachmittag.",
    ctas: [
      { _key: "cta-con-1-de", label: "Eine kurze Demo buchen",  href: "/demo",   variant: "primary"   },
      { _key: "cta-con-2-de", label: "Live-Beispiele ansehen",  href: "/cases",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_intent_direct_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_intent_direct",
    isActive: true,
    decisionMeta: {
      decisionLabel: "High Intent \u2014 Direct Conversion Push",
      decisionSummary: "Direct, urgency-led copy for pricing-page visitors and trial-ready visitors with intent score \u2265 50.",
      intendedAudience: "Visitors who have visited the pricing page, started a trial, or accumulated high intent signals in the current session.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert high-intent visitors to trial signup or sales conversation.",
      exclusions: ["Do not show to visitors with friction score ≥ 60 — use a lower-pressure variant instead."],
    },
    sourceTags: ["google-organic", "google-paid", "direct"],
    stageTags: ["Decision"],
    tag:      "Du bist so nah an einer besseren Conversion-Rate",
    title:    "Dein nächstes Experiment wartet bereits.",
    subtitle:
      "Besucher mit hoher Absicht konvertieren, wenn die Botschaft zum Moment passt. " +
      "Mister Chameleon identifiziert sie automatisch und zeigt genau die richtige Version " +
      "deiner Website - kein A/B-Test-Setup, kein Engineering-Ticket.",
    ctas: [
      { _key: "cta-int-1-de", label: "Kostenlose Testversion starten", href: "/signup", variant: "primary"   },
      { _key: "cta-int-2-de", label: "Mit dem Vertrieb sprechen",      href: "/demo",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_customer_onboarding_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_customer_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Post-Conversion \u2014 Onboarding Welcome",
      decisionSummary: "Welcome and momentum copy for newly converted customers or active customers revisiting pricing.",
      intendedAudience: "Visitors who have submitted a form (customer funnel stage) or active customers returning to the pricing page.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "google", "linkedin", "unknown"],
      tone: "direct",
      primaryGoal: "Drive immediate first-value activation \u2014 connect domain, define first rules, go live.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    tag:      "Du bist dabei - lass uns deine erste Erfahrung live schalten",
    title:    "Willkommen bei Mister Chameleon. Deine Engine ist bereit.",
    subtitle:
      "Verbinde deine Domain, definiere deine ersten zwei Regeln und deine adaptive " +
      "Homepage geht in Minuten live. Kein Engineering-Sprint. Kein Warten.",
    ctas: [
      { _key: "cta-onb-1-de", label: "Schnellstartanleitung öffnen", href: "/docs/quickstart", variant: "primary" },
    ],
  },

  {
    _id:      variantId("hero_careers_default_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_careers_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 First Visit",
      decisionSummary: "Employer brand copy for first-time careers visitors with no specific role interest yet.",
      intendedAudience: "First-time visitors to the careers section who have not yet viewed a specific role.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Build employer brand appeal and encourage visitors to browse open roles.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    tag:      "Arbeit, die die Zukunft des Webs gestaltet",
    title:    "Baue die Engine, die jede Website smarter macht.",
    subtitle:
      "Mister Chameleon ist ein kleines, ehrgeiziges Team, das die " +
      "Personalisierungsinfrastruktur entwickelt, auf die Wachstumsteams vertrauen. " +
      "Remote-first, eigenverantwortlich, missionsorientiert.",
    ctas: [
      { _key: "cta-car-d1-de", label: "Offene Stellen ansehen",       href: "/vacatures", variant: "primary"   },
      { _key: "cta-car-d2-de", label: "Mehr über unsere Kultur",       href: "/over-ons",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_careers_job_match_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_careers_job_match",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 Role Browser",
      decisionSummary: "Role-focused copy for candidates who have browsed the job listing page.",
      intendedAudience: "Candidates who have visited the jobs listing and are evaluating whether to apply.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Drive candidates from job listing browse to specific role detail pages.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Consideration"],
    tag:      "Stellen, die mit dir wachsen",
    title:    "Es gibt hier eine Stelle, die zu deiner nächsten Etappe passt.",
    subtitle:
      "Ob du Engineer, Designer oder Growth-Spezialist bist - wir expandieren in alle " +
      "Disziplinen. Finde die Stelle, die zu deinem Ehrgeiz passt.",
    ctas: [
      { _key: "cta-car-m1-de", label: "Alle offenen Stellen durchsuchen", href: "/vacatures", variant: "primary" },
    ],
  },

  {
    _id:      variantId("hero_careers_high_intent_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_careers_high_intent",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 High Intent Applicant",
      decisionSummary: "Application-ready copy for candidates who have viewed a role detail AND clicked apply.",
      intendedAudience: "Candidates who viewed a specific role detail page and clicked the apply button.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the application action \u2014 remove friction and reinforce why this is the right move.",
    },
    sourceTags: ["linkedin", "google-organic", "direct"],
    stageTags: ["Decision"],
    tag:      "Einen Schritt von deinem nächsten Kapitel entfernt",
    title:    "Bereit zu bewerben? Wir sind bereit für dich.",
    subtitle:
      "Du hast deine Recherche gemacht - jetzt machen wir es offiziell. Unser " +
      "Einstellungsprozess ist schnell, transparent und so gestaltet, dass er deine Zeit respektiert.",
    ctas: [
      { _key: "cta-car-h1-de", label: "Jetzt bewerben",          href: "/vacatures", variant: "primary"   },
      { _key: "cta-car-h2-de", label: "Uns eine Frage stellen",  href: "/contact",   variant: "secondary" },
    ],
  },

  {
    _id:      variantId("hero_careers_reassurance_de"),
    _type:    "heroVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "hero_careers_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Careers \u2014 Application Drop-off Recovery",
      decisionSummary: "Reassurance copy for visitors who dropped off mid-application or submitted and are re-visiting.",
      intendedAudience: "Candidates who started but did not complete an application, or who already submitted and returned.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates by reducing anxiety about the application process.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration", "Retention"],
    tag:      "Kein Druck. Echte Chancen.",
    title:    "Noch am Überlegen? Das ist völlig in Ordnung.",
    subtitle:
      "Große Entscheidungen verdienen sorgfältige Überlegung. Browse Stellen in deinem " +
      "eigenen Tempo - oder teile uns mit, was du suchst, und wir melden uns, wenn etwas passt.",
    ctas: [
      { _key: "cta-car-r1-de", label: "Offene Stellen durchsuchen",  href: "/vacatures",  variant: "primary"   },
      { _key: "cta-car-r2-de", label: "Initiativbewerbung senden",   href: "/open-brief", variant: "secondary" },
    ],
  },

  // Page banner variants (DE)

  {
    _id:           variantId("hero_page_banner_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_page_banner",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Generic Fallback",
      decisionSummary: "Neutral page banner for legal, changelog, and documentation pages with no personalisation signal needed.",
      intendedAudience: "Any visitor viewing a static utility or documentation page.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration", "decision", "retention"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide neutral page context without injecting a sales message.",
    },
    sourceTags: [],
    stageTags: ["Awareness", "Consideration", "Decision", "Retention"],
    layoutVariant: "hero_page_banner",
    tag:           "Mister Chameleon",
    title:         "Adaptive Personalisierung für das moderne Web.",
    subtitle:      "Jeder Besucher ist anders. Deine Website auch.",
    ctas: [],
  },

  {
    _id:           variantId("hero_page_banner_high_intent_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_page_banner_high_intent",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 High Intent",
      decisionSummary: "Conversion-nudging page banner for high-intent visitors showing strong purchase signals.",
      intendedAudience: "Visitors with intent score \u2265 50 or who have visited the pricing page.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "urgency",
      primaryGoal: "Nudge high-intent visitors toward a conversion action (trial or demo).",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    layoutVariant: "hero_page_banner",
    tag:           "Bereit anzufangen?",
    title:         "Du bist so nah an deinem ersten adaptiven Besucher.",
    subtitle:
      "Das Setup dauert 15 Minuten. Deine erste personalisierte Erfahrung könnte heute live gehen.",
    ctas: [
      { _key: "pb-hi-1-de", label: "Kostenlose Testversion starten", href: "/order/starter", variant: "primary"   },
      { _key: "pb-hi-2-de", label: "Demo-Call buchen",               href: "/contact",        variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_consideration_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_page_banner_consideration",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Consideration Stage",
      decisionSummary: "Value-reinforcing page banner for consideration-stage visitors.",
      intendedAudience: "Visitors in consideration stage who have explored multiple pages across multiple sessions.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Reinforce value and reduce evaluation friction for returning visitors.",
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "Sieh es in Aktion",
    title:         "Sieh, wie Teams wie deins mehr Besucher konvertieren.",
    subtitle:
      "Echte Ergebnisse, echte Kunden - kein Rätselraten. Schau dir die Demo an und entscheide selbst.",
    ctas: [
      { _key: "pb-co-1-de", label: "Demo ansehen",          href: "/demo",   variant: "primary"   },
      { _key: "pb-co-2-de", label: "Fallstudien lesen",     href: "/cases",  variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_returning_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_page_banner_returning",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Returning Visitor",
      decisionSummary: "Familiarity-acknowledging page banner for visitors on their second or later session.",
      intendedAudience: "Returning visitors across any funnel stage.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "google", "unknown"],
      tone: "persuasive",
      primaryGoal: "Acknowledge returning visitor status and deepen engagement.",
    },
    sourceTags: ["direct"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "Willkommen zurück",
    title:         "Schön, dich wiederzusehen.",
    subtitle:
      "Mach weiter, wo du aufgehört hast - oder erkunde einen Teil der Plattform, den du noch nicht gesehen hast.",
    ctas: [
      { _key: "pb-re-1-de", label: "Weiter zur Demo", href: "/demo",      variant: "primary"   },
      { _key: "pb-re-2-de", label: "Was ist neu",     href: "/changelog", variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_enterprise_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_page_banner_enterprise",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Enterprise Visitor",
      decisionSummary: "Enterprise-grade credibility banner for visitors from large companies or showing expansion signals.",
      intendedAudience: "Visitors enriched as enterprise-size companies, or active customers revisiting pricing.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Signal platform readiness for enterprise scale and compliance needs.",
    },
    sourceTags: ["linkedin", "direct"],
    stageTags: ["Consideration", "Decision"],
    layoutVariant: "hero_page_banner",
    tag:           "Enterprise-Personalisierung",
    title:         "Personalisierung im Maßstab - ohne die Enterprise-Einrichtungskosten.",
    subtitle:
      "Dediziertes Onboarding, SLA-Support, White-Label-Optionen und ein Team, das ans Telefon geht.",
    ctas: [
      { _key: "pb-en-1-de", label: "Enterprise-Gespräch buchen", href: "/contact", variant: "primary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_awareness_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_page_banner_awareness",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Awareness Stage",
      decisionSummary: "Lightly adaptive page banner for awareness-stage visitors or unqualified defaults.",
      intendedAudience: "First-time or unqualified visitors viewing inner pages.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Orient awareness-stage visitors and gently introduce the platform proposition.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Awareness"],
    layoutVariant: "hero_page_banner",
    tag:           "Entdecke Mister Chameleon",
    title:         "Deine Website, personalisiert für jeden Besucher.",
    subtitle:
      "Mister Chameleon passt Überschriften, Nachweise und CTAs in Echtzeit an - " +
      "keine Code-Änderungen, keine Datenschutzkompromisse.",
    ctas: [
      { _key: "pb-aw-1-de", label: "Kostenlose Testversion starten", href: "/order/starter", variant: "primary"   },
      { _key: "pb-aw-2-de", label: "Demo ansehen",                   href: "/demo",           variant: "secondary" },
    ],
    media: { mediaType: "video", videoSource: "youtube", videoId: "ioblgpA5eTo" },
  },

  {
    _id:           variantId("hero_page_banner_friction_de"),
    _type:         "heroVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "hero_page_banner_friction",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Page Banner \u2014 Form Drop-off Recovery",
      decisionSummary: "Low-pressure re-engagement banner for visitors who dropped off a form or showed hesitation signals.",
      intendedAudience: "Visitors who started but did not complete a form or CTA, or who have a friction score \u2265 40.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage hesitant visitors with a lower-friction path back to conversion.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    layoutVariant: "hero_page_banner",
    tag:           "Keine Eile",
    title:         "Noch am Abwägen? Das ist völlig in Ordnung.",
    subtitle:
      "Die meisten Teams probieren eine Regel aus, sehen den Uplift und schauen nie zurück. " +
      "Aber die Entscheidung muss sich zuerst richtig anfühlen. " +
      "Sprich mit jemandem, lies wie es funktioniert, oder erkunde einfach weiter.",
    ctas: [
      { _key: "pb-fr-1-de", label: "Erst mit jemandem sprechen", href: "/contact",      variant: "primary"   },
      { _key: "pb-fr-2-de", label: "So funktioniert es",         href: "/how-it-works", variant: "secondary" },
    ],
  },

  // Proof variants (DE)

  {
    _id:      variantId("proof_cases_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_cases",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Case Studies & ROI",
      decisionSummary: "Concrete case studies and ROI numbers for visitors evaluating real-world results.",
      intendedAudience: "Visitors who have browsed case study pages or are in consideration/decision stage.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Convert sceptical evaluators with measurable outcome proof.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration", "Decision"],
    title:    "Conversion-Steigerungen, die für sich sprechen",
    items: [
      {
        _key:  "cases-item-1-de",
        title: "3,2-fach mehr qualifizierte Leads",
        text:
          "SaaS-Teams mit Mister Chameleon sehen eine durchschnittliche 3,2-fache Steigerung " +
          "der Demo-Anfragen innerhalb von 30 Tagen nach dem Launch - ohne Engineering-Änderungen.",
      },
      {
        _key:  "cases-item-2-de",
        title: "Erste Erfahrung in weniger als 5 Minuten live",
        text:
          "Verbinde deine Domain, definiere zwei Regeln und deine erste adaptive Erfahrung ist live. " +
          "Die meisten Teams liefern innerhalb eines einzigen Nachmittags.",
      },
      {
        _key:  "cases-item-3-de",
        title: "12 Besuchersignale, in Echtzeit ausgewertet",
        text:
          "Quelle, Gerät, Kampagne, Aktualität und mehr - jeder Besuch löst eine stille Auswertung " +
          "aus, damit die richtige Erfahrung geladen wird, bevor die Seite angezeigt wird.",
      },
    ],
  },

  {
    _id:      variantId("proof_vision_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_vision",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Analyst & Industry Recognition",
      decisionSummary: "Analyst quotes and industry recognition for vision-led visitors, particularly from LinkedIn.",
      intendedAudience: "Professionals and executives who respond to thought-leadership and industry validation.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["linkedin"],
      tone: "inspiring",
      primaryGoal: "Establish platform credibility with analyst and industry validation.",
    },
    sourceTags: ["linkedin"],
    stageTags: ["Awareness"],
    title:    "Was die Branche sagt",
    items: [
      {
        _key:  "vision-item-1-de",
        title: "Von Product Hunt ausgezeichnet",
        text:
          "#1 Produkt des Tages - 'Mister Chameleon ist, wie adaptive Marketing-Infrastruktur " +
          "aussehen sollte. Endlich Personalisierung ohne die Plattformgebühren.'",
      },
      {
        _key:  "vision-item-2-de",
        title: "Gebaut für das nächste Jahrzehnt des Wachstums",
        text:
          "Speziell entwickelt für das Zeitalter, in dem jeder Besucher eine personalisierte " +
          "Erfahrung erwartet, aber Engineering-Kapazität die knappste Ressource im Team ist.",
      },
      {
        _key:  "vision-item-3-de",
        title: "Personalisierung ohne Entwickler - im Maßstab",
        text:
          "Die einzige Plattform, die Decision-Engine-Qualität in Adaptivität zu Marketing- " +
          "und Produktteams ohne Machine-Learning-Abteilung bringt.",
      },
    ],
  },

  {
    _id:      variantId("proof_platform_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_platform",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Platform Scale & Reliability",
      decisionSummary: "Platform scale and reliability stats for technical visitors evaluating infrastructure.",
      intendedAudience: "Technical evaluators and developers assessing platform scalability and reliability.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Reassure technical decision-makers on platform scale, uptime, and reliability.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration", "Decision"],
    title:    "Infrastruktur, der du vertrauen kannst",
    items: [
      {
        _key:  "platform-item-1-de",
        title: "Edge-native Decision-Engine",
        text:
          "Kontexterkennung und Erfahrungsauflösung finden am CDN-Edge statt - " +
          "unter 5 ms Latenz ohne Origin-Roundtrip, unabhängig vom Standort des Besuchers.",
      },
      {
        _key:  "platform-item-2-de",
        title: "99,99% Uptime SLA",
        text:
          "Betrieben auf einem globalen Active-Active-Edge-Netzwerk mit automatischem Failover, " +
          "Zero-Downtime-Deployments und einer öffentlichen Statusseite.",
      },
      {
        _key:  "platform-item-3-de",
        title: "Standardmäßig DSGVO- und CCPA-konform",
        text:
          "Es werden keine personenbezogenen Daten erfasst oder gespeichert. Jedes Signal wird " +
          "ephemer im Arbeitsspeicher in Echtzeit ausgewertet. Die Privatsphäre deiner Besucher " +
          "ist automatisch geschützt.",
      },
    ],
  },

  {
    _id:      variantId("proof_default_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Broad Credibility",
      decisionSummary: "General credibility block for new visitors with no specific segment signal.",
      intendedAudience: "Any new visitor where no more specific proof variant matches.",
      intentLevel: "awareness",
      funnelStages: ["awareness", "consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Establish baseline trust and credibility for unqualified visitors.",
    },
    sourceTags: ["google-organic", "linkedin", "direct"],
    stageTags: ["Awareness", "Consideration"],
    title:    "Vertraut von Wachstumsteams weltweit",
    items: [
      {
        _key:  "def-item-1-de",
        title: "2.000+ Teams passen sich bereits an",
        text:
          "Von frühen SaaS-Startups bis hin zu Enterprise-Marketingteams - Mister Chameleon " +
          "treibt adaptive Erfahrungen branchenübergreifend an - ohne einen einzigen Engineering-Sprint.",
      },
      {
        _key:  "def-item-2-de",
        title: "In weniger als 5 Minuten live",
        text:
          "Verbinde deine Domain, schreibe zwei Regeln und deine erste adaptive Erfahrung ist " +
          "live vor deinem nächsten Meeting. Die meisten Teams liefern noch am selben Nachmittag.",
      },
      {
        _key:  "def-item-3-de",
        title: "Kein PII. Volle Compliance.",
        text:
          "Mister Chameleon speichert niemals Besucherdaten. Jedes Signal wird ephemer am Edge " +
          "ausgewertet - DSGVO- und CCPA-konform, ohne einen Finger zu rühren.",
      },
    ],
  },

  {
    _id:      variantId("proof_stats_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_stats",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Hard Numbers for Buyers",
      decisionSummary: "Hard numbers and conversion statistics for high-intent buyers who need quantitative justification.",
      intendedAudience: "High-intent visitors in decision stage who respond to data-driven proof.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Provide the statistical justification a high-intent buyer needs to proceed.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "Die Zahlen, die zählen",
    items: [
      {
        _key:  "stats-item-1-de",
        title: "Durchschnittlich 3,2-fach mehr qualifizierte Leads",
        text:
          "Teams, die Mister Chameleon 30 Tage lang nutzen, sehen eine durchschnittliche " +
          "3,2-fache Steigerung der Demo-Anfragen - ohne das Werbebudget zu erhöhen oder " +
          "die Website neu zu gestalten.",
      },
      {
        _key:  "stats-item-2-de",
        title: "Unter 5 ms Kontextauswertung am Edge",
        text:
          "Jeder Besuch wird in Echtzeit ausgewertet, bevor das erste Byte gesendet wird. " +
          "Null Latenz-Auswirkung. Null Auswirkung auf Core Web Vitals.",
      },
      {
        _key:  "stats-item-3-de",
        title: "12 Besuchersignale, gleichzeitig ausgewertet",
        text:
          "Quelle, Gerät, Geo, Unternehmen, Kampagne, Aktualität, Intent-Score und mehr - " +
          "alles in einem einzigen Kontext-Snapshot zusammengefasst, der die Erfahrungsentscheidung steuert.",
      },
    ],
  },

  {
    _id:      variantId("proof_reassurance_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof \u2014 Safety & Social Proof",
      decisionSummary: "Safety and social proof for visitors with doubt, hesitation, or high friction signals.",
      intendedAudience: "Visitors with elevated friction scores, form drop-offs, or hesitation behaviour.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Remove doubt and rebuild trust for hesitant visitors.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    title:    "Vertraut von Teams, die in deiner Lage waren",
    items: [
      {
        _key:  "reas-item-1-de",
        title: "Kein Lock-in. Jederzeit kündbar.",
        text:
          "Mister Chameleon läuft neben deiner bestehenden Website - kein Abriss-und-Ersatz, " +
          "keine sechsmonatige Implementierung. Geh jederzeit, ohne eine Zeile Inhalt zu verlieren.",
      },
      {
        _key:  "reas-item-2-de",
        title: "Onboarding-Support inklusive",
        text:
          "Jedes neue Konto erhält einen 30-minütigen Onboarding-Anruf. Unser Team hilft dir, " +
          "deine Top-3-Besuchersegmente zu identifizieren und deine ersten Regeln zu schreiben - " +
          "ohne zusätzliche Kosten.",
      },
      {
        _key:  "reas-item-3-de",
        title: "Genutzt von Teams genau wie deins",
        text:
          "Die meisten unserer Kunden kamen zu uns, nachdem sie von Tools frustriert waren, " +
          "die entweder zu komplex oder zu einfach waren. Mister Chameleon wurde für genau diese Lücke gebaut.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_default_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_careers_default",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Employer Brand",
      decisionSummary: "Employer brand proof for first-time careers visitors highlighting culture and team.",
      intendedAudience: "First-time careers visitors with no specific role interest yet.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Build employer brand appeal for unqualified careers visitors.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    title:    "Leben bei Mister Chameleon",
    items: [
      {
        _key:  "car-def-1-de",
        title: "Kleines Team, große Verantwortung",
        text:
          "Wir sind ein eingespieltes Team, in dem jeder Person ein bedeutungsvolles Stück " +
          "des Produkts gehört. Keine Ticket-Warteschlangen, kein mittleres Management. " +
          "Nur du, dein Handwerk und Impact.",
      },
      {
        _key:  "car-def-2-de",
        title: "Remote-first, async-freundlich",
        text:
          "Arbeite von überall in Europa. Unsere Kultur basiert auf klarer Kommunikation, " +
          "fokussierter Arbeit und der gelegentlichen Team-Woche, in der wir uns noch mehr schätzen.",
      },
      {
        _key:  "car-def-3-de",
        title: "Getragen von einer Mission, über die es sich zu reden lohnt",
        text:
          "Wir glauben, dass jede Website mit jedem Besucher so sprechen sollte, wie ein Mensch " +
          "es tun würde. Wenn dieser Satz dich dazu bringt, etwas bauen zu wollen, passt du perfekt zu uns.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_team_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_careers_team",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Team Quality",
      decisionSummary: "Team culture and quality proof for candidates evaluating role fit.",
      intendedAudience: "Candidates who have viewed a specific role detail and are evaluating team fit.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Convince role-interested candidates that the team is worth joining.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Consideration"],
    title:    "Die Menschen, mit denen du arbeiten würdest",
    items: [
      {
        _key:  "car-team-1-de",
        title: "Engineers, denen Qualität wichtig ist",
        text:
          "Unser Engineering-Team legt großen Wert auf die Qualität dessen, was es baut. " +
          "Code-Reviews sind gründlich, Dokumentation ist echt und technische Schulden werden verfolgt.",
      },
      {
        _key:  "car-team-2-de",
        title: "Growth-Menschen, die in Systemen denken",
        text:
          "Unser Growth-Team kombiniert Daten-Intuition mit kreativem Instinkt. " +
          "Wir führen Experimente durch, keine Kampagnen - und wir teilen Ergebnisse, auch die gescheiterten.",
      },
      {
        _key:  "car-team-3-de",
        title: "Eine Kultur des ehrlichen Feedbacks",
        text:
          "Wir geben direktes, freundliches Feedback - und erwarten es zurück. " +
          "Niemand wächst in einer Echokammer. Wir sind lieber ehrlich als bequem.",
      },
    ],
  },

  {
    _id:      variantId("proof_careers_reassurance_de"),
    _type:    "proofVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "proof_careers_reassurance",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Proof Careers \u2014 Fair Hiring Process",
      decisionSummary: "Reassurance proof for application drop-off candidates emphasising fair and transparent process.",
      intendedAudience: "Candidates who started but did not complete an application or who are hesitating.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates by emphasising a transparent, low-pressure hiring process.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration", "Retention"],
    title:    "Ein Prozess für echte Menschen",
    items: [
      {
        _key:  "car-reas-1-de",
        title: "3 Phasen, keine Überraschungen",
        text:
          "Erstgespräch, Kompetenzgespräch, Angebot. Keine Hausaufgaben, die dein Wochenende " +
          "fressen. Keine Whiteboard-Rätsel. Nur echte Gespräche über echte Arbeit.",
      },
      {
        _key:  "car-reas-2-de",
        title: "Wir geben immer Feedback",
        text:
          "Jeder Kandidat erhält eine persönliche Rückmeldung und jede Absage enthält spezifisches " +
          "Feedback. Wir glauben, das ist der Mindeststandard für die Wertschätzung deiner Zeit.",
      },
      {
        _key:  "car-reas-3-de",
        title: "Fragen sind in jeder Phase willkommen",
        text:
          "Du bewertest uns genauso wie wir dich bewerten. Frag alles - über die Stelle, " +
          "das Team, das Produkt, das Gehalt, die Roadmap. Wir antworten ehrlich.",
      },
    ],
  },

  // CTA variants (DE)

  {
    _id:      variantId("cta_guide_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_guide",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Nurture: Free Playbook",
      decisionSummary: "Low-friction nurture CTA offering a free playbook download for early-stage visitors.",
      intendedAudience: "Awareness or early-consideration visitors not yet ready for a trial or demo.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "unknown"],
      tone: "educational",
      primaryGoal: "Capture email via playbook download to start nurture sequence.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Awareness"],
    title:    "Das Adaptive-Website-Playbook herunterladen",
    text:
      "Ein praktischer, sachlicher Leitfaden zur Personalisierung deiner Homepage für " +
      "deine drei wertvollsten Traffic-Quellen. Kostenlos. Kein E-Mail-Gate.",
    ctas: [
      { _key: "cta-guide-1-de", label: "Playbook herunterladen", href: "/playbook", variant: "primary" },
    ],
  },

  {
    _id:      variantId("cta_platform_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_platform",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Product-led: Start Free",
      decisionSummary: "Product-led signup CTA for visitors showing platform evaluation intent.",
      intendedAudience: "Visitors who have explored features or platform pages and are evaluating signing up.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Drive free trial signup with minimal friction.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Consideration"],
    title:    "Kostenlos mit dem Aufbau beginnen",
    text:
      "Deine erste adaptive Erfahrung ist für immer kostenlos. Keine Kreditkarte, kein " +
      "Verkaufsgespräch, kein sechsmonatiges Onboarding. Einfach verbinden, konfigurieren und liefern.",
    ctas: [
      { _key: "cta-platform-1-de", label: "Kostenloses Konto erstellen", href: "/signup",       variant: "primary"   },
      { _key: "cta-platform-2-de", label: "So funktioniert es",          href: "/how-it-works", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_meeting_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_meeting",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Sales: Book Demo",
      decisionSummary: "Sales-led demo booking CTA for visitors ready for a human conversation.",
      intendedAudience: "Consideration or decision-stage visitors who prefer a guided walkthrough over self-serve.",
      intentLevel: "consideration",
      funnelStages: ["consideration", "decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Book a demo call to begin the sales conversation.",
    },
    sourceTags: ["linkedin", "google-paid"],
    stageTags: ["Consideration", "Decision"],
    title:    "Mister Chameleon in Aktion sehen",
    text:
      "Buche eine 20-minütige Live-Demo. Wir zeigen dir genau, wie deine Homepage für " +
      "deine drei wichtigsten Besuchersegmente aussehen würde.",
    ctas: [
      { _key: "cta-meeting-1-de", label: "Demo buchen",         href: "/demo",   variant: "primary"   },
      { _key: "cta-meeting-2-de", label: "Kostenlos starten",   href: "/signup", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_demo_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_demo",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Consideration: See It In Action",
      decisionSummary: "Interactive demo CTA for consideration-stage visitors who want to experience the product before committing.",
      intendedAudience: "Consideration-stage visitors who want to see the product in action before signing up.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Drive demo engagement to convert consideration-stage visitors.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Sieh genau, wie es für deine Website aussehen würde",
    text:
      "Buche einen 20-minütigen Screen-Share. Wir zeigen dir eine live adaptive Erfahrung, " +
      "die um deine drei wichtigsten Besuchersegmente herum aufgebaut ist. Kein Pitch-Deck.",
    ctas: [
      { _key: "cta-demo-1-de", label: "20-minütige Demo buchen",   href: "/demo",   variant: "primary"   },
      { _key: "cta-demo-2-de", label: "Zuerst Fallstudien lesen",  href: "/cases",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_onboarding_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_onboarding",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Customer: First Value Fast",
      decisionSummary: "Onboarding-focused CTA for newly converted customers to reach first value quickly.",
      intendedAudience: "Newly converted customers entering the onboarding flow.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "direct",
      primaryGoal: "Drive first-value activation: connect domain and launch first live variant.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Deine erste adaptive Erfahrung ist einen Schritt entfernt",
    text:
      "Folge der Schnellstartanleitung, um deine Domain zu verbinden, deine ersten zwei " +
      "Regeln einzurichten und zu beobachten, wie die Engine live geht - normalerweise in unter 10 Minuten.",
    ctas: [
      { _key: "cta-onb-1-de", label: "Schnellstartanleitung öffnen",      href: "/docs/quickstart", variant: "primary"   },
      { _key: "cta-onb-2-de", label: "Mit Onboarding-Support sprechen",   href: "/contact",         variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_expansion_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_expansion",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA \u2014 Active Customer: Upgrade Prompt",
      decisionSummary: "Expansion CTA for active customers revisiting pricing, showing upgrade/upsell intent.",
      intendedAudience: "Active customers (customer funnel stage) who are revisiting pricing or feature pages.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "urgency",
      primaryGoal: "Convert expansion intent into an upgrade or upsell conversation.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Bereit für das nächste Level?",
    text:
      "Dein aktuelles Paket erledigt die Arbeit. Aber wenn du an Grenzen für Regeln, " +
      "Varianten oder Tenants stößt - es ist Zeit zu reden. Das Upgrade dauert weniger als 5 Minuten.",
    ctas: [
      { _key: "cta-exp-1-de", label: "Upgrade-Optionen ansehen",            href: "/pricing", variant: "primary"   },
      { _key: "cta-exp-2-de", label: "Mit deinem Account Manager sprechen", href: "/contact", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_browse_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_careers_browse",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Browse Open Roles",
      decisionSummary: "Role browsing CTA for careers visitors with no specific role interest yet.",
      intendedAudience: "First-time careers visitors who have not yet viewed a specific role.",
      intentLevel: "awareness",
      funnelStages: ["awareness"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "inspiring",
      primaryGoal: "Drive careers visitors from homepage to the jobs listing page.",
    },
    sourceTags: ["linkedin", "google-organic"],
    stageTags: ["Awareness"],
    title:    "Finde die Stelle, die zu deinem nächsten Kapitel passt",
    text:
      "Wir stellen in Engineering, Growth, Design und Customer Success ein. " +
      "Schau was offen ist - oder schick eine Initiativbewerbung, wenn noch nichts passt.",
    ctas: [
      { _key: "cta-cbr-1-de", label: "Alle offenen Stellen ansehen",  href: "/vacatures",  variant: "primary"   },
      { _key: "cta-cbr-2-de", label: "Initiativbewerbung senden",     href: "/open-brief", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_apply_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_careers_apply",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 High Intent: Apply Now",
      decisionSummary: "Application CTA for candidates who have viewed a role and are ready to apply.",
      intendedAudience: "Candidates who viewed a specific role detail page and clicked the apply button.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Complete the application action with minimal friction.",
    },
    sourceTags: ["linkedin", "google-organic", "direct"],
    stageTags: ["Decision"],
    title:    "Du hast deine Stelle gefunden. Machen wir es offiziell.",
    text:
      "Die Bewerbung dauert etwa 10 Minuten. Kein Anschreiben erforderlich - erzähle uns " +
      "einfach, was du gebaut hast und was du als Nächstes bauen möchtest.",
    ctas: [
      { _key: "cta-cap-1-de", label: "Jetzt bewerben",               href: "/vacatures", variant: "primary"   },
      { _key: "cta-cap-2-de", label: "Uns zuerst eine Frage stellen", href: "/contact",  variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_open_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_careers_open",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Open Application",
      decisionSummary: "Low-pressure open application CTA for candidates not yet ready to apply to a specific role.",
      intendedAudience: "Candidates who started but did not complete an application or who dropped off.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Re-engage drop-off candidates via a lower-commitment open application path.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Consideration"],
    title:    "Noch nicht ganz bereit? Stell dich einfach vor.",
    text:
      "Schick uns eine Initiativbewerbung. Erzähle uns, was du tust, was du suchst und " +
      "warum Mister Chameleon deine Aufmerksamkeit erregt hat. Keine Stelle erforderlich.",
    ctas: [
      { _key: "cta-cop-1-de", label: "Initiativbewerbung senden", href: "/open-brief", variant: "primary"   },
      { _key: "cta-cop-2-de", label: "Offene Stellen durchsuchen", href: "/vacatures", variant: "secondary" },
    ],
  },

  {
    _id:      variantId("cta_careers_contact_de"),
    _type:    "ctaVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "cta_careers_contact",
    isActive: true,
    decisionMeta: {
      decisionLabel: "CTA Careers \u2014 Post-Conversion: Application Received",
      decisionSummary: "Post-application CTA confirming receipt and offering a direct contact channel.",
      intendedAudience: "Candidates who have already submitted an application and are revisiting the site.",
      intentLevel: "decision",
      funnelStages: ["retention"],
      bestForSources: ["direct", "email", "unknown"],
      tone: "credibility",
      primaryGoal: "Confirm application status and provide a human contact channel to reduce post-submission anxiety.",
    },
    sourceTags: ["direct", "email"],
    stageTags: ["Retention"],
    title:    "Bewerbung erhalten. Wir melden uns.",
    text:
      "Du hörst innerhalb von 5 Werktagen von uns. In der Zwischenzeit kannst du dich " +
      "gerne melden, wenn du Fragen zur Stelle, zum Prozess oder zum Team hast.",
    ctas: [
      { _key: "cta-cco-1-de", label: "Direkt Kontakt aufnehmen", href: "/contact", variant: "primary" },
    ],
  },

  // Feature variants (DE)

  {
    _id:      variantId("feature_core_de"),
    _type:    "featureVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "feature_core",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Core Platform Capabilities",
      decisionSummary: "Three core platform capabilities overview for consideration-stage visitors evaluating the platform.",
      intendedAudience: "Visitors in consideration who want a concise overview of platform capabilities.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Communicate the three core platform capabilities clearly.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Alles, was du für Personalisierung im Maßstab brauchst",
    subtitle: "Drei Fähigkeiten, eine Plattform - keine Engineering-Sprints erforderlich.",
    items: [
      {
        _key:  "feat-core-1-de",
        title: "Adaptive Decision-Engine",
        body:
          "Echtzeit-Besucherkontext - Quelle, Gerät, Geo, Unternehmen und Kampagne - " +
          "am Edge in unter 5 ms ausgewertet. Keine Cookies. Keine personenbezogenen Daten.",
        icon:  "zap",
      },
      {
        _key:  "feat-core-2-de",
        title: "CMS-betriebene Variantenbibliothek",
        body:
          "Schreibe Hero-, Beweis- und CTA-Varianten einmal in Sanity Studio. " +
          "Die Engine wählt automatisch die richtige für jeden Besucher.",
        icon:  "layers",
      },
      {
        _key:  "feat-core-3-de",
        title: "Experiment- und Analyseebene",
        body:
          "A/B-teste jeden Varianten-Slot ohne Code. Verfolge bereitgestellte Varianten " +
          "und Conversion-Uplift mit integrierten Analysen - keine Drittanbieter-Tools nötig.",
        icon:  "bar-chart-2",
      },
    ],
  },

  {
    _id:           variantId("feature_grid_primary_de"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "feature_grid_primary",
    layoutVariant: "feature_grid",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Full Grid Overview",
      decisionSummary: "Full six-item feature grid for consideration-stage visitors doing thorough platform evaluation.",
      intendedAudience: "Visitors in detailed evaluation mode who want comprehensive feature coverage.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide complete feature coverage for thorough platform evaluators.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Consideration"],
    title:    "Alles, was du für Personalisierung im Maßstab brauchst",
    subtitle: "Drei Fähigkeiten. Eine Plattform. Null Engineering-Sprints.",
    items: [
      {
        _key:  "fg-1-de",
        title: "Adaptive Decision-Engine",
        body:
          "Echtzeit-Besucherkontext - Quelle, Gerät, Geo, Unternehmen und Kampagne - " +
          "am Edge in unter 5 ms ausgewertet. Keine Cookies. Keine personenbezogenen Daten.",
        icon:  "zap",
      },
      {
        _key:  "fg-2-de",
        title: "CMS-betriebene Variantenbibliothek",
        body:
          "Schreibe Hero-, Beweis- und CTA-Varianten einmal in Sanity Studio. " +
          "Die Engine wählt automatisch die richtige für jeden Besucher.",
        icon:  "layers",
      },
      {
        _key:  "fg-3-de",
        title: "Experiment- und Analyseebene",
        body:
          "A/B-teste jeden Varianten-Slot ohne Code zu schreiben. Verfolge bereitgestellte " +
          "Varianten und Conversion-Uplift mit integrierten Analysen - keine Drittanbieter-Tools erforderlich.",
        icon:  "bar-chart-2",
      },
      {
        _key:  "fg-4-de",
        title: "Multi-Tenant-Architektur",
        body:
          "Führe adaptive Erfahrungen für mehrere Marken oder Produkte von einer einzigen " +
          "Plattform aus. Tenant-scoped Regeln, Inhalte und Analysen - alles an einem Ort.",
        icon:  "globe",
      },
      {
        _key:  "fg-5-de",
        title: "No-Code-Regelbuilder",
        body:
          "Definiere Bedingungen und weise Variantenpläne über eine Point-and-Click-Oberfläche zu. " +
          "Kein SQL, keine Regex, keine Engineering-Tickets - nur logische, lesbare Regeln.",
        icon:  "sliders",
      },
      {
        _key:  "fg-6-de",
        title: "Edge-native, global schnell",
        body:
          "Jede Entscheidung läuft am CDN-Edge - unter 5 ms Latenz, unabhängig davon, wo dein " +
          "Besucher ist. Core Web Vitals bleiben grün. Conversions steigen.",
        icon:  "shield",
      },
    ],
  },

  {
    _id:           variantId("feature_highlights_de"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "feature_highlights",
    layoutVariant: "feature_highlights",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Key Differentiators",
      decisionSummary: "Three key differentiators for consideration-stage visitors comparing alternatives.",
      intendedAudience: "Visitors in consideration who are comparing Mister Chameleon to alternatives.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Differentiate Mister Chameleon on the three dimensions that matter most to evaluators.",
    },
    sourceTags: ["google-organic", "linkedin"],
    stageTags: ["Consideration"],
    title:    "Warum Wachstumsteams Mister Chameleon wählen",
    subtitle: "Personalisierung, die ohne ein Machine-Learning-Team funktioniert.",
    items: [
      {
        _key:  "fh-1-de",
        title: "Kontextbewusst, nicht Cookie-abhängig",
        body:
          "Mister Chameleon liest 12 Besuchersignale - Quelle, Unternehmen, Gerät, Aktualität " +
          "und Absicht - am Edge in Echtzeit. Keine Cookies nötig. Kein Cookie-Banner erforderlich. " +
          "DSGVO-konform by Design.",
        icon:  "eye",
      },
      {
        _key:  "fh-2-de",
        title: "Regeln, die du lesen, schreiben und vertrauen kannst",
        body:
          "Jede Erfahrungsentscheidung wird durch eine Regel gesteuert, die du in klarer " +
          "Sprache definiert hast. Kein Black-Box-ML-Modell, das du deinem CEO nicht erklären kannst. " +
          "Jede bereitgestellte Variante wird protokolliert und auditierbar.",
        icon:  "check-circle",
      },
      {
        _key:  "fh-3-de",
        title: "Integration mit deinem CMS in Minuten",
        body:
          "Verbinde Sanity, Storyblok oder ein Headless-CMS, das du bereits verwendest. " +
          "Schreibe Variantentexte im CMS, das du kennst - Mister Chameleon übernimmt das " +
          "Routing und die Bereitstellung automatisch.",
        icon:  "plug",
      },
    ],
  },

  {
    _id:           variantId("feature_comparison_de"),
    _type:         "featureVariant",
    tenantId:      TENANT,
    locale:        "de",
    key:           "feature_comparison",
    layoutVariant: "feature_comparison",
    isActive:      true,
    decisionMeta: {
      decisionLabel: "Feature \u2014 Comparison Table",
      decisionSummary: "Side-by-side comparison for decision-stage visitors doing final competitive evaluation.",
      intendedAudience: "Decision-stage visitors doing final comparison against competing platforms.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "credibility",
      primaryGoal: "Win the final comparison moment by demonstrating clear advantage on key criteria.",
    },
    sourceTags: ["google-organic", "direct"],
    stageTags: ["Decision"],
    title:    "Wie Mister Chameleon im Vergleich abschneidet",
    subtitle: "Nicht alle Personalisierungsplattformen sind gleich gebaut.",
    items: [
      {
        _key:  "fc-1-de",
        title: "No-Code-Regelbuilder",
        body:
          "Mister Chameleon: ja - Point-and-Click-Bedingungseditor, in einfacher Sprache lesbar. " +
          "Die meisten Plattformen: erfordert Entwicklerkonfiguration oder eine Data-Science-Pipeline.",
        icon:  "sliders",
      },
      {
        _key:  "fc-2-de",
        title: "Edge-native Auswertung",
        body:
          "Mister Chameleon: Entscheidungen laufen am CDN-Edge, unter 5 ms. " +
          "Die meisten Plattformen: Server-seitige Auswertung fügt 100-400 ms pro Seitenaufruf hinzu.",
        icon:  "zap",
      },
      {
        _key:  "fc-3-de",
        title: "Cookie-frei und DSGVO-konform",
        body:
          "Mister Chameleon: keine personenbezogenen Daten gespeichert, kein Cookie-Banner erforderlich. " +
          "Die meisten Plattformen: erfordern Cookie-Zustimmung und Datenverarbeitungsvereinbarungen.",
        icon:  "shield",
      },
      {
        _key:  "fc-4-de",
        title: "Multi-Tenant standardmäßig",
        body:
          "Mister Chameleon: Tenant-scoped Regeln, Inhalte und Analysen in allen Tarifen enthalten. " +
          "Die meisten Plattformen: Multi-Tenancy ist ein Enterprise-Add-on zum 3-10-fachen Preis.",
        icon:  "globe",
      },
    ],
  },

  // Conversion variants (DE)

  {
    _id:      variantId("conversion_signup_de"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "conversion_signup",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Product-led Signup",
      decisionSummary: "Product-led account creation entry point for decision-stage visitors ready to start.",
      intendedAudience: "Decision-stage visitors ready to create an account and start the trial.",
      intentLevel: "decision",
      funnelStages: ["decision"],
      bestForSources: ["google", "direct", "unknown"],
      tone: "direct",
      primaryGoal: "Drive account creation with minimal friction.",
    },
    sourceTags: ["google-paid", "direct"],
    stageTags: ["Decision"],
    title:    "Kostenlos starten. Upgraden wenn du bereit bist.",
    text:
      "Erstelle dein Konto in unter 60 Sekunden. Keine Kreditkarte, kein Verkaufsgespräch, " +
      "kein sechsmonatiges Onboarding. Deine erste adaptive Erfahrung lieferst du noch heute.",
    ctas: [
      { _key: "conv-signup-1-de", label: "Kostenloses Konto erstellen", href: "/signup", variant: "primary"   },
      { _key: "conv-signup-2-de", label: "Live-Demo ansehen",           href: "/demo",   variant: "secondary" },
    ],
    urgencyLabel: "Schließe dich 2.000+ Wachstumsteams an, die Mister Chameleon bereits nutzen",
  },

  {
    _id:      variantId("conversion_demo_de"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "conversion_demo",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Book a Demo",
      decisionSummary: "Sales-led demo booking for consideration-stage visitors who prefer a guided walkthrough.",
      intendedAudience: "Consideration-stage visitors who prefer a human walkthrough before committing.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "persuasive",
      primaryGoal: "Book a demo call to begin the guided sales process.",
    },
    sourceTags: ["linkedin", "google-paid"],
    stageTags: ["Consideration"],
    title:    "Sieh deine Website, personalisiert. Live.",
    text:
      "Buche einen 20-minütigen Screen-Share und wir zeigen dir genau, wie Mister Chameleon " +
      "deine drei wertvollsten Besuchersegmente bedienen würde. Bring deine echte Website mit.",
    ctas: [
      { _key: "conv-demo-1-de", label: "Live-Demo buchen",              href: "/demo",   variant: "primary"   },
      { _key: "conv-demo-2-de", label: "Stattdessen kostenlos starten", href: "/signup", variant: "secondary" },
    ],
    urgencyLabel: "Normalerweise innerhalb von 24 Stunden geplant",
  },

  {
    _id:      variantId("conversion_contact_de"),
    _type:    "conversionVariant",
    tenantId: TENANT,
    locale:   "de",
    key:      "conversion_contact",
    isActive: true,
    decisionMeta: {
      decisionLabel: "Conversion \u2014 Open Contact",
      decisionSummary: "Open contact channel for consideration-stage visitors who want human contact over automation.",
      intendedAudience: "Consideration-stage visitors with specific questions or concerns before converting.",
      intentLevel: "consideration",
      funnelStages: ["consideration"],
      bestForSources: ["google", "linkedin", "direct", "unknown"],
      tone: "educational",
      primaryGoal: "Provide a human contact path for visitors with unanswered questions.",
    },
    sourceTags: ["direct", "referral"],
    stageTags: ["Consideration"],
    title:    "Hast du eine Frage? Wir sind für dich da.",
    text:
      "Ob du die Plattform evaluierst, Hilfe beim Setup benötigst oder einfach mit einem " +
      "Menschen sprechen möchtest - schick uns eine Nachricht und wir antworten innerhalb eines Werktages.",
    ctas: [
      { _key: "conv-con-1-de", label: "Nachricht senden", href: "/contact", variant: "primary" },
    ],
    urgencyLabel: "Antwort innerhalb eines Werktages",
  },


  // ── Notification variants ─────────────────────────────────────────────────

  /**
   * notification_default
   * Audience: new and unclassified visitors.
   * Framing:  Low-friction awareness — introduce the core value prop.
   *           Top banner, dismissible, never auto-dismisses.
   */
  {
    _id:          variantId("notification_default"),
    _type:        "notificationVariant",
    tenantId:     TENANT,
    key:          "notification_default",
    isActive:     true,
    message:      "👋 See how Mister Chameleon adapts your website to every visitor — no code needed.",
    severity:     "info",
    ctaLabel:     "See how it works",
    ctaHref:      "/how-it-works",
    position:     "top",
    dismissible:  true,
    autoDismissMs: 0,
  },

  /**
   * notification_offer
   * Audience: consideration-stage and form-dropoff visitors.
   * Framing:  Promotional — limited-time free trial nudge to reduce friction.
   *           Top banner, promo style, dismissible.
   */
  {
    _id:          variantId("notification_offer"),
    _type:        "notificationVariant",
    tenantId:     TENANT,
    key:          "notification_offer",
    isActive:     true,
    message:      "🎉 Start free — no credit card required. Set up your first personalised experience in under 10 minutes.",
    severity:     "promo",
    ctaLabel:     "Start for free",
    ctaHref:      "/signup",
    position:     "top",
    dismissible:  true,
    autoDismissMs: 0,
  },

  /**
   * notification_urgency
   * Audience: high-intent visitors (viewed pricing, clicked CTA, trial-ready).
   * Framing:  Scarcity / social proof nudge — push them over the line.
   *           Top banner, warning style to stand out.
   */
  {
    _id:          variantId("notification_urgency"),
    _type:        "notificationVariant",
    tenantId:     TENANT,
    key:          "notification_urgency",
    isActive:     true,
    message:      "⚡ Demo slots this week are filling up. Most teams see results within their first session.",
    severity:     "warning",
    ctaLabel:     "Book a slot now",
    ctaHref:      "/demo",
    position:     "top",
    dismissible:  true,
    autoDismissMs: 0,
  },

  /**
   * notification_returning
   * Audience: returning visitors who have been to the site before.
   * Framing:  Personalised welcome-back — acknowledge they know us, reduce friction.
   *           Bottom-right toast, success style, auto-dismisses after 8 seconds.
   */
  {
    _id:          variantId("notification_returning"),
    _type:        "notificationVariant",
    tenantId:     TENANT,
    key:          "notification_returning",
    isActive:     true,
    message:      "Welcome back! Ready to see Mister Chameleon on your own website?",
    severity:     "success",
    ctaLabel:     "Book a personalised demo",
    ctaHref:      "/demo",
    position:     "bottom-right",
    dismissible:  true,
    autoDismissMs: 8000,
  },

] as const;
