/**
 * apply-previews-final.mjs
 * ---------------------------------------------------------------------------
 * Final, reproducible set-preview setup for one tenant CMS repo, in ONE commit:
 *   PUT  config/filesystems.php            (set_previews disk removed — cleanup)
 *   PUT  config/statamic/assets.php        (set_preview_images -> assets/set-previews)
 *   PUT  app/Providers/AppServiceProvider.php
 *        (boot-time copy of public/set-previews/*.png into the assets volume)
 *   DEL  content/assets/set_previews.yaml  (only if still present — kills the
 *        second container that broke the CP)
 *
 * Files are read from your local CMS checkout (SRC) which already has them.
 * After it runs, redeploy the tenant's app: the deploy's artisan commands copy
 * the previews into the volume, so the set-picker images appear automatically —
 * no manual upload, no second container.
 *
 * Usage:
 *   GITHUB_TOKEN=... REPO=jmulders/mister-chameleon-cms \
 *     node scripts/apply-previews-final.mjs
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

const PUT_FILES = [
  "config/filesystems.php",
  "config/statamic/assets.php",
  "app/Providers/AppServiceProvider.php",
];
const DELETE_IF_PRESENT = ["content/assets/set_previews.yaml"];

const API = `https://api.github.com/repos/${REPO}`;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

async function gh(method, url, body, allow404 = false) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 404 && allow404) return null;
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
    console.log(`  put    ${rel}`);
  }
  for (const rel of DELETE_IF_PRESENT) {
    const existing = await gh("GET", `${API}/contents/${encodeURI(rel)}?ref=${encodeURIComponent(BRANCH)}`, null, true);
    if (existing) {
      tree.push({ path: rel, mode: "100644", type: "blob", sha: null });
      console.log(`  delete ${rel}`);
    } else {
      console.log(`  skip   ${rel} (already absent)`);
    }
  }

  const newTree = await gh("POST", `${API}/git/trees`, { base_tree: baseCommit.tree.sha, tree });
  const commit = await gh("POST", `${API}/git/commits`, {
    message: "feat(cms): reproducible set previews (boot-copy into assets volume) + cleanup",
    tree: newTree.sha,
    parents: [baseCommitSha],
  });
  await gh("PATCH", `${API}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { sha: commit.sha });

  console.log(`\n✓ Committed ${commit.sha.slice(0, 7)} to ${REPO}@${BRANCH}. Now redeploy this tenant's app.`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
