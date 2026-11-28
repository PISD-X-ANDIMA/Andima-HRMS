# Prompt untuk Valent (D1): data yang masih dibutuhkan D4

Salin semua isi di bawah garis ke agent, atau ikuti sendiri sebagai checklist. Kondisi data diambil dari Supabase bersama secara read-only pada 9 Nov 2026.

---

## Tujuan

D4 (Performance & Training) akan membaca definisi KPI dan persyaratan kompetensi dari D1, bukan dari katalog D4 sendiri. Supaya bisa, data di bawah harus lengkap.

Tugasmu: **lengkapi semua data yang masih kurang**. Kalau data yang dibutuhkan ternyata berada di tabel squad lain (D3 atau B2), tambahkan juga, lalu kabari PO squad tersebut.

## Kenapa ini dibutuhkan

- Pegawai, lewat `b2_register.position_id`, dan D4 memakai posisi dari **`d3_positions`**.
- KPI D1 menempel ke **`d1_job_positions`**, yang tidak terhubung ke `d3_positions`. Tabel pemetaannya, `d3_d1_position_mappings`, masih **0 baris**.
- Akibatnya, KPI D1 belum bisa dicocokkan ke satu pegawai pun.
- Scorecard D4 mensyaratkan **tepat 5 Core KPI per posisi**, dengan total bobot 100 dan target 85. Dasarnya permintaan klien 14 Okt (B1, B4) dan KPI Scorecard V5.1. Sebagian besar posisi D1 baru punya 4 KPI.

## Aturan kerja (database dipakai bersama semua squad)

1. Sebelum mengubah data, ekspor dulu tabel yang akan diubah, misalnya ke CSV atau `create table ..._backup_20261109 as table ...`.
2. **Hanya tambah atau ubah baris data.** Jangan mengubah skema. Jangan menghapus posisi, departemen, atau KPI, karena D2 membaca `d1_job_positions` dan penghapusan ikut menghapus KPI dan sertifikasi posisi itu. Posisi yang tidak dipakai cukup dinonaktifkan.
3. Pakai UI D1 kalau bisa. Kalau harus lewat SQL, pakai akun yang memang berhak, dan catat setiap perubahan: tabel, id, nilai lama, nilai baru.
4. **Jangan menebak** pasangan posisi yang tidak jelas, atau isi KPI yang tidak ada di sumber. Tulis `[perlu keputusan PO]` dan tanyakan.
5. Isi KPI dan struktur organisasi perlu persetujuan Pak Gema (permintaan klien 14 Okt, B24). Catat bahwa data ini menunggu persetujuan itu.
6. Setelah selesai, jalankan query verifikasi di bagian akhir, lalu kirim hasilnya ke D4 (Delta).

## Data yang harus dilengkapi

### 1. Pemetaan posisi D3 ke D1 (prioritas tertinggi)

Isi tabel `d3_d1_position_mappings`. Kolomnya: `position_id` (d3), `d1_position_id`, `source_job_code`, `source_position_name`, `source_department_key`, `is_active`.

Setiap posisi yang dipegang pegawai harus punya satu pasangan Active di D1:

