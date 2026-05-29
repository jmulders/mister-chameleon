import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Link } from "./Link";

const meta: Meta<typeof Link> = {
  title:     "Atoms/Link",
  component: Link,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Styled anchor atom. Uses `next/link` for internal paths and a plain `<a>` for external URLs. " +
          "Five variants: `default`, `primary`, `muted`, `underline`, `nav`.",
      },
    },
  },
  argTypes: {
    variant:  { control: "select", options: ["default", "primary", "muted", "underline", "nav"] },
    external: { control: "boolean" },
  },
  args: {
    href:     "/example",
    children: "Example link",
    variant:  "default",
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {};

export const AllVariants: Story = {
  name: "All variants",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem" }}>
      {(["default", "primary", "muted", "underline", "nav"] as const).map((variant) => (
        <div key={variant} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ width: "6rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>{variant}</span>
          <Link href="/example" variant={variant}>
            Link text — {variant}
          </Link>
        </div>
      ))}
    </div>
  ),
};

export const InProse: Story = {
  name: "In prose context",
  render: () => (
    <p style={{ fontSize: "1rem", lineHeight: "1.7", maxWidth: "36rem" }}>
      This paragraph contains an{" "}
      <Link href="/example" variant="underline">
        inline link with underline variant
      </Link>{" "}
      which is best suited for use within body copy where the link should be clearly
      distinguishable from surrounding text.
    </p>
  ),
};

export const NavLinks: Story = {
  name: "Nav links",
  render: () => (
    <nav style={{ display: "flex", gap: "1.5rem", padding: "1rem", background: "white", borderBottom: "1px solid #e5e7eb" }}>
      {["Home", "Products", "Pricing", "Blog", "Contact"].map((label) => (
        <Link key={label} href="/example" variant="nav">
          {label}
        </Link>
      ))}
    </nav>
  ),
};

export const ExternalLink: Story = {
  name: "External link",
  args: { href: "https://example.com", children: "Visit example.com", variant: "primary", external: true },
};
