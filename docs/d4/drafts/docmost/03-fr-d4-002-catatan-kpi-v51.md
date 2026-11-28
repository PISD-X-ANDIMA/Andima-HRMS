# Draft · Catatan versi katalog KPI (FR-D4-002)

**Target:** halaman FR-D4-002 KPI Scorecard, di bawah tabel KPI per position.

---

### Catatan versi katalog

| | Dokumen FR-D4-002 | Database bersama saat ini |
|---|---|---|
| Versi | **V5.1** | V3.1 |
| Struktur | 10 role × 5 KPI, total bobot tiap role 100% | 10 role × 5 KPI |
| Kolom versi di assessment | `definition_version` | belum ada |

- Migrasi `supabase/migrations/20260929150000_d4_kpi_catalog_v51.sql` menambahkan katalog V5.1 dan kolom `definition_version` tanpa menghapus V3.1, sehingga scorecard lama tetap terbaca dengan versi aslinya.
- Migrasi ini **belum diterapkan** ke Supabase bersama. Penerapannya perlu persetujuan PO dan Back End karena memengaruhi squad lain yang memakai project yang sama.
- Sampai migrasi diterapkan, aplikasi memakai versi terbaru yang ada di database (V3.1) dan menampilkan peringatan versi katalog di halaman KPI Scorecard.
- Setiap scorecard menyimpan versi katalog yang dipakai saat dibuat (*KPI definition reference*), sehingga perubahan katalog berikutnya tidak mengubah skor historis.

### Open decision

1. Kapan V5.1 diterapkan ke database bersama, dan siapa yang menyetujui.
2. Pemetaan position → role KPI: saat ini berdasarkan judul position **saat ini**. Perlu diputuskan apakah scorecard periode lampau memakai position pada periode tersebut (butuh riwayat position per periode dari D3).
