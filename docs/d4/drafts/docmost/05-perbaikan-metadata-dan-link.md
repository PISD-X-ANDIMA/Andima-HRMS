# Draft · Perbaikan metadata, link, dan halaman duplikat

Daftar temuan audit Docmost HRMS (29 Sep 2026) beserta teks penggantinya.

## 1. Link traceability ke Confluence

**Temuan:** US-D4-006 (slug `DGo7DEKRvv`) dan beberapa US lain masih menautkan requirement ke `rangga-perwiratama.atlassian.net` (Confluence lama). Link itu tidak bisa dibuka anggota tim yang tidak punya akses Confluence, dan isinya bisa berbeda dari FR di Docmost.

**Perbaikan:** di tabel Traceability tiap US, ganti link Confluence dengan link halaman Docmost:

| User Story | Ganti link ke |
|---|---|
| US-D4-001 | FR-D4-001 Performance Evaluation |
| US-D4-002 | FR-D4-002 KPI Scorecard |
| US-D4-003 | FR-D4-003 Competency Gap |
| US-D4-004 | FR-D4-004 Development Requirement |
| US-D4-005 | FR-D4-005 Training Tracking |
| US-D4-006 | FR-D4-006 People Dashboard |

Cek juga sisa link `atlassian.net` dengan pencarian Docmost sebelum menutup item ini.

## 2. Field Date dan Author kosong

**Temuan:** tabel metadata di SD-D4-001, FR-D4-001…007, TR-D4-001/002, dan TA-D4-001 memiliki field **Date** kosong, dan **Author** di beberapa tabel berbeda dengan author halaman di Docmost.

**Perbaikan:**
- Date: isi dengan tanggal versi terakhir yang disetujui (format `DD Mon YYYY`, contoh `29 Sep 2026`).
- Author: samakan dengan pembuat halaman di Docmost. Jika halaman ditulis bersama, tulis `Squad D4` lalu sebutkan nama di field Contributor.

## 3. Dua halaman "Finalisasi Scope Kerja D4"

**Temuan:** ada dua halaman berjudul sama, slug `ZWIfHtYTQg` dan `8C786T3HuD`. Versi yang dipakai sebagai acuan adalah `8C786T3HuD` (SD-D4-001).

**Perbaikan (tanpa menghapus):** di bagian paling atas halaman `ZWIfHtYTQg`, tambahkan:

> **Superseded.** Halaman ini adalah versi lama. Versi final: *SD-D4-001 Finalisasi Scope Kerja D4* (`8C786T3HuD`). Jangan dipakai sebagai acuan.

Lalu ubah judulnya menjadi `[Superseded] Finalisasi Scope Kerja D4`.

## 4. Halaman "Test Write Access (boleh dihapus)"

**Temuan:** halaman uji akses tulis masih ada di space HRMS.

**Tindakan:** hanya dilaporkan. Pemilik space atau PO yang memutuskan menghapusnya.

## 5. Navigasi fitur (K9)

**Temuan:** jumlah fitur tertulis berbeda di beberapa tempat (4, 6, atau 7).

**Perbaikan:** di SD-D4-001 dan halaman parent FR, tambahkan kalimat berikut:

> D4 memiliki **7 functional requirement** dan **6 menu**. FR-D4-001 s.d. FR-D4-006 masing-masing menjadi satu menu di sidebar HRMS → Performance & Training. FR-D4-007 (Data Relationship & Traceability) bukan menu. Ia terlihat sebagai source chip yang dapat diklik di setiap record dan blok Source di halaman detail.
