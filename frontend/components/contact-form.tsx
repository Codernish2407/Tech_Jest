"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { findServiceArea, notSureService, serviceAreas } from "@/frontend/data/service-areas";
import { useAccount } from "@/frontend/components/account";

const DRAFT_KEY = "techjest-contact-draft";
const loginHref = "/auth?next=/contact";

type Draft = {
  service?: unknown;
  budget?: unknown;
  message?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
};

function readDraft(): Draft {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null");
    return value && typeof value === "object" ? (value as Draft) : {};
  } catch {
    return {};
  }
}

// Signed-in clients send requests into their workspace; visitors without an account send a guest
// enquiry with their name and email, and the team replies by email.
export function ContactForm() {
  const { account, ready } = useAccount();
  const signedIn = Boolean(account);
  const [service, setService] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState<"workspace" | "guest" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Start from ?service= (links from the service pages), or what the visitor typed before logging in.
  useEffect(() => {
    const fromLink = findServiceArea(new URLSearchParams(window.location.search).get("service") ?? undefined)?.title;
    const draft = readDraft();
    if (fromLink) setService(fromLink);
    else if (typeof draft.service === "string") setService(draft.service);
    if (typeof draft.budget === "string") setBudget(draft.budget);
    if (typeof draft.message === "string") setMessage(draft.message);
    if (typeof draft.name === "string") setName(draft.name);
    if (typeof draft.email === "string") setEmail(draft.email);
    if (typeof draft.phone === "string") setPhone(draft.phone);
  }, []);

  function keepDraftAndLogIn() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ service, budget, message, name, email, phone }));
    } catch {
      // Storage can be unavailable (private mode); logging in still works.
    }
    window.location.assign(loginHref);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          signedIn ? { service, budget, message } : { service, budget, message, name, email, phone, website },
        ),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? "We could not save your request.");
        return;
      }
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clean up when storage is unavailable.
      }
      setSent(signedIn ? "workspace" : "guest");
    } catch {
      setError("We could not connect to TechJest. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent === "guest")
    return (
      <div className="band" style={{ padding: 30 }}>
        <h2>Request sent.</h2>
        <p>Thank you. We’ll reply to {email} within one business day.</p>
      </div>
    );
  if (sent)
    return (
      <div className="band" style={{ padding: 30 }}>
        <h2>Request saved.</h2>
        <p>Your project request is now in your private history. We’ll be in touch within one business day.</p>
        <Link className="btn btn-ghost" href="/dashboard">
          View your workspace
        </Link>
      </div>
    );

  return (
    <form className="form" onSubmit={submit}>
      {ready && !signedIn && (
        <>
          <p className="form-note">
            No account needed: we’ll reply by email. To keep our replies in a private workspace instead,{" "}
            <a
              href={loginHref}
              onClick={(event) => {
                event.preventDefault();
                keepDraftAndLogIn();
              }}
            >
              log in or sign up
            </a>{" "}
            first. We’ll keep what you’ve typed.
          </p>
          <div className="field">
            <label htmlFor="contact-name">Your name</label>
            <input
              id="contact-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={320}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-phone">
              Phone <small>(optional)</small>
            </label>
            <input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={30}
              autoComplete="tel"
            />
          </div>
          {/* Hidden from people and screen readers; only bots fill it in. */}
          <div className="visually-hidden" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input
              id="contact-website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor="service">What can we help with?</label>
        <select
          id="service"
          name="service"
          value={service}
          onChange={(event) => setService(event.target.value)}
          required
        >
          <option value="" disabled>
            Select a service
          </option>
          {serviceAreas.map((area) => (
            <option key={area.slug} value={area.title}>
              {area.title}
            </option>
          ))}
          <option value={notSureService}>{notSureService}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="budget">
          Estimated budget <small>(optional)</small>
        </label>
        <select id="budget" name="budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
          <option value="">Prefer not to say</option>
          <option>Under ₹50,000</option>
          <option>₹50,000 – ₹2,00,000</option>
          <option>₹2,00,000 – ₹5,00,000</option>
          <option>Above ₹5,00,000</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          minLength={20}
          maxLength={5000}
          aria-describedby="message-help"
        />
        <small id="message-help">At least 20 characters.</small>
      </div>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy || !ready}>
        {busy ? "Sending request…" : signedIn ? "Save project request" : "Send request"}
      </button>
    </form>
  );
}
