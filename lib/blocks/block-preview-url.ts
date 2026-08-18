/**
 * Shared builder for the isolated block-preview route
 * (/tenant-block-preview/[tenantId]?key=<blockKey>&v=<base64url-variant>).
 *
 * Both the EditBlockDrawer live preview and the read-only BlockPreviewModal use
 * these helpers, so the variant encoding stays identical in one place.
 *
 * Client-only: btoa is a browser API. Import from client components.
 */

/** Encode an adaptive-variant object as URL-safe base64 (base64url, no padding). */
export function encodeBlockVariant(variant: unknown): string {
  const json = JSON.stringify(variant);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Build the preview iframe src for a block key + the variant to render. */
export function buildBlockPreviewSrc(tenantId: string, blockKey: string, variant: unknown): string {
  return `/tenant-block-preview/${tenantId}?key=${encodeURIComponent(blockKey)}&v=${encodeBlockVariant(variant)}`;
}
