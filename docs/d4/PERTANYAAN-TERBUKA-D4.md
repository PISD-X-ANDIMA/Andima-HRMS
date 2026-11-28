| Field | Value |
| --- | --- |
| **Document ID** | FLOW-D4-003 |
| **Squad** | D4 – Performance & Training Development |
| **Type** | Daftar pertanyaan terbuka dan anggapan sistem |
| **Status** | Untuk dijawab klien, PO, dan squad lain; dibuat 13 Nov 2026 |
| **Related** | PEMBAHASAN-ALUR-D4 (FLOW-D4-002); ALUR-PENGGUNAAN-D4 (FLOW-D4-001); PROMPT-REVISI-D4-10-NOV-2026 (keputusan K0 sampai K13) |

Setiap baris di bawah adalah hal yang **belum pasti** tetapi sistem sudah berjalan dengan satu anggapan. Kolom "Anggapan sekarang" ditulis dari kode yang berjalan di produksi per 13 Nov 2026 (main `5c38b06`), bukan dari rencana. Kolom "Kalau jawabannya beda" menyebut bagian yang harus diubah, supaya jawabannya bisa langsung ditindaklanjuti.

Cara memakai: tanyakan per kelompok ke pihak yang disebut, tulis jawaban dan tanggalnya di kolom terakhir, lalu catat keputusan di CHANGELOG-D4-V2.

## A. Untuk klien (Mas Bram / HR ANDIMA)

### A1. Peran dan hak akses

| No | Pertanyaan | Anggapan sekarang | Kalau jawabannya beda | Jawaban |
|---|---|---|---|---|
| A1.1 | Apakah direktur mengisi Daily KPI untuk dirinya sendiri? | Tidak. Direktur (posisi `DIR-*`) hanya membaca D4, termasuk KPI-nya. Ini berbeda dari contoh Mas Bram di wawancara 14 Okt 00:33:23 | Buka kembali Daily KPI untuk peran Management (aturan `canFillDaily`, API, dan policy database) | |
| A1.2 | Apakah Manager hanya boleh melihat dan menilai timnya sendiri? | Tidak dibatasi: Manager melihat dan bisa menilai semua pegawai, karena data atasan di D3 baru 3 baris | Butuh data atasan lengkap dari D3, lalu filter per tim di semua halaman | |
| A1.3 | Apakah HR Manager diperlakukan sebagai Manager (bisa menilai pegawai lain)? | Ya. Posisi `*-MGR` menjadi peran Manager | Ubah pemetaan peran di database | |
| A1.4 | Apa saja yang boleh dilihat Employee? | Hanya data miliknya sendiri: My Performance (profil) dan Daily KPI. Tidak bisa menulis selain Daily KPI | Tambah atau kurangi menu Employee | |
| A1.5 | Apakah penilaian harus dilakukan bersama atasan (bukan hanya HR)? | Tidak wajib. Kolom "dinilai bersama" hanya ada di penilaian perubahan posisi dan opsional | Jadikan wajib di form dan API | |
| A1.6 | "Informasi untuk HR staff, HR manager, dan HR director" (B20, 00:59:37) maksudnya apa? | Dibaca sebagai siapa yang melihat, dipenuhi lewat peran. Filter Levels yang dulu dibuat dari tafsiran lain sudah dihapus 13 Nov | Bila maksudnya laporan terpisah per jenjang, perlu kolom level resmi di master posisi D3 | |

### A2. Daily KPI

| No | Pertanyaan | Anggapan sekarang | Kalau jawabannya beda | Jawaban |
|---|---|---|---|---|
| A2.1 | Siapa yang mengisi Daily KPI? | Setiap pegawai yang posisinya punya peran KPI, termasuk HR dan Manager, untuk dirinya sendiri; kecuali direktur | Ubah aturan `canFillDaily` | |
| A2.2 | Skor harian itu nilai diri pegawai, atau nilai dari atasan? | Nilai diri pegawai | Bila dari atasan, alur Daily KPI berubah total | |
| A2.3 | Sampai kapan entri bisa diisi atau dikoreksi? | Hanya untuk tanggal di bulan berjalan dan tidak di masa depan. Begitu bulan berganti, entri bulan lalu tidak bisa diubah, walau HR belum memfinalkan | Buka jendela koreksi bulan lalu (usulan K12: sampai HR finalisasi, paling lama tanggal 5) | |
| A2.4 | Bagaimana skor bulanan dihitung dari entri harian? | Rata-rata per KPI dari hari yang diisi, dibulatkan ke bilangan bulat; hari tanpa entri tidak dihitung | Ubah fungsi `compileDaily` | |
| A2.5 | Berapa minimal hari terisi sebelum rata-rata boleh dipakai? | Tidak ada batas; satu entri sudah menghasilkan skor Compiled | Tambah batas (usulan K11: 50% hari kerja) dan penanda "Data kurang" | |
| A2.6 | Apakah hari libur dan cuti dikecualikan? | D4 tidak punya kalender libur; hari kerja dihitung Senin sampai Jumat hanya untuk keterangan | Butuh kalender libur dan data cuti | |
| A2.7 | Apa yang dilakukan HR pada alert X-24 (Under atau High tiga entri berturut-turut, atau kelima KPI diisi 100)? | Hanya ditampilkan di People Dashboard, tanpa notifikasi ke orang tertentu | Tambah notifikasi atau tugas tindak lanjut | |
| A2.8 | Apakah pengingat Daily KPI perlu jam tertentu atau kanal lain (email, WhatsApp)? | Hanya lonceng di aplikasi, terbuka sekali per hari | Integrasi notifikasi luar | |

