| Field | Value |
| --- | --- |
| **Document ID** | TP-D4-001 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Test Plan & Requirement Traceability Matrix |
| **Status** | Draft – menunggu review QA (Stella Olivia) dan PO (Gabriella Steny Carla Joyasita) |
| **Date** | 30 Sep 2026 |
| **Derived From** | US-D4-001 s.d. US-D4-006; FR-D4-001 s.d. FR-D4-007; TR-D4-001; TR-D4-002 |
| **Related** | API-D4-001; UI-D4-001; RN-D4-001; PLANKA-D4 |
| **Kartu Planka** | [QA] Penyusunan Test Plan & Requirement Traceability D4 |

## 1. Tujuan dan cakupan

Dokumen ini memetakan setiap requirement D4 ke test case yang dapat dijalankan QA. ID test case diturunkan langsung dari checklist kartu QA di board Planka *Squad D4*, jadi satu baris checklist = satu TC ID. Test case baru (TC-D4-001) ditambahkan karena FR-D4-001 belum punya skenario di checklist mana pun. TC-D4-002-16 s.d. 19 (skala 1–100 katalog V6 dan kategori performa) ditambahkan 20 Okt 2026 dan belum ada di checklist Planka. TC-D4-002-20 dan 21 (scorecard lama setelah Actual digabung dengan Score, dan kunci Reference) ditambahkan 20 Okt 2026 untuk Q4 dan Q12, juga belum ada di Planka. TC-D4-002-25, TC-D4-006-24, TC-D4-008-20 dan TC-D4-008-21 ditambahkan 23 Nov 2026 untuk bug QA BUG-FN-D4-001, BUG-FN-D4-002 dan catatan PST 2 tentang "/ 100".

Di luar cakupan: sertifikasi/renewal, trigger performance-gap formal, dan reassessment wajib (Academic/Project Extension sampai ada sumber resmi — lihat TS-D4-002/003).

## 2. Ringkasan coverage

| Requirement | Prefix TC | Jumlah TC | Kartu QA |
|---|---|---|---|
| US-D4-001 / FR-D4-001 Performance Evaluation | TC-D4-001 | 6 (baru) | [QA] Pengujian Phase 1 |
| US-D4-002 / FR-D4-002 KPI Scorecard | TC-D4-002 | 25 (3 baru: KPI gap; 1 baru: BUG-FN-D4-001) | [QA] Pengujian Phase 1 |
| US-D4-003 / FR-D4-003 Competency Gap | TC-D4-003 | 12 | [QA] Pengujian Phase 2 |
| US-D4-004 / FR-D4-004 Development Requirement | TC-D4-004 | 15 (3 baru) | [QA] Pengujian Phase 2 |
| US-D4-005 / FR-D4-005 Training Tracking | TC-D4-005 | 16 (1 baru: Retraining sesudah Passed) | [QA] Pengujian Phase 3 |
| US-D4-006 / FR-D4-006 Dashboard KPI Orang | TC-D4-006 | 26 (3 baru: skala di judul kolom, kartu ringkasan) | [QA] Pengujian Phase 3 |
| FR-D4-007 / TR-D4-001 Keterhubungan data | TC-D4-007 | 9 | [QA] Pengujian Integration, Security, Validation & UI Quality |
| Daily KPI (wawancara D4, 14 Okt 2026) | TC-D4-008 | 22 (baru) | [QA] Pengujian Phase 1 |
| TR-D4-002 Security & audit | TC-D4-SEC | 9 | idem |
| TR-D4-002 Validation & UI quality | TC-D4-UIQ | 19 (1 baru: pola filter; 5 baru: bahasa, paginasi, info berulang) | idem |
| Skenario lintas fitur | TS-D4-001 s.d. 003 | 3 | [QA] TS-D4-00x (list To Do List QA) |
| **Total** | | **162** | |

Semua FR dan TR yang dapat diuji punya minimal satu TC positif dan satu TC negatif.

## 3. Format hasil test

| Status | Kapan dipakai |
|---|---|
| **Not Run** | Belum dijalankan (status awal semua TC) |
| **PASS** | Actual result sama dengan expected result |
| **FAIL** | Actual result berbeda → wajib ada tiket `[Bug] BUG-D4-xxx` di list Bug Report, TC ID ditulis di tiket |
| **BLOCKED** | Tidak bisa dijalankan karena dependency di §5; tulis ID dependency-nya (mis. `BLOCKED – O2`) |

Satu baris hasil: `TC ID | Tanggal | Tester | Role login | Build/commit | Status | Actual result | Evidence`.

## 4. Format evidence

1. Screenshot penuh browser (URL terlihat), nama file `TC-D4-002-05_FAIL_2026-10-07.png`.
2. Untuk hasil API: status HTTP + body `{ "error": { "code", "message" } }` (API-D4-001 §3).
3. Data uji hanya memakai nama placeholder (Alfa…Oscar) atau data bertanda `[seed-d4]`; mode preview menampilkan badge *Preview · data fiktif* dan **tidak** boleh dipakai sebagai evidence PASS.
4. Evidence dilampirkan di komentar kartu QA terkait, bukan di deskripsi.

## 5. Dependency yang dapat menyebabkan BLOCKED

