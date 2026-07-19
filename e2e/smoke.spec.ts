import { test, expect } from "@playwright/test";

/**
 * Smoke — the one E2E test worth having before any other: does the site render
 * for a real browser at all? Nothing in the unit suite renders a page, so this
 * is the first check that "it loads" is actually true end to end.
 *
 * Point it at production or a local dev server via BASE_URL (see playwright.config.ts).
 */

test("home page renders and responds 200", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status(), "home page should answer 200").toBe(200);

  // The page has a real <body> with content, not an error shell.
  await expect(page.locator("body")).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text.trim().length, "the page should render some content").toBeGreaterThan(0);
});

test("health endpoint is alive", async ({ page }) => {
  const response = await page.goto("/api/health");
  // 200 = healthy; 429 = Vercel edge rate-limit but the origin answered (see
  // production.yml). Either proves the app is up.
  expect([200, 429]).toContain(response?.status());
});

test("cookie consent banner appears for a fresh visitor", async ({ page }) => {
  await page.goto("/");
  // A first-time visitor (no mc_consent cookie) should see the consent dialog.
  const banner = page.getByRole("dialog", { name: /cookie/i });
  await expect(banner).toBeVisible({ timeout: 10_000 });
});
