import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const root = fileURLToPath(new URL(".", import.meta.url));
const databasePath = `${root}tests/.tmp/playwright.sqlite`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:57321",
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
    url: "http://127.0.0.1:57321",
    // Each invocation must run against a fresh SQLite database. Reusing a
    // developer's server would retain prior fixtures and hide retry failures.
    reuseExistingServer: false,
    env: { ...process.env, DATABASE_PATH: databasePath, TIME_ZONE: "UTC" },
  },
});
