/**
 * POST /api/v1/slot
 *
 * Per-visitor slot resolution for the Mister Chameleon CMS adapters (e.g. the
 * Statamic addon's {{ mc:slot }} tag). Given one slot type and the visitor's
 * signals, runs the same decision pipeline as the live site and returns the
 * resolved variant for THAT slot as a clean content object.
 *
 * ─── Auth ────────────────────────────────────────────────────────────────────
 *   Authorization: Bearer <tenant_key>     (the public siteKey)
 *
 * ─── Request ─────────────────────────────────────────────────────────────────
 *   {
 *     "slot_type": "hero",
 *     "default_variant_key": "hero_default",
 *     "page":    { "collection": "pages", "slug": "pricing", "locale": "nl" },
 *     "visitor": {
 *       "fingerprint": "…", "referrer": "…", "utm": { "source": "google" },
 *       "device": "mobile", "is_bot": false, "tokens": {}
 *     }
 *   }
 *
 * ─── Response (200) ──────────────────────────────────────────────────────────
 *   {
 *     "variant_key": "hero_intent_direct",
 *     "is_default":  false,
 *     "content":     { "heading": "…", "body": "…", "cta_label": "…", "cta_url": "…" },
 *     "experiment":  null
 *   }
 *
 *   On any failure the endpoint returns the CMS-authored default variant — the
 *   adapter must always be able to render. 401 missing key · 403 unknown key.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantBySiteKey } from "@/tenant/server";
import { createCMSProvider } from "@/cms";
import { resolveSession } from "@/data/session";
import { fetchVisitorHistory } from "@/context/fetch-visitor-history";
import { emptyHistory } from "@/context/visitor-history";
import { RulesDecisionProvider, ExperimentDecisionProvider } from "@/decision";
import { loadTenantRulesConfig } from "@/decision/rules/load-tenant-rules";
import { buildDecisionContext } from "@/decision/context/build-decision-context";
import { isSupportedLocale, DEFAULT_LOCALE } from "@/lib/locale";
import type { TenantSettings } from "@/tenant/types";
import type {
  HeroBlockData, CTABlockData, ProofBlockData,
  FeatureBlockData, ConversionBlockData, NotificationBlockData,
} from "@/cms/types";
import { logger } from "@/lib/logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type SlotType = "hero" | "proof" | "cta" | "feature" | "conversion" | "notification";

interface SlotRequest {
  slot_type?: string;
  default_variant_key?: string;
  page?: { collection?: string; slug?: string; locale?: string };
  visitor?: {
    fingerprint?: string;
    referrer?: string;
    utm?: Record<string, string>;
    device?: string;
    is_bot?: boolean;
    tokens?: Record<string, unknown>;
  };
}

/** slot_type → the plan field that carries its resolved key. */
const PLAN_KEY: Record<SlotType, "heroKey" | "proofKey" | "ctaKey" | "featureKey" | "conversionKey" | "notificationKey"> = {
  hero: "heroKey", proof: "proofKey", cta: "ctaKey",
  feature: "featureKey", conversion: "conversionKey", notification: "notificationKey",
};

type Content = Record<string, string>;

/** Best-effort URL out of a loosely-typed media object. */
function mediaUrl(media: unknown): string {
  const m = media as { url?: string; src?: string; asset?: { url?: string } } | null | undefined;
  return m?.url ?? m?.src ?? m?.asset?.url ?? "";
}

/** Map a resolved variant block to the canonical slot content handles. */
function toContent(slot: SlotType, data: unknown): Content {
  const c: Content = {};
  if (!data) return c;

  if (slot === "hero") {
    const h = data as HeroBlockData;
    if (h.tag) c.tag = h.tag;
    if (h.title) c.heading = h.title;
    if (h.subtitle) c.body = h.subtitle;
    if (h.ctas?.[0]?.label) c.cta_label = h.ctas[0].label;
    if (h.ctas?.[0]?.href) c.cta_url = h.ctas[0].href;
    const mu = mediaUrl(h.media);
    if (mu) c.media = mu;
  } else if (slot === "proof") {
    const p = data as ProofBlockData;
    if (p.title) c.heading = p.title;
    const first = p.items?.[0];
    if (first?.text) c.body = first.text;
  } else if (slot === "cta") {
    const t = data as CTABlockData;
    if (t.title) c.heading = t.title;
    if (t.text) c.body = t.text;
    if (t.cta?.label) c.cta_label = t.cta.label;
    if (t.cta?.href) c.cta_url = t.cta.href;
  } else if (slot === "feature") {
    const f = data as FeatureBlockData;
    if (f.title) c.heading = f.title;
    if (f.subtitle) c.body = f.subtitle;
  } else if (slot === "conversion") {
    const v = data as ConversionBlockData;
    if (v.title) c.heading = v.title;
    if (v.text) c.body = v.text;
    if (v.ctas?.[0]?.label) c.cta_label = v.ctas[0].label;
    if (v.ctas?.[0]?.href) c.cta_url = v.ctas[0].href;
  } else if (slot === "notification") {
    const n = data as NotificationBlockData;
    if (n.message) c.message = n.message;
    if (n.severity) c.severity = n.severity;
    if (n.ctaLabel) c.cta_label = n.ctaLabel;
    if (n.ctaHref) c.cta_url = n.ctaHref;
  }
  return c;
}

