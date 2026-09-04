/**
 * seedNeutralContentIntoRepo — the step that makes a freshly generated tenant
 * repo neutral.
 *
 * A repo generated from the template is a full copy of it, live content and
 * all. This step writes the template's seed/ over that copy and prunes the
 * collection entries the seed doesn't provide. Both halves matter: without the
 * prune the tenant inherits our pages and editorial entries; without the guard
 * rails the prune could empty a repo it shouldn't have touched.
 *
 * GitHub is faked at the fetch boundary — one recursive tree read, then a blob
 * read + PUT per seed file and a DELETE per pruned file.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert                                  from "node:assert/strict";

import { seedNeutralContentIntoRepo, seedNeutralPagesIntoRepo, seedDestination } from "../../lib/provisioning/cms-provisioner.ts";

// ── Fake GitHub ───────────────────────────────────────────────────────────────

interface FakeRepo {
  /** repo path → file content. Blob shas are derived as `sha:<path>`. */
  files:      Record<string, string>;
  /** Force the tree read to fail this many times before succeeding. */
  treeFails?: number;
  /** Report the tree as truncated. */
  truncated?: boolean;
  /** Paths whose PUT/DELETE should fail, to prove per-file non-fatality. */
  failWrites?: string[];
}

interface Calls {
  puts:    Array<{ path: string; content: string; sha?: string }>;
  deletes: Array<{ path: string; sha: string }>;
  trees:   number;
}

const shaFor  = (path: string) => `sha:${path}`;
const b64     = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64   = (s: string) => Buffer.from(s, "base64").toString("utf8");
const ok      = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const realFetch = globalThis.fetch;

function installFakeGitHub(repo: FakeRepo): Calls {
  const calls: Calls = { puts: [], deletes: [], trees: 0 };
  let treeAttempts = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url    = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    // Recursive tree read
    if (url.includes("/git/trees/")) {
      calls.trees++;
      if (repo.treeFails && treeAttempts++ < repo.treeFails) return new Response("", { status: 500 });
      return ok({
        truncated: repo.truncated === true,
        tree: Object.keys(repo.files).map((path) => ({ path, type: "blob", sha: shaFor(path) })),
      });
    }

    // Blob read, addressed by sha
    if (url.includes("/git/blobs/")) {
      const sha  = decodeURIComponent(url.split("/git/blobs/")[1]!);
      const path = Object.keys(repo.files).find((p) => shaFor(p) === sha);
      if (path === undefined) return new Response("", { status: 404 });
      return ok({ content: b64(repo.files[path]!), encoding: "base64" });
    }

    // Contents PUT / DELETE
    if (url.includes("/contents/")) {
      const path = decodeURIComponent(url.split("/contents/")[1]!.split("?")[0]!);
      const body = init?.body ? JSON.parse(String(init.body)) as { content?: string; sha?: string } : {};
      if (repo.failWrites?.includes(path)) return new Response("", { status: 422 });

      if (method === "PUT") {
        calls.puts.push({ path, content: unb64(body.content ?? ""), sha: body.sha });
        repo.files[path] = unb64(body.content ?? "");
        return ok({ content: { path } });
      }
      if (method === "DELETE") {
        calls.deletes.push({ path, sha: body.sha! });
        delete repo.files[path];
        return ok({ commit: {} });
      }
    }

    throw new Error(`unexpected fetch: ${method} ${url}`);
  }) as typeof globalThis.fetch;

  return calls;
}

