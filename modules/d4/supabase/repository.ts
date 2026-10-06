import type { SupabaseClient, User } from "@supabase/supabase-js";
import { compareCompetencies } from "../competency/service";
import type { CompetencyAssessment, CompetencyFinding, CompetencyOverallStatus } from "../competency/types";
import type { DevelopmentNeedVersion, DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../development/types";
import type { EvaluationAspect, EvaluationInput, PerformanceEvaluation } from "../performance/types";
import { validatePerformanceInput } from "../performance/validation";
import { ApiError, databaseError, enforce } from "../shared/errors";
import type { ReferenceDataRepository } from "../shared/services";
import type { ReferenceDataSnapshot } from "../shared/types";
import type { TrainingStatus, TrainingVersion } from "../training/types";
import type { D3KpiRecord, D4LiveSnapshot, KpiAssessment, KpiAssessmentInput, KpiAssessmentLine } from "./types";

type QueryResult<T> = { data: T | null; error: { message: string; code?: string } | null };
function take<T>(result: QueryResult<T>, label: string): T {
  if (result.error) throw databaseError(result.error, label);
  if (result.data === null) throw new Error(`${label}: respons kosong.`);
  return result.data;
}

interface RawDepartment { id: string; code: string; name: string }
interface RawPosition { id: string; code: string; title: string; department_id: string | null }
interface RawEmployee { id: string; employee_id: string; full_name: string; position_id: string | null; department_id: string | null }
interface RawCompetency { id: string; code: string; name: string; category: string | null }
interface RawRequirement { id: string; position_id: string; competency_id: string; min_proficiency_level: number; is_mandatory: boolean | null }
interface RawSkill { id: string; employee_id: string; competency_id: string; proficiency_level: number; evidence_notes: string | null }
interface RawKpi { id: string; employee_id: string; period: string; kpi_score: number; notes: string | null; created_at: string }
interface RawKpiAssessment { id: string; definition_version?: string; employee_id: string; role_order: number; role_name: string; period: string; evaluation_date: string | null; evaluator_name: string; status: "draft" | "completed"; lines: unknown; overall_score: number | null; general_notes: string; actor_employee_id: string; created_at: string }
interface RawPerformance { id: string; employee_id: string; period: string; evaluation_date: string | null; evaluator_name_snapshot: string; status: "draft" | "completed"; review_status: PerformanceEvaluation["reviewStatus"]; overall_score: number | null; aspects: unknown; general_notes: string; evidence_reference: string | null; actor_employee_id: string; created_at: string }
interface RawAssessment { id: string; employee_id: string; position_id: string; effective_date: string; context: CompetencyAssessment["context"]; overall_status: CompetencyOverallStatus; findings: unknown; actor_employee_id: string; created_at: string }
interface RawDevelopment { id: string; employee_id: string; source_type: DevelopmentSourceType; position_requirement_id: string | null; competency_assessment_id: string | null; performance_evaluation_id: string | null; objective: string; priority: DevelopmentPriority }
interface RawDevelopmentVersion { id: string; development_need_id: string; revision: number; status: DevelopmentStatus; notes: string; actor_employee_id: string; created_at: string }
interface RawTraining { id: string; employee_id: string; development_need_id: string; activity: string; activity_date: string }
interface RawTrainingVersion { id: string; training_id: string; revision: number; status: TrainingStatus; result: string; notes: string; actor_employee_id: string; created_at: string }

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
      if (error || !data.user) throw new ApiError("UNAUTHENTICATED", "Sesi login tidak tersedia. Silakan masuk kembali.");
      return data.user;
    });
    return this.user;
  }

  async loadReferenceData(): Promise<ReferenceDataSnapshot> {
    await this.requireUser();
    const [departmentsResult, positionsResult, employeesResult, competenciesResult, requirementsResult, skillsResult] = await Promise.all([
      this.client.from("d3_departments").select("id,code,name"),
      this.client.from("d3_positions").select("id,code,title,department_id"),
      this.client.from("d3_employee").select("id,employee_id,full_name,position_id,department_id"),
      this.client.from("d3_competencies").select("id,code,name,category"),
      this.client.from("position_requirements").select("id,position_id,competency_id,min_proficiency_level,is_mandatory"),
      this.client.from("d3_employee_skills").select("id,employee_id,competency_id,proficiency_level,evidence_notes"),
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
      employees: employees.map((row) => ({ id: row.id, employeeId: row.employee_id, fullName: row.full_name, positionId: row.position_id, departmentId: row.department_id })),
      competencies: competencies.map((row) => ({ id: row.id, code: row.code, name: row.name, category: row.category })),
      positionRequirements: requirements.map((row) => ({ id: row.id, positionId: row.position_id, competencyId: row.competency_id, minProficiencyLevel: row.min_proficiency_level, isMandatory: row.is_mandatory ?? true })),
      employeeSkills: skills.map((row) => ({ id: row.id, employeeId: row.employee_id, competencyId: row.competency_id, proficiencyLevel: row.proficiency_level, evidenceNotes: row.evidence_notes })),
    };
  }

  async loadSnapshot(): Promise<D4LiveSnapshot> {
    const user = await this.requireUser();
    const { data: access, error: accessError } = await this.client.from("d3_user_access")
      .select("app_role,employee_id").eq("auth_user_id", user.id).maybeSingle();
    if (accessError) throw databaseError(accessError, "Hak akses");
    if (!access) throw new ApiError("FORBIDDEN", "Akun sudah masuk, tetapi belum diberi akses data HRMS. Hubungi admin HRMS untuk mengaktifkan peran Anda.");
    const reference = await this.loadReferenceData();
    const [kpiResult, kpiAssessmentResult, performanceResult, assessmentResult, developmentResult, developmentVersionResult, trainingResult, trainingVersionResult] = await Promise.all([
      this.client.from("employee_kpi").select("id,employee_id,period,kpi_score,notes,created_at").order("period", { ascending: false }),
      // "*" keeps this working before and after the V5.1 migration adds definition_version.
      this.client.from("d4_kpi_assessments").select("*").order("created_at", { ascending: false }),
      this.client.from("d4_performance_evaluations").select("id,employee_id,period,evaluation_date,evaluator_name_snapshot,status,review_status,overall_score,aspects,general_notes,evidence_reference,actor_employee_id,created_at").order("created_at", { ascending: false }),
      this.client.from("d4_competency_assessments").select("id,employee_id,position_id,effective_date,context,overall_status,findings,actor_employee_id,created_at").order("created_at", { ascending: false }),
      this.client.from("d4_development_needs").select("id,employee_id,source_type,position_requirement_id,competency_assessment_id,performance_evaluation_id,objective,priority"),
      this.client.from("d4_development_need_versions").select("id,development_need_id,revision,status,notes,actor_employee_id,created_at").order("created_at", { ascending: false }),
      this.client.from("d4_training_records").select("id,employee_id,development_need_id,activity,activity_date"),
      this.client.from("d4_training_versions").select("id,training_id,revision,status,result,notes,actor_employee_id,created_at").order("created_at", { ascending: false }),
    ]);
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
      generalNotes: row.general_notes, createdAt: row.created_at,
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
      createdAt: row.created_at, actor: actorName(reference, row.actor_employee_id),
    }));
    const developmentById = new Map(developmentRows.map((row) => [row.id, row]));
    const developmentVersions: DevelopmentNeedVersion[] = developmentVersionRows.flatMap((version) => {
      const need = developmentById.get(version.development_need_id);
      if (!need) return [];
      return [{ id: version.id, needId: need.id, revision: version.revision, source: "supabase" as const,
        employeeId: need.employee_id, sourceType: need.source_type,
        sourceRef: need.position_requirement_id ?? need.competency_assessment_id ?? need.performance_evaluation_id ?? "",
        objective: need.objective, priority: need.priority, status: version.status, notes: version.notes,
        createdAt: version.created_at, actor: actorName(reference, version.actor_employee_id) }];
    });
    const trainingById = new Map(trainingRows.map((row) => [row.id, row]));
    const trainingVersions: TrainingVersion[] = trainingVersionRows.flatMap((version) => {
      const trainingRecord = trainingById.get(version.training_id);
      if (!trainingRecord) return [];
      return [{ id: version.id, trainingId: trainingRecord.id, revision: version.revision, source: "supabase" as const,
        employeeId: trainingRecord.employee_id, developmentNeedId: trainingRecord.development_need_id,
        activity: trainingRecord.activity, date: trainingRecord.activity_date, status: version.status,
        result: version.result, notes: version.notes, createdAt: version.created_at,
        actor: actorName(reference, version.actor_employee_id) }];
    });
    return { reference, role: access.app_role, actorEmployeeId: access.employee_id,
      kpi, kpiAssessments, performance, competency, developmentVersions, trainingVersions };
  }

  async saveKpiAssessment(input: KpiAssessmentInput): Promise<string> {
    await this.requireUser();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new ApiError("VALIDATION_FAILED", "Periode penilaian wajib dipilih.");
    if (input.lines.length !== 5) throw new ApiError("VALIDATION_FAILED", "Penilaian harus memiliki lima indikator KPI.");
    const result = await this.client.from("d4_kpi_assessments").insert({
      // V3.1 rows predate the definition_version column; only send it for newer catalogs.
      ...(input.definitionVersion === "V3.1" ? {} : { definition_version: input.definitionVersion }),
      employee_id: input.employeeId, role_order: input.roleOrder, role_name: input.roleName,
      period: input.period, evaluation_date: input.evaluationDate || null,
      evaluator_name: input.evaluatorName.trim(), status: input.status,
      lines: input.lines, general_notes: input.generalNotes.trim(),
    }).select("id").single();
    return take(result, "Simpan penilaian KPI").id;
  }

  async savePerformance(input: EvaluationInput, reference: ReferenceDataSnapshot): Promise<string> {
    await this.requireUser();
    const employee = reference.employees.find((item) => item.id === input.employeeId);
    if (!employee) throw new ApiError("NOT_FOUND", "Employee tidak ditemukan.");
    const position = reference.positions.find((item) => item.id === employee.positionId);
    if (!position) throw new ApiError("VALIDATION_FAILED", "Posisi employee tidak tersedia.");
    enforce(() => validatePerformanceInput(input));
    const result = await this.client.from("d4_performance_evaluations").insert({
      employee_id: employee.id, position_id: position.id, position_title_snapshot: position.title,
      period: input.period, evaluation_date: input.evaluationDate || null,
      evaluator_name_snapshot: input.evaluator.trim(), status: input.status,
      review_status: input.reviewStatus, overall_score: input.overallScore,
      aspects: input.aspects, general_notes: input.generalNotes.trim(),
      evidence_reference: input.evidenceReference?.trim() || null,
    }).select("id").single();
    return take(result, "Simpan evaluasi").id;
  }

  async saveCompetency(input: { employeeId: string; positionId: string; effectiveDate: string }, reference: ReferenceDataSnapshot): Promise<string> {
    await this.requireUser();
    const employee = reference.employees.find((item) => item.id === input.employeeId);
    const position = reference.positions.find((item) => item.id === input.positionId);
    if (!employee) throw new ApiError("NOT_FOUND", "Employee tidak ditemukan.");
    if (!position) throw new ApiError("VALIDATION_FAILED", "Posisi tidak tersedia.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) throw new ApiError("VALIDATION_FAILED", "Tanggal berlaku tidak valid.");
    const comparison = compareCompetencies(employee.id, position.id, reference);
    if (!comparison.findings.length) throw new ApiError("VALIDATION_FAILED", "Persyaratan kompetensi posisi belum tersedia.");
    // d4_competency_assessments has no unique key yet. A double click re-sends an identical snapshot: answer
    // with the stored one instead of a second row. A changed snapshot (new evidence the same day) is still saved.
    // Narrows, not closes, the race until the database index is approved.
    const sameDay = take(await this.client.from("d4_competency_assessments").select("id, overall_status, findings")
      .eq("employee_id", employee.id).eq("position_id", position.id).eq("effective_date", input.effectiveDate), "Cek assessment") as { id: string; overall_status: string; findings: unknown }[];
    const identical = sameDay.find((row) => row.overall_status === comparison.overallStatus && JSON.stringify(row.findings) === JSON.stringify(comparison.findings));
    if (identical) return identical.id;
    const result = await this.client.from("d4_competency_assessments").insert({
      employee_id: employee.id, position_id: position.id, position_title_snapshot: position.title,
      effective_date: input.effectiveDate,
      context: employee.positionId === position.id ? "current-position" : "role-change",
      overall_status: comparison.overallStatus, findings: comparison.findings,
    }).select("id").single();
    return take(result, "Simpan assessment").id;
  }

  async createDevelopment(input: { employeeId: string; sourceType: DevelopmentSourceType; sourceRef: string; objective: string; priority: DevelopmentPriority; notes: string }, snapshot: D4LiveSnapshot): Promise<string> {
    await this.requireUser();
    if (!snapshot.reference.employees.some((item) => item.id === input.employeeId)) throw new ApiError("NOT_FOUND", "Employee tidak ditemukan.");
    if (!input.objective.trim()) throw new ApiError("VALIDATION_FAILED", "Development objective wajib diisi.");
    const validSource = input.sourceType === "competency_gap"
      ? (() => { const employee = snapshot.reference.employees.find((item) => item.id === input.employeeId);
          return employee?.positionId ? compareCompetencies(employee.id, employee.positionId, snapshot.reference).findings.some((item) => item.requirementId === input.sourceRef && item.status === "Gap") : false; })()
      : input.sourceType === "role_change"
        ? snapshot.competency.some((item) => item.id === input.sourceRef && item.employeeId === input.employeeId && item.context === "role-change")
        : snapshot.performance.some((item) => item.id === input.sourceRef && item.employeeId === input.employeeId && item.status === "completed");
    if (!validSource) throw new ApiError("VALIDATION_FAILED", "Referensi sumber tidak sesuai employee atau belum tersedia.");
    const result = await this.client.rpc("d4_create_development_need", {
      p_employee_id: input.employeeId, p_source_type: input.sourceType, p_source_ref: input.sourceRef,
      p_objective: input.objective.trim(), p_priority: input.priority, p_notes: input.notes.trim(),
    });
    return take(result, "Simpan development need") as string;
  }

  async updateDevelopment(needId: string, status: DevelopmentStatus, notes: string): Promise<void> {
    await this.requireUser();
    const current = take(await this.client.from("d4_development_need_versions").select("revision")
      .eq("development_need_id", needId).order("revision", { ascending: false }).limit(1).single(), "Riwayat development") as { revision: number };
    take(await this.client.from("d4_development_need_versions").insert({
      development_need_id: needId, revision: current.revision + 1, status, notes: notes.trim(),
    }).select("id").single(), "Simpan revisi development");
  }

  async createTraining(input: { employeeId: string; developmentNeedId: string; activity: string; date: string; status: TrainingStatus; result: string; notes: string }, snapshot: D4LiveSnapshot): Promise<string> {
    await this.requireUser();
    const need = snapshot.developmentVersions.find((item) => item.needId === input.developmentNeedId);
    if (!need || need.employeeId !== input.employeeId) throw new ApiError("VALIDATION_FAILED", "Training harus mengacu pada development need milik employee yang sama.");
    if (!input.activity.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError("VALIDATION_FAILED", "Aktivitas dan tanggal wajib diisi.");
    if (input.status === "Completed" && !input.result.trim()) throw new ApiError("VALIDATION_FAILED", "Hasil wajib diisi saat training selesai.");
    const result = await this.client.rpc("d4_create_training_record", {
      p_employee_id: input.employeeId, p_development_need_id: input.developmentNeedId,
      p_activity: input.activity.trim(), p_activity_date: input.date, p_status: input.status,
      p_result: input.result.trim(), p_notes: input.notes.trim(),
    });
    return take(result, "Simpan training") as string;
  }

  async updateTraining(trainingId: string, status: TrainingStatus, result: string, notes: string): Promise<void> {
    await this.requireUser();
    if (status === "Completed" && !result.trim()) throw new ApiError("VALIDATION_FAILED", "Hasil wajib diisi saat training selesai.");
    const current = take(await this.client.from("d4_training_versions").select("revision")
      .eq("training_id", trainingId).order("revision", { ascending: false }).limit(1).single(), "Riwayat training") as { revision: number };
    take(await this.client.from("d4_training_versions").insert({
      training_id: trainingId, revision: current.revision + 1,
      status, result: result.trim(), notes: notes.trim(),
    }).select("id").single(), "Simpan revisi training");
  }
}
