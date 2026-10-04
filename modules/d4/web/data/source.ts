import type { D4DataMode } from "./mode";
import type { KpiCatalog } from "../../kpi/catalog";
import type { DevelopmentPriority, DevelopmentSourceType, DevelopmentStatus } from "../../development/types";
import type { EvaluationInput } from "../../performance/types";
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
  /** Id of the current record for this employee and period when saving a revision of it. */
  revisionOf?: string | null;
};

export type EvaluationDraft = EvaluationInput & { revisionOf?: string | null };

export type DevelopmentDraft = { employeeId: string; sourceType: DevelopmentSourceType; sourceRef: string; objective: string; priority: DevelopmentPriority; notes: string };
export type TrainingDraft = { employeeId: string; developmentNeedId: string; activity: string; date: string; status: TrainingStatus; result: string; notes: string };

/**
 * Everything the D4 screens need. The live implementation talks to /api/d4/*;
 * the local implementation keeps fictional data in the browser (fixture preview and public demo).
 */
export interface D4DataSource {
  readonly mode: D4DataMode;
  loadSnapshot(): Promise<D4LiveSnapshot>;
  loadKpiCatalog(): Promise<KpiCatalog>;
  createEvaluation(input: EvaluationDraft): Promise<string>;
  createKpiAssessment(input: KpiAssessmentDraft): Promise<string>;
  saveCompetency(input: { employeeId: string; positionId: string; effectiveDate: string }): Promise<string>;
  createDevelopment(input: DevelopmentDraft): Promise<string>;
  updateDevelopment(needId: string, status: DevelopmentStatus, notes: string): Promise<void>;
  createTraining(input: TrainingDraft): Promise<string>;
  updateTraining(trainingId: string, status: TrainingStatus, result: string, notes: string): Promise<void>;
}
