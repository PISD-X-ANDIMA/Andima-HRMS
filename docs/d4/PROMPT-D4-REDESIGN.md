# PROMPT — Redesign & Konsolidasi Squad D4 (Performance & Training Development)

> Versi 1 · 29 Sep 2026 · Disusun dari audit Docmost, Planka, Figma PISD, repo Andima-HRMS, dan transkrip asistensi.

---

## 0. Peran & Tujuan

Kamu bertindak sebagai **Lead Product Designer + Frontend/Backend Engineer Squad D4** untuk HRMS PT Andima Transportindo (proyek PISD / I.B.I.S.).

Tujuan akhir: **satu sistem D4 yang konsisten** dari dokumen → desain Figma → kode, sehingga seluruh kritik asistensi 29 Sep 2026 tertutup dan QA minggu depan bisa menilai tanpa temuan "tampilan beda-beda".

Output wajib:
1. **Dokumen** Docmost & Planka D4 dirapikan (daftar perbaikan di §6).
2. **Figma**: di **page `D4` milik squad sendiri** (id `348:2`), tambahkan section baru `D4 V2` berisi Foundations, Component Library, dan seluruh "slide" layar 6 fitur + state dengan **format penomoran seperti D3** (`0X HRMS D4 - <Layar> (<Role>)`, 1440×1024).
3. **Kode**: implementasi D4 yang mengikuti Figma V2 + layer API, di-push ke repo pribadi `KevArslanian/hrms-d4-sandbox`.
4. **Laporan** akhir: checklist penerimaan (§9) dengan bukti (screenshot Figma, screenshot app, link commit).

---

## 1. Sumber Kebenaran (baca dulu, jangan mengarang)

| Sumber | Lokasi | Dipakai untuk |
|---|---|---|
| Scope | Docmost HRMS · `SD-D4-001 Finalisasi Scope Kerja D4` (slug `8C786T3HuD`) | batas fitur, in/out scope, open decision |
| User Story | `US-D4-001…006` (mis. US-D4-006 slug `DGo7DEKRvv`) | acceptance criteria per fitur |
| Functional Req | `FR-D4-001…007` (parent page id `01a0a3ee-2e27-7c77-b268-5eb9c2576a94`) | field, business rule, KPI V5.1 per position (FR-D4-002 slug `LkehEZA51e`) |
| Technical Req | `TR-D4-001`, `TR-D4-002` (slug `0DcYwFv3dv`, TR-11…TR-22) | security, state UI, konsistensi komponen |
| Arsitektur | `TA-D4-001` (slug `FGY5a5tGjO`) | Next.js + Tailwind + Supabase lewat application layer |
| Timeline / Prioritas | `TL-D4-001`, `FP-D4-001` | urutan phase |
| Planka | Project HRMS → board `Squad D4` (id `1864426495020107000`) | checklist per kartu UI/UX, WebDev, QA, PO |
| Figma | file `L5k46NNy2gX6xOq8e1dczQ` (PISD) | page `D2` (id `3:119`) = **referensi gaya**; page `D4` (`348:2`) & `D4 - REVISED A1 STYLE` (`1731:4`) = desain lama D4 (baca, **jangan dihapus**); page `design system` (`0:1`) = pondasi warna/font/button |
| Kode | repo `Andima-HRMS`, folder `modules/d4/**`, `app/{performance,kpi,competency,development,training,dashboard}` | kondisi implementasi sekarang |
| Framework | `node_modules/next/dist/docs/` | **wajib dibaca sebelum menulis kode** (Next.js versi proyek punya breaking changes — lihat AGENTS.md) |

Aturan: kalau suatu informasi tidak ada di sumber, tulis sebagai **Open Decision**, bukan kebijakan perusahaan.

---

## 2. Kritik Asistensi yang Harus Ditutup (acceptance utama)

