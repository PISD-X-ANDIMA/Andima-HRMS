# Dokumentasi Backend — ANDIMA HRMS Squad D3

**Diperbarui:** 29 September 2026
**Status:** dokumentasi teknis untuk demo/penilaian Week 4; bukan kontrak API publik.

## 1. Arsitektur saat ini

```text
Next.js UI
  │
  ├─ Supabase Auth       → autentikasi, session, logout
  ├─ Supabase Data API   → tabel PostgreSQL dengan RLS
  └─ Supabase Storage    → lampiran tiket privat
```

Saat ini tidak ada REST endpoint atau route handler kustom di folder `app/api`. Komponen Next.js berkomunikasi langsung dengan Supabase melalui:

- `utils/supabase/client.ts` untuk browser client.
- `utils/supabase/server.ts` untuk server client berbasis cookie.

Kedua client membutuhkan variabel lokal berikut di `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Nilai asli tidak boleh dicatat dalam dokumentasi, dikirim ke chat, atau di-commit. File `.env.local` harus tetap diabaikan Git.

## 2. Autentikasi dan otorisasi

### Alur identitas

```text
auth.users.id
    │ auth_user_id
    ▼
d3_user_access ── employee_id ──► d3_employee ──► d3_departments / d3_positions
    │
    └─ app_role: Employee | HR | Manager
```

1. User melakukan login atau register melalui Supabase Auth.
2. Aplikasi memperoleh user aktif dengan `supabase.auth.getUser()`.
3. `d3_user_access` memetakan user Auth ke `d3_employee` dan `app_role`.
4. Header, sidebar, dan aksi fitur menggunakan pemetaan tersebut.
5. RLS di database membatasi akses data berdasarkan identitas dan peran yang dipetakan.

Pendaftaran Auth **tidak otomatis** menjadikan akun sebagai Employee, HR, atau Manager. Admin data/HR perlu membuat atau melengkapi pemetaan `d3_user_access` untuk akun tersebut.

## 3. Peta data D3

### Master dan kehadiran

| Domain | Tabel utama | Pemakaian saat ini |
| --- | --- | --- |
| Karyawan | `d3_employee` | Identitas, nama, dan relasi pemilik data. |
| Departemen | `d3_departments` | Informasi departemen karyawan. |
| Posisi | `d3_positions` | Referensi posisi. |
| Kehadiran | `d3_attendances` | Riwayat masuk/pulang dan perhitungan produktivitas. |
| Koreksi kehadiran | `d3_attendance_corrections` | Permohonan/perubahan koreksi attendance. |
| Feedback | `d3_employee_feedback` | Tabel terdeteksi, UI belum diintegrasikan. |
| Reward | `d3_employee_rewards` | Tabel terdeteksi, UI belum diintegrasikan. |

### Ticket D3-005

```text
d3_employee ──► d3_tickets ──┬──► d3_ticket_followups
                              ├──► d3_ticket_history
                              └──► d3_ticket_attachments

