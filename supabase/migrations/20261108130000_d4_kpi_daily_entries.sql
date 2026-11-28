-- Daily KPI (interview D4, 14 Oct 2026: the company scores KPI daily, 1–100, target 85).
-- * Each employee whose position has a KPI role scores their own five Core KPI for a day. The period scorecard
--   (d4_kpi_assessments) stays HR's validation: the Performance Review form pre-fills Actual from the average of the
--   period's daily entries, and HR reviews and saves it.
-- * Insert-only, like the scorecards: a correction is a new row for the same day, and the newest row of a day counts.
-- * The writer is the subject, not HR, so the INSERT policy carries every check the HR flow relied on:
--   own employee row, KPI role of the caller's own position in the catalog version, and a day in the running WIB
--   period not after today (WIB). Directors (MANAGEMENT) score their own day too (interview 14 Oct 2026, 00:33:23);
--   they stay read-only for everyone else's data (20261108120000).
-- * The lines are validated and scored by the same triggers as the scorecards (d4_calculate_kpi_assessment,
--   d4_check_kpi_version), which read only columns this table shares with d4_kpi_assessments.
--
-- Rollout: apply after 20261017130000 (V6 scale; the calculate trigger must allow 1–100) and 20261108120000
-- (MANAGEMENT role). Before it is applied, the app shows Daily KPI as unavailable and everything else works.
-- Rollback: drop table public.d4_kpi_daily_entries; drop function public.d4_current_kpi_role(text);

create table public.d4_kpi_daily_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null default public.d4_current_employee_uuid() references public.b2_register(id),
  entry_date date not null,
  period varchar(7) not null,
  definition_version text not null,
  role_order integer not null check (role_order > 0),
  role_name text not null,
  status varchar(16) not null default 'completed' check (status = 'completed'),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) = 5),
  overall_score numeric(5,2) check (overall_score between 1 and 100),
  actor_auth_user_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (period = to_char(entry_date, 'YYYY-MM'))
);
create index d4_kpi_daily_entries_employee_period_idx on public.d4_kpi_daily_entries(employee_id, period, entry_date, created_at desc);

-- Trigger names keep the scorecard order: calculate fires before version (alphabetical).
create trigger d4_kpi_daily_entries_calculate before insert on public.d4_kpi_daily_entries
  for each row execute function public.d4_calculate_kpi_assessment();
create trigger d4_kpi_daily_entries_version before insert on public.d4_kpi_daily_entries
  for each row execute function public.d4_check_kpi_version();

-- KPI role HR mapped to the caller's own position in a catalog version. security definer: b2_register may be hidden
-- from the caller by B2's RLS, and the function only ever answers for auth.uid().
create or replace function public.d4_current_kpi_role(version text) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select k.role_order
  from public.b2_register r
  join public.d4_position_kpi_roles k on k.position_id = r.position_id and k.source_version = version
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
$$;
revoke all on function public.d4_current_kpi_role(text) from public, anon;
grant execute on function public.d4_current_kpi_role(text) to authenticated;

alter table public.d4_kpi_daily_entries enable row level security;

create policy "D4 KPI daily read permitted employee" on public.d4_kpi_daily_entries for select to authenticated using (
  (select public.d4_current_role()) = any (array['HR', 'MANAGER', 'MANAGEMENT']::public.d3_app_role[])
  or employee_id = (select public.d4_current_employee_uuid())
);

create policy "D4 KPI daily insert own entry" on public.d4_kpi_daily_entries for insert to authenticated with check (
  employee_id = (select public.d4_current_employee_uuid())
  and actor_auth_user_id = (select auth.uid())
  and role_order = public.d4_current_kpi_role(definition_version)
  and entry_date <= (now() at time zone 'Asia/Jakarta')::date
  and period = to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM')
);

revoke all on public.d4_kpi_daily_entries from anon, public, authenticated;
grant select, insert on public.d4_kpi_daily_entries to authenticated;
