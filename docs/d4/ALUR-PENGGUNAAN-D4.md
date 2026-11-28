| Field | Value |
| --- | --- |
| **Document ID** | FLOW-D4-001 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Panduan alur penggunaan |
| **Status** | Berlaku sejak 13 Nov 2026 (PR #51 sampai #56); bagian 2.2, 2.4, dan 2.5 diperbarui 15 Nov 2026 untuk masukan wawancara 13 Nov |
| **Related** | UI-D4-001 (layar dan tombol); API-D4-001 (aturan server); TEST-PLAN-D4 (kasus uji) |

Panduan ini menjelaskan urutan kerja D4 dari awal sampai akhir: siapa mengisi apa, di layar mana, dan apa yang terjadi otomatis. Prinsipnya satu: **setiap data punya satu tempat untuk ditulis**. Layar lain hanya menampilkan atau mengarahkan ke tempat itu, sehingga tidak ada pekerjaan yang diisi dua kali dan tidak ada dua angka yang bisa saling bertentangan.

## 1. Peran

| Peran | Siapa | Bisa menulis | Halaman awal |
|---|---|---|---|
| HR | Posisi HR | Semua data D4, kecuali penilaian untuk dirinya sendiri | People Dashboard |
| Manager | Posisi `*-MGR` (termasuk HR Manager) | Sama dengan HR | People Dashboard |
| Management | Direktur (`DIR-*`) | Tidak ada. Hanya membaca, termasuk KPI-nya sendiri | People Dashboard |
| Employee | Pegawai lain | Hanya Daily KPI miliknya sendiri | My Performance (profilnya sendiri) |

Penilaian untuk diri sendiri selalu ditolak (Performance Review, Competency Gap, requirement, dan training atas nama sendiri). Yang menilai harus orang lain.

## 2. Alur utama

```
Daily KPI (pegawai, harian)
   └─► Performance Review (HR/Manager, per periode)
          └─► Competency Gap (dihitung dari data kompetensi D3)
                 └─► Development Requirement (HR/Manager)
                        └─► Training Tracking (HR/Manager)  ── satu-satunya penulis progres requirement
                               └─► Meets requirement / Retraining / Close as Met
People Dashboard: ringkasan semua langkah di atas, tanpa data sendiri.
```

### 2.1 Daily KPI: pegawai mengisi skornya sendiri

- **Siapa:** setiap pegawai yang posisinya punya peran KPI, termasuk HR dan Manager. Direktur tidak mengisi Daily KPI.
- **Di mana:** menu **Daily KPI** → form "My KPI today".
- **Isinya:** skor lima Core KPI hari itu. Tanggal boleh hari ini atau mundur di periode berjalan, tidak boleh di masa depan. Koreksi disimpan sebagai entri baru; entri terbaru per tanggal yang dipakai.
- **Form selalu mulai kosong:** saat halaman dibuka, setelah Save, dan saat tanggal dipilih, Score dan Comment kosong, juga untuk hari yang sudah terisi. Untuk hari seperti itu form memberi tahu bahwa menyimpan akan mengoreksi entri hari itu.
- **Koreksi:** tombol **Correct** di tabel entri membuka hari itu di form dengan skor dan komentar tersimpan, skor tersimpan di bawah tiap field, dan total tersimpan dibanding total baru. Semua entri dan koreksi terlihat di halaman **History** (KPI n: lama → baru).
- **Otomatis:** rata-rata periode (Compiled) dihitung dari entri harian. Alert X-24 muncul di dashboard bila Under atau High tiga entri berturut-turut, atau kelima KPI diisi 100.

### 2.2 Performance Review: HR/Manager memfinalkan periode

- **Siapa:** HR atau Manager, untuk pegawai lain.
- **Di mana:** menu **Performance Review** → **Finalize from Daily KPI** (bila sudah ada skor Compiled) atau **Add Performance Review**.
- **Isinya:** Actual per KPI sudah terisi dari Daily KPI; HR meninjau, mengisi Notes dan Reference (wajib), lalu menyimpan. Penilaian kedua untuk periode yang sama disimpan sebagai revisi, dan revisinya hanya sekali per periode (wawancara 13 Nov 2026). Setelah itu form menampilkan peringatan dan Save tidak aktif.
- **Tidak diisi dua kali:** skor harian tidak diketik ulang. Performance Review hanya memvalidasi hasil kompilasi.
- **Revisi:** bila periode itu sudah punya Performance Review, form dibuka dengan nilai tersimpan. Di bawah tiap Actual tampil "Saved: N" atau "lama → baru", dan di bawah total tampil apakah total baru lebih rendah atau lebih tinggi. Centang **Save as revision** ada di akhir form, tepat di atas Save.

### 2.3 Competency Gap: dihitung, bukan diketik

- **Sumber:** level kompetensi pegawai dan syarat posisinya datang dari modul D3. D4 tidak menyimpan level kompetensi.
- **Di mana:** menu **Competency Gap**. Statusnya Met, Gap, atau Insufficient Data.
- **Yang ditulis di D4:** penilaian perubahan posisi (**Assess Position Change**) dan pembuatan requirement dari baris Gap.
- **Bila level berubah:** perbarui di D3. Gap di D4 ikut berubah sendiri.

### 2.4 Development Requirement: mencatat apa yang perlu dikembangkan

- **Siapa:** HR atau Manager.
- **Di mana:** menu **Development Requirement** → **Add Requirement**, atau dari baris Gap di Competency Gap.
- **Isinya:** pegawai, sumber (Competency Gap, perubahan posisi, atau Performance Review), tujuan, prioritas, cara pengembangan, dan **PIC (wajib)**.
- **Yang bisa diubah di sini:** Priority, Method, dan PIC lewat **Edit Requirement**.
- **Yang tidak bisa diubah di sini:** status. Status mengikuti training (lihat 2.5). Tombol "Update Status" sudah dihapus pada 13 Nov 2026.
- **Kolom Next step** menunjukkan langkah berikutnya beserta tombolnya: Create Training, keputusan Retraining atau Meets requirement, atau tautan ke training yang sedang berjalan. Aksi di kolom ini tidak diulang di menu ⋮.
- **Urutan daftar:** High dulu, lalu Medium dan Low; di dalam satu prioritas yang paling baru di-update di atas. Kolom Last updated menunjukkan jam dan siapa yang mengubah; yang dibuat atau diubah dalam 24 jam terakhir diberi label New atau Updated. Requirement yang sudah Completed dan diputuskan tidak tampil sampai Status Completed dipilih di Filter (wawancara 13 Nov 2026; tautan Show Completed dihapus 22 Nov karena masukan PST 2).
- **Banyak requirement sekaligus:** centang beberapa baris (atau select all) → **Add Training** membuat satu training yang sama untuk setiap requirement terpilih.

### 2.5 Training Tracking: satu-satunya penulis progres

- **Membuat training:** dari requirement → **Create Training**, atau dari Training Tracking → **Add Training** untuk beberapa orang sekaligus (centang requirement terbuka mereka). Orang yang mau ikut training yang sama ditambahkan dari detail training → **Add Participants** (hanya untuk Planned atau In Progress). Setiap peserta tetap punya training sendiri yang terikat ke requirement-nya, jadi setiap training selalu punya alasan.
- **Memperbarui progres:** menu **Training Tracking** → **Update Progress**. Dari Development Requirement, tombol **Update progress in Training** langsung membuka training aktifnya. Untuk banyak training sekaligus (misalnya satu angkatan field agent), centang barisnya lalu **Update Progress** di atas tabel: In Progress, atau Completed dengan satu Result dan satu keputusan. Baris yang ditolak aturan satu-barisnya tampil dengan alasannya dan tetap terpilih. Daftar tetap diurutkan per tahap; training yang dibuat atau diubah dalam 24 jam terakhir diberi label New atau Updated, dan kolom Last updated (layar 1400 px ke atas) menunjukkan jam serta siapa yang mengubah.
- **Riwayat training (17 Nov 2026):** training yang sudah tidak butuh tindakan tidak tampil di daftar default, yaitu Completed yang hasilnya sudah diputuskan dan Cancelled. Training Completed yang masih menunggu follow-up atau reassessment tetap tampil. Keterangan di bawah filter menyebut jumlahnya; untuk melihatnya, pilih Status Completed atau Cancelled di Filter; detail dan History training tetap bisa dibuka.
- **Status requirement otomatis:**

| Keadaan training di putaran berjalan | Status requirement |
|---|---|
| Belum ada training | Identified |
| Semua training Planned | Planned |
| Ada yang berjalan atau sudah selesai | In Progress |

- **Menutup (Completed) hanya dengan bukti:**
  - training **Passed** lalu keputusan **Meets requirement** (level kompetensi di D3 harus sudah memenuhi); atau
  - **Close as Met** untuk requirement Competency Gap tanpa training terbuka, bila level sudah memenuhi (misalnya setelah coaching).
- **Belum tertutup:** Passed, lalu penilaian ulang di Competency Gap yang disimpan sesudah hasil Passed masih menunjukkan gap → **Retraining** dari Next step. Saat hasil Passed dicatat, pilihannya hanya Meets requirement atau Decide later (23 Nov 2026; wawancara 14 Okt, part 2, 00:53:31). Not Passed → **Retraining** atau **Other follow-up** dengan catatan. Retraining membuat training ulang (Planned) dan requirement kembali Planned.

### 2.6 People Dashboard: membaca, bukan menulis

- **Isinya:** ringkasan KPI, kategori kinerja, status kompetensi, requirement terbuka, dan training per pegawai untuk **satu periode** (pilihan Period di samping search; tidak ada "All" agar angka tidak mencampur periode).
- **Alert** menautkan ke halaman yang harus dikerjakan, misalnya Development Requirement untuk "Tanpa PIC".
- **Tidak ada data sendiri:** semua angka berasal dari halaman 2.1 sampai 2.5.

## 3. Satu data, satu tempat menulis

| Data | Ditulis di | Hanya ditampilkan di |
|---|---|---|
| Skor KPI harian | Daily KPI | Performance Review (Compiled), People Dashboard |
| Skor KPI periode | Performance Review | People Dashboard, profil pegawai |
| Level kompetensi | Modul D3 | Competency Gap, Development Requirement, Training Tracking |
| Penilaian perubahan posisi | Competency Gap | Profil pegawai |
| Requirement (tujuan, PIC, Method, prioritas) | Development Requirement | Training Tracking, People Dashboard |
| Status requirement | Training Tracking (otomatis) | Development Requirement, People Dashboard |
| Progres dan hasil training | Training Tracking | Development Requirement, People Dashboard |
| Keputusan Meets requirement / Retraining | Training Tracking (Update Progress) | Development Requirement |
| Penutupan tanpa training | Development Requirement (Close as Met) | Training Tracking, People Dashboard |

## 4. Duplikasi yang sudah dihapus

| Sebelumnya | Masalah | Sekarang |
|---|---|---|
| "Update Status" di Development dan "Update Progress" di Training | Progres yang sama ditulis di dua tempat dan bisa bertentangan | Hanya Training Tracking; Development mengarahkan ke sana (13 Nov 2026) |
| Mode simulasi Employee | Tampilan Employee bisa dilihat tanpa login Employee sungguhan | Dihapus; tampilan Employee hanya lewat akun Employee |
| Skor harian diketik ulang di Performance Review | Dua kali input untuk angka yang sama | Actual terisi dari Daily KPI |
| Level kompetensi diisi di D4 | Bertentangan dengan data D3 | Level hanya dari D3 |

Aturan yang sama dijaga di server: API menolak perubahan status requirement manual dan penilaian untuk diri sendiri, keduanya dengan `VALIDATION_FAILED` (422). Migrasi `20261113120000` menahan aturan status di database untuk penulisan di luar aplikasi; migrasi ini sudah diuji tetapi **belum diterapkan** dan menunggu izin PO.

## 5. Yang menyusul

- **Enam posisi tanpa peran KPI** (Sales Executive, Associate Officer, IT, Field Agent, Billing, Tax Associate; 21 pegawai) belum bisa mengisi Daily KPI atau diberi Performance Review sampai PO memetakan perannya.
- **Data lama:** 3 requirement Completed tanpa Meets requirement dan 4 requirement yang statusnya belum sesuai training. Yang 4 ikut tersinkron saat training-nya disimpan lagi.
