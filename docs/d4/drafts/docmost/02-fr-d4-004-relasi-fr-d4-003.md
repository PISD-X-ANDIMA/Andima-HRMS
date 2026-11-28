# Draft · Relasi FR-D4-004 dengan FR-D4-003 (kritik K8)

**Target 1:** halaman FR-D4-004 Development Requirement, tambahkan section "Relasi dengan FR-D4-003" setelah Deskripsi.
**Target 2:** deskripsi kartu Planka "Implementasi Competency Gap & Development Requirement" (paragraf yang sama, versi singkat di bawah).

---

## Relasi dengan FR-D4-003

FR-D4-004 tetap requirement yang **terpisah** dari FR-D4-003. Keduanya dikerjakan dalam satu tiket implementasi karena alasan berikut:

1. **Alur datanya berurutan.** Competency Gap (FR-D4-003) menghasilkan requirement berstatus *Gap*. Status itu menjadi salah satu *source* untuk membuat Development Requirement (FR-D4-004). Tanpa FR-D4-003, aksi "Create Development Requirement" tidak punya sumber yang bisa dirujuk.
2. **Validasi sumber memakai data yang sama.** Server menolak Development Requirement bila source reference tidak ada, bukan milik employee yang sama, atau (untuk sumber competency gap) status requirement-nya bukan *Gap*. Validasi ini membaca tabel assessment kompetensi.
3. **Satu kali uji end-to-end.** QA menguji alur *Gap → Create Development Requirement → Detail menampilkan Source* dalam satu skenario. Memecahnya ke dua tiket membuat skenario itu tidak bisa diuji sampai kedua tiket selesai.

Yang **tidak** digabung: halaman, tabel data, status, dan acceptance criteria tetap milik masing-masing FR. Development Requirement juga dapat bersumber dari **Role Change** dan **Performance Context** (FR-D4-001), jadi FR-D4-004 bukan turunan eksklusif FR-D4-003.

### Traceability

| Dari | Ke | Wujud di aplikasi |
|---|---|---|
| FR-D4-003 requirement berstatus Gap | FR-D4-004 | Menu ⋮ "Create Development Requirement" (source type `competency_gap`) |
| FR-D4-003 assessment role change | FR-D4-004 | Source type `role_change` |
| FR-D4-001 evaluasi Completed | FR-D4-004 | Source type `performance_context` |
| FR-D4-004 | FR-D4-005 | Menu ⋮ "Create Training", training menyimpan `development_need_id` |
| Semua di atas | FR-D4-007 | Source chip yang dapat diklik + blok Source di Detail Page |

---

## Versi singkat untuk deskripsi kartu Planka

> **Kenapa FR-D4-004 ada di tiket ini?** Development Requirement paling sering dibuat dari Competency Gap (FR-D4-003), dan server memvalidasi source-nya dengan data gap yang sama. Karena itu keduanya diimplementasikan dan diuji QA dalam satu alur: Gap → Create Development Requirement → Detail menampilkan Source. FR-nya tetap terpisah: FR-D4-004 juga menerima source Role Change dan Performance Context.
