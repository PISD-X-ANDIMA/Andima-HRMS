-- The KPI catalog version now follows the scorecard period, and the position -> KPI role mapping is data HR owns.
-- * d4_kpi_catalog_versions: a version applies from effective_from (YYYY-MM) until the next version starts.
--   New catalog = insert its rows in d4_kpi_role_catalog, its mapping below, then one row here. No deploy needed.
-- * d4_position_kpi_roles: KPI role per position per version. A position without a row has no KPI (FR-02.11).
-- * Existing scorecards keep their own definition_version and lines; nothing is recalculated.

create table public.d4_kpi_catalog_versions (
  source_version text primary key,
  effective_from varchar(7) not null unique check (effective_from ~ '^\d{4}-(0[1-9]|1[0-2])$')
);
-- V5.1 covers every period so far; V3.1 rows stay in the catalog only as history.
insert into public.d4_kpi_catalog_versions (source_version, effective_from) values ('V5.1', '2000-01');

create table public.d4_position_kpi_roles (
  source_version text not null references public.d4_kpi_catalog_versions(source_version),
  position_id uuid not null references public.d3_positions(id) on delete cascade,
  role_order integer not null check (role_order > 0),
  primary key (source_version, position_id)
);
-- Seeded from the title keywords the app used until now, so behaviour does not change; HR can correct rows from here on.
insert into public.d4_position_kpi_roles (source_version, position_id, role_order)
select 'V5.1', p.id, m.role_order
from (values
    ('POS-LOG', 6), ('POS-HR', 10), ('FAT-BIL', 10), ('COM-SLS', 9), ('COM-SA', 9), ('DIR-FAT', 10), ('FAT-ACC-MGR', 10), ('DEMO-D3-HR', 10),
    ('DEMO-D4-POS-01', 1), ('DEMO-D4-POS-02', 2), ('DEMO-D4-POS-03', 3), ('DEMO-D4-POS-04', 4), ('DEMO-D4-POS-05', 5),
    ('DEMO-D4-POS-06', 6), ('DEMO-D4-POS-07', 7), ('DEMO-D4-POS-08', 8), ('DEMO-D4-POS-09', 9), ('DEMO-D4-POS-10', 10)
  ) as m(code, role_order)
join public.d3_positions p on p.code = m.code;

alter table public.d4_kpi_catalog_versions enable row level security;
alter table public.d4_position_kpi_roles enable row level security;
create policy "D4 KPI catalog versions read" on public.d4_kpi_catalog_versions for select to authenticated using (true);
create policy "D4 position KPI roles read" on public.d4_position_kpi_roles for select to authenticated using (true);
revoke all on public.d4_kpi_catalog_versions, public.d4_position_kpi_roles from anon, authenticated;
grant select on public.d4_kpi_catalog_versions, public.d4_position_kpi_roles to authenticated;

create or replace function public.d4_kpi_version_for(period text) returns text
language sql stable set search_path = public, pg_temp as $$
  select source_version from public.d4_kpi_catalog_versions
  where effective_from <= period order by effective_from desc limit 1
$$;
revoke all on function public.d4_kpi_version_for(text) from public, anon;
grant execute on function public.d4_kpi_version_for(text) to authenticated;

-- A new scorecard must use the version in force for its period, whatever the client sends.
create or replace function public.d4_check_kpi_version() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare expected text := public.d4_kpi_version_for(new.period);
begin
  if new.definition_version is distinct from expected then
    raise exception 'Scorecard periode % harus memakai katalog KPI %', new.period, coalesce(expected, '(belum ada katalog yang berlaku)');
  end if;
  return new;
end;
$$;
create trigger d4_kpi_assessments_version before insert on public.d4_kpi_assessments
  for each row execute function public.d4_check_kpi_version();
