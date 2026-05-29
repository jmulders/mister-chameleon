/**
 * billing/wallet-test-mode.ts
 *
 * Wallet test-mode / sandbox helpers.
 *
 * ─── What test mode is ────────────────────────────────────────────────────────
 *
 *   Each tenant wallet has a `test_mode` column ('live' | 'test_simulated').
 *   When set to 'test_simulated':
 *     • All balance changes use sim_* Postgres RPCs — never real Stripe.
 *     • Ledger entries are prefixed [SIM] and use sim_* entry types.
 *     • Enrichment blocking logic still runs against the real wallet state,
 *       so you can test blocking behaviour without real money.
 *     • Auto-reload simulation creates real wallet_reload_attempts rows and
 *       real ledger entries — just with simulated amounts.
 *
 * ─── Guard: test mode must be enabled ────────────────────────────────────────
 *
 *   ENABLE_BILLING_TEST_MODE=true must be set in the environment.
 *   Test mode actions always reject (403) when this flag is absent.
 *   This prevents accidental use in production environments where the
 *   env var is never set.
 *
 *   Additionally, every sim_* Postgres RPC checks test_mode = 'test_simulated'
 *   before executing, providing a second layer of safety at the DB level.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantWallet }   from "./types";

// ── Feature flag ───────────────────────────────────────────────────────────────

/**
 * Returns true when the ENABLE_BILLING_TEST_MODE environment variable is set
 * to "true".  This is the master gate for all test-mode functionality.
 *
 * Never expose this value to the client (it's derived from a server-only env var).
 */
export function isTestModeEnabled(): boolean {
  return process.env["ENABLE_BILLING_TEST_MODE"] === "true";
}

/**
 * Throw a descriptive error if test mode is not enabled.
 * Call at the top of every test-mode API route handler.
 */
export function assertTestModeEnabled(): void {
  if (!isTestModeEnabled()) {
    throw new Error(
      "[billing/wallet-test-mode] ENABLE_BILLING_TEST_MODE is not set to 'true'. " +
      "Add ENABLE_BILLING_TEST_MODE=true to your environment to use test-mode features.",
    );
  }
}

// ── Enable / disable test mode for a wallet ───────────────────────────────────

/**
 * Enable test_simulated mode for a wallet.
 * After this call the wallet accepts sim_* operations and real Stripe is bypassed.
 *
 * If the wallet doesn't exist yet it is lazily created in test_simulated mode
 * with a zero balance.
 */
export async function enableWalletTestMode(
  client:   SupabaseClient,
  tenantId: string,
): Promise<TenantWallet> {
  assertTestModeEnabled();

  const { data, error } = await client
    .from("tenant_wallets")
    .upsert(
      {
        tenant_id: tenantId,
        test_mode: "test_simulated",
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "tenant_id" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `[billing/wallet-test-mode] enableWalletTestMode failed: ${error.message} (code: ${error.code})`,
    );
  }

  console.info("[billing/wallet-test-mode] test mode enabled", { tenantId });
  return data as TenantWallet;
}

/**
 * Disable test_simulated mode, reverting the wallet to 'live'.
 *
 * WARNING: This does NOT clear any simulated balance.  The caller should
 * manually zero the balance before switching back to live to avoid a phantom
 * balance entering production.
 */
