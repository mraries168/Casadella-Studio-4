import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, useFetch } from "@/src/api";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Button, Empty, ErrorText, Field, Header, Loading, SectionTitle, Segmented } from "@/src/ui";

const ROLES = [{ key: "admin", label: "Admin" }, { key: "photographer", label: "Fotografer" }, { key: "editor", label: "Editor" }];

export default function TaskTemplates() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, reload, error } = useFetch<any[]>("/task-templates");
  const [role, setRole] = useState("admin");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = (data || []).filter((t) => t.role === role);

  const add = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api("/task-templates", { method: "POST", body: { title, role, target: Math.max(1, Number(target) || 1) } });
      setTitle("");
      setTarget("1");
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    setErr(null);
    try {
      await api(`/task-templates/${id}`, { method: "DELETE" });
      setConfirm(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <View style={s.root}>
      <Header back title="Kelola Tugas Harian" subtitle="Checklist per peran" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}>
        <Segmented testID="template-role" value={role} onChange={(k) => { setRole(k); setConfirm(null); }} options={ROLES} />
        <Text style={s.hint}>
          {role === "photographer" ? "Pekerjaan foto otomatis dibuat saat booking diterima. Tambahkan tugas rutin lain di sini." :
            role === "editor" ? "Pekerjaan edit otomatis dibuat saat fotografer menekan Selesai (deadline 3 hari kerja). Tambahkan tugas rutin lain di sini." :
              "Tugas dengan target > 1 memakai tombol +1 dan selesai otomatis saat target tercapai."}
        </Text>
        {!data && (error ? <ErrorText text={error} /> : <Loading />)}
        {data && list.length === 0 && <Empty icon="list-outline" text="Belum ada tugas untuk peran ini" />}
        {list.map((t) => (
          <View key={t.id} style={s.row} testID={`template-${t.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{t.title}</Text>
              <Text style={s.meta}>{t.target > 1 ? `Target ${t.target}x per hari` : "Sekali per hari"}</Text>
            </View>
            {confirm === t.id ? (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Pressable testID={`template-delete-confirm-${t.id}`} onPress={() => remove(t.id)} style={s.confirm} hitSlop={6}><Text style={s.confirmText}>Hapus</Text></Pressable>
                <Pressable testID={`template-delete-abort-${t.id}`} onPress={() => setConfirm(null)} style={s.iconBtn} hitSlop={6}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
              </View>
            ) : (
              <Pressable testID={`template-delete-${t.id}`} onPress={() => setConfirm(t.id)} style={s.iconBtn} hitSlop={6}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            )}
          </View>
        ))}
        <SectionTitle>Tambah Tugas</SectionTitle>
        <Field testID="template-title-input" label="Nama Tugas" value={title} onChangeText={setTitle} placeholder="mis. Rapikan studio" />
        <Field testID="template-target-input" label="Target per hari" keyboardType="number-pad" value={target} onChangeText={(v) => setTarget(v.replace(/\D/g, ""))} />
        <ErrorText text={err} />
        <Button testID="template-add-button" title="Tambah Tugas" icon="add-circle-outline" loading={busy} disabled={title.trim().length < 2} onPress={add} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  hint: { fontSize: 13, color: c.muted, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: space.md },
  title: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted, marginTop: 2 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  confirm: { height: 44, paddingHorizontal: space.md, borderRadius: radius.sm, backgroundColor: c.error, justifyContent: "center" },
  confirmText: { color: c.onError, fontWeight: "700" },
}));
