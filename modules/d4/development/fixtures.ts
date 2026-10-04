import type { DevelopmentNeedVersion } from "./types";

/** Manual, fictional needs. No automatic recommendation or training assignment. */
export const developmentFixtureVersions: readonly DevelopmentNeedVersion[] = [
  {
    id: "FIX-D4-DEV-V1-001", needId: "FIX-D4-DEV-001", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000009", sourceType: "competency_gap",
    sourceRef: "d4000000-0000-4000-8000-000000000028",
    objective: "Meningkatkan akurasi administrasi ke level yang dibutuhkan posisi.",
    priority: "High", status: "Identified", notes: "Kebutuhan contoh dari gap pada fixture.",
    createdAt: "2026-09-24T09:00:00.000Z", actor: "Fixture D4",
  },
  {
    id: "FIX-D4-DEV-V1-002", needId: "FIX-D4-DEV-002", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000011", sourceType: "competency_gap",
    sourceRef: "d4000000-0000-4000-8000-000000000031",
    objective: "Memperkuat kemampuan keselamatan operasi.",
    priority: "Medium", status: "Planned", notes: "Rencana contoh, belum memilih training.",
    createdAt: "2026-09-23T09:00:00.000Z", actor: "Fixture D4",
  },
];
