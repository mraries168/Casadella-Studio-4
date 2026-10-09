import React, { useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dmyhm, rp, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, space } from "@/src/theme";
import { Badge, Card, Chip, Empty, ErrorText, Header, Loading } from "@/src/ui";

const FILTERS = [
  { key: "", label: "Semua" },
  { key: "booking", label: "Booking" },
  { key: "payment", label: "Pembayaran" },
  { key: "package", label: "Harga Paket" },
  { key: "client", label: "Klien" },
];
const ACTION: Record<string, [string, "brand" | "success" | "warning" | "error" | "muted"]> = {
  create: ["Baru", "success"], update: ["Ubah", "brand"], delete: ["Hapus", "error"], cancel: ["Batal", "error"],
  approve: ["Setujui", "success"], reject: ["Tolak", "warning"],
};
const fmt = (v: any, field: string) => (v == null || v === "" ? "-" : field === "Harga" ? rp(Number(v)) : typeof v === "boolean" ? (v ? "Ya" : "Tidak") : String(v));
const when = dmyhm;

export default function Audit() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { isSuper } = useAuth();
  const [entity, setEntity] = useState("");
  const { data, loading, error, reload } = useFetch<any[]>(isSuper ? `/audit${entity ? `?entity=${entity}` : ""}` : null);

  if (!isSuper) return <View style={s.root}><Header back title="Riwayat Perubahan" /><Empty icon="lock-closed-outline" text="Hanya Super Admin yang dapat melihat riwayat perubahan" /></View>;

  return (
    <View style={s.root}>
      <Header back title="Riwayat Perubahan" subtitle="Siapa mengubah booking, pembayaran & harga" />
      <View style={s.chips}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, alignItems: "center" }}>
          {FILTERS.map((f) => <Chip key={f.key || "all"} testID={`audit-filter-${f.key || "all"}`} label={f.label} active={entity === f.key} onPress={() => setEntity(f.key)} />)}
        </ScrollView>
      </View>
      <FlatList
        data={data || []}
        keyExtractor={(x) => x.id}
        onRefresh={reload}
        refreshing={false}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
        ListHeaderComponent={<ErrorText text={error} />}
        ListEmptyComponent={loading ? <Loading /> : <Empty icon="document-text-outline" text="Belum ada perubahan tercatat" />}
        renderItem={({ item }) => {
          const a = ACTION[item.action] || [item.action, "muted"];
          return (
            <Card testID={`audit-${item.id}`} style={{ gap: space.xs }}>
              <View style={s.between}>
                <Badge label={a[0]} tone={a[1]} />
                <Text style={s.meta}>{when(item.created_at)}</Text>
              </View>
              <Text style={s.summary}>{item.summary}</Text>
              {(item.changes || []).map((c: any, i: number) => (
                <Text key={i} style={s.change}>
                  {c.field}: <Text style={s.from}>{fmt(c.from, c.field)}</Text> → <Text style={s.to}>{fmt(c.to, c.field)}</Text>
                </Text>
              ))}
              <Text style={s.actor}>oleh {item.actor}</Text>
            </Card>
          );
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  chips: { height: 56, justifyContent: "center", backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontSize: 12, color: c.muted },
  summary: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  change: { fontSize: 13, color: c.onSurfaceSecondary },
  from: { color: c.muted, textDecorationLine: "line-through" },
  to: { fontWeight: "700", color: c.brandPrimary },
  actor: { fontSize: 12, color: c.brandSecondary, fontWeight: "700" },
}));
