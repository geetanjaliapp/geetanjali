import { test, expect } from "@playwright/test";

/**
 * E2E tests for the case creation and viewing flow.
 * Tests the critical path: anonymous user creates a case and views it.
 */
test.describe("Case Creation Flow", () => {
  test("anonymous user can create a case", async ({ page }) => {
    // Start at homepage
    await page.goto("/");

    // Verify homepage loads with key elements (wait for loading to complete)
    await expect(page.locator("h1")).toContainText("Wisdom for Life", { timeout: 15000 });

    // Navigate to new case form - use the main CTA link
    await page.click('a[href="/cases/new"]');
    await expect(page).toHaveURL("/cases/new");

    // Verify form page loads
    await expect(page.locator("h1")).toContainText("Seek Guidance", { timeout: 15000 });

    // Fill in the question (required field)
    const questionText =
      "I am struggling with work-life balance. My job demands long hours but my family needs more of my time.";
    await page.fill('textarea[name="question"]', questionText);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for navigation to case view page
    // The URL should change to /cases/:id
    await page.waitForURL(/\/cases\/\d+/, { timeout: 30000 });

    // Verify we're on the case view page
    const url = page.url();
    expect(url).toMatch(/\/cases\/\d+/);

    // Case page should show the question text
    await expect(page.locator("body")).toContainText("work-life balance", { timeout: 15000 });
  });

  test("case form validates empty question", async ({ page }) => {
    await page.goto("/cases/new");

    // Wait for page to load
    await expect(page.locator("h1")).toContainText("Seek Guidance", { timeout: 15000 });

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator("text=Please describe your situation")).toBeVisible({ timeout: 5000 });

    // Should still be on the new case page
    await expect(page).toHaveURL("/cases/new");
  });

  test("case form has advanced options", async ({ page }) => {
    await page.goto("/cases/new");

    // Wait for page to load
    await expect(page.locator("h1")).toContainText("Seek Guidance", { timeout: 15000 });

    // Advanced options should be hidden by default
    await expect(page.locator('select[name="role"]')).not.toBeVisible();

    // Click to show advanced options
    await page.click("text=Show advanced options");

    // Now role selector should be visible
    await expect(page.locator('select[name="role"]')).toBeVisible({ timeout: 5000 });

    // Should have role options
    await expect(page.locator('option[value="individual"]')).toBeVisible();
    await expect(page.locator('option[value="parent"]')).toBeVisible();
  });
});
