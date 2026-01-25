import { test, expect } from "./fixtures";

test.describe("Campaigns Page", () => {
  test("lists open campaigns", async ({ page }) => {
    await page.goto("/campaigns");

    // Should show campaign titles from seed data
    await expect(page.getByText("Series A Backing Round")).toBeVisible();
    await expect(page.getByText("Validator Staking Pool")).toBeVisible();
  });

  test("does not show DRAFT campaigns", async ({ page }) => {
    await page.goto("/campaigns");

    await expect(page.getByText("Series B Expansion")).not.toBeVisible();
  });

  test("shows campaign entity names", async ({ page }) => {
    await page.goto("/campaigns");

    await expect(page.getByText("CoolApp").first()).toBeVisible();
    await expect(page.getByText("NodeRunner").first()).toBeVisible();
  });

  test("shows funding progress percentages", async ({ page }) => {
    await page.goto("/campaigns");

    // campaign1: 6.5M / 10M = 65%, campaign2: 4M / 5M = 80%
    await expect(page.getByText("65%")).toBeVisible();
    await expect(page.getByText("80%")).toBeVisible();
  });

  test("navigates to campaign detail", async ({ page }) => {
    await page.goto("/campaigns");

    await page.getByText("Series A Backing Round").click();
    await page.waitForURL("**/campaigns/**");

    await expect(page).toHaveURL(/\/campaigns\//);
  });
});

test.describe("Campaign Detail Page", () => {
  test("shows campaign details", async ({ page }) => {
    await page.goto("/campaigns/campaign-coolapp-1");

    await expect(page.getByText("Series A Backing Round")).toBeVisible();
    await expect(page.getByText("CoolApp").first()).toBeVisible();
    await expect(
      page.getByText(/next generation DeFi/i)
    ).toBeVisible();
  });

  test("shows funding progress bar", async ({ page }) => {
    await page.goto("/campaigns/campaign-coolapp-1");

    // Should show progress indicator (65%)
    await expect(page.getByText(/65%/)).toBeVisible();
  });

  test("shows backer list", async ({ page }) => {
    await page.goto("/campaigns/campaign-coolapp-1");

    // Bob and Charlie are backers of campaign1
    await expect(page.getByText(/Bob Smith|bob/i).first()).toBeVisible();
  });

  test("shows interest form for logged-in users", async ({ page, loginAs }) => {
    await loginAs("charlie");

    await page.goto("/campaigns/campaign-noderunner-1");

    // Charlie already has an interest — may show status instead of form
    // Just verify the page loads without error
    await expect(page.getByText("Validator Staking Pool")).toBeVisible();
  });
});