| ID | Dependency | TC terdampak | Pemilik |
|---|---|---|---|
| STG | Build staging + smoke test belum ada | Semua TC | WebDev (kartu Security … Final Staging Readiness) |
| O1 | KPI & gap belum membaca position **pada periode** (butuh riwayat position D3) | TC-D4-003-11, TC-D4-007-07 | PO + D3 |
| O2 | Migrasi katalog KPI V5.1 belum diterapkan ke Supabase bersama | TC-D4-002-03, TC-D4-006-06, TC-D4-007-08 | PO + Back End |
| O3 | Sales Admin memakai KPI Sales & Marketing (sementara) | TC-D4-002-01/02 untuk position Sales Admin | PO |
| O4 | HR Associate belum punya KPI V5.1 | TC-D4-002-01/02 untuk HR Associate (expected: form menolak simpan) | PO |
| O5 | Migrasi katalog KPI V6 skala 1–100 (`20261017130000_d4_kpi_scale_100_v6.sql`) belum diterapkan ke Supabase bersama (cek 20 Okt 2026) | TC-D4-002-16 s.d. 19 di staging; mode fixture sudah memakai V6 untuk periode mulai 2026-11 | PO + Back End |
| O6 | Migrasi kunci Reference (`20261020120000_d4_kpi_reference_required.sql`, CHECK NOT VALID) belum diterapkan ke Supabase bersama. Form dan API sudah menolak Reference kosong | Bagian DB dari TC-D4-002-21 | PO + Back End |
| O7 | Migrasi Daily KPI (`20261108130000_d4_kpi_daily_entries.sql`) belum diterapkan; butuh O5 dan O8 lebih dulu ([runbook](MIGRATION-RUNBOOK-D4.md)) | TC-D4-008 di staging; mode fixture sudah bisa | PO + Back End |
| O8 | Migrasi Management read-only (`20261108120000_d4_management_read_only.sql`, DIR-* → MANAGEMENT) belum diterapkan | TC-D4-SEC-05, TC-D4-008-06 di staging | PO + Back End |
| ~~NET~~ | Selesai 30 Sep 2026: klien menangani network failure, timeout, dan integration failure (API-D4-001 §3) | TC-D4-UIQ-06, TC-D4-UIQ-07 siap diuji di staging | WebDev |

## 6. Requirement Traceability Matrix

### TC-D4-001 · FR-D4-001 Performance Evaluation (baru)

Kartu Planka: **[QA] Pengujian Phase 1** (item ditambahkan 30 Sep 2026)

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-001-01 | Membuat evaluation dengan Employee, Period, Evaluation date, Evaluator, hasil 1–5, catatan | Positif | Not Run | Staging |
| TC-D4-001-02 | Catatan evaluasi kosong ditolak | Negatif | Not Run | Staging |
| TC-D4-001-03 | Hasil evaluasi di luar 1–5 ditolak | Negatif | Not Run | Staging |
| TC-D4-001-04 | Evaluation periode lama tidak tertimpa saat periode baru dibuat | Positif | Not Run | Staging |
| TC-D4-001-05 | History per employee menampilkan semua periode | Positif | Not Run | Staging |
| TC-D4-001-06 | Role EMPLOYEE tidak bisa membuat evaluation (403) | Negatif | Not Run | Staging |

### TC-D4-002 · FR-D4-002 KPI Scorecard

