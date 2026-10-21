import type { EvaluationInput } from "./types";

/** FR-01.3: mandatory fields of a completed evaluation (mirrors the DB check on d4_performance_evaluations). */
export function validatePerformanceInput(input: EvaluationInput): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw new Error("Periode evaluasi wajib diisi.");
  if (input.status === "completed") {
    if (!input.evaluationDate || !input.evaluator.trim()) throw new Error("Tanggal dan penilai wajib diisi.");
    if (!input.generalNotes.trim()) throw new Error("Catatan evaluasi wajib diisi.");
  }
}
