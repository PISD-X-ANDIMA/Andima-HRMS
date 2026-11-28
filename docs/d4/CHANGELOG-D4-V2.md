# CHANGELOG · D4 V2

Tanggal: 29 Sep 2026 · Branch: `feature/d4-v2-d2-style`

## Ringkasan per kritik asistensi

| # | Kritik | Kondisi V1 | Perubahan V2 | Bukti |
|---|---|---|---|---|
| K1 | Pop-up terlalu besar | Modal KPI `max-w-[1485px]`, Evaluation `max-w-[1480px]` | Satu `FormModal`: 640 px, KPI 880 px, tinggi maks 88vh, body scroll, footer sticky | `modules/d4/web/ui/forms.tsx`, semua `*Modal*.tsx` |
| K2 | Menu ⋮ "kerja dua kali" | ⋮ membuka panel Employee Quick View | ⋮ langsung membuka menu 2–4 aksi di portal, dengan navigasi keyboard | `modules/d4/web/ui/RowActionMenu.tsx` |
| K3 | Detail beda-beda per fitur | Modal (Competency), popover (Training), dropdown → page (Performance) | Detail dan History selalu route sendiri dengan breadcrumb dan tombol Back | 17 route di `app/(d4)/` |
| K4 | Blank space, dashboard tidak responsif | `max-w-[1048px]` di People Dashboard | Konten `max-w-[1600px]`, tabel dashboard penuh lebar dengan kolom sekunder yang disembunyikan di bawah 1400 px, sidebar jadi drawer di bawah 1024 px | Diuji 1440, 1280, 768 px tanpa scroll horizontal halaman |
| K5 | Font kebesaran | Ukuran px acak | Type scale tetap di `@theme` dan text style Figma `D4/*` | `app/globals.css`, UI-D4-001 §2 |
| K6 | Tidak ada API sendiri | UI memanggil Supabase langsung | `app/api/d4/**` → `modules/d4/server/<resource>/index.ts`, envelope error dengan kode, seeder | API-D4-001 |
| K7 | Checklist Planka dan label WebDev | Banyak item belum dicentang | Draft sinkron checklist berbasis bukti + label Front End/Back End | `drafts/planka/` |
| K8 | FR-D4-004 digabung tanpa alasan | — | Paragraf relasi FR-D4-003 ↔ FR-D4-004 + tabel traceability | `drafts/docmost/02-…` |
| K9 | Jumlah fitur membingungkan | 4 vs 6 vs 7 | Sidebar tepat 6 menu; FR-D4-007 dijelaskan sebagai source chip, bukan menu | `modules/d4/web/ui/AppShell.tsx`, UI-D4-001 §5 |

## Ditambahkan

- **Shell D2**: sidebar navy 260 px dengan sub-menu Performance & Training, topbar 64 px dengan breadcrumb, badge peran, dan badge "Preview · data fiktif" di mode preview.
- **Komponen bersama** (`modules/d4/web/ui/`): `PageHeader`, `FilterBar`, `SearchInput`, `SelectFilter`, `DataTable` (pagination 8 baris, baris dapat diklik, empty state), `PersonCell`, `RowActionMenu`, `DetailHeader`, `Timeline`, `Card`, `InfoGrid`, `StatusBadge`, `SourceChip`, `FormModal`, field form, `Toasts`, `StateView`, `NotFound`.
- **Halaman**: list, detail, dan history untuk kelima fitur data; People Dashboard + Employee Performance Profile.
- **API**: 14 route handler dengan `requireWriter` (HR/MANAGER), validator `field.*`, kode error `BAD_REQUEST` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` · `VALIDATION_FAILED` · `SERVER_ERROR`, dan `POST` 201.
- **Katalog KPI V5.1** (10 role × 5 KPI) di `modules/d4/kpi/catalog.ts` dan migrasi `20260929150000_d4_kpi_catalog_v51.sql` (belum diterapkan).
- **Mode preview** (`NEXT_PUBLIC_D4_DATA_MODE=fixture`, hanya `next dev`) dengan pilihan peran `NEXT_PUBLIC_D4_FIXTURE_ROLE`. Peran EMPLOYEE hanya melihat datanya sendiri dan tidak bisa menulis.
- **Seeder** `npm run seed:d4` (dry run default, `--apply` untuk menulis, penanda `[seed-d4]`).
- **Filter source requirement** di Training Tracking (dihapus lagi pada perbaikan bug 6 Okt 2026; diganti filter departemen).
- **Periode sumber** di bawah skor KPI dan Performance pada tabel People Dashboard.
- **Figma**: 36 frame D4 V2 dan 8 prototype link di https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F (page `D4`). Source chip yang lebih lebar dari kolomnya memotong referensinya dengan elipsis.
- **Dokumentasi**: UI-D4-001, API-D4-001, brief redesign, draft Docmost/Planka.

## Diubah

- Aksen hijau mengikuti D3: avatar inisial employee hijau `#16A37A` dengan teks putih, avatar user login di topbar mint `#B4F9CA` dengan teks `#0B6B4F`. D3 memakai `#2EAA68` 71% dan `#94F7B3` 70%; nilai D4 digelapkan agar inisial tetap terbaca.
- Status database `Bukti Belum Cukup` ditampilkan sebagai **Data Belum Cukup** dengan warna netral.
- Training Completed menampilkan catatan bahwa gap tidak otomatis tertutup.
- Semua perubahan status Development dan Training disimpan sebagai revisi (`POST …/versions`), bukan menimpa record.
- Format error API dari `{ "error": "…" }` menjadi `{ "error": { "code", "message" } }`. Error 500 tidak lagi membawa detail SQL.

## Dihapus

- Route lama `/live`, `/demo`, `/qa-preview`, `/employee/[id]`, dan layar V1 di `modules/d4/{performance,kpi,competency,development,training,dashboard}/*Screen.tsx`.
- Quick-view panel, popover detail, dan modal detail.
- Salinan komponen `components/Custom*.tsx`, `Pagination.tsx`, `StatusBadge.tsx`, `UserInput.tsx` yang tidak lagi dipakai. `components/auth/*` dan `public/auth`, `public/fonts` dihapus saat login diganti versi B2 GitHub (1 Okt).
- Aset SVG hasil ekspor Figma lama di `public/figma/`.
- Penyimpanan `localStorage` untuk data fitur.

## Revisi audit · 30 Sep 2026

Audit ulang terhadap FR-D4-001..006 (Docmost), checklist Planka, dan catatan VN asistensi. Detail dan dasar teorinya di [AUDIT-UX-D4.md](AUDIT-UX-D4.md).

