/**
 * CMS tenant provisioner (server-only)
 *
 * Automates standing up a new Statamic-backed tenant on Ploi Cloud:
 *
 *   Fase 1 — generateRepoFromTemplate():
 *     Creates a per-tenant GitHub repo from the template repository via the
 *     GitHub "generate" API. Each tenant gets its OWN complete repo (full copy
 *     of the template, including the committed platform fieldsets) so content
 *     and Statamic Git Sync don't collide. This prevents the "incomplete repo"
 *     failure mode (an empty/partial repo → missing public/index.php → the app
 *     404s on everything).
 *
 *   Fase 1b — seedNeutralContentIntoRepo():
 *     A generated repo is a full copy of the template, live content included.
 *     Applies the template's seed/ over it and drops every collection entry the
 *     seed doesn't provide, so a tenant starts on a neutral site instead of
 *     inheriting ours. Only ever run against a just-generated repo.
 *
 *   Fase 2 — applyPloiInfrastructure():
 *     Creates the Ploi Cloud application via the Infrastructure-as-Code API
 *     (POST /infrastructure/apply) from a generated YAML definition that points
 *     at the per-tenant repo, sets the env secrets, build/init commands, health
 *     check and PHP extensions that we know work for these instances.
 *
 * No `mc:sync`/`please` commands are needed at deploy time: the platform
 * fieldsets are committed into the template repo and bake into the image.
 *
 * NOTE: tokens never leave the server. Callers resolve them from
 * platform-store (stored token → env fallback) and pass them in.
 */

import "server-only";

import { randomInt } from "crypto";

import { generateOpenSshKeyPair } from "./openssh-key";

const GITHUB_API = "https://api.github.com";
// Ploi Cloud API base. NB: the IaC doc page shows "api.ploi.cloud" but that host
// does not resolve ("fetch failed"); the authoritative auth doc + live resolution
// use ploi.cloud/api/v1. Override via PLOI_CLOUD_API_BASE if Ploi changes it.
const PLOI_API   = process.env["PLOI_CLOUD_API_BASE"] ?? "https://ploi.cloud/api/v1";

export interface ProvisionResult {
  ok:      boolean;
  message: string;
  detail?: string;
}

// ── Fase 1: GitHub repo from template ────────────────────────────────────────────

export interface GenerateRepoInput {
  token:         string;       // GitHub PAT (resolved by caller)
  templateOwner: string;       // e.g. "jmulders"
  templateRepo:  string;       // e.g. "mister-chameleon-cms"
  owner:         string;       // owner for the new repo (user/org)
  name:          string;       // new repo name, e.g. "mister-chameleon-cms-acme"
  privateRepo:   boolean;      // create as private
  description?:  string;
}

export interface GenerateRepoResult {
  ok:        boolean;
  message:   string;
  repoOwner?: string;
  repoName?:  string;
  fullName?:  string;
  htmlUrl?:   string;
  cloneUrl?:  string;
  alreadyExisted?: boolean;
}

/**
 * Create a new repo from the template via POST /repos/{owner}/{repo}/generate.
 * Idempotent-ish: if the target repo already exists, returns ok with
 * `alreadyExisted: true` instead of failing.
 */
