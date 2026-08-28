/**
 * demo/content-generator.ts
 *
 * Scenario generation for prospect demos (the Mirror demo's scenario switcher).
 * Server only, no network calls.
 *
 * The Synthetic (Legacy) demo mode and its template/AI content builders were
 * removed; only `generateScenarios(analysis)` — the 5-scenario array that powers
 * the Mirror demo's scenario switcher — remains here.
 */

import type {
  SiteAnalysis,
  SiteCategory,
  DemoScenario,
  DemoScenarioId,
  DemoExperience,
  DemoVisitorContext,
} from "./types";

// ── Public exports ────────────────────────────────────────────────────────────


/** Legacy: generate 5 DemoScenario objects (still used for the scenario switcher). */
export function generateScenarios(analysis: SiteAnalysis): DemoScenario[] {
  const ctx: TemplateContext = {
    siteName:    analysis.title     || extractDomain(analysis.fetchedUrl),
    description: analysis.description || "a great solution for your needs",
    category:    analysis.category,
    h1:          analysis.firstH1   || analysis.title || "",
  };
  const templates = SCENARIO_TEMPLATES[analysis.category] ?? SCENARIO_TEMPLATES["general"];
  return SCENARIO_IDS.map((id) => {
    const tpl = templates[id];
    return { id, label: tpl.label, description: tpl.description, context: tpl.context, experience: tpl.experience(ctx) };
  });
}

interface TemplateContext {
  siteName:    string;
  description: string;
  category:    SiteCategory;
  h1:          string;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}


// ── Legacy scenario templates (unchanged — still powers the scenario switcher) ─

const SCENARIO_IDS: DemoScenarioId[] = [
  "new_visitor", "returning_visitor", "high_intent", "careers", "evening",
];

interface ScenarioTemplate {
  label:       string;
  description: string;
  context:     DemoVisitorContext;
  experience:  (ctx: TemplateContext) => DemoExperience;
}
type TemplateSets = Record<DemoScenarioId, ScenarioTemplate>;

const B2B_SAAS_TEMPLATES: TemplateSets = {
  new_visitor: {
    label: "New visitor", description: "First-time visitor arriving from organic search or social. Awareness stage — focus on value proposition and credibility.",
    context: { description: "Anonymous first-time visitor, likely from Google search", segment: "Unknown — possibly mid-market or SMB", intent: "browsing", source: "Organic search" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Welcome to ${siteName}`, subheadline: "Join thousands of teams who've transformed how they work. See why we're the platform others switch to.", ctaLabel: "Start free trial" },
      proof: { heading: "Trusted by growing teams worldwide", body: "From fast-growing startups to established enterprises, teams choose us when they're serious about results.", stat: "4.8 / 5 on G2 · Trusted by 2,000+ companies" },
      cta:   { heading: "Ready to see the difference?", body: "No credit card required. Set up in minutes, not months.", ctaLabel: "Get started free" },
    }),
  },
  returning_visitor: {
    label: "Returning visitor", description: "Visitor who has been on the site before. Now ready for a deeper look at features or pricing.",
    context: { description: "Returning visitor who browsed the site 3 days ago", segment: "Likely evaluating options", intent: "researching", source: "Direct / bookmark" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Welcome back. Ready to go deeper?`, subheadline: `You've seen what ${siteName} can do — now see how it fits your team's specific workflow.`, ctaLabel: "Book a personalised demo" },
      proof: { heading: "See how teams like yours made the switch", body: "Our onboarding team has helped hundreds of companies migrate — often in under a week.", stat: "Average time-to-value: 4 days" },
      cta:   { heading: "Still comparing options?", body: "We'll map out the ROI for your team — no obligation, no sales pitch.", ctaLabel: "Talk to our team" },
    }),
  },
  high_intent: {
    label: "High intent", description: "Visitor showing strong buying signals — visited pricing, spent time on feature pages.",
    context: { description: "Buyer-stage visitor who viewed pricing and feature pages", segment: "Mid-market, 50–200 employees", intent: "buying", source: "Competitor comparison site" },
    experience: ({ siteName }) => ({
      hero:  { headline: "Ready to make the call? Let's make it easy.", subheadline: `${siteName} integrates with your existing tools in hours. Our team can have you live before the end of the week.`, ctaLabel: "Start your trial now" },
      proof: { heading: "Companies like yours switched in days", body: "Our implementation team handles the heavy lifting. Most customers go live within 48 hours of signing.", stat: "98% of customers active within 5 days" },
      cta:   { heading: "Lock in your pricing today", body: "Annual plans include priority onboarding, a dedicated CSM, and a 30-day money-back guarantee.", ctaLabel: "Get my custom quote" },
    }),
  },
  careers: {
    label: "Careers visitor", description: "Visitor navigating toward the Careers section — potential job candidate.",
    context: { description: "Prospective employee exploring culture and open roles", intent: "browsing", source: "LinkedIn job listing" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Build something meaningful at ${siteName}`, subheadline: "We're a team of builders, thinkers, and problem-solvers. If you love solving hard problems with great people, we want to hear from you.", ctaLabel: "See open roles" },
      proof: { heading: "Why people love working here", body: "Flexible working, genuine ownership, and a team that celebrates wins together. We invest in your growth because your success is ours.", stat: "4.7 / 5 Glassdoor · 94% would recommend us" },
      cta:   { heading: "Found a role that fits?", body: "Applications take under 10 minutes. We review every one, and you'll hear back within 5 working days.", ctaLabel: "Apply now" },
    }),
  },
  evening: {
    label: "Evening visitor", description: "Late-evening visitor — likely a decision-maker doing research outside office hours.",
    context: { description: "Decision-maker browsing after hours (8–11 PM)", segment: "Director or VP level", intent: "researching", timeContext: "Tuesday evening" },
    experience: ({ siteName }) => ({
      hero:  { headline: "The research you do tonight shapes the decision you make tomorrow.", subheadline: `${siteName} gives your team exactly what they've been asking for — without the enterprise price tag or 6-month rollout.`, ctaLabel: "See the 5-minute overview" },
      proof: { heading: "Everything you need to make the case internally", body: "ROI calculator, security docs, customer references, and a ready-made deck for your next stakeholder meeting — all in one place." },
      cta:   { heading: "Leave with answers, not questions", body: "Our buyer guide covers pricing, integrations, and implementation timeline — all in plain language.", ctaLabel: "Download the buyer guide" },
    }),
  },
};

