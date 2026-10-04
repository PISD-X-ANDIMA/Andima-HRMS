| Field | Value |
| --- | --- |
| **Document ID** | TP-D4-001 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Test Plan & Requirement Traceability Matrix |
| **Status** | Draft – menunggu review QA (Stella Olivia) dan PO (Gabriella Steny Carla Joyasita) |
| **Date** | 30 Sep 2026 |
| **Derived From** | US-D4-001 s.d. US-D4-006; FR-D4-001 s.d. FR-D4-007; TR-D4-001; TR-D4-002 |
| **Related** | API-D4-001; UI-D4-001; RN-D4-001 |
| **Kartu Planka** | [QA] Penyusunan Test Plan & Requirement Traceability D4 |

## 1. Tujuan dan cakupan

Dokumen ini memetakan setiap requirement D4 ke test case yang dapat dijalankan QA. ID test case diturunkan langsung dari checklist kartu QA di board Planka *Squad D4*, jadi satu baris checklist = satu TC ID. Test case baru (TC-D4-001) ditambahkan karena FR-D4-001 belum punya skenario di checklist mana pun.

Di luar cakupan: sertifikasi/renewal, trigger performance-gap formal, dan reassessment wajib (Academic/Project Extension sampai ada sumber resmi — lihat TS-D4-002/003).

## 2. Ringkasan coverage

| Requirement | Prefix TC | Jumlah TC | Kartu QA |
|---|---|---|---|
| US-D4-001 / FR-D4-001 Performance Evaluation | TC-D4-001 | 6 (baru) | [QA] Pengujian Phase 1 |
| US-D4-002 / FR-D4-002 KPI Scorecard | TC-D4-002 | 15 | [QA] Pengujian Phase 1 |
| US-D4-003 / FR-D4-003 Competency Gap | TC-D4-003 | 12 | [QA] Pengujian Phase 2 |
| US-D4-004 / FR-D4-004 Development Requirement | TC-D4-004 | 12 | [QA] Pengujian Phase 2 |
| US-D4-005 / FR-D4-005 Training Tracking | TC-D4-005 | 15 | [QA] Pengujian Phase 3 |
| US-D4-006 / FR-D4-006 Dashboard KPI Orang | TC-D4-006 | 23 | [QA] Pengujian Phase 3 |
| FR-D4-007 / TR-D4-001 Keterhubungan data | TC-D4-007 | 9 | [QA] Pengujian Integration, Security, Validation & UI Quality |
| TR-D4-002 Security & audit | TC-D4-SEC | 9 | idem |
| TR-D4-002 Validation & UI quality | TC-D4-UIQ | 13 | idem |
| Skenario lintas fitur | TS-D4-001 s.d. 003 | 3 | [QA] TS-D4-00x (list To Do List QA) |
| **Total** | | **117** | |

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
| MGT | Role Management read-only belum dikonfigurasi | TC-D4-SEC-05 | PO |
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
| TC-D4-002-02 | Test tepat 5 Core KPI sesuai position | Positif | Not Run | Staging |
| TC-D4-002-03 | Test bobot KPI sesuai baseline | Positif | Not Run | O2 (migrasi KPI V5.1 belum diterapkan) |
| TC-D4-002-04 | Test total bobot = 100% | Positif | Not Run | Staging |
| TC-D4-002-05 | Test total bobot selain 100% ditolak | Negatif | Not Run | Staging |
| TC-D4-002-06 | Test input skor mentah 1 sampai 5 | Positif | Not Run | Staging |
| TC-D4-002-07 | Test skor mentah di bawah 1 ditolak | Negatif | Not Run | Staging |
| TC-D4-002-08 | Test skor mentah di atas 5 ditolak | Negatif | Not Run | Staging |
| TC-D4-002-09 | Test weighted score = Bobot × Skor Mentah | Positif | Not Run | Staging |
| TC-D4-002-10 | Test total score = jumlah seluruh skor terbobot | Positif | Not Run | Staging |
| TC-D4-002-11 | Test target dan realisasi dapat disimpan | Positif | Not Run | Staging |
| TC-D4-002-12 | Test sistem tidak otomatis membuat skor mentah dari realisasi | Negatif | Not Run | Staging |
| TC-D4-002-13 | Test KPI milik position lain tidak muncul | Negatif | Not Run | Staging |
| TC-D4-002-14 | Test history scorecard per periode | Positif | Not Run | Staging |
| TC-D4-002-15 | Test pencarian/filter bila sudah tersedia | Positif | Not Run | Staging |

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
| TC-D4-006-07 | Test target dan realisasi | Positif | Not Run | Staging |
| TC-D4-006-08 | Test skor mentah | Positif | Not Run | Staging |
| TC-D4-006-09 | Test skor terbobot | Positif | Not Run | Staging |
| TC-D4-006-10 | Test ringkasan performance evaluation | Positif | Not Run | Staging |
| TC-D4-006-11 | Test competency gap | Positif | Not Run | Staging |
| TC-D4-006-12 | Test development requirement | Positif | Not Run | Staging |
| TC-D4-006-13 | Test progress training | Positif | Not Run | Staging |
| TC-D4-006-14 | Test pencarian employee | Positif | Not Run | Staging |
| TC-D4-006-15 | Test filter position | Positif | Not Run | Staging |
| TC-D4-006-16 | Test filter periode | Positif | Not Run | Staging |
| TC-D4-006-17 | Test drill-down ke detail sumber | Positif | Not Run | Staging |
| TC-D4-006-18 | Test dashboard tidak membentuk data bisnis terpisah | Negatif | Not Run | Staging |
| TC-D4-006-19 | Test dashboard tidak membuat status achieved/not achieved tanpa threshold resmi | Negatif | Not Run | Staging |
| TC-D4-006-20 | Test loading state | Positif | Not Run | Staging |
| TC-D4-006-21 | Test empty state | Positif | Not Run | Staging |
| TC-D4-006-22 | Test validation state | Positif | Not Run | Staging |
| TC-D4-006-23 | Test error state | Positif | Not Run | Staging |

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

### TC-D4-SEC · TR-D4-002 Security & audit

Kartu Planka: **[QA] Pengujian Integration, Security, Validation & UI Quality**

| TC ID | Skenario | Jenis | Status | Dependency / BLOCKED bila |
|---|---|---|---|---|
| TC-D4-SEC-01 | Test authentication | Positif | Not Run | Staging |
| TC-D4-SEC-02 | Test authorization create | Positif | Not Run | Staging |
| TC-D4-SEC-03 | Test authorization update | Positif | Not Run | Staging |
| TC-D4-SEC-04 | Test user tanpa permission tidak dapat mengubah data | Negatif | Not Run | Staging |
| TC-D4-SEC-05 | Test Management read-only bila konfigurasi tersebut digunakan | Positif | Not Run | Konfigurasi role Management belum ditetapkan PO |
| TC-D4-SEC-06 | Test data sensitive tidak terlihat oleh role yang tidak berhak | Negatif | Not Run | Staging |
| TC-D4-SEC-07 | Test error tidak mengekspos token atau credential | Negatif | Not Run | Staging |
| TC-D4-SEC-08 | Test audit actor | Positif | Not Run | Staging |
| TC-D4-SEC-09 | Test audit timestamp | Positif | Not Run | Staging |

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
- Isi expected result detail per TC dari Acceptance Criteria FR masing-masing.
