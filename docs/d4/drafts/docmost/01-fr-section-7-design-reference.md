# Draft · Section "7. Design Reference & UI Requirements" untuk FR-D4-001 s.d. FR-D4-006

**Target:** tambahkan sebagai section terakhir di tiap halaman FR (setelah section Acceptance/Business Rule yang sudah ada).
**Sumber pola:** UI-D4-001 (draft di `docs/d4/UI-D4-001.md`).
**Figma:** file D4 V2 `https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F`, page `D4`. Komponen ada di board `00 Foundations & Components` ([2:2](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=2-2)).

Bagian umum di bawah ditempel di **setiap** FR, lalu diikuti bagian khusus fiturnya.

---

## Bagian umum (tempel di semua FR)

### 7. Design Reference & UI Requirements

Fitur ini mengikuti **UI-D4-001 Interaction & Component Guideline**. Ringkasnya:

- **Detail** selalu dibuka sebagai halaman tersendiri (breadcrumb `HRMS / <Fitur> / Detail` + tombol Back). Tidak ada quick view, popover, atau modal detail.
- **History** selalu halaman tersendiri dengan timeline vertikal (tanggal, judul revisi, status, aktor).
- **Menu ⋮** di tabel langsung berisi 2–4 aksi. Tidak ada panel info sebelum aksi.
- **Form** berupa modal di tengah layar, lebar 640 px (KPI Scorecard 880 px), tinggi maksimal 88% layar, footer `Cancel` · `Save`.
- **State** yang wajib ada: Loading, Empty, Error (dengan Retry), Validation (inline + ringkasan), Success (toast), dan Not Found / No Permission.
- Aksi tulis (tombol `+ Add`, item menu bertanda *) hanya tampil untuk **HR** dan **Manager**. Employee hanya melihat data miliknya sendiri.
- Tidak ada "Edit" yang menimpa data. Perubahan disimpan sebagai revisi atau record baru.

---

## FR-D4-001 · Performance Evaluation

| No | Layar | Route | Node Figma |
|---|---|---|---|
| 01 | Performance Evaluation List (HR/Manager) | `/performance` | [19:4133](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-4133) |
| 02 | List – Action Menu Open | `/performance` | [19:4470](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-4470) |
| 03 | Add Evaluation Modal | modal di `/performance` | [19:4828](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-4828) |
| 04 | Add Evaluation – Validation Error | modal | [19:5253](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-5253) |
| 05 | Evaluation Detail | `/performance/[id]` | [19:5688](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-5688) |
| 06 | Evaluation History | `/performance/history/[employeeId]` | [19:5845](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-5845) |
| 07 | New Evaluation (revisi periode) | modal dari Detail | [19:5982](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=19-5982) |

- Filter: search nama/ID, Position, Period (default periode terbaru), Status (Completed · Not Evaluated; opsi Draft hanya muncul bila masih ada data draft lama).
- Menu ⋮: View Detail · View History · Open KPI Scorecard · Add Evaluation*.
- Form: Employee, Period, Evaluation date, Evaluator, **Hasil evaluasi 1–5** (1 Sangat Kurang · 2 Kurang · 3 Cukup · 4 Baik · 5 Sangat Baik, dipilih evaluator), Catatan evaluasi (wajib), Evidence/reference (opsional). Satu tombol `Save Evaluation`; tidak ada draft, aspek, atau label review karena tidak didefinisikan di FR-D4-001.
- Position dan Department tampil read-only dari data employee.
- Detail menampilkan KPI Scorecard periode yang sama dan Development Requirement yang bersumber dari evaluasi ini (konteks, bukan keputusan otomatis).

## FR-D4-002 · KPI Scorecard

| No | Layar | Route | Node Figma |
|---|---|---|---|
| 08 | KPI Scorecard List | `/kpi` | [20:4114](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=20-4114) |
| 09 | KPI Scorecard Form Modal (880 px) | modal di `/kpi` | [20:4448](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=20-4448) |
| 10 | KPI Form – Validation | modal | [20:4927](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=20-4927) |
| 11 | KPI Scorecard Detail | `/kpi/[id]` | [20:5416](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=20-5416) |
| 12 | KPI Scorecard History | `/kpi/history/[employeeId]` | [20:5670](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=20-5670) |

- Form mengambil **5 KPI sesuai position employee** dari katalog aktif. Field **KPI jabatan** read-only (diturunkan dari position), sehingga KPI role lain tidak bisa dipilih; server juga menolak bila tidak cocok. Satu tombol `Save Scorecard`.
- Kolom: KPI, Bobot (read-only), Target (read-only, tetap 85), Realisasi (teks bebas), Skor (dipilih evaluator; 1–5 untuk katalog V3.1/V5.1, 1–100 untuk V6 mulai periode 2026-11), Skor terbobot (otomatis = bobot × skor), Komentar. Baris total menampilkan Σ bobot = 100% dan total skor.
- Contoh uji: bobot 35/25/15/15/10 dengan skor 4/3/5/4/4 → total **3.90**.
- Total skor V6 diberi kategori: di bawah 80 Under Performance, 80–85 Average Performance, di atas 85 High Performance. Scorecard 1–5 tidak diberi kategori.
- **Tidak ada** label tercapai/tidak tercapai atau konversi realisasi → skor.
- Menu ⋮: View Detail · View History · Open Evaluation · New Scorecard*.