Kartu Planka: **[QA] Pengujian Phase 1**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-002-01 | Test KPI mengikuti position employee | Positif | Not Run | Staging |
| TC-D4-002-02 | Test jumlah Core KPI mengikuti set KPI position (definisi D1 atau katalog D4) dengan total bobot 100 | Positif | Not Run | Staging |
| TC-D4-002-03 | Test bobot KPI sesuai baseline | Positif | Not Run | O2 (migrasi KPI V5.1 belum diterapkan) |
| TC-D4-002-04 | Test total bobot = 100% | Positif | Not Run | Staging |
| TC-D4-002-05 | Test total bobot selain 100% ditolak | Negatif | Not Run | Staging |
| TC-D4-002-06 | Test input Actual 1 sampai 5 untuk katalog V3.1/V5.1 (periode sampai 2026-10); angka Actual menjadi skor | Positif | Not Run | Staging |
| TC-D4-002-07 | Test Actual di bawah 1 ditolak (semua katalog) | Negatif | Not Run | Staging |
| TC-D4-002-08 | Test Actual di atas 5 ditolak untuk katalog V3.1/V5.1 | Negatif | Not Run | Staging |
| TC-D4-002-09 | Test skor terbobot = bobot × Actual (contoh: bobot 20% × Actual 90 = 18; bobot 35% × Actual 4 = 1.40) | Positif | Not Run | Staging |
| TC-D4-002-10 | Test total score = jumlah seluruh skor terbobot | Positif | Not Run | Staging |
| TC-D4-002-11 | Test target tampil 85 dan read-only (dari katalog, `readonly-target-1..5`); catatan realisasi ditulis dan tersimpan di Comment (`input-komentar-1..5`) | Positif | Not Run | Staging |
| TC-D4-002-12 | Test form hanya punya satu input nilai per Core KPI: Actual (`input-realisasi-1..5`, angka) adalah skor; tidak ada kolom Score terpisah (`input-skor-*` sudah dihapus, Q4 20 Okt 2026) dan tidak ada konversi lain dari realisasi ke skor | Negatif | Not Run | Staging |
| TC-D4-002-13 | Test KPI milik position lain tidak muncul | Negatif | Not Run | Staging |
| TC-D4-002-14 | Test history scorecard per periode | Positif | Not Run | Staging |
| TC-D4-002-15 | Test pencarian/filter bila sudah tersedia | Positif | Not Run | Staging |
| TC-D4-002-16 | Test input Actual 1 sampai 100 untuk katalog V6 (periode mulai 2026-11); kolom berlabel `Actual 1–100` | Positif | Not Run | O5 |
| TC-D4-002-17 | Test Actual di atas 100 atau bukan bilangan bulat ditolak untuk katalog V6 | Negatif | Not Run | O5 |
| TC-D4-002-18 | Test kategori dari total skor V6: di bawah 80 Under Performance, 80 sampai 85 Average Performance, di atas 85 High Performance (uji batas 79, 80, 85, 86) | Positif | Not Run | O5 |
| TC-D4-002-19 | Test scorecard V3.1/V5.1 (skala 1–5) tidak diberi kategori performa | Negatif | Not Run | Staging |
| TC-D4-002-20 | Test scorecard yang disimpan sebelum Q4 tetap tampil benar di detail dan profil Dashboard: Actual = skor tersimpan, total tidak berubah, teks realisasi lama tampil di Comment dengan awalan `Realisation:` (`kpi-realisation-1..5`) | Positif | Not Run | Staging |
| TC-D4-002-21 | Test Reference kosong ditolak: form (pesan inline), API (422 `Reference wajib diisi.` untuk kosong, spasi, `null`, atau tidak dikirim), dan DB (constraint `d4_kpi_assessments_evidence_reference_required`) | Negatif | Not Run | Form dan API: Staging. DB: O6 |
| TC-D4-002-22 | Test kolom Gap per Core KPI = Actual − 85 di form dan detail scorecard V6 (contoh Actual 90 → +5, 80 → −5) | Positif | Not Run | Staging: O5 |
| TC-D4-002-23 | Test KPI gap total = Total KPI − 85 di list Performance Review, detail (Ringkasan) dan profil People Dashboard | Positif | Not Run | Staging: O5 |
| TC-D4-002-24 | Test scorecard 1–5 (V3.1/V5.1) tidak dikonversi: gap tampil `n/a (skala 1–5)`, kolom Gap per baris tidak muncul | Negatif | Not Run | Staging |
| TC-D4-002-25 | Test Actual dengan nol di depan (BUG-FN-D4-001): ketik atau tempel `00085` → field menulis `85`, Weighted dan Gap dihitung dari 85; `00000` → `0` dan Save ditolak "Di luar rentang: isi 1 sampai 100."; `150` tetap tidak bisa diketik | Negatif | Not Run | Staging: O5 |
| TC-D4-002-26 | Test position yang dipetakan D1 (HR Manager, JP011) di periode 2026-11 ke atas memakai KPI `d1_kpi_definitions`: nama dan bobot sama dengan D1, helper Position KPI di Performance Review dan field Catalog di Daily KPI berbunyi `Definisi KPI D1 JP011 · skala 1–100` (EN `D1 KPI definition JP011 · scale 1–100`); periode 2026-10 tetap KPI V5.1 | Positif | Not Run | Migrasi 20261124130000 (izin PO) |
| TC-D4-002-27 | Test position yang belum dipetakan D1 (Accounting Associate 1 (Billing)) tetap memakai peran katalog D4 V6 dengan helper `Katalog D4 V6, posisi belum dipetakan D1 · skala 1–100` | Positif | Not Run | Migrasi 20261124130000 (izin PO) |
| TC-D4-002-28 | Test set KPI D1 dengan 3 KPI (IT, JP031): form dan Daily KPI menampilkan 3 baris, total dihitung dari 3 baris; API dan trigger menolak jumlah baris yang berbeda dari katalog (422) | Positif | Not Run | Migrasi 20261124130000 (izin PO) |
| TC-D4-002-29 | Test view `d4_kpi_scores_for_d1`: HR, Manager, dan Management membaca semua skor; Employee hanya skornya sendiri; `anon` ditolak; Daily KPI yang dikoreksi hanya muncul dengan skor terbaru; setiap baris punya `kpi_id` D1 | Positif | Not Run | Migrasi 20261124130000 (izin PO) |
| TC-D4-002-30 | Test Period di form Performance Review hanya berisi periode terbuka: pada 24 Nov 2026 "Nov 2026 · bulan ini" dan "Okt 2026 · bulan lalu" | Positif | Not Run | |
| TC-D4-002-31 | Test periode tertutup (Sep 2026 pada 24 Nov) ditolak API dengan 422 "Periode ini sudah ditutup…", sebelum aturan revisi; Finalize from Daily KPI untuk periode itu menampilkan peringatan dan tombol Finalize nonaktif | Negatif | Not Run | |
| TC-D4-002-32 | Test Evaluation date tampil sebagai teks hari ini (`readonly-evaluation-date`, bukan input sejak 24 Nov 2026); API menyimpan hari penyimpanan (WIB) walau body mengirim tanggal lain | Negatif | Not Run | |
| TC-D4-002-33 | Test HR membuka kembali Sep 2026 sampai 30 Nov: periode muncul di form sebagai "dibuka kembali" dan bisa disimpan; baris baru dengan tanggal kemarin menutupnya lagi; Manager ditolak RLS | Positif | Not Run | Migrasi 20261124150000 (izin PO) |
| TC-D4-002-34 | Test pegawai yang sudah dinilai di periode terpilih tidak muncul di pilihan Tambah Performance Review; dari menu baris pegawai itu form tetap terbuka sebagai revisi | Positif | Not Run | |
| TC-D4-002-35 | Test ketik `-`, huruf, `e` atau `.` di Actual (`input-realisasi-*`): karakter ditolak saat diketik dan kolom hanya berisi angka | Negatif | Not Run | |
| TC-D4-002-36 | Test skor bulat tampil tanpa desimal: total 100 tampil "100 / 100" di form dan detail, Terbobot 1 tampil "1", total 86.25 tetap "86.25" | Positif | Not Run | Fixture / Staging |
| TC-D4-002-37 | Test detail scorecard (`/performance/scorecard/<id>`) menampilkan Version "First review" untuk penilaian pertama dan "Revision N" untuk revisi, serta Recorded dengan tanggal dan jam | Positif | Not Run | Fixture / Staging |

### TC-D4-003 · FR-D4-003 Competency Gap

Kartu Planka: **[QA] Pengujian Phase 2**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-003-01 | Test capability dibandingkan dengan requirement position yang benar | Positif | Not Run | Staging |
| TC-D4-003-02 | Test status Terpenuhi | Positif | Not Run | Staging |
| TC-D4-003-03 | Test status Gap | Positif | Not Run | Staging |
| TC-D4-003-04 | Test status Data Belum Cukup | Positif | Not Run | Staging |
| TC-D4-003-05 | Test tidak adanya evidence tidak langsung menghasilkan Gap | Negatif | Not Run | Staging |
| TC-D4-003-06 | Test detail gap menampilkan employee | Positif | Not Run | Staging |
| TC-D4-003-07 | Test detail gap menampilkan position | Positif | Not Run | Staging |
| TC-D4-003-08 | Test requirement sumber tampil | Positif | Not Run | Staging |
| TC-D4-003-09 | Test capability/evidence yang digunakan tampil | Positif | Not Run | Staging |
| TC-D4-003-10 | Test pencarian/filter gap | Positif | Not Run | Staging |
| TC-D4-003-11 | Test perubahan position menggunakan requirement baru | Positif | Not Run | O1 (riwayat position per periode dari D3) |
| TC-D4-003-12 | Test history gap lama tetap tersedia | Positif | Not Run | Staging |