/** Fetch a single slot's variant content by key. */
async function fetchVariant(cms: ReturnType<typeof createCMSProvider>, slot: SlotType, key: string): Promise<unknown> {
  switch (slot) {
    case "hero": return cms.getHeroVariant(key).catch(() => null);
    case "proof": return cms.getProofVariant(key).catch(() => null);
    case "cta": return cms.getCTAVariant(key).catch(() => null);
    case "feature": return cms.getFeatureVariant(key).catch(() => null);
    case "conversion": return cms.getConversionVariant(key).catch(() => null);
    case "notification": return cms.getNotificationVariant(key).catch(() => null);
  }
}

export async function POST(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const siteKey = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!siteKey) {
    return NextResponse.json(
      { error: "Missing tenant key. Send Authorization: Bearer <key>." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  // ── Parse ────────────────────────────────────────────────────────────────────
  let body: SlotRequest;
  try {
    body = (await request.json()) as SlotRequest;
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400, headers: CORS_HEADERS });
  }

  const slotType = body.slot_type as SlotType;
  if (!slotType || !(slotType in PLAN_KEY)) {
    return NextResponse.json({ error: "Unknown or missing slot_type." }, { status: 400, headers: CORS_HEADERS });
  }
  const defaultKey = body.default_variant_key || `${slotType}_default`;
  const page = body.page ?? {};
  const visitor = body.visitor ?? {};

  // ── Tenant ────────────────────────────────────────────────────────────────────
  let tenant: TenantSettings | null = null;
  try {
    tenant = await getTenantBySiteKey(siteKey);
  } catch (err) {
    logger.error("[v1/slot] tenant lookup failed", { error: String(err) });
    return NextResponse.json({ error: "Internal error." }, { status: 500, headers: CORS_HEADERS });
  }
  if (!tenant) {
    return NextResponse.json({ error: "Unknown tenant key." }, { status: 403, headers: CORS_HEADERS });
  }

  const tenantId = tenant.tenantId;
  const locale = isSupportedLocale(page.locale ?? "") ? (page.locale as string) : DEFAULT_LOCALE;
  const cms = createCMSProvider(tenant.cms, tenantId, locale);

  // Helper: build the default-variant response (used for bots and on failure).
  const respondDefault = async () => {
    const data = await fetchVariant(cms, slotType, defaultKey);
    return NextResponse.json(
      { variant_key: defaultKey, is_default: true, content: toContent(slotType, data), experiment: null },
      { status: 200, headers: CORS_HEADERS },
    );
  };

  // Bots always get the stable default so crawlers index consistent content.
  if (visitor.is_bot === true) {
    return respondDefault();
  }

  // ── Resolve via the decision pipeline ─────────────────────────────────────────
  try {
    const path = page.slug ? `/${page.slug}` : "/";
    const url = new URL(`https://${tenant.primaryDomain ?? "site"}${path}`);
    for (const [k, v] of Object.entries(visitor.utm ?? {})) {
      if (v) url.searchParams.set(`utm_${k}`, v);
    }
    const decisionRequest = new Request(url.toString(), {
      headers: {
        referer: visitor.referrer ?? "",
        "user-agent": request.headers.get("user-agent") ?? "",
      },
    });

    const { sessionId } = resolveSession(visitor.fingerprint ? `mc_sid=${visitor.fingerprint}` : null);

    const [history, rulesConfig] = await Promise.all([
      fetchVisitorHistory(sessionId, tenantId).catch(() => emptyHistory()),
      loadTenantRulesConfig(tenantId).catch(() => null),
    ]);

    const input = await buildDecisionContext({
      request: decisionRequest,
      history,
      tenantId,
      templateKey: path,
      pageType: "cms_page",
      sessionId,
      timezone: tenant.timezone ?? null,
    });

    const decisionProvider = new ExperimentDecisionProvider(
      new RulesDecisionProvider(rulesConfig ?? undefined),
      sessionId,
      tenant.experiments?.enabled ?? true,
      tenantId,
    );

    const plan = await decisionProvider.getHomepagePlan(input);
    const planRecord = plan as unknown as Record<string, string | undefined>;
    const resolvedKey = planRecord[PLAN_KEY[slotType]] || defaultKey;

    const data = await fetchVariant(cms, slotType, resolvedKey);
    // Empty resolution → fall back to default so the adapter still renders.
    if (!data && resolvedKey !== defaultKey) {
      return respondDefault();
    }

    return NextResponse.json(
      {
        variant_key: resolvedKey,
        is_default: resolvedKey === defaultKey,
        content: toContent(slotType, data),
        experiment: null,
      },
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (err) {
    logger.warn("[v1/slot] resolve failed — serving default", {
      tenantId, slotType, error: err instanceof Error ? err.message : String(err),
    });
    return respondDefault();
  }
}
