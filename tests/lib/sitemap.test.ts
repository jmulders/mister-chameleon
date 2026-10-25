/**
 * /sitemap.xml and /robots.txt: the pure builders, and the Statamic provider's
 * list of indexable paths (which must match the routes the site serves).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { toSitemapEntries, robotsFor } from "@/lib/seo/sitemap";
import { StatamicProvider }            from "@/cms/providers/statamic-provider";
import type { StatamicClient }         from "@/cms/providers/statamic-client";

const ORIGIN = "https://www.misterchameleon.nl";

describe("toSitemapEntries", () => {
  it("always lists the homepage first", () => {
    const out = toSitemapEntries(ORIGIN, [{ path: "/pricing" }]);
    assert.deepEqual(out.map((e) => e.url), [`${ORIGIN}/`, `${ORIGIN}/pricing`]);
  });

  it("lists each path once and keeps the newest date", () => {
    const out = toSitemapEntries(ORIGIN, [
      { path: "/blog/a", lastModified: "2026-10-01T00:00:00Z" },
      { path: "/blog/a/", lastModified: "2026-10-20T00:00:00Z" },
      { path: "/", lastModified: "2026-10-05T00:00:00Z" },
    ]);
    assert.equal(out.length, 2);
    assert.equal((out[1].lastModified as Date).toISOString(), "2026-10-20T00:00:00.000Z");
    assert.equal((out[0].lastModified as Date).toISOString(), "2026-10-05T00:00:00.000Z");
  });

  it("drops paths that are not clean absolute paths", () => {
    const out = toSitemapEntries(ORIGIN, [
      { path: "https://evil.example/x" }, { path: "relative" }, { path: "//x" },
      { path: "/a b" }, { path: "/ok-path_1" },
    ]);
    assert.deepEqual(out.map((e) => e.url), [`${ORIGIN}/`, `${ORIGIN}/ok-path_1`]);
  });

  it("ignores an unparseable date", () => {
    const out = toSitemapEntries(ORIGIN, [{ path: "/x", lastModified: "gisteren" }]);
    assert.equal(out[1].lastModified, undefined);
  });
});

describe("robotsFor", () => {
  it("allows the site, keeps app areas out and points at this host's sitemap", () => {
    const r = robotsFor(ORIGIN);
    assert.equal(r.sitemap, `${ORIGIN}/sitemap.xml`);
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    assert.equal(rule.allow, "/");
    for (const p of ["/admin", "/dashboard", "/api/", "/checkout"]) {
      assert.ok((rule.disallow as string[]).includes(p), p);
    }
  });

  it("closes Vercel deployment hosts entirely", () => {
    const r = robotsFor("https://mister-chameleon-git-x-jmulders-projects.vercel.app");
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    assert.equal(rule.disallow, "/");
    assert.equal(r.sitemap, undefined);
  });
});

describe("StatamicProvider.listIndexablePaths", () => {
  function provider(collections: Record<string, unknown[] | Error>) {
    const client = {
      fetchAll: async (collection: string) => {
        const v = collections[collection];
        if (v instanceof Error) throw v;
        return v ?? [];
      },
    } as unknown as StatamicClient;
    return new StatamicProvider(client, undefined, null);
  }

  it("maps pages and collections to the routes the site serves", async () => {
    const paths = await provider({
      pages:        [{ id: "1", slug: "home" }, { id: "2", slug: "pricing", updated_at: 1760000000 }],
      blog:         [{ id: "3", slug: "eerste-post", updated_at: "2026-10-01T10:00:00+02:00" }],
      case_studies: [{ id: "4", slug: "acme" }],
      team_members: [{ id: "5", slug: "jasper" }],
      vacancies:    [{ id: "6", slug: "developer" }],
      events:       [{ id: "7", slug: "webinar" }],
    }).listIndexablePaths();
    assert.deepEqual(paths.map((p) => p.path).sort(), [
      "/", "/blog/eerste-post", "/cases/acme", "/events/webinar", "/pricing", "/team/jasper", "/vacancies/developer",
    ]);
    assert.equal(paths.find((p) => p.path === "/pricing")?.lastModified, new Date(1760000000 * 1000).toISOString());
    assert.equal(paths.find((p) => p.path === "/blog/eerste-post")?.lastModified, "2026-10-01T10:00:00+02:00");
  });

  it("leaves out noindex, unpublished and slugless entries", async () => {
    const paths = await provider({
      pages: [
        { id: "1", slug: "bedankt", robots_noindex: true },
        { id: "2", slug: "concept", published: false },
        { id: "3", slug: "" },
        { id: "4", slug: "contact" },
      ],
    }).listIndexablePaths();
    assert.deepEqual(paths.map((p) => p.path), ["/contact"]);
  });

  it("skips a collection that fails, not the whole list", async () => {
    const paths = await provider({ pages: [{ id: "1", slug: "contact" }], blog: new Error("500") }).listIndexablePaths();
    assert.deepEqual(paths.map((p) => p.path), ["/contact"]);
  });
});
