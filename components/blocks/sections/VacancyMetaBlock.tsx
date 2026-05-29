/**
 * VacancyMetaBlock
 *
 * Renders a `vacancyMeta` content block — the structured metadata summary for
 * a job vacancy detail page.  Surfaces the key decision factors a candidate
 * needs at a glance: location, contract type, hours, salary, and deadline.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      VacancyMetaBlockData  { title?, department?, location?, remote?,
 *                                     contractType?, hoursPerWeek?, salaryRange?,
 *                                     startDate?, closingDate?, level? }
 *   variant   VacancyMetaVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default   — Full metadata card with labeled rows.  Each set field renders
 *               as a label + value row inside a bordered card.  Best placed
 *               before or after the vacancy description.
 *
 *   compact   — Inline horizontal badge strip.  Good for below the vacancy
 *               title inside an article header.  Only shows high-signal fields
 *               (location, contract type, level).
 *
 *   sidebar   — Same as default.  Reserved for a future sidebar layout where
 *               VacancyMeta floats alongside the article body.
 *
 * ─── Architecture note ───────────────────────────────────────────────────────
 *
 *   Vacancy detail pages use the same article-page template as blog detail:
 *     [vacancyMeta (default), articleBody (job description), applyPanel, relatedContent?]
 *
 *   No new templates needed — the block composition differs, not the template.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --card-bg / --card-border / --card-radius / --card-shadow
 *   --text / --text-muted
 *   --primary / --primary-subtle
 *   --bg-subtle
 */

import { Container }                    from "@/components/primitives/Container";
import { Section }                      from "@/components/primitives/Section";
import { Breadcrumbs, MetaItem, MetaList } from "@/components/molecules";
import { resolveBlockVariant }          from "@/page-config/block-variants";
import type { VacancyMetaVariant }      from "@/page-config/block-variants";
import type { VacancyMetaBlockData }    from "@/page-config";

// ── Props ─────────────────────────────────────────────────────────────────────

interface VacancyMetaBlockProps {
  data:     VacancyMetaBlockData;
  variant?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const REMOTE_LABELS: Record<NonNullable<VacancyMetaBlockData["remote"]>, string> = {
  "on-site": "On-site",
  "hybrid":  "Hybrid",
  "remote":  "Remote",
};

const CONTRACT_LABELS: Record<NonNullable<VacancyMetaBlockData["contractType"]>, string> = {
  "full-time":  "Full-time",
  "part-time":  "Part-time",
  "contract":   "Contract",
  "internship": "Internship",
  "freelance":  "Freelance",
};

/** Format an ISO deadline as "closes Apr 30, 2025" or days remaining. */
function formatDeadline(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const deadline = new Date(y, m - 1, d);
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);

