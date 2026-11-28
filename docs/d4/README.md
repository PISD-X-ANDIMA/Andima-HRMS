# Dokumentasi D4 V2

| Dokumen | Isi |
|---|---|
| [PROMPT-D4-REDESIGN.md](PROMPT-D4-REDESIGN.md) | Brief redesign: kritik asistensi K1–K9, arah visual, pola, rencana Figma, DoD, dan penyesuaian saat eksekusi (§13) |
| [ALUR-PENGGUNAAN-D4.md](ALUR-PENGGUNAAN-D4.md) | Panduan alur penggunaan: siapa mengisi apa di layar mana, apa yang otomatis, dan satu tempat menulis untuk setiap data |
| [PEMBAHASAN-ALUR-D4.md](PEMBAHASAN-ALUR-D4.md) | Alasan setiap keputusan alur beserta sumbernya, squad yang terlibat, dan bagian yang belum kuat |
| [PERTANYAAN-TERBUKA-D4.md](PERTANYAAN-TERBUKA-D4.md) | Daftar pertanyaan terbuka untuk klien, PO, squad lain, dan dosen, dengan anggapan sistem sekarang |
| [UI-D4-001.md](UI-D4-001.md) | Interaction & Component Guideline: token, tipografi, pola wajib, menu ⋮ per fitur, navigasi, responsif, aksesibilitas |
| [API-D4-001.md](API-D4-001.md) | Endpoint Contract: struktur, izin, format error, 14 endpoint, aturan body, seeder |
| [CHANGELOG-D4-V2.md](CHANGELOG-D4-V2.md) | Perubahan V1 → V2 dan pemetaan ke kritik K1–K9 |
| [RN-D4-001.md](RN-D4-001.md) | Release notes D4 V2.0: fitur, perubahan, known issues, catatan deployment |
| [EMPLOYEE-RULES-D4.md](EMPLOYEE-RULES-D4.md) | User story dan ketetapan sistem peran Employee (identitas dari B2, hak baca/tulis, tampilan, error) |
| [OBJECTIVE-COMPETENCY-GAP.md](OBJECTIVE-COMPETENCY-GAP.md) | Objective Competency Gap: tujuan, kompetensi per posisi, alur gap → requirement → training → reassessment, metode penutup gap, batasan D3/D1 (draf, menunggu persetujuan) |
| [AUDIT-UX-D4.md](AUDIT-UX-D4.md) | Audit UX, flow, dan traceability FR → route → Figma → Planka |
| [TEST-PLAN-D4.md](TEST-PLAN-D4.md) | Test plan + Requirement Traceability Matrix (141 TC/TS), format PASS/FAIL/BLOCKED, dependency |
| [MIGRATION-RUNBOOK-D4.md](MIGRATION-RUNBOOK-D4.md) | Status migrasi live (8 Nov 2026), urutan penerapan, cek sebelum/sesudah, rollback |
| [QA-STABILITY-D4.md](QA-STABILITY-D4.md) | Uji stabilitas (`npm test`, 90 tes + crawl browser) dan bug log BUG-D4-001…004 |
| [PLANKA-D4.md](PLANKA-D4.md) | Konvensi board Planka "Squad D4" (layout, nama, label peran) + matriks kartu ↔ bukti |
| [drafts/](drafts/README.md) | Teks siap tempel untuk Docmost (belum diterapkan) dan Planka (diterapkan 30 Sep 2026) |

## Figma

File **D4 V2**: https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F (tim student)

Dibuat sebagai file baru karena file PISD tim hanya bisa dibaca oleh akun ini. File pertama (`bpUIPDcmpjGbYzg0JuZnPH`) tidak bisa diakses lagi, jadi semua isi dibangun ulang di file ini. Isi saat ini:

- Variable collection **D4 V2 Tokens** (warna) dan text style `D4/*`.
- Board **00 Foundations & Components** dengan component set Button, Status Badge, Source Chip, Row Action Trigger, Menu Item, Toast, Metric Card, Form Field, Sidebar (6 varian menu aktif), Topbar, dan Pagination.
- Frame layar 01–34 di page `D4`, 7 baris per fitur, dengan 9 prototype link (⋮ → menu → Detail/History/Create, Save → Success Toast). Kode pembangunnya ada di plugin lokal [`figma-plugin/d4-v2-builder`](../../figma-plugin/d4-v2-builder/README.md), jadi frame bisa dibangun ulang di file lain.
- Section **D4 Web 1:1 (fix/D4-masukan-pst2, 23 Nov 2026)** di page `D4`: 36 frame tangkapan halaman asli (21 layar desktop, 9 state termasuk Loading dan Error, 6 layar ponsel 390). Ini acuan 1:1 terbaru; section 17 Nov diberi nama "arsip".

Setelah frame selesai, file ini dapat disalin ke page `D4` di file PISD oleh anggota tim yang punya akses edit.
