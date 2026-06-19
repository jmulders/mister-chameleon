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
