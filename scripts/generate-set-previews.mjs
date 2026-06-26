/**
 * generate-set-previews.mjs
 * ---------------------------------------------------------------------------
 * Renders one Storybook story per content block and writes a 640x400 PNG named
 * after the block's *set key* — exactly the filenames the Statamic set-picker
 * expects (assets::set-previews/<setKey>.png, configured in the CMS template's
 * config/statamic/assets.php and referenced from mc_page_blocks.yaml).
 *
 * Because the filenames are identical to the schematic mockups they replace,
 * NO blueprint change is needed — just re-run this and ship the PNGs.
 *
 * Pipeline:
 *   1. `npm run build-storybook`            (produces ./storybook-static)
 *   2. `node scripts/generate-set-previews.mjs`
 *
 * Robustness: story IDs are NOT hard-coded (Storybook autotitles + content
 * `title:` props make them unstable). Instead we read storybook-static/
 * index.json and resolve each story's real id by matching importPath
 * (the .stories file) + story name. Unmatched sets are skipped with a warning
 * so the existing schematic PNG stays in place.
 *
 * Env:
 *   STORYBOOK_STATIC  dir of the built Storybook   (default: storybook-static)
 *   OUT_DIR           where PNGs are written
 *                     (default: ../mister-chameleon-cms-app/public/assets/set-previews)
 *
 * Dev deps required:  npm i -D playwright sharp  &&  npx playwright install chromium
 */

import http from "node:http";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const STORYBOOK_STATIC = path.resolve(REPO_ROOT, process.env.STORYBOOK_STATIC || "storybook-static");
const OUT_DIR = path.resolve(
  REPO_ROOT,
  process.env.OUT_DIR || "../mister-chameleon-cms-app/public/set-previews",
);

// Final preview size (matches the schematic mockups).
const OUT_W = 640;
const OUT_H = 400;
// Render at a larger, content-friendly viewport, then downscale (crisper text).
const RENDER_W = 1200;
const RENDER_H = 760;

/**
 * setKey -> which story to shoot.
 *  file: substring of the .stories importPath (the component file)
 *  name: the story (export) display name to prefer
 * Sets without a dedicated block story (context_slot, collection_listing) point
 * at the closest visual proxy; tweak freely.
 */
const SET_MAP = {
  context_slot:        { file: "HeroBlock.stories",            name: "Default" },
  text_section:        { file: "TextSectionBlock.stories",     name: "Single" },
  rich_text:           { file: "RichTextBlock.stories",        name: "Default" },
  image:               { file: "TextMediaBlock.stories",       name: "MediaRight" },
  video:               { file: "VideoBlock.stories",           name: "YouTube" },
  quote_block:         { file: "QuoteBlock.stories",           name: "Card" },
  testimonial_section: { file: "TestimonialSectionBlock.stories", name: "Grid" },
  logo_strip:          { file: "LogoStripBlock.stories",       name: "Default" },
  stats:               { file: "StatsBlock.stories",           name: "Default" },
  feature_grid:        { file: "FeatureGridBlock.stories",     name: "Default" },
  faq_section:         { file: "FaqSectionBlock.stories",      name: "Default" },
  team_section:        { file: "TeamSectionBlock.stories",     name: "Grid" },
  process_steps:       { file: "ProcessStepsBlock.stories",    name: "Default" },
  timeline:            { file: "TimelineBlock.stories",        name: "Vertical" },
  cta_section:         { file: "CtaSectionBlock.stories",      name: "BannerDefault" },
  form_section:        { file: "FormSectionBlock.stories",     name: "Default" },
  contact_section:     { file: "ContactSectionBlock.stories",  name: "Default" },
  collection_listing:  { file: "ListingBlock.stories",         name: "List" },
  listing:             { file: "ListingBlock.stories",         name: "Grid" },
  related_content:     { file: "RelatedContentBlock.stories",  name: "Grid" },
};

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".png": "image/png",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".ttf": "font/ttf", ".map": "application/json", ".ico": "image/x-icon",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
};

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        let p = decodeURIComponent((req.url || "/").split("?")[0]);
        if (p === "/") p = "/index.html";
        const fp = path.join(root, p);
        if (!fp.startsWith(root) || !existsSync(fp)) {
          res.statusCode = 404;
          return res.end("not found");
        }
        const buf = await readFile(fp);
        res.setHeader("Content-Type", MIME[path.extname(fp)] || "application/octet-stream");
        res.end(buf);
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function loadIndex(root) {
  // Storybook 8/9/10: index.json { v, entries: { id: {id,title,name,importPath,type} } }
  // Older: stories.json { stories: {...} }
  for (const name of ["index.json", "stories.json"]) {
    const fp = path.join(root, name);
    if (existsSync(fp)) {
      const json = JSON.parse(await readFile(fp, "utf8"));
      const entries = json.entries || json.stories || {};
      return Object.values(entries).filter((e) => (e.type ?? "story") === "story");
    }
  }
  throw new Error(`No index.json/stories.json in ${root}. Did 'npm run build-storybook' run?`);
}

function resolveId(stories, { file, name }) {
  const byFile = stories.filter((s) => (s.importPath || "").includes(file));
  if (byFile.length === 0) return null;
  const exact = byFile.find((s) => (s.name || "").toLowerCase() === name.toLowerCase());
  return (exact || byFile[0]).id; // fall back to first story in the file
}

async function main() {
  if (!existsSync(STORYBOOK_STATIC)) {
    console.error(`✗ ${STORYBOOK_STATIC} not found. Run 'npm run build-storybook' first.`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const stories = await loadIndex(STORYBOOK_STATIC);
  const server = await startStaticServer(STORYBOOK_STATIC);
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: RENDER_W, height: RENDER_H },
    deviceScaleFactor: 2,
  });

  let ok = 0;
  let skipped = 0;
  for (const [setKey, target] of Object.entries(SET_MAP)) {
    const id = resolveId(stories, target);
    if (!id) {
      console.warn(`• skip ${setKey}: no story matching ${target.file} (keeping existing PNG)`);
      skipped++;
      continue;
    }
    const url = `${base}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(600); // let fonts/images settle
      const shot = await page.screenshot({
        clip: { x: 0, y: 0, width: RENDER_W, height: RENDER_H },
      });
      const out = path.join(OUT_DIR, `${setKey}.png`);
      await sharp(shot)
        .resize(OUT_W, OUT_H, { fit: "cover", position: "top" })
        .png()
        .toFile(out);
      console.log(`✓ ${setKey}.png  ←  ${id}`);
      ok++;
    } catch (e) {
      console.warn(`• skip ${setKey}: render failed (${String(e).split("\n")[0]})`);
      skipped++;
    }
  }

  await browser.close();
  server.close();
  console.log(`\nDone: ${ok} written, ${skipped} skipped → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
