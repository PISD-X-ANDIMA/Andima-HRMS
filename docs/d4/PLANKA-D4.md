| Field | Value |
| --- | --- |
| **Document ID** | PM-D4-001 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Board Convention & Evidence Matrix (Planka "Squad D4") |
| **Status** | Diterapkan 30 Sep 2026 |
| **Date** | 30 Sep 2026 |
| **Related** | TEST-PLAN-D4; AUDIT-UX-D4; RN-D4-001; UI-D4-001; API-D4-001 |

Dokumen ini menjadi acuan kerapian board D4. Formatnya mengikuti board D1 dan D3. Isinya: urutan list, format nama kartu, label peran, format deskripsi, serta matriks dua arah **kartu → bukti** dan **dokumen → kartu**. Aturannya satu: setiap kartu punya bukti di dokumen, dan setiap dokumen ditautkan ke kartu.

## 1. Layout list

| Urutan | List | Isi |
|---|---|---|
| 1 | To Do List PO | Pekerjaan PO yang belum dimulai |
| 2 | To Do List WebDev | Pekerjaan Front End / Back End yang belum dimulai |
| 3 | To Do List QA | Test plan, pengujian per phase, skenario TS-D4 |
| 4 | To Do List UI/UX | Desain yang belum dimulai |
| 5 | Doing | Sedang dikerjakan atau terblokir dependency (ditulis di komentar) |
| 6 | Review / Testing | Implementasi/desain selesai, menunggu review PO atau pengujian QA |
| 7 | Done | Semua checklist tercentang dengan bukti |
| 8 | Bug Report | Tiket `[Bug] BUG-D4-xxx` dari hasil test FAIL |

Perubahan dari layout lama: "Doing/Proses" → **Doing**; "Ticket QA" → **Review / Testing** (kartu UC lama dipindah ke To Do List QA); WebDev dipindah ke urutan kedua seperti D1. Tidak ada list atau kartu yang dihapus.

## 2. Format kartu

**Nama:** `[Peran] Judul`. Nilai `[Peran]`:

- `[PO]`
- `[Fullstack]`: Front End + Back End
- `[Front End]`
- `[Back End]`
- `[UI/UX]`
- `[QA]`
- `[Bug]`

Skenario QA lintas fitur: `[QA] TS-D4-00x - Judul`.

**Label (disamakan dengan board D1; D2/D3 memakai pola yang sama: prioritas + peran):**

| Label | Warna | Dipakai pada |
|---|---|---|
| HIGH PRIORITY | berry-red | Fitur MVP FR-D4-001 s.d. 006, kartu PO, desain fitur, pengujian per phase, bug |
| MEDIUM PRIORITY | morning-sky | Security/staging, UI consistency, pengujian integrasi, eksekusi, regression, TS, UC |
| @PO | orange-peel | Kartu PO |
| @WebDev | pirate-gold | Kartu implementasi dan bug |
| @UI/UX | pink-tulip | Kartu desain |
| @QA | summer-sky | Kartu pengujian, TS, UC, bug |
| FRONTEND | antique-blue | Implementasi yang menyentuh halaman |
| BACKEND | pumpkin-orange | Implementasi yang menyentuh API/data |

Setiap kartu memakai satu label prioritas dan satu label peran. Kartu WebDev ditambah FRONTEND dan/atau BACKEND. Kartu bug memakai @QA (pelapor) + @WebDev (perbaikan), seperti tiket bug D3.

Label lama D4 (PO-Must Have, Requirement, Milestone, Phase 1–3, Functional Testing, dan lain-lain; total 36 label) sudah dilepas dari semua kartu, tetapi definisinya belum dihapus dari board. Fase kerja sudah terlihat dari judul kartu, dan jenis pengujian dari checklist.

**Deskripsi (pola D1/D3):**

```
<ringkasan tujuan>
**Source Requirement:** US-D4-00x → FR-D4-00x → TR-D4-001, TR-D4-002
**Scope:** …
**Output:** …
**Dependency/TBD:** …
**Out of Scope:** …
**Evidence:** dokumen / route / Figma / commit
#### PIC
#### Supporting
```

**Komentar progress:** satu komentar per pembaruan. Isinya: status checklist, bukti, blocker, dan langkah berikutnya.

**Aturan centang:** item dicentang hanya bila buktinya bisa dibuka (dokumen, route, frame Figma, commit). Item yang butuh persetujuan orang, data asli, atau staging tetap terbuka.

## 3. Tim (dari "Finalisasi Scope Kerja D4")

