-- D4 identity comes from B2 (b2_register) instead of D3 (d3_employee / d3_user_access).
-- * A D4 employee is a b2_register row whose id is a Supabase Auth user, is active and has a name.
-- * The D4 role follows the B2 position code: POS-HR / DEMO-D3-HR -> HR, DIR-* / *-MGR -> MANAGER, else EMPLOYEE.
-- * D3-only data (skills, requirements, employee_kpi) is not copied; it stays empty for B2 accounts.
-- * Existing D4 rows pointed at d3_employee and no B2 account matches a D3 employee, so they are
--   copied to schema d4_backup and removed before the foreign keys move to b2_register.

create schema if not exists d4_backup;
revoke all on schema d4_backup from anon, authenticated;
create table d4_backup.d4_kpi_assessments_20261013 as table public.d4_kpi_assessments;
create table d4_backup.d4_performance_evaluations_20261013 as table public.d4_performance_evaluations;
create table d4_backup.d4_competency_assessments_20261013 as table public.d4_competency_assessments;
create table d4_backup.d4_development_needs_20261013 as table public.d4_development_needs;
create table d4_backup.d4_development_need_versions_20261013 as table public.d4_development_need_versions;
create table d4_backup.d4_training_records_20261013 as table public.d4_training_records;
create table d4_backup.d4_training_versions_20261013 as table public.d4_training_versions;

delete from public.d4_training_versions;
delete from public.d4_training_records;
delete from public.d4_development_need_versions;
delete from public.d4_development_needs;
delete from public.d4_kpi_assessments;
delete from public.d4_performance_evaluations;
delete from public.d4_competency_assessments;

-- Identity helpers. security definer: they read b2_register no matter how B2 sets its RLS,
-- and only ever return the caller's own row (auth.uid()).
create or replace function public.d4_current_employee_uuid() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id from public.b2_register r
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
$$;

create or replace function public.d4_current_role() returns public.d3_app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p.code in ('POS-HR', 'DEMO-D3-HR') then 'HR'
    when p.code like 'DIR-%' or p.code like '%-MGR' then 'MANAGER'
    else 'EMPLOYEE'
  end::public.d3_app_role
  from public.b2_register r
  left join public.d3_positions p on p.id = r.position_id
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
$$;

revoke all on function public.d4_current_employee_uuid() from public, anon;
revoke all on function public.d4_current_role() from public, anon;
grant execute on function public.d4_current_employee_uuid() to authenticated;
grant execute on function public.d4_current_role() to authenticated;

-- What the app reads. Owner-rights views (no password column), filtered to what the caller may see.
create or replace view public.d4_user_access as
  select auth.uid() as auth_user_id, public.d4_current_role() as app_role, public.d4_current_employee_uuid() as employee_id
  where public.d4_current_employee_uuid() is not null;

create or replace view public.d4_employee as
  select r.id, r.employee_id, r.full_name, r.position_id, r.departement_id as department_id
  from public.b2_register r
  where coalesce(r.is_active, true) and r.full_name is not null
    and exists (select 1 from auth.users u where u.id = r.id)
    and (public.d4_current_role() in ('HR', 'MANAGER') or r.id = auth.uid());

revoke all on public.d4_user_access, public.d4_employee from anon, public;
grant select on public.d4_user_access, public.d4_employee to authenticated;

-- Foreign keys: d3_employee -> b2_register; actor default follows the B2 identity.
do $$
declare t text;
begin
  foreach t in array array['d4_kpi_assessments','d4_performance_evaluations','d4_competency_assessments',
                           'd4_development_needs','d4_development_need_versions','d4_training_records','d4_training_versions'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_actor_employee_id_fkey');
    execute format('alter table public.%I add constraint %I foreign key (actor_employee_id) references public.b2_register(id)', t, t || '_actor_employee_id_fkey');
    execute format('alter table public.%I alter column actor_employee_id set default public.d4_current_employee_uuid()', t);
    if t not in ('d4_development_need_versions', 'd4_training_versions') then
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_employee_id_fkey');
      execute format('alter table public.%I add constraint %I foreign key (employee_id) references public.b2_register(id)', t, t || '_employee_id_fkey');
    end if;
  end loop;
end $$;

-- RLS: same rules as before, B2 identity instead of D3.
alter policy "D4 KPI assessment insert HR manager" on public.d4_kpi_assessments
  with check (public.d4_current_role() in ('HR', 'MANAGER') and actor_auth_user_id = auth.uid() and actor_employee_id = public.d4_current_employee_uuid());
alter policy "D4 KPI assessment read permitted employee" on public.d4_kpi_assessments
  using (public.d4_current_role() in ('HR', 'MANAGER') or employee_id = public.d4_current_employee_uuid());

alter policy "D4 performance insert HR manager" on public.d4_performance_evaluations
  with check ((select public.d4_current_role()) in ('HR', 'MANAGER') and actor_auth_user_id = (select auth.uid()) and actor_employee_id = (select public.d4_current_employee_uuid()));
alter policy "D4 performance read permitted employee" on public.d4_performance_evaluations
  using ((select public.d4_current_role()) in ('HR', 'MANAGER') or employee_id = (select public.d4_current_employee_uuid()));

alter policy "D4 competency insert HR manager" on public.d4_competency_assessments
  with check ((select public.d4_current_role()) in ('HR', 'MANAGER') and actor_auth_user_id = (select auth.uid()) and actor_employee_id = (select public.d4_current_employee_uuid()));
alter policy "D4 competency read permitted employee" on public.d4_competency_assessments
  using ((select public.d4_current_role()) in ('HR', 'MANAGER') or employee_id = (select public.d4_current_employee_uuid()));

alter policy "D4 development insert HR manager" on public.d4_development_needs
  with check ((select public.d4_current_role()) in ('HR', 'MANAGER') and actor_auth_user_id = (select auth.uid()) and actor_employee_id = (select public.d4_current_employee_uuid()));
alter policy "D4 development read permitted employee" on public.d4_development_needs
  using ((select public.d4_current_role()) in ('HR', 'MANAGER') or employee_id = (select public.d4_current_employee_uuid()));

alter policy "D4 development history insert HR manager" on public.d4_development_need_versions
  with check ((select public.d4_current_role()) in ('HR', 'MANAGER') and actor_auth_user_id = (select auth.uid()) and actor_employee_id = (select public.d4_current_employee_uuid())
    and exists (select 1 from public.d4_development_needs n where n.id = d4_development_need_versions.development_need_id));

alter policy "D4 training insert HR manager" on public.d4_training_records
  with check ((select public.d4_current_role()) in ('HR', 'MANAGER') and actor_auth_user_id = (select auth.uid()) and actor_employee_id = (select public.d4_current_employee_uuid()));
alter policy "D4 training read permitted employee" on public.d4_training_records
  using ((select public.d4_current_role()) in ('HR', 'MANAGER') or employee_id = (select public.d4_current_employee_uuid()));

alter policy "D4 training history insert HR manager" on public.d4_training_versions
  with check ((select public.d4_current_role()) in ('HR', 'MANAGER') and actor_auth_user_id = (select auth.uid()) and actor_employee_id = (select public.d4_current_employee_uuid())
    and exists (select 1 from public.d4_training_records t where t.id = d4_training_versions.training_id));
