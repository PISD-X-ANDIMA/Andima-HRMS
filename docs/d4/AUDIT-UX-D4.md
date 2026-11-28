# AUDIT-UX-D4 · Audit UI/UX, flow, dan traceability D4 V2

Tanggal: 30 Sep 2026 · Branch: `feature/d4-v2-d2-style` · Cakupan: FR-D4-001 s.d. FR-D4-006 (Docmost), board Planka D4, catatan VN asistensi (K1–K9), web D4 V2, dan Figma `blDVBM6m8VC02A7PvouX4F`.

Prinsip audit: **dokumen FR adalah sumber kebenaran**. Apa pun yang tidak ada di FR dihapus dari UI, API, dan Figma. Apa yang ada di FR tapi belum ada di sistem dicatat sebagai sisa pekerjaan, bukan ditambal diam-diam.

## 1. Dasar teori yang dipakai

| Teori | Inti | Dipakai untuk menilai |
|---|---|---|
| Nielsen, 10 usability heuristics (1994) | Visibility of status, match with real world, user control, consistency, error prevention, recognition over recall, minimalist design, error recovery | Seluruh layar; khususnya state (loading/empty/error), label istilah HR, dan validasi form |
| Norman, *The Design of Everyday Things* — gulf of execution/evaluation, affordance, mapping | Pengguna harus tahu *apa yang bisa dilakukan* dan *apa hasilnya*; kontrol yang terlihat bisa dipakai harus benar-benar berfungsi | Filter yang tidak pernah menghasilkan data, pilihan role KPI yang seharusnya otomatis, link prototype yang putus |
| Cognitive Load Theory (Sweller) dan batas memori kerja (Miller, Cowan ±4 chunk) | Kurangi beban ekstrinsik: informasi yang tidak dibutuhkan tugas membebani pengguna | Form evaluasi 7 aspek, metric card agregat, kolom tabel yang terjepit |
| Hick–Hyman law | Waktu memilih naik logaritmik dengan jumlah pilihan | Menu ⋮ dibatasi 3–4 aksi (VN K2) |
| Fitts's law | Target kecil dan jauh lebih lambat dan rawan salah klik | Target klik minimal 40 px, tombol primer di posisi tetap (kanan atas, kanan bawah modal) |
| Shneiderman, 8 golden rules | Konsistensi, feedback informatif, dialog yang menutup, pembalikan aksi, kurangi beban memori | Pola Detail/History yang sama di semua fitur (K3), toast sukses, riwayat revisi alih-alih overwrite |
| ISO 9241-110:2020 (dialogue principles) | Suitability for the task, self-descriptiveness, conformity with user expectations, error tolerance, controllability | Form hanya berisi field tugas; error inline dan ringkasan; Esc/Cancel selalu tersedia |
| ISO 9241-210:2019 (human-centred design) | Desain berbasis konteks pengguna nyata, iteratif dengan evaluasi | Siklus audit → perbaikan → verifikasi di preview dan Figma |
| Humanistic / value-sensitive design (Friedman), prinsip HR yang etis | Sistem penilaian orang tidak boleh mengambil keputusan otomatis, harus transparan, adil, dan menjaga privasi | Tidak ada label tercapai/tidak tercapai, tidak ada keputusan otomatis dari skor, nama asli tidak ditampilkan di data contoh, training *Completed* tidak menutup gap otomatis |
| WCAG 2.2 AA | Kontras, fokus, tidak bergantung warna saja, pesan error terhubung | Badge status bertitik + teks, `aria-invalid`, fokus terkunci di modal |

## 2. Temuan dan perbaikan

Status: ✅ diperbaiki dan diverifikasi · ⏳ sisa, butuh keputusan di luar tim.

### 2.1 Flow yang tidak natural

