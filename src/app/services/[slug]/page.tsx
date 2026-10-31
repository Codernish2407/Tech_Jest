import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServices } from "@/backend/supabase/services";
import { AddToCartButton } from "@/frontend/components/service-cart";
import { getSiteUrl } from "@/lib/site-url";
import { jsonLd } from "@/lib/json-ld";
import { pageMetadata } from "@/lib/page-metadata";
import { serviceAreas } from "@/frontend/data/service-areas";
import { Scene3D } from "@/frontend/components/scene-3d";
import { RiseTitle } from "@/frontend/components/hero-title";
import type { SceneVariant } from "@/frontend/components/scene-3d-world";

// Each service shows the thing it delivers in its 3D banner, matched on its slug or catalog category.
function sceneFor(slug: string, category: string | null | undefined): SceneVariant {
  const key = `${slug} ${category ?? ""}`.toLowerCase();
  if (/mobile|android|ios|flutter|react-native/.test(key)) return "mobile";
  if (/(^|[^a-z])ai([^a-z]|$)|machine|ml-|automation|chatbot|agent/.test(key)) return "ai";
  if (/cloud|devops|hosting|server|deploy/.test(key)) return "cloud";
  if (/design|ux|brand|figma/.test(key)) return "design";
  if (/support|maintenance|consult|audit|bug/.test(key)) return "automation";
  if (/web|site|commerce|landing|seo/.test(key)) return "web";
  return "emblem";
}

// Each service page is built on its first visit, then cached; saving in Admin → Services refreshes it.
export const revalidate = 300;

// No pages at build time (the catalog lives in the database); each one is built on its first visit.
export function generateStaticParams() {
  return [];
}

const data: Record<string, { title: string; intro: string; benefits: string[]; deliverables: string[] }> = {
  "web-development": {
    title: "Web Development",
    intro: "Digital experiences that make your offer easier to understand, trust, and choose.",
    benefits: [
      "A clear path from first visit to action",
      "Fast pages that respect attention",
      "A codebase your team can extend",
    ],
    deliverables: [
      "Discovery and information architecture",
      "Responsive interface implementation",
      "CMS or content model",
      "Analytics-ready launch",
    ],
  },
  "mobile-app-development": {
    title: "Mobile App Development",
    intro: "Mobile products that feel natural to use and practical to maintain.",
    benefits: [
      "Choose native or cross-platform with evidence",
      "Design for the moments that matter",
      "A launch plan beyond the app store",
    ],
    deliverables: [
      "User flows and prototypes",
      "iOS and Android implementation",
      "App analytics setup",
      "Release and handover support",
    ],
  },
  "ai-ml-solutions": {
    title: "AI / ML Solutions",
    intro: "Practical AI for the work that takes too long, gets repeated, or needs a better signal.",
    benefits: ["Start with a measurable use case", "Keep data privacy in the design", "Test accuracy before scale"],
    deliverables: [
      "Use-case and data audit",
      "Document processing or assistant workflow",
      "Evaluation criteria and test set",
      "Human-in-the-loop controls",
    ],
  },
  "cloud-devops": {
    title: "Cloud & DevOps",
    intro: "Infrastructure and delivery systems that help your team ship with confidence.",
    benefits: [
      "Shorter, safer release cycles",
      "Visibility when something changes",
      "Cost and security considered together",
    ],
    deliverables: [
      "Cloud architecture review",
      "CI/CD pipeline",
      "Monitoring and alerting",
      "Runbooks and team handover",
    ],
  },
  "ui-ux-design": {
    title: "UI / UX Design",
    intro: "Interfaces that turn complex decisions into clear next steps.",
    benefits: [
      "Research before decoration",
      "Prototypes that answer questions early",
      "A system that keeps quality consistent",
    ],
    deliverables: [
      "Research plan and user flows",
      "Wireframes and clickable prototype",
      "Visual direction and design system",
      "Usability test findings",
    ],
  },
  "it-consulting-support": {
    title: "IT Consulting & Support",
    intro: "A calm, experienced second brain for your technology decisions and day-to-day reality.",
    benefits: [
      "A sharper view of technical trade-offs",
      "A prioritised plan, not a long wish list",
      "Support that fits your internal team",
    ],
    deliverables: [
      "Technical audit or architecture review",
      "Roadmap and risk register",
      "Maintenance and support plan",
      "Documentation your team can use",
    ],
  },
};

async function getService(slug: string) {
  const services = await getServices();
  const catalogService = services.find((item) => item.slug === slug);
  const service =
    data[slug] ??
    (catalogService
      ? {
          title: catalogService.name,
          intro: catalogService.description,
          benefits: catalogService.included.slice(0, 3),
          deliverables: catalogService.included,
        }
      : undefined);
  return { services, catalogService, service };
}

