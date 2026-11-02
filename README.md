# Medika Keperawatan — Portal Evaluasi TTS Terminologi Kesehatan

Aplikasi web full-stack berbasis **Next.js 15 (App Router) + React + TypeScript + Tailwind CSS + Supabase** untuk evaluasi pembelajaran **Teka-Teki Silang (TTS) Terminologi Kesehatan** (11 Sistem Organ, 320 Soal Medis).

## Fitur Utama

### 1. Portal Mahasiswa
- **Autentikasi Fleksibel**: Login menggunakan **Email atau NIM** + Password, registrasi mandiri, serta dukungan **Login Google OAuth**.
- **Wajib Identitas Akademik**: Setiap akun mahasiswa wajib melengkapi **Nama Lengkap**, **NIM**, dan **Kelas** sebelum dapat mengakses soal evaluasi.
- **11 Materi TTS Sistem Kesehatan Persis Kurikulum**:
  1. Sistem Pencernaan
  2. Sistem Pernapasan
  3. Sistem Kardiovaskuler
  4. Sistem Perkemihan
  5. Sistem Endokrin
  6. Sistem Muskuloskeletal
  7. Sistem Panca Indera
  8. Sistem Reproduksi Pria
  9. Sistem Reproduksi Wanita
  10. Sistem Saraf
  11. Sistem Imun dan Hematologi
- **Batas 1x Pengumpulan Per Materi**: Setiap kategori sistem kesehatan hanya dapat di-submit **1 kali**. Progres ketikan otomatis tersimpan sebagai draf sebelum dikumpulkan.
- **Modal Konfirmasi Detail Sebelum Kirim**: Menampilkan ringkasan identitas mahasiswa, jumlah soal & kotak terisi vs kosong, daftar nomor soal yang belum lengkap, durasi pengerjaan, dan peringatan penguncian jawaban.
- **Kartu Hasil Evaluasi & Profil Masing-masing**: Rekap nilai tiap materi, predikat mutu akademik, cetak kartu nilai, dan pengaturan profil/password.

### 2. Portal Admin & Dosen Pengampu
- **Kunci Jawaban Khusus Admin**: Mahasiswa tidak pernah memiliki tombol atau akses ke tabel kunci jawaban (`quiz_answer_keys` dilindungi Row Level Security khusus Admin). Admin dapat melihat papan TTS terisi penuh beserta tabel soal & jawaban resmi, serta mencetaknya.
- **Buku Nilai Terkategorisasi Per Kelas**: Pengelompokan nilai mahasiswa otomatis per **Kelas** (`M1` s.d. `M11`), lengkap dengan filter status pengumpulan (*Sudah Mengisi*, *Tuntas 11 Materi*, *Belum Mengisi Sama Sekali*).
- **Inspeksi Detail Jawaban Per Masing-masing Mahasiswa**: Klik nilai atau nama mahasiswa untuk melihat visualisasi papan TTS jawaban mahasiswa (hijau = benar, merah = salah + overlay kunci jawaban) serta rincian jawaban per nomor soal Mendatar & Menurun. Admin juga dapat **mereset pengerjaan** jika diperlukan ujian ulang.
- **Export Laporan Lengkap**:
  - **Excel Buku Nilai (`.xlsx`)**: 4 Sheet (*Buku Nilai Matriks*, *Rekap Per Kelas*, *Riwayat Pengumpulan*, *Daftar Belum Mengisi*).
  - **Excel Detail Jawaban Per Soal (`.xlsx`)**: Ekspor seluruh jawaban mahasiswa per nomor soal dibandingkan kunci jawaban.
  - **CSV (`.csv`)** & **Cetak Laporan Resmi / PDF**.
- **Full CRUD Pengguna & Kelas**:
  - CRUD Akun **Admin/Dosen** dan **Mahasiswa** (Tambah, Edit, Aktif/Nonaktif, Reset Password, Hapus).
  - **Import Massal Mahasiswa Per Kelas** (tempel daftar `NIM;Nama;Email` dari Excel).
  - CRUD **Master Kelas** dengan pembaruan nama kelas otomatis (*cascade*).
- **Pengaturan Visibilitas Nilai**: Dosen dapat mengatur apakah angka skor tampil langsung dan apakah pembahasan benar/salah dibuka setelah seluruh 11 materi selesai, langsung per materi, atau disembunyikan.

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Konfigurasi environment variable tersedia pada `.env.example` (`NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
