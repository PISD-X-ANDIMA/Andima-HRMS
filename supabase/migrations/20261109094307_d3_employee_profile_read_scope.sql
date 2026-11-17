-- Close BUG-D3-002 without changing the registration flow or the existing
-- IT/Director administration policy. Employee-profile reads must be enforced
-- in the database because routes and REST queries can be reached directly.
begin;

-- Keep the read predicate D3-owned and independent from policies introduced
-- by other squads. It intentionally exposes no RPC because it lives in the
-- private schema; authenticated callers can use it only through RLS.
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

-- These permissive policies are additive with every other SELECT/ALL policy,
-- so either one bypasses a scoped read policy.
drop policy if exists "Allow Public Select for b2_register" on public.b2_register;
drop policy if exists "Restrict_Non_IT_Director" on public.b2_register;

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

-- Mapping rows are identifiers for employee records. They must follow the
-- same profile scope instead of being enumerable by every authenticated user.
drop policy if exists "D3 authenticated users read B2 employee sources"
  on public.d3_b2_employee_sources;
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
