/**
 * Marketing Site Seed - CLI runner
 *
 * Creates all public-facing marketing pages in Sanity under
 * tenantId "mister-chameleon".  Every document uses createOrReplace
 * so re-running after a content edit is safe and idempotent.
 *
 * Usage:
 *   npx tsx cms/seed/marketing-site-seed.ts
 *   npx tsx cms/seed/marketing-site-seed.ts --dry-run
 *
 *   npm run seed:marketing
 *   npm run seed:marketing:dry
 *
 * Required env vars:
 *   SANITY_API_TOKEN          Write token (Editor role or higher)
 *   NEXT_PUBLIC_SANITY_PROJECT_ID  or  SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET     or  SANITY_DATASET   (default: production)
 *
 * Studio button:
 *   See apps/studio/plugins/seed-tool.tsx - same pages, no terminal needed.
 *
 * ── Cleanup steps ─────────────────────────────────────────────────────────────
 *
 * After seeding, two classes of stale documents are removed:
 *
 * 1. Legacy bare variant documents — before the tenant-scoping migration,
 *    variant documents used bare _ids equal to the variant key (e.g.
 *    "hero_direct_brand") with no tenantId.  These have been replaced by
 *    tenant-scoped equivalents ("mister-chameleon_*").  The ID list is derived
 *    automatically from the current variant keys.
 *
 * 2. Duplicate page documents — any page document whose slug matches a
 *    canonical seed page but whose _id differs from the canonical
 *    "mister-chameleon_page_<id>" form.  These arise when the seed was
 *    previously run under a different ID scheme (e.g. bare slug IDs, or
 *    provisioner-generated IDs).  Only the canonical ID survives; all others
 *    are deleted so slug-based GROQ queries always return the correct version.
 */

import { readFileSync }         from "fs";
import { resolve }              from "path";
import { parse as parseDotenv } from "dotenv";
import { createClient }         from "@sanity/client";
import { allMarketingPages }    from "./marketing-site-pages";
import { marketingSiteVariants } from "./marketing-site-variants";

export { allMarketingPages, marketingSiteVariants };

/** All documents seeded for the mister-chameleon marketing site */
export const allMarketingDocuments = [
  ...allMarketingPages,
  ...marketingSiteVariants,
] as const;

// ── Env loading ────────────────────────────────────────────────────────────────

const _envLoad = (function loadEnvFiles() {
  const root = process.cwd();
  const merged: Record<string, string> = {};
  const found: string[] = [];
  for (const file of [".env", ".env.local"]) {
    try {
      Object.assign(merged, parseDotenv(readFileSync(resolve(root, file), "utf8")));
      found.push(file);
    } catch { /* skip */ }
  }
  let applied = 0;
  for (const [k, v] of Object.entries(merged)) {
    if (!(k in process.env)) { process.env[k] = v; applied++; }
  }
  return { files: found, applied };
})();

function resolveConfig() {
  const projectId = process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset   = process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  const token     = process.env.SANITY_API_TOKEN;
  if (!projectId) throw new Error("SANITY_PROJECT_ID not set.");
  if (!token)     throw new Error("SANITY_API_TOKEN not set. Needs Editor role.");
  return { projectId, dataset, token };
}

function createWriteClient(cfg: ReturnType<typeof resolveConfig>) {
  return createClient({ ...cfg, apiVersion: "2024-01-01", useCdn: false });
}

// ── Legacy ID list ─────────────────────────────────────────────────────────────
//
// Before the tenant-scoping migration, variant documents were stored as shared
// content with bare _ids equal to the variant key (e.g. "hero_direct_brand").
// They have since been replaced by tenant-scoped documents ("mister-chameleon_*").
//
// This list is derived automatically from the current variant keys so it stays
// in sync whenever variants are added or renamed.

const legacyVariantIds: string[] = marketingSiteVariants.map(
  (v) => (v as Record<string, unknown>).key as string,
);