// A template copy: neutral seed + the template's own live content.
function templateCopy(): FakeRepo {
  return {
    files: {
      // ── the neutral seed (what a blank tenant starts with) ──
      "seed/README.md":                                    "not content — must not be copied",
      "seed/download-placeholders.sh":                     "#!/bin/bash",
      "seed/content/collections/pages/nl/home.md":         "neutral home",
      "seed/content/collections/pages/nl/contact.md":      "neutral contact",
      "seed/content/navigation/main_nav.yaml":             "neutral nav def",
      "seed/content/trees/navigation/nl/main_nav.yaml":    "neutral nav tree",
      "seed/content/globals/nl/site_settings.yaml":        "neutral settings",
      "seed/public/assets/placeholder-logo.svg":           "<svg/>",

      // ── the demo seed (a curated example site) ──
      "demo-seed/README.md":                                 "not content either",
      "demo-seed/content/collections/pages/nl/home.md":      "demo home",
      "demo-seed/content/collections/pages/nl/diensten.md":  "demo diensten",
      "demo-seed/content/collections/pages/nl/contact.md":   "demo contact",
      "demo-seed/content/collections/blog/nl/acme-post.md":  "demo blog post",
      "demo-seed/content/collections/testimonials/nl/t1.md": "demo testimonial",
      "demo-seed/content/navigation/main_nav.yaml":          "demo nav def",
      "demo-seed/content/trees/navigation/nl/main_nav.yaml": "demo nav tree",
      "demo-seed/content/globals/nl/site_settings.yaml":     "demo settings",
      "demo-seed/public/assets/acme-logo.svg":               "<svg>acme</svg>",

      // ── the template's own content, copied by repo-generate ──
      "content/collections/pages/nl/home.md":              "OUR home",
      "content/collections/pages/nl/contact.md":           "OUR contact",
      "content/collections/pages/nl/pricing.md":           "OUR pricing",
      "content/collections/pages/nl/cases.md":             "OUR cases",
      "content/collections/pages/en-gb/news.md":           "OUR english news",
      "content/collections/pages/de/events.md":            "OUR german events",
      "content/collections/blog/nl/a-post.md":             "OUR blog post",
      "content/collections/case_studies/nl/case-acme.md":  "OUR case study",
      "content/collections/testimonials/nl/quote-1.md":    "OUR testimonial",
      "content/collections/team_members/nl/someone.md":    "OUR team member",

      // ── collection CONFIG — structure, must survive ──
      "content/collections/pages.yaml":                    "handle: pages",
      "content/collections/blog.yaml":                     "handle: blog",
      "content/collections/testimonials.yaml":             "handle: testimonials",

      // ── other content the prune must not touch ──
      "content/navigation/main_nav.yaml":                  "OUR nav def",
      "content/trees/navigation/nl/main_nav.yaml":         "OUR nav tree",
      "content/globals/nl/site_settings.yaml":             "OUR settings",
      "content/taxonomies/theme.yaml":                     "taxonomy",

      // ── code, untouched ──
      "public/assets/our-logo.svg":                        "<svg>ours</svg>",
      "resources/blueprints/pages.yaml":                   "blueprint",
      "composer.json":                                     "{}",
    },
  };
}

const seed = (_repo: FakeRepo, seedRoot: "seed" | "demo-seed" = "seed") =>
  seedNeutralContentIntoRepo({
    token: "t", owner: "acme", name: "cms-tenant", branch: "main", seedRoot, retryDelayMs: 0,
  });

afterEach(() => { globalThis.fetch = realFetch; });

// ── Writing the seed ──────────────────────────────────────────────────────────

