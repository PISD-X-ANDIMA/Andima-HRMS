# Training Tracking, FR-D4-005

| Bagian | Lokasi |
|---|---|
| Tipe domain | `types.ts` |
| Data preview (fiktif) | `fixtures.ts` |
| Halaman list, detail, history | `modules/d4/web/features/training/TrainingPages.tsx` |
| Modal Add Training dan Update Progress | `modules/d4/web/features/training/TrainingModals.tsx` |
| API | `modules/d4/server/training-records/index.ts` |

Training terhubung ke satu employee dan satu Development Requirement miliknya. Setiap perubahan status, hasil, atau catatan menambah versi (`POST …/:id/versions`). `Result` wajib diisi saat status Completed. Training yang Completed tidak mengubah evidence kompetensi dan tidak menutup gap; halaman detail menampilkan catatan itu.
