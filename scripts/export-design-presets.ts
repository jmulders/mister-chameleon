/**
 * scripts/export-design-presets.ts
 *
 * Emits one importable JSON file per entry in DESIGN_PRESET_GALLERY into
 * ./design-presets/. The file format is the platform's grouped design-token
 * UPLOAD format (token groups at the top level + `theme`), so each file can be
 * imported via the admin Design page → Builder → "Importeer JSON" (which runs
 * importDesignPresetAction → validateDesignTokenUpload).
 *
 * A `meta` block (schema/id/name/description) and a `swatch` block are included
 * for human readability and gallery previews; the importer ignores any key that
 * is not a known token group, so they are safe to keep in the file.
 *
 * Usage:
 *   npx tsx scripts/export-design-presets.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// Dynamic .ts import so this stand-alone CLI tool runs under
// `node --experimental-strip-types`, which resolves import paths literally and
// needs the real .ts extension.
//
// This used to carry a scoped `@ts-expect-error TS5097`, because
// allowImportingTsExtensions was off and this was the only file that needed it.
// The whole scripts/ directory now imports with .ts extensions for the same
// runtime reason, so the flag is on tsconfig-wide (18 Jul 2026) and the
// suppression is gone — TS no longer errors here, so the directive would itself
// be an "unused @ts-expect-error" error (TS2578).
const { DESIGN_PRESET_GALLERY } = await import("../tenant/design-presets-gallery.ts");

const OUT_DIR = join(process.cwd(), "design-presets");
const SCHEMA = "mister-chameleon-design-preset@1";

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const preset of DESIGN_PRESET_GALLERY) {
  const file = {
    meta: {
      schema: SCHEMA,
      id: preset.id,
      name: preset.name,
      description: preset.description,
    },
    // Token-upload payload: `theme` + token groups spread at the top level.
    theme: preset.baseTheme,
    ...preset.tokenOverrides,
    // Reference-only (ignored by the importer): card preview swatch.
    swatch: preset.swatch,
  };

  const path = join(OUT_DIR, `${preset.id}.json`);
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n", "utf-8");
  count += 1;
  console.log(`→ ${path}`);
}

console.log(`\n✅ Wrote ${count} preset JSON files to ${OUT_DIR}`);
