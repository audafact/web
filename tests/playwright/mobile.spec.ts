import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 12"] });

test.describe("Mobile Smoke Tests", () => {
  test("should load on mobile devices", async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that the page loads on mobile
    await expect(page).toHaveTitle(/Audafact/);
    await expect(page.locator("body")).toBeVisible();

    // Verify no critical mobile errors
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

  test("should have responsive navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that navigation is present
    await expect(page.locator("nav")).toBeVisible();

    // Check for mobile menu button (hamburger menu)
    const mobileMenuButton = page.locator(
      'button[aria-label*="menu"], button[aria-label*="navigation"]'
    );
    if ((await mobileMenuButton.count()) > 0) {
      await expect(mobileMenuButton).toBeVisible();
    }
  });

  test("should handle touch interactions", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Test basic touch interactions
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Test tapping on clickable elements
    const clickableElements = page.locator('button, [role="button"], a');
    const count = await clickableElements.count();

    if (count > 0) {
      await clickableElements.first().tap();
      await page.waitForTimeout(100);
    }
  });

  test("should navigate to auth page on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Look for Sign In button (could be in mobile menu)
    const signInButton = page.locator('a:has-text("Sign In")').first();
    if ((await signInButton.count()) > 0) {
      await signInButton.click();
      await expect(page).toHaveURL("/auth");
    }
  });
});
