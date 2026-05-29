import { Suspense } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Pagination } from "./Pagination";

// Pagination calls useSearchParams — must be wrapped in <Suspense>
const withSuspense = (Story: React.ComponentType) => (
  <Suspense fallback={<div style={{ height: "2.25rem" }} />}>
    <Story />
  </Suspense>
);

const meta: Meta<typeof Pagination> = {
  title:     "Molecules/Pagination",
  component: Pagination,
  tags:      ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "URL-param-driven page controls (`?page=N`). Reads and writes the `page` " +
          "search param via `useSearchParams` and `router.replace`. " +
          "Must be wrapped in `<Suspense>` when used in a Server Component tree. " +
          "Renders nothing when `totalPages ≤ 1`.",
      },
    },
  },
  argTypes: {
    totalPages:  { control: { type: "number", min: 1, max: 50 } },
    maxVisible:  { control: { type: "number", min: 3, max: 11 } },
  },
  args: {
    totalPages: 10,
    maxVisible: 5,
  },
  decorators: [withSuspense],
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {};

export const FewPages: Story = {
  name: "Few pages (no ellipsis)",
  args: { totalPages: 4 },
};

export const ManyPages: Story = {
  name: "Many pages (15)",
  args: { totalPages: 15 },
};

export const WideWindow: Story = {
  name: "Wide visible window (maxVisible=9)",
  args: { totalPages: 20, maxVisible: 9 },
};

export const TwoPages: Story = {
  name: "Two pages (minimum useful)",
  args: { totalPages: 2 },
};

export const SinglePage: Story = {
  name: "Single page (renders nothing)",
  args: { totalPages: 1 },
};
