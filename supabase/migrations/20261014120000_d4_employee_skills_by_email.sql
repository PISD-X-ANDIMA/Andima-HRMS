-- D4 identities are B2 accounts (b2_register.id), but D3 skills point at d3_employee.id, and the two
-- share no ids. The same person has the same email in both, so skills are matched by email.
-- Owner-rights view like d4_employee: d3_employee_skills RLS checks D3 roles, which B2 accounts lack.
create or replace view public.d4_employee_skills as
  select s.id, r.id as employee_id, s.competency_id, s.proficiency_level, s.evidence_notes
  from public.d3_employee_skills s
  join public.d3_employee e on e.id = s.employee_id
  join public.b2_register r on lower(r.email) = lower(e.email)
  where coalesce(r.is_active, true) and r.full_name is not null
    and (public.d4_current_role() in ('HR', 'MANAGER') or r.id = auth.uid());

revoke all on public.d4_employee_skills from anon, public, authenticated;
grant select on public.d4_employee_skills to authenticated;
