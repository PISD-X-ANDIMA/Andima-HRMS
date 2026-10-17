-- D3 keeps an internal, non-blocking record of which B2 registration became
-- an Employee Profile. There is deliberately no foreign key to B2: D3 must
-- never prevent D2 from changing or deleting its own registration data.
create table public.d3_b2_employee_sources (
  b2_register_id uuid primary key,
  employee_id uuid not null unique references public.d3_employee(id) on delete restrict,
  link_kind text not null check (link_kind in ('CREATED', 'MATCHED')),
  linked_at timestamptz not null default now()
);

create index d3_b2_employee_sources_employee_id_idx
  on public.d3_b2_employee_sources (employee_id);

create table public.d3_employee_sync_events (
  id uuid primary key default gen_random_uuid(),
  b2_register_id uuid not null,
  employee_id uuid references public.d3_employee(id) on delete restrict,
  event_kind text not null check (event_kind in ('CREATED', 'MATCHED', 'WAITING_MASTER', 'AMBIGUOUS_IDENTIFIER')),
  message text not null,
  created_at timestamptz not null default now(),
  unique (b2_register_id, event_kind)
);

create index d3_employee_sync_events_created_at_idx
  on public.d3_employee_sync_events (created_at desc);

alter table public.d3_b2_employee_sources enable row level security;
alter table public.d3_employee_sync_events enable row level security;

revoke all on table public.d3_b2_employee_sources from public, anon;
revoke all on table public.d3_employee_sync_events from public, anon;
grant select on table public.d3_b2_employee_sources to authenticated;
grant select on table public.d3_employee_sync_events to authenticated;

create policy "D3 authenticated users read B2 employee sources"
  on public.d3_b2_employee_sources
  for select
  to authenticated
  using (true);

create policy "D3 HR reads employee sync history"
  on public.d3_employee_sync_events
  for select
  to authenticated
  using ((select public.d3_current_role()) = 'HR'::public.d3_app_role);

