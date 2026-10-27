import { expect, test } from "@playwright/test";

test("public pages are served from the cache", async ({ request }) => {
  // (The sitemap is rebuilt on the same schedule but sent with Next's own sitemap headers.)
  for (const path of ["/", "/services", "/about", "/contact", "/portfolio"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"], path).toContain("s-maxage=300");
  }
});

test("the welcome animation never downloads a video", async ({ page }) => {
  const videos: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp4")) videos.push(new URL(page.url()).pathname);
  });
  await page.goto("/?intro=1");
  await page.goto("/opening_animation_video");
  await page.goto("/services");
  await page.goto("/about");
  expect(videos).toEqual([]);
});

test("every sitemap link works", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]!).pathname);
  expect(urls.length).toBeGreaterThan(5);
  for (const path of urls) expect((await request.get(path)).status(), path).toBe(200);
});

test("each public page shares its own title, link, and preview image", async ({ page, request }) => {
  const services = (await (await request.get("/api/services")).json()) as { slug: string }[];
  const paths = ["/", "/about", "/contact", "/services", "/portfolio", "/privacy", "/terms"];
  paths.push("/services/web-development", `/services/${services[0]!.slug}`);
  const homeTitle = await (async () => {
    await page.goto("/");
    return page.locator('meta[property="og:title"]').getAttribute("content");
  })();
  for (const path of paths) {
    await page.goto(path);
    const og = (name: string) => page.locator(`meta[property="og:${name}"]`).first().getAttribute("content");
    expect(new URL((await og("url"))!).pathname, path).toBe(path);
    expect(await og("image"), path).toContain("/opengraph-image");
    if (path !== "/") expect(await og("title"), path).not.toBe(homeTitle);
    expect((await page.title()).match(/TechJest/g), path).toHaveLength(1);
  }
});

test("a service page links to every other service in its category", async ({ page, request }) => {
  const services = (await (await request.get("/api/services")).json()) as { slug: string; category: string }[];
  const byCategory = Map.groupBy(services, (item) => item.category);
  const [, siblings] = [...byCategory].find(([, items]) => items.length >= 3)!;
  await page.goto(`/services/${siblings[0]!.slug}`);
  const related = page.locator(".related-services .service-card a");
  await expect(related).toHaveCount(siblings.length - 1);
});

test("the homepage hydrates without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
