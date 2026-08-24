/**
 * TemplateRenderer
 *
 * Generic slot-based page renderer. Accepts a PageConfig (structural) and an
 * optional ContextSlotData bundle (pre-fetched content), then renders the page by:
 *
 *   1. "before-content" context slots in template order
 *   2. Content blocks in their PageConfig array order (reorderable)
 *   3. "after-content" context slots in template order
 *
 * ─── Architecture role ────────────────────────────────────────────────────────
 *
 *   PageConfig + ContextSlotData?
 *        ↓  TemplateRenderer    ← YOU ARE HERE
 *   rendered JSX
 *     ├── context slots → HeroBlock / ProofBlock / CTABlock
 *     └── content blocks → ContentBlockRenderer → section components
 *
 * ─── Two rendering paths ─────────────────────────────────────────────────────
 *
 *   1. Engine path (homepage)
 *      Caller provides `contextData` pre-fetched by buildHomepagePageConfig().
 *      TemplateRenderer uses it directly — no extra CMS calls.
 *
 *   2. No-engine path (CMS pages)
 *      Caller provides only `pageConfig` (assembled via mapPageDataToPageConfig).
 *      Context slot variantKeys come from CmsPageContextConfig fallback keys.
 *      TemplateRenderer fetches slot content from the CMS itself, in parallel,
 *      using each active slot's variantKey.
 *
 * ─── Slot rendering ───────────────────────────────────────────────────────────
 *
 *   Context slots with variantKey === null are skipped.  This handles both
 *   "tenant entitlements exclude this block" and "decision engine returned no
 *   variant" cases transparently — no conditional logic at call sites.
 *
 * ─── Template vs content ──────────────────────────────────────────────────────
 *
 *   The TemplateRenderer does NOT look up the TemplateDefinition at runtime.
 *   The pageConfig.contextSlots array is already the resolved, ordered list of
 *   slots — it carries the `position` field set by the assembler.
 *   This keeps the renderer self-contained and template-agnostic.
 *
 * ─── Architecture contract ────────────────────────────────────────────────────
 *
 *   - This component controls NOTHING about what content is shown.
 *     It only controls which blocks render and in what order.
 *   - No layout-specific template branching. Order is driven by:
 *       a) the template slot order (before/after-content positions)
 *       b) the CMS contentBlocks array order (reorderable by editors)
 *   - Styling is entirely delegated to HeroBlock, ProofBlock, CTABlock,
 *     and ContentBlockRenderer. No styling tokens are used here.
 */

