# Draft · Sinkronisasi checklist Planka (kritik K7)

**Target:** checklist kartu di board Squad D4.
**Dasar:** status checklist dibaca 29 Sep 2026 (read-only). Item yang sudah dicentang tim tidak diulang di sini.

Arti kolom **Rekomendasi**:

- **Centang** — sudah ada di kode D4 V2 dan diverifikasi di mode preview. Centang setelah branch V2 masuk ke repo tim dan dicek sekali di Supabase bersama.
- **Centang setelah QA live** — perilaku sudah ada dan lulus di mode preview, tapi DoD meminta bukti di data asli.
- **Belum** — memang belum selesai; alasannya ditulis.

> Catatan jujur: kode V2 saat ini ada di repo sandbox `KevArslanian/hrms-d4-sandbox` branch `feature/d4-v2-d2-style`, belum di repo tim. Jangan centang item "Centang" sebelum kode itu digabung.

## To Do List WebDev

### Implementasi Performance Evaluation

| Item belum dicentang | Rekomendasi | Bukti |
|---|---|---|
| Tampilkan rekomendasi/rencana training sebagai konteks | Centang | Detail evaluasi menampilkan Development Requirement bersumber `performance_context` beserta chip ke training (`PerformancePages.tsx`, kartu *Related records*) |
| Sediakan success state | Centang | Toast sukses setelah simpan (`ui/layout.tsx` `Toasts`) |
| DoD: Create evaluation | Centang setelah QA live | Modal Add Evaluation, `POST /api/d4/performance-evaluations` |
| DoD: Validation | Centang setelah QA live | Validasi inline + server 422 |
| DoD: Data tersimpan | Centang setelah QA live | — |
| DoD: History | Centang setelah QA live | `/performance/history/[employeeId]` |
| DoD: Data dapat dibuka kembali | Centang setelah QA live | `/performance/[id]` |
| DoD: Permission | Centang setelah QA live | `requireWriter` (HR/Manager); Employee read-only, diuji dengan fixture role EMPLOYEE |
| DoD: No automatic decision | Centang | Hasil evaluasi dipilih manual oleh evaluator; tidak ada aksi otomatis dari skor |

### Implementasi KPI Scorecard

| Item belum dicentang | Rekomendasi | Bukti |
|---|---|---|
| Sistem membaca position employee pada periode | **Belum** | Saat ini memakai position **saat ini**. Butuh riwayat position per periode dari D3 (open decision di FR-D4-002) |
| Sistem mengambil 5 Core KPI sesuai position | Centang | `roleForPositionTitle` + katalog aktif (`modules/d4/kpi/catalog.ts`) |
| Tampilkan bobot | Centang | Kolom bobot read-only di form dan detail |
| Simpan KPI definition reference | Centang setelah migrasi V5.1 | Kolom `definition_version`; migrasi belum diterapkan ke DB bersama |
| Pastikan KPI position lain tidak ikut tampil | Centang | Form hanya memuat 5 KPI role terpilih; server menolak `kpi_name` yang tidak cocok dengan katalog |
| Milestone M1 | Centang setelah dua item di atas | — |

### Implementasi Competency Gap & Development Requirement

| Item belum dicentang | Rekomendasi | Bukti |
|---|---|---|
| Pertahankan history ketika employee berpindah position | Centang | Assessment menyimpan snapshot position; history menandai role change |
| Buat halaman/list Development Requirement | Centang | `/development` |
| Perubahan position dapat digunakan sebagai source | Centang | Source type `role_change` |
| Performance evaluation dapat dipakai sebagai konteks | Centang | Source type `performance_context` |
| Buat history development requirement | Centang | `/development/[id]/history` (revisi append-only) |
| Implementasikan filter | Centang | Filter search, status, source type, priority |
| Milestone M2 | Centang | — |

### Implementasi Training Tracking

| Item belum dicentang | Rekomendasi | Bukti |
|---|---|---|
| Filter berdasarkan requirement sumber | Centang | Filter "All source requirements" di `/training` (ditambahkan 29 Sep 2026) |
| DoD akhir | Centang setelah QA live | — |

### Implementasi People Dashboard

| Item belum dicentang | Rekomendasi | Bukti |
|---|---|---|
| Search employee | Centang | `/dashboard` |
| Filter position | Centang | `/dashboard` |
| Filter periode | Centang | `/dashboard` |
| Tampilkan periode | Centang | Periode sumber tampil di bawah skor KPI dan Performance di tabel, serta di profile |
| Tampilkan total KPI | Centang | Kolom Total KPI + profile |
| Tampilkan 5 Core KPI | Centang | `/dashboard/employee/[id]` |
| Empty state | Centang | Empty di tabel dan tiap blok profile |
| Validation state | **Hapus item / tandai N/A** | Dashboard tidak punya form input. Usulkan hapus item ini dengan komentar alasan |
| Milestone M3 | Centang | — |

### Security / Final

Biarkan terbuka sampai QA live selesai. Item yang bisa dibuktikan sekarang: API tidak memakai service role key, error 500 tidak membocorkan detail SQL, `.env.local` tidak di-commit.

## To Do List UI/UX

Kartu **Design Competency Gap & Development Requirement**, **Design Training**, **Design Dashboard**, dan **UI Consistency / Handoff** masih 0%. Foundations dan komponen V2 sudah ada di file Figma PISD – D4 V2 (board `00 Foundations & Components`: Button, Status Badge, Source Chip, Row Action Trigger, Menu Item, Toast, Metric Card, Form Field, Sidebar, Topbar, Pagination). Frame layar 13–34 belum dibangun karena batas panggilan Figma MCP. Centang item layar hanya setelah frame-nya ada dan node id-nya ditempel sebagai komentar kartu.

## Done

Kartu **Design Performance Evaluation & KPI Scorecard** ada di Done tetapi 4 item belum dicentang:

| Item | Rekomendasi |
|---|---|
| Buat search/filter | Selesaikan di frame 01 dan 08 (Filter Bar) lalu centang |
| Desain validation jika total bobot tidak valid | Selesaikan di frame 10 lalu centang |
| Jangan membuat indikator achieved… | Centang setelah frame 09–12 dicek tidak memuat label achieved |
| DoD | Centang terakhir |

Sampai keempatnya selesai, **pindahkan kartu kembali ke Doing/Proses** supaya status board jujur.
