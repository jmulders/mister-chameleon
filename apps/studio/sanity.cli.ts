/**
 * Sanity CLI Configuration
 *
 * Used by the Sanity CLI for deploy, dataset management, and other commands.
 * The projectId and dataset here must match your sanity.config.ts.
 *
 * ─── Setup ────────────────────────────────────────────────────────────────────
 *
 *   1. Create a project at https://www.sanity.io/manage
 *   2. Copy your project ID from the dashboard
 *   3. Set SANITY_PROJECT_ID in apps/studio/.env.local
 *   4. Optionally set SANITY_DATASET (defaults to "production")
 *
 *   .env.local example:
 *     SANITY_PROJECT_ID=abc123def
 *     SANITY_DATASET=production
 */

import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_PROJECT_ID ?? "REPLACE_WITH_YOUR_PROJECT_ID",
    dataset:   process.env.SANITY_DATASET   ?? "production",
  },
  /**
   * Enable auto-updates for the Sanity Studio.
   * Set to false to pin the studio version manually.
   */
  autoUpdates: true,
});
