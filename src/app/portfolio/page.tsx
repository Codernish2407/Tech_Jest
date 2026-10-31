import Image from "next/image";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { Scene3D } from "@/frontend/components/scene-3d";
import { RiseTitle } from "@/frontend/components/hero-title";

export const metadata: Metadata = pageMetadata({
  title: "Our Work | Stream Bird India Website",
  description: "See how TechJest built the Stream Bird India company homepage and technology ecosystem website.",
  path: "/portfolio",
});

export default function Portfolio() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "TechJest portfolio",
            description: "Selected software and website work delivered by TechJest.",
            mainEntity: {
              "@type": "CreativeWork",
              name: "Stream Bird India company website",
              url: "https://stream-bird-india.vercel.app/",
              creator: { "@id": `${getSiteUrl()}/#organization` },
              image: `${getSiteUrl()}/images/StreamBirdIndia.png`,
            },
          }),
        }}
      />
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Selected work</div>
          <RiseTitle text="Stream Bird India" />
          <p className="lead">The Stream Bird India homepage, presented as a live company website project.</p>
        </div>
        <Scene3D variant="work" className="page-hero-scene" />
      </section>
      <section className="section">
        <div className="container">
          <article className="project project-featured">
            <div className="project-preview">
              <Image
                className="project-image"
                src="/images/StreamBirdIndia.png"
                alt="Stream Bird India homepage shown in the TechJest work portfolio"
                width={2940}
                height={1596}
                sizes="(max-width: 800px) 100vw, 680px"
              />
            </div>
            <div className="project-details">
              <div className="project-tag">Company homepage / Web development</div>
              <h2>Complete technology ecosystem.</h2>
              <p>
                A public-facing homepage for Stream Bird India, a technology ecosystem focused on network connectivity
                and physical IT infrastructure.
              </p>
              <dl className="project-facts">
                <div>
                  <dt>Project</dt>
                  <dd>Company homepage</dd>
                </div>
                <div>
                  <dt>Focus</dt>
                  <dd>Technology ecosystem</dd>
                </div>
                <div>
                  <dt>Visit</dt>
                  <dd>Live website</dd>
                </div>
              </dl>
              <p>
                <a
                  className="btn btn-primary"
                  href="https://stream-bird-india.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Stream Bird India ↗
                </a>
              </p>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
