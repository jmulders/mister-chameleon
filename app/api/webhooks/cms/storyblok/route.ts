/**
 * POST /api/webhooks/cms/storyblok
 *
 * Storyblok webhook handler voor adaptive block synchronisatie.
 *
 * ─── Architecture positie ─────────────────────────────────────────────────────
 *
 *   Storyblok (story published)
 *        ↓  POST webhook met Authorization: Bearer header
 *   deze route               ← YOU ARE HERE
 *        ↓  fetch story content via Storyblok CDN API
 *        ↓  mapStoryblokAdaptiveBlock() → AdaptiveBlockData[]
 *   syncAdaptiveBlocksToDB() → adaptive_blocks Supabase tabel
 *
 * ─── Wat dit verwerkt ─────────────────────────────────────────────────────────
 *
 *   Storyblok stuurt een webhook bij elke story publish.
 *   Deze route:
 *     1. Verifieert de Authorization: Bearer <STORYBLOK_WEBHOOK_SECRET> header
 *     2. Parseert het body als Storyblok webhook payload
 *     3. Verwerkt alleen action === "published"
 *     4. Haalt de story op via de Storyblok CDN API met story_id
 *     5. Controleert of de story content adaptive_block is (via component veld)
 *     6. Mapt met mapStoryblokAdaptiveBlock
 *     7. Haalt tenantId op uit STORYBLOK_TENANT_ID env var of query param
 *     8. Roept syncAdaptiveBlocksToDB aan
 *
 * ─── Configuratie ──────────────────────────────────────────────────────────────
 *
 *   Vereiste omgevingsvariabelen:
 *     STORYBLOK_WEBHOOK_SECRET    — gedeeld geheim van Storyblok webhook instellingen
 *     STORYBLOK_ACCESS_TOKEN      — Content Delivery API token (al geconfigureerd)
 *
 *   Optionele omgevingsvariabelen:
 *     STORYBLOK_TENANT_ID         — standaard tenant-scope voor gesynchroniseerde blocks
 *     STORYBLOK_REGION            — CDN regio (default: "eu")
 *
 *   De Storyblok webhook moet geconfigureerd worden op:
 *     URL:     https://<host>/api/webhooks/cms/storyblok
 *     Trigger: story.published
 *     Header:  Authorization: Bearer <STORYBLOK_WEBHOOK_SECRET>
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Verzoeken zonder geldig geheim worden afgewezen met 401.
 */

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { logger }                    from "@/lib/logger";
import { rethrowNextInternal }       from "@/lib/server-action-guard";
import { mapStoryblokAdaptiveBlock } from "@/cms/mappers/storyblok";
import { syncAdaptiveBlocksToDB }    from "@/lib/adaptive-blocks/adaptive-blocks-sync";
import type { StoryblokAdaptiveBlockContent } from "@/cms/queries/storyblok/adaptive-block-queries";
import {
  STORYBLOK_CDN_BASE_URLS,
  type StoryblokRegion,
} from "@/cms/providers/storyblok-client";
import { getPlatformStoryblokSettings } from "@/platform/platform-store";

// ── Storyblok webhook payload shape ───────────────────────────────────────────

interface StoryblokWebhookPayload {
  /** Het type actie dat de webhook getriggerd heeft */
  action: "published" | "unpublished" | "deleted" | "moved" | string;
  /** Storyblok numerieke story ID */
  story_id: number;
  /** Storyblok numerieke space ID */
  space_id?: number;
  /** Story slug (optioneel aanwezig in sommige webhook payloads) */
  full_slug?: string;
  /** Tekst van het story component type (optioneel) */
  text?: string;
}

// ── Story content wrapper ─────────────────────────────────────────────────────

interface StoryblokStoryEnvelope {
  id:        number;
  uuid?:     string;
  full_slug: string;
  content:   Record<string, unknown> & { component?: string };
}

interface StoryblokStoryResponse {
  story: StoryblokStoryEnvelope;
}

