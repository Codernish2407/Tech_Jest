import fs from "node:fs";
import { defineConfig } from "@playwright/test";

// Browser tests run against a throwaway local Supabase (npm run e2e:db writes e2e/.env.e2e).
const envFile = "e2e/.env.e2e";
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match?.[1] && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "";
// The tests create users and delete rows, so they must never reach the live project.
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl)) {
  throw new Error("E2E_SUPABASE_URL must be a local Supabase. Run `npm run e2e:db` first (needs Docker).");
}

export default defineConfig({
  testDir: "e2e",
  // One worker: the tests share one database, and some of them fill hourly limits.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3200",
    // The installed Google Chrome, so no separate browser download is needed.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://localhost:3200/api/health",
    // An arbitrary server on this port could have been built against production credentials.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3200",
    },
  },
});