    if (daysLeft < 0)  return "Closed";
    if (daysLeft === 0) return "Closes today";
    if (daysLeft <= 7)  return `Closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

    return `Closes ${new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(deadline)}`;
  } catch {
    return iso;
  }
}

function isCloseDeadline(iso: string): boolean {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return false;
    const deadline = new Date(y, m - 1, d);
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
    return daysLeft >= 0 && daysLeft <= 14;
  } catch {
    return false;
  }
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function MetaBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display:         "inline-block",
        fontSize:        "0.8125rem",
        fontWeight:      500,
        color:           "var(--text-muted)",
        backgroundColor: "var(--bg-subtle)",
        border:          "1px solid var(--card-border)",
        borderRadius:    "2rem",
        padding:         "0.25rem 0.75rem",
      }}
    >
      {label}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VacancyMetaBlock({ data, variant: rawVariant }: VacancyMetaBlockProps) {
  const variant = resolveBlockVariant("vacancyMeta", rawVariant) as VacancyMetaVariant;

  const {
    title, department, location, remote, contractType,
    hoursPerWeek, salaryRange, startDate, closingDate, level,
  } = data;

  // ── compact — inline badge strip ──────────────────────────────────────────
  if (variant === "compact") {
    const badges: string[] = [];
    if (level)        badges.push(level);
    if (location)     badges.push(location);
    if (remote && remote !== "on-site") badges.push(REMOTE_LABELS[remote]);
    if (contractType) badges.push(CONTRACT_LABELS[contractType]);
    if (hoursPerWeek) badges.push(hoursPerWeek);

    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.75rem 0" }}>
        {department && (
          <span
            style={{
              fontSize:        "0.75rem",
              fontWeight:      600,
              color:           "var(--text-muted)",
              backgroundColor: "var(--bg-subtle)",
              borderRadius:    "2rem",
              padding:         "0.1875rem 0.625rem",
            }}
          >
            {department}
          </span>
        )}
        {badges.filter(Boolean).map((b) => <MetaBadge key={b} label={b} />)}
        {closingDate && (
          <span
            style={{
              fontSize:   "0.8125rem",
              fontWeight: isCloseDeadline(closingDate) ? 600 : 400,
              color:      isCloseDeadline(closingDate) ? "var(--color-error-500, #ef4444)" : "var(--text-muted)",
            }}
          >
            {formatDeadline(closingDate)}
          </span>
        )}
      </div>
    );
  }

  // ── default / sidebar — full metadata card ────────────────────────────────

  return (
    <Section spacing="sm" style={{ background: "var(--bg)" }}>
      <Container size="md">
        {data.breadcrumbs && data.breadcrumbs.length > 0 && (
          <div style={{ marginBottom: "0.75rem" }}>
            <Breadcrumbs items={data.breadcrumbs} />
          </div>
        )}
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border:          "1px solid var(--card-border)",
            borderRadius:    "var(--card-radius)",
            overflow:        "hidden",
          }}
        >
          {/* Card header */}
          {(title || department) && (
            <div
              style={{
                padding:       "1.25rem 1.5rem",
                borderBottom:  "1px solid var(--card-border)",
                background:    "var(--bg-subtle)",
              }}
            >
              {title && (
                <h2
                  style={{
                    margin:     0,
                    fontSize:   "1.125rem",
                    fontWeight: 600,
                    color:      "var(--text)",
                    lineHeight: 1.3,
                  }}
                >
                  {title}
                </h2>
              )}
              {department && (
                <span
                  style={{
                    display:         "inline-block",
                    marginTop:       title ? "0.375rem" : 0,
                    fontSize:        "0.75rem",
                    fontWeight:      600,
                    color:           "var(--text-muted)",
                    backgroundColor: "var(--bg-subtle)",
                    borderRadius:    "2rem",
                    padding:         "0.1875rem 0.625rem",
                  }}
                >
                  {department}
                </span>
              )}
            </div>
          )}

          {/* Metadata rows */}
          <MetaList>
            {location && (
              <MetaItem
                label="Location"
                value={remote && remote !== "on-site"
                  ? `${location} · ${REMOTE_LABELS[remote]}`
                  : location}
              />
            )}
            {!location && remote && (
              <MetaItem label="Work style" value={REMOTE_LABELS[remote]} />
            )}
            {contractType && (
              <MetaItem label="Contract" value={CONTRACT_LABELS[contractType]} />
            )}
            {hoursPerWeek && (
              <MetaItem label="Hours" value={hoursPerWeek} />
            )}
            {level && (
              <MetaItem label="Level" value={level} />
            )}
            {salaryRange && (
              <MetaItem label="Salary" value={salaryRange} />
            )}
            {startDate && (
              <MetaItem label="Start date" value={startDate} />
            )}
            {closingDate && (
              <MetaItem
                label="Deadline"
                value={formatDeadline(closingDate)}
                urgent={isCloseDeadline(closingDate)}
              />
            )}
          </MetaList>

          {/* Empty state */}
          {!location && !remote && !contractType && !hoursPerWeek && !level && !salaryRange && !startDate && !closingDate && (
            <div style={{ padding: "1.5rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No details available.
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
