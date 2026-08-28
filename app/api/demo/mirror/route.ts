/**
 * POST /api/demo/mirror
 *
 * Generates a "Live Mirror Demo" for a prospect URL.
 *
 * ─── What it does ─────────────────────────────────────────────────────────────
 *
 *   1. Fetches the prospect's homepage and cleans it (site-mirror.ts)
 *   2. Analyses the URL for brand signals + generates 5 scenario templates
 *   3. Maps scenarios → slot content for each of the 6 blueprint archetypes
 *   4. Injects data-mc-slot attributes, the MC snippet, and scenario panel
 *      (slot content is embedded so the panel works without CMS configuration)
 *   5. Stores the instrumented HTML in demo_instances.mirrored_html
 *   6. Returns a shareable URL: /demo/[demoId]/live
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   Requires a valid mc_admin_token session cookie (same as /api/demo/generate).
 *
 * ─── Site key ─────────────────────────────────────────────────────────────────
 *
 *   The injected snippet uses the MC_DEMO_SITE_KEY env var, which should be set
 *   to the Mister Chameleon demo tenant's snippet site key.  Falls back to the
 *   development snippet-demo.html key if unset.
 */

import { NextRequest, NextResponse }        from "next/server";
import { cookies }                          from "next/headers";
import { createClient }                     from "@supabase/supabase-js";
import { verifySession, ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { mirrorSite, proxifyAssets, fillMissingImages } from "@/demo/site-mirror";
import { resolveRenderConfig }               from "@/demo/site-render";
import { instrumentHtml }                   from "@/demo/slot-injector";
import { analyzeSite }                      from "@/demo/analyzer";
import { generateScenarios }               from "@/demo/content-generator";
import { analyzeAndGenerateSlots }         from "@/demo/ai-slot-analyzer";
import { createDemoInstance }              from "@/demo/store";
import { resolveDemoBaseUrl }              from "@/lib/base-url";
import type { DemoScenario }               from "@/demo/types";

// Self-hosted headless Chrome (JS-render path) needs the Node runtime, a longer
// budget, and more memory. Cold starts are fine — demos run occasionally. Memory
// is set in vercel.json (functions), which route exports cannot express.
export const runtime     = "nodejs";
export const maxDuration = 30;
export const dynamic     = "force-dynamic";

// ── Demo site key ─────────────────────────────────────────────────────────────
//
// Resolution order:
//   1. platform_settings DB  (Admin → Integrations → AI → Demo Site Key)
//   2. MC_DEMO_SITE_KEY env var
//   3. Hard-coded development fallback
//
// Set it via the dashboard — no .env changes required in production.

// NOTE: set MC_DEMO_SITE_KEY in your environment or via Admin → Integrations → AI → Demo Site Key
const FALLBACK_DEMO_SITE_KEY = process.env["MC_DEMO_SITE_KEY_FALLBACK"] ?? "";

async function resolveDemoSiteKey(): Promise<string> {
  try {
    const { getPlatformAiSettings } = await import("@/platform/platform-store");
    const result = await getPlatformAiSettings();
    if (result.ok && result.data.demoSiteKey?.trim()) {
      return result.data.demoSiteKey.trim();
    }
  } catch {
    // DB unavailable — fall through to env var
  }
  return (process.env["MC_DEMO_SITE_KEY"] ?? "").trim() || FALLBACK_DEMO_SITE_KEY;
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function getAdminAuth(): Promise<
  | { ok: true;  adminEmail: string }
  | { ok: false; detail: "session_missing" | "2fa_required" }
> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) return { ok: false, detail: "session_missing" };

  const session = await verifySession(token);
  if (!session) return { ok: false, detail: "session_missing" };
  if (session.twoFaEnabled && !session.twoFaVerified) return { ok: false, detail: "2fa_required" };

  return { ok: true, adminEmail: session.email };
}

// ── Request type ──────────────────────────────────────────────────────────────

interface MirrorInput {
  url:          string;
  generatedBy?: string;
  expiryDays?:  number;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminAuth();

