-- Two rules the app checked only in the API, now held by the database for writes that bypass it (a signed-in user can
-- call PostgREST directly with the session the browser client keeps in readable cookies).
-- * A D4 identity needs an approved registration. b2_register takes inserts from any authenticated user (B2 policy
--   "Izinkan authenticated insert register", check true), so a PENDING row naming POS-HR made its author HR in D4.
--   Only APPROVED and PROVISIONED rows now give an employee id and a role; every D4 policy reads these two helpers.
-- * Nobody writes their own HR records: the KPI, performance, competency, development and training inserts, and the
--   history rows under a development requirement or training, refuse an employee_id equal to the writer's. Mirrors
--   assertNotSelf (SR-D4-EMP-23) in modules/d4/shared/rules.ts. Daily KPI stays self-service and is not touched.
-- Rows already stored are not touched. On 20 Nov 2026 every b2_register row D4 reads was APPROVED or PROVISIONED.
--
-- Rollout: independent of other pending D4 migrations. Apply only with PO approval; not applied by the D4 team.
-- Rollback: rerun the function definitions of 20261108120000 (d4_current_role) and 20261013120000
-- (d4_current_employee_uuid), and the policy checks of 20260928052350 / 20260929140000.

create or replace function public.d4_current_employee_uuid() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id from public.b2_register r
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
    and r.registration_status in ('APPROVED', 'PROVISIONED')
$$;

create or replace function public.d4_current_role() returns public.d3_app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p.code in ('POS-HR', 'DEMO-D3-HR') then 'HR'
    when p.code like 'DIR-%' then 'MANAGEMENT'
    when p.code like '%-MGR' then 'MANAGER'
    else 'EMPLOYEE'
  end::public.d3_app_role
  from public.b2_register r
  left join public.d3_positions p on p.id = r.position_id
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
    and r.registration_status in ('APPROVED', 'PROVISIONED')
$$;

do $$
declare
  item record;
begin
  for item in select * from (values
    ('d4_kpi_assessments', 'D4 KPI assessment insert HR manager'),
    ('d4_performance_evaluations', 'D4 performance insert HR manager'),
    ('d4_competency_assessments', 'D4 competency insert HR manager'),
    ('d4_development_needs', 'D4 development insert HR manager'),
    ('d4_training_records', 'D4 training insert HR manager')
  ) as t(table_name, policy_name) loop
    execute format(
      'alter policy %I on public.%I with check ('
      || '(select public.d4_current_role()) = any (array[''HR'', ''MANAGER'']::public.d3_app_role[])'
      || ' and actor_auth_user_id = (select auth.uid())'
      || ' and actor_employee_id = (select public.d4_current_employee_uuid())'
      || ' and employee_id <> (select public.d4_current_employee_uuid()))',
      item.policy_name, item.table_name);
  end loop;
end $$;

alter policy "D4 development history insert HR manager" on public.d4_development_need_versions with check (
  (select public.d4_current_role()) = any (array['HR', 'MANAGER']::public.d3_app_role[])
  and actor_auth_user_id = (select auth.uid())
  and actor_employee_id = (select public.d4_current_employee_uuid())
  and exists (
    select 1 from public.d4_development_needs n
    where n.id = development_need_id and n.employee_id <> (select public.d4_current_employee_uuid())
  )
);

alter policy "D4 training history insert HR manager" on public.d4_training_versions with check (
  (select public.d4_current_role()) = any (array['HR', 'MANAGER']::public.d3_app_role[])
  and actor_auth_user_id = (select auth.uid())
  and actor_employee_id = (select public.d4_current_employee_uuid())
  and exists (
    select 1 from public.d4_training_records t
    where t.id = training_id and t.employee_id <> (select public.d4_current_employee_uuid())
  )
);
