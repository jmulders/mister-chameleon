import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { WARMUP_HEADER, isWarmupHeader, warmupToken } from "../../lib/warmup/warmup-request.ts";

const SECRET = "a-secret-for-this-test";

test("the token is derived from the secret and is not the secret", () => {
  const token = warmupToken(SECRET);
  assert.match(token ?? "", /^[0-9a-f]{64}$/);
  assert.notEqual(token, SECRET);
  assert.equal(token, warmupToken(SECRET), "the same secret gives the same token");
  assert.notEqual(token, warmupToken("another-secret"));
  assert.equal(warmupToken(undefined), null);
  assert.equal(warmupToken(""), null);
});

test("only the token proves a warm-up when a secret is set", () => {
  const token = warmupToken(SECRET)!;
  assert.equal(isWarmupHeader(token, SECRET, true), true);
  assert.equal(isWarmupHeader(token, SECRET, false), true);
  // The old marker: anyone in front of a site could send it.
  assert.equal(isWarmupHeader("1", SECRET, true), false);
  assert.equal(isWarmupHeader("1", SECRET, false), false);
  assert.equal(isWarmupHeader(SECRET, SECRET, true), false, "the secret itself is not the token");
  assert.equal(isWarmupHeader(token.slice(0, -1), SECRET, true), false);
  assert.equal(isWarmupHeader(token + "0", SECRET, true), false);
  assert.equal(isWarmupHeader(warmupToken("another-secret"), SECRET, true), false);
  assert.equal(isWarmupHeader(null, SECRET, true), false);
  assert.equal(isWarmupHeader("", SECRET, true), false);
});

test("without a secret production believes nobody, development accepts 1", () => {
  assert.equal(isWarmupHeader("1", undefined, true), false);
  assert.equal(isWarmupHeader("anything", undefined, true), false);
  assert.equal(isWarmupHeader("1", undefined, false), true);
  assert.equal(isWarmupHeader("2", undefined, false), false);
  assert.equal(isWarmupHeader(null, undefined, false), false);
});

// The page and the pipeline cannot be imported here (they need a request), so
// these read the source: a warm-up ping must cost nothing, on every path.

const pipeline = readFileSync(new URL("../../lib/pipeline/homepage-pipeline.ts", import.meta.url), "utf8");
const page     = readFileSync(new URL("../../app/(site)/page.tsx", import.meta.url), "utf8");
const route    = readFileSync(new URL("../../app/api/cron/keep-warm/route.ts", import.meta.url), "utf8");

test("the pipeline proves a warm-up with the helper, never with a bare value", () => {
  assert.match(pipeline, /const isWarmup\s*=\s*isWarmupHeader\(h\.get\(WARMUP_HEADER\)\);/);
  assert.doesNotMatch(pipeline, /x-mc-warmup/, "the header name comes from the helper");
});

test("a warm-up gets the default experience and reaches no AI provider", () => {
  assert.match(pipeline, /const forceDefaultForBot = isControl \|\| isWarmup \|\| isUaBot;/);
  assert.match(pipeline, /const aiMode = isWarmup \? "off" : aiConfig\.mode;/);
  // Every branch that builds an AI provider goes through aiMode.
  assert.equal((pipeline.match(/aiConfig\.mode/g) ?? []).length, 1);
  assert.match(pipeline, /if \(aiMode === "shadow"\)/);
  assert.match(pipeline, /else if \(aiMode === "live"\)/);
  // And it is still not billed for enrichment.
  assert.match(pipeline, /if \(isWarmup\) return null;/);
});

test("the homepage counts no session and writes no analytics for a warm-up", () => {
  assert.match(pipeline, /\n\s+isWarmup,\n/, "the pipeline hands isWarmup to the page");
  // The rule itself (no session for a warm-up) is tested on the function, in
  // tests/billing/bot-visit-not-counted.test.ts. Here: the page hands it the flag.
  assert.match(page, /const countSession = countsAsPersonalizedSession\(\{[^}]*\bisWarmup:\s+result\.isWarmup,[^}]*\}\);/);
  assert.match(page, /const logAnalytics = [^;]*&& !result\.isWarmup;/);
});

test("the endpoint sends the token and reports a warm-up that failed", () => {
  assert.equal(WARMUP_HEADER, "x-mc-warmup");
  assert.match(route, /\[WARMUP_HEADER\]: token/);
  assert.doesNotMatch(route, /"x-mc-warmup": "1"/);
  // No token in production means no ping at all, rather than a counted visit.
  assert.match(route, /CRON_SECRET is not set/);
  assert.match(route, /x-vercel-mitigated/);
  assert.match(route, /status: ok \? 200 : 502/);
  // The scheduler holds no key, so the endpoint may not ask for one.
  assert.doesNotMatch(route, /authorization/i);
});
