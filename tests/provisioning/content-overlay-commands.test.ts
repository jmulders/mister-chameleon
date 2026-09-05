/**
 * The cms-content overlay in a provisioned tenant's Ploi Cloud build commands.
 *
 * Ploi Cloud does not run `deploy.sh` — only the commands in the IaC run. On a
 * classic Ploi server the deploy script fetches `cms-content` and overlays it,
 * which is what makes CP edits survive a redeploy. Without the same steps in the
 * build commands a provisioned tenant pushes its edits to `cms-content` and then
 * serves the image's content on the next deploy.
 *
 * Two things are pinned here, and both matter for different reasons:
 *
 *   ORDER — the steps only work in sequence (key, then remote, then fetch, then
 *   checkouts), and the generated YAML is a list where order is the contract.
 *
 *   FAIL-OPEN — whether a Cloud build can run a second authenticated fetch is
 *   not knowable from here; Ploi does the initial clone with its own
 *   credentials. So no overlay command may ever be able to fail a deploy.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import {
  buildContentOverlayCommands, buildStatamicInfraYaml,
  CMS_CONTENT_PATHS, DEFAULT_CONTENT_BRANCH,
} from "../../lib/provisioning/cms-provisioner.ts";

const overlay = (over: Partial<Parameters<typeof buildContentOverlayCommands>[0]> = {}) =>
  buildContentOverlayCommands({ repoOwner: "acme", repoName: "cms-tenant", ...over });

/**
 * `yaml` is installed transitively rather than declared as a dependency, so the
 * parser-backed assertion SKIPS rather than fails if a lockfile change removes
 * it. The parser-free round-trip below covers the same ground either way.
 *
 * Resolved eagerly, before the suites run: `skip` is evaluated when `it()` is
 * called, so a lazily-initialised const here would still be in its TDZ.
 */
const yamlLib: { parse: (s: string) => unknown } | null = (() => {
  try { return createRequire(import.meta.url)("yaml") as { parse: (s: string) => unknown }; }
  catch { return null; }
})();

// ── The commands themselves ───────────────────────────────────────────────────

describe("buildContentOverlayCommands", () => {
  it("emits every step, in the order they have to run", () => {
    const cmds = overlay();
    const idx = (needle: string) => cmds.findIndex((c) => c.includes(needle));

    const safeDir  = idx("safe.directory");
    const key      = idx("id_ed25519");
    const remote   = idx("git remote set-url");
    const fetch    = idx("git fetch origin --prune");
    const firstCo  = idx("git checkout origin/");

    for (const [what, i] of [["safe.directory", safeDir], ["ssh key", key], ["remote", remote], ["fetch", fetch], ["checkout", firstCo]] as const) {
      assert.ok(i > -1, `expected a ${what} step`);
    }
    assert.ok(safeDir < key,    "safe.directory must precede any git use");
    assert.ok(key     < remote, "the key must be installed before the remote switches to SSH");
    assert.ok(remote  < fetch,  "the remote must be set before fetching");
    assert.ok(fetch   < firstCo, "cms-content must be fetched before it can be checked out");
  });

  it("restores exactly the paths the CP versions — no more, no less", () => {
    // These have to match config/statamic/git.php's `paths` in the template. A
    // path in one and not the other is content that is either saved and never
    // restored, or restored and never saved.
    const checkouts = overlay().filter((c) => c.startsWith("git checkout origin/"));
    assert.equal(checkouts.length, CMS_CONTENT_PATHS.length);
    assert.deepEqual(
      checkouts.map((c) => c.split(" -- ")[1]!.split(" ")[0]),
      [...CMS_CONTENT_PATHS],
    );
  });

  it("does NOT restore platform-managed code", () => {
    // Fieldsets, blueprints and addons come from the image. A CP push of a
    // drifted fieldset is what corrupted replicator content before.
    const joined = overlay().join("\n");
    for (const forbidden of ["resources/fieldsets", "resources/blueprints", "resources/addons", "resources/sites.yaml"]) {
      assert.ok(!joined.includes(forbidden), `${forbidden} must not be overlaid`);
    }
  });

  it("checks out one path per command, so one failure cannot take the rest", () => {
    for (const c of overlay().filter((c) => c.startsWith("git checkout"))) {
      assert.equal((c.match(/ -- /g) ?? []).length, 1);
    }
  });

  it("every command is fail-open", () => {
    // The whole design rests on this: a Cloud build that cannot fetch must serve
    // the image's content, which is today's behaviour — never a broken deploy.
    for (const c of overlay()) {
      assert.ok(c.trimEnd().endsWith("|| true"), `not fail-open: ${c}`);
    }
  });

  it("targets the tenant's own repo over SSH", () => {
    const cmd = overlay({ repoOwner: "jmulders", repoName: "mister-chameleon-cms-acme" })
      .find((c) => c.includes("git remote set-url"))!;
    assert.ok(cmd.includes("git@github.com:jmulders/mister-chameleon-cms-acme.git"));
  });

  it("only switches the remote to SSH when a key is actually present", () => {
    // Switching unconditionally would replace whatever credentials Ploi cloned
    // with, and break a fetch that would otherwise have worked over HTTPS.
    const cmd = overlay().find((c) => c.includes("git remote set-url"))!;
    assert.ok(cmd.includes('if [ -n "${STATAMIC_GIT_SSH_KEY:-}" ]'));
  });

  it("defaults to cms-content and honours an override", () => {
    assert.equal(DEFAULT_CONTENT_BRANCH, "cms-content");
    assert.ok(overlay().some((c) => c.includes("git checkout origin/cms-content -- content ")));
    assert.ok(overlay({ contentBranch: "snapshot" }).some((c) => c.includes("git checkout origin/snapshot -- content ")));
  });

  it("is valid shell", () => {
    // These strings are pasted into a build runner verbatim; a quoting slip
    // would only surface on a real deploy.
    for (const c of overlay()) {
      execFileSync("bash", ["-n", "-c", c], { stdio: "ignore" });
    }
  });
});

