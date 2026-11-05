import Link from "next/link";
import { ProjectBlueprint } from "@/frontend/components/project-blueprint";
import Image from "next/image";
import { getSiteSettings } from "@/backend/supabase/site-settings";
import { getServices } from "@/backend/supabase/services";
import { assurances, costAnswer, deliveryProcess, generalFaqs, homeServiceCards } from "@/frontend/data/site-content";
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

const services = homeServiceCards;
const process = deliveryProcess;

export default async function Home() {
  const [settings, catalog] = await Promise.all([getSiteSettings(), getServices()]);
  const faqs: (readonly [string, string])[] = [["How much does a project cost?", costAnswer(catalog)], ...generalFaqs];
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
