import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TechJest — Opening Animation",
  description: "TechJest opening animation video showcase.",
  robots: { index: false, follow: false },
};

export default function OpeningAnimationPage() {
  return (
    <div id="main-content">
      <h1 className="brand-title">TECH JEST</h1>
      <p className="tagline">Ideas Today &nbsp;|&nbsp; Solutions Tomorrow</p>
      <Link href="/services" className="cta-button">
        EXPLORE SOLUTIONS
      </Link>
      <a
        href="/?intro=1"
        style={{
          marginTop: "1.5rem",
          color: "#8fa3c7",
          fontSize: "13px",
          letterSpacing: "1px",
          textTransform: "uppercase",
          textDecoration: "underline",
        }}
      >
        Replay Intro on Homepage
      </a>
    </div>
  );
}
