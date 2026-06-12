/**
 * GET /api/debug/nav
 *
 * Diagnostic endpoint — shows exactly what nav data the file reader returns.
 * Shows the raw tree file contents + resolved nav items.
 * Remove or protect this endpoint before going to production.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

export const dynamic = "force-dynamic";

export async function GET() {
  const cmsFsPath = process.env.STATAMIC_CMS_PATH;

  if (!cmsFsPath) {
    return NextResponse.json({ error: "STATAMIC_CMS_PATH not set" }, { status: 500 });
  }

  const cmsRoot  = path.resolve(process.cwd(), cmsFsPath);
  const treesFile  = path.join(cmsRoot, "content", "trees", "navigation", "main_nav.yaml");
  const legacyFile = path.join(cmsRoot, "content", "navigation", "main_nav.yaml");

  const treesExists  = fs.existsSync(treesFile);
  const legacyExists = fs.existsSync(legacyFile);
  const activeFile   = treesExists ? treesFile : legacyFile;

  let rawContent: string | null = null;
  let parsedTree: unknown = null;
  let error: string | null = null;

  try {
    rawContent = fs.readFileSync(activeFile, "utf-8");
    const yaml = (parseYaml(rawContent) as Record<string, unknown>) ?? {};
    parsedTree = yaml["tree"];
  } catch (e) {
    error = String(e);
  }

  return NextResponse.json({
    cmsRoot,
    treesFile,
    legacyFile,
    treesExists,
    legacyExists,
    activeFile,
    rawContent,
    parsedTree,
    error,
  });
}
