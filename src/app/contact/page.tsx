import { getSiteSettings, whatsappLink } from "@/backend/supabase/site-settings";
import { ContactForm } from "@/frontend/components/contact-form";
import { Scene3D } from "@/frontend/components/scene-3d";
import { RiseTitle } from "@/frontend/components/hero-title";

// Cached like the other public pages: the form reads ?service= and the session in the browser.
export default async function Contact() {
  const settings = await getSiteSettings();
  const whatsappHref = whatsappLink(settings.whatsapp_number);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Start a project</div>
          <RiseTitle text="Tell us what you’re trying to make better." />
          <p className="lead">Share a little context and we’ll reply within one business day.</p>
        </div>
        <Scene3D variant="contact" className="page-hero-scene" />
      </section>
      <section className="section">
        <div className="container contact-grid">
          <div className="contact-form-panel">
            <h2>Let’s hear your idea.</h2>
            <p className="form-note">A few details help us give you a useful first reply.</p>
            <ContactForm />
          </div>
          <aside className="contact-side">
            <div className="eyebrow">Contact</div>
            <div className="side-block">
              <h2>Email</h2>
              <p>
                <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
              </p>
            </div>
            <div className="side-block">
              <h2>What happens next</h2>
              <ol className="contact-next-steps">
                <li>
                  <strong>We read your note</strong>
                  <span>Understand what you want to build or improve.</span>
                </li>
                <li>
                  <strong>We reply with useful questions</strong>
                  <span>Clarify the scope, priorities and next step.</span>
                </li>
                <li>
                  <strong>We decide if a call helps</strong>
                  <span>A focused conversation when you need one.</span>
                </li>
              </ol>
            </div>
            {whatsappHref && (
              <div className="side-block">
                <h2>Prefer WhatsApp?</h2>
                <p>
                  <a href={whatsappHref}>Start a chat →</a>
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
