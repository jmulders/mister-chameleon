/**
 * Server-only helpers for the admin docs viewer.
 *
 * Reads the repo's `docs/*.md` files. On Vercel these are bundled into the
 * serverless function via `outputFileTracingIncludes` in next.config.mjs.
 */
import fs from "node:fs";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "docs");

export interface DocMeta {
  slug:  string;
  title: string;
}

/** First `# heading` in the file, or the slug as a fallback. */
function titleFromContent(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

/** List all docs (slug + derived title), sorted by title. */
export function listDocs(): DocMeta[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  return files
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      let content = "";
      try { content = fs.readFileSync(path.join(DOCS_DIR, f), "utf8"); } catch { /* skip */ }
      return { slug, title: titleFromContent(content, slug) };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Read a single doc by slug. Returns null for unknown/invalid slugs. */
export function readDoc(slug: string): string | null {
  // Only allow safe filename characters — blocks path traversal.
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return null;
  const file = path.join(DOCS_DIR, `${slug}.md`);
  if (file !== path.normalize(file) || !file.startsWith(DOCS_DIR + path.sep)) return null;
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}
