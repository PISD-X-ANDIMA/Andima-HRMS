# OBJECTIVE-COMPETENCY-GAP: Objective fitur Competency Gap (Squad D4)

| | |
|---|---|
| **Status** | Draf, menunggu persetujuan user/PO. Bagian 2 (tampilan, Q15) dikerjakan 20 Okt 2026: lihat bagian 5a. |
| **Tanggal** | 20 Okt 2026 |
| **Dasar** | Revisi D4 20 Okt 2026, Prompt 9 bagian 1 |
| **Sumber** | Wawancara awal D4 bagian 4.4–4.8 dan 4.10; transkrip 14 Okt 2026 bagian 2 (00:23:06–00:25:28 dan 00:46:17–00:49:43); `supabase/seed/d4-simulasi-master.sql`; `modules/d4/shared/fixtures/reference-data.ts`; migrasi D4; aturan di `modules/d4/shared/rules.ts` dan `modules/d4/web/data/selectors.ts` |

Catatan mitra pada walkthrough 14 Okt 2026 (transkrip 00:46:18–00:47:29):
- Objective belum menjelaskan kompetensi mana yang kurang dan level berapa yang harus dicapai.
- Semua objective terlihat sama.
- Belum jelas apa yang menutup gap tersebut.

Dokumen ini menjawab catatan itu.

## 1. Tujuan

Competency Gap ada untuk **menutup kesenjangan kompetensi pegawai yang sedang trainee dan pegawai yang pindah atau naik posisi**. Fitur ini bukan development rutin.

- Gap kompetensi hanya muncul pada dua kasus (transkrip 00:23:06–00:23:45):
  - pegawai masih trainee
  - pegawai dipromosikan atau naik jabatan
- Development bersifat *need-based*: tidak dilakukan bila tidak ada gap terhadap kebutuhan posisi (wawancara 4.7).
- Pemicunya:
  - capability gap
  - perubahan posisi
  - perubahan tanggung jawab
  - requirement baru pada posisi
- Durasi trainee ditentukan HR (transkrip 00:24:09–00:24:15, "yang menentukan bagian HR"). Wawancara 4.4 menyebut 1 atau 3 bulan, transkrip menyebut 3 atau 6 bulan. Karena itu durasi **bukan** aturan sistem.

Hasil yang diharapkan: untuk tiap pegawai dalam cakupan, HR tahu empat hal:
- kompetensi mana yang kurang
- dari level berapa ke level berapa
- cara menutupnya dan siapa penanggung jawabnya
- apakah setelah training gap itu sudah tertutup

## 2. Siapa yang dinilai (cakupan)

Aturan di kode: `inTrainingOrPositionChange`, `modules/d4/web/data/selectors.ts`.

| Kasus | Syarat di sistem | Asal data |
|---|---|---|
| Trainee | Status kepegawaian `PROBATION` atau `INTERN` | Status diatur HR di akun pegawai (kolom employment status, migrasi `20261017120000`) |
| Perubahan posisi | Ada penilaian kompetensi berkonteks `role-change` dengan tanggal efektif dalam 6 bulan terakhir (`POSITION_CHANGE_SCOPE_MONTHS = 6`) | Penilaian disimpan HR lewat **Assess Position Change** |
| Requirement masih terbuka | Ada Development Requirement yang belum Completed | D4 |

Pegawai di luar ketiga kasus ini tidak masuk daftar Competency Gap untuk HR dan manager. Pegawai tersebut masuk cakupan setelah HR menyimpan Assess Position Change.

## 3. Kompetensi yang dinilai per posisi

### 3.1 Daftar kompetensi (data simulasi D4, walkthrough 14 Okt 2026)

Sumber: `supabase/seed/d4-simulasi-master.sql`. Kompetensi berkode `D4-SIM-*` di tabel D3 `d3_competencies`. Ini usulan D4 untuk walkthrough. Isinya bukan daftar resmi D3.