import { cookies } from "next/headers";
import type { PageConfig, ContextSlotData, ContextSlotId, ResolvedContextSlot, PageItem } from "@/page-config";
import type { CMSProvider } from "@/cms";
import { createCMSProvider } from "@/cms";
import { HeroBlock }          from "@/components/blocks/HeroBlock";
import { ProofBlock }         from "@/components/blocks/ProofBlock";
import { CTABlock }           from "@/components/blocks/CTABlock";
import { ConversionBlock }    from "@/components/blocks/ConversionBlock";
import { NotificationBlock }  from "@/components/blocks/NotificationBlock";
import { FeatureGridBlock }   from "@/components/blocks/sections/FeatureGridBlock";
import { mapHeroBlockData } from "@/cms/mappers/content-mappers";
import { ContentBlockRenderer } from "./ContentBlockRenderer";
import { listDesignEffectSets } from "@/lib/design-effect-sets/effect-sets-store";
import type { EffectSet, BlockEffectConfig } from "@/design-system/effects/effect-ref";
import { getContextualGalleryDefaultTokens } from "@/lib/theme/contextual-block-tokens";
import { liftDarkCardTokens } from "@/design-system/theme/preset-to-block-tokens";
import { BlockThemeScope } from "./BlockThemeScope";
import { BlockEffectScope } from "./BlockEffectScope";
import type { BlockTokenSet, BlockTokenRef, CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import { getActiveTenant, getTenantById } from "@/tenant/server";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import {
  resolveAdaptiveVariant,
  adaptiveVariantToHeroBlockData,
} from "@/lib/tokens/resolve-adaptive-variant";
import { parseTokens, type TokenContext } from "@/lib/tokens/parse-tokens";

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK-TOKEN HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a BlockTokenRef from a resolved adaptive-variant's token fields.
 * Returns undefined when the variant carries no block-level tokens.
 */
function tokenRefFromVariant(
  content: { tokenSet?: string; tokens?: CuratedBlockTokens } | null | undefined,
): BlockTokenRef | undefined {
  if (!content) return undefined;
  const hasTokens = content.tokens && Object.keys(content.tokens).length > 0;
  if (!content.tokenSet && !hasTokens) return undefined;
  return {
    ...(content.tokenSet ? { tokenSet: content.tokenSet } : {}),
    ...(hasTokens ? { tokens: content.tokens } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT SLOT RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface ContextSlotRendererProps {
  slotId:         ContextSlotId;
  contextData:    ContextSlotData;
  layoutVariant?: string;
  tokenContext?:  TokenContext;
  /** Tenant's named block-token sets — used to resolve a slot's content tokenRef. */
  blockTokenSets?: readonly BlockTokenSet[] | null;
  /** Tenant's named effect sets — used to resolve a slot's content effectRef. */
  effectSets?:     readonly EffectSet[] | null;
  /** Per-block-type default effects (design.blockTypeEffects), keyed by slot type. */
  blockTypeEffects?: Partial<Record<string, readonly BlockEffectConfig[]>> | null;
  /** Tenant-wide default effects — the fallback tier when a slot has no effectRef. */
  defaultEffects?: readonly BlockEffectConfig[] | null;
}

/**
 * Renders a single context slot using the appropriate platform block component.
 *
 * Switches on slotId — exhaustive over the three defined context block types
 * (hero, proof, cta).  Returns null when the slot's data is absent (slot
 * disabled or CMS returned no content for the variant key).
 *
 * `layoutVariant` is the structural layout to use for the block, sourced from
 * ResolvedContextSlot.layoutVariant.  When absent the block falls back to its
 * family default (hero_default, proof_stats, cta_banner).
 *
 * ─── Why the conditional spread ────────────────────────────────────────────────
 *
 *   Each block's data type (HeroBlockData, ProofBlockData, CTABlockData) already
 *   carries a `layoutVariant` field from the CMS document.  mapHeroBlockData()
 *   and friends pass it through in their spread.
 *
 *   If we always pass `layoutVariant={layoutVariant}` as an explicit prop AFTER
 *   the spread, JSX compiles it to:
 *     Object.assign({}, mapHeroBlockData(data), { layoutVariant: undefined })
 *   When slot.layoutVariant is absent (undefined), this OVERWRITES the CMS value
 *   with undefined — causing resolveContextBlockVariant() to always return the
 *   family default (hero_default), ignoring the CMS-authored selection entirely.
 *
 *   Fix: only pass the slot's layoutVariant when it is explicitly non-undefined.
 *   When absent, the CMS document value already present in the spread takes effect.
 */
function ContextSlotRenderer(props: ContextSlotRendererProps) {
  const inner = renderContextSlotInner(props);
  if (!inner) return null;
  // A resolved adaptive variant can carry its own block-level token ref
  // (content.tokenRef). Wrap the slot output in a scope so its tokens restyle
  // just this block. When absent, BlockThemeScope passes children through.
  const { slotId, contextData } = props;
  const entry =
    slotId === "hero"    ? contextData.hero
    : slotId === "proof" ? contextData.proof
    : slotId === "cta"   ? contextData.cta
    : slotId === "feature" ? contextData.feature
    : undefined;
  // The effect scope sits INSIDE the token scope so the animated wrapper inherits
  // the block's scoped CSS variables (mirrors ContentBlockRenderer). When the slot
  // has no effectRef, resolveBlockEffects falls back to the tenant default; when
  // nothing resolves, BlockEffectScope passes children through untouched.
  return (
    <BlockThemeScope tokenRef={entry?.tokenRef} sets={props.blockTokenSets} scopeId={slotId}>
      <BlockEffectScope
        effectRef={entry?.effectRef}
        sets={props.effectSets}
        blockTypeDefault={props.blockTypeEffects?.[slotId]}
        tenantDefault={props.defaultEffects}
        scopeId={slotId}
      >
        {inner}
      </BlockEffectScope>
    </BlockThemeScope>
  );
}

function renderContextSlotInner({ slotId, contextData, layoutVariant, tokenContext }: ContextSlotRendererProps) {
  // Only override layoutVariant when the slot explicitly specifies one.
  // Passing `undefined` after a spread in JSX writes undefined into the prop
  // object and silently discards whatever the spread provided.
  const layoutOverride = layoutVariant !== undefined ? { layoutVariant } : {};

  // Token replacement helper — no-op when tokenContext is absent (non-homepage pages).
  const t = tokenContext
    ? (s: string | undefined) => (s ? parseTokens(s, tokenContext) : s)
    : (s: string | undefined) => s;

  switch (slotId) {
    case "hero":
      if (!contextData.hero) return null;
      return (
        <HeroBlock
          {...mapHeroBlockData(contextData.hero)}
          title={t(contextData.hero.title) ?? contextData.hero.title}
          subtitle={t(contextData.hero.subtitle) ?? contextData.hero.subtitle}
          tag={t(contextData.hero.tag)}
          ctaKey={contextData.hero.ctaKey}
          {...layoutOverride}
        />
      );

    case "proof":
      if (!contextData.proof) return null;
      return (
        <ProofBlock
          title={t(contextData.proof.title) ?? contextData.proof.title}
          items={contextData.proof.items}
          layoutVariant={contextData.proof.layoutVariant}
          {...layoutOverride}
        />
      );

    case "cta":
      if (!contextData.cta) return null;
      return (
        <CTABlock
          title={t(contextData.cta.title) ?? contextData.cta.title}
          text={t(contextData.cta.text) ?? contextData.cta.text}
          cta={contextData.cta.cta}
          ctas={contextData.cta.ctas}
          media={contextData.cta.media}
          mediaSide={contextData.cta.mediaSide}
          formKey={contextData.cta.formKey}
          ctaKey={contextData.cta.ctaKey}
          layoutVariant={contextData.cta.layoutVariant}
          {...layoutOverride}
        />
      );

    case "feature": {
      if (!contextData.feature) return null;
      // Adapt FeatureBlockData (CMS shape: title/body/icon) →
      //       FeatureGridBlockData (component shape: heading/features[]/description)
      const featureData = {
        heading:  contextData.feature.title,
        features: contextData.feature.items.map((item) => ({
          title:       item.title,
          description: item.body,
          icon:        item.icon,
          // Spotlight fields — passed through so feature_spotlight can render them.
          media:       item.media,
          price:       item.price,
          ctaLabel:    item.ctaLabel,
          ctaHref:     item.ctaHref,
          mediaSide:   item.mediaSide,
        })),
      };
      return (
        <FeatureGridBlock
          data={featureData}
          variant={contextData.feature.layoutVariant ?? "feature_grid_3up"}
          {...layoutOverride}
        />
      );
    }

    case "conversion":
      if (!contextData.conversion) return null;
      return <ConversionBlock data={contextData.conversion} />;

    case "notification":
      // Notification is an overlay — rendered outside the before/after slot
      // groups by the TemplateRenderer directly.  Skip here to avoid duplicate.
      return null;

    default:
      // Unknown slot type — forward-compatible; skip silently.
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE-SLOT PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render ONE context slot with the real production block component, for admin
 * previews. Reuses ContextSlotRenderer (and its BlockThemeScope wrapper), so
 * layout variants, media, carousels, and per-block token overrides all match
 * the live site exactly. `contextData` should contain just the slot being
 * previewed (build it via adaptiveVariantToContextEntry).
 */
export function AdaptiveSlotPreview({
  slotId,
  contextData,
  blockTokenSets,
  effectSets,
  blockTypeEffects,
  defaultEffects,
}: {
  slotId:          ContextSlotId;
  contextData:     ContextSlotData;
  blockTokenSets?: readonly BlockTokenSet[] | null;
  effectSets?:     readonly EffectSet[] | null;
  blockTypeEffects?: Partial<Record<string, readonly BlockEffectConfig[]>> | null;
  defaultEffects?: readonly BlockEffectConfig[] | null;
}) {
  return (
    <ContextSlotRenderer
      slotId={slotId}
      contextData={contextData}
      blockTokenSets={blockTokenSets}
      effectSets={effectSets}
      blockTypeEffects={blockTypeEffects}
      defaultEffects={defaultEffects}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface TemplateRendererProps {
  /**
   * The structural page config — template key, resolved context slots, and
   * the ordered content blocks array.
   */
  pageConfig:   PageConfig;
  /**
   * Pre-fetched CMS content for the active context slots.
   *
   * ─── Engine path (homepage) ───────────────────────────────────────────────
   *
   *   Provide this when the decision engine has already fetched slot content —
   *   typically via buildHomepagePageConfig() in the homepage assembler.
   *   When present, TemplateRenderer uses it directly without extra CMS calls.
   *
   * ─── No-engine path (CMS pages) ──────────────────────────────────────────
   *
   *   Omit this when rendering a static CMS page (app/[slug]/page.tsx).
   *   TemplateRenderer will fetch slot content itself using each active
   *   slot's variantKey and createCMSProvider(), in parallel.
   */
  contextData?: ContextSlotData;
  /**
   * Token substitution context — enables merge-tag resolution in variant copy.
   *
   * When provided, ContextSlotRenderer replaces `{{device}}`, `{{company_short}}`,
   * `{{source}}`, `{{campaign}}` etc. in hero/proof/cta text fields.
   *
   * ─── Homepage path ────────────────────────────────────────────────────────
   *
   *   Built by buildTokenContextFromInput(input) in app/(site)/page.tsx.
   *
   * ─── CMS slug page path ───────────────────────────────────────────────────
   *
   *   Returned alongside pageConfig by resolveSlugPageConfig(), which builds
   *   it from the same decision input object (carries device, source, UTMs,
   *   enrichment fields available without running the full enrichment pipeline).
   */
  tokenContext?: TokenContext;
  /**
   * Optional pre-configured CMS provider for context-slot content fetching.
   *
   * When provided, TemplateRenderer uses this provider instead of calling
   * createCMSProvider() internally.  Pass `createDraftStatamicProvider(blocks)`
   * from the Statamic CP Live Preview path so variant lookups are served from
   * the draft+home.md block catalog without hitting the Statamic HTTP API.
   *
   * When absent, the standard createCMSProvider() factory is used (default).
   */
  cmsProvider?: CMSProvider;
}

/**
 * Generic slot-based page renderer.
 *
 * Renders the page as a single ordered sequence of `pageItems` — an array
 * where context slots and content blocks can be freely interleaved at
 * any position.  The order is determined entirely by the CMS author.
 *
 * ─── Rendering rules ──────────────────────────────────────────────────────────
 *
 *   - Notification slots are rendered once as a full-page overlay, outside
 *     the `pageItems` loop.
 *   - Context slots with variantKey === null are skipped (inactive).
 *   - Unknown block types are silently skipped (forward-compatible).
 *
 * This component is a React Server Component — no "use client" directive,
 * no hooks, no client-side state.
 */
export async function TemplateRenderer({ pageConfig, contextData, tokenContext, cmsProvider }: TemplateRendererProps) {
  // ── Resolve context data ──────────────────────────────────────────────────
  //
  // Engine path:    contextData is pre-fetched by the caller; use it directly.
  // No-engine path: contextData is absent; fetch from CMS using variantKeys.
  //                 When cmsProvider is supplied (e.g. draft preview), it is
  //                 used in place of the default createCMSProvider() factory.
  const effectiveContextData: ContextSlotData = contextData
    ?? await fetchContextDataFromSlots(pageConfig.contextSlots, cmsProvider);

  // ── Resolve the tenant's named block-token sets once ───────────────────────
  // Used to resolve any block/slot that references a named set by key.
  // Resolution failures are non-fatal — blocks simply fall back to site tokens.
  // Also resolve the site-wide DEFAULT design tokens — the central token system.
  // These are applied once at the page root below, so every block/slot inherits
  // them; per-block token refs still override for their own subtree.
  let blockTokenSets: readonly BlockTokenSet[] | undefined;
  let defaultTokens: CuratedBlockTokens | undefined;
  let effectSets: readonly EffectSet[] | undefined;
  let defaultEffects: readonly BlockEffectConfig[] | undefined;
  let blockTypeEffects: Partial<Record<string, readonly BlockEffectConfig[]>> | undefined;
  try {
    const { tenantId } = await getActiveTenant();
    const tenant = tenantId ? await getTenantById(tenantId) : null;
    blockTokenSets = tenant?.design?.blockTokenSets;
    defaultTokens  = tenant?.design?.defaultTokens;
    defaultEffects = tenant?.design?.defaultEffects;
    blockTypeEffects = tenant?.design?.blockTypeEffects;
    // Item 6: when a rule/session lock contextually selected a GALLERY preset,
    // use that preset's derived block tokens instead of the tenant's last-applied
    // defaultTokens, so the injected preset is not masked on hero/cta/card blocks.
    // Shared (React.cache) with app/layout's theme decision — no cookie race.
    const injected = await getContextualGalleryDefaultTokens();
    if (injected) defaultTokens = injected;
    // Named effect sets referenced by blocks are resolved from the library.
    // Non-fatal: on failure blocks simply fall back to inline / default effects.
    effectSets = tenantId ? await listDesignEffectSets(tenantId) : undefined;
  } catch {
    blockTokenSets = undefined;
    defaultTokens  = undefined;
    effectSets     = undefined;
    defaultEffects = undefined;
    blockTypeEffects = undefined;
  }

  // Card-on-dark render-time pin: an already-saved preset stores a raw dark
  // defaultTokens.cardBg that, re-emitted on this more-specific site-default block
  // scope, would mask the theme-var lift (#221). Lift it here too so the card reads
  // as elevated without re-applying the preset. Newly applied presets already carry
  // the lift from derivation, so this is an idempotent no-op for them.
  let scopedDefaultTokens = defaultTokens;
  if (defaultTokens) {
    const cardLift = liftDarkCardTokens(defaultTokens.cardBg, defaultTokens.bgSubtle, defaultTokens.text);
    if (cardLift) {
      scopedDefaultTokens = { ...defaultTokens, cardBg: cardLift.cardBg, cardBorder: cardLift.cardBorder };
    }
  }

  return (
    <BlockThemeScope tokenRef={{ tokens: scopedDefaultTokens }} sets={blockTokenSets} scopeId="site-default">
      {/* ── Notification overlay (rendered once, outside page flow) ──────── */}
      {effectiveContextData.notification && (
        <NotificationBlock
          id={effectiveContextData.notification.id}
          message={effectiveContextData.notification.message}
          severity={effectiveContextData.notification.severity}
          ctaLabel={effectiveContextData.notification.ctaLabel}
          ctaHref={effectiveContextData.notification.ctaHref}
          position={effectiveContextData.notification.position}
          dismissible={effectiveContextData.notification.dismissible}
          autoDismissMs={effectiveContextData.notification.autoDismissMs}
          frequency={effectiveContextData.notification.frequency}
          ttl={effectiveContextData.notification.ttl}
          ttlUnit={effectiveContextData.notification.ttlUnit}
          campaignId={effectiveContextData.notification.campaignId}
          media={effectiveContextData.notification.media}
          mediaSide={effectiveContextData.notification.mediaSide}
        />
      )}

      {/* ── Unified page items: slots and blocks in authored order ─────────── */}
      {pageConfig.pageItems.map((item: PageItem, index: number) => {
        if (item.kind === "slot") {
          const { slot } = item;
          if (slot.variantKey === null) return null;
          // Notification is rendered as an overlay above — skip inline.
          if (slot.slotId === "notification") return null;
          // Key includes the authored index so a page with two slots of the
          // same type (e.g. two "hero" slots) never collides on slotId alone.
          return (
            <BlockThemeScope
              key={`slot-${index}-${slot.slotId}`}
              tokenRef={{ tokenSet: slot.tokenSet, tokens: slot.tokens }}
              sets={blockTokenSets}
              scopeId={`${slot.slotId}-${index}`}
            >
              <ContextSlotRenderer
                slotId={slot.slotId}
                contextData={effectiveContextData}
                layoutVariant={slot.layoutVariant}
                tokenContext={tokenContext}
                blockTokenSets={blockTokenSets}
                effectSets={effectSets}
                blockTypeEffects={blockTypeEffects}
                defaultEffects={defaultEffects}
              />
            </BlockThemeScope>
          );
        }
        // item.kind === "block"
        return (
          <ContentBlockRenderer
            key={`block-${index}-${item.block.id}`}
            block={item.block}
            blockTokenSets={blockTokenSets}
            effectSets={effectSets}
            blockTypeEffects={blockTypeEffects}
            defaultEffects={defaultEffects}
          />
        );
      })}
    </BlockThemeScope>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL — SLOT CONTENT FETCHER (no-engine path)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch CMS content for all active context slots in parallel.
 *
 * Called only on the no-engine path (i.e. when the caller did not provide
 * pre-fetched contextData).  Uses createCMSProvider() which returns the
 * environment-configured provider (mock → Sanity → Storyblok → Statamic).
 *
 * Slots with variantKey === null are skipped.
 * CMS misses (provider returned null) produce no entry in the result —
 * ContextSlotRenderer treats absent entries as inactive slots.
 *
 * ctaKey is set to the variantKey so click events on hero/cta buttons can be
 * attributed to the correct variant in analytics.
 *
 * Locale is resolved from the request cookie so that NL/DE locale-tagged
 * variant documents are preferred over the EN defaults when the visitor has
 * a non-EN locale set.  tenantId and tenant CMS settings are resolved via
 * getActiveTenant() / getTenantById() — the same resolution used by the
 * parent page component.
 */
async function fetchContextDataFromSlots(
  slots: readonly ResolvedContextSlot[],
  providerOverride?: CMSProvider,
): Promise<ContextSlotData> {
  const activeSlots = slots.filter((s) => s.variantKey !== null);
  if (activeSlots.length === 0) return {};

  // ── Resolve locale and tenant for locale-aware variant fetching ────────────
  const cookieStore  = await cookies();
  const localeRaw    = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  const locale       = isSupportedLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const { tenantId } = await getActiveTenant();
  const tenant       = tenantId ? await getTenantById(tenantId) : null;

  // When a provider override is supplied (e.g. createDraftStatamicProvider from
  // the Live Preview path), use it directly — skips the factory and the
  // CachedCMSProvider wrapper so draft content is always fresh.
  const cms = providerOverride ?? createCMSProvider(tenant?.cms, tenantId, locale);

  // Fetch all active slots in parallel — no waterfall.
  const partials = await Promise.all(
    activeSlots.map(async (slot): Promise<Partial<ContextSlotData>> => {
      const key = slot.variantKey!;
      switch (slot.slotId) {
        case "hero": {
          const data = await cms.getHeroVariant(key);
          if (data) return { hero: { ...data, ctaKey: key } };

          // ── Adaptive-block fallback ─────────────────────────────────────────
          // When no regular hero variant is found for this key, try an adaptive
          // block (Content Matrix).  The no-engine path has no visitor context,
          // so we always resolve to the defaultVariant here.  The engine path
          // (homepage) pre-resolves contextData before calling TemplateRenderer
          // and therefore bypasses this fetch entirely.
          const adaptive = await cms.getAdaptiveBlock(key);
          if (adaptive && adaptive.isActive) {
            const { content } = resolveAdaptiveVariant(adaptive);
            const heroData    = adaptiveVariantToHeroBlockData(content, adaptive.key);
            // Carry the resolved variant's block-level tokens + effects so the
            // renderer can scope/animate this hero. Absent → no wrapper.
            const tokenRef  = tokenRefFromVariant(content);
            const effectRef = content.effects && (content.effects.effectSet || content.effects.effects?.length || content.effects.disabled)
              ? content.effects
              : undefined;
            return {
              hero: {
                ...heroData,
                ctaKey: key,
                ...(tokenRef  ? { tokenRef }  : {}),
                ...(effectRef ? { effectRef } : {}),
              },
            };
          }
          return {};
        }
        case "proof": {
          const data = await cms.getProofVariant(key);
          return data ? { proof: data } : {};
        }
        case "cta": {
          const data = await cms.getCTAVariant(key);
          return data ? { cta: { ...data, ctaKey: key } } : {};
        }
        case "feature": {
          const data = await cms.getFeatureVariant(key);
          return data ? { feature: data } : {};
        }
        case "conversion": {
          const data = await cms.getConversionVariant(key);
          return data ? { conversion: data } : {};
        }
        case "notification": {
          const data = await cms.getNotificationVariant(key);
          return data ? { notification: data } : {};
        }
        default:
          // Unknown slot type — forward-compatible; no content to fetch.
          return {};
      }
    }),
  );

  // Merge all partial results into a single ContextSlotData object.
  // Later slots override earlier ones for the same slotId — should not
  // happen in practice since each slotId appears at most once per page.
  return Object.assign({} as ContextSlotData, ...partials);
}
