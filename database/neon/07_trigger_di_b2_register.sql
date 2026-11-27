-- 07_trigger_di_b2_register.sql: trigger D3 yang menempel di tabel MID public.b2_register
-- JANGAN DIJALANKAN TANPA PERSETUJUAN MID: file ini MENGUBAH tabel kelompok lain (menambah trigger).
-- Gunanya sama seperti di Supabase: pegawai baru/berubah di b2_register otomatis disalin ke d3_employee,
-- dan employee_id di b2_register tidak boleh diganti setelah tersambung ke D3.
-- Tanpa file ini, sinkron dijalankan manual: select private.d3_reconcile_b2_employee_sources();

begin;
set search_path = public;

CREATE TRIGGER d3_reject_b2_employee_id_change BEFORE UPDATE OF employee_id ON public.b2_register FOR EACH ROW EXECUTE FUNCTION private.d3_reject_b2_employee_id_change();
CREATE TRIGGER d3_sync_employee_from_b2_after_eligibility_update AFTER UPDATE OF is_active, employee_id, full_name, email, phone, position_id, departement_id, created_at, employment_status, registration_status ON public.b2_register FOR EACH ROW EXECUTE FUNCTION private.d3_sync_employee_from_b2_trigger();
CREATE TRIGGER d3_sync_employee_from_b2_after_insert AFTER INSERT ON public.b2_register FOR EACH ROW EXECUTE FUNCTION private.d3_sync_employee_from_b2_trigger();

commit;
