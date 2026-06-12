/**
 * SearchBar stories
 *
 * The SearchBar is a slim search input rendered in the middle band of the
 * header_triband layout. On submit (Enter or icon click) it navigates to
 * /search?q=<term> — that navigation fires a Next.js router call, which will
 * no-op in Storybook. Focus and hover states are fully visible.
 *
 * Use the Theme toolbar to see how the bar adapts to different brand tokens:
 * `--header-input-bg`, `--header-border`, `--ring`, `--text-muted`.
 */

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SearchBar }           from "./SearchBar";

const meta: Meta<typeof SearchBar> = {
  title:     "Layout/SearchBar",
  component: SearchBar,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Compact search input for the triband header. " +
          "Expands from `w-56` to `w-72` on focus. " +
          "Navigates to `searchHref?q=<value>` on submit. " +
          "Styled exclusively via CSS custom properties — no hardcoded colours.",
      },
    },
  },
  argTypes: {
    placeholder: { control: "text" },
    searchHref:  { control: "text" },
    className:   { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof SearchBar>;

// ── Helper: renders the bar on a realistic header-like background ─────────────

function HeaderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background:  "var(--header-bg, var(--bg, #fff))",
      padding:     "0.75rem 1.5rem",
      display:     "flex",
      alignItems:  "center",
      borderBottom:"1px solid var(--border, #e5e7eb)",
      minHeight:   56,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stories
// ─────────────────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "default",
  args: {
    placeholder: "Zoeken…",
    searchHref:  "/search",
  },
  decorators: [(Story) => <HeaderWrapper><Story /></HeaderWrapper>],
  parameters: { layout: "fullscreen" },
};

export const EnglishPlaceholder: Story = {
  name: "English placeholder",
  args: {
    placeholder: "Search…",
    searchHref:  "/search",
  },
  decorators: [(Story) => <HeaderWrapper><Story /></HeaderWrapper>],
  parameters: { layout: "fullscreen" },
};

/**
 * On a dark header background (`--header-bg` override).
 * Demonstrates that the bar picks up the token correctly.
 */
export const DarkHeader: Story = {
  name: "dark header background",
  args: {
    placeholder: "Zoeken…",
    searchHref:  "/search",
  },
  decorators: [
    (Story) => (
      <div style={{
        "--header-bg":      "var(--primary, #1e2761)",
        "--header-fg":      "#ffffff",
        "--header-border":  "rgba(255,255,255,0.2)",
        "--header-input-bg":"rgba(255,255,255,0.1)",
        "--text-muted":     "rgba(255,255,255,0.6)",
        "--ring":           "#ffffff",
      } as React.CSSProperties}>
        <HeaderWrapper><Story /></HeaderWrapper>
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
};

/**
 * Standalone (no header wrapper) — shows just the control.
 * Useful for embedding in other layouts such as a hero.
 */
export const Standalone: Story = {
  name: "standalone",
  args: {
    placeholder: "Zoek vacatures, artikelen, pagina's…",
    searchHref:  "/search",
    className:   "w-full",
  },
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};
