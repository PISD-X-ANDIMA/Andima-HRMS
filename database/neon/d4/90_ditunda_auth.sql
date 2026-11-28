-- 90_ditunda_auth.sql: JANGAN DIJALANKAN SEKARANG
-- Bagian D4 yang bergantung pada login Supabase: auth.uid(), auth.role(), auth.users, dan peran anon, authenticated, service_role.
-- Jalankan setelah kelas memutuskan pengganti Supabase Auth, setelah 01 sampai 06 D4, dan setelah skrip 90 D3
-- (fungsi d3_* dan tipe d3_app_role dipakai di sini). Sebelum dijalankan, sesuaikan dulu:
--   auth.uid() dan auth.role() diganti fungsi login versi Neon, relasi ke auth.users diganti tabel akun pengganti,
--   dan nama peran (authenticated, service_role) disamakan dengan peran yang dipakai aplikasi di Neon.
-- Isi: 3 fungsi peran, 16 default kolom, 8 relasi ke auth.users, 4 view, RLS untuk 11 tabel, 19 policy, dan grant.
--
-- BEDA DENGAN LIVE: di Supabase live, RLS untuk d4_development_needs, d4_development_need_versions, dan d4_training_records
-- dalam keadaan MATI (dicek 28 Nov 2026), padahal migrasi D4 menyalakannya. File ini menyalakan RLS di ketiganya,
-- sesuai rancangan, supaya pegawai hanya bisa membaca datanya sendiri.

begin;
set search_path = public;

CREATE OR REPLACE FUNCTION public.d4_current_employee_uuid()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select r.id from public.b2_register r
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
$function$;

CREATE OR REPLACE FUNCTION public.d4_current_role()
 RETURNS d3_app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
      when p.code in ('POS-HR', 'DEMO-D3-HR') then 'HR'
      when p.code like 'DIR-%' then 'MANAGEMENT'
      when p.code like '%-MGR' then 'MANAGER'
      else 'EMPLOYEE'
    end::public.d3_app_role
  from public.b2_register r
  left join public.d3_positions p on p.id = r.position_id
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
$function$;

-- Membaca d4_kpi_position_roles, jadi butuh 05 (katalog KPI dari D1).
CREATE OR REPLACE FUNCTION public.d4_current_kpi_role(version text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select k.role_order
  from public.b2_register r
  join public.d4_kpi_position_roles k on k.position_id = r.position_id and k.source_version = version
  where r.id = auth.uid() and coalesce(r.is_active, true) and r.full_name is not null
$function$;

-- Default yang dilepas di 01. Tanpa ini, d4_create_development_need, d4_create_training_record,
-- dan insert dari aplikasi gagal karena actor_auth_user_id dan actor_employee_id wajib diisi.
alter table public.d4_competency_assessments alter column actor_auth_user_id set default auth.uid();
alter table public.d4_competency_assessments alter column actor_employee_id set default d4_current_employee_uuid();
alter table public.d4_performance_evaluations alter column actor_auth_user_id set default auth.uid();
alter table public.d4_performance_evaluations alter column actor_employee_id set default d4_current_employee_uuid();
alter table public.d4_kpi_assessments alter column actor_auth_user_id set default auth.uid();
alter table public.d4_kpi_assessments alter column actor_employee_id set default d4_current_employee_uuid();
alter table public.d4_kpi_daily_entries alter column employee_id set default d4_current_employee_uuid();
alter table public.d4_kpi_daily_entries alter column actor_auth_user_id set default auth.uid();
alter table public.d4_development_needs alter column actor_auth_user_id set default auth.uid();
alter table public.d4_development_needs alter column actor_employee_id set default d4_current_employee_uuid();
alter table public.d4_development_need_versions alter column actor_auth_user_id set default auth.uid();
alter table public.d4_development_need_versions alter column actor_employee_id set default d4_current_employee_uuid();
alter table public.d4_training_records alter column actor_auth_user_id set default auth.uid();
alter table public.d4_training_records alter column actor_employee_id set default d4_current_employee_uuid();
alter table public.d4_training_versions alter column actor_auth_user_id set default auth.uid();
alter table public.d4_training_versions alter column actor_employee_id set default d4_current_employee_uuid();

alter table public.d4_competency_assessments add constraint d4_competency_assessments_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);
alter table public.d4_performance_evaluations add constraint d4_performance_evaluations_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);
alter table public.d4_kpi_assessments add constraint d4_kpi_assessments_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);
alter table public.d4_kpi_daily_entries add constraint d4_kpi_daily_entries_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);
alter table public.d4_development_needs add constraint d4_development_needs_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);
alter table public.d4_development_need_versions add constraint d4_development_need_versions_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);
alter table public.d4_training_records add constraint d4_training_records_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);
alter table public.d4_training_versions add constraint d4_training_versions_actor_auth_user_id_fkey FOREIGN KEY (actor_auth_user_id) REFERENCES auth.users(id);

