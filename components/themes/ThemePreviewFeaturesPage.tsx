/**
 * ThemePreviewFeaturesPage
 *
 * A second self-contained preview scene used alongside ThemePreviewScene to
 * give each preset a multi-page preview in the admin gallery.
 *
 * Shows: StatsBlock (impact metrics) + ProofBlock (quotes) + CTABlock
 * — deliberately different from the Home scene (HeroBlock + FeatureGrid + CTA)
 * so the two tabs demonstrate distinct visual contexts: a homepage vs a
 * social-proof / features page.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   Same pattern as ThemePreviewScene — render inside a Storybook story whose
 *   decorator injects the theme CSS via tenantThemeToCSS().
 *
 * ─── Story ID pattern ────────────────────────────────────────────────────────
 *
 *   Export name: CorporateBlueFeatures  →  slug: corporate-blue-features
 *   Full ID:  themes-preview--corporate-blue-features
 */

import { StatsBlock }   from "@/components/blocks/sections/StatsBlock";
import { ProofBlock }   from "@/components/blocks/ProofBlock";
import { CTABlock }     from "@/components/blocks/CTABlock";

// ── Mock content ──────────────────────────────────────────────────────────────

const STATS_DATA = {
  heading: "Trusted by teams worldwide",
  items: [
    { value: "10,000+", label: "Teams onboarded" },
    { value: "99.9%",   label: "Uptime SLA" },
    { value: "4.9 / 5", label: "Customer rating" },
    { value: "< 5 min", label: "Avg setup time" },
  ],
};

const PROOF_PROPS = {
  title: "What our customers say",
  items: [
    {
      title: "\"Game-changing platform\"",
      text:  "We cut our deployment time by 80% in the first month. The team was up and running without any training.",
    },
    {
      title: "\"Finally, a tool that just works\"",
      text:  "After trying five alternatives we landed here. Clean UI, rock-solid reliability, and support that actually responds.",
    },
    {
      title: "\"Worth every penny\"",
      text:  "The ROI was clear within two weeks. We saved more in developer hours than the annual plan costs.",
    },
  ],
  layoutVariant: "proof_quotes",
};

const CTA_PROPS = {
  title: "Start your free trial today",
  text:  "No credit card required. Set up in minutes. Cancel anytime.",
  cta:   { label: "Get started free", href: "#" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ThemePreviewFeaturesPage() {
  return (
    <main>
      <StatsBlock   data={STATS_DATA} />
      <ProofBlock   title={PROOF_PROPS.title} items={PROOF_PROPS.items} layoutVariant={PROOF_PROPS.layoutVariant} />
      <CTABlock     {...CTA_PROPS} />
    </main>
  );
}
