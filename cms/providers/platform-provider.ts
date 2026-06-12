/**
 * PlatformCMSProvider
 *
 * A lightweight, built-in CMS provider that stores all variant documents in
 * the Supabase `platform_cms_content` table.  No external headless CMS is
 * required — operators can author and edit content directly in the Mister
 * Chameleon admin UI.
 *
 * ─── When to use ──────────────────────────────────────────────────────────────
 *
 *   Ideal for tenants who:
 *     • Do not have an existing CMS (Sanity, Storyblok, etc.)
 *     • Want to get started quickly without a 3rd-party integration
 *     • Need simple personalisation without managing a full CMS project
 *
 * ─── What is supported ────────────────────────────────────────────────────────
 *
 *   ✓  Hero, Proof, CTA, Feature, Conversion variant resolution
 *   ✓  getContentByKeys — batch read for all variant types
 *   ✓  provisionSite    — seeds a sensible set of starter variants
 *   ✓  testConnection   — pings Supabase to confirm DB connectivity
 *   ✗  SiteSettings     — returns null (use Sanity for full site structure)
 *   ✗  Pages            — returns null (platform CMS is variant-only)
 *   ✗  Entity documents — returns null/[] (news, vacancies, companies)
 *   ✗  Collection resolution — returns []
 *
 * ─── Caching policy ───────────────────────────────────────────────────────────
 *
 *   PlatformCMSProvider is intentionally NOT wrapped with CachedCMSProvider.
 *   Edits made in the admin UI must be immediately visible on the next request.
 *   The create-cms-provider factory skips the `wrap()` call for the
 *   "platform" case specifically for this reason.
 *
 * ─── DB schema ────────────────────────────────────────────────────────────────
 *
 *   Table: platform_cms_content
 *     id           uuid PK
 *     tenant_id    text
 *     variant_type text  CHECK IN ('hero','proof','cta','feature','conversion')
 *     variant_key  text
 *     content      jsonb
 *     created_at   timestamptz
 *     updated_at   timestamptz
 *   UNIQUE (tenant_id, variant_type, variant_key)
 */

import type { CMSProvider, ProvisionResult, TestConnectionResult } from "./cms-provider";
import type {
  HeroBlockData,
  ProofBlockData,
  CTABlockData,
  FeatureBlockData,
  ConversionBlockData,
  NotificationBlockData,
  AdaptiveBlockData,
  SiteSettingsData,
  PageData,
  CompanyData,
  NewsArticleData,
  VacancyData,
} from "../types";
import type { TenantSettings } from "@/tenant/types";
import type { CollectionContentSource, CollectionItem } from "@/page-config/collection-source";
import type { PlatformCmsContentInsert } from "@/data/types";
import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

// ── Typed DB cast helper ──────────────────────────────────────────────────────

type SingleResult<T> = { data: T | null; error: { message: string } | null };
type ManyResult<T>   = { data: T[] | null; error: { message: string } | null };
function asSingle<T>(r: unknown): SingleResult<T> { return r as SingleResult<T>; }
function asMany<T>(r: unknown):   ManyResult<T>   { return r as ManyResult<T>;   }

// ── Row shape returned from Supabase ─────────────────────────────────────────

interface ContentRow {
  variant_key:  string;
  variant_type: string;
  content:      Record<string, unknown>;
}

// ── PlatformCMSProvider ───────────────────────────────────────────────────────

export class PlatformCMSProvider implements CMSProvider {
  constructor(private readonly tenantId: string) {}

  // ── Private DB helper ───────────────────────────────────────────────────────

