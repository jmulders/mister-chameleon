/**
 * Tenant CMS Provisioner
 *
 * Builds and writes starter Sanity documents for a tenant that has been
 * configured in the admin.  Called by `provisionSiteAction` (server action)
 * when an operator clicks "Provision site to CMS" on the tenant detail page.
 *
 * ─── What gets provisioned ────────────────────────────────────────────────────
 *
 *   For every tenant:
 *     {tenantId}_page_home          — Homepage page document (marketing-page template)
 *     hero_{tenantId}_default       — Starter hero variant
 *     proof_{tenantId}_default      — Starter proof variant
 *     cta_{tenantId}_default        — Starter CTA variant
 *
 *   Homepage sections are package-gated (via allowedBlocks.content):
 *     starter:   textSection (intro paragraph)
 *     growth:    textSection + featureGrid + testimonialSection
 *     pro:       textSection + featureGrid + testimonialSection
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   All documents are written via `createOrReplace`.  Re-running provisioning
 *   for a tenant that has already been provisioned is safe — existing documents
 *   are replaced with the same starter content.  Manually customised content
 *   in Sanity Studio will be overwritten; this is intentional for a "reset
 *   to defaults" use case.  Operators should be warned in the UI.
 *
 * ─── Design token embedding ───────────────────────────────────────────────────
 *
 *   The provisioned page document stores a `designTokens` snapshot of the
 *   tenant's resolved theme at provisioning time.  This lets the Sanity Studio
 *   (and preview environments) apply the correct brand colours and radius values
 *   when editing content.  It is NOT the runtime rendering path — at render time
 *   the tokens are always re-resolved from the live TenantSettings.
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   This module requires `SANITY_WRITE_TOKEN`.  It must only be imported from
 *   server-only contexts (Server Actions, API routes, CLI scripts).
 *
 * ─── Usage (server action) ────────────────────────────────────────────────────
 *
 *   import { provisionTenant } from "@/cms/seed/tenant-provisioner";
 *   const result = await provisionTenant(tenant);
 *   if (!result.ok) { ... }
 *
 * ─── Usage (CLI dry-run) ──────────────────────────────────────────────────────
 *
 *   SANITY_PROJECT_ID=... SANITY_WRITE_TOKEN=... \
 *     npx tsx cms/seed/tenant-provisioner.ts --tenant=workengine [--dry-run]
 */

import { createClient }       from "@sanity/client";
import { getPackageDefinition } from "@/tenant/packages";
import { resolveThemeForTenant } from "@/tenant/resolve-theme";
import type { TenantSettings } from "@/tenant/types";
import type { ContentBlockKey } from "@/tenant/types";

// ── Sanity write client ────────────────────────────────────────────────────────

/**
 * Resolves the effective Sanity write token.
 *
 * Priority (highest → lowest):
 *   1. Per-tenant writeToken from TenantCmsSettings  (admin-configured, tenant-specific)
 *   2. SANITY_API_WRITE_TOKEN env var                (preferred naming)
 *   3. SANITY_WRITE_TOKEN env var                    (legacy naming — kept for compat)
 */
function resolveWriteToken(tenantWriteToken?: string): string | undefined {
  return (
    (tenantWriteToken?.trim() || undefined) ??
    (process.env.SANITY_API_WRITE_TOKEN?.trim() || undefined) ??
    (process.env.SANITY_WRITE_TOKEN?.trim() || undefined)
  );
}

function createWriteClient(tenantWriteToken?: string) {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset   = process.env.SANITY_DATASET ?? "production";
  const token     = resolveWriteToken(tenantWriteToken);

  if (!projectId) {
    throw new Error("SANITY_PROJECT_ID is not set.");
  }
  if (!token) {
    throw new Error(
      "No Sanity write token configured. " +
      "Set SANITY_API_WRITE_TOKEN (or SANITY_WRITE_TOKEN) in environment variables, " +
      "or configure a write token in this tenant's CMS settings on the admin page.",
    );
  }

  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
    useCdn:     false,
  });
}

// ── Portable Text helpers ──────────────────────────────────────────────────────

