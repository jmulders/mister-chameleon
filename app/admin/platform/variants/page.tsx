/**
 * Variant Catalogue — AI Decision Metadata Reference
 *
 * Shows every variant the AI can select from across all sources:
 *   Platform   — hardcoded in ai/variant-registry.ts; always AI-ready
 *   CMS        — published in Sanity Studio; AI-ready once all required metadata fields are filled
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   fetchAllVariantCandidates()
 *     → resolveVariantCandidates() merges platform registry + all Sanity documents
 *     → SlotCandidates with source, aiReady, decisionMeta per variant
 *
 *   Platform variants:  always aiReady === true, source === "platform"
 *   CMS variants:       aiReady derived from isMetaComplete(); source === "tenant"
 *
 * ─── Editing CMS variants ─────────────────────────────────────────────────────
 *
 *   AI metadata for CMS variants is managed in Sanity Studio.
 *   Each CMS card shows a direct "Open in Sanity Studio" link so editors can
 *   complete the required fields without hunting for the right document.
 *
 * ─── AI-ready gating ─────────────────────────────────────────────────────────
 *
 *   Only aiReady === true variants are forwarded to the AI prompt builder
 *   (via filterAiReady() in ai/resolve-variant-candidates.ts).
 *   Incomplete CMS variants remain usable as manual/rule-based fallbacks.
 */

import type { VariantCandidate, VariantDecisionMeta } from "@/ai/variant-meta";
import { Text }         from "@/components/primitives/Text";
import { Badge }        from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { serverEnv }    from "@/lib/env";
import {
  fetchAllVariantCandidates,
  missingMetaFields,
}                       from "./fetch-all-candidates";
import { resolveContentBudget } from "@/decision/rules/variant-usage";
import { getPlatformContentBudgetSettings } from "@/platform/platform-store";
import { ContentBudgetForm } from "./_components/ContentBudgetForm";
import { saveBudgetAction }  from "./actions";

// ── Source labels & colours ───────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  platform: {
    label: "Platform",
    cls:   "bg-neutral-100 text-neutral-600",
  },
  tenant: {
    label: "CMS",
    cls:   "bg-sky-100 text-sky-700",
  },
};

// ── Slot group type ───────────────────────────────────────────────────────────

type SlotId = "hero" | "proof" | "cta";

type SlotGroup = {
  slotId:      SlotId;
  label:       string;
  description: string;
  candidates:  VariantCandidate[];
};

