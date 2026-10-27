create extension if not exists citext;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name citext not null,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_length check (char_length(name::text) between 2 and 160),
  constraint companies_website_length check (website is null or char_length(website) <= 300)
);

create unique index if not exists companies_name_unique on public.companies (lower(name::text));
alter table public.companies enable row level security;

-- Company names are private: users see only their own company, admins see all.
-- Signup creates companies through the security-definer handle_new_user trigger.
drop policy if exists "Authenticated users can read companies" on public.companies;
drop policy if exists "Authenticated users can create companies" on public.companies;
drop policy if exists "Admins can manage companies" on public.companies;
create policy "Admins can manage companies" on public.companies for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  company text check (company is null or char_length(company) <= 120),
  company_id uuid references public.companies(id) on delete set null,
  phone text check (phone is null or char_length(phone) <= 30),
  purpose text not null check (char_length(purpose) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles add column if not exists company_id uuid references public.companies(id) on delete set null;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read their own company" on public.companies;
create policy "Users can read their own company" on public.companies for select to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.company_id = companies.id));

-- Signup must never fail because of an over-long or too-short optional field,
-- so values are trimmed to the column limits instead of tripping check constraints.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb;
  v_full_name text;
  v_company text;
  v_phone text;
  v_purpose text;
  v_company_id uuid;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name := left(coalesce(nullif(btrim(meta ->> 'full_name'), ''), nullif(btrim(meta ->> 'name'), ''), ''), 100);
  v_company := left(btrim(coalesce(meta ->> 'company', '')), 120);
  v_phone := nullif(left(btrim(coalesce(meta ->> 'phone', '')), 30), '');
  v_purpose := left(btrim(coalesce(meta ->> 'purpose', '')), 500);
  if char_length(v_full_name) < 2 then v_full_name := 'TechJest client'; end if;
  if char_length(v_purpose) < 3 then v_purpose := 'Project consultation'; end if;
  if char_length(v_company) >= 2 then
    insert into public.companies (name) values (v_company) on conflict do nothing;
    select id into v_company_id from public.companies where lower(name::text) = lower(v_company) limit 1;
  else
    v_company := null;
  end if;
  insert into public.profiles (id, full_name, company, company_id, phone, purpose)
  values (new.id, v_full_name, v_company, v_company_id, v_phone, v_purpose)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Runs only as the signup trigger; it is not part of the public API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, company, phone, purpose)
select
  users.id,
  coalesce(nullif(users.raw_user_meta_data->>'full_name', ''), 'TechJest client'),
  nullif(users.raw_user_meta_data->>'company', ''),
  nullif(users.raw_user_meta_data->>'phone', ''),
  coalesce(nullif(users.raw_user_meta_data->>'purpose', ''), 'Project consultation')
from auth.users as users
where not exists (
  select 1 from public.profiles where profiles.id = users.id
);

insert into public.companies (name)
select distinct trim(company)
from public.profiles
where company is not null and trim(company) <> ''
on conflict do nothing;

update public.profiles
set company_id = companies.id
from public.companies
where public.profiles.company_id is null
  and public.profiles.company is not null
  and lower(public.profiles.company) = lower(companies.name::text);

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  service text not null,
  message text not null check (char_length(message) between 20 and 5000),
  budget text,
  name text,
  email text,
  phone text,
  company text,
  budget_range text,
  timeline text,
  description text,
  lead_stage text not null default 'received' check (lead_stage in ('received', 'qualified', 'proposal', 'negotiation', 'won', 'project')),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_requests add column if not exists budget text;
alter table public.project_requests add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.project_requests add column if not exists name text;
alter table public.project_requests add column if not exists email text;
alter table public.project_requests add column if not exists phone text;
alter table public.project_requests add column if not exists company text;
alter table public.project_requests add column if not exists budget_range text;
alter table public.project_requests add column if not exists timeline text;
alter table public.project_requests add column if not exists description text;
alter table public.project_requests add column if not exists lead_stage text not null default 'received';
alter table public.project_requests add column if not exists updated_at timestamptz not null default now();
alter table public.project_requests drop constraint if exists project_requests_lead_stage_check;
alter table public.project_requests add constraint project_requests_lead_stage_check check (lead_stage in ('received', 'qualified', 'proposal', 'negotiation', 'won', 'project'));
alter table public.project_requests drop constraint if exists project_requests_status_check;
alter table public.project_requests add constraint project_requests_status_check check (status in ('received', 'in_progress', 'completed', 'declined'));
create index if not exists project_requests_user_created_idx on public.project_requests (user_id, created_at desc);
create index if not exists project_requests_company_idx on public.project_requests (company_id);

alter table public.project_requests enable row level security;