### TC-D4-004 · FR-D4-004 Development Requirement

Kartu Planka: **[QA] Pengujian Phase 2**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-004-01 | Test membuat development requirement | Positif | Not Run | Staging |
| TC-D4-004-02 | Test requirement terhubung ke employee | Positif | Not Run | Staging |
| TC-D4-004-03 | Test source/alasan tersimpan | Positif | Not Run | Staging |
| TC-D4-004-04 | Test competency gap dapat dipilih sebagai source | Positif | Not Run | Staging |
| TC-D4-004-05 | Test perubahan position dapat digunakan sebagai source | Positif | Not Run | Staging |
| TC-D4-004-06 | Test hasil evaluation dapat digunakan sebagai context/source bila tersedia | Positif | Not Run | Staging |
| TC-D4-004-07 | Test source type tersimpan | Positif | Not Run | Staging |
| TC-D4-004-08 | Test source reference tersimpan | Positif | Not Run | Staging |
| TC-D4-004-09 | Test history development requirement | Positif | Not Run | Staging |
| TC-D4-004-10 | Test filter berdasarkan employee | Positif | Not Run | Staging |
| TC-D4-004-11 | Test filter berdasarkan source | Positif | Not Run | Staging |
| TC-D4-004-12 | Test requirement tidak terbentuk otomatis hanya karena periode waktu | Negatif | Not Run | Staging |
| TC-D4-004-13 | Test PIC wajib (B13): simpan tanpa PIC ditolak di form dan API (422 `PIC wajib diisi.`); Edit Requirement tidak bisa mengosongkan PIC | Negatif | Not Run | Staging |
| TC-D4-004-14 | Test objective dari gap ikut menyebut cara menutup gap (B14): pilih Method, objective menjadi "Naikkan X dari level a ke b melalui <Method>"; teks yang sudah diubah user tidak ditimpa | Positif | Not Run | Staging |
| TC-D4-004-15 | Test saran Method sesuai klien (B12): Internal training, External training, Certification, Coaching; teks lain tetap boleh | Positif | Not Run | Staging |

### TC-D4-005 · FR-D4-005 Training Tracking

Kartu Planka: **[QA] Pengujian Phase 3**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-005-01 | Test membuat training/development record | Positif | Not Run | Staging |
| TC-D4-005-02 | Test employee wajib valid | Positif | Not Run | Staging |
| TC-D4-005-03 | Test development requirement sumber | Positif | Not Run | Staging |
| TC-D4-005-04 | Test nama aktivitas training | Positif | Not Run | Staging |
| TC-D4-005-05 | Test tanggal/periode | Positif | Not Run | Staging |
| TC-D4-005-06 | Test status | Positif | Not Run | Staging |
| TC-D4-005-07 | Test hasil/catatan | Positif | Not Run | Staging |
| TC-D4-005-08 | Test mandatory source reference | Positif | Not Run | Staging |
| TC-D4-005-09 | Test history training | Positif | Not Run | Staging |
| TC-D4-005-10 | Test perubahan status tidak menghapus history | Negatif | Not Run | Staging |
| TC-D4-005-11 | Test filter employee | Positif | Not Run | Staging |
| TC-D4-005-12 | Test filter periode | Positif | Not Run | Staging |
| TC-D4-005-13 | Test filter status | Positif | Not Run | Staging |
| TC-D4-005-14 | Test filter requirement sumber | Positif | Not Run | Staging |
| TC-D4-005-15 | Test training selesai tidak otomatis menutup competency gap | Negatif | Not Run | Staging |
| TC-D4-005-16 | Test Retraining sesudah Passed (23 Nov 2026): saat Completed + Passed dicatat, pilihannya hanya Gap closed: Meets requirement dan Decide later; di Next step, Gap still open: Retraining nonaktif dengan alasannya sampai penilaian Competency Gap disimpan sesudah hasil Passed dan levelnya masih di bawah requirement; setelah itu Retraining membuat training ulang Planned | Negatif | Not Run | Staging |
| TC-D4-005-17 | Test cek sebelum simpan di Update Progress massal (transkrip 24 Nov 2026): di `/training` pilih beberapa training, termasuk satu yang levelnya belum memenuhi requirement; pilih Completed, Passed, dan Gap closed: Meets requirement → sebelum Save muncul `bulk-issues` ("N training tidak memenuhi syarat … tidak ikut disimpan"), baris yang ditolak menampilkan `bulk-issue-<id>` dengan alasannya, dan tombol Save menghitung hanya yang lolos (mis. "Save 2 Trainings" dari 4); setelah Save hanya training yang lolos berubah; jika tidak ada satu pun yang lolos, Save menampilkan pesan dan tidak menyimpan | Negatif | Not Run | Fixture / Staging |
| TC-D4-005-18 | Test tanggal training Planned sebelum hari ini: kalender menonaktifkan hari lampau saat status Planned (Tambah Training, Retraining); API menolak dengan "Tanggal training Planned tidak boleh sebelum hari ini."; In Progress boleh tanggal lampau | Negatif | Not Run | Fixture / Staging |
| TC-D4-005-19 | Test training ganda: simpan training "X" tanggal D untuk satu requirement, lalu simpan "x" tanggal D lagi untuk requirement yang sama → ditolak "Requirement ini sudah punya training dengan nama dan tanggal yang sama."; tanggal lain atau requirement lain tetap tersimpan; setelah yang pertama Cancelled, yang kedua boleh | Negatif | Not Run | Fixture / Staging |

### TC-D4-006 · FR-D4-006 Dashboard KPI Orang

