# Forms — phase 2: variants chosen by the decision engine

*Status: design (not built). Depends on phase 1 (presentation layouts), which is
done. Goal: let the existing decision engine pick a form variant (layout + copy +
field set) per visitor, retire the bespoke contextual-forms subsystem, and
migrate the existing `settings.formContext` data. See
`docs/forms-as-adaptive-blocks.md` for the overall direction.*

## What phase 1 already gave us

- A form can render in different **layouts** (single, split-left, split-right)
  with a contact panel — the same renderer for the snippet and the platform.
- The layout is stored per form on `tenant_form_overrides.layout` and resolved
  into `ResolvedForm.layout` by `resolveContextualForm`.

Phase 1 built the *rendering primitive*. Phase 2 makes the decision engine
*choose* which variant of that primitive to show, instead of a form-specific
resolver.

## The two mechanisms to merge

- **Decision engine** — slots (hero, cta, …) resolve to a variant per visitor via
  rules (`rules_config` / stored rules) and experiments, in
  `/api/snippet/decide`. Managed under Personalization (Variants / Rules /
  Experiments).
- **Contextual forms** — `settings.formContext` (rules + `overlays[formKey]
  [segment]`) resolved by `resolveContextualForm`, with its own rules page. This
  is the parallel subsystem to remove.

## Target data model

A **form variant** lives in the same store adaptive-block variants use, typed as
a `form` block keyed by the form slot (`form:<type>` — contact / application /
appointment). Its payload:

```
{
  key:          string,          // variant key, e.g. "contact_werving"
  isDefault:    boolean,         // served when no rule matches
  layout:       FormLayout,      // template + contact panel (phase 1 shape)
  copy:         { title?, intro?, submitLabel?, successMessage?, redirectPath? },
  fieldSet?:    FormField[],     // overrides the definition's presented fields
  tokens?:      TokenOverrides,  // per-variant design tokens
}
```

The **form definition** (fields, validation, email routing, storage, Turnstile)
is unchanged and shared by every variant — it is the server contract, keyed by
form type.

## Selection = the decide route

- Extend the decide route's slot→variant resolution so a `form:<type>` slot
  resolves to a **form variant** (via the same rule evaluation used for hero).
- Feed the chosen variant into the phase-1 renderer: `renderForm` (snippet) and
  `FormSectionBlock` (platform) already accept `layout` + copy + fields; they
  just need to read them from the selected variant instead of the per-form
  override.
- Rules are authored in the **rules builder** (`RuleCondition` over path / UTM /
  geo / behaviour / company) targeting a form variant key — identical to hero.
- Experiments A/B a form layout by bucketing over the form slot's variants.

No form-specific rules UI. The "Contextual forms" page and "Contextual CTAs"
panel are removed; their capability is expressed as variants + rules.

## Migration (from `settings.formContext`)

For each tenant that has `formContext`:

1. Each `overlays[formKey][segment]` → a form variant (copy + fieldSet) on the
   `form:<formKey>` slot, keyed by segment.
2. Each rule (conditions → segment) → a decision-engine rule targeting that
   variant.
3. The phase-1 per-form `tenant_form_overrides.layout` → the **default** variant's
   layout for that form.
4. Keep `resolveContextualForm` reading `formContext` as a fallback during the
   transition; remove it once every tenant is migrated.

Overlays map 1:1 to variants and rules map to rule conditions, so there is no
data loss. Write it as a dry-runnable migration script (like the email-secret
one) that lists what it will create before applying.

## Server contract stays independent

`/api/forms/[formKey]` is unchanged: it validates the submission against the form
definition + Turnstile, regardless of which variant/layout the visitor saw. A
variant may drop / relabel / reorder presented fields, but cannot introduce a
field the definition does not know about.

## Admin UX after phase 2

- Forms are managed like any adaptive slot: open the form slot, add variants
  (layout + copy + fields + contact panel), set rules in the rules builder, run
  experiments.
- The Forms page keeps the **server settings** (recipients, store, confirm,
  Turnstile, retention) — that is plumbing, not personalisation.
- The dedicated Contextual forms page is retired.

## Phasing within phase 2

1. **Form variants in the store + decide resolution.** Model a `form` block with
   variants; make the decide route resolve `form:<type>` to a variant and render
   it via the phase-1 renderer. Ship with a single default variant per form
   (behaviour unchanged) to de-risk.
2. **Rules + experiments target form variants.** Author form rules in the rules
   builder; enable experiments over form variants.
3. **Migrate `formContext`** → variants + rules (dry-run first), then remove the
   bespoke resolver and the Contextual forms page.
4. **Admin consolidation** into the Variants / Rules UI.

## Risks / open decisions

- **Same store vs parallel table.** Recommend the same `adaptive_blocks` store so
  there is one rules path; the alternative (a `form_variants` table reusing the
  engine) duplicates plumbing. Decide before phase-2.1.
- **Field-set overrides in a variant** must still validate against the
  definition — enforce at save time (a variant field must exist in the
  definition; it may be dropped / relabelled / reordered only).
- **Contact-panel data** stays per-variant for now; a later link to a CMS "team
  member" record is out of scope.
- **Backwards compatibility** during migration: the fallback resolver must not
  double-apply (a tenant is either on variants or on `formContext`, never both).
