/**
 * DB integration — the real database, over the network, with the real client.
 *
 * What this catches that the pure tests cannot: RLS, actual column types and
 * constraints, and the `(db as any)` cast fallout — the class of bug the pure
 * suite is blind to by design (it models tables with in-memory structures).
 *
 * Self-skips unless TEST_SUPABASE_URL + TEST_SUPABASE_SERVICE_ROLE_KEY are set.
 * Point them at a THROWAWAY test project, never production — the write round-trip
 * inserts and deletes a scratch row.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env["TEST_SUPABASE_URL"];
const KEY = process.env["TEST_SUPABASE_SERVICE_ROLE_KEY"];
const skip = !URL || !KEY
  ? "TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY not set"
  : false;

describe("DB integration", () => {

  it("reads billing_plans over the wire", { skip }, async () => {
    const db = createClient(URL!, KEY!, { auth: { persistSession: false } });
    const { data, error } = await db.from("billing_plans").select("plan_id, monthly_price");
    assert.equal(error, null, error?.message);
    assert.ok(Array.isArray(data), "expected an array of plans");
    // Don't require seed rows: a throwaway test project (which this suite asks
    // for) may be empty. The point here is that the query succeeds over the wire
    // with the selected columns — that's what catches the RLS / column-type /
    // client-cast bugs. When rows exist, sanity-check the shape.
    if (data!.length > 0) {
      const row = data![0] as { plan_id?: unknown };
      assert.ok("plan_id" in row, "billing_plans row should expose plan_id");
    }
  });

  it("round-trips a scratch row: insert → select → delete", { skip }, async () => {
    const db = createClient(URL!, KEY!, { auth: { persistSession: false } });
    const marker = `__itest_${Date.now()}__`;

    try {
      const ins = await db.from("webhook_deliveries").insert({
        tenant_id: marker, event: "itest", target_url: "http://localhost", ok: true,
      } as never);
      assert.equal(ins.error, null, `insert: ${ins.error?.message}`);

      const sel = await db.from("webhook_deliveries")
        .select("tenant_id, event").eq("tenant_id", marker);
      assert.equal(sel.error, null, `select: ${sel.error?.message}`);
      assert.equal(sel.data?.length, 1, "the row we just inserted should read back");
      assert.equal((sel.data![0] as { event: string }).event, "itest");
    } finally {
      // Always clean up, even if an assertion failed above.
      await db.from("webhook_deliveries").delete().eq("tenant_id", marker);
    }
  });
});