describe("seedNeutralContentIntoRepo — writing the seed", () => {
  let repo:  FakeRepo;
  let calls: Calls;
  beforeEach(() => { repo = templateCopy(); calls = installFakeGitHub(repo); });

  it("writes every seed/content and seed/public file to its destination", async () => {
    const result = await seed(repo);
    assert.equal(result.ok, true);
    assert.deepEqual([...result.seeded].sort(), [
      "content/collections/pages/nl/contact.md",
      "content/collections/pages/nl/home.md",
      "content/globals/nl/site_settings.yaml",
      "content/navigation/main_nav.yaml",
      "content/trees/navigation/nl/main_nav.yaml",
      "public/assets/placeholder-logo.svg",
    ]);
  });

  it("overwrites the template's own copy, rather than leaving it in place", async () => {
    await seed(repo);
    assert.equal(repo.files["content/collections/pages/nl/home.md"], "neutral home");
    assert.equal(repo.files["content/navigation/main_nav.yaml"],     "neutral nav def");
    assert.equal(repo.files["content/globals/nl/site_settings.yaml"], "neutral settings");
    assert.equal(repo.files["public/assets/placeholder-logo.svg"],   "<svg/>");
  });

  it("overwrites BOTH halves of the navigation — the definition and its tree", async () => {
    // Seeding only content/navigation leaves the old tree pointing at pages that
    // the prune is about to delete.
    await seed(repo);
    assert.equal(repo.files["content/navigation/main_nav.yaml"],          "neutral nav def");
    assert.equal(repo.files["content/trees/navigation/nl/main_nav.yaml"], "neutral nav tree");
  });

  it("passes the existing sha when overwriting and omits it when creating", async () => {
    await seed(repo);
    const overwrite = calls.puts.find((p) => p.path === "content/collections/pages/nl/home.md");
    const create    = calls.puts.find((p) => p.path === "public/assets/placeholder-logo.svg");
    assert.equal(overwrite?.sha, shaFor("content/collections/pages/nl/home.md"));
    assert.equal(create?.sha, undefined);
  });

  it("never copies seed/ files that live outside content/ and public/", async () => {
    await seed(repo);
    const written = calls.puts.map((p) => p.path);
    assert.ok(!written.includes("README.md"));
    assert.ok(!written.includes("download-placeholders.sh"));
    assert.equal(repo.files["seed/README.md"], "not content — must not be copied");
  });
});

// ── Pruning ───────────────────────────────────────────────────────────────────

describe("seedNeutralContentIntoRepo — pruning template content", () => {
  let repo:  FakeRepo;
  let calls: Calls;
  beforeEach(() => { repo = templateCopy(); calls = installFakeGitHub(repo); });

  it("deletes pages the seed does not provide, in every locale", async () => {
    const result = await seed(repo);
    for (const gone of [
      "content/collections/pages/nl/pricing.md",
      "content/collections/pages/nl/cases.md",
      "content/collections/pages/en-gb/news.md",
      "content/collections/pages/de/events.md",
    ]) {
      assert.ok(result.removed.includes(gone), `expected ${gone} to be removed`);
      assert.equal(repo.files[gone], undefined);
    }
  });

  it("keeps the pages the seed does provide", async () => {
    const result = await seed(repo);
    assert.ok(!result.removed.includes("content/collections/pages/nl/home.md"));
    assert.ok(!result.removed.includes("content/collections/pages/nl/contact.md"));
    assert.equal(repo.files["content/collections/pages/nl/home.md"], "neutral home");
  });

  it("empties every editorial collection, including ones nothing names in code", async () => {
    const result = await seed(repo);
    for (const gone of [
      "content/collections/blog/nl/a-post.md",
      "content/collections/case_studies/nl/case-acme.md",
      "content/collections/testimonials/nl/quote-1.md",
      "content/collections/team_members/nl/someone.md",
    ]) {
      assert.ok(result.removed.includes(gone), `expected ${gone} to be removed`);
    }
  });

  it("keeps collection CONFIG — structure survives, only entries go", async () => {
    await seed(repo);
    assert.equal(repo.files["content/collections/pages.yaml"],        "handle: pages");
    assert.equal(repo.files["content/collections/blog.yaml"],         "handle: blog");
    assert.equal(repo.files["content/collections/testimonials.yaml"], "handle: testimonials");
    assert.equal(calls.deletes.filter((d) => d.path.endsWith("s.yaml") && !d.path.includes("/nl/")).length, 0);
  });

  it("prunes only under content/collections — globals, trees, taxonomies and code are left alone", async () => {
    await seed(repo);
    for (const kept of [
      "content/taxonomies/theme.yaml",
      "public/assets/our-logo.svg",
      "resources/blueprints/pages.yaml",
      "composer.json",
    ]) {
      assert.notEqual(repo.files[kept], undefined, `expected ${kept} to survive`);
    }
    assert.ok(calls.deletes.every((d) => d.path.startsWith("content/collections/")));
  });

  it("a collection the template does not have is simply a no-op", async () => {
    // No `vacancies` entries exist in this repo; nothing is attempted for it.
    const result = await seed(repo);
    assert.ok(result.removed.every((p) => !p.includes("/vacancies/")));
  });

  it("deletes with the blob sha from the tree read", async () => {
    await seed(repo);
    for (const del of calls.deletes) assert.equal(del.sha, shaFor(del.path));
  });
});

