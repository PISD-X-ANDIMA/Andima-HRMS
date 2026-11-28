-- Retire the public Figma preview and require an authenticated Supabase session.
drop policy if exists "Read supplied KPI role catalog" on public.d4_kpi_role_catalog;
create policy "Authenticated users read KPI role catalog"
  on public.d4_kpi_role_catalog for select to authenticated using (true);
revoke select on public.d4_kpi_role_catalog from anon;
grant select on public.d4_kpi_role_catalog to authenticated;

revoke all on public.d4_figma_demo_people, public.d4_figma_demo_trend from anon, authenticated;
