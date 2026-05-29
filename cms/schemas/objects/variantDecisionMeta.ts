/**
 * Sanity Object Schema — variantDecisionMeta
 *
 * Embedded object that describes a slot variant's AI decision metadata.
 * Added to heroVariant, proofVariant, and ctaVariant documents.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   The AI decision engine selects which variant to show each visitor.
 *   To make a deliberate, explainable choice the AI needs structured context
 *   about what each variant communicates, who it is for, and when NOT to use it.
 *
 * ─── AI readiness — derived, not manually set ────────────────────────────────
 *
 *   There is no `aiReady` boolean field in this schema.
 *
 *   AI readiness is DERIVED at runtime by the variant resolver
 *   (ai/resolve-variant-candidates.ts → isMetaComplete()) by checking whether
 *   all eight required fields are populated.  Editors cannot override this flag.
 *
 *   The Studio list preview shows the computed readiness state so editors
 *   can see at a glance which variants are complete without a stored boolean.
 *
 * ─── Required fields (gate AI selection) ─────────────────────────────────────
 *
 *   decisionLabel, decisionSummary, intendedAudience, intentLevel,
 *   funnelStages, bestForSources, tone, primaryGoal
 *
 * ─── Optional fields (richer signal, recommended) ────────────────────────────
 *
 *   whatThisVariantCommunicates, supportingGoals, exclusions
 */

import { defineField, defineType } from "sanity";

// ── Helper: derive readiness from the embedded object itself ──────────────────
//
// Used only in this file's preview.prepare() — mirrors the runtime
// isMetaComplete() check in ai/variant-meta.ts.  Keep in sync with that.

function deriveAiReady(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta) return false;
  const label    = typeof meta["decisionLabel"]    === "string" && meta["decisionLabel"].trim();
  const summary  = typeof meta["decisionSummary"]  === "string" && meta["decisionSummary"].trim();
  const audience = typeof meta["intendedAudience"] === "string" && meta["intendedAudience"].trim();
  const intent   = Boolean(meta["intentLevel"]);
  const funnel   = Array.isArray(meta["funnelStages"])   && (meta["funnelStages"] as unknown[]).length > 0;
  const sources  = Array.isArray(meta["bestForSources"]) && (meta["bestForSources"] as unknown[]).length > 0;
  const tone     = Boolean(meta["tone"]);
  const goal     = typeof meta["primaryGoal"]  === "string" && meta["primaryGoal"].trim();
  return Boolean(label && summary && audience && intent && funnel && sources && tone && goal);
}

