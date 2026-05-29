/**
 * Dark AI Theme Stories
 *
 * Full-page compositions, typography scale, block variant comparisons, and
 * personalization scenarios for the Dark AI premium theme family.
 *
 * ─── Story structure ─────────────────────────────────────────────────────────
 *
 *   Dark AI / Homepage         — full homepage blueprint composition
 *   Dark AI / Features         — feature grid + testimonial stack
 *   Dark AI / Typography       — display → h1 → h2 → h3 → body → small scale
 *   Dark AI / Block Variants   — side-by-side variant comparison panel
 *   Dark AI / Personalization  — same page under different visitor contexts
 *
 * ─── How themes are applied ──────────────────────────────────────────────────
 *
 *   Each story creates a scoped <style> block from `tenantThemeToCSS(resolveTheme("dark-ai"))`
 *   and injects it into the story's root element, exactly replicating the
 *   production runtime injection in the root layout.  No global theme mutation.
 *
 * ─── Developer usage ─────────────────────────────────────────────────────────
 *
 *   1. Use the "Dark AI" stories to verify token application on dark surfaces.
 *   2. Use "Block Variants" to compare hero_minimal_dark vs hero_default.
 *   3. Use "Personalization" to see how rules change the CTA variant.
 *   4. Use the Storybook toolbar Preset dropdown to swap to dark-contrast or
 *      bold-dark to verify family structural consistency.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FeatureGridBlock }        from "@/components/blocks/sections/FeatureGridBlock";
import { TestimonialSectionBlock } from "@/components/blocks/sections/TestimonialSectionBlock";

import { resolveTheme }      from "@/design-system/theme/presets";
import { tenantThemeToCSS }  from "@/design-system/theme/tenant-theme";

// ── Theme injection helper ────────────────────────────────────────────────────

function DarkAIScope({ children }: { children: React.ReactNode }) {
  const theme  = resolveTheme("dark-ai");
  const cssVars = tenantThemeToCSS(theme);

  return (
    <div
      id="mc-dark-ai-scope"
      data-theme-preset="dark-ai"
      style={{ background: "var(--bg, #06060c)", minHeight: "100vh" }}
    >
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `#mc-dark-ai-scope { ${cssVars} }`,
        }}
      />
      {children}
    </div>
  );
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const features = [
  {
    icon:        "⚡",
    title:       "Sub-100ms inference",
    description: "Edge-deployed models respond in milliseconds globally — no cold starts, no wait.",
  },
  {
    icon:        "🔒",
    title:       "Zero-trust security",
    description: "SOC 2 Type II certified. Data never leaves your VPC unless you choose it.",
  },
  {
    icon:        "🔌",
    title:       "Open API surface",
    description: "RESTful and gRPC endpoints. SDKs in Python, TypeScript, Go, and Rust.",
  },
  {
    icon:        "🧠",
    title:       "Adaptive context",
    description: "Persistent memory and multi-turn state — context that actually remembers.",
  },
] as const;

const testimonials = [
  {
    quote:   "We cut inference latency by 80% and our team hasn't looked back.",
    author:  "Sven Nakamura",
    company: "CTO — Axiom Intelligence",
    avatar:  "https://i.pravatar.cc/150?img=15",
  },
  {
    quote:   "The API is the cleanest we've worked with. Zero magic, full control.",
    author:  "Lena Hoffmann",
    company: "Lead Eng — Strata Labs",
    avatar:  "https://i.pravatar.cc/150?img=23",
  },
  {
    quote:   "From PoC to production in 4 weeks. The DX is that good.",
    author:  "Marcus Chen",
    company: "Founder — Pulse AI",
    avatar:  "https://i.pravatar.cc/150?img=55",
  },
] as const;

// ── Typography showcase ───────────────────────────────────────────────────────

function TypographyScale() {
  return (
    <DarkAIScope>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "6rem 2rem", fontFamily: "var(--font-heading, 'Manrope', system-ui, sans-serif)" }}>
        <p style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted, #8884a8)", marginBottom: "3rem" }}>
          Dark AI — Typography Scale
        </p>

        {/* Display */}
        <div style={{ marginBottom: "3rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #1e1c30)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #5c5878)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Display</p>
          <h1 style={{
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            color: "var(--text-inverse, #f0eeff)",
            margin: 0,
          }}>
            The intelligence layer for modern products
          </h1>
        </div>

        {/* H1 */}
        <div style={{ marginBottom: "2.5rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #1e1c30)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #5c5878)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H1</p>
          <h1 style={{
            fontSize: "clamp(1.875rem, 4vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: "var(--text-inverse, #f0eeff)",
            margin: 0,
          }}>
            Build AI-native experiences at scale
          </h1>
        </div>

        {/* H2 */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #1e1c30)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #5c5878)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H2</p>
          <h2 style={{
            fontSize: "clamp(1.5rem, 3vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.25,
            color: "var(--text-inverse, #f0eeff)",
            margin: 0,
          }}>
            Designed for engineering teams who move fast
          </h2>
        </div>

        {/* H3 */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #1e1c30)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #5c5878)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H3</p>
          <h3 style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            letterSpacing: "-0.015em",
            lineHeight: 1.35,
            color: "var(--text-inverse, #f0eeff)",
            margin: 0,
          }}>
            Sub-100ms inference on a global edge network
          </h3>
        </div>

        {/* Body */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #1e1c30)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #5c5878)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Body</p>
          <p style={{
            fontSize: "1rem",
            fontWeight: 400,
            lineHeight: 1.75,
            color: "var(--text-muted, #8884a8)",
            margin: 0,
            fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
          }}>
            Our platform handles everything from raw model inference to structured output
            parsing, function calling, and multi-turn memory — so your team can focus on
            building, not on infrastructure plumbing.
          </p>
        </div>

        {/* Small */}
        <div>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #5c5878)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Small / Caption</p>
          <p style={{
            fontSize: "0.875rem",
            fontWeight: 400,
            lineHeight: 1.6,
            color: "var(--text-subtle, #5c5878)",
            margin: 0,
            fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
          }}>
            Latency measured at p50. Enterprise plans include SLA guarantees.
            See documentation for regional availability.
          </p>
        </div>
      </div>
    </DarkAIScope>
  );
}

// ── Hero showcase (minimal dark) ──────────────────────────────────────────────

function HeroMinimalDark() {
  return (
    <DarkAIScope>
      <section style={{
        background:   "var(--hero-bg, #03030a)",
        padding:      "8rem 2rem 7rem",
        textAlign:    "center",
        position:     "relative",
        overflow:     "hidden",
      }}>
        {/* Glow */}
        <div style={{
          position:     "absolute",
          top:          "30%",
          left:         "50%",
          transform:    "translate(-50%, -50%)",
          width:        "600px",
          height:       "400px",
          background:   "radial-gradient(ellipse at center, rgba(123,110,255,0.18) 0%, transparent 70%)",
          pointerEvents:"none",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: "760px", margin: "0 auto" }}>
          <span style={{
            display:      "inline-block",
            fontSize:     "0.75rem",
            letterSpacing:"0.12em",
            textTransform:"uppercase",
            color:        "var(--text-brand, #a89eff)",
            marginBottom: "1.5rem",
            padding:      "0.25rem 0.75rem",
            border:       "1px solid rgba(123,110,255,0.3)",
            borderRadius: "2px",
          }}>
            Now in public beta
          </span>

          <h1 style={{
            fontSize:     "clamp(2.75rem, 6vw, 5rem)",
            fontWeight:   700,
            letterSpacing:"-0.04em",
            lineHeight:   1.05,
            color:        "#f0eeff",
            margin:       "0 0 1.5rem",
            fontFamily:   "var(--font-heading, 'Manrope', system-ui, sans-serif)",
          }}>
            The intelligence layer your product has been missing
          </h1>

          <p style={{
            fontSize:   "1.125rem",
            lineHeight: 1.7,
            color:      "#8884a8",
            marginBottom:"2.5rem",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
          }}>
            Inference, memory, and structured output — one API, any model, global edge.
          </p>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{
              background:   "var(--primary, #7b6eff)",
              color:        "#fff",
              padding:      "0.875rem 2rem",
              border:       "none",
              borderRadius: "2px",
              fontWeight:   600,
              fontSize:     "0.9375rem",
              cursor:       "pointer",
              letterSpacing:"-0.01em",
            }}>
              Start building free
            </button>
            <button style={{
              background:   "transparent",
              color:        "#e4e2f0",
              padding:      "0.875rem 2rem",
              border:       "1px solid #2d2b45",
              borderRadius: "2px",
              fontWeight:   500,
              fontSize:     "0.9375rem",
              cursor:       "pointer",
            }}>
              Read docs →
            </button>
          </div>
        </div>
      </section>
    </DarkAIScope>
  );
}

// ── Block variant comparison ──────────────────────────────────────────────────

function BlockVariantComparison() {
  return (
    <DarkAIScope>
      <div style={{ padding: "3rem 2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#5c5878", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Dark AI — Block Variants
        </p>
        <h2 style={{ color: "#e4e2f0", fontSize: "1.5rem", fontWeight: 700, marginBottom: "3rem" }}>
          Feature Grid: dark vs default
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Dark variant */}
          <div>
            <p style={{ color: "#8884a8", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              feature_grid_dark (recommended for Dark AI)
            </p>
            <div style={{ border: "1px solid #2d2b45", borderRadius: "4px", overflow: "hidden" }}>
              <FeatureGridBlock
                data={{ heading: "Built for engineers", features }}
                variant="feature_grid_dark"
              />
            </div>
          </div>

          {/* Standard 3up */}
          <div>
            <p style={{ color: "#8884a8", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              feature_grid_3up (standard — falls back correctly)
            </p>
            <div style={{ border: "1px solid #2d2b45", borderRadius: "4px", overflow: "hidden" }}>
              <FeatureGridBlock
                data={{ heading: "Built for engineers", features }}
                variant="feature_grid_3up"
              />
            </div>
          </div>
        </div>
      </div>
    </DarkAIScope>
  );
}

// ── Full homepage composition ─────────────────────────────────────────────────

function HomepageComposition() {
  return (
    <DarkAIScope>
      <HeroMinimalDark />
      <FeatureGridBlock
        data={{ heading: "Everything you need to ship AI features", features }}
        variant="feature_grid_dark"
      />
      <TestimonialSectionBlock
        data={{ heading: "Trusted by engineering teams", testimonials }}
        variant="testimonial_highlight"
      />
    </DarkAIScope>
  );
}

// ── Story metadata ─────────────────────────────────────────────────────────────

const meta: Meta = {
  title:  "Dark AI",
  tags:   ["autodocs"],
  parameters: {
    layout:      "fullscreen",
    backgrounds: { default: "Dark" },
    docs: {
      description: {
        component:
          "Stories for the Dark AI premium theme family. Covers the full homepage blueprint, " +
          "typography scale, block variant comparisons, and personalization scenarios. " +
          "Theme is scoped per-story using CSS custom property injection — identical to " +
          "the production runtime injection in the root layout.",
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
  name:   "Hero — minimal dark",
  render: () => <HeroMinimalDark />,
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
    <DarkAIScope>
      <FeatureGridBlock
        data={{ heading: "Everything you need to ship AI features", features }}
        variant="feature_grid_dark"
      />
      <TestimonialSectionBlock
        data={{ heading: "Engineering teams trust us", testimonials }}
        variant="testimonial_grid"
      />
    </DarkAIScope>
  ),
};
