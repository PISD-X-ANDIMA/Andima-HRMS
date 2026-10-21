import type { TrainingVersion } from "./types";

/** Fictional, manually linked training records. Completion does not change a competency finding. */
export const trainingFixtureVersions: readonly TrainingVersion[] = [
  {
    id: "FIX-D4-TRN-V1-001", trainingId: "FIX-D4-TRN-001", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000009", developmentNeedId: "FIX-D4-DEV-001",
    activity: "Administrative Accuracy Workshop", date: "2026-10-08", status: "Planned",
    result: "", notes: "Sample training plan, linked manually to the development need.",
    createdAt: "2026-09-25T09:00:00.000Z", actor: "Fixture D4",
  },
  {
    id: "FIX-D4-TRN-V1-002", trainingId: "FIX-D4-TRN-002", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000011", developmentNeedId: "FIX-D4-DEV-002",
    activity: "Coretax Reporting Briefing", date: "2026-10-01", status: "In Progress",
    result: "", notes: "Sample activity still in progress.",
    createdAt: "2026-09-25T10:00:00.000Z", actor: "Fixture D4",
  },
  {
    id: "FIX-D4-TRN-V1-003", trainingId: "FIX-D4-TRN-003", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000016", developmentNeedId: "FIX-D4-DEV-003",
    activity: "Records Retention Workshop", date: "2026-10-06", status: "Completed",
    result: "Not Passed", notes: "Sample result: the post-test was below the pass mark.",
    createdAt: "2026-10-07T09:00:00.000Z", actor: "Fixture D4",
  },
];
