// Builds the app against the local test database and serves it on port 3200 (Playwright starts this).
// The build goes to .next-e2e, so the normal .next build is never replaced by one that points at the
// test database. next-env.d.ts is put back afterwards, because the build rewrites it for .next-e2e.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("Browser tests require an explicitly configured local Supabase URL.");
}
const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-e2e",
  // Email integration is outside browser-test scope. Empty process values override .env.local.
  RESEND_API_KEY: "",
  ALERT_EMAIL_TO: "",
  ALERT_EMAIL_FROM: "",
  NEXT_TELEMETRY_DISABLED: "1",
};
const nextEnv = path.join(root, "next-env.d.ts");
const savedNextEnv = fs.readFileSync(nextEnv, "utf8");
try {
  execFileSync("npx", ["next", "build"], { cwd: root, env, stdio: "inherit" });
} finally {
  fs.writeFileSync(nextEnv, savedNextEnv);
}
const server = spawn("npx", ["next", "start", "-p", "3200"], { cwd: root, env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