| Kode | Kompetensi | Kategori |
|---|---|---|
| S01 | Penerbitan dan pengendalian invoice | Technical |
| S02 | Rekonsiliasi pembukuan dan GL | Technical |
| S03 | Administrasi arsip keuangan dan dokumen | Technical |
| S04 | Pengelolaan kas dan likuiditas | Technical |
| S05 | Pelaporan dan kepatuhan pajak | Technical |
| S06 | Perencanaan strategi dan anggaran | Managerial |
| S07 | Kepemimpinan dan pengembangan tim | Managerial |
| S08 | Transformasi digital dan sistem informasi | Managerial |
| S09 | Administrasi kepegawaian dan payroll | Technical |
| S10 | Pengelolaan kinerja dan pengembangan SDM | Managerial |
| S11 | Negosiasi dan pengembangan penjualan | Technical |
| S12 | Penyusunan quotation dan administrasi order | Technical |
| S13 | Pengelolaan hubungan dan kepuasan pelanggan | Managerial |
| S14 | Pengembangan dan pemeliharaan aplikasi | Technical |
| S15 | Keamanan data dan infrastruktur TI | Technical |
| S16 | Analisis kebutuhan dan dukungan pengguna | Technical |

### 3.2 Level yang dibutuhkan per posisi

Sumber: seed yang sama, langkah 3 (`position_requirements`, semua `is_mandatory = true`). Skala level mengikuti D3. Seed memakai judul posisi B2. Kolom kedua menunjukkan judul yang sesuai di struktur organisasi APPROVED V1-2 (`01_ORG_MASTER`).

| Posisi (seed, judul B2) | Judul di struktur organisasi | Kompetensi dan level dibutuhkan |
|---|---|---|
| Accounting Associate (Billing) | Accounting Associate 1 (Billing), Accounting Associate 2 (Billing) | S01 Invoice **3** · S02 Rekonsiliasi dan GL **3** · S03 Arsip **2** |
| Cash Manager | Cash Manager | S04 Kas dan likuiditas **4** · S02 Rekonsiliasi dan GL **3** · S07 Kepemimpinan **3** |
| Cash Manager Associate | Cash Manager Associate | S04 Kas dan likuiditas **3** · S03 Arsip **2** · S02 Rekonsiliasi dan GL **2** |
| Director of Finance, Accounting & Digital Transformation | (sama) | S06 Strategi dan anggaran **4** · S07 Kepemimpinan **4** · S08 Transformasi digital **3** |
| Manager of Accounting | Manager of Accounting | S02 Rekonsiliasi dan GL **4** · S05 Pajak **3** · S07 Kepemimpinan **3** |
| Tax Manager | Tax Manager | S05 Pajak **4** · S02 Rekonsiliasi dan GL **3** · S07 Kepemimpinan **3** |
| Tax Associate | Tax Associate 1, Tax Associate 2 | S05 Pajak **3** · S03 Arsip **3** · S02 Rekonsiliasi dan GL **2** |
| Manager of Customer Success | Manager of Customer Success | S13 Hubungan pelanggan **4** · S07 Kepemimpinan **3** · S11 Negosiasi dan penjualan **3** |
| Sales Executive | Sales Executive 1, 2, 3 | S11 Negosiasi dan penjualan **3** · S12 Quotation dan order **3** · S13 Hubungan pelanggan **3** |
| Sales Administration Associate | Sales Administration Associate | S12 Quotation dan order **3** · S13 Hubungan pelanggan **2** · S03 Arsip **2** |
| HR Administrator | (tidak ada; struktur organisasi memakai HR Associate Officer 1–5) | S09 Kepegawaian dan payroll **3** · S10 Kinerja dan pengembangan SDM **3** · S03 Arsip **2** |
| Tim IT | (tidak ada di struktur organisasi) | S14 Aplikasi **3** · S15 Keamanan data **3** · S16 Analisis kebutuhan **2** |

Posisi di struktur organisasi yang **belum punya requirement**:
- Commissioner
- Director of Commercial & Strategic Client Partnerships
- Director of Human Capital & Culture
- HR Manager
- HR Associate Officer 1–5

Untuk posisi tanpa requirement, status tersimpan "Belum Ada Persyaratan" dan tampil sebagai **Insufficient Data**. Gap tidak bisa dihitung sampai requirement diisi (lihat bagian 6).

Contoh dari wawancara (4.8 dan 4.10) yang belum ada di daftar: Brevet A, Brevet B, Financial Audit, Tax Audit (Tax Manager), Dangerous Goods, dan kompetensi customs. Bila mitra setuju, contoh ini bisa menjadi requirement tambahan atau sertifikasi.

### 3.3 Data contoh di mode fixture (presentasi)

