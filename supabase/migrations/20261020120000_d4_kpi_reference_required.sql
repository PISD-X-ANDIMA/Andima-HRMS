-- Q12 (answer of 20 Oct 2026, UAT-06): the Performance Review Reference (d4_kpi_assessments.evidence_reference) is
-- required in the database too, not only in the form and the API (modules/d4/server/kpi-assessments already refuses
-- an empty Reference with 422 "Reference wajib diisi.").
--
-- Rollout rules
--   * Independent of 20261017130000 (V6) and 20261019120000: it only needs the column from 20261013160000, which is
--     already live. The app works the same before and after this migration, because every save already sends a
--     Reference.
--   * NOT VALID: existing rows are not checked, so the legacy rows without a Reference do not block it (live check on
--     20 Oct 2026: 3 of 69 scorecards have evidence_reference null, 0 are blank). Every new INSERT and every UPDATE
--     is checked. The table is insert-only (a revision is a new row), so no current code path updates an old row.
--   * The existing CHECK (length(evidence_reference) <= 500) stays as it is.
--   * d4_performance_evaluations is NOT locked: the form no longer writes to it, POST /api/d4/performance-evaluations
--     still documents Reference as optional, and 2 of its 2 rows have no Reference.
--
-- Validating later: once the 3 legacy rows have a Reference (find them with
--   select id, employee_id, period from public.d4_kpi_assessments
--   where evidence_reference is null or btrim(evidence_reference) = '';
-- ), run:
--   alter table public.d4_kpi_assessments validate constraint d4_kpi_assessments_evidence_reference_required;
-- VALIDATE only reads the rows and takes a light lock; it fails, changing nothing, while any old row is still empty.

-- A CHECK passes when its expression is null, so the null case must be excluded explicitly.
alter table public.d4_kpi_assessments
  add constraint d4_kpi_assessments_evidence_reference_required
  check (evidence_reference is not null and btrim(evidence_reference) <> '') not valid;

comment on constraint d4_kpi_assessments_evidence_reference_required on public.d4_kpi_assessments is
  'Q12 (20 Oct 2026): Reference wajib terisi. NOT VALID untuk 3 baris lama tanpa Reference; jalankan VALIDATE CONSTRAINT setelah baris itu diisi.';
