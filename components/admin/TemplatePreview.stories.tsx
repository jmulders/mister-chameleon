import type { Meta, StoryObj } from "@storybook/react";
import { TemplatePreview }     from "./TemplatePreview";
import type { TemplatePreviewType } from "@/page-config";

/**
 * TemplatePreview stories
 *
 * One story per structural layout type.  Each story renders the schematic SVG
 * at a realistic card thumbnail size so the layout proportions can be verified.
 *
 * The component fills 100% of its container, so we wrap each story in a
 * fixed-size div that matches the card thumbnail dimensions used in the
 * provisioning UI (68 px wide × 100 px tall, portrait 4:5 ratio).
 */

const meta: Meta<typeof TemplatePreview> = {
  title:     "Admin/TemplatePreview",
  component: TemplatePreview,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Schematic page-layout thumbnails for the template selector in the site " +
          "provisioning UI.  Each preview shows the structural arrangement of sections " +
          "(nav, hero, proof, content, CTA) for the corresponding page template type.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 68, height: 100, border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    previewType: {
      control:     "select",
      options:     ["marketing", "landing", "article", "listing", "detail"] satisfies TemplatePreviewType[],
      description: "Structural layout type to render",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TemplatePreview>;

// ── Individual layout stories ─────────────────────────────────────────────────

/**
 * Marketing page — Hero + Proof strip + two content sections + CTA banner.
 *
 * Used by: Home (corporate/content), About, Services, FAQ
 */
export const Marketing: Story = {
  name: "Marketing page",
  args: { previewType: "marketing" },
};

/**
 * Landing page — Hero + content sections + CTA banner (no proof strip).
 *
 * Used by: Landing, Contact, FAQ (standalone)
 */
export const Landing: Story = {
  name: "Landing page",
  args: { previewType: "landing" },
};

/**
 * Article page — Article meta header + long-form body content.
 *
 * Used by: Article detail (news/blog)
 */
export const Article: Story = {
  name: "Article / Editorial",
  args: { previewType: "article" },
};

/**
 * Listing page — Intro header + responsive card grid (2–3 rows).
 *
 * Used by: News listing, Case studies listing, Vacancies listing, Team
 */
export const Listing: Story = {
  name: "Listing page",
  args: { previewType: "listing" },
};

/**
 * Detail page — Entity meta header (image + title/meta) + body + related items.
 *
 * Used by: Case study detail, Vacancy detail
 */
export const Detail: Story = {
  name: "Detail page",
  args: { previewType: "detail" },
};

// ── All layouts side by side ──────────────────────────────────────────────────

/**
 * All five layout types rendered together for comparison.
 *
 * Useful for verifying visual consistency across the schematic palette and
 * ensuring each layout is clearly distinguishable at thumbnail size.
 */
export const AllLayouts: Story = {
  name: "All layouts",
  decorators: [
    () => {
      const types: Array<{ type: TemplatePreviewType; label: string }> = [
        { type: "marketing", label: "Marketing" },
        { type: "landing",   label: "Landing"   },
        { type: "article",   label: "Article"   },
        { type: "listing",   label: "Listing"   },
        { type: "detail",    label: "Detail"    },
      ];
      return (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {types.map(({ type, label }) => (
            <div key={type} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 68, height: 100,
                border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden",
              }}>
                <TemplatePreview previewType={type} />
              </div>
              <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "sans-serif" }}>{label}</span>
            </div>
          ))}
        </div>
      );
    },
  ],
  args: { previewType: "marketing" }, // satisfies Story type; decorator overrides rendering
};

// ── In-card context ───────────────────────────────────────────────────────────

/**
 * Rendered inside a TemplateCard-like container to simulate the actual
 * provisioning UI at realistic proportions.
 *
 * The card is 260 px wide — same as a single column in the lg:grid-cols-3 layout.
 */
export const InCardContext: Story = {
  name: "In card context (260 px)",
  decorators: [
    () => (
      <div style={{
        display: "flex",
        gap: 0,
        overflow: "hidden",
        borderRadius: 8,
        border: "2px solid #60a5fa",
        width: 260,
        background: "#fff",
      }}>
        {/* Preview column */}
        <div style={{ width: 68, flexShrink: 0, background: "#f9fafb", borderRight: "1px solid #f3f4f6" }}>
          <TemplatePreview previewType="marketing" />
        </div>
        {/* Info column */}
        <div style={{ padding: "10px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", fontFamily: "sans-serif" }}>Home</span>
          <code style={{ fontSize: 9, color: "#9ca3af", background: "#f3f4f6", padding: "1px 4px", borderRadius: 3, alignSelf: "flex-start" }}>/</code>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {["Hero", "Proof", "Content blocks", "CTA"].map((s) => (
              <span key={s} style={{ fontSize: 8.5, background: "#f3f4f6", color: "#6b7280", padding: "1px 5px", borderRadius: 999, fontFamily: "sans-serif" }}>{s}</span>
            ))}
          </div>
          <p style={{ fontSize: 9.5, color: "#6b7280", fontFamily: "sans-serif", marginTop: 2 }}>
            Main landing page of your site.
          </p>
        </div>
      </div>
    ),
  ],
  args: { previewType: "marketing" },
};
