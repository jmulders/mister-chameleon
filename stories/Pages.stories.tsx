/**
 * Page Starter Stories
 *
 * Full-page Storybook compositions for all 7 site starters.  Each story
 * renders a complete above-the-fold homepage view with the correct theme
 * applied via scoped CSS custom property injection — identical to the
 * production runtime mechanism.
 *
 * ─── Story structure ─────────────────────────────────────────────────────────
 *
 *   Pages / AI Product Landing         — dark-ai (near-black + indigo-violet)
 *   Pages / B2B Lead Generation        — clean-corporate (white + sky-blue)
 *   Pages / Product-Led SaaS           — structured-saas (stone + amber-600)
 *   Pages / Enterprise SaaS            — corporate-trust (slate + blue-600)
 *   Pages / Careers Platform           — careers-human (warm-gray + teal)
 *   Pages / Content & Blog             — editorial-classic (white + editorial serif)
 *   Pages / DTC Store                  — bold-marketing (white + pink-600)
 *
 * ─── Starter → Theme mapping ─────────────────────────────────────────────────
 *
 *   ai_product_landing       → dark-ai
 *   b2b_lead_generation      → clean-corporate
 *   product_led_saas         → structured-saas
 *   enterprise_saas          → corporate-trust
 *   careers_platform         → careers-human
 *   content_blog             → editorial-classic
 *   ecommerce_dtc            → bold-marketing
 *
 * ─── Developer usage ─────────────────────────────────────────────────────────
 *
 *   Use these stories to verify:
 *     1. No white "flash" sections in dark-theme starters
 *     2. Typography, spacing, and button radius differ meaningfully per theme
 *     3. CTA accent colours are visually correct for each brand character
 *     4. Feature grid cards match the theme's card style (bordered vs elevated)
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FeatureGridBlock }        from "@/components/blocks/sections/FeatureGridBlock";
import { TestimonialSectionBlock } from "@/components/blocks/sections/TestimonialSectionBlock";
import { StatsBlock }              from "@/components/blocks/sections/StatsBlock";
import { CtaSectionBlock }         from "@/components/blocks/sections/CtaSectionBlock";
import { ProcessStepsBlock }       from "@/components/blocks/sections/ProcessStepsBlock";
import { LogoStripBlock }          from "@/components/blocks/sections/LogoStripBlock";

import { resolveTheme }     from "@/design-system/theme/presets";
import { tenantThemeToCSS } from "@/design-system/theme/tenant-theme";

// ── Shared fixture helpers ────────────────────────────────────────────────────

/** Minimal nav bar rendered without RSC dependency */
function PageNav({
  logoText,
  bgColor   = "transparent",
  textColor = "#fff",
  borderColor = "rgba(255,255,255,0.08)",
  links = ["Product", "Pricing", "Docs", "Company"],
  ctaLabel = "Get started",
  ctaBg = "var(--primary)",
  ctaText = "#fff",
  ctaRadius = "0.375rem",
  ctaBorder = "none",
}: {
  logoText:    string;
  bgColor?:    string;
  textColor?:  string;
  borderColor?: string;
  links?:      string[];
  ctaLabel?:   string;
  ctaBg?:      string;
  ctaText?:    string;
  ctaRadius?:  string;
  ctaBorder?:  string;
}) {
  return (
    <nav style={{
      background:   bgColor,
      borderBottom: `1px solid ${borderColor}`,
      padding:      "0 2rem",
      height:       "64px",
      display:      "flex",
      alignItems:   "center",
      justifyContent:"space-between",
    }}>
      <span style={{
        fontWeight:   700,
        fontSize:     "1.0625rem",
        color:        textColor,
        fontFamily:   "var(--font-heading, system-ui, sans-serif)",
        letterSpacing:"-0.02em",
      }}>
        {logoText}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {links.map(link => (
            <a key={link} href="#" style={{
              fontSize:  "0.875rem",
              color:     textColor,
              opacity:   0.75,
              textDecoration:"none",
              fontWeight: 500,
              fontFamily: "var(--font-sans, system-ui, sans-serif)",
            }}>{link}</a>
          ))}
        </div>
        <button style={{
          background:   ctaBg,
          color:        ctaText,
          padding:      "0.5rem 1.25rem",
          border:       ctaBorder,
          borderRadius: ctaRadius,
          fontWeight:   600,
          fontSize:     "0.875rem",
          cursor:       "pointer",
          fontFamily:   "var(--font-sans, system-ui, sans-serif)",
        }}>
          {ctaLabel}
        </button>
      </div>
    </nav>
  );
}

