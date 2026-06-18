/**
 * /admin/platform/docs/[slug]
 *
 * Renders a single doc (docs/<slug>.md) with react-markdown.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { readDoc } from "../_docs";
import { MarkdownView } from "../_components/MarkdownView";

export const dynamic = "force-dynamic";

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await getRequiredAdminSession();
  const { slug } = await params;
  const content = readDoc(slug);
  if (content === null) notFound();

  return (
    <div className="max-w-3xl p-8">
      <Link
        href="/admin/platform/docs"
        className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← All docs
      </Link>
      <article className="mt-4">
        <MarkdownView content={content} />
      </article>
    </div>
  );
}