| # | Kritik reviewer | Akar masalah (bukti) | Solusi wajib |
|---|---|---|---|
| K1 | Pop-up terlalu besar, hampir full screen | `KpiAssessmentForm.tsx:116` `max-w-[1485px]`, `EvaluationForm.tsx:80` `max-w-[1480px]` | Form modal seperti D3 "Add Feedback": center, **640 px** (KPI Scorecard **880 px**), overlay abu 40 %, footer `Cancel` · `Save` kanan bawah |
| K2 | Action ⋮ janggal: klik ⋮ muncul info, baru ada tombol View Detail yang pindah page ("kerja dua kali") | `PerformancePages.tsx:90-99`; Figma `01 Performance & KPI` pakai panel "Employee Quick View" | ⋮ langsung membuka **menu 3–4 opsi**: View Detail · View History · aksi khusus fitur · (Edit). **Hapus quick-view panel** |
| K3 | Detail tiap fitur beda-beda (tengah / popover / pindah page) | Competency modal `max-w-lg`, Training popover anchored 510 px, Performance dropdown→page | **Satu pola detail untuk semua fitur, sama dengan D3**: `View Detail` langsung membuka **Detail Page** (breadcrumb + tombol Back), `View History` membuka **History Page** dengan timeline. Tidak ada popover/quick-view/modal detail |
| K4 | Blank space, dashboard tidak responsif | `PeoplePages.tsx:250` `max-w-[1048px]` | Grid fluid `repeat(auto-fit,minmax(240px,1fr))`, tanpa max-width di konten utama |
| K5 | Font/skala kebesaran di Vercel | ukuran px hardcode | Pakai type scale §4.2; uji 1280, 1440, 1920, 768 |
| K6 | Tidak ada API sendiri, cuma andalkan Supabase sandbox | tidak ada `app/api/**`, UI → `supabase/repository.ts` | Buat layer API per resource (§7.2) + seeder + pemisahan public/internal |
| K7 | Checklist Planka tidak dicentang, label "WebDev" | UI/UX Gap/Training/Dashboard/Handoff = 0 %, DoD belum centang | Sinkronkan checklist dengan kondisi nyata, label **Front End / Back End** |
| K8 | FR-D4-004 digabung di tiket tapi alasannya tidak jelas | tiket "Implementasi Competency Gap & Development Requirement" | Tambah paragraf "Kenapa FR-D4-004 ada di tiket ini" + traceability |
| K9 | Jumlah fitur membingungkan (4 vs 6 vs 7) | sub-menu | Navigasi eksplisit 6 menu (§5.1) + FR-D4-007 dijelaskan sebagai cross-cutting, bukan menu |

---

## 3. Gaya Visual: warna & identitas D2, struktur layar D3, fitur D4

Referensi utama: page `D2` frame `HRMS D - HR` (`1101:3390`), `HRMS D - Applicant` (`1075:22`), `fit & proper` (`1293:1990`), dan page `design system`.

Ciri D2 yang **dipertahankan**:
- Sidebar navy gelap 260 px, brand "ANDIMA / Logistics Suite", item aktif = pill biru solid, sub-menu dengan bullet + background terang, tombol **Logout** outline merah di bawah.
- Topbar putih 64 px: "ANDIMA HRMS | HRMS", search pill, notifikasi dengan badge merah, avatar + nama + role.
- Judul halaman **UPPERCASE Montserrat SemiBold** besar + subjudul abu.
- Surface konten putih radius 16 dengan **glow biru lembut** (shadow biru), badge pill berwarna, tombol primer biru solid.
- Header detail bergradasi biru (seperti `fit & proper`) → dipakai untuk **header Detail Page / Employee Profile**.

Dari **D3** diambil: format frame bernomor, shell sidebar/topbar dengan breadcrumb, modal form center ukuran sedang, Detail Page terpisah, tabel dengan header abu dan kolom Action.

Yang **tidak** ditiru dari D2: kanban horizontal, kartu job lorem "XXX", tinggi input 108 px (terlalu besar), ukuran judul 48 px di layar kerja.

---

## 4. Foundations (buat sebagai Variables + Text Styles di Figma, dan token Tailwind di kode)

