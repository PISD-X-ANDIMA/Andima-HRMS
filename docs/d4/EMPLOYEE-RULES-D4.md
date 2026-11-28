| Field | Value |
| --- | --- |
| **Document ID** | RULES-D4-EMP-001 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | User Story & Ketetapan Sistem (peran Employee) |
| **Version** | 1.1 |
| **Status** | Berlaku di production |
| **Date** | 13 Okt 2026 |
| **Author** | Delta Oga Nophen Putra |
| **Berlaku untuk** | https://hrms-d4-sandbox.vercel.app (commit `0fba567`, PR #15) |
| **Related** | RN-D4-001; API-D4-001; UI-D4-001; migrasi `20261013120000_d4_identity_from_b2.sql`, `20261013130000_b2_register_email_sync.sql` |

Dokumen ini menetapkan apa yang boleh dan tidak boleh dilakukan akun berperan **Employee** di D4, sesuai perilaku web Vercel saat ini. Kata **wajib** berarti sistem menegakkannya; pelanggaran ditolak, bukan hanya disembunyikan.

## 1. Siapa yang disebut Employee

| ID | Ketetapan |
| --- | --- |
| SR-D4-EMP-01 | Sumber data karyawan dan login adalah **B2** (`b2_register`). Data karyawan D3 (`d3_employee`, `d3_user_access`) tidak dipakai lagi oleh D4. |
| SR-D4-EMP-02 | Sebuah akun dikenali D4 hanya bila: ada baris `b2_register` dengan `id` = id akun Supabase Auth, `is_active` tidak `false`, dan `full_name` terisi. Selain itu akun dapat login tetapi D4 menampilkan "akun ini belum punya akses ke data HRMS". |
| SR-D4-EMP-03 | Peran ditentukan otomatis dari jabatan B2 (`position_id` → `d3_positions.code`): `POS-HR` → **HR**; `DIR-*` atau `*-MGR` → **Manager**; jabatan lain → **Employee**. Peran tidak dapat dipilih sendiri dan tidak dapat diubah dari request. |
| SR-D4-EMP-04 | Perubahan jabatan atau status aktif di B2 berlaku pada request berikutnya; tidak ada salinan peran di D4. |
| SR-D4-EMP-05 | Login memakai email dan password Supabase Auth. Perubahan email dan password di `b2_register` disinkronkan ke Auth oleh trigger `trigger_sync_email` dan `trigger_sync_password`. |
| SR-D4-EMP-06 | Data yang hanya ada di D3 (skill karyawan, standar kompetensi jabatan, `employee_kpi`) tidak disalin ke B2 dan tampil kosong untuk akun B2. |

## 2. User story Employee

| ID | User story | Kriteria penerimaan (sesuai web) |
| --- | --- | --- |
| US-D4-EMP-01 | Sebagai Employee, saya ingin login dengan akun B2 saya agar dapat membuka D4. | Login di `/login` dengan email terdaftar di B2 (format `nama@domain`) dan password ≥ 10 karakter berisi huruf, angka, dan simbol. Berhasil → `/dashboard`. Gagal → "Email atau password salah." dengan sisa percobaan. |
| US-D4-EMP-02 | Sebagai Employee, saya ingin melihat ringkasan kinerja saya sendiri di People Dashboard. | `/dashboard` hanya memuat satu employee: diri sendiri. Filter jabatan dan departemen tidak tampil. Badge peran di topbar: "Employee". |
| US-D4-EMP-03 | Sebagai Employee, saya ingin melihat hasil evaluasi kinerja saya dan riwayatnya. | `/performance` dan `/performance/history/[employeeId]` hanya berisi evaluasi milik saya. Tombol buat/ubah evaluasi tidak tampil. |
| US-D4-EMP-04 | Sebagai Employee, saya ingin melihat KPI scorecard saya. | `/kpi` dan riwayatnya hanya berisi scorecard milik saya; skor dan bobot read-only. |
| US-D4-EMP-05 | Sebagai Employee, saya ingin mengetahui status kompetensi saya terhadap jabatan saya. | `/competency` hanya menampilkan saya. Status tampil "Not Evaluated" sampai HR/Manager menyimpan penilaian; persyaratan tanpa skill atau bukti tampil "Insufficient Data" (lihat SR-D4-EMP-06). |
| US-D4-EMP-06 | Sebagai Employee, saya ingin melihat kebutuhan development yang ditetapkan untuk saya. | `/development` hanya berisi kebutuhan milik saya beserta revisi statusnya. Tombol buat/ubah tidak tampil. |
| US-D4-EMP-07 | Sebagai Employee, saya ingin memantau training yang saya ikuti. | `/training` hanya berisi training milik saya. Tombol "Update Progress" tidak tampil. |
| US-D4-EMP-08 | Sebagai Employee, saya ingin keluar dari aplikasi. | Tombol Logout di sidebar mengakhiri sesi dan kembali ke `/login`. |

