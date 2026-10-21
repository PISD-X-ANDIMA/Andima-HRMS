import type { PerformanceEvaluation } from "./types";

// FR-D4-001 defines no aspects or review labels; the legacy columns keep neutral values.
function sample(id: number, employee: number, score: number, notes: string, evaluator = "Mrs. Maya"): PerformanceEvaluation {
  return {
    id: `FIX-D4-PERF-00${id}`,
    source: "fixture",
    employeeId: `d4000000-0000-4000-8000-${String(employee).padStart(12, "0")}`,
    period: "2026-09",
    evaluationDate: "2026-09-20",
    evaluator,
    status: "completed",
    reviewStatus: "Needs Review",
    overallScore: score,
    aspects: [],
    generalNotes: notes,
    evidenceReference: null,
    createdAt: `2026-09-${String(20 + id).padStart(2, "0")}T09:00:00.000Z`,
    actor: "Fixture D4",
  };
}

export const performanceFixtureRecords: readonly PerformanceEvaluation[] = [
  sample(1, 9, 4, "Consistent and accurate work. Recommendation: advanced administrative accuracy training."),
  sample(2, 10, 4, "Period target met. No training recommendation yet."),
  sample(3, 11, 4, "Good teamwork. Recommendation: Coretax reporting refresher."),
  // Mrs. Maya (HR) is evaluated by the Director of Human Capital & Culture; nobody evaluates themselves.
  sample(4, 12, 4, "HR documentation on time.", "Mr. Gema Arsisto"),
  sample(5, 13, 5, "Very tidy sales administration."),
  sample(6, 14, 3, "Needs coaching on reconciliation. Recommendation: administrative accuracy training."),
  sample(7, 15, 4, "Customer escalations closed within SLA."),
];
