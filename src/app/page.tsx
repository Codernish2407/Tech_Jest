import Link from "next/link";
import { ProjectBlueprint } from "@/frontend/components/project-blueprint";
import Image from "next/image";
import { getSiteSettings } from "@/backend/supabase/site-settings";
import { getServices } from "@/backend/supabase/services";
import type { Service } from "@/frontend/data/services";
import { formatMoney } from "@/lib/format";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { InstagramFeed } from "@/frontend/components/InstagramFeed";
import { HeroTitle } from "@/frontend/components/hero-title";
import { ParticleField, ParticleSlot } from "@/frontend/components/particle-field";
import { Scene3D } from "@/frontend/components/scene-3d";

export const metadata: Metadata = pageMetadata({
  title: "TechJest | Web Development, AI Automation & Digital Solutions",
  description:
    "TechJest builds websites, web apps, mobile apps, and AI automation for startups and growing businesses. Tell us your goal and get a clear proposal.",
  path: "/",
  absoluteTitle: true,
});

const services = [
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
];
const process = [
  ["01", "Understand", "We understand your business before writing code."],
  ["02", "Design", "We create the product architecture and UX."],
  ["03", "Build", "Agile development with regular client updates."],
  ["04", "Test", "QA, security, and performance testing."],
  ["05", "Deploy", "Production deployment and monitoring."],
  ["06", "Support", "Post-launch maintenance and improvements."],
];
// Each line restates a commitment already made on the site (services, FAQ, contact).
const assurances = ["Six service areas", "Weekly demos", "You own the code", "Replies within one business day"];
// The cost answer quotes real starting prices from the live catalog, so it stays true when prices change
// in the admin console. With no priced services it falls back to the general answer.
function costAnswer(services: Service[]) {
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

const otherFaqs = [
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
];

export default async function Home() {
  const [settings, catalog] = await Promise.all([getSiteSettings(), getServices()]);
  const faqs = [["How much does a project cost?", costAnswer(catalog)], ...otherFaqs];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map(([question, answer]) => ({
              "@type": "Question",
              name: question,
              acceptedAnswer: { "@type": "Answer", text: answer },
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${getSiteUrl()}/#webpage`,
            name: "TechJest | Web Development, AI Automation & Digital Solutions",
            url: getSiteUrl(),
            isPartOf: { "@id": `${getSiteUrl()}/#website` },
            about: { "@id": `${getSiteUrl()}/#organization` },
            description:
              "Official website of TechJest — a software development company offering web development, AI automation, mobile apps, cloud infrastructure, and digital solutions for growing businesses.",
            inLanguage: "en-IN",
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [{ "@type": "ListItem", position: 1, name: "TechJest", item: getSiteUrl() }],
            },
          }),
        }}
      />
      <section className="hero hero-bold">
        <div className="hero-glow" aria-hidden="true" />
        <Scene3D variant="home" className="hero-scene" />
        <div className="container hero-stage">
          <div className="eyebrow">{settings.homepage_eyebrow}</div>
          <HeroTitle title={settings.homepage_title} />
          <p className="lead">{settings.homepage_description}</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/contact">
              {settings.homepage_cta}
            </Link>
            <Link className="btn btn-ghost" href="/portfolio">
              See our work
            </Link>
          </div>
        </div>
        <ul className="container hero-assurances" aria-label="Working with TechJest">
          {assurances.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="section">
        <div className="container detail-grid">
          <div>
            <div className="eyebrow">TechJest</div>
            <h2>Software development for ambitious businesses.</h2>
            <ParticleSlot shape="code" className="particle-slot-detail" />
          </div>
          <div>
            <p className="lead">
              TechJest designs and builds websites, web applications, mobile apps, AI/ML solutions, cloud
              infrastructure, and user-focused digital products.
            </p>
            <p>
              Founded and led by <strong>Chayan Khatua</strong> and <strong>Amit Singh Panwar</strong>, TechJest gives
              startups and growing teams a clear technical partner from the first idea through launch and ongoing
              improvement.
            </p>
            <p>
              <Link className="card-link" href="/about">
                Meet the founders and leadership team →
              </Link>
            </p>
            <ProjectBlueprint />
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">What we do</div>
              <h2>Technology with a job to do.</h2>
            </div>
            <p>From the first sketch to the systems that keep your product moving, we focus on outcomes over output.</p>
          </div>
          <div className="service-grid">
            {services.map(([title, slug, desc]) => (
              <article className="service-card" key={slug}>
                <h3>{title}</h3>
                <p>{desc}</p>
                <Link className="card-link" href={`/services/${slug}`}>
                  Explore service
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section band">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Why TechJest?</div>
              <h2>A delivery process built for confidence.</h2>
            </div>
            <ParticleSlot shape="gear" className="particle-slot-head" />
            <p className="lead">
              Every project moves through clear stages, from understanding the business to improving the product after
              launch.
            </p>
          </div>
          <div className="process-grid">
            {process.map(([num, title, desc]) => (
              <div className="process-step" key={num}>
                <div className="step-no">
                  {num} <span aria-hidden="true">—</span>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Selected work</div>
              <h2>Proof over promises.</h2>
            </div>
            <ParticleSlot shape="browser" className="particle-slot-head" />
            <Link className="card-link" href="/portfolio">
              View all work
            </Link>
          </div>
          <article className="work-spotlight">
            <Link className="work-spotlight-image" href="/portfolio" aria-label="View the Stream Bird India project">
              <Image
                src="/images/StreamBirdIndia.png"
                alt="Stream Bird India company website"
                width={2940}
                height={1596}
                sizes="(max-width: 800px) 100vw, 700px"
              />
            </Link>
            <div className="work-spotlight-copy">
              <div className="eyebrow">Featured project</div>
              <h3>Stream Bird India</h3>
              <p>
                A company homepage for a technology ecosystem focused on network connectivity and physical IT
                infrastructure.
              </p>
              <ul className="project-tags" aria-label="Project categories">
                <li>Web development</li>
                <li>Company website</li>
              </ul>
              <Link className="card-link" href="/portfolio">
                Explore the project <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Questions, answered</div>
              <h2>Before we start.</h2>
            </div>
            <ParticleSlot shape="chat" className="particle-slot-head" />
            <p>
              Open the questions that matter to your project. If you still need an answer,{" "}
              <Link className="card-link" href="/contact">
                start a conversation
              </Link>
              .
            </p>
          </div>
          <div className="faq-grid">
            {faqs.map(([q, a], index) => (
              <details className="faq" key={q} open={index === 0}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className="cta">
        <div className="container cta-row">
          <div>
            <div className="eyebrow">Have a challenge in mind?</div>
            <h2>Let’s make the next step clear.</h2>
          </div>
          <Link className="btn btn-primary" href="/contact">
            Start a conversation
          </Link>
        </div>
      </section>
      <InstagramFeed />
      <ParticleField />
    </>
  );
}
