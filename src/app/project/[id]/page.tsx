import { WorkspaceNav } from "@/frontend/components/workspace-nav";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/backend/supabase/server";
import { withDownloadLinks } from "@/backend/supabase/documents";
import { MessageThread } from "@/frontend/components/message-thread";
import { ProjectConversationStart } from "@/frontend/components/project-conversation-start";
import { ProposalResponse } from "@/frontend/components/proposal-response";
import { statusLabel } from "@/frontend/data/workflow";
import { formatDate, formatMoney } from "@/lib/format";
import Link from "next/link";
import { getSessionUser } from "@/backend/supabase/session";

// A private client page, so keep it out of search results.
export const metadata: Metadata = {
  title: "Your project",
  robots: { index: false, follow: false },
};

export default async function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(`/auth?next=/project/${encodeURIComponent(id)}`);
  if (user.app_metadata?.role === "admin") redirect(`/admin/projects/${encodeURIComponent(id)}`);
  const { data: project } = await supabase
    .from("projects")
    .select("id, request_id, name, status, start_date, target_date")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  // Drafts are internal to the TechJest team.
  const [{ data: tasks }, { data: documentRows }, { data: invoices }, { data: proposals }, { data: conversation }] =
    await Promise.all([
      supabase
        .from("project_tasks")
        .select("id, title, status, due_date")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("project_documents")
        .select("id, name, storage_path, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, number, amount, currency, status, due_date")
        .eq("project_id", id)
        .neq("status", "draft")
        .order("created_at", { ascending: false }),
      project.request_id
        ? supabase
            .from("proposals")
            .select("id, title, summary, amount, currency, status, valid_until")
            .eq("request_id", project.request_id)
            .neq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] }),
      supabase
        .from("conversations")
        .select("id, title, status, priority, last_message_at")
        .eq("client_id", user.id)
        .or(
          project.request_id
            ? `project_id.eq.${project.id},request_id.eq.${project.request_id}`
            : `project_id.eq.${project.id}`,
        )
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const documents = await withDownloadLinks(supabase, documentRows ?? []);
  return (
    <section className="section">
      <div className="container dashboard">
        <WorkspaceNav />
        <div className="eyebrow">Client project</div>
        <h1>{project.name}.</h1>
        <p className="lead">
          {statusLabel("project", project.status)}
          {project.start_date ? ` · started ${formatDate(project.start_date)}` : ""}
          {project.target_date ? ` · target ${formatDate(project.target_date)}` : ""}
        </p>
        <p>
          <Link className="btn btn-ghost" href="/messages">
            Open full message center
          </Link>
        </p>
        <div className="portal-grid">
          <section className="admin-panel">
            <h2>Latest proposal</h2>
            {proposals?.[0] ? (
              <>
                <h3>{proposals[0].title}</h3>
                <p>{proposals[0].summary}</p>
                <strong>
                  {proposals[0].amount !== null
                    ? formatMoney(proposals[0].amount, proposals[0].currency)
                    : "Amount to be confirmed"}{" "}
                  · {statusLabel("proposal", proposals[0].status, "client")}
                  {proposals[0].valid_until ? ` · valid until ${formatDate(proposals[0].valid_until)}` : ""}
                </strong>
                {proposals[0].status === "sent" && <ProposalResponse proposalId={proposals[0].id} />}
              </>
            ) : (
              <p className="admin-message">No proposal published yet.</p>
            )}
          </section>
          <section className="admin-panel">
            <h2>Tasks</h2>
            {tasks?.length ? (
              tasks.map((task) => (
                <div className="admin-mini-row" key={task.id}>
                  <strong>{task.title}</strong>
                  <span className={`admin-status status-${task.status}`}>
                    {statusLabel("task", task.status)}
                    {task.due_date ? ` · due ${formatDate(task.due_date)}` : ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="admin-message">No tasks published yet.</p>
            )}
          </section>
          <section className="admin-panel">
            <h2>Documents</h2>
            {documents.length ? (
              documents.map((document) => (
                <div className="admin-mini-row" key={document.id}>
                  <strong>{document.name}</strong>
                  <span>
                    {document.url ? (
                      <a href={document.url} target="_blank" rel="noopener noreferrer">
                        Download
                      </a>
                    ) : (
                      "Private file"
                    )}
                  </span>
                </div>
              ))
            ) : (
              <p className="admin-message">No documents published yet.</p>
            )}
          </section>
          <section className="admin-panel">
            <h2>Invoices</h2>
            {invoices?.length ? (
              invoices.map((invoice) => (
                <div className="admin-mini-row" key={invoice.id}>
                  <strong>{invoice.number}</strong>
                  <span>
                    {formatMoney(invoice.amount, invoice.currency)} · {statusLabel("invoice", invoice.status)}
                    {invoice.due_date && invoice.status === "sent" ? ` · due ${formatDate(invoice.due_date)}` : ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="admin-message">No invoices yet.</p>
            )}
          </section>
          <section className="admin-panel">
            <h2>Messages</h2>
            {conversation ? (
              <MessageThread conversation={conversation} currentUserId={user.id} />
            ) : (
              <ProjectConversationStart projectId={project.id} title={project.name} />
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
