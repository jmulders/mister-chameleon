/**
 * lib/seo/sitemap.ts
 *
 * Pure builders for /sitemap.xml and /robots.txt (app/sitemap.ts, app/robots.ts).
 * Both are served per host, so every tenant domain lists its own URLs.
 */

import type { MetadataRoute } from "next";
import type { IndexablePath } from "@/cms/providers/cms-provider";

/**
 * Sitemap entries for an origin: the homepage first, then every CMS path once,
 * sorted. Paths that are not a clean absolute path are dropped.
 */
export function toSitemapEntries(origin: string, paths: readonly IndexablePath[]): MetadataRoute.Sitemap {
  const byPath = new Map<string, IndexablePath>();
  for (const p of [{ path: "/" }, ...paths]) {
    if (typeof p.path !== "string" || !/^\/[a-z0-9\-_/]*$/i.test(p.path) || p.path.includes("//")) continue;
    const path = p.path.length > 1 ? p.path.replace(/\/+$/, "") : p.path;
    const prev = byPath.get(path);
    // Keep the newest lastModified when a path is listed twice.
    if (!prev || (p.lastModified && (!prev.lastModified || p.lastModified > prev.lastModified))) {
      byPath.set(path, { path, lastModified: p.lastModified ?? prev?.lastModified });
    }
  }
  return [...byPath.values()]
    .sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)))
    .map((p) => ({
      url: `${origin}${p.path === "/" ? "/" : p.path}`,
      ...(p.lastModified && !Number.isNaN(Date.parse(p.lastModified)) ? { lastModified: new Date(p.lastModified) } : {}),
    }));
}

/** App areas that are never meant for search results. */
const PRIVATE_PATHS = [
  "/admin", "/dashboard", "/api/", "/preview", "/tenant-block-preview",
  "/mc-preview", "/demo-controls", "/block-coverage",
  "/cart", "/checkout", "/order", "/search",
];

/**
 * robots.txt for an origin. Vercel deployment hosts (*.vercel.app) are closed
 * entirely, so previews never compete with the real domain.
 */
export function robotsFor(origin: string | null): MetadataRoute.Robots {
  const host = origin ? new URL(origin).hostname : "";
  if (!origin || host.endsWith(".vercel.app")) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules:   [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
