/**
 * The order of team members in a listing: the number the editor gave each
 * member, lowest first, whatever direction the block asks for.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { inTeamOrder }      from "@/cms/providers/team-order";
import { StatamicProvider } from "@/cms/providers/statamic-provider";

const member = (id: string) => ({ id });
const ids    = (items: Array<{ id: string }>) => items.map((item) => item.id);

describe("inTeamOrder", () => {
  it("puts the lowest number first, however the CMS returned the members", () => {
    // On 22 Nov 2026 saving one member moved that member to the end of /team:
    // the CMS returns entries by last change.
    const numbers: Record<string, number> = { lisa: 2, roos: 3, jasper: 1 };
    const sorted = inTeamOrder([member("lisa"), member("roos"), member("jasper")], (id) => numbers[id]);
    assert.deepEqual(ids(sorted), ["jasper", "lisa", "roos"]);
  });

  it("puts a member without a number last", () => {
    const numbers: Record<string, number | undefined> = { nieuw: undefined, lisa: 2, jasper: 1 };
    const sorted = inTeamOrder([member("nieuw"), member("lisa"), member("jasper")], (id) => numbers[id]);
    assert.deepEqual(ids(sorted), ["jasper", "lisa", "nieuw"]);
  });

  it("keeps members with the same number, or with none, in the order they came", () => {
    const numbers: Record<string, number | undefined> = { a: 1, b: 1, c: undefined, d: undefined };
    const sorted = inTeamOrder([member("b"), member("d"), member("a"), member("c")], (id) => numbers[id]);
    assert.deepEqual(ids(sorted), ["b", "a", "d", "c"]);
  });

  it("reads a number the CMS sent as text, and ignores what is not a number", () => {
    const numbers: Record<string, unknown> = { a: "2", b: 1, c: "eerste", d: "" };
    const sorted = inTeamOrder([member("c"), member("a"), member("d"), member("b")], (id) => numbers[id]);
    assert.deepEqual(ids(sorted), ["b", "a", "c", "d"]);
  });

  it("leaves the list it was given alone", () => {
    const given = [member("b"), member("a")];
    inTeamOrder(given, (id) => (id === "a" ? 1 : 2));
    assert.deepEqual(ids(given), ["b", "a"]);
  });
});

describe("the team listing in the Statamic provider", () => {
  // The members as the CMS returns them after Jasper's entry was saved last.
  const entries = [
    { id: "team-lisa",   slug: "team-lisa",   full_name: "Lisa van Dijk",  sort_order: 2 },
    { id: "team-roos",   slug: "team-roos",   full_name: "Roos Bakker",    sort_order: 3 },
    { id: "team-jasper", slug: "team-jasper", full_name: "Jasper Mulders", sort_order: 1 },
  ];
  const client   = { fetchAll: async (collection: string) => (collection === "team_members" ? entries : []) };
  const provider = new StatamicProvider(client as unknown as ConstructorParameters<typeof StatamicProvider>[0], [], null);
  const names    = async (sortDir: "asc" | "desc", limit?: number) =>
    (await provider.resolveCollection({ source: "collection", collection: "team_members", mode: "recent", sortDir, limit })).map((item) => item.title);

  it("shows the members by their number when the block asks for newest first", async () => {
    // The team page asks for "date, descending", the block's default.
    assert.deepEqual(await names("desc"), ["Jasper Mulders", "Lisa van Dijk", "Roos Bakker"]);
  });

  it("shows the same order when the block asks for ascending", async () => {
    // Before: sorted by number, then turned around with every other collection.
    assert.deepEqual(await names("asc"), ["Jasper Mulders", "Lisa van Dijk", "Roos Bakker"]);
  });

  it("cuts the list off after sorting", async () => {
    assert.deepEqual(await names("desc", 2), ["Jasper Mulders", "Lisa van Dijk"]);
  });
});
