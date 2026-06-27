/**
 * AI Variant Generator — brief → { content, decisionMeta }
 *
 * Turns a short brief into a complete adaptive-block variant PLUS its decision
 * metadata, so the result is instantly aiReady when saved. Output is schema-locked
 * and validated; invalid output is rejected (never written blind). The human
 * review gate is the EditBlockDrawer/Generate page — this module only produces a
 * validated draft. See docs/ai-variant-generator.md.
 */

import "server-only";

import type { AdaptiveVariantContent } from "@/cms/types";
import type {
  VariantDecisionMeta,
  IntentLevel,
  FunnelStage,
  VariantTone,
} from "@/ai/variant-meta";

export type GeneratorSlot = "hero" | "proof" | "cta";

/**
 * Max variants per slot per tenant. The generator warns near it and saving is
 * blocked at it — keeps the candidate set (and the rule surface) from sprawling.
 * Lives here (not in the "use server" actions file, which may only export async
 * functions).
 */
export const MAX_VARIANTS_PER_SLOT = 8;

export interface VariantBrief {
  slot:         GeneratorSlot;
  /** Free-text audience, or filled from a segment / ABM lead profile. */
  audience:     string;
  intentLevel?: IntentLevel;
  funnelStage?: FunnelStage;
  tone?:        VariantTone;
  primaryGoal?: string;
  /** Tenant brand voice / do's & don'ts, injected into the system prompt. */
  brandNote?:   string;
}

export interface GeneratedVariant {
  content:  AdaptiveVariantContent;
  decision: Partial<VariantDecisionMeta>;
}

export type GenerateResult =
  | { ok: true;  variant: GeneratedVariant }
  | { ok: false; error: string };

// ── Prompt ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    "You generate ONE website variant for a B2B personalization platform.",
    "Return ONLY a strict JSON object, no prose, no markdown fences, of the shape:",
    `{`,
    `  "content":  { "title": string, "subtitle": string, "tag"?: string,`,
    `                "ctas"?: [{ "label": string, "href": string, "variant"?: "primary"|"secondary" }] },`,
    `  "decision": { "decisionLabel": string, "decisionSummary": string, "intendedAudience": string,`,
    `                "intentLevel": "awareness"|"consideration"|"decision",`,
    `                "funnelStages": string[], "bestForSources": ("google"|"linkedin"|"direct"|"unknown")[],`,
    `                "tone": "educational"|"inspiring"|"direct"|"persuasive"|"credibility"|"urgency",`,
    `                "primaryGoal": string, "supportingGoals": string[], "exclusions": string[] }`,
    `}`,
    "Keep copy concise and on-brand. Fill ALL decision fields so the variant is AI-ready.",
  ].join("\n");
}

function buildUserPrompt(brief: VariantBrief): string {
  const lines = [
    `Slot: ${brief.slot}`,
    `Audience: ${brief.audience}`,
    brief.intentLevel ? `Intent level: ${brief.intentLevel}` : "",
    brief.funnelStage ? `Funnel stage: ${brief.funnelStage}` : "",
    brief.tone        ? `Tone: ${brief.tone}` : "",
    brief.primaryGoal ? `Primary goal: ${brief.primaryGoal}` : "",
    brief.brandNote   ? `Brand voice / constraints: ${brief.brandNote}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

// ── Validation / coercion ────────────────────────────────────────────────────

const INTENTS: IntentLevel[]  = ["awareness", "consideration", "decision"];
const STAGES:  FunnelStage[]  = ["awareness", "consideration", "decision", "retention"];
const SOURCES                 = ["google", "linkedin", "direct", "unknown"] as const;
const TONES:    VariantTone[] = ["educational", "inspiring", "direct", "persuasive", "credibility", "urgency"];

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function asStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function coerce(raw: unknown): GenerateResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Model returned no object." };
  const r = raw as Record<string, unknown>;
  const c = (r.content  ?? {}) as Record<string, unknown>;
  const d = (r.decision ?? {}) as Record<string, unknown>;

  const title    = asStr(c.title);
  const subtitle = asStr(c.subtitle);
  if (!title || !subtitle) return { ok: false, error: "Generated variant is missing title/subtitle." };

  const ctas = Array.isArray(c.ctas)
    ? (c.ctas as unknown[]).flatMap((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        const label = asStr(o.label); const href = asStr(o.href);
        if (!label || !href) return [];
        const variant = o.variant === "secondary" ? "secondary" : "primary";
        return [{ label, href, variant }];
      })
    : undefined;

  const content: AdaptiveVariantContent = {
    title,
    subtitle,
    ...(asStr(c.tag) ? { tag: asStr(c.tag) } : {}),
    ...(ctas && ctas.length ? { ctas } : {}),
  };

  const decision: Partial<VariantDecisionMeta> = {
    ...(asStr(d.decisionLabel)    ? { decisionLabel:    asStr(d.decisionLabel)! }    : {}),
    ...(asStr(d.decisionSummary)  ? { decisionSummary:  asStr(d.decisionSummary)! }  : {}),
    ...(asStr(d.intendedAudience) ? { intendedAudience: asStr(d.intendedAudience)! } : {}),
    ...(INTENTS.includes(d.intentLevel as IntentLevel) ? { intentLevel: d.intentLevel as IntentLevel } : {}),
    funnelStages:   asStrArray(d.funnelStages).filter((s): s is FunnelStage => STAGES.includes(s as FunnelStage)),
    bestForSources: asStrArray(d.bestForSources).filter((s): s is (typeof SOURCES)[number] => (SOURCES as readonly string[]).includes(s)),
    ...(TONES.includes(d.tone as VariantTone) ? { tone: d.tone as VariantTone } : {}),
    ...(asStr(d.primaryGoal) ? { primaryGoal: asStr(d.primaryGoal)! } : {}),
    supportingGoals: asStrArray(d.supportingGoals),
    exclusions:      asStrArray(d.exclusions),
  };

  return { ok: true, variant: { content, decision } };
}

// ── Generate ─────────────────────────────────────────────────────────────────

/**
 * Calls the Anthropic Messages API to generate + validate one variant.
 * Returns a validated draft or an error — never writes anything.
 */
export async function generateVariant(brief: VariantBrief): Promise<GenerateResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
  const model = process.env.CLAUDE_MODEL ?? "claude-3-5-haiku-20241022";

  let text: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         key,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        system:     buildSystemPrompt(),
        messages:   [{ role: "user", content: buildUserPrompt(brief) }],
      }),
    });
    if (!res.ok) return { ok: false, error: `Model API error ${res.status}.` };
    const json = await res.json() as { content?: Array<{ text?: string }> };
    text = json.content?.[0]?.text ?? "";
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Model call failed." };
  }

  // Strip accidental markdown fences and isolate the JSON object.
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "Model did not return JSON." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { ok: false, error: "Could not parse model JSON." };
  }
  return coerce(parsed);
}
