"use client";

/**
 * RecipeGallery
 *
 * The template-first "Add rule" entry point. Opens as a modal over the rules
 * editor: a non-technical operator picks a goal in plain language, chooses only
 * the outcome (variant plan, scoped to the tenant catalogue), and the recipe's
 * valid-by-construction condition rides along hidden.
 *
 * Two exits:
 *   • Pick a recipe  → fill-in step → onCreate() adds a ready rule.
 *   • "Build from scratch (advanced)" → onAdvanced() opens the full builder,
 *     unchanged, for cases no recipe covers.
 *
 * All rule shaping is delegated to the pure data layer:
 *   recipe-catalogue.ts  (recipes + variant scoping)
 *   allocate-priority.ts (unique priority + duplicate detection)
 * so what this component adds always passes validateStoredConfig.
 */

import { useEffect, useMemo, useState } from "react";
import {
  RULE_RECIPES, recipesByGroup, RECIPE_GROUPS, scopeRecipePlan,
} from "@/decision/rules/recipe-catalogue";
import type { RuleRecipe } from "@/decision/rules/recipe-catalogue";
import { allocateUniquePriority, findDuplicateByCondition } from "@/decision/rules/allocate-priority";
import { PRECEDENCE_TIERS } from "@/decision/rules/rule-packs";
import type { PrecedenceLevel } from "@/decision/rules/rule-packs";
import { formatCondition } from "@/decision/rules/stored-rule";
import type { RuleCondition, StoredPlan } from "@/decision/rules/stored-rule";
import type { VariantCatalogue, VariantEntry } from "@/decision/rules/variant-catalogue";

// ── Tier chip styling (mirrors PRECEDENCE_TIERS colours) ────────────────────────

const TIER_CHIP: Record<PrecedenceLevel, string> = {
  hard_state:          "text-red-700 bg-red-50 border-red-200",
  high_intent:         "text-orange-700 bg-orange-50 border-orange-200",
  medium_segmentation: "text-blue-700 bg-blue-50 border-blue-200",
  decorative:          "text-neutral-600 bg-neutral-100 border-neutral-200",
};

// ── The rule this gallery hands back to the editor ──────────────────────────────

export interface RecipeRuleDraft {
  recipe:   RuleRecipe;
  plan:     StoredPlan;
  priority: number;
}

/** The minimum shape the gallery reads from existing rules (dup + priority). */
export interface ExistingRuleLite {
  priority:  number;
  condition: RuleCondition;
  label?:    string;
  enabled?:  boolean;
}

interface RecipeGalleryProps {
  open:          boolean;
  catalogue:     VariantCatalogue;
  existingRules: ExistingRuleLite[];
  onClose:       () => void;
  onAdvanced:    () => void;
  onCreate:      (draft: RecipeRuleDraft) => void;
}

export function RecipeGallery({
  open, catalogue, existingRules, onClose, onAdvanced, onCreate,
}: RecipeGalleryProps) {
  const [selected, setSelected] = useState<RuleRecipe | null>(null);
  const [heroKey,  setHeroKey]  = useState("");
  const [proofKey, setProofKey] = useState("");
  const [ctaKey,   setCtaKey]   = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  // Reset to the gallery view every time the modal is (re)opened.
  useEffect(() => {
    if (open) { setSelected(null); setMoreOpen(false); }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Which recipes already exist (by condition) — drives the "Already added" chip.
  const duplicateKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of RULE_RECIPES) {
      if (findDuplicateByCondition(existingRules, r.condition)) set.add(r.key);
    }
    return set;
  }, [existingRules]);

  function pick(recipe: RuleRecipe) {
    const scoped = scopeRecipePlan(recipe.defaultPlan, catalogue);
    setHeroKey(scoped.plan.heroKey);
    setProofKey(scoped.plan.proofKey);
    setCtaKey(scoped.plan.ctaKey);
    setMoreOpen(false);
    setSelected(recipe);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Add a rule"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-neutral-800">
              {selected ? "Set the outcome" : "Add a rule"}
            </div>
            <div className="text-xs text-neutral-500">
              {selected
                ? "Step 2 of 2. The condition is already set by the recipe."
                : "Pick a goal in plain language. The matching condition is built for you."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </button>
        </div>

        {selected
          ? <FillIn
              recipe={selected}
              catalogue={catalogue}
              existingRules={existingRules}
              heroKey={heroKey} proofKey={proofKey} ctaKey={ctaKey}
              setHeroKey={setHeroKey} setProofKey={setProofKey} setCtaKey={setCtaKey}
              moreOpen={moreOpen} setMoreOpen={setMoreOpen}
              onBack={() => setSelected(null)}
              onCancel={onClose}
              onConfirm={(draft) => { onCreate(draft); onClose(); }}
            />
          : <Gallery
              duplicateKeys={duplicateKeys}
              onPick={pick}
              onAdvanced={() => { onAdvanced(); onClose(); }}
            />}
      </div>
    </div>
  );
}