// ── Guard rails ───────────────────────────────────────────────────────────────

describe("seedNeutralContentIntoRepo — guard rails", () => {
  afterEach(() => { globalThis.fetch = realFetch; });

  it("retries the tree read — GitHub populates a generated repo asynchronously", async () => {
    const repo  = templateCopy();
    repo.treeFails = 2;
    const calls = installFakeGitHub(repo);
    const result = await seed(repo);
    assert.equal(calls.trees, 3);
    assert.equal(result.ok, true);
  });

  it("gives up after the retries without touching anything", async () => {
    const repo = templateCopy();
    repo.treeFails = 99;
    const calls = installFakeGitHub(repo);
    const result = await seed(repo);
    assert.equal(result.ok, false);
    assert.deepEqual(result.removed, []);
    assert.equal(calls.deletes.length, 0);
    assert.equal(calls.puts.length, 0);
  });

  it("refuses to prune when the template has no seed — would otherwise empty the tenant", async () => {
    const repo = templateCopy();
    for (const p of Object.keys(repo.files)) if (p.startsWith("seed/")) delete repo.files[p];
    const calls = installFakeGitHub(repo);
    const result = await seed(repo);
    assert.equal(result.ok, false);
    assert.match(result.message, /No files found under seed\//);
    assert.equal(calls.deletes.length, 0);
    assert.notEqual(repo.files["content/collections/pages/nl/pricing.md"], undefined);
  });

  it("refuses to prune on a truncated tree — a partial view is not proof of absence", async () => {
    const repo = templateCopy();
    repo.truncated = true;
    const calls = installFakeGitHub(repo);
    const result = await seed(repo);
    assert.equal(result.ok, false);
    assert.match(result.message, /truncated/);
    assert.equal(calls.deletes.length, 0);
    assert.equal(calls.puts.length, 0);
  });

  it("requires token, owner and name", async () => {
    for (const bad of [
      { token: "", owner: "a", name: "b" },
      { token: "t", owner: "",  name: "b" },
      { token: "t", owner: "a", name: "" },
    ]) {
      const result = await seedNeutralContentIntoRepo(bad);
      assert.equal(result.ok, false);
      assert.deepEqual(result.seeded, []);
      assert.deepEqual(result.removed, []);
    }
  });

  it("a single failing write or delete is non-fatal — the rest still applies", async () => {
    const repo = templateCopy();
    repo.failWrites = ["content/collections/pages/nl/home.md", "content/collections/blog/nl/a-post.md"];
    installFakeGitHub(repo);
    const result = await seed(repo);
    assert.equal(result.ok, true);
    assert.ok(!result.seeded.includes("content/collections/pages/nl/home.md"));
    assert.ok(result.seeded.includes("content/collections/pages/nl/contact.md"));
    assert.ok(!result.removed.includes("content/collections/blog/nl/a-post.md"));
    assert.ok(result.removed.includes("content/collections/pages/nl/pricing.md"));
  });
});

// ── Backward compatibility ────────────────────────────────────────────────────

describe("seedNeutralPagesIntoRepo", () => {
  it("is still exported, pointing at the renamed function", () => {
    assert.equal(seedNeutralPagesIntoRepo, seedNeutralContentIntoRepo);
  });
});

// ── Seed root selection ───────────────────────────────────────────────────────

describe("seedNeutralContentIntoRepo — choosing a seed root", () => {
  let repo:  FakeRepo;
  let calls: Calls;
  beforeEach(() => { repo = templateCopy(); calls = installFakeGitHub(repo); });

  it("\"demo-seed\" applies the demo site and ignores the neutral seed", async () => {
    const result = await seed(repo, "demo-seed");
    assert.equal(result.ok, true);
    assert.deepEqual([...result.seeded].sort(), [
      "content/collections/blog/nl/acme-post.md",
      "content/collections/pages/nl/contact.md",
      "content/collections/pages/nl/diensten.md",
      "content/collections/pages/nl/home.md",
      "content/collections/testimonials/nl/t1.md",
      "content/globals/nl/site_settings.yaml",
      "content/navigation/main_nav.yaml",
      "content/trees/navigation/nl/main_nav.yaml",
      "public/assets/acme-logo.svg",
    ]);
    assert.equal(repo.files["content/collections/pages/nl/home.md"], "demo home");
    assert.equal(repo.files["public/assets/acme-logo.svg"],          "<svg>acme</svg>");
    // The neutral seed's files must not have been applied as well.
    assert.equal(repo.files["public/assets/placeholder-logo.svg"], undefined);
  });

  it("the default is still the neutral seed", async () => {
    await seed(repo);
    assert.equal(repo.files["content/collections/pages/nl/home.md"], "neutral home");
    assert.equal(repo.files["content/collections/pages/nl/diensten.md"], undefined);
  });

  it("prunes against the CHOSEN seed — demo entries survive, the rest go", async () => {
    const result = await seed(repo, "demo-seed");
    // Provided by the demo seed → kept.
    assert.ok(!result.removed.includes("content/collections/blog/nl/acme-post.md"));
    assert.ok(!result.removed.includes("content/collections/testimonials/nl/t1.md"));
    // The template's own entries → gone, including the ones the demo replaces.
    for (const gone of [
      "content/collections/pages/nl/pricing.md",
      "content/collections/blog/nl/a-post.md",
      "content/collections/testimonials/nl/quote-1.md",
      "content/collections/case_studies/nl/case-acme.md",
    ]) assert.ok(result.removed.includes(gone), `expected ${gone} to be removed`);
    // Collection config still survives.
    assert.equal(repo.files["content/collections/blog.yaml"], "handle: blog");
  });

  it("never copies a seed root's own README to the repo root", async () => {
    await seed(repo, "demo-seed");
    assert.ok(!calls.puts.map((p) => p.path).includes("README.md"));
  });

  it("refuses to prune when the chosen root is absent — a typo cannot empty a tenant", async () => {
    for (const p of Object.keys(repo.files)) if (p.startsWith("demo-seed/")) delete repo.files[p];
    const result = await seed(repo, "demo-seed");
    assert.equal(result.ok, false);
    assert.match(result.message, /No files found under demo-seed\//);
    assert.equal(calls.deletes.length, 0);
    assert.notEqual(repo.files["content/collections/pages/nl/pricing.md"], undefined);
  });

  it("refuses to prune on a truncated tree, whichever root is chosen", async () => {
    repo.truncated = true;
    const result = await seed(repo, "demo-seed");
    assert.equal(result.ok, false);
    assert.match(result.message, /truncated/);
    assert.equal(calls.deletes.length, 0);
  });
});

describe("seedDestination", () => {
  it("maps a seed path to its destination, stripping only the root", () => {
    assert.equal(seedDestination("seed/content/globals/nl/x.yaml", "seed"), "content/globals/nl/x.yaml");
    assert.equal(seedDestination("demo-seed/content/globals/nl/x.yaml", "demo-seed"), "content/globals/nl/x.yaml");
    assert.equal(seedDestination("demo-seed/public/assets/logo.svg", "demo-seed"), "public/assets/logo.svg");
  });

  it("ignores paths belonging to the other root", () => {
    assert.equal(seedDestination("seed/content/x.md", "demo-seed"), undefined);
    assert.equal(seedDestination("demo-seed/content/x.md", "seed"), undefined);
  });

  it("ignores anything outside content/ and public/", () => {
    assert.equal(seedDestination("seed/README.md", "seed"), undefined);
    assert.equal(seedDestination("seed/download-placeholders.sh", "seed"), undefined);
    assert.equal(seedDestination("seed/content/", "seed"), undefined); // the bare directory
  });
});