## FR-D4-003 · Competency Gap

| No | Layar | Route | Node Figma |
|---|---|---|---|
| 13 | Competency Gap List | `/competency` | [21:4152](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=21-4152) |
| 14 | List – Action Menu Open | `/competency` | [21:4527](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=21-4527) |
| 15 | Competency Gap Detail | `/competency/[employeeId]` | [21:4918](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=21-4918) |
| 16 | Competency Gap History (termasuk perubahan position) | `/competency/[employeeId]/history` | [21:5136](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=21-5136) |

- Status per requirement: **Terpenuhi** (hijau), **Gap** (merah), **Data Belum Cukup** (abu, nilai database `Bukti Belum Cukup`).
- Skill tanpa evidence = Data Belum Cukup, **bukan** Gap.
- Menu ⋮: View Detail · View History · Create Development Requirement* (hanya bila ada Gap).
- History tetap utuh saat employee pindah position (snapshot per assessment + penanda role change).

## FR-D4-004 · Development Requirement

| No | Layar | Route | Node Figma |
|---|---|---|---|
| 17 | Development Requirement List | `/development` | [22:4152](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=22-4152) |
| 18 | Add Development Requirement Modal | modal di `/development` | [22:4523](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=22-4523) |
| 19 | Development Requirement Detail (blok Source) | `/development/[id]` | [22:4974](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=22-4974) |
| 20 | Development Requirement History | `/development/[id]/history` | [22:5206](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=22-5206) |

- Setiap requirement wajib punya **Source type** (Competency Gap · Role Change · Performance Context) dan **Source reference** yang dapat diklik.
- Tidak dibuat otomatis karena pergantian periode.
- Status: Identified → Planned → In Progress → Completed, disimpan sebagai revisi (Update Status*).
- Menu ⋮: View Detail · View History · Create Training* · Update Status*.

## FR-D4-005 · Training Tracking

| No | Layar | Route | Node Figma |
|---|---|---|---|
| 21 | Training Tracking List | `/training` | [24:4152](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=24-4152) |
| 22 | Add Training Modal (dari requirement) | modal | [24:4513](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=24-4513) |
| 23 | Update Progress Modal | modal | [24:4928](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=24-4928) |
| 24 | Training Detail | `/training/[id]` | [24:5333](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=24-5333) |
| 25 | Training History | `/training/[id]/history` | [24:5542](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=24-5542) |

- Filter: search, Status, **Source requirement**.
- Status: Planned · In Progress · Completed · Cancelled. `Result` wajib saat Completed.
- Training Completed menampilkan catatan bahwa **gap tidak otomatis tertutup**; penutupan gap tetap lewat assessment kompetensi baru.
- Menu ⋮: View Detail · View History · Update Progress* · Open Source Requirement.

## FR-D4-006 · People Dashboard

| No | Layar | Route | Node Figma |
|---|---|---|---|
| 26 | People Dashboard (1440) | `/dashboard` | [25:4116](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=25-4116) |
| 27 | Employee Performance Profile | `/dashboard/employee/[id]` | [25:4500](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=25-4500) |
| 28 | People Dashboard – 1280 | `/dashboard` | [25:4789](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=25-4789) |
| 29 | People Dashboard – 768 | `/dashboard` | [25:5173](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=25-5173) |
| 35 | People Dashboard – Empty State | `/dashboard` | [25:5421](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=25-5421) |
| 36 | Employee Profile – Validation State | `/dashboard/employee/[id]` | [25:5580](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=25-5580) |

- Tidak ada metric card agregat (di luar lingkup #12). Satu baris = satu employee pada satu periode (FR-06.1). Tabel penuh lebar; di 1280 px kolom Position dan Open dev. disembunyikan agar tidak ada kolom yang terjepit, di 768 px sidebar menjadi drawer.
- Filter: search, Position, Period. Tabel employee menampilkan total KPI dan skor performance beserta periodenya, status competency, jumlah development requirement yang belum selesai, dan status training terakhir.
- Profile menampilkan total KPI + 5 Core KPI, ringkasan evaluasi, gap aktif, development requirement, dan training; setiap blok punya tautan **View source** ke halaman asalnya.
- Dashboard adalah **lapisan presentasi**. Tidak ada tabel bisnis sendiri, angka selalu sama dengan halaman sumber, dan tidak ada keputusan HR otomatis.
- Profile punya pemilih periode; bila scorecard periode itu tidak memiliki 5 KPI dengan total bobot 100%, tampil peringatan dan angka tidak dipakai (frame 36).
- Menu ⋮: View Detail · View KPI Scorecard · View Evaluation.

## State sistem (berlaku untuk semua FR)

| No | Layar | Node Figma |
|---|---|---|
| 30 | Loading (skeleton tabel) | [26:4202](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=26-4202) |
| 31 | Empty | [26:4345](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=26-4345) |
| 32 | Error + Retry | [26:4454](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=26-4454) |
| 33 | No Permission / Not Found | [26:4564](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=26-4564) |
| 34 | Success Toast | [26:4654](https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F?node-id=26-4654) |
