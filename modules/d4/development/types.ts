export type DevelopmentSourceType = "competency_gap" | "role_change" | "performance_context";
export type DevelopmentPriority = "Low" | "Medium" | "High";
export type DevelopmentStatus = "Identified" | "Planned" | "In Progress" | "Completed";
/** HR decision after reassessing a Completed requirement: train again, or the competency now meets the requirement. */
export type DevelopmentReassessment = "Retraining" | "Meets requirement";

export interface DevelopmentSourceOption {
  readonly type: DevelopmentSourceType;
  readonly ref: string;
  readonly label: string;
}

export interface DevelopmentNeedVersion {
  readonly id: string;
  readonly needId: string;
  readonly revision: number;
  readonly source: "fixture" | "local-demo" | "supabase";
  readonly employeeId: string;
  readonly sourceType: DevelopmentSourceType;
  readonly sourceRef: string;
  readonly objective: string;
  readonly priority: DevelopmentPriority;
  readonly method?: string;
  readonly pic?: string;
  readonly status: DevelopmentStatus;
  /** Recorded in this revision only; see reassessmentOf for the decision that applies now. */
  readonly reassessment?: DevelopmentReassessment | null;
  readonly notes: string;
  readonly createdAt: string;
  readonly actor: string;
}
