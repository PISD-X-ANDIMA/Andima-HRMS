-- D3-005 Employee Report & Ticket
-- Additive migration: it does not modify or delete existing shared tables.

create schema if not exists private;
revoke all on schema private from public;

create type public.d3_app_role as enum ('EMPLOYEE', 'HR', 'MANAGER');
create type public.d3_ticket_status as enum (
  'SUBMITTED',
  'IN_REVIEW',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED'
);

create table public.d3_user_access (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  app_role public.d3_app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.d3_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique default (
    'TKT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  employee_id uuid not null references public.employees(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 160),
  category text not null check (char_length(trim(category)) between 2 and 80),
  description text not null check (char_length(trim(description)) between 10 and 4000),
  occurred_at timestamptz,
  status public.d3_ticket_status not null default 'SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.d3_ticket_followups (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.d3_tickets(id) on delete cascade,
  actor_employee_id uuid not null references public.employees(id) on delete restrict,
  note text not null check (char_length(trim(note)) between 3 and 2000),
  follow_up_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.d3_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.d3_tickets(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  created_at timestamptz not null default now()
);

create table public.d3_ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.d3_tickets(id) on delete cascade,
  actor_employee_id uuid not null references public.employees(id) on delete restrict,
  event_type text not null check (event_type in ('CREATED', 'STATUS_CHANGED', 'FOLLOW_UP_ADDED')),
  from_status public.d3_ticket_status,
  to_status public.d3_ticket_status,
  note text,
  created_at timestamptz not null default now()
);

create index d3_tickets_employee_created_idx on public.d3_tickets (employee_id, created_at desc);
create index d3_tickets_status_created_idx on public.d3_tickets (status, created_at desc);
create index d3_ticket_followups_ticket_date_idx on public.d3_ticket_followups (ticket_id, follow_up_at desc);
create index d3_ticket_attachments_ticket_idx on public.d3_ticket_attachments (ticket_id);
create index d3_ticket_history_ticket_created_idx on public.d3_ticket_history (ticket_id, created_at desc);

create or replace function private.d3_protect_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ticket_code is distinct from old.ticket_code
     or new.employee_id is distinct from old.employee_id
     or new.title is distinct from old.title
     or new.category is distinct from old.category
     or new.description is distinct from old.description
     or new.occurred_at is distinct from old.occurred_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Only ticket status may be updated after creation';
  end if;

  if new.status is not distinct from old.status then
    raise exception 'Ticket status must change when updating a ticket';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.d3_write_ticket_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
begin
  if tg_table_name = 'd3_tickets' and tg_op = 'INSERT' then
    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, to_status
    ) values (
      new.id, new.employee_id, 'CREATED', new.status
    );
    return new;
  end if;

  if tg_table_name = 'd3_tickets' and tg_op = 'UPDATE' then
    select employee_id into current_actor
    from public.d3_user_access
    where auth_user_id = auth.uid();

    if current_actor is null then
      raise exception 'Authenticated D3 user mapping is required for an audit entry';
    end if;

    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, from_status, to_status
    ) values (
      new.id, current_actor, 'STATUS_CHANGED', old.status, new.status
    );
    return new;
  end if;

  if tg_table_name = 'd3_ticket_followups' and tg_op = 'INSERT' then
    insert into public.d3_ticket_history (
      ticket_id, actor_employee_id, event_type, note
    ) values (
      new.ticket_id, new.actor_employee_id, 'FOLLOW_UP_ADDED', new.note
    );
    return new;
  end if;

  return new;
end;
$$;

revoke all on function private.d3_protect_ticket_update() from public, anon, authenticated;
revoke all on function private.d3_write_ticket_history() from public, anon, authenticated;

create trigger d3_tickets_protect_update
before update on public.d3_tickets
for each row execute function private.d3_protect_ticket_update();

create trigger d3_tickets_audit
after insert or update of status on public.d3_tickets
for each row execute function private.d3_write_ticket_history();

create trigger d3_ticket_followups_audit
after insert on public.d3_ticket_followups
for each row execute function private.d3_write_ticket_history();

