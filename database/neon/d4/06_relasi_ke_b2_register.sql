-- 06_relasi_ke_b2_register.sql: relasi tabel D4 ke tabel MID public.b2_register
-- JANGAN DIJALANKAN TANPA PERSETUJUAN MID. Tabel MID tidak diubah, tetapi relasi ini membatasi MID:
-- 1. Relasi tanpa ON DELETE (semua kecuali satu) membuat akun di b2_register yang sudah punya penilaian, scorecard,
--    Daily KPI, development need, atau training tidak bisa dihapus MID.
-- 2. d4_training_records_employee_id_fkey memakai ON DELETE CASCADE: kalau MID menghapus akun, riwayat training
--    pegawai itu ikut terhapus. Ini sama dengan keadaan live sekarang.
-- Tanpa file ini, kolom employee_id dan actor_employee_id tetap berisi id yang sama, hanya tidak dikunci database.
-- Syarat: id b2_register di Neon sama dengan di Supabase. Menurut catatan D3 (06 mereka), 39 dari 39 sama per 27 Nov.

begin;
set search_path = public;

alter table public.d4_competency_assessments add constraint d4_competency_assessments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES b2_register(id);
alter table public.d4_competency_assessments add constraint d4_competency_assessments_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES b2_register(id);
alter table public.d4_performance_evaluations add constraint d4_performance_evaluations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES b2_register(id);
alter table public.d4_performance_evaluations add constraint d4_performance_evaluations_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES b2_register(id);
alter table public.d4_kpi_assessments add constraint d4_kpi_assessments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES b2_register(id);
alter table public.d4_kpi_assessments add constraint d4_kpi_assessments_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES b2_register(id);
alter table public.d4_kpi_daily_entries add constraint d4_kpi_daily_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES b2_register(id);
alter table public.d4_development_needs add constraint d4_development_needs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES b2_register(id);
alter table public.d4_development_needs add constraint d4_development_needs_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES b2_register(id);
alter table public.d4_development_need_versions add constraint d4_development_need_versions_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES b2_register(id);
alter table public.d4_training_records add constraint d4_training_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES b2_register(id) ON DELETE CASCADE;
alter table public.d4_training_records add constraint d4_training_records_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES b2_register(id);
alter table public.d4_training_versions add constraint d4_training_versions_actor_employee_id_fkey FOREIGN KEY (actor_employee_id) REFERENCES b2_register(id);

commit;