const AGENCY_TEMPLATES: TemplateSets = {
  new_visitor: {
    label: "New visitor", description: "Prospective client seeing the agency for the first time.",
    context: { description: "Potential client visiting for the first time", intent: "browsing", source: "Referral or search" },
    experience: ({ siteName }) => ({
      hero:  { headline: `${siteName} — where strategy meets craft`, subheadline: "We help ambitious brands stand out, grow fast, and tell better stories. Let's make something great together.", ctaLabel: "See our work" },
      proof: { heading: "Award-winning work for ambitious brands", body: "From early-stage startups to category leaders, we've shaped the brands people actually remember.", stat: "60+ brands launched · 3× industry awards" },
      cta:   { heading: "Let's talk about your project", body: "Tell us what you're building and we'll come back with a point of view — not just a proposal.", ctaLabel: "Start the conversation" },
    }),
  },
  returning_visitor: {
    label: "Returning visitor", description: "Prospect who has seen the portfolio. Now weighing the agency against alternatives.",
    context: { description: "Returning prospective client comparing agencies", intent: "researching" },
    experience: ({ siteName }) => ({
      hero:  { headline: "Still thinking? Here's what sets us apart.", subheadline: `${siteName} doesn't do generic. Every engagement starts with a real brief — and ends with work that performs.`, ctaLabel: "Read our case studies" },
      proof: { heading: "Clients who came back — and brought friends", body: "Over 70% of our clients extend or refer after their first project. We measure success by outcomes, not deliverables.", stat: "NPS: 72 · 70% repeat or referral clients" },
      cta:   { heading: "Ready to compare properly?", body: "We'll walk you through a project brief, our process, and typical timelines — so you can compare apples to apples.", ctaLabel: "Book a discovery call" },
    }),
  },
  high_intent: {
    label: "High intent", description: "Client actively scoping a project.",
    context: { description: "Active project scoping — visited brief and pricing pages", intent: "buying" },
    experience: ({ siteName }) => ({
      hero:  { headline: "You've done the research. Let's get into the detail.", subheadline: `${siteName} can turn your brief into a live campaign in as little as 3 weeks. Here's how we'd approach your project.`, ctaLabel: "Submit a project brief" },
      proof: { heading: "What happens after you reach out", body: "You'll hear from a senior strategist within 24 hours — not a BDR. We scope properly, price fairly, and start fast.", stat: "Average brief-to-kickoff: 10 days" },
      cta:   { heading: "Your project deserves the right team.", body: "Submit a brief today and receive a tailored response by tomorrow — no generic pitch decks.", ctaLabel: "Submit your brief" },
    }),
  },
  careers: {
    label: "Careers visitor", description: "Creative or strategist exploring the agency as a potential employer.",
    context: { description: "Creative professional exploring a career opportunity", intent: "browsing", source: "LinkedIn or portfolio referral" },
    experience: ({ siteName }) => ({
      hero:  { headline: `Do your best work at ${siteName}`, subheadline: "Small enough to move fast. Experienced enough to do it right. We're looking for people who care deeply about craft.", ctaLabel: "View open positions" },
      proof: { heading: "A studio built around great work", body: "No unnecessary layers. Direct client relationships. A team that challenges each other and celebrates together.", stat: "Average tenure: 3.2 years · 90% retention" },
      cta:   { heading: "Like what you see?", body: "Send us your portfolio and a short note about the work you want to be doing. We read everything.", ctaLabel: "Get in touch" },
    }),
  },
  evening: {
    label: "Evening visitor", description: "Marketing director or founder researching agency options after hours.",
    context: { description: "Senior decision-maker doing evening research", intent: "researching", timeContext: "Wednesday evening" },
    experience: ({ siteName }) => ({
      hero:  { headline: "The agency brief you write tonight determines next quarter's results.", subheadline: `${siteName} turns strategic briefs into high-performing creative — fast. See the work, then let's talk.`, ctaLabel: "Explore our case studies" },
      proof: { heading: "Everything you need before your next internal meeting", body: "Credentials deck, case studies by industry, and references available on request — all ready to share with your stakeholders." },
      cta:   { heading: "Tell us what you're working on", body: "Leave your brief or a quick note. You'll hear from a senior team member by 9 AM.", ctaLabel: "Leave us a brief" },
    }),
  },
};

