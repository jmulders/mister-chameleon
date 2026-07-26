"use server";

/**
 * Platform advertiser rate-card — read/write actions.
 *
 * The rate-card sets the default CPM / CPC that advertiser tenants are offered
 * when creating an ad. Advertisers can still override per ad; this is the
 * platform-wide default. Writing is restricted to platform super-admins.
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession, isSuperAdmin } from "@/lib/admin-auth/authorization";
import {
  getPlatformAdPricingSettings,
  savePlatformAdPricingSettings,
  AD_PRICING_DEFAULTS,
} from "@/platform/platform-store";

export type AdPricing = { cpmCents: number; cpcCents: number; revsharePct: number; updatedAt: string | null };

export async function getAdPricingAction(): Promise<{ ok: true; data: AdPricing } | { ok: false; error: string }> {
  const res = await getPlatformAdPricingSettings();
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    data: {
      cpmCents:    res.data.cpmCents    ?? AD_PRICING_DEFAULTS.cpmCents,
      cpcCents:    res.data.cpcCents    ?? AD_PRICING_DEFAULTS.cpcCents,
      revsharePct: res.data.revsharePct ?? AD_PRICING_DEFAULTS.revsharePct,
      updatedAt:   res.updatedAt,
    },
  };
}

export async function saveAdPricingAction(
  input: { cpmCents: number; cpcCents: number; revsharePct: number },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  if (!isSuperAdmin(session)) return { ok: false, error: "Only platform admins can change ad pricing." };

  const cpmCents = Math.round(Number(input.cpmCents));
  const cpcCents = Math.round(Number(input.cpcCents));
  const revsharePct = Number(input.revsharePct);
  if (!Number.isFinite(cpmCents) || cpmCents < 0) return { ok: false, error: "CPM must be a non-negative number of cents." };
  if (!Number.isFinite(cpcCents) || cpcCents < 0) return { ok: false, error: "CPC must be a non-negative number of cents." };
  if (!Number.isFinite(revsharePct) || revsharePct < 0 || revsharePct > 100) return { ok: false, error: "Revshare must be between 0 and 100 percent." };

  const res = await savePlatformAdPricingSettings({ cpmCents, cpcCents, revsharePct });
  if (!res.ok) return res;
  revalidatePath("/admin/platform/ad-pricing");
  return { ok: true };
}
