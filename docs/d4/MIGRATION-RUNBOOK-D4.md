# Runbook migrasi D4 (8 Nov 2026)

Database D4 adalah project Supabase bersama (`ufjbbwqaztgkqmpdmcyv`), dipakai juga oleh squad lain. Semua langkah di bawah **hanya dijalankan setelah PO D4 memberi izin**.

## Status: diterapkan 10 Nov 2026

- **Izin:** PO D4 (Gabriella), disampaikan lewat WebDev. Syaratnya: hanya yang sesuai permintaan Mas Bram. Ketujuh langkah cocok dengan sumbernya, yaitu wawancara 14 Okt (B5, B6, B17, target 85 dan skala 1–100) dan jawaban mitra (Q10–Q16).
- **Cara:** Supabase SQL Editor. Setiap file dibungkus `begin`/`commit` sehingga gagal di tengah berarti batal semua. Sebelum Run, isi editor dicocokkan dengan file lewat hash, dengan spasi awal baris diabaikan.
- **Backup:** `d4_backup.*_20261110` untuk `d4_kpi_assessments` (71 baris), `d4_development_need_versions` (67), `d4_training_versions` (32), `d4_kpi_catalog_versions` (1), `d4_kpi_role_catalog` (100), dan `d4_position_kpi_roles` (13). RLS aktif, jadi tidak terbaca lewat API.
- **Cek sesudah (read-only), semuanya sesuai tabel di bawah:**
  - Langkah 1: V6 berlaku dari 2026-11, 50 baris katalog V6 dengan target 85, 8 posisi V6, `overall_score` menjadi `numeric(5,2)`, dan 0 dari 71 skor lama berubah.
  - Langkah 2–4: kolom baru ada; constraint Reference berstatus NOT VALID.
  - Langkah 5–7: 5 policy baca menerima MANAGEMENT; `d4_kpi_daily_entries` punya RLS, 2 policy, dan 2 trigger, dengan hak `authenticated` hanya SELECT dan INSERT dan tanpa akses `anon`; DIR-FAT dan DIR-GEN mendapat peran 2 untuk V5.1 dan V6.
- **Riwayat:** 9 baris di `supabase_migrations.schema_migrations` (`created_by = 'd4-runbook'`), yaitu tujuh langkah ini ditambah `d4_kpi_catalog_v51` dan `d4_development_method_pic`.
- **Di aplikasi:** akun Manager membuka Daily KPI dengan katalog V6 skala 1–100, tabel tim tampil, dan pengingat serta lonceng aktif.
- **Uji akses di database (10 Nov, lihat "Data demo dan uji akses"):** 11 dari 11 lulus lewat simulasi sesi. Director (MANAGEMENT) membaca semua data, Daily KPI miliknya diterima, dan data orang lain ditolak RLS. Employee hanya bisa mengisi hari ini untuk dirinya, sedangkan besok dan bulan lalu ditolak. **Belum dicek dengan login UI:** tombol simpan Director dan respons 403 dari API.
- **Scorecard V5.1 di periode V6:** dua baris milik Aldo Sapan (2026-11 dan 2026-12) dihapus 10 Nov, dengan backup. Lihat "Data demo dan uji akses".

Tabel "Kondisi live" di bawah adalah kondisi sebelum penerapan.

## Kondisi live (dicek read-only, 8 Nov 2026)

| Migrasi (file) | Status live | Catatan |
|---|---|---|
| s.d. `20261017120000_d4_employee_employment_status` | Diterapkan | Tercatat di `supabase_migrations.schema_migrations`, dengan versi timestamp yang berbeda dari nama file. |
| `20260929150000_d4_kpi_catalog_v51` | Diterapkan, **tidak tercatat** | Katalog V5.1 ada di live, tetapi tidak ada di riwayat migrasi. |
| `20261015120000_d4_development_method_pic` | Diterapkan, **tidak tercatat** | Kolom `method` dan `pic` ada di live. |
| `20261006130000_d4_kpi_editable_core_name` | Belum | Sudah dilebur ke V6. Jangan diterapkan sendiri. |
| `20261017130000_d4_kpi_scale_100_v6` | **Belum** | Katalog live hanya V5.1. |
| `20261019120000_d4_development_edit_reassessment` | **Belum** | Kolom `priority` dan `reassessment` belum ada. |
| `20261020120000_d4_kpi_reference_required` | **Belum** | |
| `20261020130000_d4_training_follow_up` | **Belum** | Kolom `follow_up` belum ada. |
| `20261108120000_d4_management_read_only` | **Belum** (baru) | Director menjadi MANAGEMENT, read-only. |
| `20261108130000_d4_kpi_daily_entries` | **Belum** (baru) | Tabel Daily KPI. |
| `20261109120000_d4_director_kpi_role` | **Belum** (baru) | DIR-FAT dan DIR-GEN dipetakan ke peran KPI 2 "Director" (V5.1 dan V6). Cek live 9 Nov: keduanya belum punya peran KPI. |

