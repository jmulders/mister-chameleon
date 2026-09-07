/**
 * Full tenant teardown: deleting a tenant must remove EVERY tenant-scoped row so
 * a reused slug starts clean, and must never touch another tenant's rows — the
 * sharp edge being `rules_config`, a shared key-value table keyed
 * `<type>_<tenantId>` with no tenant_id column.
 *
 * The DB is mocked: each delete records its (table, column, value) so we can
 * assert coverage and scoping without a database.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  deleteTenantScopedData,
  rulesConfigKeysForTenant,
  TENANT_SCOPED_TABLES,
  type TeardownDb,
} from "../../lib/provisioning/tenant-teardown.ts";

interface EqDelete { table: string; column: string; value: string }
interface InDelete { table: string; column: string; values: readonly string[] }

/** A mock TeardownDb that records every delete; `failTables` return an error. */
function mockDb(failTables: Set<string> = new Set()): {
  db: TeardownDb; eqs: EqDelete[]; ins: InDelete[];
} {
  const eqs: EqDelete[] = [];
  const ins: InDelete[] = [];
  const db: TeardownDb = {
    from(table: string) {
      return {
        delete() {
          return {
            async eq(column: string, value: string) {
              eqs.push({ table, column, value });
              return { error: failTables.has(table) ? { message: "boom" } : null };
            },
            async in(column: string, values: readonly string[]) {
              ins.push({ table, column, values });
              return { error: failTables.has(table) ? { message: "boom" } : null };
            },
          };
        },
      };
    },
  };
  return { db, eqs, ins };
}

describe("TENANT_SCOPED_TABLES", () => {
  it("excludes tenant_settings (deleted last) and tenant_dunning_settings (cascades)", () => {
    assert.ok(!TENANT_SCOPED_TABLES.includes("tenant_settings"));
    assert.ok(!TENANT_SCOPED_TABLES.includes("tenant_dunning_settings"));
  });
  it("covers the core tenant-scoped tables", () => {
    for (const t of ["tenant_domains", "adaptive_blocks", "experiments", "visitor_profiles", "form_submissions", "subscriptions", "admin_user_tenants"]) {
      assert.ok(TENANT_SCOPED_TABLES.includes(t), `missing ${t}`);
    }
  });
  it("has no duplicates", () => {
    assert.equal(new Set(TENANT_SCOPED_TABLES).size, TENANT_SCOPED_TABLES.length);
  });
});

describe("rulesConfigKeysForTenant", () => {
  it("returns the exact per-type keys for the tenant", () => {
    assert.deepEqual(rulesConfigKeysForTenant("test"), [
      "homepage_test", "retention_test", "self_service_test", "failure_signals_test",
    ]);
  });
  it("cannot collide with another tenant whose id shares a suffix", () => {
    // Exact keys for "test" never appear in the key set for "mytest".
    const test = new Set(rulesConfigKeysForTenant("test"));
    for (const k of rulesConfigKeysForTenant("mytest")) assert.ok(!test.has(k));
  });
});

describe("deleteTenantScopedData", () => {
  it("deletes from EVERY scoped table by tenant_id, plus the rules_config keys", async () => {
    const { db, eqs, ins } = mockDb();
    const { failures } = await deleteTenantScopedData(db, "test");

    assert.deepEqual(failures, []);
    // One eq-delete per scoped table, all on tenant_id = "test".
    assert.equal(eqs.length, TENANT_SCOPED_TABLES.length);
    assert.deepEqual([...new Set(eqs.map((e) => e.table))].sort(), [...TENANT_SCOPED_TABLES].sort());
    assert.ok(eqs.every((e) => e.column === "tenant_id" && e.value === "test"));
    // core tables the KLAAR-criteria names:
    for (const t of ["tenant_domains", "adaptive_blocks", "experiments", "visitor_profiles", "form_submissions"]) {
      assert.ok(eqs.some((e) => e.table === t), `no delete for ${t}`);
    }
    // rules_config deleted by EXACT keys, never tenant_settings.
    assert.equal(ins.length, 1);
    assert.equal(ins[0]!.table, "rules_config");
    assert.equal(ins[0]!.column, "key");
    assert.deepEqual([...ins[0]!.values].sort(), rulesConfigKeysForTenant("test").sort());
    assert.ok(!eqs.some((e) => e.table === "tenant_settings"), "must not touch tenant_settings");
  });

  it("NEVER touches another tenant's rows (exact keys, exact tenant_id)", async () => {
    const { db, eqs, ins } = mockDb();
    await deleteTenantScopedData(db, "test");
    // No eq value and no rules_config key references any other tenant id.
    assert.ok(eqs.every((e) => e.value === "test"));
    assert.ok((ins[0]!.values as string[]).every((k) => k.endsWith("_test")));
    // and specifically not the near-miss "mytest".
    assert.ok(!(ins[0]!.values as string[]).some((k) => k.includes("mytest")));
  });

  it("is best-effort: a failing table is collected but the sweep continues", async () => {
    const { db, eqs } = mockDb(new Set(["adaptive_blocks", "events"]));
    const res = await deleteTenantScopedData(db, "test");
    // every table was still attempted despite two failing
    assert.equal(eqs.length, TENANT_SCOPED_TABLES.length);
    assert.equal(res.failures.length, 2);
    assert.ok(res.failures.some((f) => f.startsWith("adaptive_blocks:")));
    assert.ok(res.failures.some((f) => f.startsWith("events:")));
  });

  it("collects a rules_config failure too", async () => {
    const { db } = mockDb(new Set(["rules_config"]));
    const res = await deleteTenantScopedData(db, "test");
    assert.ok(res.failures.some((f) => f.startsWith("rules_config:")));
  });
});