### 4.1 Warna (diambil dari D2 & design system)
| Token | Hex | Pakai |
|---|---|---|
| `nav/bg` | `#0F172B` | sidebar |
| `nav/bg-2` | `#1E3765` | hover/sub-surface sidebar |
| `primary/600` | `#155DFC` | tombol primer, item aktif |
| `primary/500` | `#3B6FF5` | link, fokus |
| `primary/700` | `#0550D7` | hover primer |
| `primary/50` | `#F1F3FF` | background terpilih |
| `primary/100` | `#D9E2FC` | border lembut, row hover |
| `bg/app` | `#F8F9FC` | background aplikasi |
| `bg/surface` | `#FFFFFF` | card, table, modal |
| `text/primary` | `#0F172B` | teks utama |
| `text/secondary` | `#45556C` | teks sekunder |
| `text/muted` | `#4D5F81` | metadata |
| `border` | `#D9E2FC` / `#E2E8F0` | divider |
| `status/success` | `#16A37A` | Terpenuhi, Completed |
| `status/warning` | `#B57F0F` | Needs Review, Planned |
| `status/danger` | `#D9364F` | Gap, Error, Cancelled |
| `status/info` | `#3B6FF5` | In Progress |
| `status/teal` | `#069494` | aksi sekunder positif |
| `status/neutral` | `#64748B` | Data Belum Cukup, Not Evaluated |
| `accent/people` | `#C94FEA` | identitas modul People/Human Capital (aksen selektif, bukan status) |

Status **wajib** punya ikon + label, tidak bergantung warna saja (checklist UI/UX Planka).

### 4.2 Tipografi
| Style | Font | Size/LH | Pakai |
|---|---|---|---|
| `display/page-title` | Montserrat SemiBold, UPPERCASE | 28/36 | judul halaman |
| `heading/section` | Montserrat SemiBold | 18/26 | judul card/modal |
| `heading/sub` | Inter Semi Bold | 14/20 | label grup |
| `body/md` | Inter Regular | 14/20 | isi tabel & form |
| `body/sm` | Inter Regular | 12/16 | metadata, helper |
| `label/caps` | Inter Semi Bold UPPERCASE, +4 % tracking | 11/16 | header tabel, label field |
| `badge` | Inter Semi Bold | 11/14 | pill status |
| `number/kpi` | Montserrat SemiBold | 24/32 | angka metrik |

### 4.3 Spacing, radius, elevation
- Grid 8 px. Gutter konten 24 px (desktop), 16 px (≤768).
- Radius: input/button 10, card 16, modal 16, badge 999.
- Shadow `glow/card`: `0 8 24 rgba(21,93,252,0.10)`; `glow/modal`: `0 24 48 rgba(15,23,43,0.20)`.
- Tinggi kontrol: button & input 40 px, table row 56 px, filter bar 64 px.

### 4.4 Frame & breakpoint
- Frame desain utama **1440 × 1024** (sama dengan D2).
- Layar kunci (list + dashboard) juga dibuat varian **1280** dan **768** untuk bukti responsif.

---

## 5. Information Architecture & Pola Interaksi

### 5.1 Navigasi (sidebar → HRMS → Performance & Training)
1. Performance Evaluation (FR-D4-001)
2. KPI Scorecard (FR-D4-002)
3. Competency Gap (FR-D4-003)
4. Development Requirement (FR-D4-004)
5. Training Tracking (FR-D4-005)
6. People Dashboard (FR-D4-006)

FR-D4-007 (keterhubungan data) **bukan menu**: diwujudkan sebagai chip "Source" yang bisa diklik di setiap record + blok Source di Detail Page.

