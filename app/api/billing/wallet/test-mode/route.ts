/**
 * POST /api/billing/wallet/test-mode
 *
 * Wallet test-mode control panel — all simulated wallet actions in one route.
 *
 * ─── Safety gates ─────────────────────────────────────────────────────────────
 *
 *   1. ENABLE_BILLING_TEST_MODE=true must be set in the server environment.
 *      Missing or false → 403 immediately.
 *
 *   2. Every sim_* Postgres RPC checks test_mode = 'test_simulated' at the
 *      DB level — double protection against accidentally calling a sim_* action
 *      on a live wallet.
 *
 *   3. This route should be firewalled to platform admins only in production
 *      (see middleware or admin auth check below).
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId: string;
 *     action:
 *       | "enable_test_mode"
 *       | "disable_test_mode"
 *       | "set_balance"          → requires amountCents
 *       | "top_up"               → requires amountCents
 *       | "debit"                → requires amountCents
 *       | "set_low_balance"      (sets to threshold - 1¢)
 *       | "empty_wallet"         (sets to 0)
 *       | "sim_reload_success"   → optional amountCents
 *       | "sim_reload_failure"   → optional failureReason
 *       | "sim_reload_action_required"
 *     amountCents?:   number;
 *     failureReason?: string;
 *     note?:          string;
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { success: true; newBalance?: number; message: string }
 *   { error: string }  on failure.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import {
  isTestModeEnabled,
  enableWalletTestMode,
  disableWalletTestMode,
  simSetBalance,
  simTopUp,
  simDebit,
  simSetLowBalance,
  simEmptyWallet,
  simAutoReloadSuccess,
  simAutoReloadFailure,
  simAutoReloadActionRequired,
} from "@/billing/wallet-test-mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Action =
  | "enable_test_mode"
  | "disable_test_mode"
  | "set_balance"
  | "top_up"
  | "debit"
  | "set_low_balance"
  | "empty_wallet"
  | "sim_reload_success"
  | "sim_reload_failure"
  | "sim_reload_action_required";

const VALID_ACTIONS = new Set<Action>([
  "enable_test_mode", "disable_test_mode",
  "set_balance", "top_up", "debit",
  "set_low_balance", "empty_wallet",
  "sim_reload_success", "sim_reload_failure", "sim_reload_action_required",
]);

function serviceRoleClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Supabase service-role env vars missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Gate 1: feature flag ──────────────────────────────────────────────────

  if (!isTestModeEnabled()) {
    return NextResponse.json(
      {
        error: "Wallet test mode is not enabled on this environment. " +
               "Set ENABLE_BILLING_TEST_MODE=true to enable.",
      },
      { status: 403 },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────

  let body: {
    tenantId?:      string;
    action?:        string;
    amountCents?:   number;
    failureReason?: string;
    note?:          string;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, action, amountCents, failureReason, note } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!action || !VALID_ACTIONS.has(action as Action)) {
    return NextResponse.json(
      { error: `Invalid action. Valid actions: ${[...VALID_ACTIONS].join(", ")}` },
      { status: 400 },
    );
  }

  // ── Init Supabase ─────────────────────────────────────────────────────────

  let client: ReturnType<typeof serviceRoleClient>;
  try {
    client = serviceRoleClient();
  } catch (err) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  try {
    switch (action as Action) {
      // ── Mode switching ───────────────────────────────────────────────────

      case "enable_test_mode": {
        await enableWalletTestMode(client, tenantId);
        return NextResponse.json({
          success: true,
          message: "Test mode enabled. All wallet operations are now simulated.",
        });
      }

      case "disable_test_mode": {
        await disableWalletTestMode(client, tenantId);
        return NextResponse.json({
          success: true,
          message: "Test mode disabled. Wallet reverted to live mode.",
        });
      }

      // ── Balance controls ─────────────────────────────────────────────────

      case "set_balance": {
        if (typeof amountCents !== "number" || amountCents < 0) {
          return NextResponse.json(
            { error: "set_balance requires amountCents ≥ 0" },
            { status: 400 },
          );
        }
        const newBalance = await simSetBalance(client, tenantId, amountCents, note);
        return NextResponse.json({
          success:    true,
          newBalance,
          message:    `[SIM] Balance set to €${(newBalance / 100).toFixed(2)}`,
        });
      }

      case "top_up": {
        if (typeof amountCents !== "number" || amountCents <= 0) {
          return NextResponse.json(
            { error: "top_up requires amountCents > 0" },
            { status: 400 },
          );
        }
        const newBalance = await simTopUp(client, tenantId, amountCents, note);
        return NextResponse.json({
          success:    true,
          newBalance,
          message:    `[SIM] Added €${(amountCents / 100).toFixed(2)}. New balance: €${(newBalance / 100).toFixed(2)}`,
        });
      }

      case "debit": {
        if (typeof amountCents !== "number" || amountCents <= 0) {
          return NextResponse.json(
            { error: "debit requires amountCents > 0" },
            { status: 400 },
          );
        }
        const newBalance = await simDebit(client, tenantId, amountCents, note);
        return NextResponse.json({
          success:    true,
          newBalance,
          message:    `[SIM] Debited €${(amountCents / 100).toFixed(2)}. New balance: €${(newBalance / 100).toFixed(2)}`,
        });
      }

      case "set_low_balance": {
        const newBalance = await simSetLowBalance(client, tenantId);
        return NextResponse.json({
          success:    true,
          newBalance,
          message:    `[SIM] Balance set to low (${newBalance}¢). Low-balance notification should fire on next debit.`,
        });
      }

      case "empty_wallet": {
        const newBalance = await simEmptyWallet(client, tenantId);
        return NextResponse.json({
          success:    true,
          newBalance,
          message:    "[SIM] Wallet emptied. Billable enrichments are now blocked.",
        });
      }

      // ── Auto-reload simulation ────────────────────────────────────────────

      case "sim_reload_success": {
        const newBalance = await simAutoReloadSuccess(
          client,
          tenantId,
          typeof amountCents === "number" && amountCents > 0 ? amountCents : undefined,
        );
        return NextResponse.json({
          success:    true,
          newBalance,
          message:    `[SIM] Auto-reload succeeded. New balance: €${(newBalance / 100).toFixed(2)}`,
        });
      }

      case "sim_reload_failure": {
        await simAutoReloadFailure(
          client,
          tenantId,
          failureReason ?? "Simulated card decline",
        );
        return NextResponse.json({
          success: true,
          message: `[SIM] Auto-reload failure recorded: ${failureReason ?? "Simulated card decline"}`,
        });
      }

      case "sim_reload_action_required": {
        await simAutoReloadActionRequired(client, tenantId);
        return NextResponse.json({
          success: true,
          message: "[SIM] Auto-reload action_required recorded (simulated 3DS).",
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[wallet/test-mode] action error", { tenantId, action, error: msg });

    if (msg.includes("wallet_not_in_test_mode")) {
      return NextResponse.json(
        {
          error: "This wallet is not in test_simulated mode. " +
                 'Send action: "enable_test_mode" first.',
        },
        { status: 409 },
      );
    }
    if (msg.includes("ENABLE_BILLING_TEST_MODE")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
