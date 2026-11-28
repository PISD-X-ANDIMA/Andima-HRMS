-- 03_relasi_index.sql: relasi antar tabel D4, relasi ke tabel D3, dua check lama, dan index tambahan
-- Jalankan setelah 01 dan 02 D4, dan setelah skrip D3 01 sampai 03 (plus data D3), karena ada relasi ke d3_positions dan d3_competencies.
-- Relasi ke b2_register milik MID ada di 06 (perlu persetujuan MID). Relasi ke auth.users ada di 90.

begin;
set search_path = public;

alter table public.position_requirements add constraint position_requirements_position_id_fkey FOREIGN KEY (position_id) REFERENCES d3_positions(id) ON DELETE CASCADE;
alter table public.position_requirements add constraint position_requirements_competency_id_fkey FOREIGN KEY (competency_id) REFERENCES d3_competencies(id) ON DELETE RESTRICT;

alter table public.d4_position_kpi_roles add constraint d4_position_kpi_roles_position_id_fkey FOREIGN KEY (position_id) REFERENCES d3_positions(id) ON DELETE CASCADE;
alter table public.d4_position_kpi_roles add constraint d4_position_kpi_roles_source_version_fkey FOREIGN KEY (source_version) REFERENCES d4_kpi_catalog_versions(source_version);

alter table public.d4_competency_assessments add constraint d4_competency_assessments_position_id_fkey FOREIGN KEY (position_id) REFERENCES d3_positions(id);
alter table public.d4_performance_evaluations add constraint d4_performance_evaluations_position_id_fkey FOREIGN KEY (position_id) REFERENCES d3_positions(id);

alter table public.d4_development_needs add constraint d4_development_needs_position_requirement_id_fkey FOREIGN KEY (position_requirement_id) REFERENCES position_requirements(id);
alter table public.d4_development_needs add constraint d4_development_needs_competency_assessment_id_employee_id_fkey FOREIGN KEY (competency_assessment_id, employee_id) REFERENCES d4_competency_assessments(id, employee_id) ON DELETE CASCADE;
alter table public.d4_development_needs add constraint d4_development_needs_kpi_assessment_fkey FOREIGN KEY (kpi_assessment_id, employee_id) REFERENCES d4_kpi_assessments(id, employee_id);
alter table public.d4_development_needs add constraint d4_development_needs_performance_evaluation_id_employee_id_fkey FOREIGN KEY (performance_evaluation_id, employee_id) REFERENCES d4_performance_evaluations(id, employee_id);
alter table public.d4_development_need_versions add constraint d4_development_need_versions_development_need_id_fkey FOREIGN KEY (development_need_id) REFERENCES d4_development_needs(id) ON DELETE CASCADE;
alter table public.d4_training_records add constraint d4_training_records_development_need_id_employee_id_fkey FOREIGN KEY (development_need_id, employee_id) REFERENCES d4_development_needs(id, employee_id) ON DELETE CASCADE;
alter table public.d4_training_versions add constraint d4_training_versions_training_id_fkey FOREIGN KEY (training_id) REFERENCES d4_training_records(id) ON DELETE CASCADE;

-- NOT VALID sama seperti di live: berlaku untuk baris baru, baris lama yang belum lengkap tetap dibiarkan.
alter table public.d4_kpi_assessments add constraint d4_kpi_assessments_evidence_reference_required CHECK (((evidence_reference IS NOT NULL) AND (btrim(evidence_reference) <> ''::text))) NOT VALID;
alter table public.d4_kpi_assessments add constraint d4_kpi_assessments_notes_required CHECK ((((status)::text <> 'completed'::text) OR (length(btrim(general_notes)) > 0))) NOT VALID;

CREATE INDEX d4_competency_employee_date_idx ON public.d4_competency_assessments USING btree (employee_id, effective_date DESC, created_at DESC);
CREATE INDEX d4_development_needs_assessment_idx ON public.d4_development_needs USING btree (competency_assessment_id) WHERE (competency_assessment_id IS NOT NULL);
CREATE INDEX d4_development_needs_employee_idx ON public.d4_development_needs USING btree (employee_id, created_at DESC);
CREATE INDEX d4_development_needs_evaluation_idx ON public.d4_development_needs USING btree (performance_evaluation_id) WHERE (performance_evaluation_id IS NOT NULL);
CREATE INDEX d4_development_needs_kpi_assessment_idx ON public.d4_development_needs USING btree (kpi_assessment_id) WHERE (kpi_assessment_id IS NOT NULL);
CREATE INDEX d4_development_needs_requirement_idx ON public.d4_development_needs USING btree (position_requirement_id) WHERE (position_requirement_id IS NOT NULL);
CREATE INDEX d4_development_versions_need_idx ON public.d4_development_need_versions USING btree (development_need_id, revision DESC);
CREATE INDEX d4_kpi_assessments_employee_period_idx ON public.d4_kpi_assessments USING btree (employee_id, period, created_at DESC);
CREATE INDEX d4_kpi_daily_entries_employee_period_idx ON public.d4_kpi_daily_entries USING btree (employee_id, period, entry_date, created_at DESC);
CREATE INDEX d4_performance_employee_period_idx ON public.d4_performance_evaluations USING btree (employee_id, period, created_at DESC);
CREATE INDEX d4_training_records_employee_idx ON public.d4_training_records USING btree (employee_id, activity_date DESC);
CREATE INDEX d4_training_records_need_idx ON public.d4_training_records USING btree (development_need_id);
CREATE INDEX d4_training_versions_training_idx ON public.d4_training_versions USING btree (training_id, revision DESC);

commit;