**Jangan pakai `supabase db push`.** Dua migrasi yang tidak tercatat akan dicoba diterapkan ulang dan gagal (katalog dan kolom sudah ada). Terapkan file satu per satu, sesuai urutan di bawah, lewat SQL editor atau `apply_migration` dengan nama file yang sama.

## Prasyarat

1. Aplikasi dari cabang ini (atau main yang sudah memuatnya) sudah di-deploy. Aplikasi ini aman sebelum dan sesudah migrasi:
   - snapshot membaca `select("*")`;
   - Daily KPI menampilkan "belum tersedia" selama tabelnya belum ada;
   - follow-up training memberi pesan jelas sebelum kolomnya ada.
2. Backup logis tabel D4. Contoh: `create table d4_backup.<tabel>_20261108 as table public.<tabel>;` untuk `d4_kpi_assessments`, `d4_development_need_versions`, dan `d4_training_versions`.
3. PO menyetujui keputusan scorecard 2026-12 (lihat "Temuan").

## Urutan penerapan

| # | File | Cek sebelum | Cek sesudah |
|---|---|---|---|
| 1 | `20261017130000_d4_kpi_scale_100_v6.sql` | `select * from d4_kpi_catalog_versions;` → hanya V5.1 | Ada V6 dengan `effective_from = '2026-11'`; `select count(*) from d4_kpi_role_catalog where source_version='V6'` = jumlah baris V5.1 |
| 2 | `20261019120000_d4_development_edit_reassessment.sql` | Kolom `priority` belum ada di `d4_development_need_versions` | Kolom ada; tes Development edit berjalan |
| 3 | `20261020120000_d4_kpi_reference_required.sql` | `select count(*) from d4_kpi_assessments where evidence_reference is null or btrim(evidence_reference)=''` (3 baris lama boleh) | Constraint `d4_kpi_assessments_evidence_reference_required` ada (NOT VALID) |
| 4 | `20261020130000_d4_training_follow_up.sql` | Kolom `follow_up` belum ada | Kolom ada; follow-up training bisa disimpan |
| 5 | `20261108120000_d4_management_read_only.sql` | `select d4_current_role()` sebagai akun DIR-* → `MANAGER` | Sebagai DIR-* → `MANAGEMENT`; snapshot tetap terbaca; POST apa pun → 403, kecuali Daily KPI miliknya sendiri setelah langkah 6 |
| 6 | `20261108130000_d4_kpi_daily_entries.sql` | Tabel belum ada; langkah 1 dan 5 sudah selesai | Tabel ada; RLS aktif; grant `authenticated` hanya SELECT dan INSERT; menu Daily KPI bisa dipakai |
| 7 | `20261109120000_d4_director_kpi_role.sql` | `select p.code, k.source_version, k.role_order from d4_position_kpi_roles k join d3_positions p on p.id = k.position_id where p.code like 'DIR-%'` → kosong | 4 baris: DIR-FAT dan DIR-GEN × V5.1/V6, `role_order = 2`. Director melihat "My KPI today" dengan KPI Director. |

Langkah 7 butuh langkah 1 untuk baris V6. Bila dijalankan lebih dulu, baris V6 dilewati, jadi jalankan ulang setelah langkah 1; isinya tidak akan dobel.

Langkah 6 bergantung pada langkah 1, karena trigger skor harus mengenal skala 1–100, dan pada langkah 5, karena policy insert merujuk ke `MANAGEMENT`.

