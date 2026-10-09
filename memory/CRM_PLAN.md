# Rencana Implementasi — AI WhatsApp CRM, Casadella Photo Studio
Status: RENCANA SAJA — belum ada kode yang diubah. Menunggu persetujuan.
Pilihan yang sudah disetujui: (1) bangun CRM dulu dengan impor chat-export, lead manual, dan AI; live WhatsApp disambungkan nanti. (2) AI: Claude Sonnet 5.5 via Emergent LLM Key. (3) Analisis AI berjalan saat admin menekan "Analisis" dan lewat tombol "Analisis semua yang berubah".

---
## FASE 1 — HASIL AUDIT APLIKASI SAAT INI

### Arsitektur
- Frontend: Expo (expo-router), Bahasa Indonesia. Tab: Beranda, Jadwal, Kasir, Lainnya.
- Backend: FastAPI, satu file `backend/server.py`, semua rute memakai awalan `/api`. Database MongoDB.
- Auth: login PIN, token JWT (berlaku 30 hari). Peran: `super_admin`, `admin` (admin1/admin2), `staff` (fotografer/editor).

### Yang bisa dipakai ulang (CRM TIDAK membuat sistem duplikat)
| Yang sudah ada | Dipakai CRM untuk |
|---|---|
| `require("admin","super_admin")` = dependency `ADMIN` | Semua endpoint CRM → HTTP 403 untuk staff (dicek di server) |
| `useAuth().isAdmin` | Menampilkan menu, pintasan, dan badge CRM hanya untuk admin |
| Koleksi `clients` + `build_clients()` + `client_key()` (nomor dinormalisasi ke 62…) | Profil klien = satu-satunya data pelanggan. Lead baru dibuat sebagai `clients` |
| Koleksi `bookings` + form booking (sudah bisa diisi otomatis dari klien) | Tombol "Buat Booking" dari CRM memakai modul booking yang sudah ada, lalu booking ditautkan ke percakapan |
| Pembayaran dan kasir (`payments` di booking, `transactions`) | Hanya ditampilkan (riwayat transaksi). Tidak ada pembayaran baru |
| `audit_logs` + layar Riwayat Perubahan | Mencatat koreksi kategori, impor, pengiriman, perubahan pengaturan, dan penghapusan data CRM |
| `task_templates` / `task_logs` (Checklist Harian, sudah bisa hitung otomatis) | Tugas "Follow up klien" (minimal 10) dihitung otomatis setiap follow-up dicatat di CRM. Tidak membuat mesin workflow baru |
| `openWhatsApp()` (membuka wa.me) | "Buka WhatsApp" dengan balasan yang sudah terisi, selama API belum tersambung |
| `packages` + `settings` (jam buka, nama studio) | Satu-satunya sumber info harga/jadwal untuk AI |
| Emergent Object Storage (`/api/upload`) | Menyimpan file chat-export (.txt/.zip) |

### Celah yang perlu diisi
- Belum ada tempat menyimpan pesan/percakapan WhatsApp.
- Belum ada catatan follow-up per klien (yang ada hanya penghitung Checklist).
- Belum ada layanan AI di backend (Emergent key sudah tersedia di `.env`).

