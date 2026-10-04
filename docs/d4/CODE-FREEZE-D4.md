| Field | Value |
| --- | --- |
| **Document ID** | CODE-FREEZE-D4 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Kebijakan code freeze (demo minggu 5) |
| **Version** | 1.0 |
| **Status** | Draft for Review |
| **Date** | 3 Okt 2026 |
| **Author** | Implementer D4 |
| **Derived From (Parents)** | RN-D4-001; QA-STABILITY-D4 |
| **Related** | DEMO-SCRIPT-D4; TEST-ACCOUNTS-D4; TEST-PLAN-D4 |

## 1. Tujuan

Code freeze menjaga build yang didemokan tetap sama dengan build yang sudah diuji. Selama freeze, hanya perbaikan yang mencegah demo gagal yang boleh masuk, dan setiap perbaikan harus bisa dibatalkan dengan cepat.

## 2. Objek yang dibekukan

| Item | Nilai |
| --- | --- |
| Repository | `KevArslanian/hrms-d4-sandbox` |
| Branch beku | `feature/d4-v2-d2-style` |
| Commit beku | `bcb92d8` — feat(auth): use the team's B2 login from GitHub for D4 (1 Okt 2026) |
| Mulai berlaku | Saat dokumen ini disetujui |
| Berakhir | Setelah Show & Tell minggu 5 selesai dan PO menyatakan freeze dicabut. Tanggal: `<diisi PO>` |
| Di luar freeze | Branch `feature/D4-week5-demo-prep`, yang hanya berisi dokumen demo dan `scripts/smoke-d4.mjs` tanpa perubahan kode aplikasi |

Catatan: RN-D4-001 sudah merujuk `bcb92d8` sebagai baseline; `b8e9564` hanya titik penyusunan draf awal RN.

## 3. Yang boleh dan tidak boleh selama freeze

| Boleh (hotfix) | Tidak boleh |
| --- | --- |
| Bug yang membuat alur DEMO-SCRIPT-D4 gagal (error, halaman kosong, simpan gagal) | Fitur baru atau perubahan perilaku yang tidak memperbaiki bug demo |
| Celah keamanan, misalnya akses data lintas peran atau kebocoran pesan error internal | Refactor, rename, perapian UI, perubahan copy yang tidak kritis |
| Perbaikan konfigurasi yang menghalangi aplikasi berjalan | Upgrade atau penambahan dependency |
| Perbaikan dokumen demo | Migrasi database baru, `npm run seed:d4 -- --apply`, atau `npm run smoke:d4 -- --write` pada data demo tanpa persetujuan PO |

## 4. Alur hotfix

| # | Langkah | Pelaku |
| --- | --- | --- |
| 1 | Laporkan masalah di kartu Planka D4 berlabel `hotfix-demo`: langkah reproduksi, dampak ke demo, dan bukti | Penemu (siapa pun) |
| 2 | Tech Lead D4 memutuskan apakah masalah memenuhi kriteria §3. Jika tidak, masalah masuk backlog setelah demo | Tech Lead D4 |
| 3 | Buat branch `hotfix/D4-<ringkas>` dari `bcb92d8` (atau dari hotfix terakhir yang sudah di-merge) | Implementer D4 |
| 4 | Perubahan sekecil mungkin, satu masalah per PR, ditambah test yang mereproduksi bug jika memungkinkan | Implementer D4 |
| 5 | Verifikasi lokal: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run smoke:d4` dan `npm run smoke:d4 -- --probe` | Implementer D4 |
| 6 | Buka PR ke `feature/d4-v2-d2-style` dengan isi: masalah, penyebab, perubahan, hasil verifikasi, dan langkah rollback | Implementer D4 |
| 7 | Review dan approval sesuai §5. Tidak ada merge tanpa approval, termasuk oleh penulis PR | Approver |
| 8 | Merge, catat hash commit baru sebagai "build demo" di kartu Planka dan di RN-D4-001 | Tech Lead D4 |
| 9 | Ulangi checklist H-1 di DEMO-SCRIPT-D4 §2.1 pada build baru | QA D4 |

Branch `main`/`master` tidak disentuh selama freeze. Commit langsung ke branch beku tidak diizinkan; semua perubahan wajib lewat PR.

## 5. Approver

| Peran | Wewenang | Wajib untuk |
| --- | --- | --- |
| Tech Lead D4 | Menilai kriteria hotfix, mereview kode, merge | Semua hotfix |
| Product Owner D4 | Menyetujui dampak ke demo, mencabut freeze, menyetujui perubahan data (seed atau migrasi) | Semua hotfix, serta setiap perubahan data |
| QA D4 | Memverifikasi build setelah merge (checklist H-1 dan smoke test) | Semua hotfix, setelah merge |
| Implementer D4 | Penulis PR; bukan approver | – |

Minimal dua approval (Tech Lead D4 dan Product Owner D4) sebelum merge. Jika salah satu berhalangan menjelang demo, keputusan diambil PO dan dicatat di kartu Planka.

## 6. Rollback

Rollback kode. Data D4 bersifat append-only, sehingga rollback kode tidak menghapus data.

| # | Langkah | Perintah / tindakan |
| --- | --- | --- |
| 1 | Tentukan build terakhir yang baik | `bcb92d8`, atau hash hotfix terakhir yang lulus checklist |
| 2 | Batalkan hotfix bermasalah lewat PR revert (jangan force-push) | `git revert <hash-hotfix>` di branch `hotfix/D4-revert-<ringkas>`, lalu PR ke `feature/d4-v2-d2-style` dengan approval §5 |
| 3 | Darurat menjelang demo (tidak ada waktu untuk PR) | Jalankan demo dari checkout bersih di commit baik: `git switch --detach bcb92d8 && npm ci && npm run build && npm run start`. PR revert tetap dibuat setelah demo |
| 4 | Jika sudah ada deployment (staging) | Deploy ulang commit baik tersebut. Saat dokumen ini ditulis belum ada staging (RN-D4-001 §7) |
| 5 | Jika build baik pun gagal karena data atau layanan | Pindah ke mode fixture sesuai DEMO-SCRIPT-D4 §5 |
| 6 | Verifikasi | Checklist H-1 DEMO-SCRIPT-D4 §2.1 nomor 2–6 |

Rollback data. D4 tidak punya UPDATE/DELETE. Record yang terlanjur tertulis (misalnya bertanda `[seed-d4]` atau `[smoke-d4]`) tetap ada, dan koreksinya dilakukan dengan revisi baru lewat aplikasi. Penghapusan data langsung di database hanya boleh dilakukan atas keputusan PO bersama admin database, tidak termasuk prosedur rollback ini, dan tidak dilakukan selama freeze.

## 7. Setelah freeze

1. PO mengumumkan freeze dicabut.
2. Hotfix yang di-merge selama freeze dicatat di RN-D4-001.
3. Masalah yang ditunda masuk backlog Planka dengan label `post-demo`.
