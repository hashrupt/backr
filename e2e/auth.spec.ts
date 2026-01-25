import { test, expect, USERS } from "./fixtures";

test.describe("Login", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("logs in with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(USERS.alice.email);
    await page.getByLabel(/password/i).fill(USERS.alice.password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should redirect away from login
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 10_000,
    });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("shows error with invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should show error message and stay on login page
    await expect(page.getByText(/invalid|incorrect|error|failed/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("links to registration page", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /register|sign up|create account/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe("Registration", () => {
  test("renders registration form", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test("shows validation for mismatched passwords", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel(/^name/i).fill("Test User");
    await page.getByLabel(/email/i).fill("testmismatch@example.com");

    // Fill password fields
    const passwordFields = page.getByLabel(/password/i);
    await passwordFields.first().fill("password123");
    await passwordFields.last().fill("differentpassword");

    await page.getByRole("button", { name: /register|sign up|create/i }).click();

    // Should show password mismatch error
    await expect(page.getByText(/match|mismatch/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe("Protected Routes", () => {
  test("redirects to login when accessing my-entities", async ({ page }) => {
    await page.goto("/my-entities");

    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to login when accessing my-interests", async ({ page }) => {
    await page.goto("/my-interests");

    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to login when accessing my-backings", async ({ page }) => {
    await page.goto("/my-backings");

    await expect(page).toHaveURL(/\/login/);
  });

  test("allows access to my-entities after login", async ({ page, loginAs }) => {
    await loginAs("alice");

    await page.goto("/my-entities");
    await expect(page).toHaveURL(/\/my-entities/);

    // Alice owns CoolApp
    await expect(page.getByText("CoolApp").first()).toBeVisible();
  });
});