CREATE VIEW public.d4_user_access AS
 SELECT auth.uid() AS auth_user_id,
    d4_current_role() AS app_role,
    d4_current_employee_uuid() AS employee_id
  WHERE d4_current_employee_uuid() IS NOT NULL;

CREATE VIEW public.d4_employee AS
 SELECT id,
    employee_id,
    full_name,
    position_id,
    departement_id AS department_id,
    employment_status
   FROM b2_register r
  WHERE COALESCE(is_active, true) AND full_name IS NOT NULL AND (EXISTS ( SELECT 1
           FROM auth.users u
          WHERE u.id = r.id)) AND ((d4_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR id = auth.uid());

CREATE VIEW public.d4_employee_skills AS
 SELECT s.id,
    r.id AS employee_id,
    s.competency_id,
    s.proficiency_level,
    s.evidence_notes
   FROM d3_employee_skills s
     JOIN d3_employee e ON e.id = s.employee_id
     JOIN b2_register r ON lower(r.email::text) = lower(e.email::text)
  WHERE COALESCE(r.is_active, true) AND r.full_name IS NOT NULL AND ((d4_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR r.id = auth.uid());

-- Dibaca D1 untuk laporan KPI. Butuh 05 (tabel D1) dan auth.role().
CREATE VIEW public.d4_kpi_scores_for_d1 AS
 WITH daily AS (
         SELECT DISTINCT ON (d.employee_id, d.entry_date) 'daily'::text AS source,
            d.id,
            d.employee_id,
            d.period,
            d.entry_date,
            d.overall_score,
            d.lines,
            d.definition_version,
            NULL::text AS note,
            d.created_at
           FROM d4_kpi_daily_entries d
          ORDER BY d.employee_id, d.entry_date, d.created_at DESC
        ), review AS (
         SELECT DISTINCT ON (a.employee_id, a.period) 'period'::text AS source,
            a.id,
            a.employee_id,
            a.period,
            NULL::date AS entry_date,
            a.overall_score,
            a.lines,
            a.definition_version,
            a.general_notes AS note,
            a.created_at
           FROM d4_kpi_assessments a
          WHERE a.status::text = 'completed'::text
          ORDER BY a.employee_id, a.period, a.created_at DESC
        ), records AS (
         SELECT daily.source, daily.id, daily.employee_id, daily.period, daily.entry_date, daily.overall_score,
            daily.lines, daily.definition_version, daily.note, daily.created_at
           FROM daily
        UNION ALL
         SELECT review.source, review.id, review.employee_id, review.period, review.entry_date, review.overall_score,
            review.lines, review.definition_version, review.note, review.created_at
           FROM review
        )
 SELECT md5((r.id::text || ':'::text) || kpi.id::text)::uuid AS id,
    r.source,
    b.employee_id AS employee_ref,
    b.full_name AS employee_name,
    b.employment_status,
    kpi.position_id,
    kpi.id AS kpi_id,
    (line.value ->> 'raw_score'::text)::integer AS score,
    to_date(r.period::text || '-01'::text, 'YYYY-MM-DD'::text) AS period,
    r.entry_date,
    r.overall_score,
        CASE
            WHEN r.overall_score > 85::numeric THEN 'High'::text
            WHEN r.overall_score >= 80::numeric THEN 'Average'::text
            ELSE 'Under'::text
        END AS status,
    r.note,
    r.created_at,
    r.id AS d4_record_id
   FROM records r
     JOIN b2_register b ON b.id = r.employee_id
     CROSS JOIN LATERAL jsonb_array_elements(r.lines) line(value)
     CROSS JOIN LATERAL ( SELECT k.id,
            k.position_id
           FROM d1_kpi_definitions k
          WHERE k.id::text = (line.value ->> 'd1_kpi_id'::text)
        UNION ALL
         SELECT k.id,
            k.position_id
           FROM d3_d1_position_mappings m
             JOIN d1_kpi_definitions k ON k.position_id = m.d1_position_id AND k.is_active AND k.deleted_at IS NULL
          WHERE (line.value ->> 'd1_kpi_id'::text) IS NULL AND m.position_id = b.position_id AND m.is_active AND lower(btrim(k.kpi_name::text)) = lower(btrim(line.value ->> 'kpi_name'::text))
 LIMIT 1) kpi
  WHERE (r.definition_version <> ALL (ARRAY['V3.1'::text, 'V5.1'::text])) AND (line.value ->> 'raw_score'::text) ~ '^[0-9]+$'::text AND (((( SELECT d4_current_role() AS d4_current_role)) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR r.employee_id = (( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid)) OR (( SELECT auth.role() AS role)) = 'service_role'::text);

alter table public.d4_competency_assessments enable row level security;
alter table public.d4_performance_evaluations enable row level security;
alter table public.d4_kpi_assessments enable row level security;
alter table public.d4_kpi_daily_entries enable row level security;
alter table public.d4_kpi_catalog_versions enable row level security;
alter table public.d4_kpi_role_catalog enable row level security;
alter table public.d4_position_kpi_roles enable row level security;
alter table public.d4_development_needs enable row level security;
alter table public.d4_development_need_versions enable row level security;
alter table public.d4_training_records enable row level security;
alter table public.d4_training_versions enable row level security;

create policy "D4 KPI catalog versions read" on public.d4_kpi_catalog_versions as PERMISSIVE for SELECT to authenticated
  using (true);
create policy "Authenticated users read KPI role catalog" on public.d4_kpi_role_catalog as PERMISSIVE for SELECT to authenticated
  using (true);
create policy "D4 position KPI roles read" on public.d4_position_kpi_roles as PERMISSIVE for SELECT to authenticated
  using (true);

create policy "D4 competency insert HR manager" on public.d4_competency_assessments as PERMISSIVE for INSERT to authenticated
  with check (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid() AS uid)) AND (actor_employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));
create policy "D4 competency read permitted employee" on public.d4_competency_assessments as PERMISSIVE for SELECT to authenticated
  using (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR (employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));

create policy "D4 performance insert HR manager" on public.d4_performance_evaluations as PERMISSIVE for INSERT to authenticated
  with check (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid() AS uid)) AND (actor_employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));
