import { createPublicClient } from "@/backend/supabase/public";
import { services as fallbackServices } from "@/frontend/data/services";
import type { Service } from "@/frontend/data/services";

function fromRow(row: Record<string, unknown>): Service {
  return {
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category) as Service["category"],
    description: String(row.description),
    price: typeof row.price === "number" ? row.price : null,
    delivery: String(row.delivery),
    popular: Boolean(row.popular),
    included: Array.isArray(row.included) ? row.included.filter((item) => typeof item === "string") : [],
    technologies: Array.isArray(row.technologies) ? row.technologies.filter((item) => typeof item === "string") : [],
  };
}

export async function getServiceCatalog(): Promise<{
  services: Service[];
  status: "ready" | "unavailable";
  fallbackAvailable?: boolean;
}> {
  try {
    // No cookies: the public catalog keeps the services pages cacheable.
    const { data, error } = await createPublicClient()
      .from("service_catalog")
      .select("slug, name, category, description, price, delivery, popular, included, technologies")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!error)
      return { services: (data ?? []).map((row) => fromRow(row as Record<string, unknown>)), status: "ready" };
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { services: [], status: "unavailable", fallbackAvailable: true };
    }
    console.error("Could not load the service catalog", { code: error.code, message: error.message });
    return { services: [], status: "unavailable" };
  } catch (error) {
    console.error("Could not connect to the service catalog", error);
    return { services: [], status: "unavailable", fallbackAvailable: true };
  }
}

// Legacy informational pages may show the bundled service descriptions. Quote and
// catalog screens use getServiceCatalog so stale prices are never shown as current.
export async function getServices(options: { fallbackOnMissingTable?: boolean } = {}): Promise<Service[]> {
  const result = await getServiceCatalog();
  return result.fallbackAvailable && (options.fallbackOnMissingTable ?? true) ? fallbackServices : result.services;
}

export { fallbackServices };
