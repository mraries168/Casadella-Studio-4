import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, space } from "@/src/theme";
import { Button, Empty, ErrorText, Field, Header } from "@/src/ui";

const EMPTY = { name: "", phone: "", instagram: "", address: "", notes: "" };

export default function ClientForm() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { key } = useLocalSearchParams<{ key?: string }>();
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!key) return;
    api(`/clients/${encodeURIComponent(key)}`)
      .then((c) => setF({ name: c.name || "", phone: c.phone || "", instagram: c.instagram || "", address: c.address || "", notes: c.notes || "" }))
      .catch((e) => setErr(e.message));
  }, [key]);

  if (!isAdmin) return <View style={s.root}><Header back title="Data Klien" /><Empty icon="lock-closed-outline" text="Hanya Admin & Super Admin yang dapat mengubah data klien" /></View>;

  const save = async () => {
    if (f.name.trim().length < 2) return setErr("Nama klien wajib diisi");
    setSaving(true);
    setErr(null);
    try {
      const c = await api(key ? `/clients/${encodeURIComponent(key)}` : "/clients", { method: key ? "PUT" : "POST", body: f });
      router.replace(`/client/${encodeURIComponent(c.key)}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header back title={key ? "Ubah Data Klien" : "Tambah Klien"} subtitle={key ? "Perubahan nama/nomor ikut diterapkan ke semua booking klien ini" : "Tanpa perlu membuat booking"} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Field testID="client-name-input" label="Nama Klien" value={f.name} onChangeText={(v) => set("name", v)} placeholder="cth. Siti Rahma" />
        <Field testID="client-phone-input" label="No. WhatsApp" value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="08xxxxxxxxxx" />
        <Field testID="client-instagram-input" label="Instagram" value={f.instagram} onChangeText={(v) => set("instagram", v)} autoCapitalize="none" placeholder="Opsional, cth. @sitirahma" />
        <Field testID="client-address-input" label="Alamat" value={f.address} onChangeText={(v) => set("address", v)} placeholder="Opsional" multiline />
        <Field testID="client-notes-input" label="Catatan" value={f.notes} onChangeText={(v) => set("notes", v)} placeholder="Opsional, cth. suka konsep outdoor" multiline />
      </KeyboardAwareScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]}>
        <ErrorText text={err} />
        <Button testID="client-save-button" title={key ? "Simpan Perubahan" : "Simpan Klien"} loading={saving} onPress={save} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
}));