export async function generateRepoFromTemplate(
  input: GenerateRepoInput,
): Promise<GenerateRepoResult> {
  const { token, templateOwner, templateRepo, owner, name, privateRepo, description } = input;

  if (!token)         return { ok: false, message: "GitHub token is not configured." };
  if (!templateOwner || !templateRepo) return { ok: false, message: "Template owner/repo is not configured." };
  if (!owner || !name) return { ok: false, message: "Target owner/name is required." };

  const headers = {
    Authorization:         `Bearer ${token}`,
    Accept:                "application/vnd.github+json",
    "Content-Type":        "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":          "mister-chameleon-provisioner",
  };

  // Pre-check: does the target repo already exist?
  const existing = await fetch(`${GITHUB_API}/repos/${owner}/${name}`, { headers, cache: "no-store" });
  if (existing.ok) {
    const body = await existing.json().catch(() => ({})) as { full_name?: string; html_url?: string; clone_url?: string };
    return {
      ok:             true,
      message:        `Repo ${owner}/${name} already exists — reusing it.`,
      repoOwner:      owner,
      repoName:       name,
      fullName:       body.full_name ?? `${owner}/${name}`,
      htmlUrl:        body.html_url,
      cloneUrl:       body.clone_url,
      alreadyExisted: true,
    };
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${templateOwner}/${templateRepo}/generate`,
    {
      method: "POST",
      headers,
      cache:  "no-store",
      body: JSON.stringify({
        owner,
        name,
        description: description ?? `Mister Chameleon CMS instance (${name})`,
        private:     privateRepo,
        include_all_branches: false,
      }),
    },
  );

  if (res.status === 201) {
    const body = await res.json().catch(() => ({})) as { full_name?: string; html_url?: string; clone_url?: string };
    return {
      ok:        true,
      message:   `Created ${owner}/${name} from ${templateOwner}/${templateRepo}.`,
      repoOwner: owner,
      repoName:  name,
      fullName:  body.full_name ?? `${owner}/${name}`,
      htmlUrl:   body.html_url,
      cloneUrl:  body.clone_url,
    };
  }

  const errBody = await res.json().catch(() => ({})) as { message?: string };
  return {
    ok:      false,
    message: errBody.message
      ? `GitHub: ${errBody.message}`
      : `GitHub API returned HTTP ${res.status}.`,
  };
}

// ── Fase 1b: seed neutral content into a freshly-generated repo ──────────────────

export interface SeedRepoInput {
  token:   string;
  owner:   string;
  name:    string;
  branch?: string;   // default "main"
  /**
   * Which seed directory in the template to apply. Both are laid out the same
   * way and go through the same apply-and-prune mechanism; they differ only in
   * what they contain.
   *
   *   "seed"       — the neutral starter: a couple of blank-slate pages.
   *   "demo-seed"  — a curated, brand-free example site.
   *
   * Defaults to "seed" so existing callers keep their behaviour.
   */
  seedRoot?: SeedRoot;
  /**
   * Pause between tree-read attempts, ms (default 2500). Exists so tests can
   * exercise the retry path without sleeping through it; production callers
   * should leave it alone.
   */
  retryDelayMs?: number;
}

export interface SeedRepoResult {
  ok:      boolean;
  message: string;
  seeded:  string[];   // repo paths written from the seed
  removed: string[];   // repo paths deleted because the seed doesn't have them
}

/** The seed directories a rollout can apply. */
export type SeedRoot = "seed" | "demo-seed";

/**
 * Subdirectories of a seed root that are applied, and where they land. A file
 * at `<root>/content/x/y.md` is written to `content/x/y.md`.
 *
 * Deliberately an allowlist: a seed root also holds a README and shell scripts
 * that must NOT be copied to the repo root.
 */
const SEED_SUBDIRS = ["content/", "public/"] as const;

/** Prefix under which a collection's ENTRIES live. */
const COLLECTIONS_PREFIX = "content/collections/";

/**
 * True for a collection ENTRY (`content/collections/pages/nl/home.md`), false
 * for a collection's CONFIGURATION (`content/collections/pages.yaml`), which
 * sits one level up and defines the collection itself.
 *
 * The distinction is the whole point of the prune step: a tenant should start
 * with the template's collection structure but none of its entries.
 */
function isCollectionEntryPath(path: string): boolean {
  if (!path.startsWith(COLLECTIONS_PREFIX)) return false;
  return path.slice(COLLECTIONS_PREFIX.length).includes("/");
}

/** Map a `<root>/...` path to where it belongs in the repo, or undefined. */
export function seedDestination(path: string, seedRoot: SeedRoot): string | undefined {
  const prefix = `${seedRoot}/`;
  for (const sub of SEED_SUBDIRS) {
    const full = prefix + sub;
    if (path.startsWith(full) && path.length > full.length) {
      return path.slice(prefix.length);
    }
  }
  return undefined;
}

interface GitTreeEntry { path?: string; type?: string; sha?: string }

/**
 * Apply one of the template's seeds to a NEWLY generated tenant repo, so the
 * tenant rolls out on its own content instead of inheriting whatever currently
 * sits in the template.
 *
 * A repo generated from a template is a full copy of it — including its live
 * content/. Two things therefore have to happen:
 *
 *   1. WRITE   everything under `<seedRoot>/content/**` → `content/**` and
 *              `<seedRoot>/public/**` → `public/**` (overwriting the copy).
 *   2. PRUNE   every collection ENTRY the seed does not provide. That covers
 *              the template's own pages in every locale AND its editorial
 *              collections (blog, case studies, testimonials, …). Collection
 *              CONFIG (`content/collections/<name>.yaml`) is left alone, so the
 *              tenant keeps the structure and loses only the content.
 *
 * Nothing here enumerates collections or pages by name: the seed directory in
 * the template repo IS the definition of what a tenant starts with. Adding a
 * file there ships it to the next tenant; an entry not represented there is
 * removed. That is what lets a second seed — the curated demo site — reuse this
 * function unchanged: `seedRoot` picks the directory, the mechanism is identical.
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 *
 * Only ever call this for a repo that was JUST generated (never one that already
 * existed), so it can never touch an existing tenant's content. On top of that,
 * this function refuses to prune anything unless it actually found seed files —
 * a template without a seed leaves the repo untouched rather than emptied.
 *
 * Best-effort and non-fatal per file: a single failed write or delete is logged
 * in the result, not thrown.
 */
export async function seedNeutralContentIntoRepo(input: SeedRepoInput): Promise<SeedRepoResult> {
  const { token, owner, name } = input;
  const branch   = input.branch   ?? "main";
  const seedRoot = input.seedRoot ?? "seed";
  const empty = { seeded: [] as string[], removed: [] as string[] };
  if (!token || !owner || !name) return { ok: false, message: "owner/name/token required", ...empty };

  const headers = {
    Authorization:          `Bearer ${token}`,
    Accept:                 "application/vnd.github+json",
    "Content-Type":         "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":           "mister-chameleon-provisioner",
  };
  const api    = `${GITHUB_API}/repos/${owner}/${name}`;
  const sleep  = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const retryDelayMs = input.retryDelayMs ?? 2500;

  // ── 1. One recursive tree read gives every path AND its blob sha ───────────
  //
  // Cheaper than walking the Contents API directory by directory, and the shas
  // come along for free — needed to overwrite a file and to delete one.
  //
  // GitHub populates a generated repo asynchronously, so retry before giving up.
  let tree: GitTreeEntry[] | null = null;
  let truncated = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${api}/git/trees/${branch}?recursive=1`, { headers, cache: "no-store" });
      if (res.ok) {
        const body = await res.json() as { tree?: GitTreeEntry[]; truncated?: boolean };
        if (Array.isArray(body.tree)) { tree = body.tree; truncated = body.truncated === true; break; }
      }
    } catch { /* retry */ }
    await sleep(retryDelayMs);
  }
  if (!tree) {
    return { ok: false, message: `Could not read the tree of ${owner}/${name} — left template content as-is.`, ...empty };
  }

  const blobs = tree.filter((e): e is { path: string; type: string; sha: string } =>
    e.type === "blob" && typeof e.path === "string" && typeof e.sha === "string");
  const shaByPath = new Map(blobs.map((b) => [b.path, b.sha]));

  // ── 2. Work out what the seed says the repo should contain ────────────────
  const seedFiles: Array<{ src: string; dest: string; sha: string }> = [];
  for (const blob of blobs) {
    const dest = seedDestination(blob.path, seedRoot);
    if (dest) seedFiles.push({ src: blob.path, dest, sha: blob.sha });
  }
  if (seedFiles.length === 0) {
    // The seed root is missing or empty — do NOT prune, or we would empty the
    // tenant instead of seeding it. This is the guard that makes a typo'd or
    // not-yet-created seedRoot harmless.
    return { ok: false, message: `No files found under ${seedRoot}/ in ${owner}/${name} — left template content as-is.`, ...empty };
  }
  if (truncated) {
    return {
      ok:      false,
      message: `Tree listing for ${owner}/${name} was truncated — refusing to prune on a partial view.`,
      ...empty,
    };
  }
  const seedDests = new Set(seedFiles.map((f) => f.dest));

  const seeded:  string[] = [];
  const removed: string[] = [];

  // ── 3. Write the seed over the copied template content ────────────────────
  for (const file of seedFiles) {
    try {
      // Blobs API (not Contents) — takes the sha we already have and has no
      // 1 MB ceiling, so a larger seed asset still copies.
      const blobRes = await fetch(`${api}/git/blobs/${file.sha}`, { headers, cache: "no-store" });
      if (!blobRes.ok) continue;
      const contentB64 = ((await blobRes.json() as { content?: string }).content ?? "").replace(/\s+/g, "");
      if (!contentB64) continue;

      const existingSha = shaByPath.get(file.dest);
      const putRes = await fetch(`${api}/contents/${file.dest}`, {
        method: "PUT",
        headers,
        cache:  "no-store",
        body: JSON.stringify({
          message: `seed(${seedRoot}): ${file.dest}`,
          content: contentB64,
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      });
      if (putRes.ok) seeded.push(file.dest);
    } catch { /* non-fatal per file */ }
  }

  // ── 4. Prune every collection entry the seed does not provide ─────────────
  for (const blob of blobs) {
    if (!isCollectionEntryPath(blob.path)) continue;
    if (seedDests.has(blob.path)) continue;
    try {
      const delRes = await fetch(`${api}/contents/${blob.path}`, {
        method: "DELETE",
        headers,
        cache:  "no-store",
        body: JSON.stringify({
          message: `seed: drop template content ${blob.path}`,
          sha:     blob.sha,
          branch,
        }),
      });
      if (delRes.ok) removed.push(blob.path);
    } catch { /* non-fatal per file */ }
  }

  return {
    ok:      seeded.length > 0,
    message: seeded.length
      ? `Applied ${seeded.length} file(s) from ${seedRoot}/; removed ${removed.length} template entr${removed.length === 1 ? "y" : "ies"}.`
      : `No files applied from ${seedRoot}/.`,
    seeded,
    removed,
  };
}

/**
 * @deprecated Renamed to seedNeutralContentIntoRepo now that it seeds navigation,
 * globals and assets too — not just pages. Kept so existing callers keep working.
 */
export const seedNeutralPagesIntoRepo = seedNeutralContentIntoRepo;

// ── Fase 2: Ploi Cloud Infrastructure-as-Code ────────────────────────────────────

export interface PloiSecret { key: string; value: string }

export interface BuildInfraInput {
  appName:        string;            // unique within the team, e.g. "mc-cms-acme"
  team:           string;            // Ploi team id or name
  repoUrl:        string;            // https://github.com/owner/name
  repoOwner:      string;
  repoName:       string;
  branch?:        string;            // default "main"
  phpVersion?:    string;            // default "8.4"
  healthCheckPath?: string;          // default "/cp/auth/login"
  secrets:        PloiSecret[];      // env vars (APP_URL, siteKey, etc.)
  domain?:        string;            // optional public domain
  /**
   * Extra build commands, appended AFTER `composer install`. Used for
   * `php artisan mc:ensure-super-user`, which needs the vendor tree to exist
   * and must run on every deploy (the container filesystem is ephemeral, so a
   * user created once would not survive the next one). Every command here must
   * be idempotent for that reason.
   */
  extraBuildCommands?: readonly string[];
}

/**
 * Build the Ploi Cloud IaC YAML for a headless Statamic instance.
 *
 * Deliberate choices, learned the hard way:
 *  - No Node.js / npm build (the CP assets ship with the package; the public
 *    site is rendered by the Next.js platform via the REST API).
 *  - No `php please mc:sync` at build/init — the fieldsets are committed in the
 *    repo and bake into the image. Build = composer install only.
 *  - Health check = /cp/auth/login (host-agnostic, always 200) — NOT /up, which
 *    Statamic's frontend catch-all can shadow.
 *  - Document root = /public (Statamic/Laravel).
 */
export function buildStatamicInfraYaml(input: BuildInfraInput): string {
  const {
    appName, team, repoUrl, repoOwner, repoName,
    branch = "main", phpVersion = "8.4",
    healthCheckPath = "/cp/auth/login", secrets, domain,
    extraBuildCommands = [],
  } = input;

  const yamlEscape = (v: string): string => {
    // Quote values containing characters that break bare YAML scalars.
    if (v === "" || /[:#\n"'{}\[\],&*?|<>=!%@`]/.test(v) || /^\s|\s$/.test(v)) {
      return JSON.stringify(v); // valid YAML double-quoted scalar
    }
    return v;
  };

  const lines: string[] = [];
  lines.push("apiVersion: v1");
  lines.push("kind: Infrastructure");
  lines.push("metadata:");
  lines.push(`  name: ${yamlEscape(appName)}`);
  lines.push(`  team: ${yamlEscape(team)}`);
  lines.push("spec:");
  lines.push("  application:");
  lines.push(`    name: ${yamlEscape(appName)}`);
  lines.push("    type: statamic");
  lines.push("    repository:");
  lines.push(`      url: ${yamlEscape(repoUrl)}`);
  lines.push(`      owner: ${yamlEscape(repoOwner)}`);
  lines.push(`      name: ${yamlEscape(repoName)}`);
  lines.push(`      branch: ${yamlEscape(branch)}`);
  lines.push("    runtime:");
  lines.push(`      php_version: ${yamlEscape(phpVersion)}`);
  lines.push("    commands:");
  lines.push("      build:");
  lines.push("        - composer install --no-interaction --optimize-autoloader --no-dev");
  for (const cmd of extraBuildCommands) lines.push(`        - ${yamlEscape(cmd)}`);
  lines.push("    settings:");
  lines.push(`      health_check_path: ${yamlEscape(healthCheckPath)}`);
  lines.push("      document_root: /public");
  lines.push("    php:");
  lines.push("      extensions:");
  for (const ext of ["gd", "intl", "zip", "exif"]) lines.push(`        - ${ext}`);

  if (domain) {
    lines.push("  domains:");
    lines.push(`    - domain: ${yamlEscape(domain)}`);
  }

  lines.push("  secrets:");
  for (const s of secrets) {
    lines.push(`    - key: ${yamlEscape(s.key)}`);
    lines.push(`      value: ${yamlEscape(s.value)}`);
  }

  return lines.join("\n") + "\n";
}

