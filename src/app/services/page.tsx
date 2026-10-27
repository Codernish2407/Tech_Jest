import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { ServiceMarketplace } from "@/frontend/components/service-marketplace";
import { getServiceCatalog } from "@/backend/supabase/services";
import { jsonLd } from "@/lib/json-ld";

// Cached like the other public pages; saving in Admin → Services refreshes it straight away.
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Web, App & AI Development Services",
  description:
    "Explore TechJest's web development, AI automation, mobile app, cloud, UI/UX, and IT consulting services. Build a custom package and request a quote.",
  path: "/services",
});

export default async function Services() {
  const { services, status } = await getServiceCatalog();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "TechJest IT Services Marketplace",
            description: "Browse practical web, mobile, AI, cloud, design, and support services from TechJest.",
            url: `${getSiteUrl()}/services`,
            about: { "@id": `${getSiteUrl()}/#organization` },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: services.length,
              itemListElement: services.slice(0, 50).map((service, index) => ({
                "@type": "ListItem",
                position: index + 1,
                item: {
                  "@type": "Service",
                  name: service.name,
                  description: service.description,
                  url: `${getSiteUrl()}/services/${service.slug}`,
                  provider: { "@id": `${getSiteUrl()}/#organization` },
                  areaServed: "Worldwide",
                },
              })),
            },
          }),
        }}
      />
      <ServiceMarketplace services={services} unavailable={status === "unavailable"} />
    </>
  );
}