### Kelayakan WhatsApp Business App Coexistence
| Pertanyaan | Jawaban |
|---|---|
| Apakah nomor bisa memakai Coexistence? | Kemungkinan YA. Indonesia didukung (yang tidak didukung hanya Nigeria, Afrika Selatan, EEA/UK). Syarat: WhatsApp Business App versi ≥ 2.24.17, nomor aktif di aplikasi tersebut, dan Meta Business Account. Kepastian baru didapat saat Embedded Signup dijalankan |
| Bisa disambungkan sendiri? | Tidak langsung. Coexistence wajib lewat **Meta Tech Provider / Solution Partner (BSP)** dengan Embedded Signup. Pilihannya: memakai BSP (360dialog, YCloud, Qontak, Wati, Gupshup, Infobip) atau mendaftarkan aplikasi Meta sendiri sebagai Tech Provider (perlu App Review dan verifikasi bisnis, prosesnya berminggu-minggu) |
| Bisa sinkron riwayat chat? | YA, tetapi sekali saja per onboarding: maksimal **6 bulan terakhir** chat 1-on-1, dan harus dimulai **dalam 24 jam** setelah tersambung. Kalau terlewat, nomor harus di-offboard dan didaftarkan ulang |
| Yang ikut tersinkron | Kontak (`smb_app_state_sync`), pesan riwayat (`history`), pesan yang dikirim admin dari HP (`smb_message_echoes`), serta pesan masuk/keluar baru. Media datang sebagai ID media yang harus diunduh lewat API dalam batas waktu tertentu |
| Yang tidak tersinkron | Chat grup, panggilan suara/video, broadcast list (menjadi read-only), pesan sekali lihat dan pesan sementara, live location, chat lebih dari 6 bulan |
| Risiko untuk akun | Semua perangkat tertaut (WhatsApp Web/Desktop) diputus saat onboarding lalu harus ditautkan ulang (Windows dan WearOS tidak didukung). Aplikasi di HP wajib dibuka minimal sekali setiap 13 hari. Kecepatan kirim dibatasi 20 pesan/detik. Akun tetap di HP, tidak dimigrasi |
| Biaya Meta (per 1 Okt 2026, nomor +62) | Balasan layanan dalam jendela 24 jam: gratis 1.000/bulan, lalu ±Rp 356/pesan. Template utility ±Rp 356, template marketing ±Rp 586. Semua belum termasuk PPN 11%. Perlu metode pembayaran di Meta Billing Hub |
| Biaya BSP | Bervariasi, biasanya biaya bulanan (± USD 0–50+) ditambah markup per pesan. Dipastikan setelah BSP dipilih |
| Yang diperlukan dari Anda nanti | Meta Business Manager (sebaiknya sudah terverifikasi), akun di BSP, HP dengan WhatsApp Business versi terbaru, lalu menyelesaikan Embedded Signup sendiri (memindai QR atau memasukkan kode di HP) |

**Kesimpulan:** Cloud API biasa TIDAK otomatis mengimpor riwayat chat. Riwayat hanya didapat lewat history sync Coexistence (6 bulan, sekali, dalam 24 jam) atau lewat file Export Chat.

---
## PEMISAHAN YANG DIMINTA

### 1) Bisa dibangun sepenuhnya di aplikasi sekarang
- Kontrol akses CRM (hanya Super Admin dan Admin, 403 di server)
- Inbox CRM dengan filter, urutan, dan penanda arah pesan (masuk/keluar)
- Profil lead dan klien (memakai `clients` yang sudah ada), lead manual, penanggung jawab (admin)
- Kategori/label yang bisa diatur (11 kategori bawaan) dan koreksi manual
- Pusat Follow-up (hari ini, terlambat, mendatang, belum merespons, kontak ke-2, repeat order), catatan, hasil, jadwal berikutnya
- Tautan ke booking yang sudah ada, serta riwayat booking dan transaksi
- Importer chat-export (.txt/.zip) dengan deteksi duplikat dan ringkasan hasil impor
- Halaman Pengaturan Integrasi (status, konfigurasi yang belum lengkap, tombol tes) dan log error integrasi
- Endpoint webhook (verifikasi dan penerimaan) yang sudah siap, tetapi tidak aktif sampai kredensial diisi
- Pengaturan retensi dan penghapusan data, serta audit log

### 2) Butuh konfigurasi layanan eksternal
- **AI (Claude Sonnet 5.5):** memakai Emergent LLM Key yang SUDAH tersedia. Tidak perlu konfigurasi tambahan, hanya saldo key
- **Live WhatsApp (Fase 4):** akun BSP dan Meta, `WHATSAPP_ACCESS_TOKEN`, `PHONE_NUMBER_ID`, `WABA_ID`, `APP_SECRET`, `VERIFY_TOKEN`. Semuanya disimpan di backend `.env` dan TIDAK pernah dikirim ke frontend

### 3) Riwayat yang bisa tersinkron otomatis
- Hanya setelah Coexistence aktif: 6 bulan terakhir chat 1-on-1 beserta kontak, sekali, dalam 24 jam setelah onboarding. Di CRM ditandai dengan sumber `history_sync`

### 4) Riwayat yang perlu diekspor dan diimpor manual
- Chat yang lebih lama dari 6 bulan, atau semua riwayat kalau Coexistence belum aktif: dari HP buka chat → ⋮ → Lainnya → Ekspor chat → "Tanpa media" (.txt) atau "Sertakan media" (.zip). Satu file per chat
- Ditandai dengan sumber `import` ("Arsip impor"), dibedakan dari `live`

