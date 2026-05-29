/**
 * GET /api/segments
 *
 * Returns all active audience segments for the current tenant.
 * Consumed by the ScenarioControlPanel to populate the segment
 * multi-select dropdown so testers can override audienceSegmentIds
 * without needing real visitor signals.
 *
 * Response:
 *   { segments: { key: string; label: string }[] }
 *
 * Never throws — returns an empty segments array on any error.
 */

import { NextRequest, NextResponse } from "next/server";
import { getActiveTenant }           from "@/tenant/server";
import { listActiveAudienceSegments } from "@/audience-segments/repository";

export async function GET(_request: NextRequest) {
  try {
    const { tenantId } = await getActiveTenant();
    const result = await listActiveAudienceSegments(tenantId);

    if (!result.ok) {
      return NextResponse.json({ segments: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const segments = result.data.map((s) => ({ key: s.key, label: s.label }));
    return NextResponse.json({ segments }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ segments: [] }, { status: 200 });
  }
}