### 5.2 Pola wajib (satu-satunya pola, dipakai semua fitur)
| Pola | Spesifikasi |
|---|---|
| **Page Header** | Judul UPPERCASE + subjudul + tombol primer kanan ("+ Add …") |
| **Filter Bar** | card putih 64 px: search (flex) · dropdown Position · Period · Status · tombol Reset. Filter aktif tampil sebagai chip yang bisa dihapus |
| **Data Table** | header `label/caps`, row 56 px, kolom terakhir **⋮** 40 px, pagination kanan bawah + teks "Showing x–y of z". Klik baris = View Detail |
| **Row Action Menu (⋮)** | popover 200 px, rata kanan tombol, item ikon+label: `View Detail`, `View History`, aksi fitur (lihat 5.3), `Edit` (jika punya izin). Tidak ada panel info di dalam menu |
| **Detail Page** | seperti D3 "Feedback Detail": breadcrumb `HRMS / <Fitur> / Detail`, tombol Back, card header (avatar, nama, ID, position, status badge) + grid field label/value 2 kolom, blok **Source** (link ke record asal, FR-D4-007), tombol aksi kanan atas (Edit, aksi fitur) |
| **History Page** | breadcrumb `… / History`, header employee, timeline vertikal per periode/perubahan (tanggal, actor, perubahan, status), filter periode |
| **Form Modal** | center, 640 px (KPI 880 px), max-h 88vh scroll di body, header judul + close, footer `Cancel` (secondary) · `Save` (primary) rata kanan, field 2 kolom bila pendek. Field wajib bertanda `*`, error inline di bawah field |
| **Confirm Dialog** | 440 px, untuk simpan perubahan status/penghapusan |
| **Toast** | kanan atas, success/error, 4 detik |
| **State View** | Loading (skeleton tabel 6 baris), Empty (ilustrasi + teks + CTA), Error (pesan manusiawi + Retry, tanpa stack trace), No Permission (TR-12/13), Validation (inline + ringkasan di atas form) |

### 5.3 Aksi khusus per fitur di menu ⋮
| Fitur | Item menu |
|---|---|
| Performance Evaluation | View Detail · View History · Open KPI Scorecard · Edit |
| KPI Scorecard | View Detail · View History · Edit Scorecard |
| Competency Gap | View Detail · View History · Create Development Requirement (hanya jika status Gap) |
| Development Requirement | View Detail · View History · Create Training · Edit |
| Training Tracking | View Detail · View History · Update Progress · Edit |
| People Dashboard (tabel employee) | Open Employee Profile · View KPI · View Trainings |

---

## 6. Perbaikan Dokumen (Docmost & Planka)

> **Keputusan user: DRAFT dulu.** Semua perubahan ditulis di `docs/d4/drafts/` (satu file per halaman/kartu, berisi teks siap tempel). Docmost & Planka tim baru diubah setelah PO menyetujui.

### 6.1 Docmost
1. Tambah section **"7. Design Reference & UI Requirements"** di FR-D4-001…006: link node Figma V2, daftar layar, pola dari §5, state yang wajib.
2. Buat halaman baru **`UI-D4-001: Interaction & Component Guideline`** (child dari parent FR D4) berisi §4 + §5 — konkretisasi TR-21.
3. **FR-D4-004**: tambah paragraf relasi dengan FR-D4-003 dan alasan satu tiket implementasi; tetap FR terpisah.
4. **US-D4-006** (dan US lain): ganti link traceability yang mengarah ke Confluence (`rangga-perwiratama.atlassian.net`) menjadi link Docmost FR-D4-006.
5. Isi field **Date** yang kosong (SD-D4-001, FR, TR, TA) dan samakan **Author** di tabel dengan author halaman.
6. Ada **dua halaman "Finalisasi Scope Kerja D4"** (`ZWIfHtYTQg` & `8C786T3HuD`) → tandai satu sebagai *Superseded* + link ke versi final (jangan hapus tanpa izin).
7. Tambah halaman **`API-D4-001: Endpoint Contract`** (§7.2) — reviewer menanyakan dokumentasi Back End di Docmost.
8. Halaman "Test Write Access (boleh dihapus)" → laporkan ke user, jangan dihapus sendiri.