Mode fixture memakai daftar yang lebih ringkas. Pegawai, posisi, dan departemennya baris asli `01_ORG_MASTER` (Prompt 5). Kompetensi dan levelnya data demo.

| Posisi | Kompetensi (kategori) dan level dibutuhkan |
|---|---|
| Commissioner | Communication (Soft skill) **3** |
| Accounting Associate 1 (Billing) | Communication (Soft skill) **3** · Administrative Accuracy (Technical) **4** · Records Management (Technical) **3** |
| Sales Executive 1 | Sales & Negotiation (Technical) **3** |
| Sales Administration Associate | Administrative Accuracy (Technical) **3** |
| Manager of Customer Success | Sales & Negotiation (Technical) **3** |
| Tax Associate 1 | Tax Reporting & Compliance (Technical) **3** · Administrative Accuracy (Technical) **3** |
| Tax Manager | Tax Reporting & Compliance (Technical) **4** · Communication (Soft skill) **3** |
| Manager of Accounting | Administrative Accuracy (Technical) **4** · Records Management (Technical) **4** |
| HR Manager | HR Documentation (Technical) **3** |
| Director of Human Capital & Culture | Communication (Soft skill) **4** |

## 4. Alur fitur

```
Trainee (PROBATION/INTERN) atau perubahan posisi
  -> Penilaian kompetensi (Save Assessment / Assess Position Change, dengan Assessed with)
  -> Gap per kompetensi (Required vs Actual, dengan bukti)
  -> Development Requirement (objective "Naikkan X dari level a ke b", method, PIC, priority)
  -> Training (Planned -> In Progress -> Completed / Cancelled)
  -> Hasil training: Passed / Not Passed
  -> Reassessment: Retraining (buka lagi) atau Meets requirement (selesai)
```

| Langkah | Yang terjadi di D4 | Aturan |
|---|---|---|
| 1. Pemicu | HR menetapkan status trainee di akun pegawai. Untuk perubahan posisi, HR membuka **Assess Position Change** dan memilih posisi tujuan. | Tanpa salah satu pemicu, pegawai tidak masuk cakupan (bagian 2). |
| 2. Penilaian | **Save Assessment** (posisi aktif) atau **Assess Position Change** (posisi baru). Isian **Assessed with** dipakai untuk mencatat dengan siapa HR menilai: atasan atau departemen yang mengajukan kebutuhan pegawai (wawancara 4.5: evaluasi bersama pihak yang melakukan request). Hasilnya disimpan sebagai snapshot (`d4_competency_assessments`). | Snapshot menyimpan posisi saat dinilai, jadi riwayat tetap utuh setelah pegawai pindah posisi. |
| 3. Gap per kompetensi | Untuk tiap requirement posisi: level dibutuhkan dibandingkan level dimiliki dan bukti. Status: **Met** bila level ≥ dibutuhkan dan ada bukti; **Gap** bila level < dibutuhkan dan ada bukti; **Insufficient Data** bila level atau bukti belum ada. Sebelum penilaian posisi aktif disimpan, status keseluruhan **Not Evaluated**. | Bukti yang belum ada tidak otomatis menjadi Gap. Gap tidak otomatis menetapkan training, promosi, atau sertifikasi. |
| 4. Development Requirement | Dari baris Gap, HR memilih **Create Development Requirement**. Source: **Competency Gap** (posisi aktif) atau **Position Change**. Objective terisi otomatis dari gap dan masih bisa diubah: "Naikkan {kompetensi} dari level {a} ke {b}" (bila level belum ada: "Naikkan {kompetensi} ke level {b}"). HR juga mengisi **Priority** (Low / Medium / High), **Method**, dan **PIC**. | Gap dari posisi aktif hanya bisa dibuat setelah penilaian disimpan. Satu gap hanya punya satu requirement terbuka. Priority, method, dan PIC bisa diubah kemudian sebagai revisi. |
| 5. Training | Dari requirement, HR membuat training: aktivitas, tanggal, status **Planned → In Progress → Completed** atau **Cancelled**. | Training harus merujuk ke requirement milik pegawai yang sama dan masih terbuka. Tanggal training Completed tidak boleh di masa depan. |
| 6. Hasil training | Training **Completed** wajib punya hasil **Passed** atau **Not Passed**. | Not Passed membuat requirement tetap terbuka, lalu training diulang. Requirement bisa ditutup (Completed) tanpa training Passed hanya dengan alasan di Notes. |
| 7. Reassessment | Setelah requirement Completed, HR menilai ulang kompetensi (**Reassess Competency**, simpan penilaian baru) lalu mencatat keputusan (**Record Reassessment**): **Retraining** membuka requirement kembali sebagai Planned untuk training ulang; **Meets requirement** membuat requirement tetap Completed (nilai tersimpan sama dengan labelnya, keputusan Q11). | Training Completed atau requirement Completed **tidak** menutup gap. Gap tertutup hanya bila penilaian baru menunjukkan level terpenuhi. Dashboard memberi alert "Completed, gap masih terbuka" sampai keputusan reassessment dicatat. |