Kartu Planka: **[QA] Pengujian Phase 3**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-006-01 | Test employee tampil dengan benar | Positif | Not Run | Staging |
| TC-D4-006-02 | Test position tampil sesuai employee | Positif | Not Run | Staging |
| TC-D4-006-03 | Test periode yang dipilih | Positif | Not Run | Staging |
| TC-D4-006-04 | Test total score sama dengan KPI Scorecard | Positif | Not Run | Staging |
| TC-D4-006-05 | Test detail 5 Core KPI | Positif | Not Run | Staging |
| TC-D4-006-06 | Test bobot KPI | Positif | Not Run | O2 |
| TC-D4-006-07 | Test target, Actual (skor), dan Comment per Core KPI; scorecard lama menampilkan teks realisasi lama di Comment | Positif | Not Run | Staging |
| TC-D4-006-08 | Test Actual per KPI sesuai skala katalognya (1–5 untuk V3.1/V5.1, 1–100 untuk V6) | Positif | Not Run | Staging |
| TC-D4-006-09 | Test skor terbobot | Positif | Not Run | Staging |
| TC-D4-006-10 | Test ringkasan performance evaluation | Positif | Not Run | Staging |
| TC-D4-006-11 | Test competency gap | Positif | Not Run | Staging |
| TC-D4-006-12 | Test development requirement | Positif | Not Run | Staging |
| TC-D4-006-13 | Test progress training | Positif | Not Run | Staging |
| TC-D4-006-14 | Test pencarian employee | Positif | Not Run | Staging |
| TC-D4-006-15 | Test filter position | Positif | Not Run | Staging |
| TC-D4-006-16 | Test filter periode: tombol Period ada di samping search (bukan di panel Filter), default periode terbaru yang sudah berjalan, tanpa pilihan "All" agar ringkasan dan grafik tidak mencampur periode | Positif | Not Run | Staging |
| TC-D4-006-17 | Test drill-down ke detail sumber | Positif | Not Run | Staging |
| TC-D4-006-18 | Test dashboard tidak membentuk data bisnis terpisah | Negatif | Not Run | Staging |
| TC-D4-006-19 | Test dashboard tidak membuat status achieved/not achieved tanpa threshold resmi | Negatif | Not Run | Staging |
| TC-D4-006-20 | Test loading state | Positif | Not Run | Staging |
| TC-D4-006-21 | Test empty state | Positif | Not Run | Staging |
| TC-D4-006-22 | Test validation state | Positif | Not Run | Staging |
| TC-D4-006-23 | Test error state | Positif | Not Run | Staging |
| TC-D4-006-24 | Test kolom Total KPI di tabel People Dashboard: judul **Total KPI (/100)**, baris skala 1–100 hanya menulis angka (misalnya `82.00`) tanpa "/ 100"; baris scorecard 1–5 tetap menulis "/ 5" | Positif | Not Run | Staging: O5 |
| TC-D4-006-25 | Test kartu ringkasan bisa dibuka: **Employees** melompat ke tabel; **Need training**, **Training in progress**, dan **Performance Review complete** membuka daftar pegawai yang jumlahnya sama dengan angka kartu (Performance Review: angka kartu = bagian Sudah direview); Employees, Need training, dan Training in progress bernilai 0 tidak bisa diklik, sedangkan Performance Review complete tetap bisa dibuka selama ada pegawai yang bisa direview | Positif | Not Run | Staging |
| TC-D4-006-26 | Test aksi dari daftar kartu: Create Training, Update Progress, Add Performance Review (periode yang ditampilkan dashboard), dan Finalize membuka form menggantikan daftar, lalu kembali ke daftar setelah Save atau Cancel; tombol aksi tidak muncul di baris diri sendiri dan untuk Director | Positif | Not Run | Staging |
| TC-D4-006-27 | Test buat training untuk semua dari kartu **Need training** (transkrip 24 Nov 2026): sebagai HR, dengan dua atau lebih requirement terbuka yang belum punya training, dialog kartu menampilkan baris `summary-bulk-training` ("N requirement belum punya training.") dan tombol `btn-summary-create-training-all` "Create training for all (N)" / "Buat training untuk semua (N)"; tombol membuka form Add Training berisi N requirement tercentang; setelah Save dialog kartu kembali dengan "N training tersimpan." dan baris itu hilang; requirement yang sudah punya training, requirement diri sendiri, dan akun Director tidak ikut; dengan hanya satu requirement tanpa training baris itu tidak muncul (tombol per baris cukup) | Positif | Not Run | Fixture / Staging |

### TC-D4-007 · FR-D4-007 / TR-D4-001 Keterhubungan data

Kartu Planka: **[QA] Pengujian Integration, Security, Validation & UI Quality**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-007-01 | Test setiap performance record memiliki employee valid | Positif | Not Run | Staging |
| TC-D4-007-02 | Test KPI dapat ditelusuri ke employee, position, dan periode | Positif | Not Run | Staging |
| TC-D4-007-03 | Test gap dapat ditelusuri ke requirement | Positif | Not Run | Staging |
| TC-D4-007-04 | Test development requirement dapat ditelusuri ke source reference | Positif | Not Run | Staging |
| TC-D4-007-05 | Test training dapat ditelusuri ke development requirement | Positif | Not Run | Staging |
| TC-D4-007-06 | Test mandatory reference invalid ditolak | Negatif | Not Run | Staging |
| TC-D4-007-07 | Test perubahan position tidak menghapus history | Negatif | Not Run | O1 |
| TC-D4-007-08 | Test perubahan KPI tidak merusak scorecard historis | Negatif | Not Run | O2 |
| TC-D4-007-09 | Test dashboard menggunakan data sumber yang sama | Positif | Not Run | Staging |

### TC-D4-008 · Daily KPI (baru, 8 Nov 2026)

