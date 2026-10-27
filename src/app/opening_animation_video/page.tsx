import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Welcome to TechJest",
  description: "Practical technology for ambitious teams.",
  robots: { index: false, follow: false },
};

export default function OpeningAnimationPage() {
  return (
    <section className="brand-welcome-page">
      <div className="container">
        <div className="eyebrow">Welcome to TechJest</div>
        <h1>
          Ideas today.
          <br />
          Solutions tomorrow.
        </h1>
        <p className="lead">Practical technology for ambitious teams. Built with clarity, shipped with care.</p>
        <div className="hero-actions">
          <Link href="/services" className="btn btn-primary">
            Explore services
          </Link>
          <a href="/?intro=1" className="btn btn-ghost">
            Replay welcome
          </a>
        </div>
      </div>
    </section>
  );
}
