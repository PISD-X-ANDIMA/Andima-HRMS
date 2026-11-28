# Draft · Deskripsi dan komentar kartu

## 1. Kartu "Implementasi Competency Gap & Development Requirement"

**Tambahkan di awal deskripsi** (kritik K8):

> **Kenapa FR-D4-004 ada di tiket ini?** Development Requirement paling sering dibuat dari Competency Gap (FR-D4-003), dan server memvalidasi source-nya dengan data gap yang sama. Karena itu keduanya diimplementasikan dan diuji QA dalam satu alur: Gap → Create Development Requirement → Detail menampilkan Source. FR-nya tetap terpisah: FR-D4-004 juga menerima source Role Change dan Performance Context. Detail: Docmost FR-D4-004, section "Relasi dengan FR-D4-003".

## 2. Komentar di setiap kartu WebDev

Satu komentar per kartu setelah branch V2 digabung:

> **D4 V2 (29 Sep 2026).** Halaman memakai pola UI-D4-001: Detail dan History sebagai halaman tersendiri, menu ⋮ langsung berisi aksi, form modal 640 px (KPI 880 px). Data lewat `/api/d4/*` (API-D4-001), bukan Supabase langsung dari UI.
> Route: `<isi route fitur>` · Bukti: screenshot halaman terlampir di kartu · Checklist disinkronkan sesuai `docs/d4/drafts/planka/02-sinkron-checklist.md`.

Route per kartu:

| Kartu | Route |
|---|---|
| Performance Evaluation | `/performance`, `/performance/[id]`, `/performance/history/[employeeId]` |
| KPI Scorecard | `/kpi`, `/kpi/[id]`, `/kpi/history/[employeeId]` |
| Competency Gap & Development | `/competency`, `/competency/[employeeId]`, `/competency/[employeeId]/history`, `/development`, `/development/[id]`, `/development/[id]/history` |
| Training Tracking | `/training`, `/training/[id]`, `/training/[id]/history` |
| People Dashboard | `/dashboard`, `/dashboard/employee/[id]` |

## 3. Komentar di kartu UI/UX

> **Figma D4 V2:** https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F (page `D4`). Foundations dan komponen sudah dibuat sebagai variable, text style, dan component set. Frame layar mengikuti format D3 `NN HRMS D4 - <Layar> (<Role>)`, 1440×1024. Frame pertama untuk kartu ini: lihat kolom *Node* di tabel berikut.

Frame per kartu:

| Kartu | Frame | Node |
|---|---|---|
| Design Performance Evaluation & KPI Scorecard | 01–12 | [19:4133](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-4133) |
| Design Competency Gap & Development Requirement | 13–20 | [21:4152](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=21-4152) |
| Design Training | 21–25 | [24:4152](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=24-4152) |
| Design Dashboard | 26–29, 35, 36 | [25:4116](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=25-4116) |
| UI Consistency / Handoff | 00 Foundations & Components, 30–34 | [2:2](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=2-2) |

## 4. Kartu baru (opsional, untuk To Do List QA)

**Judul:** QA end-to-end alur traceability D4 (FR-D4-007)

**Deskripsi:**
> Uji satu alur lengkap di Supabase bersama dengan akun HR:
> 1. Competency Gap → pilih requirement berstatus Gap → Create Development Requirement.
> 2. Detail requirement menampilkan Source yang dapat diklik kembali ke gap.
> 3. Create Training dari requirement → Update Progress hingga Completed (Result wajib).
> 4. Pastikan gap **tetap** Gap setelah training Completed.
> 5. People Dashboard → profile employee menampilkan requirement dan training yang sama, dengan tautan View source.
> 6. Ulangi dengan akun Employee: hanya data sendiri, tanpa tombol tulis.

**Label:** QA · P0
