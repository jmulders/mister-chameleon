/**
 * scripts/lint-summary.mjs
 *
 * Prints an ESLint summary instead of the full report: errors grouped by rule
 * and by top-level directory, then every error with its file and line.
 *
 * Usage:
 *   npm run lint:summary
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 *   `npm run lint` prints 14,100 problems. The 354 that actually fail the build
 *   are scattered through 13,746 warnings, so the one number you need — what is
 *   broken, and where — is unreadable. Same reason the test scripts use the dot
 *   reporter: output you cannot take in is output you stop reading, and then the
 *   gate stops working.
 *
 *   This uses ESLint's Node API rather than a formatter flag. `-f compact` was
 *   removed in ESLint 9, and a missing formatter makes eslint exit 2 with the
 *   explanation on stderr — which is invisible the moment anyone pipes through
 *   `2>/dev/null`. This script cannot fail that way.
 */

import { ESLint } from "eslint";

const eslint  = new ESLint();
const results = await eslint.lintFiles(["."]);

const byRule = new Map();
const byDir  = new Map();
const errors = [];

for (const result of results) {
  for (const m of result.messages) {
    if (m.severity !== 2) continue;                       // warnings are not the gate

    const rule = m.ruleId ?? "(parse error)";
    const rel  = result.filePath.replace(process.cwd() + "/", "");
    const dir  = rel.split("/")[0];

    byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
    byDir.set(dir,   (byDir.get(dir)   ?? 0) + 1);
    errors.push({ rel, line: m.line, rule, message: m.message });
  }
}

const totalWarnings = results.reduce(
  (n, r) => n + r.messages.filter((m) => m.severity === 1).length, 0,
);

const sorted = (map) => [...map].sort((a, b) => b[1] - a[1]);

if (errors.length === 0) {
  console.log(`\n✓ 0 errors  (${totalWarnings} warnings — these do not fail the build)\n`);
  process.exit(0);
}

console.log(`\n${errors.length} errors  (+ ${totalWarnings} warnings, which do not fail the build)\n`);

console.log("Per rule:");
for (const [rule, n] of sorted(byRule)) console.log(`  ${String(n).padStart(5)}  ${rule}`);

console.log("\nPer directory:");
for (const [dir, n] of sorted(byDir))  console.log(`  ${String(n).padStart(5)}  ${dir}/`);

console.log("\nEvery error:");
for (const e of errors) console.log(`  ${e.rel}:${e.line}  ${e.rule}\n      ${e.message}`);

console.log();
process.exit(1);
