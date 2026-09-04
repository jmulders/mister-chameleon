# One-click demo rollout

Admin → **Tenants** → *Roll out a demo*. Type a name, press the button, wait a
couple of minutes, copy the credentials it hands back. That is the whole
process — provided the one-time setup below is in place.

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
neutral content — only the public `<slug>.demo.misterchameleon.nl` URL will not
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
3. **Neutral content** — `seed/` applied over the copy, and every collection
   entry the seed does not provide deleted. No previous tenant's content, and
   none of ours. See the seed's own README in the template repo.
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

You get back the demo URL, the CP URL, the CP e-mail and the password.

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

## Tearing a demo down

Nothing here is automated yet. By hand: delete the Ploi application, delete the
GitHub repo, and delete the tenant in the admin (which removes its
`tenant_domains` rows with it).
