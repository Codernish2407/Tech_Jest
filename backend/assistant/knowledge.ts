// The site assistant's knowledge base: the public website's content as plain text.
// It reuses the data the pages render (catalog, settings, team, homepage copy, service areas) so the two
// stay in step. Text that lives only inside a page component (About values, Contact steps, Portfolio,
// Privacy, Terms) is restated below. Update it when those pages change.
import type { Service } from "@/frontend/data/services";
import type { TeamMember } from "@/frontend/data/team";
import { serviceAreaDetails, serviceAreas } from "@/frontend/data/service-areas";
import { assurances, costAnswer, deliveryProcess, generalFaqs, homeServiceCards } from "@/frontend/data/site-content";
import { formatMoney } from "@/lib/format";

export type KnowledgeInput = {
  siteUrl: string;
  contactEmail: string;
  // wa.me link, or null when no WhatsApp number is configured.
  whatsappHref: string | null;
  team: readonly TeamMember[];
  // null when the live catalog could not be read; the assistant then quotes no prices.
  services: Service[] | null;
};

const bullet = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

function catalogSection({ siteUrl, services }: KnowledgeInput) {
  if (!services) {
    return `The live service catalog could not be loaded just now. Do not quote any service prices or timelines; send the visitor to ${siteUrl}/services instead.`;
  }
  if (!services.length) return `No services are listed at the moment. See ${siteUrl}/services.`;
  return services
    .map((service) =>
      [
        `### ${service.name}`,
        `Page: ${siteUrl}/services/${service.slug}`,
        `Category: ${service.category}`,
        `Description: ${service.description}`,
        `Starting price: ${service.price ? formatMoney(service.price) : "Custom quote"}`,
        `Typical delivery: ${service.delivery}`,
        service.popular ? "Marked as popular." : "",
        service.included.length ? `Included:\n${bullet(service.included)}` : "",
        service.technologies.length ? `Technologies: ${service.technologies.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

export function buildSiteKnowledge(input: KnowledgeInput) {
  const { siteUrl, contactEmail, whatsappHref, team, services } = input;
  const areas = serviceAreas.map((area) => {
    const detail = serviceAreaDetails[area.slug];
    const card = homeServiceCards.find(([, slug]) => slug === area.slug);
    return [
      `### ${area.title}`,
      `Page: ${siteUrl}/services/${area.slug}`,
      card ? `Summary: ${card[2]}` : "",
      detail ? `Intro: ${detail.intro}` : "",
      detail ? `Benefits:\n${bullet(detail.benefits)}` : "",
      detail ? `Deliverables:\n${bullet(detail.deliverables)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const faqs = [["How much does a project cost?", services ? costAnswer(services) : costAnswer([])], ...generalFaqs];

  return `# TechJest website content

## About TechJest
TechJest is a software development company for startups and growing businesses, founded and led by Founders and CEOs Chayan Khatua and Amit Singh Panwar. It designs and builds websites, web applications, mobile apps, AI/ML solutions, cloud infrastructure, and user-focused digital products, and gives teams a clear technical partner from the first idea through launch and ongoing improvement. Service area: India and worldwide.
Tagline: Practical technology for ambitious teams. Built with clarity, shipped with care.
Principles: Clear scope, useful software, long-term thinking.
Commitments: ${assurances.join(", ")}.

## Website pages
- Home: ${siteUrl}/
- Services and prices: ${siteUrl}/services
- Portfolio (our work): ${siteUrl}/portfolio
- About and leadership team: ${siteUrl}/about
- Contact / book a consultation: ${siteUrl}/contact
- Project cart (services picked from the Services page): ${siteUrl}/cart
- Privacy policy: ${siteUrl}/privacy
- Terms of service: ${siteUrl}/terms

## Contact
- Email: ${contactEmail}
${whatsappHref ? `- WhatsApp: ${whatsappHref}\n` : ""}- Contact form: ${siteUrl}/contact (TechJest replies within one business day)
- LinkedIn: https://www.linkedin.com/company/techjest
- Instagram: https://www.instagram.com/techjest_
What happens after you get in touch:
1. We read your note to understand what you want to build or improve.
2. We reply with useful questions to clarify the scope, priorities and next step.
3. We decide if a call helps: a focused conversation when you need one.
To book a service you need a TechJest account: log in or sign up at ${siteUrl}/auth (it is free). Then either send a request from the contact form, or pick services on the Services page, add them to the project cart, and request a quote for that package. What you type is kept while you log in. Your requests, proposals, projects and messages then appear in your private dashboard. For a quick question without an account, email or message TechJest using the contact details above.

## Leadership and team
${team.map((member) => `- ${member.name}, ${member.role} (LinkedIn: ${member.linkedin})`).join("\n")}
The leadership team combines product, technology, finance, operations, and marketing expertise.

## Values (About page)
- Clarity: We write down the decision, the trade-off, and the next step.
- Useful over impressive: We measure progress by what users can do, not by how complex the system sounds.
- Ownership: You receive the knowledge, files, and code needed to keep moving.
- Care: We test the edges, communicate early, and leave things better documented.

## Service areas
${areas.join("\n\n")}

## Service catalog (starting prices in Indian rupees)
Starting prices and timelines are indicative. Final scope, price, and delivery dates are set out in a written proposal that the client accepts before work begins.

${catalogSection(input)}

## Delivery process
${deliveryProcess.map(([step, title, description]) => `${step}. ${title}: ${description}`).join("\n")}

## Frequently asked questions
${faqs.map(([question, answer]) => `Q: ${question}\nA: ${answer}`).join("\n\n")}

## Portfolio
Stream Bird India (${siteUrl}/portfolio): a public-facing company homepage for Stream Bird India, a technology ecosystem focused on network connectivity and physical IT infrastructure. Project: company homepage. Categories: web development, company website. Live website: https://stream-bird-india.vercel.app/

## Privacy policy summary (${siteUrl}/privacy)
- Information collected: when you send a project enquiry, request a quote, or message TechJest, it collects the details you enter: name, email, phone number, company, budget, timeline, and project description. If you create an account, it also stores your sign-in details and the project history linked to it.
- Use: to reply to you, prepare proposals, deliver projects, and keep your project history in your private dashboard. TechJest does not sell personal information.
- Who can see it: the TechJest team, and trusted providers that host the website, store data, and send email notifications, only to provide those services. Information is shared with others only where the law requires it.
- Cookies: only the cookies and browser storage needed to keep you signed in, remember the services in your project cart, and keep a half-written enquiry while you log in.
- Your choices: ask to access, correct, or delete your personal information at any time by emailing ${contactEmail}. Project records are kept as long as needed to deliver the work and meet legal obligations.

## Terms of service summary (${siteUrl}/terms)
- Use the website for lawful purposes; do not misuse it, access areas you are not authorised to use, or submit false or harmful content.
- Starting prices and timelines on the site are indicative; the written proposal you accept before work begins sets the final scope, price, and dates.
- Once a project is paid for in full, the client owns the source code, design files, and documentation created for it, unless the proposal says otherwise. Third-party tools and libraries stay under their own licences.
- The site is provided as is; to the extent the law allows, TechJest is not liable for indirect losses arising from using it.
- Questions about the terms: ${contactEmail}.
`;
}
