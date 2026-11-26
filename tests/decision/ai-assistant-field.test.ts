/**
 * The `aiAssistant` field: a visitor who clicked through from an AI assistant.
 *
 * The owner asked on 26 Nov 2026 to recognise such a visitor, so a site can
 * adapt to him and count him. Until then he was `source = unknown`, one of
 * many. The field stands beside `source` and `channelGroup`, which keep the
 * value they had: no existing rule changes its answer.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { deriveAiAssistant, computeDerivedContext } from "@/context/derived-context";
import { FIELD_REGISTRY }             from "@/decision/rules/field-registry";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { evaluateCondition }          from "@/decision/rules/stored-rule";
import type { RuleCondition }         from "@/decision/rules/stored-rule";
import { getContextVar }              from "@/context/registry";

const ctxWith = (fields: Record<string, unknown>) => fields as unknown as RuleEvaluationContext;

describe("deriveAiAssistant", () => {
  it("names the assistant from the referrer domain", () => {
    assert.equal(deriveAiAssistant(null, "chatgpt.com"), "chatgpt");
    assert.equal(deriveAiAssistant(null, "chat.openai.com"), "chatgpt");
    assert.equal(deriveAiAssistant(null, "perplexity.ai"), "perplexity");
    assert.equal(deriveAiAssistant(null, "copilot.microsoft.com"), "copilot");
    assert.equal(deriveAiAssistant(null, "gemini.google.com"), "gemini");
    assert.equal(deriveAiAssistant(null, "claude.ai"), "claude");
    assert.equal(deriveAiAssistant(null, "chat.mistral.ai"), "other");
  });

  it("names it from utm_source, which ChatGPT adds to the links it cites", () => {
    assert.equal(deriveAiAssistant("chatgpt.com", null), "chatgpt");
    assert.equal(deriveAiAssistant(" ChatGPT.com ", null), "chatgpt");
    assert.equal(deriveAiAssistant("perplexity", null), "perplexity");
  });

  it("lets utm_source win over the referrer", () => {
    assert.equal(deriveAiAssistant("chatgpt.com", "perplexity.ai"), "chatgpt");
  });

  it("still looks at the referrer when utm_source names something else", () => {
    assert.equal(deriveAiAssistant("newsletter", "claude.ai"), "claude");
  });

  it("matches a host and its subdomains, never a look-alike", () => {
    assert.equal(deriveAiAssistant(null, "www.perplexity.ai"), "perplexity");
    assert.equal(deriveAiAssistant(null, "labs.perplexity.ai"), "perplexity");
    assert.equal(deriveAiAssistant(null, "notchatgpt.com"), null);
    assert.equal(deriveAiAssistant(null, "chatgpt.com.example.org"), null);
    assert.equal(deriveAiAssistant(null, "claude.ai.example"), null);
  });

  it("does not take Google or Microsoft as a whole for their assistant", () => {
    assert.equal(deriveAiAssistant(null, "google.com"), null);
    assert.equal(deriveAiAssistant("google", "google.com"), null);
    assert.equal(deriveAiAssistant(null, "bing.com"), null);
    assert.equal(deriveAiAssistant(null, "microsoft.com"), null);
  });

  it("is null for every other visit", () => {
    assert.equal(deriveAiAssistant(null, null), null);
    assert.equal(deriveAiAssistant(undefined, undefined), null);
    assert.equal(deriveAiAssistant("", ""), null);
    assert.equal(deriveAiAssistant("linkedin", "linkedin.com"), null);
  });
});

describe("derived context", () => {
  it("carries the assistant, and leaves source and channel group as they were", () => {
    const before = computeDerivedContext(ctxWith({ source: "unknown", referrerDomain: "example.org" }));
    const after  = computeDerivedContext(ctxWith({ source: "unknown", referrerDomain: "chatgpt.com" }));
    assert.equal(before.aiAssistant, null);
    assert.equal(after.aiAssistant, "chatgpt");
    assert.equal(after.channelGroup, before.channelGroup);
  });

  it("reads utm_source from the context", () => {
    const derived = computeDerivedContext(ctxWith({ source: "unknown", utmSource: "chatgpt.com" }));
    assert.equal(derived.aiAssistant, "chatgpt");
  });
});

describe("rule field aiAssistant", () => {
  const resolve = FIELD_REGISTRY.aiAssistant.resolve;
  const cond = (operator: string, value: unknown) => ({ type: "field", field: "aiAssistant", operator, value }) as unknown as RuleCondition;

  it("resolves from the derived context", () => {
    assert.equal(resolve(ctxWith({ derived: { aiAssistant: "claude" } })), "claude");
    assert.equal(resolve(ctxWith({ derived: { aiAssistant: null } })), null);
    assert.equal(resolve(ctxWith({})), null);
  });

  it("can be used in a rule: one assistant, or any of them", () => {
    const fromChatGpt = ctxWith({ derived: { aiAssistant: "chatgpt" } });
    const fromNowhere = ctxWith({ derived: { aiAssistant: null } });
    assert.equal(evaluateCondition(cond("equals", "chatgpt"), fromChatGpt), true);
    assert.equal(evaluateCondition(cond("equals", "chatgpt"), fromNowhere), false);
    assert.equal(evaluateCondition(cond("in", ["chatgpt", "perplexity", "copilot", "gemini", "claude", "other"]), fromChatGpt), true);
    assert.equal(evaluateCondition(cond("in", ["chatgpt", "perplexity", "copilot", "gemini", "claude", "other"]), fromNowhere), false);
  });

  it("offers the same values in the rule editor and in the context registry", () => {
    const registry = getContextVar("aiAssistant");
    assert.ok(registry, "the context registry has no aiAssistant");
    assert.deepEqual(registry!.allowedValues, FIELD_REGISTRY.aiAssistant.allowedValues);
    assert.equal(registry!.availableToRules, true);
  });
});

describe("from a real request", () => {
  async function derivedFor(url: string, referer?: string) {
    const { buildDecisionContext } = await import("@/decision/context/build-decision-context");
    const headers = new Headers({ "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" });
    if (referer) headers.set("referer", referer);
    const ctx = await buildDecisionContext({ request: new Request(url, { headers }) });
    return { ctx, derived: computeDerivedContext(ctx as unknown as RuleEvaluationContext) };
  }

  it("recognises a click from ChatGPT by its utm_source", async () => {
    const { ctx, derived } = await derivedFor("http://tenant.example/functies?utm_source=chatgpt.com");
    assert.equal(derived.aiAssistant, "chatgpt");
    // The source stays what it was for such a visit.
    assert.equal(ctx.source, "unknown");
  });

  it("recognises a click from Perplexity by its referrer", async () => {
    const { ctx, derived } = await derivedFor("http://tenant.example/", "https://www.perplexity.ai/search?q=x");
    assert.equal(derived.aiAssistant, "perplexity");
    assert.equal(ctx.source, "unknown");
  });

  it("leaves a visit from Google search alone", async () => {
    const { ctx, derived } = await derivedFor("http://tenant.example/", "https://www.google.com/");
    assert.equal(derived.aiAssistant, null);
    assert.equal(ctx.source, "google");
  });
});
