/**
 * NavMegaRich Stories
 *
 * Demonstrates the rich column-based mega menu across all three theme variants:
 *   - Dark AI       — premium, near-black, media-forward
 *   - Clean Corporate — light, calm, readable
 *   - Structured SaaS — compact, efficient, product-like
 *
 * Story matrix:
 *   Links only       — two link columns, one with titles, one without
 *   Media only       — two media columns with image / GIF items
 *   Mixed            — one link column + one media column
 *   Active item      — link marked as current page
 *   Parent clickable — demonstrates split-trigger pattern
 *
 * Each scenario is shown in all three theme variants via Storybook globals
 * (toolbar family/preset selector).  The stories here set an explicit
 * background so they look correct even without the Storybook preview decorator.
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NavMegaRich } from "./NavMegaRich";
import type { MegaMenuStyle } from "./NavMegaRich";
import type { NavigationItemData } from "@/cms/types";

// ── Fixture data ─────────────────────────────────────────────────────────────

const LINK_ITEMS_TITLED: NavigationItemData = {
  id:    "products",
  label: "Products",
  href:  "/products",
  megaMenu: {
    columns: [
      {
        _key:       "col-1",
        title:      "Core Platform",
        columnType: "links",
        items: [
          {
            _key:        "li-1",
            type:        "megaMenuLinkItem",
            label:       "Analytics Dashboard",
            href:        "/products/analytics",
            description: "Real-time data and visualisations for your team.",
          },
          {
            _key:        "li-2",
            type:        "megaMenuLinkItem",
            label:       "Automation Builder",
            href:        "/products/automation",
            description: "Trigger actions based on visitor signals.",
          },
          {
            _key:  "li-3",
            type:  "megaMenuLinkItem",
            label: "AI Decisions",
            href:  "/products/ai",
            description: "Personalise every visit using ML models.",
          },
        ],
      },
      {
        _key:       "col-2",
        title:      "Integrations",
        columnType: "links",
        items: [
          {
            _key:  "li-4",
            type:  "megaMenuLinkItem",
            label: "HubSpot CRM",
            href:  "/integrations/hubspot",
          },
          {
            _key:  "li-5",
            type:  "megaMenuLinkItem",
            label: "Sanity CMS",
            href:  "/integrations/sanity",
          },
          {
            _key:  "li-6",
            type:  "megaMenuLinkItem",
            label: "Stripe Billing",
            href:  "/integrations/stripe",
          },
          {
            _key:  "li-7",
            type:  "megaMenuLinkItem",
            label: "Vercel Deploy",
            href:  "/integrations/vercel",
          },
        ],
      },
    ],
  },
};

const LINK_ITEMS_UNTITLED: NavigationItemData = {
  id:    "solutions",
  label: "Solutions",
  href:  "/solutions",
  megaMenu: {
    columns: [
      {
        _key:       "col-a",
        title:      "",          // intentionally empty — title not rendered
        columnType: "links",
        items: [
          {
            _key:  "la-1",
            type:  "megaMenuLinkItem",
            label: "For SaaS Companies",
            href:  "/solutions/saas",
          },
          {
            _key:  "la-2",
            type:  "megaMenuLinkItem",
            label: "For E-commerce",
            href:  "/solutions/ecommerce",
          },
          {
            _key:  "la-3",
            type:  "megaMenuLinkItem",
            label: "For Enterprise",
            href:  "/solutions/enterprise",
          },
        ],
      },
      {
        _key:       "col-b",
        title:      "By Industry",
        columnType: "links",
        items: [
          {
            _key:  "lb-1",
            type:  "megaMenuLinkItem",
            label: "Financial Services",
            href:  "/solutions/finance",
          },
          {
            _key:  "lb-2",
            type:  "megaMenuLinkItem",
            label: "Healthcare",
            href:  "/solutions/healthcare",
          },
          {
            _key:  "lb-3",
            type:  "megaMenuLinkItem",
            label: "Technology",
            href:  "/solutions/tech",
          },
        ],
      },
    ],
  },
};

const MEDIA_ITEM: NavigationItemData = {
  id:    "showcase",
  label: "Showcase",
  href:  "/showcase",
  megaMenu: {
    columns: [
      {
        _key:       "col-media",
        title:      "Featured",
        columnType: "media",
        items: [
          {
            _key:      "mi-1",
            type:      "megaMenuMediaItem",
            mediaType: "image",
            assetUrl:  "https://images.unsplash.com/photo-1555421689-d68471e189f2?w=480&q=80",
            alt:       "Dashboard screenshot",
            caption:   "Analytics Dashboard",
            linkUrl:   "/showcase/analytics",
          },
          {
            _key:      "mi-2",
            type:      "megaMenuMediaItem",
            mediaType: "image",
            assetUrl:  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=480&q=80",
            hoverAssetUrl: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=480&q=80",
            alt:       "Automation builder",
            caption:   "Automation Builder",
            linkUrl:   "/showcase/automation",
          },
        ],
      },
    ],
  },
};

const MIXED_ITEM: NavigationItemData = {
  id:    "resources",
  label: "Resources",
  href:  "/resources",
  megaMenu: {
    columns: [
      {
        _key:       "col-links",
        title:      "Documentation",
        columnType: "links",
        items: [
          {
            _key:        "rl-1",
            type:        "megaMenuLinkItem",
            label:       "Getting Started",
            href:        "/docs/getting-started",
            description: "Set up your first Chameleon project in 5 minutes.",
          },
          {
            _key:        "rl-2",
            type:        "megaMenuLinkItem",
            label:       "API Reference",
            href:        "/docs/api",
            description: "Full reference for all REST and GraphQL endpoints.",
          },
          {
            _key:        "rl-3",
            type:        "megaMenuLinkItem",
            label:       "Tutorials",
            href:        "/docs/tutorials",
            description: "Step-by-step guides for common use cases.",
          },
          {
            _key:  "rl-4",
            type:  "megaMenuLinkItem",
            label: "Changelog",
            href:  "/docs/changelog",
          },
        ],
      },
      {
        _key:       "col-media-2",
        title:      "Featured Guide",
        columnType: "media",
        items: [
          {
            _key:      "rm-1",
            type:      "megaMenuMediaItem",
            mediaType: "image",
            assetUrl:  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=480&q=80",
            alt:       "Code on screen",
            caption:   "Advanced Personalisation →",
            linkUrl:   "/docs/personalisation",
          },
        ],
      },
    ],
  },
};

/** Simple items without mega menu (for context in stories) */
const SIMPLE_ITEM: NavigationItemData = {
  id:    "pricing",
  label: "Pricing",
  href:  "/pricing",
};