export interface ApplyInfraResult {
  ok:           boolean;
  message:      string;
  changes?:     string[];
  deploymentId?: number;
  raw?:         unknown;
}

/**
 * Apply an infrastructure YAML to Ploi Cloud.
 * `dryRun` previews changes without applying.
 */
export async function applyPloiInfrastructure(opts: {
  token:       string;
  yaml:        string;
  dryRun?:     boolean;
  autoDeploy?: boolean;
}): Promise<ApplyInfraResult> {
  const { token, yaml, dryRun = false, autoDeploy = true } = opts;
  if (!token) return { ok: false, message: "Ploi Cloud API token is not configured." };

  const params = new URLSearchParams();
  if (dryRun)       params.set("dry_run", "true");
  if (!autoDeploy)  params.set("auto_deploy", "false");
  const qs = params.toString() ? `?${params.toString()}` : "";

  let res: Response;
  try {
    res = await fetch(`${PLOI_API}/infrastructure/apply${qs}`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/yaml",
        Accept:         "application/json",
        "User-Agent":   "mister-chameleon-provisioner",
      },
      body:  yaml,
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, message: `Network error reaching Ploi Cloud: ${err instanceof Error ? err.message : String(err)}` };
  }

  const body = await res.json().catch(() => ({})) as {
    success?: boolean;
    changes?: string[];
    errors?: string[];
    deployment_id?: number;
    message?: string;
  };

  if (!res.ok || body.success === false) {
    const err = body.errors?.length ? body.errors.join("; ") : body.message;
    return { ok: false, message: err ?? `Ploi Cloud returned HTTP ${res.status}.`, raw: body };
  }

  return {
    ok:           true,
    message:      dryRun ? "Dry run OK — no changes applied." : "Infrastructure applied.",
    changes:      body.changes ?? [],
    deploymentId: body.deployment_id,
    raw:          body,
  };
}

