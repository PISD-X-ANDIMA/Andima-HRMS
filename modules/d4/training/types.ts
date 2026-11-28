export type TrainingStatus = "Planned" | "In Progress" | "Completed" | "Cancelled";
/** Q16: HR's follow-up of a Not Passed training. Retraining creates a new training; any other step needs a note. */
export type TrainingFollowUp = "Retraining" | "Other follow-up";

export interface TrainingVersion {
  readonly id: string;
  readonly trainingId: string;
  readonly revision: number;
  readonly source: "fixture" | "local-demo" | "supabase";
  readonly employeeId: string;
  readonly developmentNeedId: string;
  readonly activity: string;
  readonly date: string;
  readonly status: TrainingStatus;
  readonly result: string;
  readonly notes: string;
  /** Recorded in this version only; see followUpOf for the follow-up that applies now. */
  readonly followUp?: TrainingFollowUp | null;
  readonly createdAt: string;
  readonly actor: string;
}
