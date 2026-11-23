/**
 * A missing value is shown as a word, never as a lone punctuation mark.
 *
 * Admin screens once showed a dash where a value was missing. A sweep that
 * took the dashes out of the copy (#343) replaced those placeholders
 * mechanically with ", " and ": ", so a stat tile showed just a comma and a
 * "Last payment" card showed just a colon. Client components cannot be
 * rendered here, so this parses the source of every screen under app/ and
 * components/ and fails when such a placeholder comes back.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";
import ts               from "typescript";

const root = path.join(import.meta.dirname, "../..");
const DIRS = ["app", "components"];

/**
 * The Scenario Control panel is fixed, and guarded by its own test
 * (tests/scenario/panel-empty-values.test.ts), on another branch.
 */
const COVERED_ELSEWHERE = new Set([
  "components/scenario/DemoStageSection.tsx",
  "components/scenario/ScenarioControlPanel.tsx",
]);

/** Only punctuation and spaces, with at least one comma, colon or semicolon. */
const LONE = /^[\s,:;.]*[,:;][\s,:;.]*$/;

function isLoneLiteral(node: ts.Node): boolean {
  return (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && LONE.test(node.text);
}

/**
 * The places in a source where a lone mark stands in for a value:
 *  - the fallback of `x ?? ", "` or `x || ": "`;
 *  - one branch of a conditional, `x ? format(x) : ": "`. A conditional that
 *    picks between two marks, `semi ? ";" : ","`, is choosing a delimiter;
 *  - JSX text that is the whole content of its element, `<span>, </span>`.
 * A separator handed to a call (`list.join(", ")`) or put between two JSX
 * expressions (`{", "}`) is not a value and is left alone.
 */
function loneMarks(source: string, fileName = "snippet.tsx"): string[] {
  const sf = ts.createSourceFile(
    fileName, source, ts.ScriptTarget.Latest, true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  const report = (node: ts.Node) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    found.push(`${line + 1}: ${source.split("\n")[line].trim()}`);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const isFallback = op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken;
      if (isFallback && isLoneLiteral(node.right)) report(node.right);
    } else if (ts.isConditionalExpression(node)) {
      const yes = isLoneLiteral(node.whenTrue);
      const no  = isLoneLiteral(node.whenFalse);
      if (yes !== no) report(yes ? node.whenTrue : node.whenFalse);
    } else if (ts.isJsxElement(node)) {
      const children = node.children.filter((c) => !(ts.isJsxText(c) && c.text.trim() === ""));
      if (children.length === 1 && ts.isJsxText(children[0]) && LONE.test(children[0].text)) report(children[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function* sourceFiles(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* sourceFiles(p);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) yield p;
  }
}

describe("empty values in the admin and site screens", () => {
  it("finds the placeholders the dash sweep left behind", () => {
    assert.equal(loneMarks('const a = <Stat value={count || ", "} />;').length,               1);
    assert.equal(loneMarks('const a = <p>{date ? fmt(date) : ": "}</p>;').length,             1);
    assert.equal(loneMarks('const text = stage ?? ", ";', "snippet.ts").length,               1);
    assert.equal(loneMarks('const v = m === null ? ", " : m ? "yes" : "no";').length,         1);
    assert.equal(loneMarks('const a = <span className="x">\n, \n</span>;').length,            1);
    assert.equal(loneMarks('const a = <td>: </td>;').length,                                  1);
  });

  it("leaves real separators alone", () => {
    assert.deepEqual(loneMarks('const a = names.join(", ");'),                                []);
    assert.deepEqual(loneMarks('const a = <p>{i > 0 && ", "}{name}</p>;'),                    []);
    assert.deepEqual(loneMarks('const a = <p><code>a</code>, <code>b</code></p>;'),           []);
    assert.deepEqual(loneMarks('const a = <p><b>{label}</b>{": "}{text}</p>;'),               []);
    assert.deepEqual(loneMarks('const d = semi ? ";" : ",";', "snippet.ts"),                  []);
    assert.deepEqual(loneMarks('const l = h ? "Heading:" : "Body:";', "snippet.ts"),          []);
    assert.deepEqual(loneMarks('const a = <Row value={url || "not set"} />;'),                []);
  });

  it("no screen shows a lone punctuation mark for a missing value", () => {
    const found: string[] = [];
    for (const dir of DIRS) {
      for (const p of sourceFiles(path.join(root, dir))) {
        const file = path.relative(root, p).split(path.sep).join("/");
        if (COVERED_ELSEWHERE.has(file)) continue;
        const source = fs.readFileSync(p, "utf8");
        // Parsing is the slow part; most files hold no punctuation-only text at all.
        if (!/["'`>\n][ \t,:;.]*[,:;][ \t,:;.]*["'`<\n]/.test(source)) continue;
        for (const mark of loneMarks(source, p)) found.push(`${file}:${mark}`);
      }
    }
    assert.deepEqual(found, []);
  });
});