| d3 code | d3 title | Pegawai | Pasangan D1 | Yang perlu dilakukan |
|---|---|---|---|---|
| HCC-HR-MGR | HR Manager | 9 | JP011 HR Manager | Petakan |
| COM-SLS-003 | Sales Executive | 5 | JP018 / JP020 / JP021 Sales Executive 1/2/3 (**Inactive**) | `[perlu keputusan PO]`: level mana. Aktifkan posisi yang dipilih. |
| COM-CS-MGR | Manager of Customer Success | 3 | JP017 (**Inactive**) | Aktifkan, lalu petakan |
| COM-FA | Field Agent | 3 | belum ada | Buat posisi di D1, lalu petakan |
| IT | IT | 3 | belum ada | Buat posisi di D1, lalu petakan |
| COM-SA | Sales Administration Associate | 2 | belum ada | Buat posisi di D1, lalu petakan |
| DIR-GEN | General Director / Director Umum | 2 | belum ada | Buat posisi di D1, lalu petakan |
| FAT-TAX-ASC-002 | Tax Associate | 2 | JP008 / JP009 Tax Associate 1/2 | `[perlu keputusan PO]`: 1 atau 2 |
| FAT-TAX-MGR | Tax Manager | 2 | JP007 Tax Manager | Petakan |
| FAT-TRS-ASC | Cash Associate | 2 | JP006 Cash Manager Associate? | `[perlu keputusan PO]`: pastikan posisinya sama |
| DIR-FAT | Director of Finance, Accounting & Digital Transformation | 1 | JP001 | Petakan |
| FAT-ACC-MGR | Manager of Accounting | 1 | JP002 | Petakan |
| FAT-BIL | Billing | 1 | JP003 Accounting Associate 1 (Billing)? | `[perlu keputusan PO]` |
| FAT-TRS-MGR | Cash Manager | 1 | JP005 Cash Manager | Petakan |

Isi juga `d3_d1_department_mappings` (sekarang 0 baris) untuk departemen posisi-posisi di atas.

### 2. Lima Core KPI per posisi (`d1_kpi_definitions`)

Untuk setiap posisi D1 yang dipetakan di bagian 1:
- **Tepat 5 KPI aktif**, dengan total `kpi_weight` = 100.
  - Saat ini sebagian besar posisi baru punya 4 KPI.
  - JP001, JP010, dan JP011 sudah 5 KPI.
  - Posisi baru (Field Agent, IT, Sales Administration Associate, General Director) belum punya KPI sama sekali.
- `kpi_target` diisi angka `85` (target tetap dari klien, B1). Semua KPI D1 yang ada sudah 85; pertahankan.
- Nama KPI diambil dari KPI Scorecard V5.1 klien. Daftar per peran ada di repo D4, `modules/d4/kpi/catalog.ts` (`KPI_V51_CATALOG`, 10 peran × 5 KPI dengan bobotnya). Pemetaan posisi ke peran yang dipakai D4 sementara ini bisa dilihat di tabel `d4_position_kpi_roles`.
- Kalau KPI ke-5 tidak ada di sumber mana pun, tulis `[perlu keputusan PO]`. Jangan membuat nama KPI sendiri.

### 3. Persyaratan kompetensi per posisi (`position_requirements`)

`position_requirements` merujuk ke `d3_positions` dan `d3_competencies`. Dari keputusan K2 (rencana data lintas squad), D1 diusulkan mengelola tabel yang sudah terisi ini.

Posisi yang dipegang pegawai tetapi **belum punya requirement sama sekali**:
- Sales Executive (5 pegawai)
- Field Agent (3)
- IT (3)
- General Director (2)
- Tax Associate (2)
- Billing (1)
- Director of Finance (1)

Setiap requirement butuh `competency_id`, `min_proficiency_level` (1–5), dan `is_mandatory`.

Contoh dari wawancara 18 Sep (A4): promosi Tax Officer menjadi Tax Manager harus menguasai **Brevet A/B** dan audit. Pastikan keduanya ada sebagai requirement kompetensi Tax Manager. Sertifikasinya juga perlu tercatat di `d1_position_certifications`.

### 4. Data di squad lain (tambahkan, lalu kabari PO squad pemiliknya)

| Data | Tabel (pemilik) | Kondisi | Yang perlu ditambah |
|---|---|---|---|
| Level kompetensi aktual pegawai | `d3_employee_skills` (D3) | Baru **13 dari 37** pegawai aktif yang punya data skill | Level 1–5 untuk setiap kompetensi yang disyaratkan posisi masing-masing pegawai. Dicocokkan lewat email di `d3_employee`. |
| Garis atasan–bawahan | `d3_employee_reporting` (D3) | Baru **3** baris | Satu baris per pegawai ke atasan langsungnya (`manager_employee_id`, `subordinate_employee_id`, `effective_from`, `is_active`), sesuai struktur organisasi dari Mas Bram |
| Status trainee | `b2_register.employment_status` (B2) | Dipilih sendiri oleh pendaftar | Pastikan pegawai trainee berstatus `PROBATION` atau `INTERN`, dan pegawai tetap tidak |

