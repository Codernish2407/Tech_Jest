import { describe, it, expect, beforeEach, vi } from "vitest";

// A stand-in for the Supabase server client: tests choose the signed-in user and
// see every table the route touches, so they can assert nothing reached the database.
const state: {
  user: {
    id: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  } | null;
  tables: string[];
  upserts: { table: string; values: unknown; options: unknown }[];
  rpcs: { name: string; args: Record<string, unknown> }[];
  rpcError: { code: string; message: string } | null;
  // Work the route scheduled with after(), such as the team email alert.
  after: (() => unknown)[];
} = { user: null, tables: [], upserts: [], rpcs: [], rpcError: null, after: [] };

function query(table: string) {
  const result = { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit", "in", "neq", "insert", "update", "delete"]) {
    builder[method] = () => builder;
  }
  builder.upsert = (values: unknown, options: unknown) => {
    state.upserts.push({ table, values, options });
    return builder;
  };
  builder.maybeSingle = async () => result;
  builder.single = async () => result;
  builder.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  return builder;
}

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    state.after.push(task);
  },
}));

// The public catalog client: an empty catalog, so contact requests fall back to service areas.
vi.mock("@/backend/supabase/public", () => ({
  createPublicClient: () => ({ from: () => query("service_catalog") }),
}));

vi.mock("@/backend/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      getClaims: async () => ({
        data: state.user
          ? {
              claims: {
                sub: state.user.id,
                email: state.user.email,
                app_metadata: state.user.app_metadata,
                user_metadata: state.user.user_metadata,
              },
            }
          : null,
        error: null,
      }),
      exchangeCodeForSession: async () => ({ error: null }),
    },
    from: (table: string) => {
      state.tables.push(table);
      return query(table);
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcs.push({ name, args });
      return { data: state.rpcError ? null : "33333333-3333-4333-8333-333333333333", error: state.rpcError };
    },
  }),
}));

const client = { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com", app_metadata: {} };
const admin = { id: "22222222-2222-4222-8222-222222222222", app_metadata: { role: "admin" } };
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  state.user = null;
  state.tables = [];
  state.upserts = [];
  state.rpcs = [];
  state.rpcError = null;
  state.after = [];
});

describe("/api/conversations/[id]/messages", () => {
  it("requires a signed-in user", async () => {
    const { GET } = await import("./api/conversations/[id]/messages/route");
    const response = await GET(new Request("http://localhost"), params("11111111-1111-4111-8111-111111111111"));
    expect(response.status).toBe(401);
  });

  it("answers 404 for a malformed conversation id without querying the database", async () => {
    const { GET, POST } = await import("./api/conversations/[id]/messages/route");
    state.user = client;
    expect((await GET(new Request("http://localhost"), params("not-a-uuid"))).status).toBe(404);
    expect((await POST(json({ content: "Hello" }), params("not-a-uuid"))).status).toBe(404);
    expect(state.tables).toEqual([]);
  });

  it("stops clients from writing internal notes", async () => {
    const { POST } = await import("./api/conversations/[id]/messages/route");
    state.user = client;
    const response = await POST(
      json({ content: "Hi", internal: true }),
      params("11111111-1111-4111-8111-111111111111"),
    );
    expect(response.status).toBe(403);
    expect(state.tables).toEqual([]);
  });
});

describe("/api/conversations", () => {
  it("creates a conversation and membership with one atomic RPC", async () => {
    const { POST } = await import("./api/conversations/route");
    state.user = client;
    expect((await POST(json({ title: "  Project discussion  " }))).status).toBe(201);
    expect(state.tables).toEqual([]);
    expect(state.rpcs).toEqual([
      {
        name: "start_client_conversation",
        args: { p_title: "Project discussion", p_request_id: null, p_project_id: null },
      },
    ]);
  });
  it.each([
    ["42501", 403],
    ["22023", 400],
    ["PGRST202", 503],
  ] as const)("handles conversation RPC failure %s", async (code, status) => {
    const { POST } = await import("./api/conversations/route");
    state.user = client;
    state.rpcError = { code, message: "Private database detail" };
    const response = await POST(json({ title: "Project discussion" }));
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("Private database detail");
    expect(state.tables).toEqual([]);
  });

  it.each([null, [], "hello", 42, true].map((body) => ({ body })))(
    "rejects a non-object body ($body)",
    async ({ body }) => {
      const { POST } = await import("./api/conversations/route");
      state.user = client;
      expect((await POST(json(body))).status).toBe(400);
      expect(state.tables).toEqual([]);
    },
  );

  it("rejects malformed request and project ids", async () => {
    const { POST } = await import("./api/conversations/route");
    state.user = client;
    expect((await POST(json({ projectId: "x" }))).status).toBe(400);
    expect((await POST(json({ requestId: "" }))).status).toBe(400);
    expect((await POST(json({ requestId: 7 }))).status).toBe(400);
    expect(state.tables).toEqual([]);
  });
});

describe("/api/contact without an account", () => {
  const enquiry = {
    service: "Web Development",
    message: "We need a booking website for our clinic.",
    name: "Asha Rao",
    email: "asha@example.com",
  };

  it("asks the visitor to log in and saves nothing", async () => {
    const { POST } = await import("./api/contact/route");
    for (const body of [enquiry, { ...enquiry, serviceSlugs: ["landing-page"] }, null]) {
      const response = await POST(json(body));
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ loginRequired: true });
    }
    expect(state.rpcs).toEqual([]);
    expect(state.tables).toEqual([]);
    expect(state.after).toEqual([]);
  });
});

