/**
 * AI Providers — Factory
 *
 * Single entry point for constructing an AiProvider instance from the
 * resolved runtime configuration.
 *
 * ─── Why a factory? ──────────────────────────────────────────────────────────
 *
 *   Call sites (AiDecisionProvider, shadow runner, tests) should not need to
 *   know which concrete provider class to instantiate.  They call
 *   createAiProvider() and get back an AiProvider that is always safe to use.
 *
 * ─── Current routing ─────────────────────────────────────────────────────────
 *
 *   Config null or mode disabled    →  DisabledAiProvider
 *   "claude"  — key present         →  ClaudeAdapter   (real Anthropic call)
 *   "claude"  — no key              →  DisabledAiProvider
 *   "openai"  — hasApiKey           →  MockAiProvider  (OpenAiAdapter TODO)
 *   "openai"  — !hasApiKey          →  DisabledAiProvider
 *   "gemini"  — hasApiKey           →  MockAiProvider  (GeminiAdapter TODO)
 *   "gemini"  — !hasApiKey          →  DisabledAiProvider
 *   Unknown provider name           →  DisabledAiProvider  (TS exhaustive guard)
 *
 *   NOTE: openai and gemini still return a MOCK. Selecting them looks like it
 *   works — decisions get logged, plans_match populates — but no model is ever
 *   called. Only "claude" performs real inference today.
 *
 * ─── Adding a real adapter ────────────────────────────────────────────────────
 *
 *   1. Create ai/providers/<provider>-adapter.ts implementing AiProvider.
 *   2. In the corresponding case below, replace MockAiProvider with:
 *
 *        return new ClaudeAdapter({
 *          modelId:   config.modelId,
 *          timeoutMs: config.timeoutMs,
 *          apiKey:    process.env.ANTHROPIC_API_KEY as string,  // server-only
 *        });
 *
 *   3. The !hasApiKey guard routes to DisabledAiProvider so nothing crashes
 *      when the key is absent in a given environment.
 *
 *   API keys must be read from process.env inside this module ONLY — never
 *   stored in AiProviderConfig or passed through client-facing code paths.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { createAiProvider } from "@/ai/providers/create-ai-provider";
 *   import { getAiRuntimeConfig } from "@/ai/config";
 *
 *   const aiConfig = getAiRuntimeConfig();
 *
 *   // For live mode:
 *   const liveProvider = createAiProvider(aiConfig.liveProvider);
 *
 *   // For shadow mode:
 *   const shadowProvider = createAiProvider(aiConfig.shadowProvider);
 *
 *   // Both return an AiProvider that is always safe to call.
 *   const result = await liveProvider.suggest(input);
 */

import type { AiProviderConfig } from "@/ai/types";
import type { AiProvider } from "./base-provider";
import { DisabledAiProvider } from "./base-provider";
import { MockAiProvider } from "./mock-ai-provider";
import { ClaudeAdapter } from "./claude-adapter";

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates and returns the appropriate AiProvider for the given config slot.
 *
 * Pass `aiConfig.liveProvider` or `aiConfig.shadowProvider` from
 * getAiRuntimeConfig().  A null value means the slot is inactive and a
 * DisabledAiProvider is returned.
 *
 * The returned provider is always safe to call — it never throws and always
 * returns a typed AiProviderResult.
 *
 * @param config  The resolved provider config for one slot (live or shadow),
 *                or null when that slot is not active.
 *
 * @returns       A concrete AiProvider implementation.
 *
 * @example
 * const aiConfig       = getAiRuntimeConfig();
 * const shadowProvider = createAiProvider(aiConfig.shadowProvider);
 *
 * // Later, in the shadow runner:
 * const result = await shadowProvider.suggest(input);
 * if (result.ok) {
 *   void saveAiDecisionLog({ shadow_plan: result.output, ... });
 * }
 */
