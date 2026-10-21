import { catalogFor, indicatorsFor, roleForPosition, targetOf } from "../../kpi/catalog";
import { scaleMaxOf } from "../../kpi/scale";
import type { KpiAssessmentLine } from "../../supabase/types";
import { assertEvaluationInPeriod, assertNotFutureDate, assertNotSelf, assertPeriodRevision } from "../../shared/rules";
import { ApiError, employeeFilter, enforce, field, optionalUuid, readJson } from "../_lib/http";
import { loadCatalogSet } from "../kpi-catalog";
import { d4Session, requireWriter } from "../_lib/session";

/** GET /api/d4/kpi-assessments?employee_id= — KPI scorecards, newest first. */
export async function listAssessments(request: Request) {
  const { repository } = await d4Session();
  const employeeId = employeeFilter(request);
  return ((await repository.loadSnapshot()).kpiAssessments ?? []).filter((item) => !employeeId || item.employeeId === employeeId);
}

/** GET /api/d4/kpi-assessments/:id */
export async function getAssessment(id: string) {
  const { repository } = await d4Session();
  const assessment = (await repository.loadSnapshot()).kpiAssessments?.find((item) => item.id === id);
  if (!assessment) throw new ApiError("NOT_FOUND", "KPI scorecard tidak ditemukan.");
  return assessment;
}

/**
 * POST /api/d4/kpi-assessments — the catalog version is the one in force for the period, and the KPI role must be
 * the one HR mapped to the employee's position in that version (FR-02.1/FR-02.11) and the five lines must match it exactly (name, order, weight = 100 %). Weighted and total scores are calculated by the
 * database trigger. Since Q4 the form's Actual is the raw score (`raw_score`); `actual` is stored as sent, and text in it
 * from an older client is shown as realisation in Comment.
 */
export async function createAssessment(request: Request) {
  const { client, repository, access } = await requireWriter();
  const body = await readJson(request);
  // FR-D4-002 defines no draft scorecard; every saved scorecard is complete.
  const status = field.oneOf(body, "status", ["completed"] as const);
  const roleOrder = typeof body.roleOrder === "number" ? body.roleOrder : NaN;
  const employeeId = field.uuid(body, "employeeId");
  const period = field.period(body, "period");
  const catalog = catalogFor(await loadCatalogSet(client), period);
  if (!catalog) throw new ApiError("VALIDATION_FAILED", `Belum ada katalog KPI yang berlaku untuk periode ${period}.`);
  const indicators = indicatorsFor(catalog, roleOrder);
  const snapshot = await repository.loadSnapshot();
  const { reference } = snapshot;
  const employee = reference.employees.find((item) => item.id === employeeId);
  if (!employee) throw new ApiError("NOT_FOUND", "Pegawai tidak ditemukan.");
  const evaluatorName = reference.employees.find((item) => item.id === access.employeeId)?.fullName;
  if (!evaluatorName) throw new ApiError("FORBIDDEN", "Akun ini belum terhubung ke data pegawai.");
  enforce(() => assertNotSelf(access.employeeId, employeeId));
  enforce(() => assertPeriodRevision(snapshot.kpiAssessments ?? [], employeeId, period, optionalUuid(body, "revisionOf"), "Scorecard"));
  if (roleForPosition(catalog, employee.positionId) !== roleOrder) throw new ApiError("VALIDATION_FAILED", "Set KPI yang dipilih bukan milik posisi pegawai ini.");
  if (indicators.length !== 5 || indicators.reduce((sum, row) => sum + row.weight_percent, 0) !== 100) throw new ApiError("VALIDATION_FAILED", "Role KPI tidak ditemukan di katalog, atau total bobotnya tidak 100%.");
  if (!Array.isArray(body.lines) || body.lines.length !== 5) throw new ApiError("VALIDATION_FAILED", "Scorecard harus memiliki lima indikator KPI.");
  const lines: KpiAssessmentLine[] = indicators.map((indicator, index) => {
    const raw = (body.lines as unknown[])[index] as Record<string, unknown> | null;
    if (!raw) throw new ApiError("VALIDATION_FAILED", `Indikator ${index + 1} wajib diisi.`);
    // The Core KPI name is editable per scorecard; order and weight stay locked to the catalog (Excel formula).
    const kpiName = field.text(raw, "kpi_name", { required: true, max: 200 }).trim();
    if (!kpiName) throw new ApiError("VALIDATION_FAILED", `Core KPI ${index + 1} wajib diisi.`);
    const score = field.score(raw.raw_score, `Actual untuk ${indicator.kpi_name}`, { required: status === "completed", max: scaleMaxOf(catalog.version) });
    return {
      indicator_order: indicator.indicator_order, kpi_name: kpiName, weight_percent: indicator.weight_percent,
      target: targetOf(indicator), actual: field.text(raw, "actual", { required: false, max: 200 }),
      raw_score: score, comment: field.text(raw, "comment", { required: false, max: 500 }),
    };
  });
  const generalNotes = field.text(body, "generalNotes", { required: false, max: 4000 }).trim();
  if (!generalNotes) throw new ApiError("VALIDATION_FAILED", "Notes wajib diisi.");
  // Interview D4 (14 Oct 2026): evidence is required.
  const evidenceReference = field.text(body, "evidenceReference", { required: false, max: 500 }).trim();
  if (!evidenceReference) throw new ApiError("VALIDATION_FAILED", "Reference wajib diisi.");
  const evaluationDate = field.date(body, "evaluationDate", { required: status === "completed" });
  enforce(() => assertNotFutureDate(evaluationDate));
  enforce(() => assertEvaluationInPeriod(period, evaluationDate));
  const id = await repository.saveKpiAssessment({
    definitionVersion: catalog.version,
    employeeId, roleOrder, roleName: indicators[0].role_name,
    period, evaluationDate,
    evaluatorName,
    status, lines,
    // FR-D4-001 v3.1: one Penilaian Kinerja = five KPI + notes + evidence, all required.
    generalNotes,
    evidenceReference,
  });
  return { id, definitionVersion: catalog.version };
}
