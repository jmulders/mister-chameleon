/**
 * ProcessStepsBlock
 *
 * Renders a `processSteps` page section — an optional heading followed by an
 * ordered list of application/hiring process steps.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ProcessStepsBlockData  { heading?, steps[] }
 *   variant   ProcessStepsVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default    — vertical numbered list with dividers
 *   accordion  — each step is a collapsible <details>/<summary> element
 *   compact    — tight inline numbered list; lower vertical footprint
 *   horizontal — horizontal step track with connecting line and numbered nodes;
 *                ideal for short 3–5 step flows on landing pages
 *   arrows     — arrow-shaped blocks that point from one step to the next. On a
 *                wide screen they stand in a row, each with its number and
 *                title, and the text of the step under it. On a narrow one
 *                the steps stack: the arrows point down in a column on the
 *                left and the title and text stand beside them. For three to
 *                five steps with a short text each.
 *   flow       — a line the steps hang on, cards left and right of it in turn;
 *                for a longer story of five to eight steps, where each step has
 *                a few sentences. A step's `duration` shows as a label on its
 *                card, so it can say who acts in that step.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background
 *   --section-subtle-border  Section border colour
 *   --card-bg                Step card background
 *   --card-border            Step card border colour
 *   --card-radius            Step card border-radius
 *   --text                   Body text colour
 *   --text-brand             Step number accent colour
 *   --text-muted             Secondary text colour
 *   --text-subtle            Duration badge text colour
 *   --font-subheading-weight Step title font weight
 */

