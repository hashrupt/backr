import { test, expect } from "./fixtures";

test.describe("Entities Page", () => {
  test("lists entities", async ({ page }) => {
    await page.goto("/entities");

    await expect(page.getByText("CoolApp").first()).toBeVisible();
    await expect(page.getByText("NodeRunner").first()).toBeVisible();
  });

  test("shows entity types", async ({ page }) => {
    await page.goto("/entities");

    await expect(page.getByText(/Featured App/i).first()).toBeVisible();
    await expect(page.getByText(/Validator/i).first()).toBeVisible();
  });

  test("shows claim status badges", async ({ page }) => {
    await page.goto("/entities");

    // CoolApp and NodeRunner are CLAIMED, NewApp and SuperValidator are UNCLAIMED
    await expect(page.getByText(/Claimed/i).first()).toBeVisible();
    await expect(page.getByText(/Available to Claim/i).first()).toBeVisible();
  });

  test("navigates to entity detail", async ({ page }) => {
    await page.goto("/entities");

    await page.getByText("CoolApp").first().click();
    await page.waitForURL("**/entities/**");

    await expect(page).toHaveURL(/\/entities\//);
  });
});

test.describe("Entity Detail Page", () => {
  test("shows entity information", async ({ page }) => {
    // Use the first entity from seed — we need to find its ID dynamically
    await page.goto("/entities");
    await page.getByText("CoolApp").first().click();
    await page.waitForURL("**/entities/**");

    await expect(page.getByText("CoolApp").first()).toBeVisible();
    await expect(
      page.getByText(/Next-generation DeFi/i).first()
    ).toBeVisible();
  });

  test("shows entity campaigns", async ({ page }) => {
    await page.goto("/entities");
    await page.getByText("CoolApp").first().click();
    await page.waitForURL("**/entities/**");

    await expect(page.getByText("Series A Backing Round").first()).toBeVisible();
  });
});
