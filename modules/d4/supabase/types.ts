import type { CompetencyAssessment } from "../competency/types";
import type { DevelopmentNeedVersion } from "../development/types";
import type { PerformanceEvaluation } from "../performance/types";
import type { PeriodReopening } from "../shared/rules";
import type { ReferenceDataSnapshot } from "../shared/types";
import type { TrainingVersion } from "../training/types";

// MANAGEMENT (directors, B17) reads everything an HR account reads and writes nothing.
export type D4AppRole = "EMPLOYEE" | "HR" | "MANAGER" | "MANAGEMENT";

export interface D3KpiRecord {
  readonly id: string;
  readonly employeeId: string;
  readonly period: string;
  readonly score: number;
  readonly notes: string;
  readonly createdAt: string;
}

export interface KpiAssessmentLine {
  readonly indicator_order: number;
  readonly kpi_name: string;
  readonly weight_percent: number;
  readonly target: string;
  readonly actual: string;
  readonly raw_score: number | null;
  readonly comment: string;
}

export interface KpiAssessmentInput {
  /** KPI catalog version the lines were taken from (V5.1 once its migration is applied). */
  readonly definitionVersion: string;
  readonly employeeId: string;
  readonly roleOrder: number;
  readonly roleName: string;
  readonly period: string;
  readonly evaluationDate: string;
  readonly evaluatorName: string;
  readonly status: "draft" | "completed";
  readonly lines: readonly KpiAssessmentLine[];
  /** Evaluation notes of the Penilaian Kinerja; required for new records. */
  readonly generalNotes: string;
  readonly evidenceReference: string | null;
}

export interface KpiAssessment extends KpiAssessmentInput {
  readonly id: string;
  readonly overallScore: number | null;
  readonly createdAt: string;
  readonly actor: string;
}

/** One employee's own scores for one day (table d4_kpi_daily_entries); the newest row of a day counts. */
export interface KpiDailyEntryInput {
  readonly definitionVersion: string;
  readonly employeeId: string;
  readonly entryDate: string;
  readonly period: string;
  readonly roleOrder: number;
  readonly roleName: string;
  readonly lines: readonly KpiAssessmentLine[];
}

export interface KpiDailyEntry extends KpiDailyEntryInput {
  readonly id: string;
  readonly overallScore: number | null;
  readonly createdAt: string;
}

export interface D4LiveSnapshot {
  readonly reference: ReferenceDataSnapshot;
  readonly role: D4AppRole;
  readonly actorEmployeeId: string;
  readonly kpi: readonly D3KpiRecord[];
  readonly kpiAssessments?: readonly KpiAssessment[];
  /** Undefined until migration 20261108130000 creates d4_kpi_daily_entries. */
  readonly kpiDaily?: readonly KpiDailyEntry[];
  /** Older periods HR reopened; empty until migration 20261124150000 creates d4_period_reopenings. */
  readonly periodReopenings?: readonly PeriodReopening[];
  readonly performance: readonly PerformanceEvaluation[];
  readonly competency: readonly CompetencyAssessment[];
  readonly developmentVersions: readonly DevelopmentNeedVersion[];
  readonly trainingVersions: readonly TrainingVersion[];
}

export function latestDevelopment(snapshot: Pick<D4LiveSnapshot, "developmentVersions">): DevelopmentNeedVersion[] {
  const latest = new Map<string, DevelopmentNeedVersion>();
  for (const item of snapshot.developmentVersions) {
    if ((latest.get(item.needId)?.revision ?? 0) < item.revision) latest.set(item.needId, item);
  }
  return [...latest.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function latestTraining(snapshot: Pick<D4LiveSnapshot, "trainingVersions">): TrainingVersion[] {
  const latest = new Map<string, TrainingVersion>();
  for (const item of snapshot.trainingVersions) {
    if ((latest.get(item.trainingId)?.revision ?? 0) < item.revision) latest.set(item.trainingId, item);
  }
  return [...latest.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
