import type { D4DataMode } from "./mode";
import type { KpiCatalogSet } from "../../kpi/catalog";
import type { DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../../development/types";
import type { EvaluationInput } from "../../performance/types";
import type { DevelopmentChange, TrainingFollowUpInput } from "../../shared/rules";
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

export type EvaluationDraft = EvaluationInput & { revisionOf?: string | null };

export type DevelopmentDraft = { employeeId: string; sourceType: DevelopmentSourceType; sourceRef: string; objective: string; priority: DevelopmentPriority; notes: string; method?: string; pic?: string };
/** Priority, method, PIC or a reassessment saved with a revision; left out = unchanged. */
export type DevelopmentEdit = Omit<DevelopmentChange, "status" | "notes">;
export type TrainingDraft = { employeeId: string; developmentNeedId: string; activity: string; date: string; status: TrainingStatus; result: string; notes: string };

/**
 * Everything the D4 screens need. The live implementation talks to /api/d4/*;
 * the local implementation keeps fictional data in the browser (fixture preview and public demo).
 */
export interface D4DataSource {
  readonly mode: D4DataMode;
  loadSnapshot(): Promise<D4LiveSnapshot>;
  loadKpiCatalog(): Promise<KpiCatalogSet>;
  createEvaluation(input: EvaluationDraft): Promise<string>;
  createKpiAssessment(input: KpiAssessmentDraft): Promise<string>;
  saveCompetency(input: { employeeId: string; positionId: string; effectiveDate: string; assessedWith?: string }): Promise<string>;
  createDevelopment(input: DevelopmentDraft): Promise<string>;
  updateDevelopment(needId: string, status: DevelopmentStatus, notes: string, edit?: DevelopmentEdit): Promise<void>;
  createTraining(input: TrainingDraft): Promise<string>;
  updateTraining(trainingId: string, status: TrainingStatus, result: string, notes: string): Promise<void>;
  /** Q16: follow-up of a Not Passed training; returns the new training id for Retraining, else null. */
  recordTrainingFollowUp(trainingId: string, input: TrainingFollowUpInput): Promise<string | null>;
}