Alert di People Dashboard yang menjaga alur ini:
- **Gap tanpa development requirement**
- **Training Not Passed**
- **Completed, gap masih terbuka**
- **Tanpa PIC**

Contoh alur di data contoh (mode fixture):
- Bhumi: trainee, PROBATION.
- Desty, Tax Associate 1: dinilai untuk posisi Tax Manager bersama "Kak Dian, Tax Manager". Ini contoh Tax Officer -> Tax Manager dari wawancara 4.8.
- Mba Ena: training "Records Retention Workshop" Not Passed, untuk requirement "Naikkan Records Management dari level 3 ke 4".
- Kak Dian: gap Communication belum punya requirement.

## 5. Kompetensi penutup gap (metode development)

Kolom **Method** di Development Requirement adalah teks bebas (maks. 120 karakter). Saran di form: Training, Coaching, Mentoring, On-the-job training, Self-learning. Mitra juga menyebut internal training, external training, certification, dan coaching (transkrip 00:47:52–00:48:06), jadi "Certification" dan "External training" dapat diketik langsung.

Tabel berikut adalah **usulan** cara menutup gap per kompetensi. Kolom Sumber menunjukkan dasarnya. Baris berlabel "usulan D4" perlu dikonfirmasi mitra.

| Kompetensi | Method | Contoh aktivitas penutup gap | Sumber |
|---|---|---|---|
| S01 Penerbitan dan pengendalian invoice | On-the-job training | Alur invoice di ERP: input, revisi, closing invoice dan pembayaran | Wawancara 4.4 (OJT: workflow, ERP, Smart Accounting); tanggung jawab Accounting Associate di struktur organisasi |
| S02 Rekonsiliasi pembukuan dan GL | Training | Pelatihan rekonsiliasi bank dan GL, financial audit | Wawancara 4.8 dan 4.10 (Rekonsiliasi, Financial Audit) |
| S03 Administrasi arsip keuangan dan dokumen | On-the-job training | Pengelolaan dokumen pendukung dan arsip | Wawancara 4.4 (pengelolaan dokumen) |
| S04 Pengelolaan kas dan likuiditas | Coaching | Pendampingan oleh Cash Manager untuk transfer, petty cash, dan kas operasional | Usulan D4; tanggung jawab Cash Manager di struktur organisasi |
| S05 Pelaporan dan kepatuhan pajak | Certification, On-the-job training | Brevet A dan Brevet B, tax audit; OJT pengambilan data dari Coretax | Wawancara 4.4 (CORTEX/Coretax), 4.8, dan 4.10 (Brevet A/B, Tax Audit) |
| S06 Perencanaan strategi dan anggaran | Certification | Sertifikasi accounting | Transkrip 00:46:57 ("harus sertifikasi accounting misalnya") |
| S07 Kepemimpinan dan pengembangan tim | Mentoring | Pendampingan oleh atasan langsung atau direktur | Usulan D4 |
| S08 Transformasi digital dan sistem informasi | Training | Pelatihan ERP dan Smart Accounting | Wawancara 4.4 (ERP, Smart Accounting); usulan D4 untuk level manajerial |
| S09 Administrasi kepegawaian dan payroll | Training | Pelatihan administrasi kepegawaian dan data pendukung payroll | Usulan D4 |
| S10 Pengelolaan kinerja dan pengembangan SDM | Training | Pelatihan penilaian kinerja dan KPI | Usulan D4 |
| S11 Negosiasi dan pengembangan penjualan | Coaching | Pendampingan oleh Sales Executive atau Manager of Customer Success | Usulan D4; transkrip 00:48:43 (sales associate di-hire atas permintaan sales executive) |
| S12 Penyusunan quotation dan administrasi order | On-the-job training | Input permintaan pelanggan ke ERP, worksheet, dan Job Number | Wawancara 4.4 (job number, worksheet); tanggung jawab Sales Administration Associate di struktur organisasi |
| S13 Pengelolaan hubungan dan kepuasan pelanggan | Mentoring | Pendampingan oleh Manager of Customer Success untuk eskalasi pelanggan | Usulan D4 |
| S14 Pengembangan dan pemeliharaan aplikasi | External training | Kursus IT atau bootcamp application maintenance | Transkrip 00:47:11–00:47:29 |
| S15 Keamanan data dan infrastruktur TI | Certification | Sertifikasi keamanan informasi | Usulan D4 |
| S16 Analisis kebutuhan dan dukungan pengguna | On-the-job training | Pendampingan dukungan pengguna internal | Usulan D4 |

