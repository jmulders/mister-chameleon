/**
 * fix-platform-keys.mjs — plain JavaScript, no TypeScript / esbuild needed
 *
 * Patches the 9 shared platform variant documents in Sanity so their `key`
 * field becomes a plain string instead of the broken slug object
 * { _type: "slug", current: "..." }.
 *
 * This is a one-time repair script for projects where platform-seed.ts was
 * run before the key format was corrected.  Once the documents are patched,
 * the GROQ query `key == $key` will resolve correctly and the homepage
 * fallback variants will load without error.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Set your environment variables:
 *     SANITY_PROJECT_ID=your_project_id
 *     SANITY_API_WRITE_TOKEN=your_write_token
 *     SANITY_DATASET=production           (optional, defaults to production)
 *
 *   Then run from your project root:
 *     node cms/seed/fix-platform-keys.mjs
 *
 *   Or dry-run to preview without writing:
 *     node cms/seed/fix-platform-keys.mjs --dry-run
 *
 * ─── Why this script exists ───────────────────────────────────────────────────
 *
 *   The variant schemas (heroVariant, proofVariant, ctaVariant) define `key`
 *   as `type: "string"`.  The platform-seed.ts script previously wrote
 *   `key: { _type: "slug", current: "..." }` — a slug object.  The GROQ
 *   query uses `key == $key` (string equality), so slug objects never matched,
 *   causing:
 *
 *     [composeHomepageExperience] Fallback CMS variants are missing:
 *     proofKey: "proof_platform", ctaKey: "cta_meeting"
 *
 *   This script sets `key` to the correct plain string on all 9 documents.
 *
 * ─── What is patched ─────────────────────────────────────────────────────────
 *
 *   Hero variants:  hero_google_problem, hero_linkedin_vision, hero_direct_brand
 *   Proof variants: proof_cases, proof_vision, proof_platform
 *   CTA variants:   cta_guide, cta_platform, cta_meeting
 */

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ID =
  process.env.SANITY_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

const DATASET =
  process.env.SANITY_DATASET ??
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  "production";

const TOKEN       = process.env.SANITY_API_TOKEN;
const API_VERSION = "2024-01-01";
const DRY_RUN     = process.argv.includes("--dry-run");

if (!PROJECT_ID) {
  console.error(
    "\n  ❌  SANITY_PROJECT_ID is not set.\n" +
    "  Add SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_PROJECT_ID to your environment.\n",
  );
  process.exit(1);
}
if (!TOKEN) {
  console.error(
    "\n  ❌  SANITY_API_TOKEN is not set.\n" +
    "  Create a write token at https://www.sanity.io/manage → API → Tokens\n" +
    "  and add it to .env.local:\n" +
    "    SANITY_API_TOKEN=your_token_here\n",
  );
  process.exit(1);
}

// ── Patches ───────────────────────────────────────────────────────────────────

/** Each entry: the Sanity document _id and the correct plain-string key. */
const PATCHES = [
  { _id: "hero_google_problem",  key: "hero_google_problem"  },
  { _id: "hero_linkedin_vision", key: "hero_linkedin_vision" },
  { _id: "hero_direct_brand",    key: "hero_direct_brand"    },
  { _id: "proof_cases",          key: "proof_cases"          },
  { _id: "proof_vision",         key: "proof_vision"         },
  { _id: "proof_platform",       key: "proof_platform"       },
  { _id: "cta_guide",            key: "cta_guide"            },
  { _id: "cta_platform",         key: "cta_platform"         },
  { _id: "cta_meeting",          key: "cta_meeting"          },
];

// ── Sanity REST mutations ─────────────────────────────────────────────────────

const endpoint =
  `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}`;

async function patchDocuments() {
  const mutations = PATCHES.map(({ _id, key }) => ({
    patch: { id: _id, set: { key } },
  }));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ mutations }),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(`Sanity API ${res.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🔧  Fix platform variant key format — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
console.log(`   Project: ${PROJECT_ID}`);
console.log(`   Dataset: ${DATASET}`);
console.log(`   Patches: ${PATCHES.length} documents\n`);

if (DRY_RUN) {
  for (const { _id, key } of PATCHES) {
    console.log(`   [dry-run]  ${_id}  →  key: "${key}"`);
  }
  console.log("\n✅  Dry run complete — no changes written.\n");
  process.exit(0);
}

try {
  const result = await patchDocuments();
  const results = Array.isArray(result.results) ? result.results : [];

  let okCount  = 0;
  let errCount = 0;

  for (const { _id, key } of PATCHES) {
    const entry = results.find((r) => r.id === _id);
    if (entry) {
      console.log(`   ✅  ${_id}  →  key: "${key}"  (${entry.operation ?? "patched"})`);
      okCount++;
    } else if (results.length === 0) {
      // Sanity returns an empty results array when all patches succeed without
      // document-level detail — the batch was accepted.
      okCount++;
    } else {
      console.log(`   ❓  ${_id} — not found in dataset (document may not exist)`);
      errCount++;
    }
  }

  if (results.length === 0) {
    console.log("   ℹ️  Mutations accepted (Sanity returned no per-document results).");
  }

  console.log(`\n✅  Done: ${okCount} patched${errCount > 0 ? `, ${errCount} not found` : ""}.\n`);

  if (errCount > 0) {
    console.log(
      "   Documents marked ❓ were not found in your dataset.\n" +
      "   Run the full seed to create them:\n" +
      "     npx tsx cms/seed/platform-seed.ts\n",
    );
    process.exit(1);
  }
} catch (err) {
  console.error(`\n❌  Error: ${err.message}\n`);
  process.exit(1);
}
