import { scaleMaxOf } from "../../kpi/scale";
import { compareCompetencies } from "../../competency/service";
import type { CompetencyAssessment, CompetencyFinding, CompetencyOverallStatus } from "../../competency/types";
import type { DevelopmentNeedVersion, DevelopmentSourceType } from "../../development/types";
import type { PerformanceEvaluation } from "../../performance/types";
import type { EmployeeReference } from "../../shared/types";
import { isTeamMember, localMonth, localToday, reassessmentOf, revisionNumber } from "../../shared/rules";
import { latestDevelopment, latestTraining, type D4LiveSnapshot, type KpiAssessment } from "../../supabase/types";
import type { TrainingVersion } from "../../training/types";

export type Snapshot = D4LiveSnapshot;

export const canWrite = (snapshot: Snapshot) => snapshot.role === "HR" || snapshot.role === "MANAGER";

/**
 * Employees see only their own records; managers only their team (same department, never themselves);
 * HR sees everyone RLS allows.
 */
export function visibleEmployees(snapshot: Snapshot): readonly EmployeeReference[] {
  const { employees } = snapshot.reference;
  if (snapshot.role === "EMPLOYEE") return employees.filter((item) => item.id === snapshot.actorEmployeeId);
  if (snapshot.role === "MANAGER") {
    const actor = employees.find((item) => item.id === snapshot.actorEmployeeId);
    return employees.filter((item) => isTeamMember(actor, item));
  }
  return employees;
}

/**
 * HR/manager preview of what one employee sees: the same snapshot narrowed to that employee's records with
 * role EMPLOYEE. Display only; the provider blocks writes while it is active, and the server still sees HR.
 */
export function asEmployee(snapshot: Snapshot, employeeId: string): Snapshot {
  const own = <T extends { employeeId: string }>(items: readonly T[]) => items.filter((item) => item.employeeId === employeeId);
  return {
    ...snapshot, role: "EMPLOYEE", actorEmployeeId: employeeId,
    kpi: own(snapshot.kpi), kpiAssessments: snapshot.kpiAssessments && own(snapshot.kpiAssessments), performance: own(snapshot.performance),
    competency: own(snapshot.competency), developmentVersions: own(snapshot.developmentVersions), trainingVersions: own(snapshot.trainingVersions),
  };
}

/** Employees the signed-in evaluator may assess or raise development/training for: never themselves. */
export const canAssess = (snapshot: Snapshot, employeeId: string) => canWrite(snapshot) && employeeId !== snapshot.actorEmployeeId;
export const assessableEmployees = (snapshot: Snapshot) => visibleEmployees(snapshot).filter((item) => item.id !== snapshot.actorEmployeeId);

