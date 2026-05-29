/**
 * Sanity Studio v3 Configuration
 *
 * Single shared Studio for all tenants. Schemas live in ../../cms/schemas
 * so they are co-located with the Next.js app and shared with TypeScript
 * types used by the frontend.
 *
 * ─── Quick start ──────────────────────────────────────────────────────────────
 *
 *   1. Copy apps/studio/.env.local.example → apps/studio/.env.local
 *   2. Fill in SANITY_PROJECT_ID and SANITY_DATASET
 *   3. cd apps/studio && npm install && npm run dev
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *
 *   SANITY_STUDIO_PROJECT_ID   Your Sanity project ID (required)
 *   SANITY_STUDIO_DATASET      Dataset name, default "production"
 *   SANITY_STUDIO_API_VERSION  API version, default "2024-01-01"
 *
 *   Note: Sanity Studio uses the SANITY_STUDIO_* prefix for Vite env vars.
 *   The non-prefixed SANITY_* vars are only available in the CLI context
 *   (sanity.cli.ts). Use SANITY_STUDIO_* in this config file.
 *
 * ─── Plugins ──────────────────────────────────────────────────────────────────
 *
 *   neutralLandingPlugin — resets any stale deep-link URL (e.g. one that
 *     lands directly inside a specific tenant pane) back to the neutral
 *     /structure root on the first page-load of each browser session.
 *     See plugins/neutral-landing.ts for details.
 *
 *   structureTool — custom multi-tenant desk structure.
 *     See structure.ts for the pane hierarchy.
 *
 *   visionTool — GROQ query playground.
 *     Remove in production if you want to keep the UI minimal.
 *
 * ─── Seed ─────────────────────────────────────────────────────────────────────
 *
 *   The old seedToolPlugin (🦎 Seed tab) has been removed. Seeding is now
 *   done per-tenant from the platform admin at
 *   /admin/tenants/[tenantId]/content — this seeds pages + variants,
 *   resets navigation, and is isolated to the selected tenant.
 */

import { defineConfig }        from "sanity";
import { structureTool }       from "sanity/structure";
import { visionTool }          from "@sanity/vision";
import { schemaTypes }         from "../../cms/schemas";
import { structure }           from "./structure";
import { neutralLandingPlugin } from "./plugins/neutral-landing";

const projectId = (
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.SANITY_STUDIO_PROJECT_ID) ??
  process.env.SANITY_STUDIO_PROJECT_ID ??
  process.env.SANITY_PROJECT_ID ??
  "in3s2m2m"
);

const dataset = (
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.SANITY_STUDIO_DATASET) ??
  process.env.SANITY_STUDIO_DATASET ??
  process.env.SANITY_DATASET ??
  "production"
);

export default defineConfig({
  // ── Identity ───────────────────────────────────────────────────────────────
  name:  "mister-chameleon",
  title: "Mister Chameleon Studio",

  // ── API ────────────────────────────────────────────────────────────────────
  projectId,
  dataset,

  // ── Plugins ────────────────────────────────────────────────────────────────
  plugins: [
    // Reset stale deep-link URLs to the neutral structure root on fresh loads.
    // Must be listed before structureTool so the layout guard runs first.
    neutralLandingPlugin(),

    structureTool({ structure }),

    // GROQ Vision — query your dataset directly from the Studio.
    // Remove in production if you want to keep the UI minimal.
    visionTool(),
  ],

  // ── Schema ─────────────────────────────────────────────────────────────────
  schema: {
    types: schemaTypes,
  },
});
