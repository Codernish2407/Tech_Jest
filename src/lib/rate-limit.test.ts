import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("API rate limiting", () => {
  it("keeps the original rolling window and rejected requests do not extend the wait", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(allow("client", 0).allowed).toBe(true);
    expect(allow("client", 1000).allowed).toBe(true);
    for (let i = 0; i < 10_000; i++) expect(allow("client", 2000).allowed).toBe(false);
    expect(allow("client", 59_000)).toEqual({ allowed: false, retryAfter: 1 });
    expect(allow("client", 60_000).allowed).toBe(true);
    expect(allow("client", 60_000).allowed).toBe(false);
  });

  it("bounds address cardinality without resetting live limits, then reclaims expired slots", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 60_000, maxAddresses: 2 });
    expect(allow("first", 0).allowed).toBe(true);
    expect(allow("second", 0).allowed).toBe(true);
    expect(allow("third", 0).allowed).toBe(false);
    expect(allow("first", 0).allowed).toBe(false);
    expect(allow("third", 60_000).allowed).toBe(true);
  });
});