// ── Field renderers ───────────────────────────────────────────────────────────

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      <div className="text-sm text-neutral-700">{children}</div>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-neutral-400 text-sm">, </span>;
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function DisqualifierList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-neutral-400 text-sm">None</span>;
  return (
    <ul className="mt-0.5 space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-sm text-neutral-600">
          <span className="mt-0.5 shrink-0 text-error-400">✗</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── CMS not-ready state ───────────────────────────────────────────────────────

function CmsMissingFields({
  missing,
  variantKey,
  studioBase,
}: {
  missing:    string[];
  variantKey: string;
  studioBase: string | undefined;
}) {
  return (
    <div className="px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
        AI not ready: complete these fields in Sanity Studio
      </p>
      <ul className="space-y-1 mb-4">
        {missing.map((field) => (
          <li key={field} className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            {field}
          </li>
        ))}
      </ul>
      {studioBase && (
        <a
          href={`${studioBase}/structure/heroVariant;proofVariant;ctaVariant`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06l5.19-5.19H6.75a.75.75 0 0 1 0-1.5h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V7.06l-5.19 5.19a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
          </svg>
          Open in Sanity Studio
        </a>
      )}
      <p className="mt-2 text-xs text-neutral-400">
        This variant is usable as a manual/rule-based fallback while metadata is incomplete.
      </p>
    </div>
  );
}

// ── Intent / tone colour maps ─────────────────────────────────────────────────

const INTENT_COLOUR: Record<string, string> = {
  awareness:     "bg-blue-50 text-blue-700",
  consideration: "bg-amber-50 text-amber-700",
  decision:      "bg-green-50 text-green-700",
};

const TONE_COLOUR: Record<string, string> = {
  educational:  "bg-sky-50 text-sky-700",
  inspiring:    "bg-violet-50 text-violet-700",
  direct:       "bg-neutral-100 text-neutral-700",
  persuasive:   "bg-orange-50 text-orange-700",
  credibility:  "bg-emerald-50 text-emerald-700",
  urgency:      "bg-red-50 text-red-700",
};

// ── Variant card ──────────────────────────────────────────────────────────────

function VariantCard({
  candidate,
  studioBase,
}: {
  candidate:  VariantCandidate;
  studioBase: string | undefined;
}) {
  const source = SOURCE_BADGE[candidate.source] ?? SOURCE_BADGE.tenant;
  const isCms  = candidate.source === "tenant";
  const meta   = candidate.decisionMeta as VariantDecisionMeta | null;
  const missing = isCms && !candidate.aiReady
    ? missingMetaFields(candidate.decisionMeta as Record<string, unknown> | null)
    : [];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* AI readiness */}
            {candidate.aiReady ? (
              <Badge variant="success" size="sm" dot>AI ready</Badge>
            ) : (
              <Badge variant="warning" size="sm">AI not ready</Badge>
            )}

            {/* Intent level */}
            {meta?.intentLevel && (
              <span className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                INTENT_COLOUR[meta.intentLevel] ?? "bg-neutral-100 text-neutral-600",
              ].join(" ")}>
                {meta.intentLevel}
              </span>
            )}

            {/* Tone */}
            {meta?.tone && (
              <span className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                TONE_COLOUR[meta.tone] ?? "bg-neutral-100 text-neutral-600",
              ].join(" ")}>
                {meta.tone}
              </span>
            )}

            {/* Decision label */}
            {meta?.decisionLabel && (
              <span className="text-sm font-semibold text-neutral-800">{meta.decisionLabel}</span>
            )}
          </div>
          <code className="mt-0.5 block text-xs font-mono text-neutral-400">{candidate.key}</code>
        </div>

        {/* Source badge */}
        <span className={[
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          source.cls,
        ].join(" ")}>
          {source.label}
        </span>
      </div>

      {/* Body: metadata or not-ready state */}
      {meta && candidate.aiReady ? (
        <div className="px-4 py-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetaField label="Decision summary">
            {meta.decisionSummary}
          </MetaField>

          {meta.whatThisVariantCommunicates && (
            <MetaField label="What this variant communicates">
              {meta.whatThisVariantCommunicates}
            </MetaField>
          )}

          <MetaField label="Intended audience">
            {meta.intendedAudience}
          </MetaField>

          <MetaField label="Primary conversion goal">
            {meta.primaryGoal}
          </MetaField>

          <MetaField label="Supporting goals">
            {meta.supportingGoals.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5 text-sm text-neutral-600">
                {meta.supportingGoals.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            ) : (
              <span className="text-neutral-400">, </span>
            )}
          </MetaField>

          <MetaField label="Funnel stages">
            <TagList items={meta.funnelStages} />
          </MetaField>

          <MetaField label="Best-performing sources">
            <TagList items={meta.bestForSources} />
          </MetaField>

          <div className="sm:col-span-2">
            <MetaField label="Exclusions: when NOT to use (AI hard exclusions)">
              <DisqualifierList items={meta.exclusions} />
            </MetaField>
          </div>

          {/* CMS variants: Sanity Studio shortcut */}
          {isCms && studioBase && (
            <div className="sm:col-span-2 pt-2 border-t border-neutral-100 flex items-center gap-3">
              <a
                href={`${studioBase}/structure/heroVariant;proofVariant;ctaVariant`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06l5.19-5.19H6.75a.75.75 0 0 1 0-1.5h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V7.06l-5.19 5.19a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
                </svg>
                Edit in Sanity Studio
              </a>
              <span className="text-xs text-neutral-400">
                Changes are live after the Sanity webhook revalidates the cache.
              </span>
            </div>
          )}
        </div>
      ) : isCms ? (
        <CmsMissingFields
          missing={missing}
          variantKey={candidate.key}
          studioBase={studioBase}
        />
      ) : null}
    </div>
  );
}

// ── Slot section ──────────────────────────────────────────────────────────────

