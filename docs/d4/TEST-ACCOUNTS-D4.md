| Field | Value |
| --- | --- |
| **Document ID** | TEST-ACCOUNTS-D4 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Daftar akun uji (demo dan QA) |
| **Version** | 1.0 |
| **Status** | Draft for Review |
| **Date** | 3 Okt 2026 |
| **Author** | Implementer D4 |
| **Derived From (Parents)** | TR-D4-001; API-D4-001; TEST-PLAN-D4 |
| **Related** | DEMO-SCRIPT-D4; CODE-FREEZE-D4; `scripts/smoke-d4.mjs` |

## 1. Tujuan

Dokumen ini menetapkan akun uji yang dipakai untuk Show & Tell minggu 5 dan untuk `npm run smoke:d4`. Setiap peran D4 punya satu akun, dan hak aksesnya diambil langsung dari kode API, bukan dari asumsi desain.

> **Password tidak pernah ditulis di repo.** Password setiap akun dibagikan PO secara privat (pesan langsung atau password manager tim) kepada presenter dan QA. Jangan menyalin password atau cookie sesi ke file mana pun, termasuk `.env.example`, dokumen ini, kartu Planka, atau halaman Docmost. Nilai lokal cukup disimpan di `.env.local`, yang tidak ikut di-commit.

## 2. Akun uji

Nama orang di kolom "Contoh tampilan" hanya placeholder. Nama yang tampil di aplikasi live berasal dari `d3_employee` yang ditautkan ke akun tersebut.

| # | Role | Tujuan | Nilai `d3_user_access.app_role` | Email | Contoh tampilan | Prasyarat data |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | HR | Presenter utama: membuat evaluasi, scorecard, assessment, development requirement, dan training | `HR` | `<diisi PO>` | Mercury (HR) | `employee_id` wajib terisi. Employee ini **bukan** target demo, karena penilaian diri sendiri ditolak. |
| 2 | MANAGER | Menunjukkan bahwa manager juga dapat mencatat penilaian | `MANAGER` | `<diisi PO>` | Bravo (Manager) | `employee_id` wajib terisi dan bukan target demo |
| 3 | EMPLOYEE | Menunjukkan tampilan self-service read-only | `EMPLOYEE` | `<diisi PO>` | Alfa (Employee) | `employee_id` wajib menunjuk employee yang **sudah punya** data D4 (evaluasi, scorecard, development, training). Tanpa itu, halaman terlihat kosong. |
| 4 | (tanpa akses) | Uji negatif, opsional, tidak dipakai saat demo | tidak ada baris | `<diisi PO>` | – | Akun Supabase Auth tanpa baris `d3_user_access` |

> **Wajib sebelum demo dan QA: akun HR dan MANAGER harus terhubung ke `employee_id` di `d3_user_access`.** Tanpa tautan ini, simpan akan ditolak **403**. Performance Evaluation dan KPI Scorecard ditolak oleh API sendiri. POST lain lolos `requireWriter()` (fungsi itu hanya memeriksa peran), tetapi insert di database tetap butuh `actor_employee_id = d3_current_employee_uuid()` dari policy RLS, sehingga diperkirakan juga ditolak 403 karena RLS. Bagian RLS ini belum diverifikasi terhadap database. Perilaku API-nya diuji di `tests/d4/api.test.ts` (blok "account without employee_id").

Catatan pemetaan:

- Peran dibaca dari `d3_user_access.app_role` berdasarkan `auth_user_id` (`modules/d4/server/_lib/session.ts:28-33`). Nilai yang dikenali D4 hanya `HR`, `MANAGER`, dan `EMPLOYEE`.
- `d3_user_access.employee_id` dipakai sebagai identitas aktor. Untuk HR dan MANAGER, nama evaluator diambil dari employee ini. Jika `employee_id` kosong atau tidak ditemukan, POST Performance Evaluation dan KPI Scorecard ditolak 403 dengan pesan "Akun belum terhubung dengan data employee." (`modules/d4/server/performance-evaluations/index.ts:30-31`, `modules/d4/server/kpi-assessments/index.ts:44-45`).
- Akun dibuat dan dipetakan oleh admin D3/PO. Squad D4 tidak menulis ke tabel `d3_user_access`.

## 3. Hak akses per halaman (UI)

