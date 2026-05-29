# Build Pipeline & Release System

Complete guide for the development, staging, and production pipeline.

---

## Environment Setup

### Three environments

| Environment | Branch | URL | Supabase project | Stripe mode |
|-------------|--------|-----|-----------------|-------------|
| Development | any feature branch | `localhost:3000` | Shared dev project | Test mode |
| Staging | `develop` | `staging.misterchameleon.com` | Staging project | Test mode |
| Production | `main` | `misterchameleon.com` | Production project | Live mode |

### Environment variables

Each environment has its own set of secrets. Templates are in the repo:

```
.env.local.example          # Development template
.env.staging.example        # Staging template
.env.production.example     # Production template
```

**Critical separation:**
- Staging uses `STRIPE_SECRET_KEY=sk_test_...` (test mode — no real charges).
- Production uses `STRIPE_SECRET_KEY=sk_live_...` (live mode — real charges).
- Each environment has its own Supabase project and service-role key.
- Vercel environment variables are set per environment in the Vercel dashboard.
- GitHub Actions secrets are set at the repository level (with environment scopes for production).

### GitHub environments

Two GitHub environments are configured:
- **staging** — no protection rules, auto-deploys on push to `develop`.
- **production** — requires manual approval from a designated reviewer before deploy runs.

Set these up at: *GitHub repo → Settings → Environments*.

---

## Branch Strategy

```
main                     ← production (protected, requires PR + CI)
develop                  ← staging (protected, requires PR + CI)
feature/<name>           ← feature work (branch from develop)
fix/<name>               ← bug fixes (branch from develop)
hotfix/<name>            ← urgent production fixes (branch from main)
```

### Typical flow

```
feature/my-feature
    │
    ├─► PR → develop   (CI runs, reviewer approves)
    │
develop
    │   (auto-deploys to staging)
    │
    ├─► PR → main      (CI runs, reviewer approves)
    │
main
    │   (manual approval gate → auto-deploys to production)
    │   (auto-tags and creates GitHub release)
```

### Branch protection rules

Configure both `main` and `develop` with:
- Require pull request before merging
- Require status checks to pass (CI workflow)
- Require at least 1 approving review
- No force pushes
- No deletions

---

## Deployment Flow

### CI (runs on every PR)

Triggered by: PRs targeting `main` or `develop`.

```
ci.yml
  ├── lint-and-typecheck (eslint + tsc --noEmit)
  ├── test (jest — unit + integration, with TEST_SUPABASE vars)
  └── build (next build — verifies no compile errors)
```

All three jobs must pass before a PR can be merged.

### Staging deploy

Triggered by: push to `develop` (after PR merge).

```
staging.yml
  ├── ci (reusable — same as above)
  ├── migrate (supabase db push → staging project)
  ├── deploy (vercel --target=preview + alias to staging.misterchameleon.com)
  └── healthcheck (curl /api/health, expects 200)
```

### Production deploy

Triggered by: push to `main` (after PR merge from develop).

```
production.yml
  ├── ci (same checks)
  ├── approve (manual gate — GitHub Environment: production)
  ├── migrate (supabase db push → production project)
  ├── deploy (vercel --prod)
  ├── healthcheck (curl /api/health on production URL)
  └── release (scripts/release.ts --create-tag --push --github-release)
```

The release step:
1. Reads commits since the last tag.
2. Determines bump type (major / minor / patch) from conventional commit prefixes.
3. Increments version in `package.json`.
4. Appends to `CHANGELOG.md`.
5. Creates a git tag and pushes it.
6. Creates a GitHub Release with the generated changelog section.

---

## Database Migration Control

Migrations live in `supabase/migrations/` as sequentially-numbered SQL files:

```
20240101000001_create_tenants.sql
20240101000002_create_admin_users.sql
...
20240101000037_create_tenant_form_overrides.sql
```

### Rules

1. **Never edit an existing migration file.** Always create a new migration to make schema changes.
2. **Name migrations descriptively.** Use the format `YYYYMMDDNNNNNN_description.sql`.
3. **Migrations are applied in order.** Each file must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, etc.).
4. **Test migrations on staging first.** The staging deploy applies migrations before the production deploy.

### Creating a new migration

```bash
# Generate a timestamped filename
echo "supabase/migrations/$(date +%Y%m%d%H%M%S)_your_description.sql"

# Or use the Supabase CLI
supabase migration new your_description
```

### Rollback a bad migration

Migrations do not auto-rollback. If a migration causes issues:

1. Write a **new** migration that undoes the change (e.g., `DROP COLUMN`, `DROP TABLE`).
2. Deploy it via the normal pipeline.
3. For catastrophic failures, use Supabase PITR (Point-in-Time Recovery) to restore the database to a pre-migration state, then revert the code.

---

## Release Management

### Versioning

Follows [Semantic Versioning](https://semver.org/):

| Commit prefix | Version bump |
|--------------|-------------|
| `BREAKING CHANGE:` in body | **major** (x.0.0) |
| `feat:` | **minor** (0.x.0) |
| `fix:`, `perf:`, `refactor:`, others | **patch** (0.0.x) |

### Conventional commit prefixes

```
feat:      New feature
fix:       Bug fix
perf:      Performance improvement
refactor:  Code restructuring (no feature/fix)
docs:      Documentation only
test:      Test additions or changes
chore:     Build system, tooling, deps
ci:        CI/CD changes
```

### Manual release (emergency)

```bash
node --experimental-strip-types scripts/release.ts \
  --version=1.2.3 \
  --create-tag \
  --push \
  --github-release
```

### CHANGELOG.md

Auto-generated and committed on each production deploy. Structure:

```markdown
## [1.2.3] — 2024-12-01

### Features
- feat: add billing portal link to admin nav

### Bug Fixes
- fix: correct credit balance display for zero-credit tenants

### Performance
- perf: cache context library matching result per request
```

---

## Rollback Procedure

### Quick rollback (Vercel alias)

For frontend-only issues, roll back in under 2 minutes by pointing the production domain to the previous Vercel deployment:

```bash
# Via GitHub Actions (recommended — requires production environment approval)
# Go to: GitHub → Actions → "Production Rollback" → Run workflow
# Input: previous deployment URL from Vercel dashboard
# Input: reason for rollback

# Or manually via Vercel CLI
vercel alias set <previous-deployment-url> misterchameleon.com
```

The rollback workflow (`rollback.yml`) is a manual `workflow_dispatch` that:
1. Requires production environment approval.
2. Runs `vercel alias` to point the production domain to a previous deployment.
3. Creates a GitHub deployment annotation for the audit trail.

### Full rollback (code + DB)

For schema-breaking changes that require database rollback:

1. Create a new migration that reverts the schema change.
2. Merge it to `develop` → staging deploy → verify.
3. Merge to `main` → production deploy (with approval).
4. If the DB is in an unrecoverable state, use Supabase PITR to restore to a pre-change snapshot, then re-deploy the corresponding code tag.

### Identifying the previous deployment

```bash
# List recent Vercel deployments
vercel ls --prod

# Or via Vercel dashboard: Project → Deployments
```

---

## Hotfix Procedure

For urgent production bugs that cannot wait for the normal `develop → main` flow:

### 1. Branch from main

```bash
git checkout main
git pull origin main
git checkout -b hotfix/brief-description
```

### 2. Make the fix and push

The hotfix CI workflow runs automatically on `hotfix/**` branches:
- Lint + typecheck
- Personalisation-critical tests only (fast — ~2 min vs ~10 min full suite)

### 3. Merge to main via PR

```bash
# Create PR targeting main (not develop)
gh pr create --base main --title "hotfix: description" --body "..."
```

After approval and CI pass, merge to `main`. The production workflow runs automatically (with the manual approval gate).

### 4. Back-merge to develop

After the production deploy succeeds, cherry-pick the fix back to `develop`:

```bash
git checkout develop
git pull origin develop
git cherry-pick <hotfix-commit-sha>
git push origin develop
```

Or create a PR from `hotfix/` to `develop` if the changes need review.

### 5. Delete the hotfix branch

```bash
git push origin --delete hotfix/brief-description
```

### Hotfix checklist

- [ ] Does the fix require a DB migration? If yes, include it in the hotfix branch.
- [ ] Is the fix tested locally against production data patterns?
- [ ] Has staging been smoke-tested after the staging deploy?
- [ ] Is the cherry-pick back to `develop` done to prevent regression on the next release?

---

## Health Check Endpoint

All deployment workflows verify the `/api/health` endpoint returns HTTP 200 after deploy.

The endpoint should return:

```json
{
  "status": "ok",
  "version": "1.2.3",
  "env": "production"
}
```

If you don't have this endpoint yet, create it at `app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";
import pkg from "@/package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version: pkg.version,
    env: process.env["NODE_ENV"] ?? "unknown",
  });
}
```