Keputusan 8 Nov 2026: pegawai mengisi skornya sendiri per hari; skor periode dikompilasi otomatis (status Compiled) dan HR memfinalisasinya dengan Notes dan Reference (B6).

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-008-01 | Test Employee menyimpan skor semua Core KPI posisinya hari ini di `/daily-kpi`; total dan gap terhitung, entri muncul di "This period" | Positif | Not Run | Staging: O7 |
| TC-D4-008-02 | Test koreksi: menyimpan lagi tanggal yang sama menambah entri baru dan hanya entri terbaru yang dihitung | Positif | Not Run | Staging: O7 |
| TC-D4-008-03 | Test tanggal besok dan tanggal periode sebelumnya ditolak (form, API 422, RLS) | Negatif | Not Run | Staging: O7 |
| TC-D4-008-04 | Test skor kosong, 0, 101 atau desimal ditolak (form, API 422, trigger) | Negatif | Not Run | Staging: O7 |
| TC-D4-008-05 | Test POST `/api/d4/kpi-daily` dengan `employeeId`/`roleOrder` orang lain tetap tersimpan atas nama dan KPI akun yang login | Negatif | Not Run | Staging: O7 |
| TC-D4-008-06 | Test akun tanpa data pegawai ditolak 403; posisi tanpa KPI melihat pesan "hubungi HR"; akun Management (Director) dengan KPI bisa menyimpan Daily KPI miliknya sendiri, tetapi tidak untuk pegawai lain | Negatif | Not Run | Staging: O7, O8 |
| TC-D4-008-07 | Test Add Performance Review mengisi Actual dari rata-rata harian (dibulatkan) dengan pesan "Actual diisi dari rata-rata N entri", dan HR tetap bisa mengubahnya | Positif | Not Run | Staging: O5, O7 |
| TC-D4-008-08 | Test alert People Dashboard: "Daily KPI di bawah target" setelah 3 entri berturut-turut di bawah 85, dan "Belum mengisi Daily KPI" untuk pegawai dengan KPI tanpa entri | Positif | Not Run | Staging: O7 |
| TC-D4-008-09 | Test pegawai dengan Daily KPI tanpa scorecard periode itu tampil Compiled (total, jumlah entri, gap) di Performance Review dan People Dashboard, tanpa input manual | Positif | Not Run | Staging: O7 |
| TC-D4-008-10 | Test Finalize from Daily KPI: skor read-only, Notes dan Reference wajib, simpan membuat scorecard periode dengan total = skor kompilasi, lalu status menjadi Completed | Positif | Not Run | Staging: O5, O7 |
| TC-D4-008-11 | Test Finalize tidak tersedia untuk diri sendiri, Employee, dan Management; grafik dan ringkasan dashboard tidak menghitung skor Compiled | Negatif | Not Run | Staging: O7, O8 |
| TC-D4-008-12 | Test pengingat B5: pegawai yang belum mengisi hari ini melihat "Daily KPI hari ini belum diisi. Isi sebelum pulang." (atau "Daily KPI hari ini dan N hari kerja lain bulan ini belum diisi." bila ada hari kerja lain yang terlewat); setelah menyimpan, pengingat hari ini hilang | Positif | Not Run | Staging: O7 |
| TC-D4-008-13 | Test lonceng notifikasi: badge menghitung pengingat (Employee: "1") dan panel terbuka sendiri sekali untuk setiap kumpulan pengingat yang baru, selama Daily KPI hari ini belum diisi; "Isi sekarang" membuka `/daily-kpi`; setelah diisi, badge hilang; Simulasi Employee langsung membuka `/daily-kpi` | Positif | Not Run | Staging: O7 |
| TC-D4-008-14 | Test kolom Category di tabel entri harian: Under/Average/High Performance per hari untuk skala 1–100, "—" untuk 1–5 | Positif | Not Run | Staging: O5, O7 |
| TC-D4-008-15 | Test mengisi hari sebelumnya di periode berjalan (bukan tanggal 1): entri kemarin tersimpan, Days filled bertambah, skor kompilasi memakai rata-rata semua hari | Positif | Not Run | Staging: O7 |
| TC-D4-008-16 | Test pemantauan tim oleh HR dan Management: pegawai tanpa entri di baris teratas ("No entries"), View entries membuka Daily entries, Management tanpa aksi simpan untuk pegawai lain | Positif | Not Run | Staging: O7, O8 |
| TC-D4-008-17 | Test gagal simpan saat offline: toast "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi." dan entri tidak tersimpan | Negatif | Not Run | Staging: O7 |
| TC-D4-008-18 | Test sebelum migrasi Daily KPI: pesan "Daily KPI belum tersedia karena database belum diperbarui (migrasi 20261108130000). Menu lain tetap bisa dipakai." dan menu lain tetap berjalan | Negatif | Pass (10 Nov 2026, produksi, Simulasi Employee) | Hanya sebelum migrasi langkah 6 |
| TC-D4-008-19 | Test lonceng "Belum punya training" (PST 2): sebagai HR, buat satu requirement terbuka tanpa training atau batalkan training satu-satunya; lonceng menampilkan "1 pegawai belum punya training", panel terbuka sendiri, "Buat training" membuka `/development`, dan alert **Belum punya training** muncul di People Dashboard. Sebagai Employee dan Management, pengingat ini tidak muncul | Positif | Not Run | – |
| TC-D4-008-20 | Test Score dengan nol di depan (BUG-FN-D4-001): ketik `0`, `0`, `8`, `5` → field menulis `85`; tempel `0085` → `85`; `00000` → `0` dan Save ditolak dengan pesan rentang 1–100 | Negatif | Not Run | Staging: O7 |
| TC-D4-008-21 | Test form kosong (BUG-FN-D4-002): setelah Save, Score dan Comment kosong; membuka lagi `/daily-kpi` atau memilih tanggal yang sudah terisi tetap memberi form kosong dengan pemberitahuan "sudah tersimpan dengan total …" dan tombol **Save correction**; **Correct** di tabel This period memuat skor dan komentar tersimpan beserta "Saved: N"; History tetap menampilkan semua entri | Positif | Not Run | Staging: O7 |
| TC-D4-008-22 | Test kalender hari terlewat: dengan beberapa hari kerja bulan ini belum diisi, kotak kuning hanya berisi kalimat pengingat, dan di bawahnya ada panel kalender putih bergaris tipis berjudul bulan (mis. "Nov 2026") dengan kolom Sen–Jum, satu baris per minggu, dari tanggal 1 sampai hari ini; hari yang belum diisi berupa tombol bertitik kuning (`missed-YYYY-MM-DD`; hari ini `daily-today` dengan cincin biru), hari yang sudah diisi redup dengan centang; keterangan di bawah kalender (`daily-calendar-legend`) menjelaskan Belum diisi, Sudah diisi, Hari ini, dan Dibuka di form; menekan tanggal membuka tanggal itu di form dan menandainya terpilih (kotak biru penuh, teks putih), berbeda dari hover yang berlatar biru muda; mulai 768 px field Tanggal, KPI posisi, dan Katalog berada di kanan kalender, di bawahnya berurutan ke bawah; setelah Save tanggal itu berubah jadi centang dan jumlah di kalimat berkurang satu; di 375 px tidak ada scroll ke samping dan tinggi sel 40 px | Positif | Not Run | Staging: O7 |
| TC-D4-008-23 | Test semua nama di balik alert (Pak Emanuel, 17 Nov): sebagai HR di `/dashboard`, alert dengan lebih dari tiga pegawai menampilkan tiga nama dan tombol "Lihat semua N pegawai" (`btn-alert-people-<key>`); popup `alert-people` memuat N nama, Buka di satu nama membuka daftar sumber dengan `?q=<nama>`, Close (`btn-close-alert-people`) menutupnya; alert dengan tiga pegawai atau kurang tidak punya tombol; di EN tombolnya "View all N employees" | Positif | Not Run | Fixture / Staging |