## Uji setelah penerapan (akun uji dari PO, jangan akun pribadi)

- **Employee:** buka Daily KPI dan simpan skor hari ini. Uji:
  - mengisi untuk tanggal besok ditolak;
  - mengisi untuk tanggal bulan lalu ditolak;
  - mengirim POST dengan `employeeId` orang lain tetap tersimpan atas nama diri sendiri.
- **HR:** buka Add Performance Review untuk pegawai yang sudah mengisi Daily KPI. Actual harus terisi otomatis, dan Gap tampil.
- **Director (DIR-GEN/DIR-FAT):** semua halaman bisa dibaca, label peran "Management", dan tidak ada tombol simpan untuk data orang lain. POST ke endpoint apa pun ditolak dengan 403, kecuali `POST /api/d4/kpi-daily` untuk Daily KPI miliknya sendiri (bila posisinya punya KPI).

Perilaku RLS langkah 5 dan 6 sudah diuji di Postgres 16 lokal dengan stub auth, B2, dan D3 (8 Nov 2026).
- Diterima: entri sendiri untuk hari ini, dan koreksi.
- Ditolak:
  - entri untuk orang lain, besok, periode lalu, atau periode yang tidak cocok dengan tanggal;
  - peran KPI lain dan skor 101;
  - UPDATE dan DELETE;
  - posisi tanpa KPI dan anon.
- Diuji ulang 9 Nov setelah Director diizinkan mengisi Daily KPI sendiri: entri Director untuk dirinya diterima, entri Director untuk pegawai lain dan entri pegawai untuk Director ditolak.

## Rollback

| # | Langkah |
|---|---|
| 7 | `delete from public.d4_position_kpi_roles where position_id in (select id from public.d3_positions where code in ('DIR-FAT', 'DIR-GEN')) and role_order = 2;` Lakukan sebelum ada scorecard atau entri harian Director. |
| 6 | `drop table public.d4_kpi_daily_entries; drop function public.d4_current_kpi_role(text);` Entri harian ikut hilang; backup dulu bila sudah dipakai. |
| 5 | Jalankan ulang definisi lama: `d4_current_role()` dari `20261013120000`, view `d4_employee` dari `20261017120000`, view `d4_employee_skills` dari `20261014120000`, dan lima policy baca dengan `array['HR','MANAGER']`. |
| 4, 2 | Kolom baru bisa dibiarkan; aplikasi tetap jalan tanpa memakainya. Hapus hanya bila belum ada data di dalamnya. |
| 3 | `alter table public.d4_kpi_assessments drop constraint d4_kpi_assessments_evidence_reference_required;` |
| 1 | Hanya selama belum ada scorecard V6: hapus baris V6 dari `d4_position_kpi_roles`, `d4_kpi_role_catalog`, dan `d4_kpi_catalog_versions`. |

## Temuan yang perlu keputusan PO

- **Scorecard periode 2026-12 di V5.1 (selesai 10 Nov: dihapus bersama scorecard 2026-11 V5.1, lihat "Data demo dan uji akses"):** 1 baris live untuk periode yang belum mulai, disimpan sebelum aturan D4-FN-01. Setelah V6 berlaku, baris itu tetap berskala 1–5 di periode V6. Aplikasi menampilkannya apa adanya: skala 1–5, tanpa band dan tanpa gap. Revisi atas baris itu harus memakai V6. Saran: HR menghapus atau merevisinya.
- **Riwayat migrasi:** setelah langkah di atas selesai, catat juga dua migrasi yang tidak tercatat (`d4_kpi_catalog_v51`, `d4_development_method_pic`) di `schema_migrations`, supaya `db push` kelak tidak mencoba menerapkannya lagi.

## Pembersihan requirement uji (10 Nov 2026)

Ini perubahan data, bukan migrasi skema. Tabel `position_requirements` milik D3 dan kini dikelola D1.

