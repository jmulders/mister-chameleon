/**
 * push-block-fieldsets-to-repo.mjs
 * ---------------------------------------------------------------------------
 * Pushes the floating-contact + hero-carousel CMS fieldsets to one tenant's
 * CMS repo as a SINGLE commit (Git Data API). Use for a tenant whose CMS repo
 * is separate from the template — e.g. misterchameleon.nl deploys from
 * jmulders/mister-chameleon-cms-another-statamic.
 *
 * Pushed (read from your local CMS checkout SRC):
 *   - resources/fieldsets/mrc_floating_contact.yaml   (new — floating contact)
 *   - resources/fieldsets/mc_page_blocks.yaml         (adds floating_contact set)
 *   - resources/fieldsets/mrc_hero_variant.yaml       (carousel option + slides)
 *
 * After it runs, redeploy that tenant's app (Ploi → Deploy now). The fieldsets
 * bake into the image (mc:sync is intentionally disabled), so a redeploy is what
 * makes the new block + hero variant authorable.
 *
 * Usage:
 *   GITHUB_TOKEN=... REPO=jmulders/mister-chameleon-cms-another-statamic \
 *     node scripts/push-block-fieldsets-to-repo.mjs
 *
 * Env:
 *   GITHUB_TOKEN  token with contents:write on REPO         (required)
 *   REPO          owner/name of the target tenant CMS repo  (required)
 *   BRANCH        target branch                             (default: main)
 *   SRC           local CMS checkout to read files from
 *                 (default: ../mister-chameleon-cms-app)
 *   DRY_RUN=1     list what would be pushed, write nothing
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;
const BRANCH = process.env.BRANCH || "main";
const SRC = path.resolve(REPO_ROOT, process.env.SRC || "../mister-chameleon-cms-app");
const DRY = process.env.DRY_RUN === "1";

if (!TOKEN || !REPO) {
  console.error("✗ Set GITHUB_TOKEN and REPO (owner/name).");
  process.exit(1);
}

const FILES = [
  "resources/fieldsets/mrc_floating_contact.yaml",
  "resources/fieldsets/mc_page_blocks.yaml",
  "resources/fieldsets/mrc_hero_variant.yaml",
];

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
  for (const f of FILES) {
    if (!existsSync(path.join(SRC, f))) {
      console.error(`✗ ${f} not found in ${SRC}`);
      process.exit(1);
    }
  }
  console.log(`${DRY ? "[dry] " : ""}Committing ${FILES.length} fieldset(s) → ${REPO}@${BRANCH}`);
  for (const f of FILES) console.log(`   • ${f}`);
  if (DRY) return;

  const ref = await gh("GET", `${API}/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await gh("GET", `${API}/git/commits/${baseCommitSha}`);

  const tree = [];
  for (const rel of FILES) {
    const buf = await readFile(path.join(SRC, rel));
    const blob = await gh("POST", `${API}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" });
    tree.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await gh("POST", `${API}/git/trees`, { base_tree: baseCommit.tree.sha, tree });
  const commit = await gh("POST", `${API}/git/commits`, {
    message: "feat(cms): floating contact set + hero carousel layout/slides",
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
