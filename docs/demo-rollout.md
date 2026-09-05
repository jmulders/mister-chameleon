# One-click Statamic rollout

Admin → **Tenants** → *Nieuwe Statamic-site*. Type a name, pick **Demo** or
**Leeg**, press the button, wait a couple of minutes, copy the credentials it
hands back. That is the whole process — provided the one-time setup below is in
place.

## Demo or Leeg

|  | **Demo** | **Leeg** |
| --- | --- | --- |
| Pages | 7 — home, diensten, prijzen, cases, over ons, contact, bedankt | 3 — home, contact, showcase |
| Blocks | every block type the CMS declares, filled in | the neutral starter set |
| Collections | 3 cases, 3 testimonials, 4 features, 3 plans, 3 team members, 4 FAQ items, 2 blog posts | empty |
| Navigation | Home · Diensten · Prijzen · Cases · Over ons · Contact | Home · Contact |
| Personalisation | an adaptive block + a rule, so the hero visibly switches | slots render their default |
| Forms | a contact form on two pages, one showing a thank-you message and one redirecting | one contact form |

Both modes are otherwise identical: same repo, same deploy key, same super-user,
same wildcard URL. The mode only picks which seed directory the provisioner
applies (`demo-seed/` or `seed/` in the template repo) and, for Demo, whether
the platform-side adaptive data is seeded too.

**A demo is brand-free.** The example brand is *Acme* — a placeholder, not a
real company. It is defined once, as `DEMO_BRAND` in
`lib/provisioning/demo-platform-seed.ts` for the platform copy and as literal
text in the template's `demo-seed/`; that directory's README says what to change.

## Does the personalisation actually fire?

Yes, and this is the part that used to be missing. A demo rollout writes two
things on the platform side for the new tenant:

- an **adaptive block** (`hero_matrix_homepage`) with two hero variants;
- a **rule** in `rules_config` (`homepage_<tenantId>`): a visitor arriving from
  LinkedIn gets the organisation-facing hero.

To show it: open the site, then set the traffic source to LinkedIn in the
scenario console (bottom right). The hero changes. `source` was chosen over
device or UTM precisely because the console can set it directly, so the switch
is demonstrable on demand rather than dependent on real traffic.

Both variant keys are platform keys (`hero_default`, `hero_enterprise`). A
Statamic tenant contributes no `extraKeys`, so a rule naming a CMS-invented key
would be rejected by `validateStoredConfig` — and that check is all-or-nothing,
so it would take the tenant's whole rule set down with it.

If the adaptive seed fails, the rollout still succeeds with a warning: the site
works, its slots just render their defaults.

## One-time setup (do this once, ever)

Both steps are about the **wildcard**. It is what removes per-demo DNS: every
demo is a row in `tenant_domains`, not a registrar visit and a certificate wait.

**1 — DNS.** At the registrar for `misterchameleon.nl`:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `*.demo` | `cname.vercel-dns.com` |

**2 — Vercel.** On the platform project, add the domain `*.demo.misterchameleon.nl`
(Project → Settings → Domains). Vercel issues one wildcard certificate covering
every subdomain.

Verify with any name you like — it does not have to exist yet:

```bash
dig +short anything.demo.misterchameleon.nl
```

A CNAME to Vercel means you are done.

**Without this**, a rollout still produces a working CP, a working repo and
its content — only the public `<slug>.demo.misterchameleon.nl` URL will not
resolve. The rollout does not fail; it just gives you a URL nothing answers on.

## Also needed

Both are already configured if any tenant has been provisioned before —
Platform → Integrations → Provisioning:

- a **GitHub token** with admin rights on the repo owner. Repo-admin is what
  lets the rollout add the write deploy key; a token without it still completes,
  with a warning (see *Deploy key* below).
- a **Ploi Cloud token** and team.

## What the button actually does

1. **Tenant** — via the normal onboarding path, so the siteKey is generated the
   same way it is for any other tenant. Slug comes from the name.
2. **Repo** — generated from the template, private.
3. **Content** — the chosen seed (`demo-seed/` or `seed/`) applied over the
   copy, and every collection entry that seed does not provide deleted. No
   previous tenant's content, and none of ours. See each seed's own README in
   the template repo.
