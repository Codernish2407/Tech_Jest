import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { getSiteSettings } from "@/backend/supabase/site-settings";
import { Scene3D } from "@/frontend/components/scene-3d";
import { RiseTitle } from "@/frontend/components/hero-title";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms for using the TechJest website and requesting software development services.",
  path: "/terms",
});

export default async function Terms() {
  const { contact_email: email } = await getSiteSettings();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Legal</div>
          <RiseTitle text="Terms of service" />
          <p className="lead">The ground rules for using this website and working with TechJest.</p>
        </div>
        <Scene3D variant="emblem" className="page-hero-scene" />
      </section>
      <section className="section">
        <div className="container legal-content">
          <h2>Using this website</h2>
          <p>
            You may browse this site and send enquiries for lawful purposes. Please do not misuse it, attempt to access
            areas you are not authorised to use, or submit false or harmful content.
          </p>
          <h2>Quotes and proposals</h2>
          <p>
            Starting prices and timelines shown on this site are indicative. Final scope, price, and delivery dates are
            set out in a written proposal that you accept before work begins.
          </p>
          <h2>Ownership of your work</h2>
          <p>
            Once a project is paid for in full, you own the source code, design files, and documentation created for it,
            unless the proposal says otherwise. Third-party tools and libraries stay under their own licences.
          </p>
          <h2>Liability</h2>
          <p>
            We take care to keep this site accurate and available, but it is provided as is. To the extent the law
            allows, TechJest is not liable for indirect losses arising from using the site.
          </p>
          <h2>Contact</h2>
          <p>
            Questions about these terms? Email <a href={`mailto:${email}`}>{email}</a>. See also our{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
