/**
 * site/navigation-store.ts
 *
 * Read / write operations for the `site_navigation` table (migration 077).
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   The Header component reads navigation from the CMS (Sanity mainNavigation).
 *   When a new tenant's CMS content has not yet been published, that array is
 *   empty.  This store provides a DB-backed fallback written by initializeSite()
 *   from the blueprint's page list.
 *
 *   Header fallback order:
 *     1. CMS mainNavigation (Sanity) — non-empty when CMS is provisioned.
 *     2. site_navigation table       — populated by initializeSite().
 *     3. Empty array                 — no nav renders.
 *
 * ─── NavigationItemData compatibility ────────────────────────────────────────
 *
 *   getSiteNavigation() returns NavigationItemData[] so the Header can use it
 *   as a drop-in replacement for CMS nav without any additional mapping.
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   Uses the service-role Supabase client.  Do NOT import in client components.
 */

import "server-only";

import { randomUUID }         from "crypto";
import { getDb }              from "@/data/db";
import type { NavigationItemData } from "@/cms/types";
import type {
  SiteNavRow,
  SiteNavInsert,
  NavItemResult,
} from "./types";
import type { GeneratedNavItem } from "./navigation-generator";

// ── Write: persist generated nav items ───────────────────────────────────────

export interface WriteNavOptions {
  tenantId:  string;
  items:     GeneratedNavItem[];
  overwrite: boolean;
}

/**
 * Write generated nav items to the `site_navigation` table.
 *
 * When overwrite = true, all existing nav rows for the tenant are deleted
 * before inserting the new set (full replace).
 *
 * When overwrite = false, existing rows are left in place and only missing
 * top-level hrefs are inserted.
 *
 * Returns NavItemResult[] for the items that were written.
 */
export async function writeNavItems(
  opts: WriteNavOptions,
): Promise<NavItemResult[]> {
  const { tenantId, items, overwrite } = opts;

  if (overwrite) {
    // Delete all existing nav for this tenant then insert fresh.
    await getDb()
      .from("site_navigation")
      .delete()
      .eq("tenant_id", tenantId as never);
  }

  const written: NavItemResult[] = [];

  // Load existing hrefs to support non-overwrite idempotency.
  const existingHrefs = overwrite ? new Set<string>() : await loadExistingHrefs(tenantId);

  for (const item of items) {
    if (existingHrefs.has(item.href)) continue;

    const id = randomUUID();

    const row: SiteNavInsert = {
      id,
      tenant_id:   tenantId,
      label:       item.label,
      href:        item.href,
      order_index: item.order,
      parent_id:   null,
    };

    const { error } = await getDb()
      .from("site_navigation")
      .insert(row as never);

    if (!error) {
      written.push({ id, label: item.label, href: item.href, order: item.order });

      // Insert children if present.
      for (let ci = 0; ci < item.children.length; ci++) {
        const child   = item.children[ci];
        const childId = randomUUID();

        await getDb()
          .from("site_navigation")
          .insert({
            id:          childId,
            tenant_id:   tenantId,
            label:       child.label,
            href:        child.href,
            order_index: ci,
            parent_id:   id,
          } as never);
      }
    }
  }

  return written;
}

// ── Read: navigation for Header fallback ──────────────────────────────────────

/**
 * Load navigation items from `site_navigation` for a tenant, shaped as
 * NavigationItemData[] for drop-in use in the Header.
 *
 * Returns only top-level items (parent_id IS NULL), ordered by order_index.
 * Children are loaded in a second pass and nested under their parent.
 *
 * Returns an empty array on any error — never throws.
 */
export async function getSiteNavigation(
  tenantId: string,
): Promise<NavigationItemData[]> {
  try {
    const { data, error } = await getDb()
      .from("site_navigation")
      .select("*")
      .eq("tenant_id", tenantId as never)
      .order("order_index", { ascending: true });

    if (error || !data) return [];

    const rows = data as SiteNavRow[];

    // Build parent → children map.
    const childrenMap = new Map<string, NavigationItemData[]>();

    for (const row of rows) {
      if (row.parent_id) {
        const list = childrenMap.get(row.parent_id) ?? [];
        list.push(rowToNavItem(row, []));
        childrenMap.set(row.parent_id, list);
      }
    }

    // Top-level items only.
    return rows
      .filter((r) => !r.parent_id)
      .map((r) => rowToNavItem(r, childrenMap.get(r.id) ?? []));
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToNavItem(
  row:      SiteNavRow,
  children: NavigationItemData[],
): NavigationItemData {
  return {
    id:       row.id,
    label:    row.label,
    href:     row.href,
    children: children.length > 0 ? children : undefined,
  };
}

async function loadExistingHrefs(tenantId: string): Promise<Set<string>> {
  try {
    const { data } = await getDb()
      .from("site_navigation")
      .select("href")
      .eq("tenant_id", tenantId as never)
      .is("parent_id", null as never);
    return new Set((data ?? []).map((r: { href: string }) => r.href));
  } catch {
    return new Set();
  }
}
