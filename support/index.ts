/**
 * Support Module — Barrel Export
 *
 * Re-exports all public types and runtime values from the support layer.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   import type { SupportProcessDefinition, SupportSeverity } from "@/support";
 *   import { SUPPORT_PROCESS_CATALOG, getSupportProcess }     from "@/support";
 *   import { getProcessSLA, getProcessesOwnedBy }             from "@/support";
 *
 * ─── Module map ───────────────────────────────────────────────────────────────
 *
 *   support/types.ts     — all type definitions
 *   support/processes.ts — six concrete process definitions + catalog + helpers
 *   support/index.ts     ← YOU ARE HERE — barrel re-export
 */

// ── Type exports ────────────────────────────────────────────────────────────

export type {
  // Identifier types
  SupportProcessTypeId,
  SupportSeverity,
  SupportOwnerRole,
  SupportChannelId,
  SupportTicketStatus,

  // SLA
  ResponseSLA,

  // Escalation
  EscalationTrigger,
  EscalationStep,

  // Response path
  ResponseStep,
  ResponsePath,

  // Process definition
  SupportProcessDefinition,
  SupportToolingNotes,

  // Catalog
  SupportProcessCatalog,
} from "./types";

// ── Runtime exports ──────────────────────────────────────────────────────────

export {
  // ── Individual process definitions ────────────────────────────────────────
  INCIDENT_PROCESS,
  CONTENT_ISSUE_PROCESS,
  CMS_ISSUE_PROCESS,
  TRACKING_DATA_ISSUE_PROCESS,
  TENANT_CONFIG_ISSUE_PROCESS,
  FEATURE_REQUEST_PROCESS,

  // ── Catalog ───────────────────────────────────────────────────────────────
  /** All six support process definitions indexed by SupportProcessTypeId. */
  SUPPORT_PROCESS_CATALOG,

  // ── Lookup helpers ────────────────────────────────────────────────────────
  /** Get a process definition by its type ID. */
  getSupportProcess,
  /** All processes ordered by default severity (critical first). */
  getProcessesBySeverity,
  /** All processes for which the given role is the primary owner. */
  getProcessesOwnedBy,
  /** The SLA for a given process type and severity. */
  getProcessSLA,
  /** All process types for which the given channel is the primary channel. */
  getProcessesForChannel,
  /** All process types that list a given module as linked. */
  getProcessesForModule,
} from "./processes";
