/**
 * A paid Checkout session is credited once, whoever reports it.
 *
 * The webhook and the browser returning to the success page both report the
 * same payment. They used to credit independently, and each reload of the
 * success page credited again. See billing/checkout-credit-claim.ts.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkoutCreditClaimKey,
  claimCheckoutCredit,
  creditCheckoutSessionOnce,
} from "../../billing/checkout-credit-claim.ts";

/** The one property that matters: stripe_event_id is unique. */
function fakeClient(opts: { failing?: boolean } = {}) {
  const rows = new Set<string>();
  const client = {
    from(table: string) {
      assert.equal(table, "wallet_webhook_events");
      return {
        upsert(row: { stripe_event_id: string }) {
          return {
            async select() {
              if (opts.failing) return { data: null, error: { message: "relation does not exist" } };
              if (rows.has(row.stripe_event_id)) return { data: [], error: null };
              rows.add(row.stripe_event_id);
              return { data: [{ stripe_event_id: row.stripe_event_id }], error: null };
            },
          };
        },
        delete() {
          return { async eq(_col: string, value: string) { rows.delete(value); return { error: null }; } };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, rows };
}

describe("claimCheckoutCredit", () => {
  it("is won once per session", async () => {
    const { client } = fakeClient();
    assert.equal(await claimCheckoutCredit(client, "cs_1", "t1", true, "credit_bundle"), "claimed");
    assert.equal(await claimCheckoutCredit(client, "cs_1", "t1", true, "credit_bundle"), "already-claimed");
    assert.equal(await claimCheckoutCredit(client, "cs_2", "t1", true, "credit_bundle"), "claimed");
  });

  it("uses a key that cannot collide with a real event id", () => {
    assert.equal(checkoutCreditClaimKey("cs_abc"), "credit:cs_abc");
  });

  it("reports when the claim table cannot be written", async () => {
    const { client } = fakeClient({ failing: true });
    assert.equal(await claimCheckoutCredit(client, "cs_1", "t1", true, "credit_bundle"), "unavailable");
  });
});

describe("creditCheckoutSessionOnce", () => {
  it("credits once when the webhook and the success page both report the payment", async () => {
    const { client } = fakeClient();
    let credited = 0;
    const credit = async () => { credited += 1000; };

    const webhook = await creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", credit);
    const page    = await creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", credit);
    const reload  = await creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", credit);

    assert.deepEqual([webhook, page, reload], ["credited", "already-credited", "already-credited"]);
    assert.equal(credited, 1000);
  });

  it("credits once when both arrive at the same moment", async () => {
    const { client } = fakeClient();
    let credited = 0;
    const credit = async () => { credited += 1000; };
    const results = await Promise.all([
      creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", credit),
      creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", credit),
    ]);
    assert.deepEqual(results.sort(), ["already-credited", "credited"]);
    assert.equal(credited, 1000);
  });

  it("gives the claim back when the credit fails, so a retry can credit", async () => {
    const { client, rows } = fakeClient();
    let attempts = 0;
    const flaky = async () => { attempts++; if (attempts === 1) throw new Error("wallet down"); };

    await assert.rejects(creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", flaky), /wallet down/);
    assert.equal(rows.size, 0);
    assert.equal(await creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", flaky), "credited");
    assert.equal(attempts, 2);
  });

  it("still credits when the claim table is unavailable", async () => {
    const { client } = fakeClient({ failing: true });
    let credited = 0;
    const outcome = await creditCheckoutSessionOnce(client, "cs_1", "t1", true, "credit_bundle", async () => { credited++; });
    assert.equal(outcome, "credited");
    assert.equal(credited, 1);
  });
});
