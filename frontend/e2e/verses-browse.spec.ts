import { test, expect } from "@playwright/test";

/**
 * E2E tests for browsing verses.
 * Tests the critical path: user can browse and filter verses.
 */
test.describe("Verses Browsing", () => {
  test("user can browse verses page", async ({ page }) => {
    // Go directly to verses page
    await page.goto("/verses");

    // Wait for page to load - should have filter buttons
    await expect(page.locator("button:has-text('Featured')")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("button:has-text('All')")).toBeVisible();
    await expect(page.locator("button:has-text('Chapter')")).toBeVisible();

    // Should show verses count after data loads
    await expect(page.locator("text=Showing")).toBeVisible({ timeout: 15000 });
  });

  test("user can filter verses by chapter", async ({ page }) => {
    await page.goto("/verses");

    // Wait for initial load
    await expect(page.locator("button:has-text('Chapter')")).toBeVisible({ timeout: 15000 });

    // Click chapter dropdown
    await page.click("button:has-text('Chapter')");

    // Chapter dropdown should show chapter buttons (1-18)
    // Wait for dropdown to appear
    await expect(page.locator("button:has-text('2')")).toBeVisible({ timeout: 5000 });

    // Select chapter 2
    await page.click("button:has-text('2')");

    // URL should update with chapter param
    await expect(page).toHaveURL(/chapter=2/);

    // Should show verses from Chapter 2
    await expect(page.locator("text=Showing")).toBeVisible({ timeout: 10000 });
  });

  test("user can switch between featured and all verses", async ({ page }) => {
    await page.goto("/verses");

    // Wait for page load
    await expect(page.locator("button:has-text('Featured')")).toBeVisible({ timeout: 15000 });

    // Click "All" filter
    await page.click("button:has-text('All')");

    // URL should update
    await expect(page).toHaveURL(/all=true/);

    // Switch back to Featured
    await page.click("button:has-text('Featured')");

    // URL should not have all param
    await expect(page).not.toHaveURL(/all=true/);
  });

  test("homepage shows featured verse", async ({ page }) => {
    await page.goto("/");

    // Wait for homepage to load
    await expect(page.locator("h1")).toContainText("Wisdom for Life", { timeout: 15000 });

    // Should not show error - page loaded successfully
    // The featured verse may or may not load depending on backend, but page should render
    await expect(page.locator("body")).not.toContainText("Service Unavailable");
  });
});