export async function disableWalletTestMode(
  client:   SupabaseClient,
  tenantId: string,
): Promise<void> {
  assertTestModeEnabled();

  const { error } = await client
    .from("tenant_wallets")
    .update({ test_mode: "live", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(
      `[billing/wallet-test-mode] disableWalletTestMode failed: ${error.message} (code: ${error.code})`,
    );
  }

  console.info("[billing/wallet-test-mode] test mode disabled", { tenantId });
}

// ── Simulated balance operations ──────────────────────────────────────────────

/**
 * Set the wallet balance to an exact amount (cents).
 * Creates a [SIM] ledger entry explaining the change.
 * Automatically suspends the wallet when set to 0, reactivates when > 0.
 *
 * @returns New balance_cents.
 */
export async function simSetBalance(
  client:      SupabaseClient,
  tenantId:    string,
  balanceCents: number,
  note?:       string,
): Promise<number> {
  assertTestModeEnabled();

  if (balanceCents < 0) {
    throw new Error("[billing/wallet-test-mode] simSetBalance: balanceCents must be ≥ 0");
  }

  const { data, error } = await client.rpc("sim_set_wallet_balance", {
    p_tenant_id:     tenantId,
    p_balance_cents: balanceCents,
    p_note:          note ?? null,
  });

  if (error) {
    if (error.message?.includes("wallet_not_in_test_mode")) {
      throw new Error(
        `[billing/wallet-test-mode] simSetBalance: wallet "${tenantId}" is not in test_simulated mode. ` +
        "Call enableWalletTestMode() first.",
      );
    }
    throw new Error(
      `[billing/wallet-test-mode] simSetBalance RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  const newBalance = typeof data === "number" ? data : balanceCents;
  console.info("[billing/wallet-test-mode] simSetBalance", { tenantId, balanceCents, newBalance });
  return newBalance;
}

/**
 * Add a simulated top-up (positive credit) to the wallet.
 * Creates a sim_top_up ledger entry marked [SIM].
 *
 * @returns New balance_cents.
 */
export async function simTopUp(
  client:      SupabaseClient,
  tenantId:    string,
  amountCents: number,
  note?:       string,
): Promise<number> {
  assertTestModeEnabled();

  if (amountCents <= 0) {
    throw new Error("[billing/wallet-test-mode] simTopUp: amountCents must be > 0");
  }

  const { data, error } = await client.rpc("sim_credit_wallet", {
    p_tenant_id:    tenantId,
    p_amount_cents: amountCents,
    p_note:         note ?? null,
  });

  if (error) {
    if (error.message?.includes("wallet_not_in_test_mode")) {
      throw new Error(
        `[billing/wallet-test-mode] simTopUp: wallet "${tenantId}" is not in test_simulated mode.`,
      );
    }
    throw new Error(
      `[billing/wallet-test-mode] simTopUp RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  const newBalance = typeof data === "number" ? data : 0;
  console.info("[billing/wallet-test-mode] simTopUp", { tenantId, amountCents, newBalance });
  return newBalance;
}

/**
 * Remove a simulated debit from the wallet (does not check for sufficient balance).
 * Creates a sim_debit ledger entry marked [SIM].
 * Suspends the wallet when balance reaches 0.
 *
 * @returns New balance_cents.
 */
export async function simDebit(
  client:      SupabaseClient,
  tenantId:    string,
  amountCents: number,
  note?:       string,
): Promise<number> {
  assertTestModeEnabled();

  if (amountCents <= 0) {
    throw new Error("[billing/wallet-test-mode] simDebit: amountCents must be > 0");
  }

  const { data, error } = await client.rpc("sim_debit_wallet", {
    p_tenant_id:    tenantId,
    p_amount_cents: amountCents,
    p_note:         note ?? null,
  });

  if (error) {
    if (error.message?.includes("wallet_not_in_test_mode")) {
      throw new Error(
        `[billing/wallet-test-mode] simDebit: wallet "${tenantId}" is not in test_simulated mode.`,
      );
    }
    throw new Error(
      `[billing/wallet-test-mode] simDebit RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  const newBalance = typeof data === "number" ? data : 0;
  console.info("[billing/wallet-test-mode] simDebit", { tenantId, amountCents, newBalance });
  return newBalance;
}

// ── Convenience shortcuts ─────────────────────────────────────────────────────

/**
 * Shortcut: set balance to the wallet's low_balance_threshold_cents - 1
 * so the next enrichment debit would trigger a low-balance notification.
 */
export async function simSetLowBalance(
  client:   SupabaseClient,
  tenantId: string,
): Promise<number> {
  assertTestModeEnabled();

  // Read the current threshold first.
  const { data: wallet, error } = await client
    .from("tenant_wallets")
    .select("low_balance_threshold_cents, test_mode")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !wallet) {
    throw new Error(
      `[billing/wallet-test-mode] simSetLowBalance: wallet not found for tenant "${tenantId}"`,
    );
  }

  const w = wallet as { low_balance_threshold_cents: number; test_mode: string };
  if (w.test_mode !== "test_simulated") {
    throw new Error(
      `[billing/wallet-test-mode] simSetLowBalance: wallet "${tenantId}" is not in test_simulated mode.`,
    );
  }

  // Set balance to threshold - 1¢ so it's below threshold.
  const targetCents = Math.max(0, w.low_balance_threshold_cents - 1);
  return simSetBalance(client, tenantId, targetCents, "[SIM] Low balance test");
}

/**
 * Shortcut: set balance to 0, which suspends the wallet immediately
 * and causes all subsequent enrichment guards to block billable stages.
 */
export async function simEmptyWallet(
  client:   SupabaseClient,
  tenantId: string,
): Promise<number> {
  return simSetBalance(client, tenantId, 0, "[SIM] Empty wallet test");
}

// ── Auto-reload simulation ────────────────────────────────────────────────────

/**
 * Simulate a successful auto-reload.
 *
 * Creates a wallet_reload_attempts row with status='succeeded' and a
 * sim_auto_reload ledger entry.  Credits the wallet.
 *
 * No Stripe call is made.
 *
 * @param amountCents  Reload amount in cents.  Defaults to wallet's auto_reload_amount_cents.
 * @returns New balance_cents.
 */
export async function simAutoReloadSuccess(
  client:       SupabaseClient,
  tenantId:     string,
  amountCents?: number,
): Promise<number> {
  assertTestModeEnabled();

  const { data, error } = await client.rpc("sim_trigger_reload_success", {
    p_tenant_id:    tenantId,
    p_amount_cents: amountCents ?? null,
  });

  if (error) {
    if (error.message?.includes("wallet_not_in_test_mode")) {
      throw new Error(
        `[billing/wallet-test-mode] simAutoReloadSuccess: wallet "${tenantId}" is not in test_simulated mode.`,
      );
    }
    throw new Error(
      `[billing/wallet-test-mode] simAutoReloadSuccess RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  const newBalance = typeof data === "number" ? data : 0;
  console.info("[billing/wallet-test-mode] simAutoReloadSuccess", { tenantId, newBalance });

  // Fire the success notification so the full notification path is tested.
  try {
    const { notifyAutoReloadSuccess } = await import("./notifications");
    await notifyAutoReloadSuccess(client, tenantId, amountCents ?? 0, newBalance);
  } catch {
    // Non-fatal.
  }

  return newBalance;
}

/**
 * Simulate a failed auto-reload.
 *
 * Creates a wallet_reload_attempts row with status='failed' and a
 * sim_failed_reload ledger entry.  Does NOT credit the wallet.
 *
 * No Stripe call is made.
 */
export async function simAutoReloadFailure(
  client:        SupabaseClient,
  tenantId:      string,
  failureReason  = "Simulated card decline",
): Promise<void> {
  assertTestModeEnabled();

  const { error } = await client.rpc("sim_trigger_reload_failure", {
    p_tenant_id:      tenantId,
    p_failure_reason: failureReason,
    p_status:         "failed",
  });

  if (error) {
    if (error.message?.includes("wallet_not_in_test_mode")) {
      throw new Error(
        `[billing/wallet-test-mode] simAutoReloadFailure: wallet "${tenantId}" is not in test_simulated mode.`,
      );
    }
    throw new Error(
      `[billing/wallet-test-mode] simAutoReloadFailure RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  console.info("[billing/wallet-test-mode] simAutoReloadFailure", { tenantId, failureReason });

  // Fire failure notification so the full notification path is tested.
  try {
    const { notifyAutoReloadFailure } = await import("./notifications");
    await notifyAutoReloadFailure(client, tenantId, failureReason);
  } catch {
    // Non-fatal.
  }
}

/**
 * Simulate a reload that requires 3DS action.
 *
 * Creates a wallet_reload_attempts row with status='action_required'.
 * Does NOT credit the wallet.
 *
 * No Stripe call is made.
 */
export async function simAutoReloadActionRequired(
  client:   SupabaseClient,
  tenantId: string,
): Promise<void> {
  assertTestModeEnabled();

  const { error } = await client.rpc("sim_trigger_reload_failure", {
    p_tenant_id:      tenantId,
    p_failure_reason: "3DS authentication required (simulated)",
    p_status:         "action_required",
  });

  if (error) {
    if (error.message?.includes("wallet_not_in_test_mode")) {
      throw new Error(
        `[billing/wallet-test-mode] simAutoReloadActionRequired: wallet "${tenantId}" is not in test_simulated mode.`,
      );
    }
    throw new Error(
      `[billing/wallet-test-mode] simAutoReloadActionRequired RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  console.info("[billing/wallet-test-mode] simAutoReloadActionRequired", { tenantId });

  // Fire action-required notification.
  try {
    const { notifyActionRequired } = await import("./notifications");
    await notifyActionRequired(client, tenantId, "sim_pi_action_required");
  } catch {
    // Non-fatal.
  }
}
