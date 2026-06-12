/**
 * TimelineBlock
 *
 * Renders a `timeline` page section — an ordered list of milestones, events,
 * or history entries with date labels.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      TimelineBlockData  { heading?, description?, items[] }
 *   variant   TimelineVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   timeline_vertical   — stacked vertical timeline with connecting line and
 *                         alternating dot markers (default)
 *   timeline_compact    — tight single-column list; date inline with title,
 *                         lower vertical footprint
 *   timeline_milestones — bold date + icon emphasis; ideal for company history
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg     Section background
 *   --section-subtle-border Section border
 *   --card-bg               Item card background
 *   --card-border           Item card border colour
 *   --card-radius           Item card border-radius
 *   --primary               Timeline line / dot accent colour
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 */

import { Container }          from "@/components/primitives/Container";
import { Section }            from "@/components/primitives/Section";
import { Stack }              from "@/components/primitives/Stack";
import { Text }               from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { TimelineVariant } from "@/page-config/block-variants";
import type { TimelineBlockData, TimelineItem } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";
import { TimelineSlider }    from "./TimelineSlider";

interface TimelineBlockProps {
  data:     TimelineBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Vertical timeline item ────────────────────────────────────────────────────

function VerticalItem({
  item,
  isLast,
}: {
  item:   TimelineItem;
  isLast: boolean;
}) {
  return (
    <div className="relative flex gap-6">
      {/* Connector line + dot */}
      <div className="flex flex-col items-center">
        <div
          className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-current"
          style={{ color: "var(--primary)", backgroundColor: "var(--card-bg, white)" }}
        >
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: "var(--primary)" }}
          />
        </div>
        {!isLast && (
          <div
            className="mt-1 w-px flex-1"
            style={{ backgroundColor: "var(--card-border)" }}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-10 ${isLast ? "" : ""}`}>
        {item.date && (
          <Text variant="caption" color="muted" className="mb-1 uppercase tracking-wide">
            {item.date}
          </Text>
        )}
        <Text
          variant="h4"
          as="h3"
          style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}
        >
          {item.href ? (
            <a href={item.href} className="hover:underline">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </Text>
        {item.description && (
          <Text variant="body-sm" color="muted" className="mt-1">
            {item.description}
          </Text>
        )}
      </div>
    </div>
  );
}

// ── Compact timeline item ─────────────────────────────────────────────────────

function CompactItem({ item }: { item: TimelineItem }) {
  return (
    <div
      className="flex items-start gap-4 border-l-2 pl-4"
      style={{ borderColor: "var(--primary)" }}
    >
      <div className="flex-1 py-2">
        <div className="flex flex-wrap items-baseline gap-2">
          {item.date && (
            <Text variant="caption" color="muted" className="uppercase tracking-wide shrink-0">
              {item.date}
            </Text>
          )}
          <Text variant="body" className="font-medium">
            {item.href ? (
              <a href={item.href} className="hover:underline">
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </Text>
        </div>
        {item.description && (
          <Text variant="body-sm" color="muted" className="mt-0.5">
            {item.description}
          </Text>
        )}
      </div>
    </div>
  );
}

// ── Milestone item ────────────────────────────────────────────────────────────

function MilestoneItem({ item }: { item: TimelineItem }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border p-6"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {item.date && (
        <Text
          variant="h4"
          as="p"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-heading)" }}
        >
          {item.date}
        </Text>
      )}
      <Text variant="body" className="font-semibold">
        {item.href ? (
          <a href={item.href} className="hover:underline">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </Text>
      {item.description && (
        <Text variant="body-sm" color="muted">
          {item.description}
        </Text>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TimelineBlock({ data, variant: rawVariant, surface }: TimelineBlockProps) {
  const variant = resolveBlockVariant("timeline", rawVariant) as TimelineVariant;
  const { heading, description, items } = data;

  // ── Empty state (development / live preview only) ────────────────────────────
  //
  // When no items, heading, or description have been configured yet, the block
  // would render as invisible whitespace — unhelpful when editing in the CP live
  // preview.  Show a dashed placeholder in development so the editor can see the
  // block's position and know content still needs to be added.
  //
  // In production the block is simply suppressed (returns null).
  if (items.length === 0 && !heading && !description) {
    if (process.env.NODE_ENV === "development") {
      return (
        <Section spacing="md" style={{ background: "var(--section-subtle-bg, #f8f9fa)" }}>
          <Container size="md">
            <div
              style={{
                border: "2px dashed var(--card-border, #d0d5dd)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                textAlign: "center",
                color: "var(--text-muted, #6b7280)",
                fontSize: "0.875rem",
                lineHeight: "1.5",
              }}
            >
              <strong style={{ display: "block", marginBottom: "0.25rem" }}>Timeline</strong>
              Voeg milestones toe in de editor
            </div>
          </Container>
        </Section>
      );
    }
    return null;
  }

  // ── timeline_slider ──────────────────────────────────────────────────────────
  if (variant === "timeline_slider") {
    return (
      <TimelineSlider
        data={data}
        surface={resolveSurface(surface) ?? undefined}
      />
    );
  }

  // ── timeline_compact ────────────────────────────────────────────────────────
  if (variant === "timeline_compact") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="md">
          <Stack gap={8}>
            {(heading || description) && (
              <Stack gap={3}>
                {heading && (
                  <Text
                    variant="h2"
                    balance
                    style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}
                  >
                    {heading}
                  </Text>
                )}
                {description && (
                  <Text variant="body" color="muted" className="max-w-xl">
                    {description}
                  </Text>
                )}
              </Stack>
            )}
            <Stack gap={0}>
              {items.map((item) => (
                <div key={item.id} className="py-3 border-b last:border-b-0" style={{ borderColor: "var(--card-border)" }}>
                  <CompactItem item={item} />
                </div>
              ))}
            </Stack>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── timeline_milestones ─────────────────────────────────────────────────────
  if (variant === "timeline_milestones") {
    return (
      <Section spacing="xl" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={10}>
            {(heading || description) && (
              <Stack gap={3} align="center" className="text-center">
                {heading && (
                  <Text
                    variant="h2"
                    align="center"
                    balance
                    style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}
                  >
                    {heading}
                  </Text>
                )}
                {description && (
                  <Text variant="body" color="muted" align="center" className="max-w-xl">
                    {description}
                  </Text>
                )}
              </Stack>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <MilestoneItem key={item.id} item={item} />
              ))}
            </div>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── timeline_vertical (default) ─────────────────────────────────────────────
  return (
    <Section spacing="xl" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
      <Container size="md">
        <Stack gap={10}>
          {(heading || description) && (
            <Stack gap={3}>
              {heading && (
                <Text
                  variant="h2"
                  balance
                  style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}
                >
                  {heading}
                </Text>
              )}
              {description && (
                <Text variant="body" color="muted" className="max-w-xl">
                  {description}
                </Text>
              )}
            </Stack>
          )}
          <div>
            {items.map((item, index) => (
              <VerticalItem
                key={item.id}
                item={item}
                isLast={index === items.length - 1}
              />
            ))}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
