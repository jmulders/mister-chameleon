"use client";

/**
 * BackupPanel
 *
 * Client component that renders the interactive backup section on the
 * /admin/platform/system page.
 *
 * ─── Features ─────────────────────────────────────────────────────────────────
 *
 *   • "Create Backup" button — POSTs to /api/admin/backup
 *   • Version history table — shows all backups (latest first)
 *   • "Restore" button per row — POSTs to /api/admin/restore/[id]
 *   • Live feedback (spinner + success/error messages)
 *   • Auto-refresh after create/restore
 *
 * ─── Versioning model ─────────────────────────────────────────────────────────
 *
 *   Backups are append-only.  Restoring from version N creates a NEW backup
 *   (version N+1) labelled "Restored from vN" — so the history is auditable
 *   and you can always roll forward again by restoring a later version.
 */

import { useState, useTransition } from "react";
import type { BackupMeta }         from "@/app/api/admin/backup/route";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BackupPanelProps {
  initialBackups: BackupMeta[];
}

// ── Helper components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function StatusBadge({ status, restoredFrom }: { status: BackupMeta["status"]; restoredFrom: number | null }) {
  if (restoredFrom != null) {
    return (
      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
        Restore
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
        OK
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
        Failed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      {status}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BackupPanel({ initialBackups }: BackupPanelProps) {
  const [backups,   setBackups]   = useState<BackupMeta[]>(initialBackups);
  const [message,   setMessage]   = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null); // backup id being restored
  const [isPending, startTransition] = useTransition();

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function refreshBackups() {
    const res  = await fetch("/api/admin/backup");
    const json = await res.json() as { backups?: BackupMeta[] };
    if (json.backups) setBackups(json.backups);
  }

  // ── Create backup ─────────────────────────────────────────────────────────

  function handleCreate() {
    setMessage(null);
    startTransition(async () => {
      const res  = await fetch("/api/admin/backup", { method: "POST" });
      const json = await res.json() as { ok?: boolean; backup?: BackupMeta; error?: string };

      if (!res.ok || !json.ok) {
        setMessage({ type: "error", text: json.error ?? "Backup failed." });
        return;
      }

      setMessage({ type: "ok", text: `Backup v${json.backup?.version} created successfully.` });
      await refreshBackups();
    });
  }

  // ── Restore ───────────────────────────────────────────────────────────────

  function handleRestore(backup: BackupMeta) {
    if (restoring) return;
    setMessage(null);
    setRestoring(backup.id);

    startTransition(async () => {
      const res  = await fetch(`/api/admin/restore/${backup.id}`, { method: "POST" });
      const json = await res.json() as { ok?: boolean; message?: string; backup?: BackupMeta; error?: string };

      setRestoring(null);

      if (!res.ok || !json.ok) {
        setMessage({ type: "error", text: json.error ?? "Restore failed." });
        return;
      }

      setMessage({ type: "ok", text: json.message ?? "Restore complete." });
      await refreshBackups();
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const latestVersion = backups[0]?.version ?? 0;

  return (
    <div className="space-y-5">

      {/* Callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800">
        <strong>Platform backups</strong> snapshot all configuration tables (tenants, settings,
        rules, pages, billing) and store them in the database, they work locally and on Vercel.
        Backups do <em>not</em> include event data (sessions, analytics).
        The last {20} backups are kept automatically.
      </div>

      {/* Create backup button + status */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending && !restoring && <Spinner />}
          Create Backup
        </button>

        {message && (
          <span className={`text-sm font-medium ${message.type === "ok" ? "text-green-700" : "text-red-700"}`}>
            {message.type === "ok" ? "✓ " : "✗ "}{message.text}
          </span>
        )}
      </div>

      {/* Version history */}
      {backups.length === 0 ? (
        <p className="text-sm text-neutral-500">No backups yet. Click "Create Backup" to make your first snapshot.</p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Version</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">By</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Label</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Rows</th>
                <th className="px-4 py-2.5 text-left font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold text-neutral-500 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {backups.map((b) => {
                const isLatest    = b.version === latestVersion;
                const isRestoring = restoring === b.id;

                return (
                  <tr
                    key={b.id}
                    className={`transition-colors ${isLatest ? "bg-green-50" : "hover:bg-neutral-50"}`}
                  >
                    {/* Version */}
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-800">
                      v{b.version}
                      {isLatest && (
                        <span className="ml-2 rounded-full bg-green-200 px-1.5 py-0.5 text-[9px] font-bold text-green-800 uppercase tracking-wide">
                          latest
                        </span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString("en-GB", {
                        day:    "numeric",
                        month:  "short",
                        year:   "numeric",
                        hour:   "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* By */}
                    <td className="px-4 py-3 text-neutral-500 max-w-[120px] truncate" title={b.created_by}>
                      {b.created_by}
                    </td>

                    {/* Label */}
                    <td className="px-4 py-3 text-neutral-600 max-w-[180px] truncate" title={b.label ?? ""}>
                      {b.label ?? (b.restored_from_version != null
                        ? `Restored from v${b.restored_from_version}`
                        : <span className="text-neutral-400">, </span>
                      )}
                    </td>

                    {/* Rows */}
                    <td className="px-4 py-3 text-neutral-500">
                      {b.row_count.toLocaleString()}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} restoredFrom={b.restored_from_version} />
                    </td>

                    {/* Restore button */}
                    <td className="px-4 py-3 text-right">
                      {!isLatest && b.status === "complete" && (
                        <button
                          onClick={() => handleRestore(b)}
                          disabled={!!restoring || isPending}
                          title={`Restore platform config to this version`}
                          className="inline-flex items-center gap-1.5 rounded border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isRestoring ? <><Spinner /> Restoring…</> : "↩ Restore"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Warning */}
      <div className="rounded-lg border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <strong>Restoring</strong> upserts stored rows back into each table.
        Rows added after the snapshot was taken are <em>not</em> deleted.
        For a full DB point-in-time restore, use{" "}
        <strong>Supabase Dashboard → Database → Backups</strong>.
      </div>
    </div>
  );
}
