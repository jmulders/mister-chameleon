/**
 * A bot is served the default page, so it counts no session.
 *
 * ─── What went wrong ─────────────────────────────────────────────────────────
 *
 *   Both render paths recognise a bot by its User-Agent and force the default
 *   plan for it. The session count did not look at that verdict: the homepage
 *   counted every visit that was under the cap and not a keep-warm ping, the
 *   CMS pages every visit under the cap. A crawler or a headless browser keeps
 *   no cookie, so each request of it arrived as a new visit and took one
 *   session from the tenant's bundle. Seen on production on 27 Nov 2026: every
 *   visit of a headless Chromium to the homepage left new rows in
 *   personalization_sessions.
 *
 * ─── What is tested ──────────────────────────────────────────────────────────
 *
 *   1. The rule, on the pure function: over the cap, a bot and a keep-warm
 *      ping count nothing, everyone else counts.
 *   2. The rule on real User-Agents, through the same detector the render
 *      paths use.
 *   3. Both render paths count through that function, with the very verdict
 *      that forced the default plan. They need a request to run, so these read
 *      the source, like tests/warmup/warmup-request.test.ts does.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import { countsAsPersonalizedSession } from "@/billing/plan-enforcement";
import { isBotUserAgent }              from "@/decision/context/detect-bot";

const HEADLESS_CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("which visit counts as a personalised session", () => {
  it("counts a visitor under the cap", () => {
    assert.equal(countsAsPersonalizedSession({ overLimit: false, isBot: false }), true);
    assert.equal(countsAsPersonalizedSession({ overLimit: false, isBot: false, isWarmup: false }), true);
  });

  it("counts nothing for a bot", () => {
    assert.equal(countsAsPersonalizedSession({ overLimit: false, isBot: true }), false);
  });

  it("counts nothing over the cap, as before", () => {
    assert.equal(countsAsPersonalizedSession({ overLimit: true, isBot: false }), false);
  });

  it("counts nothing for a keep-warm ping, as before", () => {
    assert.equal(countsAsPersonalizedSession({ overLimit: false, isBot: false, isWarmup: true }), false);
  });

  it("one reason is enough", () => {
    assert.equal(countsAsPersonalizedSession({ overLimit: true,  isBot: true,  isWarmup: true  }), false);
    assert.equal(countsAsPersonalizedSession({ overLimit: true,  isBot: true,  isWarmup: false }), false);
    assert.equal(countsAsPersonalizedSession({ overLimit: false, isBot: true,  isWarmup: true  }), false);
  });
});

describe("the verdict on real User-Agents", () => {
  const counted = (userAgent: string | null) =>
    countsAsPersonalizedSession({ overLimit: false, isBot: isBotUserAgent(userAgent) });

  it("a headless Chromium is not counted (the visits seen on production)", () => {
    assert.equal(counted(HEADLESS_CHROME), false);
  });

  it("a search crawler and a plain HTTP client are not counted", () => {
    assert.equal(counted(GOOGLEBOT), false);
    assert.equal(counted("curl/8.7.1"), false);
  });

  it("a browser is counted", () => {
    assert.equal(counted(CHROME), true);
  });

  it("a request without a User-Agent is counted: unknown is not a bot", () => {
    // The detector answers false for an absent User-Agent on purpose, so a
    // visitor behind a proxy that strips the header is still personalised.
    // Personalised means counted.
    assert.equal(counted(null), true);
    assert.equal(counted(""), true);
  });
});

describe("the render paths", () => {
  // Comments out, so a line that only lives in a comment proves nothing.
  const strip = (file: string) =>
    readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  const pipeline = strip("lib/pipeline/homepage-pipeline.ts");
  const page     = strip("app/(site)/page.tsx");
  const cmsPage  = strip("lib/cms-page-decision.ts");

  it("the homepage pipeline forces the default plan and reports the bot with one verdict", () => {
    assert.match(pipeline, /const isUaBot = isBotUserAgent\(h\.get\("user-agent"\)\);/);
    assert.match(pipeline, /const forceDefaultForBot = isControl \|\| isWarmup \|\| isUaBot;/);
    assert.match(pipeline, /\n\s+isUaBot,\n/, "the pipeline hands isUaBot to the page");
    assert.equal(pipeline.match(/isBotUserAgent\(/g)?.length, 1, "the User-Agent is judged once");
  });

  it("the homepage counts through the rule, with the pipeline's verdict", () => {
    const call = /const countSession = countsAsPersonalizedSession\(\{([^}]*)\}\);/.exec(page)?.[1] ?? "";
    assert.match(call, /overLimit:\s+result\.sessionCap\.overLimit,/);
    assert.match(call, /isBot:\s+result\.isUaBot,/);
    assert.match(call, /isWarmup:\s+result\.isWarmup,/);

    const guarded = /if \(countSession\) \{([\s\S]*?)\n    \}\n/.exec(page)?.[1] ?? "";
    assert.match(guarded, /recordPersonalizedSession\(/);
    assert.equal(page.match(/recordPersonalizedSession\(/g)?.length, 1, "no count outside the guard");
  });

  it("a CMS page counts through the rule, with the verdict that forces the default plan", () => {
    assert.match(cmsPage, /const isUaBot = isBotUserAgent\(request\.headers\.get\("user-agent"\)\);/);
    assert.match(cmsPage, /const forceDefaultForBot = isControl \|\| isUaBot;/);
    assert.equal(cmsPage.match(/isBotUserAgent\(/g)?.length, 1, "the User-Agent is judged once");

    const guarded =
      /if \(countsAsPersonalizedSession\(\{ overLimit: sessionCap\.overLimit, isBot: isUaBot \}\)\) \{([\s\S]*?)\n    \}\n/
        .exec(cmsPage)?.[1] ?? "";
    assert.match(guarded, /recordPersonalizedSession\(/);
    assert.equal(cmsPage.match(/recordPersonalizedSession\(/g)?.length, 1, "no count outside the guard");
  });

  it("the snippet and the slot API count no session, so there is no third place to guard", () => {
    // A caller added there must apply the rule too. This fails when one is
    // added, so it gets looked at.
    for (const file of ["app/api/snippet/decide/route.ts", "app/api/v1/slot/route.ts"]) {
      assert.doesNotMatch(strip(file), /recordPersonalizedSession\(/, file);
    }
  });
});
