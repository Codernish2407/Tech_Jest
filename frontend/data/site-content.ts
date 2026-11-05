// Homepage copy that the site assistant (backend/assistant/knowledge.ts) also answers from.
// Edit it here and both the page and the assistant change together.
import type { Service } from "@/frontend/data/services";
import { formatMoney } from "@/lib/format";

// [title, service area slug, summary]
export const homeServiceCards = [
  ["Web development", "web-development", "Marketing sites, web apps, and e-commerce that stay fast and maintainable."],
  [
    "Mobile app development",
    "mobile-app-development",
    "Cross-platform and native apps designed for real-world adoption.",
  ],
  ["AI / ML solutions", "ai-ml-solutions", "Useful automation, assistants, and forecasting grounded in your data."],
  ["Cloud & DevOps", "cloud-devops", "Reliable deployments, observability, and infrastructure that scales with you."],
  ["UI / UX design", "ui-ux-design", "Research-led interfaces that help people understand and act."],
  [
    "IT consulting & support",
    "it-consulting-support",
    "A practical technical partner for decisions, audits, and upkeep.",
  ],
] as const;

// [step number, title, description]
export const deliveryProcess = [
  ["01", "Understand", "We understand your business before writing code."],
  ["02", "Design", "We create the product architecture and UX."],
  ["03", "Build", "Agile development with regular client updates."],
  ["04", "Test", "QA, security, and performance testing."],
  ["05", "Deploy", "Production deployment and monitoring."],
  ["06", "Support", "Post-launch maintenance and improvements."],
] as const;

// Each line restates a commitment already made on the site (services, FAQ, contact).
export const assurances = ["Six service areas", "Weekly demos", "You own the code", "Replies within one business day"];

// The cost answer quotes real starting prices from the live catalog, so it stays true when prices change
// in the admin console. With no priced services it falls back to the general answer.
export function costAnswer(services: Service[]) {
  const priced = services.filter((item): item is Service & { price: number } => item.price !== null && item.price > 0);
  if (!priced.length) {
    return "It depends on the scope and the outcome you need. We’ll give you a clear proposal after a short discovery call.";
  }
  const cheapest = priced.reduce((low, item) => (item.price < low.price ? item : low));
  const examples = priced
    .filter((item) => item.popular && item.slug !== cheapest.slug)
    .sort((a, b) => b.price - a.price)
    .slice(0, 2);
  const quote = (item: Service & { price: number }) =>
    `${item.name} from ${formatMoney(item.price)} (${item.delivery})`;
  const range = examples.length ? `, and for example ${examples.map(quote).join(" or ")}` : "";
  return `Every service on our Services page lists its starting price and timeline. Packages start at ${formatMoney(cheapest.price)} for ${cheapest.name} (${cheapest.delivery})${range}. Larger or custom projects get a clear proposal after a short discovery call.`;
}

// [question, answer]. The cost question comes first on the page and is built by costAnswer().
export const generalFaqs = [
  ["How quickly can we start?", "Most projects begin within one to three weeks of agreeing on scope and availability."],
  [
    "Who owns the code?",
    "You do. We hand over the source code, design files, and documentation created for your project.",
  ],
  ["How will we communicate?", "You’ll have a direct channel with the team, weekly demos, and a shared project board."],
  [
    "Can you work with our existing team?",
    "Yes. We can own a workstream, strengthen your team, or provide a second opinion.",
  ],
  [
    "What happens after launch?",
    "We can hand over fully, or stay on with a support retainer for fixes, improvements, and advice.",
  ],
] as const;
