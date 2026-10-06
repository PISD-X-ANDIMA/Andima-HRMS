export type TrainingStatus = "Planned" | "In Progress" | "Completed" | "Cancelled";

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
  readonly createdAt: string;
  readonly actor: string;
}
