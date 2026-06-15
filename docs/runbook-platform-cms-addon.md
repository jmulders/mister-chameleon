# RUNBOOK — Platform ↔ CMS addon architecture

_How Mister Chameleon personalises a CMS-rendered site through a thin addon, with
the platform owning the build pipeline and the decision engine. Last updated:
2026-06._

## TL;DR

The **CMS manages content**. The **platform owns the build pipeline** (slots,
templates, blocks, styling, design tokens) **and the decision engine** (which
variant a visitor sees). A thin **addon** is the runtime inside the CMS: it
renders platform-managed slots natively and asks the platform per visitor which
variant to show.

Because rendering happens *inside* the CMS (same-origin), the CMS's native Live
Preview works without any headless cross-origin bridge — which is what motivated
this design.

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│  CMS + addon (runtime)   │  POST   │  Platform (control plane)    │
│  • content + editing     │ ──────► │  • decision engine           │
│  • native render         │ /v1/slot│  • experiments + analytics   │
│  • Live Preview          │ ◄────── │  • build pipeline            │
│                          │ variant │                              │
│                          │  GET    │                              │
│                          │ ──────► │                              │
│                          │ manifest│  single source of truth      │
│                          │ ◄────── │  (slots/templates/tokens)    │
└─────────────────────────┘         └──────────────────────────────┘
```

## Components & where they live

### Platform (this repo, deploys to Vercel)

| Path | Role |
|------|------|
| `provisioning/definitions.ts` | **Single source of truth** for the canonical context slots (hero, proof, cta, feature, conversion, notification) and their fields. |
| `provisioning/tokens-css.ts` | Generates the `--mc-*` design-token CSS from `design-system/tokens`, with optional per-tenant overrides. |
| `provisioning/generators/statamic.ts` | Turns the definitions + tokens into Statamic artifacts (fieldset YAML, Antlers template, tokens CSS). One generator per CMS family. |
| `app/api/v1/provision/manifest/route.ts` | `GET` — returns the build artifacts for the requesting tenant, shaped for `tenant.cms.provider`. |
| `app/api/v1/slot/route.ts` | `POST` — resolves one slot's variant for the current visitor via the decision pipeline. |
| `app/api/snippet/decide/route.ts` | Pre-existing snippet decision endpoint (flat slot map). `/api/v1/slot` reuses the same pipeline with a cleaner per-slot contract. |

### Addon (separate repo: `mister-chameleon-statamic`)

Installed into a customer's (or our own demo) Statamic site via Composer.

| Path | Role |
|------|------|
| `src/Tags/Slot.php` | `{{ mc:slot type="hero" }}` — resolve + render a slot (edge / client / hybrid). |
| `src/Tags/Snippet.php` | `{{ mc:snippet }}` — client runtime for client/hybrid modes. |
| `src/Support/PlatformClient.php` | Calls `POST /api/v1/slot`. Caches per visitor+slot; never blocks a render. |
| `src/Support/VisitorContext.php` | Privacy-first first-party signals (anonymous fingerprint, referrer, UTM, device, bot flag). |
| `src/Console/SyncCommand.php` | `php please mc:sync` — pulls `/api/v1/provision/manifest` and writes artifacts to disk. |
| `resources/{fieldsets,views/blocks,css}` | Offline **starters** — overwritten on first `mc:sync`. |

## Authentication

Both `/api/v1/*` endpoints authenticate with the tenant's **public siteKey** via
`Authorization: Bearer <siteKey>`, resolved by `getTenantBySiteKey` against
`tenant_settings.settings->snippet->siteKey`. The siteKey is public (embedded in
markup), not a secret. Generate/rotate it in admin → Tenants → _(tenant)_ →
Snippet, or via `generateSnippetSiteKeyAction`.

## Flow 1 — Provisioning (build pipeline → CMS)

1. Edit a slot/field in `provisioning/definitions.ts` (or change a design token).
2. Deploy the platform.
3. On the CMS host: `php please mc:sync` → `GET /api/v1/provision/manifest`.
4. The platform reads `tenant.cms.provider`, runs the matching generator, and
   returns `{ cms, version, artifacts: [{ path, contents }] }`.
5. The addon writes each artifact to disk. Run `php please stache:clear` if
   templates changed.

This is why the CMS and platform never drift: definitions live in one place and
roll out on sync. Hand-editing the provisioned fieldsets/templates in the CMS is
an anti-pattern — they are regenerated.

## Flow 2 — Slot resolution (per visitor)

1. A template renders `{{ mc:slot type="hero" default="hero_default" }}`.
2. In `edge` mode the addon `POST`s to `/api/v1/slot` with the slot type, the
   CMS-authored default key, page context and the visitor signals.
3. The platform runs the decision pipeline (rules → experiments) and returns
   `{ variant_key, is_default, content, experiment }` for that slot.
4. The addon renders `content` through the provisioned block template.

Guarantees: **bots** always get the default (stable for crawlers); on **timeout
or error** the addon renders the CMS default (personalisation never blocks or
breaks a page). The `PlatformClient` caches per visitor+slot (`cache_ttl`) to
keep call volume — and rate-limit exposure — low.

### Rate-limiting note

`/api/*` is rate-limited by the app middleware, and Vercel applies edge limits to
server-origin traffic. Keep `cache_ttl` > 0 (default 60s) so `edge` mode doesn't
call `/api/v1/slot` on every render. For heavily-cached pages prefer `client`
mode (browser calls, spread across visitors) or `hybrid`.

## Modes

| Mode | Decision | Use for |
|------|----------|---------|
| `edge` | Server-side in Antlers per render | SEO, no flash |
| `client` | In the browser via the snippet | full-page caches / CDNs |
| `hybrid` | Server default + client refine | cached pages wanting first-paint personalisation |

## Generalising to other CMSes

The shared core — `/api/v1/slot`, `/api/v1/provision/manifest`, the visitor
context, the snippet — is CMS-agnostic. Only the adapter differs:

- **Server-rendered (WordPress, Statamic, Craft):** addon/plugin renders blocks
  server-side and calls `/api/v1/slot`. Native preview works. Add a generator
  in `provisioning/generators/`.
- **Headless (Sanity, Storyblok, Contentful):** ship a schema/field plugin + a
  frontend SDK that calls `/api/v1/slot`; rendering and preview happen in the
  customer's frontend via the CMS's own visual-editing bridge.

`/api/v1/provision/manifest` returns `501` for providers without a generator yet.

## Our own demo site

The demo Statamic site (`mister-chameleon-cms/`, tenant `mister-chameleon`,
provider `statamic`) installs this same addon. Config:

```dotenv
MISTER_CHAMELEON_API_URL=https://www.misterchameleon.nl
MISTER_CHAMELEON_TENANT_KEY=<siteKey from tenant_settings>
MISTER_CHAMELEON_MODE=edge
```

## Deploy & smoke test

1. Platform: `git push` → Vercel builds `/api/v1/*`.
2. CMS host: set the `.env` above, `php please mc:sync`, `php please stache:clear`.
3. Smoke test:

   ```bash
   curl -s https://www.misterchameleon.nl/api/v1/provision/manifest \
     -H "Authorization: Bearer <siteKey>" | head
   curl -s -X POST https://www.misterchameleon.nl/api/v1/slot \
     -H "Authorization: Bearer <siteKey>" -H "Content-Type: application/json" \
     -d '{"slot_type":"hero","default_variant_key":"hero_default","page":{"slug":"home","locale":"nl"},"visitor":{"is_bot":false}}'
   ```

4. Open the CMS Live Preview — slots render natively, no headless bridge.