// ── sites.yaml: point the primary site at the tenant's own domain ────────────────

/**
 * Best-effort update of `resources/sites.yaml` in a per-tenant repo so the
 * primary (nl) site URL points at the tenant's own public domain instead of the
 * template default (www.misterchameleon.nl). Uses the GitHub Contents API
 * (GET to read the sha + content, PUT to commit). Non-fatal: returns
 * `changed:false` if the file/pattern isn't found.
 */
export async function updateRepoSitesYaml(opts: {
  token: string;
  owner: string;
  repo: string;
  primarySiteUrl: string;   // e.g. "https://www.steunles.nl"
  branch?: string;
}): Promise<{ ok: boolean; message: string; changed?: boolean }> {
  const { token, owner, repo, primarySiteUrl, branch = "main" } = opts;
  if (!token) return { ok: false, message: "GitHub token is not configured." };

  const headers = {
    Authorization:          `Bearer ${token}`,
    Accept:                 "application/vnd.github+json",
    "Content-Type":         "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":           "mister-chameleon-provisioner",
  };
  const path = "resources/sites.yaml";
  const url  = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;

  const getRes = await fetch(url, { headers, cache: "no-store" });
  if (!getRes.ok) {
    return { ok: true, changed: false, message: `sites.yaml not read (HTTP ${getRes.status}); skipped.` };
  }
  const file = await getRes.json().catch(() => ({})) as { content?: string; sha?: string };
  if (!file.content || !file.sha) return { ok: true, changed: false, message: "sites.yaml empty; skipped." };

  const current = Buffer.from(file.content, "base64").toString("utf8");
  // Replace the template default URL wherever it appears as a site `url:`.
  const updated = current.replace(
    /url:\s*['"]?https?:\/\/(www\.)?misterchameleon\.nl['"]?/g,
    `url: '${primarySiteUrl}'`,
  );
  if (updated === current) {
    return { ok: true, changed: false, message: "sites.yaml already points elsewhere; no change." };
  }

  const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      message: `chore(sites): point primary site at ${primarySiteUrl}`,
      content: Buffer.from(updated, "utf8").toString("base64"),
      sha:     file.sha,
      branch,
    }),
  });
  if (!putRes.ok) {
    const b = await putRes.json().catch(() => ({})) as { message?: string };
    return { ok: false, message: b.message ?? `Failed to commit sites.yaml (HTTP ${putRes.status}).` };
  }
  return { ok: true, changed: true, message: `sites.yaml updated → ${primarySiteUrl}.` };
}