### 6.2 Planka (board Squad D4)
1. Buat label **Front End**, **Back End**, **UI/UX**, **QA**, **PO**, **P0** dan pasang ke kartu terkait.
2. Centang task yang **benar-benar** sudah ada (verifikasi di kode/Figma, bukan asumsi).
3. Kartu UI/UX Gap, Training, Dashboard, Handoff: isi progres sesuai Figma V2; tambahkan komentar berisi link node Figma.
4. Kartu "Implementasi Competency Gap & Development Requirement": perjelas deskripsi FR-D4-004 (K8).
5. Kartu "Design Performance Evaluation & KPI Scorecard" sudah di Done padahal 4 item belum → selesaikan item tersebut atau kembalikan ke Doing.

---

## 7. Implementasi Kode

### 7.1 Frontend (Next.js + Tailwind, folder `modules/d4`)
- Baca dulu `node_modules/next/dist/docs/` untuk App Router & Route Handlers versi proyek.
- Buat komponen bersama di `modules/d4/shared/ui/`: `PageHeader`, `FilterBar`, `DataTable`, `RowActionMenu`, `DetailPage`, `HistoryTimeline`, `FormModal`, `ConfirmDialog`, `StatusBadge`, `StateView`, `Toast`, `SourceChip`, `Pagination`, `MetricCard`.
- Token §4 masuk ke Tailwind theme / CSS variables, **tanpa hex hardcode** di komponen fitur.
- Ganti semua pola lama: quick-view panel Performance, popover Training, modal detail Competency, modal besar KPI/Evaluation, `max-w-[1048px]` People. Detail & History menjadi route: `/<fitur>/[id]` dan `/<fitur>/[id]/history`.
- Aksesibilitas: fokus trap di modal, ESC, `aria-*`, target klik ≥ 40 px, kontras AA.

### 7.2 Backend / API layer
Konvensi yang diminta reviewer ("folder API → folder resource → index.ts") dipetakan ke App Router:
```
app/api/d4/
  evaluations/route.ts          GET list, POST create
  evaluations/[id]/route.ts     GET detail, PATCH update
  evaluations/[id]/history/route.ts
  kpi-scorecards/…              (sama)
  competency-gaps/…
  development-requirements/…
  trainings/…                   + [id]/progress/route.ts
  people-dashboard/route.ts     GET agregasi read-only
modules/d4/server/<resource>/index.ts   ← handler, validasi (zod), permission, audit
modules/d4/server/_lib/                 ← auth guard, error envelope, supabase server client
```
- Response seragam `{ data, meta }` / error `{ error: { code, message } }`, status HTTP benar, tanpa stack trace (TR-17).
- Authorization di server (TR-12/13), audit actor/timestamp/entity/action (TR-14), RLS tetap aktif (TR-16).
- Business rule KPI di server: bobot total 100 %, skor 1–5, skor terbobot = bobot × skor, total = Σ; **tidak ada** konversi otomatis realisasi→skor dan **tidak ada** label achieved.
- `supabase/seed/d4_seed.sql` (atau script `scripts/seed-d4.ts`) untuk data demo, ditandai `is_fixture = true` (TR-22).
- Pemisahan **public** (read agregat dashboard) vs **internal** (create/update HR) di level route + permission.
- Dokumentasikan semua endpoint di `API-D4-001` (§6.1-7).

### 7.3 Repo pribadi
- Target: `github.com/KevArslanian/hrms-d4-sandbox` (private).
- Branch `feature/d4-v2-d2-style`, commit per langkah (foundations → components → per fitur → api → docs), pesan conventional commit.
- Sertakan `docs/d4/` berisi: prompt ini, `UI-D4-001.md`, `API-D4-001.md`, `CHANGELOG-D4-V2.md`, dan screenshot bukti.
- **Jangan commit `.env.local`** atau kredensial apa pun; sediakan `.env.example` tanpa nilai.
- Jangan push ke repo organisasi `PISD-X-ANDIMA/Andima-HRMS` kecuali diminta eksplisit.

---

## 8. Figma — Rencana Build (file `L5k46NNy2gX6xOq8e1dczQ`, page `D4` id `348:2`)

