import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// local runs use the system Brave (no download); CI falls back to Playwright's own Chromium
const browser = process.env.DG_BROWSER ?? (existsSync("/usr/bin/brave-browser") ? "/usr/bin/brave-browser" : undefined);

/**
 * E2E + a11y suite. Runs on the system's Chromium-based Brave (headless) so no
 * browser download is needed. State is asserted via data-state / web-first
 * assertions, never sleeps.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
    launchOptions: browser ? { executablePath: browser } : {},
  },
  projects: [{ name: "brave" }],
  webServer: {
    command: "npm run dev",
    port: 5174,
    reuseExistingServer: true,
  },
});
