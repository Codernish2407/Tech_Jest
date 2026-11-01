import Link from "next/link";
import { requireAdmin } from "@/backend/supabase/admin";
import { profilesById } from "@/backend/supabase/profiles";
import { AdminShell } from "@/frontend/components/admin-shell";
import { EmailLink, PhoneLinks } from "@/frontend/components/contact-links";
import { AdminStatusSelect } from "@/frontend/components/admin-status-select";
import { statusOptions } from "@/frontend/data/workflow";
import { formatDateTime } from "@/lib/format";
import { pageFromParam, pageRange, searchFromParam } from "@/lib/pagination";
import { AdminPagination } from "@/frontend/components/admin-pagination";
import { AdminDeleteButton } from "@/frontend/components/admin-delete-button";
import { AdminRequestBulkDelete, BULK_FORM } from "@/frontend/components/admin-request-bulk-delete";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[]; status?: string | string[] }>;
}) {
  const { supabase, user } = await requireAdmin();
  const params = await searchParams;
  const page = pageFromParam(params.page);
  const [from, to] = pageRange(page);
  const search = searchFromParam(params.q);
  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = statusOptions.request.some(([value]) => value === statusParam) ? statusParam : undefined;
  let query = supabase
    .from("project_requests")
    .select(
      "id, service, message, budget, name, email, phone, company, budget_range, timeline, description, status, created_at, user_id",
      { count: "exact" },
    );
  if (status) query = query.eq("status", status);
  if (search) {
    const pattern = `"%${search}%"`;
    query = query.or(
      ["name", "email", "phone", "company", "service", "message"]
        .map((column) => `${column}.ilike.${pattern}`)
        .join(","),
    );
  }
  const { data: requests, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  const filtered = Boolean(search || status);
  const requestIds = requests?.map((request) => request.id) ?? [];
  const [profiles, { data: requestServices, error: requestServicesError }] = await Promise.all([
    profilesById(supabase, requests?.map((request) => request.user_id) ?? []),
    requestIds.length
      ? supabase
          .from("project_request_services")
          .select("request_id, service_name_snapshot, price_snapshot")
          .in("request_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const servicesByRequest = new Map<string, string[]>();
  (requestServices ?? []).forEach((item) => {
    servicesByRequest.set(item.request_id, [
      ...(servicesByRequest.get(item.request_id) ?? []),
      item.service_name_snapshot,
    ]);
  });
  const loadError = error ?? requestServicesError;
  return (
    <AdminShell user={user}>
      <div className="admin-title">
        <div>
          <div className="eyebrow">Lead management</div>
          <h1>Consultation requests.</h1>
          <p className="lead">Every enquiry submitted through the TechJest website.</p>
        </div>
        <span className="admin-count">
          {count ?? requests?.length ?? 0} {filtered ? "matching" : "total"}
        </span>
      </div>
      <form className="admin-filter" action="/admin/requests" role="search">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search name, email, phone, company, service…"
          aria-label="Search requests"
        />
        <select name="status" defaultValue={status ?? ""} aria-label="Filter by status">
          <option value="">All statuses</option>
          {statusOptions.request.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-small btn-ghost">
          Search
        </button>
        {filtered && (
          <Link className="text-link" href="/admin/requests">
            Clear
          </Link>
        )}
      </form>
      {loadError ? (
        <div className="empty-state">
          <h2>Requests unavailable.</h2>
          <p>Confirm the latest schema and admin RLS policies are applied.</p>
        </div>
      ) : requests?.length ? (
        <>
          <AdminRequestBulkDelete total={requests.length} />
          <div className="admin-requests">
            {requests.map((request) => {
              const profile = profiles.get(request.user_id);
              const selectedServices = servicesByRequest.get(request.id) ?? [];
              const clientName = request.name ?? profile?.full_name ?? "Unknown client";
              const phone = request.phone ?? profile?.phone;
              return (
                <article className="admin-request" key={request.id}>
                  <div className="admin-request-top">
                    <input
                      type="checkbox"
                      className="admin-request-select"
                      form={BULK_FORM}
                      name="id"
                      value={request.id}
                      aria-label={`Select ${request.service} from ${clientName}`}
                    />
                    <div>
                      <AdminStatusSelect kind="request" id={request.id} value={request.status} name={request.service} />
                      <h2>
                        <Link href={`/admin/requests/${request.id}`}>{request.service}</Link>
                      </h2>
                    </div>
                    <time dateTime={request.created_at}>{formatDateTime(request.created_at)}</time>
                  </div>
                  <p className="admin-message">{request.description ?? request.message}</p>
                  {(request.budget_range ?? request.budget) && (
                    <p>
                      <strong>Budget:</strong> {request.budget_range ?? request.budget}
                    </p>
                  )}
                  {request.timeline && (
                    <p>
                      <strong>Timeline:</strong> {request.timeline}
                    </p>
                  )}
                  {selectedServices.length > 0 && (
                    <p>
                      <strong>Selected services:</strong> {selectedServices.join(", ")}
                    </p>
                  )}
                  <div className="admin-customer">
                    <strong>{clientName}</strong>
                    {!request.user_id && <span className="admin-status">Guest · reply by email</span>}
                    {request.email ? (
                      <EmailLink email={request.email} subject={`Your TechJest enquiry: ${request.service}`} />
                    ) : (
                      <span>Email unavailable</span>
                    )}
                    <span>{request.company ?? profile?.company ?? "Independent project"}</span>
                    {phone && <PhoneLinks phone={phone} />}
                    <Link className="text-link" href={`/admin/requests/${request.id}`}>
                      Open request →
                    </Link>
                    <AdminDeleteButton kind="request" id={request.id} name={`${request.service} from ${clientName}`} />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>{filtered ? "No requests match." : page > 1 ? "No requests on this page." : "No requests yet."}</h2>
          <p>{filtered ? "Try a different search or status." : "New consultation requests will appear here."}</p>
        </div>
      )}
      {!loadError && (
        <AdminPagination page={page} total={count ?? 0} basePath="/admin/requests" params={{ q: search, status }} />
      )}
    </AdminShell>
  );
}