-- This routine only creates or links D3 employees. It never updates an
-- existing employee, so HR-managed profile fields and employment status stay
-- under D3 ownership after the first successful synchronization.
create or replace function private.d3_sync_employee_from_b2(p_b2_register_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_b2 record;
  v_employee_id uuid;
  v_candidate_count integer;
  v_link_kind text;
  v_status text;
begin
  select register.id, register.employee_id, register.full_name, register.email,
    register.phone, register.position_id, register.departement_id,
    register.employment_status, register.created_at, register.registration_status
  into v_b2
  from public.b2_register as register
  where register.id = p_b2_register_id;

  if not found or v_b2.registration_status <> 'PROVISIONED' then
    return;
  end if;

  if exists (
    select 1
    from public.d3_b2_employee_sources
    where b2_register_id = v_b2.id
  ) then
    return;
  end if;

  if nullif(btrim(v_b2.employee_id), '') is null
     or nullif(btrim(v_b2.full_name), '') is null
     or nullif(btrim(v_b2.email), '') is null
     or v_b2.position_id is null
     or v_b2.departement_id is null
     or v_b2.created_at is null then
    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2.id, 'WAITING_MASTER', 'Registrasi B2 belum memiliki data employee yang lengkap.')
    on conflict (b2_register_id, event_kind) do nothing;
    return;
  end if;

  if not exists (
    select 1
    from public.d3_positions as position
    where position.id = v_b2.position_id
      and position.department_id = v_b2.departement_id
  ) or not exists (
    select 1
    from public.d3_departments as department
    where department.id = v_b2.departement_id
  ) then
    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2.id, 'WAITING_MASTER', 'Menunggu mapping Department dan Position D3 yang valid.')
    on conflict (b2_register_id, event_kind) do nothing;
    return;
  end if;

  -- Lock both business identifiers before checking/inserting to keep the
  -- employee identity idempotent even if registrations arrive concurrently.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('d3:b2:employee:' || lower(btrim(v_b2.employee_id))));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('d3:b2:email:' || lower(btrim(v_b2.email))));

  select count(*)
  into v_candidate_count
  from public.d3_employee as employee
  where lower(btrim(employee.employee_id)) = lower(btrim(v_b2.employee_id))
     or lower(btrim(employee.email)) = lower(btrim(v_b2.email));

  if v_candidate_count = 1 then
    select employee.id
    into v_employee_id
    from public.d3_employee as employee
    where lower(btrim(employee.employee_id)) = lower(btrim(v_b2.employee_id))
       or lower(btrim(employee.email)) = lower(btrim(v_b2.email))
    limit 1;
  end if;

  if v_candidate_count > 1 then
    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2.id, 'AMBIGUOUS_IDENTIFIER', 'Employee ID atau email B2 cocok dengan lebih dari satu employee D3.')
    on conflict (b2_register_id, event_kind) do nothing;
    return;
  end if;

  if v_candidate_count = 1 then
    v_link_kind := 'MATCHED';
  else
    v_status := upper(btrim(coalesce(v_b2.employment_status, '')));
    if v_status not in ('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'RESIGNED', 'TERMINATED') then
      v_status := 'PROBATION';
    end if;

    insert into public.d3_employee (
      employee_id,
      full_name,
      email,
      phone,
      position_id,
      department_id,
      employment_status,
      join_date,
      work_location
    )
    values (
      btrim(v_b2.employee_id),
      btrim(v_b2.full_name),
      btrim(v_b2.email),
      nullif(btrim(v_b2.phone), ''),
      v_b2.position_id,
      v_b2.departement_id,
      v_status,
      v_b2.created_at::date,
      'HQ'
    )
    returning id into v_employee_id;

    v_link_kind := 'CREATED';
  end if;

  insert into public.d3_b2_employee_sources (b2_register_id, employee_id, link_kind)
  values (v_b2.id, v_employee_id, v_link_kind)
  on conflict (b2_register_id) do nothing;

  -- The D3 employee may already be linked to an earlier duplicate B2 row.
  -- It is already a valid B2-sourced profile, so no duplicate is created.
  if not found then
    return;
  end if;

  insert into public.d3_employee_sync_events (b2_register_id, employee_id, event_kind, message)
  values (
    v_b2.id,
    v_employee_id,
    v_link_kind,
    case v_link_kind
      when 'CREATED' then 'Employee baru dibuat otomatis dari registrasi B2.'
      else 'Employee D3 yang sudah ada berhasil dikaitkan ke registrasi B2.'
    end
  )
  on conflict (b2_register_id, event_kind) do nothing;
exception
  when unique_violation then
    -- An outside writer may have created the same identity between the lookup
    -- and insert. The trigger must not fail the B2 registration in that case.
    select count(*)
    into v_candidate_count
    from public.d3_employee as employee
    where lower(btrim(employee.employee_id)) = lower(btrim(v_b2.employee_id))
       or lower(btrim(employee.email)) = lower(btrim(v_b2.email));

    if v_candidate_count = 1 then
      select employee.id
      into v_employee_id
      from public.d3_employee as employee
      where lower(btrim(employee.employee_id)) = lower(btrim(v_b2.employee_id))
         or lower(btrim(employee.email)) = lower(btrim(v_b2.email))
      limit 1;
    end if;

    if v_candidate_count = 1 then
      insert into public.d3_b2_employee_sources (b2_register_id, employee_id, link_kind)
      values (v_b2.id, v_employee_id, 'MATCHED')
      on conflict do nothing;
      insert into public.d3_employee_sync_events (b2_register_id, employee_id, event_kind, message)
      values (v_b2.id, v_employee_id, 'MATCHED', 'Employee D3 yang sudah ada berhasil dikaitkan ke registrasi B2.')
      on conflict (b2_register_id, event_kind) do nothing;
      return;
    end if;

    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2.id, 'AMBIGUOUS_IDENTIFIER', 'Identitas B2 tidak dapat dikaitkan secara aman ke employee D3.')
    on conflict (b2_register_id, event_kind) do nothing;
end;
$$;

create or replace function private.d3_reconcile_b2_employee_sources()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_b2_register_id uuid;
begin
  for v_b2_register_id in
    select register.id
    from public.b2_register as register
    where register.registration_status = 'PROVISIONED'
      and not exists (
        select 1
        from public.d3_b2_employee_sources as source
        where source.b2_register_id = register.id
      )
  loop
    begin
      perform private.d3_sync_employee_from_b2(v_b2_register_id);
    exception
      when others then
        raise warning 'D3 B2 employee reconciliation skipped registration %: %', v_b2_register_id, sqlerrm;
    end;
  end loop;
