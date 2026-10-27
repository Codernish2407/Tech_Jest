import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./[id]/messages/route";
import { decodeMessageCursor, encodeMessageCursor, mergeMessages } from "@/lib/message-page";

const state = vi.hoisted(() => ({
  visible: true,
  messages: [] as { id: string; created_at: string; content: string }[],
  calls: [] as { table: string; method: string; args: unknown[] }[],
  rpc: vi.fn(),
}));
const id = "11111111-1111-4111-8111-111111111111";
const params = { params: Promise.resolve({ id }) };

vi.mock("@/backend/supabase/session", () => ({
  getSessionUser: async () => ({ id, app_metadata: {}, user_metadata: {} }),
}));
vi.mock("@/backend/supabase/server", () => ({
  createClient: async () => ({
    rpc: state.rpc,
    from: (table: string) => {
      const result = () => ({
        data: table === "conversations" ? (state.visible ? { id } : null) : state.messages,
        error: null,
      });
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "order", "limit", "or", "upsert", "insert"])
        query[method] = (...args: unknown[]) => {
          state.calls.push({ table, method, args });
          return query;
        };
      query.maybeSingle = async () => result();
      query.then = (resolve: (value: ReturnType<typeof result>) => unknown) => resolve(result());
      return query;
    },
  }),
}));

beforeEach(() => {
  state.visible = true;
  state.messages = [];
  state.calls = [];
  state.rpc.mockReset().mockResolvedValue({ data: null, error: null });
});

describe("message history", () => {
  it("shows the newest 100 in reading order, with a cursor for the older page", async () => {
    state.messages = Array.from({ length: 101 }, (_, index) => ({
      id: `${String(130 - index).padStart(8, "0")}-1111-4111-8111-111111111111`,
      created_at: new Date(Date.UTC(2026, 9, 26, 0, 0, 130 - index)).toISOString(),
      content: `message ${130 - index}`,
    }));
    const response = await GET(new Request("http://localhost/api/messages"), params);
    const messages = await response.json();
    expect(response.status).toBe(200);
    expect(messages).toHaveLength(100);
    expect(messages[0].content).toBe("message 31");
    expect(messages.at(-1).content).toBe("message 130");
    expect(response.headers.get("X-Next-Cursor")).toBe(encodeMessageCursor(messages[0]));
    expect(state.calls).toEqual(
      expect.arrayContaining([
        { table: "messages", method: "order", args: ["created_at", { ascending: false }] },
        { table: "messages", method: "order", args: ["id", { ascending: false }] },
        { table: "messages", method: "limit", args: [101] },
      ]),
    );
    expect(state.rpc).toHaveBeenCalledWith("mark_conversation_read", {
      p_conversation_id: id,
      p_read_at: messages.at(-1).created_at,
    });
  });

  it("uses a timestamp and id together for older messages without marking them read again", async () => {
    const cursor = { id, created_at: "2026-10-26T00:00:00.123456+00:00" };
    const response = await GET(
      new Request(`http://localhost/api/messages?before=${encodeURIComponent(encodeMessageCursor(cursor))}`),
      params,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Next-Cursor")).toBe("");
    expect(state.calls).toContainEqual({
      table: "messages",
      method: "or",
      args: [`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${id})`],
    });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed cursor filters before reading the database", async () => {
    const response = await GET(new Request("http://localhost/api/messages?before=x,content.neq.secret"), params);
    expect(response.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it("returns the same 404 for missing and inaccessible threads, without touching messages", async () => {
    state.visible = false;
    expect((await GET(new Request("http://localhost"), params)).status).toBe(404);
    expect(
      (
        await POST(
          new Request("http://localhost", { method: "POST", body: JSON.stringify({ content: "Hello" }) }),
          params,
        )
      ).status,
    ).toBe(404);
    expect(state.calls.every((call) => call.table === "conversations")).toBe(true);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("reports a failed read-state write without exposing database details", async () => {
    state.messages = [{ id, created_at: "2026-10-26T00:00:00Z", content: "Hello" }];
    state.rpc.mockResolvedValue({ error: { message: "private database details" } });
    const response = await GET(new Request("http://localhost"), params);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database details");
  });

  it("preserves microsecond cursors and merges equal-time messages without duplicates", () => {
    const first = { id, created_at: "2026-10-26T00:00:00.000001+00:00", content: "old" };
    const newer = {
      id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-10-26T00:00:00.000002Z",
      content: "new",
    };
    expect(decodeMessageCursor(encodeMessageCursor(first))).toEqual({ id, created_at: first.created_at });
    expect(mergeMessages([newer, first], [{ ...first, content: "updated" }])).toEqual([
      { ...first, content: "updated" },
      newer,
    ]);
    expect(mergeMessages([{ ...first, created_at: "2026-10-26T00:00:00Z" }], [newer])[0]?.id).toBe(id);
  });
});