## 3. Ketetapan sistem untuk Employee

### 3.1 Hak baca

| ID | Ketetapan | Ditegakkan di |
| --- | --- | --- |
| SR-D4-EMP-10 | Employee **wajib** hanya dapat membaca data D4 miliknya sendiri: evaluasi kinerja, KPI scorecard, assessment kompetensi, kebutuhan development (+ revisi), dan training (+ revisi). | RLS tabel `d4_*` (`employee_id = d4_current_employee_uuid()`) |
| SR-D4-EMP-11 | Daftar karyawan untuk Employee hanya berisi dirinya sendiri. Nama, email, dan password karyawan lain tidak dikirim ke browser. | View `d4_employee`; `visibleEmployees()` di `modules/d4/web/data/selectors.ts` |
| SR-D4-EMP-12 | Membuka URL detail atau riwayat milik karyawan lain (mis. `/dashboard/employee/[id]`) menampilkan halaman "Employee not found" dengan tombol kembali, karena data tersebut tidak pernah dikirim. | RLS + view |
| SR-D4-EMP-13 | Data referensi umum (departemen, jabatan, katalog KPI) boleh dibaca. | Policy baca `d3_departments`, `d3_positions`, `d4_kpi_role_catalog` |

### 3.2 Hak tulis

| ID | Ketetapan | Ditegakkan di |
| --- | --- | --- |
| SR-D4-EMP-20 | Employee **tidak boleh** membuat atau mengubah data D4 apa pun. Semua `POST` ke `/api/d4/*` dari Employee dijawab `403 FORBIDDEN` dengan pesan "Hanya HR atau manager yang dapat mengubah data ini." | `requireWriter()` di `modules/d4/server/_lib/session.ts` |
| SR-D4-EMP-21 | Insert langsung ke database (melewati API) juga ditolak. | RLS insert `d4_*`: peran wajib HR atau MANAGER |
| SR-D4-EMP-22 | Tombol buat, ubah, dan "Update Progress" disembunyikan untuk Employee. | `canWrite()` di `selectors.ts` |
| SR-D4-EMP-23 | Tidak ada yang dapat menilai dirinya sendiri: HR/Manager tidak dapat membuat evaluasi atau scorecard untuk akunnya sendiri, dan Employee tidak dapat menilai siapa pun. | `canAssess()` di `selectors.ts`; validasi API |
| SR-D4-EMP-24 | Setiap record yang dibuat untuk Employee mencatat pelaku (`actor_employee_id`, `actor_auth_user_id`) dari akun yang login, bukan dari isi request. | Default kolom + RLS `with check` |

### 3.3 Tampilan

| ID | Ketetapan |
| --- | --- |
| SR-D4-EMP-30 | Sidebar tetap menampilkan lima menu D4 (Performance & KPI, Competency Gap, Development Requirement, Training Tracking, People Dashboard) dengan isi terbatas pada data sendiri. Sejak 15 Nov 2026 sidebar hanya berisi grup HRMS; POS, CRM, dan MID tidak ditampilkan. |
| SR-D4-EMP-31 | Filter "All positions" dan "All departments" tidak tampil untuk Employee. |
| SR-D4-EMP-32 | Bila belum ada data, halaman menampilkan empty state, bukan error. |
| SR-D4-EMP-33 | Akun yang lolos login tetapi tidak memenuhi SR-D4-EMP-02 melihat "Data D4 gagal dimuat – akun ini belum punya akses ke data HRMS". |

### 3.4 Error yang dapat dilihat Employee

| Kode | Kapan | Pesan |
| --- | --- | --- |
| `UNAUTHENTICATED` (401) | Sesi habis atau belum login | "Sesi login tidak ditemukan. Silakan login kembali." |
| `FORBIDDEN` (403) | Akun tidak terdaftar aktif di B2 | "Anda sudah login, tetapi akun ini belum punya akses ke data HRMS…" |
| `FORBIDDEN` (403) | Employee mencoba menyimpan data | "Hanya HR atau manager yang dapat mengubah data ini." |

## 4. Batasan yang diketahui

