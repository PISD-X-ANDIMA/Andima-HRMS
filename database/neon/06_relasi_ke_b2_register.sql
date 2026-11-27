-- 06_relasi_ke_b2_register.sql: relasi tabel D3 ke tabel MID public.b2_register
-- JANGAN DIJALANKAN TANPA PERSETUJUAN MID. Tabel MID tidak diubah, tapi relasi ini membatasi MID:
-- 3 relasi memakai ON DELETE RESTRICT, jadi akun di b2_register yang punya data presensi/koreksi/closing
-- tidak bisa dihapus MID. Relasi lain ON DELETE SET NULL (penunjuk di tabel D3 dikosongkan kalau akun dihapus).
-- Tanpa file ini, kolom b2_register_id di tabel D3 tetap ada dan tetap berisi id yang sama, hanya tidak dikunci database.
-- Id b2_register di Neon sama dengan Supabase (dicek 27 Nov, 39 dari 39), jadi relasi ini bisa langsung valid.

begin;
set search_path = public;

alter table public.d3_attendance_audit_log add constraint d3_attendance_audit_log_actor_b2_register_id_fkey FOREIGN KEY (actor_b2_register_id) REFERENCES b2_register(id) ON DELETE SET NULL;
alter table public.d3_attendance_audit_log add constraint d3_attendance_audit_log_target_b2_register_id_fkey FOREIGN KEY (target_b2_register_id) REFERENCES b2_register(id) ON DELETE SET NULL;
alter table public.d3_attendance_closings add constraint d3_attendance_closings_closed_by_b2_register_id_fkey FOREIGN KEY (closed_by_b2_register_id) REFERENCES b2_register(id) ON DELETE RESTRICT;
alter table public.d3_attendance_closings add constraint d3_attendance_closings_reopened_by_b2_register_id_fkey FOREIGN KEY (reopened_by_b2_register_id) REFERENCES b2_register(id) ON DELETE SET NULL;
alter table public.d3_attendance_corrections add constraint d3_attendance_corrections_requested_by_b2_register_id_fkey FOREIGN KEY (requested_by_b2_register_id) REFERENCES b2_register(id) ON DELETE RESTRICT;
alter table public.d3_attendance_corrections add constraint d3_attendance_corrections_reviewed_by_b2_register_id_fkey FOREIGN KEY (reviewed_by_b2_register_id) REFERENCES b2_register(id) ON DELETE SET NULL;
alter table public.d3_attendances add constraint d3_attendances_b2_register_id_fkey FOREIGN KEY (b2_register_id) REFERENCES b2_register(id) ON DELETE RESTRICT;

commit;
