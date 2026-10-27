import { expect, test } from "@playwright/test";
import { admin, browserlessClient, createUser, logIn, logInAsAdmin, signedInClient } from "./helpers";

// A client with one request, a reply from the team, a sent proposal, and a project with a sent invoice.
async function clientWithProposal(options: { validUntil?: string | null; status?: string } = {}) {
  const user = await createUser({ prefix: "deal", name: "Priya Sharma" });
  const team = await createUser({ prefix: "deal-admin", role: "admin" });
  const client = await signedInClient(user.email, user.password);
  const { data: requestId, error } = await client.rpc("submit_project_request", {
    p_service: "Clinic booking platform",
    p_message: "We want patients to book and pay online for our three clinics.",
    p_email: user.email,
  });
  if (error) throw error;
  const { data: conversation } = await admin.from("conversations").select("id").eq("request_id", requestId).single();
  await admin.from("messages").insert({
    conversation_id: conversation!.id,
    sender_id: team.id,
    sender_type: "admin",
    content: "Here is our proposal. Let us know what you think.",
    message_type: "text",
  });
  const { data: proposal } = await admin
    .from("proposals")
    .insert({
      request_id: requestId,
      title: "Proposal: Clinic booking platform",
      summary: "Booking, payments, and reminders for three clinics.",
      amount: 320000,
      currency: "INR",
      valid_until: options.validUntil === undefined ? "2099-12-31" : options.validUntil,
      status: options.status ?? "sent",
    })
    .select("id")
    .single();
  const { data: project } = await admin
    .from("projects")
    .insert({ request_id: requestId, name: "Sharma Clinics platform", status: "active" })
    .select("id")
    .single();
  await admin.from("invoices").insert({
    project_id: project!.id,
    request_id: requestId,
    number: `TJ-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    amount: 96000,
    status: "sent",
    due_date: "2099-01-15",
  });
  return {
    user,
    team,
    client,
    requestId: requestId as string,
    conversationId: conversation!.id,
    proposalId: proposal!.id,
    projectId: project!.id,
  };
}

test("a client sees what needs attention and accepts a proposal", async ({ page }) => {
  const deal = await clientWithProposal();
  await logIn(page, deal.user.email, deal.user.password);
  const attention = page.locator(".attention-panel");
  await expect(attention).toContainText("1 new message from the TechJest team");
  await expect(attention).toContainText("Proposal to review: Proposal: Clinic booking platform");
  await expect(attention).toContainText("Invoice TJ-");

  const card = page.locator(`#proposal-${deal.proposalId}`);
  await expect(card).toContainText("Awaiting your decision");
  await card.getByRole("button", { name: "Accept proposal" }).click();
  await expect(card).toContainText("Proposal · Accepted");
  await expect(card.getByRole("button", { name: "Accept proposal" })).toHaveCount(0);

  const { data: proposal } = await admin.from("proposals").select("status").eq("id", deal.proposalId).single();
  expect(proposal?.status).toBe("accepted");
  const { data: request } = await admin.from("project_requests").select("lead_stage").eq("id", deal.requestId).single();
  expect(request?.lead_stage).toBe("won");
  const { data: notes } = await admin.from("admin_notifications").select("title").eq("request_id", deal.requestId);
  expect(notes?.map((note) => note.title)).toContain("Proposal accepted");

  // The answer is part of the conversation the team reads.
  await page.goto(`/messages?conversation=${deal.conversationId}`);
  await expect(page.locator(".message-system")).toContainText("Proposal accepted: Proposal: Clinic booking platform");
});

test("a client declines a proposal from the project page", async ({ page }) => {
  const deal = await clientWithProposal();
  await logIn(page, deal.user.email, deal.user.password);
  await page.goto(`/project/${deal.projectId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Declined", { exact: false }).first()).toBeVisible();
  const { data } = await admin.from("proposals").select("status").eq("id", deal.proposalId).single();
  expect(data?.status).toBe("declined");
});

test("a proposal can be answered once, by its own client, while it is valid", async () => {
  const deal = await clientWithProposal();
  const answer = (client: typeof deal.client, id: string, accept = true) =>
    client.rpc("respond_to_proposal", { p_proposal_id: id, p_accept: accept });
  expect((await answer(deal.client, deal.proposalId)).error).toBeNull();
  expect((await answer(deal.client, deal.proposalId, false)).error?.code).toBe("TJ409");

  const expired = await clientWithProposal({ validUntil: "2020-01-01" });
  expect((await answer(expired.client, expired.proposalId)).error?.code).toBe("TJ409");
  const draft = await clientWithProposal({ status: "draft" });
  expect((await answer(draft.client, draft.proposalId)).error?.code).toBe("TJ404");

  const other = await clientWithProposal();
  expect((await answer(deal.client, other.proposalId)).error?.code).toBe("TJ404");
  expect((await answer(browserlessClient(), other.proposalId)).error).not.toBeNull();
  const { data } = await admin.from("proposals").select("status").eq("id", other.proposalId).single();
  expect(data?.status).toBe("sent");
});

test("a long thread opens at the newest message", async ({ page }) => {
  const deal = await clientWithProposal();
  await admin.from("messages").insert(
    Array.from({ length: 130 }, (_, index) => ({
      conversation_id: deal.conversationId,
      sender_id: deal.team.id,
      sender_type: "admin",
      content: `Update number ${index + 1}`,
      message_type: "text",
      created_at: new Date(Date.now() + index).toISOString(),
    })),
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await logIn(page, deal.user.email, deal.user.password);
  await page.goto(`/messages?conversation=${deal.conversationId}`);
  await expect(page.getByText("Update number 130", { exact: true })).toBeVisible();
  await expect(page.getByText("Update number 1", { exact: true })).toHaveCount(0);
  const list = page.locator(".message-list");
  await expect
    .poll(() => list.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
    .toBeLessThan(5);
  await page.getByRole("button", { name: "Load earlier messages" }).click();
  await expect(page.getByText("Update number 1", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Load earlier messages" })).toHaveCount(0);
  await page.getByLabel("Message", { exact: true }).fill("A reply after 130 updates.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("A reply after 130 updates.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("A reply after 130 updates.", { exact: true })).toBeVisible();
});

test("on a phone the admin console starts with its workspace selector", async ({ page }) => {
  const deal = await clientWithProposal();
  await page.setViewportSize({ width: 375, height: 812 });
  await logInAsAdmin(page, deal.team.email, deal.team.password);
  await page.goto("/admin/settings");
  await expect(page.locator(".admin-sidebar h2")).toBeHidden();
  const selector = page.getByRole("combobox", { name: "Admin workspace" });
  await expect(selector).toHaveValue("/admin/settings");
  const box = await selector.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);

  // A busy CRM stage scrolls inside its column instead of making the page thousands of pixels tall.
  await page.goto("/admin/crm");
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(pageHeight).toBeLessThan(3000);

  // Create forms fold away once there is something to show.
  await page.goto(`/admin/requests/${deal.requestId}`);
  await expect(page.locator("details.admin-add", { hasText: "New proposal" })).not.toHaveAttribute("open", "");
  await expect(page.locator("details.admin-add", { hasText: "New project" })).not.toHaveAttribute("open", "");
  await page.getByText("+ New proposal").click();
  await expect(page.getByRole("button", { name: "Save proposal" })).toBeVisible();
});

test("clients see which conversation has new replies, and messages show the day", async ({ page }) => {
  const user = await createUser({ prefix: "badges", name: "Neha Gupta" });
  const team = await createUser({ prefix: "badges-admin", role: "admin" });
  const client = await signedInClient(user.email, user.password);
  const conversationFor = async (service: string) => {
    const { data: requestId, error } = await client.rpc("submit_project_request", {
      p_service: service,
      p_message: "We need help with this part of the business, please.",
      p_email: user.email,
    });
    if (error) throw error;
    const { data } = await admin.from("conversations").select("id").eq("request_id", requestId).single();
    return data!.id as string;
  };
  const replied = await conversationFor("Inventory app");
  const latest = await conversationFor("Company website");
  // A team reply in one conversation, then the client's own message in the other, so the second
  // conversation is newest and opens first, leaving the reply waiting in the list.
  await admin.from("messages").insert({
    conversation_id: replied,
    sender_id: team.id,
    sender_type: "admin",
    content: "We have a first plan for the inventory app.",
    message_type: "text",
  });
  await admin.from("messages").insert({
    conversation_id: latest,
    sender_id: user.id,
    sender_type: "client",
    content: "Any update on the website?",
    message_type: "text",
  });

  await logIn(page, user.email, user.password);
  await page.goto("/messages");
  await expect(page.locator(`a[href="/messages?conversation=${replied}"]`)).toContainText("1 new");
  await expect(page.locator(`a[href="/messages?conversation=${latest}"]`)).not.toContainText("new");
  await expect(page.locator(".message-day").first()).toHaveText("Today");

  // Ctrl + Enter sends, and the "Sent" note clears by itself.
  const box = page.getByLabel("Message", { exact: true });
  await box.fill("Sent with the keyboard shortcut.");
  await box.press("Control+Enter");
  await expect(page.locator(".message-bubble").getByText("Sent with the keyboard shortcut.")).toBeVisible();
  await expect(box).toHaveValue("");
  await expect(page.getByRole("status")).toHaveText("Sent");
  await expect(page.getByRole("status")).toBeHidden({ timeout: 6000 });
});
