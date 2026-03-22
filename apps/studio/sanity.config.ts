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
 */

import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "../../cms/schemas";
import { structure } from "./structure";

const projectId = (
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.SANITY_STUDIO_PROJECT_ID) ??
  process.env.SANITY_STUDIO_PROJECT_ID ??
  process.env.SANITY_PROJECT_ID ??
  "REPLACE_WITH_YOUR_PROJECT_ID"
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
