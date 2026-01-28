import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Backr/);
  });

  test("campaigns page loads", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(page.locator("h1")).toContainText("Campaigns");
  });

  test("navigation works", async ({ page }) => {
    await page.goto("/");

    // Check navigation elements are present
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });
});
