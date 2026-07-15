/**
 * AI Providers — Claude Adapter (Anthropic Messages API)
 *
 * The first real model adapter. Replaces MockAiProvider for `name: "claude"`
 * in createAiProvider(). Everything around it already existed — the prompt
 * builder, the confidence policy, shadow mode, ai_decision_logs, the credit
 * ledger. This is the piece that actually asks a model.
 *
 * ─── Contract ─────────────────────────────────────────────────────────────────
 *
 *   Implements AiProvider (see base-provider.ts). The two rules that matter:
 *
 *     1. NEVER throws. Network failures, timeouts, malformed JSON and
 *        hallucinated variant keys all come back as a typed AiProviderFailure so
 *        the caller falls back to the rules engine.
 *     2. Stateless. suggest() is safe to call concurrently.
 *
 * ─── Why the key is read from the environment ────────────────────────────────
 *
 *   AiProviderConfig deliberately carries `hasApiKey: boolean` and never the key
 *   value, so a tenant's secret cannot leak into a client bundle or a log line.
 *   The consequence: a tenant that configures its OWN Anthropic key in the admin
 *   sets hasApiKey → true, but that key never reaches this adapter — we use the
 *   platform key from ANTHROPIC_API_KEY instead. For a single-platform key that
 *   is correct. Per-tenant keys need a server-side lookup here; see the note in
 *   ai/config.ts resolveTenantProvider().
 *
 * ─── Cost ─────────────────────────────────────────────────────────────────────
 *
 *   Every suggest() is a billable model call. The pipeline gates this behind the
 *   tenant's AI mode and the wallet's Brainpower budget — this adapter does not
 *   re-check either. Do not call it outside that path.
 */

import type { DecisionInput, ExperiencePlan, HeroVariantKey, ProofVariantKey, CTAVariantKey } from "@/decision/types";
import type { ThemePresetKey } from "@/design-system/theme/presets";
import { buildHomepagePrompt } from "@/ai/prompt-builder";
import { filterAiReady, platformOnlyCandidates } from "@/ai/resolve-variant-candidates";
import { ALLOWED_THEME_KEYS } from "@/ai/theme-meta";
import type { AiProvider, AiProviderResult } from "./base-provider";

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER_NAME = "ai:claude" as const;

/** Anthropic Messages API endpoint. */
const API_URL = "https://api.anthropic.com/v1/messages";

/** Required by the Messages API — pinned, not "latest", so behaviour is stable. */
const ANTHROPIC_VERSION = "2023-06-01" as const;

/**
 * Output cap. The response is a single small JSON object (three keys, a reason
 * sentence and a float), so 1024 is generous. Keeping it low bounds both cost
 * and worst-case latency.
 */
const MAX_TOKENS = 1024;

// ── Options ───────────────────────────────────────────────────────────────────

export interface ClaudeAdapterOptions {
  /** Model id, e.g. "claude-3-5-haiku-20241022". Comes from AiProviderConfig. */
  modelId: string;
  /** Wall-clock budget for the API call. Exceeding it yields code TIMEOUT. */
  timeoutMs: number;
  /** The Anthropic API key. Server-only — never pass this to a client component. */
  apiKey: string;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class ClaudeAdapter implements AiProvider {
  readonly providerName = PROVIDER_NAME;
  readonly modelId: string;

  private readonly timeoutMs: number;
  private readonly apiKey: string;

  constructor(opts: ClaudeAdapterOptions) {
    this.modelId   = opts.modelId;
    this.timeoutMs = opts.timeoutMs;
    this.apiKey    = opts.apiKey;
  }

  async suggest(input: DecisionInput): Promise<AiProviderResult> {
    // Guard: the factory should never construct us without a key, but a missing
    // key must not surface as a network error two layers down.
    if (!this.apiKey) {
      return {
        ok:     false,
        code:   "MISSING_API_KEY",
        reason: "ANTHROPIC_API_KEY is not set — cannot call the Anthropic API.",
      };
    }

    const { systemPrompt, userPrompt } = buildHomepagePrompt(input);

    // The allowed vocabulary for THIS tenant. The prompt enumerates these, but a
    // model can still return something outside them — we verify rather than trust.
    const candidates = input.variantCandidates ?? platformOnlyCandidates();
    const heroReady  = filterAiReady(candidates.hero).map((c) => c.key);
    const proofReady = filterAiReady(candidates.proof).map((c) => c.key);
    const ctaReady   = filterAiReady(candidates.cta).map((c) => c.key);

    // ── Call the model ────────────────────────────────────────────────────────

    const startedAt  = Date.now();
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type":      "application/json",
          "x-api-key":         this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model:      this.modelId,
          max_tokens: MAX_TOKENS,
          system:     systemPrompt,
          // Temperature 0: this is a classification task against a fixed
          // vocabulary, not a creative one. Same context should yield the same
          // plan, otherwise shadow-vs-live comparisons are meaningless.
          temperature: 0,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
        cache:  "no-store",
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      return isAbort
        ? {
            ok:     false,
            code:   "TIMEOUT",
            reason: `Anthropic API did not respond within ${this.timeoutMs}ms.`,
          }
        : {
            ok:     false,
            code:   "MODEL_ERROR",
            reason: `Network error calling the Anthropic API: ${err instanceof Error ? err.message : String(err)}`,
          };
    } finally {
      clearTimeout(timer);
    }

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      // Body may carry Anthropic's error detail; truncate so a huge payload
      // cannot bloat a log line.
      const body = await response.text().catch(() => "");
      return {
        ok:     false,
        code:   "MODEL_ERROR",
        reason: `Anthropic API returned HTTP ${response.status} ${response.statusText}` +
                (body ? ` — ${body.slice(0, 300)}` : ""),
      };
    }

