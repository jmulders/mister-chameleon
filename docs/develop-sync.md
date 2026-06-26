# Runbook — keep `develop` in sync with `main`

We use a **fast-path**: most work is committed straight to `main` (CI still gates
it). The trade-off is that the staging branch `develop` falls behind `main` over
time. This runbook re-aligns it so `develop` stays a usable staging base.

> Run this **periodically** — e.g. at the end of a working session, or before
> anyone starts work that will go through `develop → staging → main`.

## 1. Safety check — does `develop` have unique commits?

A hard reset discards anything on `develop` that isn't on `main`. First confirm
there's nothing to lose:

```bash
git fetch origin develop main
git rev-list --count origin/main..origin/develop   # commits on develop NOT on main
```

- **`0`** → safe to reset (the steps below).
- **non-zero** → `develop` has unique work. Do NOT hard-reset. Instead open a PR
  `develop → main` (or cherry-pick those commits to main first), then reset.

## 2. Re-align `develop` to `main`

```bash
git checkout develop
git reset --hard origin/main
git push --force-with-lease origin develop
git checkout main
```

`--force-with-lease` (not `--force`) refuses to overwrite if someone else pushed
to `develop` in the meantime — a safety net against clobbering a colleague.

## 3. Verify

```bash
git rev-list --count origin/develop..origin/main   # → 0 (develop not behind)
git rev-list --count origin/main..origin/develop   # → 0 (develop not ahead)
```

Both `0` = `develop` and `main` are identical. Done.

---

## When this is NOT enough

If real feature work starts flowing through `develop` (the intended
`feature → develop → main` flow), stop hard-resetting — `develop` then carries
commits `main` doesn't have yet, and a reset would delete them. At that point
switch to merging (`develop → main` via PR) instead of resetting.

See [`pipeline.md`](./pipeline.md) for the full branch model and
[`cms-pipeline.md`](./cms-pipeline.md) for the CMS side.
