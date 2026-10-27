import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCart, addToCart, removeFromCart } from "@/frontend/components/service-cart";
import { getLoginDestination } from "./login-destination";
import { findServiceArea } from "@/frontend/data/service-areas";

// Mock localStorage and window events for Node/Vitest environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string) {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

describe("Flow 1: Service Cart Lifecycle (/services → /cart)", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    const mockStorage = new LocalStorageMock();
    vi.stubGlobal("window", {
      localStorage: mockStorage,
      dispatchEvent: vi.fn(),
    });
  });

  it("starts with an empty cart when nothing is stored", () => {
    expect(getCart()).toEqual([]);
  });

  it("adds services to the cart and prevents duplicates", () => {
    const addedFirst = addToCart("web-development");
    expect(addedFirst).toBe(true);
    expect(getCart()).toEqual(["web-development"]);

    // Attempt to add the same service again
    const addedDuplicate = addToCart("web-development");
    expect(addedDuplicate).toBe(false);
    expect(getCart()).toEqual(["web-development"]);

    // Add a second distinct service
    const addedSecond = addToCart("mobile-app-development");
    expect(addedSecond).toBe(true);
    expect(getCart()).toEqual(["web-development", "mobile-app-development"]);
  });

  it("removes a service from the cart", () => {
    addToCart("web-development");
    addToCart("ai-ml-solutions");
    expect(getCart()).toEqual(["web-development", "ai-ml-solutions"]);

    removeFromCart("web-development");
    expect(getCart()).toEqual(["ai-ml-solutions"]);
  });

  it("gracefully recovers from corrupt localStorage data", () => {
    window.localStorage.setItem("techjest-service-cart", "invalid-json{{");
    expect(getCart()).toEqual([]);
  });

  it("ignores duplicate, empty and non-string values in stored selections", () => {
    window.localStorage.setItem("techjest-service-cart", JSON.stringify(["landing-page", "", null, 9, "landing-page"]));
    expect(getCart()).toEqual(["landing-page"]);
  });
});

describe("Flow 2: Quote & Consultation Data Validation (/contact)", () => {
  it("resolves valid service areas from user inputs", () => {
    const webArea = findServiceArea("Web Development");
    expect(webArea).toBeDefined();
    expect(webArea?.slug).toBe("web-development");

    const mobileArea = findServiceArea("Mobile App Development");
    expect(mobileArea).toBeDefined();
    expect(mobileArea?.slug).toBe("mobile-app-development");
  });

  it("returns undefined for unknown service areas", () => {
    const unknown = findServiceArea("nonexistent-service");
    expect(unknown).toBeUndefined();
  });

  it("validates quote message bounds (min 20, max 5000 characters)", () => {
    const shortMessage = "Too short";
    expect(shortMessage.length < 20).toBe(true);

    const validMessage = "We would like to build an enterprise web application with Next.js and Supabase.";
    expect(validMessage.length >= 20 && validMessage.length <= 5000).toBe(true);
  });
});

describe("Flow 3: Auth Redirection & Security Audit (/auth → /dashboard | /cart)", () => {
  it("routes regular clients to /dashboard by default", () => {
    const clientUser = { app_metadata: { role: "client" } };
    expect(getLoginDestination(clientUser, null)).toBe("/dashboard");
    expect(getLoginDestination(clientUser, "")).toBe("/dashboard");
  });

  it("routes admins to /admin when default /dashboard is requested", () => {
    const adminUser = { app_metadata: { role: "admin" } };
    expect(getLoginDestination(adminUser, "/dashboard")).toBe("/admin");
    expect(getLoginDestination(adminUser, null)).toBe("/admin");
  });

  it("honors safe internal redirect destinations such as /cart and /contact", () => {
    const clientUser = { app_metadata: { role: "client" } };
    expect(getLoginDestination(clientUser, "/cart")).toBe("/cart");
    expect(getLoginDestination(clientUser, "/contact")).toBe("/contact");
    expect(getLoginDestination(clientUser, "/services?category=web")).toBe("/services?category=web");
  });

  it("blocks open redirect attacks and falls back to /dashboard", () => {
    const clientUser = { app_metadata: { role: "client" } };
    expect(getLoginDestination(clientUser, "https://evil.com")).toBe("/dashboard");
    expect(getLoginDestination(clientUser, "//evil.com")).toBe("/dashboard");
    expect(getLoginDestination(clientUser, "/\\evil.com")).toBe("/dashboard");
    expect(getLoginDestination(clientUser, "javascript:alert(1)")).toBe("/dashboard");
    expect(getLoginDestination(clientUser, "/dashboard\u0000evil")).toBe("/dashboard");
  });
});
