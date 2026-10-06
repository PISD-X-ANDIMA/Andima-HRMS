import type { TrainingVersion } from "./types";

/** Fictional, manually linked training records. Completion does not change a competency finding. */
export const trainingFixtureVersions: readonly TrainingVersion[] = [
  {
    id: "FIX-D4-TRN-V1-001", trainingId: "FIX-D4-TRN-001", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000009", developmentNeedId: "FIX-D4-DEV-001",
    activity: "Workshop Akurasi Administrasi", date: "2026-10-08", status: "Planned",
    result: "", notes: "Rencana pelatihan contoh, ditautkan manual ke development need.",
    createdAt: "2026-09-25T09:00:00.000Z", actor: "Fixture D4",
  },
  {
    id: "FIX-D4-TRN-V1-002", trainingId: "FIX-D4-TRN-002", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000011", developmentNeedId: "FIX-D4-DEV-002",
    activity: "Safety Operations Briefing", date: "2026-10-12", status: "In Progress",
    result: "", notes: "Kegiatan contoh masih berlangsung.",
    createdAt: "2026-09-25T10:00:00.000Z", actor: "Fixture D4",
  },
];
