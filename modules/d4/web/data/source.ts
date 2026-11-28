import type { KpiCatalogSet } from "../../kpi/catalog";
import type { DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../../development/types";
import type { EvaluationInput } from "../../performance/types";
import type { DevelopmentChange, PeriodReopeningDraft, TrainingCompletion } from "../../shared/rules";
import type { D4LiveSnapshot, KpiAssessmentLine } from "../../supabase/types";
import type { TrainingStatus } from "../../training/types";

export type KpiAssessmentDraft = {
  employeeId: string;
  roleOrder: number;
  period: string;
  evaluationDate: string;
  evaluatorName: string;
  status: "draft" | "completed";
  lines: KpiAssessmentLine[];
  generalNotes: string;
  evidenceReference?: string | null;
  /** Id of the current record for this employee and period when saving a revision of it. */
  revisionOf?: string | null;
};

/** The employee's own scores for one day; employee, KPI role and indicators follow the session and the catalog. */
export type DailyKpiDraft = { entryDate: string; lines: { raw_score: number | null; comment: string }[] };

export type EvaluationDraft = EvaluationInput & { revisionOf?: string | null };

export type DevelopmentDraft = { employeeId: string; sourceType: DevelopmentSourceType; sourceRef: string; objective: string; priority: DevelopmentPriority; notes: string; method?: string; pic?: string };
/** Priority, method, PIC or a reassessment saved with a revision; left out = unchanged. */
export type DevelopmentEdit = Omit<DevelopmentChange, "status" | "notes">;
export type TrainingDraft = { employeeId: string; developmentNeedId: string; activity: string; date: string; status: TrainingStatus; result: string; notes: string };
/** One row of a bulk training save: the body of createTraining, updateTraining or completeTraining. */
export type BulkTrainingItem =
  | ({ op: "create" } & TrainingDraft)
  | { op: "version"; trainingId: string; status: TrainingStatus; result: string; notes: string }
  | ({ op: "complete"; trainingId: string } & TrainingCompletion);
export type BulkRowResult = { ok: true } | { ok: false; message: string };

/**
 * Everything the D4 screens need. The live implementation talks to /api/d4/*;
 * the fixture implementation keeps fictional data in memory for local preview.
 */
export interface D4DataSource {
  readonly mode: "live" | "fixture";
  loadSnapshot(): Promise<D4LiveSnapshot>;
  loadKpiCatalog(): Promise<KpiCatalogSet>;
  createEvaluation(input: EvaluationDraft): Promise<string>;
  createKpiAssessment(input: KpiAssessmentDraft): Promise<string>;
  createDailyKpi(input: DailyKpiDraft): Promise<string>;
  /** HR only: reopen an older period until a date, or close it again with a date that has passed. */
  reopenPeriod(input: PeriodReopeningDraft): Promise<string>;
  saveCompetency(input: { employeeId: string; positionId: string; effectiveDate: string; assessedWith?: string }): Promise<string>;
  createDevelopment(input: DevelopmentDraft): Promise<string>;
  updateDevelopment(needId: string, status: DevelopmentStatus, notes: string, edit?: DevelopmentEdit): Promise<void>;
  /** Path B (13 Nov 2026): a Competency Gap requirement with no open training closes once the level is met. */
  closeDevelopment(needId: string): Promise<void>;
  createTraining(input: TrainingDraft): Promise<string>;
  updateTraining(trainingId: string, status: TrainingStatus, result: string, notes: string): Promise<void>;
  /** Result and HR's decision in one save (Training Tracking); returns the new training id for Retraining, else null. */
  completeTraining(trainingId: string, input: TrainingCompletion): Promise<string | null>;
  /** Many training writes in one request, one result per row in order. Without it, rows are saved one by one. */
  bulkTraining?(items: readonly BulkTrainingItem[]): Promise<BulkRowResult[]>;
}