### TC-D4-SEC · TR-D4-002 Security & audit

Kartu Planka: **[QA] Pengujian Integration, Security, Validation & UI Quality**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-SEC-01 | Test authentication | Positif | Not Run | Staging |
| TC-D4-SEC-02 | Test authorization create | Positif | Not Run | Staging |
| TC-D4-SEC-03 | Test authorization update | Positif | Not Run | Staging |
| TC-D4-SEC-04 | Test user tanpa permission tidak dapat mengubah data | Negatif | Not Run | Staging |
| TC-D4-SEC-05 | Test Management read-only: akun DIR-* berlabel Management, semua menu terbaca, tidak ada tombol simpan untuk data orang lain, POST ke semua endpoint 403 kecuali Daily KPI miliknya sendiri, INSERT langsung ke tabel D4 lain ditolak RLS | Positif | Not Run | O8 |
| TC-D4-SEC-06 | Test data sensitive tidak terlihat oleh role yang tidak berhak | Negatif | Not Run | Staging |
| TC-D4-SEC-07 | Test error tidak mengekspos token atau credential | Negatif | Not Run | Staging |
| TC-D4-SEC-08 | Test audit actor | Positif | Not Run | Staging |
| TC-D4-SEC-09 | Test audit timestamp | Positif | Not Run | Staging |
| TC-D4-SEC-10 | Test logout otomatis saat tidak aktif (asistensi 21 Nov 2026): setelah 29 menit tanpa klik, ketik, atau scroll di semua tab D4, muncul dialog `idle-warning` "Sesi akan berakhir" dengan jam logout dalam zona perangkat (WIB, WITA, atau WIT) dan hitung mundur `idle-countdown`; fokus di **Tetap masuk** (`btn-idle-stay`), yang menutup dialog dan memulai hitungan dari awal; menggerakkan mouse saat dialog terbuka tidak menutupnya; **Logout sekarang** (`btn-idle-logout`) atau habisnya 60 detik membawa ke `/login` dengan pesan `login-idle` "Anda logout otomatis pukul … karena tidak aktif selama 30 menit"; pesan itu hilang setelah login lagi; aktivitas di tab lain menunda logout di tab ini; ubah zona waktu perangkat ke Asia/Makassar → jamnya berlabel WITA | Positif | Not Run | Staging (cara cepat: ubah `localStorage.d4-last-activity` tidak cukup karena tab aktif menyimpan waktunya sendiri; jalankan dengan menunggu atau dengan jam perangkat dimajukan) |

### TC-D4-UIQ · TR-D4-002 Validation & UI quality

