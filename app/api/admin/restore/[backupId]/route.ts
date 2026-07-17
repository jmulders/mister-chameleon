/**
 * /api/admin/restore/[backupId]
 *
 * POST — Restore platform configuration from a specific backup version.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Requires a valid admin session.
 *   This is a destructive, irreversible operation — existing rows in the
 *   restored tables are overwritten (upserted) with the backup's data.
 *   Rows that exist in the DB but not in the backup are NOT deleted, to
 *   avoid accidental data loss from tables that grew after the snapshot.
 *
 * ─── What is restored ─────────────────────────────────────────────────────────
 *
 *   Only the tables present in the selected backup are touched.
 *   Existing rows are upserted (matched on primary key "id") — new rows
 *   are inserted, conflicting rows are overwritten.
 *
 * ─── Audit trail ──────────────────────────────────────────────────────────────
 *
 *   After restoring, a NEW backup entry is created with
 *   `restored_from_version = N`, so the history is append-only.
 *   This lets you see exactly when restores happened and roll forward again
 *   by restoring a later version.
 */

import { NextRequest, NextResponse } from "next/server";
// Eén lijst, gedeeld met de backup — anders drijven ze uit elkaar en herstelt
// een restore net die tabellen niet die de backup net wel meenam.
import { BACKUP_TABLES } from "@/lib/backup/backup-tables";
import { getRequiredAdminSession }   from "@/lib/admin-auth/authorization";
import { getDb }                     from "@/data/db";
import type { BackupMeta }           from "@/app/api/admin/backup/route";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const session  = await getRequiredAdminSession();
  const db       = getDb();
  const { backupId } = await params;

  if (!backupId) {
    return NextResponse.json({ error: "Missing backupId" }, { status: 400 });
  }

  // ── Fetch the target backup ───────────────────────────────────────────────
  const { data: backup, error: fetchErr } = await db
    .from("platform_backups")
    .select("*")
    .eq("id", backupId)
    .single();

  if (fetchErr || !backup) {
    return NextResponse.json(
      { error: `Backup not found: ${fetchErr?.message ?? "unknown"}` },
      { status: 404 },
    );
  }

  const b = backup as BackupMeta & { data: Record<string, unknown[]> };

  if (b.status !== "complete") {
    return NextResponse.json(
      { error: `Cannot restore from a backup with status "${b.status}"` },
      { status: 400 },
    );
  }

  // ── Restore each table ────────────────────────────────────────────────────
  //
  // In BACKUP_TABLES-volgorde, niet in JSON-sleutelvolgorde.
  //
  // Die twee zijn nu hetzelfde — de backup schrijft de keys in die volgorde weg
  // en V8 bewaart insertion order — maar dan hangt je foreign-key-volgorde aan
  // een impliciete eigenschap van de JSON-parser. Expliciet is het een regel die
  // je kunt lezen en die blijft kloppen als iemand een backup met de hand
  // aanpast of samenvoegt.
  //
  // Keys die niet in BACKUP_TABLES staan (een oudere backup, een tabel die
  // sindsdien hernoemd is) gaan daarna, zodat er niets stil verdwijnt.
  const tableData = b.data ?? {};
  const errors: string[] = [];

  const known   = BACKUP_TABLES.filter((t) => t in tableData).map((t) => [t, tableData[t]] as const);
  const unknown = Object.entries(tableData).filter(([t]) => !(BACKUP_TABLES as readonly string[]).includes(t));

  for (const [table, rows] of [...known, ...unknown]) {
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Chunk to stay within Supabase request size limits
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK) as Record<string, unknown>[];
      // `db as any` — hier terecht, en het blijft.
      //
      // `table` komt uit de opgeslagen backup-JSON, dus het is een echte string:
      // TypeScript kan niet weten of het een bestaande tabelnaam is, en dat is
      // niet op te lossen met een beter type. De 42P01-check hieronder is de
      // runtime-controle die dit afdekt.
      //
      // (Overweging voor later: eerst valideren dat `table` in BACKUP_TABLES
      // staat. Een restore schrijft nu naar elke tabelnaam die in de JSON staat.
      // Die rijen zijn admin-gemaakt, dus het risico is klein — maar het is wel
      // een schrijfpad dat door data wordt gestuurd.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any)
        .from(table)
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });

      if (error) {
        if (error.code === "42P01") break; // table gone — skip silently
        errors.push(`${table}: ${error.message}`);
        break;
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: `Restore partially failed:\n${errors.join("\n")}` },
      { status: 500 },
    );
  }

  // ── Record the restore as a new backup entry ──────────────────────────────
  const { data: latest } = await db
    .from("platform_backups")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((latest as { version: number } | null)?.version ?? 0) + 1;

  // (db as any) — zoals de 24 andere plekken in deze codebase.
  //
  // data/types.ts bevat een HANDGESCHREVEN Database-type. Dat mist per tabel de
  // door @supabase/postgrest-js vereiste `Relationships`-sleutel, plus Views /
  // Functions / Enums / CompositeTypes op schemaniveau. Daardoor faalt het type
  // zijn GenericSchema-constraint en resolvet supabase-js ELKE tabel naar `never`
  // — niet alleen platform_backups. De getypte client heeft dus nooit iets getypt,
  // en deze cast verliest geen enkele veiligheid die er was.
  //
  // De echte oplossing is genereren i.p.v. handschrijven:
  //   npx supabase gen types typescript --linked > data/database.types.ts
  // Daarna kunnen deze 24 casts weg. Zie docs/testing.md.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newEntry, error: insErr } = await (db as any)
    .from("platform_backups")
    .insert({
      created_by:            session.email ?? "admin",
      label:                 `Restored from v${b.version}`,
      version:               nextVersion,
      status:                "complete",
      tables:                b.tables,
      row_count:             b.row_count,
      restored_from_version: b.version,
      data:                  tableData,
    })
    .select("id, created_at, created_by, label, version, status, tables, row_count, restored_from_version")
    .single();

  if (insErr) {
    // Non-fatal — the restore succeeded; the audit entry failed.
    console.error("[restore] Failed to create audit entry:", insErr.message);
  }

  return NextResponse.json({
    ok:      true,
    message: `Restored from v${b.version}`,
    backup:  newEntry as BackupMeta | null,
  });
}
