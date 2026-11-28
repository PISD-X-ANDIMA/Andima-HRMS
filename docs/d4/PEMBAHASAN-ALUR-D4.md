| Field | Value |
| --- | --- |
| **Document ID** | FLOW-D4-002 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Pembahasan alur dan justifikasi keputusan |
| **Status** | Draf untuk diperiksa tim dan PO, 13 Nov 2026 |
| **Related** | ALUR-PENGGUNAAN-D4 (FLOW-D4-001, cara pakai); CHANGELOG-D4-V2; PROMPT-REVISI-D4-10-NOV-2026 (dasar revisi dosen, di Downloads tim) |

Dokumen ini membahas alur D4 dari awal sampai akhir dan menjawab satu pertanyaan untuk setiap langkah: **kenapa dibuat seperti ini**. Cara pakainya ada di ALUR-PENGGUNAAN-D4. Di sini yang dicatat adalah alasan, sumber alasan itu, dan bagian yang masih lemah.

## 1. Cara membaca justifikasi

Setiap keputusan diberi label sumber. Urutannya dari yang paling kuat:

| Label | Arti | Contoh |
|---|---|---|
| **[Klien]** | Ucapan klien yang terekam, dengan waktu di transkrip | Wawancara 14 Okt 2026, 00:32:52 |
| **[Dokumen klien]** | Dokumen yang diberikan klien | KPI Scorecard V5.1 dari Mas Bram |
| **[Dosen]** | Ucapan dosen PISD pada revisi 10 Nov 2026, kode R1 sampai R4 | R2: nilai sebelumnya harus terlihat |
| **[Keputusan]** | Keputusan PO atau user yang tercatat, dengan tanggal | Keputusan 13 Nov 2026: satu penulis progres |
| **[Standar]** | Pedoman terbit; kode sumber mengikuti daftar referensi PROMPT-REVISI-D4 bagian A5 | [NIELSEN-10], [WCAG22] |
| **[Asumsi]** | Belum ada sumber; dipakai sampai dikonfirmasi | Pemetaan HR Manager ke peran Finance & Administration |

Aturan yang dipakai: sebuah keputusan tidak boleh hanya bersandar pada selera pembuatnya. Bila sumbernya hanya [Asumsi], dokumen ini menyebutnya terang-terangan di bagian 4.

## 2. Prinsip yang mengikat semua langkah

| Prinsip | Isi | Justifikasi |
|---|---|---|
| P1. Satu data, satu tempat menulis | Setiap data hanya bisa ditulis dari satu layar; layar lain menampilkan atau mengarahkan | [Keputusan] 13 Nov 2026 setelah "Update Status" dan "Update Progress" menulis progres yang sama. [Standar] [NNG-CONSIST]: perilaku yang sama untuk hal yang sama. Dua penulis membuat dua jawaban yang bisa bertentangan, sehingga HR tidak tahu mana yang benar |
| P2. Tidak ada yang ditimpa | Semua perubahan disimpan sebagai versi baru; versi lama tetap ada di History | [Klien] FR-01.4 dan FR-02.9 (riwayat tidak ditimpa). [Dosen] R1 meminta revisi diperlakukan sama di semua fitur, tidak dihapus. [Standar] [HIST-GDOCS], [HIST-WIKI]: versi lama selalu bisa dibuka |
| P3. Nilai sebelumnya selalu terlihat saat mengubah | Form koreksi dibuka dengan nilai tersimpan dan menampilkan "lama → baru" | [Dosen] R2: "saya rubah nilai, nilai sebelumnya nilai saya berapa ya", "jangan sampai nilai saya yang baru ini lebih rendah". [Standar] [NNG-STATUS] (status sistem terlihat), [WCAG22] 1.4.1 (arah perubahan ditulis, tidak hanya warna) |
| P4. Orang tidak menilai dirinya sendiri | HR atau Manager tidak bisa membuat Performance Review, penilaian kompetensi, requirement, atau training atas nama sendiri | Pemisahan tugas dalam penilaian. [Standar] [PJ-GREENBERG], [PJ-TAYLOR] (keadilan prosedural penilaian; status [METADATA], teks belum dibaca ulang). Ditegakkan di server (`VALIDATION_FAILED`), tidak hanya disembunyikan di UI |
| P5. Yang tidak perlu tidak ditampilkan | Filter jarang dipakai disimpan di panel; label pratinjau tidak tampil di produksi | [Dosen] R4: "yang nggak perlu memang nggak usah ditampilin", contoh jamtangan.com. [Standar] [NNG-PD] (pengungkapan bertahap), [NNG-MINIMAL] |

