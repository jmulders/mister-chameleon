/**
 * Admin — Tenant Workspace › Snippet
 *
 * Installation hub for the JavaScript snippet integration.
 *
 * Accessible at /admin/tenants/[tenantId]/snippet.
 *
 * ─── What this page does ─────────────────────────────────────────────────────
 *
 *   1. Displays the site key (or a "Generate" prompt if none exists yet).
 *   2. Shows a copy-ready `<script>` tag for the operator to paste into their
 *      site's `<head>`.
 *   3. Allows the operator to enable/disable the snippet integration.
 *   4. Explains the `data-mc-slot` markup convention with examples.
 *   5. Allows key regeneration (invalidates the previous key immediately).
 */

import { notFound }          from "next/navigation";
import { getTenantById }     from "@/tenant/server";
import { SnippetTabs }       from "./_components/SnippetTabs";

export const metadata = {
  title: "Snippet Integration",
};

export default async function SnippetPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  // Resolve the canonical API origin.
  // In production this comes from NEXT_PUBLIC_APP_URL; in dev we use a placeholder.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.misterchameleon.com";

  const snippetSrc   = `${appUrl}/api/snippet.js`;
  const siteKey      = tenant.snippet?.siteKey ?? null;
  const enabled      = tenant.snippet?.enabled ?? false;
  const generatedAt  = tenant.snippet?.siteKeyGeneratedAt ?? null;
  const selectorMap  = tenant.snippet?.selectorMap ?? {};

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">Snippet Integration</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Add one script tag to your site&apos;s <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5 rounded">&lt;head&gt;</code>.
          The snippet personalises your existing pages in real-time — no server-side changes required.
        </p>
      </div>

      <SnippetTabs
        tenantId={tenantId}
        siteKey={siteKey}
        enabled={enabled}
        generatedAt={generatedAt}
        snippetSrc={snippetSrc}
        selectorMap={selectorMap}
        slotSuggestions={SLOT_SUGGESTIONS}
      />
    </div>
  );
}

// Common slot names, surfaced as autocomplete hints in the selector editor.
const SLOT_SUGGESTIONS = [
  "hero-title", "hero-subtitle", "hero-tag",
  "hero-cta-label", "hero-cta-href", "hero-cta2-label", "hero-cta2-href",
  "proof-title",
  "cta-title", "cta-text", "cta-cta-label", "cta-cta-href",
  "feature-title", "feature-subtitle",
  "conversion-title", "conversion-text",
  "notification-message",
] as const;
