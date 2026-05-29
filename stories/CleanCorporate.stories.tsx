/**
 * Clean Corporate Theme Stories
 *
 * Full-page compositions, typography scale, block variant comparisons, and
 * personalization scenarios for the Clean Corporate premium theme family.
 *
 * ─── Story structure ─────────────────────────────────────────────────────────
 *
 *   Clean Corporate / Homepage         — full homepage blueprint composition
 *   Clean Corporate / Features         — feature grid + testimonial stack
 *   Clean Corporate / Typography       — display → h1 → h2 → h3 → body → small
 *   Clean Corporate / Block Variants   — side-by-side variant comparison panel
 *   Clean Corporate / Hero Variants    — hero_split_clean vs hero_default
 *
 * ─── How themes are applied ──────────────────────────────────────────────────
 *
 *   Each story creates a scoped <style> block from `tenantThemeToCSS(resolveTheme("clean-corporate"))`
 *   and injects it into the story's root element, replicating production runtime injection.
 *
 * ─── Developer usage ─────────────────────────────────────────────────────────
 *
 *   1. Use "Homepage" to review the full clean-corporate blueprint.
 *   2. Use "Block Variants" to compare feature_grid_spacious vs feature_grid_3up.
 *   3. Use "Hero Variants" to see hero_split_clean alongside hero_default.
 *   4. Switch Storybook toolbar Preset to corporate-trust / modern-saas to verify
 *      that family structural character is consistent across the clean-corporate family.
 */

import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FeatureGridBlock }        from "@/components/blocks/sections/FeatureGridBlock";
import { TestimonialSectionBlock } from "@/components/blocks/sections/TestimonialSectionBlock";

import { resolveTheme }     from "@/design-system/theme/presets";
import { tenantThemeToCSS } from "@/design-system/theme/tenant-theme";

// ── Theme injection helper ────────────────────────────────────────────────────

function CleanCorporateScope({ children }: { children: React.ReactNode }) {
  const theme   = resolveTheme("clean-corporate");
  const cssVars = tenantThemeToCSS(theme);

  return (
    <div
      id="mc-clean-corp-scope"
      data-theme-preset="clean-corporate"
      style={{ background: "var(--bg, #ffffff)", minHeight: "100vh" }}
    >
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `#mc-clean-corp-scope { ${cssVars} }`,
        }}
      />
      {children}
    </div>
  );
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const features = [
  {
    icon:        "📊",
    title:       "Real-time reporting",
    description: "Live dashboards that update as data flows in — no ETL lag, no waiting for batches.",
  },
  {
    icon:        "🔐",
    title:       "Enterprise security",
    description: "SOC 2 Type II. GDPR-ready data processing with granular role-based access control.",
  },
  {
    icon:        "🔗",
    title:       "100+ integrations",
    description: "Connect your CRM, ERP, marketing stack, and data warehouse in minutes, not weeks.",
  },
  {
    icon:        "🤝",
    title:       "Dedicated success team",
    description: "A named account manager and CSM from day one. Not just software — a partnership.",
  },
] as const;

const testimonials = [
  {
    quote:   "The migration was painless and our team adopted it in week one. Remarkable.",
    author:  "Julia Veen",
    company: "Director of Operations — Meridian Group",
    avatar:  "https://i.pravatar.cc/150?img=47",
  },
  {
    quote:   "Finally a platform our board can look at and immediately trust.",
    author:  "Thomas Bakker",
    company: "CFO — Nexus Ventures",
    avatar:  "https://i.pravatar.cc/150?img=12",
  },
  {
    quote:   "We replaced three separate tools. ROI positive by month two.",
    author:  "Sarah Okonkwo",
    company: "Head of Growth — Streamline B.V.",
    avatar:  "https://i.pravatar.cc/150?img=29",
  },
] as const;

// ── Typography showcase ───────────────────────────────────────────────────────

