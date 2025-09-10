import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("should load the application without errors", async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Navigate to the application
    await page.goto("/");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Check that the page has a title
    await expect(page).toHaveTitle(/Audafact/);

    // Check that main content is visible
    await expect(page.locator("body")).toBeVisible();

    // Verify no critical JavaScript errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes("Warning") &&
        !error.includes("instanceof") &&
        !error.includes("Should not already be working") &&
        !error.includes("ResizeObserver") &&
        !error.includes("Non-Error promise rejection")
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("should navigate to auth page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click the Sign In button if it exists (use first one to avoid strict mode violation)
    const signInButton = page.locator('a:has-text("Sign In")').first();
    if ((await signInButton.count()) > 0) {
      await signInButton.click();
      await expect(page).toHaveURL("/auth");
    }
  });

  test("should have working navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that navigation elements are present
    await expect(page.locator("nav")).toBeVisible();

    // Check that main content area is present
    await expect(page.locator("main")).toBeVisible();
  });
});
