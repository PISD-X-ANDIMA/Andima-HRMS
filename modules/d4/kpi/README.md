# KPI Scorecard, FR-D4-002

Sumber kebutuhan: Docmost `FR-D4-002` (`LkehEZA51e`), `TR-D4-001` (`dPjb2IrYir`), dan workbook KPI Scorecard V5.1.

| Bagian | Lokasi |
|---|---|
| Katalog V5.1 (10 role × 5 KPI) dan pemetaan position → role | `catalog.ts` |
| Halaman list, detail, history, katalog | `modules/d4/web/features/kpi/KpiPages.tsx` |
| Modal scorecard (880 px) | `modules/d4/web/features/kpi/KpiFormModal.tsx` |
| API | `modules/d4/server/kpi-assessments/index.ts`, `modules/d4/server/kpi-catalog/index.ts` |
| Migrasi V5.1 (belum diterapkan ke DB bersama) | `supabase/migrations/20260929150000_d4_kpi_catalog_v51.sql` |

Form hanya memuat 5 KPI milik role employee. Bobot diambil dari katalog di server, bukan dari body request. Evaluator mengisi target, realisasi (teks), dan skor mentah 1–5. Skor terbobot = bobot × skor mentah, dan total = Σ skor terbobot, dihitung oleh trigger database `d4_calculate_kpi_assessment`. Tidak ada label tercapai, ambang batas, atau konversi realisasi → skor.

Selama migrasi V5.1 belum diterapkan, API memakai versi katalog terbaru yang ada di database (V3.1).
