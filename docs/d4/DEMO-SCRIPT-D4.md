| Field | Value |
| --- | --- |
| **Document ID** | DEMO-SCRIPT-D4 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Skrip Show & Tell (demo minggu 5) |
| **Version** | 1.2 |
| **Status** | Draft for Review |
| **Date** | 6 Okt 2026 (v1.0: 3 Okt 2026; v1.2: UI berbahasa Inggris, font Poppins) |
| **Author** | Implementer D4 |
| **Derived From (Parents)** | FR-D4-001 s.d. FR-D4-006; RN-D4-001; API-D4-001 |
| **Related** | TEST-ACCOUNTS-D4; CODE-FREEZE-D4; TEST-PLAN-D4; `scripts/smoke-d4.mjs` |

## 1. Tujuan dan format

Demo ini menunjukkan alur D4 dari penilaian sampai tindak lanjut pengembangan, dalam satu cerita: **evaluasi → scorecard KPI → gap kompetensi → kebutuhan development → training → ringkasan di dashboard**. Durasi target 11 menit, maksimal 12 menit, dengan tiga sudut pandang peran.

| Item | Nilai |
| --- | --- |
| Build yang didemokan | `feature/d4-v2-d2-style` @ `bcb92d8` (lihat CODE-FREEZE-D4) |
| Mode utama | Live (`NEXT_PUBLIC_D4_DATA_MODE=supabase`) dengan tiga akun dari TEST-ACCOUNTS-D4 |
| Mode cadangan | Fixture (`NEXT_PUBLIC_D4_DATA_MODE=fixture`, `next dev`), data fiktif, login lokal dengan email dan password apa pun yang formatnya valid |
| Presenter | Implementer D4 (layar), PO D4 (narasi bisnis dan menjawab pertanyaan) |
| Placeholder orang | Mercury = akun HR, Bravo = akun MANAGER, Alfa = akun EMPLOYEE, Holly = employee yang belum dievaluasi |

Nama yang tampil di mode live berasal dari `d3_employee`. Dalam skrip ini nama tersebut disebut "employee demo". Nama di kolom fixture adalah data fiktif bawaan aplikasi.

## 2. Checklist sebelum demo

### 2.1 H-1