end;
$$;

create or replace function private.d3_sync_employee_from_b2_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  begin
    perform private.d3_sync_employee_from_b2(new.id);
  exception
    when others then
      raise warning 'D3 B2 employee sync skipped registration %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function private.d3_reconcile_b2_employee_sources_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.d3_reconcile_b2_employee_sources();
  return null;
end;
$$;

revoke all on function private.d3_sync_employee_from_b2(uuid) from public, anon, authenticated;
revoke all on function private.d3_reconcile_b2_employee_sources() from public, anon, authenticated;
revoke all on function private.d3_sync_employee_from_b2_trigger() from public, anon, authenticated;
revoke all on function private.d3_reconcile_b2_employee_sources_trigger() from public, anon, authenticated;

create trigger d3_sync_employee_from_b2_after_insert
  after insert on public.b2_register
  for each row execute function private.d3_sync_employee_from_b2_trigger();

create trigger d3_sync_employee_from_b2_after_eligibility_update
  after update of employee_id, full_name, email, phone, position_id, departement_id, created_at, employment_status, registration_status
  on public.b2_register
  for each row execute function private.d3_sync_employee_from_b2_trigger();

-- D1's scheduled mirror changes D3 master rows. A statement-level D3 trigger
-- retries only unresolved B2 records once a Position mapping becomes valid.
create trigger d3_reconcile_b2_employee_sources_after_position_change
  after insert or update of department_id on public.d3_positions
  for each statement execute function private.d3_reconcile_b2_employee_sources_trigger();

-- Layoff/status changes are D3-owned. The public RPC is callable only through
-- authenticated sessions and independently verifies the D3 HR role.
create or replace function public.d3_update_employee_employment_status(
  p_employee_uuid uuid,
  p_employment_status text
)
returns table(employee_id text, employment_status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current_status text;
  v_target_status text := upper(btrim(coalesce(p_employment_status, '')));
  v_employee_code text;
  v_actor_employee_id uuid;
begin
  if auth.uid() is null or public.d3_current_role() is distinct from 'HR'::public.d3_app_role then
    raise exception 'Only authenticated HR users may change employment status' using errcode = '42501';
  end if;

  if v_target_status not in ('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'RESIGNED', 'TERMINATED') then
    raise exception 'Employment status is invalid' using errcode = '22023';
  end if;

  select employee.employment_status, employee.employee_id
  into v_current_status, v_employee_code
  from public.d3_employee as employee
  where employee.id = p_employee_uuid
    and exists (
      select 1
      from public.d3_b2_employee_sources as source
      where source.employee_id = employee.id
    )
  for update;

  if not found then
    raise exception 'B2-sourced employee was not found' using errcode = 'P0002';
  end if;

  if v_current_status = 'PERMANENT'
     and v_target_status not in ('PERMANENT', 'RESIGNED', 'TERMINATED') then
    raise exception 'A permanent employee may only change to RESIGNED or TERMINATED' using errcode = '22023';
  end if;

  if v_current_status is distinct from v_target_status then
    update public.d3_employee
    set employment_status = v_target_status
    where id = p_employee_uuid;

    select access.employee_id
    into v_actor_employee_id
    from public.d3_user_access as access
    where access.auth_user_id = auth.uid()
    limit 1;

    insert into public.d3_employee_audit_log (
      employee_record_id,
      action,
      actor_auth_user_id,
      actor_employee_id,
      changed_fields
    )
    values (
      p_employee_uuid,
      case when v_target_status = 'TERMINATED' then 'EMPLOYEE_LAID_OFF' else 'EMPLOYMENT_STATUS_UPDATED' end,
      auth.uid(),
      v_actor_employee_id,
      array['employment_status']
    );
  end if;

  return query select v_employee_code, v_target_status;
end;
$$;

revoke all on function public.d3_update_employee_employment_status(uuid, text) from public, anon;
grant execute on function public.d3_update_employee_employment_status(uuid, text) to authenticated;

-- Initial D3-only backfill. Existing B2 records are linked or created through
-- the exact same validation and idempotent path as future trigger events.
select private.d3_reconcile_b2_employee_sources();