- **Performance Evaluation**: form hanya berisi field FR-D4-001 — Employee, Period, Evaluation date, Evaluator, **Hasil evaluasi 1–5** (dengan label 1 Sangat Kurang … 5 Sangat Baik), Catatan evaluasi (wajib), Evidence. Tujuh aspek, review status manual, dan `Save Draft` dihapus karena tidak ada di FR.
- **KPI Scorecard**: KPI jabatan diturunkan otomatis dari position employee dan read-only; server menolak `roleOrder` yang tidak cocok. Satu tombol `Save Scorecard`. Halaman katalog `/kpi/catalog` dihapus (bukan fitur di FR), endpoint `kpi-catalog` tetap dipakai form.
- **People Dashboard**: satu baris = satu employee pada satu periode (FR-06.1); metric card agregat dihapus (di luar lingkup #12); profil punya pemilih periode dan peringatan bila scorecard tidak valid. Di bawah 1400 px kolom Position dan Open dev. disembunyikan.
- **Data fiktif**: nama staf asli diganti placeholder (Alfa … Holly, Mercury sebagai HR). Label peran "HR Manager" menjadi "HR".
- **Kode mati**: komponen `MetricCard` dihapus.
- **Figma**: 36 frame dibangun ulang dari builder (`figma-plugin/d4-v2-builder/code.js`), teks kolom lebar dipotong dua baris, lebar kolom dashboard dan Development Requirement disesuaikan, link prototype 14 → 18 dipulihkan.
- **Dokumen**: API-D4-001 §5 disesuaikan dengan kontrak evaluasi dan KPI yang baru; UI-D4-001 §2–§7 disesuaikan.

## Integritas logika · 30 Sep 2026 (malam)

Perbaikan dari audit ulang terhadap dokumen dan flow bisnis; detail di [AUDIT-UX-D4.md](AUDIT-UX-D4.md) §2.4–2.6. Aturan bersama ada di `modules/d4/shared/rules.ts` dan dipakai UI, fixture, serta API.

- **Tanggal WIB**: default tanggal dan periode form memakai `Asia/Jakarta`, bukan UTC (L1).
- **Revisi per periode**: evaluasi/scorecard kedua untuk employee + periode yang sama harus dikonfirmasi sebagai revisi (`revisionOf`); riwayat menampilkan "Revisi n" (L2).
- **Evaluator = user login**: field read-only; API mengambil nama dari akun dan menolak penilaian diri sendiri (L3, L4).
- **Training ↔ requirement**: requirement Completed tidak bisa diberi training baru; peringatan saat menyelesaikan requirement yang training-nya masih berjalan (L5).
- **Satu requirement terbuka per gap**: gap yang sudah tertangani tidak bisa dibuatkan requirement lagi; notes menyimpan nilai gap saat dibuat (L6).
- **Label**: "Evaluator", "Evaluation date", "Add Scorecard", "Add Evaluation" di semua layar (U1). Sempat diganti ke bahasa Indonesia (PR #9, #10), lalu kembali ke bahasa Inggris pada 6 Okt 2026.
- **Sidebar**: modul squad lain diredupkan dan ditandai belum terhubung (U2).
- **Training rollback**: status mundur wajib disertai alasan (U4).

## Uji stabilitas · 1 Okt 2026

Detail di [QA-STABILITY-D4.md](QA-STABILITY-D4.md). `npm test` (Vitest) menjalankan 90 tes tanpa menyentuh Supabase.

- **BUG-D4-001 (tinggi)**: update status development need dengan id tidak dikenal kini 404, bukan error database.
- **BUG-D4-002 (tinggi)**: referensi employee/posisi yang tidak ada kini 422, bukan 500.
- **BUG-D4-003 (sedang)**: pratinjau EMPLOYEE hanya memuat record milik sendiri, seperti RLS.

## Login B2 (GitHub) · 1 Okt 2026

- `/login` memakai kode login tim B2 dari `PISD-X-ANDIMA/Andima-HRMS` branch `feature/D3-005-employee-report-ticket`: tampilan kartu kaca, `signInWithPassword`, cek `d3_user_access`, `signOut` bila akun belum punya role.
- Penyesuaian D4: tujuan setelah login `/dashboard`; tidak ada register mandiri ("Belum punya akun? Hubungi HR Admin."); kotak "Kredensial Pengujian (Demo)" dari Figma B2 hanya tampil bila `NEXT_PUBLIC_D4_DEMO_EMAIL` dan `NEXT_PUBLIC_D4_DEMO_PASSWORD` diisi.

## Bahasa Indonesia dan perbaikan bug · 6 Okt 2026

- **Bahasa**: semua label, tombol, menu ⋮, header tabel, placeholder, empty state, dan form modal berbahasa Indonesia (PR #9, #10). `data-testid` lama dipertahankan agar XPath Katalon tidak berubah.
- **Perbaikan bug ronde 1**: kolom Departemen dan status Draf di KPI Scorecard, tanggal evaluasi tidak boleh di masa depan, tidak ada tombol Tambah untuk data diri sendiri, menu ⋮ tanpa "Lihat Detail" (klik baris), konfirmasi sebelum menutup modal yang sudah diisi, kode FR dihapus dari subjudul.

## Penyeragaman antar halaman · 6 Okt 2026

| Area | Sebelum | Sesudah | Bukti |
|---|---|---|---|
| Departemen | Filter dan kolom hanya di KPI Scorecard | Filter **Semua departemen** di keenam halaman daftar; kolom Departemen di Performance, KPI, Competency; Dashboard memakai kolom **Posisi / Departemen** | `modules/d4/web/features/*/…Pages.tsx` |
| Header detail/riwayat | Isi meta berbeda per fitur | Selalu posisi · ID · departemen, lalu konteks halaman | `employeeMeta` di `modules/d4/web/data/selectors.ts` |
| Riwayat Performance | Tanpa tombol tambah | Tombol **Tambah Evaluasi**, sama dengan riwayat KPI | `PerformancePages.tsx` |
| Tabel Dashboard 1440 px | Melebar 90 px, kolom Aksi terpotong | Muat tanpa scroll | `DashboardPages.tsx` |
| Profil karyawan Dashboard | Kolom Terbobot dan angka Total di luar layar | Terlihat tanpa menggeser tabel | `DashboardPages.tsx` |
| Filter | "Semua departemen" terpotong | Search min. 160 px, dropdown min. 180 px; muat satu baris di 1440 px | `modules/d4/web/ui/forms.tsx` |
| Tanggal | `en-GB`: "Sept 2026", "12 Oct 2026" | `id-ID`: "Sep 2026", "12 Okt 2026" | `formatDate`, `formatPeriod` |
| Copy | Back, Evaluator, capability/evidence/employee/position | Kembali, Penilai, kemampuan/bukti/karyawan/posisi | `ui/layout.tsx`, fitur terkait |
| Form Training | Error "Lengkapi field wajib… Completed" walau status lain; requirement sumber "belum memiliki requirement" sebelum karyawan dipilih | "Lengkapi <field> sebelum menyimpan." seperti form Evaluasi; "Pilih karyawan terlebih dahulu"; status berlabel Indonesia | `TrainingModals.tsx` |
| Data fixture | Requirement Alfa Teridentifikasi padahal training Direncanakan; Charlie Direncanakan padahal training Sedang Berjalan bertanggal 12 Okt | Requirement Alfa Direncanakan, Charlie Sedang Berjalan; training Charlie 1 Okt 2026 | `modules/d4/development/fixtures.ts`, `modules/d4/training/fixtures.ts` |

Belum diputuskan: status requirement tidak otomatis mengikuti status training, dan training Sedang Berjalan masih boleh bertanggal di masa depan. Keduanya aturan bisnis yang perlu keputusan PO.

## UI bahasa Inggris dan font Poppins · 6 Okt 2026

Keputusan pemilik produk: tampilan D4 di Vercel memakai bahasa Inggris dan font Poppins. Ini membalik arah PR #9/#10 (Bahasa Indonesia).

| Area | Perubahan | Bukti |
|---|---|---|
| Font | Inter + Montserrat diganti **Poppins** (400–800) untuk teks dan judul; judul tetap SemiBold lewat `font-semibold` | `app/layout.tsx`, `app/globals.css` |
| Teks UI | Semua label, tombol, menu ⋮, header tabel, placeholder, empty state, modal, toast, dan halaman login/register berbahasa Inggris; `<html lang="en">` | `modules/d4/web/**`, `app/login`, `app/register` |
| Pesan error API | Pesan validasi dan error server dalam bahasa Inggris (status kode tidak berubah) | `modules/d4/shared/rules.ts`, `shared/errors.ts`, `server/**`, `supabase/repository.ts` |
| Status | Status workflow tampil sesuai nilai database (Completed, Planned, …); status kompetensi D3 ditampilkan sebagai Met / Insufficient Data / No Requirement | `statusLabel` di `ui/primitives.tsx` |
| Tanggal | "12 Oct 2026", "Sep 2026" | `formatDate`, `formatPeriod` |
| Katalon | Semua `data-testid` sama persis dengan sebelum terjemahan (diverifikasi di 39 tampilan mode preview) | slug lama dipasang sebagai `testId` eksplisit |
| Data fixture | Data contoh mode preview diterjemahkan | `*/fixtures.ts`, `shared/fixtures/reference-data.ts` |
| Layout | Placeholder search dipersingkat; kartu KPI di profil karyawan selebar penuh di ≥1280 px agar kolom Weighted dan Total tetap terlihat dengan Poppins | `DashboardPages.tsx` |

Tidak diterjemahkan: nama KPI katalog V5.1, data D3 (karyawan, posisi, kompetensi), isi data seed live, dan pesan error yang dibangkitkan fungsi database (`raise exception` di migrasi Supabase).

## Konsistensi filter dan tombol · 6 Okt 2026

- **Filter**: label seragam `All …` dan urutan Position → Department → Source → Period → Status. "Latest period" di Performance/KPI menjadi **All periods**; "All gap status" di Competency menjadi **All status**. Filter periode People Dashboard (daftar dan profil) tidak lagi punya pilihan kosong dan langsung menampilkan periode terbaru (mis. "Sep 2026"). `data-testid` tetap.
- **Training Tracking**: tombol **Add Training** di header dihapus; training dibuat dari Development Requirement → **Create Training**.
- **Tombol detail**: Assess Position Change (Competency) dan Update Status (Development) menjadi primer biru seperti Add Evaluation / Add Scorecard / Update Progress. View History dan link navigasi tetap putih.

## Evaluasi kinerja tanpa skor · 6 Okt 2026

Keputusan pemilik produk: Performance Evaluation hanya berisi catatan; skor hanya di KPI Scorecard.

- Form Add Evaluation tidak lagi punya field **Evaluation result**; API mengabaikan `overallScore` dan menyimpan `null`.
- Tabel Performance: kolom Result diganti **Notes**. Detail: Evaluation result dan Criteria dihapus. Riwayat: judul tanpa skor.
- People Dashboard: kolom Performance (skor) menjadi **Evaluation** (Completed / Not Evaluated); kartu profil menampilkan catatan evaluasi.
- Database: migrasi `20261006120000_d4_evaluation_score_optional.sql` melonggarkan check `d4_performance_evaluations_check` (skor tidak wajib untuk status completed). Kolom `overall_score` tetap ada untuk evaluasi lama. **Belum diterapkan**; sampai diterapkan, simpan evaluasi di mode live ditolak database.

## Perbaikan total D4 · 8 Nov 2026

Cabang `feat/D4-perbaikan-total`, dibangun di atas PR #37. Dua migrasi baru disiapkan tetapi **belum diterapkan**. Urutan, cek, dan rollback ada di [MIGRATION-RUNBOOK-D4.md](MIGRATION-RUNBOOK-D4.md).

**Bug**
- **UI-005:** logo Andima di `/login` dan `/register` baru tampil mulai lebar 1024 px, jadi tidak menimpa form di 768–1023 px.
- **UI-006:** sapaan memakai jam browser setelah hydrasi, bukan jam server (UTC).
- **UI-008:** riwayat Competency Gap memakai fallback "posisi tidak ada di master", sama dengan People Dashboard.
- `POST /api/d4/performance-evaluations` kini mewajibkan Reference, sama dengan endpoint KPI (Q12).

**Director read-only (B17)**
- Migrasi `20261108120000`: `DIR-*` dipetakan ke `MANAGEMENT`.
- Semua policy baca dan view D4 menerima `MANAGEMENT`. Policy insert tetap HR/MANAGER.
- Aplikasi menampilkan peran "Management" tanpa tombol simpan. Pengecualian (koreksi 9 Nov): Director mengisi Daily KPI miliknya sendiri, lihat bagian 9 Nov.

**Daily KPI** (asumsi kerja, menunggu konfirmasi klien)
- Menu baru `/daily-kpi`. Pegawai mengisi skor lima Core KPI miliknya per hari. Koreksi berarti entri baru di tanggal yang sama, dan entri terbaru yang dipakai.
- HR, Manager, dan Management melihat tabel tim: jumlah hari terisi, skor kompilasi, dan gap terhadap 85.
- Migrasi `20261108130000` membuat tabel `d4_kpi_daily_entries`. Database menegakkan:
  - pemilik entri adalah akun yang login;
  - peran KPI sesuai posisi sendiri;
  - tanggal di periode WIB berjalan dan tidak lewat hari ini.
- Diuji di Postgres lokal.
- Add Performance Review mengisi Actual dari rata-rata harian (dibulatkan, karena trigger menyimpan skor bulat). HR tetap meninjau dan menyimpan.
- Alert People Dashboard baru:
  - "Daily KPI di bawah target": tiga entri terakhir berturut-turut di bawah 85;
  - "Belum mengisi Daily KPI".

**KPI gap**
- Gap = skor − 85, ditampilkan per Core KPI (form dan detail) dan untuk Total KPI (list Performance Review, Ringkasan detail, profil Dashboard).
- Skala 1–5 tidak dikonversi; tampil `n/a (skala 1–5)`.

**Verifikasi**
- `typecheck` dan `eslint` (0 error).
- 448 tes Vitest.
- Render di mode fixture untuk HR, Employee, dan Management:
  - Daily KPI di 1440 px dan 375 px;
  - prefill Performance Review;
  - alert dashboard;
  - login/register di 900 px dan 1440 px.

## Skor periode otomatis dari Daily KPI · 8 Nov 2026

Keputusan: skor periode dikompilasi otomatis, dan HR melakukan finalisasi. Daily KPI diisi pegawai saja. Integrasi definisi KPI D1 ditunda. Ini menjawab B6: klien menyebut input manual per periode sebagai langkah mundur.

- **Performance Review:**
  - Pegawai yang punya entri Daily KPI tetapi belum punya scorecard untuk periode itu tampil dengan status **Compiled**, total kompilasi, jumlah entri, dan gap terhadap 85.
  - Tanpa filter periode, kompilasi periode berjalan menggantikan scorecard yang lebih lama.
  - Filter status mendapat pilihan Compiled.
- **Aksi baru "Finalize from Daily KPI"** (HR/Manager, bukan untuk diri sendiri):
  - Skor kompilasi tampil read-only. HR menambahkan Notes dan Reference (Q12), lalu menyimpannya sebagai scorecard periode lewat `POST /api/d4/kpi-assessments` yang sudah ada.
  - Tanggal evaluasi adalah hari ini untuk periode berjalan, atau hari terakhir periode untuk periode lalu.
  - Mengubah skor tetap bisa lewat Add Performance Review.
- **People Dashboard:**
  - Pilihan periode ikut memuat periode Daily KPI.
  - Kolom Total KPI menampilkan skor kompilasi dengan badge Compiled sampai difinalisasi.
  - Grafik, ringkasan, dan alert Under Performance tetap hanya memakai scorecard yang sudah final.
  - Efek samping: begitu ada entri Daily KPI, periode default dashboard bergeser ke bulan berjalan, karena itu periode terbaru yang sudah mulai.
- **Server dan database:** tidak ada perubahan.

**Syarat integrasi definisi KPI dari D1 (ditunda).** Kondisi live per 9 Nov 2026 (read-only). D1 memperbarui KPI-nya pada 8 Nov: kini 21 posisi D1 punya bobot 100% dengan target 85, dan sebagian besar berisi 4 KPI.
- **Masih memblokir:**
  - `d1_kpi_definitions` merujuk ke `d1_job_positions`, bukan ke `d3_positions` yang dipakai pegawai (B2) dan D4.
  - Tabel pemetaan `d3_d1_position_mappings` masih 0 baris.
  - 0 dari 14 posisi yang dipegang pegawai punya pasangan D1 Active dengan 5 KPI.
- **Syarat sebelum D4 membaca KPI dari D1:**
  1. Pemetaan posisi D3 ke D1 terisi untuk setiap posisi yang dipegang pegawai.
  2. Hanya posisi `Active`.
  3. Tepat 5 KPI per posisi dengan bobot 100%. FR-D4-002, constraint DB, dan trigger scorecard mensyaratkan 5 Core KPI.
  4. Skala skor 1–100 dengan target 85. Sudah terpenuhi di data D1.
  5. Ada versi atau tanggal berlaku, supaya scorecard lama tetap memakai definisi saat disimpan.
- **Permintaan data ke D1** (pemetaan, KPI ke-5, requirement kompetensi, dan data D3/B2 terkait): `docs/d4/drafts/PROMPT-VALENT-DATA-D1-UNTUK-D4.md`.

## Permintaan wawancara 14 Okt yang bisa dipastikan · 9 Nov 2026

Hanya permintaan yang jelas di transkrip Show & Tell (Mas Bram) dan sepenuhnya milik D4:

- **B13 (01:48:13–01:49:03):** PIC "harus ada" agar bisa ditelusuri.
  - PIC wajib di form Add Requirement, `POST /api/d4/development-needs`, dan fixture.
  - Edit Requirement tidak bisa mengosongkan PIC. Requirement lama tanpa PIC tetap bisa diubah statusnya, dan alert "Tanpa PIC" tetap menandainya.
  - Kolom `pic` sudah ada di live, jadi tidak perlu migrasi.
- **B14 (01:46:09–01:47:34):** objective menyebut kompetensi yang kurang, level tujuan, dan cara menutup gap. Saran objective dari gap kini menambahkan "melalui <Method>" saat Method dipilih. Teks yang sudah diubah user tidak ditimpa.
- **B12 (01:47:48–01:48:08):** saran Method mengikuti contoh klien: Internal training, External training, Certification, Coaching. Method tetap opsional dan boleh teks lain.
- **B5 (00:32:52–00:33:46):** pegawai menilai KPI-nya setiap hari sebelum pulang.
  - Halaman Daily KPI menampilkan pengingat selama hari ini belum diisi.
  - Lonceng notifikasi di header mendapat badge. Panelnya terbuka sendiri sekali per hari di halaman mana pun selain Daily KPI, dan "Isi sekarang" membawa ke `/daily-kpi`.
  - Masuk Simulasi Employee langsung membuka `/daily-kpi`, sehingga "My KPI today" tampil pertama.

- **Pencocokan ulang Daily KPI dengan transkrip 14 Okt:**
  - **Director juga mengisi Daily KPI miliknya sendiri.** Contoh Mas Bram di 00:33:23 adalah seorang direktur yang menilai KPI direkturnya ("pencapaian target pendapatan operasional"). Penolakan untuk MANAGEMENT dihapus dari API, fixture, dan policy insert migrasi `20261108130000` (belum diterapkan, jadi diubah di tempat). Untuk data orang lain, Director tetap read-only (B17). Diuji ulang di Postgres lokal: entri sendiri diterima, entri untuk pegawai lain ditolak.
  - **Peran KPI untuk posisi direktur.** Di live, DIR-FAT dan DIR-GEN belum punya peran KPI, jadi Director tetap tidak bisa mengisi Daily KPI. Migrasi `20261109120000` memetakan keduanya ke peran 2 "Director" di V5.1 dan V6, sama dengan KPI pada contoh Mas Bram. Ini sementara, sampai KPI direktur dari D1 bisa dipetakan. Diuji di Postgres lokal: bisa dijalankan ulang tanpa duplikat, dan Director menyimpan entri dengan KPI Director (total 84.50, sesuai rumus).
  - **Kategori performa per hari (00:58:05, "nilainya ternyata high performance"):** tabel entri harian mendapat kolom Category untuk skala 1–100.
  - **Masih terbuka:** notulen 14 Okt menulis "KPI harian ada di tim Raka (D1)" dan "pembagian KPI harian antara D4 dan D1 perlu didiskusikan lagi". Keputusan PO bersama D1 tetap dibutuhkan.

- **Urutan daftar dinamis (permintaan 9 Nov):** di setiap halaman daftar, baris yang masih perlu ditindaklanjuti tampil di atas dan yang sudah selesai di bawah. Dalam kelompok yang sama, urutan tetap per nama.

| Halaman | Urutan (atas ke bawah) |
|---|---|
| Performance Review | Compiled (siap Finalize), belum dinilai, sudah dinilai, posisi tanpa KPI |
| Daily KPI (tim) | Periode berjalan: belum mengisi hari ini, lalu sudah. Periode lalu: tanpa entri, lalu ada entri. |
| Competency Gap | Belum dinilai, Gap, Insufficient Data, Met, tanpa persyaratan |
| Development Requirement | Identified, Planned, In Progress, Completed yang menunggu reassessment, Completed |
| Training Tracking | Not Passed tanpa tindak lanjut, Planned, In Progress, Completed, Cancelled |
| People Dashboard | Compiled, tanpa Performance Review, sudah dinilai |

Tidak dikerjakan karena belum pasti atau bukan milik D4:
- **B2:** UI target dan standar KPI. Menunggu kesepakatan definisi KPI dengan D1.
- **B20:** dashboard per level HR. Isi tiap level tidak dijelaskan klien. (Sebagian dikerjakan 10 Nov, lihat bawah.)
- **B9 / A1:** durasi trainee 3 atau 6 bulan. Tidak ada tanggal mulai kerja di data D4, dan statusnya milik B2.
- **A2:** wajibnya "dinilai bersama". Kolom `assessed_with` butuh migrasi `20261019120000`.
- **A4:** promosi otomatis. Butuh riwayat posisi dari D3.
- **B19:** alert ke MID beserta contoh dari klien. Butuh kontrak MID dan data D3.
- **B21, B22, B23, B24:** milik B2, D3, atau proses persetujuan.

## Persiapan presentasi · 10 Nov 2026

- **Kolom Status Performance Review (PR #39):** Penilai menjadi baris kecil di bawah Notes ("Notes / Penilai"), sehingga badge Status tidak lagi tertutup kolom aksi pada 1400–1500 px.
- **B20, filter level di People Dashboard (asumsi):**
  - Klien (00:59:37–00:59:47): semua halaman harus memberi informasi kepada HR staff, HR manager, dan HR director.
  - Filter baru "All levels" (Staff, Manager, Director) menyaring tabel, ringkasan, dan grafik.
  - Tabel posisi tidak punya kolom level. Level diambil dari kode posisi dengan aturan yang sama seperti pemetaan peran (`DIR-*` Director, `*-MGR` Manager), lalu judul posisi sebagai cadangan, dan sisanya Staff.
  - Tanpa migrasi. Perlu dikonfirmasi ke klien.
- **B9 tetap menunggu.**
  - `join_date` ada di `d3_employee` (130 pegawai), tetapi view `d4_employee` belum membukanya.
  - Menampilkan masa trainee 3 atau 6 bulan butuh migrasi view dan keputusan HR per pegawai.
  - Per 10 Nov hanya 1 pegawai berstatus probation di data B2.
- **TC-D4-008-18 lulus di produksi** (sebelum migrasi, Simulasi Employee): Daily KPI menampilkan pesan "belum tersedia", menu lain tetap berjalan.
- **Tujuh migrasi D4 diterapkan** dengan izin PO, setelah dicocokkan dengan permintaan Mas Bram. Akibatnya Daily KPI, skala 1–100 (V6), Gap vs 85, kategori, Management read-only, edit requirement, reassessment, dan tindak lanjut training kini aktif di production. Detail, backup, dan hasil cek ada di MIGRATION-RUNBOOK-D4, bagian "Status".
- **Integrasi data D1 (dijalankan D1):**
  - D1 memetakan 9 posisi D3 ke posisi D1. Sebanyak 7 dari 14 posisi pegawai kini lengkap: 5 KPI, bobot 100, dan target 85.
  - KPI untuk 6 posisi sama persis dengan katalog V6 D4. HR Manager memakai 5 KPI HR milik D1, yang bukan berasal dari scorecard klien.
  - D4 belum membaca `d1_kpi_definitions`, jadi perilaku KPI D4 tidak berubah.
  - D1 juga menambah 17 requirement kompetensi untuk 6 posisi. Requirement ini langsung terbaca di Competency Gap, sehingga status kompetensi 13 pegawai berubah.
- **20 requirement uji dihapus dari `position_requirements`** dengan izin PO, menindaklanjuti temuan D1: 18 requirement "Demo D4:" dan 2 kompetensi IT di COM-SA. Detail, backup, dan rollback ada di MIGRATION-RUNBOOK-D4, bagian "Pembersihan requirement uji".
- **Uji akses di database, 11 dari 11 lulus** lewat simulasi sesi. Director membaca semua data dan hanya bisa menulis Daily KPI miliknya. Employee hanya bisa mengisi hari ini untuk dirinya. Login UI dengan akun Director dan Employee belum dicoba.
- **Data demo Daily KPI untuk presentasi:** 33 entri V6 untuk lima akun bernama fiktif, di hari kerja 2–10 Nov. Hasilnya tiga kategori kinerja tampil, dan alert "Daily KPI di bawah target" muncul untuk dua pegawai.
- **Dua scorecard V5.1 di periode V6 dihapus** (Aldo Sapan, 2026-11 dan 2026-12), dengan backup. Detail ketiga butir ini ada di MIGRATION-RUNBOOK-D4, bagian "Data demo dan uji akses".
- **Semua dropdown form memakai gaya design system PISD.** Delapan dropdown di form Development dan Training sebelumnya memakai daftar bawaan browser (Priority, Source type, Source reference, Status, Result, Source requirement); kini sama dengan dropdown Employee dan PIC. Saran Method tetap boleh diketik bebas, tetapi daftarnya kini bergaya sama, bukan popup bawaan browser.
- **Passed/Not Passed tidak lagi berulang.** Di modal Update Progress, notice langkah berikutnya hanya tampil sekali dan hanya saat hasil baru dipilih. Di detail training, tombol "Reassess Competency" di header dan notice kuning di bawah dihapus karena sudah diwakili kartu Next step atau Follow-up.
- **Selesai training dan reassessment kini satu menu, satu Save.**
  - **Alur lama:** setelah Passed, HR perlu 4 kali Save di 3 menu (Training, Competency Gap, Development).
  - **Alur baru:** di Training Tracking, Update Progress → Completed meminta Result sekaligus keputusannya:
    - **Passed:** Meets requirement (requirement ditutup), Retraining (requirement dibuka lagi dan training ulang dibuat), atau Decide later.
    - **Not Passed:** Retraining atau Other follow-up.
  - **Isi satu Save:** snapshot Competency Gap ikut tersimpan.
  - **Syarat Meets requirement:** hanya bisa dipilih bila level di data D3 sudah memenuhi. Menyelesaikan training tidak mengubah data itu.
  - **Yang dihapus:** tombol dan menu "Record Reassessment" di Development, modal Record Follow-up yang terpisah, dan tombol "Reassess competency".
  - **Yang tetap ada:** testid `btn-record-follow-up` dan `btn-record-reassessment` sekarang ada di kartu Next step, dan membuka modal Update Progress yang sama.
  - **Server dan database:** endpoint baru `POST /api/d4/training-records/:id/complete`. Tidak ada migrasi.
  - **Requirement yang ditutup manual:** bila ditutup tanpa training Passed, tidak lagi ditandai "Needs reassessment".
- **Input tanggal dan periode memakai kalender bergaya design system.** Enam input tanggal sebelumnya memakai kalender bawaan browser dan menampilkan "10/11/2026", yang bisa terbaca 10 Nov atau 11 Okt. Inputnya adalah Date di Add Training dan Retraining, Effective date, Daily KPI, Period, dan Evaluation date.
  - Kini tampil "10 Nov 2026" dengan kalender yang sama gayanya dengan dropdown. Senin ada di kolom pertama, hari di luar batas tanggal nonaktif, dan ada tombol Today.
  - Keyboard: panah dan Enter untuk memilih, PageUp dan PageDown untuk pindah bulan, Escape menutup kalender saja.
  - Katalon: hari dipilih lewat testid `day-YYYY-MM-DD` dan bulan lewat `month-YYYY-MM`, bukan Set Text.
- **Save as revision tidak lagi gagal terus saat ada revisi lebih baru.** Bila form dibuka sebelum revisi lain untuk periode yang sama tersimpan (tab atau perangkat lain), server menjawab 409 "Sudah ada revisi ... yang lebih baru untuk periode ini sejak form dibuka." Aplikasi langsung memuat data terbaru, jadi Simpan berikutnya merevisi versi terakhir. Kasus belum mencentang Save as revision tetap 422.
- **Batas karakter dan teks panjang.**
  - Semua kolom catatan kini dibatasi 2000 karakter di form, sama dengan server. Notes Performance Review dibatasi 4000, dan Training / activity 200.
  - Teks panjang tanpa spasi kini terbungkus di halaman detail, riwayat, dan profil dashboard. Sebelumnya teks seperti itu membuat halaman riwayat melebar ke samping.
- **Development Requirement menunjukkan langkah berikutnya, termasuk Retraining.** HR menemukan requirement yang masih "Identified" padahal training-nya sudah selesai. Kolom Action juga hanya berisi "—" walaupun ada keputusan Retraining yang menunggu.
  - **Status mengikuti training:** sejak digabung dengan keputusan 13 Nov 2026, aturannya adalah milik Training Tracking (`statusFromTrainings`): tanpa training Identified, semua training Planned menjadi Planned, selain itu In Progress. Completed hanya lewat Meets requirement atau Close as Met; Update Status sudah dihapus. Aturan awal PR ini (`needFollowsTraining`) tidak dipakai lagi agar status requirement tetap punya satu penulis.
  - **Kolom Next step menggantikan Action**, dengan isi sesuai keadaan:

    | Keadaan | Isi kolom |
    |---|---|
    | Training Not Passed menunggu keputusan | tombol "Retraining / Follow-up" |
    | Training Passed menunggu keputusan | tombol "Meets / Retraining" |
    | Training berjalan | tautan "Training" atau "Retraining" dengan statusnya |
    | Belum ada training | tombol "Create Training" (atau "Create Retraining") |
    | Requirement ditutup | "Meets requirement" atau "Closed" |

    Akun tanpa hak simpan melihat "Menunggu keputusan HR". Keputusan membuka modal Update Progress yang sama dengan Training Tracking, jadi aturannya tetap satu.
  - **Menu ⋮ dan halaman detail:** menu ⋮ memuat "Record Reassessment" atau "Retraining / Follow-up" saat ada keputusan yang ditunggu. Halaman detail punya kartu Next step dengan penjelasan satu kalimat.
  - **Legenda status** di atas tabel menjelaskan arti Identified, Planned, In Progress, dan Completed.
  - **Teks "level di D3"** diganti "data kompetensi pegawai (modul D3)" agar HR tahu data mana yang harus diperbarui sebelum Meets requirement bisa dipilih.

## Daily KPI per peran, alert X-24, dan tanpa simulasi · 13 Nov 2026

- **Direktur tidak mengisi Daily KPI.** Keputusan 13 Nov 2026: peran Management (posisi `DIR-*`) hanya membaca D4, termasuk KPI-nya sendiri. Form "My KPI today" dan pengingatnya tidak tampil, server menjawab 403 "Direktur tidak mengisi Daily KPI", dan direktur tidak dihitung di alert "Belum mengisi Daily KPI". HR, Manager, dan Employee tetap mengisi Daily KPI-nya sendiri. Ini berbeda dengan contoh di wawancara 14 Okt (00:33:23, X-07). Policy insert di database (`d4_kpi_daily_entries`) belum diubah, karena perubahan itu butuh migrasi dan izin PO.
- **Alert Daily KPI mengikuti X-24 (wawancara 14 Okt, 01:16:41).** Under Performance (< 80) atau High Performance (> 85) tiga entri berturut-turut, dan entri yang mengisi 100 untuk kelima KPI, masing-masing jadi alert untuk dipanggil HR. Alert lama "di bawah target 85" dihapus, karena skor 80–85 adalah Average.
- **Dihapus: Simulasi Employee.** Tombol, banner "Keluar simulasi", dan logika pratinjau di `D4DataProvider` (`asEmployee`, `d4-view-as`). Tampilan Employee hanya dilihat lewat login Employee sungguhan.
- **Data contoh:** HR Manager kini punya KPI Finance & Administration seperti di live (`d4_position_kpi_roles`, role 10 di V5.1 dan V6), sehingga "My KPI today" milik HR terlihat di pratinjau.
- **Data yang baru disimpan tetap terlihat.** Setelah simpan, baris itu tampil paling atas dengan label "Just saved" dan notice View Detail, sampai halaman ditinggalkan.
- **Progres requirement punya satu penulis: Training Tracking.** Tombol "Update Status" di Development Requirement dihapus, karena progres yang sama juga ditulis lewat Update Progress di training dan keduanya bisa bertentangan.
  - Status requirement kini dihitung dari training-nya di putaran berjalan (setelah Retraining terakhir, tanpa yang Cancelled): tanpa training menjadi Identified, semua Planned menjadi Planned, selain itu In Progress. Server menuliskannya otomatis setelah setiap simpan training, dengan catatan "Mengikuti Training Tracking."
  - Completed hanya dengan bukti: training Passed dengan Meets requirement (sudah ada), atau **Close as Met** (baru) untuk requirement Competency Gap tanpa training terbuka saat level di data kompetensi sudah memenuhi, misalnya setelah coaching. Bukti dihitung ulang di server.
  - Development Requirement menampilkan "Update progress in Training" yang langsung membuka training aktifnya. Edit Requirement (Priority, Method, PIC) tetap ada.
  - API `development-needs/:id/versions` menolak perubahan status (422). Endpoint baru `development-needs/:id/close`.
  - Requirement Competency Gap yang syaratnya bukan lagi bagian dari posisi pegawai diberi tanda "Not in current position" (tampilan saja).
  - Migrasi `20261113120000_d4_development_status_from_trainings.sql` menahan aturan yang sama di database untuk penulisan yang melewati aplikasi. Sudah diuji di Postgres 16 lokal (13 kasus), **belum diterapkan**: perlu izin PO.
  - Data live 13 Nov (read-only): 39 requirement, 3 Completed tanpa Meets requirement (ditutup manual dengan aturan lama) dan 4 yang statusnya belum sesuai training. Tidak diubah; yang 4 ikut tersinkron saat training-nya disimpan lagi.
- **Filter list lebih bersih: search, Period, dan satu tombol Filter.** Di People Dashboard, Performance Review, Competency Gap, Development Requirement, dan Training Tracking, dropdown selain Period pindah ke panel di balik tombol Filter, masing-masing dengan label di atasnya (Departments, Performance, Positions, dan seterusnya) dan pilihan kosong "All". Period tetap di baris sebagai tombol berikon kalender, juga di Daily KPI dan profil pegawai. People Dashboard tetap tanpa "All" pada Period, agar angka dan grafiknya tidak mencampur periode. Saat panel tertutup, filter yang terisi hanya ditandai angka di tombol Filter; Reset filter ada di dalam panel. Filter kategori People Dashboard kini bernama Performance (id Katalon `filter-all-categories` tetap).
- **Dropdown bisa ditutup dengan menekan tombolnya lagi di Safari dan Firefox (Mac).** Di kedua browser itu tombol yang diklik tidak menerima fokus, sehingga dropdown dengan kotak pencarian (misalnya Period) tertutup lalu langsung terbuka lagi.
- **People Dashboard pindah ke urutan pertama** di menu HRMS.
- **Logout dengan konfirmasi.** Tombol tetap berlabel "Logout" (tidak lagi berubah menjadi "Keluar..."). Dialog menanyakan "Apakah Anda yakin ingin logout?"; Iya menampilkan "Logging out..." sampai halaman login terbuka, Tidak menutup dialog. Tombol Logout kini juga tampil di mode pratinjau lokal.
- **Login dan logout di mode pratinjau lokal.** Halaman login menerima email dan password apa pun yang formatnya valid dan hanya memasang cookie lokal `d4-preview-session`; logout menghapusnya. Tidak ada permintaan ke Supabase. Seperti di live, halaman D4 mengarah ke login bila belum login, dan halaman login mengarah ke dashboard bila sudah. Hanya aktif di `next dev` dengan `NEXT_PUBLIC_D4_DATA_MODE=fixture`.
- **Filter Levels di People Dashboard dihapus** (keputusan 13 Nov 2026). Filter ini berasal dari tafsiran B20 (wawancara 14 Okt 00:59:37), yang lebih tepat dibaca sebagai siapa yang melihat (sudah dipenuhi lewat peran HR, Manager, dan Management), dan levelnya hanya ditebak dari kode posisi karena master posisi D3 tidak punya kolom level. Filter Positions dan Departments tetap ada. TC-D4-006-24 ikut dihapus dari TEST-PLAN.
- **Kolom skor tidak bisa diisi di atas skala.** Score di Daily KPI dan Actual di Performance Review menolak ketikan atau tempelan yang membuat angka melewati skala katalog (100, atau 5 untuk V3.1/V5.1): mengetik 999 berhenti di 99, 1000 berhenti di 100, dan menempel "1000" tidak mengubah isi kolom. API dan database sudah menolak nilai itu sebelumnya; ini menutup celah di tampilan.

## Masukan wawancara 13 Nov (Mas Bram) · 15 Nov 2026

- **Urutan tile People Dashboard:** Employees, Need training, Training in progress, lalu Performance Review complete paling akhir (wawancara 13 Nov, 0:32:14). Isi dan testId tile tidak berubah.
- **Urutan Development Requirement:** requirement terbuka dulu, lalu High, Medium, Low, dan di dalam satu prioritas yang paling baru di-update di atas (1:06:52 dan 1:21:38). Sebelumnya urut per tahap lalu nama, sehingga High bisa tenggelam di bawah.
  - High tampil sebagai badge merah (`priority-high`). Di bawah 1280 px, saat kolom Priority disembunyikan, badge yang sama muncul di bawah Objective (`cell-priority-compact`).
  - Header kolom tanggal menjadi "Last updated", karena daftar diurutkan dengan tanggal itu.
  - **Penanda perubahan terbaru (permintaan 15 Nov 2026).** Last updated menampilkan jam dan nama yang mengubah (`cell-updated-by`), sehingga perubahan di hari yang sama bisa dibedakan. Requirement yang dibuat dalam 24 jam terakhir diberi label **New**, yang diubah dalam 24 jam terakhir diberi **Updated** (`label-recent`). Di bawah 1400 px, saat kolom Last updated disembunyikan, label yang sama muncul di bawah Objective (`label-recent-compact`). Batas 24 jam sama untuk semua pengguna, karena D4 belum menyimpan waktu terakhir tiap orang membuka halaman. Halaman detail requirement dan training juga menampilkan jam pada Last updated.
  - **Training Tracking ikut punya Last updated** dengan isi dan label yang sama, karena progres training paling sering berubah dan daftarnya diurutkan per tahap, bukan per waktu. Urutan per tahap tidak diubah. Kolom tampil mulai 1400 px; di bawah itu label pindah ke bawah nama training (dengan kolom penuh, tabel meluber 47 px di 1280 px dan 157 px di 768 px). Header "Date" di daftar dan detail training menjadi **Training date** agar tidak tertukar dengan Last updated; testId `cell-date` dan `date` tetap. Logika label (`recentLabel`, `RECENT_MS`) pindah ke `selectors.ts` dan badge-nya (`RecentBadge`) ke `primitives.tsx`, dipakai kedua halaman.
- **Requirement Completed keluar dari daftar default (1:08:36).** Yang sudah Completed dan sudah diputuskan tidak tampil sampai Status Completed dipilih. Di atas tabel ada satu baris "N requirement Completed sudah masuk riwayat." dengan tombol Show Completed (`archived-hint`, `btn-show-completed`). Yang Completed tetapi masih menunggu reassessment HR tetap tampil, karena HR masih harus bertindak. Riwayatnya tetap ada di Training Tracking dan profil pegawai.
- **Legenda status (`status-legend`) dihapus dari daftar Development Requirement.** Legenda dari 10 Nov 2026 membuat area di atas tabel terlalu penuh setelah ada keterangan riwayat. Arti status tetap dijelaskan di ALUR-PENGGUNAAN-D4 bagian 2.5.
- **Sidebar mengikuti contoh HRMS (permintaan 15 Nov 2026).** Hanya grup HRMS; POS, CRM, dan MID yang memang tidak bisa diklik dari D4 tidak ditampilkan lagi (testId `nav-pos`, `nav-crm`, `nav-mid` hilang). Tombol HRMS 40 px dengan `primary-700`, item 14 px tanpa bullet (sesuai Figma tim, 16 Nov 2026), item aktif tetap pill `#b0c6d4`, logo tanpa kotak putih. "Development Requirement" turun ke baris kedua karena tidak muat satu baris dengan indentasi contoh (179 px, tersedia 175 px). Logout tetap di bawah karena itu satu-satunya jalan keluar.
- **Font: judul Poppins, isi Inter (aturan tim, dikonfirmasi 15 Nov 2026).** `--font-sans` sekarang Inter, jadi teks isi, tabel, form, tombol, dan menu memakai Inter. Yang memakai `font-display` (judul halaman, judul kartu dan modal, nama di header detail, angka skor) serta brand ANDIMA di sidebar dan topbar tetap Poppins. Ukuran Inter di sidebar cocok dengan contoh HRMS: "Recruitment Pipeline" 14 px = 140 px, di contoh 141 px. Halaman login dan register (dari branch B2) tidak diubah.
- **Tabel tidak lagi digeser ke samping di 768 sampai 1399 px.** Sebelumnya empat tabel meluber: Competency Gap 35 px di 1280, People Dashboard 57 px, tim Daily KPI 80 px, dan Development Requirement 16 px di 1024 (dengan sidebar tetap, area konten di 1024 hanya ±700 px, lebih sempit dari 768). Perbaikannya: padding sel `DataTable` 16 px di bawah 1400 px (20 px mulai 1400 px, sama dengan frame Figma 1440), kolom Training di People Dashboard boleh dua baris ("Completed, awaiting follow-up"), kolom "Days filled / working days" di tim Daily KPI disembunyikan di bawah 1280 px dan jumlahnya tampil di bawah Today atau Last entry (`days-compact`), dan kolom Status Development boleh dua baris agar catatan "Not in current position" tidak melebarkan kolom. Diukur di fixture pada 1440, 1400, 1280, 1180, 1024, dan 768 px: luberan 0 di semua tabel keenam halaman.
- **SQL View untuk MID: `d4_mid_hrms_summary` (wawancara 13 Nov, 0:29:57; permintaan MID 13 Nov).** Mas Bram meminta MID cukup menerima angka di bagian atas People Dashboard, dan MID meminta satu SQL View per sistem yang dibaca aplikasi Next.js mereka. View berisi satu baris per periode: `total_employees`, `need_training`, `training_in_progress`, `performance_review_complete`, `under_performance`, `average_performance`, dan `high_performance`, dihitung dengan aturan yang sama dengan tile dan donut dashboard (akun B2 aktif yang punya login, revisi terbaru setiap requirement dan training, scorecard terbaru per pegawai dan periode dengan lima baris berbobot 100%, kategori hanya untuk skala 1–100). Isinya hanya angka agregat: bisa dibaca akun yang login, tidak oleh `anon`. Migrasi `20261116120000_d4_mid_hrms_summary.sql` diuji di Postgres 16 lokal (lima periode termasuk revisi scorecard, bobot tidak 100%, skala 1–5, skor tepat 80, 85, dan 85,01, akun nonaktif atau tanpa login, requirement yang dibuka ulang, dan migrasi dijalankan dua kali). Penerapan ke Supabase bersama mengikuti izin PO, seperti migrasi D4 lainnya.
- **Bulk select (1:10:34–1:12:33).** Kasus nyata dari Mas Bram: 32 field agent ikut satu training dan tidak mungkin diproses satu per satu.
  - `DataTable` punya checkbox per baris, select all untuk semua halaman dari baris yang sedang tampil, dan baris aksi berisi tombol (bukan menu ⋮). testId: `checkbox-select-all`, `checkbox-row-<id>`, `selection-bar`, `selection-count`, `btn-clear-selection`.
  - Development Requirement → **Add Training** (`btn-bulk-add-training`): satu training dengan aktivitas dan tanggal yang sama untuk setiap requirement terpilih, status Planned atau In Progress. Yang Completed dan requirement milik sendiri tidak bisa dipilih.
  - Training Tracking → **Update Progress** (`btn-bulk-update-progress`): In Progress, atau Completed dengan satu Result dan satu keputusan (Meets requirement, Retraining, Decide later; untuk Not Passed: Retraining atau Other follow-up). Hanya training Planned atau In Progress yang bisa dipilih. Pindah ke In Progress melewati yang sudah In Progress.
  - Setiap baris tetap disimpan lewat penyimpanan satu baris yang sama (`modules/d4/web/data/bulk.ts`), sehingga semua aturan dan pesannya sama. Baris dijalankan berurutan; baris yang ditolak tidak menghentikan yang lain. Baris yang ditolak tampil beserta alasannya dan tetap terpilih untuk dicoba lagi. Kalau tidak ada satu pun yang tersimpan, penyimpanan dianggap gagal.
- **Revisi Performance Review maksimal satu kali per periode (0:52:35).** Aturan `MAX_PERIOD_REVISIONS` di `rules.ts` berlaku untuk API dan pratinjau, untuk scorecard maupun evaluation. Revisi basi (sudah ada revisi lebih baru) tetap dijawab 409 lebih dulu agar data dimuat ulang. Form menampilkan peringatan `revision-limit` di atas dan menonaktifkan Save. Migrasi `20261115120000_d4_period_revision_limit.sql` menahan aturan yang sama di database, **belum diterapkan**: perlu izin PO. Diuji di Postgres 16 lokal dengan tabel sederhana (11 kasus: simpan pertama dan satu revisi diterima, simpan ketiga ditolak, periode atau pegawai lain tidak terpengaruh, evaluation ikut dibatasi, aman diterapkan dua kali). Baris lama yang sudah lebih dari dua tidak diubah, tetapi periode itu tidak menerima baris baru. Pemeriksaan memakai hitungan tanpa kunci baris, jadi dua simpan pada saat yang persis bersamaan masih bisa lolos.
- **Baris yang baru disimpan tetap terlihat** walaupun penyimpanannya membuat requirement Completed dan tersembunyi (misalnya Close as Met dari daftar), sampai halaman ditinggalkan.
- **Tes:** `tests/d4/interview-13nov.test.ts` (10 kasus) dan satu kasus API di `api.test.ts` (revisi dari revisi dijawab 422). Satu tes lama di `fixture-source.test.ts` diubah karena revisi dari revisi kini ditolak.

## Design system, field read-only, dan riwayat training · 16–17 Nov 2026

- **Sidebar mengikuti revisi Design System PISD** (node Figma `5429:830`, PR #58). Wordmark ANDIMA tanpa logo, link Dashboard berikon di atas grup HRMS (membuka People Dashboard; untuk Employee, My Performance), titik teal `#069494` pada menu aktif, menu lain putih, semua label mulai di x 71. Poppins untuk Dashboard, HRMS, Logistics Suite, dan Logout. Teks Logout tetap `#e3697b` (`#d9364f` hanya 3,4:1 di navy). testId baru `nav-dashboard`; `nav-people-dashboard`, `nav-my-performance`, dan `sidebar-logo` dihapus. Ini menggantikan "sub-menu tanpa bullet" dari 16 Nov.
- **Tombol secondary mengikuti Standar Button** (PR #58): isi `#f8f9fc`, garis `#3b6ff5`, label `#155dfc` (kontras 4,5:1).
- **Field read-only diberi border** sama dengan input nonaktif (PR #58). Tanpa border, field itu terlihat seperti dropdown rusak saat praktik bersama Mas Bram (13 Nov).
- **Judul section Notes dan Reference** di halaman detail memakai Poppins (PR #58).
- **Training yang selesai masuk riwayat** (aturan yang sama dengan Development Requirement, wawancara 13 Nov, 1:08:36). Training Completed yang hasilnya sudah diputuskan dan training Cancelled tidak tampil di daftar default Training Tracking; training Completed yang masih menunggu follow-up atau reassessment tetap tampil. Di atas tabel tampil "N training Completed dan N training Cancelled sudah masuk riwayat" dengan **Show Completed** (`btn-show-completed`) dan **Show Cancelled** (`btn-show-cancelled`), yang mengisi filter Status. Training yang baru disimpan tetap tampil sampai halaman ditinggalkan. Aturannya di `modules/d4/web/features/training/rows.ts`; tes `tests/d4/training-history.test.ts` (3 kasus).
- **Training Completed dengan hasil teks bebas** (data simulasi 14 Okt, di production hanya training Vira) kini dianggap menunggu hasil: `pendingDecision` mengembalikan `"result"`. Training itu tetap tampil di daftar dan diurutkan di atas, Next step requirement-nya "Training Completed, hasil belum dicatat · Record Result" (bukan Create Training), dan detail training menampilkan "Hasil belum dicatat" dengan tombol Record Result (`btn-record-result`). Ditemukan tim 17 Nov: requirement Vira In Progress sementara training-nya Completed. Status In Progress itu memang benar, karena requirement baru Completed setelah keputusan Meets requirement.
- **Label "Menunggu keputusan"** di bawah status requirement (daftar dan detail Development Requirement, `awaiting-decision`) selama ada training yang menunggu HR: hasil belum dicatat, Not Passed tanpa tindak lanjut, atau Passed tanpa reassessment. Tim membaca requirement In Progress dengan training Completed sebagai tidak konsisten; labelnya menjelaskan bahwa requirement menunggu keputusan HR. Tiga requirement lama yang statusnya memang tertinggal dari training-nya diperbaiki dengan `supabase/maintenance/20261117_d4_sync_requirement_status.sql` (menunggu izin PO).
- **Nama posisi tersimpan di riwayat kompetensi** (QA-07, temuan F-3). Penilaian yang posisinya sudah tidak ada di master posisi kini menampilkan nama posisi yang disimpan saat penilaian (`position_title_snapshot`), bukan "posisi tidak ada di master". Ini berlaku di Competency Gap › History dan timeline History di profil pegawai. Di production ada 10 penilaian yang terdampak, karena D3 membuat ulang 3 posisi dengan id baru setelah 14 Okt. Teks lama tetap dipakai bila snapshot kosong. Tes ada di `tests/d4/repository.test.ts` dan `tests/d4/dashboard-summary.test.ts`.
- **"Just saved" memakai satu aturan di kelima daftar** (Performance Review, Daily KPI tim, Competency Gap, Development Requirement, Training Tracking; WEB-08: komponen dan filter konsisten). Baris yang baru disimpan tampil paling atas dengan label Just saved sampai halaman ditinggalkan, juga ketika search, filter, atau aturan riwayat tidak lagi mencakupnya. Sebelumnya hanya Development Requirement yang begitu: di Training Tracking dengan filter Status = Planned, training yang baru diubah ke In Progress hilang dari tabel ("Tidak ada training yang cocok"). Aturannya satu fungsi, `pinJustSaved` di `selectors.ts`, yang dipakai `DataTable` lewat prop `justSaved` (menggantikan `highlightKey`); `withJustSaved` di Development dihapus. Dicek di pratinjau lokal untuk kelima daftar. Tes ada di `tests/d4/list-filters.test.ts`.

## Masukan PST 2 dan dosen · 22 Nov 2026

Sumber: Rekap Penilaian Squad D4 (PST 2) dan catatan dosen per anggota. Dasar dari wawancara Mas Bram disebut dengan menit rekamannya.

- **Training untuk beberapa orang sekaligus.** Training Tracking kini punya **Add Training**: centang requirement terbuka dari beberapa pegawai, isi activity dan tanggal sekali, lalu tersimpan satu training per orang. Orang yang mau ikut training yang sama ditambahkan dari detail training → **Add Participants** (training Planned atau In Progress); requirement yang sudah ikut training dengan activity dan tanggal yang sama tidak muncul lagi di pilihan. Kasus nyatanya 32 field agent dalam satu training (wawancara 13 Nov, 1:10:34). `BulkModals.tsx`, `TrainingPages.tsx`
- **Passed dengan pilihan Retraining dijelaskan.** Passed berarti lulus training; yang dipilih sesudahnya adalah kondisi kompetensi. Pilihannya kini bernama **Gap closed: Meets requirement** dan **Gap still open: Retraining**, di bawah label **Competency after training** dengan keterangan bahwa lulus training belum tentu menutup gap (wawancara 14 Okt, 1:49:50–1:53:22). `TrainingModals.tsx`, `BulkModals.tsx`
- **Tautan Show Completed dan Show Cancelled dihapus.** Satu-satunya jalan ke data yang sudah selesai adalah Status di Filter, dan Reset ada di panel yang sama. Keterangan di bawah filter kini menyebut jumlahnya dan menunjuk ke Filter. Ini juga menutup jalur bug PST 2 "Reset filter tidak berfungsi": tautan mengubah Status saat panel Filter tertutup, sehingga Reset tidak terlihat. Di main, Reset sendiri mengosongkan filter dengan benar (dicoba Status Completed → Reset). `TrainingPages.tsx`, `DevelopmentPages.tsx`
- **Siapa yang butuh training.** Alert baru **Butuh training** di People Dashboard menyebut pegawai yang punya development requirement terbuka tanpa training (selain Cancelled). Untuk HR dan Manager, lonceng notifikasi juga menampilkan "{n} pegawai butuh training" dan panelnya terbuka sendiri setiap kali daftar pengingat berubah. Mas Bram meminta jumlah "need training" di dashboard (14 Okt, 1:56:44; 13 Nov, 0:32:14). `summary.ts`, `AppShell.tsx`, `selectors.ts`
- **Kolom Total KPI tanpa "/ 100" di setiap baris.** Skala ditulis sekali di judul kolom, misalnya **Total KPI (/100)**; baris dengan skala lain (V5.1, 1–5) tetap menulis skalanya sendiri. `PerformancePages.tsx`
- **Alasan Period, Evaluation date, dan Evaluator di form Performance Review.** Period bisa diubah untuk penilaian periode lalu yang terlambat dicatat; Evaluation date dari awal periode sampai hari ini; Evaluator dikunci karena server menyimpan akun yang sedang login, supaya penilaian tidak tercatat atas nama orang lain. Ketiganya kini punya keterangan di bawah field. `KpiFormModal.tsx`, `forms.tsx`
- **Daily KPI yang lupa diisi lebih dari satu hari.** Form menampilkan hari kerja (Senin–Jumat) bulan berjalan yang belum diisi, sebagai tombol tanggal; satu klik memilih tanggal itu. Aturan lama tetap: entri hanya untuk bulan berjalan dan tidak untuk hari depan, jadi hari yang terlewat bisa diisi sampai akhir bulan. `daily/entry.ts`, `DailyKpiPages.tsx`
- **Update Progress menutup sendiri setelah tersimpan.** Form tertutup begitu data tersimpan; daftar dimuat ulang di belakang dan notifikasi tersimpan muncul setelah datanya baru. Sebelumnya form menunggu dua kali muat ulang snapshot penuh (satu di server, satu di browser). `D4DataProvider.tsx`
- **Halaman History satu pola.** Judul kartu mengikuti nama modul: Performance Review history, Daily KPI history, Competency Gap history, Development Requirement history, Training history, dan Employee history di profil. Revisi training ditulis "Revision n" seperti requirement, dan log revisi memakai tanggal dan jam. Keterangan di daftar tidak lagi berkata "sudah masuk riwayat", karena View History adalah halaman lain. `*Pages.tsx`

## Design System terbaru, tampilan ponsel, dan Figma 1:1 · 23 Nov 2026

- **Shell mengikuti Design System PISD terbaru** (node `5858:737`; node sidebar lama `5429:830` sudah dihapus dari file DS). Header sidebar kembali memakai logo ANDIMA 52×35 di samping wordmark ANDIMA dan "Logistics Suite". Tombol menu biru `#3b6ff5` (24×24, radius 5) selalu tampil di topbar: di layar ≥1024 px tombol ini menutup dan membuka sidebar, dan pilihannya diingat per browser (`d4-sidebar-collapsed`); di bawah 1024 px sidebar tetap drawer. "ANDIMA HRMS" 16 px dan garis pemisah `#d9e2fc`. `AppShell.tsx`
- **Toast mengikuti DS** (node `6410:132`): judul SUCCEED atau FAILED, isi `#ecfdf5`, garis `#a7f3d0`, radius 12. Toast pindah ke kanan bawah, karena di kanan atas toast menutupi lonceng notifikasi. Isinya solid, bukan 70% seperti di DS, karena toast muncul di atas tabel dan teks tabel tembus terbaca. `layout.tsx`
- **Belum diterapkan dari DS: pilihan bahasa EN/ID dan Top Quick Search Bar.** Belum ada squad yang memasangnya, Docmost belum punya keputusannya, dan pertanyaan bahasa ke Mas Bram belum dijawab. Terjemahan setengah jadi lebih membingungkan daripada satu bahasa.
- **Daftar di ponsel jadi kartu.** Di lebar 639 px ke bawah, setiap baris kelima daftar dan People Dashboard tampil sebagai satu kartu: kolom pertama (nama dan ID) di atas dengan menu ⋮, kolom lain di bawahnya sebagai pasangan label dan nilai. Centang per baris dan "Select all" tetap ada. Tabel lebar dengan scroll ke samping tetap dipakai mulai 640 px. Hanya satu bentuk yang dirender, jadi test id tidak dobel. Dicek di 390 px untuk semua route. `DataTable.tsx`
- **Daily KPI: "Lewati tanggal libur".** Keterangan hari yang belum diisi kini menyebut bahwa tanggal libur dilewati saja. Aturan bulan berjalan tidak diubah: aturan itu ada di database dan migrasinya, dan membukanya untuk bulan lalu berarti periode yang sudah difinalisasi bisa berubah. `DailyKpiPages.tsx`
- **Keputusan tanpa perubahan kode.** Pegawai yang belum punya development requirement tetap tidak bisa langsung ditambahkan ke training; Add Participants hanya menampilkan requirement terbuka dan arahnya buat requirement dulu lewat Add Requirement, supaya setiap training tetap punya sumber. Cabang lama `fix/D4-urutan-priority` dibiarkan, karena menghapusnya tidak bisa dibatalkan.
- **Figma 1:1.** Di file D4 V2, page `D4`, section baru **D4 Web 1:1 (fix/D4-masukan-pst2, 23 Nov 2026)** berisi 36 frame yang ditangkap dari halaman lokal cabang ini sebagai layer editable: 21 layar desktop 1440 (semua list, detail, history, dan modal), 9 state (Loading, Error, hasil pencarian kosong, Not found, panel Filter, panel notifikasi, toast SUCCEED, konfirmasi logout, sidebar tertutup), dan 6 layar ponsel 390. State Loading dan Error dirender dari markup `LoadingView` dan `StateView` di halaman yang sama, karena mode data contoh tidak bisa gagal memuat. Section 17 Nov diberi nama "arsip"; 36 frame asli dan prototype link-nya tidak diubah.
- **Judul pengingat training diganti "Belum punya training".** Di produksi, lonceng menulis "4 pegawai butuh training" sementara kartu **Need training** di People Dashboard menulis 5. Keduanya benar: kartu menghitung pegawai yang masih punya requirement terbuka (permintaan klien, UAT-19), lonceng dan alert dashboard hanya yang requirement-nya belum punya training. Judul lonceng kini "{n} pegawai belum punya training", alert dashboard **Belum punya training**, dan kalimat di bawahnya "menunggu training". Label kartu tidak diubah. `AppShell.tsx`, `summary.ts`

## Bug QA di Planka · 23 Nov 2026

Sumber: dua kartu bug terbuka di board Planka Squad D4 (QA, 17 Nov 2026) dan catatan PST 2 tentang "/ 100".

- **BUG-FN-D4-001: angka nol di depan pada Actual dan Score.** Field Actual di Performance Review dan Score di Daily KPI tidak lagi menampilkan "00085" atau "00000". Nol di depan angka lain dibuang saat diketik atau ditempel ("00085" menjadi "85"), dan deretan nol menjadi satu "0" yang ditolak saat Save dengan pesan rentang 1–100. Di Performance Review, input angka menyimpan 85 di state tetapi layar tetap menulis "00085"; teks yang sudah dibersihkan kini ditulis balik ke field. Kedua form memakai satu aturan, `typedScore`. Weighted dan Total tidak berubah. `scale.ts`, `KpiFormModal.tsx`, `DailyKpiPages.tsx`
- **BUG-FN-D4-002: Score dan Comment Daily KPI kosong setelah Save dan saat dibuka lagi.** Form "My KPI today" kini kosong saat halaman dibuka, setelah Save, dan saat tanggal dipilih, juga untuk hari yang sudah punya entri. Untuk hari seperti itu muncul pemberitahuan bahwa menyimpan akan mengoreksi entri tersebut, dengan totalnya, dan tombolnya **Save correction**. Skor dan komentar tersimpan hanya dimuat lewat **Correct** di tabel This period, lengkap dengan "Saved: N" dan perbandingan total seperti sebelumnya. Riwayat tetap utuh di halaman History. Sebelumnya form memuat skor tersimpan setiap kali dibuka. `daily/entry.ts` (`openDailyForm`), `DailyKpiPages.tsx`
- **People Dashboard: skala di judul kolom.** Kolom Total KPI di tabel People Dashboard kini berjudul **Total KPI (/100)** dan barisnya hanya menulis angka, sama dengan daftar Performance Review sejak 22 Nov. Baris yang tersimpan dengan skala lain (V5.1, 1–5) tetap menulis "/ 5". Aturannya kini satu fungsi bersama, `listScore`. `selectors.ts`, `DashboardPages.tsx`, `PerformancePages.tsx`
- **Belum diubah:** tabel This period dan Daily entries di halaman Daily KPI masih menulis "/ 100" per baris. Tidak ada laporan untuk tabel itu, jadi dibiarkan sampai ada keputusan.

## Passed tidak langsung menawarkan Retraining · 23 Nov 2026

Sumber: pertanyaan 23 Nov "kalau Passed kenapa ada Retraining", yang juga disorot PST 2 dan pada 22 Nov hanya dijawab dengan label. Dasarnya wawancara 14 Okt part 2: training Completed belum membuktikan gap tertutup (00:51:27), dan sesudah training ada reassessment, "Apakah harus dilakukan retraining? Ataukah sudah memenuhi?" (00:53:31).

- **Saat hasil Passed dicatat** (Update Progress satuan dan bulk): pilihannya **Gap closed: Meets requirement** (tetap butuh level D3 yang memenuhi) atau **Decide later**. **Gap still open: Retraining** tidak ditawarkan lagi di sini. Sebelumnya Retraining bisa disimpan di Save yang sama dengan level sebelum training. Dicoba 23 Nov di data contoh: training Coretax Kak Dian, "current 3", dan training ulang langsung dibuat.
- **Retraining sesudah Passed** ada di langkah reassessment, yaitu Next step untuk training Passed yang menunggu keputusan. Untuk requirement dari Competency Gap, pilihan ini aktif bila ada penilaian kompetensi yang disimpan di Competency Gap **sesudah** hasil Passed dan levelnya masih di bawah requirement. Data level D3 tidak punya tanggal, jadi penilaian yang disimpan di D4 menjadi satu-satunya bukti bertanggal. Bila level sudah memenuhi, yang aktif Meets requirement. Requirement dari role change atau performance context tidak punya data level di D4, jadi hanya syarat langkah reassessment yang berlaku.
- **Satu aturan untuk layar dan server:** `retrainingBlockedReason` di `rules.ts`, dipakai `planTrainingCompletion` (API dan fixture) dan form Update Progress. Server menolak Retraining yang belum memenuhi syarat dengan 422 sebelum menulis apa pun.
- **Akibatnya:** Retraining sesudah Passed butuh satu Save tambahan, yaitu penilaian di Competency Gap. Meets requirement dan alur Not Passed tidak berubah.
- **Penilaian di hari yang sama:** bila penilaian dengan hasil sama sudah tersimpan hari itu sebelum hasil Passed dicatat, tombolnya menjadi Saved Today. Pesan Retraining dan tooltip tombol menyebut jalan keluarnya: isi **Assessed with** (misalnya atasannya), lalu penilaian tersimpan sebagai penilaian baru, di layar maupun di server. Dicoba 23 Nov di data contoh.
- Tes: `training-completion` (aturan dan alur dua langkah), `development-next-step`, `fixture-source`, `api.test` (422 tanpa tulis). TC-D4-005-16.
- `rules.ts`, `TrainingModals.tsx`, `BulkModals.tsx`, `TrainingPages.tsx`, `DevelopmentPages.tsx`, `CompetencyPages.tsx`, `server/training-records/index.ts`, `fixture-source.ts`

## Kartu ringkasan People Dashboard bisa dibuka · 23 Nov 2026

Sumber: saran Pak Emanuel ke Skuad 4 (17 Nov 2026), "bisa dilihat di mana siapa yang butuh training?", diingatkan lagi oleh Gebby pada 23 Nov.

- **Employees** melompat ke tabel pegawai di bawahnya.
- **Need training** membuka daftar pegawai yang punya development requirement belum selesai. Tiap requirement menampilkan training terakhirnya selain Cancelled, atau "Belum punya training". Training yang Completed ikut menampilkan hasilnya, sehingga Not Passed tidak terbaca selesai. HR dan Manager bisa langsung **Create Training** untuk requirement tanpa training, atau **Update Progress** untuk training yang Planned atau In Progress.
- **Training in progress** membuka daftar training In Progress per pegawai, masing-masing dengan **Update Progress**.
- **Performance Review complete** membuka daftar periode yang ditampilkan: Belum direview lebih dulu (**Finalize** bila sudah ada skor Compiled dari Daily KPI, **Add Performance Review** bila belum), lalu Data tidak valid, lalu Sudah direview dengan Total KPI dan kategorinya. Pegawai yang posisinya tidak punya KPI disebut di catatan bawah.
- Form aksi menggantikan daftar selama terbuka. Setelah Save atau Cancel, dialog kembali ke daftar, dan Save menambahkan pemberitahuan "tersimpan" dengan link View Detail. Tidak pernah ada dua dialog bertumpuk.
- Angka kartu dan isi daftarnya berasal dari satu fungsi (`tileMembers` di `summary.ts`), jadi keduanya tidak bisa berbeda. Kartu bernilai 0 tidak bisa diklik. Kartu Performance Review tetap bisa dibuka selama ada pegawai yang bisa direview, karena isinya dimulai dari yang belum direview.
- Tombol aksi mengikuti aturan halaman sumbernya: hanya HR dan Manager, tidak di baris diri sendiri, dan tidak untuk Director yang read-only.
- Footer dialog menautkan halaman lengkapnya: Development Requirement, Training Tracking dengan filter In Progress (`/training?status=In%20Progress`, yang kini dibaca halaman Training), dan Performance Review untuk periode itu.
- Form Performance Review kini menerima periode awal. Add Performance Review dari dashboard membuka periode yang sedang ditampilkan dashboard, bukan selalu bulan ini.
- Dicek di mode pratinjau pada lebar 1440, 768, dan 390 px, juga dengan keyboard: Enter membuka daftar, Escape menutup, dan fokus kembali ke kartu. Menyimpan dari dialog belum dicoba.

## Paginasi, info berulang, dan toggle bahasa · 24 Nov 2026

- **Pemilih baris per halaman** mengikuti contoh yang dibagikan di kelas: `[10 ▾] per page` di kanan bawah tabel, pemilih di depan labelnya. Pilihannya 10, 20, 50, 100. Testid tidak berubah (`select-page-size`, `options-page-size`).
- **Info yang sama di setiap baris dihapus:**
  - List Performance Review tidak lagi menulis "from 6 daily entries" di bawah skor. Kolom Period hanya muncul bila daftar tidak difilter ke satu periode.
  - People Dashboard tidak lagi punya kolom Period; periodenya sudah ada di tombol Period.
  - Tabel tim Daily KPI memindahkan jumlah hari kerja dan target 85 ke judul kolom: **Days filled (/N)** dan **Compiled score / Gap vs 85**. Selnya hanya berisi angka per pegawai.
- **Toggle bahasa EN | ID** di topbar, default ID. Urutannya EN di kiri dan ID di kanan (permintaan Delta 24 Nov); testid tidak berubah. Mengikuti keputusan diskusi kelas 21 Nov 2026: React Context API, terjemahan disimpan di frontend. Cookie dan localStorage `andima-hrms-language` sama dengan D3, jadi satu pilihan berlaku di kedua modul begitu domainnya sama. Server membaca cookie, sehingga halaman tidak berkedip dari bahasa lain saat dimuat.
  - Semua layar D4 ikut diterjemahkan: label, teks bantuan, empty state, toast, aria-label, halaman 404, dan nama bulan (Mei, Agu, Okt, Des).
  - Yang tidak diterjemahkan: nama modul, kosakata workflow, nama KPI dan kompetensi, data tersimpan, nilai filter, dan pesan dari server (bahasa Indonesia). Detailnya di UI-D4-001 §6.
  - Bahasa Inggris memakai bentuk tunggal saat jumlahnya 1 ("1 employee has", bukan "1 employees have"), lewat `enOne` di kamus.
  - Testid tidak berubah antarbahasa. Dicek di browser 24 Nov: set `data-testid` di enam halaman list, detail training, profil pegawai, dan modal Performance Review identik di ID dan EN. Diff kode juga tidak mengubah satu pun testid literal.
  - Kartu ringkasan dashboard dan tiga dialognya (PR #68, masuk main lebih dulu) ikut diterjemahkan saat main digabung ke cabang ini. Testid dialog Need training, Training in progress, dan Performance Review identik di ID dan EN.
  - Tes baru `tests/d4/i18n.test.ts`: setiap teks yang dilewatkan ke `t(...)` punya entri kamus, tiap teks hanya ada di satu file fitur, placeholder terjemahan sama dengan sumbernya, dan bentuk tunggal Inggris dipakai saat jumlahnya 1. TC-D4-UIQ-15 s.d. 19.
- `modules/d4/web/i18n/`, `modules/d4/shared/text.ts`, `app/(d4)/layout.tsx`, `app/not-found.tsx`, `DataTable.tsx`, `selectors.ts`, `rules.ts`, `bulk.ts`, dan halaman serta modal di `modules/d4/web/features/`

## Pengingat Daily KPI jadi satu kalender · 24 Nov 2026

- **Dua kotak kuning digabung.** "Daily KPI hari ini belum diisi" dan "N hari kerja bulan ini belum diisi" kini satu kotak: "Daily KPI hari ini dan N hari kerja lain bulan ini belum diisi." Kalau hanya hari ini yang kosong, kalimat lama tetap dipakai.
- **Deretan chip tanggal diganti kalender Sen–Jum.** Satu baris per minggu dari tanggal 1 sampai hari ini, jadi tanggal yang bolong sejajar dengan harinya. Hari yang belum diisi berupa tombol, hari yang sudah diisi redup dengan centang, dan hari ini diberi titik. Tanggal yang sedang dibuka di form tampil terpilih.
- **Sel tanpa bingkai, mengikuti pola kalender Carbon dan Total Synergy.** Hari yang belum diisi berupa kotak putih bertulisan tebal, hover berlatar biru muda, dan tanggal terpilih berlatar `primary-600` dengan teks putih (kontras 5,2:1). Sebelumnya terpilih dan hover sama-sama bergaris biru sehingga sulit dibedakan. Fokus keyboard memakai garis biru 2 px dengan jarak 2 px.
- Tinggi sel 40 px di ponsel dan 32 px mulai 640 px. Teks hari yang sudah diisi memakai `text-ink-2` (kontras 6,9:1 di latar kuning; `text-ink-3` hanya 4,4:1).
- Testid `daily-reminder`, `daily-missed`, dan `missed-YYYY-MM-DD` tetap; sel hari ini memakai `daily-today`. TC-D4-008-12 diperbarui, TC-D4-008-22 baru.
- Dicek di mode pratinjau pada 375, sekitar 400, dan 1280 px dalam ID dan EN, termasuk menyimpan satu tanggal lalu melihatnya berubah jadi centang. Belum ada desain Figma untuk bagian ini; frame Daily KPI di Figma D4 V2 (302:2) tidak punya kotak pengingat.
- `modules/d4/web/features/daily/DailyKpiPages.tsx`, `modules/d4/web/i18n/dictionary/daily.ts`

## Core KPI dari definisi D1 · 24 Nov 2026

Permintaan: data KPI D4 tidak lagi dummy, melainkan diambil dari KPI Definition D1, dan D1 bisa mengambil skor Daily KPI dan Performance Review dari D4. Keputusan Delta 24 Nov:
- berlaku mulai periode November 2026;
- jumlah KPI mengikuti D1 asal total bobotnya 100;
- posisi yang belum dipetakan D1 memakai katalog D4 sementara.

- **Katalog dari D1** (`supabase/migrations/20261124130000_d4_kpi_from_d1.sql`, **diterapkan di production 24 Nov 2026** lewat SQL Editor dengan izin PO):
  - Posisi D3 yang dipetakan D1 lewat `d3_d1_position_mappings` memakai `d1_kpi_definitions`. Syaratnya: posisi D1 Active, KPI aktif, dan total bobot 100.
  - Nomor perannya 1000 + digit job code (JP011 → 1011), supaya tidak bentrok dengan peran D4 1–10.
  - Di live 24 Nov ada 8 posisi yang memenuhi: tujuh dengan 5 KPI dan IT dengan 3 KPI. Posisi lain tetap memakai peran katalog D4 V6.
  - View `d4_kpi_catalog_rows` dan `d4_kpi_position_roles` menggabungkan katalog D4 dan D1. Trigger skor dan policy Daily KPI membaca view itu.
  - Trigger juga menyimpan `d1_kpi_id` di setiap baris, sehingga skor tetap tertaut ke KPI D1 walau namanya diubah.
- **Jumlah KPI bebas, bobot tetap 100:** aturan "tepat 5" dihapus di constraint, trigger, server (`kpi-assessments`, `kpi-daily`), repository, fixture, form, Finalize, ringkasan dashboard, dan view MID `20261116120000` (yang juga belum diterapkan). Total scorecard di form baru muncul setelah semua baris terisi dan bobot set-nya 100.
- **Untuk D1:** view `d4_kpi_scores_for_d1` memuat semua kolom `d1_kpi_scores` dengan nama dan tipe yang sama (dicek di live 24 Nov), ditambah kolom D4. Isinya satu baris per KPI untuk setiap Daily KPI (koreksi terbaru per tanggal) dan setiap Performance Review yang completed. Kolomnya ada di API-D4-001 §8.
  - Yang bisa membaca: HR, Manager, Management, pemilik data, dan `service_role`. `anon` tidak punya akses.
- **Sumber KPI terlihat di layar:**
  - Daily KPI menampilkan sumbernya di field Catalog; Performance Review menampilkannya di bawah Position KPI. Isinya `Definisi KPI D1 JP011 · skala 1–100`, `Katalog D4 V6, posisi belum dipetakan D1 · skala 1–100`, atau `KPI Scorecard V5.1 · skala 1–5`, dalam ID dan EN.
  - Teks yang menyebut "lima/5 Core KPI" diganti.
- **Urutan rilis:** aplikasi boleh di-deploy sebelum migrasi. Selama view belum ada (PGRST205), loader katalog kembali membaca tabel, jadi production tidak berubah sampai migrasi diterapkan. Langkah, cek, dan rollback ada di MIGRATION-RUNBOOK-D4, bagian "KPI dari D1".
- **Uji:**
  - Migrasi diuji di Postgres 16 lokal dengan kasus T1–T15. T15 memastikan `id` view D1 unik per baris.
  - Ada 9 tes vitest baru:
    - set 3 KPI diterima dan set 5 baris ditolak di API Performance Review dan Daily KPI;
    - lewat view, Daily KPI HR Manager tersimpan dengan peran 1011 dan Performance Review Tax Manager dengan peran 1007, sedangkan peran D4 lamanya ditolak;
    - peran D1 dan label sumber, posisi yang belum dipetakan, `scorableSet`, serta loader view dan fallback ke tabel.

    Total 648 tes lulus.
  - Preview lokal 24 Nov: Daily KPI Mrs. Maya (HR Manager) menampilkan 5 KPI HR dari D1. Setelah Save, totalnya 84,50, sama dengan hitungan manual. Performance Review Kak Ismi (Billing) menampilkan peran D4 dengan label belum dipetakan. Dicek di lebar desktop 1225 px (ID dan EN) dan di 375 px untuk form Performance Review.
  - Fixture preview mengikuti live: Billing belum dipetakan.
  - TC-D4-002-26 s.d. 29.
- `modules/d4/kpi/catalog.ts`, `modules/d4/server/kpi-catalog/`, `kpi-assessments/`, `kpi-daily/`, `modules/d4/supabase/repository.ts`, `modules/d4/web/data/fixture-source.ts`, `modules/d4/web/features/{kpi,daily,dashboard,performance}/`, kamus i18n, `AppShell.tsx`

## Celah RLS: registrasi belum disetujui dan menilai diri sendiri · 20 Nov 2026

- **Migrasi `20261120120000_d4_rls_approved_and_not_self.sql`, belum diterapkan: perlu izin PO.** Menutup dua aturan yang selama ini hanya dicek API. Akun yang sudah login bisa memanggil PostgREST langsung dengan sesi dari cookie browser.
  - **Identitas D4 hanya dari registrasi yang disetujui.** Hanya baris `b2_register` dengan status APPROVED atau PROVISIONED yang memberi employee id dan role (`d4_current_employee_uuid`, `d4_current_role`). Sebelumnya, baris PENDING dengan posisi POS-HR langsung menjadi HR di D4. Policy INSERT B2 `Izinkan authenticated insert register` (`check (true)`) membuat siapa pun yang login bisa membuat baris itu sendiri. Policy tersebut milik B2 dan perlu ditutup oleh B2.
  - **Tidak boleh menulis catatan HR milik sendiri.** Policy INSERT KPI, performance, competency, development requirement, training, dan riwayat requirement/training sekarang menolak `employee_id` yang sama dengan penulisnya. Aturan ini sama dengan `assertNotSelf` (SR-D4-EMP-23). Daily KPI tetap diisi sendiri dan tidak diubah.
  - **Diuji di Postgres 16 lokal** dengan salinan policy INSERT yang aktif pada 20 Nov (13 kasus). Sebelum migrasi, 12 kasus diterima. Itu termasuk manager menilai KPI sendiri, HR mengevaluasi diri sendiri, dan akun PENDING ber-POS-HR menambah training. Sesudah migrasi, 8 kasus menulis catatan sendiri atau memakai akun PENDING ditolak. Penilaian dan riwayat untuk pegawai lain tetap diterima. Mendaftar sebagai PENDING tetap diterima karena tabel itu milik B2.
  - Pada 20 Nov, semua baris `b2_register` yang dibaca D4 berstatus APPROVED atau PROVISIONED, jadi tidak ada akun aktif yang kehilangan akses.

## Masukan Pak Emanuel di Show N Tell · 17 Nov 2026 (PR #63)

PR #63 menjawab masukan ini pada 20 Nov, tetapi sebelum digabung, PR #65, #68, #69, dan #70 sudah mengerjakan butir yang sama dengan cara lain. Saat PR #63 digabung ke main pada 24 Nov, versi main dipertahankan di semua bagian yang bentrok. Yang baru dari PR #63 hanya popup **Lihat semua N pegawai** di alert dashboard.

- **Filter, bukan tautan, untuk riwayat.** Sudah di PR #65: tautan Show Completed dan Show Cancelled dihapus, dan baris yang selesai dibuka lewat Status di panel Filter.
- **Retraining setelah Passed.** Sudah di PR #65: `retrainingBlockedReason` di `modules/d4/shared/rules.ts` juga dipakai server (`planTrainingCompletion`). Retraining baru bisa dipilih setelah ada penilaian ulang kompetensi sesudah training, dan ditolak bila level sudah memenuhi.
- **Training untuk lebih dari satu orang.** Sudah di PR #65: **Add Training** di Training Tracking (`btn-add-training`) untuk requirement beberapa pegawai, dan **Add Participants** di detail training (`btn-add-participants`). Field "Other participants" dari PR #63 tidak dipakai.
- **Siapa yang butuh training.** Sudah di PR #65 dan #68: alert **Belum punya training** (`alert-requirement-no-training`), dan kotak Need training yang membuka daftar pegawainya (`summary-dev`, `summary-dialog-dev`). Tombol "Lihat siapa saja" dari PR #63 tidak dipakai.
- **Baru dari PR #63: semua nama di balik alert.** Alert yang menyangkut lebih dari tiga pegawai kini punya tombol **Lihat semua N pegawai** (`btn-alert-people-<key>`). Popup-nya (`alert-people`) memuat semua nama, masing-masing dengan **Buka**: daftar sumber alert yang disaring ke pegawai itu (`?q=<nama>`, periode alert tetap terbawa). Tombol **Close** `btn-close-alert-people`. Teksnya ikut toggle ID dan EN. TC-D4-008-23.
- **Total KPI tanpa skala di setiap baris.** Sudah di PR #65: judul kolom **Total KPI (/100)**, baris berskala 1–5 tetap memakai akhiran sendiri.
- **Alasan Period, Evaluation date, dan Evaluator.** Sudah di PR #65: keterangan di bawah ketiga field di form Performance Review.
- **Daily KPI yang lupa diisi lebih dari sehari.** Sudah di PR #65, lalu menjadi kalender Sen–Jum di PR #70 (`daily-missed`, `missed-YYYY-MM-DD`). Tombol `btn-fill-missed-<tanggal>` dari PR #63 tidak dipakai.
- **Bahasa judul dialog konfirmasi.** Sudah lewat toggle bahasa (PR #69 dan #72): judul dan tombol mengikuti bahasa yang dipilih, misalnya "Buang perubahan?" di ID dan "Discard changes?" di EN.

## Daftar di form bulk bisa dicentang · 24 Nov 2026

- Update Progress (Training Tracking) dan Add Training dari Development Requirement sebelumnya hanya menampilkan lima baris pertama lalu "dan N lainnya". Kini semua yang dipilih tampil sebagai checkbox dalam daftar yang bisa digulir, dan semuanya tercentang di awal. Melepas centang mengeluarkan baris itu dari simpanan kali ini tanpa kembali ke tabel; tombol Save mengikuti jumlahnya.
- Baris training memuat tanggal dan status di bawah namanya, karena satu pegawai bisa punya beberapa training dengan nama yang sama.
- Baris yang tidak dicentang tidak disimpan dan tetap terpilih di tabel.
- Testid `bulk-targets` tetap; tiap baris `bulk-target-<id>`. Judulnya "{n} dari {total} training dipilih" / "{n} of {total} trainings selected".
- Dicek di mode pratinjau: Update Progress dengan 1 dari 2 training (hanya Kak Ismi yang berubah jadi In Progress), Add Training 2 dari 3 requirement, ID dan EN, 375 px tanpa scroll horizontal.
- `modules/d4/web/features/training/BulkModals.tsx`, `TrainingPages.tsx`, `modules/d4/web/data/bulk.ts`, `modules/d4/web/i18n/dictionary/shared.ts`

## Kalender Daily KPI mengikuti design system · 24 Nov 2026

- **Kotak kuning hanya berisi pengingat.** Kalender keluar dari kotak itu dan menjadi panel putih bergaris tipis dengan judul bulan, mengikuti komponen Base Calendar di Design System kelas (PISD, node `5277:644`) dan popup DateField di aplikasi. Sebelumnya kotak putih bertumpuk di atas latar kuning.
- **Sel tanpa kotak, seperti Base Calendar.** Tanggal yang belum diisi bertulisan tebal dengan hover biru muda. Tanggal terpilih berupa kotak biru `primary-600` bersudut 8 px. Hari ini ditandai cincin biru (pengganti titik), jadi tetap terlihat saat tanggal lain dipilih. Hari yang sudah diisi tetap redup dengan centang (`text-ink-3`, kontras 4,76:1 di putih).
- **Penanda yang tidak bisa salah baca.** Tiap keadaan punya bentuk sendiri dan dijelaskan di keterangan bawah kalender (`daily-calendar-legend`): titik kuning = belum diisi (warnanya sama dengan kotak pengingat, kontras 5,35:1), centang = sudah diisi, cincin = hari ini, kotak biru = tanggal yang sedang dibuka di form. Kotak biru diberi nama "Dibuka di form" agar tidak terbaca sebagai sudah tersimpan. Pembaca layar mendengar "Rab, 11 Nov, Belum diisi".
- **Sisi kanan tidak kosong lagi** (masukan Kei). Mulai 768 px, field Tanggal, KPI posisi, dan Katalog berada di kanan kalender, jadi tanggal yang diklik langsung terlihat di sebelahnya. Di bawah 768 px urutannya ke bawah.
- Testid tetap: `daily-missed`, `daily-reminder`, `missed-YYYY-MM-DD`, `daily-today`, `input-daily-date`. TC-D4-008-22 diperbarui.
- Dicek di mode pratinjau pada 1225, 768, dan 375 px dalam ID dan EN: memilih 10 dan 12 Nov, hover, menyimpan 10 Nov sampai jadi centang dan jumlah turun dari 16 ke 15, tanpa scroll ke samping.
- `modules/d4/web/features/daily/DailyKpiPages.tsx`

## Kolom Metode menunjukkan bahwa ia punya pilihan · 24 Nov 2026

- Di Add Development Requirement dan Retraining, kolom Metode kosong tampak seperti kotak rusak di samping dropdown PIC. Kini kolom itu menampilkan "Pilih atau ketik metode" (EN "Select or type a method") dan panah dropdown yang berputar saat daftar terbuka. Isian bebas tetap boleh.
- `modules/d4/web/ui/forms.tsx` (`SuggestField` menerima `placeholder`), `DevelopmentModals.tsx`.

## Periode terbuka dan tertutup, tanggal evaluasi tidak bisa mundur · 24 Nov 2026

Review dosen 24 Nov 2026: periode penilaian dibuka dan ditutup, dan tanggal evaluasi yang bisa dimundurkan dianggap celah integritas.

- **Period hanya periode terbuka.** Form Performance Review tidak lagi memakai pemilih bulan bebas (dulu bisa sampai 2024). Pilihannya bulan ini dan bulan lalu, ditambah periode lama yang dibuka kembali HR. Pemanggil yang meminta periode tertutup, misalnya dari filter dashboard, membuka form di bulan ini dengan peringatan.
- **Server ikut menolak.** `POST kpi-assessments` dan `performance-evaluations` menjawab 422 untuk periode tertutup, belum dimulai, atau sebelum September 2026, sebelum aturan revisi. Aturannya satu fungsi, `periodState` di `modules/d4/shared/rules.ts`, dipakai form, server, dan mode pratinjau.
- **Evaluation date = hari penyimpanan.** Field-nya dikunci dan menampilkan hari ini. Server mengabaikan tanggal dari klien dan menyimpan hari ini (WIB). Finalize from Daily KPI juga memakai hari ini, tidak lagi tanggal terakhir periode. Test id `input-evaluation-date` tetap ada.
- **Membuka kembali periode lama:** tabel `d4_period_reopenings` di migrasi `20261124150000` (belum diterapkan, butuh izin PO). Langkah dan SQL-nya ada di MIGRATION-RUNBOOK-D4. Layar HR untuk membuka periode belum dibuat.
- **Dampak:** mulai deploy, September tertutup (18 scorecard tersimpan tetap bisa dilihat). Oktober tertutup pada 1 Desember.
- TC-D4-002-30 s.d. 33. Diuji: unit test aturan (batas bulan, 1 Desember dalam WIB, pergantian tahun, pembukaan aktif dan kedaluwarsa, baris terbaru menang), API, mode pratinjau, dan migrasi di Postgres lokal.

## Cek sebelum simpan di Update Progress massal, dan training untuk semua dari kartu · 24 Nov 2026

Dari rekaman asistensi 21 Nov dan audio 24 Nov 2026.

- **Update Progress massal memberi tahu lebih dulu.** Dulu training yang ditolak (misalnya Meets requirement padahal level D3 belum memenuhi) baru ketahuan setelah Save. Kini form menjalankan aturan yang sama dengan penyimpanan untuk tiap training yang dicentang. Yang akan ditolak diberi alasan di barisnya (`bulk-issue-<id>`), kotak `bulk-issues` menyebut jumlahnya, dan tombol Save hanya menghitung yang lolos. Training In Progress yang dipilih In Progress lagi tidak dihitung ditolak, karena memang dibiarkan.
- Aturannya tidak disalin: `completionContext` di `modules/d4/web/data/completion.ts` dipakai simpan di mode pratinjau dan cek di form. Test `bulk-progress-check` membandingkan hasil cek dengan simpan sungguhan untuk setiap training terbuka di fixture.
- **Kartu Need training: satu tombol untuk semua.** Bila ada dua atau lebih requirement terbuka tanpa training yang boleh ditulis pengguna, dialog kartu menampilkan "Buat training untuk semua (N)". Tombol itu membuka form Add Training massal yang sama dengan Development Requirement, lalu kembali ke daftar dengan jumlah yang tersimpan. Daftarnya dari `needsWithoutTraining` di `dashboard/summary.ts`.
- TC-D4-005-17 dan TC-D4-006-27. Dicek di mode pratinjau: dua requirement baru untuk Desty → tombol "Buat training untuk semua (2)" → Save → "2 training tersimpan"; Update Progress 4 training dengan Passed + Meets requirement → 2 ditandai beserta alasannya dan Save menjadi "Simpan 2 Training".
- `BulkModals.tsx`, `SummaryTiles.tsx`, `summary.ts`, `completion.ts`, `fixture-source.ts`, kamus `shared.ts` dan `dashboard.ts`.

## Logout otomatis saat tidak aktif · 24 Nov 2026

Asistensi 21 Nov 2026: setiap departemen harus logout otomatis bila pengguna terlalu lama AFK, dengan notifikasi, dan waktunya mengikuti WIB/WITA/WIT karena pegawai bisa berpindah pulau.

- **Batas 30 menit, peringatan 1 menit sebelumnya.** Dialog "Sesi akan berakhir" menyebut jam logout dan menghitung mundur. **Tetap masuk** melanjutkan sesi; **Logout sekarang** keluar saat itu juga. Gerakan mouse saat dialog terbuka tidak dihitung, jadi sesi hanya berlanjut lewat tombol.
- **Semua tab dihitung bersama.** Waktu aktivitas terakhir disimpan di `localStorage` (`d4-last-activity`), jadi bekerja di satu tab menjaga tab lain tetap login. Laptop yang bangun dari sleep melewati batas langsung logout.
- **Jam mengikuti zona perangkat**: WIB, WITA, WIT, atau GMT±n di luar Indonesia (`zoneLabel` di `modules/d4/web/data/idle.ts`).
- **Halaman login menjelaskan**: "Anda logout otomatis pukul 14:35 WITA karena tidak aktif selama 30 menit." Pesan hilang setelah login lagi.
- Angka 30 menit dan 60 detik adalah konstanta `IDLE_LIMIT_MS` dan `IDLE_WARNING_MS`, belum dikonfirmasi mas Bram. Berlaku juga di mode pratinjau.
- Tile **Pegawai** di People Dashboard kini memakai panah ke bawah (`summary-total-jump`), karena tile itu melompat ke tabel, bukan membuka daftar seperti tiga tile lain.
- Belum: logout manual seharusnya kembali ke landing page HRMS, tetapi URL landing page belum ada. Untuk sementara tetap ke `/login`.
- TC-D4-SEC-10. Dicek di mode pratinjau dengan jam halaman dimajukan: dialog muncul pada menit 29 dengan "04:44 WIB", Tetap masuk menutupnya, menit 30 membawa ke `/login` dengan pesan, dan pesan hilang setelah login lagi.
- `modules/d4/web/ui/IdleLogout.tsx`, `modules/d4/web/data/idle.ts`, `AppShell.tsx`, `app/login/page.tsx`, `SummaryTiles.tsx`, kamus `shared.ts`.

## Belum selesai

| Item | Alasan | Langkah berikut |
|---|---|---|
| KPI berdasarkan position **pada periode** | Butuh riwayat position per periode dari D3 | Open decision di FR-D4-002 |
| QA di data asli | Mode live butuh akun HR/Manager dan data seed | `npm run seed:d4 -- --apply`, lalu skenario QA di `drafts/planka/03-…` |
| Docmost dan Planka tim | Keputusan: draft dulu | Terapkan isi `drafts/` setelah disetujui PO |
| Sales Admin memakai KPI Sales & Marketing | V5.1 tidak punya role Sales Admin; pemetaan sementara | Keputusan PO (lihat `drafts/docmost/03-…`) |
| Cakupan Manager (O7) | Manager masih melihat semua employee; butuh data atasan dari D3 | Keputusan PO + `supervisor_id` dari D3 |
| Sisa setelah migrasi D4 | Ketujuh migrasi dan katalog V5.1 sudah diterapkan 10 Nov (lihat [MIGRATION-RUNBOOK-D4.md](MIGRATION-RUNBOOK-D4.md), bagian "Status"). Aturan akses sudah diuji di database dan scorecard V5.1 di periode V6 sudah dihapus. Yang belum: login UI dengan akun Director dan Employee | Uji dengan akun dari PO: Director tanpa tombol simpan untuk data orang lain, dan Employee ditolak mengisi tanggal besok |
| Konfirmasi alur Daily KPI | Dibangun dengan asumsi: pegawai isi sendiri, HR memvalidasi rata-rata periode | Konfirmasi klien; bila skor periode harus otomatis tanpa HR, ubah Performance Review |
| Definisi KPI dari D1 | Migrasi `20261124130000` diterapkan 24 Nov. Delapan posisi pegawai kini memakai KPI D1. Field Agent dipetakan tanpa KPI. Billing, General Director, dan Cash Associate belum dipetakan sehingga tetap memakai katalog D4. | D1 memetakan dan melengkapi posisi yang tersisa |
| Volume Daily KPI di snapshot | Snapshot memuat semua entri harian (sekitar 20 per pegawai per bulan) di setiap halaman; cukup untuk sandbox, tetapi tumbuh tanpa batas | Batasi ke periode berjalan + filter periode di API sebelum produksi |
| Alert ke MID, input level kompetensi, Employee ID di `/register` | Milik squad lain (MID, D3, B2) atau kontraknya belum ada | Koordinasi lintas squad |
| Kolom `review_status` (O8) dan unique index per periode/gap (O9) | Butuh migrasi Supabase bersama | Persetujuan PO/Back End |
| HR Associate tanpa KPI | V5.1 tidak mendefinisikan KPI untuk HR Associate | Form menampilkan "Belum tersedia untuk position ini" dan menolak simpan; tunggu KPI dari PO |

## KPI dari D1 aktif di production · 24 Nov 2026

Migrasi `20261124130000_d4_kpi_from_d1.sql` dijalankan di Supabase SQL Editor dalam satu transaksi, dengan izin PO, dan tercatat di `schema_migrations` (`created_by = d4-runbook`). Aplikasi tidak perlu di-deploy ulang karena kode PR #71 sudah membaca view baru begitu view itu ada.

- **Cek sesudah (read-only):**
  - Kelima view ada: `d4_kpi_d1_catalog`, `d4_kpi_d1_position_roles`, `d4_kpi_catalog_rows`, `d4_kpi_position_roles`, `d4_kpi_scores_for_d1`.
  - 20 posisi D1 aktif berbobot 100 masuk katalog (nomor peran 1001–1032).
  - Posisi pegawai yang memakai KPI D1: COM-CS-MGR, COM-SA, DIR-FAT, FAT-ACC-MGR, FAT-TAX-MGR, FAT-TRS-MGR, HCC-HR-MGR (5 KPI) dan IT (3 KPI). DIR-GEN, FAT-BIL-001, dan FAT-TRS-ASC tetap memakai katalog D4 V6.
  - Constraint baru aktif (jumlah baris minimal 1, `role_order > 0`). Data lama utuh: 95 scorecard dan 69 entri Daily KPI.
- **Belum dicek:** isi `d4_kpi_scores_for_d1` (akun baca yang dipakai untuk cek tidak boleh menjalankan `d4_current_role`) dan form di production dengan akun HR.
- **Rollback:** SQL-nya ada di MIGRATION-RUNBOOK-D4, bagian "KPI dari D1", dan sudah diuji di Postgres 16 lokal.


## Layar HR membuka kembali periode · 24 Nov 2026

PO mengizinkan migrasi `20261120120000` dan `20261124150000`. Sampai migrasi itu dijalankan, aturan default tetap berlaku dan tombol ini menjawab "database belum diperbarui".

- **Performance Review → Buka Kembali Periode** (hanya HR): pilih periode lama (Sep 2026 sampai dua bulan lalu), isi Dibuka sampai dan Alasan, lalu Buka kembali. Status tiap periode tampil di pilihan ("tertutup" atau "dibuka sampai …") beserta perubahan terakhir.
- **Tutup sekarang** muncul untuk periode yang sedang dibuka. Tombol ini menambah baris baru dengan tanggal kemarin, karena tabelnya insert-only dan baris terbaru yang berlaku.
- **API:** `POST /api/d4/period-reopenings` `{ period, openUntil, reason }`, HR saja (Manager dan Employee 403). Bulan ini, bulan lalu, periode sebelum Sep 2026, tanggal sebelum awal periode, dan alasan di bawah 5 karakter ditolak 422. `actor_employee_id` diisi database dari akun yang login.
- **Bukti:** `tests/d4/api.test.ts` (POST period-reopenings), `tests/d4/period-state.test.ts`. Dicek di pratinjau lokal: Sep 2026 dibuka sampai 30 Nov lalu muncul di form sebagai "dibuka kembali", Tutup sekarang mengembalikannya ke "tertutup", tampilan ponsel 375 px rapi.

## Logout tanpa konfirmasi · 24 Nov 2026

- Tombol **Logout** di sidebar langsung logout, tanpa dialog "Apakah Anda yakin ingin logout?" (permintaan 24 Nov 2026, menggantikan keputusan 13 Nov). Selama proses, tombol menulis "Sedang logout..." dan tidak bisa ditekan dua kali; bila gagal, tombol kembali menjadi "Logout".
- `data-testid` `logout-confirm`, `btn-logout-confirm`, `btn-logout-cancel`, dan `logout-progress` tidak ada lagi. Skrip Katalon cukup mengklik `btn-logout` lalu menunggu halaman login.

## Simpan massal lebih cepat · 24 Nov 2026

- **Masalah:** Update Progress massal dan "Buat training untuk semua" lambat. Setiap baris dikirim sebagai permintaan sendiri secara berurutan. Di server, setiap baris memuat seluruh data D4 dua kali: sekali untuk memeriksa aturan, sekali lagi untuk menyesuaikan status requirement. Untuk 17 baris itu berarti sekitar 34 kali muat penuh.
- **Perubahan:**
  - Endpoint baru `POST /api/d4/training-records/bulk` memproses semua baris dalam satu permintaan, dengan aturan yang sama per baris. Login dan data dimuat sekali. Data dimuat ulang hanya sebelum baris Completed milik pegawai yang sudah ditulis baris sebelumnya, karena hanya keputusan Completed yang membaca data yang bisa diubah baris sebelumnya.
  - Layar mengirim 10 baris per permintaan, dengan batas waktu 60 detik. Permintaan yang terputus tidak menghentikan server, jadi batas yang terlalu pendek bisa membuat pengguna menyimpan ulang baris yang sebenarnya sudah tersimpan.
  - Penyesuaian status requirement setelah setiap tulis training sekarang hanya membaca 4 tabel training dan requirement, bukan seluruh data. Ini juga mempercepat simpan satu baris.
  - Form "Buat training untuk semua" tertutup begitu tersimpan; daftar diperbarui di belakangnya, sama seperti Update Progress.
- **Peringatan sebelum Save tidak berubah:** Update Progress massal menandai baris yang akan ditolak beserta alasannya sebelum tombol Simpan ditekan. Di "Buat training", baris yang pasti ditolak (requirement Completed, diri sendiri) tidak bisa dipilih.
- **Bukti:**
  - `tests/d4/api.test.ts` (POST /training-records/bulk): satu muat snapshot untuk 3 baris, muat ulang hanya sebelum baris Completed pegawai yang sama, baris ditolak tidak menghentikan baris lain.
  - `tests/d4/bulk-request.test.ts`: 10 baris per permintaan, permintaan yang gagal di tengah.
  - Dicek di pratinjau lokal: peringatan muncul sebelum Save, dan simpan 2 training berhasil.
  - Kecepatan di production belum diukur dengan akun asli.

## Masukan dosen saat presentasi · 24 Nov 2026

- **Tanggal evaluasi bukan input lagi.** Form Performance Review menampilkannya sebagai teks seperti Penilai, karena input nonaktif bisa diaktifkan lewat Inspect. Server tetap menyimpan hari penyimpanan (WIB), apa pun kiriman klien. Test id berganti menjadi `readonly-evaluation-date` (TC-D4-002-32).
- **Pegawai yang sudah dinilai di periode itu tidak ditawarkan** di Tambah Performance Review, supaya tidak terpilih tanpa sengaja. Revisi tetap dibuka dari menu baris pegawai tersebut (TC-D4-002-34).
- **Actual hanya menerima angka.** Minus, huruf, `e` dan titik ditolak saat diketik, di Performance Review dan Daily KPI. Kolom Actual Performance Review kini `type="text"` seperti Daily KPI. Di production tidak ada skor minus yang tersimpan (dicek 24 Nov: 0 dari 495 baris), karena API dan database sudah menolak skor di luar 1–100 (TC-D4-002-35).
- **Skor bulat tanpa ".00".** Total, Terbobot, rata-rata dashboard, dan selisih revisi menampilkan "100" atau "82", bukan "100.00"; skor pecahan tetap dua desimal ("86.25"). Satu helper `scoreText` di `modules/d4/kpi/scale.ts` (TC-D4-002-36).
- **Detail Performance Review menunjukkan versi penilaian.** Baris baru **Version** berisi "First review" atau "Revision N", dan **Recorded** menampilkan tanggal beserta jamnya (TC-D4-002-37).
- **Training Planned tidak bisa bertanggal lampau.** Kalender di Tambah Training (satu dan massal) dan di Retraining menonaktifkan hari sebelum hari ini; API dan mode pratinjau menolak dengan "Tanggal training Planned tidak boleh sebelum hari ini." In Progress dan Completed tetap boleh tanggal lampau (TC-D4-005-18).
- **Training ganda ditolak.** Requirement yang sudah punya training dengan nama dan tanggal sama (tanpa beda huruf besar-kecil, yang Cancelled tidak dihitung) menolak training kedua; di simpan massal baris itu muncul di daftar gagal dengan alasannya (TC-D4-005-19). Data ganda yang sudah ada di production (dicek 24 Nov: satu pegawai punya 9 "Pelatihan rekonsiliasi" 25 Nov di 5 requirement) tidak dihapus otomatis.
- **Tidak diubah, dengan alasan:** tombol Kembali sudah sama di semua halaman detail dan riwayat (`DetailHeader`, `btn-back`); kolom angka selain Actual tidak ada; Daily KPI pada tanggal yang sudah terisi adalah alur koreksi yang memang dirancang (pemberitahuan `daily-already-saved` dan tombol Save correction).
- **Belum dikerjakan, menunggu keputusan:** status workflow ikut toggle EN/ID (bertentangan dengan UI-D4-001 §137 yang sengaja tidak menerjemahkannya) dan logout otomatis saat idle (milik MID).

## Status ikut toggle bahasa · 24 Nov 2026

- **Keputusan Delta 24 Nov:** status dan hasil ikut toggle EN/ID (masukan dosen saat presentasi, poin 9). Ini mengganti aturan UI-D4-001 §6 yang sebelumnya membiarkan status workflow berbahasa Inggris.
- **Yang berubah di mode ID:** badge status di semua list dan detail, pilihan Status/Priority/Result di form dan filter, legenda donut dashboard, dan field Status/Result/Priority di detail. Contoh: Completed → Selesai, Not Evaluated → Belum Dinilai, Not Passed → Tidak Lulus. Daftar lengkap ada di UI-D4-001 §6.
- **Yang tidak berubah:** nilai di database dan API, nilai filter, parameter URL, dan `data-testid`. `statusLabel` tetap mengembalikan kunci bahasa Inggris yang dipakai filter; teks tampilnya diterjemahkan lewat `t()`.
- **Dampak ke Katalon:** bahasa default adalah ID, jadi skrip yang memeriksa teks badge (mis. "Completed") sekarang membaca "Selesai". Skrip yang memakai `data-testid` atau nilai `<option value>` tidak terpengaruh.
- **Bukti:** `tests/d4/i18n.test.ts` (terjemahan status ID dan EN). Dicek di pratinjau lokal mode ID: dashboard, lima halaman list, detail training, dan detail development tidak lagi menampilkan kata status bahasa Inggris.

## Revisi dari grup WA: Logout, toast sukses, profil · 25 Nov 2026

- **Hover Logout terlihat jelas.** Saat hover atau fokus keyboard, tombol terisi `#d9364f` dan teksnya putih (4,57:1). Sebelumnya hanya muncul tint merah 10% yang terlalu tipis (Gebi, 24 Nov). Design System kelas (node `2053:802`) hanya menggambar Logout outline merah tanpa varian hover. `AppShell.tsx`
- **Toast sukses putih.** Latarnya putih dengan garis tipis, ikon centang, dan label SUCCEED/BERHASIL hijau; isi pesan berwarna teks biasa. Dasarnya daftar revisi mas Bram 21 Nov no. 6 dan polling kelas di rekaman 21 Nov ("desain sistemnya warna putih"). Toast hijau dari DS node `6410:132` (16–17 Nov) tidak dipakai lagi; node itu sudah tidak ada di file DS. Toast gagal tetap merah. `layout.tsx`
- **Halaman My Profile (`/profile`).** Dibuka dari avatar di kanan header. Isinya:
  - nama, peran, Employee ID, email akun, posisi, dan departemen, semuanya hanya baca (data diri diubah HR);
  - form ubah password: password saat ini, password baru, konfirmasi.
- **Aturan password baru sama dengan `/register`:** minimal 10 karakter, berisi huruf, angka, dan karakter khusus. Password baru juga harus berbeda dari yang lama, dan konfirmasinya harus sama.
- **Cara mengubahnya di live:** halaman login ulang dengan password saat ini untuk membuktikannya, lalu memanggil `auth.updateUser`. Password saat ini yang salah ditandai di field-nya. Di mode pratinjau tidak ada yang diubah; toast menyebutnya.
- **Tidak dikerjakan:** tombol IT "reset ke password default". D4 tidak punya peran IT, reset butuh service role di server, dan akun auth dipakai semua squad, jadi fitur ini milik HRMS/MID/IT. Pindah database ke Neon + Prisma juga belum (dikecualikan).
- **Test tanggal diperbaiki.** Tanggal Retraining di 3 file test (`api`, `training-completion`, `development-next-step`) adalah 24–27 Nov. Sejak aturan "Planned tidak boleh sebelum hari ini" (PR #86), test itu gagal begitu tanggal tersebut lewat. Tanggalnya kini 15 Jan 2030, begitu juga tanggal Planned 30 Nov dan 1 Des di test simpan massal (`api`, `bulk-progress-check`) yang akan gagal minggu depan.
- **Bukti:**
  - `tests/d4/profile-password.test.ts`.
  - Dicek di pratinjau lokal (1024 px dan 375 px): hover Logout berwarna `rgb(217,54,79)` dengan teks putih; validasi field; toast sukses putih.
  - Jalur live (login ulang + updateUser) belum dicoba dengan akun asli.
