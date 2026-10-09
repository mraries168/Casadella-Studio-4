import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { api, rp, today, useFetch } from "@/src/api";
import { makeStyles, radius, space } from "@/src/theme";
import { Button, Chip, ChipRow, DayStrip, ErrorText, Field, Header, Loading, SectionTitle } from "@/src/ui";

export default function BookingForm() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, date: d0 } = useLocalSearchParams<{ id?: string; date?: string }>();
  const pkgs = useFetch<any[]>("/packages");
  const photographers = useFetch<any[]>("/users?sub_role=photographer");
  const editors = useFetch<any[]>("/users?sub_role=editor");
  const [f, setF] = useState({ client_name: "", client_phone: "", date: d0 || today(), start_time: "", package_id: "", photographer_id: "", editor_id: "", notes: "" });
  const [slots, setSlots] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!id) return;
    api(`/bookings/${id}`).then((b) =>
      setF({ client_name: b.client_name, client_phone: b.client_phone || "", date: b.date, start_time: b.start_time, package_id: b.package_id, photographer_id: b.photographer_id || "", editor_id: b.editor_id || "", notes: b.notes || "" }),
    );
  }, [id]);

  useEffect(() => {
    if (!f.package_id) return setSlots(null);
    setSlots(null);
    api(`/slots?date=${f.date}&package_id=${f.package_id}${id ? `&exclude_booking=${id}` : ""}`).then(setSlots).catch((e) => setErr(e.message));
  }, [f.date, f.package_id, id]);

  const pkg = pkgs.data?.find((p) => p.id === f.package_id);
  const save = async () => {
    if (!f.client_name.trim()) return setErr("Nama klien wajib diisi");
    if (!f.package_id) return setErr("Pilih paket foto");
    if (!f.start_time) return setErr("Pilih jam mulai");
    setSaving(true);
    setErr(null);
    try {
      const body = { ...f, photographer_id: f.photographer_id || null, editor_id: f.editor_id || null };
      const b = await api(id ? `/bookings/${id}` : "/bookings", { method: id ? "PUT" : "POST", body });
      if (id) router.back();
      else router.replace(`/booking/${b.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header back title={id ? "Ubah Booking" : "Booking Baru"} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: space.lg, gap: space.lg }}>
        <View style={s.pad}>
          <Field testID="booking-client-name-input" label="Nama Klien" value={f.client_name} onChangeText={(v) => set("client_name", v)} placeholder="cth. Siti Rahma" />
          <Field testID="booking-client-phone-input" label="No. WhatsApp" value={f.client_phone} onChangeText={(v) => set("client_phone", v)} keyboardType="phone-pad" placeholder="08xxxxxxxxxx" />
        </View>

        <View style={[s.pad, { gap: space.sm }]}>
          <SectionTitle>Paket Foto</SectionTitle>
          {pkgs.loading && !pkgs.data && <Loading />}
          {(pkgs.data || []).filter((p) => p.active || p.id === f.package_id).map((p) => {
            const active = p.id === f.package_id;
            return (
              <Pressable key={p.id} testID={`booking-package-${p.id}`} onPress={() => { set("package_id", p.id); set("start_time", ""); }} style={[s.pkg, active && s.pkgActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pkgName}>{p.name}</Text>
                  <Text style={s.pkgMeta}>{p.duration_min} menit · {p.description}</Text>
                </View>
                <Text style={s.pkgPrice}>{rp(p.price)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: space.sm }}>
          <View style={s.pad}><SectionTitle>Tanggal</SectionTitle></View>
          <DayStrip value={f.date} onChange={(v) => { set("date", v); set("start_time", ""); }} />
        </View>

        <View style={[s.pad, { gap: space.sm }]}>
          <SectionTitle>Jam Mulai {pkg ? `(durasi ${pkg.duration_min} menit)` : ""}</SectionTitle>
          {!f.package_id ? <Text style={s.hint}>Pilih paket terlebih dahulu untuk melihat slot tersedia.</Text> : !slots ? <Loading /> : (
            <View style={s.slots} testID="booking-slots-grid">
              {slots.map((sl) => (
                <Pressable
                  key={sl.time}
                  testID={`slot-${sl.time}`}
                  disabled={!sl.available}
                  onPress={() => set("start_time", sl.time)}
                  style={[s.slot, !sl.available && s.slotOff, f.start_time === sl.time && s.slotOn]}
                >
                  <Text style={[s.slotText, !sl.available && s.slotTextOff, f.start_time === sl.time && s.slotTextOn]}>{sl.time}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!!f.start_time && pkg && <Text style={s.hint} testID="booking-selected-time">Terpilih: {f.start_time} – {slots?.find((x) => x.time === f.start_time)?.end}</Text>}
        </View>

        <View style={[s.pad, { gap: space.sm }]}>
          <SectionTitle>Fotografer</SectionTitle>
          <ChipRow>
            <Chip testID="booking-photographer-none" label="Belum ditentukan" active={!f.photographer_id} onPress={() => set("photographer_id", "")} />
            {(photographers.data || []).map((u) => (
              <Chip key={u.id} testID={`booking-photographer-${u.id}`} label={u.name} active={f.photographer_id === u.id} onPress={() => set("photographer_id", u.id)} />
            ))}
          </ChipRow>
          <SectionTitle>Editor</SectionTitle>
          <ChipRow>
            <Chip testID="booking-editor-none" label="Belum ditentukan" active={!f.editor_id} onPress={() => set("editor_id", "")} />
            {(editors.data || []).map((u) => (
              <Chip key={u.id} testID={`booking-editor-${u.id}`} label={u.name} active={f.editor_id === u.id} onPress={() => set("editor_id", u.id)} />
            ))}
          </ChipRow>
        </View>

        <View style={s.pad}>
          <Field testID="booking-notes-input" label="Catatan" value={f.notes} onChangeText={(v) => set("notes", v)} placeholder="Opsional" multiline />
        </View>
      </KeyboardAwareScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]}>
        <ErrorText text={err} />
        <Button testID="booking-save-button" title={id ? "Simpan Perubahan" : `Simpan Booking${pkg ? ` · ${rp(pkg.price)}` : ""}`} loading={saving} onPress={save} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  pad: { paddingHorizontal: space.lg, gap: space.md },
  pkg: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border },
  pkgActive: { borderColor: c.brandPrimary, backgroundColor: c.brandTertiary },
  pkgName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  pkgMeta: { fontSize: 12, color: c.muted, marginTop: 2 },
  pkgPrice: { fontSize: 14, fontWeight: "800", color: c.brandPrimary },
  hint: { fontSize: 13, color: c.muted },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  slot: { width: "23%", height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  slotOff: { borderColor: c.border, backgroundColor: c.surfaceSecondary },
  slotOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  slotText: { fontSize: 13, fontWeight: "700", color: c.brandPrimary },
  slotTextOff: { color: c.borderStrong, textDecorationLine: "line-through" },
  slotTextOn: { color: c.onBrandPrimary },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