Kartu Planka: **[QA] Pengujian Integration, Security, Validation & UI Quality**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-UIQ-01 | Test loading state | Positif | Not Run | Staging |
| TC-D4-UIQ-02 | Test empty state | Positif | Not Run | Staging |
| TC-D4-UIQ-03 | Test validation state | Positif | Not Run | Staging |
| TC-D4-UIQ-04 | Test success state | Positif | Not Run | Staging |
| TC-D4-UIQ-05 | Test error state | Positif | Not Run | Staging |
| TC-D4-UIQ-06 | Test network failure | Negatif | Not Run | Matikan jaringan (DevTools → Offline) lalu simpan: expected toast "Tidak dapat terhubung ke server…", data tidak berubah |
| TC-D4-UIQ-07 | Test integration failure | Negatif | Not Run | Supabase tidak terjangkau / respons 503: expected `INTEGRATION_ERROR` dan pesan "Layanan data HRMS sedang tidak dapat dihubungi…" |
| TC-D4-UIQ-08 | Test feedback error dapat dipahami user | Positif | Not Run | Staging |
| TC-D4-UIQ-09 | Test form pattern konsisten | Positif | Not Run | Staging |
| TC-D4-UIQ-10 | Test table pattern konsisten | Positif | Not Run | Staging |
| TC-D4-UIQ-11 | Test status indicator konsisten | Positif | Not Run | Staging |
| TC-D4-UIQ-12 | Test action pattern konsisten | Positif | Not Run | Staging |
| TC-D4-UIQ-13 | Test demo/fixture data dapat dibedakan dari baseline data | Positif | Not Run | Staging |
| TC-D4-UIQ-14 | Test pola filter list (keputusan 13 Nov 2026): satu baris berisi search, tombol Period, dan tombol Filter (`btn-filter`); dropdown lain baru ada setelah `btn-filter` diklik, masing-masing berlabel di atas dengan pilihan kosong "All"; jumlah filter terisi tampil di tombol Filter (`filter-count`) dan tidak ada tag saat panel tertutup; Reset filter ada di dalam panel dan mengosongkan semua filter; Esc menutup daftar dropdown dulu, lalu panel, dan fokus kembali ke tombol Filter | Positif | Not Run | Staging, di People Dashboard, Performance Review, Competency Gap, Development Requirement, Training Tracking |
| TC-D4-UIQ-15 | Test toggle bahasa (24 Nov 2026): tanpa cookie halaman tampil bahasa Indonesia dan `btn-language-id` ber-`aria-pressed=true`; klik `btn-language-en` mengubah teks layar ke bahasa Inggris tanpa reload; reload tetap bahasa Inggris (cookie `andima-hrms-language=en`). Status workflow, nama KPI, dan nama pegawai tidak berubah | Positif | Not Run | Staging |
| TC-D4-UIQ-16 | Test cookie `andima-hrms-language` bernilai tidak dikenal (mis. `fr`): halaman tampil bahasa Indonesia tanpa error | Negatif | Not Run | Staging |
| TC-D4-UIQ-17 | Test testid stabil antarbahasa: di tiap halaman list, kumpulkan semua `data-testid`, klik `btn-language-en`, kumpulkan lagi; kedua set identik. Skrip Katalon yang ada lulus di kedua bahasa | Positif | Not Run | Staging |
| TC-D4-UIQ-18 | Test pemilih baris per halaman: `select-page-size` ada di kanan bawah sebelum label "per page"/"per halaman", pilihan 10/20/50/100; pilih 20 → `table-count` menampilkan "Showing 1–20 of …" (bila data > 20) dan halaman kembali ke 1 | Positif | Not Run | Staging |
| TC-D4-UIQ-19 | Test info berulang dihapus: skor di list Performance Review tanpa teks "from N daily entries"; kolom Period hilang saat filter Period dipilih; People Dashboard tanpa kolom Period; tabel tim Daily KPI berjudul **Days filled (/N)** dan **Compiled score / Gap vs 85**; alert dashboard dengan jumlah 1 di mode EN memakai bentuk tunggal ("1 employee has …") | Positif | Not Run | Staging |
| TC-D4-UIQ-20 | Test hover Logout (Gebi, 24 Nov 2026): arahkan kursor ke `btn-logout` → latar `#d9364f` penuh dan teks putih; fokus keyboard (Tab) memberi tampilan yang sama | Positif | Not Run | Staging |
| TC-D4-UIQ-21 | Test toast sukses putih (kesepakatan kelas 21 Nov 2026): simpan data apa pun → `toast-success` berlatar putih, bergaris tipis, ikon centang dan label SUCCEED/BERHASIL hijau; `toast-error` tetap merah | Positif | Not Run | Staging |
| TC-D4-UIQ-22 | Test halaman profil (mas Bram, 25 Nov 2026): klik avatar di header (`header-profile-link`) → `/profile` menampilkan nama, peran, Employee ID, email akun, posisi, departemen; judul tab "My Profile"/"Profil Saya" untuk semua peran | Positif | Not Run | Staging |
| TC-D4-UIQ-23 | Test ubah password: password saat ini benar, password baru ≥ 10 karakter berisi huruf, angka, karakter khusus, konfirmasi sama → toast sukses; logout lalu login dengan password baru berhasil, password lama ditolak. Uji dengan akun uji sendiri, bukan akun bersama | Positif | Not Run | Staging + akun uji |
| TC-D4-UIQ-24 | Test ubah password ditolak: password saat ini salah (`input-current-password` merah), password baru < 10 karakter, tanpa angka/karakter khusus, sama dengan password saat ini, atau konfirmasi berbeda → pesan di bawah field dan password tidak berubah | Negatif | Not Run | Staging + akun uji |

### TS-D4 · Skenario lintas fitur

| TS ID | Judul | Requirement | Kartu |
|---|---|---|---|
| TS-D4-001 | KPI berbeda menurut position | US-D4-001, US-D4-002; FR-D4-001, FR-D4-002; TR-D4-001, TR-D4-002 | [QA] TS-D4-001 |
| TS-D4-002 | Skill gap dan role change | US-D4-003; FR-D4-003; TR-D4-001 | [QA] TS-D4-002 |
| TS-D4-003 | Gap-based training dan completion | US-D4-004, US-D4-005; FR-D4-004, FR-D4-005; TR-D4-001 | [QA] TS-D4-003 |

### UC · Kartu uji berbasis use case (skema lama BF/E/A)

Dua kartu lama memakai alur use case (Basic Flow, Exception, Alternative). Nomor `TC-D4-002-01 s.d. 05` dan `TC-D4-003-01 s.d. 04` di deskripsinya berasal dari dokumen QA lama. Pemetaan ke RTM ini dibuat berdasarkan isi skenario, bukan nomor urut:

| Kartu | Item checklist | TC di RTM |
|---|---|---|
| [QA] UC-D4-002 Pelacakan KPI Employee | BF: tampilkan KPI sesuai position | TC-D4-002-01 |
| | E-1: employee/position/KPI reference tidak valid | TC-D4-007-06 |
| | E-2: tipe data KPI tidak valid | TC-D4-002-07, TC-D4-002-08 |
| | A-1: filter/pencarian KPI | TC-D4-002-15 |
| | A-2: KPI bersama performance | TC-D4-006-10 |
| [QA] UC-D4-003 Identifikasi Competency Gap | BF: perbandingan competency dan requirement | TC-D4-003-01 |
| | Missing evidence bukan confirmed gap | TC-D4-003-05 |
| | E-1: competency/position reference tidak valid | TC-D4-007-06 |
| | A-1: filter competency gap | TC-D4-003-10 |
| | A-2: gap menjadi development need | TC-D4-004-04 |

Rekomendasi: QA memakai ID RTM ini saat mencatat hasil agar tidak ada dua nomor untuk skenario yang sama.

## 7. Alur eksekusi

1. Staging siap → smoke test (RN-D4-001 §8).
2. Phase 1 → Phase 2 → Phase 3 → Integration/Security/UI Quality → TS lintas fitur.
3. FAIL → tiket Bug → WebDev fix → retest → Close/Reopen (kartu *[QA] Test Execution, Defect Reporting & Retest*).
4. Regression setelah fix terakhir → Final Test Report (kartu *[QA] Regression Testing & Final QA Evidence*).

## 8. Yang masih harus dilakukan QA

- Review coverage bersama PO sebelum eksekusi (item checklist tetap terbuka sampai review dilakukan).
- Tambahkan TC-D4-002-16 s.d. 19 ke checklist kartu **[QA] Pengujian Phase 1**.
- Isi expected result detail per TC dari Acceptance Criteria FR masing-masing.