/** Minimal footer */
function PageFooter({
  bgColor      = "#0a0a0f",
  textColor    = "rgba(255,255,255,0.4)",
  logoText,
  links        = ["Privacy", "Terms", "Status", "Contact"],
}: {
  bgColor?:   string;
  textColor?: string;
  logoText:   string;
  links?:     string[];
}) {
  return (
    <footer style={{
      background:   bgColor,
      borderTop:    "1px solid rgba(255,255,255,0.06)",
      padding:      "3rem 2rem",
    }}>
      <div style={{
        maxWidth:       "1200px",
        margin:         "0 auto",
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        flexWrap:       "wrap",
        gap:            "1.5rem",
      }}>
        <span style={{ fontWeight: 700, color: textColor, fontFamily: "var(--font-heading, system-ui)", fontSize: "0.9375rem" }}>
          {logoText}
        </span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {links.map(link => (
            <a key={link} href="#" style={{ fontSize: "0.8125rem", color: textColor, textDecoration: "none", fontFamily: "var(--font-sans, system-ui)" }}>
              {link}
            </a>
          ))}
        </div>
        <span style={{ fontSize: "0.75rem", color: textColor, fontFamily: "var(--font-sans, system-ui)" }}>
          © 2026 {logoText}
        </span>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  AI Product Landing  →  dark-ai
// ─────────────────────────────────────────────────────────────────────────────

function AiProductLandingPage() {
  const cssVars = tenantThemeToCSS(resolveTheme("dark-ai"));

  const features = [
    { icon: "⚡", title: "Sub-100ms inference",  description: "Edge-deployed models respond globally with no cold starts." },
    { icon: "🔒", title: "Zero-trust security",   description: "SOC 2 Type II certified. Data never leaves your VPC." },
    { icon: "🔌", title: "Open API surface",       description: "RESTful and gRPC. SDKs in Python, TypeScript, Go, Rust." },
    { icon: "🧠", title: "Adaptive context",       description: "Persistent memory and multi-turn state across every session." },
  ] as const;

  const testimonials = [
    { quote: "We cut inference latency by 80% and our team hasn't looked back.", author: "Sven Nakamura", company: "CTO — Axiom Intelligence", avatar: "https://i.pravatar.cc/150?img=15" },
    { quote: "The API is the cleanest we've worked with. Zero magic, full control.", author: "Lena Hoffmann", company: "Lead Eng — Strata Labs", avatar: "https://i.pravatar.cc/150?img=23" },
    { quote: "From PoC to production in 4 weeks. The DX is that good.", author: "Marcus Chen", company: "Founder — Pulse AI", avatar: "https://i.pravatar.cc/150?img=55" },
  ] as const;

  return (
    <div id="mc-page-dark-ai" data-theme-preset="dark-ai" style={{ background: "#06060c", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `#mc-page-dark-ai { ${cssVars} }` }} />

      <PageNav
        logoText="NeuralKit"
        bgColor="rgba(6,6,12,0.92)"
        textColor="#e4e2f0"
        borderColor="rgba(123,110,255,0.15)"
        links={["Platform", "Docs", "Pricing", "Blog"]}
        ctaLabel="Start building"
        ctaBg="var(--primary, #7b6eff)"
        ctaRadius="2px"
      />

      {/* Hero */}
      <section style={{
        background: "var(--hero-bg, #03030a)",
        padding:    "7rem 2rem 6rem",
        textAlign:  "center",
        position:   "relative",
        overflow:   "hidden",
      }}>
        <div style={{
          position:     "absolute", top: "30%", left: "50%",
          transform:    "translate(-50%, -50%)",
          width:        "640px", height: "400px",
          background:   "radial-gradient(ellipse at center, rgba(123,110,255,0.18) 0%, transparent 70%)",
          pointerEvents:"none",
        }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "760px", margin: "0 auto" }}>
          <span style={{
            display:      "inline-block", fontSize: "0.75rem", letterSpacing: "0.12em",
            textTransform:"uppercase", color: "var(--text-brand, #a89eff)", marginBottom: "1.5rem",
            padding:      "0.25rem 0.75rem", border: "1px solid rgba(123,110,255,0.3)", borderRadius: "2px",
          }}>Now in public beta</span>
          <h1 style={{
            fontSize:     "clamp(2.75rem, 6vw, 5rem)", fontWeight: 700, letterSpacing: "-0.04em",
            lineHeight:   1.05, color: "#f0eeff", margin: "0 0 1.5rem",
            fontFamily:   "var(--font-heading, 'Manrope', system-ui, sans-serif)",
          }}>
            The intelligence layer your product has been missing
          </h1>
          <p style={{ fontSize: "1.125rem", lineHeight: 1.7, color: "#8884a8", marginBottom: "2.5rem" }}>
            Inference, memory, and structured output — one API, any model, global edge.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{ background: "var(--primary, #7b6eff)", color: "#fff", padding: "0.875rem 2rem", border: "none", borderRadius: "2px", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer" }}>
              Start building free
            </button>
            <button style={{ background: "transparent", color: "#e4e2f0", padding: "0.875rem 2rem", border: "1px solid #2d2b45", borderRadius: "2px", fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer" }}>
              Read docs →
            </button>
          </div>
        </div>
      </section>

      <FeatureGridBlock data={{ heading: "Everything you need to ship AI features", features }} variant="feature_grid_dark" />
      <TestimonialSectionBlock data={{ heading: "Trusted by engineering teams", testimonials }} variant="testimonial_highlight" />
      <CtaSectionBlock
        data={{ title: "The AI platform built for speed", description: "Deploy intelligent workflows in hours, not months.", primaryCta: { label: "Start building", href: "/signup" }, secondaryCta: { label: "View the docs", href: "/docs" } }}
        variant="cta_glow"
      />
      <PageFooter logoText="NeuralKit" bgColor="#03030a" textColor="rgba(228,226,240,0.35)" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  B2B Lead Generation  →  clean-corporate
// ─────────────────────────────────────────────────────────────────────────────

function B2BLeadGenPage() {
  const cssVars = tenantThemeToCSS(resolveTheme("clean-corporate"));

  const features = [
    { icon: "📊", title: "Real-time reporting",   description: "Live dashboards that update as data flows in — no ETL lag." },
    { icon: "🔐", title: "Enterprise security",   description: "SOC 2 Type II. GDPR-ready with granular role-based access." },
    { icon: "🔗", title: "100+ integrations",      description: "Connect your CRM, ERP, and data warehouse in minutes." },
    { icon: "🤝", title: "Dedicated success team", description: "A named CSM from day one. A partnership, not just software." },
  ] as const;

  const testimonials = [
    { quote: "The migration was painless and our team adopted it in week one.", author: "Julia Veen", company: "Director of Operations — Meridian Group", avatar: "https://i.pravatar.cc/150?img=47" },
    { quote: "Finally a platform our board can look at and immediately trust.", author: "Thomas Bakker", company: "CFO — Nexus Ventures", avatar: "https://i.pravatar.cc/150?img=12" },
  ] as const;

  return (
    <div id="mc-page-clean-corp" data-theme-preset="clean-corporate" style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `#mc-page-clean-corp { ${cssVars} }` }} />

      <PageNav
        logoText="Meridian"
        bgColor="#ffffff"
        textColor="#0f172a"
        borderColor="#e2e8f0"
        links={["Platform", "Solutions", "Pricing", "Resources"]}
        ctaLabel="Book a demo"
        ctaBg="var(--primary, #0284c7)"
        ctaRadius="0.5rem"
        ctaBorder="none"
      />

      {/* Hero — split */}
      <section style={{ background: "#ffffff", padding: "5rem 2rem", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div>
            <span style={{ display: "inline-block", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary, #0284c7)", marginBottom: "1rem", fontWeight: 600 }}>
              Trusted by 500+ companies
            </span>
            <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "#0f172a", margin: "0 0 1.25rem", fontFamily: "var(--font-heading, 'DM Sans', system-ui, sans-serif)" }}>
              The platform modern businesses run on
            </h1>
            <p style={{ fontSize: "1.0625rem", lineHeight: 1.7, color: "#475569", marginBottom: "2rem" }}>
              Unify your data, streamline operations, and give every stakeholder the clarity they need to move fast.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button style={{ background: "var(--primary, #0284c7)", color: "#fff", padding: "0.75rem 1.75rem", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer" }}>Book a demo</button>
              <button style={{ background: "transparent", color: "#0f172a", padding: "0.75rem 1.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer" }}>Start free trial →</button>
            </div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "2rem", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>
            <div style={{ textAlign: "center", color: "#94a3b8" }}><div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📊</div><p style={{ fontSize: "0.875rem", margin: 0 }}>Product screenshot</p></div>
          </div>
        </div>
      </section>

      <FeatureGridBlock data={{ heading: "Everything your business needs", features }} variant="feature_grid_spacious" />
      <TestimonialSectionBlock data={{ heading: "What our customers say", testimonials }} variant="testimonial_grid" />
      <CtaSectionBlock
        data={{ title: "Ready to improve how your team works?", description: "Join 2,000+ teams that have simplified their workflows.", primaryCta: { label: "Request a demo", href: "/demo" }, secondaryCta: { label: "See case studies", href: "/stories" } }}
        variant="cta_soft"
      />
      <PageFooter logoText="Meridian" bgColor="#f8fafc" textColor="#94a3b8" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Product-Led SaaS  →  structured-saas
// ─────────────────────────────────────────────────────────────────────────────

function ProductLedSaaSPage() {
  const cssVars = tenantThemeToCSS(resolveTheme("structured-saas"));

  const features = [
    { icon: "⚙️", title: "Workflow automation", description: "Map and automate processes across every team with visual tools." },
    { icon: "📈", title: "Revenue analytics",   description: "Unified pipeline with deal velocity and AI-powered forecasts." },
    { icon: "🔒", title: "Compliance-ready",    description: "SOC 2 Type II. Full audit trail. GDPR controls built in." },
    { icon: "🔗", title: "Deep integrations",   description: "Native connectors to Salesforce, HubSpot, Jira, Slack, and 80+ more." },
  ] as const;

  const stats = {
    heading: "Built for teams that ship",
    items: [
      { value: "3,200", label: "Companies on the platform", suffix: "+" },
      { value: "99.9",  label: "Uptime SLA",                suffix: "%" },
      { value: "14",    label: "Day free trial" },
    ],
  } as const;

  return (
    <div id="mc-page-structured" data-theme-preset="structured-saas" style={{ background: "#fafaf9", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `#mc-page-structured { ${cssVars} }` }} />

      <PageNav
        logoText="Scalepath"
        bgColor="#fafaf9"
        textColor="#1c1917"
        borderColor="#e7e5e4"
        links={["Product", "Pricing", "Docs", "Blog"]}
        ctaLabel="Start free trial"
        ctaBg="var(--primary, #d97706)"
        ctaRadius="0"
        ctaBorder="none"
      />

      {/* Hero — dark amber split */}
      <section style={{ background: "var(--hero-bg, #431407)", padding: "5rem 2rem 4.5rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "radial-gradient(ellipse 60% 50% at 30% 50%, rgba(217,119,6,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center", position: "relative", zIndex: 1 }}>
          <div>
            <span style={{ display: "inline-block", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-brand, #d97706)", marginBottom: "1.25rem", padding: "0.2rem 0.6rem", border: "1px solid rgba(217,119,6,0.4)", fontWeight: 600 }}>
              Now in GA
            </span>
            <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.25rem)", fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, color: "#fafaf9", margin: "0 0 1.25rem", fontFamily: "var(--font-heading, 'Plus Jakarta Sans', system-ui, sans-serif)" }}>
              Ship product faster. Stay organised at scale.
            </h1>
            <p style={{ fontSize: "1.0625rem", lineHeight: 1.65, color: "#fef3c7", marginBottom: "2rem" }}>
              The structured SaaS platform for revenue teams who need clarity, velocity, and no surprises at quarter end.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button style={{ background: "var(--primary, #d97706)", color: "#fff", padding: "0.75rem 1.75rem", border: "none", borderRadius: "0", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer" }}>Start free trial</button>
              <button style={{ background: "transparent", color: "#fafaf9", padding: "0.75rem 1.75rem", border: "1px solid rgba(250,250,249,0.2)", borderRadius: "0", fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer" }}>Book a demo →</button>
            </div>
          </div>
          <div style={{ background: "#fafaf9", border: "1px solid rgba(217,119,6,0.35)", borderRadius: "0.25rem", padding: "1.5rem", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📊</div><p style={{ fontSize: "0.875rem", color: "#78716c", margin: 0 }}>Product screenshot</p></div>
          </div>
        </div>
      </section>

      <StatsBlock data={stats} variant="compact" />
      <FeatureGridBlock data={{ heading: "Everything your revenue team needs", features }} variant="feature_grid_3up" />
      <CtaSectionBlock
        data={{ title: "Ready to bring structure to your growth?", description: "Join 3,200+ teams already running on the platform.", primaryCta: { label: "Start free trial", href: "/signup" }, secondaryCta: { label: "Book a demo", href: "/demo" } }}
        variant="cta_soft"
      />
      <PageFooter logoText="Scalepath" bgColor="#1c1917" textColor="rgba(250,250,249,0.4)" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Enterprise SaaS  →  corporate-trust
// ─────────────────────────────────────────────────────────────────────────────

function EnterpriseSaaSPage() {
  const cssVars = tenantThemeToCSS(resolveTheme("corporate-trust"));

  const features = [
    { icon: "🏢", title: "Enterprise grade",      description: "SAML SSO, SCIM provisioning, and dedicated infrastructure from day one." },
    { icon: "📋", title: "Audit & compliance",     description: "Immutable audit logs, GDPR, HIPAA, and SOC 2 Type II certified." },
    { icon: "👥", title: "Org-wide visibility",    description: "Unified dashboards that give C-suite and ops a shared source of truth." },
    { icon: "🔧", title: "Professional services",  description: "Dedicated implementation engineer and a named enterprise CSM for 12 months." },
  ] as const;

  const steps = {
    heading: "Onboarding in four structured steps",
    steps: [
      { title: "Discovery call",     description: "We map your existing stack and define success criteria together.", duration: "60 min" },
      { title: "Solution design",    description: "Our solutions team delivers a tailored implementation plan.", duration: "1 week" },
      { title: "Guided onboarding",  description: "Dedicated engineer handles migration, SSO, and role setup.", duration: "2 weeks" },
      { title: "Go live",            description: "Training, handoff, and a 30-day check-in from your CSM.", duration: "Day 30" },
    ],
  } as const;

  return (
    <div id="mc-page-corp-trust" data-theme-preset="corporate-trust" style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `#mc-page-corp-trust { ${cssVars} }` }} />

      <PageNav
        logoText="NexusOps"
        bgColor="#ffffff"
        textColor="#0f172a"
        borderColor="#e2e8f0"
        links={["Platform", "Enterprise", "Security", "Resources"]}
        ctaLabel="Talk to sales"
        ctaBg="#2563eb"
        ctaRadius="0.5rem"
        ctaBorder="none"
      />

      {/* Hero — deep navy */}
      <section style={{ background: "#0f2a5c", padding: "6rem 2rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 60% at 50% 0%, rgba(37,99,235,0.25) 0%, transparent 60%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#93c5fd", marginBottom: "1.5rem", fontWeight: 600 }}>
            Enterprise-ready from day one
          </span>
          <h1 style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: "#f8fafc", margin: "0 0 1.5rem", fontFamily: "var(--font-heading, 'DM Sans', system-ui, sans-serif)" }}>
            The operations platform large teams trust
          </h1>
          <p style={{ fontSize: "1.0625rem", lineHeight: 1.7, color: "#94a3b8", marginBottom: "2.5rem", maxWidth: "620px", margin: "0 auto 2.5rem" }}>
            SAML SSO, dedicated infrastructure, and a named CSM — enterprise software that earns its place in your procurement process.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{ background: "#2563eb", color: "#fff", padding: "0.875rem 2rem", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer" }}>Talk to sales</button>
            <button style={{ background: "transparent", color: "#f8fafc", padding: "0.875rem 2rem", border: "1px solid rgba(248,250,252,0.2)", borderRadius: "0.5rem", fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer" }}>Download security overview</button>
          </div>
        </div>
      </section>

      <FeatureGridBlock data={{ heading: "Enterprise features built in, not bolted on", features }} variant="feature_grid_spacious" />
      <ProcessStepsBlock data={steps} variant="horizontal" />
      <CtaSectionBlock
        data={{ title: "Ready to evaluate for your org?", description: "Security documentation, compliance reports, and a live demo on request.", primaryCta: { label: "Talk to sales", href: "/contact" }, secondaryCta: { label: "View security docs", href: "/security" } }}
        variant="cta_soft"
      />
      <PageFooter logoText="NexusOps" bgColor="#0f172a" textColor="#475569" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  Careers Platform  →  careers-human
// ─────────────────────────────────────────────────────────────────────────────

function CareersPlatformPage() {
  const cssVars = tenantThemeToCSS(resolveTheme("careers-human"));

  const features = [
    { icon: "🌱", title: "Growth pathways",     description: "Transparent career ladders and structured feedback cycles built into the platform." },
    { icon: "🤝", title: "Human-first process",  description: "Every application reviewed personally. We believe in reading between the lines." },
    { icon: "💬", title: "Honest communication", description: "Fast, clear updates at every stage — no ghosting, no black holes." },
    { icon: "🌍", title: "Remote-friendly",       description: "Async-first culture. Full-time remote positions in 20+ countries." },
  ] as const;

  const steps = {
    heading: "Our hiring process",
    steps: [
      { title: "Apply online",      description: "Submit your CV and a short cover note. We read every application personally.", duration: "5 min" },
      { title: "Screening call",    description: "30-minute conversation with our recruiter about your background and the role.", duration: "30 min" },
      { title: "Team interview",    description: "60 minutes with two team members. We focus on collaboration, not puzzles.", duration: "60 min" },
      { title: "Offer",             description: "Usually within 48 hours of the final conversation.", duration: "48 h" },
    ],
  } as const;

  return (
    <div id="mc-page-careers" data-theme-preset="careers-human" style={{ background: "#fafaf9", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `#mc-page-careers { ${cssVars} }` }} />

      <PageNav
        logoText="Talent & Co"
        bgColor="#ffffff"
        textColor="#1c1917"
        borderColor="#e7e5e4"
        links={["Open roles", "Culture", "Benefits", "Blog"]}
        ctaLabel="View open roles"
        ctaBg="var(--primary, #0f766e)"
        ctaRadius="999px"
        ctaBorder="none"
      />

      {/* Hero — teal welcoming */}
      <section style={{ background: "#0f766e", padding: "6rem 2rem 5rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 60%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "760px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h1 style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.2, color: "#ffffff", margin: "0 0 1.5rem", fontFamily: "var(--font-heading, 'DM Sans', system-ui, sans-serif)" }}>
            Build a career where your work actually matters
          </h1>
          <p style={{ fontSize: "1.0625rem", lineHeight: 1.75, color: "rgba(255,255,255,0.8)", marginBottom: "2.5rem" }}>
            We're a remote-first team building products used by millions. We hire for mindset, not pedigree.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{ background: "#ffffff", color: "#0f766e", padding: "0.875rem 2rem", border: "none", borderRadius: "999px", fontWeight: 600, fontSize: "0.9375rem", cursor: "pointer" }}>See open roles</button>
            <button style={{ background: "transparent", color: "#ffffff", padding: "0.875rem 2rem", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "999px", fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer" }}>Our culture →</button>
          </div>
        </div>
      </section>

      <FeatureGridBlock data={{ heading: "Why people choose to work here", features }} variant="feature_grid_3up" />
      <ProcessStepsBlock data={steps} variant="horizontal" />
      <CtaSectionBlock
        data={{ title: "Ready to find your next role?", description: "We have open positions across engineering, design, and growth.", primaryCta: { label: "See open roles", href: "/jobs" }, secondaryCta: { label: "Meet the team", href: "/team" } }}
        variant="cta_soft"
      />
      <PageFooter logoText="Talent & Co" bgColor="#0f766e" textColor="rgba(255,255,255,0.5)" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.  Content & Blog  →  editorial-classic
// ─────────────────────────────────────────────────────────────────────────────

function ContentBlogPage() {
  const cssVars = tenantThemeToCSS(resolveTheme("editorial-classic"));

  const recentPosts = [
    { tag: "Strategy",  title: "How we grew ARR from $1M to $10M without a sales team", date: "Apr 18, 2026", readTime: "8 min" },
    { tag: "Product",   title: "The feature we almost shipped and why we didn't", date: "Apr 11, 2026", readTime: "6 min" },
    { tag: "Culture",   title: "What 18 months of remote-first hiring taught us", date: "Apr 4, 2026", readTime: "5 min" },
  ];

  return (
    <div id="mc-page-editorial" data-theme-preset="editorial-classic" style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `#mc-page-editorial { ${cssVars} }` }} />

      <PageNav
        logoText="The Margin"
        bgColor="#ffffff"
        textColor="#1a1a1a"
        borderColor="#e8e4de"
        links={["Stories", "Topics", "Newsletter", "About"]}
        ctaLabel="Subscribe"
        ctaBg="#1a1a1a"
        ctaRadius="0"
        ctaBorder="none"
        ctaText="#ffffff"
      />

      {/* Hero — editorial */}
      <section style={{ background: "#ffffff", padding: "5rem 2rem 4rem", borderBottom: "1px solid #e8e4de" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a9a9a", marginBottom: "1.5rem" }}>
            The Margin — Independent business writing
          </p>
          <h1 style={{
            fontSize:     "clamp(2.5rem, 6vw, 4rem)",
            fontWeight:   700,
            letterSpacing:"-0.03em",
            lineHeight:   1.1,
            color:        "#1a1a1a",
            margin:       "0 0 2rem",
            fontFamily:   "var(--font-heading, 'Playfair Display', Georgia, serif)",
          }}>
            Writing for people who build, lead, and think seriously about work.
          </h1>
          <div style={{ display: "flex", gap: "3rem", borderTop: "1px solid #e8e4de", paddingTop: "1.5rem" }}>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.25rem" }}>Readers</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>48,000+</p>
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.25rem" }}>Articles</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>340+</p>
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.25rem" }}>Since</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>2020</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent articles */}
      <section style={{ background: "#ffffff", padding: "4rem 2rem" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9a9a", marginBottom: "2rem" }}>Recent articles</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {recentPosts.map((post, i) => (
              <article key={i} style={{
                padding:      "1.75rem 0",
                borderBottom: "1px solid #e8e4de",
                display:      "grid",
                gridTemplateColumns: "1fr auto",
                gap:          "2rem",
                alignItems:   "start",
              }}>
                <div>
                  <span style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9a9a", fontWeight: 600 }}>{post.tag}</span>
                  <h2 style={{ fontSize: "1.1875rem", fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.35, color: "#1a1a1a", margin: "0.5rem 0 0", fontFamily: "var(--font-heading, Georgia, serif)", cursor: "pointer" }}>
                    {post.title}
                  </h2>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: "0.8125rem", color: "#9a9a9a", margin: 0 }}>{post.date}</p>
                  <p style={{ fontSize: "0.8125rem", color: "#c8c4bc", margin: "0.25rem 0 0" }}>{post.readTime} read</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <CtaSectionBlock
        data={{ title: "Stay in the loop", description: "Get the latest essays and product updates straight to your inbox. No spam, ever." }}
        variant="cta_newsletter"
      />
      <PageFooter logoText="The Margin" bgColor="#1c1917" textColor="rgba(248,246,243,0.4)" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.  DTC Store  →  bold-marketing
// ─────────────────────────────────────────────────────────────────────────────

function DtcStorePage() {
  const cssVars = tenantThemeToCSS(resolveTheme("bold-marketing"));

  const features = [
    { icon: "🎨", title: "Handcrafted design",   description: "Every piece made to order by our in-house design team. Nothing mass produced." },
    { icon: "♻️", title: "Sustainable materials", description: "Certified organic cotton and recycled packaging on every order." },
    { icon: "🚀", title: "Fast delivery",          description: "Ships within 48 hours. Free returns on all UK and EU orders." },
    { icon: "💬", title: "Real support",            description: "A human answers within 4 hours — no bots, no ticket queues." },
  ] as const;

  const testimonials = [
    { quote: "The quality is genuinely unlike anything else at this price point. I've bought three.", author: "Chloe Martin", company: "Customer since 2024", avatar: "https://i.pravatar.cc/150?img=9" },
    { quote: "Shipped in two days and the packaging was beautiful. Will be back.", author: "Diego López", company: "Customer since 2025", avatar: "https://i.pravatar.cc/150?img=61" },
    { quote: "Returns were painless and customer service was warm and fast.", author: "Priya Mehta", company: "Customer since 2024", avatar: "https://i.pravatar.cc/150?img=38" },
  ] as const;

  return (
    <div id="mc-page-bold-mkt" data-theme-preset="bold-marketing" style={{ background: "#ffffff", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: `#mc-page-bold-mkt { ${cssVars} }` }} />

      <PageNav
        logoText="Studio Kind"
        bgColor="#ffffff"
        textColor="#111827"
        borderColor="#f3f4f6"
        links={["Shop", "Collections", "About", "Sustainability"]}
        ctaLabel="Shop now"
        ctaBg="var(--primary, #db2777)"
        ctaRadius="999px"
        ctaBorder="none"
      />

      {/* Hero — bold full-bleed */}
      <section style={{
        background:  "#1e1b4b",
        padding:     "6rem 2rem",
        position:    "relative",
        overflow:    "hidden",
        textAlign:   "center",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(219,39,119,0.3) 0%, transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "760px", margin: "0 auto" }}>
          <span style={{ display: "inline-block", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#f9a8d4", marginBottom: "1.5rem", fontWeight: 600 }}>
            New spring collection — now live
          </span>
          <h1 style={{
            fontSize:     "clamp(3rem, 7vw, 5.5rem)",
            fontWeight:   800,
            letterSpacing:"-0.04em",
            lineHeight:   0.95,
            color:        "#ffffff",
            margin:       "0 0 1.5rem",
            fontFamily:   "var(--font-heading, 'Poppins', system-ui, sans-serif)",
            textTransform:"uppercase",
          }}>
            Made with<br />intention.
          </h1>
          <p style={{ fontSize: "1.125rem", lineHeight: 1.65, color: "rgba(255,255,255,0.75)", marginBottom: "2.5rem" }}>
            Sustainably made clothing designed to last a decade, not a season.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{ background: "#db2777", color: "#fff", padding: "1rem 2.25rem", border: "none", borderRadius: "999px", fontWeight: 700, fontSize: "1rem", cursor: "pointer", letterSpacing: "-0.01em" }}>
              Shop the collection
            </button>
            <button style={{ background: "transparent", color: "#ffffff", padding: "1rem 2.25rem", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "999px", fontWeight: 500, fontSize: "1rem", cursor: "pointer" }}>
              Our story →
            </button>
          </div>
        </div>
      </section>

      <FeatureGridBlock data={{ heading: "Why customers keep coming back", features }} variant="feature_grid_3up" />
      <TestimonialSectionBlock data={{ heading: "What our customers say", testimonials }} variant="testimonial_grid" />
      <CtaSectionBlock
        data={{ title: "🎉 Free shipping this week — no minimum", primaryCta: { label: "Shop now", href: "/shop" } }}
        variant="cta_banner_compact"
      />
      <PageFooter logoText="Studio Kind" bgColor="#111827" textColor="rgba(255,255,255,0.4)" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Story metadata
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title:  "Pages",
  tags:   ["autodocs"],
  parameters: {
    layout:      "fullscreen",
    backgrounds: { default: "Light" },
    docs: {
      description: {
        component:
          "Full-page homepage compositions for all 7 site starters. " +
          "Each story applies the correct theme via scoped CSS custom property injection, " +
          "identical to the production runtime mechanism. " +
          "Use these stories to audit dark-theme integrity (no white flash sections), " +
          "verify typography and spacing differ meaningfully per theme, " +
          "and confirm CTA accent colours match each brand character.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// ── Stories ───────────────────────────────────────────────────────────────────

export const AiProductLanding: Story = {
  name:   "AI Product Landing (dark-ai)",
  render: () => <AiProductLandingPage />,
};

export const B2BLeadGeneration: Story = {
  name:   "B2B Lead Generation (clean-corporate)",
  render: () => <B2BLeadGenPage />,
};

export const ProductLedSaaS: Story = {
  name:   "Product-Led SaaS (structured-saas)",
  render: () => <ProductLedSaaSPage />,
};

export const EnterpriseSaaS: Story = {
  name:   "Enterprise SaaS (corporate-trust)",
  render: () => <EnterpriseSaaSPage />,
};

export const CareersPlatform: Story = {
  name:   "Careers Platform (careers-human)",
  render: () => <CareersPlatformPage />,
};

export const ContentBlog: Story = {
  name:   "Content & Blog (editorial-classic)",
  render: () => <ContentBlogPage />,
};

export const DtcStore: Story = {
  name:   "DTC Store (bold-marketing)",
  render: () => <DtcStorePage />,
};
