# Draft · Label board "Squad D4" (kritik K7)

**Target:** Planka → Project HRMS → board Squad D4 → Labels.

Reviewer meminta pembagian **Front End** dan **Back End** menggantikan label tunggal "WebDev". Nama list "To Do List WebDev" boleh tetap, karena yang dibaca reviewer adalah label di kartu.

## Label yang dibuat

| Label | Warna saran | Dipasang di |
|---|---|---|
| Front End | biru | Kartu implementasi yang menyentuh halaman, komponen, form, state UI |
| Back End | ungu | Kartu yang menyentuh API `/api/d4/*`, validasi server, migrasi, RLS, seeder |
| UI/UX | merah muda | Kartu desain Figma |
| QA | oranye | Kartu di "To Do List QA", "Ticket QA", "Bug Report" |
| PO | abu-abu | Kartu requirement dan finalisasi dokumen |
| P0 | merah | Kartu yang memblokir demo/QA minggu ini |

## Pemasangan per kartu

| Kartu | Label |
|---|---|
| Implementasi Performance Evaluation | Front End · Back End · P0 |
| Implementasi KPI Scorecard | Front End · Back End · P0 |
| Implementasi Competency Gap & Development Requirement | Front End · Back End · P0 |
| Implementasi Training Tracking | Front End · Back End |
| Implementasi People Dashboard | Front End |
| Security / Final (hardening & DoD akhir) | Back End · QA |
| Setup Foundation, Data Model & Integration D4 | Back End |
| Design Performance Evaluation & KPI Scorecard | UI/UX |
| Design Competency Gap & Development Requirement | UI/UX · P0 |
| Design Training | UI/UX |
| Design Dashboard | UI/UX |
| UI Consistency / Handoff | UI/UX · Front End |
| Setup User Flow, IA & UI Component D4 | UI/UX |
| Finalisasi Requirement Phase 1 | PO |

People Dashboard hanya **Front End** karena tidak punya endpoint atau tabel sendiri; ia membaca `/api/d4/snapshot`.

Label "WebDev" lama dilepas dari kartu setelah label baru terpasang. Labelnya sendiri boleh dihapus setelah tidak ada kartu yang memakainya.
