import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(".env.test") });

const port = process.env.PORT || "5000";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  globalSetup: "tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "development",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