/** Strip protocol/path from a host string → bare hostname. */
export function bareHost(input: string): string {
  return input.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/\/$/, "");
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

/** Slugify a tenant name/id into a safe repo/app suffix. */
export function provisioningSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "tenant";
}

// ── Fase 1c: write-enabled deploy key for CP push-back ───────────────────────────

export interface DeployKeyResult {
  ok:         boolean;
  message:    string;
  /** OpenSSH private key — set ONLY when a key was just generated. */
  privateKey?: string;
  /** True when a key with this title was already on the repo and was reused. */
  reused?:    boolean;
}

/** Title used for the key we manage, so repeat runs can recognise it. */
export const DEPLOY_KEY_TITLE = "ploi-cms-content";

/**
 * Put a WRITE-enabled deploy key on a per-tenant repo, so Statamic's Git
 * integration can push CP content edits back.
 *
 * Without this, `STATAMIC_GIT_PUSH=true` commits into the container's ephemeral
 * filesystem and the edits are LOST on the next deploy — the failure mode that
 * made a CP site-URL edit silently diverge from the repo. It used to be a manual
 * checklist item at the end of provisioning; this closes it.
 *
 * ─── Idempotence, and its one real limitation ────────────────────────────────
 *
 * GitHub only ever returns a deploy key's PUBLIC half, so a key we created on an
 * earlier run cannot have its private half recovered. On a repeat run we
 * therefore REUSE the existing key (`reused: true`, no `privateKey`) and leave
 * the Ploi secret alone — which is correct, because that secret already holds
 * the matching private half. Rotating would mean deleting and recreating, and
 * that would break push-back for the window between the two calls.
 *
 * Never throws. A token without `admin:public_key`/repo-admin scope yields
 * `ok: false` with a readable message; the caller logs it and carries on, since
 * a demo without push-back is still a working demo.
 */
