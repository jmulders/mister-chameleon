/**
 * push-set-previews-to-tenant.mjs
 * ---------------------------------------------------------------------------
 * Uploads the 20 set-preview PNGs into ONE existing tenant's CMS GitHub repo,
 * via the GitHub Contents API. Run once per existing tenant. After it finishes,
 * click "Deploy CMS" for that tenant in the admin (or trigger its Ploi deploy
 * webhook) so the instance does: git pull (brings these PNGs) + php please
 * mc:sync (brings the updated fieldset with the preview refs) + cache clear.
 *
 * The fieldset itself does NOT need pushing here — mc:sync writes it from the
 * platform manifest. Only the binary PNGs need to live in the tenant repo.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx REPO=owner/tenant-cms-repo \
 *     node scripts/push-set-previews-to-tenant.mjs
 *
 * Env:
 *   GITHUB_TOKEN   a token with contents:write on the target repo  (required)
 *   REPO           owner/name of the tenant's CMS repo             (required)
 *   BRANCH         target branch                                   (default: main)
 *   SRC            folder with the PNGs
 *                  (default: ../mister-chameleon-cms-app/public/assets/set-previews)
 *   DEST           path prefix in the repo
 *                  (default: public/assets/set-previews)
 *   DRY_RUN        set to 1 to list without writing
 *
 * The token is read from the environment only — it is never printed or stored.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;
const BRANCH = process.env.BRANCH || "main";
const SRC = path.resolve(REPO_ROOT, process.env.SRC || "../mister-chameleon-cms-app/public/set-previews");
const DEST = (process.env.DEST || "public/set-previews").replace(/\/+$/, "");
const DRY = process.env.DRY_RUN === "1";

if (!TOKEN || !REPO) {
  console.error("✗ Set GITHUB_TOKEN and REPO (owner/name). See header for usage.");
  process.exit(1);
}

const API = `https://api.github.com/repos/${REPO}/contents`;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function existingSha(repoPath) {
  const res = await fetch(`${API}/${repoPath}?ref=${encodeURIComponent(BRANCH)}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${repoPath} → HTTP ${res.status}`);
  return (await res.json()).sha ?? null;
}

async function putFile(repoPath, contentB64, sha) {
  const body = {
    message: `chore(assets): set-picker preview ${path.basename(repoPath)}`,
    content: contentB64,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(`${API}/${repoPath}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${repoPath} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function main() {
  const files = (await readdir(SRC)).filter((f) => f.endsWith(".png")).sort();
  if (files.length === 0) {
    console.error(`✗ No PNGs in ${SRC}`);
    process.exit(1);
  }
  console.log(`${DRY ? "[dry] " : ""}Pushing ${files.length} preview(s) → ${REPO}@${BRANCH}:${DEST}/\n`);

  let written = 0;
  for (const name of files) {
    const repoPath = `${DEST}/${name}`;
    const b64 = (await readFile(path.join(SRC, name))).toString("base64");
    if (DRY) {
      console.log(`[dry] would write ${repoPath}`);
      continue;
    }
    const sha = await existingSha(repoPath);
    await putFile(repoPath, b64, sha);
    console.log(`✓ ${repoPath}${sha ? " (updated)" : " (created)"}`);
    written++;
  }
  console.log(`\nDone: ${written} file(s). Now click "Deploy CMS" for this tenant in the admin.`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
