import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, useFetch } from "@/src/api";
import { makeStyles, space } from "@/src/theme";
import { Button, ErrorText, Field, Header, Loading } from "@/src/ui";

export default function WorkflowLabels() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { data, setData, error } = useFetch<{ key: string; label: string; default: string }[]>("/workflow/labels");
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data) setF(Object.fromEntries(data.map((x) => [x.key, x.label])));
  }, [data]);

  const save = async () => {
    setMsg(null);
    if (Object.values(f).some((v) => !v.trim())) return setMsg({ ok: false, text: "Teks tidak boleh kosong" });
    setBusy(true);
    try {
      setData(await api("/workflow/labels", { method: "PUT", body: f }));
      setMsg({ ok: true, text: "Teks workflow tersimpan" });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <Header back title="Teks Workflow" subtitle="Ubah label tiap tahap order" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}>
        <Text style={s.hint}>Gunakan {"{nama}"} untuk menampilkan nama klien, mis. {"\u201C{nama} - Paid in Full\u201D"}.</Text>
        {!data && (error ? <ErrorText text={error} /> : <Loading />)}
        {(data || []).map((x, i) => (
          <View key={x.key} style={{ gap: space.xs }}>
            <Field testID={`label-input-${x.key}`} label={`${i + 1}. Tahap`} value={f[x.key] ?? ""} maxLength={80}
              onChangeText={(v) => { setMsg(null); setF({ ...f, [x.key]: v }); }} />
            {f[x.key] !== x.default && (
              <Text testID={`label-reset-${x.key}`} style={s.reset} onPress={() => setF({ ...f, [x.key]: x.default })}>Kembalikan ke default: {x.default}</Text>
            )}
          </View>
        ))}
        {msg && (msg.ok ? <Text style={s.ok} testID="labels-saved-message">{msg.text}</Text> : <ErrorText text={msg.text} />)}
        {data && <Button testID="labels-save-button" title="Simpan Teks" loading={busy} onPress={save} />}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  hint: { fontSize: 13, color: c.muted, lineHeight: 18 },
  reset: { fontSize: 12, color: c.brandSecondary, fontWeight: "600" },
  ok: { fontSize: 13, color: c.success, fontWeight: "700" },
}));
