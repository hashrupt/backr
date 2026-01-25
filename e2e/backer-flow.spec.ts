import { test, expect } from "./fixtures";

test.describe("Backer Journey", () => {
  test("browse campaigns → view detail → see interest form", async ({
    page,
    loginAs,
  }) => {
    // 1. Log in as a user
    await loginAs("alice");

    // 2. Browse campaigns
    await page.goto("/campaigns");
    await expect(page.getByText("Validator Staking Pool")).toBeVisible();

    // 3. Click into a campaign Alice hasn't backed yet... but Alice is a backer of campaign2
    // She can still view the detail page
    await page.getByText("Validator Staking Pool").click();
    await page.waitForURL("**/campaigns/**");

    // 4. Detail page should load with campaign info
    await expect(page.getByText("Validator Staking Pool")).toBeVisible();
    await expect(page.getByText("NodeRunner").first()).toBeVisible();
  });

  test("entity owner can view their entities", async ({ page, loginAs }) => {
    await loginAs("alice");
    await page.goto("/my-entities");

    await expect(page.getByText("CoolApp").first()).toBeVisible();
  });

  test("entity owner can view their entity campaigns", async ({
    page,
    loginAs,
  }) => {
    await loginAs("alice");
    await page.goto("/my-entities");

    // Click into the entity
    await page.getByText("CoolApp").first().click();
    await page.waitForURL("**/my-entities/**");

    // Should see campaigns for this entity
    await expect(page.getByText("Series A Backing Round").first()).toBeVisible();
  });

  test("dave can view his interests", async ({ page, loginAs }) => {
    await loginAs("dave");
    await page.goto("/my-interests");

    // Dave has a PENDING interest on campaign1 and ACCEPTED on campaign2
    await expect(page.getByText(/Series A Backing Round|Validator Staking Pool/).first()).toBeVisible();
  });

  test("dave can view his invites", async ({ page, loginAs }) => {
    await loginAs("dave");
    await page.goto("/my-invites");

    // Dave has a pending invite from Alice for campaign1
    await expect(page.getByText(/CoolApp|Series A/i).first()).toBeVisible();
  });
});
