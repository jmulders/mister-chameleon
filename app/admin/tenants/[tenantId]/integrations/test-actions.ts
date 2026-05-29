"use server";

/**
 * Tenant Integrations — GA4 Test Connection Server Actions
 *
 * Dedicated server actions for testing tenant-level GA4 connectivity.
 * Each action reads secrets from the stored tenant record (never from the
 * client) and attempts a minimal, read-safe API call.
 *
 * ─── Error taxonomy ──────────────────────────────────────────────────────────
 *
 *   "config"  — credentials/config not set (no API call attempted)
 *   "auth"    — HTTP 401 or 403 (bad key / expired token)
 *   "empty"   — credentials valid but API returned no usable data
 *   "network" — connection timeout, DNS failure, unexpected HTTP error
 *   "unknown" — catch-all for unexpected exceptions
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Secret values (apiSecret, serviceAccountJson) are read inside the action
 *   and used only for the outbound HTTP request.  They are never included in
 *   the returned result object.
 */

import { getTenantById } from "@/tenant/server";
import { testGa4Connection } from "@/enrichment/providers/ga4-history";

// ── Shared result type ────────────────────────────────────────────────────────

/** A single key/value field to display in the test result panel. */
export interface TestResultField {
  label: string;
  value: string | null;
}

/** Structured result returned by every test action. */
export type TestConnectionResult =
  | {
      ok:         true;
      fields:     TestResultField[];
      latencyMs:  number;
    }
  | {
      ok:         false;
      errorType:  "config" | "auth" | "empty" | "network" | "unknown";
      message:    string;
      latencyMs:  number;
    };

// ── GA4 Tracking test ─────────────────────────────────────────────────────────

/**
 * Test GA4 Tracking connectivity for a tenant.
 *
 * Validates that `measurementId` is set and correctly formatted, and that
 * `apiSecret` is present when sendMode === "server".
 * Does NOT fire a real event (no side effects in GA4).
 */
export async function testTenantGa4TrackingAction(
  tenantId: string,
): Promise<TestConnectionResult> {
  const start = Date.now();

  try {
    const stored = await getTenantById(tenantId);

    if (!stored) {
      return {
        ok:        false,
        errorType: "config",
        message:   `Tenant "${tenantId}" not found.`,
        latencyMs: Date.now() - start,
      };
    }

    const tracking = stored.ga4?.tracking;

    if (!tracking?.enabled) {
      return {
        ok:        false,
        errorType: "config",
        message:   "GA4 Tracking is disabled for this tenant.",
        latencyMs: Date.now() - start,
      };
    }

    if (!tracking.measurementId || tracking.measurementId.trim().length === 0) {
      return {
        ok:        false,
        errorType: "config",
        message:   "Measurement ID is not configured.",
        latencyMs: Date.now() - start,
      };
    }

    // Validate Measurement ID format.
    if (!/^G-[A-Z0-9]+$/i.test(tracking.measurementId)) {
      return {
        ok:        false,
        errorType: "config",
        message:   `Invalid Measurement ID format: "${tracking.measurementId}". Expected G-XXXXXXXXXX.`,
        latencyMs: Date.now() - start,
      };
    }

    const sendMode = tracking.sendMode ?? "off";

    if (sendMode === "off") {
      return {
        ok:        false,
        errorType: "config",
        message:   "Send mode is set to \"off\" — no events will be sent.",
        latencyMs: Date.now() - start,
      };
    }

    if (sendMode === "server") {
      if (!tracking.apiSecret || tracking.apiSecret.trim().length === 0) {
        return {
          ok:        false,
          errorType: "config",
          message:   "API Secret is required for server-side send mode but is not configured.",
          latencyMs: Date.now() - start,
        };
      }
    }

    // All config checks passed — return success with a config summary.
    return {
      ok:        true,
      latencyMs: Date.now() - start,
      fields:    [
        { label: "Measurement ID", value: tracking.measurementId },
        { label: "Send mode",      value: sendMode },
        { label: "Visitor ID param", value: tracking.visitorIdParamName ?? "visitor_id" },
        { label: "API Secret",     value: sendMode === "server" ? "configured ✓" : "n/a (client mode)" },
      ],
    };
  } catch (err) {
    return {
      ok:        false,
      errorType: "unknown",
      message:   err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

// ── GA4 History test ──────────────────────────────────────────────────────────

/**
 * Test GA4 Analytics History connectivity for a tenant.
 *
 * Reads the stored service account + property ID and calls the GA4 Data API
 * metadata endpoint to validate authentication and property access.
 */
export async function testTenantGa4HistoryAction(
  tenantId: string,
): Promise<TestConnectionResult> {
  const start = Date.now();

  try {
    const stored = await getTenantById(tenantId);

    if (!stored) {
      return {
        ok:        false,
        errorType: "config",
        message:   `Tenant "${tenantId}" not found.`,
        latencyMs: Date.now() - start,
      };
    }

    const history = stored.ga4?.history;

    if (!history?.enabled) {
      return {
        ok:        false,
        errorType: "config",
        message:   "GA4 Analytics History is disabled for this tenant.",
        latencyMs: Date.now() - start,
      };
    }

    const propertyId = history.propertyId?.trim() ?? "";
    const serviceAccountRaw = history.serviceAccountJson?.trim() ?? "";

    if (!propertyId) {
      return {
        ok:        false,
        errorType: "config",
        message:   "GA4 Property ID is not configured.",
        latencyMs: Date.now() - start,
      };
    }

    if (!serviceAccountRaw) {
      return {
        ok:        false,
        errorType: "config",
        message:   "Service account JSON is not configured.",
        latencyMs: Date.now() - start,
      };
    }

    // Parse the service account JSON.
    let serviceAccount: { client_email: string; private_key: string };
    try {
      serviceAccount = JSON.parse(serviceAccountRaw) as typeof serviceAccount;
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        return {
          ok:        false,
          errorType: "config",
          message:   "Service account JSON is missing required fields (client_email, private_key).",
          latencyMs: Date.now() - start,
        };
      }
    } catch {
      return {
        ok:        false,
        errorType: "config",
        message:   "Service account JSON is not valid JSON.",
        latencyMs: Date.now() - start,
      };
    }

    // Delegate to the shared GA4 connection tester.
    const result = await testGa4Connection(propertyId, serviceAccount);

    if (!result.ok) {
      return {
        ok:        false,
        errorType: result.errorType,
        message:   result.message,
        latencyMs: Date.now() - start,
      };
    }

    return {
      ok:        true,
      latencyMs: Date.now() - start,
      fields:    result.fields,
    };
  } catch (err) {
    return {
      ok:        false,
      errorType: "unknown",
      message:   err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}
