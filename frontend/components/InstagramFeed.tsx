import { InstagramIcon } from "@/frontend/components/icons";

// A lightweight profile link: no embed scripts, feed requests or client JavaScript.
export const InstagramFeed = () => (
  <section className="instagram-section" aria-label="TechJest on Instagram">
    <div className="container social-strip">
      <div className="social-strip-icon">
        <InstagramIcon />
      </div>
      <div>
        <h2>A little more behind the work.</h2>
        <p>Find TechJest on Instagram.</p>
      </div>
      <a
        href="https://www.instagram.com/techjest_/"
        target="_blank"
        rel="noopener noreferrer"
        className="card-link"
        aria-label="Follow TechJest on Instagram"
      >
        Follow @techjest_ <span aria-hidden="true">↗</span>
      </a>
    </div>
  </section>
);
