import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import { BASE_URL, DATABASE_PATH, STORAGE_STATE } from "./tests/e2e/accounts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Creates the account and the test agents once the server is up; every test starts signed in.
  globalSetup: `${root}tests/e2e/global-setup.ts`,
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    // Playwright launches webServer before globalSetup, so initialise the test
    // database here, before the application opens its SQLite connection.
    command: "rm -rf tests/.tmp && mkdir -p tests/.tmp && npm run dev -- --port 57321",
    // Any answer means it's up: without an account, `/` redirects to `/setup`.
    url: `${BASE_URL}/setup`,
    // Each invocation must run against a fresh SQLite database. Reusing a
    // developer's server would retain prior fixtures and hide retry failures.
    reuseExistingServer: false,
    env: { ...process.env, DATABASE_PATH, TIME_ZONE: "UTC" },
  },
});
