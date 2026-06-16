/**
 * POST /api/webhooks/cms/statamic
 *
 * Statamic webhook handler voor adaptive block synchronisatie.
 *
 * ─── Architecture positie ─────────────────────────────────────────────────────
 *
 *   Statamic (entry published/saved)
 *        ↓  POST webhook met x-statamic-secret header
 *   deze route               ← YOU ARE HERE
 *        ↓  mapStatamicAdaptiveBlock() → AdaptiveBlockData[]
 *   syncAdaptiveBlocksToDB() → adaptive_blocks Supabase tabel
 *
 * ─── Wat dit verwerkt ─────────────────────────────────────────────────────────
 *
 *   Statamic stuurt een webhook bij elke entry save of publish.
 *   Deze route:
 *     1. Verifieert de x-statamic-secret header
 *     2. Parseert het body als { event, collection, entries[] }
 *     3. Verwerkt alleen wanneer collection === "adaptive_blocks"
 *     4. Mapt elke entry via mapStatamicAdaptiveBlock
 *     5. Haalt tenantId op uit query param ?tenantId= of payload.tenant_id
 *     6. Roept syncAdaptiveBlocksToDB aan
 *     7. Retourneert { ok: true, synced: N } of { ok: false, error: "..." }
 *
 * ─── Configuratie ──────────────────────────────────────────────────────────────
 *
 *   Vereiste omgevingsvariabelen:
 *     STATAMIC_WEBHOOK_SECRET  — gedeeld geheim geconfigureerd in de Statamic webhook instellingen
 *
 *   De Statamic webhook moet geconfigureerd worden op:
 *     URL:     https://<host>/api/webhooks/cms/statamic
 *     Method:  POST
 *     Events:  EntrySaved, EntryPublished
 *     Header:  x-statamic-secret: <STATAMIC_WEBHOOK_SECRET>
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Verzoeken zonder geldige x-statamic-secret header worden afgewezen met 401.
 */

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag }             from "next/cache";
import { STATAMIC_CACHE_TAG }        from "@/cms/providers/statamic-client";
import { logger }                    from "@/lib/logger";
import { rethrowNextInternal }       from "@/lib/server-action-guard";
import { mapStatamicAdaptiveBlock }  from "@/cms/mappers/statamic";
import { syncAdaptiveBlocksToDB }    from "@/lib/adaptive-blocks/adaptive-blocks-sync";
import { ADAPTIVE_BLOCKS_COLLECTION } from "@/cms/queries/statamic/adaptive-block-queries";
import type { StatamicAdaptiveBlockEntry } from "@/cms/queries/statamic/adaptive-block-queries";
import { getPlatformStatamicSettings } from "@/platform/platform-store";

// ── Webhook body shape van Statamic ───────────────────────────────────────────

interface StatamicWebhookBody {
  /** Het type webhook event, bijv. "EntrySaved", "EntryPublished" */
  event: string;
  /** De collection handle die de entry bevat */
  collection: string;
  /** De getriggerde entries */
  entries: StatamicAdaptiveBlockEntry[];
  /** Optionele tenant-scope in het payload */
  tenant_id?: string | null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Secret verificatie ─────────────────────────────────────────────────────
  // Prioriteit: platform DB instelling → STATAMIC_WEBHOOK_SECRET env var.
  let webhookSecret: string | undefined;
  try {
    const stored = await getPlatformStatamicSettings();
    if (stored.ok) {
      webhookSecret = stored.data.webhookSecret?.trim() || undefined;
    }
  } catch {
    // Non-fatal — valt terug op env var.
  }
  if (!webhookSecret) {
    webhookSecret = process.env.STATAMIC_WEBHOOK_SECRET?.trim() || undefined;
  }

  if (!webhookSecret) {
    logger.warn("[statamic-webhook] Webhook secret niet geconfigureerd — afwijzen.");
    return NextResponse.json({ ok: false, error: "Webhook niet geconfigureerd" }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-statamic-secret") ?? "";
  if (providedSecret !== webhookSecret) {
    logger.warn("[statamic-webhook] Ongeldige x-statamic-secret header — afwijzen.");
    return NextResponse.json({ ok: false, error: "Ongeldige handtekening" }, { status: 401 });
  }

  // ── Body parsen ───────────────────────────────────────────────────────────
  let body: StatamicWebhookBody;
  try {
    body = (await request.json()) as StatamicWebhookBody;
  } catch {
    logger.warn("[statamic-webhook] Kon webhook body niet parsen.");
    return NextResponse.json({ ok: false, error: "Ongeldige JSON body" }, { status: 400 });
  }

  const { event, collection, entries, tenant_id } = body;

  // ── Paginacache invalideren ───────────────────────────────────────────────
  // Elke entry-save/publish (welke collection dan ook) maakt de Statamic-content
  // in de Next.js fetch-cache stale, zodat een wijziging direct zichtbaar is i.p.v.
  // pas na de TTL. Dit maakt het veilig om STATAMIC_REVALIDATE_SECONDS te verhogen
  // voor minder Ploi-round-trips zonder verlies van versheid.
  try {
    revalidateTag(STATAMIC_CACHE_TAG);
  } catch {
    // Non-fatal — revalidation mag de webhook-afhandeling nooit breken.
  }

  // Alleen adaptive_blocks collection verwerken
  if (collection !== ADAPTIVE_BLOCKS_COLLECTION) {
    logger.info("[statamic-webhook] Overgeslagen — niet de adaptive_blocks collection.", {
      collection, event,
    });
    return NextResponse.json({ ok: true, synced: 0, skipped: true });
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    logger.info("[statamic-webhook] Geen entries in payload.", { collection, event });
    return NextResponse.json({ ok: true, synced: 0 });
  }

  // ── tenantId ophalen ──────────────────────────────────────────────────────
  const tenantId: string | null =
    request.nextUrl.searchParams.get("tenantId") ??
    tenant_id ??
    null;

  logger.info("[statamic-webhook] Ontvangen", {
    event, collection, entryCount: entries.length, tenantId,
  });

  // ── Entries mappen en synchroniseren ──────────────────────────────────────
  try {
    const blocks = entries.map(mapStatamicAdaptiveBlock);
    const result = await syncAdaptiveBlocksToDB(blocks, tenantId);

    if (result.errors.length > 0) {
      logger.warn("[statamic-webhook] Sommige blocks konden niet worden gesynchroniseerd.", {
        errors: result.errors,
      });
    }

    logger.info("[statamic-webhook] Synchronisatie voltooid.", {
      synced: result.synced, errors: result.errors.length,
    });

    return NextResponse.json({
      ok:     result.errors.length === 0,
      synced: result.synced,
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    });
  } catch (err) {
    rethrowNextInternal(err);
    logger.error("[statamic-webhook] Onverwachte fout bij synchronisatie.", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Onbekende fout" },
      { status: 500 },
    );
  }
}