| # | Temuan | Teori yang dilanggar | Perbaikan | Status |
|---|---|---|---|---|
| F1 | Form evaluasi meminta 7 aspek berbobot + review status manual, padahal FR-D4-001 hanya meminta hasil evaluasi, catatan, evidence | Cognitive load, ISO 9241-110 *suitability for the task* | Form hanya: Employee, Period, Evaluation date, Evaluator, **Hasil evaluasi 1–5** berlabel, Catatan (wajib), Evidence | ✅ `41d44b8` |
| F2 | Ada `Save Draft` dan `Save`, padahal FR tidak mengenal draft; pengguna harus menebak bedanya | Hick, Nielsen #4 consistency | Satu tombol simpan per form | ✅ `41d44b8` |
| F3 | Role KPI dipilih manual, padahal FR-02.1 menyatakan KPI mengikuti position; pengguna bisa memilih KPI jabatan lain | Norman (affordance palsu), error prevention | Field **KPI jabatan** read-only, diturunkan dari position; server menolak bila tidak cocok | ✅ `41d44b8` |
| F4 | Halaman katalog KPI `/kpi/catalog` berdiri sebagai halaman sendiri tanpa FR | Minimalist design, K9 (jumlah fitur membingungkan) | Halaman dihapus; katalog hanya dipakai form | ✅ `41d44b8` |
| F5 | People Dashboard mencampur periode berbeda dalam satu baris dan menampilkan metric card agregat (di luar lingkup #12) | Match with real world, cognitive load | Satu baris = satu employee pada satu periode (FR-06.1); metric card agregat dihapus | ✅ `41d44b8` |
| F6 | Profil employee tidak bisa ganti periode; scorecard tidak valid tetap ditampilkan seolah benar | Visibility of status, error tolerance | Pemilih periode + peringatan bila 5 KPI/bobot 100% tidak terpenuhi (frame 36) | ✅ `41d44b8` |
| F7 | Filter status Performance menawarkan "Draft" yang tidak pernah bisa ada | Norman (kontrol yang tidak berfungsi), Nielsen #8 | Opsi Draft hanya muncul bila masih ada data draft lama | ✅ `49467b5` |
| F8 | Di 1280 px kolom Employee dashboard terjepit (≈60 px) sehingga nama menimpa kolom Position | Fitts, WCAG reflow, K4 | Kolom sekunder (Position, Open dev.) disembunyikan di bawah 1400 px di web (`Column.secondary`) dan di Figma frame 28 | ✅ `49467b5`, Figma |
| F9 | ⋮ membuka panel quick view lebih dulu, lalu aksi ("kerja dua kali") | Hick, Shneiderman (kurangi langkah) | ⋮ langsung membuka 3–4 aksi | ✅ V2 |
| F10 | Detail tiap fitur berbeda (modal, popover, page) | Consistency, conformity with expectations | Detail dan History selalu route sendiri dengan breadcrumb dan Back | ✅ V2 |

### 2.2 Konten dan etika data

| # | Temuan | Perbaikan | Status |
|---|---|---|---|
| E1 | Data contoh memakai nama staf asli di samping skor | Semua diganti placeholder (Alfa … Holly, Mercury) di web, fixture, dan Figma | ✅ |
| E2 | Label peran "HR Manager" menunjuk jabatan orang tertentu | Menjadi "HR" | ✅ |
| E3 | Risiko keputusan otomatis dari skor | Tidak ada label tercapai, tidak ada ambang, training Completed tidak menutup gap otomatis | ✅ |

### 2.3 Figma

| # | Temuan | Perbaikan | Status |
|---|---|---|---|
| G1 | Teks kolom lebar menimpa kolom sebelahnya (frame 11, 15, 17–19, 21–23, 27, 36) | Teks mengisi sel, maksimal 2 baris dengan elipsis | ✅ |
| G2 | Kolom Source di Development Requirement lebih sempit dari chip-nya | Kolom Source 280 px | ✅ |
| G3 | Link prototype 14 → 18 putus setelah frame 18 dibangun ulang | Dipulihkan; tidak ada link yang menunjuk frame terhapus | ✅ |
| G4 | Frame 09/10/18 masih berlabel "(HR Manager)" | Menjadi "(HR)" | ✅ |

### 2.4 Integritas logika (audit ulang 30 Sep 2026, malam)

Aturan dipusatkan di `modules/d4/shared/rules.ts`, lalu dipakai oleh form (UI), fixture source (preview), dan route API. Dengan begitu mode preview dan live menolak input yang sama.

| # | Temuan | Dasar | Perbaikan | Status |
|---|---|---|---|---|
| L1 | Default tanggal/periode memakai UTC (`toISOString`); form yang dibuka sebelum 07.00 WIB terisi tanggal kemarin, dan di tanggal 1 terisi periode bulan lalu | Error prevention (Nielsen #5) | `localToday()`/`localMonth()` berbasis `Asia/Jakarta` | ✅ |
| L2 | Evaluasi/scorecard kedua untuk employee + periode yang sama tersimpan diam-diam, lalu data yang tampil berganti tanpa jejak | FR-01.4 / FR-02.9 (riwayat tidak ditimpa), visibility of status | Form menampilkan peringatan dan meminta centang **Simpan sebagai revisi**; payload membawa `revisionOf` (id record terbaru). Server dan fixture menolak bila record sudah ada tetapi `revisionOf` tidak sesuai. Riwayat diberi label "Revisi n" | ✅ |
| L3 | Field Evaluator bisa diketik bebas, sehingga nama evaluator bisa dipalsukan | Akuntabilitas audit trail | Evaluator read-only = user yang login; server mengambil nama dari `d3_user_access.employee_id` dan mengabaikan nilai body | ✅ |
| L4 | Penilai bisa menilai dirinya sendiri (daftar employee memuat dirinya) | Konflik kepentingan | Daftar employee di form Evaluasi dan KPI tidak memuat user yang login; server menolak `employeeId` = diri sendiri. Fixture Mercury kini dievaluasi oleh "Oscar" | ✅ |
| L5 | Training bisa dibuat untuk requirement yang sudah Completed; requirement bisa di-Completed-kan saat training masih berjalan tanpa peringatan | Konsistensi status | Form training hanya menampilkan requirement yang belum Completed; server/fixture menolak. Update Status Completed menampilkan peringatan jumlah training Planned/In Progress. Sejak 13 Nov 2026 Update Status dihapus: Completed hanya lewat Meets requirement atau Close as Met (ALUR-PENGGUNAAN-D4 §2.5) | ✅ |
| L6 | Satu gap kompetensi bisa dibuatkan beberapa requirement terbuka; nilai gap saat requirement dibuat tidak tercatat | Duplikasi data, traceability | Opsi gap yang sudah punya requirement terbuka dinonaktifkan ("sudah ada requirement terbuka"); aksi Create di Competency Gap disembunyikan bila semua gap sudah tertangani; server menolak duplikat. Notes otomatis menyimpan "Gap saat dibuat (tanggal): … level X dari min. Y" | ✅ |

### 2.5 Konsistensi UI (audit ulang 30 Sep 2026, malam)

| # | Temuan | Perbaikan | Status |
|---|---|---|---|
| U1 | Label campur: "Penilai"/"Tanggal penilaian" di KPI vs "Evaluator"/"Evaluation date" di Performance; tombol "New Scorecard"/"New Evaluation" vs pola `+ Add …` | Seragam **Evaluator** dan **Evaluation date** di form, detail, dan history; tombol **Add Scorecard** / **Add Evaluation**; judul modal KPI "Add Scorecard" | ✅ |
| U2 | Item sidebar modul squad lain (General Dashboard, POS, CRM, MID, Settings) terlihat seperti link tetapi tidak bisa diklik | Diredupkan (opacity 50 %), `cursor-not-allowed`, `aria-disabled`, tooltip "Modul squad lain — belum terhubung" | ✅ |
| U4 | Status training bisa mundur (Completed → Planned, Cancelled → Planned) tanpa alasan | Rollback mewajibkan **Alasan perubahan** (UI, fixture, server); alasan tersimpan di versi | ✅ |

### 2.6 Sisa (butuh keputusan PO/Back End)

| # | Item | Alasan belum |
|---|---|---|
| O1 | KPI mengikuti position **pada periode** penilaian | Butuh riwayat position per periode dari D3 |
| O2 | Migrasi katalog KPI V5.1 + `definition_version` | Mengubah Supabase bersama; perlu persetujuan |
| O3 | Sales Admin memakai KPI Sales & Marketing | V5.1 tidak punya role Sales Admin |
| O4 | HR Associate belum punya KPI di V5.1 | Form menolak simpan dengan pesan "Belum tersedia untuk position ini" |
| O5 | Label Planka Front End / Back End menggantikan "WebDev" | **Selesai 30 Sep 2026**: label peran Front End, Back End, UI/UX, QA, PO, Bug dipasang; lihat PLANKA-D4 |
| O6 | Penjelasan relasi FR-D4-003 ↔ FR-D4-004 di Docmost | Draft di `drafts/docmost/02-…`, Docmost read-only |
| O7 | (L7) Manager melihat dan menilai **semua** employee, bukan hanya bawahannya | Butuh data atasan/`supervisor_id` dari D3 dan keputusan PO tentang cakupan Manager; RLS saat ini hanya membatasi EMPLOYEE |
| O8 | (U3) Kolom `review_status` masih diisi "Needs Review" untuk setiap evaluasi padahal FR-D4-001 tidak mengenal review status | Kolom `NOT NULL` + `CHECK` di migrasi `20260928052350`; menghapusnya butuh migrasi di Supabase bersama (tidak boleh tanpa persetujuan). UI sudah tidak menampilkannya |
| O9 | Aturan satu-record-aktif-per-periode (L2) dan satu-requirement-terbuka-per-gap (L6) baru ditegakkan di aplikasi | Unique/partial index di database butuh migrasi; tanpa itu dua request bersamaan masih bisa lolos |
| O10 | Masukan wawancara: palet Galaxy/ungu/pink, relasi KPI ↔ capability | Dijadwalkan setelah perbaikan ini, sesuai arahan tim |

## 3. FR-D4-004 dalam satu paragraf (VN K8)

Development Requirement (FR-D4-004) adalah **jembatan** antara temuan dan tindakan. Competency Gap (FR-D4-003) hanya menyatakan fakta — skill yang dibutuhkan position belum terpenuhi. Development Requirement mencatat keputusan manusia bahwa gap itu (atau perubahan position, atau konteks evaluasi) perlu ditindaklanjuti, dengan objective dan prioritas. Training (FR-D4-005) lalu selalu merujuk satu requirement. Karena itu FR-D4-004 berdiri sebagai menu sendiri: tanpa lapisan ini, training akan terhubung langsung ke skor atau gap dan sistem terlihat seperti mengambil keputusan otomatis. Rantai source chip Gap → Requirement → Training adalah wujud FR-D4-007 (traceability).

## 4. Traceability FR → web → Figma → Planka

| FR | Web (route) | API | Figma | Kartu Planka |
|---|---|---|---|---|
| FR-D4-001 Performance Evaluation | `/performance`, `/performance/[id]`, `/performance/history/[employeeId]` | `performance-evaluations` | 01–07, 30–34 | Implementasi Performance Evaluation; Design Performance Evaluation & KPI Scorecard |
| FR-D4-002 KPI Scorecard | `/kpi`, `/kpi/[id]`, `/kpi/history/[employeeId]` | `kpi-assessments`, `kpi-catalog` | 08–12 | Implementasi KPI Scorecard; Design Performance Evaluation & KPI Scorecard |
| FR-D4-003 Competency Gap | `/competency`, `/competency/[employeeId]`, `/competency/[employeeId]/history` | `competency-assessments` | 13–16 | Implementasi Competency Gap & Development Requirement; Design Competency Gap & Development Requirement |
| FR-D4-004 Development Requirement | `/development`, `/development/[id]`, `/development/[id]/history` | `development-needs` | 17–20 | idem |
| FR-D4-005 Training Tracking | `/training`, `/training/[id]`, `/training/[id]/history` | `training-records` | 21–25 | Implementasi Training; Design Training Completion Tracking |
| FR-D4-006 People Dashboard | `/dashboard`, `/dashboard/employee/[id]` | `snapshot` | 26–29, 35, 36 | Implementasi Dashboard; Design Dashboard KPI Orang |
| Lintas fitur | state, permission, responsif | `_lib` (auth, error envelope) | 00, 28–34 | UI Consistency Review, Handoff & Final Design Validation; Security |

## 5. Aturan centang Planka

Item dicentang hanya bila ada bukti yang bisa dibuka (commit, route, frame Figma). Item yang butuh data asli, keputusan PO, atau proses tim **tidak** dicentang. Hasil 30 Sep 2026 (131 item):

| Kartu | Dicentang | Sengaja dibiarkan terbuka |
|---|---|---|
| Implementasi Training | Filter requirement sumber | — |
| Implementasi Dashboard | Search, filter position/periode, periode, total KPI, 5 Core KPI, empty state, validation state | — |
| Implementasi Competency Gap & Development Requirement | History saat pindah position, list, source perubahan position, konteks evaluasi, history, filter | — |
| Implementasi KPI Scorecard | 5 Core KPI sesuai position, bobot, KPI position lain tidak tampil | Position **pada periode** (O1), KPI definition reference (O2) |
| Implementasi Performance Evaluation | Rencana training sebagai konteks, success state | DoD yang butuh QA di data asli |
| Security | Credential/token tidak ada di source | — |
| Design Performance Evaluation & KPI Scorecard | Search/filter, validasi bobot (frame 10), tanpa label achieved, cakupan field & state | — |
| Design Dashboard KPI Orang | Seluruh 25 item (frame 26–29, 35, 36; loading/error memakai pola bersama frame 30/32) | — |
| Design Training Completion Tracking | 20 item (frame 21–25, 31, 32, 34) | Validation state (belum ada frame validasi training) |
| Design Competency Gap & Development Requirement | 28 item (frame 13–20) | "Empty, validation, success, error state" Development (belum ada frame validasi requirement) |
| UI Consistency Review, Handoff & Final Design Validation | 33 item (audit ini, UI-D4-001, frame 00 dan 28–36) | Handoff formal ke Webdev, konfirmasi readiness ke PO/QA, "semua fitur MVP punya desain final" — butuh persetujuan orang, bukan bukti artefak |

Pembaruan 30 Sep 2026 (sore): board ditata ulang mengikuti D1/D3 — nama kartu berawalan peran, label disamakan dengan D1 (HIGH/MEDIUM PRIORITY, @PO/@WebDev/@UI/UX/@QA, FRONTEND/BACKEND), deskripsi berformat Source Requirement/Scope/Dependency/Out of Scope/Evidence/PIC, komentar progress per kartu, dan centang tambahan berbukti (Security: error generik & log `[d4-api]`, pattern konsisten, badge data fiktif; Setup Foundation: fixture vs baseline, dependency terdokumentasi; Setup User Flow DoD 3 item; Finalisasi Scope DoD 5 item; Test Plan 4 item via TEST-PLAN-D4). Detail per kartu di PLANKA-D4 §4.

## 6. Verifikasi

- `npx tsc --noEmit`, `npx eslint modules/d4`, `npm run build`: lulus.
- Perbaikan L1–L6, U1, U2, U4 (30 Sep 2026 malam): typecheck dan eslint lulus; aturan di `shared/rules.ts` diuji dengan skrip Node (9 kasus lulus, termasuk 23.30 UTC → tanggal WIB berikutnya); alur preview diuji di browser: notice + centang revisi → riwayat "Revisi 2", evaluator read-only, Mercury tidak ada di daftar employee, opsi gap tertangani nonaktif, requirement Completed tidak muncul di form training, peringatan training terbuka saat Completed, rollback Cancelled → Planned ditolak tanpa alasan.
- Preview (fixture) 1280 px: dashboard 6 kolom, tanpa scroll horizontal; 1440 px: 8 kolom.
- Figma: pemindaian otomatis tidak menemukan isi sel yang lebih lebar dari selnya, tidak ada link prototype yang putus, dan tidak ada teks "Maya"/"HR Manager".
