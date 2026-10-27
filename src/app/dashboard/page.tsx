import { WorkspaceNav } from "@/frontend/components/workspace-nav";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/backend/supabase/server";
import { countUnreadMessages } from "@/backend/supabase/unread";
import { ProfileEditor } from "@/frontend/components/profile-editor";
import { ProposalResponse } from "@/frontend/components/proposal-response";
import { statusLabel } from "@/frontend/data/workflow";
import { formatDate, formatMoney } from "@/lib/format";
import { getSessionUser } from "@/backend/supabase/session";

// A private client page, so keep it out of search results.
export const metadata: Metadata = {
  title: "Your workspace",
  robots: { index: false, follow: false },
};

export default async function Dashboard() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/auth");
  // Admins have no client workspace; their home is the admin console.
  if (user.app_metadata?.role === "admin") redirect("/admin");
  let { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company, phone, purpose")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    const metadata = user.user_metadata ?? {};
    const fullName = String(metadata.full_name ?? metadata.name ?? user.email?.split("@")[0] ?? "TechJest client")
      .trim()
      .slice(0, 100);
    const company = typeof metadata.company === "string" ? metadata.company.trim().slice(0, 120) : null;
    const phone = typeof metadata.phone === "string" ? metadata.phone.trim().slice(0, 30) : null;
    const purpose = String(metadata.purpose ?? "Project consultation")
      .trim()
      .slice(0, 500);
    const { data: createdProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: fullName.length >= 2 ? fullName : "TechJest client",
        company: company || null,
        phone: phone || null,
        purpose: purpose.length >= 3 ? purpose : "Project consultation",
      })
      .select("full_name, company, phone, purpose")
      .single();
    profile = createdProfile;
  }
  const [{ data: requests, error: requestsError }, unreadMessageCount] = await Promise.all([
    supabase
      .from("project_requests")
      .select("id, service, message, budget, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    countUnreadMessages(supabase),
  ]);
  const requestIds = requests?.map((request) => request.id) ?? [];
  // Proposals appear once the team marks them sent; drafts stay internal (also enforced by RLS).
  const [{ data: projects }, { data: proposals }, { data: conversations }, { data: dueInvoices }] = requestIds.length
    ? await Promise.all([
        supabase
          .from("projects")
          .select("id, request_id, name, status, start_date, target_date")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("proposals")
          .select("id, request_id, title, summary, amount, currency, status, valid_until")
          .in("request_id", requestIds)
          .neq("status", "draft")
          .order("created_at", { ascending: false }),
        supabase.from("conversations").select("id, request_id").eq("client_id", user.id).in("request_id", requestIds),
        // Sent invoices are the ones waiting for payment.
        supabase
          .from("invoices")
          .select("id, project_id, number, amount, currency, due_date")
          .in("request_id", requestIds)
          .eq("status", "sent")
          .order("due_date", { ascending: true, nullsFirst: false }),
      ])
    : ([{ data: [] }, { data: [] }, { data: [] }, { data: [] }] as const);
  const { data: tasks } = projects?.length
    ? await supabase
        .from("project_tasks")
        .select("id, project_id, title, status, due_date")
        .in(
          "project_id",
          projects.map((project) => project.id),
        )
        .order("created_at", { ascending: true })
    : { data: [] };
  const tasksByProject = new Map<string, NonNullable<typeof tasks>>();
  (tasks ?? []).forEach((task) =>
    tasksByProject.set(task.project_id, [...(tasksByProject.get(task.project_id) ?? []), task]),
  );
  const proposalsByRequest = new Map<string, NonNullable<typeof proposals>>();
  (proposals ?? []).forEach((proposal) =>
    proposalsByRequest.set(proposal.request_id, [...(proposalsByRequest.get(proposal.request_id) ?? []), proposal]),
  );
  const conversationByRequest = new Map((conversations ?? []).map((item) => [item.request_id, item.id]));
  const awaitingDecision = (proposals ?? []).filter((proposal) => proposal.status === "sent");
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  return (
    <section className="section">
      <div className="container dashboard">
        <WorkspaceNav />
        <div className="eyebrow">Private workspace</div>
        <h1>Good to see you, {profile?.full_name?.split(" ")[0] ?? "there"}.</h1>
        <p className="lead">Your account, project requests, and next steps in one place.</p>
        <div className="dashboard-head">
          <div>
            <strong>{user.email}</strong>
            <small className="dashboard-company">{profile?.company ?? "Independent project"}</small>
          </div>
          <div className="dashboard-actions">
            <Link className="btn btn-primary" href="/messages">
              Messages{unreadMessageCount ? ` (${unreadMessageCount})` : ""}
            </Link>
            <Link className="btn btn-primary" href="/contact">
              New project request
            </Link>
            <form action="/auth/signout" method="post">
              <button className="btn btn-ghost">Log out</button>
            </form>
          </div>
        </div>
        {(unreadMessageCount > 0 || awaitingDecision.length > 0 || (dueInvoices?.length ?? 0) > 0) && (
          <section className="attention-panel" aria-labelledby="attention-heading">
            <h2 id="attention-heading">Needs your attention</h2>
            <ul>
              {unreadMessageCount > 0 && (
                <li>
                  <Link href="/messages">{plural(unreadMessageCount, "new message")} from the TechJest team</Link>
                </li>
              )}
              {awaitingDecision.map((proposal) => (
                <li key={proposal.id}>
                  <a href={`#proposal-${proposal.id}`}>
                    Proposal to review: {proposal.title}
                    {proposal.amount !== null ? ` · ${formatMoney(proposal.amount, proposal.currency)}` : ""}
                  </a>
                </li>
              ))}
              {(dueInvoices ?? []).map((invoice) => (
                <li key={invoice.id}>
                  {invoice.project_id ? (
                    <Link href={`/project/${invoice.project_id}`}>
                      Invoice {invoice.number}: {formatMoney(invoice.amount, invoice.currency)}
                      {invoice.due_date ? `, due ${formatDate(invoice.due_date)}` : ""}
                    </Link>
                  ) : (
                    <span>
                      Invoice {invoice.number}: {formatMoney(invoice.amount, invoice.currency)}
                      {invoice.due_date ? `, due ${formatDate(invoice.due_date)}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="profile-summary">
          <div>
            <span>Company</span>
            <strong>{profile?.company || "Not added"}</strong>
          </div>
          <div>
            <span>Phone</span>
            <strong>{profile?.phone || "Not added"}</strong>
          </div>
          <div>
            <span>Purpose</span>
            <strong>{profile?.purpose || "Project consultation"}</strong>
          </div>
        </div>
        {profile && <ProfileEditor userId={user.id} profile={profile} />}
        {projects?.length ? (
          <>
            <div className="history-heading">
              <h2>Active projects</h2>
              <span>{plural(projects.length, "project")}</span>
            </div>
            <div className="history">
              {projects.map((project) => (
                <article className="history-item" key={project.id}>
                  <div>
                    <div className="project-tag">{statusLabel("project", project.status)}</div>
                    <h3>
                      <Link href={`/project/${project.id}`}>{project.name}</Link>
                    </h3>
                    <p>
                      {project.start_date ? `Starts ${formatDate(project.start_date)}` : "Kickoff date to be confirmed"}
                      {project.target_date ? ` · target ${formatDate(project.target_date)}` : ""}
                    </p>
                    {tasksByProject.get(project.id)?.map((task) => (
                      <small className="dashboard-task" key={task.id}>
                        {statusLabel("task", task.status)} · {task.title}
                        {task.due_date ? ` · due ${formatDate(task.due_date)}` : ""}
                      </small>
                    ))}
                    <Link className="text-link" href={`/project/${project.id}`}>
                      Open project →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
        <div className="history-heading">
          <h2>Project history</h2>
          {!requestsError && <span>{plural(requests?.length ?? 0, "request")}</span>}
        </div>
        <div className="history">
          {requestsError ? (
            <div className="empty-state" role="alert">
              <h2>Your requests could not be loaded.</h2>
              <p>This is a problem on our side, not with your account. Refresh the page in a minute.</p>
            </div>
          ) : requests?.length ? (
            requests.map((request) => {
              const conversationId = conversationByRequest.get(request.id);
              return (
                <article className="history-item" key={request.id}>
                  <div>
                    <div className="project-tag">{statusLabel("request", request.status)}</div>
                    <h3>{request.service}</h3>
                    <p>{request.message}</p>
                    {request.budget && <small>Budget: {request.budget}</small>}
                    {proposalsByRequest.get(request.id)?.map((proposal) => (
                      <div className="dashboard-proposal" key={proposal.id} id={`proposal-${proposal.id}`}>
                        <span className="eyebrow">Proposal · {statusLabel("proposal", proposal.status, "client")}</span>
                        <strong>{proposal.title}</strong>
                        <p>{proposal.summary}</p>
                        <small>
                          {proposal.amount !== null
                            ? formatMoney(proposal.amount, proposal.currency)
                            : "Amount to be confirmed"}
                          {proposal.valid_until ? ` · valid until ${formatDate(proposal.valid_until)}` : ""}
                        </small>
                        {proposal.status === "sent" && <ProposalResponse proposalId={proposal.id} />}
                      </div>
                    ))}
                    {conversationId && (
                      <Link className="text-link" href={`/messages?conversation=${conversationId}`}>
                        View conversation →
                      </Link>
                    )}
                  </div>
                  <time dateTime={request.created_at}>{formatDate(request.created_at)}</time>
                </article>
              );
            })
          ) : (
            <div className="empty-state">
              <h2>No requests yet.</h2>
              <p>Tell us what you’re building and your project history will appear here.</p>
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
