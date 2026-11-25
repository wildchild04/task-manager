import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import { BASE_URL, DATABASE_PATH, STORAGE_STATE } from "./tests/e2e/accounts";

const root = fileURLToPath(new URL(".", import.meta.url));
const testDirectory = process.env.E2E_TEST_DIR;
if (!testDirectory || !process.env.E2E_PORT) {
  throw new Error("Run Playwright with npm run test:e2e so its server and files are isolated and cleaned up.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `${testDirectory}/results`,
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
    command: `npm run dev -- --host 127.0.0.1 --port ${process.env.E2E_PORT} --strictPort`,
    // Any answer means it's up: without an account, `/` redirects to `/setup`.
    url: `${BASE_URL}/setup`,
    // Each invocation must run against a fresh SQLite database. Reusing a
    // developer's server would retain prior fixtures and hide retry failures.
    reuseExistingServer: false,
    // A fixed SECRET_KEY, so agents' tokens are kept and Settings can show them again.
    env: { ...process.env, DATABASE_PATH, CONTENT_PATH: `${testDirectory}/content`, TIME_ZONE: "UTC", SECRET_KEY: "playwright-secret-key-of-32-characters" },
  },
});