## 3. Alur dari awal sampai akhir

### Langkah 0 · Masuk dan peran

**Apa yang terjadi.** Pengguna login lewat halaman bersama B2. Peran D4 ditentukan dari kode posisi: HR, Manager (`*-MGR`), Management (`DIR-*`), atau Employee.

**Kenapa begini.**
- Identitas berasal dari B2 dan D3, tidak dibuat ulang di D4, supaya satu orang punya satu akun di seluruh HRMS. [Keputusan] PR #15 dan #28.
- Management hanya membaca. [Klien] B17: direktur read-only. Ditegakkan di policy database (migrasi `20261108120000`), bukan hanya di tampilan.
- Employee melihat profilnya sendiri sebagai halaman awal, bukan daftar tim yang hanya berisi dirinya. [Keputusan] 13 Nov 2026 (PR #52).
- Logout langsung keluar tanpa dialog konfirmasi, labelnya tetap "Logout". [Keputusan] 24 Nov 2026 (PR #81), menggantikan keputusan 13 Nov yang memakai konfirmasi: logout tidak menghapus data apa pun, jadi cukup login lagi bila tidak sengaja.

### Langkah 1 · Daily KPI

**Apa yang terjadi.** Pegawai mengisi lima Core KPI miliknya sendiri setiap hari. Koreksi disimpan sebagai entri baru untuk tanggal yang sama. Rata-rata periode menjadi skor Compiled.

**Kenapa begini.**
- Pegawai menilai KPI-nya setiap hari sebelum pulang. [Klien] B5, wawancara 14 Okt 00:32:52 sampai 00:33:46. Karena itu ada pengingat dan lonceng notifikasi.
- Lima Core KPI dan bobotnya diambil dari katalog, tidak diketik pegawai. [Dokumen klien] KPI Scorecard V5.1: 10 peran, masing-masing 5 KPI dengan total bobot 100%. Dicek 13 Nov 2026: 50 dari 50 KPI sama persis dengan katalog V5.1 dan V6 di database.
- Skala 1 sampai 100 mulai Nov 2026 (V6). Batas kategori Under (< 80), Average (80 sampai 85), dan High (> 85): [Klien] X-24, wawancara 14 Okt 01:16:41. Target 85 sama dengan definisi KPI D1 (CHANGELOG, 9 Nov 2026), sehingga D1 dan D4 memakai patokan yang sama.
- Angka di atas skala ditolak saat diketik, di API, dan oleh CHECK database. [Standar] [WCAG22] 3.3.4: cegah kesalahan sebelum tersimpan.
- Alert bila Under atau High tiga entri berturut-turut, atau kelima KPI diisi 100. [Klien] X-24, wawancara 14 Okt 01:16:41.
- Direktur tidak mengisi Daily KPI. [Keputusan] 13 Nov 2026. **Catatan:** ini berbeda dengan contoh klien di 00:33:23, di mana seorang direktur menilai KPI-nya sendiri. Keputusan ini perlu dikonfirmasi ke klien (lihat bagian 4).

### Langkah 2 · Performance Review

**Apa yang terjadi.** HR atau Manager memfinalkan skor periode untuk pegawai lain, dari skor Compiled atau dengan mengisi langsung. Notes dan Reference wajib. Penilaian kedua untuk periode yang sama disimpan sebagai revisi.

**Kenapa begini.**
- Skor harian tidak diketik ulang; Actual terisi dari rata-rata Daily KPI dan HR meninjaunya. P1: satu angka, satu tempat menulis.
- Reference wajib, supaya setiap skor punya bukti dokumen. [Klien] Q12, dicatat di CHANGELOG bagian 8 Nov; ditegakkan di API.
- **Revisi (diperbaiki 13 Nov 2026):**
  - Form revisi dibuka dengan nilai yang tersimpan, bukan kosong, sehingga penilai hanya mengubah yang berbeda.
  - Di bawah setiap Actual tampil "Saved: 78", lalu "78 → 80" bila diubah. Di bawah total tampil total tersimpan, total baru, dan "Lower than saved" atau "Higher than saved" beserta selisihnya.
  - Kotak "Save as revision" berada di akhir form, tepat di atas tombol Save.
  - Justifikasi: [Dosen] R2 (lihat P3). Konfirmasi diletakkan di akhir karena penilai baru bisa memutuskan setelah melihat apa yang berubah; konfirmasi di awal meminta persetujuan sebelum ada yang ditinjau. [Standar] [GOVUK-CHECK]: tinjau jawaban tepat sebelum mengirim.
- Revisi tidak menimpa versi lama. P2.
- Revisi hanya sekali per periode. [Klien] wawancara 13 Nov 2026, 0:52:35. Ditegakkan di `rules.ts` (API dan pratinjau); migrasi `20261115120000` menahan aturan yang sama di database, belum diterapkan.

### Langkah 3 · Competency Gap

**Apa yang terjadi.** Status Met, Gap, atau Insufficient Data dihitung dari level kompetensi pegawai dan syarat posisinya. HR menilai perubahan posisi dan membuat requirement dari baris Gap.

**Kenapa begini.**
- Level kompetensi milik D3 dan tidak diketik di D4. P1. Kalau D4 menyimpan level sendiri, dua modul bisa menunjukkan level berbeda untuk orang yang sama.
- Data yang tidak lengkap ditampilkan sebagai Insufficient Data berwarna netral, bukan merah. [Keputusan] UI-D4-001 §6: tidak menyalahkan pegawai atas data yang belum diisi modul lain.
- Requirement dibuat dari baris Gap, sehingga setiap kebutuhan pengembangan punya sumber yang bisa ditelusuri. [Klien] FR-D4-007 (keterhubungan data).

### Langkah 4 · Development Requirement

**Apa yang terjadi.** HR mencatat tujuan, sumber, prioritas, cara pengembangan, dan PIC. Status tidak diubah di sini.

**Kenapa begini.**
- PIC wajib. [Klien] B13, wawancara 14 Okt 01:48:13: PIC "harus ada" agar bisa ditelusuri.
- Tujuan menyebut kompetensi, level tujuan, dan caranya. [Klien] B14, 01:46:09.
- Pilihan cara: Internal training, External training, Certification, Coaching, atau teks lain. [Klien] B12, 01:47:48.
- **Status tidak bisa diubah di sini.** [Keputusan] 13 Nov 2026, P1. Sebelumnya status bisa ditulis dari dua tempat dan bisa bertentangan dengan training. Sekarang API menolak perubahan status manual (`VALIDATION_FAILED`), dan kolom Next step mengarahkan HR ke langkah berikutnya.
- **Satu aksi, satu tempat.** Aksi yang sudah ditawarkan kolom Next step (Create Training pertama, keputusan Retraining atau Meets requirement) tidak diulang di menu ⋮ atau di header detail. [Keputusan] 13 Nov 2026 setelah user menemukan Create Training tampil dua kali di satu baris; sejalan dengan rekomendasi K4 di dokumen revisi. [Standar] [NNG-MINIMAL]: setiap elemen tambahan bersaing dengan elemen yang relevan. Menu ⋮ tetap memuat Create Training untuk training tambahan saat sudah ada training berjalan.

### Langkah 5 · Training Tracking

**Apa yang terjadi.** Training dibuat dari requirement. Progres dan hasilnya dicatat di sini. Status requirement mengikuti training secara otomatis.

**Kenapa begini.**
- Training tidak bisa dibuat tanpa requirement, sehingga setiap training punya alasan. [Klien] FR-D4-005 dan FR-D4-007.
- Status requirement dihitung dari training di putaran berjalan: tanpa training Identified, semua Planned menjadi Planned, selain itu In Progress. Aturan ini satu fungsi (`statusFromTrainings`) yang dipakai API dan preview. P1.
- **Completed hanya dengan bukti:** training Passed lalu keputusan Meets requirement, dengan level di D3 yang sudah memenuhi. Training yang selesai belum tentu menutup gap, jadi lulus training tidak otomatis menutup requirement. [Klien] transkrip 00:25:28, dicatat di OBJECTIVE-COMPETENCY-GAP ("Tidak otomatis"); diuji oleh TC-D4-005-15.
- Not Passed: Retraining (training ulang, status kembali Planned) atau Other follow-up dengan catatan.
- Passed: Retraining baru bisa dipilih di langkah reassessment, bila penilaian kompetensi yang disimpan sesudah hasil Passed masih menunjukkan gap. Level sebelum training tidak dipakai sebagai bukti. [Klien] transkrip 14 Okt part 2, 00:51:27 dan 00:53:31.

### Langkah 6 · Close as Met

**Apa yang terjadi.** Requirement dari Competency Gap ditutup tanpa training bila level di D3 sudah memenuhi dan tidak ada training terbuka.

**Kenapa begini.** Tidak semua gap ditutup lewat training; coaching atau pembaruan data di D3 juga menutupnya. Tanpa jalan ini, requirement seperti itu terbuka selamanya atau ditutup dengan training palsu. Bukti dihitung ulang di server, jadi tombol ini tidak bisa menutup requirement yang levelnya belum memenuhi. [Keputusan] 13 Nov 2026.

### Langkah 7 · People Dashboard

**Apa yang terjadi.** Ringkasan semua langkah di atas untuk satu periode, beserta alert yang menautkan ke halaman yang harus dikerjakan.

**Kenapa begini.**
- Dashboard tidak punya data sendiri. P1. Semua angka dihitung dari baris tabel yang sedang tampil.
- Satu periode, tanpa pilihan "All". [Keputusan] 13 Nov 2026. Menggabungkan periode membuat angka seperti "Performance review complete" mencampur Oktober milik satu pegawai dengan November milik pegawai lain.
- Informasi untuk HR staff, HR manager, dan HR director. [Klien] B20, 00:59:37. Dibaca sebagai **siapa yang melihat**, dan dipenuhi lewat peran HR, Manager, dan Management. Filter Levels yang sempat dibuat dari tafsiran lain (pegawai disaring per level yang ditebak dari kode posisi) dihapus pada 13 Nov 2026 (PR #56), karena dasarnya hanya asumsi dan Positions sudah mencakupnya. [Keputusan]

### Langkah 8 · History

**Apa yang terjadi.** Setiap fitur punya halaman History lewat menu ⋮ "View History". Versi lama tidak ditampilkan di halaman lain.

**Kenapa begini.** [Dosen] R1 menawarkan dua pilihan yang konsisten: tidak ada revisi sama sekali, atau revisi disembunyikan dalam satu tombol dan baru terlihat bila diklik. Pilihan pertama melanggar P2, jadi dipilih satu tombol. Penanda "Revision n", "Revisions", dan "Version" di halaman detail dihapus pada 13 Nov 2026 agar tidak ada cara kedua melihat revisi.

### Langkah 9 · Filter

**Apa yang terjadi.** Satu baris berisi search, tombol Period, dan tombol Filter. Dropdown lain berada di panel dengan label di atasnya; jumlah filter aktif tampil di tombol Filter.

**Kenapa begini.**
- [Dosen] R4 dan P5: yang tidak perlu disimpan di tempat lain, hasil tidak tertutup.
- Period tetap di baris karena menentukan isi halaman dan paling sering diganti. [Keputusan] 13 Nov 2026 (opsi A dari lima opsi yang ditunjukkan ke user).
- Reset ada di dalam panel, tidak di samping tombol Filter. Diuji di browser 13 Nov: bila Reset muncul di samping tombol, tombol Filter bergeser dan klik untuk menutup panel mengenai Reset.

## 4. Alur yang melibatkan squad lain

Dibaca dari tabel yang dipakai kode D4 (`modules/d4/supabase/repository.ts`) dan catatan di CHANGELOG, 13 Nov 2026. D4 tidak menulis ke tabel squad lain; semuanya hanya dibaca.

| Squad | Yang D4 pakai | Dipakai di langkah | Status |
|---|---|---|---|
| B2 | Login dan register bersama; identitas pengguna dan pemetaan akun ke pegawai (`d4_employee`, berdasarkan email) | 0 | Berjalan |
| D3 | Master pegawai, posisi (`d3_positions`), departemen (`d3_departments`), daftar kompetensi (`d3_competencies`), level kompetensi pegawai (`d4_employee_skills`), dan `employee_kpi` | 0, 3, 5, 6, 7 | Berjalan. Level kompetensi hanya bisa diubah di D3 |
| D1 | Standar kompetensi per posisi (`position_requirements`, tabel milik D3 yang kini dikelola D1); definisi KPI per posisi (`d1_kpi_definitions`) | 3; 1 dan 2 | Berjalan. Sejak 23 Nov 2026 (PR #71) D4 membaca KPI dari D1, bukan katalog sendiri. Pembagiannya: D1 menentukan KPI, bobot, dan target 85; D4 tempat pegawai mengisi Daily KPI dan HR/Manager memfinalkan skor periode. Arah sebaliknya, D1 membaca skor D4 lewat view `d4_kpi_scores_for_d1` untuk laporan gap KPI (FR-D1-003). Posisi tanpa pemetaan atau tanpa KPI di D1 belum bisa mengisi Daily KPI (data 24 Nov: lihat TEST-ACCOUNTS-D4 bagian 2a) |
| MID | Alert dan ringkasan untuk MID (B19) | 7 | Belum dibuat. Butuh kontrak data dari MID; arahan terbaru di grup (query agregasi lewat SQL View di database bersama) belum dikerjakan D4 |
| D2 | Pegawai baru hasil rekrutmen | 0 | Tidak langsung: pegawai baru masuk ke D4 lewat master D3 |

## 5. Bagian yang belum kuat

Bagian ini sengaja dipisah supaya pemeriksa tahu mana yang belum boleh diklaim selesai.

| No | Hal | Kenapa lemah | Yang dibutuhkan |
|---|---|---|---|
| 1 | Direktur tidak mengisi Daily KPI | Bertentangan dengan contoh klien 00:33:23 | Konfirmasi klien lewat PO |
| 2 | HR Manager dipetakan ke peran Finance & Administration | Dokumen V5.1 tidak punya peran HR | Keputusan PO |
| 3 | Enam posisi tanpa peran KPI (21 pegawai) | Tidak ada di dokumen V5.1 | Pemetaan dari PO |
| 4 | Actual Performance Review baru diisi dari rata-rata Daily KPI | Belum diuji pada HR sungguhan; bisa mendorong HR menyetujui nilai diri tanpa menilai (K9 di dokumen revisi) | Uji dengan HR, atau keputusan PO |
| 5 | Aturan status di database | Migrasi `20261113120000` sudah diuji di Postgres 16 lokal tetapi belum diterapkan | Izin PO |
| 6 | Eksekusi QA | 145 test case di TEST-PLAN masih Not Run; yang lulus adalah test otomatis Web Dev | Eksekusi oleh QA |
| 7 | Revisi dosen R2: dialog Review changes | Halaman History Daily KPI (R1) dan tombol Correct (R2) sudah ada sejak PR #55. Dialog Review changes terpisah tidak dibuat: nilai tersimpan dan total lama dibanding total baru tampil langsung di form, di Daily KPI dan Performance Review | Konfirmasi ke dosen bahwa perbandingan di form sudah memenuhi R2 |
| 8 | Alasan koreksi | Tidak ada kolom untuk menyimpan kenapa sebuah revisi dibuat (K5) | Migrasi dengan izin PO |
