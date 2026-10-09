import React, { useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ROLE_LABEL, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme, space } from "@/src/theme";
import { Badge, Card, Empty, ErrorText, Header, Loading } from "@/src/ui";

const PERMS = [
  { key: "booking", label: "Input Booking & Pembayaran", hint: "Buat/ubah booking, catat DP & pelunasan" },
  { key: "expense", label: "Catat Pengeluaran", hint: "Input biaya operasional & sewa" },
  { key: "reports", label: "Lihat Laporan Kasir", hint: "Laporan harian, bulanan & tahunan" },
] as const;

export default function Access() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isSuper } = useAuth();
  const { data, setData, loading } = useFetch<any[]>(isSuper ? "/users" : null);
  const [err, setErr] = useState<string | null>(null);

  if (!isSuper) return <View style={s.root}><Header back title="Hak Akses" /><Empty icon="lock-closed-outline" text="Hanya Super Admin yang dapat mengatur hak akses" /></View>;

  const toggle = async (u: any, key: string, v: boolean) => {
    setErr(null);
    const perms = { ...u.permissions, [key]: v };
    setData((data || []).map((x) => (x.id === u.id ? { ...x, permissions: perms } : x)));
    try {
      await api(`/users/${u.id}/permissions`, { method: "PUT", body: perms });
    } catch (e: any) {
      setErr(e.message);
      setData((data || []).map((x) => (x.id === u.id ? u : x)));
    }
  };
  const list = (data || []).filter((u) => u.role !== "super_admin");

  return (
    <View style={s.root}>
      <Header back title="Hak Akses" subtitle="Super Admin selalu memiliki akses penuh" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
        <ErrorText text={err} />
        {loading && !data && <Loading />}
        {list.map((u) => {
          const viewOnly = !PERMS.some((p) => u.permissions?.[p.key]);
          return (
            <Card key={u.id} testID={`access-user-${u.id}`} style={{ gap: space.sm }}>
              <View style={s.between}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{u.name}</Text>
                  <Text style={s.meta}>{ROLE_LABEL[u.sub_role]}</Text>
                </View>
                {viewOnly && <Badge label="Hanya Lihat" tone="muted" />}
              </View>
              {PERMS.map((p) => (
                <View key={p.key} style={s.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.permLabel}>{p.label}</Text>
                    <Text style={s.meta}>{p.hint}</Text>
                  </View>
                  <Switch
                    testID={`access-${p.key}-${u.id}`}
                    value={!!u.permissions?.[p.key]}
                    onValueChange={(v) => toggle(u, p.key, v)}
                    trackColor={{ true: colors.brandSecondary, false: colors.surfaceTertiary }}
                  />
                </View>
              ))}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, minHeight: 44 },
  name: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  permLabel: { fontSize: 14, fontWeight: "600", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted },
}));