    // ── Extract the text ──────────────────────────────────────────────────────

    let text: string;
    try {
      const json = (await response.json()) as AnthropicMessagesResponse;
      text = (json.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      if (!text) {
        return {
          ok:     false,
          code:   "PARSE_ERROR",
          reason: `Anthropic response contained no text block (stop_reason: ${json.stop_reason ?? "unknown"}).`,
        };
      }
    } catch (err) {
      return {
        ok:     false,
        code:   "PARSE_ERROR",
        reason: `Could not read the Anthropic response body: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // ── Parse the JSON plan ───────────────────────────────────────────────────

    const parsed = parseModelJson(text);
    if (parsed === null) {
      return {
        ok:     false,
        code:   "PARSE_ERROR",
        reason: `Model did not return parseable JSON. First 300 chars: ${text.slice(0, 300)}`,
      };
    }

    // ── Validate the keys against the allowed vocabulary ──────────────────────
    //
    // A key outside the aiReady pool means the model invented a variant that
    // this tenant does not have. Serving it would render nothing, so this is a
    // hard failure — but we attach partialOutput so the dashboard can show what
    // the model actually said.

    const invalid: string[] = [];
    if (!heroReady.includes(parsed.heroKey))   invalid.push(`heroKey="${parsed.heroKey}"`);
    if (!proofReady.includes(parsed.proofKey)) invalid.push(`proofKey="${parsed.proofKey}"`);
    if (!ctaReady.includes(parsed.ctaKey))     invalid.push(`ctaKey="${parsed.ctaKey}"`);

    if (invalid.length > 0) {
      return {
        ok:     false,
        code:   "INVALID_KEYS",
        reason: `Model returned ${invalid.length} key(s) outside the allowed vocabulary: ${invalid.join(", ")}.`,
        partialOutput: {
          confidence: clampConfidence(parsed.confidence),
          modelId:    this.modelId,
          latencyMs,
          rawReasoning: text,
        },
      };
    }

    // themeKey is optional and explicitly "silently ignored when invalid" per the
    // prompt contract — so an unknown theme must not fail the whole decision.
    const themeKey =
      parsed.themeKey !== undefined && (ALLOWED_THEME_KEYS as readonly string[]).includes(parsed.themeKey)
        ? (parsed.themeKey as ThemePresetKey)
        : undefined;

    const plan: ExperiencePlan = {
      heroKey:  parsed.heroKey  as HeroVariantKey,
      proofKey: parsed.proofKey as ProofVariantKey,
      ctaKey:   parsed.ctaKey   as CTAVariantKey,
      reason:   parsed.reason,
      ...(themeKey ? { themeKey } : {}),
    };

    return {
      ok: true,
      output: {
        plan,
        confidence: clampConfidence(parsed.confidence),
        modelId:    this.modelId,
        latencyMs,
        rawReasoning: text,
      },
    };
  }
}

// ── Response shape ────────────────────────────────────────────────────────────

interface AnthropicMessagesResponse {
  content?:     Array<{ type: string; text: string }>;
  stop_reason?: string;
}

/** The JSON object the system prompt demands. */
interface ModelPlanJson {
  heroKey:     string;
  proofKey:    string;
  ctaKey:      string;
  themeKey?:   string;
  reason:      string;
  confidence?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses the model's response into a ModelPlanJson, or null when it does not
 * match the required shape.
 *
 * The prompt says "no markdown, no code blocks", but models occasionally wrap
 * JSON in a fence anyway. Rather than fail a decision over formatting, we strip
 * a leading/trailing fence and fall back to extracting the outermost {...}.
 * The strictness that matters — the variant vocabulary — is enforced by the
 * caller, not here.
 */
function parseModelJson(text: string): ModelPlanJson | null {
  const candidates: string[] = [text];

  // ```json … ```  or  ``` … ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) candidates.push(fenced[1]);

  // Outermost braces — catches a stray sentence before or after the object.
  const first = text.indexOf("{");
  const last  = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate) as unknown;
      if (!obj || typeof obj !== "object") continue;

      const o = obj as Record<string, unknown>;
      if (
        typeof o["heroKey"]  !== "string" ||
        typeof o["proofKey"] !== "string" ||
        typeof o["ctaKey"]   !== "string"
      ) continue;

      return {
        heroKey:  o["heroKey"]  as string,
        proofKey: o["proofKey"] as string,
        ctaKey:   o["ctaKey"]   as string,
        themeKey: typeof o["themeKey"] === "string" ? (o["themeKey"] as string) : undefined,
        // reason is required by the schema but must not sink a valid plan.
        reason:   typeof o["reason"] === "string" ? (o["reason"] as string) : "(model returned no reason)",
        confidence: typeof o["confidence"] === "number" ? (o["confidence"] as number) : undefined,
      };
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

/**
 * Clamps the model's confidence into [0, 1].
 *
 * The confidence policy clamps too, but doing it here keeps ai_decision_logs
 * free of out-of-range values — a model that reports 1.5 should not look more
 * certain than one that reports 1.0.
 */
function clampConfidence(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}
