/**
 * The wallet settings routes write named fields only.
 *
 * They used to spread the request body into tenant_wallets.update(), so a
 * caller could set balance_cents or status. See billing/wallet-settings-input.ts.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { pickAutoReloadSettings, pickNotificationPrefs } from "../../billing/wallet-settings-input.ts";

describe("pickAutoReloadSettings", () => {
  it("keeps the four settings", () => {
    const r = pickAutoReloadSettings({
      tenantId: "t1",
      auto_reload_enabled: true,
      auto_reload_trigger_cents: 300,
      auto_reload_amount_cents: 2000,
      auto_reload_monthly_limit_cents: 10000,
    });
    assert.deepEqual(r, {
      ok: true,
      value: {
        auto_reload_enabled: true,
        auto_reload_trigger_cents: 300,
        auto_reload_amount_cents: 2000,
        auto_reload_monthly_limit_cents: 10000,
      },
    });
  });

  it("drops every other column", () => {
    const r = pickAutoReloadSettings({
      tenantId: "t1",
      auto_reload_enabled: false,
      balance_cents: 99_999_999,
      status: "active",
      stripe_payment_method_id: "pm_x",
      stripe_customer_id: "cus_x",
      notification_email: "x@example.com",
    });
    assert.deepEqual(r, { ok: true, value: { auto_reload_enabled: false } });
  });

  it("refuses a body with nothing to save", () => {
    assert.equal(pickAutoReloadSettings({ tenantId: "t1", balance_cents: 1 }).ok, false);
    assert.equal(pickAutoReloadSettings(null).ok, false);
    assert.equal(pickAutoReloadSettings([]).ok, false);
  });

  it("checks types and ranges", () => {
    assert.equal(pickAutoReloadSettings({ auto_reload_enabled: "yes" }).ok, false);
    assert.equal(pickAutoReloadSettings({ auto_reload_amount_cents: 99 }).ok, false);
    assert.equal(pickAutoReloadSettings({ auto_reload_amount_cents: 2000.5 }).ok, false);
    assert.equal(pickAutoReloadSettings({ auto_reload_amount_cents: "2000" }).ok, false);
    assert.equal(pickAutoReloadSettings({ auto_reload_trigger_cents: -1 }).ok, false);
    assert.equal(pickAutoReloadSettings({ auto_reload_amount_cents: 1e12 }).ok, false);
    assert.equal(
      pickAutoReloadSettings({ auto_reload_amount_cents: 5000, auto_reload_monthly_limit_cents: 2000 }).ok,
      false,
    );
  });
});

describe("pickNotificationPrefs", () => {
  it("keeps the five preferences and drops the rest", () => {
    const r = pickNotificationPrefs({
      tenantId: "t1",
      notify_email: true,
      notify_sms: false,
      notification_email: "billing@example.com",
      notification_phone: "+31 6 1234 5678",
      low_balance_threshold_cents: 500,
      balance_cents: 1,
      status: "blocked",
    });
    assert.deepEqual(r, {
      ok: true,
      value: {
        notify_email: true,
        notify_sms: false,
        notification_email: "billing@example.com",
        notification_phone: "+31 6 1234 5678",
        low_balance_threshold_cents: 500,
      },
    });
  });

  it("turns an emptied field into null", () => {
    assert.deepEqual(pickNotificationPrefs({ notification_email: "", notification_phone: "" }), {
      ok: true,
      value: { notification_email: null, notification_phone: null },
    });
  });

  it("refuses bad values", () => {
    assert.equal(pickNotificationPrefs({ notification_email: "not-an-address" }).ok, false);
    assert.equal(pickNotificationPrefs({ notification_email: 5 }).ok, false);
    assert.equal(pickNotificationPrefs({ notification_phone: "<script>" }).ok, false);
    assert.equal(pickNotificationPrefs({ notify_email: 1 }).ok, false);
    assert.equal(pickNotificationPrefs({ low_balance_threshold_cents: -5 }).ok, false);
    assert.equal(pickNotificationPrefs({ status: "active" }).ok, false);
  });
});
