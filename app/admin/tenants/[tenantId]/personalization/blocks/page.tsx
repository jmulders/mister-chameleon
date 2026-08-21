/**
 * Tenant — Adaptive Blocks
 *
 * Per slot: list of all known block keys with their status:
 *   Customized      — this tenant has its own override
 *   Platform default — inheriting from the platform catalog
 *   Not configured  — no block defined at all
 *
 * Hover a row to Edit (customized) or Customize (platform default).
 * Customizing forks a tenant copy of the platform block and opens the edit drawer.
 */

import Link                         from "next/link";
import { ADAPTIVE_SLOT_REGISTRY }   from "@/decision/types";
import { listAdaptiveBlocksAction }  from "@/lib/adaptive-blocks/adaptive-blocks-actions";
import { getAdaptiveBlockByKey }     from "@/lib/adaptive-blocks/adaptive-blocks-store";
import { getTenantById }             from "@/tenant/server";
import { getFormDefinition, isFormKey } from "@/forms";
import { TenantBlocksClient }        from "./_components/TenantBlocksClient";

interface Props {
  params: Promise<{ tenantId: string }>;
}

/**
 * Form types are adaptive slots too (forms-as-adaptive-blocks): each can carry
 * layout / copy / field variants, targeted by a rule via plan.formVariants —
 * exactly like the content slots above. They're surfaced here for a single
 * overview, but their variants and delivery config are edited on the form page
 * (Content › Forms), which also owns fields, email routing, storage, Turnstile.
 */
const FORM_SLOT_KEYS = ["contact", "application", "appointment"] as const;

export default async function TenantBlocksPage({ params }: Props) {
  const { tenantId } = await params;

  // Load both tenant-specific blocks AND platform blocks in one call
  const result = await listAdaptiveBlocksAction(tenantId, /* includePlatform */ true);
  const allBlocks = result.ok ? result.blocks : [];

  // Named block-token sets — passed to the editor drawer's token-set picker.
  const tenant = await getTenantById(tenantId);
  const blockTokenSets = tenant?.design?.blockTokenSets ?? [];

  const totalCustomized = allBlocks.filter((b) => b.tenantId === tenantId).length;

  // Forms overview: each form type + how many variants it has authored.
  const formRows = await Promise.all(
    FORM_SLOT_KEYS.filter(isFormKey).map(async (key) => {
      const def   = getFormDefinition(key);
      const block = await getAdaptiveBlockByKey(`form:${key}`, tenantId);
      return { key, title: def?.title ?? key, variantCount: block?.adaptiveVariants?.length ?? 0 };
    }),
  );

  return (
    <div className="p-8 space-y-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Adaptive blocks</h1>
          <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
            Manage the personalised content for each adaptive slot on this tenant&apos;s site, and set
            per slot how a variant is selected with the <em>Mode</em> control (AI-assisted, rules-only,
            or a fixed key).
            Blocks marked <strong className="font-semibold text-neutral-700">Platform default</strong> inherit
            from the shared catalog. Click <em>Customize</em> to create a tenant-specific version.
            Tenant blocks take full precedence over platform defaults.
          </p>
        </div>
        <Link
          href={`/admin/tenants/${tenantId}/personalization/blocks/generate`}
          className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          ✨ Generate variant
        </Link>
      </div>

      {/* Error */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          Failed to load blocks: {result.error}
        </div>
      )}

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Customized</p>
          <p className="mt-0.5 text-xl font-semibold text-neutral-900">{totalCustomized}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Platform defaults</p>
          <p className="mt-0.5 text-xl font-semibold text-neutral-900">
            {allBlocks.filter((b) => !b.tenantId).length}
          </p>
        </div>
      </div>

      {/* Slot sections */}
      <TenantBlocksClient
        tenantId={tenantId}
        slots={ADAPTIVE_SLOT_REGISTRY.map((s) => ({
          id:          s.id,
          label:       s.label,
          description: s.description,
          keyPrefix:   s.keyPrefix,
          knownKeys:   s.knownKeys,
        }))}
        allBlocks={allBlocks}
        initialSlotModes={tenant?.adaptiveSlots ?? null}
        blockTokenSets={blockTokenSets}
        customAttributes={tenant?.customAttributes ?? []}
      />

      {/* Forms — adaptive slots whose variants + config live on the form page */}
      <section className="space-y-3 border-t border-neutral-200 pt-8">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-neutral-900">Forms</h2>
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 ring-1 ring-neutral-200">
              managed under Content → Forms
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400 max-w-2xl">
            Forms are adaptive too. Each type can have layout, copy, and field variants, targeted by a
            rule just like the slots above. Variants and delivery settings (fields, email, storage) are
            edited on each form&apos;s page.
          </p>
        </div>
        <div className="space-y-2">
          {formRows.map((f) => (
            <Link
              key={f.key}
              href={`/admin/tenants/${tenantId}/content/forms/${f.key}`}
              className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 transition-colors hover:border-neutral-300"
            >
              <code className="shrink-0 text-xs font-mono font-semibold text-neutral-800">form:{f.key}</code>
              <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-400">{f.title}</span>
              {f.variantCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 ring-1 ring-indigo-200">
                  {f.variantCount} variant{f.variantCount === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 ring-1 ring-neutral-200">
                  No variants
                </span>
              )}
              <span className="shrink-0 text-[11px] font-medium text-neutral-400 group-hover:text-neutral-700">
                Manage →
              </span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