- **Izin:** PO D4 (Gabriella), dengan syarat penghapusannya aman. Izin disampaikan lewat WebDev. D1 dan PO D3 perlu diberi tahu; pesannya untuk Valent sudah disiapkan.
- **Latar:** D1 menemukan requirement yang tidak cocok dengan posisinya saat integrasi data D1. Requirement itu tampil di Competency Gap.
- **Dihapus, 20 baris:**
  - 18 requirement dengan kompetensi `DEMO-D4-C*` berlabel "Demo D4:" (kepabeanan, gudang, cabang): 12 di COM-SA, 3 di COM-CS-MGR, dan 3 di FAT-ACC-MGR.
  - 2 kompetensi IT di COM-SA, yaitu `D4-SIM-S15` dan `D4-SIM-S16`. Keduanya kemungkinan besar ikut terbawa saat posisi Tim IT diubah menjadi COM-SA: 28 penilaian kompetensi 14 Okt, termasuk milik pegawai IT, tercatat di posisi yang sama.
- **Cek sebelum (read-only):**
  - Satu-satunya foreign key ke tabel ini berasal dari `d4_development_needs`, dan tidak ada baris yang merujuk ke-20 baris target. Tabel ini juga tidak punya trigger.
  - Pencarian ke-20 ID di semua kolom teks dan JSON seluruh tabel hanya menemukannya di 28 snapshot `d4_competency_assessments`. Snapshot itu riwayat dan tidak diubah.
- **Cara:**
  - Satu transaksi di SQL Editor. Skrip lebih dulu memastikan setiap ID masih pasangan posisi dan kompetensi yang sama, dan tidak dirujuk development need. Bila tidak, transaksi batal.
  - Isi editor dicocokkan dengan file lewat hash, dengan spasi awal baris diabaikan.
  - Skrip diuji dulu di Postgres 16 lokal dengan salinan baris live: jalan pertama, jalan ulang (batal), rollback, serta dua kasus yang harus batal.
- **Hasil:**
  - Jumlah requirement: COM-SA 18 → 4, COM-CS-MGR 8 → 5, FAT-ACC-MGR 6 → 3.
  - Backup: `d4_backup.position_requirements_test_rows`, 20 baris, RLS aktif.
  - Tidak ada development need yang kehilangan rujukan.
  - Halaman Competency Gap Emma Watson di production tidak lagi menampilkan baris "Demo D4".
- **Sengaja tidak dihapus:**
  - `D4-SIM-S14` di COM-SA (`85385771-cce2-4967-af4f-32109570ef0e`). Requirement ini dirujuk development need `e42a24ce-dad2-4d00-9118-619205bec6fe` milik akun yang tidak lagi ada di `b2_register`, yang punya 2 versi dan 1 training record. Menghapusnya berarti menghapus riwayat D4, jadi butuh keputusan PO.
  - 12 requirement `DEMO-D4-C*` lain. Semuanya menempel di 2 posisi yang tidak terbaca di `d3_positions` dan tidak dipegang pegawai, sehingga tidak tampil di aplikasi.
- **Rollback:**

  ```sql
  insert into public.position_requirements (id, position_id, competency_id, min_proficiency_level, is_mandatory, created_at)
  select id, position_id, competency_id, min_proficiency_level, is_mandatory, created_at
  from d4_backup.position_requirements_test_rows;
  ```

## Data demo dan uji akses (10 Nov 2026)

Perubahan data atas permintaan WebDev untuk presentasi. Aturan awal "tidak menulis data uji ke database live" sengaja dikecualikan untuk langkah ini.

- **Uji akses (tanpa perubahan data):**
  - Satu blok `DO` yang selalu diakhiri `raise exception`. Identitas diganti dengan `set local role authenticated` ditambah klaim JWT, sehingga RLS menilai persis seperti panggilan dari aplikasi.
  - Director (Stevanus Imanuel, DIR-FAT):
    - peran MANAGEMENT;
    - membaca 71 scorecard;
    - Daily KPI miliknya diterima;
    - Daily KPI dan scorecard orang lain ditolak RLS.
  - Employee (Tom Hanks, FAT-TRS-ASC):
    - peran EMPLOYEE;
    - entri hari ini diterima;
    - besok dan bulan lalu ditolak;
    - tidak melihat entri orang lain;
    - scorecard ditolak.
  - Hasil 11 dari 11 lulus. Sesudahnya jumlah baris tidak berubah.
