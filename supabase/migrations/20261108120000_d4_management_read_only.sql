-- B17 (client request): directors see every D4 page but cannot save anything.
-- * d4_current_role(): DIR-* now maps to MANAGEMENT, a value d3_app_role already has. *-MGR stays MANAGER.
-- * Every D4 read path (5 SELECT policies, views d4_employee and d4_employee_skills) adds MANAGEMENT.
-- * INSERT policies are untouched, so they keep allowing HR and MANAGER only: a director's insert fails in the
--   database, not only in the API (requireWriter) and the UI (canWrite).
-- * d4_development_need_versions and d4_training_versions read through their parent row, so they follow.
--
-- Rollout: independent of the other pending D4 migrations. Deploy the app that knows the MANAGEMENT role first;
-- an older app treats an unknown role as read-only too, but labels it wrongly.
-- Rollback: rerun the previous definitions from 20261013120000 (function), 20261017120000 (d4_employee),
-- 20261014120000 (d4_employee_skills) and the policies of 20260928052350 / 20260929140000.

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
$$;

do $$
declare
  item record;
begin
  for item in select * from (values
    ('d4_kpi_assessments', 'D4 KPI assessment read permitted employee'),
    ('d4_performance_evaluations', 'D4 performance read permitted employee'),
    ('d4_competency_assessments', 'D4 competency read permitted employee'),
    ('d4_development_needs', 'D4 development read permitted employee'),
    ('d4_training_records', 'D4 training read permitted employee')
  ) as t(table_name, policy_name) loop
    execute format('drop policy if exists %I on public.%I', item.policy_name, item.table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || '(select public.d4_current_role()) = any (array[''HR'', ''MANAGER'', ''MANAGEMENT'']::public.d3_app_role[])'
      || ' or employee_id = (select public.d4_current_employee_uuid()))',
      item.policy_name, item.table_name);
  end loop;
end $$;

create or replace view public.d4_employee as
  select r.id, r.employee_id, r.full_name, r.position_id, r.departement_id as department_id, r.employment_status
  from public.b2_register r
  where coalesce(r.is_active, true) and r.full_name is not null
    and exists (select 1 from auth.users u where u.id = r.id)
    and (public.d4_current_role() = any (array['HR', 'MANAGER', 'MANAGEMENT']::public.d3_app_role[]) or r.id = auth.uid());

create or replace view public.d4_employee_skills as
  select s.id, r.id as employee_id, s.competency_id, s.proficiency_level, s.evidence_notes
  from public.d3_employee_skills s
  join public.d3_employee e on e.id = s.employee_id
  join public.b2_register r on lower(r.email::text) = lower(e.email::text)
  where coalesce(r.is_active, true) and r.full_name is not null
    and (public.d4_current_role() = any (array['HR', 'MANAGER', 'MANAGEMENT']::public.d3_app_role[]) or r.id = auth.uid());
