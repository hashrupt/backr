import { defineConfig, devices } from "@playwright/test";

/**
 * Backr E2E Test Configuration
 *
 * Tests the full app validation workflow with Keycloak authentication
 * and Canton ledger verification.
 *
 * Test Hierarchy:
 *   1. JSON API Direct Tests (scripts/test/json-api-test.sh)
 *   2. REST API Tests (scripts/test/backr-workflow-test.sh)
 *   3. UI E2E Tests (this configuration)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run tests sequentially for workflow dependencies
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for sequential workflow
  timeout: 120000, // 2 minute timeout for CIP-56 tests with retries

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.BACKR_WEB_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Server configuration - starts the frontend and API if not running
  webServer: process.env.BACKR_WEB_URL
    ? undefined
    : [
        {
          command: "pnpm --filter @backr/api dev",
          url: "http://localhost:4001/health",
          reuseExistingServer: !process.env.CI,
          timeout: 60 * 1000,
        },
        {
          command: "pnpm --filter @backr/web dev",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      ],
});