Aturan:
- Tambah **di page `D4` milik squad** (bukan page baru), di area kosong sebelah kanan/bawah frame lama. Frame lama (`Performance & KPI`, `Training Tracking`, `People Dashboard`, dst.) dan page `D4 - REVISED A1 STYLE` **tidak dihapus/diubah**; beri satu label teks "Versi lama — lihat D4 V2".
- Semua layar = instance komponen + auto-layout + variable, bukan shape lepas.
- **Format "slide" mengikuti D3**: frame 1440×1024, nama `NN HRMS D4 - <Layar> (<Role>)`, satu **baris per fitur** (kiri→kanan sesuai alur), judul baris besar di atasnya. Shell (sidebar + topbar) identik dengan D3: sidebar navy 260 px (POS · CRM · HRMS ▾ [6 sub-menu D4] · MID, Logout merah), topbar "ANDIMA HRMS | HRMS / <Fitur>", notifikasi, avatar "HR / Manager".

### Section `D4 V2`
**Baris 0 · Foundations** (frame seperti D3 `button varians`, `form fields`, `status indikator`, `tabel`): warna, tipografi, button, form fields, status badge, tabel + pagination, row action menu, modal, toast, state.

**Baris 1 · Performance Evaluation**
01 List (HR Manager) · 02 List – Action Menu Open · 03 Add Evaluation Modal · 04 Add Evaluation – Validation Error · 05 Evaluation Detail · 06 Evaluation History · 07 Edit Evaluation Modal

**Baris 2 · KPI Scorecard**
08 KPI Scorecard List · 09 KPI Scorecard Form Modal (5 KPI position, bobot read-only, target, realisasi, skor 1–5, skor terbobot auto, total, indikator total bobot 100 %; contoh Finance & Administration total 4.10) · 10 KPI Form – Validation (skor di luar 1–5 / bobot ≠ 100 %) · 11 KPI Scorecard Detail · 12 KPI Scorecard History

**Baris 3 · Competency Gap**
13 Competency Gap List (status Terpenuhi / Gap / Data Belum Cukup) · 14 List – Action Menu Open · 15 Competency Gap Detail (requirement vs capability/evidence, riwayat position) · 16 Competency Gap History

**Baris 4 · Development Requirement**
17 Development Requirement List · 18 Add Development Requirement Modal (prefilled dari Gap, source type + reference) · 19 Development Requirement Detail (blok Source) · 20 Development Requirement History

**Baris 5 · Training Tracking**
21 Training Tracking List · 22 Add Training Modal (dari requirement) · 23 Update Progress Modal · 24 Training Detail · 25 Training History (completed tidak menutup gap)

**Baris 6 · People Dashboard**
26 People Dashboard (metric cards fluid, tabel employee, filter position/period) · 27 Employee Performance Profile (total KPI, 5 KPI, ringkasan evaluasi, gap aktif, dev need, progress training, tiap blok "View source") · 28 People Dashboard – 1280 · 29 People Dashboard – 768

**Baris 7 · System States**
30 Loading · 31 Empty · 32 Error · 33 No Permission · 34 Success Toast

**Prototype**: 01 → ⋮ → 05/06 → 03 → toast; 13 → 18 → 22 → 26/27.

Setelah build: screenshot per baris, cek teks tidak terpotong/overlap, semua instance terhubung komponen.

## 9. Business Rule yang TIDAK boleh dilanggar (desain & kode)
1. KPI **position-specific** (10 position V5.1), tidak ada KPI position lain yang muncul.
2. Tidak ada label **achieved / not achieved / threshold** di mana pun.
3. Tidak ada konversi otomatis realisasi → skor mentah.
4. Ketiadaan evidence = **Data Belum Cukup**, bukan Gap.
5. Training Completed **tidak** menutup gap otomatis.
6. Development requirement selalu punya **source type + source reference**; tidak dibuat otomatis karena periode.
7. Dashboard = presentation layer; angka sama dengan halaman sumber; tidak ada tabel bisnis terpisah.
8. Tidak ada keputusan HR otomatis (mutasi, disiplin, dll).
9. Data demo terpisah dari data sumber.

---

