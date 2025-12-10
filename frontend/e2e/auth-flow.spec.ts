import { test, expect } from "@playwright/test";

/**
 * E2E tests for authentication flow.
 * Tests signup, login, and logout functionality.
 */
test.describe("Authentication Flow", () => {
  test("signup page loads and validates input", async ({ page }) => {
    await page.goto("/signup");

    // Verify signup page loads
    await expect(page.locator("h1")).toContainText("Create Account", { timeout: 10000 });

    // Verify form fields exist
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(
      page.locator("text=Email is required").or(page.locator("text=required"))
    ).toBeVisible();
  });

  test("signup validates password requirements", async ({ page }) => {
    await page.goto("/signup");

    // Fill email
    await page.fill('input[name="email"]', "test@example.com");

    // Fill weak password
    await page.fill('input[name="password"]', "weak");
    await page.fill('input[name="confirmPassword"]', "weak");

    // Submit
    await page.click('button[type="submit"]');

    // Should show password requirement error
    await expect(
      page
        .locator("text=at least 8 characters")
        .or(page.locator("text=Password must"))
        .or(page.locator("text=too short"))
    ).toBeVisible();
  });

  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login");

    // Verify login page loads
    await expect(
      page.locator("h1").or(page.locator("h2")).filter({ hasText: /log\s*in|sign\s*in/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify form fields
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // Verify signup link exists
    await expect(page.locator('a[href="/signup"]')).toBeVisible();
  });

  test("can navigate between login and signup", async ({ page }) => {
    // Start at login
    await page.goto("/login");
    await expect(page).toHaveURL("/login");

    // Click signup link
    await page.click('a[href="/signup"]');
    await expect(page).toHaveURL("/signup");

    // Click login link from signup page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL("/login");
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");

    // Verify page loads
    await expect(
      page.locator("text=Forgot Password").or(page.locator("text=Reset Password"))
    ).toBeVisible({ timeout: 10000 });

    // Should have email input
    await expect(page.locator('input[name="email"]').or(page.locator('input[type="email"]'))).toBeVisible();
  });

  test("login shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill invalid credentials
    await page.fill('input[name="email"]', "nonexistent@example.com");
    await page.fill('input[name="password"]', "wrongpassword123");

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message (could be various error messages)
    await expect(
      page
        .locator("text=Invalid")
        .or(page.locator("text=incorrect"))
        .or(page.locator("text=not found"))
        .or(page.locator('[role="alert"]'))
    ).toBeVisible({ timeout: 10000 });
  });
});
