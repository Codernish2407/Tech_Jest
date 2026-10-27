import { expect, test } from "@playwright/test";
import { admin, browserlessClient, createUser, signedInClient, uniqueEmail } from "./helpers";

test("backdating direct requests cannot bypass the hourly limit, including concurrent inserts", async () => {
  const user = await createUser({ prefix: "timestamp-limit" });
  const client = await signedInClient(user.email, user.password);
  const insert = () =>
    client.from("project_requests").insert({
      user_id: user.id,
      service: "Web",
      message: "Please help build a booking website.",
      created_at: "2000-01-01T00:00:00Z",
    });
  for (let i = 0; i < 8; i++) expect((await insert()).error).toBeNull();
  const attempts = await Promise.all(Array.from({ length: 5 }, insert));
  expect(attempts.filter((result) => !result.error)).toHaveLength(2);
  expect(attempts.filter((result) => result.error?.code === "TJ429")).toHaveLength(3);
  const { data } = await admin.from("project_requests").select("created_at").eq("user_id", user.id);
  expect(data).toHaveLength(10);
  for (const row of data!) expect(Date.parse(row.created_at)).toBeGreaterThan(Date.now() - 60_000);
});

test("service snapshots come from the catalog through both RPC and direct REST writes", async () => {
  const user = await createUser({ prefix: "snapshot" });
  const client = await signedInClient(user.email, user.password);
  const { data: catalog } = await admin
    .from("service_catalog")
    .select("slug, name, price")
    .eq("is_active", true)
    .limit(1)
    .single();
  expect(catalog).not.toBeNull();
  const result = await client.rpc("submit_project_request", {
    p_service: "Web",
    p_message: "Please help build a booking website.",
    p_services: [{ slug: catalog!.slug, name: "Forged name", price: -1000 }],
  });
  expect(result.error).toBeNull();
  const direct = await client
    .from("project_request_services")
    .insert({
      request_id: result.data,
      service_slug: catalog!.slug,
      service_name_snapshot: "Another fake",
      price_snapshot: 0,
    })
    .select("service_name_snapshot, price_snapshot")
    .single();
  expect(direct.error).toBeNull();
  expect(direct.data?.service_name_snapshot).toBe(catalog!.name);
  expect(direct.data?.price_snapshot).toBe(catalog!.price);
  const { data: rows } = await admin
    .from("project_request_services")
    .select("service_name_snapshot, price_snapshot")
    .eq("request_id", result.data);
  for (const row of rows!)
    expect(row).toEqual({ service_name_snapshot: catalog!.name, price_snapshot: catalog!.price });
  expect(
    (
      await client.from("project_request_services").insert({
        request_id: result.data,
        service_slug: "not-a-real-service",
        service_name_snapshot: "Fake",
        price_snapshot: 0,
      })
    ).error?.code,
  ).toBe("TJ400");
  expect(
    (
      await client.from("project_requests").insert({
        user_id: user.id,
        service: "Web",
        message: "Valid message with more than twenty characters.",
        phone: "x".repeat(31),
      })
    ).error?.code,
  ).toBe("TJ400");
});

test("concurrent guest enquiries share the per-email limit and reject null slugs", async () => {
  const guest = browserlessClient();
  const args = {
    p_name: "Guest Person",
    p_email: uniqueEmail("concurrent-guest"),
    p_service: "Web",
    p_message: "Please build a booking website for our clinic.",
  };
  expect((await guest.rpc("submit_guest_request", { ...args, p_service_slugs: [null] })).error?.code).toBe("TJ400");
  const results = await Promise.all(Array.from({ length: 6 }, () => guest.rpc("submit_guest_request", args)));
  expect(results.filter((result) => !result.error)).toHaveLength(3);
  expect(results.filter((result) => result.error?.code === "TJ429")).toHaveLength(3);
});

test("read cursors are monotonic and private, and client message times are server-owned", async () => {
  const user = await createUser({ prefix: "read-cursor" });
  const other = await createUser({ prefix: "read-outsider" });
  const client = await signedInClient(user.email, user.password);
  const outsider = await signedInClient(other.email, other.password);
  const { data: requestId, error } = await client.rpc("submit_project_request", {
    p_service: "Web",
    p_message: "Please build a booking website for our clinic.",
  });
  expect(error).toBeNull();
  const { data: conversation } = await admin.from("conversations").select("id").eq("request_id", requestId).single();
  const id = conversation!.id;
  const message = await client
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: user.id,
      sender_type: "client",
      content: "A new message",
      created_at: "2099-01-01T00:00:00Z",
    })
    .select("created_at")
    .single();
  expect(message.error).toBeNull();
  expect(Date.parse(message.data!.created_at)).toBeLessThan(Date.now() + 1000);
  const cursor = message.data!.created_at;
  expect((await client.rpc("mark_conversation_read", { p_conversation_id: id, p_read_at: cursor })).error).toBeNull();
  expect(
    (await client.rpc("mark_conversation_read", { p_conversation_id: id, p_read_at: "2000-01-01T00:00:00Z" })).error,
  ).toBeNull();
  const { data: participant } = await admin
    .from("conversation_participants")
    .select("last_read_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .single();
  expect(Date.parse(participant!.last_read_at)).toBe(Date.parse(cursor));
  expect((await outsider.rpc("mark_conversation_read", { p_conversation_id: id, p_read_at: cursor })).error?.code).toBe(
    "TJ404",
  );
  expect(
    (await browserlessClient().rpc("mark_conversation_read", { p_conversation_id: id, p_read_at: cursor })).error,
  ).not.toBeNull();
});

test("conversation retries reuse one thread and repair missing membership", async () => {
  const user = await createUser({ prefix: "atomic-conversation" });
  const client = await signedInClient(user.email, user.password);
  const request = await client
    .from("project_requests")
    .insert({ user_id: user.id, service: "Web", message: "Please build a reliable booking website." })
    .select("id")
    .single();
  expect(request.error).toBeNull();
  const args = { p_title: "Booking project", p_request_id: request.data!.id };
  const results = await Promise.all(Array.from({ length: 5 }, () => client.rpc("start_client_conversation", args)));
  for (const result of results) expect(result.error).toBeNull();
  const id = results[0]!.data.id;
  expect(new Set(results.map((result) => result.data.id)).size).toBe(1);
  const members = await admin.from("conversation_participants").select("user_id").eq("conversation_id", id);
  expect(members.data).toEqual([{ user_id: user.id }]);
  expect((await admin.from("conversation_participants").delete().eq("conversation_id", id)).error).toBeNull();
  expect((await client.rpc("start_client_conversation", args)).data.id).toBe(id);
  const repaired = await admin.from("conversation_participants").select("user_id").eq("conversation_id", id);
  expect(repaired.data).toEqual([{ user_id: user.id }]);
  const outsider = await createUser({ prefix: "atomic-outsider" });
  const outsiderClient = await signedInClient(outsider.email, outsider.password);
  expect((await outsiderClient.rpc("start_client_conversation", args)).error?.code).toBe("42501");
  const unauthorized = await admin.from("conversations").select("id").eq("client_id", outsider.id);
  expect(unauthorized.data).toEqual([]);
});