  /**
   * Fetch a single variant document from the DB.
   * Returns the typed content, or null when no row exists.
   */
  private async fetchVariant<T>(
    variantType: "hero" | "proof" | "cta" | "feature" | "conversion" | "notification",
    key: string,
  ): Promise<T | null> {
    try {
      const { data, error } = asSingle<ContentRow>(
        await getDb()
          .from("platform_cms_content")
          .select("variant_key, variant_type, content")
          .eq("tenant_id",    this.tenantId)
          .eq("variant_type", variantType)
          .eq("variant_key",  key)
          .maybeSingle(),
      );

      if (error || !data) return null;

      // The stored JSONB must have `id` set to the variant key so callers
      // can use data.id safely (matches the convention in all other providers).
      const doc = { ...data.content, id: key } as T;
      return doc;
    } catch (err) {
      logger.error("[PlatformCMS] fetchVariant error", { variantType, key, err });
      return null;
    }
  }

  // ── Variant fetches ─────────────────────────────────────────────────────────

  async getHeroVariant(key: string): Promise<HeroBlockData | null> {
    return this.fetchVariant<HeroBlockData>("hero", key);
  }

  async getProofVariant(key: string): Promise<ProofBlockData | null> {
    return this.fetchVariant<ProofBlockData>("proof", key);
  }

  async getCTAVariant(key: string): Promise<CTABlockData | null> {
    return this.fetchVariant<CTABlockData>("cta", key);
  }

  async getFeatureVariant(key: string): Promise<FeatureBlockData | null> {
    return this.fetchVariant<FeatureBlockData>("feature", key);
  }

  async getConversionVariant(key: string): Promise<ConversionBlockData | null> {
    return this.fetchVariant<ConversionBlockData>("conversion", key);
  }

  async getNotificationVariant(key: string): Promise<NotificationBlockData | null> {
    return this.fetchVariant<NotificationBlockData>("notification", key);
  }

  async getAdaptiveBlock(key: string): Promise<AdaptiveBlockData | null> {
    // Adaptive blocks are stored in the dedicated `adaptive_blocks` Supabase table.
    // Delegate to the platform-managed store (tenant_id scoped to this.tenantId).
    try {
      const { getAdaptiveBlockByKey } = await import("@/lib/adaptive-blocks/adaptive-blocks-store");
      return getAdaptiveBlockByKey(key, this.tenantId ?? null);
    } catch {
      // Graceful degradation: return null if the store is unavailable.
      return null;
    }
  }

  // ── Site-level fetches ──────────────────────────────────────────────────────

  /**
   * PlatformCMSProvider is variant-only — full site structure (header, footer,
   * nav) is not stored in the platform_cms_content table.
   */
  async getSiteSettings(_locale?: string): Promise<SiteSettingsData | null> {
    return null;
  }

  // ── Page fetches ────────────────────────────────────────────────────────────

  async getPageBySlug(_slug: string, _locale?: string): Promise<PageData | null> {
    return null;
  }

  async getContentByKeys(keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) return {};