### A3. Performance Review

| No | Pertanyaan | Anggapan sekarang | Kalau jawabannya beda | Jawaban |
|---|---|---|---|---|
| A3.1 | Apakah Actual diisi dari rata-rata Daily KPI lalu ditinjau HR, atau HR menilai dari nol? | Diisi dari rata-rata Daily KPI (Compiled), HR meninjau sebelum menyimpan (K9, belum diuji ke HR) | Tampilkan nilai diri terpisah dari isian HR | |
| A3.2 | Skor tepat 85 masuk Average atau High? Skor tepat 80? | 85 masuk Average, 80 masuk Average. Di bawah 80 Under, di atas 85 High | Ubah batas di `performanceBand` | |
| A3.3 | Apakah nama Core KPI boleh diubah penilai di form? | Boleh; bobot dan target tidak bisa diubah | Kunci nama KPI | |
| A3.4 | Siapa yang boleh merevisi Performance Review, dan sampai kapan? | HR atau Manager mana pun (kecuali yang dinilai), tanpa batas waktu; harus mencentang Save as revision | Batasi ke HR atau penilai asli (usulan K8) dan/atau beri batas waktu | |
| A3.5 | Apakah revisi wajib menyertakan alasan? | Tidak; belum ada kolom alasan | Migrasi kolom alasan (K5) | |
| A3.6 | Apa isi Reference yang diharapkan? | Teks bebas wajib (nomor dokumen, tautan, atau lokasi) | Format atau unggah file | |
| A3.7 | Apakah skala 1–5 berlaku sampai Oktober 2026 dan 1–100 mulai November 2026? | Ya: V5.1 untuk periode sampai Okt 2026, V6 mulai Nov 2026 | Ubah tanggal berlaku katalog | |
| A3.8 | Apakah pegawai perlu melihat dan menyetujui hasil Performance Review-nya? | Tidak ada langkah persetujuan pegawai | Tambah langkah acknowledge | |

### A4. Competency Gap, requirement, dan training

| No | Pertanyaan | Anggapan sekarang | Kalau jawabannya beda | Jawaban |
|---|---|---|---|---|
| A4.1 | Bila data level kompetensi kosong, statusnya apa? | Insufficient Data (netral), bukan Gap | Ubah aturan status | |
| A4.2 | Apakah status requirement boleh diubah manual oleh HR? | Tidak. Status mengikuti training; Completed hanya lewat Meets requirement atau Close as Met | Kembalikan ubah status manual (memunculkan lagi dua penulis) | |
| A4.3 | Apakah gap boleh ditutup tanpa training (misalnya coaching)? | Boleh lewat Close as Met, bila level di D3 sudah memenuhi dan tidak ada training terbuka | Hapus jalur ini atau beri syarat lain | |
| A4.4 | Berapa kali Retraining boleh dilakukan? | Tidak dibatasi | Batasi (usulan K10: satu kali, lalu keputusan HR) | |
| A4.5 | Apakah hasil training selain Passed dan Not Passed diperlukan? | Hanya Passed dan Not Passed | Tambah pilihan hasil | |
| A4.6 | PIC requirement itu orang atau unit? | Teks bebas wajib | Pilihan dari daftar pegawai | |
| A4.7 | Apakah requirement dari posisi lama (setelah pindah posisi) tetap diselesaikan? | Tetap terbuka dengan tanda "Not in current position" sampai HR menutupnya | Tutup otomatis saat pindah posisi | |
| A4.8 | Durasi trainee 3 atau 6 bulan berpengaruh ke penilaian? (B9) | Tidak dipakai | Butuh tanggal mulai kerja dan status dari B2/D3 | |
| A4.9 | Apakah promosi otomatis setelah gap tertutup? (A4) | Tidak ada | Butuh riwayat posisi dari D3 | |

### A5. Dashboard dan istilah

