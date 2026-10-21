import type { SupabaseClient, User } from "@supabase/supabase-js";
import { compareCompetencies } from "../competency/service";
import type { CompetencyAssessment, CompetencyFinding, CompetencyOverallStatus } from "../competency/types";
import type { DevelopmentNeedVersion, DevelopmentPriority, DevelopmentReassessment, DevelopmentSourceType } from "../development/types";
import type { EvaluationAspect, EvaluationInput, PerformanceEvaluation } from "../performance/types";
import { validatePerformanceInput } from "../performance/validation";
import { ApiError, databaseError, enforce } from "../shared/errors";
import { retrainingNotes, type DevelopmentRevision, type TrainingFollowUpInput } from "../shared/rules";
import type { ReferenceDataRepository } from "../shared/services";
import type { ReferenceDataSnapshot } from "../shared/types";
import type { TrainingFollowUp, TrainingStatus, TrainingVersion } from "../training/types";
import type { D3KpiRecord, D4LiveSnapshot, KpiAssessment, KpiAssessmentInput, KpiAssessmentLine } from "./types";

type QueryResult<T> = { data: T | null; error: { message: string; code?: string } | null };
function take<T>(result: QueryResult<T>, label: string): T {
  if (result.error) throw databaseError(result.error, label);
  if (result.data === null) throw new Error(`${label}: empty response.`);
  return result.data;
}

const PAGE_ROWS = 1000;
type Pageable = { range: (from: number, to: number) => PromiseLike<QueryResult<unknown[]>> };

/**
 * PostgREST returns at most 1000 rows per request (Supabase default max-rows), so a bigger table would be cut
 * off without an error. Reads every page; the query is rebuilt per page because a builder runs only once.
 * Each query needs a stable order (ends with the primary key) so pages do not overlap.
 */
async function allRows(query: () => Pageable): Promise<QueryResult<unknown[]>> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const page = await query().range(from, from + PAGE_ROWS - 1);
    if (page.error) return page;
    rows.push(...(page.data ?? []));
    if (!page.data || page.data.length < PAGE_ROWS) return { data: rows, error: null };
  }
}

interface RawDepartment { id: string; code: string; name: string }
interface RawPosition { id: string; code: string; title: string; department_id: string | null }
interface RawEmployee { id: string; employee_id: string; full_name: string; position_id: string | null; department_id: string | null; employment_status?: string | null }
interface RawCompetency { id: string; code: string; name: string; category: string | null }
interface RawRequirement { id: string; position_id: string; competency_id: string; min_proficiency_level: number; is_mandatory: boolean | null }
interface RawSkill { id: string; employee_id: string; competency_id: string; proficiency_level: number; evidence_notes: string | null }
interface RawKpi { id: string; employee_id: string; period: string; kpi_score: number; notes: string | null; created_at: string }
interface RawKpiAssessment { id: string; definition_version?: string; employee_id: string; role_order: number; role_name: string; period: string; evaluation_date: string | null; evaluator_name: string; status: "draft" | "completed"; lines: unknown; overall_score: number | null; general_notes: string; evidence_reference?: string | null; actor_employee_id: string; created_at: string }
interface RawPerformance { id: string; employee_id: string; period: string; evaluation_date: string | null; evaluator_name_snapshot: string; status: "draft" | "completed"; review_status: PerformanceEvaluation["reviewStatus"]; overall_score: number | null; aspects: unknown; general_notes: string; evidence_reference: string | null; actor_employee_id: string; created_at: string }
interface RawAssessment { id: string; employee_id: string; position_id: string; effective_date: string; context: CompetencyAssessment["context"]; overall_status: CompetencyOverallStatus; findings: unknown; assessed_with?: string | null; actor_employee_id: string; created_at: string }
interface RawDevelopment { id: string; employee_id: string; source_type: DevelopmentSourceType; position_requirement_id: string | null; competency_assessment_id: string | null; kpi_assessment_id?: string | null; performance_evaluation_id: string | null; objective: string; priority: DevelopmentPriority; method?: string | null; pic?: string | null }
// priority/method/pic: null = unchanged in this revision, "" = cleared. Absent before migration 20261019120000.
interface RawDevelopmentVersion { id: string; development_need_id: string; revision: number; status: DevelopmentNeedVersion["status"]; notes: string; priority?: DevelopmentPriority | null; method?: string | null; pic?: string | null; reassessment?: DevelopmentReassessment | null; actor_employee_id: string; created_at: string }
interface RawTraining { id: string; employee_id: string; development_need_id: string; activity: string; activity_date: string }
// follow_up is absent before migration 20261020130000.
interface RawTrainingVersion { id: string; training_id: string; revision: number; status: TrainingStatus; result: string; notes: string; follow_up?: TrainingFollowUp | null; actor_employee_id: string; created_at: string }