| Peran | Nama |
|---|---|
| PO | Gabriella Steny Carla Joyasita |
| Web Developer | Delta Oga Nophen Putra, Christa Annabella Danuwinata, Keizia Christina F Simanungkalit |
| QA | Stella Olivia |
| UI/UX | Belum tercantum di dokumen scope. PIC kartu UI/UX perlu dikonfirmasi PO |

Pembagian PIC per kartu WebDev belum ditetapkan di dokumen. Di kartu, PIC ditulis per peran dan perlu dikonfirmasi tim.

## 4. Matriks kartu → bukti

| Kartu | List | Label | Source Requirement | Evidence |
|---|---|---|---|---|
| [PO] Finalisasi Scope, Requirement & Prioritas MVP D4 | Done | HIGH PRIORITY, @PO | US/FR/TR D4 semua | Docmost "Finalisasi Scope Kerja D4"; RN-D4-001 §2 |
| [PO] Finalisasi Requirement Phase 1 | Doing | HIGH PRIORITY, @PO | US/FR-D4-001, 002 | RN-D4-001 §2, §7; AUDIT §2.6 (O1–O4) |
| [PO] Finalisasi Requirement Phase 2 | To Do PO | HIGH PRIORITY, @PO | US/FR-D4-003, 004 | AUDIT §3 (relasi FR-003↔004); drafts/docmost/02 |
| [PO] Finalisasi Requirement Phase 3 | To Do PO | HIGH PRIORITY, @PO | US/FR-D4-005, 006 | RN-D4-001 §2 |
| [PO] Validasi Dependency, Integration, Security & Cross-Cutting | To Do PO | HIGH PRIORITY, @PO | FR-D4-007, TR-D4-001, 002 | TEST-PLAN §5; API-D4-001 |
| [PO] Review MVP, Acceptance & Final Readiness D4 | To Do PO | HIGH PRIORITY, @PO | Semua | TEST-PLAN §7; RN-D4-001 §7 |
| [Back End] Setup Foundation, Data Model & Integration D4 | Doing | HIGH PRIORITY, @WebDev, BACKEND | FR-D4-007, TR-D4-001 | API-D4-001; `modules/d4/server`; badge *Preview · data fiktif* (`AppShell.tsx`); AUDIT §2.6 |
| [Fullstack] Implementasi Performance Evaluation | Review / Testing | HIGH PRIORITY, @WebDev, FRONTEND, BACKEND | US/FR-D4-001 | Route `/performance*`; API `performance-evaluations`; commit 41d44b8 |
| [Fullstack] Implementasi KPI Scorecard Employee | Doing | HIGH PRIORITY, @WebDev, FRONTEND, BACKEND | US/FR-D4-002 | Route `/kpi*`; API `kpi-assessments`, `kpi-catalog`; blocker O1, O2 |
| [Fullstack] Implementasi Competency Gap & Development Requirement | Review / Testing | HIGH PRIORITY, @WebDev, FRONTEND, BACKEND | US/FR-D4-003, 004 | Route `/competency*`, `/development*`; AUDIT §3 |
| [Fullstack] Implementasi Training Completion Tracking | Review / Testing | HIGH PRIORITY, @WebDev, FRONTEND, BACKEND | US/FR-D4-005 | Route `/training*`; API `training-records` |
| [Front End] Implementasi Dashboard KPI Orang | Review / Testing | HIGH PRIORITY, @WebDev, FRONTEND | US/FR-D4-006 | Route `/dashboard*`; API `snapshot`; commit 49467b5 |
| [Fullstack] Security, Validation, Integration Fix & Final Staging Readiness | Doing | MEDIUM PRIORITY, @WebDev, FRONTEND, BACKEND | TR-D4-001, 002 | `modules/d4/server/_lib/http.ts` (error generik, log `[d4-api]`); UI-D4-001; API-D4-001 §3 |
| [UI/UX] Setup User Flow, IA & UI Component D4 | Review / Testing | HIGH PRIORITY, @UI/UX | Semua FR | Figma frame 00; UI-D4-001 |
| [UI/UX] Design Performance Evaluation & KPI Scorecard | Done | HIGH PRIORITY, @UI/UX | FR-D4-001, 002 | Figma 01–12 (node 19:4133) |
| [UI/UX] Design Competency Gap & Development Requirement | Doing | HIGH PRIORITY, @UI/UX | FR-D4-003, 004 | Figma 13–20 (node 21:4152). Kurang frame validation Development |
| [UI/UX] Design Training Completion Tracking | Doing | HIGH PRIORITY, @UI/UX | FR-D4-005 | Figma 21–25 (node 24:4152). Kurang frame validation Training |
| [UI/UX] Design Dashboard KPI Orang | Done | HIGH PRIORITY, @UI/UX | FR-D4-006 | Figma 26–29, 35, 36 (node 25:4116) |
| [UI/UX] UI Consistency Review, Handoff & Final Design Validation | Doing | MEDIUM PRIORITY, @UI/UX | TR-D4-002 | Figma 00, 30–34 (node 2:2); AUDIT-UX-D4; UI-D4-001 |
| [QA] Penyusunan Test Plan & Requirement Traceability D4 | Doing | HIGH PRIORITY, @QA | Semua | **TEST-PLAN-D4** |
| [QA] Pengujian Phase 1 | To Do QA | HIGH PRIORITY, @QA | FR-D4-001, 002 | TEST-PLAN TC-D4-001, TC-D4-002 |
| [QA] Pengujian Phase 2 | To Do QA | HIGH PRIORITY, @QA | FR-D4-003, 004 | TEST-PLAN TC-D4-003, TC-D4-004 |
| [QA] Pengujian Phase 3 | To Do QA | HIGH PRIORITY, @QA | FR-D4-005, 006 | TEST-PLAN TC-D4-005, TC-D4-006 |
| [QA] Pengujian Integration, Security, Validation & UI Quality | To Do QA | MEDIUM PRIORITY, @QA | FR-D4-007, TR-D4-001, 002 | TEST-PLAN TC-D4-007, SEC, UIQ |
| [QA] Test Execution, Defect Reporting & Retest | To Do QA | MEDIUM PRIORITY, @QA | Semua | TEST-PLAN §3, §4, §7 |
| [QA] Regression Testing & Final QA Evidence | To Do QA | MEDIUM PRIORITY, @QA | Semua | TEST-PLAN §7 |
| [QA] TS-D4-001 - KPI berbeda menurut Position | To Do QA | MEDIUM PRIORITY, @QA | FR-D4-001, 002 | TEST-PLAN §6 TS |
| [QA] TS-D4-002 - Skill Gap dan Role Change | To Do QA | MEDIUM PRIORITY, @QA | FR-D4-003 | TEST-PLAN §6 TS |
| [QA] TS-D4-003 - Gap-Based Training dan Completion | To Do QA | MEDIUM PRIORITY, @QA | FR-D4-004, 005 | TEST-PLAN §6 TS |
| [QA] UC-D4-002 Pelacakan KPI Employee | To Do QA | MEDIUM PRIORITY, @QA | FR-D4-002 | TEST-PLAN §6 UC (BF/E/A → TC RTM) |
| [QA] UC-D4-003 Identifikasi Competency Gap | To Do QA | MEDIUM PRIORITY, @QA | FR-D4-003 | TEST-PLAN §6 UC (BF/E/A → TC RTM) |
| [Bug] BUG-D4-002 - Dashboard Performance & Development Employee | Bug Report | HIGH PRIORITY, @QA, @WebDev, FRONTEND | FR-D4-006 | Dibuat 19 Sep (V1). Perlu retest di V2 |
| [Bug] BUG-D4-003 - Data Competency Gap Tertukar Antar Employee (judul lama: Integrasi Data Employee …) | Bug Report | HIGH PRIORITY, @QA, @WebDev, BACKEND | FR-D4-003, 007 | Dibuat 19 Sep (V1). Perlu retest di V2 |

