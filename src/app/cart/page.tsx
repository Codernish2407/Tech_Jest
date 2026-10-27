"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { type Service } from "@/frontend/data/services";
import { ServiceIcon } from "@/frontend/components/icons";
import { AddToCartButton, getCart, removeFromCart } from "@/frontend/components/service-cart";
import { useAccount } from "@/frontend/components/account";

// What the visitor typed into the quote form, kept if they choose to log in first.
const DRAFT_KEY = "techjest-quote-draft";
const draftFields = ["name", "email", "phone", "company", "budget", "timeline", "message"] as const;
type Draft = Partial<Record<(typeof draftFields)[number], string>>;

function readDraft(): Draft {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null");
    if (!value || typeof value !== "object") return {};
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      draftFields.filter((field) => typeof record[field] === "string").map((field) => [field, record[field]]),
    );
  } catch {
    return {};
  }
}

export default function CartPage() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const { account } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const selected = useMemo(() => services.filter((item) => slugs.includes(item.slug)), [slugs, services]);
  const startingTotal = selected.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const unavailableSlugs =
    catalogState === "ready" ? slugs.filter((slug) => !services.some((item) => item.slug === slug)) : [];
  useEffect(() => {
    const sync = () => setSlugs(getCart());
    sync();
    setDraft(readDraft());
    window.addEventListener("techjest-cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("techjest-cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setCatalogState("loading");
    fetch("/api/services", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid catalog");
        if (active) {
          setServices(data as Service[]);
          setCatalogState("ready");
        }
      })
      .catch(() => {
        if (active) setCatalogState("unavailable");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [catalogAttempt]);
  function remove(slug: string) {
    try {
      removeFromCart(slug);
      setSlugs(getCart());
    } catch {
      setError("Your browser could not update the cart. Allow site storage and try again.");
    }
  }
  // Logging in is optional; the quote form is kept so the visitor does not type it again.
  function keepDraftAndLogIn() {
    const form = document.getElementById("quote");
    if (form instanceof HTMLFormElement) {
      const data = new FormData(form);
      try {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify(Object.fromEntries(draftFields.map((field) => [field, String(data.get(field) ?? "")]))),
        );
      } catch {
        // Storage can be unavailable (private mode); logging in still works.
      }
    }
    window.location.assign("/auth?next=/cart");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || catalogState !== "ready" || unavailableSlugs.length || !selected.length) return;
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceSlugs: selected.map((item) => item.slug),
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          company: form.get("company"),
          timeline: form.get("timeline"),
          message: form.get("message"),
          budget: form.get("budget"),
          website: form.get("website"),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "We could not send your quote request.");
        return;
      }
      setSlugs([]);
      setSent(true);
      // The server already accepted the request. A browser-storage failure must never invite a duplicate.
      try {
        window.localStorage.removeItem("techjest-service-cart");
        window.localStorage.removeItem(DRAFT_KEY);
        window.dispatchEvent(new Event("techjest-cart-updated"));
      } catch {
        console.warn("Your quote was sent, but this browser could not clear the saved cart.");
      }
    } catch {
      setError("We could not connect to TechJest. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section cart-page">
      <div className="container">
        <div className="eyebrow">Project cart</div>
        <h1>Build your project package.</h1>
        <p className="lead">Select the services you need, then send us the context so we can prepare a useful quote.</p>
        {error && (
          <p className="form-message" role="alert">
            {error}
          </p>
        )}
        {sent ? (
          <div className="success-panel">
            <div className="eyebrow">Request received</div>
            <h2>We’ll be in touch.</h2>
            <p>
              Your selected services are now with the TechJest team. We’ll reply within one business day
              {account ? "." : " by email."}
            </p>
            {account && (
              <Link className="btn btn-primary" href="/dashboard">
                View your project history
              </Link>
            )}
          </div>
        ) : catalogState !== "ready" ? (
          <div className="catalog-notice" role="status">
            <h2>
              {catalogState === "loading"
                ? "Checking your selected services…"
                : "We couldn’t load current services and prices."}
            </h2>
            <p>
              {catalogState === "loading"
                ? "Your project package will appear here in a moment."
                : "Your saved selections are still in your cart. Try again or contact us to discuss your project."}
            </p>
            {catalogState === "unavailable" && (
              <div className="hero-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCatalogAttempt((attempt) => attempt + 1)}
                >
                  Try again
                </button>
                <Link className="btn btn-ghost" href="/contact">
                  Contact us
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="cart-page-grid">
            <div>
              {unavailableSlugs.length > 0 && (
                <div className="catalog-notice" role="status">
                  <h2>Some selections are no longer available.</h2>
                  <p>
                    Remove these services before sending your quote request. Your other selections will stay in your
                    cart.
                  </p>
                  {unavailableSlugs.map((slug) => (
                    <div key={slug}>
                      <button type="button" className="text-button" onClick={() => remove(slug)}>
                        Remove {slug}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="cart-items">
                {selected.length ? (
                  selected.map((item) => (
                    <article className="cart-item" key={item.slug}>
                      <div className="market-service-icon">
                        <ServiceIcon category={item.category} />
                      </div>
                      <div>
                        <div className="eyebrow">{item.category}</div>
                        <h2>{item.name}</h2>
                        <p>{item.description}</p>
                        <strong>{item.price ? `From ₹${item.price.toLocaleString("en-IN")}` : "Custom quote"}</strong>
                      </div>
                      <button type="button" className="text-button" onClick={() => remove(item.slug)}>
                        Remove
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <h2>Your project cart is empty.</h2>
                    <p>Browse our services and add the capabilities you need, or simply describe your project.</p>
                    <div className="hero-actions">
                      <Link className="btn btn-primary" href="/services">
                        Explore services
                      </Link>
                      <Link className="btn btn-ghost" href="/contact">
                        Describe your project
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              {selected.length > 0 && (
                <aside className="estimate-panel">
                  <div>
                    <span className="eyebrow">Starting estimate</span>
                    <strong>{startingTotal ? `₹${startingTotal.toLocaleString("en-IN")}` : "Custom quote"}</strong>
                  </div>
                  <p>
                    This is an initial estimate based on listed starting prices. Final scope, timeline, and pricing are
                    confirmed in your proposal.
                  </p>
                  <div className="estimate-timeline">
                    <span className="eyebrow">Indicative delivery</span>
                    {selected.map((item) => (
                      <span key={item.slug}>
                        {item.name} · {item.delivery}
                      </span>
                    ))}
                  </div>
                </aside>
              )}
            </div>
            {selected.length > 0 && (
              // Remounts once the saved draft is read, so the fields start with what the visitor typed.
              <form id="quote" className="quote-form form" onSubmit={submit} key={draft ? "draft" : "empty"}>
                <div>
                  <div className="eyebrow">Request a quote</div>
                  <h2>Tell us about the project.</h2>
                </div>
                <div className="field">
                  <label htmlFor="quote-name">Name</label>
                  <input
                    id="quote-name"
                    name="name"
                    defaultValue={draft?.name}
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="quote-email">Email</label>
                  <input
                    id="quote-email"
                    name="email"
                    defaultValue={draft?.email}
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label htmlFor="quote-phone">Phone</label>
                  <input
                    id="quote-phone"
                    name="phone"
                    defaultValue={draft?.phone}
                    type="tel"
                    required
                    autoComplete="tel"
                  />
                </div>
                <div className="field">
                  <label htmlFor="quote-company">Company</label>
                  <input id="quote-company" name="company" defaultValue={draft?.company} autoComplete="organization" />
                </div>
                <div className="field">
                  <label htmlFor="quote-budget">Budget range</label>
                  <select id="quote-budget" name="budget" defaultValue={draft?.budget ?? ""}>
                    <option value="">Prefer not to say</option>
                    <option>Under ₹50,000</option>
                    <option>₹50,000 – ₹2,00,000</option>
                    <option>₹2,00,000 – ₹5,00,000</option>
                    <option>Above ₹5,00,000</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="quote-timeline">Expected timeline</label>
                  <select id="quote-timeline" name="timeline" defaultValue={draft?.timeline ?? ""}>
                    <option value="">Not sure yet</option>
                    <option>As soon as possible</option>
                    <option>Within 1 month</option>
                    <option>1–3 months</option>
                    <option>Flexible</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="quote-message">Project description</label>
                  <textarea
                    id="quote-message"
                    name="message"
                    defaultValue={draft?.message}
                    required
                    minLength={20}
                    placeholder="What are you trying to build or improve?"
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy || unavailableSlugs.length > 0}>
                  {busy ? "Sending request…" : "Request a quote"}
                </button>
                {/* Hidden from people and screen readers; only bots fill it in. */}
                <div className="visually-hidden" aria-hidden="true">
                  <label htmlFor="quote-website">Website</label>
                  <input id="quote-website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                {!account && (
                  <small className="form-note">
                    No account needed: we’ll reply by email. To keep the quote in a private workspace,{" "}
                    <a
                      href="/auth?next=/cart"
                      onClick={(event) => {
                        event.preventDefault();
                        keepDraftAndLogIn();
                      }}
                    >
                      log in or sign up
                    </a>{" "}
                    first.
                  </small>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