## Sumber acuan

- Repo D4: `KevArslanian/hrms-d4-sandbox`, cabang `feat/D4-perbaikan-total`. Minta akses ke Delta.
  - `modules/d4/kpi/catalog.ts`: KPI Scorecard V5.1, nama dan bobot.
  - `docs/d4/CHANGELOG-D4-V2.md`: syarat integrasi KPI D1.
- Folder `PISD-Week5-Context` (minta zip ke Delta):
  - `ringkasan/RENCANA-DATA-DAN-PERBAIKAN.md`: tabel S1–S8 dan keputusan K1–K10.
  - `ringkasan/detail/D1.md` dan `ringkasan/detail/D4.md`: permintaan klien beserta timestamp.
  - Transkrip dan notulen Show & Tell 14 Okt.
- Struktur organisasi resmi dari Mas Bram (01_ORG_MASTER), sebagai acuan posisi dan atasan.

## Query verifikasi (read-only; jalankan setelah selesai)

```sql
-- 1. Setiap posisi yang dipegang pegawai punya pasangan D1 Active dengan 5 KPI, bobot 100, target 85
select p.code, p.title, jp.job_code, jp.status_posisi,
       count(k.*) filter (where k.is_active) as kpis,
       coalesce(sum(k.kpi_weight) filter (where k.is_active), 0) as weight,
       bool_and(k.kpi_target = '85') filter (where k.is_active) as target_85
from d3_positions p
join b2_register r on r.position_id = p.id and coalesce(r.is_active, true)
left join d3_d1_position_mappings m on m.position_id = p.id and m.is_active
left join d1_job_positions jp on jp.id = m.d1_position_id
left join d1_kpi_definitions k on k.position_id = jp.id
group by p.code, p.title, jp.job_code, jp.status_posisi
order by p.code;
-- Harapan: setiap baris punya job_code, status Active, kpis = 5, weight = 100, target_85 = true.

-- 2. Posisi pegawai tanpa persyaratan kompetensi (harapan: kosong)
select distinct p.code, p.title from d3_positions p
join b2_register r on r.position_id = p.id and coalesce(r.is_active, true)
where not exists (select 1 from position_requirements pr where pr.position_id = p.id);

-- 3. Pegawai aktif tanpa data skill (harapan: kosong)
select r.employee_id, r.full_name from b2_register r
where coalesce(r.is_active, true) and r.full_name is not null
  and not exists (select 1 from d3_employee e join d3_employee_skills s on s.employee_id = e.id where lower(e.email) = lower(r.email));

-- 4. Pegawai aktif tanpa atasan (harapan: hanya direktur)
select r.employee_id, r.full_name from b2_register r
where coalesce(r.is_active, true) and r.full_name is not null
  and not exists (select 1 from d3_employee e join d3_employee_reporting rep on rep.subordinate_employee_id = e.id and rep.is_active where lower(e.email) = lower(r.email));
```

Hasil keempat query pada 9 Nov 2026, sebagai baseline:

| Query | Hasil sekarang | Target |
|---|---|---|
| 1. Posisi pegawai yang siap (pasangan D1 Active, 5 KPI, bobot 100) | 0 dari 14 | 14 dari 14 |
| 2. Posisi pegawai tanpa persyaratan kompetensi | 7 | 0 |
| 3. Pegawai aktif tanpa data skill | 24 | 0 |
| 4. Pegawai aktif tanpa atasan | 34 | Hanya direktur |

## Keluaran yang diminta

1. Log perubahan: tabel, id, nilai lama, nilai baru, tanggal.
2. Hasil keempat query verifikasi.
3. Daftar `[perlu keputusan PO]` yang masih terbuka: Sales Executive level berapa, Tax Associate 1 atau 2, Cash Associate, Billing, KPI ke-5 yang tidak ada di sumber, dan persetujuan Pak Gema.