alter table public.d3_user_access enable row level security;
alter table public.d3_tickets enable row level security;
alter table public.d3_ticket_followups enable row level security;
alter table public.d3_ticket_attachments enable row level security;
alter table public.d3_ticket_history enable row level security;

grant select on public.d3_user_access to authenticated;
grant select, insert, update on public.d3_tickets to authenticated;
grant select, insert on public.d3_ticket_followups to authenticated;
grant select, insert on public.d3_ticket_attachments to authenticated;
grant select on public.d3_ticket_history to authenticated;

create policy "D3 users read their own access mapping"
on public.d3_user_access for select to authenticated
using (auth_user_id = auth.uid());

create policy "D3 users read allowed tickets"
on public.d3_tickets for select to authenticated
using (
  exists (
    select 1 from public.d3_user_access access
    where access.auth_user_id = auth.uid()
      and (access.employee_id = d3_tickets.employee_id or access.app_role in ('HR', 'MANAGER'))
  )
);

create policy "Employees create their own tickets"
on public.d3_tickets for insert to authenticated
with check (
  exists (
    select 1 from public.d3_user_access access
    where access.auth_user_id = auth.uid()
      and access.employee_id = d3_tickets.employee_id
      and access.app_role = 'EMPLOYEE'
  )
);

create policy "HR and managers update ticket status"
on public.d3_tickets for update to authenticated
using (
  exists (
    select 1 from public.d3_user_access access
    where access.auth_user_id = auth.uid()
      and access.app_role in ('HR', 'MANAGER')
  )
)
with check (
  exists (
    select 1 from public.d3_user_access access
    where access.auth_user_id = auth.uid()
      and access.app_role in ('HR', 'MANAGER')
  )
);

create policy "D3 users read allowed follow-ups"
on public.d3_ticket_followups for select to authenticated
using (
  exists (
    select 1
    from public.d3_tickets ticket
    join public.d3_user_access access on access.auth_user_id = auth.uid()
    where ticket.id = d3_ticket_followups.ticket_id
      and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))
  )
);

create policy "HR and managers add their own follow-ups"
on public.d3_ticket_followups for insert to authenticated
with check (
  actor_employee_id = (
    select employee_id from public.d3_user_access
    where auth_user_id = auth.uid()
  )
  and exists (
    select 1 from public.d3_user_access access
    where access.auth_user_id = auth.uid()
      and access.app_role in ('HR', 'MANAGER')
  )
);

create policy "D3 users read allowed ticket attachments"
on public.d3_ticket_attachments for select to authenticated
using (
  exists (
    select 1
    from public.d3_tickets ticket
    join public.d3_user_access access on access.auth_user_id = auth.uid()
    where ticket.id = d3_ticket_attachments.ticket_id
      and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))
  )
);

create policy "Allowed users attach files to tickets"
on public.d3_ticket_attachments for insert to authenticated
with check (
  exists (
    select 1
    from public.d3_tickets ticket
    join public.d3_user_access access on access.auth_user_id = auth.uid()
    where ticket.id = d3_ticket_attachments.ticket_id
      and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))
  )
);

create policy "D3 users read allowed ticket history"
on public.d3_ticket_history for select to authenticated
using (
  exists (
    select 1
    from public.d3_tickets ticket
    join public.d3_user_access access on access.auth_user_id = auth.uid()
    where ticket.id = d3_ticket_history.ticket_id
      and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))
  )
);

insert into storage.buckets (id, name, public)
values ('d3-ticket-attachments', 'd3-ticket-attachments', false)
on conflict (id) do nothing;

create policy "D3 users upload into their own attachment folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'd3-ticket-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "D3 users read allowed stored ticket attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'd3-ticket-attachments'
  and exists (
    select 1
    from public.d3_ticket_attachments attachment
    join public.d3_tickets ticket on ticket.id = attachment.ticket_id
    join public.d3_user_access access on access.auth_user_id = auth.uid()
    where attachment.storage_path = storage.objects.name
      and (ticket.employee_id = access.employee_id or access.app_role in ('HR', 'MANAGER'))
  )
);
