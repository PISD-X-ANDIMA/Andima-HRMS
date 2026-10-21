import type { DevelopmentNeedVersion } from "./types";

/** Manual, fictional needs. No automatic recommendation or training assignment. */
export const developmentFixtureVersions: readonly DevelopmentNeedVersion[] = [
  {
    id: "FIX-D4-DEV-V1-001", needId: "FIX-D4-DEV-001", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000009", sourceType: "competency_gap",
    sourceRef: "d4000000-0000-4000-8000-000000000028",
    objective: "Raise administrative accuracy to the level the position requires.",
    priority: "High", status: "Planned", notes: "Sample need from a fixture gap; the workshop is scheduled.",
    createdAt: "2026-09-24T09:00:00.000Z", actor: "Fixture D4",
  },
  {
    id: "FIX-D4-DEV-V1-002", needId: "FIX-D4-DEV-002", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000011", sourceType: "competency_gap",
    sourceRef: "d4000000-0000-4000-8000-000000000031",
    objective: "Naikkan Tax Reporting & Compliance dari level 3 ke 4 (aturan Coretax)",
    priority: "Medium", status: "In Progress", notes: "Sample Coretax briefing in progress.",
    createdAt: "2026-09-23T09:00:00.000Z", actor: "Fixture D4",
  },
  {
    id: "FIX-D4-DEV-V1-003", needId: "FIX-D4-DEV-003", revision: 1, source: "fixture",
    employeeId: "d4000000-0000-4000-8000-000000000016", sourceType: "competency_gap",
    sourceRef: "d4000000-0000-4000-8000-000000000057",
    objective: "Naikkan Records Management dari level 3 ke 4",
    priority: "Medium", status: "In Progress", notes: "Sample need whose first workshop was Not Passed; the training is repeated.",
    createdAt: "2026-09-26T09:00:00.000Z", actor: "Fixture D4",
  },
];
