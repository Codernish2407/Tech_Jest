import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { getSiteSettings } from "@/backend/supabase/site-settings";
import { Scene3D } from "@/frontend/components/scene-3d";
import { RiseTitle } from "@/frontend/components/hero-title";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How TechJest collects, uses, and protects the information you share through this website.",
  path: "/privacy",
});

export default async function Privacy() {
  const { contact_email: email } = await getSiteSettings();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Legal</div>
          <RiseTitle text="Privacy policy" />
          <p className="lead">What we collect when you use this website, why, and the choices you have.</p>
        </div>
        <Scene3D variant="emblem" className="page-hero-scene" />
      </section>
      <section className="section">
        <div className="container legal-content">
          <h2>Information we collect</h2>
          <p>
            When you send a project enquiry, request a quote, or message us, we collect the details you enter: your
            name, email, phone number, company, budget, timeline, and project description. Booking a service needs an
            account, so we also store your sign-in details and the project history linked to it.
          </p>
          <h2>How we use it</h2>
          <p>
            We use this information to reply to you, prepare proposals, deliver projects, and keep your project history
            in your private dashboard. We do not sell your personal information.
          </p>
          <h2>Who can see it</h2>
          <p>
            Your enquiries and project data are visible to the TechJest team. We use trusted providers to host the
            website, store data, and send email notifications about your enquiry and our replies, and they process it
            only to provide those services. We share information with others only where the law requires it.
          </p>
          <h2>Cookies</h2>
          <p>
            We use only the cookies and browser storage needed to keep you signed in, to remember the services in your
            project cart, and to keep a half-written enquiry while you log in.
          </p>
          <h2>Your choices</h2>
          <p>
            You can ask us to access, correct, or delete your personal information at any time by emailing{" "}
            <a href={`mailto:${email}`}>{email}</a>. We keep project records for as long as needed to deliver the work
            and meet legal obligations.
          </p>
          <h2>Changes</h2>
          <p>
            We may update this policy as the website changes. See also our <Link href="/terms">terms of service</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
