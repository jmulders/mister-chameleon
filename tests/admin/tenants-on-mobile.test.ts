/**
 * The tenants overview on a phone. Seen on 28 Nov 2026: the seven-column table
 * ran off the screen, and its buttons only showed on hover, which a touch
 * screen does not have.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

const table = readFileSync("app/admin/tenants/_components/TenantsTable.tsx", "utf8");
const page  = readFileSync("app/admin/tenants/page.tsx", "utf8");

describe("tenants overview on a phone", () => {
  it("shows cards below md and the table from md up", () => {
    assert.match(table, /<ul className="divide-y divide-neutral-100 md:hidden" data-part="tenant-cards">/);
    assert.match(table, /<table className="hidden w-full text-left md:table">/);
  });

  it("keeps the Open button visible on a card", () => {
    const cards = table.slice(table.indexOf('data-part="tenant-cards"'), table.indexOf("<table"));
    assert.match(cards, /<OpenLink tenantId=\{tenant\.tenantId\} \/>/);
    assert.doesNotMatch(cards, /opacity-0/);
  });

  it("shows the row buttons on keyboard focus too, not only on hover", () => {
    assert.match(table, /group-hover:opacity-100 group-focus-within:opacity-100/);
  });

  it("shows the delete button to a super admin only, in both layouts", () => {
    assert.equal((table.match(/\{superAdmin && \(\s*<TenantDeleteButton/g) ?? []).length, 2);
    assert.match(page, /<TenantsTable tenants=\{tenants\} superAdmin=\{superAdmin\} \/>/);
  });

  it("gives the page header a narrow gutter on a phone", () => {
    assert.match(page, /bg-white px-4 py-6 sm:px-8/);
  });
});
