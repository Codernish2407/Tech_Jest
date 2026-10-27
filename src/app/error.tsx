"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section page-error">
      <div className="container empty-state">
        <div className="eyebrow">Something went wrong</div>
        <h1>We could not load this page.</h1>
        <p>Please try again. If the problem continues, contact the TechJest team.</p>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link className="btn btn-ghost" href="/contact">
            Contact support
          </Link>
        </div>
      </div>
    </section>
  );
}
