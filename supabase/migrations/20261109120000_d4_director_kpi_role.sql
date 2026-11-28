-- Directors get a KPI role, so they can score their own Daily KPI and can be assessed.
-- Interview D4, 14 Oct 2026, 00:33:23: the client's example of daily self-scoring is a director scoring the Director
-- KPI "Pencapaian Target Pendapatan Operasional", which is role 2 "Director" in the KPI Scorecard catalog.
-- Live check, 9 Nov 2026: DIR-FAT (1 employee) and DIR-GEN (2 employees) had no row in d4_position_kpi_roles.
--
-- Rollout: apply after 20261017130000 (it adds catalog V6). A version that does not exist yet is skipped, so the file
-- is also safe before it, but then rerun it after V6 to add the V6 rows. Re-running adds nothing twice.
-- Rollback: delete from public.d4_position_kpi_roles
--   where position_id in (select id from public.d3_positions where code in ('DIR-FAT', 'DIR-GEN')) and role_order = 2;
-- Temporary: once D1's KPI definitions are mapped to d3_positions, the Director KPI comes from D1 instead.

insert into public.d4_position_kpi_roles (source_version, position_id, role_order)
select v.source_version, p.id, 2
from public.d3_positions p
cross join public.d4_kpi_catalog_versions v
where p.code in ('DIR-FAT', 'DIR-GEN')
  and v.source_version in ('V5.1', 'V6')
  and exists (select 1 from public.d4_kpi_role_catalog c where c.source_version = v.source_version and c.role_order = 2)
on conflict do nothing;