Keenam menu tampil untuk semua peran (`modules/d4/web/ui/AppShell.tsx`). Tombol tulis hanya muncul jika `canWrite` bernilai benar, yaitu untuk HR atau MANAGER (`modules/d4/web/data/selectors.ts:12`).

| Halaman | HR | MANAGER | EMPLOYEE |
| --- | --- | --- | --- |
| Performance Evaluation `/performance` | Semua employee. Tombol Add Evaluation, revisi periode, View History | Sama dengan HR | Hanya baris miliknya. Tanpa tombol Add Evaluation |
| KPI Scorecard `/kpi` | Semua employee. Tombol Add Scorecard dan riwayat `/kpi/history/[employeeId]` | Sama dengan HR | Hanya scorecard miliknya. Tanpa Add Scorecard |
| Competency Gap `/competency` | Semua employee. Tombol Save Assessment, Assess Position Change, Create Development Requirement | Sama dengan HR | Hanya dirinya. Tanpa tombol simpan |
| Development Requirement `/development` | Semua. Tombol Add Requirement, Update Status, Create Training | Sama dengan HR | Hanya miliknya. Tanpa tombol aksi |
| Training Tracking `/training` | Semua. Tombol Add Training dan Update Progress | Sama dengan HR | Hanya miliknya. Tanpa Update Progress |
| People Dashboard `/dashboard` | Semua employee dan halaman profil | Sama dengan HR | Hanya baris dan profilnya sendiri |
| Detail milik employee lain | Bisa dibuka | Bisa dibuka | Tampil "tidak ditemukan", karena RLS menyaring datanya |

Penting untuk demo: **MANAGER tidak dibatasi ke timnya.** RLS memberi HR dan MANAGER akses baca dan insert ke semua baris D4 (`supabase/migrations/20260928052350_d4_performance_development.sql:150-224`, `supabase/migrations/20260929140000_d4_kpi_assessments_v31.sql:70-86`). EMPLOYEE hanya membaca baris dengan `employee_id` miliknya.

## 4. Hak akses per endpoint (API)

Sumber: `app/api/d4/**/route.ts` dan `modules/d4/server/**`. Format respons: sukses `{ data }`, gagal `{ error: { code, message } }`.

| # | Method | Path | HR | MANAGER | EMPLOYEE | Tanpa akses | Tanpa sesi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GET | `/api/d4/me` | 200 | 200 | 200 | 403 | 401 |
| 2 | GET | `/api/d4/snapshot` | 200 (semua) | 200 (semua) | 200 (milik sendiri) | 403 | 401 |
| 3 | GET | `/api/d4/kpi-catalog` | 200 | 200 | 200 | 200* | 401 |
| 4 | GET | `/api/d4/performance-evaluations` | 200 | 200 | 200 (milik sendiri) | 403 | 401 |
| 5 | POST | `/api/d4/performance-evaluations` | 201 / 422 | 201 / 422 | 403 | 403 | 401 |
| 6 | GET | `/api/d4/performance-evaluations/[id]` | 200 / 404 | 200 / 404 | 200 milik sendiri, selain itu 404 | 403 | 401 |
| 7 | GET | `/api/d4/kpi-assessments` | 200 | 200 | 200 (milik sendiri) | 403 | 401 |
| 8 | POST | `/api/d4/kpi-assessments` | 201 / 422 | 201 / 422 | 403 | 403 | 401 |
| 9 | GET | `/api/d4/kpi-assessments/[id]` | 200 / 404 | 200 / 404 | 200 milik sendiri, selain itu 404 | 403 | 401 |
| 10 | GET | `/api/d4/competency-assessments` | 200 | 200 | 200 (milik sendiri) | 403 | 401 |
| 11 | POST | `/api/d4/competency-assessments` | 201 / 422 | 201 / 422 | 403 | 403 | 401 |
| 12 | GET | `/api/d4/development-needs` | 200 | 200 | 200 (milik sendiri) | 403 | 401 |
| 13 | POST | `/api/d4/development-needs` | 201 / 422 | 201 / 422 | 403 | 403 | 401 |
| 14 | GET | `/api/d4/development-needs/[id]` | 200 / 404 | 200 / 404 | 200 milik sendiri, selain itu 404 | 403 | 401 |
| 15 | POST | `/api/d4/development-needs/[id]/versions` | 201 / 404 / 422 | 201 / 404 / 422 | 403 | 403 | 401 |
| 16 | GET | `/api/d4/training-records` | 200 | 200 | 200 (milik sendiri) | 403 | 401 |
| 17 | POST | `/api/d4/training-records` | 201 / 422 | 201 / 422 | 403 | 403 | 401 |
| 18 | GET | `/api/d4/training-records/[id]` | 200 / 404 | 200 / 404 | 200 milik sendiri, selain itu 404 | 403 | 401 |
| 19 | POST | `/api/d4/training-records/[id]/versions` | 201 / 404 / 422 | 201 / 404 / 422 | 403 | 403 | 401 |

