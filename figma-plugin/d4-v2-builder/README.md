# D4 V2 Screen Builder (plugin Figma lokal)

Membangun 34 frame layar D4 V2 berformat D3 (`NN HRMS D4 - <Layar> (<Role>)`, 1440 × 1024) di file **D4 V2** (https://www.figma.com/design/blDVBM6m8VC02A7PvouX4F, tim student), memakai variable **D4 V2 Tokens**, text style `D4/*`, dan komponen di board **00 Foundations & Components**.

Plugin ini dipakai karena kuota panggilan Figma MCP pada plan Starter habis sebelum frame selesai dibuat.

## Menjalankan

1. Buka file PISD – D4 V2 di **Figma desktop** (plugin development tidak bisa diimpor dari browser).
2. Menu **Plugins → Development → Import plugin from manifest…**, pilih `figma-plugin/d4-v2-builder/manifest.json`.
3. **Plugins → Development → D4 V2 Screen Builder**.
4. Tunggu notifikasi `D4 V2: 34 frame dibuat.` Frame disusun per baris fitur di bawah board foundations.

Plugin tidak memakai jaringan (`allowedDomains: ["none"]`). Menjalankan ulang menghapus frame `NN HRMS D4 - …` dan judul `Baris N · …` yang dibuat sebelumnya, lalu membangun ulang; node lain tidak disentuh.

Jika muncul `D4 V2 gagal: Komponen tidak ditemukan …`, plugin dijalankan di file yang salah atau nama komponen di board foundations sudah diubah.

## Isi

| Baris | Frame |
|---|---|
| 1 · Performance Evaluation | 01 List · 02 Menu ⋮ terbuka · 03 Add Evaluation (640) · 04 Validasi · 05 Detail · 06 History · 07 New Evaluation (revisi periode) |
| 2 · KPI Scorecard | 08 List · 09 Form (880) · 10 Validasi bobot 95% · 11 Detail · 12 History |
| 3 · Competency Gap | 13 List · 14 Menu ⋮ terbuka · 15 Detail · 16 History |
| 4 · Development Requirement | 17 List · 18 Add Requirement · 19 Detail · 20 History |
| 5 · Training Tracking | 21 List · 22 Add Training · 23 Update Progress · 24 Detail · 25 History |
| 6 · People Dashboard | 26 Dashboard 1440 · 27 Employee Profile · 28 Dashboard 1280 · 29 Dashboard 768 |
| 7 · System States | 30 Loading · 31 Empty · 32 Error + Retry · 33 No Permission/Not Found · 34 Success Toast |

Prototype: ⋮ baris di 01 → 02, item menu di 02 → 05/06/03, ⋮ di 13 → 14, item menu di 14 → 15/18, ⋮ di 26 → 27, Save di 03 → 34.

Data contoh sama dengan mode preview aplikasi (`modules/d4/*/fixtures.ts` dan `modules/d4/shared/fixtures/`). KPI Finance & Administration memakai bobot 25/25/20/15/15 dan skor 4/4/3/5/4, sehingga total 3.95.
