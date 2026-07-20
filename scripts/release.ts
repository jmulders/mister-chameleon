#!/usr/bin/env node
/**
 * scripts/release.ts
 *
 * Release management for Mister Chameleon.
 *
 * ─── What this does ───────────────────────────────────────────────────────────
 *
 *   1. Determines the next version based on conventional commit messages
 *      or a provided --version argument.
 *   2. Updates version in package.json.
 *   3. Generates a CHANGELOG entry (commit messages since last tag).
 *   4. Creates a git tag (e.g. v1.2.3).
 *   5. Optionally pushes the tag to origin.
 *   6. Optionally creates a GitHub Release via the API.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   # Dry run — print what the next version would be
 *   node --experimental-strip-types scripts/release.ts --dry-run
 *
 *   # Bump patch (default)
 *   node --experimental-strip-types scripts/release.ts
 *
 *   # Bump minor
 *   node --experimental-strip-types scripts/release.ts --bump=minor
 *
 *   # Specific version
 *   node --experimental-strip-types scripts/release.ts --version=1.5.0
 *
 *   # Full production release (used by production.yml CI)
 *   node --experimental-strip-types scripts/release.ts --create-tag --push --github-release
 *
 * ─── Version bump rules (conventional commits) ───────────────────────────────
 *
 *   BREAKING CHANGE in commit body  →  major bump
 *   feat: prefix                    →  minor bump
 *   fix: / chore: / other           →  patch bump
 *
 *   Explicit --bump=<major|minor|patch> overrides auto-detection.
 */

import fs   from "node:fs";
import path from "node:path";
import https from "node:https";

import { log }           from "./lib/logger.ts";
import { run, capture }  from "./lib/exec.ts";
import { PROJECT_ROOT }  from "./lib/env.ts";

// ── CLI args ───────────────────────────────────────────────────────────────────

const args            = process.argv.slice(2);
const dryRun          = args.includes("--dry-run");
const createTag       = args.includes("--create-tag");
const pushTag         = args.includes("--push");
const githubRelease   = args.includes("--github-release");
const manualVersion   = args.find((a) => a.startsWith("--version="))?.slice(10);
const manualBump      = args.find((a) => a.startsWith("--bump="))?.slice(7) as "major" | "minor" | "patch" | undefined;

// ── Version helpers ────────────────────────────────────────────────────────────

function parseVersion(v: string): [number, number, number] {
  const parts = v.replace(/^v/, "").split(".");
  return [parseInt(parts[0]!, 10), parseInt(parts[1]!, 10), parseInt(parts[2]!, 10)];
}

