/**
 * DemoViewer — v2
 *
 * Full-page, bilingual, scenario-aware prospect demo viewer.
 *
 * Features:
 *   • Language switcher (EN / NL)
 *   • 5-scenario tab switcher with visible content changes
 *   • Multi-block page rendering (nav, hero, services, proof, cases, cta, pricing, careers, footer)
 *   • Demo mode switcher (Personalisation Demo / Brand Match / Structure)
 *   • Before/After comparison panel
 *   • Graceful fallback to legacy scenario content when v2 content is absent
 */

"use client";

import { useState, useEffect } from "react";
import type {
  DemoInstance,
  DemoScenario,
  DemoPageContent,
  DemoLanguage,
  DemoMode,
  ScenarioOverride,
  DemoScenarioId,
  HeroBlock,
  ServicesBlock,
  ProofBlock,
  CtaBlock,
  PricingBlock,
  CareersBlock,
  CasesBlock,
} from "@/demo/types";
import { blockTokensToStyle, type CuratedBlockTokens } from "@/design-system/theme/block-token-set";

// ── Props ──────────────────────────────────────────────────────────────────────

interface DemoViewerProps { demo: DemoInstance; }

// ── Root component ─────────────────────────────────────────────────────────────

export function DemoViewer({ demo }: DemoViewerProps) {
  const [activeScenarioId, setActiveScenarioId] = useState<DemoScenarioId>(
    (demo.scenarios[0]?.id ?? "new_visitor") as DemoScenarioId,
  );
  const [language, setLanguage] = useState<DemoLanguage>(
    demo.content_nl ? (demo.brand_signals ? (demo.brand_signals.confidence === "high" ? "nl" : "en") : "en") : "en",
  );
  const [mode, setMode] = useState<DemoMode>("personalization_demo");

  const activeScenario = demo.scenarios.find((s) => s.id === activeScenarioId) ?? demo.scenarios[0];
  const richContent    = language === "nl" ? demo.content_nl : demo.content_en;
  const hasRich        = !!richContent;

  // CSS theme vars
  const primary   = demo.primary_color   ?? "#3b82f6";
  const secondary = demo.secondary_color ?? "#1e3a8a";

  // Google Fonts injection
  useEffect(() => {
    const fontsUrl = demo.brand_signals?.googleFontsUrl;
    if (!fontsUrl) return;
    const existing = document.querySelector(`link[href="${fontsUrl}"]`);
    if (existing) return;
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = fontsUrl;
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [demo.brand_signals?.googleFontsUrl]);

  // Design tokens extracted from the prospect's site (if any) — render on-brand.
  const blockTokens = (demo.brand_signals?.blockTokens ?? undefined) as CuratedBlockTokens | undefined;
  const tokenStyle  = blockTokensToStyle(blockTokens);

  const fontFamily = blockTokens?.headingFont
    ?? (demo.brand_signals?.headingFont
      ? `"${demo.brand_signals.headingFont}", system-ui, sans-serif`
      : "system-ui, -apple-system, sans-serif");

  const themeVars = {
    // Block-token CSS vars first (bg/text/card/etc. + wrapper backgroundColor),
    // then the demo's own vars — preferring extracted tokens where present.
    ...tokenStyle,
    "--demo-primary":   blockTokens?.primary ?? primary,
    "--demo-secondary": blockTokens?.primaryHover ?? blockTokens?.textBrand ?? secondary,
    "--demo-font":      fontFamily,
  } as React.CSSProperties;

  return (
    <div style={{ ...themeVars, fontFamily }} className="min-h-screen bg-neutral-100 antialiased">

      {/* ── Top control bar ────────────────────────────────────────────────── */}
      <ControlBar
        demo={demo}
        language={language}
        onLanguageChange={setLanguage}
        mode={mode}
        onModeChange={setMode}
        hasRich={hasRich}
      />

      {/* ── Scenario bar ───────────────────────────────────────────────────── */}
      <ScenarioBar
        scenarios={demo.scenarios}
        activeId={activeScenarioId}
        onSelect={setActiveScenarioId}
        primary={primary}
      />

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-4">

        {/* Browser chrome + page */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-xl bg-white">
          <BrowserChrome url={demo.source_url} />

          {hasRich && richContent ? (
            <RichPage
              content={richContent}
              scenario={activeScenario}
              demo={demo}
              mode={mode}
              primary={primary}
              secondary={secondary}
              fontFamily={fontFamily}
            />
          ) : (
            <LegacyPage
              scenario={activeScenario}
              demo={demo}
              primary={primary}
              secondary={secondary}
            />
          )}
        </div>

        {/* Before / After panel */}
        {activeScenario && (
          <BeforeAfterPanel
            scenario={activeScenario}
            content={richContent}
            genericSiteName={demo.site_name}
            primary={primary}
            secondary={secondary}
          />
        )}

        {/* Demo footer */}
        <DemoFooter
          generatedFor={demo.site_name}
          expiresAt={demo.expires_at}
          imagesAttribution={!!demo.page_images}
        />
      </div>
    </div>
  );
}

// ── Control bar ────────────────────────────────────────────────────────────────

function ControlBar({
  demo, language, onLanguageChange, mode, onModeChange, hasRich,
}: {
  demo:               DemoInstance;
  language:           DemoLanguage;
  onLanguageChange:   (l: DemoLanguage) => void;
  mode:               DemoMode;
  onModeChange:       (m: DemoMode) => void;
  hasRich:            boolean;
}) {
  const secondary = demo.secondary_color ?? "#1e3a8a";
  const hasBothLangs = !!(demo.content_en && demo.content_nl);

  return (
    <div className="sticky top-0 z-50 border-b shadow-sm"
      style={{ background: secondary, borderColor: secondary }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">

        {/* Left: site info */}
        <div className="flex items-center gap-3 min-w-0">
          {demo.favicon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={demo.favicon_url} alt="" className="h-5 w-5 rounded-sm object-contain shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="min-w-0">
            <span className="text-sm font-semibold text-white truncate block">{demo.site_name}</span>
            <span className="hidden text-[11px] text-white/60 sm:block">
              {(() => { try { return new URL(demo.source_url).hostname; } catch { return demo.source_url; } })()}
            </span>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white sm:block">
            🎭 Demo
          </span>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Language switcher */}
          {hasBothLangs && (
            <div className="flex rounded-md overflow-hidden border border-white/30">
              {(["en", "nl"] as DemoLanguage[]).map((l) => (
                <button key={l} onClick={() => onLanguageChange(l)}
                  className={`px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors ${
                    language === l ? "bg-white text-gray-900" : "text-white/80 hover:bg-white/20"
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Mode selector */}
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as DemoMode)}
            className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-[11px] text-white font-medium cursor-pointer focus:outline-none"
          >
            <option value="personalization_demo">🎯 Personalisation</option>
            <option value="brand_match">🎨 Brand Match</option>
            <option value="structure_match">🏗 Structure</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Scenario bar ───────────────────────────────────────────────────────────────

function ScenarioBar({
  scenarios, activeId, onSelect, primary,
}: {
  scenarios: DemoScenario[];
  activeId:  DemoScenarioId;
  onSelect:  (id: DemoScenarioId) => void;
  primary:   string;
}) {
  const active = scenarios.find((s) => s.id === activeId);

  return (
    <div className="bg-white border-b border-neutral-200 sticky top-[49px] z-40">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex gap-1 pt-3 pb-0 overflow-x-auto scrollbar-hide">
          {scenarios.map((s) => {
            const isActive = s.id === activeId;
            return (
              <button key={s.id}
                onClick={() => onSelect(s.id as DemoScenarioId)}
                className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                  isActive
                    ? "border-current text-current bg-neutral-50"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
                style={isActive ? { color: primary, borderColor: primary } : {}}>
                {SCENARIO_ICONS[s.id] ?? "👤"} {s.label}
              </button>
            );
          })}
        </div>

        {active && (
          <div className="pb-2 pt-1.5 flex items-center gap-4 text-xs text-neutral-500">
            <span>{active.context.description}</span>
            {active.context.intent && (
              <span className="hidden sm:block">
                Intent: <span className="font-medium capitalize text-neutral-700">{active.context.intent}</span>
              </span>
            )}
            {active.context.source && (
              <span className="hidden sm:block">
                Source: <span className="font-medium text-neutral-700">{active.context.source}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SCENARIO_ICONS: Record<string, string> = {
  new_visitor: "👋", returning_visitor: "🔄", high_intent: "🎯", careers: "💼", evening: "🌙",
};

// ── Browser chrome ─────────────────────────────────────────────────────────────

function BrowserChrome({ url }: { url: string }) {
  let display = url;
  try { const u = new URL(url); display = u.hostname + (u.pathname !== "/" ? u.pathname : ""); } catch { /* keep */ }

  return (
    <div className="flex items-center gap-3 bg-neutral-100 px-4 py-2.5 border-b border-neutral-200">
      <div className="flex gap-1.5">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-green-400" />
      </div>
      <div className="flex-1 rounded border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-500 font-mono truncate">
        🔒 {display}
      </div>
    </div>
  );
}

// ── Rich page renderer ─────────────────────────────────────────────────────────

function RichPage({
  content, scenario, demo, mode, primary, secondary, fontFamily,
}: {
  content:    DemoPageContent;
  scenario:   DemoScenario | undefined;
  demo:       DemoInstance;
  mode:       DemoMode;
  primary:    string;
  secondary:  string;
  fontFamily: string;
}) {
  // Apply scenario overrides on top of base content
  const override: ScenarioOverride = scenario
    ? (content.scenarioOverrides?.[scenario.id as DemoScenarioId] ?? {})
    : {};

  const hero: HeroBlock = {
    ...content.hero,
    headline:    override.heroHeadline    ?? content.hero.headline,
    subheadline: override.heroSubheadline ?? content.hero.subheadline,
    primaryCta:  override.heroCta         ?? content.hero.primaryCta,
  };

  const proof: ProofBlock = {
    ...content.proof,
    heading: override.proofHeading ?? content.proof.heading,
  };

  const cta: CtaBlock = {
    ...content.cta,
    heading:    override.ctaHeading ?? content.cta.heading,
    body:       override.ctaBody    ?? content.cta.body,
    primaryCta: override.ctaCta     ?? content.cta.primaryCta,
  };

  const showStructureLabels = mode === "structure_match";
  const isPersonalization   = mode === "personalization_demo";

  const blockLabel = (label: string) =>
    showStructureLabels ? (
      <div className="absolute top-2 left-2 z-10 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white font-mono uppercase tracking-wider">
        {label}
      </div>
    ) : null;

  return (
    <div style={{ fontFamily }}>

      {/* Site nav */}
      <SiteNav demo={demo} content={content} primary={primary} secondary={secondary} />

      {/* Hero */}
      <div className="relative">
        {blockLabel("hero")}
        <HeroSection
          hero={hero}
          demo={demo}
          primary={primary}
          secondary={secondary}
          isPersonalized={isPersonalization}
          hasOverride={!!(override.heroHeadline || override.heroSubheadline)}
        />
      </div>

      {/* Services */}
      <div className="relative">
        {blockLabel("services")}
        <ServicesSection services={content.services} primary={primary} />
      </div>

      {/* Proof */}
      <div className="relative">
        {blockLabel("social proof")}
        <ProofSection proof={proof} primary={primary} secondary={secondary}
          images={demo.page_images}
          isPersonalized={isPersonalization}
          hasOverride={!!override.proofHeading}
        />
      </div>

      {/* Cases */}
      {content.cases && (
        <div className="relative">
          {blockLabel("case studies")}
          <CasesSection cases={content.cases} primary={primary} />
        </div>
      )}

      {/* Pricing */}
      {content.pricing && (
        <div className="relative">
          {blockLabel("pricing")}
          <PricingSection pricing={content.pricing} primary={primary} secondary={secondary} />
        </div>
      )}

      {/* Careers */}
      {content.careers && demo.scenarios.some((s) => s.id === "careers") && (
        <div className="relative">
          {blockLabel("careers")}
          <CareersSection careers={content.careers} primary={primary} secondary={secondary} />
        </div>
      )}

      {/* CTA banner */}
      <div className="relative">
        {blockLabel("cta")}
        <CtaSection cta={cta} secondary={secondary}
          isPersonalized={isPersonalization}
          hasOverride={!!(override.ctaHeading || override.ctaBody)}
        />
      </div>

      {/* Site footer */}
      <SiteFooter demo={demo} secondary={secondary} content={content} />
    </div>
  );
}

// ── Site nav ───────────────────────────────────────────────────────────────────

function SiteNav({
  demo, content, primary, secondary,
}: {
  demo:      DemoInstance;
  content:   DemoPageContent;
  primary:   string;
  secondary: string;
}) {
  const navLinks = demo.brand_signals?.navLinks?.slice(0, 5) ?? [];
  const hasPricing  = demo.brand_signals?.hasPricingPage  ?? !!content.pricing;
  const hasCareers  = demo.brand_signals?.hasCareersPage  ?? !!content.careers;
  const hasCases    = demo.brand_signals?.hasCasesPage    ?? !!content.cases;

  const displayLinks = navLinks.length >= 3
    ? navLinks
    : [
        hasCases    && "Cases",
        hasPricing  && "Pricing",
        hasCareers  && "Careers",
        "Contact",
      ].filter(Boolean) as string[];

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-neutral-100">
      <div className="flex items-center gap-3">
        {demo.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={demo.logo_url} alt={demo.site_name}
            className="h-8 max-w-[140px] object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="text-base font-bold" style={{ color: secondary }}>{demo.site_name}</span>
        )}
      </div>
      <nav className="hidden md:flex items-center gap-6">
        {displayLinks.slice(0, 5).map((link) => (
          <span key={link} className="text-sm text-neutral-600 cursor-pointer hover:text-neutral-900 transition-colors">
            {link}
          </span>
        ))}
      </nav>
      <button className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: primary }}>
        {content.hero.primaryCta}
      </button>
    </header>
  );
}

// ── Hero section ───────────────────────────────────────────────────────────────

function HeroSection({
  hero, demo, primary, secondary, isPersonalized, hasOverride,
}: {
  hero:          HeroBlock;
  demo:          DemoInstance;
  primary:       string;
  secondary:     string;
  isPersonalized: boolean;
  hasOverride:   boolean;
}) {
  const hasImage = !!hero.imageUrl;

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      {hasImage ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.imageUrl} alt={hero.imageAlt ?? ""} className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${secondary}e6 0%, ${primary}99 100%)` }} />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${secondary} 0%, ${primary} 100%)` }} />
      )}

      {/* Content */}
      <div className="relative z-10 px-8 py-20 max-w-2xl">
        {isPersonalized && hasOverride && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs text-white font-semibold">
            ✨ Personalised for this visitor
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          {hero.headline}
        </h1>
        <p className="mt-4 text-lg text-white/85 leading-relaxed">
          {hero.subheadline}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="rounded-lg bg-white px-6 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-105"
            style={{ color: secondary }}>
            {hero.primaryCta}
          </button>
          {hero.secondaryCta && (
            <button className="rounded-lg border border-white/60 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/15">
              {hero.secondaryCta}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Services section ───────────────────────────────────────────────────────────

function ServicesSection({
  services, primary,
}: {
  services: ServicesBlock;
  primary:  string;
}) {
  return (
    <section className="bg-white px-8 py-16">
      <div className="text-center max-w-xl mx-auto mb-12">
        <h2 className="text-2xl font-bold text-neutral-900">{services.heading}</h2>
        {services.subheading && (
          <p className="mt-2 text-neutral-500">{services.subheading}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
        {services.services.map((s, i) => (
          <div key={i} className="rounded-xl border border-neutral-100 bg-neutral-50 p-5 hover:border-neutral-200 hover:shadow-sm transition-all">
            <div className="text-3xl mb-3">{s.icon}</div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1.5">{s.title}</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Proof section ──────────────────────────────────────────────────────────────

function ProofSection({
  proof, primary, secondary, images, isPersonalized, hasOverride,
}: {
  proof:          ProofBlock;
  primary:        string;
  secondary:      string;
  images:         DemoInstance["page_images"];
  isPersonalized: boolean;
  hasOverride:    boolean;
}) {
  return (
    <section className="bg-neutral-50 px-8 py-16 border-t border-neutral-100">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          {isPersonalized && hasOverride && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: primary }}>
              ✨ Personalised
            </span>
          )}
          <h2 className="text-2xl font-bold text-neutral-900">{proof.heading}</h2>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {proof.metrics.map((m, i) => (
            <div key={i} className="text-center p-5 rounded-xl bg-white border border-neutral-200 shadow-sm">
              <div className="text-2xl font-bold" style={{ color: primary }}>{m.value}</div>
              <div className="mt-1 text-xs text-neutral-500 font-medium">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        {proof.testimonial && (
          <div className="rounded-xl bg-white border border-neutral-200 p-6 shadow-sm">
            <blockquote className="text-neutral-700 leading-relaxed italic">
              "{proof.testimonial.quote}"
            </blockquote>
            <footer className="mt-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ background: secondary }}>
                {proof.testimonial.author[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{proof.testimonial.author}</p>
                <p className="text-xs text-neutral-500">
                  {proof.testimonial.role}{proof.testimonial.company ? `, ${proof.testimonial.company}` : ""}
                </p>
              </div>
            </footer>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Cases section ──────────────────────────────────────────────────────────────

function CasesSection({ cases, primary }: { cases: CasesBlock; primary: string }) {
  return (
    <section className="bg-white px-8 py-16 border-t border-neutral-100">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-neutral-900 mb-8">{cases.heading}</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {cases.cases.map((c, i) => (
            <div key={i} className="rounded-xl border border-neutral-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-neutral-900">{c.company}</span>
                {c.industry && (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-500">{c.industry}</span>
                )}
              </div>
              <p className="text-sm text-neutral-600 mb-3">{c.description}</p>
              <p className="text-sm font-semibold" style={{ color: primary }}>→ {c.result}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing section ────────────────────────────────────────────────────────────

function PricingSection({
  pricing, primary, secondary,
}: {
  pricing:   PricingBlock;
  primary:   string;
  secondary: string;
}) {
  return (
    <section className="bg-neutral-50 px-8 py-16 border-t border-neutral-100">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-neutral-900">{pricing.heading}</h2>
          {pricing.subheading && <p className="mt-2 text-neutral-500">{pricing.subheading}</p>}
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {pricing.tiers.map((tier, i) => (
            <div key={i}
              className={`rounded-xl border p-6 transition-shadow ${
                tier.highlighted
                  ? "shadow-md ring-2"
                  : "border-neutral-200 bg-white hover:shadow-sm"
              }`}
              style={tier.highlighted ? { borderColor: primary, boxShadow: `0 0 0 2px ${primary}30` } : {}}>
              {tier.highlighted && (
                <div className="mb-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ background: primary }}>
                  Recommended
                </div>
              )}
              <h3 className="font-bold text-neutral-900">{tier.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-2xl font-bold" style={tier.highlighted ? { color: primary } : {}}>{tier.price}</span>
                <span className="text-xs text-neutral-500 ml-1">{tier.period}</span>
              </div>
              <p className="text-xs text-neutral-500 mb-4">{tier.description}</p>
              <ul className="space-y-2 mb-5">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-xs text-neutral-700">
                    <span style={{ color: primary }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full rounded-lg py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  tier.highlighted ? "text-white" : "border border-neutral-200 text-neutral-700 bg-white"
                }`}
                style={tier.highlighted ? { background: primary } : {}}>
                {tier.ctaLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Careers section ────────────────────────────────────────────────────────────

function CareersSection({
  careers, primary, secondary,
}: {
  careers:   CareersBlock;
  primary:   string;
  secondary: string;
}) {
  return (
    <section className="bg-white px-8 py-16 border-t border-neutral-100">
      <div className="max-w-4xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">{careers.heading}</h2>
            <p className="text-neutral-600 leading-relaxed">{careers.body}</p>
            <button className="mt-6 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: secondary }}>
              {careers.ctaLabel}
            </button>
          </div>
          <div className="space-y-3">
            {careers.roles.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{r.title}</p>
                  <p className="text-xs text-neutral-500">{r.department}</p>
                </div>
                <span className="text-xs text-neutral-400">{r.location}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CTA section ────────────────────────────────────────────────────────────────

function CtaSection({
  cta, secondary, isPersonalized, hasOverride,
}: {
  cta:            CtaBlock;
  secondary:      string;
  isPersonalized: boolean;
  hasOverride:    boolean;
}) {
  return (
    <section className="px-8 py-16" style={{ background: secondary }}>
      <div className="max-w-2xl mx-auto text-center">
        {isPersonalized && hasOverride && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs text-white font-semibold">
            ✨ Personalised for this visitor
          </div>
        )}
        <h2 className="text-2xl font-bold text-white">{cta.heading}</h2>
        <p className="mt-3 text-white/80 leading-relaxed">{cta.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="rounded-lg bg-white px-7 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-105"
            style={{ color: secondary }}>
            {cta.primaryCta}
          </button>
          {cta.secondaryCta && (
            <button className="rounded-lg border border-white/60 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/15">
              {cta.secondaryCta}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Site footer ────────────────────────────────────────────────────────────────

function SiteFooter({
  demo, secondary, content,
}: {
  demo:      DemoInstance;
  secondary: string;
  content:   DemoPageContent;
}) {
  const hasPricing = !!content.pricing;
  const hasCareers = !!content.careers;
  const hasCases   = !!content.cases;

  return (
    <footer className="px-8 py-8 border-t border-neutral-100 bg-white">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <span className="font-bold text-sm" style={{ color: secondary }}>{demo.site_name}</span>
        <nav className="flex flex-wrap gap-5 text-xs text-neutral-400">
          {hasCases    && <span className="cursor-pointer hover:text-neutral-600 transition-colors">Cases</span>}
          {hasPricing  && <span className="cursor-pointer hover:text-neutral-600 transition-colors">Pricing</span>}
          {hasCareers  && <span className="cursor-pointer hover:text-neutral-600 transition-colors">Careers</span>}
          <span className="cursor-pointer hover:text-neutral-600 transition-colors">Privacy</span>
          <span className="cursor-pointer hover:text-neutral-600 transition-colors">Contact</span>
        </nav>
        <span className="text-xs text-neutral-300">© {new Date().getFullYear()} {demo.site_name}</span>
      </div>
    </footer>
  );
}

// ── Legacy page (fallback when no v2 content) ─────────────────────────────────

function LegacyPage({
  scenario, demo, primary, secondary,
}: {
  scenario:  DemoScenario | undefined;
  demo:      DemoInstance;
  primary:   string;
  secondary: string;
}) {
  if (!scenario) return null;
  const { hero, proof, cta } = scenario.experience;

  return (
    <div>
      {/* Minimal nav */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-neutral-100">
        {demo.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={demo.logo_url} alt={demo.site_name} className="h-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <span className="font-bold text-sm" style={{ color: secondary }}>{demo.site_name}</span>
        )}
        <button className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white"
          style={{ background: primary }}>
          {hero.ctaLabel}
        </button>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-8 py-16"
        style={{ background: `linear-gradient(135deg, ${secondary} 0%, ${primary} 100%)` }}>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold text-white leading-tight">{hero.headline}</h1>
          <p className="mt-4 text-lg text-white/80 leading-relaxed">{hero.subheadline}</p>
          <button className="mt-8 rounded-lg bg-white px-6 py-3 text-sm font-semibold shadow-lg"
            style={{ color: secondary }}>
            {hero.ctaLabel}
          </button>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full opacity-20"
          style={{ background: primary }} aria-hidden />
      </section>

      {/* Proof */}
      <section className="bg-white px-8 py-12">
        <h2 className="text-xl font-semibold text-neutral-900">{proof.heading}</h2>
        <p className="mt-3 text-neutral-600 leading-relaxed">{proof.body}</p>
        {proof.stat && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-sm font-medium text-neutral-700">
            <span style={{ color: primary }}>✓</span> {proof.stat}
          </p>
        )}
      </section>

      {/* CTA */}
      <section className="px-8 py-12" style={{ background: secondary }}>
        <h2 className="text-xl font-bold text-white">{cta.heading}</h2>
        <p className="mt-2 text-white/75 leading-relaxed">{cta.body}</p>
        <button className="mt-6 rounded-lg bg-white px-6 py-2.5 text-sm font-semibold shadow"
          style={{ color: secondary }}>
          {cta.ctaLabel}
        </button>
      </section>
    </div>
  );
}

// ── Before / after panel ──────────────────────────────────────────────────────

function BeforeAfterPanel({
  scenario, content, genericSiteName, primary, secondary,
}: {
  scenario:        DemoScenario | undefined;
  content:         DemoPageContent | null;
  genericSiteName: string;
  primary:         string;
  secondary:       string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!scenario) return null;

  const override = content?.scenarioOverrides?.[scenario.id as DemoScenarioId];

  const genericHero = `Welcome to ${genericSiteName}. We help businesses grow.`;
  const genericCta  = "Contact us to learn more.";

  const personalHero = override?.heroHeadline ?? scenario.experience.hero.headline;
  const personalSub  = override?.heroSubheadline ?? scenario.experience.hero.subheadline;
  const personalCta  = override?.ctaHeading ?? scenario.experience.cta.heading;

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-50 transition-colors">
        <div>
          <p className="text-sm font-semibold text-neutral-800">
            Before &amp; After — how personalisation changes the message
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Generic copy vs. what a <strong>{scenario.label.toLowerCase()}</strong> sees
          </p>
        </div>
        <span className="text-neutral-400 text-lg ml-4">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100">
          {/* Before */}
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-neutral-300" />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Without personalisation</span>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-300 mb-1">Hero headline</p>
                <p className="italic text-neutral-500">"{genericHero}"</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-300 mb-1">CTA</p>
                <p className="italic text-neutral-500">"{genericCta}"</p>
              </div>
            </div>
          </div>

          {/* After */}
          <div className="p-6 bg-neutral-50">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: primary }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: primary }}>
                {SCENARIO_ICONS[scenario.id] ?? "👤"} {scenario.label}
              </span>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1">Hero headline</p>
                <p className="font-semibold text-neutral-800">"{personalHero}"</p>
                {personalSub && <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{personalSub}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1">CTA heading</p>
                <p className="font-semibold text-neutral-800">"{personalCta}"</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Demo footer ────────────────────────────────────────────────────────────────

function DemoFooter({
  generatedFor, expiresAt, imagesAttribution,
}: {
  generatedFor:       string;
  expiresAt:          string;
  imagesAttribution:  boolean;
}) {
  const expiresDate = new Date(expiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <footer className="mt-12 text-center text-xs text-neutral-400 space-y-1">
      <p>
        This is a personalisation preview generated for{" "}
        <span className="font-medium text-neutral-500">{generatedFor}</span>{" "}
        by{" "}
        <a href="https://misterchameleon.com" target="_blank" rel="noopener noreferrer"
          className="font-medium text-neutral-500 hover:underline">
          Mister Chameleon
        </a>
        .
      </p>
      <p>Link expires {expiresDate}. Content is AI-generated — this is not the live site.</p>
      {imagesAttribution && (
        <p>Photography by <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer"
          className="hover:underline">Unsplash</a>.</p>
      )}
    </footer>
  );
}
