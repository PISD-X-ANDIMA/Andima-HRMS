import { compareCompetencies } from "../../competency/service";
import type { CompetencyFinding, CompetencyOverallStatus } from "../../competency/types";
import type { DevelopmentNeedVersion, DevelopmentSourceType } from "../../development/types";
import type { PerformanceEvaluation } from "../../performance/types";
import type { EmployeeReference } from "../../shared/types";
import { isTeamMember, localMonth, localToday, revisionNumber } from "../../shared/rules";
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

/** Employees the signed-in evaluator may assess or raise development/training for: never themselves. */
export const canAssess = (snapshot: Snapshot, employeeId: string) => canWrite(snapshot) && employeeId !== snapshot.actorEmployeeId;
export const assessableEmployees = (snapshot: Snapshot) => visibleEmployees(snapshot).filter((item) => item.id !== snapshot.actorEmployeeId);

export const employeeById = (snapshot: Snapshot, id: string) => snapshot.reference.employees.find((item) => item.id === id);
export const positionOf = (snapshot: Snapshot, employee?: EmployeeReference) => snapshot.reference.positions.find((item) => item.id === employee?.positionId);
/** Position filter options limited to positions held by employees this role can see. */
export function positionOptions(snapshot: Snapshot) {
  const held = new Set(visibleEmployees(snapshot).map((item) => item.positionId));
  return snapshot.reference.positions.filter((item) => held.has(item.id)).map((item) => ({ value: item.id, label: item.title }));
}
export const positionById = (snapshot: Snapshot, id?: string | null) => snapshot.reference.positions.find((item) => item.id === id);
export const departmentOf = (snapshot: Snapshot, employee?: EmployeeReference) => snapshot.reference.departments.find((item) => item.id === employee?.departmentId);

const newestFirst = <T extends { createdAt: string }>(items: readonly T[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export function evaluationsOf(snapshot: Snapshot, employeeId: string): PerformanceEvaluation[] {
  return newestFirst(snapshot.performance.filter((item) => item.employeeId === employeeId)).sort((a, b) => b.period.localeCompare(a.period));
}
export const latestEvaluation = (snapshot: Snapshot, employeeId: string) => evaluationsOf(snapshot, employeeId)[0];

export function scorecardsOf(snapshot: Snapshot, employeeId: string): KpiAssessment[] {
  return newestFirst((snapshot.kpiAssessments ?? []).filter((item) => item.employeeId === employeeId)).sort((a, b) => b.period.localeCompare(a.period));
}
/** " · Revisi n" for the second and later record of the same period; empty for the first. */
export function revisionTag<T extends { id: string; employeeId: string; period: string; createdAt: string }>(records: readonly T[], record: T) {
  const n = revisionNumber(records, record);
  return n > 1 ? ` · Revisi ${n}` : "";
}

export const latestScorecard = (snapshot: Snapshot, employeeId: string) => scorecardsOf(snapshot, employeeId)[0];

/** Live comparison of the employee's current position requirements against recorded evidence. */
export function currentGap(snapshot: Snapshot, employee: EmployeeReference): { findings: CompetencyFinding[]; overallStatus: CompetencyOverallStatus } | null {
  if (!employee.positionId || !snapshot.reference.positions.some((item) => item.id === employee.positionId)) return null;
  return compareCompetencies(employee.id, employee.positionId, snapshot.reference);
}

export const developmentNeeds = (snapshot: Snapshot) => latestDevelopment(snapshot);
export const trainings = (snapshot: Snapshot) => latestTraining(snapshot);
export const developmentById = (snapshot: Snapshot, needId: string) => latestDevelopment(snapshot).find((item) => item.needId === needId);
export const trainingById = (snapshot: Snapshot, trainingId: string) => latestTraining(snapshot).find((item) => item.trainingId === trainingId);
export const developmentHistory = (snapshot: Snapshot, needId: string) => snapshot.developmentVersions.filter((item) => item.needId === needId).sort((a, b) => b.revision - a.revision);
export const trainingHistory = (snapshot: Snapshot, trainingId: string) => snapshot.trainingVersions.filter((item) => item.trainingId === trainingId).sort((a, b) => b.revision - a.revision);

export const sourceTypeLabel: Record<DevelopmentSourceType, string> = {
  competency_gap: "Competency Gap",
  role_change: "Position Change",
  performance_context: "Performance Evaluation",
};

/** Resolves a development need's source reference to a readable label and a link to the source record (FR-D4-005). */
export function describeSource(snapshot: Snapshot, need: Pick<DevelopmentNeedVersion, "sourceType" | "sourceRef" | "employeeId">): { label: string; href: string | null } {
  if (need.sourceType === "competency_gap") {
    const requirement = snapshot.reference.positionRequirements.find((item) => item.id === need.sourceRef);
    const competency = snapshot.reference.competencies.find((item) => item.id === requirement?.competencyId);
    return { label: competency ? `${competency.name} (min. level ${requirement?.minProficiencyLevel})` : "Persyaratan kompetensi", href: `/competency/${need.employeeId}` };
  }
  if (need.sourceType === "role_change") {
    const assessment = snapshot.competency.find((item) => item.id === need.sourceRef);
    return { label: assessment ? `Assessment perubahan posisi · ${formatDate(assessment.effectiveDate)}` : "Assessment perubahan posisi", href: `/competency/${need.employeeId}/history` };
  }
  const evaluation = snapshot.performance.find((item) => item.id === need.sourceRef);
  return { label: evaluation ? `Evaluasi kinerja ${formatPeriod(evaluation.period)}` : "Evaluasi kinerja", href: evaluation ? `/performance/${evaluation.id}` : null };
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

/** Raw-score criteria from KPI Scorecard V3.1/V5.1 sheet "KPI Scoring Card"; shared by KPI and evaluation results. */
export const SCORE_LABELS: Record<number, string> = { 1: "Sangat Kurang", 2: "Kurang", 3: "Cukup", 4: "Baik", 5: "Sangat Baik" };

/** An evaluation result is a whole 1–5 score, so it reads as "4 · Baik" rather than "4.00 / 5". */
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