const ECOMMERCE_TEMPLATES: TemplateSets = {
  new_visitor: { label: "New visitor", description: "First-time shopper discovering the brand.", context: { description: "New shopper, first visit", intent: "browsing", source: "Instagram ad or Google Shopping" }, experience: ({ siteName }) => ({ hero: { headline: `Welcome to ${siteName}`, subheadline: "Free shipping on your first order. Discover what thousands of happy customers already love.", ctaLabel: "Shop now" }, proof: { heading: "Loved by customers everywhere", body: "Real reviews from real customers. We stand behind every product with our no-quibble return policy.", stat: "4.9 stars · 12,000+ verified reviews" }, cta: { heading: "First-time shopper? Here's a treat.", body: "Get 10% off your first order when you sign up for our newsletter.", ctaLabel: "Claim your 10% discount" } }) },
  returning_visitor: { label: "Returning visitor", description: "Customer who has shopped before.", context: { description: "Returning customer, last order 3 weeks ago", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: "Welcome back — new arrivals just for you", subheadline: `We've added new styles to ${siteName} since your last visit. Loyal customers get early access to our latest drops.`, ctaLabel: "See what's new" }, proof: { heading: "Your loyalty means the world to us", body: "As a returning customer, you get free returns, priority support, and early access to sales.", stat: "Members save an average of €47 per order" }, cta: { heading: "Ready to treat yourself?", body: "Your wishlist is waiting. Free next-day delivery on orders over €50.", ctaLabel: "Continue shopping" } }) },
  high_intent: { label: "High intent", description: "Shopper who has added items to cart.", context: { description: "Shopper with items in cart, high purchase intent", intent: "buying" }, experience: ({ siteName }) => ({ hero: { headline: "Your cart is waiting — and so is free shipping", subheadline: `Complete your ${siteName} order today and get free next-day delivery. Limited stock on selected items.`, ctaLabel: "Complete my order" }, proof: { heading: "100% secure checkout", body: "We use bank-grade encryption. Your payment details are never stored. Free returns within 30 days, no questions asked.", stat: "30-day free returns · Secure checkout" }, cta: { heading: "Don't miss out", body: "Items in your cart are popular — we can't guarantee availability. Order now and receive by tomorrow.", ctaLabel: "Checkout now" } }) },
  careers: { label: "Careers visitor", description: "Potential employee browsing career opportunities.", context: { description: "Job seeker interested in retail or e-commerce careers", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: `Join the ${siteName} team`, subheadline: "We're building something special — and we want great people to build it with us. Flexible roles, real growth.", ctaLabel: "See open roles" }, proof: { heading: "A great place to grow", body: "Staff discount, flexible hours, and a culture that invests in your development. We promote from within.", stat: "60% of managers started in entry-level roles" }, cta: { heading: "Ready to apply?", body: "Applications take under 5 minutes. You'll hear back within 3 working days.", ctaLabel: "Apply now" } }) },
  evening: { label: "Evening visitor", description: "Evening shopper — often making considered purchases with time to browse.", context: { description: "Relaxed evening shopper with time to browse", intent: "browsing", timeContext: "Sunday evening" }, experience: ({ siteName }) => ({ hero: { headline: "Evening inspiration — free next-day delivery when you order tonight", subheadline: `Browse the full ${siteName} collection at your own pace. Order before midnight for next-day delivery.`, ctaLabel: "Start browsing" }, proof: { heading: "No rush — free returns on everything", body: "Not sure? Order two sizes and return the one that doesn't fit, free. We make it easy to shop with confidence.", stat: "Free returns · 30 days to decide" }, cta: { heading: "Found something you love?", body: "Order tonight and receive tomorrow. Gift wrapping available at checkout.", ctaLabel: "Shop the collection" } }) },
};