- **Data demo Daily KPI:**
  - 33 entri V6 untuk lima akun bernama fiktif, di hari kerja 2–10 Nov 2026: Tom Hanks dan Emma Watson masing-masing 6, lalu Michael Jackson, Testing Manager, dan Testing HR masing-masing 7.
  - 11 Nov sengaja kosong untuk diisi saat demo.
  - Skor dibuat deterministik (dasar per orang ± 4).
  - Penanda: `actor_auth_user_id` = akun Deltaoga Putra (WebDev), berbeda dari `employee_id`. Kolom ini tidak tampil di aplikasi.
- **Scorecard V5.1 di periode V6:** dua scorecard Aldo Sapan, `47eeb3e9-…` (2026-11) dan `0fe38320-…` (2026-12), dihapus. Keduanya disimpan sebelum V6 berlaku dan tidak dirujuk development need. Backup: `d4_backup.kpi_assessments_v51_in_v6_period` (2 baris, RLS aktif).
- **Cara:**
  - Satu transaksi dengan cek: kelima akun aktif dan punya peran KPI V6, belum ada entri, tepat 33 entri masuk, dan tepat 2 scorecard terhapus.
  - Diuji dulu di Postgres 16 lokal dengan katalog, ID, dan trigger yang sama: jalan pertama, jalan ulang (batal), rollback, dan dua kasus yang harus batal.
  - Isi editor dicocokkan dengan file lewat hash.
- **Hasil di production:**
  - Skor periode di halaman Daily KPI (tim):

    | Akun | Skor | Kategori |
    |---|---|---|
    | Tom Hanks | 89.00 | High |
    | Michael Jackson | 91.60 | High |
    | Testing Manager | 85.60 | High |
    | Emma Watson | 83.30 | Average |
    | Testing HR | 75.60 | Under |

  - Alert "Daily KPI di bawah target" berisi Emma Watson dan Testing HR.
  - Form Add Performance Review untuk Tom Hanks terisi dari 6 entri (total 89.00). Form ditutup tanpa menyimpan.
- **Rollback:**

  ```sql
  delete from public.d4_kpi_daily_entries
  where actor_auth_user_id = '3ac5b219-1d2a-4b6d-80d4-e8046ad36125' and employee_id <> actor_auth_user_id;

  begin;
  alter table public.d4_kpi_assessments disable trigger d4_kpi_assessments_version;
  insert into public.d4_kpi_assessments select * from d4_backup.kpi_assessments_v51_in_v6_period;
  alter table public.d4_kpi_assessments enable trigger d4_kpi_assessments_version;
  commit;
  ```

  Trigger versi dimatikan sementara karena periode 2026-11 dan 2026-12 kini mewajibkan V6.

## KPI dari D1 (24 Nov 2026): diterapkan 24 Nov 2026

Migrasi `20261124130000_d4_kpi_from_d1.sql`. Isinya: mulai periode 2026-11, KPI posisi yang dipetakan D1 diambil dari `d1_kpi_definitions`, jumlah KPI mengikuti D1 asal total bobotnya 100, dan view `d4_kpi_scores_for_d1` disediakan untuk D1. Detail kolomnya ada di API-D4-001 §8.

- **Status:** diterapkan di production pada 24 Nov 2026 lewat SQL Editor, satu transaksi, dengan izin PO (PO D4 Gabriella, disampaikan lewat WebDev). Tercatat di `schema_migrations` sebagai `20261124130000` / `d4-runbook`. Hasil cek sesudah sama dengan yang tertulis di bawah: 8 posisi pegawai berlabel D1 (1001, 1002, 1005, 1007, 1011, 1017, 1032 dengan 5 KPI, 1031 dengan 3 KPI), DIR-GEN, FAT-BIL-001, dan FAT-TRS-ASC tetap D4. Data lama tidak berubah (95 scorecard, 69 entri Daily KPI). Fungsi lama untuk rollback diambil dari live sebelum penerapan.

