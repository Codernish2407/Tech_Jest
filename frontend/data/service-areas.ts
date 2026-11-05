// The six broad service areas promoted on the homepage. They have their own
// /services/[slug] pages and are the choices on the contact form, so the contact
// API must accept them alongside the live catalog's services and categories.
// catalogCategory is the live catalog category whose services each area page lists as related;
// Cloud & DevOps has no single matching category, so its page lists none.
export const serviceAreas = [
  { slug: "web-development", title: "Web Development", catalogCategory: "Web Development" },
  { slug: "mobile-app-development", title: "Mobile App Development", catalogCategory: "Mobile Development" },
  { slug: "ai-ml-solutions", title: "AI / ML Solutions", catalogCategory: "AI & Automation" },
  { slug: "cloud-devops", title: "Cloud & DevOps", catalogCategory: null },
  { slug: "ui-ux-design", title: "UI / UX Design", catalogCategory: "Design" },
  { slug: "it-consulting-support", title: "IT Consulting & Support", catalogCategory: "Maintenance & Support" },
] as const;

// The page copy for each service area (/services/[slug]). The site assistant answers from it too.
export const serviceAreaDetails: Record<
  string,
  { title: string; intro: string; benefits: string[]; deliverables: string[] }
> = {
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

export const notSureService = "Not sure yet";

export function findServiceArea(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return serviceAreas.find((area) => area.slug === normalized || area.title.toLowerCase() === normalized);
}
