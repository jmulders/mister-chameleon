/**
 * adaptive-blocks-sync.ts
 *
 * Syncs AdaptiveBlockData[] from a CMS publish event to the adaptive_blocks
 * Supabase table. Called from webhook routes for Statamic and Storyblok.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   CMS publish event
 *        ↓  webhook route maps CMS payload → AdaptiveBlockData[]
 *   syncAdaptiveBlocksToDB()      ← YOU ARE HERE
 *        ↓  loops and calls upsertAdaptiveBlock() for each block
 *   adaptive_blocks Supabase table
 *
 * ─── Null tenantId semantics ──────────────────────────────────────────────────
 *
 *   A null tenantId upserts platform-wide blocks (tenant_id IS NULL).
 *   A non-null tenantId scopes the upsert to the given tenant.
 */

import { upsertAdaptiveBlock } from "./adaptive-blocks-store";
import type { AdaptiveBlockData } from "@/cms/types";

// ── Result type ───────────────────────────────────────────────────────────────

export interface SyncResult {
  /** Aantal blocks dat succesvol is gesynchroniseerd */
  synced:  number;
  /** Foutmeldingen voor blocks die niet konden worden gesynchroniseerd */
  errors:  string[];
}

// ── Sync function ─────────────────────────────────────────────────────────────

/**
 * Synchroniseer een array van AdaptiveBlockData naar de Supabase `adaptive_blocks` tabel.
 *
 * Loopt door elke block en roept `upsertAdaptiveBlock` aan met de opgegeven tenantId.
 * Fouten worden verzameld in het resultaat — een enkelvoudige fout stopt de overige
 * upserts niet.
 *
 * @param blocks    De te synchroniseren adaptive blocks (gemapt vanuit CMS payload).
 * @param tenantId  Tenant scope; null = platform-breed.
 * @returns         SyncResult met het aantal gesynchroniseerde blocks en eventuele fouten.
 */
export async function syncAdaptiveBlocksToDB(
  blocks:   AdaptiveBlockData[],
  tenantId: string | null,
): Promise<SyncResult> {
  const errors: string[] = [];
  let synced = 0;

  for (const block of blocks) {
    const result = await upsertAdaptiveBlock({
      ...block,
      tenantId: tenantId ?? undefined,
    });

    if (result.ok) {
      synced++;
    } else {
      errors.push(`[${block.key}] ${result.error}`);
    }
  }

  return { synced, errors };
}