function paragraph(text: string) {
  return {
    _type:    "block",
    _key:     uniqueKey("p"),
    style:    "normal",
    children: [{ _type: "span", _key: "s1", text, marks: [] }],
    markDefs: [],
  };
}

let _keyCounter = 0;
function uniqueKey(prefix = "k"): string {
  _keyCounter++;
  return `${prefix}${Date.now().toString(36)}${_keyCounter.toString(36)}`;
}

// ── Display name helper ────────────────────────────────────────────────────────

/**
 * Converts a tenantId slug to a human-readable display name.
 * "workengine"  → "Workengine"
 * "acme-corp"   → "Acme Corp"
 * "my-brand-io" → "My Brand Io"
 */
function tenantDisplayName(tenantId: string): string {
  return tenantId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ── Document builders ─────────────────────────────────────────────────────────

function buildHeroVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:      `hero_${tenantId}_default`,
    _type:    "heroVariant",
    tenantId,
    key:      { _type: "slug", current: `hero_${tenantId}_default` },
    isActive: true,
    tag:      "Welcome",
    title:    `Welcome to ${name}`,
    subtitle:
      `${name} helps you achieve more — with the right people, tools, and content ` +
      `delivered at exactly the right moment.`,
    ctaLabel: "Get Started",
    ctaHref:  "/contact",
  };
}

function buildProofVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:      `proof_${tenantId}_default`,
    _type:    "proofVariant",
    tenantId,
    key:      { _type: "slug", current: `proof_${tenantId}_default` },
    isActive: true,
    title:    "Why Choose Us",
    items: [
      {
        _key:  uniqueKey("pi"),
        title: "Expertise You Can Trust",
        text:  `${name} brings proven experience and a results-focused approach to every engagement.`,
      },
      {
        _key:  uniqueKey("pi"),
        title: "Fast Time-to-Value",
        text:  "We move quickly — from first conversation to measurable results in weeks, not months.",
      },
      {
        _key:  uniqueKey("pi"),
        title: "Long-term Partnership",
        text:  "Our clients stay because we deliver. We measure success by your outcomes, not ours.",
      },
    ],
  };
}

function buildCtaVariant(tenantId: string) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:      `cta_${tenantId}_default`,
    _type:    "ctaVariant",
    tenantId,
    key:      { _type: "slug", current: `cta_${tenantId}_default` },
    isActive: true,
    title:    "Ready to Get Started?",
    text:
      `Whether you have a question or a specific project in mind, the ${name} team ` +
      `is here to help. Reach out today.`,
    ctaLabel: "Get in Touch",
    ctaHref:  "/contact",
  };
}

/**
 * Builds the homepage sections array, gated by the tenant's package.
 *
 * Only sections whose `_type` maps to an allowed ContentBlockKey are included.
 * The starter package only allows textSection; growth and pro unlock
 * featureGrid and testimonialSection.
 */
function buildHomepageSections(
  tenantId:      string,
  allowedContent: readonly ContentBlockKey[],
): object[] {
  const name    = tenantDisplayName(tenantId);
  const allowed = new Set<string>(allowedContent);
  const sections: object[] = [];

  // ── textSection (starter+) ────────────────────────────────────────────────
  if (allowed.has("textSection")) {
    sections.push({
      _type:   "textSection",
      _key:    uniqueKey("ts"),
      heading: `About ${name}`,
      body: [
        paragraph(
          `${name} is built to deliver results. We combine deep domain expertise ` +
          `with a personal approach to ensure every client gets what they actually need.`,
        ),
        paragraph(
          `Our team is ready to help you grow — whether that means finding the right ` +
          `talent, delivering an innovative solution, or simply getting out of the way ` +
          `so you can focus on what matters most.`,
        ),
      ],
    });
  }

  // ── featureGrid (growth+) ─────────────────────────────────────────────────
  if (allowed.has("featureGrid")) {
    sections.push({
      _type:    "featureGrid",
      _key:     uniqueKey("fg"),
      heading:  `What We Do`,
      features: [
        {
          _key:        uniqueKey("f"),
          title:       "Strategy",
          description: "We help you define a clear path forward — from initial discovery to a concrete action plan.",
          icon:        "lightbulb",
        },
        {
          _key:        uniqueKey("f"),
          title:       "Delivery",
          description: "We execute with precision. Our team brings structure and accountability to every project.",
          icon:        "briefcase",
        },
        {
          _key:        uniqueKey("f"),
          title:       "Support",
          description: "We stay engaged after launch. Long-term success is our measure — not the handover date.",
          icon:        "users",
        },
      ],
    });
  }

  // ── testimonialSection (growth+) ─────────────────────────────────────────
  if (allowed.has("testimonialSection")) {
    sections.push({
      _type:        "testimonialSection",
      _key:         uniqueKey("tes"),
      heading:      "What Our Clients Say",
      testimonials: [
        {
          _key:    uniqueKey("t"),
          quote:   `Working with ${name} changed how we approach this entirely. The results speak for themselves.`,
          author:  "A Satisfied Client",
          company: "Client Organisation",
        },
        {
          _key:    uniqueKey("t"),
          quote:   `The team is responsive, professional, and genuinely invested in outcomes. We'd recommend them to anyone.`,
          author:  "Another Happy Client",
          company: "Partner Organisation",
        },
      ],
    });
  }

  return sections;
}