// ── Helper: fetch story by ID ─────────────────────────────────────────────────

/**
 * Haalt de gepubliceerde story op uit de Storyblok CDN via numerieke story ID.
 *
 * Storyblok CDN accepteert ook numerieke ID's als slug in de stories endpoint.
 * We gebruiken `find_by=id` parameter voor directe ID-lookup.
 */
async function fetchStoryById(storyId: number): Promise<StoryblokStoryEnvelope | null> {
  const token   = process.env.STORYBLOK_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN;
  const region  = (process.env.STORYBLOK_REGION ?? "eu") as StoryblokRegion;
  const baseUrl = STORYBLOK_CDN_BASE_URLS[region] ?? STORYBLOK_CDN_BASE_URLS.eu;

  if (!token) {
    logger.warn("[storyblok-webhook] STORYBLOK_ACCESS_TOKEN niet geconfigureerd.");
    return null;
  }

  const url = `${baseUrl}/stories/${storyId}?version=published&token=${token}&find_by=id`;

  try {
    const response = await fetch(url, { cache: "no-store" });

    if (response.status === 404) return null;
    if (!response.ok) {
      logger.warn("[storyblok-webhook] Storyblok CDN API fout.", {
        storyId, status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as StoryblokStoryResponse;
    return data.story ?? null;
  } catch (err) {
    logger.warn("[storyblok-webhook] Kon story niet ophalen.", {
      storyId, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Secret verificatie + DB-instellingen ophalen ──────────────────────────
  // Prioriteit voor webhook secret: platform DB instelling → STORYBLOK_WEBHOOK_SECRET env var.
  // Prioriteit voor tenantId:       platform DB instelling → STORYBLOK_TENANT_ID env var.
  let webhookSecret: string | undefined;
  let dbTenantId:    string | undefined;
  try {
    const stored = await getPlatformStoryblokSettings();
    if (stored.ok) {
      webhookSecret = stored.data.webhookSecret?.trim() || undefined;
      dbTenantId    = stored.data.tenantId?.trim()      || undefined;
    }
  } catch {
    // Non-fatal — valt terug op env vars.
  }
  if (!webhookSecret) {
    webhookSecret = process.env.STORYBLOK_WEBHOOK_SECRET?.trim() || undefined;
  }

  if (!webhookSecret) {
    logger.warn("[storyblok-webhook] Webhook secret niet geconfigureerd — afwijzen.");
    return NextResponse.json({ ok: false, error: "Webhook niet geconfigureerd" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expectedBearer = `Bearer ${webhookSecret}`;
  // Fallback: check x-storyblok-webhook-signature header (sommige Storyblok plan-tiers)
  const signatureHeader = request.headers.get("x-storyblok-webhook-signature") ?? "";

  if (authHeader !== expectedBearer && signatureHeader !== webhookSecret) {
    logger.warn("[storyblok-webhook] Ongeldige autorisatie header — afwijzen.");
    return NextResponse.json({ ok: false, error: "Ongeldige autorisatie" }, { status: 401 });
  }

  // ── Body parsen ───────────────────────────────────────────────────────────
  let body: StoryblokWebhookPayload;
  try {
    body = (await request.json()) as StoryblokWebhookPayload;
  } catch {
    logger.warn("[storyblok-webhook] Kon webhook body niet parsen.");
    return NextResponse.json({ ok: false, error: "Ongeldige JSON body" }, { status: 400 });
  }

  const { action, story_id } = body;

  // Alleen published events verwerken
  if (action !== "published") {
    logger.info("[storyblok-webhook] Overgeslagen — niet een published event.", { action });
    return NextResponse.json({ ok: true, synced: 0, skipped: true });
  }

  if (!story_id) {
    logger.warn("[storyblok-webhook] Geen story_id in payload.");
    return NextResponse.json({ ok: false, error: "Ontbrekende story_id" }, { status: 400 });
  }

  logger.info("[storyblok-webhook] Ontvangen", { action, story_id });

  // ── Story ophalen ─────────────────────────────────────────────────────────
  let story: StoryblokStoryEnvelope | null;
  try {
    story = await fetchStoryById(story_id);
  } catch (err) {
    rethrowNextInternal(err);
    logger.error("[storyblok-webhook] Fout bij ophalen story.", {
      story_id, error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "Kon story niet ophalen" }, { status: 500 });
  }

  if (!story) {
    logger.info("[storyblok-webhook] Story niet gevonden of niet gepubliceerd.", { story_id });
    return NextResponse.json({ ok: true, synced: 0 });
  }

  // ── Controleer of dit een adaptive_block story is ─────────────────────────
  const content = story.content;
  if (content.component !== "adaptive_block") {
    logger.info("[storyblok-webhook] Overgeslagen — geen adaptive_block component.", {
      component: content.component, full_slug: story.full_slug,
    });
    return NextResponse.json({ ok: true, synced: 0, skipped: true });
  }

  // ── tenantId ophalen ──────────────────────────────────────────────────────
  // Prioriteit: query param → platform DB instelling → STORYBLOK_TENANT_ID env var.
  const tenantId: string | null =
    request.nextUrl.searchParams.get("tenantId") ??
    dbTenantId ??
    process.env.STORYBLOK_TENANT_ID ??
    null;

  // ── Block mappen en synchroniseren ────────────────────────────────────────
  try {
    const adaptiveContent = content as unknown as StoryblokAdaptiveBlockContent;

    // Valideer verplichte velden
    if (!adaptiveContent.block_key) {
      logger.warn("[storyblok-webhook] adaptive_block mist block_key veld.", {
        full_slug: story.full_slug,
      });
      return NextResponse.json({ ok: false, error: "Ontbrekende block_key in story content" }, { status: 422 });
    }

    const block  = mapStoryblokAdaptiveBlock(String(story.id), adaptiveContent);
    const result = await syncAdaptiveBlocksToDB([block], tenantId);

    if (result.errors.length > 0) {
      logger.warn("[storyblok-webhook] Block kon niet worden gesynchroniseerd.", {
        errors: result.errors, full_slug: story.full_slug,
      });
      return NextResponse.json({
        ok:     false,
        synced: result.synced,
        errors: result.errors,
      });
    }

    logger.info("[storyblok-webhook] Block gesynchroniseerd.", {
      block_key: block.key, full_slug: story.full_slug,
    });

    // Invalideer de Storyblok ISR cache zodat de volgende render direct de nieuwe content leest
    try {
      const { revalidateTag } = await import("next/cache");
      revalidateTag("storyblok", {});
    } catch {
      // revalidateTag is alleen beschikbaar in de App Router context — niet kritisch
    }

    return NextResponse.json({
      ok:     true,
      synced: result.synced,
    });
  } catch (err) {
    rethrowNextInternal(err);
    logger.error("[storyblok-webhook] Onverwachte fout bij synchronisatie.", {
      story_id, error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Onbekende fout" },
      { status: 500 },
    );
  }
}

// ── Storyblok slug helper export ───────────────────────────────────────────────
//
// Verwijderd: `export { adaptiveBlockSlug };`
//
// Een route-bestand mag alleen HTTP-methodes (GET/POST/…) en Next's eigen
// config-exports exporteren — Next controleert dat in .next/types en gaf hier
// TS2344. De re-export was bovendien overbodig: adaptiveBlockSlug woont in
// @/cms/queries/storyblok/adaptive-block-queries en wordt daar al door de
// barrel (cms/queries/storyblok/index.ts) en door storyblok-provider.ts
// geïmporteerd. Niemand haalde hem ooit uit deze route.
//
// De comment zei "voor gebruik in tests of provisioning". Importeer daar
// rechtstreeks uit @/cms/queries/storyblok.
