/**
 * Failure Signal Store — the "did something fail silently?" layer.
 *
 * The three places where a personalization platform fails quietly are form
 * storage, mail sending, and the decide path. Each already degrades safely
 * (fail-open), which is good for the visitor but means an operator never finds
 * out. This layer records those failures so they become visible in the admin.
 *
 * It is deliberately separate from the score/rule diagnostics: those tell you
 * whether the system is DISCRIMINATING; this tells you whether it is BREAKING.
 *
 * Storage: a capped, newest-first ring buffer per tenant in the generic
 * `rules_config` key/value table under "failure_signals_<tenantId>" — no
 * migration needed. Failures are rare, so a read-modify-write append is fine.
 * recordFailureSignal is fire-and-forget and never throws; it must never turn
 * a handled failure into an unhandled one.
 */

import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

export type FailureSurface = "storage" | "mail" | "decide";

export interface FailureSignal {
  surface: FailureSurface;
  message: string;
  at:      string; // ISO
}

/** How many recent failures to keep per tenant. */
export const FAILURE_BUFFER_CAP = 100;

function failureKey(tenantId: string): string {
  return `failure_signals_${tenantId}`;
}

type SingleResult<T> = { data: T | null; error: { message: string } | null };
function asSingle<T>(result: unknown): SingleResult<T> { return result as SingleResult<T>; }

/**
 * Record one failure. Fire-and-forget: callers should NOT await this on the hot
 * path (or may await without try/catch — it never throws). Best-effort append.
 */
export async function recordFailureSignal(input: {
  tenantId: string;
  surface:  FailureSurface;
  message:  string;
}): Promise<void> {
  const { tenantId, surface } = input;
  if (!tenantId) return;

  try {
    const db = getDb();
    const { data } = asSingle<{ config: { signals?: FailureSignal[] } }>(
      await db.from("rules_config").select("config").eq("key", failureKey(tenantId)).maybeSingle(),
    );

    const existing = Array.isArray(data?.config?.signals) ? data!.config!.signals! : [];
    const entry: FailureSignal = {
      surface,
      message: String(input.message ?? "").slice(0, 300),
      at:      new Date().toISOString(),
    };
    const signals = [entry, ...existing].slice(0, FAILURE_BUFFER_CAP);
    const updatedAt = entry.at;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from("rules_config")
      .upsert(
        { key: failureKey(tenantId), config: { signals, updatedAt }, updated_at: updatedAt },
        { onConflict: "key" },
      );
  } catch (err) {
    // Never let observability break the thing it observes.
    logger.warn("[observability] recordFailureSignal failed", {
      tenantId, surface, err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Read recent failures for a tenant, newest first. Never throws. */
export async function getFailureSignals(tenantId: string, limit = FAILURE_BUFFER_CAP): Promise<FailureSignal[]> {
  if (!tenantId) return [];
  try {
    const { data, error } = asSingle<{ config: { signals?: FailureSignal[] } }>(
      await getDb().from("rules_config").select("config").eq("key", failureKey(tenantId)).maybeSingle(),
    );
    if (error || !data?.config?.signals) return [];
    return data.config.signals.slice(0, limit);
  } catch {
    return [];
  }
}

export interface FailureSurfaceSummary {
  surface: FailureSurface;
  count:   number;
  last:    string | null;
}

/** Per-surface counts + last occurrence, over the retained buffer. */
export async function getFailureSummary(tenantId: string): Promise<FailureSurfaceSummary[]> {
  const signals = await getFailureSignals(tenantId);
  const surfaces: FailureSurface[] = ["storage", "mail", "decide"];
  return surfaces.map((surface) => {
    const forSurface = signals.filter((s) => s.surface === surface);
    return {
      surface,
      count: forSurface.length,
      last:  forSurface.length ? forSurface[0].at : null,
    };
  });
}
