import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { defineConfig, devices } from "@playwright/test";

// The suites exercise a production build served by `next start`, on a port that cannot collide with `pnpm dev`.
const PORT = 3100;
const BASE_URL = `http://localhost:${String(PORT)}`;

// `next start` does not load .env.test (Next skips it outside `NODE_ENV=test`), so parse it here and hand the
// result to the server explicitly. NODE_ENV is forced to production: the proxy opens `/dev/ui` in any other
// mode, and these tests must see exactly what ships.
const testEnv = parseEnv(readFileSync(join(import.meta.dirname, ".env.test"), "utf8"));

// E2E_SKIP_BUILD=1 serves an existing `.next` build (the sandbox's 180 s tool limit needs build and run
// in separate calls). CI and fresh checkouts leave it unset and build first.
const serverCommand = process.env.E2E_SKIP_BUILD
  ? `pnpm start -p ${String(PORT)}`
  : `pnpm build && pnpm start -p ${String(PORT)}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // Mobile first: phones run before the desktop check.
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: serverCommand,
    // The health route also proves the database is reachable before any test runs.
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { ...process.env, ...testEnv, NODE_ENV: "production" },
    stdout: "pipe",
    stderr: "pipe",
  },
});
