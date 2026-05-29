/**
 * Structured SaaS Theme Stories
 *
 * Full-page compositions, typography scale, block variant comparisons, and
 * hero variants for the Structured SaaS premium theme family.
 *
 * ─── Story structure ─────────────────────────────────────────────────────────
 *
 *   Structured SaaS / Homepage         — full homepage blueprint composition
 *   Structured SaaS / Features         — feature grid + testimonial stack
 *   Structured SaaS / Typography       — display → h1 → h2 → h3 → body → small
 *   Structured SaaS / Block Variants   — side-by-side variant comparison panel
 *   Structured SaaS / Hero Variants    — hero_split (dark amber hero) + cta_soft
 *
 * ─── Theme characteristics ───────────────────────────────────────────────────
 *
 *   - Plus Jakarta Sans headings (700), Inter body
 *   - Amber-600 (#d97706) primary accent on warm stone-50 (#fafaf9) background
 *   - Sharp buttons (0px radius), bordered cards (0.25rem, no shadow)
 *   - Compact editorial density — structured editorial precision
 *   - Hero bg: warm deep amber-black (#431407 / amber-950)
 *
 * ─── How themes are applied ──────────────────────────────────────────────────
 *
 *   Each story creates a scoped <style> block from
 *   `tenantThemeToCSS(resolveTheme("structured-saas"))` injected into the
 *   story's root element — identical to the production runtime injection.
 *
 * ─── Developer usage ─────────────────────────────────────────────────────────
 *
 *   1. Use "Homepage" to review the full structured-saas blueprint.
 *   2. Use "Block Variants" to compare feature_grid_3up vs feature_grid_spacious.
 *   3. Use "Hero Variants" to see the dark amber split hero alongside cta_soft.
 *   4. Switch Storybook toolbar Preset to verify structural consistency with
 *      the wider structured-saas family (corporate-trust, modern-saas).
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FeatureGridBlock }        from "@/components/blocks/sections/FeatureGridBlock";
import { TestimonialSectionBlock } from "@/components/blocks/sections/TestimonialSectionBlock";
import { StatsBlock }              from "@/components/blocks/sections/StatsBlock";
import { CtaSectionBlock }         from "@/components/blocks/sections/CtaSectionBlock";

import { resolveTheme }     from "@/design-system/theme/presets";
import { tenantThemeToCSS } from "@/design-system/theme/tenant-theme";

// ── Theme injection helper ────────────────────────────────────────────────────

function StructuredSaaSScope({ children }: { children: React.ReactNode }) {
  const theme   = resolveTheme("structured-saas");
  const cssVars = tenantThemeToCSS(theme);

  return (
    <div
      id="mc-structured-saas-scope"
      data-theme-preset="structured-saas"
      style={{ background: "var(--bg, #fafaf9)", minHeight: "100vh" }}
    >
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `#mc-structured-saas-scope { ${cssVars} }`,
        }}
      />
      {children}
    </div>
  );
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const features = [
  {
    icon:        "⚙️",
    title:       "Workflow automation",
    description: "Map your business processes visually and automate repetitive steps across every team.",
  },
  {
    icon:        "📈",
    title:       "Revenue analytics",
    description: "Unified pipeline view with deal velocity tracking and AI-powered revenue forecasting.",
  },
  {
    icon:        "🔒",
    title:       "Compliance-ready",
    description: "SOC 2 Type II. Full audit trail. GDPR controls built in — not bolted on.",
  },
  {
    icon:        "🔗",
    title:       "Deep integrations",
    description: "Native connectors to Salesforce, HubSpot, Jira, Slack, and 80+ more tools your team already uses.",
  },
] as const;

const testimonials = [
  {
    quote:   "The structured layout gave our sales team clarity they never had before. Adoption was instant.",
    author:  "Nina Brouwer",
    company: "VP Sales — Axiom Systems",
    avatar:  "https://i.pravatar.cc/150?img=32",
  },
  {
    quote:   "Finally a SaaS tool that respects our existing processes instead of replacing them.",
    author:  "Peter Hofmann",
    company: "Head of RevOps — Scalepath B.V.",
    avatar:  "https://i.pravatar.cc/150?img=7",
  },
  {
    quote:   "Went live in two weeks. The onboarding is that straightforward.",
    author:  "Amara Osei",
    company: "CTO — Meridian SaaS",
    avatar:  "https://i.pravatar.cc/150?img=44",
  },
] as const;

const stats = {
  heading: "Built for teams that ship",
  items: [
    { value: "3,200",  label: "Companies on the platform",  suffix: "+" },
    { value: "99.9",   label: "Uptime SLA",                 suffix: "%" },
    { value: "14",     label: "Day free trial" },
    { value: "4×",     label: "Average productivity gain",  prefix: "" },
  ],
} as const;

// ── Typography showcase ───────────────────────────────────────────────────────

function TypographyScale() {
  return (
    <StructuredSaaSScope>
      <div style={{
        maxWidth:   "800px",
        margin:     "0 auto",
        padding:    "6rem 2rem",
        fontFamily: "var(--font-heading, 'Plus Jakarta Sans', system-ui, sans-serif)",
      }}>
        <p style={{
          fontSize:      "0.75rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color:         "var(--text-muted, #78716c)",
          marginBottom:  "3rem",
        }}>
          Structured SaaS — Typography Scale
        </p>

        {/* Display */}
        <div style={{ marginBottom: "3rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e7e5e4)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #a8a29e)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Display</p>
          <h1 style={{
            fontSize:     "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight:   700,
            letterSpacing:"-0.025em",
            lineHeight:   1.1,
            color:        "var(--text, #1c1917)",
            margin:       0,
          }}>
            Ship product faster. Stay organised at scale.
          </h1>
        </div>

        {/* H1 */}
        <div style={{ marginBottom: "2.5rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e7e5e4)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #a8a29e)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H1</p>
          <h1 style={{
            fontSize:     "clamp(1.875rem, 4vw, 2.75rem)",
            fontWeight:   700,
            letterSpacing:"-0.025em",
            lineHeight:   1.2,
            color:        "var(--text, #1c1917)",
            margin:       0,
          }}>
            The platform that scales with your revenue
          </h1>
        </div>

        {/* H2 */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e7e5e4)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #a8a29e)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H2</p>
          <h2 style={{
            fontSize:     "clamp(1.5rem, 3vw, 2rem)",
            fontWeight:   700,
            letterSpacing:"-0.02em",
            lineHeight:   1.3,
            color:        "var(--text, #1c1917)",
            margin:       0,
          }}>
            Everything your revenue team needs in one place
          </h2>
        </div>

        {/* H3 */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e7e5e4)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #a8a29e)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H3</p>
          <h3 style={{
            fontSize:     "1.25rem",
            fontWeight:   700,
            letterSpacing:"-0.015em",
            lineHeight:   1.4,
            color:        "var(--text, #1c1917)",
            margin:       0,
          }}>
            Workflow automation that works like you do
          </h3>
        </div>

        {/* Body */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e7e5e4)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #a8a29e)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Body</p>
          <p style={{
            fontSize:   "1rem",
            fontWeight: 400,
            lineHeight: 1.75,
            color:      "var(--text-muted, #78716c)",
            margin:     0,
            fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
          }}>
            From pipeline tracking to deal forecasting, every feature is built for the
            way B2B SaaS teams actually work — structured, systematic, and focused on
            the metrics that move the number.
          </p>
        </div>

        {/* Small */}
        <div>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #a8a29e)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Small / Caption</p>
          <p style={{
            fontSize:   "0.875rem",
            fontWeight: 400,
            lineHeight: 1.6,
            color:      "var(--text-subtle, #a8a29e)",
            margin:     0,
            fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
          }}>
            14-day free trial. No credit card required. SOC 2 certified.
          </p>
        </div>
      </div>
    </StructuredSaaSScope>
  );
}

// ── Hero — dark amber split ───────────────────────────────────────────────────
//
// Mirrors the hero_split variant for structured-saas:
//  - Left: headline + description + amber CTAs on warm amber-950 dark bg
//  - Right: framed product screenshot placeholder with amber border accent

function HeroDarkSplit() {
  return (
    <StructuredSaaSScope>
      <section style={{
        background: "var(--hero-bg, #431407)",
        padding:    "5rem 2rem 4.5rem",
        position:   "relative",
        overflow:   "hidden",
      }}>
        {/* Subtle amber glow */}
        <div style={{
          position:     "absolute",
          top:          "0",
          left:         "0",
          right:        "0",
          bottom:       "0",
          background:   "radial-gradient(ellipse 60% 50% at 30% 50%, rgba(217,119,6,0.12) 0%, transparent 70%)",
          pointerEvents:"none",
        }} />

        <div style={{
          maxWidth:            "1200px",
          margin:              "0 auto",
          display:             "grid",
          gridTemplateColumns: "1fr 1fr",
          gap:                 "4rem",
          alignItems:          "center",
          position:            "relative",
          zIndex:              1,
        }}>
          {/* Left: copy */}
          <div>
            <span style={{
              display:       "inline-block",
              fontSize:      "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:         "var(--text-brand, #d97706)",
              marginBottom:  "1.25rem",
              padding:       "0.2rem 0.6rem",
              border:        "1px solid rgba(217,119,6,0.4)",
              borderRadius:  "0",
              fontWeight:    600,
            }}>
              Now in general availability
            </span>

            <h1 style={{
              fontSize:     "clamp(2rem, 4vw, 3.25rem)",
              fontWeight:   700,
              letterSpacing:"-0.025em",
              lineHeight:   1.15,
              color:        "var(--text-inverse, #fafaf9)",
              margin:       "0 0 1.25rem",
              fontFamily:   "var(--font-heading, 'Plus Jakarta Sans', system-ui, sans-serif)",
            }}>
              Ship product faster. Stay organised at scale.
            </h1>

            <p style={{
              fontSize:    "1.0625rem",
              lineHeight:  1.65,
              color:       "var(--hero-subtitle-color, #fef3c7)",
              marginBottom:"2rem",
              fontFamily:  "var(--font-sans, 'Inter', system-ui, sans-serif)",
            }}>
              The structured SaaS platform for revenue teams who need clarity,
              velocity, and no surprises at the end of the quarter.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button style={{
                background:   "var(--primary, #d97706)",
                color:        "#fff",
                padding:      "0.75rem 1.75rem",
                border:       "none",
                borderRadius: "0",
                fontWeight:   600,
                fontSize:     "0.9375rem",
                cursor:       "pointer",
                letterSpacing:"-0.01em",
              }}>
                Start free trial
              </button>
              <button style={{
                background:   "transparent",
                color:        "var(--text-inverse, #fafaf9)",
                padding:      "0.75rem 1.75rem",
                border:       "1px solid rgba(250,250,249,0.2)",
                borderRadius: "0",
                fontWeight:   500,
                fontSize:     "0.9375rem",
                cursor:       "pointer",
              }}>
                Book a demo →
              </button>
            </div>
          </div>

          {/* Right: product frame */}
          <div style={{
            background:   "var(--bg, #fafaf9)",
            border:       "1px solid rgba(217,119,6,0.35)",
            borderRadius: "0.25rem",
            padding:      "1.5rem",
            aspectRatio:  "4/3",
            display:      "flex",
            alignItems:   "center",
            justifyContent:"center",
            boxShadow:    "0 8px 40px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(217,119,6,0.1)",
          }}>
            <div style={{ textAlign: "center", fontFamily: "system-ui" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📊</div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted, #78716c)", margin: 0 }}>
                Product screenshot
              </p>
            </div>
          </div>
        </div>
      </section>
    </StructuredSaaSScope>
  );
}

// ── Block variant comparison ──────────────────────────────────────────────────

function BlockVariantComparison() {
  return (
    <StructuredSaaSScope>
      <div style={{ padding: "3rem 2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "var(--text-muted, #78716c)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Structured SaaS — Block Variants
        </p>
        <h2 style={{ color: "var(--text, #1c1917)", fontSize: "1.5rem", fontWeight: 700, marginBottom: "3rem" }}>
          Feature Grid: 3-up vs spacious
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* 3-up: recommended for structured-saas */}
          <div>
            <p style={{ color: "var(--text-muted, #78716c)", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              feature_grid_3up (recommended for Structured SaaS — bordered cards, no shadow)
            </p>
            <div style={{ border: "1px solid var(--border, #e7e5e4)", borderRadius: "0.25rem", overflow: "hidden" }}>
              <FeatureGridBlock
                data={{ heading: "Built for structured teams", features }}
                variant="feature_grid_3up"
              />
            </div>
          </div>

          {/* Spacious: clean corporate comparison */}
          <div>
            <p style={{ color: "var(--text-muted, #78716c)", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              feature_grid_spacious (compare — more padding, elevated cards)
            </p>
            <div style={{ border: "1px solid var(--border, #e7e5e4)", borderRadius: "0.25rem", overflow: "hidden" }}>
              <FeatureGridBlock
                data={{ heading: "Built for structured teams", features }}
                variant="feature_grid_spacious"
              />
            </div>
          </div>
        </div>

        {/* Stats comparison */}
        <h2 style={{ color: "var(--text, #1c1917)", fontSize: "1.5rem", fontWeight: 700, margin: "3rem 0 1.5rem" }}>
          Stats: compact vs default
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <p style={{ color: "var(--text-muted, #78716c)", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              compact (recommended for Structured SaaS — tight inline row)
            </p>
            <div style={{ border: "1px solid var(--border, #e7e5e4)", borderRadius: "0.25rem", overflow: "hidden" }}>
              <StatsBlock data={stats} variant="compact" />
            </div>
          </div>
          <div>
            <p style={{ color: "var(--text-muted, #78716c)", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              default (large bordered cards)
            </p>
            <div style={{ border: "1px solid var(--border, #e7e5e4)", borderRadius: "0.25rem", overflow: "hidden" }}>
              <StatsBlock data={stats} variant="default" />
            </div>
          </div>
        </div>
      </div>
    </StructuredSaaSScope>
  );
}

// ── Full homepage composition ─────────────────────────────────────────────────

function HomepageComposition() {
  return (
    <StructuredSaaSScope>
      <HeroDarkSplit />
      <StatsBlock data={stats} variant="compact" />
      <FeatureGridBlock
        data={{ heading: "Everything your revenue team needs", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "Trusted by scaling SaaS teams", testimonials }}
        variant="testimonial_grid"
      />
      <CtaSectionBlock
        data={{
          title:       "Ready to bring structure to your growth?",
          description: "Join 3,200+ teams already running on the platform. Start free, no card required.",
          primaryCta:   { label: "Start free trial", href: "/signup"  },
          secondaryCta: { label: "Book a demo",       href: "/demo"    },
        }}
        variant="cta_soft"
      />
    </StructuredSaaSScope>
  );
}

// ── Story metadata ─────────────────────────────────────────────────────────────

const meta: Meta = {
  title:  "Structured SaaS",
  tags:   ["autodocs"],
  parameters: {
    layout:      "fullscreen",
    backgrounds: { default: "Light" },
    docs: {
      description: {
        component:
          "Stories for the Structured SaaS premium theme family. Warm stone background, " +
          "amber-600 accent, Plus Jakarta Sans headings (700), bordered cards (0.25rem, no shadow), " +
          "sharp buttons — editorial confidence aimed at product-led SaaS and B2B revenue teams. " +
          "Covers the full homepage blueprint, typography scale, block variant comparisons, and hero variants.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Homepage: Story = {
  name:   "Homepage",
  render: () => <HomepageComposition />,
};

export const HeroVariant: Story = {
  name:   "Hero — dark amber split",
  render: () => <HeroDarkSplit />,
};

export const Typography: Story = {
  name:   "Typography scale",
  render: () => <TypographyScale />,
};

export const BlockVariants: Story = {
  name:   "Block variants",
  render: () => <BlockVariantComparison />,
};

export const Features: Story = {
  name:   "Features",
  render: () => (
    <StructuredSaaSScope>
      <FeatureGridBlock
        data={{ heading: "Everything your revenue team needs", features }}
        variant="feature_grid_3up"
      />
      <TestimonialSectionBlock
        data={{ heading: "What scaling teams say", testimonials }}
        variant="testimonial_grid"
      />
    </StructuredSaaSScope>
  ),
};
