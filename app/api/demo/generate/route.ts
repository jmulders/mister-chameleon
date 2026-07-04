/**
 * POST /api/demo/generate
 *
 * Generate a prospect demo from a URL.
 * v2: AI-generated bilingual content + curated images.
 */

import { NextRequest, NextResponse }              from "next/server";
import { cookies }                                from "next/headers";
import { createClient }                           from "@supabase/supabase-js";
import { verifySession, ADMIN_TOKEN_COOKIE }       from "@/lib/admin-auth";
import { analyzeSite }                            from "@/demo/analyzer";
import { generateScenarios, generateBilingualPageContent } from "@/demo/content-generator";
import { getDemoImages }                          from "@/demo/image-provider";
import { createDemoInstance }                     from "@/demo/store";
import { resolveRequestBaseUrl }                  from "@/lib/base-url";
import type { GenerateDemoInput, GenerateDemoResponse } from "@/demo/types";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function getAdminAuth(
  req: NextRequest,
): Promise<
  | { ok: true;  adminEmail: string }
  | { ok: false; detail: "session_missing" | "2fa_required" }
> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;

  if (!token) {
    console.warn("[api/demo/generate] auth: no mc_admin_token cookie present");
    return { ok: false, detail: "session_missing" };
  }

  const session = await verifySession(token);

  if (!session) {
    console.warn("[api/demo/generate] auth: mc_admin_token failed JWT verification");
    return { ok: false, detail: "session_missing" };
  }

  if (session.twoFaEnabled && !session.twoFaVerified) {
    console.warn(`[api/demo/generate] auth: 2FA not completed — adminEmail=${session.email}`);
    return { ok: false, detail: "2fa_required" };
  }

  return { ok: true, adminEmail: session.email };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await getAdminAuth(req);

  if (!auth.ok) {
    const message =
      auth.detail === "2fa_required"
        ? "Two-factor authentication is required. Please complete the 2FA challenge at /admin/login/2fa."
        : "Your admin session has expired or is missing. Please log in at /admin/login.";
    return NextResponse.json({ error: "Unauthorized", detail: auth.detail, message }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body as Partial<GenerateDemoInput>;

  if (!input.url || typeof input.url !== "string" || input.url.trim().length < 4) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const expiryDays = typeof input.expiryDays === "number"
    ? Math.max(1, Math.min(30, input.expiryDays))
    : 7;

  // ── Supabase client ─────────────────────────────────────────────────────────

  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // ── Step 1: Analyze ─────────────────────────────────────────────────────────

  const startMs = Date.now();

  let analysis;
  try {
    analysis = await analyzeSite(input.url.trim());
  } catch (err) {
    console.error("[api/demo/generate] analyzeSite failed", {
      url: input.url, error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to analyse the prospect URL. Please check that it is accessible." },
      { status: 502 },
    );
  }

  // ── Step 2: Generate content (parallel: scenarios + bilingual + images) ─────

  const [scenarios, bilingualContent, pageImages] = await Promise.all([
    Promise.resolve(generateScenarios(analysis)),
    generateBilingualPageContent(analysis).catch((err) => {
      console.warn("[api/demo/generate] bilingual content generation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { en: null as never, nl: null as never };
    }),
    getDemoImages(analysis.category).catch(() => null),
  ]);

  const { en: contentEn, nl: contentNl } = bilingualContent;

  // Attach hero image URL to content blocks if available
  if (pageImages?.hero) {
    if (contentEn?.hero) { contentEn.hero.imageUrl = pageImages.hero; contentEn.hero.imageAlt = analysis.title; }
    if (contentNl?.hero) { contentNl.hero.imageUrl = pageImages.hero; contentNl.hero.imageAlt = analysis.title; }
  }

  const generationMs = Date.now() - startMs;

  // ── Step 3: Store ────────────────────────────────────────────────────────────

  let demo;
  try {
    demo = await createDemoInstance(client, {
      analysis,
      scenarios,
      generatedBy:  input.generatedBy ?? auth.adminEmail,
      generationMs,
      expiryDays,
      contentEn,
      contentNl,
      pageImages,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    console.error("[api/demo/generate] createDemoInstance failed", {
      fn: "createDemoInstance", table: "demo_instances", url: input.url, error: errMsg,
    });

    let clientError: string;
    if (errMsg.includes("PGRST205") || errMsg.includes("42P01") || errMsg.includes("table missing")) {
      clientError = "demo_instances table is missing — run: supabase db push (applies migration 052).";
    } else if (errMsg.includes("column missing") || errMsg.includes("column '")) {
      const colMatch = errMsg.match(/column '([^']+)'/);
      clientError = colMatch
        ? `Schema mismatch: column '${colMatch[1]}' missing from demo_instances — run: supabase db push (migration 064).`
        : "Schema mismatch in demo_instances — run: supabase db push (migration 064).";
    } else if (errMsg.includes("23502") || errMsg.includes("NOT NULL")) {
      clientError = "Insert failed: a required field is NULL. Check server logs for the column name.";
    } else if (errMsg.includes("23505") || errMsg.includes("duplicate key")) {
      clientError = "Insert failed: duplicate demo ID. Please try again.";
    } else {
      clientError = `Failed to store the demo instance: ${errMsg}`;
    }

    return NextResponse.json({ error: clientError }, { status: 500 });
  }

  // ── Return ───────────────────────────────────────────────────────────────────

  const baseUrl = await resolveRequestBaseUrl();

  const demoUrl = `${baseUrl}/demo/${demo.id}`;

  const response: GenerateDemoResponse = {
    demoId:    demo.id,
    demoUrl,
    siteName:  demo.site_name,
    expiresAt: demo.expires_at,
  };

  const aiUsed = !!(contentEn || contentNl);
  console.info(
    `[api/demo/generate] demo created — demoId=${demo.id} siteName=${demo.site_name}` +
    ` category=${demo.site_category} generationMs=${generationMs}` +
    ` fetchSucceeded=${analysis.fetchSucceeded} aiContent=${aiUsed} createdBy=${auth.adminEmail}`,
  );

  return NextResponse.json(response, { status: 200 });
}
