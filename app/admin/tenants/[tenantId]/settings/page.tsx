/**
 * Admin — Tenant Settings
 *
 * Full interactive settings editor for a tenant.  Covers:
 *
 *   • Identity        — display name, slug, primary domain
 *   • Package         — starter / growth / pro tier selection (super-admin only)
 *   • CMS config      — provider, project ID, dataset
 *   • AI config       — live + shadow AI provider, model, API key (write-only)
 *   • Features        — analytics, personalisation, A/B, AI decisions
 *   • Blocks config   — block-level feature flags
 *
 * ─── Package field access control ────────────────────────────────────────────
 *
 *   The Package selector directly writes packageKey to TenantSettings, which
 *   bypasses billing entirely.  It must only be editable by super-admins.
 *   Tenant-admin users see a read-only plan indicator with a link to the
 *   Billing page where they can manage their Stripe subscription.
 *
 * ─── Secret handling ─────────────────────────────────────────────────────────
 *
 *   API key values are stripped before crossing the server→client boundary.
 *   Boolean presence flags (hasLiveKey, hasShadowKey, hasCmsWriteToken) are
 *   passed instead so the form can show "key configured" hints without ever
 *   seeing the raw value.
 */

import { notFound }      from "next/navigation";
import { getTenantById } from "@/tenant/server";
import {
  getRequiredAdminSession,
  isSuperAdmin,
} from "@/lib/admin-auth/authorization";
import { TenantSettingsForm }  from "../TenantSettingsForm";
import { DeleteTenantPanel }   from "../_components/DeleteTenantPanel";
import { RetentionPolicyPanel } from "../_components/RetentionPolicyPanel";
import { getRetentionPolicyAction, setRetentionPolicyAction } from "./retention-actions";
import { SelfServiceToggle } from "../_components/SelfServiceToggle";
import { getSelfServiceEnabledAction, setSelfServiceEnabledAction } from "./self-service-actions";
import type { TenantSettings } from "@/tenant/server";
import { getEffectivePlan }    from "@/billing/plan-enforcement";

// ── Secret-field security ─────────────────────────────────────────────────────

interface ExistingKeys {
  hasLiveKey:       boolean;
  hasShadowKey:     boolean;
  hasCmsWriteToken: boolean;
}

function recordExistingKeys(tenant: TenantSettings): ExistingKeys {
  return {
    hasLiveKey:       Boolean(tenant.ai?.liveProvider?.apiKey),
    hasShadowKey:     Boolean(tenant.ai?.shadowProvider?.apiKey),
    hasCmsWriteToken: Boolean(tenant.cms?.writeToken),
  };
}

function stripSecrets(tenant: TenantSettings): TenantSettings {
  return {
    ...tenant,
    ai: {
      ...tenant.ai,
      liveProvider: tenant.ai?.liveProvider
        ? { ...tenant.ai.liveProvider, apiKey: undefined }
        : undefined,
      shadowProvider: tenant.ai?.shadowProvider
        ? { ...tenant.ai.shadowProvider, apiKey: undefined }
        : undefined,
    },
    cms: {
      ...tenant.cms,
      writeToken: undefined,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  // Resolve super-admin status so the form can gate the Package selector.
  // getRequiredAdminSession() is safe to call here — the parent layout already
  // verified the session exists and has access to this tenant.
  const session       = await getRequiredAdminSession();
  const adminIsSuper  = isSuperAdmin(session);

  const [tenant, effectivePlan, retentionPolicy, selfServiceEnabled] = await Promise.all([
    getTenantById(tenantId),
    getEffectivePlan(tenantId),
    getRetentionPolicyAction(tenantId),
    getSelfServiceEnabledAction(tenantId),
  ]);
  if (!tenant) notFound();

  const boundSetRetention   = setRetentionPolicyAction.bind(null, tenantId);
  const boundSetSelfService = setSelfServiceEnabledAction.bind(null, tenantId);

  const existingKeys = recordExistingKeys(tenant);
  const safeTenant   = stripSecrets(tenant);

  return (
    <div className="p-8 max-w-3xl">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Configure this tenant&apos;s identity, CMS connection, AI providers,
          feature flags, and the <strong>plan-gated block entitlements</strong>
          {" "}(which block types this package allows, distinct from the
          Adaptive blocks catalogue under Personalization).
        </p>
      </div>

      <TenantSettingsForm
        tenant={safeTenant}
        existingKeys={existingKeys}
        isSuperAdmin={adminIsSuper}
        planFeatures={{
          aiDecisioning: effectivePlan.features.aiPersonalization,
          abExperiments: true,
        }}
      />

      {/* Self-service mode */}
      <div className="mt-8">
        <SelfServiceToggle
          initialEnabled={selfServiceEnabled}
          setEnabledAction={boundSetSelfService}
        />
      </div>

      {/* Data retention after termination */}
      <div className="mt-8">
        <RetentionPolicyPanel
          initialPolicy={retentionPolicy}
          setAction={boundSetRetention}
        />
      </div>

      {/* Danger zone — super-admin only */}
      {adminIsSuper && (
        <DeleteTenantPanel
          tenantId={tenant.tenantId}
          tenantName={tenant.name ?? ""}
        />
      )}

    </div>
  );
}
