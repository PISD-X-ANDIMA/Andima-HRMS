# KPI Scorecard, FR-D4-002

Sumber kebutuhan: Docmost `FR-D4-002` (`LkehEZA51e`), `TR-D4-001` (`dPjb2IrYir`), dan workbook KPI Scorecard V5.1.

| Bagian | Lokasi |
|---|---|
| Katalog V5.1 (10 role × 5 KPI) dan pemetaan position → role | `catalog.ts` |
| Halaman list, detail, history, katalog | `modules/d4/web/features/kpi/KpiPages.tsx` |
| Modal scorecard (880 px) | `modules/d4/web/features/kpi/KpiFormModal.tsx` |
| API | `modules/d4/server/kpi-assessments/index.ts`, `modules/d4/server/kpi-catalog/index.ts` |
| Migrasi V5.1 (belum diterapkan ke DB bersama) | `supabase/migrations/20260929150000_d4_kpi_catalog_v51.sql` |

Form hanya memuat 5 KPI milik role employee. Bobot dan target diambil dari katalog di server, bukan dari body request; target setiap Core KPI tetap 85 (`KPI_TARGET` di `catalog.ts`). Evaluator mengisi realisasi (teks) dan skor. Skala skor mengikuti versi katalog (`scale.ts`): 1–5 untuk V3.1/V5.1 dan 1–100 untuk V6, yang berlaku untuk periode mulai 2026-11 (`KPI_V6_EFFECTIVE_FROM`). Skor terbobot = bobot × skor (bobot 20% × skor 90 = 18), dan total = Σ skor terbobot, dihitung oleh trigger database `d4_calculate_kpi_assessment`.

Total skor V6 diberi kategori performa (`performanceBand`): di bawah 80 Under Performance, 80–85 Average Performance, di atas 85 High Performance. Scorecard 1–5 tidak diberi kategori. Tidak ada label tercapai/tidak tercapai dan tidak ada konversi realisasi → skor.

Selama migrasi V5.1 belum diterapkan, API memakai versi katalog terbaru yang ada di database (V3.1).