function bump(current: string, type: "major" | "minor" | "patch"): string {
  const [maj, min, pat] = parseVersion(current);
  if (type === "major") return `${maj + 1}.0.0`;
  if (type === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

/** Determine bump type from commit messages since last tag. */
function detectBumpType(commits: string[]): "major" | "minor" | "patch" {
  if (commits.some((c) => c.includes("BREAKING CHANGE"))) return "major";
  if (commits.some((c) => /^feat(\(.+\))?!?:/.test(c))) return "minor";
  return "patch";
}

// ── Changelog builder ─────────────────────────────────────────────────────────

function buildChangelog(version: string, commits: string[], date: string): string {
  const categories: Record<string, string[]> = {
    "Features":       [],
    "Bug Fixes":      [],
    "Performance":    [],
    "Refactoring":    [],
    "Documentation":  [],
    "Other":          [],
  };

  for (const msg of commits) {
    if (/^feat/i.test(msg))       categories["Features"]!.push(msg);
    else if (/^fix/i.test(msg))   categories["Bug Fixes"]!.push(msg);
    else if (/^perf/i.test(msg))  categories["Performance"]!.push(msg);
    else if (/^refactor/i.test(msg)) categories["Refactoring"]!.push(msg);
    else if (/^docs/i.test(msg))  categories["Documentation"]!.push(msg);
    else                          categories["Other"]!.push(msg);
  }

  const lines: string[] = [`## v${version} — ${date}`, ""];

  for (const [cat, msgs] of Object.entries(categories)) {
    if (msgs.length === 0) continue;
    lines.push(`### ${cat}`);
    for (const m of msgs) lines.push(`- ${m}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ── GitHub release via API ────────────────────────────────────────────────────

async function createGithubRelease(
  tag: string,
  body: string,
): Promise<void> {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    log.warn("GITHUB_TOKEN not set — skipping GitHub Release creation");
    return;
  }

  // Derive repo from git remote.
  const remoteUrl = capture("git remote get-url origin", { verbose: false, ignoreErrors: true });
  const repoMatch = remoteUrl.match(/github\.com[:/](.+\/.+?)(?:\.git)?$/);
  if (!repoMatch) {
    log.warn("Could not parse GitHub repo from remote URL — skipping GitHub Release");
    return;
  }
  const [owner, repo] = repoMatch[1]!.split("/") as [string, string];

  const payload = JSON.stringify({ tag_name: tag, name: tag, body, draft: false, prerelease: false });
  const options = {
    hostname: "api.github.com",
    path:     `/repos/${owner}/${repo}/releases`,
    method:   "POST",
    headers:  {
      "Content-Type":    "application/json",
      "User-Agent":      "mister-chameleon-release-script",
      Authorization:     `Bearer ${token}`,
      "Content-Length":  Buffer.byteLength(payload),
    },
  };

  await new Promise<void>((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => {
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
          resolve();
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.section("Mister Chameleon — Release");

  // ── Read current version from package.json ─────────────────────────────────

  const pkgPath = path.join(PROJECT_ROOT, "package.json");
  const pkg     = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string };

  // ── Current version comes from the latest git TAG, not package.json ─────────
  //
  // The tag is the immutable record of what was actually released. package.json
  // drifts: this job commits the version bump and tries to push it to main, but
  // branch protection blocks a CI push to main, so the bump never lands there —
  // package.json stays at an old version while the tag moves on. Basing the next
  // version on that stale package.json re-computes a version that already has a
  // tag, and `git tag` fails with "tag vX already exists" (observed 19 Jul 2026:
  // package.json 0.1.0, tag v0.2.0 already pushed → every release collided).
  //
  // Reading the latest tag makes releases idempotent-by-design: v0.2.0 exists →
  // next is v0.3.0, regardless of what package.json says.
  //
  // Use the HIGHEST version tag across ALL tags — NOT `git describe`, which only
  // finds tags reachable from HEAD. Because the bump commit never lands on main
  // (branch protection), the previous release's tag points at an orphan commit
  // that isn't in main's history, so `git describe` returns nothing and we fell
  // straight back to the stale package.json — recomputing the very tag that
  // already exists. `git tag --sort=-v:refname` is reachability-independent, so
  // it always sees v0.2.0 and the next release becomes v0.3.0.
  const lastTag = capture("git tag -l 'v*' --sort=-v:refname | head -1", { verbose: false }).trim();
  const current = lastTag ? lastTag.replace(/^v/, "") : (pkg.version ?? "0.0.0");
  log.info(`Current version: v${current}${lastTag ? " (from git tag)" : " (from package.json — no tags yet)"}`);

  // ── Get commits since last tag ─────────────────────────────────────────────

  let commits: string[] = [];
  try {
    const range      = lastTag ? `${lastTag}..HEAD` : "HEAD";
    const commitLog  = capture(`git log ${range} --pretty=format:"%s"`, { verbose: false });
    commits          = commitLog.split("\n").filter(Boolean);
    log.info(`Commits since ${lastTag || "beginning"}: ${commits.length}`);
  } catch {
    log.warn("Could not read git log — continuing without commit history");
  }

  // ── Determine next version ─────────────────────────────────────────────────

  let nextVersion: string;
  if (manualVersion) {
    nextVersion = manualVersion.replace(/^v/, "");
    log.info(`Manual version: v${nextVersion}`);
  } else {
    const bumpType  = manualBump ?? detectBumpType(commits);
    nextVersion     = bump(current, bumpType);
    log.info(`Bump type: ${bumpType} → v${nextVersion}`);
  }

  const tagName = `v${nextVersion}`;
  const today   = new Date().toISOString().slice(0, 10);
  const changelog = buildChangelog(nextVersion, commits, today);

  if (dryRun) {
    log.warn(`DRY RUN — would create: ${tagName}`);
    log.info(`Changelog preview:\n${changelog}`);
    return;
  }

  // ── Update package.json ────────────────────────────────────────────────────

  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  log.success(`package.json updated: ${nextVersion}`);

  // ── Append to CHANGELOG.md ─────────────────────────────────────────────────

  const changelogPath = path.join(PROJECT_ROOT, "CHANGELOG.md");
  const existing      = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
  const header        = "# Changelog\n\n";
  const newContent    = existing.startsWith("# Changelog")
    ? existing.replace("# Changelog\n\n", `${header}${changelog}\n`)
    : `${header}${changelog}\n${existing}`;
  fs.writeFileSync(changelogPath, newContent, "utf8");
  log.success("CHANGELOG.md updated");

  // ── Stage and commit version bump ─────────────────────────────────────────

  run(`git add ${pkgPath} ${changelogPath}`, { cwd: PROJECT_ROOT });
  run(`git commit -m "chore(release): v${nextVersion}"`, { cwd: PROJECT_ROOT });
  log.success("Version bump committed");

  // ── Create git tag ─────────────────────────────────────────────────────────

  if (createTag) {
    run(`git tag -a ${tagName} -m "Release ${tagName}"`, { cwd: PROJECT_ROOT });
    log.success(`Git tag created: ${tagName}`);
  }

  // ── Push ──────────────────────────────────────────────────────────────────────

  if (pushTag && createTag) {
    // The tag always pushes — tags bypass branch protection.
    run(`git push origin ${tagName}`, { cwd: PROJECT_ROOT });
    log.success(`Tag pushed: ${tagName}`);

    // The version-bump commit to main is BEST-EFFORT. Branch protection blocks a
    // direct CI push to main, so this usually fails — and that must not fail the
    // release: the tag above and the GitHub release below are the source of truth.
    // (Before this was fatal, `git push` failed on every release even when the tag
    // and release were fine.) The cost is that package.json / CHANGELOG on main
    // stay informational; the tag is the real version.
    run("git push", { cwd: PROJECT_ROOT, ignoreErrors: true });
  }

  // ── GitHub Release ─────────────────────────────────────────────────────────

  if (githubRelease && createTag) {
    await createGithubRelease(tagName, changelog);
    log.success(`GitHub Release created: ${tagName}`);
  }

  log.section("Release Complete");
  log.success(`Released: ${tagName}`);
}

main().catch((err) => {
  log.error("Release failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
