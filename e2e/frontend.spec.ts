import { expect, test } from "@playwright/test";
import { createUser, logIn, logInAsAdmin } from "./helpers";

const publicPaths = [
  "/",
  "/services",
  "/services/web-development",
  "/portfolio",
  "/about",
  "/contact",
  "/cart",
  "/auth",
  "/auth/reset",
  "/admin/login",
  "/privacy",
  "/terms",
  "/missing-page",
  "/opening_animation_video",
];
for (const width of [360, 768, 1280]) {
  test(`public pages fit ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of publicPaths) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), path).toBe(true);
    }
  });
}

test("mobile navigation closes on Escape and follows the cart link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services");
  const trigger = page.getByRole("button", { name: "Open menu" });
  await trigger.click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Services", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator("#mobile-navigation-panel")).toHaveCount(0);
  await trigger.click();
  await page.locator("#mobile-navigation-panel .cart-link").click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator("#mobile-navigation-panel")).toHaveCount(0);
});

test("service filters recover from no results and expose selected state", async ({ page }) => {
  await page.goto("/services");
  await page.getByRole("searchbox", { name: "Search services" }).fill("no-service-matches-this-text");
  await expect(page.getByRole("heading", { name: "No services found." })).toBeVisible();
  await page.getByRole("button", { name: "Show all services" }).click();
  await expect(page.getByRole("searchbox", { name: "Search services" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("cart preserves selections through a catalog outage and retries", async ({ page, request }) => {
  const catalog = await (await request.get("/api/services")).json();
  await page.addInitScript(
    (slug) => localStorage.setItem("techjest-service-cart", JSON.stringify([slug])),
    catalog[0].slug,
  );
  let unavailable = true;
  await page.route("**/api/services", (route) =>
    route.fulfill({
      status: unavailable ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(unavailable ? { error: "Unavailable" } : catalog),
    }),
  );
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "We couldn’t load current services and prices." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your project cart is empty." })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("techjest-service-cart")!))).toEqual([
    catalog[0].slug,
  ]);
  unavailable = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".cart-item h2")).toHaveText(catalog[0].name);
  await expect(page.getByRole("button", { name: "Request a quote", exact: true })).toBeEnabled();
});

test("client workspace navigation fits a phone", async ({ page }) => {
  const user = await createUser({ prefix: "frontend-client" });
  await page.setViewportSize({ width: 360, height: 800 });
  await logIn(page, user.email, user.password);
  await page.getByRole("navigation", { name: "Client workspace" }).getByRole("link", { name: "Messages" }).click();
  await expect(page).toHaveURL(/\/messages$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("every admin section is reachable using the phone workspace selector", async ({ page }) => {
  const user = await createUser({ prefix: "frontend-admin", role: "admin" });
  await page.setViewportSize({ width: 360, height: 800 });
  await logInAsAdmin(page, user.email, user.password);
  const selector = page.getByRole("combobox", { name: "Admin workspace" });
  const destinations = await selector
    .locator("option")
    .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  for (const destination of destinations) {
    await selector.selectOption(destination);
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(page.locator(".admin-content h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), destination).toBe(
      true,
    );
  }
});
