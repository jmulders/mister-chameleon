/**
 * /admin/demo
 *
 * Prospect Demo list — shows all generated demos with status, mode, and
 * quick-access links to open or copy each shareable URL.
 */

import { createClient }        from "@supabase/supabase-js";
import { listDemoInstances }   from "@/demo/store";
import { resolveDemoBaseUrl } from "@/lib/base-url";
import Link                    from "next/link";
import type { DemoInstance }   from "@/demo/types";
import { DemoCopyButton }      from "./_components/DemoCopyButton";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(demo: DemoInstance): boolean {
  return new Date(demo.expires_at) < new Date();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function demoBrowseUrl(demo: DemoInstance, baseUrl: string): string {
  const path = demo.demo_mode === "mirror"
    ? `/demo/${demo.id}/live`
    : `/demo/${demo.id}`;
  return `${baseUrl}${path}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DemoListPage() {
  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  let demos: DemoInstance[] = [];
  let fetchError: string | null = null;

  try {
    demos = await listDemoInstances(client, 100);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const baseUrl = await resolveDemoBaseUrl();

  const active  = demos.filter((d) => !isExpired(d));
  const expired = demos.filter((d) =>  isExpired(d));

  return (
    <div className="max-w-4xl p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Prospect Demos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            All generated demo links — mirror and synthetic.
            {demos.length > 0 && ` ${active.length} active, ${expired.length} expired.`}
          </p>
        </div>
        <Link
          href="/admin/demo/new"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          + New demo
        </Link>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">Could not load demos</p>
          <p className="mt-0.5 text-xs text-red-600 font-mono">{fetchError}</p>
        </div>
      )}

      {/* Empty state */}
      {!fetchError && demos.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center">
          <p className="text-2xl mb-3">🪞</p>
          <p className="text-sm font-medium text-neutral-700">No demos yet</p>
          <p className="mt-1 text-sm text-neutral-400">
            Generate your first prospect demo to see it here.
          </p>
          <Link
            href="/admin/demo/new"
            className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            Create a demo
          </Link>
        </div>
      )}

      {/* Active demos */}
      {active.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Active — {active.length}
          </p>
          {active.map((demo) => (
            <DemoRow
              key={demo.id}
              demo={demo}
              url={demoBrowseUrl(demo, baseUrl)}
            />
          ))}
        </section>
      )}

      {/* Expired demos */}
      {expired.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Expired — {expired.length}
          </p>
          {expired.map((demo) => (
            <DemoRow
              key={demo.id}
              demo={demo}
              url={demoBrowseUrl(demo, baseUrl)}
              expired
            />
          ))}
        </section>
      )}

    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function DemoRow({
  demo,
  url,
  expired = false,
}: {
  demo:     DemoInstance;
  url:      string;
  expired?: boolean;
}) {
  const isMirror = demo.demo_mode === "mirror";

  return (
    <div className={`rounded-lg border bg-white px-4 py-3.5 transition-colors ${
      expired ? "border-neutral-100 opacity-60" : "border-neutral-200"
    }`}>
      <div className="flex items-start justify-between gap-4">

        {/* Left */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isMirror
                ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                : "bg-purple-50 text-purple-700 border border-purple-100"
            }`}>
              {isMirror ? "🪞 Mirror" : "✨ Synthetic"}
            </span>
            <span className="text-sm font-semibold text-neutral-900 truncate">
              {demo.site_name || "Unnamed"}
            </span>
            {demo.site_category && demo.site_category !== "general" && (
              <span className="text-[11px] text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">
                {demo.site_category.replace("_", " ")}
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-400 truncate">{demo.source_url}</p>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
            <span>Created {formatDate(demo.created_at)}</span>
            <span className={expired ? "text-red-400" : ""}>
              {expired ? "Expired" : "Expires"} {formatDate(demo.expires_at)}
            </span>
            {demo.view_count > 0 && (
              <span>{demo.view_count} view{demo.view_count !== 1 ? "s" : ""}</span>
            )}
            {demo.generated_by && (
              <span>by {demo.generated_by}</span>
            )}
          </div>
        </div>

        {/* Right — actions */}
        <div className="shrink-0 flex items-center gap-2">
          {!expired && (
            <Link
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Open ↗
            </Link>
          )}
          <DemoCopyButton url={url} />
        </div>

      </div>
    </div>
  );
}
