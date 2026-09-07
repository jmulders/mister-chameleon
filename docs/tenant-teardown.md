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
- Deletes the tenant's `tenant_settings` row and, with it, the rows that hang off
  it by a foreign key: billing (subscriptions, wallet, dunning state). It also
  removes the tenant's admin↔tenant links and any orphaned admin users whose only
  tenant was this one.
- **Not everything is removed.** Tenant-scoped tables that are keyed by a plain
  `tenant_id` column with *no* foreign key to `tenant_settings` —
  `tenant_domains`, `rules_config`, `adaptive_blocks`, experiments, ABM,
  enrichment cache, visitor data — are **left behind**. They dangle harmlessly:
  once `tenant_settings` is gone the tenant no longer resolves, so nothing reads
  them. Delete them directly in the database only if you want the tidiness.
- If the tenant has an active **Stripe subscription**, cancel it in the Stripe
  Dashboard first (throwaway demos have none).

Deleting the `tenant_settings` row is what stops the tenant from resolving, so the
public site at `<slug>.demo.misterchameleon.nl` goes dark even before you touch
DNS — the leftover `tenant_domains` row now points at a tenant that no longer
exists.

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
