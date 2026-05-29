/**
 * lib/assets/format.ts
 *
 * Client-safe formatting utilities for asset metadata.
 *
 * Kept separate from tenant-assets.ts (which is server-only via storage-adapter)
 * so client components can import these helpers without pulling in the
 * server-only chain.
 */

/** Human-readable file size. */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