- **Kondisi live (dicek read-only, 24 Nov 2026):**
  - Ada 9 pemetaan D3 → D1 yang aktif. Delapan sudah punya KPI berbobot 100: COM-CS-MGR, COM-SA, DIR-FAT, FAT-ACC-MGR, FAT-TAX-MGR, FAT-TRS-MGR, dan HCC-HR-MGR dengan 5 KPI, serta IT dengan 3 KPI.
  - COM-FA (Field Agent, JP030) sudah dipetakan, tetapi D1 belum mengisi KPI-nya. Posisi ini tetap tanpa KPI, sama seperti sekarang.
  - Posisi yang belum dipetakan, misalnya Billing (JP003 punya 4 KPI di D1, tetapi belum ada pemetaannya), General Director, dan Cash Associate, tetap memakai peran katalog D4 V6.
- **Diuji lokal:** Postgres 16 dengan salinan struktur live dan data contoh, kasus T1–T15 lulus. Yang diuji:
  - isi katalog dan urutan KPI;
  - peran per posisi, termasuk posisi tanpa pemetaan dan posisi D1 yang tidak aktif;
  - Daily KPI dan Performance Review dengan 5 dan 3 baris, serta penolakan jumlah baris dan bobot yang salah;
  - RLS view untuk HR, Employee, `service_role`, dan `anon`;
  - koreksi Daily KPI terbaru dan pencocokan baris V6 lama lewat nama KPI;
  - `id` view D1 yang unik per baris.
- **Urutan:**
  1. Deploy aplikasi lebih dulu. Selama view belum ada, loader katalog kembali membaca tabel, jadi deploy ini tidak mengubah apa pun di live.
  2. Terapkan `20261124130000_d4_kpi_from_d1.sql` dalam satu transaksi lewat SQL Editor. Seperti biasa, cocokkan isi editor dengan file lewat hash sebelum Run.
  3. Catat di `supabase_migrations.schema_migrations` dengan `created_by = 'd4-runbook'`.
  - `20261116120000_d4_mid_hrms_summary.sql` (view untuk MID) tidak bergantung pada migrasi ini. Syarat "tepat 5 baris" di dalamnya sudah dihapus supaya scorecard IT dengan 3 KPI ikut dihitung.
- **Cek sesudah (read-only):**

  ```sql
  -- Setiap posisi D1 aktif berbobot 100. Yang dipakai pegawai: 1001, 1002, 1005, 1007, 1011, 1017, 1032 (5 baris) dan 1031 (3 baris).
  select role_order, d1_job_code, count(*), sum(weight_percent)
  from public.d4_kpi_catalog_rows where source_version = 'V6' and kpi_source = 'D1' group by 1, 2 order by 1;
  -- Posisi pegawai: 8 posisi berlabel D1, sisanya D4.
  select p.code, r.role_order, r.kpi_source
  from public.d4_kpi_position_roles r join public.d3_positions p on p.id = r.position_id
  where r.source_version = 'V6' order by 1;
  -- View D1 dibaca sebagai service_role, lalu dibatalkan.
  begin;
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select source, count(*), count(distinct kpi_id) from public.d4_kpi_scores_for_d1 group by 1;
  rollback;
  ```

  Posisi D1 yang belum dipetakan, misalnya JP003, ikut muncul di katalog, tetapi tidak dipakai pegawai mana pun sampai D1 memetakannya.
- **Efek ke data November:** di live 24 Nov, 20 pegawai berada di posisi yang akan pindah ke KPI D1. Empat di antaranya punya 63 entri Daily KPI November, dan 17 Performance Review November mereka sudah completed. Entri Daily KPI November yang sudah tersimpan dengan peran D4 tetap utuh. Begitu pegawai mengisi satu hari dengan set D1, skor periode hanya menghitung hari dengan set D1 (`modules/d4/kpi/daily.ts`), sehingga hari dengan set lama tidak ikut dihitung. Scorecard yang sudah tersimpan tidak berubah. Revisinya tetap bisa disimpan dengan set D1 karena `revisionOf` mengikuti scorecard terbaru periode itu, apa pun perannya; hanya perbandingan skor lama per baris yang tidak tampil. Peralihan mulai Desember tidak cukup dengan mengganti tanggal di view. View memilih versi katalog lewat `effective_from`, dan V6 berlaku sejak 2026-11, jadi Desember butuh versi katalog baru (misalnya V7 berlaku 2026-12, salinan V6) ditambah `'2026-12'` di bagian 3 migrasi.
- **Rollback (urutannya penting):**
  1. `drop view public.d4_kpi_scores_for_d1;`
  2. Jalankan ulang isi fungsi `d4_current_kpi_role` dari `20261108130000` dan `d4_calculate_kpi_assessment` dari `20261017130000`.
  3. `drop view public.d4_kpi_position_roles, public.d4_kpi_catalog_rows, public.d4_kpi_d1_position_roles, public.d4_kpi_d1_catalog;`
  4. Kembalikan tiga constraint (5 baris, `role_order` 1..10) hanya jika belum ada scorecard atau entri harian dengan jumlah baris lain. Aplikasi otomatis kembali membaca tabel begitu view hilang.