  if (!auth.ok) {
    const detail  = auth.detail;
    const message =
      detail === "2fa_required"
        ? "Two-factor authentication is required."
        : "Admin session expired — please log in.";
    return NextResponse.json(
      { error: "Unauthorized", detail, message },
      { status: 401 },
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body as Partial<MirrorInput>;

  if (!input.url || typeof input.url !== "string" || input.url.trim().length < 4) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const url        = input.url.trim();
  const expiryDays = typeof input.expiryDays === "number"
    ? Math.max(1, Math.min(30, input.expiryDays))
    : 7;

  const startMs = Date.now();

  // Resolve demo site key from DB first, env var fallback
  const DEMO_SITE_KEY = await resolveDemoSiteKey();

  const baseUrl = await resolveDemoBaseUrl();

  // Service-role client — reused for render-config resolution and storage.
  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Step 1: Mirror the site ─────────────────────────────────────────────────
  //   When JS-rendering is enabled (demo_importer settings), the page is rendered
  //   with a self-hosted headless Chrome for a faithful mirror; otherwise a plain
  //   fetch is used (with automatic fallback on error/timeout).

  const renderConfig = await resolveRenderConfig(client);

  let mirrored;
  try {
    mirrored = await mirrorSite(url, renderConfig);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch the prospect URL: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  // ── Step 2: Analyse + generate scenarios ────────────────────────────────────
  //   The analysis provides brand signals (colors, category) and drives the
  //   scenario copy that gets embedded in the Scenario Control Panel.

  let analysis;
  try {
    analysis = await analyzeSite(url);
    // Mirror extraction is more accurate for title/favicon
    if (mirrored.title)      analysis.title      = mirrored.title;
    if (mirrored.faviconUrl) analysis.faviconUrl = mirrored.faviconUrl;
    if (mirrored.logoUrl)    analysis.logoUrl     = mirrored.logoUrl;
  } catch {
    // Non-fatal — build a minimal analysis stub
    analysis = {
      fetchedUrl:     mirrored.baseUrl,
      title:          mirrored.title,
      description:    "",
      category:       "general" as const,
      primaryColor:   "#3b82f6",
      secondaryColor: "#1e3a8a",
      logoUrl:        mirrored.logoUrl ?? undefined,
      faviconUrl:     mirrored.faviconUrl ?? undefined,
      keywords:       [],
      fetchSucceeded: mirrored.fetchSucceeded,
    };
  }

  const scenarios = generateScenarios(analysis);

  // ── Step 2b: AI-driven slot analysis ────────────────────────────────────────
  //   Uses Claude to identify 8-12 personalizable elements in the mirrored HTML
  //   and generate 6 unique content variants per element (one per blueprint
  //   scenario).  Runs concurrently with nothing else — result is non-fatal on
  //   failure (falls back to regex heuristics in slot-injector.ts).

  const aiSlotDefs = await analyzeAndGenerateSlots(mirrored.html, {
    url:         mirrored.baseUrl,
    title:       mirrored.title,
    category:    analysis.category,
    description: analysis.description,
  });

  // ── Step 3: Build scenario slot content for the panel ──────────────────────
  //   Start with the 5 legacy scenario experiences (mapped to 6 blueprint keys)
  //   as a base, then layer in the AI-generated slots on top — giving us unique
  //   content for all detected elements across all 6 scenarios.

  /**
   * Extract slot values from a DemoScenario's experience block.
   * Maps scenario content to the 8 slot keys that the HTML taggers inject:
   *   hero-title / hero-subtitle / hero-cta-label
   *   proof-title / proof-body
   *   cta-title / cta-body / cta-cta
   */
  /**
   * Extract slot values from a DemoScenario's experience block.
   * Slot key names MUST match what /api/snippet/decide emits so the
   * same data-mc-slot attributes work for both embedded and API-driven content.
   */
  function slotsFromScenario(s: DemoScenario | undefined): Record<string, string> {
    if (!s) return {};
    const slots: Record<string, string> = {};
    const { hero, proof, cta } = s.experience;
    // Hero block
    if (hero.headline)    slots["hero-title"]        = hero.headline;
    if (hero.subheadline) slots["hero-subtitle"]     = hero.subheadline;
    if (hero.ctaLabel)    slots["hero-cta-label"]    = hero.ctaLabel;
    // Proof block — key matches decide endpoint: proof-item-0-text
    if (proof.heading)    slots["proof-title"]       = proof.heading;
    if (proof.body)       slots["proof-item-0-text"] = proof.body;
    // CTA block — keys match decide endpoint: cta-text, cta-cta-label
    if (cta.heading)      slots["cta-title"]         = cta.heading;
    if (cta.body)         slots["cta-text"]          = cta.body;
    if (cta.ctaLabel)     slots["cta-cta-label"]     = cta.ctaLabel;
    return slots;
  }

  const scenarioMap = Object.fromEntries(scenarios.map((s) => [s.id, s]));

  // Build base slots from legacy scenarios
  const scenarioSlots: Record<string, Record<string, string>> = {
    awareness:     { ...slotsFromScenario(scenarioMap["new_visitor"])      },
    consideration: { ...slotsFromScenario(scenarioMap["returning_visitor"]) },
    high_intent:   { ...slotsFromScenario(scenarioMap["high_intent"])      },
    form_dropout:  { ...slotsFromScenario(scenarioMap["returning_visitor"]) },
    customer:      { ...slotsFromScenario(scenarioMap["returning_visitor"]) },
    expansion:     { ...slotsFromScenario(scenarioMap["high_intent"])      },
  };

  // Merge AI-generated slots on top (AI content takes precedence for its keys;
  // legacy content fills any gaps for keys the AI didn't produce variants for).
  for (const slotDef of aiSlotDefs) {
    for (const [scenarioKey, content] of Object.entries(slotDef.scenarios)) {
      if (!scenarioSlots[scenarioKey]) scenarioSlots[scenarioKey] = {};
      scenarioSlots[scenarioKey][slotDef.slotKey] = content;
    }
  }

  // ── Step 4: Instrument the HTML ─────────────────────────────────────────────

  const instrumentedHtml = instrumentHtml(mirrored.html, {
    siteKey:        DEMO_SITE_KEY,
    decideBase:     baseUrl,
    siteName:       mirrored.title,
    faviconUrl:     mirrored.faviconUrl,
    aiSlots:        aiSlotDefs,
    // Embed the full scenario→slot map directly in the HTML so the scenario
    // panel applies content instantly without a decide round-trip.
    // This makes the demo self-contained and reliable even before the
    // scenario_slots DB migration is applied.
    scenarioSlots,
  });

  // Route the prospect's images through our same-origin proxy so cross-origin
  // hotlink/CORP protection on the source site doesn't blank them out.
  const proxiedHtml = proxifyAssets(instrumentedHtml, baseUrl);

  // Fill any remaining placeholder image slots (JS-lazy-loaded originals that
  // aren't in the static HTML) with category-matched Unsplash photos, so the
  // mirror looks complete instead of showing blank boxes.
  const mirroredHtml = fillMissingImages(proxiedHtml, analysis.category);

  const generationMs = Date.now() - startMs;

  // ── Step 5: Store ────────────────────────────────────────────────────────────

  let demo;
  try {
    demo = await createDemoInstance(client, {
      analysis,
      scenarios,
      generatedBy:  input.generatedBy ?? auth.adminEmail,
      generationMs,
      expiryDays,
      demoMode:      "mirror" as const,
      mirroredHtml,
      scenarioSlots,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/demo/mirror] createDemoInstance failed", { url, error: msg });
    return NextResponse.json(
      { error: `Failed to store demo: ${msg}` },
      { status: 500 },
    );
  }

  // ── Return ───────────────────────────────────────────────────────────────────

  const demoUrl = `${baseUrl}/demo/${demo.id}/live`;

  console.info(
    `[api/demo/mirror] mirror demo created — demoId=${demo.id}` +
    ` siteName=${demo.site_name} fetchSucceeded=${mirrored.fetchSucceeded}` +
    ` aiSlots=${aiSlotDefs.length} generationMs=${generationMs} createdBy=${auth.adminEmail}`,
  );

  return NextResponse.json(
    {
      demoId:         demo.id,
      demoUrl,
      siteName:       demo.site_name,
      expiresAt:      demo.expires_at,
      fetchSucceeded: mirrored.fetchSucceeded,
    },
    { status: 200 },
  );
}