create policy "D4 performance read permitted employee" on public.d4_performance_evaluations as PERMISSIVE for SELECT to authenticated
  using (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR (employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));

create policy "D4 KPI assessment insert HR manager" on public.d4_kpi_assessments as PERMISSIVE for INSERT to authenticated
  with check (((d4_current_role() = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (actor_auth_user_id = auth.uid()) AND (actor_employee_id = d4_current_employee_uuid())));
create policy "D4 KPI assessment read permitted employee" on public.d4_kpi_assessments as PERMISSIVE for SELECT to authenticated
  using (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR (employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));

create policy "D4 KPI daily insert own entry" on public.d4_kpi_daily_entries as PERMISSIVE for INSERT to authenticated
  with check (((employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid)) AND (actor_auth_user_id = ( SELECT auth.uid() AS uid)) AND (role_order = d4_current_kpi_role(definition_version)) AND (entry_date <= ((now() AT TIME ZONE 'Asia/Jakarta'::text))::date) AND ((period)::text = to_char((now() AT TIME ZONE 'Asia/Jakarta'::text), 'YYYY-MM'::text))));
create policy "D4 KPI daily read permitted employee" on public.d4_kpi_daily_entries as PERMISSIVE for SELECT to authenticated
  using (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR (employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));

