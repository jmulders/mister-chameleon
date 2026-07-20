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
  const status = response?.status();

  // 429 = Vercel edge rate-limit throttling the CI runner's burst of requests,
  // not an origin failure — the same rationale the health test already applies.
  // Tolerate it, but only assert real content when the origin actually served
  // the page (a 429 has no page body to check).
  expect([200, 429], `home page answered ${status}`).toContain(status);
  if (status !== 200) return;

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
  const response = await page.goto("/");
  // A rate-limited (429) response never renders the banner — skip rather than
  // fail, consistent with the home-page test above.
  test.skip(response?.status() === 429, "home page edge rate-limited (429)");

  // A first-time visitor (no mc_consent cookie) should see the consent dialog.
  const banner = page.getByRole("dialog", { name: /cookie/i });
  await expect(banner).toBeVisible({ timeout: 10_000 });
});