### 5) Biaya, syarat akun, dan batasan teknis
- Biaya pesan Meta dan BSP (lihat tabel di atas). Biaya AI dari saldo Emergent LLM Key (perkiraan kecil per analisis, tergantung panjang chat)
- Keterbatasan file export:
  - Format tanggal mengikuti bahasa dan pengaturan HP. Parser mendukung format Indonesia/Inggris, 12 dan 24 jam
  - File tidak mencantumkan nomor admin. Arah pesan ditentukan dari nama pengirim: nama yang dipilih admin sebagai "nama bisnis" dihitung sebagai pesan keluar
  - Nomor pelanggan biasanya hanya ada kalau kontaknya tidak tersimpan. Kalau tidak ada, admin memilih atau mengetik nomor saat impor
  - Detik tidak tercatat, jadi pesan dalam menit yang sama diurutkan sesuai urutan di file
  - Media hanya tercatat sebagai "<Media tidak disertakan>". Lampiran dari .zip disimpan sebagai daftar nama file, tidak dianalisis AI
  - Baris yang tidak bisa dibaca ditampilkan di ringkasan impor, tidak dibuang diam-diam
- Aplikasi tidak akan pernah memakai scraping WhatsApp Web, sesi browser, atau login pribadi admin

---
## RANCANGAN ARSITEKTUR (dalam `server.py` dan database yang sama)

Modul backend (dipisah per bagian dengan prefix `/api/crm/...`, semuanya memakai `Depends(ADMIN)` kecuali webhook):
1. **CRM API:** inbox, detail percakapan, label, penanggung jawab, follow-up, pengaturan, retensi
2. **Data:** koleksi baru `crm_conversations`, `crm_messages`, `crm_followups`, `crm_imports`, `crm_integration_log`, `crm_settings`. Pelanggan TETAP di `clients`, booking TETAP di `bookings`
3. **WhatsApp service:** antarmuka `send_text()`, `fetch_media()`, `status()`. Saat ini statusnya "Belum tersambung". Adapter Meta Cloud API dibuat agar BSP berformat Cloud API (mis. 360dialog) bisa langsung dipakai
4. **Webhook receiver:** `GET /api/crm/webhook` (verifikasi `hub.verify_token`) dan `POST /api/crm/webhook` (verifikasi signature `X-Hub-Signature-256` dengan APP_SECRET), lalu event disimpan mentah ke antrean
5. **Antrean sinkronisasi:** koleksi `crm_events` diproses oleh background task: idempoten berdasarkan `wa_message_id`, aman untuk pengiriman ulang, mengurutkan event yang datang terlambat berdasarkan timestamp asli, dan mencoba ulang dengan backoff. Error dicatat ke log integrasi
6. **AI Analysis service** (Claude Sonnet 5.5): ringkasan, intent, kebutuhan utama, label (bisa lebih dari satu), prioritas, confidence, aksi berikutnya, dan waktu follow-up. Output JSON yang divalidasi
7. **AI Reply service:** 3 gaya balasan, dengan konteks dari `packages`, `settings`, booking klien, dan "Info Resmi Studio" (teks kebijakan/promo yang diisi Super Admin)
8. **Follow-up:** `crm_followups` dihubungkan ke Checklist Harian (auto +1 "Follow up klien")
9. **Integrasi booking:** tautan conversation → client_key → booking_id. Booking dibuat lewat form booking yang sudah ada

### Model data utama
- `crm_conversations`: client_key (unik), wa_phone, display_name, last_message_at, last_inbound_at, last_outbound_at, last_direction, last_preview, awaiting ("admin" | "customer" | null), labels[], labels_source ("ai" | "manual"), priority (1–5), ai{summary, intent, need, confidence, next_action, followup_at, analyzed_at, msg_count_at_analysis}, assigned_to, linked_booking_ids[], unread_count, sources[]
- `crm_messages`: conversation_id, wa_message_id (unik, nullable) atau dedupe_hash (hash dari arah + waktu + teks + client_key, unik), direction (in/out), text, media{type, name}, ts (asli), source (live | history_sync | import | manual), import_id
- `crm_followups`: conversation_id, client_key, due_at, assigned_to, note, status (open/done/skipped), outcome, created_by, done_at, attempt_no

### Aturan penting
- "Booking Confirmed" atau "Booking Pending" hanya diberikan dari data `bookings` yang nyata (aturan dari sistem, bukan tebakan AI)
- Label "Unanswered Customer" atau "menunggu admin" dihitung dari arah pesan terakhir (deterministik). "Awaiting Customer Decision" berarti pesan terakhir dari admin dan pelanggan belum menjawab
- AI menerima riwayat chat (maks. ±60 pesan terakhir ditambah ringkasan sebelumnya), bukan hanya pesan terakhir
- AI dilarang membuat harga, diskon, jadwal, isi paket, atau konfirmasi booking. Kalau data tidak ada di konteks, AI menulis [VERIFIKASI ADMIN: …]. Harga di balasan dicek ulang di server terhadap `packages`, dan kalau tidak cocok diberi tanda peringatan
- Tidak ada pengiriman otomatis. Tombol Kirim (setelah API aktif) butuh konfirmasi admin. Status Terkirim/Dibaca hanya ditampilkan dari webhook status, tidak pernah diasumsikan

