/**
 * AI Rule Suggester — brief → ONE validated StoredRule (draft).
 *
 * On demand, proposes a single personalization rule (condition + plan + label +
 * reason) for the operator to adjust and save. "Adviseert, beslist niet": this
 * module only produces a validated DRAFT — it never persists and never
 * auto-publishes. See docs/design/config-intelligence.md (spoor 2) and
 * docs/ai-variant-generator.md for tone/guardrails.
 *
 * The suggestion is constrained two ways so it can only ever be a VALID rule:
 *   1. The prompt carries the tenant's own allow-lists — the valid condition
 *      fields/operators (FIELD_REGISTRY) and the valid variant keys — so the AI
 *      can only choose from real building blocks.
 *   2. Every candidate is assigned a unique id + a non-colliding priority and is
 *      then merged into the existing config and run through validateStoredConfig.
 *      A candidate that fails validation is rejected, never injected —
 *      validateStoredConfig rejects the WHOLE config on a single bad rule /
 *      duplicate priority, so a bad suggestion must never reach the editor.
 *
 * Pure over an injected provider `generate` fn (the shared AiProvider
 * abstraction) — no env, no fetch, no DB — so it is unit-testable.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import type { AiGenerateRequest, AiGenerateResult, AiProviderErrorCode } from "@/ai/providers/base-provider";
import {
  FIELD_REGISTRY,
  ALL_FIELD_KEYS,
  NAMED_CONDITIONS,
  validateStoredConfig,
  SEED_RULES_CONFIG,
  type StoredRule,
  type StoredPlan,
  type RuleCondition,
  type StoredRulesConfig,
  type ExtraAllowedKeys,
} from "@/decision/rules/stored-rule";
import type { RuleFieldKey } from "@/decision/rules/field-registry";

// ── Public types ──────────────────────────────────────────────────────────────

/** Operator's short brief for the rule they want proposed. */
export interface RuleSuggestionBrief {
  /** Free-text audience / segment / intent the rule should target. */
  audience: string;
  /** Optional primary goal (e.g. "push a demo", "reassure drop-offs"). */
  goal?:    string;
  /** Optional brand voice / constraints, injected into the prompt. */
  note?:    string;
}

/** The tenant's full allowed variant keys per slot (platform + CMS). */
export interface RuleSuggestionCatalogue {
  heroKeys:  readonly string[];
  proofKeys: readonly string[];
  ctaKeys:   readonly string[];
}

/** Everything the generator needs to build valid, non-colliding output. */
export interface RuleSuggestionContext {
  catalogue:  RuleSuggestionCatalogue;
  /** Non-platform keys, passed to validateStoredConfig (CMS variants). */
  extraKeys:  ExtraAllowedKeys;
  /** Validated existing config the suggestion is merged into for validation. */
  baseConfig: StoredRulesConfig;
  /** ids already taken in the live editor (avoid on-screen collisions). */
  takenIds?:        readonly string[];
  /** priorities already taken in the live editor (avoid on-screen collisions). */
  takenPriorities?: readonly number[];
}

export type SuggestResult =
  | { ok: true;  rule: StoredRule }
  | { ok: false; error: string };

/** The generation capability — provider.generate (shared with fase 1). */
export type GenerateFn = (req: AiGenerateRequest) => Promise<AiGenerateResult>;

// ── Prompt ────────────────────────────────────────────────────────────────────

/** Compact allow-list of condition fields the AI may reference. */
function buildFieldCatalogue(): string {
  const lines: string[] = [];
  for (const key of ALL_FIELD_KEYS as RuleFieldKey[]) {
    const def = FIELD_REGISTRY[key];
    const values = def.allowedValues ? ` — values: ${def.allowedValues.join(" | ")}` : "";
    lines.push(`  - ${key} (${def.kind}) ops: ${def.operators.join(", ")}${values}`);
  }
  return lines.join("\n");
}

function buildNamedCatalogue(): string {
  return Object.entries(NAMED_CONDITIONS)
    .map(([name, meta]) => `  - ${name}: ${meta.label}`)
    .join("\n");
}