drop policy if exists "Users can read their own project requests" on public.project_requests;
create policy "Users can read their own project requests"
  on public.project_requests for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all project requests" on public.project_requests;
create policy "Admins can read all project requests"
  on public.project_requests for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Users can create their own project requests" on public.project_requests;
-- A new request always starts at the beginning of the pipeline; only admins move it along.
create policy "Users can create their own project requests"
  on public.project_requests for insert
  with check (
    auth.uid() = user_id
    and status = 'received'
    and lead_stage = 'received'
    and (company_id is null or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.company_id = project_requests.company_id
    ))
  );

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop function if exists public.admin_delete_user_data(uuid);
create function public.admin_delete_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' or target_user_id = auth.uid() then
    raise exception 'Not allowed';
  end if;
  -- Only the person's own conversations; admins are participants in every client
  -- conversation they open, and those must survive removing an admin's data.
  delete from public.conversations where client_id = target_user_id;
  delete from public.conversation_participants where user_id = target_user_id;
  delete from public.project_messages where user_id = target_user_id;
  delete from public.project_requests where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;
end;
$$;
revoke all on function public.admin_delete_user_data(uuid) from public;
grant execute on function public.admin_delete_user_data(uuid) to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in ('login', 'admin_login', 'signup')),
  email text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
alter table public.audit_logs enable row level security;
-- Sign-ins are recorded by the record_auth_event trigger (further down), so browsers cannot write here.
drop policy if exists "Users can insert audit logs" on public.audit_logs;
drop policy if exists "Users can record their own audit events" on public.audit_logs;
drop policy if exists "Admins can read audit events" on public.audit_logs;
create policy "Admins can read audit events"
  on public.audit_logs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update project requests" on public.project_requests;
create policy "Admins can update project requests"
  on public.project_requests for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can delete project requests" on public.project_requests;
create policy "Admins can delete project requests"
  on public.project_requests for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.project_request_services (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  service_slug text not null check (char_length(service_slug) between 1 and 160),
  service_name_snapshot text not null check (char_length(service_name_snapshot) between 1 and 200),
  price_snapshot numeric,
  created_at timestamptz not null default now()
);

create index if not exists project_request_services_request_idx
  on public.project_request_services (request_id);

alter table public.project_request_services enable row level security;

drop policy if exists "Users can read their own request services" on public.project_request_services;
create policy "Users can read their own request services"
  on public.project_request_services for select
  using (exists (
    select 1 from public.project_requests
    where project_requests.id = project_request_services.request_id
      and project_requests.user_id = auth.uid()
  ));

drop policy if exists "Users can create their own request services" on public.project_request_services;
create policy "Users can create their own request services"
  on public.project_request_services for insert
  with check (exists (
    select 1 from public.project_requests
    where project_requests.id = project_request_services.request_id
      and project_requests.user_id = auth.uid()
  ));

