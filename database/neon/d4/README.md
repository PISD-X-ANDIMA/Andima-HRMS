# Skrip Neon D4

Skrip ini memindahkan tabel dan data D4 (Performance & Training) dari Supabase ke Neon. Isinya diambil read-only dari Supabase live pada 28 November 2026, dengan pola yang sama dengan skrip D3 di branch `D3-003-neon-migrated-ready`. Aplikasi D4 masih berjalan di Supabase sampai kelas memutuskan pengganti Supabase Auth.

## Urutan menjalankan

| Urutan | File | Syarat sebelum jalan |
| --- | --- | --- |
| 1 | Skrip D3 `01_tabel.sql` dan data D3 | `b2_register` milik MID sudah ada di Neon |
| 2 | `01_tabel.sql` | Tabel `d3_*` sudah ada |
| 3 | `02_data.sql` (dibuat dengan `02_ekspor_data.sh`, tidak di-commit) | 01 D4 |
| 4 | Skrip D3 `03_relasi_index.sql`, lalu `03_relasi_index.sql` D4 | Data D3 dan D4 sudah dimuat |
| 5 | `04_fungsi_trigger.sql` | 03 D4 |
| 6 | `05_kpi_dari_d1.sql` | Tabel D1 `d1_job_positions` dan `d1_kpi_definitions` sudah ada di Neon |
| 7 | `06_relasi_ke_b2_register.sql` | Persetujuan MID |
| 8 | `90_ditunda_auth.sql` | Keputusan pengganti Supabase Auth, lalu file ini disesuaikan |

Setiap file berjalan dalam satu transaksi. Kalau satu perintah gagal, seluruh file dibatalkan dan database tidak berubah. Contoh menjalankan satu file:

```bash
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/neon/d4/01_tabel.sql
```

## Data (02)

`02_ekspor_data.sh` membaca 12 tabel dari Supabase dengan `pg_dump --data-only --inserts`. Hasilnya `02_data.sql`, sekitar 856 baris per 28 November 2026. File ini tidak di-commit karena berisi data pegawai.

Skrip ini membutuhkan `pg_dump` versi 17, karena Supabase memakai Postgres 17. Connection string diketik saat diminta dan tidak disimpan. Kalau Neon memakai Postgres 16, hapus baris `SET transaction_timeout = 0;` di awal `02_data.sql` sebelum dijalankan.

## Yang tidak ikut

- Skema `d4_backup` (salinan cadangan sebelum migrasi Oktober dan November) dan tabel `d4_figma_demo_*` (kosong, hanya untuk demo Figma).
- Lima migrasi D4 yang belum diterapkan di Supabase live. Skrip ini menyalin keadaan live, sehingga migrasi tersebut tetap perlu diterapkan terpisah setelah PO menyetujuinya.

## Yang perlu dicek sebelum dijalankan

- `employee_id` dan `actor_employee_id` di semua tabel D4 berisi `b2_register.id`, yang di Supabase sama dengan id akun login. Data D4 hanya tetap terhubung kalau id `b2_register` di Neon sama dengan di Supabase. Catatan D3 menyebut 39 dari 39 id sama pada 27 November.
- `position_requirements` tidak berprefiks, tetapi di repo Andima hanya D4 yang memakainya. Kalau tabel itu sudah dibuat squad lain di Neon, hapus bloknya dari `01_tabel.sql` dan baris tabelnya dari `02_ekspor_data.sh`.
- Di Supabase live, RLS untuk `d4_development_needs`, `d4_development_need_versions`, dan `d4_training_records` dalam keadaan mati. `90_ditunda_auth.sql` menyalakannya kembali sesuai rancangan migrasi D4.
