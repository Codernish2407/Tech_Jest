import { WorkspaceNav } from "@/frontend/components/workspace-nav";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/backend/supabase/server";
import { MessageThread } from "@/frontend/components/message-thread";
import { statusLabel } from "@/frontend/data/workflow";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/backend/supabase/session";
import { unreadByConversation } from "@/backend/supabase/unread";

// A private client page, so keep it out of search results.
export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/auth?next=/messages");
  if (user.app_metadata?.role === "admin") redirect("/admin/messages");
  const [{ data: conversations }, unread] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, status, priority, last_message_at")
      .eq("client_id", user.id)
      .neq("status", "archived")
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    unreadByConversation(supabase),
  ]);
  const { conversation: selectedId } = await searchParams;
  const first = conversations?.find((item) => item.id === selectedId) ?? conversations?.[0];
  return (
    <section className="section">
      <div className="container dashboard">
        <WorkspaceNav />
        <div className="dashboard-head">
          <div>
            <div className="eyebrow">Client portal</div>
            <h1>Messages.</h1>
            <p className="lead">Keep every project conversation with the TechJest team in one secure place.</p>
          </div>
          <Link className="btn btn-ghost" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
        <div className="messages-layout">
          <aside className="conversation-list">
            <div className="conversation-list-head">
              <h2>Conversations</h2>
              <span>{conversations?.length ?? 0}</span>
            </div>
            {conversations?.length ? (
              conversations.map((item) => {
                // The open conversation is marked read as it loads, so it never shows a badge.
                const newCount = item.id === first?.id ? 0 : (unread.get(item.id) ?? 0);
                return (
                  <Link
                    className={`conversation-list-item ${item.id === first?.id ? "active" : ""}`}
                    href={`/messages?conversation=${item.id}`}
                    key={item.id}
                    aria-current={item.id === first?.id ? "page" : undefined}
                  >
                    <strong>
                      {item.title}
                      {newCount > 0 && <span className="notification-unread-dot">{newCount} new</span>}
                    </strong>
                    <small>
                      {statusLabel("conversation", item.status, "client")} ·{" "}
                      {item.last_message_at ? formatDate(item.last_message_at) : "New"}
                    </small>
                  </Link>
                );
              })
            ) : (
              <p className="admin-message">Your conversations will appear here after you submit a project request.</p>
            )}
          </aside>
          {first ? (
            <MessageThread conversation={first} currentUserId={user.id} />
          ) : (
            <div className="empty-state">
              <h2>No conversations yet.</h2>
              <p>Start a project and the TechJest team will reply here.</p>
              <Link className="btn btn-primary" href="/contact">
                Start a project
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