import { Container }          from "@/components/primitives/Container";
import { Section }            from "@/components/primitives/Section";
import { Stack }              from "@/components/primitives/Stack";
import { Text }               from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { ProcessStepsVariant } from "@/page-config/block-variants";
import type { ProcessStepsBlockData, ProcessStep } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface ProcessStepsBlockProps {
  data:     ProcessStepsBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Step subcomponent ─────────────────────────────────────────────────────────

/**
 * The numbered circle of a step.
 *
 * `connect` draws an arm from the circle to the step's card, with a tab where
 * the arm meets the card. The flow layout uses it: there the cards interleave,
 * so a circle stands beside two cards at once and the arm says which is its
 * own. On a phone the card is always after the circle; from md it is on the
 * side named here. Arm and tab are children of the circle, so they inherit the
 * colour a brand layer gives that step (`--mc-step`).
 */
function StepNumber({ n, large = false, connect }: { n: number; large?: boolean; connect?: "before" | "after" }) {
  const armColour = "var(--mc-step, var(--primary))";
  // Phone: arm to the right (gap 16 px). Wide: 32 px, to the card's side.
  const side = connect === "before"
    ? "left-full md:left-auto md:right-full"
    : "left-full";
  // The tab is centred on the card's edge, whichever side that edge is on.
  const tabSide = connect === "before"
    ? "left-[calc(100%+1rem)] -translate-x-1/2 md:left-auto md:right-[calc(100%+2rem)] md:translate-x-1/2"
    : "left-[calc(100%+1rem)] -translate-x-1/2 md:left-[calc(100%+2rem)]";
  return (
    <span
      // Hooks for a brand layer (app/brand/*.css): six colours, then round again.
      data-part="step-number"
      data-step={((n - 1) % 6) + 1}
      className={`relative flex shrink-0 items-center justify-center rounded-full font-bold ${large ? "h-12 w-12 text-lg" : "h-9 w-9 text-sm"}`}
      style={{
        background: "color-mix(in srgb, var(--primary) 12%, transparent)",
        color:      "var(--primary)",
      }}
    >
      {n}
      {connect && (
        <>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 h-0.5 w-4 -translate-y-1/2 md:w-8 ${side}`}
            style={{ background: armColour }}
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 h-8 w-1 -translate-y-1/2 rounded-full ${tabSide}`}
            style={{ background: armColour }}
          />
        </>
      )}
    </span>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function ProcessStepsBlock({ data, variant: rawVariant, surface }: ProcessStepsBlockProps) {
  const variant = resolveBlockVariant("processSteps", rawVariant) as ProcessStepsVariant;
  const { heading, steps } = data;
  const items = steps ?? [];

  // ── accordion variant ────────────────────────────────────────────────────────
  //
  // Each step is a <details>/<summary> collapsible panel.
  // Zero-JS progressive disclosure — no client components needed.

  if (variant === "accordion") {
    return (
      <Section
        spacing="lg"
        style={{
          background:          resolveSurface(surface) ?? "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
        className="border-y"
      >
        <Container size="md">
          <Stack gap={10}>
            {heading && (
              <Text variant="h2" align="center">
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Stack gap={2}>
                {items.map((step, index) => (
                  <details
                    key={index}
                    className="group border"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor:     "var(--card-border)",
                      borderRadius:    "var(--card-radius)",
                    }}
                  >
                    <summary
                      className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      <StepNumber n={index + 1} />
                      <span style={{ color: "var(--text)" }}>{step.title}</span>
                      {step.duration && (
                        <span
                          className="ml-auto text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {step.duration}
                        </span>
                      )}
                      {/* Chevron */}
                      <svg
                        className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                        style={{ color: "var(--text-subtle)" }}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </summary>
                    {step.description && (
                      <div className="px-5 pb-5 pt-1">
                        <Text variant="body" color="muted" className="leading-relaxed">
                          {step.description}
                        </Text>
                      </div>
                    )}
                  </details>
                ))}
              </Stack>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── compact variant ──────────────────────────────────────────────────────────
  //
  // Tight inline numbered list with a lower vertical footprint.
  // Good for embedding mid-page or in sidebars.

  if (variant === "compact") {
    return (
      <Section spacing="md">
        <Container size="md">
          <Stack gap={6}>
            {heading && <Text variant="h3">{heading}</Text>}

            {items.length > 0 && (
              <ol className="space-y-3">
                {items.map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <StepNumber n={index + 1} />
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-sm"
                        style={{
                          fontWeight: "var(--font-subheading-weight)",
                          color:      "var(--text)",
                        }}
                      >
                        {step.title}
                      </span>
                      {step.description && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {step.description}
                        </span>
                      )}
                      {step.duration && (
                        <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                          {step.duration}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── horizontal variant ───────────────────────────────────────────────────────
  //
  // Horizontal step track: numbered nodes connected by a horizontal line.
  // Works best with 3–5 short steps. On mobile, falls back to a vertical list
  // (same appearance as the default variant) since horizontal tracks need space.

  if (variant === "horizontal") {
    return (
      <Section
        spacing="xl"
        style={{
          background:        "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
        className="border-y"
      >
        <Container size="lg">
          <Stack gap={10}>
            {heading && (
              <Text variant="h2" align="center">
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <div>
                {/* ── Desktop: horizontal track ──────────────────────────────── */}
                <div className="hidden sm:block">
                  {/* Connector line row — sits behind the nodes */}
                  <div className="relative flex items-start">
                    {/* The line stretches between the first and last node centres */}
                    <div
                      className="absolute top-[18px] left-0 right-0 h-px"
                      style={{
                        marginLeft:  `calc(100% / ${items.length * 2})`,
                        marginRight: `calc(100% / ${items.length * 2})`,
                        background:  "var(--section-subtle-border)",
                      }}
                      aria-hidden="true"
                    />

                    {items.map((step, index) => (
                      <div key={index} className="relative flex flex-1 flex-col items-center gap-4">
                        {/* Numbered node */}
                        <StepNumber n={index + 1} />

                        {/* Step text */}
                        <div className="flex flex-col items-center gap-1 text-center px-2">
                          <span
                            className="text-sm"
                            style={{
                              fontWeight: "var(--font-subheading-weight)",
                              color:      "var(--text)",
                            }}
                          >
                            {step.title}
                          </span>
                          {step.description && (
                            <span
                              className="text-xs leading-relaxed"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {step.description}
                            </span>
                          )}
                          {step.duration && (
                            <span
                              className="text-xs"
                              style={{ color: "var(--text-subtle)" }}
                            >
                              {step.duration}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Mobile: vertical fallback ──────────────────────────────── */}
                <ol className="sm:hidden space-y-0">
                  {items.map((step, index) => (
                    <li
                      key={index}
                      className={`flex items-start gap-5 py-6 ${
                        index < items.length - 1 ? "border-b" : ""
                      }`}
                      style={{ borderColor: "var(--section-subtle-border)" }}
                    >
                      <StepNumber n={index + 1} />
                      <div className="flex flex-1 flex-col gap-1">
                        <span
                          className="text-base"
                          style={{
                            fontWeight: "var(--font-subheading-weight)",
                            color:      "var(--text)",
                          }}
                        >
                          {step.title}
                        </span>
                        {step.description && (
                          <Text variant="body" color="muted" className="leading-relaxed">
                            {step.description}
                          </Text>
                        )}
                      </div>
                      {step.duration && (
                        <span className="shrink-0 text-sm" style={{ color: "var(--text-subtle)" }}>
                          {step.duration}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── arrows variant ───────────────────────────────────────────────────────────
  //
  // Each step is an arrow that points at the next one. The arrow is one element
  // with a clip-path: a point on the far side, and a notch on the near side for
  // every arrow but the first. An arrow is pulled over the room its neighbour's
  // point leaves, so a thin gap of the section's background stays between two.
  //
  // Wide screen: the arrows stand in a row and point right. Number and title
  // are in the arrow, the text of the step is under it.
  //
  // Below that the steps stack and the arrows point down. They form a column on
  // the left with the number in it, and the title and the text stand beside
  // their arrow. So a phone shows every step at once: a row that slides
  // sideways hid three of the four steps behind a swipe.
  //
  // Stacked, every arrow has the same size. A dashed line runs from an arrow to
  // the next one and takes up the length of the text. In the first stacked
  // version an arrow was as tall as its step, so four steps gave four sizes of
  // arrow, which the owner did not find pretty.
  //
  // Both shapes are on the element as custom properties and a class picks one
  // per breakpoint, so there is one arrow per step in the markup. The title is
  // there twice, in the arrow and beside it. One of the two is always
  // `display: none`, so a screen reader meets it once.
  //
  // With many steps the row can still be wider than a small laptop. Then it
  // scrolls, and it can take focus so the keyboard can scroll it too.

  if (variant === "arrows") {
    const POINT = 18; // px the point sticks out, and the notch cuts in
    const GAP   = 6;  // px of background between two arrows
    const right     = `calc(100% - ${POINT}px) 0, 100% 50%, calc(100% - ${POINT}px) 100%, 0 100%`;
    const down      = `100% 0, 100% calc(100% - ${POINT}px), 50% 100%, 0 calc(100% - ${POINT}px)`;
    const rightFirst = `polygon(0 0, ${right})`;
    const rightNext  = `polygon(0 0, ${right}, ${POINT}px 50%)`;
    // Stacked arrows do not interlock, so they need no notch: one shape for all.
    const downShape  = `polygon(0 0, ${down})`;
    // The same dashes as the line of the flow layout.
    const lineStyle = {
      backgroundImage: "linear-gradient(to bottom, var(--text-subtle) 55%, transparent 55%)",
      backgroundSize:  "2px 12px",
    };
    return (
      <Section
        spacing="lg"
        style={{
          background:        resolveSurface(surface) ?? "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
        className="border-y"
      >
        <Container size="lg">
          <Stack gap={10}>
            {heading && (
              <Text variant="h2" align="center">
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <ol
                // A row that scrolls must be reachable without a mouse.
                tabIndex={0}
                aria-label={heading || undefined}
                className="mx-auto flex w-full max-w-xl flex-col lg:mx-0 lg:grid lg:max-w-none lg:grid-flow-col lg:auto-cols-[minmax(13rem,1fr)] lg:overflow-x-auto lg:pb-3"
                style={{ scrollbarWidth: "thin" }}
              >
                {items.map((step, index) => {
                  const first = index === 0;
                  const last  = index === items.length - 1;
                  return (
                    <li key={index} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-4 lg:block">
                      <div className="flex flex-col items-center lg:block">
                        <div
                          // The same hooks as the numbered circle, so a brand layer
                          // colours an arrow as it colours that step's number.
                          data-part="step-number"
                          data-step={(index % 6) + 1}
                          className="flex h-[4.25rem] w-full shrink-0 justify-center pt-2.5 text-base font-bold leading-tight [clip-path:var(--arrow-down)] lg:ml-[var(--arrow-pull)] lg:h-16 lg:w-auto lg:items-center lg:justify-start lg:gap-3 lg:pl-[var(--arrow-lead)] lg:pr-[var(--arrow-tail)] lg:pt-0 lg:[clip-path:var(--arrow-right)]"
                          style={{
                            "--arrow-down":  downShape,
                            "--arrow-right": first ? rightFirst : rightNext,
                            "--arrow-pull":  `${first ? 0 : -(POINT - GAP)}px`,
                            "--arrow-lead":  `${first ? 20 : 20 + (POINT - GAP)}px`,
                            "--arrow-tail":  `${POINT + 10}px`,
                            background:      "color-mix(in srgb, var(--primary) 12%, transparent)",
                            color:           "var(--primary)",
                          } as React.CSSProperties}
                        >
                          <span aria-hidden="true" className="text-2xl tabular-nums" style={{ opacity: 0.75 }}>
                            {index + 1}
                          </span>
                          <span className="hidden lg:inline">{step.title}</span>
                        </div>
                        {!last && (
                          <span aria-hidden="true" className="my-1.5 w-0.5 flex-1 lg:hidden" style={lineStyle} />
                        )}
                      </div>
                      <div className="pb-9 pt-3.5 lg:pb-0 lg:pl-5 lg:pr-6 lg:pt-4">
                        <span className="block text-lg font-bold leading-snug lg:hidden" style={{ color: "var(--text)" }}>
                          {step.title}
                        </span>
                        {step.description && (
                          <Text variant="body" color="muted" className="mt-1 leading-relaxed lg:mt-0">
                            {step.description}
                          </Text>
                        )}
                        {step.duration && (
                          <span className="mt-2 block text-sm" style={{ color: "var(--text-subtle)" }}>
                            {step.duration}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── flow variant ─────────────────────────────────────────────────────────────
  //
  // A story told along a line. On a wide screen the line runs down the middle
  // and the cards stand left and right of it in turn. On a phone the line runs
  // down the left and every card stands to its right.
  //
  // Wide screen: the list is one grid and every step takes two rows, starting
  // one row below the step before it. So a card on the right begins beside the
  // card on the left, which keeps the flow compact, and two cards on the same
  // side can never overlap, whatever their length.
  //
  // The line is drawn per step, from its node down to the next one, so it ends
  // at the last node and not below it.
  //
  // Because the cards interleave, a node stands beside two cards at once. An arm
  // in the step's colour runs from each node to its own card (see StepNumber).

  if (variant === "flow") {
    const lineStyle = {
      backgroundImage: "linear-gradient(to bottom, var(--text-subtle) 55%, transparent 55%)",
      backgroundSize:  "2px 12px",
      opacity:         0.55,
    };
    return (
      <Section
        spacing="lg"
        style={{
          background:        resolveSurface(surface) ?? "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
        className="border-y"
      >
        <Container size="lg">
          <Stack gap={10}>
            {heading && (
              <Text variant="h2" align="center">
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <ol className="mx-auto w-full max-w-4xl md:grid md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:gap-x-8">
                {items.map((step, index) => {
                  const right = index % 2 === 1;
                  const last  = index === items.length - 1;
                  return (
                    <li
                      key={index}
                      className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 md:contents"
                      // The last step has no step below it to share a row with.
                      style={{ "--flow-row": index + 1, "--flow-span": last ? 1 : 2 } as React.CSSProperties}
                    >
                      {/* The node, and under it the line to the next node. */}
                      <div className="col-start-1 flex flex-col items-center md:col-start-2 md:[grid-row:var(--flow-row)]">
                        <StepNumber n={index + 1} large connect={right ? "after" : "before"} />
                        {!last && <span aria-hidden="true" className="my-1 w-0.5 flex-1" style={lineStyle} />}
                      </div>
                      <div
                        className={`col-start-2 mb-5 rounded-2xl border p-5 md:mb-4 md:self-start md:[grid-row:var(--flow-row)_/_span_var(--flow-span)] ${last ? "mb-0 md:mb-0" : ""} ${right ? "md:col-start-3" : "md:col-start-1"}`}
                        style={{
                          background:   "var(--card-bg)",
                          borderColor:  "var(--card-border)",
                          borderRadius: "var(--card-radius)",
                        }}
                      >
                        {step.duration && (
                          <span
                            className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {step.duration}
                          </span>
                        )}
                        <span
                          className="block text-lg"
                          style={{
                            fontWeight: "var(--font-subheading-weight)",
                            color:      "var(--text)",
                          }}
                        >
                          {step.title}
                        </span>
                        {step.description && (
                          <Text variant="body" color="muted" className="mt-1 leading-relaxed">
                            {step.description}
                          </Text>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default variant ──────────────────────────────────────────────────────────
  //
  // Vertical numbered list with dividers on a subtle-bg section.

  return (
    <Section
      spacing="lg"
      style={{
        background:          resolveSurface(surface) ?? "var(--section-subtle-bg)",
        borderTopColor:    "var(--section-subtle-border)",
        borderBottomColor: "var(--section-subtle-border)",
      }}
      className="border-y"
    >
      <Container size="md">
        <Stack gap={10}>
          {heading && (
            <Text variant="h2" align="center">
              {heading}
            </Text>
          )}

          {items.length > 0 && (
            <ol className="space-y-0">
              {items.map((step, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-5 py-6 ${
                    index < items.length - 1
                      ? "border-b"
                      : ""
                  }`}
                  style={{ borderColor: "var(--section-subtle-border)" }}
                >
                  <StepNumber n={index + 1} />
                  <div className="flex flex-1 flex-col gap-1">
                    <span
                      className="text-base"
                      style={{
                        fontWeight: "var(--font-subheading-weight)",
                        color:      "var(--text)",
                      }}
                    >
                      {step.title}
                    </span>
                    {step.description && (
                      <Text variant="body" color="muted" className="leading-relaxed">
                        {step.description}
                      </Text>
                    )}
                  </div>
                  {step.duration && (
                    <span
                      className="shrink-0 text-sm"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {step.duration}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