function TypographyScale() {
  return (
    <CleanCorporateScope>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "6rem 2rem", fontFamily: "var(--font-heading, 'DM Sans', system-ui, sans-serif)" }}>
        <p style={{ fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted, #475569)", marginBottom: "3rem" }}>
          Clean Corporate — Typography Scale
        </p>

        {/* Display */}
        <div style={{ marginBottom: "3rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #94a3b8)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Display</p>
          <h1 style={{
            fontSize:     "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight:   600,
            letterSpacing:"-0.025em",
            lineHeight:   1.1,
            color:        "var(--text, #0f172a)",
            margin:       0,
          }}>
            The platform modern businesses run on
          </h1>
        </div>

        {/* H1 */}
        <div style={{ marginBottom: "2.5rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #94a3b8)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H1</p>
          <h1 style={{
            fontSize:     "clamp(1.875rem, 4vw, 2.75rem)",
            fontWeight:   600,
            letterSpacing:"-0.02em",
            lineHeight:   1.2,
            color:        "var(--text, #0f172a)",
            margin:       0,
          }}>
            Grow faster without adding complexity
          </h1>
        </div>

        {/* H2 */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #94a3b8)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H2</p>
          <h2 style={{
            fontSize:     "clamp(1.5rem, 3vw, 2rem)",
            fontWeight:   600,
            letterSpacing:"-0.015em",
            lineHeight:   1.3,
            color:        "var(--text, #0f172a)",
            margin:       0,
          }}>
            Trusted by 500+ companies across Europe
          </h2>
        </div>

        {/* H3 */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #94a3b8)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>H3</p>
          <h3 style={{
            fontSize:     "1.25rem",
            fontWeight:   600,
            letterSpacing:"-0.01em",
            lineHeight:   1.4,
            color:        "var(--text, #0f172a)",
            margin:       0,
          }}>
            Real-time reporting that your board will love
          </h3>
        </div>

        {/* Body */}
        <div style={{ marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #94a3b8)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Body</p>
          <p style={{
            fontSize:   "1rem",
            fontWeight: 400,
            lineHeight: 1.75,
            color:      "var(--text-muted, #475569)",
            margin:     0,
          }}>
            Our platform unifies your data, your team, and your processes into a single
            coherent operating layer — so every decision is faster, every process is
            cleaner, and every stakeholder finally sees the same picture.
          </p>
        </div>

        {/* Small */}
        <div>
          <p style={{ fontSize: "0.65rem", color: "var(--text-subtle, #94a3b8)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Small / Caption</p>
          <p style={{
            fontSize:   "0.875rem",
            fontWeight: 400,
            lineHeight: 1.6,
            color:      "var(--text-subtle, #94a3b8)",
            margin:     0,
          }}>
            30-day free trial. No credit card required. Cancel at any time.
          </p>
        </div>
      </div>
    </CleanCorporateScope>
  );
}

// ── Hero — split clean ────────────────────────────────────────────────────────

function HeroSplitClean() {
  return (
    <CleanCorporateScope>
      <section style={{
        background: "var(--bg, #ffffff)",
        padding:    "5rem 2rem",
        borderBottom:"1px solid var(--border, #e2e8f0)",
      }}>
        <div style={{
          maxWidth:   "1200px",
          margin:     "0 auto",
          display:    "grid",
          gridTemplateColumns: "1fr 1fr",
          gap:        "4rem",
          alignItems: "center",
        }}>
          {/* Left: copy */}
          <div>
            <span style={{
              display:      "inline-block",
              fontSize:     "0.75rem",
              letterSpacing:"0.1em",
              textTransform:"uppercase",
              color:        "var(--primary, #0284c7)",
              marginBottom: "1rem",
              fontWeight:   600,
            }}>
              Trusted by 500+ companies
            </span>

            <h1 style={{
              fontSize:     "clamp(2rem, 4vw, 3.25rem)",
              fontWeight:   600,
              letterSpacing:"-0.02em",
              lineHeight:   1.15,
              color:        "var(--text, #0f172a)",
              margin:       "0 0 1.25rem",
              fontFamily:   "var(--font-heading, 'DM Sans', system-ui, sans-serif)",
            }}>
              The platform modern businesses run on
            </h1>

            <p style={{
              fontSize:    "1.0625rem",
              lineHeight:  1.7,
              color:       "var(--text-muted, #475569)",
              marginBottom:"2rem",
            }}>
              Unify your data, streamline your operations, and give every stakeholder
              the clarity they need to move fast and confidently.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button style={{
                background:   "var(--primary, #0284c7)",
                color:        "#fff",
                padding:      "0.75rem 1.75rem",
                border:       "none",
                borderRadius: "0.5rem",
                fontWeight:   600,
                fontSize:     "0.9375rem",
                cursor:       "pointer",
              }}>
                Book a demo
              </button>
              <button style={{
                background:   "transparent",
                color:        "var(--text, #0f172a)",
                padding:      "0.75rem 1.75rem",
                border:       "1px solid var(--border, #e2e8f0)",
                borderRadius: "0.5rem",
                fontWeight:   500,
                fontSize:     "0.9375rem",
                cursor:       "pointer",
              }}>
                Start free trial →
              </button>
            </div>
          </div>

          {/* Right: product visual placeholder */}
          <div style={{
            background:   "var(--bg-subtle, #f8fafc)",
            border:       "1px solid var(--border, #e2e8f0)",
            borderRadius: "0.75rem",
            padding:      "2rem",
            aspectRatio:  "4/3",
            display:      "flex",
            alignItems:   "center",
            justifyContent:"center",
            boxShadow:    "0 4px 24px rgba(15,23,42,0.06)",
          }}>
            <div style={{ textAlign: "center", color: "var(--text-subtle, #94a3b8)", fontFamily: "system-ui" }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📊</div>
              <p style={{ fontSize: "0.875rem", margin: 0 }}>Product screenshot</p>
            </div>
          </div>
        </div>
      </section>
    </CleanCorporateScope>
  );
}

// ── Block variant comparison ──────────────────────────────────────────────────

function BlockVariantComparison() {
  return (
    <CleanCorporateScope>
      <div style={{ padding: "3rem 2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "var(--text-muted, #475569)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Clean Corporate — Block Variants
        </p>
        <h2 style={{ color: "var(--text, #0f172a)", fontSize: "1.5rem", fontWeight: 600, marginBottom: "3rem" }}>
          Feature Grid: spacious vs 3-up
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Spacious */}
          <div>
            <p style={{ color: "var(--text-muted, #475569)", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              feature_grid_spacious (recommended for Clean Corporate)
            </p>
            <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
              <FeatureGridBlock
                data={{ heading: "What you get on day one", features }}
                variant="feature_grid_spacious"
              />
            </div>
          </div>

          {/* Standard */}
          <div>
            <p style={{ color: "var(--text-muted, #475569)", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>
              feature_grid_3up (standard — falls back correctly)
            </p>
            <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: "8px", overflow: "hidden" }}>
              <FeatureGridBlock
                data={{ heading: "What you get on day one", features }}
                variant="feature_grid_3up"
              />
            </div>
          </div>
        </div>
      </div>
    </CleanCorporateScope>
  );
}

// ── Full homepage composition ─────────────────────────────────────────────────

function HomepageComposition() {
  return (
    <CleanCorporateScope>
      <HeroSplitClean />
      <FeatureGridBlock
        data={{ heading: "Everything your business needs", features }}
        variant="feature_grid_spacious"
      />
      <TestimonialSectionBlock
        data={{ heading: "What our customers say", testimonials }}
        variant="testimonial_grid"
      />
    </CleanCorporateScope>
  );
}

// ── Story metadata ─────────────────────────────────────────────────────────────

const meta: Meta = {
  title:  "Clean Corporate",
  tags:   ["autodocs"],
  parameters: {
    layout:      "fullscreen",
    backgrounds: { default: "Light" },
    docs: {
      description: {
        component:
          "Stories for the Clean Corporate premium theme family. Pure white surface, sky-blue accent, " +
          "DM Sans typography, balanced radius — optimised for first-time visitors and B2B corporate buyers. " +
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
  name:   "Hero — split clean",
  render: () => <HeroSplitClean />,
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
    <CleanCorporateScope>
      <FeatureGridBlock
        data={{ heading: "Everything your business needs", features }}
        variant="feature_grid_spacious"
      />
      <TestimonialSectionBlock
        data={{ heading: "What our customers say", testimonials }}
        variant="testimonial_grid"
      />
    </CleanCorporateScope>
  ),
};