Keterangan:

- Ada 14 file route dan 19 endpoint (12 GET, 7 POST). `competency-assessments` tidak punya endpoint detail `[id]`.
- Setiap POST memanggil `requireWriter()` sebelum membaca body (`modules/d4/server/_lib/session.ts:36-41`). Akibatnya EMPLOYEE selalu menerima 403, apa pun isi body-nya, dan tidak ada data yang tertulis.
- 422 muncul untuk body yang tidak valid, penilaian diri sendiri, periode yang sudah ada tanpa `revisionOf`, KPI yang tidak sesuai posisi, atau sumber development yang tidak valid. 400 muncul untuk body yang bukan JSON. 404 muncul untuk id yang tidak dikenal di endpoint `versions`.
- \* `GET /api/d4/kpi-catalog` hanya memeriksa sesi dan tidak memeriksa `d3_user_access` (`modules/d4/server/kpi-catalog/index.ts:6`). Akun yang belum dipetakan tetap mendapat katalog, selama RLS tabel katalog mengizinkan. Ini belum diverifikasi terhadap database.
- Tanpa sesi, halaman diarahkan ke `/login` oleh `proxy.ts`. Route API tidak dialihkan dan mengembalikan 401 JSON sendiri.

## 5. Login dan verifikasi akun

| Langkah | Hasil yang diharapkan |
| --- | --- |
| Buka `/login`, masuk dengan akun HR | Diarahkan ke `/dashboard`. Topbar menampilkan nama employee akun dan label peran |
| Ulangi untuk akun MANAGER dan EMPLOYEE, masing-masing di profil browser terpisah | Tiap profil menyimpan sesi sendiri, sehingga tidak perlu logout saat berganti peran di demo |
| Masuk dengan akun tanpa akses (opsional) | Login ditolak dengan pesan "Akun ini belum dipetakan ke akses HRMS" (`app/login/page.tsx`) |
| `npm run smoke:d4` dengan cookie ketiga akun di `.env.local` | Semua GET PASS (200). Baris ANON PASS (401) |
| `npm run smoke:d4 -- --probe` | POST EMPLOYEE 403 dan POST HR/MANAGER 422, tanpa data yang tertulis |

Cara mengambil cookie untuk smoke test: login di browser, buka DevTools → Network, pilih request `/api/d4/...`, lalu salin nilai header `Cookie` (berisi `sb-<ref>-auth-token`, kadang terpecah `.0`/`.1`) ke `D4_SMOKE_COOKIE_<ROLE>` di `.env.local`. API **tidak** menerima `Authorization: Bearer`, karena sesi dibaca dari cookie (`modules/d4/server/_lib/session.ts:14-23`). Cookie adalah token sesi aktif, jadi jangan dibagikan atau di-commit.

## 6. Fallback tanpa akun (fixture)

Jika akun live bermasalah, aplikasi bisa dijalankan dengan data fiktif tanpa login. Mode ini hanya berlaku pada `next dev`.

```bash
NEXT_PUBLIC_D4_DATA_MODE=fixture NEXT_PUBLIC_D4_FIXTURE_ROLE=HR npm run dev        # aktor: Mercury (HR)
NEXT_PUBLIC_D4_DATA_MODE=fixture NEXT_PUBLIC_D4_FIXTURE_ROLE=MANAGER npm run dev   # aktor: Mercury, label Manager
NEXT_PUBLIC_D4_DATA_MODE=fixture NEXT_PUBLIC_D4_FIXTURE_ROLE=EMPLOYEE npm run dev  # tampilan Alfa, read-only
```

Topbar menampilkan badge "Preview · data fiktif". Data yang ditulis hanya tersimpan di memori dan hilang saat reload. Mode fixture tidak melewati API `/api/d4/*`, sehingga tidak bisa dipakai untuk membuktikan 403 dari server.