## 10. Checklist Penerimaan (Definition of Done)
- [ ] K1–K9 masing-masing punya bukti (screenshot Figma + app).
- [ ] Semua 6 fitur memakai pola §5.2 yang sama; tidak ada modal > 880 px, tidak ada quick-view panel.
- [ ] Setiap layar punya state loading/empty/error/validation/success yang relevan.
- [ ] Layout lolos di 1280/1440/1920 dan 768 tanpa blank space besar atau scroll horizontal halaman.
- [ ] Figma: 0 layer lepas di layar final (semua instance), variable & text style terpasang, prototype flow jalan.
- [ ] 34 frame bernomor lengkap di page D4, format sama dengan D3.
- [ ] Endpoint API berjalan, validasi server, error envelope, permission, audit.
- [ ] `npm run lint` & build lulus; tidak ada secret di repo.
- [ ] Docmost & Planka diperbarui sesuai §6 (setelah konfirmasi).
- [ ] Laporan akhir berisi link Figma node, link commit, dan daftar open decision.

---

## 11. Urutan Kerja
1. Konfirmasi keputusan terbuka ke user (§12).
2. Figma (page D4): Foundations → Components → baris 1–7 → Prototype (screenshot per baris).
3. Kode: token & komponen bersama → refactor per fitur mengikuti Figma → API layer → seeder → verifikasi di browser.
4. Dokumen: tulis draft perubahan Docmost & Planka di `docs/d4/` repo (belum menyentuh Docmost/Planka tim).
5. Push ke `KevArslanian/hrms-d4-sandbox`, lalu laporan.

## 12. Keputusan yang Sudah Dikonfirmasi (29 Sep 2026)
1. Repo tujuan: `KevArslanian/hrms-d4-sandbox` (kode app D4 + `docs/d4/`).
2. Docmost & Planka: **draft dulu** di repo, belum edit dokumen tim.
3. "Slide": ikut format D3 (frame layar bernomor per fitur), ditambahkan di **page D4** milik squad.
4. Desain lama D4 dibiarkan, hanya diberi label "Versi lama".

---

## 13. Penyesuaian saat eksekusi (29 Sep 2026)

Prompt di atas adalah rencana awal. Bagian berikut mencatat keputusan yang berubah saat dikerjakan, supaya tidak dibaca sebagai kondisi akhir.

| Rencana | Pelaksanaan | Alasan |
|---|---|---|
| Frame V2 ditambahkan di page `D4` file PISD (`L5k46NNy2gX6xOq8e1dczQ`) | Dibangun di file baru **D4 V2** (`blDVBM6m8VC02A7PvouX4F`, tim student; file pertama `bpUIPDcmpjGbYzg0JuZnPH` tidak bisa diakses lagi), page `D4`, lalu disalin ke PISD oleh pemilik edit | Akun hanya punya akses view ke PISD; user memilih "Build di file baru dulu" |
| Nama endpoint `evaluations`, `kpi-scorecards`, `competency-gaps`, `development-requirements`, `trainings` | `performance-evaluations`, `kpi-assessments`, `competency-assessments`, `development-needs`, `training-records` | Mengikuti nama tabel dan endpoint yang sudah ada di branch `feature/D4-api-endpoints`, agar tidak memecah klien lama. Pola folder resource → `index.ts` tetap dipakai |
| PATCH untuk edit | Revisi ditambahkan lewat `POST …/:id/versions` (development, training) atau record baru (evaluasi, KPI, competency) | Skema D4 bersifat append-only; riwayat tidak boleh tertimpa |
| Validasi dengan zod | Validator kecil `field.*` di `modules/d4/server/_lib/http.ts` | Tidak menambah dependensi baru di luar lockfile repo resmi |
| `is_fixture = true` pada data demo | Seeder menandai baris dengan `[seed-d4]` di kolom notes | Skema bersama tidak punya kolom `is_fixture`; menambah kolom butuh migrasi di proyek bersama |
| Migrasi V5.1 dijalankan | File migrasi disertakan, **belum diterapkan** ke Supabase bersama | Perlu izin pemilik proyek. UI menampilkan peringatan bila katalog DB belum V5.1 |
