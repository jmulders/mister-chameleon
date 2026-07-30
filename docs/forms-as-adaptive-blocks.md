# Forms as adaptive blocks — design

*Status: design (not built). Goal: make forms first-class adaptive slots with
presentation variants, and select those variants with the existing decision
engine instead of a bespoke contextual-forms subsystem.*

## Why

Two real problems, surfaced by looking at how tenant contact forms actually look
(contact panel left/right, photo of the contact person, 1 vs 2 columns, varied
field arrangements) and at the current admin UI:

1. **Forms cannot vary their presentation.** Today a form varies only its copy,
   field set, and thank-you per segment (`FormOverlay`). It has one fixed
   layout. Real forms need layout variants: split form + contact panel, panel
   left or right, photo on/off, compact/stacked, multi-step.

2. **Forms have their own rules engine.** Contextual forms were built as a
   *parallel* subsystem (`settings.formContext` = rules + overlays keyed by
   `[formKey][segment]`, resolved by `resolveContextualForm`, with a dedicated
   "Contextual forms" rules page and a sibling "Contextual CTAs" panel). This
   duplicates the decision engine that already picks adaptive-block variants per
   visitor. Conceptually a form is just an adaptive slot, so its variant
   selection belongs in the same rules builder. The bespoke UI is also the
   "vague" part — it is a second, half-finished mechanism next to the real one.

## Current state — two parallel systems

- **Decision engine.** Adaptive slots (hero, proof, cta, feature, conversion,
  notification) have variants; a variant is chosen per visitor by rules
  (`rules_config` / stored rules), experiments, and AI. Managed under
  Personalization (Slots / Variants / Rules / Experiments / AI). The snippet
  `/api/snippet/decide` resolves slot → variant.

- **Forms subsystem.** `FormDefinition` (fields, validation, email routing,
  action flags) per form type (contact / application / appointment), plus
  `TenantFormContext` overlays keyed by `[formKey][segment]`, resolved by
  `resolveContextualForm`, with its own rules UI. Rendered by `renderForm`
  (snippet) and `FormSectionBlock` (platform). Turnstile + submission handled by
  `/api/forms/[formKey]`.

Both solve "pick the right thing per visitor," but they do not share it.

## Target model — a form is an adaptive slot

- **Form slot** — like hero/cta: the placement where a form appears. The marker
  `data-mc-block="form:<type>"` already exists.

- **Form variant** — the unit the decision engine chooses. It carries:
  - a **layout template** (presentation),
  - **copy** (heading, intro, submit label, thank-you / redirect),
  - a **field set** (drop / relabel / reorder the presented fields),
  - an optional **contact panel** (person name, role, photo, phone, email),
  - optional **design tokens**.

- **Form definition (server contract)** — unchanged responsibility, keyed by
  form *type*: the canonical fields, validation, email routing, storage,
  Turnstile. Every variant of a form references the same definition. A variant
  may narrow / relabel / reorder the *presented* fields, but submission always
  validates against the definition. This is the plumbing, not personalisation.

### Layout templates

A small, token-styled template library. Each template exposes named regions:
heading, intro, the fields, submit, and an optional contact panel. Start with:

- `single` — one column (today's layout).
- `split-left` / `split-right` — form on one side, contact panel on the other.
- contact panel with / without photo.
- `compact` — stacked, minimal.
- `multi-step` — later.

The same field set renders in different arrangements by swapping the template.

### Selection = the existing decision engine

No form-specific rules. A form variant is chosen exactly like a hero variant:

- **rules** in the rules builder (`RuleCondition` over path, UTM, geo, behaviour,
  company, …),
- **experiments** (A/B a form layout),
- **AI** (later).

The dedicated "Contextual forms" rules page and the "Contextual CTAs" panel are
deprecated and folded into the standard Variants + Rules UI.

## Mapping to existing infrastructure

- Store form variants where adaptive-block variants already live
  (`adaptive_blocks` / variants), typed as a `form` block whose variant payload
  is `{ templateId, copy, fieldSet, contactPanel, tokens }`.
- Extend the decide-route variant renderer so a `form` variant renders through
  its chosen template (reusing `renderForm` / `FormSectionBlock`, made
  template-aware).
- `/api/forms/[formKey]` keeps its contract: validate against the definition +
  Turnstile, independent of which template was shown.

## Migration (existing `settings.formContext`)

- For each tenant with `formContext`: convert each `overlays[formKey][segment]`
  into a form variant (copy + field set) on the form slot, and each rule into a
  decision-engine rule targeting that variant.
- Keep the old resolver reading `formContext` as a fallback during transition;
  remove it once every tenant is migrated.
- No data loss: overlays map 1:1 to variants; rules map to rule conditions.

## Rendering changes

- Snippet `renderForm` → template-aware: given `{ templateId, copy, fields,
  contactPanel, tokens }`, render the chosen layout (all `mc-`-scoped and
  token-styled). Turnstile widget injection is unchanged.
- Platform `FormSectionBlock` → the same template set as React components.
- A **shared template registry** (ids + region contract) so the snippet HTML and
  the React render stay visually identical.

## Admin UX

- Forms move into the adaptive-block / variants flow: choose a form slot, add
  variants (template + copy + fields + contact panel), set rules in the rules
  builder, run experiments.
- The dedicated "Contextual forms" page becomes redundant.
- The per-form **server settings** (recipients, store, confirm, Turnstile,
  retention) stay on the Forms page — that is the definition, not
  personalisation.

## Phasing

1. **Templates + rendering.** Template registry + form-variant payload type +
   template-aware renderers (snippet + platform). Ship `single`, `split-left`,
   `split-right`, and the photo toggle. No selection change yet — a form still
   shows its default variant. This alone gives layout variety.
2. **Decision-engine wiring.** Rules + experiments select a form variant.
   Deprecate the bespoke contextual-forms resolver; migrate `formContext` →
   variants + rules.
3. **Admin consolidation.** Forms in the Variants / Rules UI; retire the
   Contextual forms page; keep the Forms page for the server contract.
4. **AI-driven form-variant selection** (optional, later).

## Open decisions

- Do form variants live in the **same** `adaptive_blocks` store, or a parallel
  `form_variants` table that reuses the decision engine? Prefer the same store so
  there is one rules path.
- Contact-panel data (person / photo / phone): per variant, or pulled from a
  tenant "team member" record? Start per-variant; link to the CMS later.
- How much of the field set can a variant change vs the definition? A variant can
  drop / relabel / reorder; it cannot add a field the definition + validation
  does not know about.