| No | Batasan | Pemilik perbaikan |
| --- | --- | --- |
| 1 | Peran mengikuti jabatan yang dipilih saat register. Jabatan yang salah pilih (mis. anak IT memilih Director FAT) memberi peran Manager. | B2: validasi jabatan saat register |
| 2 | Standar kompetensi, skill, dan KPI lama berada di D3 dan tidak terbaca akun B2, sehingga Competency Gap menampilkan "Insufficient Data". | D3 / PO: data per jabatan |
| 3 | `b2_register` menyimpan password teks biasa dan dapat dibaca anon. D4 tidak membaca kolom itu, tetapi risikonya tetap ada. | B2: hapus kolom `password` dan policy "Allow anon select" |
| 4 | Data D4 sebelum 13 Okt 2026 terikat ke karyawan D3 dan dipindahkan ke schema `d4_backup`. | — |

## 5. Bukti uji langsung (UAT Employee)

| Field | Value |
| --- | --- |
| **Tanggal** | 13 Okt 2026 |
| **Lingkungan** | Production, https://hrms-d4-sandbox.vercel.app (commit `6a7212e`) |
| **Akun uji** | Tristo, `IT-DEV-009`, jabatan Tim IT, departemen Information Technology (peran turunan: Employee) |
| **Cara uji** | Login lewat `/login`, buka tiap halaman D4, panggil API dari sesi browser yang sama |

### 5.1 API

| Uji | Hasil | Rule |
| --- | --- | --- |
| `GET /api/d4/me` | 200, `role: EMPLOYEE`, employee `IT-DEV-009` Tristo | SR-D4-EMP-02, SR-D4-EMP-03 |
| `GET /api/d4/snapshot` | `employees` hanya berisi Tristo; departemen 9, jabatan 29; competencies/requirements/skills 0; semua record D4 0 | SR-D4-EMP-06, SR-D4-EMP-10, SR-D4-EMP-11, SR-D4-EMP-13 |
| `POST /api/d4/performance-evaluations` | 403 `FORBIDDEN` "Hanya HR atau manager yang dapat mengubah data ini." | SR-D4-EMP-20 |
| `POST /api/d4/kpi-assessments` | 403 `FORBIDDEN`, pesan sama | SR-D4-EMP-20 |
| `POST /api/d4/competency-assessments` | 403 `FORBIDDEN`, pesan sama | SR-D4-EMP-20 |
| `POST /api/d4/development-needs` | 403 `FORBIDDEN`, pesan sama | SR-D4-EMP-20 |
| `POST /api/d4/training-records` | 403 `FORBIDDEN`, pesan sama | SR-D4-EMP-20 |

### 5.2 Halaman

| Halaman | Hasil | Rule / Story | Status |
| --- | --- | --- | --- |
| `/dashboard` | Satu baris: Tristo, Evaluation "Not Evaluated". Filter hanya pencarian dan Period; tidak ada filter jabatan/departemen. | US-D4-EMP-02, SR-D4-EMP-31 | Lulus |
| `/performance` | Satu baris: Tristo, KPI Score dan Evaluation "Not Evaluated". Tidak ada tombol buat/ubah. | US-D4-EMP-03, SR-D4-EMP-22 | Lulus |
| `/kpi` | Diarahkan ke `/performance` (KPI Scorecard digabung di halaman Performance & KPI). | US-D4-EMP-04 | Lulus |
| `/competency` | Satu baris: Tristo, Requirement "—", status "Not Evaluated". Menu aksi hanya View Detail dan View History. | US-D4-EMP-05, SR-D4-EMP-22 | Lulus |
| `/development` | Empty state "Belum ada development requirement". Tidak ada tombol buat. | US-D4-EMP-06, SR-D4-EMP-32 | Lulus |
| `/training` | Empty state "Tidak ada training yang cocok". Tidak ada "Update Progress". | US-D4-EMP-07, SR-D4-EMP-32 | Lulus |
| `/dashboard/employee/<id AND-0002>` | "Employee not found" dengan tombol "Back to People Dashboard". | SR-D4-EMP-12 | Lulus |
| Topbar | Menu pengguna menampilkan "Tristo" dan "Employee". | US-D4-EMP-02 | Lulus |
| Sidebar | POS, CRM, HRMS (Performance & KPI, Competency Gap, Development Requirement, Training Tracking, People Dashboard), MID, Logout. | SR-D4-EMP-30, US-D4-EMP-08 | Lulus |

### 5.3 Catatan

- Logout (US-D4-EMP-08) tidak dijalankan agar sesi uji tetap aktif; tombol tampil di sidebar.
- SR-D4-EMP-21 (insert langsung ke database) dibuktikan oleh policy RLS di migrasi `20261013120000_d4_identity_from_b2.sql`, bukan oleh uji UI.
- Status "Not Evaluated" dan Requirement "—" sesuai Batasan no. 2: standar kompetensi jabatan belum ada untuk akun B2.
