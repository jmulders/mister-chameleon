/**
 * AI Logs Repository — backward-compat facade
 *
 * This file is retained so existing direct imports continue to resolve
 * without modification:
 *
 *   import { saveAiDecisionLog } from "@/data/repositories/ai-logs-repository";
 *   // ↑ still works — used by AiDecisionProvider and the dashboard page
 *
 * The implementation lives in `ai-decisions-repository.ts`.
 * New code should import from there directly.
 */

export {
  saveAiDecisionLog,
  getRecentAiDecisionLogs,
  getAiDecisionLogsBySession,
  getAiDecisionLogsByTenant,
  type GetRecentAiDecisionLogsOptions,
  type AiDecisionLogRow,
  type AiDecisionLogInsert,
} from "./ai-decisions-repository";