export function createAiProvider(config: AiProviderConfig | null): AiProvider {
  // ── Inactive slot ────────────────────────────────────────────────────────
  // null means this mode slot (live or shadow) is not configured.
  if (config === null) {
    return new DisabledAiProvider(
      "AI provider slot is not configured for this mode.",
    );
  }

  // ── Route to a concrete provider ─────────────────────────────────────────
  // Each case checks hasApiKey first.  When the key is absent the slot is
  // disabled so nothing crashes in an environment that lacks the credential.
  //
  // MockAiProvider is used in place of real adapters while those are being
  // built.  Swap each TODO block for the real adapter when ready.
  // The key check already lives in every case — no change needed at the
  // call site when a real adapter replaces the mock.

  switch (config.name) {
    // ── Claude (Anthropic) ──────────────────────────────────────────────
    case "claude": {
      if (!config.hasApiKey) {
        return new DisabledAiProvider(
          `AI provider "claude" requires ANTHROPIC_API_KEY to be set. ` +
          `Add it to .env.local (or your deployment secrets) to enable inference.`,
        );
      }
      // hasApiKey can be true because the TENANT configured its own key — but
      // AiProviderConfig never carries the value, so all we can use is the
      // platform key. Guard rather than hand the adapter an empty string.
      const anthropicKey = process.env["ANTHROPIC_API_KEY"];
      if (!anthropicKey) {
        return new DisabledAiProvider(
          `AI provider "claude" is marked configured, but ANTHROPIC_API_KEY is ` +
          `absent in this environment. A tenant-supplied key cannot be used yet: ` +
          `AiProviderConfig carries only hasApiKey, never the value.`,
        );
      }
      return new ClaudeAdapter({
        modelId:   config.modelId,
        timeoutMs: config.timeoutMs,
        apiKey:    anthropicKey,
      });
    }

    // ── OpenAI ─────────────────────────────────────────────────────────
    case "openai": {
      if (!config.hasApiKey) {
        return new DisabledAiProvider(
          `AI provider "openai" requires OPENAI_API_KEY to be set. ` +
          `Add it to .env.local (or your deployment secrets) to enable inference.`,
        );
      }
      // TODO: replace with OpenAiAdapter when implemented:
      //
      //   import { OpenAiAdapter } from "./openai-adapter";
      //   return new OpenAiAdapter({
      //     modelId:   config.modelId,
      //     timeoutMs: config.timeoutMs,
      //     apiKey:    process.env.OPENAI_API_KEY as string,
      //   });
      return new MockAiProvider();
    }

    // ── Gemini (Google) ────────────────────────────────────────────────
    case "gemini": {
      if (!config.hasApiKey) {
        return new DisabledAiProvider(
          `AI provider "gemini" requires GEMINI_API_KEY to be set. ` +
          `Add it to .env.local (or your deployment secrets) to enable inference.`,
        );
      }
      // TODO: replace with GeminiAdapter when implemented:
      //
      //   import { GeminiAdapter } from "./gemini-adapter";
      //   return new GeminiAdapter({
      //     modelId:   config.modelId,
      //     timeoutMs: config.timeoutMs,
      //     apiKey:    process.env.GEMINI_API_KEY as string,
      //   });
      return new MockAiProvider();
    }

    default: {
      // Exhaustiveness guard — TypeScript will flag this at compile time if a
      // new provider name is added to AiProviderName without a case here.
      const _exhaustive: never = config.name;
      return new DisabledAiProvider(
        `Unknown AI provider "${_exhaustive as string}". ` +
        `Add a case for it in createAiProvider().`,
      );
    }
  }
}

// ── Convenience overload for full AiRuntimeConfig ────────────────────────────

/**
 * Creates the active AiProvider for the current deployment's AI mode.
 *
 * A convenience wrapper over createAiProvider() that accepts the full
 * AiRuntimeConfig and picks the relevant slot automatically:
 *
 *   mode "live"     → uses config.liveProvider
 *   mode "shadow"   → uses config.shadowProvider
 *   mode "disabled" → always returns DisabledAiProvider
 *
 * This is the entry point for callers that have the full config and simply
 * want the right provider without inspecting mode themselves.
 *
 * @param config  The full AiRuntimeConfig from getAiRuntimeConfig().
 * @param slot    Which slot to create: "live" (default) or "shadow".
 *
 * @example
 * const aiConfig       = getAiRuntimeConfig();
 * const activeProvider = createAiProviderFromConfig(aiConfig, "shadow");
 */
export function createAiProviderFromConfig(
  config: import("@/ai/types").AiRuntimeConfig,
  slot: "live" | "shadow" = "live",
): AiProvider {
  if (config.mode === "disabled") {
    return new DisabledAiProvider("AI mode is set to disabled.");
  }

  const providerConfig =
    slot === "shadow" ? config.shadowProvider : config.liveProvider;

  return createAiProvider(providerConfig);
}