/** Item with legacy children (no megaMenu) — backward compat demonstration */
const LEGACY_CHILDREN_ITEM: NavigationItemData = {
  id:    "company",
  label: "Company",
  href:  "/company",
  children: [
    { id: "about",    label: "About Us",    href: "/about"    },
    { id: "careers",  label: "Careers",     href: "/careers"  },
    { id: "blog",     label: "Blog",        href: "/blog"     },
    { id: "press",    label: "Press",       href: "/press"    },
    { id: "contact",  label: "Contact",     href: "/contact"  },
  ],
};

/** Full navigation set for the most representative stories */
const FULL_NAV: NavigationItemData[] = [
  LINK_ITEMS_TITLED,
  LINK_ITEMS_UNTITLED,
  MIXED_ITEM,
  SIMPLE_ITEM,
  LEGACY_CHILDREN_ITEM,
];

// ── Story wrapper — applies a simple background matching each theme ────────────

function ThemeWrapper({
  children,
  megaStyle,
}: {
  children: React.ReactNode;
  megaStyle: MegaMenuStyle;
}) {
  const bg =
    megaStyle === "dark-ai"
      ? "bg-[#0a0a0f]"
      : megaStyle === "structured-saas"
        ? "bg-[#fafaf8]"
        : "bg-white";

  return (
    <div className={`relative ${bg} p-6 min-h-[400px]`}>
      {/* Shift down so the mega panel is visible below the trigger row */}
      <div className="relative">{children}</div>
    </div>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof NavMegaRich> = {
  title:     "Layout/Navigation/NavMegaRich",
  component: NavMegaRich,
  tags:      ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
The **NavMegaRich** component renders a flexible column-based mega menu that
supports link columns, media columns (image / video / GIF), and optional
column titles.

Three theme variants are available via the \`megaStyle\` prop:
- **dark-ai** — premium, near-black, spacious, media-forward
- **clean-corporate** — light, calm, readable, clearly structured
- **structured-saas** — compact, product-like, efficient

The parent nav item is always clickable (split-trigger pattern: label navigates,
chevron toggles the panel). The hover bridge prevents premature menu close.
        `.trim(),
      },
    },
  },
  argTypes: {
    megaStyle: {
      control:     "select",
      options:     ["dark-ai", "clean-corporate", "structured-saas", "default"],
      description: "Visual personality — derived from the active theme family.",
    },
    density: {
      control:  "select",
      options:  ["compact", "comfortable"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof NavMegaRich>;

// ── Stories — Clean Corporate ─────────────────────────────────────────────────

export const CleanCorporate_Links: Story = {
  name: "Clean Corporate — links only",
  args: {
    items:     [LINK_ITEMS_TITLED, LINK_ITEMS_UNTITLED, SIMPLE_ITEM],
    density:   "comfortable",
    megaStyle: "clean-corporate",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

export const CleanCorporate_Media: Story = {
  name: "Clean Corporate — media only",
  args: {
    items:     [MEDIA_ITEM, SIMPLE_ITEM],
    density:   "comfortable",
    megaStyle: "clean-corporate",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

export const CleanCorporate_Mixed: Story = {
  name: "Clean Corporate — mixed (links + media)",
  args: {
    items:     FULL_NAV,
    density:   "comfortable",
    megaStyle: "clean-corporate",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

export const CleanCorporate_LegacyChildren: Story = {
  name: "Clean Corporate — legacy children (backward compat)",
  args: {
    items:     [LEGACY_CHILDREN_ITEM, SIMPLE_ITEM],
    density:   "comfortable",
    megaStyle: "clean-corporate",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

// ── Stories — Dark AI ─────────────────────────────────────────────────────────

export const DarkAI_Links: Story = {
  name: "Dark AI — links only",
  args: {
    items:     [LINK_ITEMS_TITLED, LINK_ITEMS_UNTITLED, SIMPLE_ITEM],
    density:   "comfortable",
    megaStyle: "dark-ai",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="dark-ai">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

export const DarkAI_Media: Story = {
  name: "Dark AI — media only",
  args: {
    items:     [MEDIA_ITEM, SIMPLE_ITEM],
    density:   "comfortable",
    megaStyle: "dark-ai",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="dark-ai">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

export const DarkAI_Mixed: Story = {
  name: "Dark AI — mixed (links + media)",
  args: {
    items:     FULL_NAV,
    density:   "comfortable",
    megaStyle: "dark-ai",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="dark-ai">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

// ── Stories — Structured SaaS ─────────────────────────────────────────────────

export const StructuredSaaS_Links: Story = {
  name: "Structured SaaS — links only",
  args: {
    items:     [LINK_ITEMS_TITLED, LINK_ITEMS_UNTITLED, SIMPLE_ITEM],
    density:   "compact",
    megaStyle: "structured-saas",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="structured-saas">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

export const StructuredSaaS_Media: Story = {
  name: "Structured SaaS — media (product screenshot)",
  args: {
    items:     [MEDIA_ITEM, SIMPLE_ITEM],
    density:   "compact",
    megaStyle: "structured-saas",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="structured-saas">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

export const StructuredSaaS_Mixed: Story = {
  name: "Structured SaaS — mixed (links + screenshot)",
  args: {
    items:     FULL_NAV,
    density:   "compact",
    megaStyle: "structured-saas",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="structured-saas">
        <Story />
      </ThemeWrapper>
    ),
  ],
};

// ── Comparison story — all themes side by side ────────────────────────────────

export const AllThemes_Comparison: Story = {
  name: "All themes — comparison",
  render: () => (
    <div className="space-y-0 divide-y divide-neutral-200">
      {(["clean-corporate", "dark-ai", "structured-saas"] as MegaMenuStyle[]).map((style) => (
        <div key={style} className="p-6">
          <p className="text-xs font-mono text-neutral-500 mb-3 uppercase tracking-widest">
            megaStyle: {style}
          </p>
          <ThemeWrapper megaStyle={style}>
            <NavMegaRich
              items={[LINK_ITEMS_TITLED, MIXED_ITEM, SIMPLE_ITEM]}
              density={style === "structured-saas" ? "compact" : "comfortable"}
              megaStyle={style}
            />
          </ThemeWrapper>
        </div>
      ))}
    </div>
  ),
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Side-by-side comparison of the same navigation data rendered in each theme variant. " +
          "Hover a trigger to open the mega panel.",
      },
    },
  },
};

// ── Compact density story ─────────────────────────────────────────────────────

export const CompactDensity: Story = {
  name: "Clean Corporate — compact density",
  args: {
    items:     FULL_NAV,
    density:   "compact",
    megaStyle: "clean-corporate",
  },
  decorators: [
    (Story) => (
      <ThemeWrapper megaStyle="clean-corporate">
        <Story />
      </ThemeWrapper>
    ),
  ],
};
