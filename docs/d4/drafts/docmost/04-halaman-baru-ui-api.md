# Draft · Halaman baru UI-D4-001 dan API-D4-001

**Target:** buat dua halaman baru di space HRMS, sebagai child dari parent Functional Requirement D4 (sejajar FR-D4-001…007).

| Halaman baru | Isi | Sumber teks |
|---|---|---|
| `UI-D4-001: Interaction & Component Guideline` | Token warna, tipografi, ukuran, pola wajib (Page Header, Filter Bar, Data Table, Menu ⋮, Detail Page, History Page, Form Modal, Toast, State), menu ⋮ per fitur, navigasi 6 menu, aturan konten, responsif, aksesibilitas | Salin isi `docs/d4/UI-D4-001.md` |
| `API-D4-001: Endpoint Contract` | Struktur folder API, autentikasi & izin, format respons dan kode error, 14 endpoint, aturan body POST per resource, contoh curl, seeder data demo | Salin isi `docs/d4/API-D4-001.md` |

## Isian tabel metadata (bagian atas halaman)

| Field | UI-D4-001 | API-D4-001 |
|---|---|---|
| Document ID | UI-D4-001 | API-D4-001 |
| Squad | D4 – Performance & Training Development | D4 – Performance & Training Development |
| Type | Interaction & Component Guideline | API Contract |
| Status | Draft for Review | Draft for Review |
| Date | 29 Sep 2026 | 29 Sep 2026 |
| Author | _(isi nama author halaman)_ | _(isi nama author halaman)_ |
| Related | TR-D4-002 (TR-11…TR-13, TR-21), FR-D4-001…007 | TR-D4-002 (TR-12…TR-19), TA-D4-001, FR-D4-001…006 |

## Tambahan di halaman lain

- **TR-D4-002, baris TR-21 (konsistensi komponen):** tambahkan kalimat "Dikonkretkan di UI-D4-001."
- **TA-D4-001:** di bagian arsitektur, tambahkan "Kontrak endpoint dan format error: API-D4-001. UI tidak memanggil Supabase langsung; semua baca dan tulis lewat `/api/d4/*`."
- **SD-D4-001 (versi final):** di daftar dokumen turunan, tambahkan UI-D4-001 dan API-D4-001.
