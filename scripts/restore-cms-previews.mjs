/**
 * restore-cms-previews.mjs
 * ---------------------------------------------------------------------------
 * Emergency restore: undoes the second asset container that broke the CP
 * (UndefinedContainerException — Statamic can't pick a default container for
 * Assets fields when more than one container exists).
 *
 * In ONE atomic commit it:
 *   - DELETES content/assets/set_previews.yaml   (removes the 2nd container)
 *   - restores config/statamic/assets.php         (set_preview_images -> assets)
 *     read from your local CMS checkout (SRC, already reverted).
 *
 * Leaves the unused set_previews disk + PNGs in place (harmless). After it runs,
 * redeploy the tenant's app — the CP works again (no previews yet).
 *
 * Usage:
 *   GITHUB_TOKEN=... REPO=jmulders/mister-chameleon-cms-another-statamic \
 *     node scripts/restore-cms-previews.mjs
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;
const BRANCH = process.env.BRANCH || "main";
const SRC = path.resolve(REPO_ROOT, process.env.SRC || "../mister-chameleon-cms-app");

if (!TOKEN || !REPO) {
  console.error("✗ Set GITHUB_TOKEN and REPO (owner/name).");
  process.exit(1);
}

const PUT_FILES = ["config/statamic/assets.php"];
const DELETE_PATHS = ["content/assets/set_previews.yaml"];

const API = `https://api.github.com/repos/${REPO}`;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

async function gh(method, url, body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${url.replace(API, "")} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  const ref = await gh("GET", `${API}/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await gh("GET", `${API}/git/commits/${baseCommitSha}`);

  const tree = [];
  for (const rel of PUT_FILES) {
    const buf = await readFile(path.join(SRC, rel));
    const blob = await gh("POST", `${API}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" });
    tree.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  }
  for (const rel of DELETE_PATHS) {
    tree.push({ path: rel, mode: "100644", type: "blob", sha: null }); // null sha = delete
  }

  const newTree = await gh("POST", `${API}/git/trees`, { base_tree: baseCommit.tree.sha, tree });
  const commit = await gh("POST", `${API}/git/commits`, {
    message: "fix(cms): remove second asset container that broke the CP (restore single-container default)",
    tree: newTree.sha,
    parents: [baseCommitSha],
  });
  await gh("PATCH", `${API}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { sha: commit.sha });

  console.log(`✓ Restored in commit ${commit.sha.slice(0, 7)} on ${REPO}@${BRANCH}. Now redeploy this tenant's app.`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
