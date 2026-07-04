/**
 * /demo/[demoId]
 *
 * Public prospect demo viewer.
 *
 * ─── What it renders ──────────────────────────────────────────────────────────
 *
 *   A self-contained demo of Mr. Chameleon's personalisation capabilities:
 *     • Demo environment banner (top — makes clear this is a preview)
 *     • Scenario switcher (5 visitor personas)
 *     • Personalised hero, proof, and CTA sections (change per scenario)
 *     • Before/after panel (generic vs. personalised copy)
 *     • Brand theming applied from the prospect's extracted colours
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   Server component — fetches demo from /api/demo/[demoId], then passes
 *   the full DemoInstance to the client-side DemoViewer for interactivity.
 *
 *   Bypasses the full tenant/CMS/decision pipeline — no session cookies,
 *   no enrichment, no variant decisions.  The generated scenarios are all
 *   the data the viewer needs.
 *
 * ─── Expiry ───────────────────────────────────────────────────────────────────
 *
 *   If the demo is expired (API returns 410), renders an expiry message
 *   instead of a 404 — the link was valid; it just ran out.
 *
 * ─── No auth ──────────────────────────────────────────────────────────────────
 *
 *   This route is fully public.  The demo ID is the access token.
 */

import type { Metadata } from "next";
import type { DemoInstance } from "@/demo/types";
import { resolveRequestBaseUrl } from "@/lib/base-url";
import { DemoViewer } from "./_components/DemoViewer";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ demoId: string }>;
}): Promise<Metadata> {
  const { demoId } = await params;
  return {
    title:       "Prospect Demo — Mister Chameleon",
    description: "See how Mister Chameleon personalises your website for every visitor.",
    robots:      { index: false, follow: false },
    other:       { "demo-id": demoId },
  };
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchDemo(
  demoId:  string,
  baseUrl: string,
): Promise<{ demo: DemoInstance | null; expired: boolean; notFound: boolean }> {
  try {
    const response = await fetch(`${baseUrl}/api/demo/${demoId}`, {
      cache: "no-store",   // always fresh — demo viewer must show current view_count
    });

    if (response.status === 410) {
      return { demo: null, expired: true, notFound: false };
    }
    if (response.status === 404) {
      return { demo: null, expired: false, notFound: true };
    }
    if (!response.ok) {
      return { demo: null, expired: false, notFound: true };
    }

    const demo = await response.json() as DemoInstance;
    return { demo, expired: false, notFound: false };
  } catch {
    return { demo: null, expired: false, notFound: true };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DemoPage({
  params,
}: {
  params: Promise<{ demoId: string }>;
}) {
  const { demoId } = await params;

  // Resolve the base URL for the internal API fetch (always includes a scheme).
  const baseUrl = await resolveRequestBaseUrl();

  const { demo, expired, notFound } = await fetchDemo(demoId, baseUrl);

  // ── Expired ────────────────────────────────────────────────────────────────

  if (expired) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">⏰</div>
          <h1 className="text-2xl font-bold text-neutral-900">This demo has expired</h1>
          <p className="mt-3 text-neutral-500">
            Prospect demos are valid for 7 days. This one has run its course.
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            Ask the person who shared this link to generate a fresh one from the
            Mister Chameleon admin panel.
          </p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (notFound || !demo) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">🔍</div>
          <h1 className="text-2xl font-bold text-neutral-900">Demo not found</h1>
          <p className="mt-3 text-neutral-500">
            This link doesn't match any demo we have on record. It may have been
            deleted or the URL might be incorrect.
          </p>
        </div>
      </div>
    );
  }

  // ── Viewer ─────────────────────────────────────────────────────────────────

  return <DemoViewer demo={demo} />;
}
