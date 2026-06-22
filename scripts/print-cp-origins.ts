/**
 * scripts/print-cp-origins.ts
 *
 * Prints the exact `STATAMIC_CP_ORIGIN` value to set on Vercel, derived from
 * every registered tenant's `cms.statamicBaseUrl`. This is the list of Statamic
 * Control-Panel origins allowed to embed the Live Preview iframe via the
 * frame-ancestors CSP in next.config.mjs.
 *
 * Why this script exists:
 *   The draft POST endpoint (/api/statamic-draft) is self-maintaining — it reads
 *   the tenant store at request time. But the frame-ancestors CSP is a build-time
 *   header that CANNOT read the DB, so its origin list lives in an env var that
 *   must be kept in sync by hand. This script removes the "by hand" guesswork:
 *   run it, paste the output into Vercel, redeploy.
 *
 * Usage:
 *   npx tsx scripts/print-cp-origins.ts
 *
 * Requirements:
 *   Same DB env as the other scripts (Supabase URL + service-role key), so the
 *   tenant store can be read.
 */

import { getAllTenants } from "@/tenant/server";

/** Scheme+host origin of a URL, e.g. https://cms.x.nl/api → https://cms.x.nl. */
function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function main() {
  const tenants = await getAllTenants();

  const origins = Array.from(
    new Set(
      tenants
        .map((t) => originOf(t.cms?.statamicBaseUrl))
        .filter((o): o is string => Boolean(o)),
    ),
  ).sort();

  if (origins.length === 0) {
    console.error(
      "No tenant has a cms.statamicBaseUrl set — nothing to list. " +
        "Finalize the wiring (step 3) first.",
    );
    process.exit(1);
  }

  console.log("\nSet this on Vercel → Settings → Environment Variables:\n");
  console.log(`STATAMIC_CP_ORIGIN=${origins.join(" ")}\n`);
  console.log("Then redeploy the platform so the new frame-ancestors CSP ships.\n");
}

main().catch((err) => {
  console.error("[print-cp-origins] failed:", err);
  process.exit(1);
});
