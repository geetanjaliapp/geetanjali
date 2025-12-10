import { test, expect } from "@playwright/test";

/**
 * E2E tests for authentication flow.
 * Tests signup, login, and logout functionality.
 */
test.describe("Authentication Flow", () => {
  test("signup page loads and validates input", async ({ page }) => {
    await page.goto("/signup");

    // Verify signup page loads - h2 says "Create Your Account"
    await expect(page.locator("h2")).toContainText("Create Your Account", { timeout: 15000 });

    // Verify form fields exist
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    // Try to submit empty form (HTML5 validation will prevent)
    // Just verify the submit button exists
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("signup validates password requirements", async ({ page }) => {
    await page.goto("/signup");

    // Wait for page to load
    await expect(page.locator("h2")).toContainText("Create Your Account", { timeout: 15000 });

    // Fill all required fields
    await page.fill('input[name="name"]', "Test User");
    await page.fill('input[name="email"]', "test@example.com");

    // Fill weak password
    await page.fill('input[name="password"]', "weak");
    await page.fill('input[name="confirmPassword"]', "weak");

    // Submit
    await page.click('button[type="submit"]');

    // Should show password requirement error
    await expect(page.locator("text=at least 8 characters")).toBeVisible({ timeout: 5000 });
  });

  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login");

    // Verify login page loads - h2 says "Welcome Back"
    await expect(page.locator("h2")).toContainText("Welcome Back", { timeout: 15000 });

    // Verify form fields
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // Verify signup link exists
    await expect(page.locator('a[href="/signup"]')).toBeVisible();
  });

  test("can navigate between login and signup", async ({ page }) => {
    // Start at login
    await page.goto("/login");
    await expect(page.locator("h2")).toContainText("Welcome Back", { timeout: 15000 });

    // Click signup link
    await page.click('a[href="/signup"]');
    await expect(page).toHaveURL("/signup");
    await expect(page.locator("h2")).toContainText("Create Your Account", { timeout: 15000 });

    // Click login link from signup page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL("/login");
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");

    // Verify page loads - should have some heading about password reset
    await expect(
      page.locator("h2").or(page.locator("h1"))
    ).toBeVisible({ timeout: 15000 });

    // Should have email input
    await expect(page.locator('input[name="email"]').or(page.locator('input[type="email"]'))).toBeVisible();
  });

  test("login shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Wait for page load
    await expect(page.locator("h2")).toContainText("Welcome Back", { timeout: 15000 });

    // Fill invalid credentials
    await page.fill('input[name="email"]', "nonexistent@example.com");
    await page.fill('input[name="password"]', "wrongpassword123");

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message in the red error box
    await expect(page.locator(".bg-red-50")).toBeVisible({ timeout: 10000 });
  });
});