create policy "D4 development insert HR manager" on public.d4_development_needs as PERMISSIVE for INSERT to authenticated
  with check (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid() AS uid)) AND (actor_employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));
create policy "D4 development read permitted employee" on public.d4_development_needs as PERMISSIVE for SELECT to authenticated
  using (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR (employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));

create policy "D4 development history insert HR manager" on public.d4_development_need_versions as PERMISSIVE for INSERT to authenticated
  with check (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid() AS uid)) AND (actor_employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid)) AND (EXISTS ( SELECT 1
   FROM d4_development_needs n
  WHERE (n.id = d4_development_need_versions.development_need_id)))));
create policy "D4 development history read permitted employee" on public.d4_development_need_versions as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM d4_development_needs n
  WHERE (n.id = d4_development_need_versions.development_need_id))));

create policy "D4 training insert HR manager" on public.d4_training_records as PERMISSIVE for INSERT to authenticated
  with check (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid() AS uid)) AND (actor_employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));
create policy "D4 training read permitted employee" on public.d4_training_records as PERMISSIVE for SELECT to authenticated
  using (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role, 'MANAGEMENT'::d3_app_role])) OR (employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid))));

create policy "D4 training history insert HR manager" on public.d4_training_versions as PERMISSIVE for INSERT to authenticated
  with check (((( SELECT d4_current_role() AS d4_current_role) = ANY (ARRAY['HR'::d3_app_role, 'MANAGER'::d3_app_role])) AND (actor_auth_user_id = ( SELECT auth.uid() AS uid)) AND (actor_employee_id = ( SELECT d4_current_employee_uuid() AS d4_current_employee_uuid)) AND (EXISTS ( SELECT 1
   FROM d4_training_records t
  WHERE (t.id = d4_training_versions.training_id)))));
create policy "D4 training history read permitted employee" on public.d4_training_versions as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM d4_training_records t
  WHERE (t.id = d4_training_versions.training_id))));

-- Grant sama dengan live: tabel transaksi hanya baca dan tambah (riwayat tidak pernah diubah atau dihapus),
-- katalog dan view hanya baca. Live memberi authenticated hak penuh di beberapa view dan di position_requirements;
-- di sini dibatasi baca, karena aplikasi D4 tidak pernah menulis ke sana.
grant select, insert on public.d4_competency_assessments, public.d4_performance_evaluations, public.d4_kpi_assessments,
  public.d4_kpi_daily_entries, public.d4_development_needs, public.d4_development_need_versions,
  public.d4_training_records, public.d4_training_versions to authenticated;
grant select on public.d4_kpi_catalog_versions, public.d4_kpi_role_catalog, public.d4_position_kpi_roles,
  public.position_requirements, public.d4_kpi_catalog_rows, public.d4_kpi_d1_catalog, public.d4_kpi_d1_position_roles,
  public.d4_kpi_position_roles, public.d4_kpi_scores_for_d1, public.d4_user_access, public.d4_employee,
  public.d4_employee_skills to authenticated;
grant all on public.d4_competency_assessments, public.d4_performance_evaluations, public.d4_kpi_assessments,
  public.d4_kpi_daily_entries, public.d4_development_needs, public.d4_development_need_versions,
  public.d4_training_records, public.d4_training_versions, public.d4_kpi_catalog_versions, public.d4_kpi_role_catalog,
  public.d4_position_kpi_roles, public.d4_kpi_scores_for_d1 to service_role;

revoke execute on function public.d4_current_employee_uuid(), public.d4_current_role(), public.d4_current_kpi_role(text),
  public.d4_kpi_version_for(text),
  public.d4_create_development_need(uuid, character varying, uuid, text, character varying, text, text, text),
  public.d4_create_training_record(uuid, uuid, text, date, character varying, text, text) from public;
grant execute on function public.d4_current_employee_uuid(), public.d4_current_role(), public.d4_current_kpi_role(text),
  public.d4_kpi_version_for(text),
  public.d4_create_development_need(uuid, character varying, uuid, text, character varying, text, text, text),
  public.d4_create_training_record(uuid, uuid, text, date, character varying, text, text) to authenticated;

commit;
