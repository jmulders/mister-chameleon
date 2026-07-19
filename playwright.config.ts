import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — browser / E2E tests.
 *
 * Free and open source (MIT). Not part of `npm run verify`: E2E needs a running
 * site and real browsers, which is slow and belongs outside the blocking gate.
 * Run with `npm run test:e2e`.
 *
 * BASE_URL decides what it points at:
 *   - unset            → http://localhost:3000 (a local `npm run dev`)
 *   - production URL   → BASE_URL=https://www.misterchameleon.nl npm run test:e2e
 *
 * First-time setup (one-off):
 *   npm i -D @playwright/test && npx playwright install
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: process.env["CI"] ? "dot" : "list",
  use: {
    baseURL: process.env["BASE_URL"] ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
