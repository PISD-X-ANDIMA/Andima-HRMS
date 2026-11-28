# Draft perubahan Docmost & Planka (D4 V2)

Semua file di folder ini adalah **draft siap tempel**. Draft **Planka sudah diterapkan 30 Sep 2026** (lihat [PLANKA-D4](../PLANKA-D4.md)); label dari `planka/01-label.md` diganti dengan format label D1 (lihat PLANKA-D4 §2). Draft **Docmost belum diterapkan**. Setelah PO menyetujui, isi file disalin ke halaman atau kartu yang disebut di bagian "Target" masing-masing file.

| File | Target | Menutup |
|---|---|---|
| [docmost/01-fr-section-7-design-reference.md](docmost/01-fr-section-7-design-reference.md) | FR-D4-001 s.d. FR-D4-006, section baru "7. Design Reference & UI Requirements" | K1–K5, K9 |
| [docmost/02-fr-d4-004-relasi-fr-d4-003.md](docmost/02-fr-d4-004-relasi-fr-d4-003.md) | FR-D4-004 + deskripsi kartu Planka terkait | K8 |
| [docmost/03-fr-d4-002-catatan-kpi-v51.md](docmost/03-fr-d4-002-catatan-kpi-v51.md) | FR-D4-002 | Selisih katalog V5.1 (dokumen) vs V3.1 (database) |
| [docmost/04-halaman-baru-ui-api.md](docmost/04-halaman-baru-ui-api.md) | Halaman baru UI-D4-001 dan API-D4-001 | K6, TR-21 |
| [docmost/05-perbaikan-metadata-dan-link.md](docmost/05-perbaikan-metadata-dan-link.md) | US-D4-001…006, SD/FR/TR/TA, halaman duplikat | Kerapian dokumen |
| [planka/01-label.md](planka/01-label.md) | Label board Squad D4 | K7 |
| [planka/02-sinkron-checklist.md](planka/02-sinkron-checklist.md) | Checklist semua kartu WebDev dan UI/UX | K7 |
| [planka/03-kartu-dan-komentar.md](planka/03-kartu-dan-komentar.md) | Deskripsi dan komentar kartu | K7, K8 |

## Aturan penerapan

1. Centang item Planka hanya setelah dicek di lingkungan tim (Supabase bersama + Vercel), bukan hanya di sandbox ini. Kolom "Bukti" di draft menunjuk ke kode di repo sandbox.
2. Halaman **"Test Write Access (boleh dihapus)"** di Docmost tidak disentuh. Keputusan hapus ada di PO/pemilik space.
3. Halaman duplikat tidak dihapus; salah satunya ditandai *Superseded*.
4. Link Figma memakai file **D4 V2** (`https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F`). Node id per layar sudah diisi untuk 34 frame; kalau frame dibangun ulang dengan `figma-plugin/d4-v2-builder/`, id-nya berubah dan perlu diperbarui.