/** Shown when a follow-up is saved before migration 20261020130000 adds d4_training_versions.follow_up. */
export const FOLLOW_UP_NOT_READY = "Tindak lanjut training belum bisa disimpan karena database belum diperbarui (migrasi 20261020130000). Hubungi admin HRMS; data lain tetap bisa disimpan.";

function actorName(reference: ReferenceDataSnapshot, employeeId: string): string {
  return reference.employees.find((item) => item.id === employeeId)?.fullName ?? `Employee ${employeeId.slice(0, 8)}`;
}

export class SupabaseD4Repository implements ReferenceDataRepository {
  private user?: Promise<User>;

  /** `verifiedUser`: the user the caller already checked with auth.getUser() for this request. */
  constructor(private readonly client: SupabaseClient, verifiedUser?: User) {
    if (verifiedUser) this.user = Promise.resolve(verifiedUser);
  }

  // At most one auth.getUser() round trip per repository; a repository lives for one request.
  private requireUser(): Promise<User> {
    this.user ??= this.client.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) throw new ApiError("UNAUTHENTICATED", "Sesi login tidak ditemukan. Silakan login kembali.");
      return data.user;
    });
    return this.user;
  }

  async loadReferenceData(): Promise<ReferenceDataSnapshot> {
    await this.requireUser();
    const [departmentsResult, positionsResult, employeesResult, competenciesResult, requirementsResult, skillsResult] = await Promise.all([
      allRows(() => this.client.from("d3_departments").select("id,code,name").order("id")),
      allRows(() => this.client.from("d3_positions").select("id,code,title,department_id").order("id")),
      allRows(() => // "*" keeps this working before and after the view exposes employment_status (same approach as d4_kpi_assessments).
      this.client.from("d4_employee").select("*").order("id")),
      allRows(() => this.client.from("d3_competencies").select("id,code,name,category").order("id")),
      allRows(() => this.client.from("position_requirements").select("id,position_id,competency_id,min_proficiency_level,is_mandatory").order("id")),
      allRows(() => this.client.from("d4_employee_skills").select("id,employee_id,competency_id,proficiency_level,evidence_notes").order("id")),
    ]);
    const departments = take(departmentsResult, "Departments") as RawDepartment[];
    const positions = take(positionsResult, "Positions") as RawPosition[];
    const employees = take(employeesResult, "Employees") as RawEmployee[];
    const competencies = take(competenciesResult, "Competencies") as RawCompetency[];
    const requirements = take(requirementsResult, "Position requirements") as RawRequirement[];
    const skills = take(skillsResult, "Employee skills") as RawSkill[];
    return {
      source: "supabase",
      departments: departments.map((row) => ({ id: row.id, code: row.code, name: row.name })),
      positions: positions.map((row) => ({ id: row.id, code: row.code, title: row.title, departmentId: row.department_id })),
      employees: employees.map((row) => ({ id: row.id, employeeId: row.employee_id, fullName: row.full_name, positionId: row.position_id, departmentId: row.department_id, employmentStatus: row.employment_status ?? null })),
      competencies: competencies.map((row) => ({ id: row.id, code: row.code, name: row.name, category: row.category })),
      positionRequirements: requirements.map((row) => ({ id: row.id, positionId: row.position_id, competencyId: row.competency_id, minProficiencyLevel: row.min_proficiency_level, isMandatory: row.is_mandatory ?? true })),
      employeeSkills: skills.map((row) => ({ id: row.id, employeeId: row.employee_id, competencyId: row.competency_id, proficiencyLevel: row.proficiency_level, evidenceNotes: row.evidence_notes })),
    };
  }

  async loadSnapshot(): Promise<D4LiveSnapshot> {
    const user = await this.requireUser();
    // Access, reference data and records load in one parallel round instead of three sequential ones
    // (each round trip to the database counts). RLS already limits what the queries return, and access
    // is still checked before anything is returned.
    const [{ data: access, error: accessError }, reference, [kpiResult, kpiAssessmentResult, performanceResult, assessmentResult, developmentResult, developmentVersionResult, trainingResult, trainingVersionResult]] = await Promise.all([
      this.client.from("d4_user_access").select("app_role,employee_id").eq("auth_user_id", user.id).maybeSingle(),
      this.loadReferenceData(),
      Promise.all([
      allRows(() => this.client.from("employee_kpi").select("id,employee_id,period,kpi_score,notes,created_at").order("period", { ascending: false }).order("id")),
      // "*" keeps this working before and after the V5.1 migration adds definition_version.
      allRows(() => this.client.from("d4_kpi_assessments").select("*").order("created_at", { ascending: false }).order("id")),
      allRows(() => this.client.from("d4_performance_evaluations").select("id,employee_id,period,evaluation_date,evaluator_name_snapshot,status,review_status,overall_score,aspects,general_notes,evidence_reference,actor_employee_id,created_at").order("created_at", { ascending: false }).order("id")),
      // "*" for the competency and development history tables: works before and after migration 20261019120000.
      allRows(() => this.client.from("d4_competency_assessments").select("*").order("created_at", { ascending: false }).order("id")),
      allRows(() => this.client.from("d4_development_needs").select("*").order("id")),
      allRows(() => this.client.from("d4_development_need_versions").select("*").order("created_at", { ascending: false }).order("id")),
      allRows(() => this.client.from("d4_training_records").select("id,employee_id,development_need_id,activity,activity_date").order("id")),
      // "*": naming follow_up would fail the whole snapshot before migration 20261020130000.
      allRows(() => this.client.from("d4_training_versions").select("*").order("created_at", { ascending: false }).order("id")),
    ])]);
    if (accessError) throw databaseError(accessError, "Hak akses");
    if (!access) throw new ApiError("FORBIDDEN", "Anda sudah login, tetapi akun ini belum punya akses ke data HRMS. Hubungi admin HRMS untuk mengaktifkan role Anda.");
    const kpiRows = take(kpiResult, "KPI") as RawKpi[];
    const kpiAssessmentRows = take(kpiAssessmentResult, "Penilaian KPI") as RawKpiAssessment[];
    const performanceRows = take(performanceResult, "Performance") as RawPerformance[];
    const assessmentRows = take(assessmentResult, "Competency") as RawAssessment[];
    const developmentRows = take(developmentResult, "Development") as RawDevelopment[];
    const developmentVersionRows = take(developmentVersionResult, "Development history") as RawDevelopmentVersion[];
    const trainingRows = take(trainingResult, "Training") as RawTraining[];
    const trainingVersionRows = take(trainingVersionResult, "Training history") as RawTrainingVersion[];

    const kpiAssessments: KpiAssessment[] = kpiAssessmentRows.map((row) => ({
      id: row.id, definitionVersion: row.definition_version ?? "V3.1", employeeId: row.employee_id, roleOrder: row.role_order, roleName: row.role_name,
      period: row.period, evaluationDate: row.evaluation_date ?? "", evaluatorName: row.evaluator_name,
      status: row.status, lines: Array.isArray(row.lines) ? row.lines as KpiAssessmentLine[] : [],
      overallScore: row.overall_score === null ? null : Number(row.overall_score),
      generalNotes: row.general_notes, evidenceReference: row.evidence_reference ?? null, createdAt: row.created_at,
      actor: actorName(reference, row.actor_employee_id),
    }));
    // Legacy D3 employee_kpi rows (0–100). D4 scorecards live in kpiAssessments on the 1–5 scale;
    // they are not converted to another scale (FR-D4-002 defines no such conversion).
    const kpi: D3KpiRecord[] = kpiRows.map((row) => ({
      id: row.id, employeeId: row.employee_id, period: row.period,
      score: Number(row.kpi_score), notes: row.notes ?? "", createdAt: row.created_at,
    }));
    const performance: PerformanceEvaluation[] = performanceRows.map((row) => ({
      id: row.id, source: "supabase", employeeId: row.employee_id, period: row.period,
      evaluationDate: row.evaluation_date ?? "", evaluator: row.evaluator_name_snapshot,
      status: row.status, reviewStatus: row.review_status,
      overallScore: row.overall_score === null ? null : Number(row.overall_score),
      aspects: Array.isArray(row.aspects) ? row.aspects as EvaluationAspect[] : [],
      generalNotes: row.general_notes, evidenceReference: row.evidence_reference,
      createdAt: row.created_at, actor: actorName(reference, row.actor_employee_id),
    }));
    const competency: CompetencyAssessment[] = assessmentRows.map((row) => ({
      id: row.id, source: "supabase", employeeId: row.employee_id, positionId: row.position_id,
      effectiveDate: row.effective_date, context: row.context, overallStatus: row.overall_status,
      findings: Array.isArray(row.findings) ? row.findings as CompetencyFinding[] : [],
      createdAt: row.created_at, actor: actorName(reference, row.actor_employee_id), assessedWith: row.assessed_with ?? null,
    }));
    const developmentById = new Map(developmentRows.map((row) => [row.id, row]));
    // A revision stores only the priority/method/PIC it changed, so each value is carried forward in revision order.
    const resolvedBy = new Map<string, Pick<DevelopmentNeedVersion, "priority" | "method" | "pic">>();
    const developmentVersions: DevelopmentNeedVersion[] = [...developmentVersionRows].sort((a, b) => a.revision - b.revision).flatMap((version) => {
      const need = developmentById.get(version.development_need_id);
      if (!need) return [];
      const previous = resolvedBy.get(need.id) ?? { priority: need.priority, method: need.method ?? "", pic: need.pic ?? "" };
      const resolved = { priority: version.priority ?? previous.priority, method: version.method ?? previous.method, pic: version.pic ?? previous.pic };
      resolvedBy.set(need.id, resolved);
      return [{ id: version.id, needId: need.id, revision: version.revision, source: "supabase" as const,
        employeeId: need.employee_id, sourceType: need.source_type,
        sourceRef: need.position_requirement_id ?? need.competency_assessment_id ?? need.kpi_assessment_id ?? need.performance_evaluation_id ?? "",
        objective: need.objective, ...resolved, status: version.status, reassessment: version.reassessment ?? null, notes: version.notes,
        createdAt: version.created_at, actor: actorName(reference, version.actor_employee_id) }];
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const trainingById = new Map(trainingRows.map((row) => [row.id, row]));
    const trainingVersions: TrainingVersion[] = trainingVersionRows.flatMap((version) => {
      const trainingRecord = trainingById.get(version.training_id);
      if (!trainingRecord) return [];
      return [{ id: version.id, trainingId: trainingRecord.id, revision: version.revision, source: "supabase" as const,
        employeeId: trainingRecord.employee_id, developmentNeedId: trainingRecord.development_need_id,
        activity: trainingRecord.activity, date: trainingRecord.activity_date, status: version.status,
        result: version.result, notes: version.notes, followUp: version.follow_up ?? null, createdAt: version.created_at,
        actor: actorName(reference, version.actor_employee_id) }];
    });
    return { reference, role: access.app_role, actorEmployeeId: access.employee_id,
      kpi, kpiAssessments, performance, competency, developmentVersions, trainingVersions };
  }

  async saveKpiAssessment(input: KpiAssessmentInput): Promise<string> {
    await this.requireUser();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new ApiError("VALIDATION_FAILED", "Periode penilaian wajib diisi.");
    if (input.lines.length !== 5) throw new ApiError("VALIDATION_FAILED", "Penilaian harus memiliki lima indikator KPI.");
    const result = await this.client.from("d4_kpi_assessments").insert({
      // V3.1 rows predate the definition_version column; only send it for newer catalogs.
      ...(input.definitionVersion === "V3.1" ? {} : { definition_version: input.definitionVersion }),
      employee_id: input.employeeId, role_order: input.roleOrder, role_name: input.roleName,
      period: input.period, evaluation_date: input.evaluationDate || null,
      evaluator_name: input.evaluatorName.trim(), status: input.status,
      lines: input.lines, general_notes: input.generalNotes.trim(), evidence_reference: input.evidenceReference,
    }).select("id").single();
    return take(result, "Save KPI assessment").id;
  }

  async savePerformance(input: EvaluationInput, reference: ReferenceDataSnapshot): Promise<string> {
    await this.requireUser();
    const employee = reference.employees.find((item) => item.id === input.employeeId);
    if (!employee) throw new ApiError("NOT_FOUND", "Pegawai tidak ditemukan.");
    const position = reference.positions.find((item) => item.id === employee.positionId);
    if (!position) throw new ApiError("VALIDATION_FAILED", "Posisi pegawai tidak tersedia.");
    enforce(() => validatePerformanceInput(input));
    const result = await this.client.from("d4_performance_evaluations").insert({
      employee_id: employee.id, position_id: position.id, position_title_snapshot: position.title,
      period: input.period, evaluation_date: input.evaluationDate || null,
      evaluator_name_snapshot: input.evaluator.trim(), status: input.status,
      review_status: input.reviewStatus, overall_score: input.overallScore,
      aspects: input.aspects, general_notes: input.generalNotes.trim(),
      evidence_reference: input.evidenceReference?.trim() || null,
    }).select("id").single();
    return take(result, "Save evaluation").id;
  }

  async saveCompetency(input: { employeeId: string; positionId: string; effectiveDate: string; assessedWith?: string }, reference: ReferenceDataSnapshot): Promise<string> {
    await this.requireUser();
    const employee = reference.employees.find((item) => item.id === input.employeeId);
    const position = reference.positions.find((item) => item.id === input.positionId);
    if (!employee) throw new ApiError("NOT_FOUND", "Pegawai tidak ditemukan.");
    if (!position) throw new ApiError("VALIDATION_FAILED", "Posisi tidak tersedia.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) throw new ApiError("VALIDATION_FAILED", "Tanggal efektif tidak valid.");
    const comparison = compareCompetencies(employee.id, position.id, reference);
    if (!comparison.findings.length) throw new ApiError("VALIDATION_FAILED", "Posisi ini belum memiliki persyaratan kompetensi.");
    // d4_competency_assessments has no unique key yet. A double click re-sends an identical snapshot: answer
    // with the stored one instead of a second row. A changed snapshot (new evidence the same day) is still saved.
    // Narrows, not closes, the race until the database index is approved.
    const assessedWith = input.assessedWith?.trim() ?? "";
    // "*": assessed_with exists only after migration 20261019120000. A different co-assessor is a new snapshot;
    // an empty one changes nothing, as on the competency page.
    const sameDay = take(await this.client.from("d4_competency_assessments").select("*")
      .eq("employee_id", employee.id).eq("position_id", position.id).eq("effective_date", input.effectiveDate), "Cek assessment") as { id: string; overall_status: string; findings: unknown; assessed_with?: string | null }[];
    const identical = sameDay.find((row) => row.overall_status === comparison.overallStatus && JSON.stringify(row.findings) === JSON.stringify(comparison.findings) && (!assessedWith || (row.assessed_with ?? "") === assessedWith));
    if (identical) return identical.id;
    const result = await this.client.from("d4_competency_assessments").insert({
      employee_id: employee.id, position_id: position.id, position_title_snapshot: position.title,
      effective_date: input.effectiveDate,
      context: employee.positionId === position.id ? "current-position" : "role-change",
      overall_status: comparison.overallStatus, findings: comparison.findings,
      // Sent only when filled, so a save without it keeps working before the migration is applied.
      ...(assessedWith ? { assessed_with: assessedWith } : {}),
    }).select("id").single();
    return take(result, "Save assessment").id;
  }

  async createDevelopment(input: { employeeId: string; sourceType: DevelopmentSourceType; sourceRef: string; objective: string; priority: DevelopmentPriority; notes: string; method?: string; pic?: string }, snapshot: D4LiveSnapshot): Promise<string> {
    await this.requireUser();
    if (!snapshot.reference.employees.some((item) => item.id === input.employeeId)) throw new ApiError("NOT_FOUND", "Pegawai tidak ditemukan.");
    if (!input.objective.trim()) throw new ApiError("VALIDATION_FAILED", "Development objective wajib diisi.");
    const validSource = input.sourceType === "competency_gap"
      ? (() => { const employee = snapshot.reference.employees.find((item) => item.id === input.employeeId);
          return employee?.positionId ? compareCompetencies(employee.id, employee.positionId, snapshot.reference).findings.some((item) => item.requirementId === input.sourceRef && item.status === "Gap") : false; })()
      : input.sourceType === "role_change"
        ? snapshot.competency.some((item) => item.id === input.sourceRef && item.employeeId === input.employeeId && item.context === "role-change")
        // Performance context = a saved Penilaian Kinerja; older evaluations are history only.
        : (snapshot.kpiAssessments ?? []).some((item) => item.id === input.sourceRef && item.employeeId === input.employeeId && item.status === "completed");
    if (!validSource) throw new ApiError("VALIDATION_FAILED", "Referensi sumber tidak cocok dengan pegawai atau belum tersedia.");
    const result = await this.client.rpc("d4_create_development_need", {
      p_employee_id: input.employeeId, p_source_type: input.sourceType, p_source_ref: input.sourceRef,
      p_objective: input.objective.trim(), p_priority: input.priority, p_notes: input.notes.trim(),
      p_method: input.method?.trim() || null, p_pic: input.pic?.trim() || null,
    });
    return take(result, "Save development need") as string;
  }

  /**
   * `next` is the checked revision, `current` the latest one it follows. Only changed priority/method/PIC and a
   * recorded reassessment are sent: a status-only update writes the same columns as before migration 20261019120000.
   */
  async updateDevelopment(needId: string, next: DevelopmentRevision, current: Pick<DevelopmentNeedVersion, "priority" | "method" | "pic">): Promise<void> {
    await this.requireUser();
    const latest = take(await this.client.from("d4_development_need_versions").select("revision")
      .eq("development_need_id", needId).order("revision", { ascending: false }).limit(1).single(), "Development history") as { revision: number };
    take(await this.client.from("d4_development_need_versions").insert({
      development_need_id: needId, revision: latest.revision + 1, status: next.status, notes: next.notes.trim(),
      ...(next.priority !== current.priority ? { priority: next.priority } : {}),
      ...(next.method !== (current.method ?? "") ? { method: next.method } : {}),
      ...(next.pic !== (current.pic ?? "") ? { pic: next.pic } : {}),
      ...(next.reassessment ? { reassessment: next.reassessment } : {}),
    }).select("id").single(), "Save development revision");
  }

  async createTraining(input: { employeeId: string; developmentNeedId: string; activity: string; date: string; status: TrainingStatus; result: string; notes: string }, snapshot: D4LiveSnapshot): Promise<string> {
    await this.requireUser();
    const need = snapshot.developmentVersions.find((item) => item.needId === input.developmentNeedId);
    if (!need || need.employeeId !== input.employeeId) throw new ApiError("VALIDATION_FAILED", "Training harus merujuk ke development requirement milik pegawai yang sama.");
    if (!input.activity.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError("VALIDATION_FAILED", "Aktivitas dan tanggal wajib diisi.");
    if (input.status === "Completed" && !input.result.trim()) throw new ApiError("VALIDATION_FAILED", "Result wajib diisi saat training Completed.");
    const result = await this.client.rpc("d4_create_training_record", {
      p_employee_id: input.employeeId, p_development_need_id: input.developmentNeedId,
      p_activity: input.activity.trim(), p_activity_date: input.date, p_status: input.status,
      p_result: input.result.trim(), p_notes: input.notes.trim(),
    });
    return take(result, "Save training") as string;
  }

  async updateTraining(trainingId: string, status: TrainingStatus, result: string, notes: string): Promise<void> {
    await this.requireUser();
    if (status === "Completed" && !result.trim()) throw new ApiError("VALIDATION_FAILED", "Result wajib diisi saat training Completed.");
    const current = take(await this.client.from("d4_training_versions").select("revision")
      .eq("training_id", trainingId).order("revision", { ascending: false }).limit(1).single(), "Training history") as { revision: number };
    take(await this.client.from("d4_training_versions").insert({
      training_id: trainingId, revision: current.revision + 1,
      status, result: result.trim(), notes: notes.trim(),
    }).select("id").single(), "Save training revision");
  }

  /**
   * Q16: the follow-up is a new version of the Not Passed training, inserted first so that nothing is written before
   * migration 20261020130000 (the column is missing: PGRST204 / 42703). Retraining then creates the next training for
   * the same requirement through the existing RPC; returns its id.
   */
  async recordTrainingFollowUp(trainingId: string, input: TrainingFollowUpInput, snapshot: D4LiveSnapshot): Promise<string | null> {
    await this.requireUser();
    const current = take(await this.client.from("d4_training_versions").select("revision")
      .eq("training_id", trainingId).order("revision", { ascending: false }).limit(1).single(), "Training history") as { revision: number };
    const saved = await this.client.from("d4_training_versions").insert({
      training_id: trainingId, revision: current.revision + 1, status: "Completed", result: "Not Passed", notes: input.notes.trim(), follow_up: input.followUp,
    }).select("id").single();
    if (saved.error?.code === "PGRST204" || saved.error?.code === "42703") throw new ApiError("CONFIGURATION_ERROR", FOLLOW_UP_NOT_READY);
    take(saved, "Save training follow-up");
    if (input.followUp !== "Retraining") return null;
    const previous = snapshot.trainingVersions.find((item) => item.trainingId === trainingId);
    if (!previous) throw new ApiError("NOT_FOUND", "Training tidak ditemukan.");
    // ponytail: two writes, not one transaction. If this one fails the follow-up stays recorded and HR adds the
    // training from the requirement (Add Training); an RPC doing both is the upgrade if that ever happens.
    return this.createTraining({ employeeId: previous.employeeId, developmentNeedId: previous.developmentNeedId, activity: input.activity ?? "",
      date: input.date ?? "", status: "Planned", result: "", notes: retrainingNotes(previous, input.notes) }, snapshot);
  }
}
