import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { introScript } from "./site-intro";

function run(
  options: {
    pathname?: string;
    search?: string;
    hash?: string;
    reduced?: boolean;
    seen?: boolean;
    storageBlocked?: boolean;
    userAgent?: string;
  } = {},
) {
  const dataset: Record<string, string> = {};
  const stored = new Map<string, string>(options.seen ? [["techjest-welcome-v2", "seen"]] : []);
  const timers: { callback: () => void; delay: number }[] = [];
  const removeAttribute = vi.fn(() => {
    delete dataset.intro;
  });
  runInNewContext(introScript, {
    document: { documentElement: { dataset, removeAttribute } },
    location: { pathname: options.pathname ?? "/", search: options.search ?? "", hash: options.hash ?? "" },
    matchMedia: () => ({ matches: options.reduced ?? false }),
    navigator: { userAgent: options.userAgent ?? "Mozilla/5.0" },
    URLSearchParams,
    sessionStorage: {
      getItem: (key: string) => {
        if (options.storageBlocked) throw new Error("Blocked");
        return stored.get(key);
      },
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    setTimeout: (callback: () => void, delay: number) => {
      timers.push({ callback, delay });
    },
  });
  return { dataset, stored, timers, removeAttribute };
}

describe("opening animation", () => {
  it("opts in once per tab and expires without React hydration", () => {
    const result = run();
    expect(result.dataset.intro).toBe("play");
    expect(result.stored.get("techjest-welcome-v2")).toBe("seen");
    expect(result.timers.map((timer) => timer.delay)).toEqual([1600, 2300]);
    result.timers[0]!.callback();
    expect(result.dataset.intro).toBe("exit");
    result.timers[1]!.callback();
    expect(result.dataset.intro).toBeUndefined();
  });
  it("skips a repeat visit", () => {
    expect(run({ seen: true }).dataset.intro).toBeUndefined();
  });
  it("honors an explicit replay", () => {
    expect(run({ seen: true, search: "?intro=1" }).dataset.intro).toBe("play");
  });
  it("never overrides reduced motion, even for replay", () => {
    const result = run({ reduced: true, search: "?intro=1" });
    expect(result.dataset.intro).toBeUndefined();
    expect(result.timers).toEqual([]);
  });
  it("does not interrupt other pages or deep links", () => {
    expect(run({ pathname: "/services" }).dataset.intro).toBeUndefined();
    expect(run({ hash: "#services" }).dataset.intro).toBeUndefined();
  });
  it("still expires if session storage is blocked", () => {
    const result = run({ storageBlocked: true });
    expect(result.dataset.intro).toBe("play");
    result.timers[1]!.callback();
    expect(result.dataset.intro).toBeUndefined();
  });
  it("does not resurrect an intro the visitor already skipped", () => {
    const result = run();
    result.removeAttribute();
    result.timers[0]!.callback();
    expect(result.dataset.intro).toBeUndefined();
  });
  it("skips crawlers", () => {
    expect(run({ userAgent: "Googlebot" }).dataset.intro).toBeUndefined();
  });
  it("keeps the old welcome URL working", () => {
    expect(run({ pathname: "/opening_animation_video" }).dataset.intro).toBe("play");
  });
});
