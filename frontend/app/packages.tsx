import React, { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, rp, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme, space } from "@/src/theme";
import { Badge, Button, Card, ErrorText, Fab, Field, Header, Loading, Sheet } from "@/src/ui";

const EMPTY = { name: "", description: "", duration_min: "30", price: "", active: true };

export default function Packages() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const { data, loading, reload } = useFetch<any[]>("/packages");
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const dur = Number(edit.duration_min);
    if (!edit.name.trim() || !Number(edit.price) || dur < 15 || dur % 15 !== 0) return setErr("Lengkapi nama, harga & durasi (kelipatan 15 menit)");
    setBusy(true);
    try {
      const body = { ...edit, duration_min: dur, price: Number(edit.price) };
      await api(edit.id ? `/packages/${edit.id}` : "/packages", { method: edit.id ? "PUT" : "POST", body });
      setEdit(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    await api(`/packages/${edit.id}`, { method: "DELETE" });
    setEdit(null);
    reload();
  };

  return (
    <View style={s.root}>
      <Header back title="Paket Foto" subtitle={isAdmin ? "Ketuk paket untuk mengubah" : "Hanya-baca"} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + 96 }}>
        {loading && !data && <Loading />}
        {(data || []).map((p) => (
          <Card key={p.id} testID={`package-${p.id}`} onPress={isAdmin ? () => { setErr(null); setEdit({ ...p, duration_min: String(p.duration_min), price: String(p.price) }); } : undefined} style={{ gap: space.xs }}>
            <View style={s.between}>
              <Text style={s.name}>{p.name}</Text>
              {!p.active && <Badge label="Nonaktif" tone="muted" />}
            </View>
            <Text style={s.meta}>{p.description}</Text>
            <View style={s.between}>
              <Text style={s.dur}>{p.duration_min} menit</Text>
              <Text style={s.price}>{rp(p.price)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
      {isAdmin && <Fab testID="package-add-fab" label="Paket" bottom={insets.bottom + space.lg} onPress={() => { setErr(null); setEdit({ ...EMPTY }); }} />}
      <Sheet testID="package-sheet" visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah Paket" : "Paket Baru"}>
        {edit && (
          <>
            <Field testID="package-name-input" label="Nama Paket" value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} />
            <Field testID="package-desc-input" label="Deskripsi" value={edit.description} onChangeText={(v) => setEdit({ ...edit, description: v })} />
            <Field testID="package-duration-input" label="Durasi (menit, kelipatan 15)" keyboardType="number-pad" value={edit.duration_min} onChangeText={(v) => setEdit({ ...edit, duration_min: v.replace(/\D/g, "") })} />
            <Field testID="package-price-input" label="Harga (Rp)" keyboardType="number-pad" value={edit.price} onChangeText={(v) => setEdit({ ...edit, price: v.replace(/\D/g, "") })} />
            <View style={s.between}>
              <Text style={s.name}>Aktif</Text>
              <Switch testID="package-active-switch" value={edit.active} onValueChange={(v) => setEdit({ ...edit, active: v })} trackColor={{ true: colors.brandSecondary, false: colors.surfaceTertiary }} />
            </View>
            <ErrorText text={err} />
            <Button testID="package-save-button" title="Simpan" loading={busy} onPress={save} />
            {edit.id && <Button testID="package-delete-button" title="Hapus Paket" variant="danger" onPress={remove} />}
          </>
        )}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  meta: { fontSize: 13, color: c.muted },
  dur: { fontSize: 13, fontWeight: "600", color: c.brandSecondary },
  price: { fontSize: 16, fontWeight: "800", color: c.brandPrimary },
}));