// ── The generated infrastructure YAML ─────────────────────────────────────────

describe("buildStatamicInfraYaml with the overlay", () => {
  const yamlFor = () => buildStatamicInfraYaml({
    appName:   "mc-cms-acme",
    team:      "team",
    repoUrl:   "https://github.com/acme/cms-tenant",
    repoOwner: "acme",
    repoName:  "cms-tenant",
    secrets:   [{ key: "STATAMIC_GIT_SSH_KEY", value: "-----BEGIN OPENSSH PRIVATE KEY-----\nx\n" }],
    extraBuildCommands: [...overlay(), "php artisan mc:ensure-super-user"],
  });

  it("orders the build: composer install → overlay → super-user", () => {
    const yaml = yamlFor();
    const composer = yaml.indexOf("composer install");
    const key      = yaml.indexOf("id_ed25519");
    const fetch    = yaml.indexOf("git fetch origin --prune");
    const lastCo   = yaml.lastIndexOf("git checkout origin/");
    const ensure   = yaml.indexOf("mc:ensure-super-user");

    assert.ok(composer > -1 && composer < key,  "composer install stays first");
    assert.ok(key < fetch && fetch < lastCo,    "key, fetch, then the checkouts");
    assert.ok(lastCo < ensure,                  "the super-user runs after the overlay");
  });

  it("emits every command as its own list item, escaping intact", () => {
    // yamlEscape has to cope with $, ", &&, |, >, ~ and braces. A mis-escaped
    // item would either break the apply or silently merge two commands —
    // neither is visible without decoding the emitted lines back.
    assert.deepEqual(buildCommandsFrom(yamlFor()), [
      "composer install --no-interaction --optimize-autoloader --no-dev",
      ...overlay(),
      "php artisan mc:ensure-super-user",
    ]);
  });

  it("parses under a real YAML parser", { skip: !yamlLib && "the yaml package is not resolvable here" }, () => {
    const parsed = yamlLib!.parse(yamlFor()) as {
      spec: { application: { commands: { build: string[] } } };
    };
    assert.deepEqual(parsed.spec.application.commands.build, buildCommandsFrom(yamlFor()));
  });

  it("keeps the ssh key in secrets, not in a command", () => {
    const yaml = yamlFor();
    const buildSection = yaml.slice(yaml.indexOf("build:"), yaml.indexOf("secrets:"));
    assert.ok(!buildSection.includes("BEGIN OPENSSH"), "the key must be an env secret, not inlined");
    assert.ok(yaml.includes("key: STATAMIC_GIT_SSH_KEY"));
    // The command reads it from the environment.
    assert.ok(buildSection.includes("STATAMIC_GIT_SSH_KEY"));
  });
});

/**
 * Pull the build commands back out of the generated YAML, undoing yamlEscape.
 *
 * Deliberately parser-free: this asserts the exact property that matters — one
 * list item per command, decoding to the original string — without depending on
 * a YAML library, and it is the check that always runs.
 */
function buildCommandsFrom(yaml: string): string[] {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => l.trim() === "build:");
  assert.ok(start > -1, "no build: key in the generated YAML");

  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const item = line.trim();
    if (!item.startsWith("- ")) break;   // the build list ended
    const value = item.slice(2);
    out.push(value.startsWith('"') ? JSON.parse(value) as string : value);
  }
  return out;
}