| # | Cek | Cara | Lulus jika |
| --- | --- | --- | --- |
| 1 | Build beku | `git rev-parse --short HEAD` di checkout demo | `bcb92d8`, atau hotfix yang sudah disetujui sesuai CODE-FREEZE-D4 |
| 2 | Kualitas kode | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` | Semua lulus |
| 3 | Akun | Login HR, MANAGER, dan EMPLOYEE satu per satu | Masuk ke `/dashboard` dengan label peran yang benar di topbar |
| 4 | Akun terhubung ke employee | Panggil `GET /api/d4/me` per akun, atau baris `/api/d4/me` di smoke test | `employee` tidak `null`. Untuk HR dan MANAGER, employee-nya bukan target demo |
| 5 | Smoke API | `npm run smoke:d4`, lalu `npm run smoke:d4 -- --probe` | 0 FAIL. Jangan menjalankan `--write` pada data demo |
| 6 | Data demo ada | Buka kelima menu sebagai HR | Ada minimal satu employee dengan evaluasi, scorecard, development requirement, dan training. Seed `[seed-d4]` menyiapkan tiga employee pertama (urut nama), tetapi tidak membuat competency assessment |
| 7 | Satu employee "kosong" untuk input live | Performance Evaluation, filter status "Not Evaluated" | Ada employee tanpa evaluasi periode berjalan, dan posisinya punya KPI jabatan |
| 8 | Requirement kompetensi | Competency Gap, kolom Requirement | Employee demo punya Requirement > 0 dan minimal satu baris Gap |
| 9 | Katalog KPI | Buka `/performance` (Performance & KPI) | Tidak muncul peringatan "Katalog KPI di database masih …". Jika muncul, migrasi V5.1 belum diterapkan; putuskan bersama PO apakah demo jalan dengan katalog lama |
| 10 | Fallback siap | `NEXT_PUBLIC_D4_DATA_MODE=fixture npm run dev` di laptop presenter | Badge "Preview · sample data" muncul dan kelima menu terisi |

### 2.2 T-30 menit

| # | Cek |
| --- | --- |
| 1 | Jalankan aplikasi (`npm run build && npm run start`, atau URL staging jika sudah ada) |
| 2 | Siapkan tiga profil browser terpisah (profil biasa, profil kedua, dan jendela incognito). Login HR, MANAGER, dan EMPLOYEE masing-masing di satu profil supaya tidak perlu logout saat berganti peran |
| 3 | Di profil HR, buka tab `/performance`, `/competency`, `/development`, `/training`, `/dashboard` sesuai urutan |
| 4 | Zoom browser 110–125%, tutup DevTools, matikan notifikasi OS |
| 5 | Siapkan terminal berisi hasil `npm run smoke:d4 -- --probe` untuk segmen EMPLOYEE (bukti 403 dari server) |
| 6 | Catat nama employee demo dan employee "kosong" di kertas, bukan di repo |

### 2.3 T-5 menit

Refresh setiap tab (sesi masih aktif), lalu pastikan topbar menampilkan peran yang benar di tiap profil dan koneksi internet stabil.

## 3. Pembagian waktu

| Segmen | Peran | Halaman | Durasi | Kumulatif |
| --- | --- | --- | --- | --- |
| Pembuka | HR | `/dashboard` (landing) | 0:30 | 0:30 |
| 1 | HR | Performance Evaluation | 1:45 | 2:15 |
| 2 | HR | KPI Scorecard | 1:45 | 4:00 |
| 3 | HR | Competency Gap | 1:30 | 5:30 |
| 4 | HR | Development Requirement | 1:15 | 6:45 |
| 5 | HR | Training Tracking | 1:15 | 8:00 |
| 6 | HR | People Dashboard | 1:00 | 9:00 |
| 7 | MANAGER | Performance Evaluation → People Dashboard (sekilas) | 0:45 | 9:45 |
| 8 | EMPLOYEE | Kelima halaman, read-only | 1:15 | 11:00 |
| Penutup | – | Ringkasan dan tanya jawab | 0:30 | 11:30 |

Jika waktu mepet, persingkat segmen 7 menjadi satu kalimat dan langsung ke segmen 8.

## 4. Skrip per langkah

Setiap langkah menyebut data untuk mode live (seed) dan mode fixture. Kolom "Fallback" berisi tindakan jika langkah tersebut gagal di layar.

### 4.0 Pembuka (HR, 0:30)

| Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- |
| Tampilkan profil HR yang sudah login di `/dashboard` | Topbar: nama employee akun HR dan label peran HR. Sidebar: enam menu D4 | "D4 mencatat kinerja dan pengembangan karyawan. Kami akan mengikuti satu karyawan dari evaluasi sampai training, lalu melihat hasilnya dari sisi manager dan karyawan." | Sesi habis: login ulang dari `/login` (±15 detik). Login gagal total: pindah ke mode fixture (§5) |

### 4.1 Performance Evaluation (HR, 1:45)

| # | Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- | --- |
| 1 | Menu **Performance Evaluation** | Filter: All positions, All departments, All periods, All status. Tabel Employee, Position, Department, Period, Notes, Evaluator, Status. Live: tiga employee seed berstatus Completed untuk periode seed. Fixture: tujuh evaluasi periode Sep 2026 (Alfa, Bravo, Charlie, Mercury oleh Oscar, Delta, Echo, Fanta). Holly "Not Evaluated" | "Satu baris per karyawan, menampilkan evaluasi terakhirnya. Periode lama tidak pernah ditimpa." | Tabel kosong: cek filter (tombol reset), lalu cek apakah seed sudah diterapkan |
| 2 | **Add Evaluation** | Modal: Employee, Position dan Department (otomatis), Period (bulan), Evaluation date, Evaluator (otomatis, read-only), Evaluation notes (wajib), Evidence / reference. Tidak ada field skor | "Penilai diisi otomatis dari akun yang login, jadi tidak bisa dipalsukan. Evaluasi kinerja berisi catatan; penilaian angka dilakukan di KPI Scorecard." | – |
| 3 | Pilih employee "kosong" (fixture: **Holly**), Period bulan berjalan, Evaluation notes "Period target met; administration needs strengthening." → **Save Evaluation** | Toast "Performance evaluation saved." Baris Holly menjadi Completed dan kolom Notes terisi | "Begitu disimpan, data langsung jadi riwayat." | 422 "for this period already exists": centang konfirmasi revisi yang muncul, atau pilih employee lain. 403 "not linked to an employee record": akun HR belum punya `employee_id`, lanjut ke fixture |
| 4 | Menu ⋮ pada baris employee demo → **View History** | Daftar evaluasi per periode beserta label revisi. Header: posisi · ID · departemen; tombol **Add Evaluation** juga tersedia di halaman ini | "Kalau ada koreksi, kami simpan sebagai revisi baru, bukan menimpa yang lama. Jejak audit tetap utuh." | Lewati jika waktu habis |

Catatan untuk presenter: evaluasi kinerja sekarang hanya berupa catatan; skor ada di KPI Scorecard (langkah 4.2). Evaluasi lama (termasuk seed) masih menyimpan skor di database, tetapi tidak ditampilkan.

### 4.2 KPI Scorecard (HR, 1:45)

| # | Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- | --- |
| 1 | Menu **KPI Scorecard** | Tabel Employee, Position, Department, KPI Role, Period, Total Score, Status. Fixture: Alfa, Sep 2026, total 4.10 / 5, dan Jun 2026. Live: scorecard seed untuk tiga employee | "Setiap posisi punya lima Core KPI dari KPI Scorecard V5.1, dengan total bobot 100%." | Muncul peringatan katalog lama: katakan "migrasi katalog V5.1 dijadwalkan", lalu lanjut |
| 2 | Buka scorecard Alfa (fixture) atau employee demo (live) | Tabel "Core KPI": lima indikator, Weight, Target, Actual, Score, Weighted, Comment. Kartu "Scorecard summary". Fixture Alfa: skor 4, 5, 4, 3, 4 dengan bobot 25/25/20/15/15 | "Skor 1–5 diisi atasan secara manual. Sistem hanya menghitung nilai terbobot dan total; realisasi tidak dikonversi otomatis menjadi skor." | – |
| 3 | **Back**, **Add Scorecard** → pilih employee yang sama dengan langkah 4.1.3 | Modal 880 px. "Position KPI" dan Department terisi otomatis dari data karyawan, lima baris Core KPI terisi | "KPI tidak bisa dipilih bebas. Sistem mengambil KPI sesuai jabatan karyawan." | "KPIs for this position are not available": posisi tidak terpetakan di katalog. Batalkan, cukup tunjukkan scorecard yang sudah ada |
| 4 | Isi Skor kelima baris (mis. 4, 4, 3, 4, 5) → **Save Scorecard** | Toast "KPI scorecard saved." | "Total ini nanti muncul di dashboard bersama status evaluasi kinerja." | Simpan gagal: tutup modal dan lanjut. Data yang sudah ada cukup untuk cerita |

### 4.3 Competency Gap (HR, 1:30)

| # | Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- | --- |
| 1 | Menu **Competency Gap** | Kolom Employee, Position, Department, Requirement, Gap, Status (Met / Gap / Insufficient Data), Last saved. Fixture: Alfa berstatus Gap. Live: tergantung data D3 (requirement posisi dan skill employee) | "Kami membandingkan kemampuan karyawan dengan requirement posisinya. Datanya dari D3; D4 tidak mengubah master data." | Semua "Insufficient Data" atau Requirement "—": data skill/requirement D3 belum lengkap. Jelaskan aturannya, lalu tunjukkan di fixture jika perlu |
| 2 | Buka employee berstatus Gap (fixture: **Alfa**) | Kartu "Requirement vs capability": level dibutuhkan, level aktual, selisih, evidence, status dengan kalimat alasannya, dan development requirement penutup beserta statusnya per kompetensi. Notice: ketiadaan evidence ditandai Insufficient Data, bukan otomatis Gap | "Tanpa evidence, sistem tidak menyimpulkan Gap. Statusnya Insufficient Data. Gap juga tidak otomatis menugaskan training." | – |
| 3 | **Save Assessment** | Snapshot tersimpan, kolom "Last saved" terisi | "Hasil perbandingan disimpan sebagai snapshot, jadi kita tahu kondisi gap pada tanggal itu." | Gagal 422 (posisi tanpa requirement): lewati |
| 4 | Sebut menu ⋮ **Create Development Requirement** pada baris Gap (jangan diklik jika fixture Alfa sudah punya requirement terbuka) | – | "Dari sini HR bisa langsung membuat kebutuhan development yang sumbernya tercatat." | – |

Catatan: seed live tidak membuat competency assessment, jadi "Last saved" kosong sampai tombol Save Assessment ditekan.

### 4.4 Development Requirement (HR, 1:15)

| # | Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- | --- |
| 1 | Menu **Development Requirement** | Filter: All departments, All sources, All status, All periods. Fixture: Alfa "Raise administrative accuracy…" (High, Planned, sumber Competency Gap); Charlie (Medium, In Progress). Live: seed "Perkuat ketelitian dokumen operasional" (Performance Evaluation, Identified; isi data seed tetap bahasa Indonesia) | "Setiap kebutuhan development wajib punya sumber: gap kompetensi, perubahan posisi, atau hasil evaluasi." | Tabel kosong: buat satu lewat **Add Requirement** (Source type Performance Evaluation, Source reference = evaluasi dari langkah 4.1.3) |
| 2 | Buka requirement Alfa / employee demo | Kartu "Source (traceability)" yang tertaut ke sumbernya, dan "Linked training" | "Klik sumbernya dan kita kembali ke gap atau evaluasi asalnya. Inilah jejak kenapa training ini ada." | – |
| 3 | **Update progress in Training** → Update Progress ke **In Progress** → Save, lalu kembali ke requirement | Status requirement ikut menjadi In Progress dengan catatan "Mengikuti Training Tracking."; "Development Requirement history" bertambah satu | "Progres hanya ditulis di Training Tracking. Requirement mengikutinya, jadi tidak ada dua status yang bisa bertentangan." | Belum ada training: **Create Training** dulu (requirement menjadi Planned) |

### 4.5 Training Tracking (HR, 1:15)

| # | Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- | --- |
| 1 | Menu **Training Tracking** | Filter: All departments, All periods, All status. Fixture: "Administrative Accuracy Workshop" (Alfa, 8 Oct 2026, Planned), "Safety Operations Briefing" (Charlie, 1 Oct 2026, In Progress). Live: seed "Workshop Akurasi Dokumen & Administrasi" (Planned) | "Training selalu terhubung ke development requirement. Tidak ada training tanpa alasan." | Kosong: buka requirement yang masih terbuka di Development Requirement → **Create Training** (Training Tracking tidak punya tombol Add Training) |
| 2 | Buka training Alfa / employee demo → **Update Progress** → In Progress → **Save Progress** | Status In Progress dan entri baru di "Training history" | "Kalau status mundur, misalnya dari Completed ke Planned, alasan wajib diisi." | – |
| 3 | Tunjuk notice kuning | "A Completed training does not automatically mark the competency gap as met…" | "Selesai training tidak berarti gap tertutup. Gap baru tertutup setelah reassessment oleh manusia." | – |

### 4.6 People Dashboard (HR, 1:00)

| # | Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- | --- |
| 1 | Menu **People Dashboard** | Filter: All positions, All departments, Period (selalu satu periode, default periode terbaru, mis. Sep 2026). Kolom Employee, Position / Department, Period, Total KPI, Evaluation (Completed / Not Evaluated), Competency, Open dev., Training. Di bawah 1400 px kolom Position / Department dan Open dev. disembunyikan. Employee dari langkah 4.1–4.2 kini terisi | "Satu baris merangkum lima fitur tadi untuk periode yang sama. Dashboard tidak membuat data sendiri." | – |
| 2 | Buka profil employee demo (`/dashboard/employee/[id]?period=…`) | Header posisi · ID · departemen. Kartu KPI scorecard selebar penuh (dengan Weighted dan Total), Performance evaluation, Competency gap, Development & training | "Ini yang dibaca HR sebelum diskusi pengembangan karyawan." | Muncul peringatan scorecard tidak valid: scorecard lama dari katalog lama. Sebut bahwa dashboard menolak meringkas scorecard yang bobotnya bukan 100% |

### 4.7 MANAGER (0:45)

| Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- |
| Pindah ke profil browser MANAGER → **Performance Evaluation**, lalu **People Dashboard** | Label peran Manager di topbar. Tombol Add Evaluation dan Add Scorecard tersedia. Data sama dengan HR | "Manager bisa mencatat evaluasi dan scorecard untuk timnya. Di rilis ini manager masih melihat semua karyawan; pembatasan per tim masuk backlog." | Sesi MANAGER habis: login ulang, atau cukup jelaskan secara lisan |

### 4.8 EMPLOYEE (1:15)

| Klik | Data yang muncul | Yang diucapkan | Fallback |
| --- | --- | --- | --- |
| Pindah ke profil EMPLOYEE → klik cepat keenam menu sesuai urutan | Hanya satu baris, yaitu dirinya (fixture: Alfa). Tidak ada tombol Add, Save, atau Update | "Karyawan hanya melihat datanya sendiri, dari evaluasi sampai training, dan tidak bisa mengubah apa pun." | Data kosong: akun EMPLOYEE tertaut ke employee tanpa data D4. Gunakan fixture `NEXT_PUBLIC_D4_FIXTURE_ROLE=EMPLOYEE` |
| Tampilkan terminal hasil `npm run smoke:d4 -- --probe` | Baris EMPLOYEE POST = 403 PASS untuk ketujuh endpoint tulis | "Pembatasan ini juga ditegakkan di server dan di database (RLS), bukan hanya disembunyikan di layar." | Terminal tidak siap: sebut bahwa TC keamanan di TEST-PLAN-D4 dan tes otomatis `tests/d4/api.test.ts` mencakupnya |

### 4.9 Penutup (0:30)

"Satu alur utuh: evaluasi, KPI, gap, kebutuhan development, training, dan ringkasan di dashboard. Setiap perubahan tersimpan sebagai riwayat dan bisa ditelusuri ke sumbernya. Langkah berikutnya adalah staging, QA, dan pembatasan manager per tim."

## 5. Fallback umum

| Masalah | Tindakan | Waktu |
| --- | --- | --- |
| Supabase atau jaringan mati (pesan "The HRMS data service is unreachable right now", 503) | Hentikan server live, jalankan `NEXT_PUBLIC_D4_DATA_MODE=fixture NEXT_PUBLIC_D4_FIXTURE_ROLE=HR npm run dev`, dan lanjutkan dari langkah yang sama dengan data fixture | ±30 detik |
| Login gagal atau akun belum dipetakan | Sama seperti di atas | ±30 detik |
| Ganti peran di mode fixture | Peran dibaca saat server dev start: hentikan server, jalankan ulang dengan `NEXT_PUBLIC_D4_FIXTURE_ROLE=MANAGER` atau `EMPLOYEE` | ±20 detik |
| Satu halaman error | Lewati ke halaman berikutnya, ceritakan fitur tersebut secara lisan | – |
| Data hasil input hilang setelah reload (fixture) | Normal: data fixture hanya di memori. Jangan reload di tengah cerita | – |
| Semua gagal | Tunjukkan screenshot alur yang disiapkan H-1 (simpan di luar repo) | – |

Mode fixture hanya berjalan dengan `next dev`. `next start` atau build produksi selalu memakai mode live (`proxy.ts:8`, `app/(d4)/layout.tsx`).

## 6. Pertanyaan partner yang mungkin muncul

| # | Pertanyaan | Jawaban |
| --- | --- | --- |
| 1 | Apakah manager hanya melihat timnya? | Belum. Di rilis ini HR dan MANAGER membaca dan menulis data semua karyawan (RLS di migrasi D4). Pembatasan per tim membutuhkan relasi atasan–bawahan dari D3 dan masuk backlog. |
| 2 | Apakah evaluasi bisa diedit atau dihapus? | Tidak. Database tidak punya izin UPDATE/DELETE untuk data D4. Koreksi disimpan sebagai revisi baru yang menunjuk record sebelumnya, sehingga riwayat tetap utuh. |
| 3 | Bisakah atasan menilai dirinya sendiri? | Tidak. Server menolak evaluasi dan scorecard untuk diri sendiri. |
| 4 | Apakah skor KPI dihitung otomatis dari realisasi? | Tidak. Skor 1–5 diisi atasan. Sistem hanya menghitung nilai terbobot dan total dari bobot KPI Scorecard V5.1. |
| 5 | Dari mana daftar KPI per jabatan? | Dari tabel katalog `d4_kpi_role_catalog` (KPI Scorecard V5.1, lima Core KPI per jabatan, bobot 100%). KPI dipetakan otomatis dari posisi karyawan. |
| 6 | Apakah gap kompetensi otomatis memberi training? | Tidak. Gap hanya menjadi sumber development requirement yang dibuat HR atau manager secara sadar. |
| 7 | Apakah training berstatus Completed menutup gap? | Tidak. Gap tertutup setelah reassessment kompetensi. |
| 8 | Apa beda Gap dan Insufficient Data? | Gap berarti ada evidence dan levelnya di bawah requirement. Insufficient Data berarti evidence belum ada, sehingga sistem tidak menyimpulkan apa pun. |
| 9 | Bisakah karyawan mengisi self-assessment atau mengubah datanya? | Tidak di rilis ini. Karyawan read-only, dan server mengembalikan 403 untuk semua permintaan tulis. |
| 10 | Bagaimana keamanannya? | Ada tiga lapis: login Supabase, pengecekan peran di setiap API tulis, dan Row Level Security di database. Aplikasi hanya memakai publishable key, tanpa service key. |
| 11 | Apakah D4 mengubah data karyawan atau posisi di D3? | Tidak. D4 hanya membaca data D3 (karyawan, posisi, requirement, skill). Assess Position Change pun tidak mengubah posisi karyawan. |
| 12 | Apakah ada laporan agregat atau export? | Belum. Dashboard D4 sengaja per karyawan, tanpa metrik agregat manajemen, karena agregat berada di luar scope FR-D4-006. |
| 13 | Siapa yang mengubah data dan kapan? | Setiap record dan revisi menyimpan aktor dan waktu pembuatan, terlihat di halaman riwayat. |
| 14 | Kenapa evaluasi kinerja tidak punya skor? | Keputusan produk 6 Okt 2026: evaluasi kinerja berisi catatan, skor hanya di KPI Scorecard agar tidak ada dua angka penilaian untuk periode yang sama. |
| 15 | Kapan bisa dipakai di staging/produksi? | Setelah deployment staging dan eksekusi TEST-PLAN-D4 (milestone M4 di RN-D4-001). |

## 7. Risiko yang diketahui

| Risiko | Dampak saat demo | Mitigasi |
| --- | --- | --- |
| Seed tidak membuat competency assessment (`scripts/seed-d4.mjs`) | "Last saved" kosong; sumber perubahan posisi tidak tersedia | Tekan Save Assessment di langkah 4.3.3 |
| Seed bisa memilih KPI jabatan cadangan yang tidak cocok dengan posisi (`scripts/seed-d4.mjs:70`) | Scorecard seed tidak sesuai KPI posisi; revisi dari form ditolak | Pakai scorecard fixture, atau employee yang scorecard-nya sesuai |
| Seed bisa menilai employee milik akun seed sendiri (`scripts/seed-d4.mjs:48`) | Ada evaluasi "diri sendiri" di data | Jangan pakai employee tersebut sebagai contoh |
| Periode dan tanggal seed memakai UTC, aplikasi memakai WIB (`scripts/seed-d4.mjs:16-17`) | Di awal bulan, periode seed bisa berbeda satu bulan dengan default form | Pilih periode secara eksplisit |
| Migrasi katalog V5.1 belum diterapkan (`supabase/migrations/20260929150000_d4_kpi_catalog_v51.sql`) | Peringatan katalog di `/kpi`; KPI berbeda dari V5.1 | Cek H-1 nomor 9 |
| MANAGER tidak dibatasi per tim | Pertanyaan partner | Jawaban pertanyaan #1 |
| Belum ada staging | Demo dari laptop presenter | Cadangan fixture dan screenshot |