function buildHomepagePage(
  tenantId:      string,
  allowedContent: readonly ContentBlockKey[],
  resolvedVars:  Record<string, string>,
) {
  const name = tenantDisplayName(tenantId);
  return {
    _id:         `${tenantId}_page_home`,
    _type:       "page",
    tenantId,
    title:       `${name} — Homepage`,
    slug:        { _type: "slug", current: "home" },
    templateKey: "marketing-page",
    isPublished: true,

    // Context slot config — points to the tenant's own variants as fallback
    contextConfig: {
      hero:  { fallbackVariantKey: `hero_${tenantId}_default`  },
      proof: { fallbackVariantKey: `proof_${tenantId}_default` },
      cta:   { fallbackVariantKey: `cta_${tenantId}_default`   },
    },

    // Design token snapshot for Studio preview (informational only; not used at render time)
    ...(Object.keys(resolvedVars).length > 0 ? { designTokensSnapshot: resolvedVars } : {}),

    sections: buildHomepageSections(tenantId, allowedContent),
  };
}

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * Result of a provisioning run.
 *
 *   ok: true  — all documents were written; `documentIds` lists the Sanity _id
 *               values that were created or replaced.  `warnings` carries
 *               non-fatal notes (e.g. missing env vars in dry-run mode).
 *
 *   ok: false — provisioning failed; `error` is a human-readable reason.
 *               `partial` carries any document IDs that were written before
 *               the failure (partial write — caller should retry or clean up).
 */
export type ProvisionResult =
  | { ok: true;  documentIds: string[]; warnings: string[] }
  | { ok: false; error: string; partial?: string[] };

// ── Main provisioner ──────────────────────────────────────────────────────────

/**
 * Provisions starter CMS content for a tenant.
 *
 * Builds homepage page, hero/proof/cta variants, and package-gated page
 * sections, then writes them to Sanity using `createOrReplace`.
 *
 * All writes are idempotent — re-running provisioning is safe.
 * Existing tenant-scoped documents are replaced with the starter content.
 *
 * @param tenant  The tenant's stored settings (used for tenantId, package, design).
 * @param dryRun  When true, builds documents and returns their IDs without writing.
 * @returns       ProvisionResult with written document IDs and any warnings.
 *
 * @example
 * // From a server action:
 * const result = await provisionTenant(tenant);
 * if (!result.ok) return { ok: false, error: result.error };
 */
