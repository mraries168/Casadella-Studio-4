import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { api, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, space } from "@/src/theme";
import { Button, Empty, ErrorText, Field, Header, Loading, SectionTitle, Segmented } from "@/src/ui";

const NUM_KEYS = ["slot_interval", "default_dp_percent", "late_tolerance_min", "overtime_min_minutes", "overtime_rate_per_hour", "meal_allowance_per_day", "rent_amount", "attendance_radius_m"];
const COORD_KEYS = ["studio_lat", "studio_lng"];

export default function Settings() {
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSuper } = useAuth();
  const [pin, setPin] = useState({ a: "", b: "" });
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const savePin = async () => {
    setPinMsg(null);
    if (!/^\d{6}$/.test(pin.a)) return setPinMsg({ ok: false, text: "PIN harus 6 digit angka" });
    if (pin.a !== pin.b) return setPinMsg({ ok: false, text: "Konfirmasi PIN tidak sama" });
    setPinBusy(true);
    try {
      const me = await api("/auth/me");
      await api(`/users/${me.id}`, { method: "PUT", body: { name: me.name, sub_role: me.sub_role, enabled: true, phone: me.phone || "", pin: pin.a } });
      setPin({ a: "", b: "" });
      setPinMsg({ ok: true, text: "PIN Super Admin berhasil diubah" });
    } catch (e: any) {
      setPinMsg({ ok: false, text: e.message });
    } finally {
      setPinBusy(false);
    }
  };
  const { data } = useFetch<any>("/settings");
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data)
      setF({
        ...data,
        ...Object.fromEntries([...NUM_KEYS, ...COORD_KEYS].map((k) => [k, String(data[k])])),
      });
  }, [data]);

  if (!isSuper) return <View style={s.root}><Header back title="Pengaturan Sistem" /><Empty icon="lock-closed-outline" text="Hanya Super Admin yang dapat mengubah pengaturan" /></View>;
  if (!f) return <View style={s.root}><Header back title="Pengaturan Sistem" /><Loading /></View>;

  const save = async () => {
    const t = /^\d{2}:\d{2}$/;
    if (![f.open_time, f.close_time, f.work_start, f.work_end].every((x) => t.test(x))) return setErr("Format jam HH:MM");
    const lat = Number(String(f.studio_lat).replace(",", "."));
    const lng = Number(String(f.studio_lng).replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return setErr("Koordinat studio tidak valid");
    if ((Number(f.attendance_radius_m) || 0) < 10) return setErr("Radius minimal 10 meter");
    setBusy(true);
    setErr(null);
    try {
      await api("/settings", {
        method: "PUT",
        body: {
          studio_name: f.studio_name, open_time: f.open_time, close_time: f.close_time, work_start: f.work_start, work_end: f.work_end,
          ...Object.fromEntries(NUM_KEYS.map((k) => [k, Number(f[k]) || 0])),
          studio_lat: lat, studio_lng: lng, admin_wa_number: f.admin_wa_number || "",
          rent_auto_enabled: f.rent_auto_enabled, geofence_enabled: f.geofence_enabled,
        },
      });
      setMsg("Pengaturan tersimpan");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: string) => (v: string) => { setMsg(null); setF({ ...f, [k]: v }); };

  return (
    <View style={s.root}>
      <Header back title="Pengaturan Sistem" subtitle="Berlaku untuk seluruh aplikasi" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}>
        <Button testID="settings-access-link" title="Atur Hak Akses Staff" icon="key-outline" variant="secondary" onPress={() => router.push("/access")} />
        <SectionTitle>Studio & Booking</SectionTitle>
        <Field testID="settings-studio-name" label="Nama Studio" value={f.studio_name} onChangeText={set("studio_name")} />
        <Field testID="settings-open-time" label="Jam Buka (HH:MM)" value={f.open_time} onChangeText={set("open_time")} />
        <Field testID="settings-close-time" label="Jam Tutup (HH:MM)" value={f.close_time} onChangeText={set("close_time")} />
        <Field testID="settings-interval" label="Interval Slot (menit)" keyboardType="number-pad" value={f.slot_interval} onChangeText={set("slot_interval")} />
        <Field testID="settings-dp-percent" label="Default DP (%)" keyboardType="number-pad" value={f.default_dp_percent} onChangeText={set("default_dp_percent")} />
        <Field testID="settings-admin-wa" label="No. WhatsApp Admin (penerima invoice DP/Pelunasan)" keyboardType="phone-pad" value={f.admin_wa_number} onChangeText={set("admin_wa_number")} />
        <SectionTitle>Absensi & Lembur</SectionTitle>
        <Field testID="settings-work-start" label="Jam Masuk Kerja (HH:MM)" value={f.work_start} onChangeText={set("work_start")} />
        <Field testID="settings-work-end" label="Jam Pulang Kerja (HH:MM)" value={f.work_end} onChangeText={set("work_end")} />
        <Field testID="settings-late-tolerance" label="Toleransi Terlambat (menit)" keyboardType="number-pad" value={f.late_tolerance_min} onChangeText={set("late_tolerance_min")} />
        <Field testID="settings-overtime-min" label="Minimal Lembur Dihitung (menit)" keyboardType="number-pad" value={f.overtime_min_minutes} onChangeText={set("overtime_min_minutes")} />
        <Field testID="settings-overtime-rate" label="Upah Lembur per Jam (Rp)" keyboardType="number-pad" value={f.overtime_rate_per_hour} onChangeText={set("overtime_rate_per_hour")} />
        <SectionTitle>Absensi Berbasis Lokasi</SectionTitle>
        <Segmented testID="settings-geofence" value={f.geofence_enabled ? "on" : "off"} onChange={(k) => { setMsg(null); setF({ ...f, geofence_enabled: k === "on" }); }} options={[{ key: "on", label: "Aktif" }, { key: "off", label: "Nonaktif" }]} />
        <Field testID="settings-studio-lat" label="Latitude Studio" keyboardType="numbers-and-punctuation" value={f.studio_lat} onChangeText={set("studio_lat")} />
        <Field testID="settings-studio-lng" label="Longitude Studio" keyboardType="numbers-and-punctuation" value={f.studio_lng} onChangeText={set("studio_lng")} />
        <Field testID="settings-radius" label="Radius Absensi (meter)" keyboardType="number-pad" value={f.attendance_radius_m} onChangeText={set("attendance_radius_m")} />
        <SectionTitle>Sewa Bulanan Otomatis</SectionTitle>
        <Segmented testID="settings-rent-auto" value={f.rent_auto_enabled ? "on" : "off"} onChange={(k) => { setMsg(null); setF({ ...f, rent_auto_enabled: k === "on" }); }} options={[{ key: "on", label: "Aktif" }, { key: "off", label: "Nonaktif" }]} />
        <Field testID="settings-rent-amount" label="Nominal Sewa per Bulan (Rp) · dicatat tiap tanggal 1" keyboardType="number-pad" value={f.rent_amount} onChangeText={set("rent_amount")} />
        <SectionTitle>Penggajian</SectionTitle>
        <Field testID="settings-meal-allowance" label="Uang Makan per Hari Kerja (Rp)" keyboardType="number-pad" value={f.meal_allowance_per_day} onChangeText={set("meal_allowance_per_day")} />
        <ErrorText text={err} />
        {!!msg && <Empty icon="checkmark-circle-outline" text={msg} />}
        <Button testID="settings-save-button" title="Simpan Pengaturan" loading={busy} onPress={save} />
        <SectionTitle>PIN Super Admin</SectionTitle>
        <Field testID="settings-pin-new" label="PIN Baru (6 digit)" keyboardType="number-pad" secureTextEntry maxLength={6} value={pin.a} onChangeText={(v) => setPin({ ...pin, a: v.replace(/\D/g, "") })} />
        <Field testID="settings-pin-confirm" label="Ulangi PIN Baru" keyboardType="number-pad" secureTextEntry maxLength={6} value={pin.b} onChangeText={(v) => setPin({ ...pin, b: v.replace(/\D/g, "") })} />
        {pinMsg && (pinMsg.ok ? <Empty icon="checkmark-circle-outline" text={pinMsg.text} /> : <ErrorText text={pinMsg.text} />)}
        <Button testID="settings-pin-save-button" title="Ubah PIN" icon="lock-closed-outline" variant="secondary" loading={pinBusy} onPress={savePin} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({ root: { flex: 1, backgroundColor: c.surface } }));
