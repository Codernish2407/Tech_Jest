import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  data: [] as unknown[],
  error: null as null | { code: string; message: string },
  throws: false,
}));
vi.mock("@/backend/supabase/public", () => ({
  createPublicClient: () => {
    if (state.throws) throw new Error("Offline");
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => resolve({ data: state.data, error: state.error }),
    };
    return { from: () => query };
  },
}));
import { getServiceCatalog } from "./services";
import { GET } from "@/app/api/services/route";

beforeEach(() => {
  state.data = [];
  state.error = null;
  state.throws = false;
});
describe("catalog availability", () => {
  it("distinguishes a genuinely empty catalog from an outage", async () => {
    expect(await getServiceCatalog()).toEqual({ services: [], status: "ready" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
  it.each(["42P01", "PGRST205", "08006"])("reports %s as unavailable without stale prices", async (code) => {
    state.error = { code, message: "Private database detail" };
    const catalog = await getServiceCatalog();
    expect(catalog.status).toBe("unavailable");
    expect(catalog.services).toEqual([]);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("Private database detail");
  });
  it("reports connection failures without returning bundled catalog prices", async () => {
    state.throws = true;
    expect((await GET()).status).toBe(503);
  });
  it("recovers with current prices on the next request", async () => {
    state.error = { code: "08006", message: "Offline" };
    expect((await GET()).status).toBe(503);
    state.error = null;
    state.data = [
      {
        slug: "test",
        name: "Current service",
        price: 12345,
        category: "Web Development",
        description: "Current description",
        delivery: "2 weeks",
      },
    ];
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ slug: "test", price: 12345 }]);
  });
});