## Periode terbuka dan tertutup (24 Nov 2026): belum diterapkan

Migrasi `20261124150000_d4_period_reopenings.sql`. Isinya:
- tabel `d4_period_reopenings` (insert-only; HR menambah baris atas namanya sendiri, semua role D4 membaca);
- fungsi `d4_period_is_open(period, today)`;
- trigger `*_open_period` pada `d4_kpi_assessments` dan `d4_performance_evaluations`. Trigger ini menolak periode tertutup dan mengisi `evaluation_date` dengan hari ini (WIB).

**Butuh izin PO.**

- **Yang sudah berlaku tanpa migrasi, begitu aplikasi di-deploy:**
  - API dan form memakai aturan default: bulan berjalan dan bulan lalu terbuka.
  - Tanggal evaluasi selalu hari penyimpanan.
  - Tanpa tabel, tidak ada periode lama yang bisa dibuka kembali.
- **Dampak di live (dicek read-only, 24 Nov 2026):**
  - Scorecard tersimpan: 2026-01 1 baris, 2026-09 18, 2026-10 45, 2026-11 31. Evaluasi lama: 2026-10 2 baris. Tidak ada yang diubah.
  - Mulai deploy, Performance Review baru atau revisi untuk September ditolak. Oktober tertutup pada 1 Desember.
  - Skrip Katalon yang menyimpan Performance Review untuk periode lama akan mendapat 422. Pakai periode berjalan, atau buka kembali periodenya setelah migrasi diterapkan.
- **Diuji lokal:** Postgres 16, kasus T1–T10 lulus:
  - matriks aturan, termasuk 1 Desember dan pergantian tahun;
  - tanggal evaluasi mundur diganti hari ini;
  - periode tertutup, belum mulai, dan sebelum September ditolak di kedua tabel;
  - Manager tidak bisa membuka periode, dan HR tidak bisa memakai nama orang lain;
  - periode di bawah 2026-09, `open_until` sebelum awal periode, dan alasan pendek ditolak;
  - tidak ada UPDATE atau DELETE;
  - Employee membaca, `anon` ditolak;
  - baris terbaru menutup periode lagi.
- **Urutan:** deploy aplikasi lebih dulu, lalu terapkan file ini dalam satu transaksi. Catat di `supabase_migrations.schema_migrations` dengan `created_by = 'd4-runbook'`.
- **Membuka kembali periode (setelah migrasi):** HR memakai Performance Review → Buka Kembali Periode. Tanpa aplikasi, jalankan di SQL Editor dengan `actor_employee_id` diisi id HR yang meminta:

  ```sql
  insert into public.d4_period_reopenings (period, open_until, reason, actor_employee_id)
  values ('2026-09', '2026-11-30', 'Penilaian September terlambat dicatat', '<uuid HR>');
  -- Menutup lebih awal: tambah baris baru dengan open_until kemarin.
  ```
- **Cek sesudah (read-only):**

  ```sql
  select p, public.d4_period_is_open(p) from (values ('2026-09'), ('2026-10'), ('2026-11'), ('2026-12')) v(p);
  -- Hasil 24 Nov tanpa pembukaan: f, t, t, f.
  ```
- **Rollback:** hapus trigger `d4_kpi_assessments_open_period` dan `d4_performance_evaluations_open_period`, lalu fungsi `d4_require_open_period` dan `d4_period_is_open`, lalu tabel `d4_period_reopenings`.
