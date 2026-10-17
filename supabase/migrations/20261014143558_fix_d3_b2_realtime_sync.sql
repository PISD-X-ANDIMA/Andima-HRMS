-- Correct the first real-time sync implementation without changing B2/D1
-- schema. It must select only mapped columns from B2; password is never read.
alter table public.d3_employee_sync_events
  drop constraint if exists d3_employee_sync_events_event_kind_check;

alter table public.d3_employee_sync_events
  add constraint d3_employee_sync_events_event_kind_check
  check (event_kind in ('CREATED', 'MATCHED', 'WAITING_MASTER', 'AMBIGUOUS_IDENTIFIER', 'SYNC_ERROR'));

create or replace function private.d3_sync_employee_from_b2(p_b2_register_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_b2_id uuid;
  v_employee_code text;
  v_full_name text;
  v_email text;
  v_phone text;
  v_position_id uuid;
  v_department_id uuid;
  v_employment_status text;
  v_created_at timestamptz;
  v_registration_status text;
  v_employee_id uuid;
  v_candidate_count integer;
  v_link_kind text;
  v_status text;
begin
  select
    register.id,
    register.employee_id,
    register.full_name,
    register.email,
    register.phone,
    register.position_id,
    register.departement_id,
    register.employment_status,
    register.created_at,
    register.registration_status
  into
    v_b2_id,
    v_employee_code,
    v_full_name,
    v_email,
    v_phone,
    v_position_id,
    v_department_id,
    v_employment_status,
    v_created_at,
    v_registration_status
  from public.b2_register as register
  where register.id = p_b2_register_id;

  if not found or v_registration_status is distinct from 'PROVISIONED' then
    return;
  end if;

  if exists (
    select 1
    from public.d3_b2_employee_sources as source
    where source.b2_register_id = v_b2_id
  ) then
    return;
  end if;

  if nullif(btrim(v_employee_code), '') is null
     or nullif(btrim(v_full_name), '') is null
     or nullif(btrim(v_email), '') is null
     or v_position_id is null
     or v_department_id is null
     or v_created_at is null then
    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2_id, 'WAITING_MASTER', 'Registrasi B2 belum memiliki data employee yang lengkap.')
    on conflict (b2_register_id, event_kind) do nothing;
    return;
  end if;

  if not exists (
    select 1
    from public.d3_positions as position
    where position.id = v_position_id
      and position.department_id = v_department_id
  ) or not exists (
    select 1
    from public.d3_departments as department
    where department.id = v_department_id
  ) then
    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2_id, 'WAITING_MASTER', 'Menunggu mapping Department dan Position D3 yang valid.')
    on conflict (b2_register_id, event_kind) do nothing;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('d3:b2:employee:' || lower(btrim(v_employee_code))));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('d3:b2:email:' || lower(btrim(v_email))));

  select count(*) into v_candidate_count
  from public.d3_employee as employee
  where lower(btrim(employee.employee_id)) = lower(btrim(v_employee_code))
     or lower(btrim(employee.email)) = lower(btrim(v_email));

  if v_candidate_count > 1 then
    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2_id, 'AMBIGUOUS_IDENTIFIER', 'Employee ID atau email B2 cocok dengan lebih dari satu employee D3.')
    on conflict (b2_register_id, event_kind) do nothing;
    return;
  end if;

  if v_candidate_count = 1 then
    select employee.id into v_employee_id
    from public.d3_employee as employee
    where lower(btrim(employee.employee_id)) = lower(btrim(v_employee_code))
       or lower(btrim(employee.email)) = lower(btrim(v_email))
    limit 1;
    v_link_kind := 'MATCHED';
  else
    v_status := upper(btrim(coalesce(v_employment_status, '')));
    if v_status not in ('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'RESIGNED', 'TERMINATED') then
      v_status := 'PROBATION';
    end if;

    insert into public.d3_employee (
      employee_id, full_name, email, phone, position_id, department_id,
      employment_status, join_date, work_location
    )
    values (
      btrim(v_employee_code), btrim(v_full_name), btrim(v_email), nullif(btrim(v_phone), ''),
      v_position_id, v_department_id, v_status, v_created_at::date, 'HQ'
    )
    returning id into v_employee_id;
    v_link_kind := 'CREATED';
  end if;

  insert into public.d3_b2_employee_sources (b2_register_id, employee_id, link_kind)
  values (v_b2_id, v_employee_id, v_link_kind)
  on conflict (b2_register_id) do nothing;

  insert into public.d3_employee_sync_events (b2_register_id, employee_id, event_kind, message)
  values (
    v_b2_id,
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
    -- A concurrent writer may have won the identity race. Re-read without
    -- min(uuid), which PostgreSQL does not support, then link safely.
    select count(*) into v_candidate_count
    from public.d3_employee as employee
    where lower(btrim(employee.employee_id)) = lower(btrim(v_employee_code))
       or lower(btrim(employee.email)) = lower(btrim(v_email));

    if v_candidate_count = 1 then
      select employee.id into v_employee_id
      from public.d3_employee as employee
      where lower(btrim(employee.employee_id)) = lower(btrim(v_employee_code))
         or lower(btrim(employee.email)) = lower(btrim(v_email))
      limit 1;

      insert into public.d3_b2_employee_sources (b2_register_id, employee_id, link_kind)
      values (v_b2_id, v_employee_id, 'MATCHED')
      on conflict do nothing;
      insert into public.d3_employee_sync_events (b2_register_id, employee_id, event_kind, message)
      values (v_b2_id, v_employee_id, 'MATCHED', 'Employee D3 yang sudah ada berhasil dikaitkan ke registrasi B2.')
      on conflict (b2_register_id, event_kind) do nothing;
      return;
    end if;

    insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
    values (v_b2_id, 'AMBIGUOUS_IDENTIFIER', 'Identitas B2 tidak dapat dikaitkan secara aman ke employee D3.')
    on conflict (b2_register_id, event_kind) do nothing;
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
      insert into public.d3_employee_sync_events (b2_register_id, event_kind, message)
      values (new.id, 'SYNC_ERROR', 'Sinkronisasi B2 gagal: ' || sqlerrm)
      on conflict (b2_register_id, event_kind) do nothing;
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
revoke all on function private.d3_sync_employee_from_b2_trigger() from public, anon, authenticated;
revoke all on function private.d3_reconcile_b2_employee_sources_trigger() from public, anon, authenticated;

drop trigger if exists d3_reconcile_b2_employee_sources_after_department_change on public.d3_departments;
create trigger d3_reconcile_b2_employee_sources_after_department_change
  after insert or update on public.d3_departments
  for each statement execute function private.d3_reconcile_b2_employee_sources_trigger();

-- Retry the complete PROVISIONED backfill after fixing the identity lookup.
select private.d3_reconcile_b2_employee_sources();