export function buildRuleSystemPrompt(ctx: RuleSuggestionContext): string {
  return [
    "You propose ONE decision rule for a B2B website personalization platform.",
    "A rule maps a visitor CONDITION to a PLAN of content variants. It ADVISES —",
    "a human operator reviews, adjusts, and saves it. Keep it simple and safe:",
    "prefer a single clear condition over a deep nested group.",
    "",
    "Return ONLY a strict JSON object (no prose, no markdown fences) of this shape:",
    "{",
    '  "condition": <Condition>,',
    '  "plan": { "heroKey": string, "proofKey": string, "ctaKey": string },',
    '  "label": string,   // short English label for the operator',
    '  "reason": string   // one English sentence explaining when/why it fires',
    "}",
    "Do NOT include an id or a priority — those are assigned by the system.",
    "",
    "A <Condition> is ONE of:",
    '  { "type": "field", "field": <fieldKey>, "operator": <op>, "value": <value> }',
    '  { "type": "named", "name": <namedConditionId> }',
    '  { "type": "group", "logic": "and"|"or", "conditions": [<Condition>, ...] }',
    "For existence operators (exists / not_exists) omit value; for in / not_in use",
    "an array; for numeric operators use a number.",
    "",
    "Valid condition fields (choose ONLY from these, with an operator listed for it):",
    buildFieldCatalogue(),
    "",
    "Valid named conditions:",
    buildNamedCatalogue(),
    "",
    "Valid heroKey values: " + ctx.catalogue.heroKeys.join(", "),
    "Valid proofKey values: " + ctx.catalogue.proofKeys.join(", "),
    "Valid ctaKey values: " + ctx.catalogue.ctaKeys.join(", "),
    "Pick exactly one key from each list for the plan.",
  ].join("\n");
}

export function buildRuleUserPrompt(brief: RuleSuggestionBrief): string {
  return [
    `Target audience / segment: ${brief.audience}`,
    brief.goal ? `Primary goal: ${brief.goal}` : "",
    brief.note ? `Brand voice / constraints: ${brief.note}` : "",
  ].filter(Boolean).join("\n");
}

// ── Error messages ────────────────────────────────────────────────────────────

/** Turn a provider error code into an operator-facing message. */
function messageForCode(code: AiProviderErrorCode, reason: string): string {
  switch (code) {
    case "DISABLED":        return "AI is uitgeschakeld voor deze tenant — zet AI aan bij Settings om regels te laten voorstellen.";
    case "MISSING_API_KEY": return "Geen AI-API-key geconfigureerd — stel die in bij Platform → Integrations.";
    case "TIMEOUT":         return "Het AI-model reageerde niet op tijd. Probeer het opnieuw.";
    case "PARSE_ERROR":     return "Het AI-model gaf een onleesbaar antwoord. Probeer het opnieuw.";
    case "MODEL_ERROR":
    default:                return `Het AI-model gaf een fout: ${reason}`;
  }
}

// ── Parse + coerce + validate ─────────────────────────────────────────────────

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Extract and JSON-parse the first object from raw model text. */
function extractJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "Het AI-model gaf geen JSON terug." };
  try {
    return { ok: true, value: JSON.parse(cleaned.slice(start, end + 1)) };
  } catch {
    return { ok: false, error: "Kon de JSON van het AI-model niet verwerken." };
  }
}

/** Next non-colliding priority — appended at lowest precedence so it never
 *  shadows an existing rule (the operator can raise it in the editor). */
function allocatePriority(ctx: RuleSuggestionContext): number {
  const used = [
    ...ctx.baseConfig.rules.map((r) => r.priority),
    ...(ctx.takenPriorities ?? []),
  ];
  return Math.max(0, ...used) + 1;
}

/** A unique rule id not present in the base config or the live editor. */
function allocateId(ctx: RuleSuggestionContext, label: string): string {
  const used = new Set<string>([
    ...ctx.baseConfig.rules.map((r) => r.id),
    ...(ctx.takenIds ?? []),
  ]);
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "rule";
  let id = `ai.${slug}_${randomBytes(3).toString("hex")}`;
  while (used.has(id)) id = `ai.${slug}_${randomBytes(3).toString("hex")}`;
  return id;
}

/**
 * Build a StoredRule from the model's raw object, assign a unique id +
 * non-colliding priority, then validate by merging into the existing config.
 * Returns the validated rule, or an error listing what was invalid.
 */