// ── Gallery view ────────────────────────────────────────────────────────────────

function Gallery({
  duplicateKeys, onPick, onAdvanced,
}: {
  duplicateKeys: Set<string>;
  onPick:        (r: RuleRecipe) => void;
  onAdvanced:    () => void;
}) {
  const sections = recipesByGroup();
  return (
    <div className="px-5 py-4">
      {sections.map(({ group, recipes }) => (
        <section key={group} className="mb-5 last:mb-1">
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-700">
              {RECIPE_GROUPS[group].label}
            </h3>
            <span className="text-xs text-neutral-400">{RECIPE_GROUPS[group].blurb}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recipes.map((r) => (
              <RecipeCard key={r.key} recipe={r} duplicate={duplicateKeys.has(r.key)} onClick={() => onPick(r)} />
            ))}
          </div>
        </section>
      ))}

      <div className="mt-4 border-t border-dashed border-neutral-300 pt-4">
        <button
          type="button"
          onClick={onAdvanced}
          className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition-colors hover:border-neutral-300"
        >
          <span aria-hidden className="text-base">🛠️</span>
          <span>
            <span className="block text-sm font-semibold text-neutral-800">Build from scratch (advanced)</span>
            <span className="block text-xs text-neutral-500">Full condition builder, for cases no recipe covers.</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function RecipeCard({
  recipe, duplicate, onClick,
}: {
  recipe: RuleRecipe; duplicate: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition-all hover:border-brand-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span aria-hidden className="shrink-0 text-xl leading-tight">{recipe.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-neutral-800">{recipe.title}</span>
        <span className="mt-0.5 block text-xs text-neutral-600">{recipe.description}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <TierChip tier={recipe.tier} />
          {duplicate && (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              Already added
            </span>
          )}
        </span>
        {recipe.proxyNote && (
          <span className="mt-1.5 flex gap-1 text-[11px] italic text-neutral-400">
            <span aria-hidden>ⓘ</span>{recipe.proxyNote}
          </span>
        )}
      </span>
    </button>
  );
}

function TierChip({ tier }: { tier: PrecedenceLevel }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_CHIP[tier]}`}>
      {PRECEDENCE_TIERS[tier].label}
    </span>
  );
}

// ── Fill-in view ────────────────────────────────────────────────────────────────

function FillIn({
  recipe, catalogue, existingRules,
  heroKey, proofKey, ctaKey, setHeroKey, setProofKey, setCtaKey,
  moreOpen, setMoreOpen, onBack, onCancel, onConfirm,
}: {
  recipe:        RuleRecipe;
  catalogue:     VariantCatalogue;
  existingRules: ExistingRuleLite[];
  heroKey: string; proofKey: string; ctaKey: string;
  setHeroKey: (v: string) => void; setProofKey: (v: string) => void; setCtaKey: (v: string) => void;
  moreOpen: boolean; setMoreOpen: (v: boolean) => void;
  onBack:    () => void;
  onCancel:  () => void;
  onConfirm: (draft: RecipeRuleDraft) => void;
}) {
  const duplicate = useMemo(
    () => findDuplicateByCondition(existingRules, recipe.condition),
    [existingRules, recipe.condition],
  );
  const priority = useMemo(
    () => allocateUniquePriority(existingRules, recipe.tier),
    [existingRules, recipe.tier],
  );

  const heroLabel = labelFor(catalogue.hero, heroKey);
  const heroFallback = !catalogue.hero.some((e) => e.key === recipe.defaultPlan.heroKey);
  const tier = PRECEDENCE_TIERS[recipe.tier];

  function confirm() {
    const plan: StoredPlan = { ...recipe.defaultPlan, heroKey, proofKey, ctaKey } as StoredPlan;
    onConfirm({ recipe, plan, priority });
  }

  return (
    <div className="px-5 py-4">
      <button type="button" onClick={onBack} className="mb-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
        ← All recipes
      </button>

      <div className="flex items-start gap-3">
        <span aria-hidden className="text-3xl leading-none">{recipe.icon}</span>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{recipe.title}</h2>
          <p className="mt-0.5 text-sm text-neutral-600">{recipe.description}</p>
        </div>
      </div>

      {/* Condition (read-only) */}
      <div className="mt-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-700">
          Condition <span className="font-normal normal-case tracking-normal text-neutral-400">, set by this recipe</span>
        </label>
        <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3">
          <span aria-hidden className="mt-0.5 text-neutral-400">🔒</span>
          <div>
            <div className="text-sm text-neutral-800">When {formatCondition(recipe.condition)}.</div>
            <div className="mt-1 text-xs text-neutral-500">
              {recipe.proxyNote
                ? <span className="italic">ⓘ {recipe.proxyNote}</span>
                : <>Fine-tune later with <b className="font-semibold">Edit as advanced</b> on the saved rule.</>}
            </div>
          </div>
        </div>
      </div>

      {/* Hero (primary outcome) */}
      <div className="mt-5">
        <label htmlFor="recipe-hero" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-700">
          Hero variant <span className="font-normal normal-case tracking-normal text-neutral-400">, what the visitor sees</span>
        </label>
        <SlotSelect id="recipe-hero" entries={catalogue.hero} value={heroKey} onChange={setHeroKey} />
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-neutral-400">
          {heroFallback ? (
            <span className="text-amber-600">
              ⚠ The recipe default is not published for this tenant, so it defaulted to “{heroLabel}”. Pick any valid one.
            </span>
          ) : (
            <span>ⓘ Only variants that exist for this tenant are listed.</span>
          )}
        </p>
      </div>

      {/* More options */}
      <details className="mt-4 overflow-hidden rounded-lg border border-neutral-200" open={moreOpen}>
        <summary
          onClick={(e) => { e.preventDefault(); setMoreOpen(!moreOpen); }}
          className="flex cursor-pointer items-center gap-2 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-600"
        >
          <span aria-hidden className={`transition-transform ${moreOpen ? "rotate-90" : ""}`}>▶</span>
          More options (proof and CTA), pre-filled from the recipe
        </summary>
        <div className="grid grid-cols-1 gap-3.5 border-t border-neutral-200 px-3.5 py-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="recipe-proof" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Proof section</label>
            <SlotSelect id="recipe-proof" entries={catalogue.proof} value={proofKey} onChange={setProofKey} />
          </div>
          <div>
            <label htmlFor="recipe-cta" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">Call to action</label>
            <SlotSelect id="recipe-cta" entries={catalogue.cta} value={ctaKey} onChange={setCtaKey} />
          </div>
        </div>
      </details>

      {/* Preview */}
      <div className="mt-5 rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-3">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">Rule preview</div>
        <div className="text-sm text-neutral-800">
          <b className="text-brand-700">When</b> {formatCondition(recipe.condition)} <b className="text-brand-700">→ show</b> the “{heroLabel}” hero.
        </div>
      </div>

      {/* Priority / duplicate */}
      {duplicate ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-700">
          <span aria-hidden>⚠</span>
          <div>
            This recipe is already running{typeof duplicate.priority === "number" ? <> (priority <b className="font-mono">{duplicate.priority}</b>)</> : null}. Adding it again would duplicate the rule.
            {" "}Edit the existing rule instead, or add a segment to make this variant distinct.
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3.5 py-3 text-xs text-neutral-600">
          <span aria-hidden className="text-blue-600">✓</span>
          <div>
            Priority auto-assigned: <b className="font-mono tabular-nums">{priority}</b>, the first free slot in the{" "}
            <b>{tier.label}</b> tier ({tier.range[0]} to {tier.range[1]}). Guaranteed unique, so the config stays valid.
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!!duplicate}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {duplicate ? "Already added" : "Add rule"}
        </button>
      </div>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────────

function SlotSelect({
  id, entries, value, onChange,
}: {
  id: string; entries: VariantEntry[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {entries.map((e) => (
        <option key={e.key} value={e.key}>{e.label}</option>
      ))}
    </select>
  );
}

function labelFor(entries: VariantEntry[], key: string): string {
  return entries.find((e) => e.key === key)?.label ?? key;
}
