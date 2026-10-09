# Casadella Photo Studio – Internal App (PRD)

## Original problem statement
Photo studio app with integrated transparent logo: POS, attendance, photo package selection, scheduling, booking, payments (deposit + balance). Blue/white. Time slots 09:00–20:00, 15-min intervals, auto-adjusted by package duration. Roles: staff (photographer/editor, read-only), admins (Admin 1/2: edit client names, booking times, payments, assign photographer/editor), super admin (access rights, system settings, add photographer/editor). Internal only. POS: income, expenses, turnover; daily/monthly/yearly reports (revenue, operational + rental expenses, net = revenue − expenses).
User choices: PIN login, IDR, record-only payments (cash/transfer/card/QRIS), clock-in/out attendance, demo packages, Bahasa Indonesia UI.

## Architecture
- Backend: FastAPI + MongoDB (motor), PIN (bcrypt) + JWT (12h). Collections: users, packages, bookings (embedded payments), transactions, attendance, settings.
- Frontend: Expo Router; tabs Beranda/Jadwal/Kasir/Lainnya (NativeTabs on iOS 26+); screens booking/form, booking/[id], transaction, packages, users, settings, attendance.

## Implemented (2026-10-08)
- PIN login with name picker, role-based UI & API enforcement
- Slot engine (settings-driven open/close/interval), overlap prevention
- Booking create/edit/cancel with photographer & editor assignment
- DP / Pelunasan payments → auto POS income; payment status
- POS manual income/expense (operasional, sewa); daily/monthly/yearly reports
- Attendance clock-in/out + daily log; packages CRUD (admin); staff/roles CRUD & system settings (super admin)
- Tested: backend 19/19, frontend flows pass

## Iteration 2 (2026-10-08)
- Cashier reports/transactions visible only to admin & super admin (Kasir tab hidden for staff)
- Cancelling a booking deletes it and its payment transactions from reports
- Transaction delete restricted to super admin; PIN managed only by super admin
- Quick "Catat Pengeluaran" shortcut (Beranda + Kasir) for admins; expenses flow into daily report

## Iteration 3 (2026-10-08)
- Per-user access rights (booking & payments / expenses / reports; all off = view-only) set by Super Admin (/access)
- Expense receipt photos (camera/gallery) via Emergent Object Storage
- Report export PDF & Excel (monthly includes attendance recap); reports show Omzet, Pemasukan (DP/Pelunasan), Pengeluaran, Laba Bersih
- WhatsApp booking confirmation & payment receipt buttons
- Monthly attendance recap (late/overtime per employee); work hours & overtime rules in settings (super admin)
- Payroll (super admin): base salary, meal allowance auto (days x Rp25.000), overtime pay, turnover bonus %, misc bonus

## Backlog
- P1: WhatsApp booking confirmation/receipt share, printable receipts/invoices
- P1: Report export (PDF/Excel), monthly attendance recap
- P2: English language toggle, audit log of edits

## Iteration 4 (2026-10-08)
- Payslip PDF (share sheet → WhatsApp) + WA summary to employee phone (users have phone field)
- Booking reminders: home "Pengingat Sesi Besok" one-tap WA + booking detail reminder button
- Client database derived from bookings (name, phone, last visit, last package, total spend, history, favorite package) + PDF/Excel export
- Invoice via WhatsApp text + Invoice PDF; package popularity ("Paket Terlaris") in Kasir

## Import ke environment baru (2026-06)
- Repo diimpor dari GitHub (main) apa adanya; ditambahkan env backend (JWT_SECRET, EMERGENT_LLM_KEY, SEED_SUPERADMIN_PIN=999999), dependensi openpyxl/reportlab & paket Expo (ionicons, image-picker, sharing, file-system)
- Bundle ID/package tetap milik environment ini (com.emergent.casadellastudio.uy27at)
- Smoke test: backend 58/58, alur frontend utama lolos

## Iteration 5 (2026-06)
- Online booking link (/api/book public HTML page): clients pick package + slot; status "pending" locks slot; admin Setujui/Tolak (WA message to client); Home + Link Booking Online screen list pending
- Riwayat Perubahan (audit log, Super Admin only): booking create/update/cancel/approve/reject, payments, package changes (field diffs)
- "Staf" → "Staff" across UI
- Auto rent: expense "sewa" Rp 2.500.000 dated the 1st of each month (amount + on/off in Settings), idempotent via rent_runs
- Payroll fully editable: days worked override, meal allowance override, overtime override, bonuses, deductions kasbon & denda (payslip PDF/WA updated)
- Geofenced attendance: clock-in/out only within 100 m of studio (-10.158988, 123.605584), configurable; permission flow with Open Settings
- Admin invoice via WhatsApp to 6287786098669 (configurable) after DP/Pelunasan: schedule, package, DP, remaining; invoice PDF shows DP
- Super Admin PIN reset to 123456; changeable in Pengaturan Sistem
## Backlog
- P1: Automatic (background) WhatsApp sending via WhatsApp Business API; online DP payment on booking page
- P2: English toggle, shadow* → boxShadow cleanup

## Re-import ke environment baru (2026-06)
- Repo main diimpor apa adanya; env backend dilengkapi (JWT_SECRET, EMERGENT_LLM_KEY, SEED_SUPERADMIN_PIN=123456), frontend EXPO_PUBLIC_BACKEND_URL
- Dependensi backend openpyxl/reportlab/pillow dipasang; frontend Expo di-install ulang (yarn), start di port 3000
- Bundle ID/package baru: com.emergent.casadellastudio.c442b0
- Test iteration_9: backend 22/22 + 10 curl lolos, alur frontend Super Admin lolos
## Backlog
- Tahap 2: DP online di halaman booking, WhatsApp otomatis
- Tahap 3: Bahasa Inggris, galeri hasil foto klien