const RECRUITMENT_TEMPLATES: TemplateSets = {
  new_visitor: { label: "New visitor", description: "Job seeker or employer finding the platform for the first time.", context: { description: "First-time visitor — could be employer or candidate", intent: "browsing", source: "Google search" }, experience: ({ siteName }) => ({ hero: { headline: `Find the right fit — faster with ${siteName}`, subheadline: "Whether you're hiring or job-seeking, we make the match. Thousands of roles and top-tier talent, all in one place.", ctaLabel: "Get started" }, proof: { heading: "The platform that works for both sides", body: "Employers fill roles faster. Candidates land offers they actually want. Everyone wins.", stat: "50,000+ placements · Average fill time: 12 days" }, cta: { heading: "Not sure where to start?", body: "Tell us whether you're hiring or looking — and we'll personalise your experience from there.", ctaLabel: "Tell us your goal" } }) },
  returning_visitor: { label: "Returning visitor", description: "Returning candidate or employer — show progress and next steps.", context: { description: "Returning user who started a profile or job search", intent: "researching" }, experience: ({ siteName }) => ({ hero: { headline: "Welcome back — your next step is waiting", subheadline: `New roles matching your profile have been added to ${siteName} since your last visit. Don't let the right opportunity pass.`, ctaLabel: "See new matches" }, proof: { heading: "Candidates who stayed consistent got results", body: "Active profiles receive 3× more employer views. Update your availability and let opportunities come to you.", stat: "3× more employer views for active profiles" }, cta: { heading: "Ready to take the next step?", body: "Complete your profile and get matched to top employers in your field — free.", ctaLabel: "Complete my profile" } }) },
  high_intent: { label: "High intent", description: "Employer ready to post or candidate ready to apply — reduce friction.", context: { description: "Decision-stage user ready to post or apply", intent: "buying" }, experience: ({ siteName }) => ({ hero: { headline: "Ready to post? You're two minutes from your first applicant.", subheadline: `${siteName}'s smart matching puts your role in front of the right candidates immediately. No wasted applications.`, ctaLabel: "Post a job now" }, proof: { heading: "First applicants within hours, not weeks", body: "Our matching algorithm screens for fit before candidates apply — so your shortlist is always quality-first.", stat: "Average: 8 qualified applicants in 48 hours" }, cta: { heading: "Post today, interview this week", body: "First job post is free. No credit card required.", ctaLabel: "Post my first role free" } }) },
  careers: { label: "Careers visitor", description: "Someone interested in working at the recruitment platform itself.", context: { description: "Job seeker interested in internal roles at the platform", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: `Work at ${siteName} — help people find their next chapter`, subheadline: "We're on a mission to make recruitment human again. Join the team that's changing how the world finds work.", ctaLabel: "See our open roles" }, proof: { heading: "Inside the team that builds the platform", body: "A mix of tech, talent, and hustle. We're growing fast and looking for people who want real impact from day one.", stat: "40 countries represented · Fully remote-friendly" }, cta: { heading: "Ready to join us?", body: "Browse our current openings and apply in minutes. Every application gets a personal response.", ctaLabel: "View open roles" } }) },
  evening: { label: "Evening visitor", description: "Candidate doing evening job search — motivated, focused, ready to act.", context: { description: "Motivated job seeker researching after work hours", intent: "researching", timeContext: "Thursday evening" }, experience: ({ siteName }) => ({ hero: { headline: "The right move starts with the right search", subheadline: `Browse ${siteName} at your own pace tonight — set up job alerts so you never miss the role that fits.`, ctaLabel: "Search jobs now" }, proof: { heading: "Confidential, discreet, effective", body: "Your current employer will never be notified. Browse and apply privately — we only connect you when you're ready.", stat: "100% confidential job searching" }, cta: { heading: "Set up your alert before you sleep", body: "New roles matching your criteria, delivered to your inbox each morning. Takes 60 seconds to set up.", ctaLabel: "Create my job alert" } }) },
};