BUG-D4-001 tidak ada di board, jadi nomor berikutnya adalah BUG-D4-004. Nomor yang hilang tidak dipakai ulang.

## 5. Matriks dokumen → kartu

| Dokumen | Kartu yang ditautkan |
|---|---|
| Docmost "Finalisasi Scope Kerja D4" | [PO] Finalisasi Scope …; semua kartu (Source Requirement) |
| API-D4-001 | [Back End] Setup Foundation; [Fullstack] Security …; semua kartu Implementasi |
| UI-D4-001 | [UI/UX] Setup User Flow; [UI/UX] UI Consistency Review; [Fullstack] Security (pattern konsisten) |
| AUDIT-UX-D4 | [UI/UX] UI Consistency Review; [PO] Finalisasi Requirement Phase 1/2 (O1–O6); [Fullstack] Implementasi Competency Gap & Dev (§3) |
| RN-D4-001 | [PO] Review MVP; [PO] Finalisasi Requirement Phase 1/3; [Fullstack] Security (§8 deployment) |
| TEST-PLAN-D4 | Semua kartu [QA]; [PO] Validasi Dependency (§5); [PO] Review MVP (§7) |
| CHANGELOG-D4-V2 | Semua kartu Implementasi (perubahan V1 → V2) |
| Figma D4 V2 | Semua kartu [UI/UX] |
| PLANKA-D4 (dokumen ini) | Board secara keseluruhan |
