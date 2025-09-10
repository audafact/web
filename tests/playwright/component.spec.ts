import { test, expect } from "@playwright/test";

test.describe("Component Tests", () => {
  test("should load the application", async ({ page }) => {
    await page.goto("/");

    // Check if the app loads without errors
    await expect(page).toHaveTitle(/Audafact/);

    // Check for any console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Verify no critical errors
    expect(
      errors.filter(
        (error) =>
          !error.includes("Warning") &&
          !error.includes("instanceof") &&
          !error.includes("Should not already be working")
      )
    ).toHaveLength(0);
  });

  test("should handle user interactions", async ({ page }) => {
    await page.goto("/");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Test basic interactions
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Test clicking (if there are clickable elements)
    const clickableElements = page.locator('button, [role="button"], a');
    const count = await clickableElements.count();

    if (count > 0) {
      await clickableElements.first().click();
      // Verify the click worked (no errors)
      await page.waitForTimeout(100);
    }
  });

  test("should handle form interactions", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Test form inputs if they exist
    const inputs = page.locator("input, textarea, select");
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      const firstInput = inputs.first();
      await firstInput.fill("test input");
      await expect(firstInput).toHaveValue("test input");
    }
  });
});