Untuk data contoh di mode fixture:

| Kompetensi | Method | Contoh di fixture |
|---|---|---|
| Communication | Coaching | (belum ada) |
| Administrative Accuracy | Training | Administrative Accuracy Workshop |
| Records Management | Training | Records Retention Workshop (Not Passed, diulang) |
| Tax Reporting & Compliance | Training, Certification | Coretax Reporting Briefing; Brevet A/B |
| HR Documentation | On-the-job training | (belum ada) |
| Sales & Negotiation | Coaching | (belum ada) |

**PIC** (penanggung jawab) wajib jelas supaya pegawai tidak "terlantar" di development requirement (transkrip 00:48:14–00:49:24). Contohnya: untuk Sales Administration Associate, PIC-nya Sales Executive yang meminta pegawai itu. Keputusan Q13 (20 Okt 2026): PIC dipilih dari daftar semua pegawai (dropdown cari, label nama dan posisi) dan disimpan sebagai nama. PIC lama yang diketik bebas tetap tampil dan bisa dipertahankan saat Edit.

## 5a. Tampilan detail Competency Gap (Q15)

Keputusan Q15 (20 Okt 2026): per kompetensi tampil level dibutuhkan, level dimiliki, selisih, status, bukti, dan requirement penutupnya beserta statusnya. Arahan transkrip 00:25:11: tunjukkan logikanya, bukan sekadar data. Halaman: `/competency/<employeeId>`, kartu **Requirement vs capability**.

| Kolom | Isi | Logika |
|---|---|---|
| Competency | Nama kompetensi dari requirement posisi aktif | Satu baris per requirement posisi |
| Required | Level minimal posisi | `position_requirements` (D3) |
| Actual | Level pegawai, "—" bila belum tercatat | `employee_skills` (D3) |
| Difference | Actual − Required: "−1" berarti kurang satu level, "0" pas, "+1" lebih; "—" bila level belum ada | Merah bila negatif |
| Evidence | Catatan bukti, "Belum ada bukti" bila kosong | Bukti wajib sebelum disimpulkan |
| Status | Badge **Met / Gap / Insufficient Data** dan satu kalimat alasan | Level kosong: "Level belum tercatat …". Ada level tanpa bukti: "Level a belum punya bukti …" (Insufficient Data, bukan Gap). Kurang: "Level a di bawah minimal b: kurang n level." Cukup: "Level a memenuhi minimal b." |
| Development requirement | Objective requirement penutup (tautan ke detailnya), badge statusnya, hasil reassessment (Needs reassessment, Retraining, Meets requirement), dan training terakhir beserta hasilnya | Requirement yang belum Completed didahulukan; bila tidak ada, requirement terbaru. Gap tanpa requirement terbuka menampilkan **Create Development Requirement** (atau "Simpan penilaian dulu" sebelum penilaian disimpan). Met: "Tidak perlu". Insufficient Data: "Lengkapi level dan bukti dulu". |

Di atas tabel ada satu paragraf aturan: Difference = level dimiliki − level dibutuhkan; Gap tertutup hanya bila penilaian baru menunjukkan level sudah memenuhi, bukan karena requirement atau training Completed.

Di layar di bawah 768 px tiap kompetensi tampil sebagai blok bertumpuk dengan nama kolom di atas tiap nilai, jadi halaman tidak perlu digeser.

Fungsi murni (dites di `tests/d4/development-gap-view.test.ts`): `findingLogic`, `formatDifference`, dan `closingRequirement` di `modules/d4/web/features/competency/rows.ts`.

