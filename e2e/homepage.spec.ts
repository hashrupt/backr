import { test, expect } from "./fixtures";

test.describe("Homepage", () => {
  test("renders hero section with headline", async ({ page }) => {
    await page.goto("/");

    // Main heading should be visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("has navigation links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /campaigns/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /entities|apps/i })).toBeVisible();
  });

  test("has call-to-action buttons", async ({ page }) => {
    await page.goto("/");

    // Should have sign up or get started CTA
    const cta = page.getByRole("link", { name: /get started|sign up|explore/i });
    await expect(cta.first()).toBeVisible();
  });

  test("has login and register links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /log in|sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /register|sign up/i })).toBeVisible();
  });

  test("navigates to campaigns page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /campaigns/i }).first().click();
    await page.waitForURL("**/campaigns");

    await expect(page).toHaveURL(/\/campaigns/);
  });
});
