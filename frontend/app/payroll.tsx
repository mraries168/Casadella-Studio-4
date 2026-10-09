import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, downloadAndShare, MONTHS, openWhatsApp, ROLE_LABEL, rp, today, useFetch } from "@/src/api";
import { payslipText } from "@/src/wa";
import { useAuth } from "@/src/auth";
import { MonthNav } from "@/src/month-nav";
import { makeStyles, radius, space } from "@/src/theme";
import { Badge, Button, Card, Empty, ErrorText, Field, Header, Loading, Sheet } from "@/src/ui";

export default function Payroll() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { isSuper } = useAuth();
  const [month, setMonth] = useState(today().slice(0, 8) + "01");
  const { data, loading, reload, error } = useFetch<any>(isSuper ? `/payroll?month=${month.slice(0, 7)}` : null);
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const settings = useFetch<any>("/settings");

  if (!isSuper) return <View style={s.root}><Header back title="Penggajian" /><Empty icon="lock-closed-outline" text="Hanya Super Admin yang dapat mengakses penggajian" /></View>;

  const open = (r: any) => {
    setErr(null);
    const opt = (v: any) => (v == null ? "" : String(v));
    setEdit({
      ...r, base_salary: String(r.base_salary || ""), turnover_bonus_pct: String(r.turnover_bonus_pct || ""), misc_bonus: String(r.misc_bonus || ""),
      ot: opt(r.overtime_pay_override), days: opt(r.days_worked_override), meal: opt(r.meal_allowance_override),
      kasbon: String(r.kasbon || ""), denda: String(r.denda || ""),
    });
  };
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/payroll/${edit.user_id}?month=${month.slice(0, 7)}`, {
        method: "PUT",
        body: {
          base_salary: Number(edit.base_salary) || 0,
          turnover_bonus_pct: Number(String(edit.turnover_bonus_pct).replace(",", ".")) || 0,
          misc_bonus: Number(edit.misc_bonus) || 0,
          overtime_pay_override: edit.ot === "" ? null : Number(edit.ot) || 0,
          days_worked_override: edit.days === "" ? null : Math.min(31, Number(edit.days) || 0),
          meal_allowance_override: edit.meal === "" ? null : Number(edit.meal) || 0,
          kasbon: Number(edit.kasbon) || 0,
          denda: Number(edit.denda) || 0,
          note: edit.note || "",
        },
      });
      setEdit(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const num = (k: string) => (v: string) => setEdit({ ...edit, [k]: k === "turnover_bonus_pct" ? v.replace(/[^\d.,]/g, "") : v.replace(/\D/g, "") });
  const mLabel = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const sharePdf = async () => {
    setErr(null);
    setSharing(true);
    try {
      await downloadAndShare(`/payroll/${edit.user_id}/payslip?month=${month.slice(0, 7)}`, `slip-gaji-${month.slice(0, 7)}-${edit.name.replace(/\W+/g, "-")}.pdf`, "application/pdf");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSharing(false);
    }
  };
  const sendWa = async () => {
    setErr(null);
    try {
      await openWhatsApp(edit.phone, payslipText(edit, mLabel, settings.data?.studio_name || "Casadella Photo Studio"));
    } catch (e: any) {
      setErr(e.message === "Nomor WhatsApp klien belum diisi" ? "Nomor WhatsApp karyawan belum diisi (Staff & PIN)" : e.message);
    }
  };

  return (
    <View style={s.root}>
      <Header back title="Penggajian" subtitle="Gaji per karyawan per bulan" />
      <View style={s.controls}><MonthNav month={month} onChange={setMonth} /></View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
        <ErrorText text={error} />
        {loading && !data && <Loading />}
        {data && (
          <View style={s.hero} testID="payroll-summary">
            <Text style={s.heroLabel}>Total Gaji Bulan Ini</Text>
            <Text style={s.heroValue} testID="payroll-grand-total">{rp(data.grand_total)}</Text>
            <Text style={s.heroHint}>Omzet bulan ini {rp(data.turnover)} · Uang makan {rp(data.meal_allowance_per_day)}/hari</Text>
          </View>
        )}
        {(data?.rows || []).map((r: any) => (
          <Card key={r.user_id} testID={`payroll-${r.user_id}`} onPress={() => open(r)} style={{ gap: space.sm }}>
            <View style={s.between}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{r.name}</Text>
                <Text style={s.meta}>{ROLE_LABEL[r.sub_role]} · {r.days_worked} hari kerja</Text>
              </View>
              {!r.saved && <Badge label="Belum diatur" tone="warning" />}
            </View>
            <Line label="Gaji Pokok" value={rp(r.base_salary)} />
            <Line label={`Uang Makan (${r.days_worked} hari)${r.meal_allowance_override != null || r.days_worked_override != null ? " · manual" : ""}`} value={rp(r.meal_allowance)} />
            <Line label={`Uang Lembur (${Math.round(r.overtime_minutes)} mnt)${r.overtime_pay_override != null ? " · manual" : ""}`} value={rp(r.overtime_pay)} />
            <Line label={`Bonus Omzet (${r.turnover_bonus_pct}%)`} value={rp(r.turnover_bonus)} />
            <Line label="Bonus Lain-lain" value={rp(r.misc_bonus)} />
            {r.kasbon > 0 && <Line label="Potongan Kasbon" value={`-${rp(r.kasbon)}`} />}
            {r.denda > 0 && <Line label="Potongan Denda" value={`-${rp(r.denda)}`} />}
            <View style={s.divider} />
            <View style={s.between}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue} testID={`payroll-total-${r.user_id}`}>{rp(r.total)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Sheet testID="payroll-sheet" visible={!!edit} onClose={() => setEdit(null)} title={edit ? `Gaji ${edit.name}` : ""}>
        {edit && (
          <>
            <Field testID="payroll-base-input" label="Gaji Pokok (Rp)" keyboardType="number-pad" value={edit.base_salary} onChangeText={num("base_salary")} placeholder="0" />
            <Field testID="payroll-days-input" label={`Jumlah Hari Kerja (kosongkan = otomatis ${edit.days_worked_auto} hari)`} keyboardType="number-pad" value={edit.days} onChangeText={num("days")} placeholder="Otomatis" />
            <Field
              testID="payroll-meal-input"
              label={`Uang Makan (Rp) (kosongkan = ${edit.days === "" ? edit.days_worked_auto : edit.days} × ${rp(data?.meal_allowance_per_day)})`}
              keyboardType="number-pad" value={edit.meal} onChangeText={num("meal")} placeholder="Otomatis"
            />
            <Field testID="payroll-pct-input" label={`Bonus Omzet (%) dari ${rp(data?.turnover)}`} keyboardType="decimal-pad" value={edit.turnover_bonus_pct} onChangeText={num("turnover_bonus_pct")} placeholder="0" />
            <Field testID="payroll-misc-input" label="Bonus Lain-lain (Rp)" keyboardType="number-pad" value={edit.misc_bonus} onChangeText={num("misc_bonus")} placeholder="0" />
            <Field testID="payroll-ot-input" label={`Uang Lembur Manual (kosongkan = otomatis ${rp(edit.overtime_pay_auto)})`} keyboardType="number-pad" value={edit.ot} onChangeText={num("ot")} placeholder="Otomatis" />
            <Field testID="payroll-kasbon-input" label="Potongan Kasbon (Rp)" keyboardType="number-pad" value={edit.kasbon} onChangeText={num("kasbon")} placeholder="0" />
            <Field testID="payroll-denda-input" label="Potongan Denda (Rp)" keyboardType="number-pad" value={edit.denda} onChangeText={num("denda")} placeholder="0" />
            <Field testID="payroll-note-input" label="Catatan" value={edit.note} onChangeText={(v) => setEdit({ ...edit, note: v })} placeholder="Opsional" />
            <ErrorText text={err} />
            <Button testID="payroll-save-button" title="Simpan Gaji" loading={busy} onPress={save} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button testID="payslip-pdf-button" title="Slip PDF" icon="document-text-outline" variant="secondary" style={{ flex: 1 }} loading={sharing} onPress={sharePdf} />
              <Button testID="payslip-wa-button" title="Kirim WA" icon="logo-whatsapp" variant="secondary" style={{ flex: 1 }} onPress={sendWa} />
            </View>
            <Text style={s.meta}>Simpan dulu bila ada perubahan. Tombol Slip PDF membuka menu bagikan, lalu pilih WhatsApp untuk mengirim file PDF ke karyawan.</Text>
          </>
        )}
      </Sheet>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.between}>
      <Text style={s.lineLabel}>{label}</Text>
      <Text style={s.lineValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  controls: { backgroundColor: c.surface, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  hero: { backgroundColor: c.brandPrimary, borderRadius: radius.lg, padding: space.xl, gap: space.xs },
  heroLabel: { color: c.brandTertiary, fontSize: 13, fontWeight: "700" },
  heroValue: { color: c.onBrandPrimary, fontSize: 28, fontWeight: "800" },
  heroHint: { color: c.brandTertiary, fontSize: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  name: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted },
  lineLabel: { fontSize: 13, color: c.onSurfaceSecondary, flex: 1 },
  lineValue: { fontSize: 13, fontWeight: "700", color: c.onSurface },
  divider: { height: 1, backgroundColor: c.border },
  totalLabel: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  totalValue: { fontSize: 17, fontWeight: "800", color: c.brandPrimary },
}));
