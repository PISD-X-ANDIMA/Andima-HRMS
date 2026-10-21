-- Exposes the employment status HR keeps on the B2 account (PROBATION, INTERN, CONTRACT, PERMANENT) through
-- d4_employee, so D4 can tell who is still a trainee (interview D4, 14 Oct 2026: the trainee period is decided by HR).
--
-- Additive and low risk: one new trailing column; rows, security model (owner-rights view) and the access filter are
-- identical to the current definition. Existing grants are kept by CREATE OR REPLACE. The app reads the view with
-- select("*"), so it works before and after this migration.
create or replace view public.d4_employee as
  select r.id,
         r.employee_id,
         r.full_name,
         r.position_id,
         r.departement_id as department_id,
         r.employment_status
  from public.b2_register r
  where coalesce(r.is_active, true)
    and r.full_name is not null
    and exists (select 1 from auth.users u where u.id = r.id)
    and (public.d4_current_role() = any (array['HR'::public.d3_app_role, 'MANAGER'::public.d3_app_role]) or r.id = auth.uid());
