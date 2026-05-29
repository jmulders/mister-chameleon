// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored / compiled studio output — not our source, never lint these
    "apps/studio/dist/**",
    "apps/studio/#/**",
    "apps/studio/node_modules/**",
    // Test helper scripts
    "test-smpt.js",
  ]),
  ...storybook.configs["flat/recommended"],

  // ── Project-wide rule overrides ───────────────────────────────────────────
  {
    rules: {
      // Components defined inside render functions are a performance anti-pattern
      // but not a correctness bug. Too many instances throughout the codebase to
      // refactor right now — downgrade to warning.
      "react-hooks/static-components": "warn",

      // Unescaped HTML entities (&, ', ", >) in JSX are cosmetic.
      // The React runtime handles them correctly; this is a style preference only.
      "react/no-unescaped-entities": "off",

      // JSX comment nodes — some components deliberately place comments in ways
      // that trigger this rule. Downgrade to warning.
      "react/jsx-no-comment-textnodes": "warn",

      // setState called synchronously in useEffect body is discouraged but common
      // for one-time initialization patterns (e.g. reading localStorage on mount).
      // Downgrade to warning so intentional patterns don't block CI.
      "react-hooks/set-state-in-effect": "warn",

      // Date.now() and similar built-ins in useState initialisers are a known
      // pattern for one-time default values.  The React Compiler flags these as
      // "impure" but they are safe in useState(fn) and one-time renders.
      "react-hooks/purity": "warn",
    },
  },

  // ── Storybook files: relax renderer package rule ─────────────────────────
  {
    files: ["**/*.stories.tsx", "**/*.stories.ts", ".storybook/**"],
    rules: {
      // Story files legitimately import from @storybook/react for typing
      "storybook/no-renderer-packages": "off",
    },
  },
]);

export default eslintConfig;
