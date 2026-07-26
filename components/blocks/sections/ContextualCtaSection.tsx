"use client";

/**
 * ContextualCtaSection
 *
 * Client wrapper around CtaSectionBlock that swaps the heading, text, and
 * primary button per visitor segment. Used only when a ctaSection block carries
 * a `contextKey` — otherwise ContentBlockRenderer renders the plain (server)
 * CtaSectionBlock so normal CTAs keep their SSR.
 *
 * On mount it POSTs the current path + query to /api/context/cta/[key]; the
 * server resolves the segment (reusing the tenant's form-context rules + geo)
 * and returns the overlay for this block key. Until it arrives — or when no
 * rule matches — the authored CTA is shown, then values swap in.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CtaSectionBlock } from "./CtaSectionBlock";
import type { CtaSectionBlockData } from "@/page-config";
import type { CtaOverlay } from "@/forms/context/types";

export function ContextualCtaSection({ data, variant, contextKey }:
  { data: CtaSectionBlockData; variant?: string; contextKey: string }) {
  const pathname = usePathname();
  const [overlay, setOverlay] = useState<CtaOverlay | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query: Record<string, string> = {};
    try {
      new URLSearchParams(window.location.search).forEach((v, k) => { query[k.toLowerCase()] = v; });
    } catch { /* ignore */ }
    fetch(`/api/context/cta/${encodeURIComponent(contextKey)}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ path: pathname, query }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.ok && j.overlay) setOverlay(j.overlay as CtaOverlay); })
      .catch(() => { /* keep authored CTA */ });
    return () => { cancelled = true; };
  }, [contextKey, pathname]);

  const merged: CtaSectionBlockData = overlay
    ? {
        ...data,
        title:       overlay.title ?? data.title,
        description: overlay.description ?? data.description,
        primaryCta:  (overlay.ctaLabel || overlay.ctaHref)
          ? {
              label: overlay.ctaLabel ?? data.primaryCta?.label ?? "Learn more",
              href:  overlay.ctaHref ?? data.primaryCta?.href ?? "#",
            }
          : data.primaryCta,
      }
    : data;

  return <CtaSectionBlock data={merged} variant={variant} />;
}