| No | Pertanyaan | Anggapan sekarang | Kalau jawabannya beda | Jawaban |
|---|---|---|---|---|
| A5.1 | Apakah dashboard selalu satu periode? | Ya, tanpa pilihan "All"; default periode terbaru yang sudah berjalan | Tambah ringkasan lintas periode | |
| A5.2 | Apakah skor Compiled (belum final) boleh ikut di grafik? | Tidak; hanya Performance Review final | Masukkan Compiled dengan penanda | |
| A5.3 | Apakah nama departemen (Commercial, Customer Success, Finance, Accounting & Tax) sama dengan divisi resmi ANDIMA? | Mengikuti master D3 apa adanya | Penyesuaian di master D3 | |
| A5.4 | Bahasa tampilan: nama dan tombol berbahasa Inggris, kalimat penjelasan berbahasa Indonesia? | Ya (usulan K1) | Seragamkan ke satu bahasa | |

## B. Untuk PO

| No | Pertanyaan | Anggapan sekarang | Kalau jawabannya beda | Jawaban |
|---|---|---|---|---|
| B1 | Boleh terapkan migrasi `20261113120000` (aturan status requirement di database)? | Belum diterapkan; aturan hanya dijaga aplikasi dan API | Terapkan atau tolak | |
| B2 | Peran KPI untuk 6 posisi: Sales Executive, Associate Officer, IT, Field Agent, Billing, Tax Associate (21 pegawai)? | Belum ada; mereka tidak bisa diberi Performance Review atau mengisi Daily KPI | Tambah pemetaan | |
| B3 | HR Manager dipetakan ke peran KPI Finance & Administration karena dokumen V5.1 tidak punya peran HR. Setuju? | Ya | Ubah pemetaan atau minta KPI HR ke klien | |
| B4 | 3 requirement Completed tanpa Meets requirement dan 4 yang statusnya tidak sesuai training: dibiarkan? | Dibiarkan; yang 4 tersinkron saat training disimpan | Perbaiki lewat aplikasi | |
| B5 | K2: centang Save as revision tetap, atau diganti dialog Review changes? | Centang, di akhir form | Bangun dialog Review changes | |
| B6 | Siapa PIC UI/UX, dan bagaimana pembagian kartu Web Dev (Delta, Christa, Keizia)? | Belum ada PIC UI/UX; kartu Web Dev atas nama Delta | Perbarui kartu Planka | |
| B7 | Test Plan (146 TC) disusun Web Dev; siapa dari QA yang mengesahkan dan kapan eksekusi? | Belum disahkan; semua Not Run | Jadwal QA | |

## C. Untuk squad lain

| No | Ke | Pertanyaan | Anggapan sekarang | Jawaban |
|---|---|---|---|---|
| C1 | D1 | Definisi KPI per posisi: pakai versi D1 atau dokumen KPI Scorecard V5.1 dari Mas Bram? | Dokumen Mas Bram (50 KPI, cocok 100% dengan katalog V5.1 dan V6) | |
| C2 | D1 | Daily KPI milik D1 atau D4? (notulen 14 Okt: "KPI harian ada di tim Raka") | D4 membuat dan menyimpan Daily KPI sendiri | |
| C3 | D1 | Standar kompetensi per posisi (`position_requirements`) dikelola D1 seterusnya? | Ya, D4 hanya membaca | |
| C4 | D3 | Bisakah master posisi punya kolom jenjang resmi (Staff, Manager, Director)? | Tidak ada; peran ditebak dari kode posisi (`DIR-*`, `*-MGR`) | |
| C5 | D3 | Kapan data atasan (`d3_employee_reporting`) lengkap? | Baru 3 baris; cakupan tim Manager belum bisa dibuat | |
| C6 | D3 | Siapa yang memperbarui level kompetensi pegawai setelah training atau coaching? | Di D3, oleh pihak yang belum ditetapkan; D4 menunggu angka itu untuk Meets requirement | |
| C7 | D3 | Pegawai dengan status apa yang dihitung aktif? | Mengikuti master D3 apa adanya | |
| C8 | B2 | Apakah setiap pegawai akan punya akun login? | Akun dipetakan ke pegawai lewat email; berapa pegawai yang sudah punya akun belum dicek | |
| C9 | MID | Data apa yang dibutuhkan dari D4, dalam bentuk apa (SQL View, endpoint)? | Belum ada kontrak; belum dibuat | |

## D. Untuk dosen

| No | Pertanyaan | Anggapan sekarang | Jawaban |
|---|---|---|---|
| D1 | R1: revisi dipilih "satu tombol" (View History) dan dihapus dari halaman lain. Sudah sesuai maksud? | Ya | |
| D2 | R3 (kerapian): butir spesifik tidak terekam. Bagian mana yang dianggap kurang rapi? | Belum diketahui | |
| D3 | R4 (filter): bentuk search, Period, dan satu tombol Filter sudah sesuai contoh jamtangan.com? | Ya | |
