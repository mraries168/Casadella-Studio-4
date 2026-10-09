import { longDate, METHOD_LABEL, PAY_STATUS, rp } from "@/src/api";

const detail = (b: any) =>
  `Paket: ${b.package_name}\nTanggal: ${longDate(b.date)}\nJam: ${b.start_time} - ${b.end_time}\nFotografer: ${b.photographer_name || "-"}\n`;
const remainingOf = (b: any) => b.price - (b.paid_total || 0);

export const confirmText = (b: any, studio: string) =>
  `Halo ${b.client_name},\n\nBooking Anda di ${studio} telah DIKONFIRMASI.\n\n${detail(b)}Total: ${rp(b.price)}\nSudah dibayar: ${rp(b.paid_total)}\nSisa: ${rp(remainingOf(b))}\n\nMohon datang 10 menit lebih awal. Terima kasih!`;

export const invoiceText = (b: any, studio: string) =>
  `Halo ${b.client_name},\n\nBerikut invoice / kwitansi Anda di ${studio}.\n\n${detail(b)}\nRiwayat pembayaran:\n${
    (b.payments || []).map((p: any) => `- ${p.date} ${p.type === "dp" ? "DP" : "Pelunasan"} ${rp(p.amount)} (${METHOD_LABEL[p.method]})`).join("\n") || "- Belum ada"
  }\n\nTotal: ${rp(b.price)}\nDibayar: ${rp(b.paid_total)}\nSisa: ${rp(remainingOf(b))}\nStatus: ${PAY_STATUS[b.payment_status]}\n\nTerima kasih!`;

export const reminderText = (b: any, studio: string) =>
  `Halo ${b.client_name},\n\nIni pengingat sesi foto Anda di ${studio}:\n\n${detail(b)}${
    remainingOf(b) > 0 ? `Sisa pembayaran: ${rp(remainingOf(b))}\n` : ""
  }\nMohon datang 10 menit lebih awal. Sampai jumpa!`;

export const balanceText = (b: any, studio: string) =>
  `Halo ${b.client_name},\n\nTerima kasih sudah melakukan sesi foto di ${studio}.\n\n${detail(b)}\nTotal: ${rp(b.price)}\nSudah dibayar: ${rp(b.paid_total)}\n*Sisa pelunasan: ${rp(remainingOf(b))}*\n\nMohon segera melakukan pelunasan (tunai, transfer, kartu, atau QRIS) agar foto dapat kami proses dan kirimkan. Terima kasih!`;

export const rejectText = (b: any, studio: string) =>
  `Halo ${b.client_name},\n\nMohon maaf, booking online Anda di ${studio} untuk ${longDate(b.date)} jam ${b.start_time} (${b.package_name}) belum dapat kami terima. Silakan pilih jadwal lain atau hubungi kami. Terima kasih!`;

// Invoice sent to the studio admin after a DP / pelunasan is recorded.
export const adminInvoiceText = (b: any, studio: string) => {
  const dp = (b.payments || []).filter((p: any) => p.type === "dp").reduce((a: number, p: any) => a + p.amount, 0);
  const last = (b.payments || [])[(b.payments || []).length - 1];
  return `*INVOICE ${studio}*\n${last ? `Pembayaran baru: ${last.type === "dp" ? "DP" : "Pelunasan"} ${rp(last.amount)} (${METHOD_LABEL[last.method]}) oleh ${last.by}\n` : ""}\nKlien: ${b.client_name}\nNo. WA: ${b.client_phone || "-"}\n\nJadwal: ${longDate(b.date)}\nJam: ${b.start_time} - ${b.end_time}\nPaket: ${b.package_name} (${b.duration_min} menit)\nFotografer: ${b.photographer_name || "-"}\n\nTotal Harga: ${rp(b.price)}\nDP: ${rp(dp)}\nTotal Dibayar: ${rp(b.paid_total)}\nSisa Tagihan: ${rp(remainingOf(b))}\nStatus: ${PAY_STATUS[b.payment_status]}`;
};

export const payslipText = (r: any, month: string, studio: string) =>
  `Halo ${r.name},\n\nBerikut ringkasan slip gaji ${month} dari ${studio}:\n\nGaji Pokok: ${rp(r.base_salary)}\nUang Makan (${r.days_worked} hari): ${rp(r.meal_allowance)}\nUang Lembur: ${rp(r.overtime_pay)}\nBonus Omzet (${r.turnover_bonus_pct}%): ${rp(r.turnover_bonus)}\nBonus Lain-lain: ${rp(r.misc_bonus)}${
    r.kasbon ? `\nPotongan Kasbon: -${rp(r.kasbon)}` : ""
  }${r.denda ? `\nPotongan Denda: -${rp(r.denda)}` : ""}\n\nTOTAL: ${rp(r.total)}\n\nSlip gaji PDF terlampir. Terima kasih atas kerja kerasnya!`;