drop policy if exists "Admins can read all request services" on public.project_request_services;
create policy "Admins can read all request services"
  on public.project_request_services for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 5000),
  amount numeric check (amount is null or amount >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD')),
  valid_until date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_request_idx on public.proposals (request_id, created_at desc);
alter table public.proposals enable row level security;
drop policy if exists "Admins can manage proposals" on public.proposals;
create policy "Admins can manage proposals" on public.proposals for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Users can read their proposals" on public.proposals;
-- Draft proposals and invoices are internal until the team marks them sent.
create policy "Users can read their proposals" on public.proposals for select
  using (status <> 'draft' and exists (select 1 from public.project_requests where project_requests.id = proposals.request_id and project_requests.user_id = auth.uid()));

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.project_requests(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'planned' check (status in ('planned', 'active', 'on_hold', 'completed')),
  start_date date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_status_idx on public.projects (status, created_at desc);
alter table public.projects enable row level security;
drop policy if exists "Admins can manage projects" on public.projects;
create policy "Admins can manage projects" on public.projects for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Users can read their projects" on public.projects;
create policy "Users can read their projects" on public.projects for select
  using (exists (select 1 from public.project_requests where project_requests.id = projects.request_id and project_requests.user_id = auth.uid()));

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_idx on public.project_tasks (project_id, created_at asc);
alter table public.project_tasks enable row level security;
drop policy if exists "Admins can manage project tasks" on public.project_tasks;
create policy "Admins can manage project tasks" on public.project_tasks for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Users can read their project tasks" on public.project_tasks;
create policy "Users can read their project tasks" on public.project_tasks for select
  using (exists (
    select 1 from public.projects
    join public.project_requests on project_requests.id = projects.request_id
    where projects.id = project_tasks.project_id and project_requests.user_id = auth.uid()
  ));

create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists project_messages_project_idx on public.project_messages (project_id, created_at asc);
alter table public.project_messages enable row level security;
drop policy if exists "Admins can manage project messages" on public.project_messages;
create policy "Admins can manage project messages" on public.project_messages for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Users can read and send project messages" on public.project_messages;
create policy "Users can read and send project messages" on public.project_messages for select to authenticated
  using (exists (select 1 from public.projects join public.project_requests on project_requests.id = projects.request_id where projects.id = project_messages.project_id and project_requests.user_id = auth.uid()));
drop policy if exists "Users can create project messages" on public.project_messages;
create policy "Users can create project messages" on public.project_messages for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.projects join public.project_requests on project_requests.id = projects.request_id where projects.id = project_messages.project_id and project_requests.user_id = auth.uid()));

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists project_documents_project_idx on public.project_documents (project_id, created_at desc);
alter table public.project_documents enable row level security;
drop policy if exists "Admins can manage project documents" on public.project_documents;
create policy "Admins can manage project documents" on public.project_documents for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Users can read project documents" on public.project_documents;
create policy "Users can read project documents" on public.project_documents for select
  using (exists (select 1 from public.projects join public.project_requests on project_requests.id = projects.request_id where projects.id = project_documents.project_id and project_requests.user_id = auth.uid()));

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  request_id uuid references public.project_requests(id) on delete set null,
  number text not null unique,
  amount numeric not null check (amount >= 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoices_project_idx on public.invoices (project_id, created_at desc);
alter table public.invoices enable row level security;
drop policy if exists "Admins can manage invoices" on public.invoices;
create policy "Admins can manage invoices" on public.invoices for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Users can read their invoices" on public.invoices;
create policy "Users can read their invoices" on public.invoices for select
  using (status <> 'draft' and exists (select 1 from public.project_requests where project_requests.id = invoices.request_id and project_requests.user_id = auth.uid()));

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 160),
  category text not null check (char_length(category) between 2 and 80),
  description text not null check (char_length(description) between 10 and 1000),
  price numeric check (price is null or price >= 0),
  delivery text not null check (char_length(delivery) between 2 and 80),
  icon text not null default '✦',
  popular boolean not null default false,
  included jsonb not null default '[]'::jsonb,
  technologies jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_catalog_included_array check (jsonb_typeof(included) = 'array'),
  constraint service_catalog_technologies_array check (jsonb_typeof(technologies) = 'array')
);

alter table public.service_catalog enable row level security;
drop policy if exists "Public can read active services" on public.service_catalog;
create policy "Public can read active services"
  on public.service_catalog for select
  to anon, authenticated
  using (is_active = true or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can manage services" on public.service_catalog;
create policy "Admins can manage services"
  on public.service_catalog for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create index if not exists service_catalog_public_order_idx on public.service_catalog (is_active, sort_order, name);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('service_request','message','system')),
  title text not null check (char_length(title) between 2 and 200),
  body text not null check (char_length(body) between 1 and 500),
  request_id uuid references public.project_requests(id) on delete cascade,
  conversation_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_inbox_idx on public.admin_notifications (admin_id, read_at, created_at desc);
