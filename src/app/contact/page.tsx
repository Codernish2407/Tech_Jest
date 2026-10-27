import { getSiteSettings, whatsappLink } from "@/backend/supabase/site-settings";
import { ContactForm } from "@/frontend/components/contact-form";

// Cached like the other public pages: the form reads ?service= and the session in the browser.
export default async function Contact() {
  const settings = await getSiteSettings();
  const whatsappHref = whatsappLink(settings.whatsapp_number);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Start a project</div>
          <h1>Tell us what you’re trying to make better.</h1>
          <p className="lead">Share a little context and we’ll reply within one business day.</p>
        </div>
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
              <p>
                01 — We read your note
                <br />
                02 — We reply with useful questions
                <br />
                03 — We decide together if a call helps
              </p>
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