4. **Write deploy key** — an ed25519 pair generated here; the public half goes
   on the repo with write access, the private half becomes the
   `STATAMIC_GIT_SSH_KEY` secret. This is what makes CP edits survive a
   redeploy.
5. **Ploi application** — with `php artisan mc:ensure-super-user` in the build
   commands and `CP_ADMIN_EMAIL` / a generated `CP_ADMIN_PASSWORD` as secrets,
   so there is an account to log in with.
6. **Wait for the host** Ploi assigns, then set `statamicBaseUrl`, correct
   `APP_URL` to that host and redeploy.
7. **Public URL** — one `tenant_domains` row for `<slug>.demo.misterchameleon.nl`.
8. **Adaptive data** — demo mode only; see above.

The Ploi app's build commands also carry the `cms-content` overlay, so CP edits
survive every redeploy without a dashboard step — see below.

You get back the site URL, the CP URL, the CP e-mail and the password.

## CP edits survive a redeploy — automatically

A rolled-out tenant is content-persistent out of the box. Nothing to configure in
the Ploi dashboard.

Statamic's git automation pushes CP saves to a disposable `cms-content` branch
(never the deploy branch — see the template's DEPLOY.md for why). Something then
has to read that branch back onto the pod, or a redeploy serves the image's
content and the edits look like they vanished. On a classic Ploi server
`deploy.sh` does it; **Ploi Cloud never runs `deploy.sh`**, only the commands in
the IaC. So the provisioner now emits those steps as build commands:

```
composer install …
git config --global --add safe.directory …
install $STATAMIC_GIT_SSH_KEY, switch the remote to SSH
git fetch origin --prune
git checkout origin/cms-content -- <each content path>
php artisan mc:ensure-super-user
```

The paths are content-only and mirror `config/statamic/git.php` exactly:
`content`, `users`, `resources/forms`, `resources/users`,
`resources/preferences.yaml`, `storage/forms`, `public/assets`. Fieldsets,
blueprints and addons deliberately come from the image — a CP push of a drifted
fieldset is what corrupted replicator content in the past.

**Every step is fail-open.** If the fetch or a checkout can't run, the deploy
carries on and serves the image's content, which is what happened before this
existed. The overlay can improve on that; it can't break a deploy.

**Existing tenants are unaffected.** `steunles` and `cms.misterchameleon.nl` keep
the build commands they were configured with by hand — this does not rewrite
already-applied infrastructure. It only changes what a *new* rollout gets. To
give an existing tenant the same thing, either re-apply its infra or paste the
block from its own DEPLOY.md.

## The password is shown once

It is generated during the rollout and stored only as a Ploi secret, which the
admin cannot read back. Copy it from the result card. If you lose it, add a user
by hand in Ploi's console (`php please make:user`) or change `CP_ADMIN_PASSWORD`
in Ploi, delete the user, and redeploy — `mc:ensure-super-user` deliberately
does **not** reset an existing user's password, so changing the secret alone
does nothing.

## When it says "host pending"

Ploi assigns a hostname asynchronously and occasionally takes longer than the
polling window. Everything else is built; the rollout returns the credentials
and the repo, and says so.

To finish: wait for the host to appear in Ploi, then open the tenant's **Setup**
tab and run **Finalize** with it. That sets `statamicBaseUrl` and `APP_URL`.

## Deploy key

If the result card warns that the deploy key could not be placed, CP edits will
commit inside the container and be **lost on the next redeploy**. Fix it by
adding a key by hand:

1. GitHub → the tenant repo → Settings → Deploy keys → Add
2. tick **Allow write access**
3. put the private half in Ploi as `STATAMIC_GIT_SSH_KEY`

Then re-run the rollout — it is idempotent and will reuse what already exists.

The usual cause is a GitHub token without admin rights on the repo. A key that
is already there but **read-only** is reported explicitly rather than accepted:
delete it in GitHub and re-run.

## Tearing a site down

Nothing here is automated yet. By hand: delete the Ploi application, delete the
GitHub repo, and delete the tenant in the admin (which removes its
`tenant_domains` rows with it).
