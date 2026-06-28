/**
 * push-previews-fix-to-repo.mjs
 * ---------------------------------------------------------------------------
 * Pushes the COMPLETE set-picker-preview change set to one tenant CMS repo as a
 * SINGLE atomic commit (via the GitHub Git Data API). Use this for a tenant
 * whose CMS repo did not receive the earlier commits — e.g. misterchameleon.nl
 * deploys from jmulders/mister-chameleon-cms-another-statamic, a separate repo
 * from steunles (jmulders/mister-chameleon-cms).
 *
 * Pushed (read from your local CMS checkout SRC — the repo that already has the
 * fix), all in one commit so auto-deploy fires at most once:
 *   - config/filesystems.php                  (set_previews disk)
 *   - config/statamic/assets.php              (set_preview_images -> set_previews)
 *   - content/assets/set_previews.yaml        (new asset container)
 *   - resources/fieldsets/mc_page_blocks.yaml (palette with icon/instructions/image)
 *   - public/set-previews/*.png               (the 20 preview images)
 *
 * After it finishes, redeploy that tenant's app so it rebuilds from the repo.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx REPO=jmulders/mister-chameleon-cms-another-statamic \
 *     node scripts/push-previews-fix-to-repo.mjs
 *
 * Env:
 *   GITHUB_TOKEN  token with contents:write on REPO         (required)
 *   REPO          owner/name of the target tenant CMS repo  (required)
 *   BRANCH        target branch                             (default: main)
 *   SRC           local CMS checkout to read files from
 *                 (default: ../mister-chameleon-cms-app)
 *   DRY_RUN=1     list what would be pushed, write nothing
 *
 * The token is read from the environment only — never printed or stored.
 */

import { readFile, readdir } from "node:fs/promises";
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
  console.error("✗ Set GITHUB_TOKEN and REPO (owner/name). See header for usage.");
  process.exit(1);
}

const FILES = [
  "config/filesystems.php",
  "config/statamic/assets.php",
  "content/assets/set_previews.yaml",
  "resources/fieldsets/mc_page_blocks.yaml",
];
const PNG_DIR = "public/set-previews";

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
      console.error(`✗ ${f} not found in ${SRC} — point SRC at the CMS checkout that has the fix.`);
      process.exit(1);
    }
  }
  const pngs = (await readdir(path.join(SRC, PNG_DIR))).filter((f) => f.endsWith(".png")).sort();
  const allPaths = [...FILES, ...pngs.map((n) => `${PNG_DIR}/${n}`)];

  console.log(`${DRY ? "[dry] " : ""}Committing ${allPaths.length} file(s) → ${REPO}@${BRANCH}`);
  for (const p of allPaths) console.log(`   • ${p}`);
  if (DRY) return;

  // 1. Current branch head + base tree.
  const ref = await gh("GET", `${API}/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await gh("GET", `${API}/git/commits/${baseCommitSha}`);
  const baseTreeSha = baseCommit.tree.sha;

  // 2. Create a blob per file.
  const treeItems = [];
  for (const rel of allPaths) {
    const buf = await readFile(path.join(SRC, rel));
    const blob = await gh("POST", `${API}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" });
    treeItems.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  }

  // 3. New tree on top of the base tree, 4. commit, 5. move the branch.
  const tree = await gh("POST", `${API}/git/trees`, { base_tree: baseTreeSha, tree: treeItems });
  const commit = await gh("POST", `${API}/git/commits`, {
    message: "fix(cms): set-picker previews (fieldset + images + set_previews container/disk)",
    tree: tree.sha,
    parents: [baseCommitSha],
  });
  await gh("PATCH", `${API}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { sha: commit.sha });

  console.log(`\n✓ Committed ${commit.sha.slice(0, 7)} to ${REPO}@${BRANCH}. Now redeploy this tenant's app.`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
