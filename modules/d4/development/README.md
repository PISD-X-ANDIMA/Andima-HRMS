# Development Requirement, FR-D4-004

Sumber kebutuhan: Docmost `FR-D4-004` (`0wzA4bRIaF`).

| Bagian | Lokasi |
|---|---|
| Tipe domain | `types.ts` |
| Data preview (fiktif) | `fixtures.ts` |
| Halaman list, detail, history | `modules/d4/web/features/development/DevelopmentPages.tsx` |
| Modal Add dan Update Status | `modules/d4/web/features/development/DevelopmentModals.tsx` |
| API | `modules/d4/server/development-needs/index.ts` |

Requirement hanya dibuat dari salah satu source milik employee yang sama: requirement kompetensi berstatus Gap, assessment role change, atau evaluasi Completed. Objective wajib diisi. Priority, status, dan catatan dipilih manual. Setiap perubahan status menambah revisi (`POST …/:id/versions`), sehingga histori dan referensi source awal tetap ada. Tidak ada pembuatan berkala atau pemilihan training otomatis.