---
## FASE IMPLEMENTASI (setelah disetujui)

**Fase 2 — Fondasi CRM**
- Koleksi dan indeks, endpoint CRM dengan `ADMIN` (403 untuk staff), menu "CRM WhatsApp" di Lainnya, dan badge di Beranda (hanya admin)
- Inbox: nama, nomor, preview pesan, waktu, "x jam lalu", panah masuk/keluar, label, penanggung jawab, status booking, status follow-up, ringkasan AI
- Filter: Terbaru, Belum dibalas, Hot lead, Tanya harga, Tertarik belum booking, Follow-up hari ini, Terlambat, Terkait booking, Repeat order, Dormant, Komplain
- Urutan: pesan terbaru, belum dibalas paling lama, urgensi follow-up, prioritas AI, status booking
- Detail percakapan: timeline pesan, profil klien, riwayat booking dan transaksi, edit label, pilih penanggung jawab, catat pesan manual
- Lead manual (membuat `clients` dan percakapan) serta Pusat Follow-up (7 tab)
- Kategori bisa diatur (Super Admin: ganti nama, aktif/nonaktif, warna)

**Fase 3 — Riwayat**
- Unggah file .txt/.zip → pratinjau (jumlah pesan, rentang tanggal, pengirim yang terdeteksi, baris yang gagal dibaca) → admin memilih nama bisnis dan nomor pelanggan → impor
- Deteksi duplikat dengan `dedupe_hash` (impor ulang file yang sama menghasilkan 0 pesan baru), progres impor, dan ringkasan (baru, duplikat, gagal)
- Penautan otomatis ke `clients` hanya kalau nomornya cocok persis. Kalau tidak cocok, admin memilih klien atau membuat klien baru

**Fase 5 — AI**
- Tombol "Analisis" per percakapan dan "Analisis semua yang berubah" (hanya untuk percakapan yang punya pesan baru sejak analisis terakhir)
- 3 saran balasan (Ramah singkat, Profesional, Sales halus): Salin, Edit, Generate ulang, Buka WhatsApp (wa.me dengan teks terisi), Catat follow-up, dan Jadwalkan berikutnya
- Halaman "Info Resmi Studio" (Super Admin) sebagai sumber kebijakan dan promo yang boleh disebut AI
- Koreksi label oleh admin menimpa hasil AI dan tercatat di audit

**Fase 4 — Live WhatsApp (menunggu pilihan BSP dan kredensial Anda)**
- Halaman Integrasi sudah dibuat di Fase 2: status, konfigurasi yang belum lengkap, URL webhook untuk ditempel di BSP/Meta, tombol tes, dan log error
- Setelah kredensial ada: aktifkan webhook, history sync dalam 24 jam, echo pesan dari HP, kirim dengan persetujuan admin, dan status pengiriman

**Fase 6 — Pengujian**
- Hak akses (staff → 403 di semua endpoint CRM)
- Impor: parser beberapa format, impor ulang menghasilkan 0 duplikat, file rusak
- Webhook: signature salah ditolak, retry dan event yang tidak berurutan
- Kualitas AI: harga tidak boleh dikarang, label booking dari data nyata
- Follow-up dan Checklist, pembuatan booking dari CRM, dan regresi fitur lama

### Perlindungan data
- Hanya ADMIN yang bisa mengakses. Token WhatsApp disimpan di `.env` backend. Webhook diverifikasi dengan signature
- Input divalidasi Pydantic dan ukuran file dibatasi (maks. 20 MB)
- Audit log untuk impor, koreksi, kirim, dan hapus
- Retensi: Super Admin mengatur "hapus pesan lebih lama dari N bulan" (bawaan: tidak dihapus) dan bisa menghapus semua data CRM satu klien
- Data chat dikirim ke model AI hanya saat admin menekan Analisis atau Generate (melalui Emergent LLM Key). Nomor telepon disamarkan di prompt

### Tidak akan dilakukan tanpa persetujuan
- Menyambungkan atau memigrasi nomor WhatsApp produksi, mengubah pengaturan produksi, mengirim pesan otomatis, atau mengubah alur booking, absensi, dan workflow yang sudah ada
