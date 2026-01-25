import { test as base, expect, Page } from "@playwright/test";

/** Seed user credentials (from prisma/seed.ts) */
export const USERS = {
  alice: { email: "alice@example.com", password: "password123", name: "Alice Johnson" },
  bob: { email: "bob@example.com", password: "password123", name: "Bob Smith" },
  charlie: { email: "charlie@example.com", password: "password123", name: "Charlie Davis" },
  dave: { email: "dave@example.com", password: "password123", name: "Dave Wilson" },
} as const;

/** Log in via the UI and return to the given page */
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // Wait for redirect after login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10_000,
  });
}

/**
 * Extended test fixture that provides a `loginAs` helper.
 */
export const test = base.extend<{
  loginAs: (user: keyof typeof USERS) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    await use(async (user: keyof typeof USERS) => {
      const { email, password } = USERS[user];
      await login(page, email, password);
    });
  },
});

export { expect };
