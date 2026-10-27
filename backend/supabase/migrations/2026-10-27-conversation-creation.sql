-- Apply after 2026-10-26-request-and-message-safety.sql. No existing rows are rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

commit;