export default defineType({
  name:  "variantDecisionMeta",
  title: "AI / Decision Metadata",
  type:  "object",

  fields: [

    // ── Identity & summary ────────────────────────────────────────────────────
    //
    // Fill all eight required fields to make this variant eligible for
    // AI-driven personalisation.  AI readiness is computed automatically —
    // there is no separate "AI-ready" toggle to set.
    defineField({
      name:        "decisionLabel",
      title:       "Decision Label",
      type:        "string",
      description:
        "Short, human-readable label used in AI logs and the admin catalogue. " +
        'Example: "Google — Problem Aware".  Required for AI selection.',
      validation: (Rule) => Rule.required().max(80),
    }),

    defineField({
      name:        "decisionSummary",
      title:       "Decision Summary",
      type:        "text",
      rows:        2,
      description:
        "One-sentence explanation of what this variant communicates and why a visitor " +
        "should see it.  The AI uses this to reason about fit.  Required for AI selection.",
      validation: (Rule) => Rule.required().max(300),
    }),

    defineField({
      name:        "whatThisVariantCommunicates",
      title:       "What this variant communicates",
      type:        "text",
      rows:        3,
      description:
        "Longer editorial description of the visual and emotional message this variant " +
        "delivers — for team reference and documentation.  Optional; not sent to the AI.",
    }),

    // ── Audience & intent ─────────────────────────────────────────────────────
    defineField({
      name:        "intendedAudience",
      title:       "Intended Audience",
      type:        "text",
      rows:        2,
      description:
        "Description of the ideal visitor profile for this variant. " +
        'Example: "Paid or organic search visitors who searched a problem keyword." ' +
        "Required for AI selection.",
      validation: (Rule) => Rule.required().max(300),
    }),

    defineField({
      name:        "intentLevel",
      title:       "Intent Level",
      type:        "string",
      description: "Where the visitor is likely to be in their buying journey.  Required for AI selection.",
      options: {
        list: [
          { title: "Awareness — just discovering",        value: "awareness"     },
          { title: "Consideration — actively evaluating", value: "consideration" },
          { title: "Decision — ready to convert",         value: "decision"      },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name:        "funnelStages",
      title:       "Funnel Stages",
      type:        "array",
      description: "Which funnel stages this variant fits.  Select all that apply.  Required for AI selection.",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Awareness",     value: "awareness"     },
          { title: "Consideration", value: "consideration" },
          { title: "Decision",      value: "decision"      },
          { title: "Retention",     value: "retention"     },
        ],
        layout: "grid",
      },
      validation: (Rule) => Rule.required().min(1),
    }),

    // ── Traffic & tone ────────────────────────────────────────────────────────
    defineField({
      name:        "bestForSources",
      title:       "Best For Sources",
      type:        "array",
      description: "Traffic sources this variant performs best for.  Select all that apply.  Required for AI selection.",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Google (organic or paid)", value: "google"   },
          { title: "LinkedIn",                 value: "linkedin" },
          { title: "Direct / typed URL",       value: "direct"   },
          { title: "Unknown / other",          value: "unknown"  },
        ],
        layout: "grid",
      },
      validation: (Rule) => Rule.required().min(1),
    }),

    defineField({
      name:        "tone",
      title:       "Tone",
      type:        "string",
      description: "The emotional or rhetorical tone of this variant.  Required for AI selection.",
      options: {
        list: [
          { title: "Educational — teaches, explains",         value: "educational" },
          { title: "Inspiring — aspirational, visionary",     value: "inspiring"   },
          { title: "Direct — no-nonsense, action-first",      value: "direct"      },
          { title: "Persuasive — sells the outcome",          value: "persuasive"  },
          { title: "Credibility — proof-driven, trustworthy", value: "credibility" },
          { title: "Urgency — time or scarcity pressure",     value: "urgency"     },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),

    // ── Goals ─────────────────────────────────────────────────────────────────
    defineField({
      name:        "primaryGoal",
      title:       "Primary Goal",
      type:        "text",
      rows:        2,
      description: "The main conversion or engagement goal this variant is optimised for.  Required for AI selection.",
      validation: (Rule) => Rule.required().max(200),
    }),

    defineField({
      name:        "supportingGoals",
      title:       "Supporting Goals",
      type:        "array",
      description: "Secondary goals this variant helps achieve (optional).  Add one per item.",
      of: [{ type: "string" }],
    }),

    // ── Exclusions ────────────────────────────────────────────────────────────
    defineField({
      name:        "exclusions",
      title:       "Exclusions",
      type:        "array",
      description:
        "Conditions under which this variant must NOT be chosen by the AI. " +
        'These are treated as hard exclusions.  Example: "Visitor is already a known customer."',
      of: [{ type: "string" }],
    }),
  ],

  // ── Studio preview ──────────────────────────────────────────────────────────
  //
  // Readiness is DERIVED from the 8 required field values — no stored boolean.
  // Each alias maps to one required field; prepare() checks all 8.
  preview: {
    select: {
      // Display
      label:    "decisionLabel",
      summary:  "decisionSummary",
      // Remaining 6 required fields for completeness check
      audience: "intendedAudience",
      intent:   "intentLevel",
      funnel:   "funnelStages",
      sources:  "bestForSources",
      tone:     "tone",
      goal:     "primaryGoal",
    },
    prepare({ label, summary, audience, intent, funnel, sources, tone, goal }) {
      const ready = Boolean(
        typeof label    === "string" && label.trim() &&
        typeof summary  === "string" && summary.trim() &&
        typeof audience === "string" && audience.trim() &&
        intent &&
        Array.isArray(funnel)   && (funnel   as unknown[]).length > 0 &&
        Array.isArray(sources)  && (sources  as unknown[]).length > 0 &&
        tone &&
        typeof goal === "string" && goal.trim()
      );
      const readyBadge = ready ? "✓ AI-ready" : "✗ Not AI-ready";
      return {
        title:    label   ?? "(No decision label)",
        subtitle: `${readyBadge}  ·  ${summary ?? "(No summary)"}`,
      };
    },
  },
});

