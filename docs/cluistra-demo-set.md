# Cluistra demo-set (dev)

A sales/prospect demo layer for the **cluistra** tenant, in the style of the
statamic demo: a prospect switches between the four business contexts and the
adaptive blocks (hero, features, social-proof, CTA) visibly change, plus a
notification block driven by the time simulator.

**This is a demo layer, dev only.** The context is forced directly via a scenario
preset (`bypass: true`), independent of the production rules that need the real
signals and domain data. All copy is direction-of-the-writer placeholder marked
`werkversie` (`content._status`) until the CSD copy lands — never the final copy.

## How it works

- **Context switcher** — `components/scenario/demo-context-sets.ts` registers a
  per-tenant `DEMO_CONTEXT_SETS["cluistra"]` of four one-click contexts.
  `DemoStageSection` reads `?tenant=` and renders them instead of the generic
  personas. Each click calls `activateScenario({ ...overrides, bypass: true }, key)`.
- **Forced plans** — `lib/demo/demo-scenario-plans.ts` maps each `_scenarioKey`
  (`cluistra_service` / `_ondernemer` / `_particulier` / `_default`) to an
  `ExperiencePlan` of platform variant keys cluistra does not use in production.
  The homepage pipeline serves the forced plan when `bypass === true`
  (`homepage-pipeline.ts`), so the page switches without any rule setup.
- **Variant content** — authored in `platform_cms_content` for cluistra (see SQL
  below). The platform-hosted page reads these because cluistra's `cms.provider`
  is set to `"platform"` on dev.
- **Notification** — driven by the time simulator on the **real rule path** (no
  bypass): two dev-only rules keyed on `currentHour` + `isWeekend`. Day → the
  bel-ons banner (`notification_default`, green); Evening / Weekend → the
  buiten-openingstijden banner (`notification_urgency`, amber). The time window is
  hour-granular (open = weekday-ish 08–17), a demo approximation of ma-za 08:00–17:30.

### Key → context map

| Context | hero | proof | cta | feature |
|---|---|---|---|---|
| Service customer  | `hero_service`         | `proof_service`     | `cta_service` | `feature_service` |
| Business owner    | `hero_intent_direct`   | `proof_stats`       | `cta_meeting` | `feature_comparison` |
| Consumer          | `hero_consideration`   | `proof_reassurance` | `cta_demo`    | `feature_highlights` |
| Default           | `hero_direct_brand`    | `proof_cases`       | `cta_guide`   | `feature_grid_primary` |

## Notes / limitations

- The platform-hosted localhost page renders the Mister Chameleon site shell and
  the tenant-independent Statamic home sections; only the adaptive hero/proof/cta/
  feature blocks and the notification reflect cluistra. This matches the statamic
  demo's behaviour — the demo showcases the adaptive blocks, not a full cluistra site.
- Context (bypass) and notification (time simulator) are separate axes: the demo
  bypass skips the rules engine, so the notification shows on the time-driven real
  path. Clicking a context and then a time button drops back to the real path.
- CTA content needs a **singular** `content.cta = {label, href}` for the platform
  React renderer (`TemplateRenderer` reads `contextData.cta.cta`). `PlatformCMSProvider`
  does not normalise `ctas[]` → `cta` the way the Statamic provider does, so the
  singular field is authored explicitly below.

## Dev setup (idempotent)

Applied on dev (`xqaeqbqjymeyxbvmhseg`). Reproducible SQL:

```sql
-- 1) Tenant: platform CMS + deterministic demo (holdout 0). Dev only.
update tenant_settings
set settings = jsonb_set(
  jsonb_set(settings, '{cms}', '{"provider":"platform"}'::jsonb, true),
  '{enrichment,personalizationHoldoutPct}', '0'::jsonb, true)
where tenant_id='cluistra';

-- 2) Variant content: see the full INSERT ... ON CONFLICT blocks in git history
--    (feat/cluistra-demo-set). Every row carries
--    content._status = 'werkversie (richting schrijver, nog geen CSD-copy)'.
--    CTA rows additionally carry a singular content.cta:
update platform_cms_content
set content = jsonb_set(content, '{cta}',
  jsonb_build_object('label', content->'ctas'->0->>'label',
                     'href',  content->'ctas'->0->>'href'))
where tenant_id='cluistra' and variant_type='cta';

-- 3) Notification rules (prio 40/41) added to homepage_cluistra, and the dev
--    defaultPlan + notification-rule plans pointed at cluistra default-context
--    keys (hero_direct_brand / proof_cases / cta_guide / feature_grid_primary)
--    so the real path renders coherent cluistra content + the time banner.
```
