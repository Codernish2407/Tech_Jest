import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import "./fonts.css";
import "./globals.css";
import "./site-assistant.css";
import { MobileMenu } from "@/frontend/components/mobile-menu";
import { SiteAssistant } from "@/frontend/components/site-assistant";
import { NavLinks } from "@/frontend/components/nav-links";
import { SiteIntro } from "@/frontend/components/site-intro";
import { Depth3D } from "@/frontend/components/depth-3d";
import { introScript } from "@/lib/site-intro";
import { ChatIcon } from "@/frontend/components/icons";
import { team, type TeamMember } from "@/frontend/data/team";
import { AccountBadge, AccountProvider, NotificationBell } from "@/frontend/components/account";
import { CartLink, CartToast } from "@/frontend/components/service-cart";
import { getSiteUrl } from "@/lib/site-url";
import { getSiteSettings, whatsappLink } from "@/backend/supabase/site-settings";
import { jsonLd } from "@/lib/json-ld";

const siteUrl = getSiteUrl();
const founders = team.filter((member) => member.founder);
// One identity per person, linked to the matching card on /about and their public profiles.
const person = (member: TeamMember) => ({
  "@type": "Person",
  "@id": `${siteUrl}/about#${member.id}`,
  name: member.name,
  ...(member.photo ? { image: `${siteUrl}${member.photo}` } : {}),
  sameAs: member.github ? [member.linkedin, member.github] : [member.linkedin],
});
export const viewport: Viewport = { themeColor: "#1b1e4a" };
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "TechJest | Web Development, AI Automation & Digital Solutions", template: "%s | TechJest" },
  description:
    "TechJest is a software development company for startups and growing businesses. We build websites, web apps, mobile apps, AI/ML solutions, cloud infrastructure, and digital products.",
  keywords: [
    "TechJest",
    "software development company",
    "web development",
    "mobile app development",
    "AI ML solutions",
    "cloud DevOps",
    "UI UX design",
    "IT consulting",
  ],
  applicationName: "TechJest",
  category: "Software development services",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
  authors: founders.map((member) => ({ name: member.name, url: member.linkedin })),
  creator: "Chayan Khatua and Amit Singh Panwar",
  publisher: "TechJest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "TechJest",
    title: "TechJest | Web Development, AI Automation & Digital Solutions",
    description:
      "TechJest builds practical websites, web apps, mobile apps, AI/ML solutions, and cloud infrastructure for startups and growing businesses.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "TechJest | Web Development, AI Automation & Digital Solutions",
    description:
      "TechJest builds websites, web apps, mobile apps, AI/ML solutions, and cloud infrastructure for growing businesses.",
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  other: {
    "ai-content-declaration":
      "This website contains original information about TechJest services, leadership, and work.",
    "ai-purpose": "Official company information, services, leadership, portfolio, and contact details for TechJest.",
  },
};

