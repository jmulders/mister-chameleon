/**
 * The provisioner pieces a one-click demo rollout is built from, against faked
 * GitHub and Ploi APIs.
 *
 * The orchestrating server action itself needs a database, a session and the
 * platform store, so what is pinned here is every decision it delegates: which
 * deploy key to place (and when not to), what the Ploi env ends up containing,
 * how the assigned host is read, and what happens when Ploi never reports one.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert                                  from "node:assert/strict";

import {
  ensureRepoDeployKey, DEPLOY_KEY_TITLE,
  fetchPloiApplicationHost, pollPloiApplicationHost,
  buildDemoSecrets, buildStatamicInfraYaml,
  demoNaming, generateDemoPassword, DEMO_DOMAIN_SUFFIX,
} from "../../lib/provisioning/cms-provisioner.ts";

const realFetch = globalThis.fetch;
const ok  = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const created = (body: unknown) => new Response(JSON.stringify(body), { status: 201 });

afterEach(() => { globalThis.fetch = realFetch; });

// ── Deploy key ────────────────────────────────────────────────────────────────

describe("ensureRepoDeployKey", () => {
  interface Call { method: string; body?: { title?: string; key?: string; read_only?: boolean } }
  let calls: Call[];

  function fakeGitHub(existingKeys: Array<{ title: string; read_only: boolean }>, postStatus = 201) {
    calls = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body   = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, body });
      if (method === "GET")  return ok(existingKeys);
      if (method === "POST") {
        return postStatus === 201
          ? created({ id: 1 })
          : new Response(JSON.stringify({ message: "Must have admin rights to Repository." }), { status: postStatus });
      }
      throw new Error(`unexpected ${method}`);
    }) as typeof globalThis.fetch;
  }

  const run = () => ensureRepoDeployKey({ token: "t", owner: "acme", repo: "cms-demo" });

  it("creates a WRITE key when the repo has none", async () => {
    fakeGitHub([]);
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.reused, undefined);

    const post = calls.find((c) => c.method === "POST");
    assert.equal(post?.body?.title, DEPLOY_KEY_TITLE);
    // read_only:false is the entire point — a read-only key means CP edits are
    // committed in the container and lost on the next deploy.
    assert.equal(post?.body?.read_only, false);
    assert.match(post?.body?.key ?? "", /^ssh-ed25519 AAAA/);
  });

  it("returns the private half exactly once, for the Ploi secret", async () => {
    fakeGitHub([]);
    const result = await run();
    assert.ok(result.privateKey?.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"));
  });

  it("reuses an existing write key and does NOT rotate it", async () => {
    // GitHub never returns a private half, so re-creating would break push-back
    // for the window between delete and create. The Ploi secret already holds
    // the matching private key, so reuse is the correct answer.
    fakeGitHub([{ title: DEPLOY_KEY_TITLE, read_only: false }]);
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.reused, true);
    assert.equal(result.privateKey, undefined);
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);
  });

  it("flags an existing READ-ONLY key rather than silently accepting it", async () => {
    fakeGitHub([{ title: DEPLOY_KEY_TITLE, read_only: true }]);
    const result = await run();
    assert.equal(result.ok, false);
    assert.equal(result.reused, true);
    assert.match(result.message, /READ-ONLY/);
  });

  it("ignores deploy keys with other titles", async () => {
    fakeGitHub([{ title: "someone-elses-key", read_only: false }]);
    const result = await run();
    assert.equal(result.ok, true);
    assert.equal(result.reused, undefined);
    assert.equal(calls.filter((c) => c.method === "POST").length, 1);
  });

  it("reports an out-of-scope token without throwing — the rollout continues", async () => {
    fakeGitHub([], 403);
    const result = await run();
    assert.equal(result.ok, false);
    assert.match(result.message, /admin rights|HTTP 403/);
    assert.equal(result.privateKey, undefined);
  });

  it("survives a network error", async () => {
    globalThis.fetch = (async () => { throw new Error("boom"); }) as typeof globalThis.fetch;
    const result = await ensureRepoDeployKey({ token: "t", owner: "acme", repo: "cms-demo" });
    assert.equal(result.ok, false);
    assert.match(result.message, /Network error/);
  });

  it("requires token, owner and repo", async () => {
    assert.equal((await ensureRepoDeployKey({ token: "", owner: "a", repo: "b" })).ok, false);
    assert.equal((await ensureRepoDeployKey({ token: "t", owner: "", repo: "b" })).ok, false);
    assert.equal((await ensureRepoDeployKey({ token: "t", owner: "a", repo: "" })).ok, false);
  });
});

// ── Ploi host discovery ───────────────────────────────────────────────────────

describe("fetchPloiApplicationHost", () => {
  function fakePloi(body: unknown, status = 200) {
    globalThis.fetch = (async () =>
      status === 200 ? ok(body) : new Response("", { status })) as typeof globalThis.fetch;
  }
  const run = () => fetchPloiApplicationHost({ token: "t", appName: "mc-cms-acme" });

  it("reads the host out of a { data: [...] } envelope", async () => {
    fakePloi({ data: [{ name: "mc-cms-acme", default_domain: "mc-cms-acme-ams1-t.preview.ploi.it" }] });
    assert.deepEqual(await run(), {
      ok: true, host: "mc-cms-acme-ams1-t.preview.ploi.it", message: "Ploi assigned mc-cms-acme-ams1-t.preview.ploi.it.",
    });
  });

  it("reads a bare array too", async () => {
    fakePloi([{ name: "mc-cms-acme", domain: "host.ploi.it" }]);
    assert.equal((await run()).host, "host.ploi.it");
  });

  it("strips scheme and path from whatever field carried it", async () => {
    fakePloi({ data: [{ name: "mc-cms-acme", url: "https://host.ploi.it/cp" }] });
    assert.equal((await run()).host, "host.ploi.it");
  });

  it("falls back through the field list, and into domains[]", async () => {
    fakePloi({ data: [{ name: "mc-cms-acme", domains: [{ domain: "host.ploi.it" }] }] });
    assert.equal((await run()).host, "host.ploi.it");
    fakePloi({ data: [{ name: "mc-cms-acme", domains: ["host.ploi.it"] }] });
    assert.equal((await run()).host, "host.ploi.it");
  });

  it("picks the right application out of several", async () => {
    fakePloi({ data: [
      { name: "mc-cms-other", domain: "other.ploi.it" },
      { name: "mc-cms-acme",  domain: "acme.ploi.it" },
    ] });
    assert.equal((await run()).host, "acme.ploi.it");
  });

  it("is not-ready rather than an error when the app has no host yet", async () => {
    fakePloi({ data: [{ name: "mc-cms-acme" }] });
    const r = await run();
    assert.equal(r.ok, false);
    assert.match(r.message, /no host assigned yet/);
  });

  it("is not-ready when the app is not in the listing yet", async () => {
    fakePloi({ data: [] });
    assert.equal((await run()).ok, false);
  });

  it("does not mistake a hostless value for a host", async () => {
    fakePloi({ data: [{ name: "mc-cms-acme", domain: "pending" }] });
    assert.equal((await run()).ok, false);
  });

  it("handles an HTTP error and a network error without throwing", async () => {
    fakePloi(null, 500);
    assert.match((await run()).message, /HTTP 500/);
    globalThis.fetch = (async () => { throw new Error("boom"); }) as typeof globalThis.fetch;
    assert.match((await run()).message, /Network error/);
  });
});

describe("pollPloiApplicationHost", () => {
  it("stops as soon as a host appears", async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      return ok({ data: [attempts < 3 ? { name: "mc-cms-acme" } : { name: "mc-cms-acme", domain: "host.ploi.it" }] });
    }) as typeof globalThis.fetch;

    const r = await pollPloiApplicationHost({ token: "t", appName: "mc-cms-acme", attempts: 8, intervalMs: 0 });
    assert.equal(r.ok, true);
    assert.equal(r.host, "host.ploi.it");
    assert.equal(attempts, 3);
  });

  it("gives up after the configured attempts, saying so", async () => {
    let attempts = 0;
    globalThis.fetch = (async () => { attempts++; return ok({ data: [] }); }) as typeof globalThis.fetch;

    const r = await pollPloiApplicationHost({ token: "t", appName: "mc-cms-acme", attempts: 4, intervalMs: 0 });
    assert.equal(r.ok, false);
    assert.equal(attempts, 4);
    assert.match(r.message, /did not report a host .* within 4 attempt/);
  });
});

// ── Naming and credentials ────────────────────────────────────────────────────

describe("demoNaming", () => {
  it("derives every name from one slug", () => {
    assert.deepEqual(demoNaming("Acme Corp", "mister-chameleon-cms"), {
      slug:     "acme-corp",
      repoName: "mister-chameleon-cms-acme-corp",
      appName:  "mc-cms-acme-corp",
      demoHost: `acme-corp.${DEMO_DOMAIN_SUFFIX}`,
      cpEmail:  "demo+acme-corp@misterchameleon.nl",
    });
  });

  it("puts every demo under the shared demo zone (own subdomain, no wildcard)", () => {
    // Strato has no wildcard, so each demo is its own <slug>.demo.misterchameleon.nl
    // host with one CNAME at the DNS provider (see lib/provisioning/demo-dns.ts).
    assert.equal(DEMO_DOMAIN_SUFFIX, "demo.misterchameleon.nl");
    assert.ok(demoNaming("x", "t").demoHost.endsWith(`.${DEMO_DOMAIN_SUFFIX}`));
  });
});

describe("generateDemoPassword", () => {
  it("is readable aloud: four groups, no ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateDemoPassword();
      assert.match(pw, /^[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}$/);
      assert.ok(!/[ilo01]/.test(pw), `${pw} contains an ambiguous character`);
    }
  });

  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateDemoPassword()));
    assert.equal(seen.size, 200);
  });
});

// ── Ploi environment ──────────────────────────────────────────────────────────

describe("buildDemoSecrets", () => {
  const base = {
    platformUrl: "https://www.misterchameleon.nl",
    appUrl:      "https://mc-cms-acme.preview.ploi.it",
    appKey:      "base64:AAA",
    siteKey:     "site_abc",
    tenantId:    "acme",
    cpEmail:     "demo+acme@misterchameleon.nl",
    cpPassword:  "abcde-fghij-klmno-pqrst",
  };
  const asMap = (secrets: { key: string; value: string }[]) =>
    Object.fromEntries(secrets.map((s) => [s.key, s.value]));

  it("points APP_URL at the CP's own host, not the platform", () => {
    const env = asMap(buildDemoSecrets(base));
    assert.equal(env["APP_URL"], "https://mc-cms-acme.preview.ploi.it");
  });

  it("keeps the callback URLs pointed at the platform", () => {
    // Where the add-on and Live Preview talk TO is a different thing from where
    // the CP lives; conflating them is what APP_URL got wrong before.
    const env = asMap(buildDemoSecrets(base));
    assert.equal(env["MISTER_CHAMELEON_API_URL"], "https://www.misterchameleon.nl");
    assert.equal(env["MC_PREVIEW_FRONTEND_URL"],  "https://www.misterchameleon.nl");
  });

  it("carries the CP admin credentials mc:ensure-super-user reads", () => {
    const env = asMap(buildDemoSecrets(base));
    assert.equal(env["CP_ADMIN_EMAIL"],    "demo+acme@misterchameleon.nl");
    assert.equal(env["CP_ADMIN_PASSWORD"], "abcde-fghij-klmno-pqrst");
  });

  it("includes the git ssh key only when a deploy key was actually created", () => {
    assert.equal(asMap(buildDemoSecrets(base))["STATAMIC_GIT_SSH_KEY"], undefined);
    assert.equal(
      asMap(buildDemoSecrets({ ...base, gitSshKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nx\n" }))["STATAMIC_GIT_SSH_KEY"],
      "-----BEGIN OPENSSH PRIVATE KEY-----\nx\n",
    );
  });

  it("still enables git push-back and Pro", () => {
    const env = asMap(buildDemoSecrets(base));
    assert.equal(env["STATAMIC_GIT_PUSH"],      "true");
    assert.equal(env["STATAMIC_PRO_ENABLED"],   "true"); // navs are a Pro feature
    assert.equal(env["STATAMIC_GIT_USER_EMAIL"], "cms+acme@misterchameleon.nl");
  });

  it("only APP_URL differs between the first apply and the corrected one", () => {
    const first     = asMap(buildDemoSecrets({ ...base, appUrl: base.platformUrl }));
    const corrected = asMap(buildDemoSecrets(base));
    const changed = Object.keys(corrected).filter((k) => corrected[k] !== first[k]);
    assert.deepEqual(changed, ["APP_URL"]);
  });
});

describe("buildStatamicInfraYaml — demo build commands", () => {
  const base = {
    appName: "mc-cms-acme", team: "team", repoUrl: "https://github.com/acme/cms",
    repoOwner: "acme", repoName: "cms", secrets: [],
  };

  it("runs mc:ensure-super-user AFTER composer install", () => {
    const yaml = buildStatamicInfraYaml({ ...base, extraBuildCommands: ["php artisan mc:ensure-super-user"] });
    const composer = yaml.indexOf("composer install");
    const ensure   = yaml.indexOf("php artisan mc:ensure-super-user");
    assert.ok(composer > -1 && ensure > composer, "the command needs the vendor tree to exist");
  });

  it("adds nothing when no extra commands are given", () => {
    const yaml = buildStatamicInfraYaml(base);
    assert.ok(!yaml.includes("mc:ensure-super-user"));
    assert.ok(yaml.includes("composer install"));
  });

  it("keeps the CP-admin secrets out of the build commands and in secrets", () => {
    const yaml = buildStatamicInfraYaml({
      ...base,
      extraBuildCommands: ["php artisan mc:ensure-super-user"],
      secrets: [{ key: "CP_ADMIN_PASSWORD", value: "abcde-fghij-klmno-pqrst" }],
    });
    assert.ok(!/- .*abcde-fghij/.test(yaml.split("secrets:")[0] ?? ""));
    assert.ok(yaml.includes("key: CP_ADMIN_PASSWORD"));
  });
});