d3_user_access ──► d3_employee
```

| Tabel | Tanggung jawab |
| --- | --- |
| `d3_user_access` | Pemetaan user Auth, employee, dan role aplikasi. |
| `d3_tickets` | Data tiket, pelapor, status, prioritas, dan snapshot identitas pelapor. |
| `d3_ticket_followups` | Catatan tindak lanjut oleh actor. |
| `d3_ticket_history` | Audit trail perubahan tiket/follow-up. |
| `d3_ticket_attachments` | Metadata lampiran yang berada di Storage. |

Relasi aktif yang perlu diperhatikan: `d3_tickets.employee_id`, `d3_ticket_followups.actor_employee_id`, `d3_ticket_history.actor_employee_id`, dan `d3_user_access.employee_id` mengarah ke `d3_employee.id`.

## 4. Operasi data per fitur

| Fitur/route | Operasi aplikasi | Sumber data | Status integrasi |
| --- | --- | --- | --- |
| `/employee-report-ticket` | baca/buat tiket, ubah status, tambah follow-up, baca history, unggah/buka lampiran | `d3_tickets`, `d3_ticket_followups`, `d3_ticket_history`, `d3_ticket_attachments`, bucket Storage | Terhubung |
| `/attendance-productivity` | baca attendance dan relasi employee/departemen | `d3_attendances`, `d3_employee`, `d3_departments` | Terhubung baca data |
| `/employee-profile` | baca ringkasan kehadiran/produktivitas | `d3_attendances`, `d3_employee`, `d3_departments` | Terhubung baca data; belum CRUD profil |
| `/attendance` | baca attendance dan mengubah status koreksi | `d3_attendances`, `d3_attendance_corrections` | Perlu penyelarasan nama tabel/kolom lama dan uji ulang |
| `/fingerprint-integration` | belum ada operasi | — | Placeholder |
| `/feedback-reward` | belum ada operasi | — | Placeholder |

## 5. D3-005: alur request tanpa API kustom

| Aksi UI | Panggilan Supabase | Otorisasi yang diharapkan |
| --- | --- | --- |
| Buat tiket | `insert` ke `d3_tickets` | Employee hanya membuat tiket atas dirinya sendiri. |
| Lihat tiket | `select` dari `d3_tickets` | Employee melihat tiket miliknya; HR/Manager melihat tiket dalam cakupan RLS. |
| Ubah status | `update` ke `d3_tickets` | HR/Manager sesuai policy. |
| Tambah follow-up | `insert` ke `d3_ticket_followups` | Actor harus dipetakan pada `d3_user_access`. |
| Baca riwayat | `select` dari `d3_ticket_history` | Akses mengikuti policy tiket. |
| Unggah lampiran | `storage.from('d3-ticket-attachments').upload(...)`, lalu `insert` metadata | User terautentikasi dan diizinkan oleh storage/RLS policy. |
| Buka lampiran | `createSignedUrl(..., 60)` | Bucket privat; signed URL berlaku 60 detik. |

Migration D3-005 mendefinisikan trigger untuk melindungi perubahan tiket tertentu dan menulis audit history. Karena ini basis data bersama, perubahan migration atau policy harus direview tim database terlebih dahulu.

## 6. RLS dan keamanan data

Prinsip desain D3-005:

- Employee hanya membuat/melihat data tiket yang diizinkan untuk dirinya.
- HR dan Manager menjalankan update status serta follow-up berdasarkan peran.
- Audit history tidak dibuat manual oleh UI; trigger database mencatat perubahan.
- Lampiran berada pada bucket privat, bukan URL publik permanen.
- Akses UI tidak cukup sebagai keamanan; policy RLS wajib menjadi lapisan pembatas data.

File migration terkait:

- `supabase/migrations/20260927153229_d3_ticket_access.sql`
- `supabase/migrations/20260927175301_d3_ticket_reporter_snapshot.sql`
- `supabase/migrations/20260927175531_d3_ticket_policy_performance.sql`

## 7. Catatan penyelarasan skema

Skema master D3 yang digunakan client saat ini memakai nama singular `d3_employee` dan `d3_departments`. Sebagian migration ticket lama masih menyebut `public.employees` dan `public.departments`.

Implikasinya:

1. Jangan menjalankan ulang migration lama langsung pada database bersama.
2. Bandingkan foreign key dan nama kolom dengan skema live sebelum membuat migration perbaikan.
3. Uji query dengan akun Employee dan akun HR/Manager setelah perubahan policy atau schema.
4. Catat hasilnya di test case QA sebelum menyatakan integrasi selesai.

## 8. Cara uji end-to-end

Gunakan dua akun yang telah dipetakan: satu Employee dan satu HR/Manager.

1. Login sebagai Employee dan buat satu tiket dengan data valid.
2. Pastikan tiket muncul kembali setelah refresh.
3. Login sebagai HR/Manager, buka tiket yang sama, ubah status, lalu buat follow-up.
4. Login kembali sebagai Employee dan pastikan status, follow-up, serta history tampil sesuai policy.
5. Bila menguji lampiran, unggah satu berkas aman, buka menggunakan signed URL, lalu periksa metadata lampiran.
6. Catat hasil aktual, request gagal, dan bug pada test case QA.

## 9. Verifikasi teknis dan batasan

- `npm run build` berhasil pada snapshot integrasi ini.
- Request Supabase D3-005 dapat muncul pada Network sebagai fetch ke tabel (`d3_tickets`, `d3_ticket_followups`, dan seterusnya); ini normal karena aplikasi memakai Data API langsung.
- Belum ada deployment staging, release production, atau API server kustom untuk fitur D3.
- Halaman Attendance History & Correction dan placeholder perlu diselesaikan sebelum deklarasi seluruh fitur D3 siap rilis.
