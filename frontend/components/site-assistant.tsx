"use client";

import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MAX_QUESTION_LENGTH, type ChatMessage } from "@/lib/chat-history";

const greeting =
  "Hi! I answer questions about TechJest from this website: our services, starting prices, process, team, and how to get in touch.";
const suggestions = ["What services do you offer?", "How much does a website cost?", "How do I start a project?"];

// Answers are plain text, rendered as text nodes. Bare URLs and email addresses become links.
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s<>"']+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g).map((part, index) => {
    if (index % 2 === 0) return part;
    const target = part.replace(/[.,;:!?)\]]+$/, "");
    const trailing = part.slice(target.length);
    let link: ReactNode;
    if (target.startsWith("http")) {
      let internal = false;
      try {
        internal = new URL(target).origin === window.location.origin;
      } catch {}
      link = internal ? (
        <a href={target}>{target}</a>
      ) : (
        <a href={target} target="_blank" rel="noopener noreferrer">
          {target}
        </a>
      );
    } else {
      link = <a href={`mailto:${target}`}>{target}</a>;
    }
    return (
      <Fragment key={index}>
        {link}
        {trailing}
      </Fragment>
    );
  });
}

const AssistantIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
    <path d="M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01" strokeLinecap="round" strokeWidth="2.4" />
  </svg>
);

// The floating "Ask TechJest" chat. It sits above the WhatsApp button when that one is shown (`raised`).
export function SiteAssistant({ raised }: { raised: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const panelId = useId();
  const inputId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending, error, open]);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    const previous = messages;
    const history: ChatMessage[] = [...previous, { role: "user", content: text }];
    setMessages(history);
    setDraft("");
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data: unknown = await response.json().catch(() => null);
      const reply = typeof data === "object" && data !== null && "reply" in data ? data.reply : undefined;
      if (!response.ok || typeof reply !== "string") {
        const message = typeof data === "object" && data !== null && "error" in data ? data.error : undefined;
        throw new Error(typeof message === "string" ? message : "The assistant couldn’t answer just now.");
      }
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (caught) {
      // Put the question back so the conversation still alternates and the visitor can resend it.
      setMessages(previous);
      setDraft(text);
      setError(
        caught instanceof TypeError
          ? "Couldn’t reach the assistant. Check your connection and try again."
          : caught instanceof Error
            ? caught.message
            : "The assistant couldn’t answer just now.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <aside aria-label="Website assistant" className={`assistant${raised ? " assistant-raised" : ""}`}>
      {open && (
        <div
          className="assistant-panel"
          id={panelId}
          role="dialog"
          aria-label="Ask TechJest"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div className="assistant-head">
            <div>
              <strong>Ask TechJest</strong>
              <span>Answers from this website</span>
            </div>
            <button type="button" className="assistant-close" onClick={close} aria-label="Close assistant">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="assistant-log" ref={logRef} aria-live="polite" aria-busy={pending}>
            <p className="assistant-msg assistant-msg-bot">{greeting}</p>
            {messages.map((message, index) => (
              <p
                key={index}
                className={`assistant-msg ${message.role === "user" ? "assistant-msg-user" : "assistant-msg-bot"}`}
              >
                {message.role === "assistant" ? linkify(message.content) : message.content}
              </p>
            ))}
            {pending && <p className="assistant-msg assistant-msg-bot assistant-typing">Looking that up…</p>}
            {!messages.length && !pending && (
              <div className="assistant-suggestions">
                {suggestions.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => ask(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && (
            <p className="assistant-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <label className="visually-hidden" htmlFor={inputId}>
              Your question
            </label>
            <input
              id={inputId}
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_QUESTION_LENGTH}
              placeholder="Ask about services, prices, process…"
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" className="btn btn-primary" disabled={pending || !draft.trim()}>
              Send
            </button>
          </form>
          <p className="assistant-note">
            AI answers based on this website and can make mistakes. Please don’t share personal details here.
          </p>
        </div>
      )}
      <button
        ref={launcherRef}
        type="button"
        className="assistant-launcher"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Close the TechJest assistant" : "Ask TechJest a question"}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <AssistantIcon />
      </button>
    </aside>
  );
}
