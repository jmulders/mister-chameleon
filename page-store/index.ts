/**
 * Page store module — barrel export  (@/page-store)
 *
 * Public API for the admin-editable page management layer.
 *
 * Named `page-store/` (not `pages/`) to avoid conflicting with Next.js's
 * reserved `pages/` directory convention for the Pages Router.
 *
 * ─── What this module is ──────────────────────────────────────────────────────
 *
 *   A thin persistence layer that sits between the admin page builder (UI)
 *   and the platform runtime (PageConfig / TemplateRenderer).
 *
 *   It stores page definitions as `EditablePage` objects — mutable, persistable
 *   counterparts of the runtime `PageConfig`.  All reads and writes go through
 *   the helpers exported here; consumers never touch the JSON file directly.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Read
 *   import { getAllPages, getPageById, getPageBySlug } from "@/page-store";
 *   const pages = await getAllPages();
 *
 *   // Write
 *   import { savePage } from "@/page-store";
 *   const saved = await savePage({ ...draftPage, title: "New Title" });
 *
 *   // Convert to runtime PageConfig for rendering
 *   import { toPageConfig } from "@/page-store";
 *   const config = toPageConfig(editablePage);
 *   return <TemplateRenderer pageConfig={config} />;
 *
 * ─── Server-only constraint ───────────────────────────────────────────────────
 *
 *   The store helpers (getAllPages, getPageById, etc.) use Node.js `fs` and
 *   must only be called from Server Components, Server Actions, or API routes.
 *   Import `toPageConfig` / `fromPageConfig` freely — they are pure functions
 *   with no I/O dependencies.
 *
 * ─── Module map ───────────────────────────────────────────────────────────────
 *
 *   page-store/types.ts   — EditablePage model + toPageConfig / fromPageConfig
 *   page-store/seed.ts    — getSeedPages() (derives initial content from MockCMSProvider)
 *   page-store/store.ts   — File-backed async CRUD store
 *   page-store/index.ts   — YOU ARE HERE (barrel export)
 *   page-store/data/      — Runtime JSON store (created on first server start)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  EditablePage,
  EditableContextSlot,
  EditableContentBlock,
} from "./types";

// ── Conversion helpers (pure, importable anywhere) ────────────────────────────

export {
  toPageConfig,
  fromPageConfig,
} from "./types";

// ── Store helpers (server-only) ───────────────────────────────────────────────

export {
  getAllPages,
  getPagesByTenant,
  getPageById,
  getPageBySlug,
  savePage,
  deletePage,
  listPageSlugs,
  resetStore,
} from "./store";

// ── Seed (exposed for tooling / testing) ──────────────────────────────────────

export { getSeedPages } from "./seed";
