/**
 * The visit limits of the plans say the same thing everywhere.
 *
 * The number a plan includes stands in the plan definition (the fallback the
 * cap is computed from), in the table the cap is really computed from (set by
 * migration 189), on the price list in two languages, in the description for
 * search engines, in the calculator and in the tenant guide. When the owner
 * lowered them on 27 Nov 2026 they had to change in all of those at once.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import { BILLING_PLANS } from "../../billing/plans.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");
const limit = (id: "starter" | "growth" | "pro") => BILLING_PLANS[id].limits.personalizedSessionsPerMonth;
const nl = (n: number) => n.toLocaleString("nl-NL");
const en = (n: number) => n.toLocaleString("en-GB");
const IDS = ["starter", "growth", "pro"] as const;

describe("plan visit limits", () => {
  it("migration 189 sets the table to what the plan definition holds", () => {
    const sql = read("supabase/migrations/20240101000189_plan_visit_limits.sql");
    for (const id of IDS) {
      const statement = sql.split("UPDATE billing_plans").find((part) => part.includes(`WHERE plan_id = '${id}'`));
      assert.ok(statement, `update for ${id} found`);
      const json = /\|\| '(\{[^']+\})'::jsonb/.exec(statement);
      assert.ok(json, `limits for ${id} found`);
      assert.deepEqual(JSON.parse(json[1]), { personalizedSessionsPerMonth: limit(id) });
    }
    // The three plans the price list sells, and no other row.
    assert.equal(sql.split("UPDATE billing_plans").length - 1, 3);
  });

  it("the price list names the same numbers, in Dutch and in English", () => {
    const shop = read("lib/site-texts/shop.ts");
    for (const id of IDS) {
      assert.ok(shop.includes(`"${nl(limit(id))} gepersonaliseerde bezoeken per maand"`), `${id} in Dutch`);
      assert.ok(shop.includes(`"${en(limit(id))} personalised sessions/month"`), `${id} in English`);
    }
    for (const old of ["25.000", "150.000", "500.000", "25,000", "150,000", "500,000"]) {
      assert.equal(shop.includes(`"${old} `), false, `${old} is gone from the price list`);
    }
  });

  it("the description for search engines names what Starter includes", () => {
    const page = read("app/(site)/prijzen/page.tsx");
    assert.ok(page.includes(`voor ${nl(limit("starter"))} gepersonaliseerde bezoeken`));
  });

  it("the calculator starts at what Starter includes", () => {
    const calculator = read("app/(site)/prijzen/_components/CreditCalculator.tsx");
    const start = /useState\(([\d_]+)\);\s*\n\s*const \[consent/.exec(calculator)?.[1] ?? "";
    assert.equal(Number(start.replace(/_/g, "")), limit("starter"));
  });

  it("the plan descriptions and the tenant guide name the same numbers", () => {
    for (const id of IDS) {
      assert.ok(BILLING_PLANS[id].description.includes(`Up to ${en(limit(id))} `), `${id} description`);
    }
    const guide = read("docs/tenant-handleiding.md");
    for (const id of IDS) {
      assert.match(guide, new RegExp(`\\| ${BILLING_PLANS[id].name} \\|[^\\n]*\\| ${nl(limit(id)).replace(".", "\\.")} \\|`), `${id} in the guide`);
    }
  });
});
