import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("browser test isolation", () => {
  it.each(["https://example.supabase.co", "", "http://127.0.0.1:1234@remote.example"])(
    "rejects an unsafe database URL before building or starting the application (%s)",
    (url) => {
      const result = spawnSync(process.execPath, ["e2e/serve.mjs"], {
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url },
        encoding: "utf8",
        timeout: 5000,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Browser tests require an explicitly configured local Supabase URL");
      expect(result.stdout).not.toContain("Creating an optimized production build");
    },
  );
});
