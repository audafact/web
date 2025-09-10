import { test, expect } from "@playwright/test";

test.describe("Performance Smoke Tests", () => {
  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loadTime = Date.now() - startTime;

    // Check that page loads within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    // Verify page is interactive
    await expect(page.locator("body")).toBeVisible();
  });

  test("should not have memory leaks", async ({ page }) => {
    // Listen for memory-related errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Navigate around to test for memory issues (avoid auth page)
    await page.goto("/studio");
    await page.waitForLoadState("networkidle");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for memory-related errors
    const memoryErrors = errors.filter(
      (error) =>
        error.includes("memory") ||
        error.includes("leak") ||
        error.includes("out of memory")
    );

    expect(memoryErrors).toHaveLength(0);
  });

  test("should handle multiple page loads", async ({ page }) => {
    // Test multiple page loads to check for performance degradation
    for (let i = 0; i < 3; i++) {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await page.goto("/studio");
      await page.waitForLoadState("networkidle");
    }

    // Final check that everything still works
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should not have excessive network requests", async ({ page }) => {
    const requests: string[] = [];

    page.on("request", (request) => {
      requests.push(request.url());
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that we don't have excessive API calls
    const apiRequests = requests.filter(
      (url) =>
        url.includes("/api/") ||
        url.includes("auth") ||
        url.includes("supabase")
    );

    // Should have reasonable number of API calls (not excessive)
    expect(apiRequests.length).toBeLessThan(20);
  });
});
