-- Align the already-deployed read policies with the D3-owned helper above.
-- Keeping this as a follow-up migration makes the live schema match fresh
-- environments without relying on the external helper that existed earlier.
begin;

create or replace function private.d3_can_view_employee_profile(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    (select auth.uid()) is not null
    and (
      (select public.d3_current_role()) = 'HR'::public.d3_app_role
      or p_employee_id = (select public.d3_current_legacy_employee_uuid())
      or (
        (select public.d3_current_role()) = 'MANAGER'::public.d3_app_role
        and exists (
          select 1
          from public.d3_user_access as access
          join public.d3_employee_reporting as reporting
            on reporting.manager_employee_id = access.employee_id
          where access.auth_user_id = (select auth.uid())
            and reporting.subordinate_employee_id = p_employee_id
            and reporting.is_active is true
            and reporting.effective_from <= current_date
            and (reporting.effective_to is null or reporting.effective_to >= current_date)
        )
      )
    )
$$;

revoke all on function private.d3_can_view_employee_profile(uuid) from public, anon;
grant execute on function private.d3_can_view_employee_profile(uuid) to authenticated;

drop policy if exists "D3 role scoped B2 profile read" on public.b2_register;
create policy "D3 role scoped B2 profile read"
  on public.b2_register
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      auth_user_id = (select auth.uid())
      or (select public.d3_current_role()) = 'HR'::public.d3_app_role
      or exists (
        select 1
        from public.d3_b2_employee_sources as source
        where source.b2_register_id = b2_register.id
          and private.d3_can_view_employee_profile(source.employee_id)
      )
    )
  );

drop policy if exists "D3 role scoped B2 employee source read"
  on public.d3_b2_employee_sources;
create policy "D3 role scoped B2 employee source read"
  on public.d3_b2_employee_sources
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and private.d3_can_view_employee_profile(employee_id)
  );

commit;
