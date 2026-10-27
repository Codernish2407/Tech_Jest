-- Apply after the dated 2026-10-23 migration and before deploying the matching app.
-- Re-runnable. No existing rows are deleted or rewritten. See docs/audit-rollout-2026-10-26.md.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Direct REST inserts must obey the same limits as the website. Serialize per user so two
-- concurrent submissions cannot both pass the last available slot. Never trust client timestamps.
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

-- The request RPCs below retain their existing signatures and grants.

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


commit;
