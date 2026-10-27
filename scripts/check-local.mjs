// Local compilation/unit checks only. Never inherit the real Supabase or email configuration.
// A separate build folder keeps this deliberately disconnected build away from release artifacts.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const saved = ["next-env.d.ts", "tsconfig.json"].map((name) => {
  const file = path.join(root, name);
  return [file, fs.readFileSync(file)];
});
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-check-not-a-real-key",
  SUPABASE_JWKS_URL: "",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  RESEND_API_KEY: "",
  ALERT_EMAIL_TO: "",
  ALERT_EMAIL_FROM: "",
  CONTACT_EMAIL: "local@example.test",
  WHATSAPP_NUMBER: "",
  NEXT_DIST_DIR: ".next-local-check",
  NEXT_TELEMETRY_DISABLED: "1",
};
console.log(
  "Local checks: external integrations disconnected; expected catalog/settings fetch warnings are not integration verification.",
);
try {
  const result = spawnSync("npm", ["run", "check"], { cwd: root, env, stdio: "inherit" });
  if (result.error) console.error("Could not start local checks:", result.error.message);
  process.exitCode = result.status ?? 1;
} finally {
  // Next updates generated-type paths when a custom output directory is used.
  for (const [file, bytes] of saved) fs.writeFileSync(file, bytes);
}
