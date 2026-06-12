import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/cms-version
 *
 * Returns the latest modification timestamp across all .md files in the
 * Statamic CMS content directory. The Statamic CP Live Preview template
 * polls this endpoint and reloads the iframe whenever the version changes —
 * giving sub-2-second feedback after every save without any browser caching.
 *
 * Always responds with Cache-Control: no-store so the value is never cached.
 */

function maxMtime(dir: string): number {
  let max = 0;
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return max;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const childMax = maxMtime(full);
      if (childMax > max) max = childMax;
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      try {
        const { mtimeMs } = fs.statSync(full);
        if (mtimeMs > max) max = mtimeMs;
      } catch {
        // ignore unreadable files
      }
    }
  }

  return max;
}

export async function GET() {
  // STATAMIC_CMS_PATH may point to the CMS root (e.g. ./mister-chameleon-cms)
  // or directly to the content directory. Prefer the /content sub-directory when
  // it exists so we only watch actual content files, not config/vendor files.
  const rawCmsPath =
    process.env.STATAMIC_CMS_PATH ||
    path.resolve(process.cwd(), "../mister-chameleon-cms");

  const resolvedBase = path.resolve(process.cwd(), rawCmsPath);
  const contentSub = path.join(resolvedBase, "content");

  const cmsPath = fs.existsSync(contentSub) ? contentSub : resolvedBase;

  const version = maxMtime(cmsPath);

  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