// Public pages are rebuilt at most every 5 minutes and served from the CDN in between. Pages that read
// the session (dashboard, admin) still render per request. Admin edits refresh them straight away
// through /api/admin/revalidate.
export const revalidate = 300;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // No session read here: it would make every page per-visitor. AccountProvider fills in the
  // signed-in parts of the header in the browser.
  const settings = await getSiteSettings();
  const contactEmail = settings.contact_email;
  const whatsappHref = whatsappLink(settings.whatsapp_number);
  const whatsappChatHref = whatsappLink(settings.whatsapp_number, "Hi TechJest, I'd like to discuss a project.");
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "TechJest",
    legalName: "TechJest",
    url: siteUrl,
    logo: `${siteUrl}/images/techjest-brand.png`,
    image: `${siteUrl}/images/techjest-brand.png`,
    email: contactEmail,
    description:
      "TechJest is a software development company that builds websites, web applications, mobile apps, AI/ML solutions, cloud infrastructure, and user-focused digital products for startups and growing businesses.",
    slogan: "Practical technology for ambitious teams.",
    brand: { "@type": "Brand", name: "TechJest", logo: `${siteUrl}/images/techjest-brand.png` },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: contactEmail,
      availableLanguage: ["English"],
    },
    founder: founders.map(person),
    employee: team.map((member) => ({ ...person(member), jobTitle: member.role })),
    sameAs: [
      "https://github.com/chayan2006/Tech_Jest",
      "https://www.linkedin.com/company/techjest",
      "https://www.instagram.com/techjest_",
    ],
    areaServed: [
      { "@type": "Country", name: "India" },
      { "@type": "Place", name: "Worldwide" },
    ],
    knowsLanguage: "English",
    knowsAbout: [
      "Web development",
      "Mobile app development",
      "Artificial intelligence",
      "Machine learning",
      "Cloud computing",
      "DevOps",
      "UI/UX design",
      "IT consulting",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "TechJest software development services",
      itemListElement: [
        "Web development",
        "Mobile app development",
        "AI / ML solutions",
        "Cloud & DevOps",
        "UI / UX design",
        "IT consulting & support",
      ].map((name, index) => ({
        "@type": "Offer",
        position: index + 1,
        itemOffered: { "@type": "Service", name, provider: { "@id": `${siteUrl}/#organization` } },
      })),
    },
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: "TechJest",
    url: siteUrl,
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en-IN",
    description:
      "Official website of TechJest — web development, AI automation, mobile apps, cloud infrastructure, and digital solutions for growing businesses.",
    about: { "@id": `${siteUrl}/#organization` },
  };
  // The intro script sets data-intro on <html> before hydration, hence suppressHydrationWarning.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link
          rel="preload"
          href="/fonts/source-serif-4-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema) }} />
        <SiteIntro />
        <Depth3D />
        <AccountProvider>
          <CartToast />
          <a className="skip" href="#main">
            Skip to content
          </a>
          <header className="site-header">
            <div className="container nav">
              <div className="nav-left">
                <Link className="logo" href="/">
                  <Image
                    className="brand-image"
                    src="/images/techjest-brand.png"
                    alt="TechJest"
                    width={138}
                    height={92}
                  />
                </Link>
                <AccountBadge />
              </div>
              <NavLinks />
              <div className="nav-actions">
                <NotificationBell />
                <CartLink />
                <Link className="btn btn-primary" href="/contact">
                  Book a consultation
                </Link>
                <MobileMenu />
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="footer">
            <div className="container">
              <div className="footer-grid">
                <div>
                  <Link className="logo" href="/">
                    <Image
                      className="brand-image footer-brand"
                      src="/images/techjest-brand.png"
                      alt="TechJest"
                      width={138}
                      height={92}
                    />
                  </Link>
                  <p>Practical technology for ambitious teams. Built with clarity, shipped with care.</p>
                </div>
                <div>
                  <h2>Explore</h2>
                  <p>
                    <Link href="/services">Services</Link>
                    <br />
                    <Link href="/portfolio">Our work</Link>
                    <br />
                    <Link href="/about">About us</Link>
                    <br />
                    <Link href="/privacy">Privacy policy</Link>
                    <br />
                    <Link href="/terms">Terms of service</Link>
                  </p>
                </div>
                <div>
                  <h2>Start a project</h2>
                  <p>
                    <Link href="/contact">Book a consultation</Link>
                    <br />
                    <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                    {whatsappHref && (
                      <>
                        <br />
                        <a href={whatsappHref}>WhatsApp</a>
                      </>
                    )}
                    <br />
                    <a
                      href="https://www.linkedin.com/company/techjest"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TechJest on LinkedIn"
                    >
                      LinkedIn
                    </a>
                    <br />
                    <a
                      href="https://instagram.com/techjest_"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TechJest on Instagram"
                    >
                      Instagram
                    </a>
                  </p>
                </div>
                <div>
                  <h2>Principles</h2>
                  <p>
                    Clear scope
                    <br />
                    Useful software
                    <br />
                    Long-term thinking
                  </p>
                </div>
              </div>
              <div className="footer-bottom">© {new Date().getFullYear()} TechJest. Built for what’s next.</div>
            </div>
          </footer>
          {/* A labelled landmark, so screen-reader users can find the floating chat button. */}
          {whatsappChatHref && (
            <aside aria-label="WhatsApp chat">
              <a className="whatsapp" href={whatsappChatHref} aria-label="Chat with us on WhatsApp">
                <ChatIcon />
              </a>
            </aside>
          )}
          {/* The website assistant (/api/chat) is off until AI_API_KEY is configured. */}
          {process.env.AI_API_KEY?.trim() && <SiteAssistant raised={Boolean(whatsappChatHref)} />}
        </AccountProvider>
      </body>
    </html>
  );
}
