# AI Variant Generator — "brief → aiReady, personalized variant"

The high-leverage take on Figma's AI-website-generator idea, built *inside* the
platform so the output lands directly in the personalization engine instead of as
throwaway design code. It connects three things that already exist:

- **Adaptive blocks** — the DB-stored variant content (`AdaptiveVariantContent`).
- **AI/Decision metadata** — `VariantDecisionMeta` that makes a variant `aiReady`.
- **ABM** — known leads + audience segments to target a variant.

> Instead of "generate a website in Figma," the operator writes a short brief and
> the platform generates a complete, on-brand **adaptive-block variant** *with* its
> decision metadata — so it's instantly AI-selectable, and can be aimed at a
> segment or an ABM lead.

## What it produces

From a brief, one LLM call returns a structured object that maps 1:1 onto types
the platform already has:

```
{
  content:  AdaptiveVariantContent   // title, subtitle, ctas, layoutVariant, items…
  decision: VariantDecisionMeta      // decisionLabel, decisionSummary, intendedAudience,
                                     // intentLevel, funnelStages, bestForSources, tone,
                                     // primaryGoal, supportingGoals, exclusions
}
```

Because `decision` is filled, `isMetaComplete()` passes → the variant is **aiReady**
the moment it's saved. No second authoring pass.

## The brief

A small form (or a one-line prompt parsed into fields):

- Slot: hero / proof / cta
- Audience: free text, or pick an existing **audience segment**, or an **ABM lead**
  (auto-fills company/role/industry/named greeting)
- Intent level + funnel stage + tone
- Primary goal (e.g. "book a demo")
- Brand voice / constraints (pulled from tenant design tokens + a tenant brand note)

## Flow

```
Brief ──▶ buildVariantPrompt(brief, tenantBrand)
            │  (system prompt pins output to the AdaptiveVariantContent +
            │   VariantDecisionMeta JSON schema; few-shot from existing variants)
            ▼
        AI provider (reuse ai/providers/*) → strict JSON
            │
        validate + coerce (zod-style) → { content, decision }
            │
        Open in EditBlockDrawer  ← human review gate (edit before commit)
            │
        upsertAdaptiveBlock(key = `${slot}_${slug}`, defaultVariant = content+decision)
            ▼
        Instantly a candidate: resolveVariantCandidates → aiReady → AI may select it
            │
        (optional) bind to ABM lead/segment → segment_hint personalizes on landing
```

## Why it fits — concrete reuse

| Piece | Reused as-is |
| --- | --- |
| LLM call | `ai/providers/*` (same infra as the decision AI) |
| Output schema | `AdaptiveVariantContent` + `VariantDecisionMeta` (already typed) |
| Review/edit | `EditBlockDrawer` (already edits both content + AI/Decision) |
| Persist | `upsertAdaptiveBlock` (DB adaptive blocks) |
| Go live for AI | `resolveVariantCandidates` → `filterAiReady` (the B-deel-2 feed) |
| Targeting | audience segments + ABM `segment_hint` / `knownLead` |

Net new code is small: a prompt builder, a strict validator, and a "Generate"
action + button in the adaptive-blocks admin. Everything downstream already works.

## Phased build

1. **Generate one hero variant** from a brief → opens in EditBlockDrawer (review) →
   save. (Content only; decisionMeta optional.)
2. **Generate decisionMeta too** → auto-`aiReady` on save (the real unlock — a brief
   becomes an AI-selectable variant in one step).
3. **ABM / segment tie-in** → "generate a variant for *this* lead/segment" pre-fills
   the brief from the lead profile; on save, bind `segment_hint`.
4. **Full-page generation** → a brief → an ordered set of `page_blocks` (a tenant
   starter during onboarding), each block optionally aiReady.

## Where Figma still helps (and where it doesn't)

- **Helps:** quick *visual* mockups during onboarding (Figma Make), and Dev Mode
  for designing a brand-new block *component* you then port to React.
- **Doesn't:** generating production variants for this platform — Figma emits
  standalone code, not your block schema + decisionMeta. The generator above keeps
  generation native, so it slots straight into personalization and ABM.

## Risks / guardrails

- **Schema-lock the output** (strict JSON + validate; reject/repair on miss) — never
  write unvalidated LLM output into a block.
- **Human review gate** — always open in EditBlockDrawer before commit; never
  auto-publish to live traffic.
- **Brand drift** — feed tenant tokens + a short brand note; keep a per-tenant
  "do/don't" list in the system prompt.
- **Cost** — generation is on-demand (operator action), not per request, so cost is
  bounded.
- **Quality of decisionMeta** — the AI grades its own variant; spot-check that
  `intendedAudience` / `exclusions` are sane before relying on auto-aiReady.
