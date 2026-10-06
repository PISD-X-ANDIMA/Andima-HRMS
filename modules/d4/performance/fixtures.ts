import type { PerformanceEvaluation } from "./types";

// FR-D4-001 defines no aspects or review labels; the legacy columns keep neutral values.
function sample(id: number, employee: number, score: number, notes: string, evaluator = "Mercury"): PerformanceEvaluation {
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
  sample(1, 9, 4, "Hasil kerja konsisten dan akurat. Rekomendasi: pelatihan akurasi administrasi lanjutan."),
  sample(2, 10, 4, "Target periode tercapai. Belum ada rekomendasi pelatihan."),
  sample(3, 11, 4, "Kolaborasi tim baik. Rekomendasi: penyegaran keselamatan operasi."),
  // Mercury (HR) is evaluated by someone else; nobody evaluates themselves.
  sample(4, 12, 4, "Dokumentasi HR tepat waktu.", "Oscar"),
  sample(5, 13, 5, "Administrasi penjualan sangat rapi."),
  sample(6, 14, 3, "Perlu pendampingan rekonsiliasi. Rekomendasi: pelatihan akurasi administrasi."),
  sample(7, 15, 4, "Checklist operasi lengkap."),
];