export async function ensureRepoDeployKey(opts: {
  token:  string;
  owner:  string;
  repo:   string;
  title?: string;
}): Promise<DeployKeyResult> {
  const { token, owner, repo } = opts;
  const title = opts.title ?? DEPLOY_KEY_TITLE;
  if (!token || !owner || !repo) return { ok: false, message: "owner/repo/token required" };

  const headers = {
    Authorization:          `Bearer ${token}`,
    Accept:                 "application/vnd.github+json",
    "Content-Type":         "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent":           "mister-chameleon-provisioner",
  };
  const keysUrl = `${GITHUB_API}/repos/${owner}/${repo}/keys`;

  // ── Already there? ────────────────────────────────────────────────────────
  try {
    const listRes = await fetch(keysUrl, { headers, cache: "no-store" });
    if (listRes.ok) {
      const keys = await listRes.json() as Array<{ title?: string; read_only?: boolean }>;
      const existing = Array.isArray(keys) ? keys.find((k) => k.title === title) : undefined;
      if (existing) {
        return existing.read_only === true
          ? { ok: false, reused: true, message: `Deploy key "${title}" exists but is READ-ONLY — remove it in GitHub and re-run, or CP edits will not push back.` }
          : { ok: true,  reused: true, message: `Deploy key "${title}" already present (write) — reused; the Ploi secret already holds its private half.` };
      }
    }
  } catch { /* fall through to create */ }

  // ── Generate an ed25519 pair and register the public half ─────────────────
  let publicKey: string;
  let privateKey: string;
  try {
    ({ publicKey, privateKey } = generateOpenSshKeyPair(title));
  } catch (err) {
    return { ok: false, message: `Could not generate a deploy key: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const res = await fetch(keysUrl, {
      method: "POST",
      headers,
      cache:  "no-store",
      body: JSON.stringify({ title, key: publicKey, read_only: false }),
    });
    if (res.status === 201) {
      return { ok: true, message: `Deploy key "${title}" added with write access.`, privateKey };
    }
    const body = await res.json().catch(() => ({})) as { message?: string };
    return {
      ok: false,
      message: `GitHub refused the deploy key (HTTP ${res.status}${body.message ? `: ${body.message}` : ""}). `
        + "The token needs admin rights on the repo. CP edits will not push back until a write deploy key is added by hand.",
    };
  } catch (err) {
    return { ok: false, message: `Network error adding the deploy key: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── Fase 2b: discover the host Ploi assigned ─────────────────────────────────────

export interface PloiHostResult {
  ok:      boolean;
  message: string;
  /** Bare hostname, e.g. "mc-cms-acme-ams1-t.preview.ploi.it". */
  host?:   string;
}

/**
 * Fields Ploi has been seen to carry the assigned hostname in, most specific
 * first. Kept broad on purpose: the exact shape is not contractual, a rename
 * would otherwise silently break the rollout, and the caller already has a
 * correct fallback for "host unknown" — so guessing wide costs nothing and a
 * miss costs one manual paste.
 */
const PLOI_HOST_FIELDS = [
  "default_domain", "domain", "hostname", "fqdn", "host", "url", "preview_url", "app_url",
] as const;

/** Pull the first usable hostname out of an application object. */
function readPloiHost(app: Record<string, unknown>): string | undefined {
  for (const field of PLOI_HOST_FIELDS) {
    const value = app[field];
    if (typeof value === "string" && value.trim()) {
      const host = bareHost(value);
      if (host.includes(".")) return host;
    }
  }
  // `domains` may be a list of strings or of objects.
  const domains = app["domains"];
  if (Array.isArray(domains)) {
    for (const entry of domains) {
      const raw = typeof entry === "string"
        ? entry
        : (entry && typeof entry === "object" ? (entry as Record<string, unknown>)["domain"] : undefined);
      if (typeof raw === "string" && raw.trim()) {
        const host = bareHost(raw);
        if (host.includes(".")) return host;
      }
    }
  }
  return undefined;
}

/**
 * Ask Ploi which host it gave an application.
 *
 * A freshly applied app has no host for the first minute or so, which is why
 * this is polled rather than read once — see `pollPloiApplicationHost`.
 *
 * Never throws: an unreachable API, an unexpected body, or an app that simply
 * isn't ready yet all come back as `ok:false` with a message.
 */
export async function fetchPloiApplicationHost(opts: {
  token:   string;
  appName: string;
}): Promise<PloiHostResult> {
  const { token, appName } = opts;
  if (!token)   return { ok: false, message: "Ploi Cloud API token is not configured." };
  if (!appName) return { ok: false, message: "appName is required." };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept:        "application/json",
    "User-Agent":  "mister-chameleon-provisioner",
  };

  let body: unknown;
  try {
    const res = await fetch(`${PLOI_API}/applications`, { headers, cache: "no-store" });
    if (!res.ok) return { ok: false, message: `Ploi returned HTTP ${res.status} listing applications.` };
    body = await res.json();
  } catch (err) {
    return { ok: false, message: `Network error reaching Ploi: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Ploi wraps collections in { data: [...] }; tolerate a bare array too.
  const list = Array.isArray(body)
    ? body
    : (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
        ? (body as { data: unknown[] }).data
        : []);

  const app = list.find((a): a is Record<string, unknown> =>
    Boolean(a) && typeof a === "object" && (a as Record<string, unknown>)["name"] === appName);
  if (!app) return { ok: false, message: `Application '${appName}' not found in the Ploi listing yet.` };

  const host = readPloiHost(app);
  if (!host) return { ok: false, message: `Application '${appName}' has no host assigned yet.` };
  return { ok: true, host, message: `Ploi assigned ${host}.` };
}

/**
 * Poll until Ploi reports a host, or the attempts run out.
 *
 * Returning `ok:false` is a normal outcome, not an error: the caller turns it
 * into a "host pending" result the operator can finish later, so a slow Ploi
 * never leaves a half-provisioned demo with no way forward.
 */
export async function pollPloiApplicationHost(opts: {
  token:      string;
  appName:    string;
  attempts?:  number;   // default 8
  intervalMs?: number;  // default 15_000
}): Promise<PloiHostResult> {
  const attempts   = opts.attempts   ?? 8;
  const intervalMs = opts.intervalMs ?? 15_000;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let last: PloiHostResult = { ok: false, message: "No attempt made." };
  for (let i = 0; i < attempts; i++) {
    last = await fetchPloiApplicationHost({ token: opts.token, appName: opts.appName });
    if (last.ok) return last;
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return {
    ok: false,
    message: `Ploi did not report a host for '${opts.appName}' within ${attempts} attempt(s): ${last.message}`,
  };
}

// ── Demo rollout: names, credentials and env ─────────────────────────────────────

/** Everything a demo rollout needs to name consistently, derived from one slug. */
export interface DemoNaming {
  slug:     string;
  repoName: string;
  appName:  string;
  /** Public demo host under the wildcard, e.g. "acme.demo.misterchameleon.nl". */
  demoHost: string;
  cpEmail:  string;
}

/** Parent zone of the demo wildcard — a single `*` CNAME covers every demo. */
export const DEMO_DOMAIN_SUFFIX = "demo.misterchameleon.nl";

/** Derive every name a demo rollout uses from the tenant slug. */
export function demoNaming(tenantId: string, templateRepo: string): DemoNaming {
  const slug = provisioningSlug(tenantId);
  return {
    slug,
    repoName: `${templateRepo}-${slug}`,
    appName:  `mc-cms-${slug}`,
    demoHost: `${slug}.${DEMO_DOMAIN_SUFFIX}`,
    cpEmail:  `demo+${slug}@misterchameleon.nl`,
  };
}

/**
 * A password an operator can read out loud once and paste — no ambiguous
 * characters, and enough entropy that a public demo CP is not guessable
 * (4 groups × 5 chars from a 31-char alphabet ≈ 99 bits).
 */
export function generateDemoPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no i/l/o/0/1
  const group = () => Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return [group(), group(), group(), group()].join("-");
}

export interface DemoSecretsInput {
  /** The platform itself — where the CMS calls back to, and previews render. */
  platformUrl: string;
  /** The CP's own host. Unknown on the first apply; corrected in finalize. */
  appUrl:      string;
  appKey:      string;
  siteKey:     string;
  tenantId:    string;
  cpEmail:     string;
  cpPassword:  string;
  /** Private half of the write deploy key, when one could be created. */
  gitSshKey?:  string;
}

/**
 * The full Ploi secret set for a demo instance.
 *
 * Pure, so the composition is unit-testable — in particular the two things that
 * were previously hand-set and easy to get wrong:
 *
 *   APP_URL must be the CP's OWN host, not the platform. Pointing it at the
 *   platform makes the CP generate links and redirects to the wrong origin. It
 *   cannot be right on the first apply (Ploi hasn't assigned a host yet), so it
 *   starts at the platform URL and finalize re-applies with the real host.
 *
 *   MISTER_CHAMELEON_API_URL and MC_PREVIEW_FRONTEND_URL stay the platform —
 *   they are where the add-on and Live Preview talk TO, which is a different
 *   thing from where the CP lives.
 */
export function buildDemoSecrets(input: DemoSecretsInput): PloiSecret[] {
  const { platformUrl, appUrl, appKey, siteKey, tenantId, cpEmail, cpPassword, gitSshKey } = input;
  return [
    { key: "APP_ENV",   value: "production" },
    { key: "APP_DEBUG", value: "false" },
    { key: "APP_KEY",   value: appKey },
    { key: "APP_URL",   value: appUrl },
    { key: "STATAMIC_API_ENABLED", value: "true" },
    // Pro is REQUIRED: navigations are a Statamic Pro feature. Without it the
    // /api/navs/{handle}/tree endpoint 404s and the site renders no nav.
    { key: "STATAMIC_PRO_ENABLED", value: "true" },
    { key: "MISTER_CHAMELEON_API_URL",    value: platformUrl },
    { key: "MISTER_CHAMELEON_TENANT_KEY", value: siteKey },
    { key: "MC_PREVIEW_FRONTEND_URL",     value: platformUrl },
    { key: "CP_ENABLED",            value: "true" },
    { key: "SESSION_DRIVER",        value: "file" },
    { key: "MISTER_CHAMELEON_MODE", value: "edge" },
    // Read by `php artisan mc:ensure-super-user` in the build commands — without
    // these a provisioned instance has no users at all and nobody can log in.
    { key: "CP_ADMIN_EMAIL",    value: cpEmail },
    { key: "CP_ADMIN_PASSWORD", value: cpPassword },
    // Statamic Git integration — persists CP content edits back to the repo.
    { key: "STATAMIC_GIT_ENABLED",        value: "true" },
    { key: "STATAMIC_GIT_AUTOMATIC",      value: "true" },
    { key: "STATAMIC_GIT_PUSH",           value: "true" },
    { key: "STATAMIC_GIT_DISPATCH_DELAY", value: "5" },
    { key: "STATAMIC_GIT_USER_NAME",      value: `Mister Chameleon CMS (${tenantId})` },
    { key: "STATAMIC_GIT_USER_EMAIL",     value: `cms+${tenantId}@misterchameleon.nl` },
    // The private half of the write deploy key. Without it STATAMIC_GIT_PUSH
    // commits into the ephemeral container and CP edits are lost on redeploy.
    ...(gitSshKey ? [{ key: "STATAMIC_GIT_SSH_KEY", value: gitSshKey }] : []),
  ];
}
