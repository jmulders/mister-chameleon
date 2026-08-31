/**
 * GET /api/admin/tenants/[tenantId]/bag-probe?postcode=3011AD&huisnummer=1
 *
 * ⚠️ TIJDELIJK DIAGNOSE-ENDPOINT — GEEN PRODUCTIEFEATURE. Verwijderen zodra de
 * BAG-diagnose klaar is. Achter de bestaande admin-auth; lekt de key niet.
 *
 * Isoleert de BAG-fetch los van de decide/warm-pipeline: roept de ECHTE
 * `fetchBagAddress` aan (zelfde endpoint/headers/parser) met een ruime timeout
 * (15s, dus buiten het 2000/4000ms-budget), via een geïnstrumenteerde fetch die
 * de HTTP-status en het aantal `_embedded.adressen` meeleest. Zo zie je in één
 * call of het gaat om:
 *   (a) key/scope        — httpStatus 401/403
 *   (b) lege lookup      — embeddedCount 0
 *   (c) parse-mismatch   — embeddedCount > 0 maar parsed == null
 *   (d) latency          — elapsedMs > het pipeline-budget (2000/4000ms)
 *
 * Retourneert nooit de key zelf, alleen `hasKey` (of BAG_API_KEY gezet is).
 */

import { NextRequest, NextResponse }        from "next/server";
import { cookies }                          from "next/headers";
import { verifySession, ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { fetchBagAddress, resolveBagApiKey } from "@/lib/enrichment/bag-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 15_000; // ruim buiten het decide/warm-budget

// ── Auth guard (zelfde patroon als de andere /api/admin/...-routes) ─────────────

async function requireAdminSession(): Promise<
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string }
> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) return { ok: false, status: 401, message: "Not authenticated." };

  const session = await verifySession(token);
  if (!session)  return { ok: false, status: 401, message: "Invalid or expired session." };

  if (session.twoFaEnabled && !session.twoFaVerified) {
    return { ok: false, status: 403, message: "2FA verification required." };
  }
  return { ok: true };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { tenantId } = await params;
  if (!tenantId) return NextResponse.json({ ok: false, message: "tenantId required" }, { status: 400 });

  const postcode    = (req.nextUrl.searchParams.get("postcode") ?? "").replace(/\s+/g, "").toUpperCase();
  const huisnummer  = (req.nextUrl.searchParams.get("huisnummer") ?? "").trim();
  if (!/^\d{4}[A-Z]{2}$/.test(postcode) || !/^\d{1,5}$/.test(huisnummer)) {
    return NextResponse.json(
      { ok: false, message: "postcode (1234AB) en huisnummer (cijfers) zijn verplicht en moeten geldig zijn." },
      { status: 400 },
    );
  }

  const hasKey = resolveBagApiKey() != null;
  if (!hasKey) {
    return NextResponse.json({
      ok: true, tenantId, postcode, huisnummer,
      hasKey: false, httpStatus: null, embeddedCount: null, parsed: null, elapsedMs: 0,
      _conclusion: "Geen BAG_API_KEY ingesteld in deze omgeving — de enricher no-opt en er wordt niets gefetcht.",
    });
  }

  // Geïnstrumenteerde fetch: mee-lezen zonder het body-stream voor fetchBagAddress
  // te consumeren (response klonen). fetchBagAddress zelf blijft ongewijzigd.
  let httpStatus:    number | null = null;
  let embeddedCount: number | null = null;
  const instrumentedFetch: typeof fetch = async (input, init) => {
    const res = await fetch(input, init);
    httpStatus = res.status;
    try {
      const json = await res.clone().json();
      const adressen = (json as { _embedded?: { adressen?: unknown[] } })?._embedded?.adressen;
      embeddedCount = Array.isArray(adressen) ? adressen.length : 0;
    } catch {
      embeddedCount = null; // non-JSON body (bv. een HTML-foutpagina)
    }
    return res;
  };

  const key = resolveBagApiKey() as string;
  const started = Date.now();
  const result  = await fetchBagAddress(postcode, huisnummer, key, PROBE_TIMEOUT_MS, instrumentedFetch);
  const elapsedMs = Date.now() - started;

  const parsed = result.data
    ? { build_year: result.data.buildYear, building_use: result.data.buildingUse, area_m2: result.data.areaM2 }
    : null;

  // ── Diagnose ────────────────────────────────────────────────────────────────
  let conclusion: string;
  if (httpStatus === 401 || httpStatus === 403) {
    conclusion = `(a) Key/scope-probleem — BAG gaf HTTP ${httpStatus}. Controleer de API-key en of hij toegang heeft tot adressenuitgebreid v2.`;
  } else if (result.status === "error") {
    conclusion = httpStatus == null
      ? `(d) Transient — geen HTTP-status: timeout (>${PROBE_TIMEOUT_MS}ms) of netwerkfout. elapsedMs=${elapsedMs}.`
      : `(a/d) Transient — BAG gaf HTTP ${httpStatus} (5xx). elapsedMs=${elapsedMs}.`;
  } else if (embeddedCount === 0) {
    conclusion = `(b) Lege adres-lookup — HTTP ${httpStatus}, geen _embedded.adressen. Bestaat postcode+huisnummer in BAG?`;
  } else if ((embeddedCount ?? 0) > 0 && parsed == null) {
    conclusion = `(c) Parse-mismatch — ${embeddedCount} adres(sen) terug maar de parser herkende geen velden. Response-shape wijkt af.`;
  } else if (parsed != null) {
    conclusion = elapsedMs > 2000
      ? `✅ Gevonden, MAAR elapsedMs=${elapsedMs} > het 2000/4000ms-budget → (d) de enricher is gezond maar timeout in de pipeline. Verhoog het budget of houd de warm buiten het request.`
      : `✅ Gevonden in ${elapsedMs}ms — binnen budget. De fetch zelf is gezond; kijk dan naar consent/mc_loc/huisnummer op het echte pad.`;
  } else {
    conclusion = `Onbepaald — status=${result.status}, httpStatus=${httpStatus}, embeddedCount=${embeddedCount}.`;
  }

  return NextResponse.json({
    ok: true,
    tenantId, postcode, huisnummer,
    hasKey,
    httpStatus,
    embeddedCount,
    parsed,
    elapsedMs,
    fetchStatus: result.status, // de classificatie van de echte fetchBagAddress
    _conclusion: conclusion,
    _note: "TIJDELIJK diagnose-endpoint — verwijderen na de BAG-diagnose.",
  });
}
