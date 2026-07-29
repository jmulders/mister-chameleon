# Admin nav URL refactor — plan

*Status: plan (not yet executed). Goal: make the tenant-workspace URL tree match
the tab tree, so a page's path reflects the tab it lives under. Old URLs keep
working via 301 redirects.*

## Why

Today the URL tree and the tab tree disagree. Personalization surfaces are
scattered across `/behavior/*`, bare top-level paths (`/blocks`, `/variants`,
`/rules`, `/experiments`, `/ai`) and `/forms/context`. Audience surfaces are
spread across `/interest-profiles`, `/audience-segments`, `/abm`, `/ad-sync`,
`/leads`, `/behavior/journey` and a bare `/behavior` (Scoring). The worst tells:
`/behavior/slots` is a Personalization page buried under `/behavior`, and the
bare `/behavior` route *is* the Scoring page.

## Target scheme

Group each tab's pages under a matching path prefix.

### Personalization → `/personalization/*`

| Label | Old path | New path |
|---|---|---|
| Slots | `/behavior/slots` | `/personalization/slots` |
| Variants | `/variants` | `/personalization/variants` |
| Adaptive blocks | `/blocks` | `/personalization/blocks` |
| Contextual forms | `/forms/context` | `/personalization/contextual-forms` |
| Rules | `/rules` | `/personalization/rules` |
| Experiments | `/experiments` | `/personalization/experiments` |
| AI | `/ai` | `/personalization/ai` |
| AI logs | `/ai-logs` | `/personalization/ai/logs` |
| AI policy | `/behavior/ai-policy` | `/personalization/ai/policy` |
| Field fill | `/behavior/field-fill` | `/personalization/ai/field-fill` |
| Context variables | `/context` | `/personalization/context-variables` |

### Audience → `/audience/*`

| Label | Old path | New path |
|---|---|---|
| Interests | `/interest-profiles` | `/audience/interests` |
| Segments | `/audience-segments` | `/audience/segments` |
| Target accounts | `/abm` | `/audience/accounts` |
| Leads | `/leads` | `/audience/leads` |
| Suppression | `/leads/suppression` | `/audience/leads/suppression` |
| Attribution | `/leads/performance` | `/audience/attribution` |
| Retargeting | `/ad-sync` | `/audience/retargeting` |
| Journey | `/behavior/journey` | `/audience/journey` |
| Scoring | `/behavior` | `/audience/scoring` |

Content (`/pages`, `/forms`, `/email`, `/assets`, `/blueprints`,
`/content-status`) can follow the same `/content/*` pattern in a later pass; it
is out of scope for the first two phases because it has no split-brain problem.

## Mechanism

For each moved route:

1. **Move the directory** under `app/admin/tenants/[tenantId]/` to its new path
   (dynamic segments and nested pages move with it).
2. **Add a 301 redirect** old → new in `next.config.mjs` `redirects()` using
   `:tenantId` path params, e.g.
   `{ source: "/admin/tenants/:tenantId/behavior/slots", destination: "/admin/tenants/:tenantId/personalization/slots", permanent: true }`.
   This keeps bookmarks, external links, and any missed internal link working.
3. **Update internal links**: `TenantSubNav.tsx` hrefs/prefixes, plus any
   hardcoded `Link`/`redirect`/`router.push` to the old paths, plus every
   `revalidatePath("/admin/tenants/.../<old>")` in server actions.
4. **Update the nav prefix + activePrefix** entries so tab/sub-item highlighting
   follows the new paths (and drop the `/forms/context` special-case in
   `isGroupActive` once Contextual forms moves out of `/forms`).

## Sequencing (each its own commit + verify)

- **Phase 1 — Personalization (pilot).** Move the 11 Personalization routes,
  add redirects, update links + revalidatePath, update the nav. Validates the
  whole approach on one tab.
- **Phase 2 — Audience.** Same for the 9 Audience routes.
- **Phase 3 (optional) — Content** under `/content/*` for full consistency.
- **Phase 4 — cleanup.** Remove the now-unneeded nav special-cases and the
  behavior-split highlight logic.

## Verification per phase

- `grep` the repo for every old path string to confirm no internal link, redirect,
  or `revalidatePath` still points at it.
- `next build` / typecheck green.
- Click-through: each moved page loads at its new URL, and each old URL 301s to
  the new one.
- Nav: the correct tab + sub-item highlight on every moved page.

## Risks / notes

- `revalidatePath` calls are the easiest thing to miss — a stale path silently
  fails to revalidate. Grep every server action.
- Redirects are permanent (301) and cached by browsers; keep them in place
  indefinitely (cheap) rather than removing them later.
- No data or DB changes — this is purely routing + links.