export async function provisionTenant(
  tenant:  TenantSettings,
  dryRun = false,
): Promise<ProvisionResult> {
  const { tenantId, packageKey, design } = tenant;
  const warnings: string[] = [];

  // ── Resolve package and design ────────────────────────────────────────────
  const pkg            = getPackageDefinition(packageKey);
  const allowedContent = pkg.allowedBlocks.content;

  // Resolve the theme to capture CSS vars for the Studio preview snapshot.
  const resolvedTheme = resolveThemeForTenant(tenant);
  const resolvedVars  = resolvedTheme.vars;

  // ── Build documents ───────────────────────────────────────────────────────
  const documents = [
    buildHeroVariant(tenantId),
    buildProofVariant(tenantId),
    buildCtaVariant(tenantId),
    buildHomepagePage(tenantId, allowedContent, resolvedVars),
  ];

  const documentIds = documents.map((d) => (d as { _id: string })._id);

  // ── Dry run ───────────────────────────────────────────────────────────────
  if (dryRun) {
    warnings.push("Dry run — no documents were written to Sanity.");
    return { ok: true, documentIds, warnings };
  }

  // ── Validate env vars and token before writing ───────────────────────────
  if (!process.env.SANITY_PROJECT_ID) {
    return { ok: false, error: "SANITY_PROJECT_ID is not set in environment variables." };
  }

  // Check the resolved write token (per-tenant → env vars) before attempting
  // to create the client.  Give a clear, actionable error when none is found.
  const effectiveWriteToken = resolveWriteToken(tenant.cms.writeToken);
  if (!effectiveWriteToken) {
    return {
      ok: false,
      error:
        "No Sanity write token configured for this tenant. " +
        "Add SANITY_API_WRITE_TOKEN (or SANITY_WRITE_TOKEN) to your environment variables, " +
        "or set a per-tenant write token via the CMS Credentials panel on the admin page.",
    };
  }

  // ── Write to Sanity ───────────────────────────────────────────────────────
  let client;
  try {
    client = createWriteClient(tenant.cms.writeToken);
  } catch (err) {
    return {
      ok:    false,
      error: err instanceof Error ? err.message : "Failed to create Sanity write client.",
    };
  }

  const written:  string[] = [];

  for (const doc of documents) {
    try {
      await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
      written.push((doc as { _id: string })._id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        ok:      false,
        error:   `Failed to write document "${(doc as { _id: string })._id}": ${reason}`,
        partial: written,
      };
    }
  }

  return { ok: true, documentIds: written, warnings };
}

// ── CLI entry-point ────────────────────────────────────────────────────────────
//
// Invoked directly for manual or CI provisioning:
//   npx tsx cms/seed/tenant-provisioner.ts --tenant=workengine [--dry-run]

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (
    process.argv[1].endsWith("tenant-provisioner.ts") ||
    process.argv[1].endsWith("tenant-provisioner.js")
  );

if (isDirect) {
  (async () => {
    const args     = process.argv.slice(2);
    const dryRun   = args.includes("--dry-run");
    const tenantArg = args.find((a) => a.startsWith("--tenant="));

    if (!tenantArg) {
      console.error("\nUsage: npx tsx cms/seed/tenant-provisioner.ts --tenant=<tenantId> [--dry-run]\n");
      process.exit(1);
    }

    const tenantId = tenantArg.split("=")[1]?.trim();
    if (!tenantId) {
      console.error("No tenantId provided in --tenant= argument.");
      process.exit(1);
    }

    // For CLI usage we build a minimal TenantSettings stub.
    // The store is not available in all CLI environments, so we accept
    // an optional --package flag and default to "starter".
    const packageArg = args.find((a) => a.startsWith("--package="));
    const packageKey = (packageArg?.split("=")[1]?.trim() ?? "starter") as
      "starter" | "growth" | "pro";

    const stub: TenantSettings = {
      tenantId,
      packageKey,
      features: { experiments: false, ai: false, analytics: true },
      blocks:   { context: ["hero", "proof", "cta"], content: [] },
      ai:       { mode: "disabled" },
      cms:      { provider: "sanity" },
      design:   { theme: "default" },
    };

    console.log(`\n🌱  Provisioning "${tenantId}" (${packageKey}) — ${dryRun ? "DRY RUN" : "LIVE"}\n`);

    const result = await provisionTenant(stub, dryRun);

    if (!result.ok) {
      console.error(`\n❌  Provisioning failed: ${result.error}`);
      if (result.partial?.length) {
        console.log(`  Partial writes: ${result.partial.join(", ")}`);
      }
      process.exit(1);
    }

    console.log(`\n✅  Provisioned ${result.documentIds.length} documents:`);
    for (const id of result.documentIds) {
      console.log(`  ${id}`);
    }
    if (result.warnings.length > 0) {
      console.log("\nWarnings:");
      for (const w of result.warnings) {
        console.log(`  ⚠  ${w}`);
      }
    }
    console.log();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
