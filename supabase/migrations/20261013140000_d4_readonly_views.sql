-- d4_employee is a simple view over b2_register, so Postgres made it auto-updatable, and the default
-- Supabase grants gave authenticated insert/update/delete on it. The view runs with owner rights,
-- so an Employee could update their own b2_register row (e.g. position_id -> POS-HR) past B2's RLS.
-- D4 only ever reads these views and the KPI catalog.
revoke all on public.d4_employee, public.d4_user_access from authenticated;
grant select on public.d4_employee, public.d4_user_access to authenticated;

-- The catalog is reference data; RLS already allows select only. Drop the unused write grants too.
revoke insert, update, delete, truncate on public.d4_kpi_role_catalog from authenticated, anon;

-- Trigger functions are never called directly.
revoke all on function public.sync_register_email_to_auth() from public, anon, authenticated;