    try {
      const { data, error } = asMany<ContentRow>(
        await getDb()
          .from("platform_cms_content")
          .select("variant_key, variant_type, content")
          .eq("tenant_id", this.tenantId)
          .in("variant_key", keys),
      );

      const result: Record<string, unknown> = {};
      // Initialise all requested keys to null.
      for (const k of keys) result[k] = null;

      if (error || !data) return result;

      for (const row of data) {
        result[row.variant_key] = { ...row.content, id: row.variant_key };
      }

      return result;
    } catch (err) {
      logger.error("[PlatformCMS] getContentByKeys error", { err });
      const result: Record<string, unknown> = {};
      for (const k of keys) result[k] = null;
      return result;
    }
  }

  // ── Entity document stubs ───────────────────────────────────────────────────

  async getNewsArticleBySlug(_slug: string): Promise<NewsArticleData | null> { return null; }
  async getNewsArticles(_options?: { limit?: number; tags?: string[]; company?: string }): Promise<NewsArticleData[]> { return []; }
  async getVacancyBySlug(_slug: string): Promise<VacancyData | null> { return null; }
  async getVacancies(_options?: { limit?: number; company?: string }): Promise<VacancyData[]> { return []; }
  async getCompanyBySlug(_slug: string): Promise<CompanyData | null> { return null; }
  async getCompanies(_options?: { limit?: number }): Promise<CompanyData[]> { return []; }

  // ── Collection resolution ───────────────────────────────────────────────────

  async resolveCollection(_source: CollectionContentSource): Promise<CollectionItem[]> {
    return [];
  }

  async getListingFilters(
    _collection: import("@/page-config/collection-source").CollectionKey,
  ): Promise<import("@/page-config/collection-source").ListingFilters> {
    return [];
  }

  // ── Provider management ─────────────────────────────────────────────────────

  /**
   * Provision starter variant content for this tenant.
   *
   * Seeds all variant keys required by the 6 demo scenarios and 10 audience
   * segment plans across hero, proof, CTA, feature, conversion, and notification
   * block types.  Uses an upsert strategy so re-running is safe — existing
   * customised variants are NOT overwritten (insert-only-if-absent behaviour
   * via `ignoreDuplicates: true`).  New variants added in later versions will
   * be inserted on re-provision without touching any existing content.
   *
   * If `dryRun` is true, the documents are built and returned without writing.
   */
  async provisionSite(
    tenant: TenantSettings,
    options?: { dryRun?: boolean },
  ): Promise<ProvisionResult> {
    const tid = this.tenantId;

    const heroRows = [
      // ── Core homepage heroes ─────────────────────────────────────────────────
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_default",
        content: {
          title:    "Your website, personalised for every visitor.",
          subtitle: "Mister Chameleon detects who's visiting and automatically serves the version of your site that converts them — without A/B tests, engineering sprints, or guesswork.",
          ctas:     [{ label: "Start for free", href: "/signup", variant: "primary" }, { label: "See how it works", href: "/how-it-works", variant: "secondary" }],
          tag:      "Adaptive websites that convert",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_direct_brand",
        content: {
          title:    "Transform your website into a personalised experience",
          subtitle: "Mister Chameleon detects who's visiting and serves the content that converts — in milliseconds, without code.",
          ctas:     [{ label: "Start free trial", href: "/trial/start", variant: "primary" }, { label: "See how it works", href: "/the-engine", variant: "secondary" }],
          tag:      "AI-powered personalisation",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_consideration",
        content: {
          title:    "More visits shouldn't mean more confusion.",
          subtitle: "You've explored the platform. The question isn't whether adaptive websites work — it's how quickly you can get one live. Most teams do it in an afternoon.",
          ctas:     [{ label: "Book a quick demo", href: "/demo", variant: "primary" }, { label: "See live examples", href: "/cases", variant: "secondary" }],
          tag:      "You've seen what we do. Here's why it works.",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_intent_direct",
        content: {
          title:    "High intent deserves a high-impact message.",
          subtitle: "Visitors convert when the message matches the moment. Mister Chameleon identifies them automatically and shows exactly the right version of your site — no A/B test setup, no engineering ticket.",
          ctas:     [{ label: "Start your free trial", href: "/signup", variant: "primary" }, { label: "Talk to sales", href: "/demo", variant: "secondary" }],
          tag:      "Your next experiment is already waiting",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_customer_onboarding",
        content: {
          title:    "Welcome to Mister Chameleon. Your engine is ready.",
          subtitle: "Connect your domain, define your first two rules, and your adaptive homepage goes live in minutes. No engineering sprint. No waiting.",
          ctas:     [{ label: "Open the quick-start guide", href: "/docs/quickstart", variant: "primary" }],
          tag:      "You're in — let's ship your first experience",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_google_problem",
        content: {
          title:    "Your website speaks to no one. Fix that in minutes.",
          subtitle: "Most visitors leave because your homepage wasn't written for them. Mister Chameleon detects where they came from and instantly serves the version of your site that converts.",
          ctas:     [{ label: "Fix my homepage", href: "/trial/start", variant: "primary" }, { label: "See it live", href: "/demo", variant: "secondary" }],
          tag:      "Stop sending every visitor to the same page",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_linkedin_vision",
        content: {
          title:    "The personalisation layer your website is missing",
          subtitle: "Every visitor has a different intent. Mister Chameleon reads the signals and adapts your homepage content dynamically — no dev work, no A/B test, no guesswork.",
          ctas:     [{ label: "Explore the platform", href: "/the-engine", variant: "primary" }, { label: "Talk to us", href: "/contact", variant: "secondary" }],
          tag:      "Built for modern marketing teams",
        },
      },
      // ── Page banner heroes (used on inner CMS pages) ─────────────────────────
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_page_banner_awareness",
        content: {
          title:    "Your website, personalised for every visitor.",
          subtitle: "Mister Chameleon adapts headlines, proof, and CTAs in real time — no code changes, no privacy trade-offs.",
          ctas:     [{ label: "Start free trial", href: "/order/starter", variant: "primary" }, { label: "Watch the demo", href: "/demo", variant: "secondary" }],
          tag:      "Discover Mister Chameleon",
          layoutVariant: "hero_page_banner",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_page_banner_consideration",
        content: {
          title:    "See how teams like yours are converting more visitors.",
          subtitle: "Real results, real customers — no guesswork. Watch the demo and decide for yourself.",
          ctas:     [{ label: "Watch the demo", href: "/demo", variant: "primary" }, { label: "Read case studies", href: "/cases", variant: "secondary" }],
          tag:      "See it in action",
          layoutVariant: "hero_page_banner",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_page_banner_high_intent",
        content: {
          title:    "You are this close to your first adaptive visitor.",
          subtitle: "Setup takes 15 minutes. Your first personalised experience could go live today — no engineering ticket required.",
          ctas:     [{ label: "Start free trial", href: "/order/starter", variant: "primary" }, { label: "Book a demo call", href: "/contact", variant: "secondary" }],
          tag:      "Ready to start?",
          layoutVariant: "hero_page_banner",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_page_banner_returning",
        content: {
          title:    "Good to see you again.",
          subtitle: "You're back — pick up where you left off, or explore a part of the platform you haven't seen yet.",
          ctas:     [{ label: "Continue to demo", href: "/demo", variant: "primary" }, { label: "See what's new", href: "/changelog", variant: "secondary" }],
          tag:      "Welcome back",
          layoutVariant: "hero_page_banner",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_page_banner_enterprise",
        content: {
          title:    "Personalisation at scale, without the setup cost.",
          subtitle: "Dedicated onboarding, SLA support, white-label options, and a team that picks up the phone — built for enterprise organisations.",
          ctas:     [{ label: "Book an enterprise call", href: "/contact", variant: "primary" }],
          tag:      "Enterprise personalisation",
          layoutVariant: "hero_page_banner",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "hero" as const,
        variant_key:  "hero_page_banner_friction",
        content: {
          title:    "Still weighing it up? That is completely fine.",
          subtitle: "Most teams try one rule, see the lift, and never look back. But the decision has to feel right first. Talk to someone, read how it works, or just keep exploring.",
          ctas:     [{ label: "Talk to someone first", href: "/contact", variant: "primary" }, { label: "See how it works", href: "/how-it-works", variant: "secondary" }],
          tag:      "No rush",
          layoutVariant: "hero_page_banner",
        },
      },
    ];

    const proofRows = [
      {
        tenant_id:    tid,
        variant_type: "proof" as const,
        variant_key:  "proof_default",
        content: {
          title: "Trusted by growth teams worldwide",
          items: [
            { title: "2,000+ teams already adapting", text: "From early-stage SaaS startups to enterprise marketing teams, Mister Chameleon powers adaptive experiences across industries — without a single engineering sprint." },
            { title: "Live in under 5 minutes", text: "Connect your domain, write two rules, and your first adaptive experience is live before your next meeting. Most teams ship the same afternoon." },
            { title: "Zero PII. Full compliance.", text: "Mister Chameleon never stores visitor data. Every signal is evaluated ephemerally at the edge — GDPR and CCPA compliant without lifting a finger." },
          ],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "proof" as const,
        variant_key:  "proof_vision",
        content: {
          title: "Why personalisation wins",
          items: [
            { title: "Intent-first", text: "We read behavioural signals — traffic source, scroll depth, prior visits — before serving a single pixel." },
            { title: "Edge-native", text: "Decisions run at the CDN edge, not in your server — eliminating latency and infrastructure risk." },
            { title: "Privacy by design", text: "No PII is stored. Signals are in-session only, fully GDPR and ePrivacy compliant." },
          ],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "proof" as const,
        variant_key:  "proof_cases",
        content: {
          title: "Conversion lifts that speak for themselves",
          items: [
            { title: "3.2x more qualified leads", text: "SaaS teams using Mister Chameleon see an average 3.2x lift in demo requests within 30 days of going live — no engineering changes required." },
            { title: "First experience live in under 5 minutes", text: "Connect your domain, define two rules, and your first adaptive experience is live. Most teams are shipping within a single afternoon." },
            { title: "12 visitor signals, evaluated in real time", text: "Source, device, campaign, recency, and more — every visit triggers a silent evaluation so the right experience loads before the page paints." },
          ],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "proof" as const,
        variant_key:  "proof_stats",
        content: {
          title: "The numbers that matter",
          items: [
            { title: "3.2x more qualified leads, on average", text: "Teams that run Mister Chameleon for 30 days see an average 3.2x increase in demo requests — without changing ad spend or redesigning the site." },
            { title: "Sub-5 ms context evaluation at the edge", text: "Every visit is evaluated in real time before the first byte is served. Zero latency impact. Zero impact on Core Web Vitals." },
            { title: "12 visitor signals, evaluated simultaneously", text: "Source, device, geo, company, campaign, recency, intent score, and more — all combined into a single context snapshot that drives the experience decision." },
          ],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "proof" as const,
        variant_key:  "proof_platform",
        content: {
          title: "Infrastructure you can trust",
          items: [
            { title: "Edge-native decision engine", text: "Context detection and experience resolution happen at the CDN edge — sub-5ms latency with no origin round-trip, regardless of visitor location." },
            { title: "99.99% uptime SLA", text: "Deployed across a global active-active edge network with automatic failover, zero-downtime deployments, and a public status page." },
            { title: "GDPR & CCPA compliant by default", text: "No PII is collected or stored. Every signal is evaluated ephemerally, in memory, in real time. Your visitors' privacy is preserved automatically." },
          ],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "proof" as const,
        variant_key:  "proof_reassurance",
        content: {
          title: "Trusted by teams who've been in your position",
          items: [
            { title: "No lock-in. Cancel any time.", text: "Month-to-month billing, full data export, and a team that won't hold your content hostage. If Mister Chameleon doesn't deliver, you leave — simple." },
            { title: "Setup support included on all plans", text: "Dedicated onboarding assistance, documentation written for humans, and a support team that responds in hours — not days." },
            { title: "Works with the CMS you already use", text: "Connect Sanity, Storyblok, or keep it simple with the built-in platform editor. No mandatory migration, no rework of existing content." },
          ],
        },
      },
    ];

    const ctaRows = [
      {
        tenant_id:    tid,
        variant_type: "cta" as const,
        variant_key:  "cta_default",
        content: {
          title: "Ready to see what a personalised homepage can do?",
          text:  "Join thousands of growth teams who use Mister Chameleon to serve the right message to the right visitor — automatically, without engineering involvement.",
          ctas:  [{ label: "Start for free", href: "/signup", variant: "primary" }, { label: "Book a demo", href: "/demo", variant: "secondary" }],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "cta" as const,
        variant_key:  "cta_guide",
        content: {
          title: "Ready to personalise your homepage?",
          text:  "Set up takes 10 minutes. Start with the free plan — no credit card required.",
          ctas:  [{ label: "Get started free", href: "/trial/start", variant: "primary" }],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "cta" as const,
        variant_key:  "cta_meeting",
        content: {
          title: "Let's build your personalisation strategy together",
          text:  "Book a 30-minute demo and we'll show you exactly how Mister Chameleon works for your site.",
          ctas:  [{ label: "Book a demo", href: "/book-demo", variant: "primary" }, { label: "Start for free", href: "/signup", variant: "secondary" }],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "cta" as const,
        variant_key:  "cta_platform",
        content: {
          title: "See the platform in action",
          text:  "Explore the decision engine, rule builder, and variant editor — live on your own content.",
          ctas:  [{ label: "Explore the platform", href: "/the-engine", variant: "primary" }],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "cta" as const,
        variant_key:  "cta_demo",
        content: {
          title: "See exactly how it would look for your site",
          text:  "Book a 20-minute screen-share. We'll show you a live adaptive experience built around your three most important visitor segments. No pitch deck.",
          ctas:  [{ label: "Book a 20-minute demo", href: "/demo", variant: "primary" }, { label: "Read case studies first", href: "/cases", variant: "secondary" }],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "cta" as const,
        variant_key:  "cta_onboarding",
        content: {
          title: "Your first adaptive experience is one step away",
          text:  "Follow the quick-start guide to connect your domain, set your first two rules, and watch the engine go live — usually in under 10 minutes.",
          ctas:  [{ label: "Open quick-start guide", href: "/docs/quickstart", variant: "primary" }, { label: "Talk to onboarding support", href: "/contact", variant: "secondary" }],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "cta" as const,
        variant_key:  "cta_expansion",
        content: {
          title: "Ready to unlock the next level?",
          text:  "Your current plan is doing the work. But if you're hitting limits on rules, variants, or tenants — it's time to talk. Upgrading takes less than 5 minutes.",
          ctas:  [{ label: "View upgrade options", href: "/pricing", variant: "primary" }, { label: "Talk to your account manager", href: "/contact", variant: "secondary" }],
        },
      },
    ];

    const featureRows = [
      {
        tenant_id:    tid,
        variant_type: "feature" as const,
        variant_key:  "feature_highlights",
        content: {
          title:         "Why growth teams choose Mister Chameleon",
          subtitle:      "Personalisation that works without a machine learning team.",
          layoutVariant: "feature_highlights",
          items: [
            { title: "Context-aware, not cookie-dependent", body: "Mister Chameleon reads 12 visitor signals — source, company, device, recency, and intent — at the edge in real time. No cookies needed. No consent banner required. GDPR-compliant by design.", icon: "eye" },
            { title: "Rules you can read, write, and trust", body: "Every experience decision is driven by a rule you defined in plain language. No black-box ML model you can't explain to your CEO. Every variant served is logged and auditable.", icon: "check-circle" },
            { title: "Integrates with your CMS in minutes", body: "Connect Sanity, Storyblok, or a headless CMS you already use. Write variant copy in the CMS you know — Mister Chameleon handles the routing and serving automatically.", icon: "plug" },
          ],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "feature" as const,
        variant_key:  "feature_grid_primary",
        content: {
          title:         "Everything you need to personalise at scale",
          subtitle:      "Three capabilities. One platform. Zero engineering sprints.",
          layoutVariant: "feature_grid",
          items: [
            { title: "Adaptive decision engine", body: "Real-time visitor context — source, device, geo, company, and campaign — evaluated at the edge in under 5 ms. No cookies. No PII.", icon: "zap" },
            { title: "CMS-powered variant library", body: "Write hero, proof, and CTA variants once in your CMS. The engine selects the right one for every visitor, automatically.", icon: "layers" },
            { title: "Experiment and analytics layer", body: "A/B test any variant slot without writing code. Track served variants and conversion lift with built-in analytics — no third-party tools required.", icon: "bar-chart-2" },
            { title: "Multi-tenant architecture", body: "Run adaptive experiences for multiple brands or products from a single platform. Tenant-scoped rules, content, and analytics — all in one place.", icon: "globe" },
            { title: "No-code rule builder", body: "Define conditions and assign variant plans using a point-and-click interface. No SQL, no regex, no engineering tickets — just logical, readable rules.", icon: "sliders" },
            { title: "Edge-native, globally fast", body: "Every decision runs at the CDN edge — sub-5 ms latency regardless of where your visitor is. Core Web Vitals stay green. Conversions go up.", icon: "shield" },
          ],
        },
      },
      {
        tenant_id:    tid,
        variant_type: "feature" as const,
        variant_key:  "feature_comparison",
        content: {
          title:         "How Mister Chameleon compares",
          subtitle:      "Not all personalisation platforms are built the same.",
          layoutVariant: "feature_comparison",
          items: [
            { title: "No-code rule builder", body: "Mister Chameleon: yes — point-and-click condition editor, readable in plain English. Most platforms: requires developer config or a data science pipeline.", icon: "sliders" },
            { title: "Edge-native evaluation", body: "Mister Chameleon: decisions run at the CDN edge, sub-5 ms. Most platforms: server-side evaluation adds 100–400 ms per page load.", icon: "zap" },
            { title: "Cookie-free and GDPR-compliant", body: "Mister Chameleon: no PII stored, no consent banner required. Most platforms: require cookie consent and data processing agreements.", icon: "shield" },
            { title: "Multi-tenant out of the box", body: "Mister Chameleon: tenant-scoped rules, content, and analytics included on all plans. Most platforms: multi-tenancy is an enterprise add-on at 3–10x the price.", icon: "globe" },
          ],
        },
      },
    ];

    const conversionRows = [
      {
        tenant_id:    tid,
        variant_type: "conversion" as const,
        variant_key:  "conversion_signup",
        content: {
          title:        "Start free. Upgrade when you're ready.",
          text:         "Create your account in under 60 seconds. No credit card, no sales call, no six-month onboarding. Your first adaptive experience ships today.",
          ctas:         [{ label: "Create your free account", href: "/signup", variant: "primary" }, { label: "See a live demo", href: "/demo", variant: "secondary" }],
          urgencyLabel: "Join 2,000+ growth teams already using Mister Chameleon",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "conversion" as const,
        variant_key:  "conversion_demo",
        content: {
          title:        "See your site, personalised. Live.",
          text:         "Book a 20-minute screen-share and we'll show you exactly how Mister Chameleon would serve your three highest-value visitor segments. Bring your real site.",
          ctas:         [{ label: "Book a live demo", href: "/demo", variant: "primary" }, { label: "Start free instead", href: "/signup", variant: "secondary" }],
          urgencyLabel: "Usually scheduled within 24 hours",
        },
      },
      {
        tenant_id:    tid,
        variant_type: "conversion" as const,
        variant_key:  "conversion_contact",
        content: {
          title:        "Have a question? We're here.",
          text:         "Whether you're evaluating the platform, need help with setup, or just want to talk to a human — drop us a message and we'll respond within one business day.",
          ctas:         [{ label: "Send a message", href: "/contact", variant: "primary" }],
          urgencyLabel: "Response within one business day",
        },
      },
    ];

    const notificationRows = [
      {
        tenant_id:    tid,
        variant_type: "notification" as const,
        variant_key:  "notification_default",
        content: {
          message:      "✨ Nieuw: ontdek onze meest recente functie — nu beschikbaar voor alle klanten.",
          severity:     "info",
          ctaLabel:     "Meer info",
          ctaHref:      "/features",
          position:     "top",
          dismissible:  true,
          autoDismissMs: 0,
        },
      },
      {
        tenant_id:    tid,
        variant_type: "notification" as const,
        variant_key:  "notification_offer",
        content: {
          message:      "🎁 Beperkte aanbieding: 30% korting op het Growth-plan — alleen deze week.",
          severity:     "promo",
          ctaLabel:     "Claim korting",
          ctaHref:      "/pricing",
          position:     "top",
          dismissible:  true,
          autoDismissMs: 0,
        },
      },
      {
        tenant_id:    tid,
        variant_type: "notification" as const,
        variant_key:  "notification_urgency",
        content: {
          message:      "⏳ Nog 3 plekken vrij voor onze live onboarding-sessie — schrijf je nu in.",
          severity:     "warning",
          ctaLabel:     "Reserveer je plek",
          ctaHref:      "/book-demo",
          position:     "top",
          dismissible:  true,
          autoDismissMs: 0,
        },
      },
      {
        tenant_id:    tid,
        variant_type: "notification" as const,
        variant_key:  "notification_returning",
        content: {
          message:      "👋 Welkom terug! Bekijk wat er nieuw is sinds je laatste bezoek.",
          severity:     "success",
          ctaLabel:     "Bekijk updates",
          ctaHref:      "/changelog",
          position:     "bottom-right",
          dismissible:  true,
          autoDismissMs: 8000,
        },
      },
    ];

    const allRows: PlatformCmsContentInsert[] = [
      ...heroRows.map((r) => ({ ...r, content: r.content as Record<string, unknown> })),
      ...proofRows.map((r) => ({ ...r, content: r.content as Record<string, unknown> })),
      ...ctaRows.map((r) => ({ ...r, content: r.content as Record<string, unknown> })),
      ...featureRows.map((r) => ({ ...r, content: r.content as Record<string, unknown> })),
      ...conversionRows.map((r) => ({ ...r, content: r.content as Record<string, unknown> })),
      ...notificationRows.map((r) => ({ ...r, content: r.content as Record<string, unknown> })),
    ];
    const documentIds = allRows.map((r) => `${r.variant_type}/${r.variant_key}`);

    if (options?.dryRun) {
      return {
        ok:                  true,
        documentIds,
        pagesCreated:        0,
        pagesUpdated:        0,
        variantsWritten:     allRows.length,
        siteSettingsWritten: false,
        navItemsWritten:     0,
        warnings:            ["Dry run — no documents were written."],
      };
    }

    try {
      // Cast through unknown: `platform_cms_content` was added after the DB type
      // was last generated; upsert() is stricter than insert() on unknown tables.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (getDb() as any)
        .from("platform_cms_content")
        .upsert(allRows, { onConflict: "tenant_id,variant_type,variant_key", ignoreDuplicates: true });

      if (error) {
        logger.error("[PlatformCMS] provisionSite upsert error", { tenantId: tid, error });
        return { ok: false, error: error.message };
      }

      logger.info("[PlatformCMS] provisionSite complete", {
        tenantId:    tid,
        rowsSeeded:  allRows.length,
      });

      return {
        ok:                  true,
        documentIds,
        pagesCreated:        0,
        pagesUpdated:        0,
        variantsWritten:     allRows.length,
        siteSettingsWritten: false,
        navItemsWritten:     0,
        warnings:            ["Platform CMS provisions variant documents only. Page structure and site settings are not provisioned."],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[PlatformCMS] provisionSite exception", { tenantId: tid, err });
      return { ok: false, error: message };
    }
  }

  /**
   * Verify that the DB connection is alive and the table is accessible.
   */
  async testConnection(): Promise<TestConnectionResult> {
    try {
      const { error } = await getDb()
        .from("platform_cms_content")
        .select("id")
        .eq("tenant_id", this.tenantId)
        .limit(1);

      if (error) {
        return { ok: false, provider: "platform", error: error.message };
      }

      return { ok: true, provider: "platform", readAccess: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, provider: "platform", error: message };
    }
  }
}
