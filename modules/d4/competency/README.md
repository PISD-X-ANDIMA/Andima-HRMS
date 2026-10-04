# Competency Gap, FR-D4-003

Sumber kebutuhan: Docmost `FR-D4-003` (`FGi95rfKIP`).

| Bagian | Lokasi |
|---|---|
| Perbandingan requirement vs skill | `service.ts` (`compareCompetencies`) |
| Halaman list, detail, history | `modules/d4/web/features/competency/CompetencyPages.tsx` |
| API | `modules/d4/server/competency-assessments/index.ts` |

Satu temuan bernilai `Terpenuhi` bila level memenuhi syarat dan evidence ada, `Gap` bila level kurang dan evidence ada, atau `Bukti Belum Cukup` bila skill atau evidence tidak tersedia. UI menampilkan status terakhir sebagai **Data Belum Cukup** dengan warna netral. Gap dihitung ulang di server saat assessment disimpan; nilai dari klien tidak dipakai.

Assessment menyimpan snapshot position, sehingga riwayat tetap utuh saat employee pindah position. Assessment dengan konteks `role-change` dapat menjadi source Development Requirement. Training yang selesai tidak mengubah evidence atau menutup gap.