function SlotSection({
  group,
  studioBase,
}: {
  group:      SlotGroup;
  studioBase: string | undefined;
}) {
  const platformCount = group.candidates.filter((c) => c.source === "platform").length;
  const cmsCount      = group.candidates.filter((c) => c.source === "tenant").length;
  const readyCount    = group.candidates.filter((c) => c.aiReady).length;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <Text variant="h3">{group.label}</Text>
          <Badge variant="outline" size="sm">
            {group.candidates.length} variant{group.candidates.length !== 1 ? "s" : ""}
          </Badge>
          <span className="text-xs text-neutral-400">
            {platformCount} platform · {cmsCount} CMS · {readyCount} AI-ready
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-500 max-w-2xl">{group.description}</p>
      </div>

      {/* Platform variants first, CMS variants below */}
      {["platform", "tenant"].map((sourceType) => {
        const subset = group.candidates.filter((c) => c.source === sourceType);
        if (subset.length === 0) return null;
        return (
          <div key={sourceType} className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {sourceType === "platform" ? "Platform variants" : "CMS variants"}
            </p>
            {subset.map((candidate) => (
              <VariantCard key={candidate.key} candidate={candidate} studioBase={studioBase} />
            ))}
          </div>
        );
      })}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PlatformVariantsPage() {
  const [candidates, budgetResult] = await Promise.all([
    fetchAllVariantCandidates(),
    getPlatformContentBudgetSettings(),
  ]);

  const budget = resolveContentBudget(
    budgetResult.ok ? (budgetResult.data ?? {}) : {},
  );

  // Build slot groups with merged platform + CMS candidates
  const slotGroups: SlotGroup[] = [
    {
      slotId:      "hero",
      label:       "Hero",
      description: "Adaptive headline section, first impression above the fold. The AI picks the variant that best matches the visitor's inferred intent and source.",
      candidates:  candidates.hero,
    },
    {
      slotId:      "proof",
      label:       "Social proof",
      description: "Evidence section that validates the product. Variant selection depends on the visitor's role, funnel stage, and what kind of proof resonates with them.",
      candidates:  candidates.proof,
    },
    {
      slotId:      "cta",
      label:       "Call to action",
      description: "Primary conversion section. The AI selects the commitment level (resource, trial, meeting) that matches the visitor's readiness to act.",
      candidates:  candidates.cta,
    },
  ];

  const totalVariants  = candidates.hero.length + candidates.proof.length + candidates.cta.length;
  const platformTotal  = [candidates.hero, candidates.proof, candidates.cta]
    .flat().filter((c) => c.source === "platform").length;
  const cmsTotal       = totalVariants - platformTotal;
  const aiReadyTotal   = [candidates.hero, candidates.proof, candidates.cta]
    .flat().filter((c) => c.aiReady).length;

  // Sanity Studio base URL for "Open in Studio" links (optional — only present when CMS configured)
  const studioBase: string | undefined = serverEnv.sanity.studioUrl?.replace(/\/$/, "");

  return (
    <div className="p-8 max-w-4xl">

      {/* Page header */}
      <div className="mb-8">
        <Text variant="h2">Variant AI metadata</Text>
        <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
          Every slot variant the AI can select from, platform and CMS, with the decision
          metadata that drives each choice. Complete the required fields in Sanity Studio
          to make CMS variants AI-eligible.
        </p>
      </div>

      {/* Summary strip */}
      <Card className="mb-8">
        <CardContent>
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">All variants</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{totalVariants}</p>
              <p className="text-xs text-neutral-400">Platform + CMS combined</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Platform</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{platformTotal}</p>
              <p className="text-xs text-neutral-400">Always AI-ready</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">CMS</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{cmsTotal}</p>
              <p className="text-xs text-neutral-400">Editable in Sanity Studio</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">AI-ready</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">{aiReadyTotal}</p>
              <p className="text-xs text-neutral-400">Forwarded to AI prompt</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Slots covered</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900">3</p>
              <p className="text-xs text-neutral-400">Hero · Proof · CTA</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How the AI uses metadata */}
      <Card className="mb-8 border-brand-200 bg-brand-50">
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-2">
            How AI candidate gating works
          </p>
          <p className="text-sm text-brand-800 max-w-2xl">
            At request time the decision engine reads each variant's{" "}
            <strong>intendedAudience</strong>, <strong>funnelStages</strong>, and{" "}
            <strong>bestForSources</strong> to shortlist candidates, then applies{" "}
            <strong>disqualifiers</strong> as hard exclusions before scoring.
            Only <Badge variant="success" size="sm" dot>AI ready</Badge>{" "}
            variants (all 8 required fields complete) are forwarded to the AI.
            Variants with incomplete metadata fall back to rule-based or default selection, 
            they are never silently dropped from personalisation entirely.
          </p>
          {!serverEnv.sanity.projectId && (
            <p className="mt-3 text-sm text-amber-700 font-medium">
              ⚠ Sanity is not configured, only platform variants are shown.
              Connect a Sanity project to see CMS variants.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Content budget settings */}
      <div className="mb-10">
        <ContentBudgetForm initialBudget={budget} saveAction={saveBudgetAction} />
      </div>

      {/* Slot sections */}
      <div className="flex flex-col gap-12">
        {slotGroups.map((group) => (
          <SlotSection key={group.slotId} group={group} studioBase={studioBase} />
        ))}
      </div>
    </div>
  );
}