## 6. Batasan

| Batasan | Keterangan |
|---|---|
| **Level kompetensi bersumber dari D3** | Daftar kompetensi (`d3_competencies`), requirement posisi (`position_requirements`), dan level serta bukti pegawai (`d3_employee_skills`, dibaca D4 lewat view `d4_employee_skills`) milik D3. D4 hanya membaca data itu dan menyimpan snapshot penilaian, development requirement, dan training. D4 tidak mengubah level. Gap tertutup bila level di D3 sudah diperbarui dan penilaian baru disimpan di D4. Siapa yang memperbarui level setelah training Passed masih pertanyaan terbuka Q14. |
| **KPI dari D1, skor di D4** | Definisi KPI per posisi milik D1 (`d1_kpi_definitions`); sejak 23 Nov 2026 D4 membacanya. Skor harian dan periode diisi di D4 (Daily KPI dan Performance Review). KPI hanya menjadi konteks (source **Performance Review**), bukan penentu gap kompetensi: gap kompetensi adalah level aktual di D3 dibanding level wajib di `position_requirements`. Laporan gap KPI (skor − 85) seluruh pegawai ada di D1 (FR-D1-003). |
| **Requirement belum lengkap** | Per 24 Nov 2026, Field Agent dan General Director belum punya requirement, dan baru 7 dari 39 pegawai aktif yang punya level kompetensi di D3. Untuk mereka gap tidak bisa dihitung (TEST-ACCOUNTS-D4 bagian 2a). |
| **Riwayat posisi** | D3 belum punya view riwayat posisi resmi. Posisi lama hanya terlihat lewat penilaian berkonteks perubahan posisi (D3 #2). |
| **Status trainee** | Status PROBATION/INTERN dibaca dari akun pegawai. Durasi trainee tidak dihitung sistem. |
| **Tidak otomatis** | Gap tidak otomatis membuat requirement, menetapkan training, promosi, atau sertifikasi. Semua langkah dicatat manual oleh HR atau manager (transkrip 00:25:28). |

## 7. Pertanyaan terbuka

| # | Pertanyaan | Dampak |
|---|---|---|
| Q14 | Setelah training Passed, siapa yang memperbarui level kompetensi? (usulan: HR lewat penilaian ulang di D4, D3 membaca hasilnya) | Menentukan kapan gap tertutup (langkah 7) |
| - | Apakah daftar S01–S16 dan level di bagian 3.2 disetujui sebagai daftar resmi, dan siapa yang mengisinya di D3? | Isi requirement posisi |
| - | Apakah "Certification" dan "External training" masuk daftar saran Method? | Pilihan Method di form |
| - | Requirement untuk Commissioner, para Director, HR Manager, dan HR Associate Officer | Posisi tanpa requirement (bagian 3.2) |

## 8. Referensi

- Wawancara awal D4: bagian 4.4 Trainee dan OJT, 4.5 Evaluasi dan Capability Gap, 4.6 Performance and Development, 4.7 Need-based development, 4.8 Tax Officer ke Tax Manager, 4.10 Sertifikasi.
- Transkrip 14 Okt 2026, bagian 2:
  - 00:23:06–00:24:15: dua kasus gap; durasi trainee ditentukan HR
  - 00:25:11–00:25:28: tunjukkan logikanya, bukan hanya data
  - 00:46:17–00:47:29: objective dan apa yang menutup gap
  - 00:47:52–00:48:06: metode
  - 00:48:14–00:49:24: PIC
  - 00:49:35–00:49:43: priority
- Kode:
  - `modules/d4/competency/service.ts` (`compareCompetencies`)
  - `modules/d4/web/data/selectors.ts` (`inTrainingOrPositionChange`, `objectiveFromFinding`)
  - `modules/d4/shared/rules.ts` (aturan development, training, reassessment)
  - `modules/d4/web/features/development/DevelopmentModals.tsx` (Method, objective)
- Migrasi:
  - `20261015120000_d4_development_method_pic.sql`
  - `20261017120000_d4_employee_employment_status.sql`
  - `20261019120000_d4_development_edit_reassessment.sql` (reassessment, priority per revisi, `assessed_with`; belum diterapkan di DB live per 20 Okt 2026)
- Data:
  - `supabase/seed/d4-simulasi-master.sql`
  - `modules/d4/shared/fixtures/reference-data.ts`