/** Position filter options limited to positions held by employees this role can see. */
export function positionOptions(snapshot: Snapshot) {
  const held = new Set(visibleEmployees(snapshot).map((item) => item.positionId));
  return snapshot.reference.positions.filter((item) => held.has(item.id)).map((item) => ({ value: item.id, label: item.title }));
}
const newestFirst = <T extends { createdAt: string }>(items: readonly T[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const byPeriod = <T extends { createdAt: string; period: string }>(items: readonly T[]) => newestFirst(items).sort((a, b) => b.period.localeCompare(a.period));
function groupBy<T>(items: readonly T[], key: (item: T) => string, order: (items: T[]) => T[] = (list) => list) {
  const groups = new Map<string, T[]>();
  for (const item of items) { const k = key(item); const list = groups.get(k); if (list) list.push(item); else groups.set(k, [item]); }
  for (const [k, list] of groups) groups.set(k, order(list));
  return groups;
}

/**
 * Lookups built once per snapshot (load test: 1000+ records per table). Without them every table row
 * re-scanned and re-sorted whole arrays, so list pages were O(n²) and typing in a search box took
 * over a second. A snapshot is never mutated (each change creates a new one), so a WeakMap keyed by
 * it is invalidated automatically.
 */
type SnapshotIndex = {
  employees: Map<string, EmployeeReference>;
  positions: Map<string, Snapshot["reference"]["positions"][number]>;
  departments: Map<string, Snapshot["reference"]["departments"][number]>;
  evaluations: Map<string, PerformanceEvaluation[]>;
  scorecards: Map<string, KpiAssessment[]>;
  assessments: Map<string, CompetencyAssessment[]>;
  needs: DevelopmentNeedVersion[];
  trainings: TrainingVersion[];
  needsByEmployee: Map<string, DevelopmentNeedVersion[]>;
  needHistory: Map<string, DevelopmentNeedVersion[]>;
  trainingsByEmployee: Map<string, TrainingVersion[]>;
  gaps: Map<string, ReturnType<typeof compareCompetencies> | null>;
};
const indexes = new WeakMap<Snapshot, SnapshotIndex>();
function indexOf(snapshot: Snapshot): SnapshotIndex {
  let index = indexes.get(snapshot);
  if (!index) {
    const { reference } = snapshot;
    index = {
      employees: new Map(reference.employees.map((item) => [item.id, item])),
      positions: new Map(reference.positions.map((item) => [item.id, item])),
      departments: new Map(reference.departments.map((item) => [item.id, item])),
      evaluations: groupBy(snapshot.performance, (item) => item.employeeId, byPeriod),
      scorecards: groupBy(snapshot.kpiAssessments ?? [], (item) => item.employeeId, byPeriod),
      assessments: groupBy(snapshot.competency, (item) => `${item.employeeId}|${item.positionId}`, newestFirst),
      needs: latestDevelopment(snapshot),
      trainings: latestTraining(snapshot),
      needsByEmployee: new Map(),
      needHistory: groupBy(snapshot.developmentVersions, (item) => item.needId, (list) => list.sort((a, b) => b.revision - a.revision)),
      trainingsByEmployee: new Map(),
      gaps: new Map(),
    };
    index.needsByEmployee = groupBy(index.needs, (item) => item.employeeId);
    index.trainingsByEmployee = groupBy(index.trainings, (item) => item.employeeId);
    indexes.set(snapshot, index);
  }
  return index;
}

export const employeeById = (snapshot: Snapshot, id: string) => indexOf(snapshot).employees.get(id);
export const positionOf = (snapshot: Snapshot, employee?: EmployeeReference) => employee?.positionId ? indexOf(snapshot).positions.get(employee.positionId) : undefined;
export const positionById = (snapshot: Snapshot, id?: string | null) => id ? indexOf(snapshot).positions.get(id) : undefined;
export const departmentOf = (snapshot: Snapshot, employee?: EmployeeReference) => employee?.departmentId ? indexOf(snapshot).departments.get(employee.departmentId) : undefined;
/** Header line shared by every detail/history page: position · employee ID · department. */
export const employeeMeta = (snapshot: Snapshot, employee: EmployeeReference) => [positionOf(snapshot, employee)?.title ?? "No position yet", employee.employeeId, departmentOf(snapshot, employee)?.name ?? ""];

// Copies, so a caller sorting the result never reorders the shared index.
export function evaluationsOf(snapshot: Snapshot, employeeId: string): PerformanceEvaluation[] {
  return [...(indexOf(snapshot).evaluations.get(employeeId) ?? [])];
}
export const latestEvaluation = (snapshot: Snapshot, employeeId: string) => evaluationsOf(snapshot, employeeId)[0];

export function scorecardsOf(snapshot: Snapshot, employeeId: string): KpiAssessment[] {
  return [...(indexOf(snapshot).scorecards.get(employeeId) ?? [])];
}
/** " · Revision n" for the second and later record of the same period; empty for the first. */
export function revisionTag<T extends { id: string; employeeId: string; period: string; createdAt: string }>(records: readonly T[], record: T) {
  const n = revisionNumber(records, record);
  return n > 1 ? ` · Revision ${n}` : "";
}

export const latestScorecard = (snapshot: Snapshot, employeeId: string) => scorecardsOf(snapshot, employeeId)[0];

/** Live comparison of the employee's current position requirements against recorded evidence. */
export function currentGap(snapshot: Snapshot, employee: EmployeeReference): { findings: CompetencyFinding[]; overallStatus: CompetencyOverallStatus } | null {
  if (!employee.positionId || !positionById(snapshot, employee.positionId)) return null;
  const { gaps } = indexOf(snapshot);
  if (!gaps.has(employee.id)) gaps.set(employee.id, compareCompetencies(employee.id, employee.positionId, snapshot.reference));
  return gaps.get(employee.id) ?? null;
}

/** Latest saved assessment for the active position, including a position-change snapshot after reassignment. */
export function latestCurrentPositionAssessment(snapshot: Snapshot, employee: EmployeeReference): CompetencyAssessment | undefined {
  if (!positionOf(snapshot, employee)) return undefined;
  return indexOf(snapshot).assessments.get(`${employee.id}|${employee.positionId}`)?.[0];
}

export type CurrentCompetencyStatus = CompetencyOverallStatus | "Not Evaluated";

/** Display readiness separately from evidence quality; saved assessments keep the live comparison status. */
export function currentCompetencyStatus(snapshot: Snapshot, employee: EmployeeReference): CurrentCompetencyStatus {
  if (!latestCurrentPositionAssessment(snapshot, employee)) return "Not Evaluated";
  return currentGap(snapshot, employee)?.overallStatus ?? "Not Evaluated";
}

// Shared arrays from the index: callers only filter/find them.
export const developmentNeeds = (snapshot: Snapshot): readonly DevelopmentNeedVersion[] => indexOf(snapshot).needs;
export const trainings = (snapshot: Snapshot): readonly TrainingVersion[] => indexOf(snapshot).trainings;
/** Latest revision of each need / training of one employee, newest first. */
export const needsOf = (snapshot: Snapshot, employeeId: string): readonly DevelopmentNeedVersion[] => indexOf(snapshot).needsByEmployee.get(employeeId) ?? [];
/** Employment statuses HR sets for people still in training (interview D4: "yang menentukan HR"). */
const TRAINEE_STATUSES = ["PROBATION", "INTERN"];
/**
 * After a promotion or position change the competency stays in scope this long. Trainees need no month count
 * (HR flips the status), and probation is capped at 3 months by Indonesian labour law; a new role takes longer to
 * close a gap, so a position change gets 6 months.
 */
export const POSITION_CHANGE_SCOPE_MONTHS = 6;

const addMonths = (isoDate: string, months: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};

/**
 * Competency is assessed for trainees (probation or intern status), for promoted employees (a saved position
 * change assessment in the last POSITION_CHANGE_SCOPE_MONTHS) and while a requirement is still open
 * (interview D4, 14 Oct 2026).
 */
export const inTrainingOrPositionChange = (snapshot: Snapshot, employeeId: string, on: string = today()) => {
  const status = employeeById(snapshot, employeeId)?.employmentStatus?.toUpperCase();
  return Boolean(status && TRAINEE_STATUSES.includes(status))
    || developmentNeeds(snapshot).some((item) => item.employeeId === employeeId && item.status !== "Completed")
    || snapshot.competency.some((item) => item.employeeId === employeeId && item.context === "role-change" && addMonths(item.effectiveDate, POSITION_CHANGE_SCOPE_MONTHS) >= on);
};

export const trainingsOf = (snapshot: Snapshot, employeeId: string): readonly TrainingVersion[] => indexOf(snapshot).trainingsByEmployee.get(employeeId) ?? [];
export const developmentById = (snapshot: Snapshot, needId: string) => developmentNeeds(snapshot).find((item) => item.needId === needId);
export const trainingById = (snapshot: Snapshot, trainingId: string) => trainings(snapshot).find((item) => item.trainingId === trainingId);
/** Every revision of a need, newest first. */
export const developmentHistory = (snapshot: Snapshot, needId: string): DevelopmentNeedVersion[] => [...(indexOf(snapshot).needHistory.get(needId) ?? [])];
/** Reassessment result shown for a need: Retraining, Meets requirement, "pending" (Completed, not yet decided) or null. */
export const reassessmentFor = (snapshot: Snapshot, needId: string) => reassessmentOf(indexOf(snapshot).needHistory.get(needId) ?? []);
export const REASSESSMENT_PENDING = "Needs reassessment";

/** What a revision changed besides its status, for history lines: priority, method, PIC, reassessment. */
export function revisionChanges(version: DevelopmentNeedVersion, previous?: DevelopmentNeedVersion): string[] {
  const changes: string[] = [];
  if (previous && version.priority !== previous.priority) changes.push(`Priority ${previous.priority} → ${version.priority}`);
  if (previous && (version.method ?? "") !== (previous.method ?? "")) changes.push(`Method: ${previous.method || "—"} → ${version.method || "—"}`);
  if (previous && (version.pic ?? "") !== (previous.pic ?? "")) changes.push(`PIC: ${previous.pic || "—"} → ${version.pic || "—"}`);
  if (version.reassessment) changes.push(`Reassessment: ${version.reassessment}`);
  return changes;
}

/** Objective suggested from a gap finding (interview D4): the competency that falls short and its target level. */
export function objectiveFromFinding(finding: Pick<CompetencyFinding, "competencyName" | "actualLevel" | "requiredLevel">): string {
  return finding.actualLevel === null
    ? `Naikkan ${finding.competencyName} ke level ${finding.requiredLevel}`
    : `Naikkan ${finding.competencyName} dari level ${finding.actualLevel} ke ${finding.requiredLevel}`;
}
export const trainingHistory = (snapshot: Snapshot, trainingId: string) => snapshot.trainingVersions.filter((item) => item.trainingId === trainingId).sort((a, b) => b.revision - a.revision);

export const sourceTypeLabel: Record<DevelopmentSourceType, string> = {
  competency_gap: "Competency Gap",
  role_change: "Position Change",
  performance_context: "Performance Review",
};
/** Q9: a new requirement starts from a competency gap; Position Change and Performance Review stay as other sources. */
export const DEFAULT_SOURCE_TYPE: DevelopmentSourceType = "competency_gap";

/** Resolves a development need's source reference to a readable label and a link to the source record (FR-D4-005). */
export function describeSource(snapshot: Snapshot, need: Pick<DevelopmentNeedVersion, "sourceType" | "sourceRef" | "employeeId">): { label: string; href: string | null } {
  if (need.sourceType === "competency_gap") {
    const requirement = snapshot.reference.positionRequirements.find((item) => item.id === need.sourceRef);
    const competency = snapshot.reference.competencies.find((item) => item.id === requirement?.competencyId);
    return { label: competency ? `${competency.name} (min. level ${requirement?.minProficiencyLevel})` : "Competency requirement", href: `/competency/${need.employeeId}` };
  }
  if (need.sourceType === "role_change") {
    const assessment = snapshot.competency.find((item) => item.id === need.sourceRef);
    return { label: assessment ? `Position change assessment · ${formatDate(assessment.effectiveDate)}` : "Position change assessment", href: `/competency/${need.employeeId}/history` };
  }
  const assessment = snapshot.kpiAssessments?.find((item) => item.id === need.sourceRef);
  if (assessment) return { label: `Performance Review ${formatPeriod(assessment.period)}`, href: `/performance/scorecard/${assessment.id}` };
  // Needs raised before FR-D4-001 v3.1 point at an older, separate evaluation.
  const evaluation = snapshot.performance.find((item) => item.id === need.sourceRef);
  return { label: evaluation ? `Performance Review ${formatPeriod(evaluation.period)} (evaluasi lama)` : "Performance Review", href: evaluation ? `/performance/${evaluation.id}` : null };
}

export function trainingSource(snapshot: Snapshot, record: TrainingVersion) {
  return developmentById(snapshot, record.developmentNeedId);
}

/** Distinct periods of the records, newest first. The first one is the default cycle of the list pages. */
export const periodsOf = (records: readonly { period: string }[]) => [...new Set(records.map((item) => item.period))].sort().reverse();

// Users read Indonesian dates: "September 2026", "3 Okt 2026".
export function formatPeriod(period: string | undefined): string {
  if (!period) return "—";
  const date = new Date(`${period.slice(0, 7)}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? period : new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatScore(value: number | null | undefined, scale = 5): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(2)} / ${scale}`;
}

/** "4.10 / 5" for a V5.1 scorecard, "82.50 / 100" for V6: every scorecard shows the scale it was saved under. */
export const formatScorecard = (scorecard: { overallScore: number | null; definitionVersion?: string | null }): string => formatScore(scorecard.overallScore, scaleMaxOf(scorecard.definitionVersion));

/** Raw-score criteria from KPI Scorecard V3.1/V5.1 sheet "KPI Scoring Card"; shared by KPI and evaluation results. */
export const SCORE_LABELS: Record<number, string> = { 1: "Very Poor", 2: "Poor", 3: "Fair", 4: "Good", 5: "Very Good" };

/** An evaluation result is a whole 1–5 score, so it reads as "4 · Good" rather than "4.00 / 5". */
export function formatResult(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const label = SCORE_LABELS[Math.round(value)];
  return label ? `${value} · ${label}` : String(value);
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

// Dates follow WIB, not UTC: a form opened before 07:00 WIB must not default to yesterday.
export const today = () => localToday();
export const thisMonth = () => localMonth();

export function includesText(haystack: string, needle: string) {
  return !needle.trim() || haystack.toLocaleLowerCase().includes(needle.trim().toLocaleLowerCase());
}

/** What list search matches for an employee: name, Employee ID and position title (interview D4: find a user by name or position). */
export const employeeSearchText = (snapshot: Snapshot, employee?: EmployeeReference) =>
  `${employee?.fullName ?? ""} ${employee?.employeeId ?? ""} ${positionOf(snapshot, employee)?.title ?? ""}`;
