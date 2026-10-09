# Impor Casadella Studio (Expo) dari GitHub

Aplikasi internal Casadella Photo Studio yang mengurus booking, jadwal, kasir (POS), absensi, penggajian, dan laporan dalam satu aplikasi mobile.
Repo `mraries168/Casadella-Studio-2` (branch main) diimpor apa adanya dan dipastikan semua fitur berjalan lagi, tanpa fitur baru.

## Untuk siapa
- **Super Admin (pemilik):** mengatur hak akses, pengaturan sistem, staff, penggajian, dan melihat riwayat perubahan.
- **Admin 1 & 2:** mengelola booking, pembayaran, paket, kasir, dan laporan.
- **Staff (fotografer/editor):** melihat jadwal dan melakukan absensi, tanpa bisa mengubah data.
- **Klien:** hanya memakai link booking online.

## Fitur dan pengalaman (dari repo, semua dipertahankan)
- Login dengan PIN: pilih nama, lalu masukkan PIN. Tampilan menyesuaikan peran.
- Jadwal dan booking: slot 09:00–20:00 per 15 menit, menyesuaikan durasi paket, dan jadwal tidak bisa bentrok. Admin bisa menugaskan fotografer/editor, mengubah booking, atau membatalkannya.
- Pembayaran DP dan pelunasan (tunai, transfer, kartu, QRIS) hanya dicatat, lalu otomatis masuk ke pemasukan kasir.
- Kasir: catat pemasukan/pengeluaran dengan foto struk, sewa otomatis setiap tanggal 1, laporan harian/bulanan/tahunan (omzet, pengeluaran, laba bersih), ekspor ke PDF/Excel, dan daftar paket terlaris.
- Absensi masuk/pulang hanya dalam radius 100 m dari studio. Ada rekap bulanan keterlambatan dan lembur.
- Penggajian bisa diedit (hari kerja, uang makan, lembur, bonus, kasbon, denda). Slip gaji dibuat dalam PDF dan dikirim lewat WhatsApp.
- WhatsApp: konfirmasi booking, kuitansi, pengingat sesi besok, dan invoice ke admin. Semuanya dibuka di WhatsApp, lalu admin menekan kirim sendiri.
- Database klien yang diambil dari data booking, bisa diekspor.
- Link booking online untuk klien. Booking masuk sebagai "Menunggu Konfirmasi", lalu admin menyetujui atau menolaknya.
- Riwayat Perubahan, khusus Super Admin.
- Hak akses per pengguna dan pengaturan sistem (jam buka, jam kerja, lembur, sewa, lokasi studio, nomor admin, PIN).

## Alur pengguna
1. Buka aplikasi, pilih nama, lalu masukkan PIN.
2. Beranda menampilkan ringkasan hari ini, booking yang menunggu konfirmasi, pengingat sesi besok, dan pintasan untuk mencatat pengeluaran.
3. Tab Jadwal: buat atau ubah booking, lalu catat DP atau pelunasan. Setelah itu WhatsApp terbuka dengan invoice.
4. Tab Kasir (khusus admin): transaksi, laporan, dan ekspor.
5. Tab Lainnya: absensi, paket, klien, staff, hak akses, penggajian, link booking, riwayat perubahan, dan pengaturan.

## Tampilan
Tampilan dan nuansa mengikuti repo: biru-putih dengan logo Casadella, Bahasa Indonesia, mata uang IDR. Pedoman desain dari repo dipakai tanpa perubahan.

## Tahapan
- **Tahap 1 (dikerjakan sekarang):** impor repo, lengkapi pengaturan server yang tidak ikut tersimpan di repo, pasang library yang belum ada, jalankan di preview Expo, lalu uji semua alur utama dan perbaiki yang rusak akibat impor.
- **Tahap 2 (nanti, perlu persetujuan):** pembayaran DP online di halaman booking, dan pengiriman WhatsApp otomatis tanpa menekan kirim.
- **Tahap 3 (nanti, perlu persetujuan):** pilihan Bahasa Inggris, dan galeri hasil foto untuk klien.

## Asumsi
- Aplikasi tetap aplikasi mobile Expo. Bisa dicoba lewat Expo Go dan dibuat versi iOS/Android setelah Publish.
- PIN Super Admin 123456. PIN lain mengikuti data contoh di repo: Admin 1 111111, Admin 2 222222, Rina 333333, Budi 444444.
- Data dimulai dari kosong. Booking dan transaksi dari environment lama tidak ikut terbawa. Yang tersedia hanya akun dan paket contoh.
- ID aplikasi untuk build memakai ID milik project ini, bukan ID dari repo lama.
- Pengaturan bawaan dari repo tetap dipakai: koordinat studio (-10.158988, 123.605584), radius 100 m, sewa Rp 2.500.000, dan nomor WhatsApp admin 6287786098669.
- Foto struk disimpan di Emergent Object Storage seperti di repo.
- Link booking online dan fitur yang butuh perangkat asli (GPS, kamera) baru bisa dites penuh setelah aplikasi di-deploy dan dipasang di HP.
- Tidak ada fitur baru dan tidak ada perubahan tampilan. Yang diperbaiki hanya hal yang rusak karena impor.