create unique index if not exists admin_notifications_request_unique on public.admin_notifications (request_id) where request_id is not null and type = 'service_request';
alter table public.admin_notifications enable row level security;
drop policy if exists "Admins can read own notifications" on public.admin_notifications;
create policy "Admins can read own notifications" on public.admin_notifications for select to authenticated
  using ((admin_id is null or admin_id = auth.uid()) and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can update own notifications" on public.admin_notifications;
create policy "Admins can update own notifications" on public.admin_notifications for update to authenticated
  using ((admin_id is null or admin_id = auth.uid()) and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((admin_id is null or admin_id = auth.uid()) and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can create notifications" on public.admin_notifications;
create policy "Admins can create notifications" on public.admin_notifications for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Users can create service request notifications" on public.admin_notifications;
create policy "Users can create service request notifications" on public.admin_notifications for insert to authenticated
  with check (
    admin_id is null and type = 'service_request'
    and exists (select 1 from public.project_requests where project_requests.id = admin_notifications.request_id and project_requests.user_id = auth.uid())
  );

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.project_requests(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references auth.users(id) on delete set null,
  title text not null default 'TechJest conversation',
  status text not null default 'open' check (status in ('open','waiting_for_client','waiting_for_admin','resolved','closed','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  last_message_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists conversations_request_unique on public.conversations(request_id) where request_id is not null;
create index if not exists conversations_client_idx on public.conversations(client_id, last_message_at desc);
create index if not exists conversations_project_idx on public.conversations(project_id, last_message_at desc);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client','admin','project_manager','support_agent')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_type text not null check (sender_type in ('client','admin','internal')),
  content text not null check (char_length(content) between 1 and 5000),
  message_type text not null default 'text' check (message_type in ('text','system','internal_note')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at asc);
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Participants can read conversations" on public.conversations;
create policy "Participants can read conversations" on public.conversations for select to authenticated
  using (client_id = auth.uid() or exists (select 1 from public.conversation_participants where conversation_id = conversations.id and user_id = auth.uid()) or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can manage conversations" on public.conversations;
create policy "Admins can manage conversations" on public.conversations for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Clients can create own conversations" on public.conversations;
-- Clients start conversations only on their own requests and projects, at the default status and priority.
create policy "Clients can create own conversations" on public.conversations for insert to authenticated
  with check (
    client_id = auth.uid()
    and created_by = auth.uid()
    and status = 'open'
    and priority = 'normal'
    and (request_id is null or exists (
      select 1 from public.project_requests
      where project_requests.id = conversations.request_id and project_requests.user_id = auth.uid()
    ))
    and (project_id is null or exists (
      select 1 from public.projects
      join public.project_requests on project_requests.id = projects.request_id
      where projects.id = conversations.project_id and project_requests.user_id = auth.uid()
    ))
  );
drop policy if exists "Users can read conversation participants" on public.conversation_participants;
create policy "Users can read conversation participants" on public.conversation_participants for select to authenticated
  using (user_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Admins can manage conversation participants" on public.conversation_participants;
create policy "Admins can manage conversation participants" on public.conversation_participants for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Clients can join own conversations" on public.conversation_participants;
create policy "Clients can join own conversations" on public.conversation_participants for insert to authenticated
  with check (user_id = auth.uid() and role = 'client' and exists (select 1 from public.conversations where conversations.id = conversation_participants.conversation_id and conversations.client_id = auth.uid()));
-- Lets clients record when they last read a conversation (clears their unread badge).
drop policy if exists "Clients can update their own read state" on public.conversation_participants;
create policy "Clients can update their own read state" on public.conversation_participants for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and role = 'client'
    and exists (select 1 from public.conversations where conversations.id = conversation_participants.conversation_id and conversations.client_id = auth.uid())
  );
drop policy if exists "Participants can read client messages" on public.messages;
create policy "Participants can read client messages" on public.messages for select to authenticated
  using (
    (message_type <> 'internal_note' and (exists (select 1 from public.conversations where conversations.id = messages.conversation_id and (conversations.client_id = auth.uid() or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'))))
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
drop policy if exists "Clients can send messages" on public.messages;
create policy "Clients can send messages" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and sender_type = 'client'
    and message_type = 'text'
    and exists (select 1 from public.conversations where conversations.id = messages.conversation_id and conversations.client_id = auth.uid())
  );
drop policy if exists "Admins can send messages" on public.messages;
create policy "Admins can send messages" on public.messages for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and sender_id = auth.uid() and sender_type in ('admin','internal'));
alter table public.messages replica identity full;

-- Clients cannot update conversations directly, so a trigger keeps status and
-- ordering in sync with every new message, whoever sends it.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_type = 'internal_note' or new.sender_type = 'internal' then
    return new;
  end if;
  update public.conversations
  set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
      updated_at = now(),
      status = case
        when new.sender_type = 'client' then 'waiting_for_admin'
        when new.sender_type = 'admin' then 'waiting_for_client'
        else status
      end
  where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function public.touch_conversation_on_message() from public, anon, authenticated;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value text not null check (char_length(value) <= 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings for select using (true);
drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings" on public.site_settings for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- An empty WhatsApp number hides WhatsApp links until an admin adds the real one.
insert into public.site_settings (key, value) values
  ('homepage_eyebrow', 'Independent technology partner'),
  ('homepage_title', 'Build software that moves your business forward.'),
  ('homepage_description', 'TechJest helps startups and growing teams turn good ideas into useful, dependable digital products.'),
  ('homepage_cta', 'Book a free consultation'),
  ('contact_email', 'techjest1@gmail.com'),
  ('whatsapp_number', '')
on conflict (key) do nothing;

-- Lookups behind client dashboards, RLS checks, and unread counts.
create index if not exists projects_request_idx on public.projects (request_id);
create index if not exists invoices_request_idx on public.invoices (request_id);
create index if not exists conversation_participants_user_idx on public.conversation_participants (user_id);

-- New messages reach open conversations instantly (the app also checks every 15 seconds).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- Private storage for project documents. The first folder of each file path is the project id.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-documents', 'project-documents', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
drop policy if exists "Admins manage project document files" on storage.objects;
create policy "Admins manage project document files" on storage.objects for all to authenticated
  using (bucket_id = 'project-documents' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id = 'project-documents' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "Clients read their project document files" on storage.objects;
create policy "Clients read their project document files" on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from public.projects
      join public.project_requests on project_requests.id = projects.request_id
      where projects.id::text = (storage.foldername(objects.name))[1]
        and project_requests.user_id = auth.uid()
    )
  );

-- A request, its services, conversation, first message, and admin notification are saved together.
--    Before, they were six separate calls, and a failure part-way left a request without its conversation.
--    Runs as the signed-in client (security invoker), so every row-level security rule still applies.
create or replace function public.submit_project_request(
  p_service text,
  p_message text,
  p_budget text default null,
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_company text default null,
  p_timeline text default null,
  p_company_id uuid default null,
  p_services jsonb default '[]'::jsonb,
  p_notification_body text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_request uuid;
  v_conversation uuid;
begin
  if v_user is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_services, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid service selections.' using errcode = 'TJ400';
  end if;
  if jsonb_array_length(coalesce(p_services, '[]'::jsonb)) > 30 then
    raise exception 'Select up to 30 services.' using errcode = 'TJ400';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) item
    where jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'slug') is distinct from 'string'
      or char_length(btrim(coalesce(item ->> 'slug', ''))) not between 1 and 160
  ) then
    raise exception 'Invalid service selections.' using errcode = 'TJ400';
  end if;
  insert into public.project_requests
    (user_id, company_id, service, message, budget, name, email, phone, company, budget_range, timeline, description)
  values
    (v_user, p_company_id, p_service, p_message, p_budget, p_name, p_email, p_phone, p_company, p_budget, p_timeline, p_message)
  returning id into v_request;
  insert into public.project_request_services (request_id, service_slug, service_name_snapshot, price_snapshot)
  select v_request, item ->> 'slug', coalesce(catalog.name, ''), catalog.price
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) as item
  left join public.service_catalog catalog on catalog.slug = item ->> 'slug' and catalog.is_active;
  insert into public.conversations (request_id, client_id, created_by, title)
  values (v_request, v_user, v_user, case when char_length(p_service) > 70 then left(p_service, 67) || '...' else p_service end)
  returning id into v_conversation;
  insert into public.conversation_participants (conversation_id, user_id, role) values (v_conversation, v_user, 'client');
  -- The messages_touch_conversation trigger marks the conversation as waiting for the team.
  insert into public.messages (conversation_id, sender_id, sender_type, content, message_type)
  values (v_conversation, v_user, 'client', p_message, 'text');
  insert into public.admin_notifications (type, title, body, request_id, conversation_id)
  values ('service_request', 'New service request', left(coalesce(nullif(p_notification_body, ''), 'A client sent a new request.'), 500), v_request, v_conversation);
  return v_request;
end;
$$;
revoke all on function public.submit_project_request(text, text, text, text, text, text, text, text, uuid, jsonb, text) from public, anon;
grant execute on function public.submit_project_request(text, text, text, text, text, text, text, text, uuid, jsonb, text) to authenticated;

-- At most 10 requests per client per hour, however they are sent. The count lives in the database,
--    so it holds across every server instance (the in-memory limit in src/proxy.ts does not).
create or replace function public.limit_project_requests()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' then
    return new;
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(new.service, ''))) not between 1 and 1000
    or char_length(btrim(coalesce(new.message, ''))) not between 20 and 5000
    or char_length(coalesce(new.name, '')) > 100
    or char_length(coalesce(new.email, '')) > 320
    or char_length(coalesce(new.phone, '')) > 30
    or char_length(coalesce(new.company, '')) > 160
    or char_length(coalesce(new.budget, '')) > 160
    or char_length(coalesce(new.budget_range, '')) > 160
    or char_length(coalesce(new.timeline, '')) > 160
    or char_length(coalesce(new.description, '')) > 5000 then
    raise exception 'Some request details are invalid or too long.' using errcode = 'TJ400';
  end if;
  if new.email is not null and new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.' using errcode = 'TJ400';
  end if;
  perform pg_advisory_xact_lock(187451, hashtext(new.user_id::text));
  new.created_at := clock_timestamp();
  new.updated_at := new.created_at;
  if (
    select count(*) from public.project_requests
    where user_id = new.user_id and created_at > new.created_at - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many project requests. Please try again in an hour.' using errcode = 'TJ429';
  end if;
  return new;
end;
$$;
drop trigger if exists project_requests_rate_limit on public.project_requests;
create trigger project_requests_rate_limit
  before insert on public.project_requests
  for each row execute function public.limit_project_requests();

-- Sign-ins are recorded by the database, not the browser: every email, Google, and password-reset
--    sign-in is logged, and clients can no longer add, skip, or repeat entries.
create or replace function public.record_auth_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if tg_op = 'INSERT' then
      insert into public.audit_logs (user_id, event, email) values (new.id, 'signup', new.email);
    elsif new.last_sign_in_at is not null and new.last_sign_in_at is distinct from old.last_sign_in_at then
      insert into public.audit_logs (user_id, event, email)
      values (new.id, case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin_login' else 'login' end, new.email);
    end if;
  exception when others then
    -- The activity log must never block someone from signing in.
    raise warning 'Audit log entry skipped: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.record_auth_event() from public, anon, authenticated;
drop trigger if exists on_auth_user_audit on auth.users;
create trigger on_auth_user_audit
  after insert or update of last_sign_in_at on auth.users
  for each row execute function public.record_auth_event();
drop policy if exists "Users can insert audit logs" on public.audit_logs;
drop policy if exists "Users can record their own audit events" on public.audit_logs;

-- Unread message counts are added up in the database. Before, the app downloaded every incoming
--    message row, and past about 1,000 rows the counts came out too low.
create or replace function public.unread_message_counts()
returns table (conversation_id uuid, unread bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.conversation_id, count(*)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  left join public.conversation_participants p on p.conversation_id = m.conversation_id and p.user_id = auth.uid()
  where c.status <> 'archived'
    and m.deleted_at is null
    and m.sender_type = case when (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then 'client' else 'admin' end
    and ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' or c.client_id = auth.uid())
    and m.created_at > coalesce(p.last_read_at, '-infinity'::timestamptz)
  group by m.conversation_id;
$$;
revoke all on function public.unread_message_counts() from public, anon;
grant execute on function public.unread_message_counts() to authenticated;

-- Guest enquiries: visitors can send a request without an account. Their request has no user_id
--    and no conversation; the team replies by email. The visitor cannot write to any table directly:
--    this function checks every field again (the publishable key is public, so it can be called without
--    the website), takes service names and prices from the live catalog, and caps guest requests at
--    3 per email address and 50 in total per hour.
alter table public.project_requests alter column user_id drop not null;
create index if not exists project_requests_guest_idx on public.project_requests (created_at desc) where user_id is null;

create or replace function public.submit_guest_request(
  p_name text,
  p_email text,
  p_message text,
  p_phone text default null,
  p_company text default null,
  p_service text default null,
  p_budget text default null,
  p_timeline text default null,
  p_service_slugs text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_message text := btrim(coalesce(p_message, ''));
  v_service text := btrim(coalesce(p_service, ''));
  v_slugs text[] := coalesce(p_service_slugs, '{}');
  v_found integer;
  v_request uuid;
begin
  -- TJ400 messages are shown to the visitor as written.
  if char_length(v_name) not between 2 and 100 then
    raise exception 'Enter your name.' using errcode = 'TJ400';
  end if;
  if char_length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address.' using errcode = 'TJ400';
  end if;
  if char_length(v_message) not between 20 and 5000 then
    raise exception 'Describe your project in 20 to 5000 characters.' using errcode = 'TJ400';
  end if;
  if char_length(coalesce(p_phone, '')) > 30 or char_length(coalesce(p_company, '')) > 160
    or char_length(coalesce(p_budget, '')) > 160 or char_length(coalesce(p_timeline, '')) > 160
    or cardinality(v_slugs) > 30
    or exists (select 1 from unnest(v_slugs) slug where slug is null or char_length(btrim(slug)) not between 1 and 160) then
    raise exception 'Some request details are too long.' using errcode = 'TJ400';
  end if;
  -- One lock covers the global cap as well as the per-email cap. Recheck after acquiring it.
  perform pg_advisory_xact_lock(187452, 0);
  if (
    select count(*) from public.project_requests
    where user_id is null and email = v_email and created_at > clock_timestamp() - interval '1 hour'
  ) >= 3 or (
    select count(*) from public.project_requests
    where user_id is null and created_at > clock_timestamp() - interval '1 hour'
  ) >= 50 then
    raise exception 'Too many guest requests. Please try again later.' using errcode = 'TJ429';
  end if;
  if coalesce(array_length(v_slugs, 1), 0) > 0 then
    select count(*) into v_found from public.service_catalog where is_active and slug = any (v_slugs);
    if v_found <> (select count(distinct slug) from unnest(v_slugs) as slug) then
      raise exception 'One or more selected services are no longer available.' using errcode = 'TJ400';
    end if;
    select string_agg(name, ', ' order by sort_order, name) into v_service
    from public.service_catalog where is_active and slug = any (v_slugs);
  end if;
  if char_length(coalesce(v_service, '')) not between 1 and 1000 then
    raise exception 'Select a service.' using errcode = 'TJ400';
  end if;
  insert into public.project_requests
    (user_id, service, message, budget, name, email, phone, company, budget_range, timeline, description)
  values
    (null, v_service, v_message, nullif(btrim(p_budget), ''), v_name, v_email, nullif(btrim(p_phone), ''),
     nullif(btrim(p_company), ''), nullif(btrim(p_budget), ''), nullif(btrim(p_timeline), ''), v_message)
  returning id into v_request;
  insert into public.project_request_services (request_id, service_slug, service_name_snapshot, price_snapshot)
  select v_request, slug, name, price from public.service_catalog where is_active and slug = any (v_slugs);
  insert into public.admin_notifications (type, title, body, request_id)
  values ('service_request', 'New guest enquiry',
          left(v_name || ' (' || v_email || ') requested ' || v_service || '. No account: reply by email.', 500), v_request);
  return v_request;
end;
$$;
revoke all on function public.submit_guest_request(text, text, text, text, text, text, text, text, text[]) from public, authenticated;
grant execute on function public.submit_guest_request(text, text, text, text, text, text, text, text, text[]) to anon;

-- Clients answer proposals themselves. A sent proposal can be accepted or declined once, by the client
--    whose request it belongs to, and not after its "valid until" date. The team gets a notification,
--    the conversation records the answer, and an accepted proposal moves the lead to "won".
create or replace function public.respond_to_proposal(p_proposal_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_title text;
  v_status text;
  v_valid_until date;
  v_request uuid;
  v_name text;
  v_conversation uuid;
  v_answer text := case when p_accept then 'accepted' else 'declined' end;
begin
  if v_user is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select proposals.title, proposals.status, proposals.valid_until, proposals.request_id
    into v_title, v_status, v_valid_until, v_request
  from public.proposals
  join public.project_requests on project_requests.id = proposals.request_id
  where proposals.id = p_proposal_id and project_requests.user_id = v_user
  for update of proposals;
  -- TJ4xx messages are shown to the client as written.
  if not found or v_status = 'draft' then
    raise exception 'Proposal not found.' using errcode = 'TJ404';
  end if;
  if v_status <> 'sent' then
    raise exception 'This proposal has already been answered.' using errcode = 'TJ409';
  end if;
  if v_valid_until is not null and v_valid_until < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'This proposal has expired. Send the team a message for an updated one.' using errcode = 'TJ409';
  end if;
  update public.proposals set status = v_answer, updated_at = now() where id = p_proposal_id;
  if p_accept then
    update public.project_requests
    set lead_stage = 'won', updated_at = now()
    where id = v_request and lead_stage in ('received', 'qualified', 'proposal', 'negotiation');
  end if;
  select coalesce(nullif(btrim(full_name), ''), 'The client') into v_name from public.profiles where id = v_user;
  insert into public.admin_notifications (type, title, body, request_id)
  values ('system', 'Proposal ' || v_answer, left(coalesce(v_name, 'The client') || ' ' || v_answer || ' “' || v_title || '”.', 500), v_request);
  select id into v_conversation from public.conversations
  where request_id = v_request and client_id = v_user order by created_at limit 1;
  if v_conversation is not null then
    insert into public.messages (conversation_id, sender_id, sender_type, content, message_type)
    values (v_conversation, v_user, 'client', 'Proposal ' || v_answer || ': ' || v_title, 'system');
  end if;
  return v_answer;
end;
$$;
revoke all on function public.respond_to_proposal(uuid, boolean) from public, anon;
grant execute on function public.respond_to_proposal(uuid, boolean) to authenticated;

-- The reset script recreates the public schema, so table privileges must be
-- applied after all application tables exist. RLS policies still limit rows.
grant usage on schema public to anon, authenticated;
grant select on public.service_catalog to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon, authenticated;
-- Clients edit their own name, phone, and purpose, but never the company record their profile points at.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, purpose, updated_at) on public.profiles to authenticated;


-- 26 October 2026 hardening: also see migrations/2026-10-26-request-and-message-safety.sql.
revoke all on function public.limit_project_requests() from public, anon, authenticated;

-- Enforce catalog snapshots at the table boundary, including direct REST inserts and RPC calls.
-- Historical records are untouched. Admin/server tooling can still import historical snapshots.
create or replace function public.canonical_request_service()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' then
    return new;
  end if;
  if not exists (select 1 from public.project_requests where id = new.request_id and user_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(187453, hashtext(new.request_id::text));
  if (select count(*) from public.project_request_services where request_id = new.request_id) >= 30 then
    raise exception 'Select up to 30 services.' using errcode = 'TJ400';
  end if;
  select name, price into new.service_name_snapshot, new.price_snapshot
    from public.service_catalog where slug = new.service_slug and is_active;
  if not found then
    raise exception 'One or more selected services are no longer available.' using errcode = 'TJ400';
  end if;
  return new;
end;
$$;
revoke all on function public.canonical_request_service() from public, anon, authenticated;
drop trigger if exists request_service_canonical on public.project_request_services;
create trigger request_service_canonical before insert on public.project_request_services
  for each row execute function public.canonical_request_service();

-- Clients cannot place messages in the distant future and poison ordering/read cursors.
create or replace function public.set_client_message_time()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    new.created_at := clock_timestamp();
    new.updated_at := new.created_at;
  end if;
  return new;
end;
$$;
revoke all on function public.set_client_message_time() from public, anon, authenticated;
drop trigger if exists messages_client_time on public.messages;
create trigger messages_client_time before insert on public.messages
  for each row execute function public.set_client_message_time();

-- Monotonic read state: overlapping browser requests cannot move a cursor backwards.
-- Runs with the caller's privileges and RLS; no access to another client's thread is granted.
create or replace function public.mark_conversation_read(p_conversation_id uuid, p_read_at timestamptz)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_read_at is null or not isfinite(p_read_at) then
    raise exception 'Invalid read timestamp.' using errcode = 'TJ400';
  end if;
  if not exists (
    select 1 from public.conversations where id = p_conversation_id
      and (client_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  ) then
    raise exception 'Conversation not found.' using errcode = 'TJ404';
  end if;
  insert into public.conversation_participants (conversation_id, user_id, role, last_read_at)
  values (p_conversation_id, auth.uid(),
    case when auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' then 'admin' else 'client' end,
    least(p_read_at, clock_timestamp()))
  on conflict (conversation_id, user_id) do update
    set last_read_at = greatest(public.conversation_participants.last_read_at, excluded.last_read_at);
end;
$$;
revoke all on function public.mark_conversation_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_conversation_read(uuid, timestamptz) to authenticated;

-- Matches the bounded, stable keyset query used for message history.
create index if not exists messages_visible_page_idx
  on public.messages (conversation_id, created_at desc, id desc) where deleted_at is null;

-- Create the thread and membership in one transaction. Request/project retries
-- reuse the existing conversation; unlinked conversations are intentionally new.
create or replace function public.start_client_conversation(
  p_title text default 'TechJest conversation',
  p_request_id uuid default null,
  p_project_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_request uuid := p_request_id;
  v_project_request uuid;
  v_conversation public.conversations%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 160 then
    raise exception 'Invalid conversation title' using errcode = '22023';
  end if;
  -- Also serializes retries that identify the same request through its project.
  perform pg_advisory_xact_lock(187454, hashtext(v_user::text));
  if p_project_id is not null then
    select p.request_id into v_project_request
    from public.projects p join public.project_requests r on r.id = p.request_id
    where p.id = p_project_id and r.user_id = v_user;
    if v_project_request is null then
      raise exception 'Project unavailable' using errcode = '42501';
    end if;
    if v_request is not null and v_request <> v_project_request then
      raise exception 'Project and request do not match' using errcode = '22023';
    end if;
    v_request := v_project_request;
  end if;
  if v_request is not null and not exists (
    select 1 from public.project_requests where id = v_request and user_id = v_user
  ) then
    raise exception 'Request unavailable' using errcode = '42501';
  end if;
  select c.* into v_conversation from public.conversations c
  where c.client_id = v_user and (
    (v_request is not null and c.request_id = v_request) or
    (p_project_id is not null and c.project_id = p_project_id)
  ) order by c.created_at, c.id limit 1;
  if v_conversation.id is null then
    insert into public.conversations (title, request_id, project_id, client_id, created_by)
    values (trim(p_title), v_request, p_project_id, v_user, v_user)
    on conflict (request_id) where request_id is not null do nothing
    returning * into v_conversation;
    -- A request may also have been created by another authorized transaction.
    if v_conversation.id is null then
      select c.* into v_conversation from public.conversations c
      where c.request_id = v_request and c.client_id = v_user;
    end if;
  end if;
  if v_conversation.id is null then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conversation.id, v_user, 'client')
  on conflict (conversation_id, user_id) do nothing;
  return jsonb_build_object('id', v_conversation.id, 'title', v_conversation.title,
    'status', v_conversation.status, 'priority', v_conversation.priority);
end;
$$;
revoke all on function public.start_client_conversation(text, uuid, uuid) from public, anon;
grant execute on function public.start_client_conversation(text, uuid, uuid) to authenticated;