const GENERAL_TEMPLATES: TemplateSets = {
  new_visitor: { label: "New visitor", description: "First-time visitor — focus on clarity and value proposition.", context: { description: "First-time visitor discovering the brand", intent: "browsing", source: "Search or referral" }, experience: ({ siteName }) => ({ hero: { headline: `Welcome to ${siteName}`, subheadline: "We help businesses like yours grow smarter. Find out why thousands of customers choose us.", ctaLabel: "Learn more" }, proof: { heading: "Trusted by businesses like yours", body: "From small teams to global companies, we deliver results that matter.", stat: "2,000+ happy customers · 4.8 / 5 rating" }, cta: { heading: "Ready to get started?", body: "Talk to our team and find out what we can do for you.", ctaLabel: "Get in touch" } }) },
  returning_visitor: { label: "Returning visitor", description: "Returning visitor doing deeper research before deciding.", context: { description: "Returning visitor evaluating options", intent: "researching" }, experience: ({ siteName }) => ({ hero: { headline: "Good to see you back — still have questions?", subheadline: `We're here to help you make the right decision. See how ${siteName} stacks up for your specific needs.`, ctaLabel: "Talk to an expert" }, proof: { heading: "Real results for real businesses", body: "Our customers see measurable improvement within 30 days. We'll show you exactly how.", stat: "Customers see results within 30 days" }, cta: { heading: "Let's find the right fit together", body: "A quick 20-minute call is all it takes to know if we're the right choice for your team.", ctaLabel: "Book a quick call" } }) },
  high_intent: { label: "High intent", description: "Decision-stage visitor — remove friction and make it easy to act.", context: { description: "Visitor in the decision stage", intent: "buying" }, experience: ({ siteName }) => ({ hero: { headline: "Make your move — we'll make it seamless", subheadline: `${siteName} is ready when you are. Our team will have you set up and seeing results within days.`, ctaLabel: "Get started today" }, proof: { heading: "Fast onboarding, lasting results", body: "We've helped hundreds of companies get up and running quickly — and stay happy long after.", stat: "Average time to first result: 72 hours" }, cta: { heading: "Let's make it official", body: "Get a personalised plan and pricing for your team today.", ctaLabel: "Request my plan" } }) },
  careers: { label: "Careers visitor", description: "Potential employee browsing career opportunities.", context: { description: "Prospective employee exploring the company", intent: "browsing" }, experience: ({ siteName }) => ({ hero: { headline: `Grow your career at ${siteName}`, subheadline: "Join a team that's passionate about what they do. We invest in people, reward great work, and have fun along the way.", ctaLabel: "See open roles" }, proof: { heading: "A place where careers thrive", body: "Competitive pay, flexible working, and a culture built on trust. We're proud of the team we've built.", stat: "Glassdoor rating: 4.6 · 91% would recommend" }, cta: { heading: "Find your next role", body: "We hire for attitude and train for skill. If you share our values, we want to hear from you.", ctaLabel: "Apply now" } }) },
  evening: { label: "Evening visitor", description: "Late-evening visitor doing self-directed research.", context: { description: "Decision-maker browsing outside office hours", intent: "researching", timeContext: "Evening" }, experience: ({ siteName }) => ({ hero: { headline: "Taking your time to get this right? Smart.", subheadline: `${siteName} gives you everything you need to make an informed decision — case studies, pricing, and references all in one place.`, ctaLabel: "Explore at your pace" }, proof: { heading: "All the information — none of the pressure", body: "Download our product guide, read customer stories, or compare plans — we make the research easy." }, cta: { heading: "Leave with what you need", body: "Drop us a question and we'll send a personal reply by 9 AM tomorrow.", ctaLabel: "Ask us anything" } }) },
};

const SCENARIO_TEMPLATES: Record<SiteCategory, TemplateSets> = {
  b2b_saas:    B2B_SAAS_TEMPLATES,
  agency:      AGENCY_TEMPLATES,
  ecommerce:   ECOMMERCE_TEMPLATES,
  recruitment: RECRUITMENT_TEMPLATES,
  general:     GENERAL_TEMPLATES,
};
