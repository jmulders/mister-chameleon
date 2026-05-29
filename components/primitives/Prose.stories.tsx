import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Prose } from "./Prose";

const sampleHtml = `
<h2>Why this matters</h2>
<p>Good typography is the foundation of readable content. When text is well-set, readers don't think about the type — they just read.</p>
<p>The Prose component applies Tailwind Typography classes to consistently style headings, paragraphs, lists, blockquotes, and inline elements across the platform.</p>
<h3>Key features</h3>
<ul>
  <li>Consistent heading hierarchy (h2–h4)</li>
  <li>Comfortable line-height and paragraph spacing</li>
  <li>Styled <a href="#">inline links</a> and <strong>bold text</strong></li>
  <li>Code blocks: <code>const foo = 'bar'</code></li>
</ul>
<blockquote>
  <p>Typography is the craft of endowing human language with a durable visual form.</p>
</blockquote>
<p>Platform colours and fonts are applied via Tailwind Typography's neutral palette modifier, so tenant theme tokens take effect automatically.</p>
`;

const meta: Meta<typeof Prose> = {
  title:     "Atoms/Prose",
  component: Prose,
  tags:      ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Typography container for rich or long-form text. " +
          "Applies Tailwind Typography prose classes. " +
          "Accepts either React `children` (component-composed) or a sanitised `html` string from a CMS.",
      },
    },
  },
  argTypes: {
    size: { control: "select", options: ["sm", "base", "lg"] },
  },
  args: {
    size: "base",
    html: sampleHtml,
  },
  decorators: [(Story) => <div style={{ maxWidth: "48rem", padding: "1rem" }}><Story /></div>],
};

export default meta;
type Story = StoryObj<typeof Prose>;

export const Default: Story = {};

export const Small: Story = {
  name: "Small (prose-sm)",
  args: { size: "sm", html: sampleHtml },
};

export const Large: Story = {
  name: "Large (prose-lg)",
  args: { size: "lg", html: sampleHtml },
};

export const ComponentChildren: Story = {
  name: "Component children (not HTML string)",
  args: { html: undefined },
  render: () => (
    <Prose>
      <h2>Component-composed content</h2>
      <p>
        This version uses React children instead of a raw HTML string. Useful when
        rich text is built from components rather than CMS-rendered HTML.
      </p>
      <ul>
        <li>Works with any React node</li>
        <li>No sanitisation needed — no dangerouslySetInnerHTML</li>
        <li>Picks up the same typography styles</li>
      </ul>
    </Prose>
  ),
};
