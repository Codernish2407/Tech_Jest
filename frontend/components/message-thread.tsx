"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/backend/supabase/client";
import { statusLabel } from "@/frontend/data/workflow";
import { UNREAD_EVENT } from "@/frontend/components/account";
import { mergeMessages } from "@/lib/message-page";

type Conversation = { id: string; title: string; status: string; priority: string; last_message_at?: string | null };
type Message = {
  id: string;
  sender_id: string;
  sender_type: string;
  content: string;
  message_type: string;
  created_at: string;
};

// "Today", "Yesterday", or "23 Oct 2026", in the reader's own time zone, for the line above each day's messages.
function dayLabel(value: string) {
  const day = new Date(value).toDateString();
  const today = new Date();
  if (day === today.toDateString()) return "Today";
  today.setDate(today.getDate() - 1);
  if (day === today.toDateString()) return "Yesterday";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function timeOfDay(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { timeStyle: "short" });
}

type ThreadProps = {
  conversation: Conversation;
  currentUserId?: string;
  admin?: boolean;
};

export function MessageThread(props: ThreadProps) {
  // Switching conversations clears drafts/history and cannot reuse a late response from another thread.
  return <Thread key={props.conversation.id} {...props} />;
}

function Thread({ conversation, currentUserId, admin = false }: ThreadProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [nextCursor, setNextCursor] = useState("");
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const knownLatest = useRef<string | null>(null);
  const hasLoadedHistory = useRef(false);
  const active = useRef(true);
  const latestRequest = useRef<AbortController | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  const scrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Whether the reader is at the newest message; if they scrolled up to read, new arrivals leave them there.
  const atBottom = useRef(true);

  // Success notes fade after a few seconds; errors stay until the next attempt.
  useEffect(() => {
    if (status !== "Sent" && status !== "Internal note saved") return;
    const timer = window.setTimeout(() => setStatus(""), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const list = listRef.current;
    if (list && scrollAnchor.current) {
      list.scrollTop = scrollAnchor.current.top + list.scrollHeight - scrollAnchor.current.height;
      scrollAnchor.current = null;
    } else if (list && atBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages, loading]);

  const load = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    latestRequest.current?.abort();
    const controller = new AbortController();
    latestRequest.current = controller;
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, { signal: controller.signal });
      if (!response.ok) throw new Error("Could not load messages");
      const loaded = (await response.json()) as Message[];
      if (!active.current || controller.signal.aborted) return;
      setMessages((current) => mergeMessages(current, loaded));
      if (!hasLoadedHistory.current) setNextCursor(response.headers.get("X-Next-Cursor") ?? "");
      setLoadError("");
      const latest = loaded.at(-1)?.id ?? "";
      if (knownLatest.current !== null && latest !== knownLatest.current) router.refresh();
      // Loading marks the thread read, so the header bell recounts on first open and on new arrivals.
      if (latest !== knownLatest.current) window.dispatchEvent(new Event(UNREAD_EVENT));
      knownLatest.current = latest;
    } catch {
      if (!active.current || controller.signal.aborted) return;
      setLoadError("Messages could not be loaded. Check your connection and try again.");
    } finally {
      if (active.current && !controller.signal.aborted) setLoading(false);
    }
  }, [conversation.id, router]);

  async function loadEarlier() {
    if (!nextCursor || loadingEarlier) return;
    setLoadingEarlier(true);
    setHistoryError("");
    const controller = new AbortController();
    historyRequest.current = controller;
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/messages?before=${encodeURIComponent(nextCursor)}`,
        {
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error("Could not load earlier messages");
      const older = (await response.json()) as Message[];
      if (!active.current || controller.signal.aborted) return;
      const list = listRef.current;
      if (list) scrollAnchor.current = { height: list.scrollHeight, top: list.scrollTop };
      atBottom.current = false;
      hasLoadedHistory.current = true;
      setMessages((current) => mergeMessages(current, older));
      setNextCursor(response.headers.get("X-Next-Cursor") ?? "");
    } catch {
      if (active.current && !controller.signal.aborted)
        setHistoryError("Earlier messages could not be loaded. Please retry.");
    } finally {
      if (active.current && !controller.signal.aborted) setLoadingEarlier(false);
    }
  }
  useEffect(() => {
    active.current = true;
    void load();
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    // Live updates must carry the signed-in session, or the security rules hide every message from them.
    // The browser client loads its session after the socket opens, so hand the token over before subscribing.
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (data.session) await supabase.realtime.setAuth(data.session.access_token);
        if (cancelled) return;
        // A unique name per subscription: reusing one can hand a new subscription a channel that is still
        // being removed (React mounts effects twice in development), which silently stops live updates.
        channel = supabase
          .channel(`conversation-${conversation.id}-${crypto.randomUUID()}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
            () => void load(),
          )
          .subscribe();
      })
      .catch(() => {
        // Polling remains available when a realtime connection cannot be established.
        console.warn("Live message updates are unavailable; messages will refresh periodically.");
      });
    const timer = window.setInterval(() => void load(), 15000);
    const onVisible = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      active.current = false;
      latestRequest.current?.abort();
      historyRequest.current?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversation.id, load]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || sending) return;
    setStatus("");
    setSending(true);
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, internal }),
      });
      if (!response.ok) {
        setStatus("Message could not be sent. Please try again.");
        return;
      }
      const message = (await response.json()) as Message;
      if (!active.current) return;
      atBottom.current = true;
      setMessages((current) => mergeMessages(current, [message]));
      setContent("");
      setStatus(internal ? "Internal note saved" : "Sent");
      // The conversation's status changes with each message; refresh the badges and unread counts around the thread.
      router.refresh();
    } catch {
      setStatus("Message could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="message-thread">
      <header className="message-thread-head">
        <div>
          <span className="eyebrow">{admin ? "Client conversation" : "TechJest support"}</span>
          <h2>{conversation.title}</h2>
        </div>
        <span className={`admin-status status-${conversation.status}`}>
          {statusLabel("conversation", conversation.status, admin ? "admin" : "client")}
        </span>
      </header>
      <div
        className="message-list"
        aria-live="polite"
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        }}
      >
        {nextCursor && !loading && (
          <button type="button" className="btn btn-ghost" onClick={() => void loadEarlier()} disabled={loadingEarlier}>
            {loadingEarlier ? "Loading earlier messages…" : "Load earlier messages"}
          </button>
        )}
        {historyError && (
          <p className="admin-message" role="alert">
            {historyError}
          </p>
        )}
        {loading ? (
          <p className="admin-message">Loading conversation...</p>
        ) : loadError ? (
          <div className="empty-state">
            <p>{loadError}</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              Try again
            </button>
          </div>
        ) : messages.length ? (
          messages.map((message, index) => {
            const day = dayLabel(message.created_at);
            const previous = messages[index - 1];
            const newDay = !previous || day !== dayLabel(previous.created_at);
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <p className="message-day">
                    <span>{day}</span>
                  </p>
                )}
                {message.message_type === "system" ? (
                  <p className="message-system">
                    {message.content} · <time dateTime={message.created_at}>{timeOfDay(message.created_at)}</time>
                  </p>
                ) : (
                  <article
                    className={`message-bubble ${message.sender_type === "internal" ? "message-internal" : message.sender_id === currentUserId ? "message-own" : "message-other"}`}
                  >
                    <div className="message-label">
                      {message.sender_type === "internal"
                        ? "Internal note · only the TechJest team sees this"
                        : message.sender_type === "admin"
                          ? "TechJest"
                          : message.sender_id === currentUserId
                            ? "You"
                            : "Client"}
                    </div>
                    <p>{message.content}</p>
                    <time dateTime={message.created_at}>{timeOfDay(message.created_at)}</time>
                  </article>
                )}
              </Fragment>
            );
          })
        ) : (
          <p className="admin-message">No messages yet. Start the conversation below.</p>
        )}
      </div>
      <form className="message-composer" onSubmit={send}>
        <textarea
          aria-label={internal ? "Internal note" : "Message"}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={internal ? "Write an internal note..." : "Write a message..."}
          rows={3}
          maxLength={5000}
          disabled={sending}
          onKeyDown={(event) => {
            // Ctrl + Enter (⌘ + Enter on a Mac) sends; plain Enter still starts a new line.
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="message-composer-actions">
          <div className="message-composer-options">
            {admin && (
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(event) => setInternal(event.target.checked)}
                  disabled={sending}
                />{" "}
                Internal note
              </label>
            )}
            <small className="message-shortcut">Ctrl + Enter to send</small>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!content.trim() || sending}>
            {sending ? "Sending..." : "Send message"}
          </button>
        </div>
        {status && (
          <small className="admin-message" role="status">
            {status}
          </small>
        )}
      </form>
    </section>
  );
}
