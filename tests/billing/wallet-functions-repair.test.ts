/**
 * Migration 194: six wallet functions that could not run.
 *
 * Five still cast a status literal to the enum wallet_status while the column
 * is text, so Postgres refused them ("CASE types text and wallet_status cannot
 * be matched"). One counted changed rows into a boolean and compared it with
 * zero ("operator does not exist: boolean > integer"), which undid its own
 * update. The proof is the development database, where a paid and a failed
 * automatic top-up now complete. This test keeps the two faults from coming
 * back in a later rewrite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

const sql = fs.readFileSync("supabase/migrations/20240101000194_wallet_functions_repair.sql", "utf8");
// The statements only: the comments quote the old, faulty lines on purpose.
const body = sql
  .slice(sql.indexOf("CREATE OR REPLACE FUNCTION"))
  .split("\n")
  .filter((line) => !line.startsWith("--"))
  .join("\n");

describe("wallet functions repair", () => {
  it("redefines the six functions, and leaves debit_wallet alone", () => {
    const names = [...body.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_]+)\(/g)].map((m) => m[1]);
    assert.deepEqual(names.sort(), [
      "process_wallet_reload_failure",
      "process_wallet_reload_success",
      "sim_credit_wallet",
      "sim_debit_wallet",
      "sim_set_wallet_balance",
      "sim_trigger_reload_success",
    ]);
  });

  it("casts no literal to wallet_status any more", () => {
    assert.doesNotMatch(body, /::(public\.)?wallet_status/);
    assert.match(body, /WHEN public\.tenant_wallets\.status = 'suspended'\s+THEN 'active'\s+ELSE public\.tenant_wallets\.status/);
  });

  it("counts the changed rows in an integer", () => {
    assert.match(body, /DECLARE v_updated integer;/);
    assert.doesNotMatch(body, /v_updated boolean/);
    assert.match(body, /GET DIAGNOSTICS v_updated = ROW_COUNT;\s+RETURN v_updated > 0;/);
  });

  it("keeps the signatures the code calls", () => {
    assert.match(body, /process_wallet_reload_failure\(p_attempt_id uuid, p_new_status reload_attempt_status, p_failure_reason text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text\)/);
    const attempts = fs.readFileSync("billing/wallet-reload-attempts.ts", "utf8");
    for (const arg of ["p_attempt_id", "p_new_status", "p_failure_reason", "p_stripe_payment_intent_id"]) {
      assert.match(attempts, new RegExp(`${arg}:`));
    }
  });
});
