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
import type { AiGenerateRequest, AiGenerateResult, AiProviderErrorCode } from "@/ai/providers/base-provider";
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
        // `as const` — without it the literal widens to `string` inside the
        // flatMap's inferred return type, and HeroCTAItem.variant is a union.
        const variant = o.variant === "secondary" ? "secondary" as const : "primary" as const;
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

/** The generation capability the generator needs — provider.generate (D1). */
export type GenerateFn = (req: AiGenerateRequest) => Promise<AiGenerateResult>;

/** Turn a provider error code into an operator-facing message. */
function messageForCode(code: AiProviderErrorCode, reason: string): string {
  switch (code) {
    case "DISABLED":        return "AI is uitgeschakeld voor deze tenant — zet AI aan bij Settings om te genereren.";
    case "MISSING_API_KEY": return "Geen AI-API-key geconfigureerd — stel die in bij Platform → Integrations.";
    case "TIMEOUT":         return "Het AI-model reageerde niet op tijd. Probeer het opnieuw.";
    case "PARSE_ERROR":     return "Het AI-model gaf een onleesbaar antwoord. Probeer het opnieuw.";
    case "MODEL_ERROR":
    default:                return `Het AI-model gaf een fout: ${reason}`;
  }
}

/**
 * Generate + validate ONE variant via the injected provider generate fn
 * (`createAiProvider(...).generate`). Pure over its dependency: no env, no fetch —
 * the caller wires the configured AiProvider. Returns a validated draft or an
 * error; never writes anything. Provider failures surface as their error code's
 * message (DISABLED / MISSING_API_KEY / MODEL_ERROR / PARSE_ERROR / TIMEOUT).
 */
export async function generateVariant(
  brief: VariantBrief,
  deps:  { generate: GenerateFn },
): Promise<GenerateResult> {
  const res = await deps.generate({
    system:    buildSystemPrompt(),
    user:      buildUserPrompt(brief),
    maxTokens: 1200,
  });
  if (!res.ok) return { ok: false, error: messageForCode(res.code, res.reason) };

  // Strip accidental markdown fences and isolate the JSON object.
  const cleaned = res.text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "Het AI-model gaf geen JSON terug." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { ok: false, error: "Kon de JSON van het AI-model niet verwerken." };
  }
  return coerce(parsed);
}
