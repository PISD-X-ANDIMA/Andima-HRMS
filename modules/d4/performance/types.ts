export type EvaluationStatus = "draft" | "completed";
export type ReviewStatus = "Needs Review" | "On Track" | "Needs Attention";

export interface EvaluationAspect {
  readonly name: string;
  readonly weight: number;
  readonly score: number | null;
  readonly notes: string;
}

export interface PerformanceEvaluation {
  readonly id: string;
  readonly source: "fixture" | "local-demo" | "supabase";
  readonly employeeId: string;
  readonly period: string;
  readonly evaluationDate: string;
  readonly evaluator: string;
  readonly status: EvaluationStatus;
  /** Manual review label. No automatic HR decision is inferred from a score. */
  readonly reviewStatus: ReviewStatus;
  /** Legacy column: older evaluations may carry a 1–5 score, new ones store null and the UI never shows it. */
  readonly overallScore: number | null;
  readonly aspects: readonly EvaluationAspect[];
  readonly generalNotes: string;
  readonly evidenceReference: string | null;
  readonly createdAt: string;
  readonly actor: string;
}

export type EvaluationInput = Omit<PerformanceEvaluation, "id" | "source" | "createdAt" | "actor">;