// ── Canonical page ID set ──────────────────────────────────────────────────────
//
// All _ids that the seed owns for the mister-chameleon tenant.  Used by the
// dupe-cleanup step to ensure we never accidentally delete a canonical page
// that happens to share a slug with another canonical page (e.g. locale
// variant pages that reuse the same slug as the primary page).
//
// This set is also used to derive the tenant identifier from the pages
// themselves rather than hard-coding it a second time.

const canonicalPageIds: string[] = allMarketingPages.map(
  (p) => String((p as Record<string, unknown>)._id),
);

// Derive the tenant ID from the first page document (all pages share the
// same tenantId value set in the page() factory in marketing-site-pages.ts).
const SEED_TENANT_ID: string =
  String((allMarketingPages[0] as Record<string, unknown>).tenantId ?? "mister-chameleon");

// ── Seed runner ────────────────────────────────────────────────────────────────

export async function seedMarketingSite(dryRun = false): Promise<void> {
  const pageCount    = allMarketingPages.length;
  const variantCount = marketingSiteVariants.length;
  const total        = pageCount + variantCount;
  console.log(`\n🦎  Marketing site seed - ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  const projectId = process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "(not set)";
  const dataset   = process.env.SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
  if (_envLoad.files.length > 0)
    console.log(`   Env files  : ${_envLoad.files.join(", ")}  (${_envLoad.applied} vars applied)`);
  console.log(`   Project ID : ${projectId}`);
  console.log(`   Dataset    : ${dataset}`);
  console.log(`   Pages      : ${pageCount}`);
  console.log(`   Variants   : ${variantCount}  (tenantId: mister-chameleon)`);
  console.log(`   Tenant     : ${SEED_TENANT_ID}`);
  console.log(`   Legacy IDs : ${legacyVariantIds.length}  (will be deleted if present)`);
  console.log(`   Dupe pages : non-canonical IDs for ${canonicalPageIds.length} slugs will be purged`);
  console.log();

  if (dryRun) {
    console.log("  Pages:");
    for (const doc of allMarketingPages) {
      const d    = doc as Record<string, unknown>;
      const slug = (d.slug as Record<string, unknown> | undefined)?.current
        ? `/${(d.slug as Record<string, unknown>).current}`
        : `[${d._type}]`;
      console.log(`     ${String(d._id).padEnd(50)}  ${slug}`);
    }
    console.log("\n  Variants:");
    for (const doc of marketingSiteVariants) {
      const d = doc as Record<string, unknown>;
      console.log(`     ${String(d._id).padEnd(50)}  [${d._type}]`);
    }
    console.log("\n  Legacy IDs to delete (if present):");
    for (const id of legacyVariantIds) {
      console.log(`     ${id}`);
    }
    console.log("\n  Duplicate page slugs to purge (non-canonical _ids, tenant-scoped):");
    const drySlugs = new Set<string>();
    for (const doc of allMarketingPages) {
      const d    = doc as Record<string, unknown>;
      const slug = (d.slug as Record<string, unknown>)?.current as string | undefined;
      if (slug && !drySlugs.has(slug)) {
        drySlugs.add(slug);
        console.log(`     slug=${slug}  tenant=${SEED_TENANT_ID}  excluding ${canonicalPageIds.length} canonical IDs`);
      }
    }
    console.log(`\n✅  Dry run - ${total} documents, no changes written.\n`);
    return;
  }

  if (dataset === "production") {
    console.warn("   ⚠️   Writing to PRODUCTION. Ctrl-C within 3 s to abort.");
    await new Promise((r) => setTimeout(r, 3000));
  }

  const config = resolveConfig();
  const client = createWriteClient(config);
  let ok = 0, fail = 0;

  // ── 1. Upsert all pages and variants ────────────────────────────────────────
  for (const doc of allMarketingDocuments) {
    const d  = doc as Record<string, unknown>;
    const id = String(d._id);
    try {
      await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
      // Delete any open draft so Studio shows the freshly-seeded published version
      // rather than the stale draft that may have been created by the tenant provisioner.
      try { await client.delete(`drafts.${id}`); } catch { /* no draft - fine */ }
      console.log(`   ✅  ${id}`);
      ok++;
    } catch (err) {
      console.error(`   ❌  ${id} - ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  // ── 2. Delete legacy bare variant documents (pre-tenant-scoping migration) ──
  console.log("\n   Cleaning up legacy shared variant documents...");
  let cleaned = 0, alreadyGone = 0;

  for (const id of legacyVariantIds) {
    try {
      const existing = await client.fetch<{ _id: string } | null>(
        `*[_id == $id && !defined(tenantId)][0]{ _id }`,
        { id },
      );
      if (!existing) {
        alreadyGone++;
        continue;
      }
      await client.delete(id);
      try { await client.delete(`drafts.${id}`); } catch { /* no draft - fine */ }
      console.log(`   🗑   ${id}`);
      cleaned++;
    } catch (err) {
      console.error(`   ⚠️   ${id} - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (cleaned > 0)
    console.log(`\n   Removed ${cleaned} legacy document${cleaned !== 1 ? "s" : ""}.`);
  else
    console.log(`   Nothing to clean up (${alreadyGone} legacy IDs already absent).`);

  // ── 3. Delete duplicate page documents with non-canonical _ids ───────────────
  //
  // For each unique slug in the seed, delete any page documents that:
  //   (a) belong to the seed tenant (tenantId == SEED_TENANT_ID), AND
  //   (b) share the slug but are NOT one of the canonical seed page IDs.
  //
  // Two important safety constraints prevent collateral damage:
  //
  //   1. tenantId filter — pages belonging to other tenants (e.g. workengine_*)
  //      are never touched, even if they happen to share a slug.
  //
  //   2. canonicalPageIds exclusion — we exclude ALL canonical IDs from the
  //      delete set, not just the one currently being iterated.  This prevents
  //      the case where a locale-variant page (slug="home", id="…home-nl")
  //      causes the primary page (slug="home", id="…home") to be found as a
  //      "duplicate" when the loop reaches the locale entry.
  //
  // We deduplicate slugs so each slug is only queried once.
  console.log("\n   Purging duplicate page documents (non-canonical _ids)...");
  let dupesCleaned = 0, dupesAlreadyGone = 0;

  const processedSlugs = new Set<string>();

  for (const doc of allMarketingPages) {
    const d    = doc as Record<string, unknown>;
    const slug = (d.slug as Record<string, unknown>)?.current as string | undefined;
    if (!slug || processedSlugs.has(slug)) continue;
    processedSlugs.add(slug);

    try {
      // Find all published page documents for this tenant+slug that are not
      // one of the known canonical seed IDs.  Excludes drafts (handled below).
      const dupes = await client.fetch<{ _id: string }[]>(
        `*[
          _type == "page" &&
          tenantId == $tenantId &&
          slug.current == $slug &&
          !(_id in $canonicalIds) &&
          !(_id in path("drafts.**"))
        ]{_id}`,
        { slug, tenantId: SEED_TENANT_ID, canonicalIds: canonicalPageIds },
      );
      for (const dupe of dupes) {
        try {
          await client.delete(dupe._id);
          try { await client.delete(`drafts.${dupe._id}`); } catch { /* no draft - fine */ }
          console.log(`   🗑   ${dupe._id}  (dupe of slug="${slug}")`);
          dupesCleaned++;
        } catch (err) {
          console.error(`   ⚠️   ${dupe._id} - ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (dupes.length === 0) dupesAlreadyGone++;
    } catch (err) {
      console.error(`   ⚠️   slug=${slug} query failed - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (dupesCleaned > 0)
    console.log(`\n   Removed ${dupesCleaned} duplicate page document${dupesCleaned !== 1 ? "s" : ""}.`);
  else
    console.log(`   No duplicate pages found (${dupesAlreadyGone} slugs checked, all clean).`);

  console.log(`\n🦎  Done: ${ok} created/replaced, ${fail} failed.\n`);
  if (fail > 0) process.exit(1);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const isDirect =
  typeof process !== "undefined" && process.argv[1] !== undefined &&
  (process.argv[1].endsWith("marketing-site-seed.ts") ||
   process.argv[1].endsWith("marketing-site-seed.js"));

if (isDirect) {
  const dryRun = process.argv.includes("--dry-run");
  seedMarketingSite(dryRun).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
