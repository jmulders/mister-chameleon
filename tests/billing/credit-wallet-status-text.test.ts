/**
 * credit_wallet (6 arguments) and the text status column.
 *
 * tenant_wallets.status is a text column. The overload that addCredits() calls
 * cast one branch of a CASE to the enum wallet_status and left the other as
 * the column: Postgres refused the statement ("CASE types text and
 * wallet_status cannot be matched"), so every credit purchase and every plan
 * credit grant failed. Migration 192 leaves the literal untyped. The database
 * is the proof (it was run against the development database); this test keeps
 * the cast from coming back in a later rewrite of the function.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

const DIR = "supabase/migrations";

/** The newest migration that defines the 6-argument overload. */
function latestSixArgDefinition(): { file: string; sql: string } {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const file of files) {
    const sql = fs.readFileSync(`${DIR}/${file}`, "utf8");
    if (/CREATE OR REPLACE FUNCTION public\.credit_wallet\([^)]*p_credit_type/i.test(sql)) return { file, sql };
  }
  throw new Error("no migration defines credit_wallet with p_credit_type");
}

describe("credit_wallet with a text status column", () => {
  const { file, sql } = latestSixArgDefinition();
  const body = sql.slice(sql.search(/CREATE OR REPLACE FUNCTION public\.credit_wallet/i));

  it("the newest definition is the fix", () => {
    assert.equal(file, "20240101000192_credit_wallet_status_text.sql");
  });

  it("does not cast the reactivated status to the enum", () => {
    assert.doesNotMatch(body, /'active'::(public\.)?wallet_status/);
    assert.match(body, /WHEN public\.tenant_wallets\.status = 'suspended'\s+THEN 'active'\s+ELSE public\.tenant_wallets\.status/);
  });

  it("keeps the signature addCredits() calls", () => {
    assert.match(body, /p_tenant_id text, p_amount_cents numeric, p_reference text[^)]*p_note text[^)]*p_entry_type text[^)]*p_credit_type text/);
    const usage = fs.readFileSync("billing/usage.ts", "utf8");
    for (const arg of ["p_tenant_id", "p_amount_cents", "p_entry_type", "p_reference", "p_note", "p_credit_type"]) {
      assert.match(usage, new RegExp(`${arg}:`), `${arg} is passed by addCredits`);
    }
  });
});