export function coerceAndValidateRule(
  raw: unknown,
  ctx: RuleSuggestionContext,
): SuggestResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Het AI-model gaf geen bruikbaar regel-object terug." };
  }
  const r = raw as Record<string, unknown>;

  const condition = r.condition as RuleCondition | undefined;
  const p = (r.plan ?? {}) as Record<string, unknown>;
  const label  = asStr(r.label);
  const reason = asStr(r.reason);
  const heroKey  = asStr(p.heroKey);
  const proofKey = asStr(p.proofKey);
  const ctaKey   = asStr(p.ctaKey);

  if (!condition || typeof condition !== "object") {
    return { ok: false, error: "De voorgestelde regel mist een geldige conditie." };
  }
  if (!heroKey || !proofKey || !ctaKey) {
    return { ok: false, error: "De voorgestelde regel mist een volledige plan (hero/proof/cta)." };
  }
  if (!label || !reason) {
    return { ok: false, error: "De voorgestelde regel mist een label of reden." };
  }

  // Only accept the core plan keys; the operator adds extended slots in the editor.
  const plan: StoredPlan = { heroKey, proofKey, ctaKey } as StoredPlan;

  const rule: StoredRule = {
    id:        allocateId(ctx, label),
    priority:  allocatePriority(ctx),
    label,
    condition,
    plan,
    reason,
    enabled:   true,
    source:    "tenant", // an operator-initiated suggestion; never trampled by merges
  };

  // Validate by merging into the existing (validated) config — the same check
  // the save path runs. Because the base config is already valid and the id /
  // priority are freshly allocated, any error here belongs to the new rule.
  const merged: StoredRulesConfig = {
    ...ctx.baseConfig,
    rules: [...ctx.baseConfig.rules, rule],
  };
  const errors = validateStoredConfig(merged, ctx.extraKeys).filter((e) => e.ruleId === rule.id);

  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    return { ok: false, error: `De AI stelde een ongeldige regel voor en die is niet toegevoegd. (${detail})` };
  }

  return { ok: true, rule };
}

// ── Generate ──────────────────────────────────────────────────────────────────

/**
 * Propose + validate ONE rule via the injected provider generate fn. Optionally
 * retries once, feeding the validation error back into the prompt. Returns a
 * validated draft rule or a clean message; never persists anything.
 */
export async function suggestRule(
  brief: RuleSuggestionBrief,
  ctx:   RuleSuggestionContext,
  deps:  { generate: GenerateFn; retryOnInvalid?: boolean },
): Promise<SuggestResult> {
  const system = buildRuleSystemPrompt(ctx);
  const user   = buildRuleUserPrompt(brief);

  const first = await runOnce(system, user, ctx, deps.generate);
  if (first.ok || !deps.retryOnInvalid || !first.retryable) {
    return first.result;
  }

  // One corrective retry — hand the validation error back to the model.
  const retryUser = `${user}\n\nYour previous suggestion was rejected: ${first.error}\nReturn a corrected JSON object that fixes this.`;
  const second = await runOnce(system, retryUser, ctx, deps.generate);
  return second.result;
}

/** One generate → parse → validate attempt. `retryable` marks a validation
 *  failure (worth a corrective retry) vs a provider/parse failure. */
async function runOnce(
  system:   string,
  user:     string,
  ctx:      RuleSuggestionContext,
  generate: GenerateFn,
): Promise<{ ok: boolean; retryable: boolean; error: string; result: SuggestResult }> {
  const res = await generate({ system, user, maxTokens: 900 });
  if (!res.ok) {
    const error = messageForCode(res.code, res.reason);
    return { ok: false, retryable: false, error, result: { ok: false, error } };
  }

  const parsed = extractJson(res.text);
  if (!parsed.ok) {
    return { ok: false, retryable: false, error: parsed.error, result: { ok: false, error: parsed.error } };
  }

  const coerced = coerceAndValidateRule(parsed.value, ctx);
  if (!coerced.ok) {
    return { ok: false, retryable: true, error: coerced.error, result: coerced };
  }
  return { ok: true, retryable: false, error: "", result: coerced };
}

// ── Base-config helper ────────────────────────────────────────────────────────

/**
 * A guaranteed-valid base config to merge suggestions into. Prefer the tenant's
 * loaded config; fall back to the seed when it is absent or itself invalid, so
 * any merged validation error can only come from the new rule.
 */
export function safeBaseConfig(
  loaded:    StoredRulesConfig | null,
  extraKeys: ExtraAllowedKeys,
): StoredRulesConfig {
  if (loaded && validateStoredConfig(loaded, extraKeys).length === 0) return loaded;
  return SEED_RULES_CONFIG;
}
