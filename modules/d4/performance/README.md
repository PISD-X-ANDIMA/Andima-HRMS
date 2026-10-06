# Performance Evaluation, FR-D4-001

Sumber kebutuhan: Docmost `FR-D4-001` (`zuilMLBo7c`). Pola UI: `docs/d4/UI-D4-001.md`.

| Bagian | Lokasi |
|---|---|
| Tipe domain dan validasi form | `types.ts`, `validation.ts` |
| Data preview (fiktif) | `fixtures.ts` |
| Halaman list, detail, history | `modules/d4/web/features/performance/PerformancePages.tsx` |
| Modal Add Evaluation | `modules/d4/web/features/performance/EvaluationFormModal.tsx` |
| API | `modules/d4/server/performance-evaluations/index.ts` → `/api/d4/performance-evaluations` |

Setiap evaluasi terhubung ke UUID `d3_employee.id` dan satu periode. `Save Draft` hanya mewajibkan employee dan periode. `Save` mewajibkan tanggal, evaluator, dan skor 1–5 untuk ketujuh aspek. Skor keseluruhan dihitung dari bobot aspek, sedangkan status review dipilih manual oleh evaluator. Setiap simpan menambah record baru, jadi riwayat tidak tertimpa. Tidak ada keputusan HR otomatis dari skor.
