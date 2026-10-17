-- The shared d3_current_role() currently translates legacy CCR roles and does
-- not expose the D3 HR app_role. D3 policies use the authoritative D3 access
-- mapping directly, without changing that shared function.
drop policy if exists "D3 HR reads employee sync history" on public.d3_employee_sync_events;
create policy "D3 HR reads employee sync history"
  on public.d3_employee_sync_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.d3_user_access as access
      where access.auth_user_id = (select auth.uid())
        and access.app_role = 'HR'::public.d3_app_role
    )
  );

drop policy if exists "D3 HR hide employees from directory" on public.d3_employee_directory_hidden;
create policy "D3 HR hide employees from directory"
  on public.d3_employee_directory_hidden
  for insert
  to authenticated
  with check (
    (select auth.uid()) = hidden_by
    and exists (
      select 1
      from public.d3_user_access as access
      where access.auth_user_id = (select auth.uid())
        and access.app_role = 'HR'::public.d3_app_role
    )
  );

drop policy if exists "D3 HR restore employees to directory" on public.d3_employee_directory_hidden;
create policy "D3 HR restore employees to directory"
  on public.d3_employee_directory_hidden
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.d3_user_access as access
      where access.auth_user_id = (select auth.uid())
        and access.app_role = 'HR'::public.d3_app_role
    )
  );

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
  if auth.uid() is null or not exists (
    select 1
    from public.d3_user_access as access
    where access.auth_user_id = auth.uid()
      and access.app_role = 'HR'::public.d3_app_role
  ) then
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
      employee_record_id, action, actor_auth_user_id, actor_employee_id, changed_fields
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
