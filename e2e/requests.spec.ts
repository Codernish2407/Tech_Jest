import { expect, test, type Page } from "@playwright/test";
import { admin, createUser, logIn, signedInClient, uniqueEmail } from "./helpers";

async function fillCart(page: Page, slugs: string[]) {
  await page.goto("/services");
  await page.evaluate((items) => localStorage.setItem("techjest-service-cart", JSON.stringify(items)), slugs);
  await page.goto("/cart");
  await expect(page.locator("#quote-name")).toBeVisible();
}

test("a successful quote stays successful when browser storage cleanup fails", async ({ page }) => {
  await fillCart(page, ["landing-page"]);
  await page.locator("#quote-name").fill("Storage Guest");
  await page.locator("#quote-email").fill("storage@example.test");
  await page.locator("#quote-phone").fill("12345");
  await page.locator("#quote-message").fill("Please build a landing page for our clinic launch.");
  let submissions = 0;
  await page.route("**/api/contact", (route) => {
    submissions += 1;
    return route.fulfill({ json: { ok: true, guest: true } });
  });
  await page.evaluate(() => {
    Storage.prototype.removeItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.getByRole("button", { name: "Request a quote" }).click();
  await expect(page.getByRole("heading", { name: "We’ll be in touch." })).toBeVisible();
  await expect(page.getByText("We could not connect to TechJest. Please try again.")).toHaveCount(0);
  expect(submissions).toBe(1);
});

test("blocked cart storage shows an actionable error instead of a false success", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/services/landing-page");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Add to project", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("Your browser could not save the cart");
  expect(errors).toEqual([]);
});

test("a signed-in client sends a request into their workspace", async ({ page }) => {
  const user = await createUser({ prefix: "client-request" });
  await logIn(page, user.email, user.password);
  await page.goto("/contact");
  await page.locator("#service").selectOption("Web Development");
  await page.locator("#message").fill("We need a booking website for our clinic, with payments.");
  await page.getByRole("button", { name: "Save project request" }).click();
  await expect(page.getByRole("heading", { name: "Request saved." })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "View conversation →" })).toBeVisible();
  await page.goto("/messages");
  await expect(page.getByText("We need a booking website for our clinic, with payments.").first()).toBeVisible();
});

test("a visitor sends an enquiry without an account", async ({ page }) => {
  const email = uniqueEmail("guest-contact");
  await page.goto("/contact?service=web-development");
  await expect(page.locator("#service")).toHaveValue("Web Development");
  await page.locator("#contact-name").fill("Contact Guest");
  await page.locator("#contact-email").fill(email);
  await page.locator("#message").fill("We need help rebuilding our company website this quarter.");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(`We’ll reply to ${email}`)).toBeVisible();

  const { data } = await admin.from("project_requests").select("user_id, service").eq("email", email);
  expect(data).toEqual([{ user_id: null, service: "Web Development" }]);
});

test("a form filled in by a bot looks sent but saves nothing", async ({ page }) => {
  const email = uniqueEmail("bot");
  await page.goto("/contact");
  await page.locator("#service").selectOption("Web Development");
  await page.locator("#contact-name").fill("Bot");
  await page.locator("#contact-email").fill(email);
  await page.locator("#message").fill("Buy cheap things at our website, best prices guaranteed!!");
  // People never see this field; bots fill every field they find.
  await page.locator("#contact-website").fill("http://spam.example", { force: true });
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("heading", { name: "Request sent." })).toBeVisible();
  const { data } = await admin.from("project_requests").select("id").eq("email", email);
  expect(data).toEqual([]);
});

test("a visitor sends a cart quote without an account", async ({ page }) => {
  const email = uniqueEmail("guest-cart");
  await fillCart(page, ["landing-page"]);
  await expect(page.getByText("No account needed")).toBeVisible();
  await page.locator("#quote-name").fill("Guest Cart");
  await page.locator("#quote-email").fill(email);
  await page.locator("#quote-phone").fill("12345");
  await page.locator("#quote-message").fill("We would like a landing page for our new clinic launch.");
  await page.getByRole("button", { name: "Request a quote" }).click();
  await expect(page.getByText("We’ll reply within one business day by email.")).toBeVisible();

  const { data: rows } = await admin.from("project_requests").select("id, user_id").eq("email", email);
  expect(rows).toHaveLength(1);
  expect(rows?.[0]?.user_id).toBeNull();
  const { count } = await admin
    .from("project_request_services")
    .select("*", { count: "exact", head: true })
    .eq("request_id", rows![0]!.id);
  expect(count).toBe(1);
});

test("choosing to log in first keeps the cart quote form", async ({ page }) => {
  const quoteEmail = uniqueEmail("draft");
  await fillCart(page, ["landing-page"]);
  await page.locator("#quote-name").fill("Draft Person");
  await page.locator("#quote-email").fill(quoteEmail);
  await page.locator("#quote-phone").fill("12345");
  await page.locator("#quote-timeline").selectOption("1–3 months");
  await page.locator("#quote-message").fill("Long description of the clinic booking project we want to build.");
  await page.getByRole("link", { name: "log in or sign up" }).click();
  await expect(page).toHaveURL(/\/auth\?next=\/cart$/);

  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.locator("#full-name").fill("Cart Person");
  await page.locator("#purpose").fill("Clinic booking");
  await page.locator("#auth-email").fill(uniqueEmail("cart-signup"));
  await page.locator("#auth-password").fill("CartPass123");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator("#quote-name")).toHaveValue("Draft Person");
  await expect(page.locator("#quote-message")).toHaveValue(/^Long description/);
  await expect(page.locator("#quote-timeline")).toHaveValue("1–3 months");
  await expect(page.getByText("No account needed")).toHaveCount(0);

  await page.getByRole("button", { name: "Request a quote" }).click();
  await expect(page.getByRole("link", { name: "View your project history" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("techjest-quote-draft"))).toBeNull();
  const { data } = await admin.from("project_requests").select("user_id, timeline").eq("email", quoteEmail);
  expect(data).toHaveLength(1);
  expect(data?.[0]?.user_id).not.toBeNull();
  expect(data?.[0]?.timeline).toBe("1–3 months");
});

test("cached pages show who is signed in, and the bell clears once a reply is read", async ({ page }) => {
  const user = await createUser({ prefix: "bell", name: "Bella Client" });
  const team = await createUser({ prefix: "bell-admin", role: "admin" });
  const client = await signedInClient(user.email, user.password);
  const { data: requestId } = await client.rpc("submit_project_request", {
    p_service: "Web Development",
    p_message: "Please build our booking website soon.",
  });
  const { data: conversation } = await admin.from("conversations").select("id").eq("request_id", requestId).single();
  await admin.from("messages").insert({
    conversation_id: conversation!.id,
    sender_id: team.id,
    sender_type: "admin",
    content: "Thanks! We'll call you tomorrow.",
    message_type: "text",
  });

  await page.goto("/about");
  await expect(page.locator(".nav-links").getByRole("link", { name: "Login" })).toBeVisible();
  await expect(page.locator(".profile-badge")).toHaveCount(0);

  await logIn(page, user.email, user.password);
  await page.goto("/about");
  await expect(page.locator(".profile-badge")).toContainText("Bella Client");
  await expect(page.locator(".nav-links").getByRole("link", { name: "Login" })).toHaveCount(0);
  await expect(page.locator(".message-notification b")).toHaveText("1");

  await page.goto(`/messages?conversation=${conversation!.id}`);
  await expect(page.getByText("Thanks! We'll call you tomorrow.")).toBeVisible();
  await expect(page.locator(".message-notification b")).toHaveCount(0);
});
