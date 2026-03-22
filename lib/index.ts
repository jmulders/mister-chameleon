/**
 * Lib barrel export
 *
 * Shared utilities and helpers that don't belong to a specific domain.
 * Import from "@/lib" for convenience.
 *
 * NOTE: This barrel re-exports from env.ts, which imports "server-only".
 * Importing "@/lib" in a Client Component will cause a build error.
 * If you only need cn() or logger in a client file, import those directly:
 *   import { cn } from "@/lib/utils";
 *   import { logger } from "@/lib/logger";
 */

export { logger } from "./logger";
export { cn } from "./utils";
export { isDefined, isNonNull, isPresent, assertDefined, assertNonNull, assertPresent } from "./assert";
export {
  clientEnv,
  serverEnv,
  type SanityEnvConfig,
  type SupabaseServerEnvConfig,
  type N8nEnvConfig,
} from "./env";
