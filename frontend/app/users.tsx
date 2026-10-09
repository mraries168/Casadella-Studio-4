import React, { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ROLE_LABEL, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme, space, radius } from "@/src/theme";
import { Badge, Button, Card, Chip, ChipRow, Empty, ErrorText, Fab, Field, Header, Loading, SectionTitle, Sheet } from "@/src/ui";

const ACCESS: Record<string, string> = {
  super_admin: "Hak akses & pengaturan sistem",
  admin1: "Ubah klien, jadwal & pembayaran",
  admin2: "Ubah klien, jadwal & pembayaran",
  photographer: "Hanya-baca",
  editor: "Hanya-baca",
};

export default function Users() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSuper, user } = useAuth();
  const { data, loading, reload } = useFetch<any[]>("/users");
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!isSuper) return <View style={s.root}><Header back title="Staff & Hak Akses" /><Empty icon="lock-closed-outline" text="Hanya Super Admin yang dapat mengakses halaman ini" /></View>;

  const save = async () => {
    if (!edit.name.trim()) return setErr("Nama wajib diisi");
    if (!edit.id && !/^\d{6}$/.test(edit.pin)) return setErr("PIN harus 6 digit angka");
    if (edit.pin && !/^\d{6}$/.test(edit.pin)) return setErr("PIN harus 6 digit angka");
    setBusy(true);
    try {
      await api(edit.id ? `/users/${edit.id}` : "/users", { method: edit.id ? "PUT" : "POST", body: { name: edit.name, sub_role: edit.sub_role, enabled: edit.enabled, pin: edit.pin || null, phone: edit.phone || "" } });
      setEdit(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api(`/users/${edit.id}`, { method: "DELETE" });
      setEdit(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const groups = ["super_admin", "admin1", "admin2", "photographer", "editor"];
  return (
    <View style={s.root}>
      <Header back title="Staff & Hak Akses" subtitle="Tambah fotografer, editor & admin" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + 96 }}>
        {loading && !data && <Loading />}
        {groups.map((g) => {
          const list = (data || []).filter((u) => u.sub_role === g);
          if (!list.length) return null;
          return (
            <View key={g} style={{ gap: space.sm }}>
              <SectionTitle>{ROLE_LABEL[g]} · {ACCESS[g]}</SectionTitle>
              {list.map((u) => (
                <Card key={u.id} testID={`user-${u.id}`} onPress={() => { setErr(null); setEdit({ ...u, pin: "" }); }} style={s.row}>
                  <View style={s.avatar}><Text style={s.avatarText}>{u.name[0]}</Text></View>
                  <Text style={s.name}>{u.name}{u.id === user?.id ? " (Anda)" : ""}</Text>
                  {!u.enabled && <Badge label="Nonaktif" tone="muted" />}
                </Card>
              ))}
            </View>
          );
        })}
      </ScrollView>
      <Fab testID="user-add-fab" label="Staff" bottom={insets.bottom + space.lg} onPress={() => { setErr(null); setEdit({ name: "", sub_role: "photographer", pin: "", enabled: true }); }} />
      <Sheet testID="user-sheet" visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah Staff" : "Staff Baru"}>
        {edit && (
          <>
            <Field testID="user-name-input" label="Nama" value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} />
            <Field testID="user-phone-input" label="No. WhatsApp (untuk slip gaji)" keyboardType="phone-pad" value={edit.phone || ""} onChangeText={(v) => setEdit({ ...edit, phone: v })} placeholder="08xxxxxxxxxx" />
            <SectionTitle>Peran / Hak Akses</SectionTitle>
            <ChipRow>
              {groups.map((g) => <Chip key={g} testID={`user-role-${g}`} label={ROLE_LABEL[g]} active={edit.sub_role === g} onPress={() => setEdit({ ...edit, sub_role: g })} />)}
            </ChipRow>
            <Text style={s.hint}>{ACCESS[edit.sub_role]}</Text>
            <Field testID="user-pin-input" label={edit.id ? "PIN baru (kosongkan jika tidak diubah)" : "PIN (6 digit)"} keyboardType="number-pad" secureTextEntry maxLength={6} value={edit.pin} onChangeText={(v) => setEdit({ ...edit, pin: v.replace(/\D/g, "") })} />
            <View style={s.between}>
              <Text style={s.name}>Akun aktif</Text>
              <Switch testID="user-enabled-switch" value={edit.enabled} onValueChange={(v) => setEdit({ ...edit, enabled: v })} trackColor={{ true: colors.brandSecondary, false: colors.surfaceTertiary }} />
            </View>
            <ErrorText text={err} />
            <Button testID="user-save-button" title="Simpan" loading={busy} onPress={save} />
            {edit.id && edit.id !== user?.id && <Button testID="user-delete-button" title="Hapus Staff" variant="danger" onPress={remove} />}
          </>
        )}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: c.brandPrimary, fontWeight: "800", fontSize: 16 },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: c.onSurface },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { fontSize: 13, color: c.muted },
}));
