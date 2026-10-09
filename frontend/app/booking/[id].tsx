import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, downloadAndShare, longDate, METHOD_LABEL, openWhatsApp, PAY_STATUS, rp, useFetch } from "@/src/api";
import { adminInvoiceText, balanceText, confirmText, invoiceText, rejectText, reminderText } from "@/src/wa";
import { useAuth } from "@/src/auth";
import { WorkflowCard } from "@/src/workflow";
import { makeStyles, space, radius } from "@/src/theme";
import { Badge, Button, Card, Chip, ChipRow, Empty, ErrorText, Field, Header, Loading, SectionTitle, Sheet } from "@/src/ui";

export default function BookingDetail() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useAuth();
  const isAdmin = can("booking");
  const { data: b, setData, error } = useFetch<any>(`/bookings/${id}`);
  const settings = useFetch<any>("/settings");
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pay, setPay] = useState({ type: "dp", method: "cash", amount: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);

  if (!b) return <View style={s.root}><Header back title="Detail Booking" />{error ? <ErrorText text={error} /> : <Loading />}</View>;
  const remaining = b.price - (b.paid_total || 0);
  const cancelled = b.status === "cancelled";
  const pending = b.status === "pending";
  const studioName = settings.data?.studio_name || "Casadella Photo Studio";

  const approve = async () => {
    setErr(null);
    setDecision("approve");
    try {
      const nb = await api(`/bookings/${id}/approve`, { method: "POST" });
      setData(nb);
      openWhatsApp(nb.client_phone, confirmText(nb, studioName)).catch(() => {});
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDecision(null);
    }
  };
  const reject = async () => {
    setErr(null);
    setDecision("reject");
    try {
      await api(`/bookings/${id}/reject`, { method: "POST" });
      openWhatsApp(b.client_phone, rejectText(b, studioName)).catch(() => {});
      router.back();
    } catch (e: any) {
      setErr(e.message);
      setDecision(null);
    }
  };

  const openPay = () => {
    const isDp = (b.paid_total || 0) === 0;
    const dpPct = settings.data?.default_dp_percent ?? 50;
    setPay({ type: isDp ? "dp" : "pelunasan", method: "cash", amount: String(isDp ? Math.round((b.price * dpPct) / 100) : remaining), note: "" });
    setErr(null);
    setOpen(true);
  };
  const submitPay = async () => {
    setBusy(true);
    setErr(null);
    try {
      const nb = await api(`/bookings/${id}/payments`, { method: "POST", body: { ...pay, amount: Number(pay.amount.replace(/\D/g, "")) } });
      setData(nb);
      setOpen(false);
      sendAdminInvoice(nb);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    try {
      await api(`/bookings/${id}/cancel`, { method: "POST" });
      router.back();
    } catch (e: any) {
      setErr(e.message);
      setConfirmCancel(false);
    }
  };

  const sendWa = async (kind: "confirm" | "receipt" | "reminder" | "balance") => {
    setErr(null);
    const studio = settings.data?.studio_name || "Casadella Photo Studio";
    const text = kind === "confirm" ? confirmText(b, studio) : kind === "reminder" ? reminderText(b, studio) : kind === "balance" ? balanceText(b, studio) : invoiceText(b, studio);
    try {
      await openWhatsApp(b.client_phone, text);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const sendAdminInvoice = async (nb: any) => {
    setErr(null);
    try {
      await openWhatsApp(settings.data?.admin_wa_number || "", adminInvoiceText(nb, studioName));
    } catch (e: any) {
      setErr(e.message === "Nomor WhatsApp klien belum diisi" ? "Nomor WhatsApp admin belum diatur (Pengaturan Sistem)" : e.message);
    }
  };
  const shareInvoice = async () => {
    setErr(null);
    setPdfBusy(true);
    try {
      await downloadAndShare(`/bookings/${id}/invoice`, `invoice-${b.client_name.replace(/\W+/g, "-")}-${b.date}.pdf`, "application/pdf");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <Header back title={b.client_name} subtitle={`${longDate(b.date)} · ${b.start_time}–${b.end_time}`} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}>
        {pending && (
          <View style={s.pendingCard} testID="pending-approval-card">
            <Text style={s.pendingTitle}>Booking online menunggu konfirmasi</Text>
            <Text style={s.pendingText}>Slot sudah dikunci untuk klien ini. Setujui atau tolak, lalu kirim kabar ke klien via WhatsApp.</Text>
            {isAdmin && (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button testID="approve-booking-button" title="Setujui" icon="checkmark-circle-outline" style={{ flex: 1 }} loading={decision === "approve"} disabled={!!decision} onPress={approve} />
                <Button testID="reject-booking-button" title="Tolak" icon="close-circle-outline" variant="danger" style={{ flex: 1 }} loading={decision === "reject"} disabled={!!decision} onPress={reject} />
              </View>
            )}
          </View>
        )}
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button testID="wa-confirm-button" title="Konfirmasi" icon="logo-whatsapp" variant="secondary" style={{ flex: 1 }} onPress={() => sendWa("confirm")} />
          <Button testID="wa-reminder-button" title="Pengingat" icon="alarm-outline" variant="secondary" style={{ flex: 1 }} onPress={() => sendWa("reminder")} />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button testID="wa-receipt-button" title="WA Invoice" icon="receipt-outline" variant="secondary" style={{ flex: 1 }} onPress={() => sendWa("receipt")} />
          <Button testID="invoice-pdf-button" title="Invoice PDF" icon="document-text-outline" variant="secondary" style={{ flex: 1 }} loading={pdfBusy} onPress={shareInvoice} />
        </View>
        {!pending && !cancelled && b.payment_status !== "lunas" && (
          <Button testID="wa-balance-button" title={`Tagih Pelunasan ${rp(b.price - (b.paid_total || 0))}`} icon="logo-whatsapp" variant="secondary" onPress={() => sendWa("balance")} />
        )}
        {(!isAdmin || pending) && <ErrorText text={!open ? err : null} />}
        <Card testID="booking-info-card" style={{ gap: space.md }}>
          <View style={s.between}>
            <Text style={s.pkg}>{b.package_name}</Text>
            {cancelled ? <Badge label="Dibatalkan" tone="error" /> : pending ? <Badge label="Menunggu Konfirmasi" tone="warning" /> : <Badge label={PAY_STATUS[b.payment_status]} tone={b.payment_status === "lunas" ? "success" : b.payment_status === "dp" ? "warning" : "muted"} />}
          </View>
          <Info label="Klien" value={b.client_name} />
          <Info label="No. WhatsApp" value={b.client_phone || "-"} />
          <Info label="Waktu" value={`${b.start_time} – ${b.end_time} (${b.duration_min} menit)`} />
          <Info label="Fotografer" value={b.photographer_name || "Belum ditentukan"} />
          <Info label="Editor" value={b.editor_name || "Belum ditentukan"} />
          {!!b.notes && <Info label="Catatan" value={b.notes} />}
        </Card>

        {b.status === "confirmed" && <WorkflowCard b={b} onChange={setData} />}

        <View style={s.payCard} testID="booking-payment-summary">
          <Info label="Total Harga" value={rp(b.price)} light />
          <Info label="Sudah Dibayar" value={rp(b.paid_total)} light />
          <View style={s.line} />
          <View style={s.between}>
            <Text style={s.remLabel}>Sisa Tagihan</Text>
            <Text style={s.remValue} testID="booking-remaining">{rp(remaining)}</Text>
          </View>
        </View>

        {isAdmin && !cancelled && !pending && remaining > 0 && <Button testID="add-payment-button" title="Catat Pembayaran (DP / Pelunasan)" icon="cash-outline" onPress={openPay} />}

        {(b.payments || []).length > 0 && (
          <Button testID="admin-invoice-button" title="Kirim Invoice ke Admin" icon="logo-whatsapp" variant="secondary" onPress={() => sendAdminInvoice(b)} />
        )}
        <SectionTitle>Riwayat Pembayaran</SectionTitle>
        {(b.payments || []).length === 0 && <Empty icon="wallet-outline" text="Belum ada pembayaran" />}
        {(b.payments || []).map((p: any, i: number) => (
          <View key={i} style={s.payRow} testID={`payment-row-${i}`}>
            <Badge label={p.type === "dp" ? "DP" : "Pelunasan"} tone={p.type === "dp" ? "warning" : "success"} />
            <View style={{ flex: 1 }}>
              <Text style={s.payAmt}>{rp(p.amount)}</Text>
              <Text style={s.payMeta}>{METHOD_LABEL[p.method]} · {p.date} · oleh {p.by}</Text>
            </View>
          </View>
        ))}

        {isAdmin && !cancelled && !pending && (
          <View style={{ gap: space.sm }}>
            <Button testID="edit-booking-button" title="Ubah Booking" icon="create-outline" variant="secondary" onPress={() => router.push(`/booking/form?id=${id}`)} />
            {confirmCancel ? (
              <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                <Text style={s.sheetHint}>Booking & semua pembayarannya akan dihapus dari data dan laporan keuangan.</Text>
                <Button testID="cancel-booking-confirm" title="Ya, batalkan" variant="danger" style={{ flex: 1 }} onPress={cancel} />
                <Button testID="cancel-booking-abort" title="Tidak" variant="ghost" style={{ flex: 1 }} onPress={() => setConfirmCancel(false)} />
              </View>
            ) : (
              <Button testID="cancel-booking-button" title="Batalkan & Hapus Booking" variant="ghost" onPress={() => setConfirmCancel(true)} />
            )}
            <ErrorText text={!open ? err : null} />
          </View>
        )}
      </ScrollView>

      <Sheet testID="payment-sheet" visible={open} onClose={() => setOpen(false)} title="Catat Pembayaran">
        <Text style={s.sheetHint}>Sisa tagihan: {rp(remaining)}</Text>
        <ChipRow>
          <Chip testID="payment-type-dp" label="DP / Uang Muka" active={pay.type === "dp"} onPress={() => setPay({ ...pay, type: "dp" })} />
          <Chip testID="payment-type-pelunasan" label="Pelunasan" active={pay.type === "pelunasan"} onPress={() => setPay({ ...pay, type: "pelunasan", amount: String(remaining) })} />
        </ChipRow>
        <Field testID="payment-amount-input" label="Nominal (Rp)" keyboardType="number-pad" value={pay.amount} onChangeText={(v) => setPay({ ...pay, amount: v.replace(/\D/g, "") })} />
        <ChipRow>
          {Object.entries(METHOD_LABEL).map(([k, v]) => (
            <Chip key={k} testID={`payment-method-${k}`} label={v} active={pay.method === k} onPress={() => setPay({ ...pay, method: k })} />
          ))}
        </ChipRow>
        <Field testID="payment-note-input" label="Catatan" value={pay.note} onChangeText={(v) => setPay({ ...pay, note: v })} placeholder="Opsional" />
        <ErrorText text={err} />
        <Button testID="payment-submit-button" title={`Simpan ${rp(Number(pay.amount || 0))}`} loading={busy} disabled={!Number(pay.amount)} onPress={submitPay} />
      </Sheet>
    </View>
  );
}

function Info({ label, value, light }: { label: string; value: string; light?: boolean }) {
  const s = useStyles();
  return (
    <View style={s.between}>
      <Text style={[s.infoLabel, light && s.lightLabel]}>{label}</Text>
      <Text style={[s.infoValue, light && s.lightValue]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  pkg: { fontSize: 17, fontWeight: "800", color: c.brandPrimary, flex: 1 },
  infoLabel: { fontSize: 13, color: c.muted },
  infoValue: { fontSize: 14, fontWeight: "600", color: c.onSurface, flexShrink: 1, textAlign: "right" },
  lightLabel: { color: c.brandTertiary },
  lightValue: { color: c.onBrandPrimary },
  payCard: { backgroundColor: c.brandPrimary, borderRadius: radius.lg, padding: space.xl, gap: space.sm },
  line: { height: 1, backgroundColor: c.brandSecondary, marginVertical: space.xs },
  remLabel: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "700" },
  remValue: { color: c.onBrandPrimary, fontSize: 22, fontWeight: "800" },
  payRow: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: c.surface, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  payAmt: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  payMeta: { fontSize: 12, color: c.muted, marginTop: 2 },
  sheetHint: { fontSize: 14, color: c.muted },
  pendingCard: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.warning, borderLeftWidth: 4, padding: space.lg, gap: space.md },
  pendingTitle: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  pendingText: { fontSize: 13, color: c.muted, lineHeight: 18 },
}));