// The search snippet: the service's own intro plus its real price and timeline when the catalog has them,
// kept to 160 characters so Google shows it whole.
function serviceDescription(
  service: { title: string; intro: string },
  catalogService: { price: number | null; delivery: string } | undefined,
) {
  const detail = catalogService
    ? `${catalogService.price ? `From ₹${catalogService.price.toLocaleString("en-IN")}` : "Custom quote"}, delivered in ${catalogService.delivery}.`
    : `${service.title} services from TechJest for growing businesses.`;
  const full = `${service.intro} ${detail}`;
  return full.length <= 160 ? full : service.intro;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { catalogService, service } = await getService(slug);
  if (!service) return {};
  return {
    ...pageMetadata({
      title: `${service.title} Services`,
      description: serviceDescription(service, catalogService),
      path: `/services/${slug}`,
    }),
    keywords: [service.title, "TechJest", "software development", ...(catalogService?.technologies ?? [])],
  };
}

export default async function Service({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { services, catalogService, service } = await getService(slug);
  if (!service) notFound();
  const siteUrl = getSiteUrl();
  const serviceUrl = `${siteUrl}/services/${slug}`;
  // Broad service areas have no cart item, so they go straight to the contact form.
  const contactHref = `/contact?service=${encodeURIComponent(slug)}`;
  // Every other service in the same category, so each service page is linked from all its siblings.
  const relatedCategory =
    catalogService?.category ?? serviceAreas.find((area) => area.slug === slug)?.catalogCategory ?? null;
  const relatedServices = relatedCategory
    ? services.filter((item) => item.category === relatedCategory && item.slug !== slug)
    : [];
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${serviceUrl}#service`,
    name: service.title,
    description: service.intro,
    url: serviceUrl,
    provider: { "@id": `${siteUrl}/#organization` },
    areaServed: "Worldwide",
    serviceType: service.title,
    ...(catalogService?.price
      ? { offers: { "@type": "Offer", price: catalogService.price, priceCurrency: "INR" } }
      : {}),
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TechJest", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Services", item: `${siteUrl}/services` },
      { "@type": "ListItem", position: 3, name: service.title, item: serviceUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />
      <section className="page-hero">
        <div className="container service-detail-hero">
          <div className="eyebrow">
            <Link href="/services">Services</Link> / {service.title}
          </div>
          <RiseTitle text={service.title} />
          <p className="lead">{service.intro}</p>
          {catalogService && (
            <div className="service-detail-price">
              <strong>
                {catalogService.price ? `From ₹${catalogService.price.toLocaleString("en-IN")}` : "Custom quote"}
              </strong>
              <span>⏱ {catalogService.delivery}</span>
            </div>
          )}
          <div className="hero-actions">
            {catalogService ? (
              <>
                <AddToCartButton service={catalogService} />
                <Link className="btn btn-ghost" href="/cart#quote">
                  Request a quote
                </Link>
              </>
            ) : (
              <Link className="btn btn-primary" href={contactHref}>
                Start a project
              </Link>
            )}
          </div>
        </div>
        <Scene3D variant={sceneFor(slug, catalogService?.category ?? relatedCategory)} className="page-hero-scene" />
      </section>
      <section className="section">
        <div className="container detail-grid">
          <div>
            <div className="eyebrow">What changes</div>
            <h2>Useful from the first release.</h2>
            <div className="list">
              {service.benefits.map((item, index) => (
                <div className="list-item" key={item}>
                  <strong>0{index + 1}</strong>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow">What you receive</div>
            <h2>Concrete deliverables.</h2>
            <div className="list">
              {service.deliverables.map((item) => (
                <div className="list-item" key={item}>
                  <strong>✓</strong>
                  <p>{item}</p>
                </div>
              ))}
            </div>
            {catalogService && (
              <>
                <div className="eyebrow detail-tech-eyebrow">Technologies</div>
                <p>{catalogService.technologies.join(" · ")}</p>
              </>
            )}
          </div>
        </div>
      </section>
      {relatedServices.length > 0 && (
        <section className="section related-services">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">Build the full solution</div>
                <h2>Related {relatedCategory} services.</h2>
              </div>
              <Link className="card-link" href="/services">
                Browse all services
              </Link>
            </div>
            <div className="service-grid">
              {relatedServices.map((item) => (
                <article className="service-card" key={item.slug}>
                  <div className="eyebrow">{item.category}</div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <Link className="card-link" href={`/services/${item.slug}`}>
                    View details →
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="cta">
        <div className="container cta-row">
          <div>
            <div className="eyebrow">Ready when you are</div>
            <h2>Let’s talk about {service.title}.</h2>
          </div>
          {catalogService ? (
            <Link className="btn btn-primary" href="/cart#quote">
              Build your project package
            </Link>
          ) : (
            <Link className="btn btn-primary" href={contactHref}>
              Start a project
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