describe("/api/contact input checks", () => {
  const enquiry = { service: "Web Development", message: "We need a booking website for our clinic." };

  it.each([null, [], "hello", 42, true].map((body) => ({ body })))(
    "rejects a non-object body ($body)",
    async ({ body }) => {
      const { POST } = await import("./api/contact/route");
      state.user = client;
      expect((await POST(json(body))).status).toBe(400);
      expect(state.rpcs).toEqual([]);
      expect(state.after).toEqual([]);
    },
  );

  it.each(["website", [null], [42], [""], Array(31).fill("website")].map((serviceSlugs) => ({ serviceSlugs })))(
    "rejects invalid service selections ($serviceSlugs)",
    async ({ serviceSlugs }) => {
      const { POST } = await import("./api/contact/route");
      state.user = client;
      expect((await POST(json({ ...enquiry, serviceSlugs }))).status).toBe(400);
      expect(state.rpcs).toEqual([]);
    },
  );

  it("needs a real email address when one is given", async () => {
    const { POST } = await import("./api/contact/route");
    state.user = client;
    expect((await POST(json({ ...enquiry, email: "asha@" }))).status).toBe(400);
    expect(state.rpcs).toEqual([]);
  });

  it("quietly drops submissions that fill the hidden bot field", async () => {
    const { POST } = await import("./api/contact/route");
    state.user = client;
    const response = await POST(json({ ...enquiry, website: "http://spam.example" }));
    expect(response.status).toBe(200);
    expect(state.rpcs).toEqual([]);
    expect(state.after).toEqual([]);
  });

  it("shows the database's own message for invalid details", async () => {
    const { POST } = await import("./api/contact/route");
    state.user = client;
    state.rpcError = { code: "TJ400", message: "One or more selected services are no longer available." };
    const invalid = await POST(json(enquiry));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toBe("One or more selected services are no longer available.");
    expect(state.after).toEqual([]);
  });
});

describe("/api/contact submission", () => {
  const request = { service: "Web Development", message: "We need a booking website for our clinic." };

  it("saves everything in one database call", async () => {
    const { POST } = await import("./api/contact/route");
    state.user = client;
    const response = await POST(json(request));
    expect(response.status).toBe(200);
    expect(state.rpcs).toHaveLength(1);
    expect(state.rpcs[0]).toMatchObject({
      name: "submit_project_request",
      args: { p_service: "Web Development", p_message: request.message, p_email: client.email },
    });
    expect(state.tables).not.toContain("project_requests");
  });

  it("explains the hourly limit instead of a generic failure", async () => {
    const { POST } = await import("./api/contact/route");
    state.user = client;
    state.rpcError = { code: "TJ429", message: "Too many project requests." };
    const response = await POST(json(request));
    expect(response.status).toBe(429);
  });

  it("reports other database failures as a failed save", async () => {
    const { POST } = await import("./api/contact/route");
    state.user = client;
    state.rpcError = { code: "42501", message: "permission denied" };
    const response = await POST(json(request));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("permission denied");
  });
});

describe("/api/proposals/[id]/respond", () => {
  const id = "44444444-4444-4444-8444-444444444444";

  it("checks the id, the answer, and the session before touching the database", async () => {
    const { POST } = await import("./api/proposals/[id]/respond/route");
    expect((await POST(json({ accept: true }), params("nope"))).status).toBe(404);
    expect((await POST(json({ accept: "yes" }), params(id))).status).toBe(400);
    expect((await POST(json({ accept: true }), params(id))).status).toBe(401);
    expect(state.rpcs).toEqual([]);
  });

  it("records the answer and alerts the team", async () => {
    const { POST } = await import("./api/proposals/[id]/respond/route");
    state.user = client;
    const response = await POST(json({ accept: false }), params(id));
    expect(response.status).toBe(200);
    expect(state.rpcs[0]).toEqual({ name: "respond_to_proposal", args: { p_proposal_id: id, p_accept: false } });
    expect(state.after).toHaveLength(1);
  });

  it("explains a proposal that was already answered or has expired", async () => {
    const { POST } = await import("./api/proposals/[id]/respond/route");
    state.user = client;
    state.rpcError = { code: "TJ409", message: "This proposal has already been answered." };
    const response = await POST(json({ accept: true }), params(id));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("This proposal has already been answered.");
    expect(state.after).toEqual([]);
  });
});

describe("/api/admin/users/[id]", () => {
  it("is limited to admins", async () => {
    const { DELETE } = await import("./api/admin/users/[id]/route");
    expect((await DELETE(new Request("http://localhost"), params(client.id))).status).toBe(401);
    state.user = client;
    expect((await DELETE(new Request("http://localhost"), params(admin.id))).status).toBe(403);
  });

  it("refuses self-deletion and malformed ids", async () => {
    const { DELETE } = await import("./api/admin/users/[id]/route");
    state.user = admin;
    expect((await DELETE(new Request("http://localhost"), params(admin.id))).status).toBe(400);
    expect((await DELETE(new Request("http://localhost"), params("nope"))).status).toBe(404);
  });
});

describe("/auth/callback", () => {
  it("creates a missing profile but never overwrites an existing one", async () => {
    const { GET } = await import("./auth/callback/route");
    state.user = { id: client.id, email: client.email, user_metadata: { full_name: "Asha Rao" } };
    const response = await GET(new Request("http://localhost/auth/callback?code=abc&next=/cart"));
    expect(response.headers.get("location")).toBe("http://localhost/cart");
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({
      table: "profiles",
      options: { onConflict: "id", ignoreDuplicates: true },
    });
  });

  it("keeps the post-login redirect on this site", async () => {
    const { GET } = await import("./auth/callback/route");
    state.user = client;
    const response = await GET(new Request("http://localhost/auth/callback?code=abc&next=//evil.example"));
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
  });
});
