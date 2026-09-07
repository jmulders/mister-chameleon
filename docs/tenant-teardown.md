# Deleting a tenant

The reverse of a rollout (see [`demo-rollout.md`](demo-rollout.md)). A provisioned
Statamic tenant has two halves: **platform data** in Supabase, and **external
infrastructure** (a Ploi Cloud app, a GitHub repo, a Vercel domain, a Strato DNS
record). The admin handles the data half in one click; the infra half is four
manual removals.

Replace `<slug>` below with the tenant id (e.g. `test`, `demo`) — the same slug
that appears in `mc-cms-<slug>`, `mister-chameleon-cms-<slug>` and
`<slug>.demo.misterchameleon.nl`.

## 1. Platform data — the admin "Delete tenant" flow

Admin → **Tenants** → open the tenant → **Settings** → scroll to the red
**Danger zone** at the bottom → **Delete tenant…** → type the tenant id to
confirm → **Delete permanently**.

- Super-admin only. Permanent and irreversible.
- Removes **all** tenant-scoped data. The action sweeps every public table with a
  `tenant_id` column (`tenant_domains`, `adaptive_blocks`, `experiments`, ABM,
  enrichment/usage, visitor data, forms, billing/wallet, …) and deletes the
  tenant's `rules_config` rows (that table is keyed `<type>_<tenantId>` —
  `homepage_`, `retention_`, `self_service_`, `failure_signals_` — not by a
  `tenant_id` column, so it is handled explicitly, by exact key). It also removes
  the tenant's admin↔tenant links and any orphaned admin users whose only tenant
  was this one. `tenant_settings` is deleted last (which cascade-removes
  `tenant_dunning_settings`).
- **A reused slug starts clean.** Because the sweep leaves no rows behind, a new
  tenant provisioned with the same id (e.g. `test`, `demo`) does not inherit the
  old tenant's rules, adaptive blocks, wallet balance or visitor data.
- Best-effort and non-atomic: a per-table failure is logged and the sweep
  continues (only a `tenant_settings` failure aborts and surfaces an error). If a
  delete leaves something behind, re-running the delete is safe.
- If the tenant has an active **Stripe subscription**, cancel it in the Stripe
  Dashboard first (throwaway demos have none).

Deleting the tenant's data stops it from resolving, so the public site at
`<slug>.demo.misterchameleon.nl` goes dark even before you touch DNS — the
`tenant_domains` rows are removed by the sweep, but the Vercel domain and Strato
CNAME still need the manual removals in step 2.

## 2. External infrastructure — four manual removals

Not touched by the admin delete; remove each yourself.

1. **Ploi Cloud** — delete the application `mc-cms-<slug>`. This takes the
   control panel (`…preview.ploi.it`) offline.
2. **GitHub** — delete or archive the repo `jmulders/mister-chameleon-cms-<slug>`.
3. **Vercel** — project `mister-chameleon` → Settings → Domains → remove
   `<slug>.demo.misterchameleon.nl`.
4. **Strato** — DNS tab → delete the CNAME record `<slug>.demo`.

## Notes

- **Order doesn't matter** for a throwaway tenant. If you leave the Vercel domain
  or Strato CNAME behind after the admin delete, they just dangle harmlessly
  (nothing resolves to a tenant anymore).
- **Soft alternative:** `tenant_settings.is_active_override` can deactivate a
  tenant without deleting anything — use that instead of a hard delete when you
  might want it back.
- The platform delete is DB-only by design: Ploi/GitHub/Vercel/Strato live
  outside Supabase and have no platform credentials wired for destructive calls,
  so they stay a deliberate manual step.
