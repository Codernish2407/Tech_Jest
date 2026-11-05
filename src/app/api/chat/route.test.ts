import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { DEFAULT_REFUSAL } from "@/backend/assistant/prompt";
import { modelConfig } from "@/backend/assistant/model";
import { services } from "@/frontend/data/services";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  catalog: { services: [] as unknown[], status: "ready" as "ready" | "unavailable" },
}));

vi.mock("@/backend/supabase/services", () => ({ getServiceCatalog: async () => state.catalog }));
vi.mock("@/backend/supabase/site-settings", () => ({
  getSiteSettings: async () => ({ contact_email: "hello@example.com", whatsapp_number: "" }),
  whatsappLink: () => null,
}));

let ip = 0;
const ask = (body: unknown, address = `203.0.113.${++ip}`) =>
  POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": address },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const question = { messages: [{ role: "user", content: "What does a business website cost?" }] };
const completion = (content: string | null, finish_reason = "stop", status = 200) =>
  new Response(JSON.stringify({ choices: [{ finish_reason, message: { role: "assistant", content } }] }), {
    status,
  });
const sent = () => {
  const [url, init] = state.fetch.mock.calls[0]!;
  return { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
};

beforeEach(() => {
  vi.stubEnv("AI_API_KEY", "test-key");
  vi.stubEnv("AI_BASE_URL", "");
  vi.stubEnv("AI_MODEL", "");
  vi.stubGlobal("fetch", state.fetch);
  state.catalog = { services, status: "ready" };
  state.fetch.mockReset().mockImplementation(async () => completion("A Business Website starts at ₹25,000."));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("site assistant", () => {
  it("is off without an API key", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const response = await ask(question);
    expect(response.status).toBe(503);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("asks Gemini with the website rules and knowledge base", async () => {
    const response = await ask(question);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "A Business Website starts at ₹25,000." });
    const { url, headers, body } = sent();
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(body.model).toBe("gemini-3.5-flash-lite");
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("WEBSITE-ONLY KNOWLEDGE");
    expect(body.messages[0].content).toContain("<website_knowledge_base>");
    expect(body.messages[0].content).toContain("Starting price: ₹25,000");
    expect(body.messages[0].content).toContain("hello@example.com");
    expect(body.messages.slice(1)).toEqual([{ role: "user", content: "What does a business website cost?" }]);
  });

  it("can use another OpenAI-compatible provider", () => {
    expect(modelConfig({ AI_API_KEY: "k", AI_BASE_URL: "https://api.groq.com/openai/v1/", AI_MODEL: "llama" })).toEqual(
      { apiKey: "k", baseUrl: "https://api.groq.com/openai/v1", models: ["llama"], reasoningEffort: "" },
    );
    expect(modelConfig({ AI_API_KEY: "k", AI_MODEL: " a , b ," })?.models).toEqual(["a", "b"]);
  });

  it("moves on to the next model when one is overloaded or retired", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failures = [503, 404];
    state.fetch.mockImplementation(async () => {
      const status = failures.shift();
      return status ? new Response(JSON.stringify({ error: "high demand" }), { status }) : completion("Answer");
    });
    const response = await ask(question);
    expect(await response.json()).toEqual({ reply: "Answer" });
    expect(state.fetch.mock.calls.map(([, init]) => JSON.parse(init.body).model)).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
    ]);
  });

  it("does not retry other models when the key is wrong", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.fetch.mockImplementation(async () => new Response(JSON.stringify({ error: "bad key" }), { status: 401 }));
    expect((await ask(question)).status).toBe(502);
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });

  it("quotes no prices when the live catalog is down", async () => {
    state.catalog = { services: [], status: "unavailable" };
    await ask(question);
    const system: string = sent().body.messages[0].content;
    expect(system).toContain("Do not quote any service prices");
    expect(system).not.toContain("Starting price:");
  });

  it("returns the default refusal when the safety filter blocks the answer", async () => {
    state.fetch.mockImplementation(async () => completion(null, "content_filter"));
    expect(await (await ask(question)).json()).toEqual({ reply: DEFAULT_REFUSAL });
  });

  it("rejects malformed conversations without calling the model", async () => {
    expect((await ask("{")).status).toBe(400);
    expect((await ask({ messages: [] })).status).toBe(400);
    expect((await ask({ messages: [{ role: "assistant", content: "Hi" }] })).status).toBe(400);
    expect((await ask({ messages: [{ role: "user", content: "x".repeat(1001) }] })).status).toBe(400);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("limits how often one visitor can ask", async () => {
    const statuses = [];
    for (let index = 0; index < 7; index++) statuses.push((await ask(question, "198.51.100.7")).status);
    expect(statuses.slice(0, 6).every((status) => status === 200)).toBe(true);
    expect(statuses[6]).toBe(429);
  });

  it("says the assistant is busy when every model is out of free quota", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.fetch.mockImplementation(async () => new Response(JSON.stringify({ error: "quota" }), { status: 429 }));
    const response = await ask(question);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("busy");
    expect(state.fetch).toHaveBeenCalledTimes(3);
  });

  it("reports a failed model call without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.fetch.mockRejectedValue(new Error("socket hang up"));
    const response = await ask(question);
    expect(response.status).toBe(502);
    expect((await response.json()).error).not.toContain("socket");
  });
});
