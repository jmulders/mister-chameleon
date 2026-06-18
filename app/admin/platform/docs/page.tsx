/**
 * /admin/platform/docs
 *
 * Lists the repo's runbooks/guides (docs/*.md) and links to a rendered view.
 */
import Link from "next/link";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { listDocs } from "./_docs";

export const dynamic = "force-dynamic";

export default async function DocsIndexPage() {
  await getRequiredAdminSession();
  const docs = listDocs();

  return (
    <div className="max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Docs</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Runbooks and operational guides from the repo&apos;s{" "}
          <code className="rounded bg-neutral-100 px-1 font-mono text-xs">docs/</code> folder.
        </p>
      </div>

      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {docs.length === 0 && (
          <li className="px-4 py-3 text-sm text-neutral-500">No docs found.</li>
        )}
        {docs.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/admin/platform/docs/${d.slug}`}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-neutral-50"
            >
              <span className="font-medium text-neutral-900">{d.title}</span>
              <span className="shrink-0 font-mono text-xs text-neutral-400">{d.slug}.md</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
