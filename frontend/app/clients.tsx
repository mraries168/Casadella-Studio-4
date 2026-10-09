import React, { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { downloadAndShare, longDate, rp, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Badge, Button, Card, Empty, ErrorText, Header, Loading } from "@/src/ui";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function Clients() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { can } = useAuth();
  const allowed = can("booking") || can("reports");
  const { data, loading, error } = useFetch<any[]>(allowed ? "/clients" : null);
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!allowed) return <View style={s.root}><Header back title="Database Klien" /><Empty icon="lock-closed-outline" text="Anda tidak memiliki akses ke database klien" /></View>;

  const doExport = async (format: "pdf" | "xlsx") => {
    setExporting(format);
    setErr(null);
    try {
      await downloadAndShare(`/clients/export?format=${format}`, `database-klien.${format}`, format === "pdf" ? "application/pdf" : XLSX);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setExporting(null);
    }
  };
  const ql = q.trim().toLowerCase();
  const list = (data || []).filter((c) => !ql || c.name.toLowerCase().includes(ql) || (c.phone || "").includes(ql));

  return (
    <View style={s.root}>
      <Header back title="Database Klien" subtitle={data ? `${data.length} klien` : undefined} />
      <View style={s.controls}>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="clients-search-input" value={q} onChangeText={setQ} placeholder="Cari nama atau nomor" placeholderTextColor={colors.muted} style={s.searchInput} />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button testID="clients-export-pdf" title="PDF" icon="document-text-outline" variant="ghost" style={{ flex: 1 }} loading={exporting === "pdf"} onPress={() => doExport("pdf")} />
          <Button testID="clients-export-xlsx" title="Excel" icon="grid-outline" variant="ghost" style={{ flex: 1 }} loading={exporting === "xlsx"} onPress={() => doExport("xlsx")} />
        </View>
        <ErrorText text={err || error} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
        {loading && !data && <Loading />}
        {data && list.length === 0 && <Empty icon="people-outline" text="Belum ada klien" />}
        {list.map((c) => (
          <Card key={c.key} testID={`client-${c.key}`} onPress={() => router.push(`/client/${encodeURIComponent(c.key)}`)} style={{ gap: space.xs }}>
            <View style={s.between}>
              <Text style={s.name} numberOfLines={1}>{c.name}</Text>
              {c.total_bookings > 1 && <Badge label={`${c.total_bookings}x booking`} tone="success" />}
            </View>
            <Text style={s.meta}>{c.phone || "Tanpa nomor"}</Text>
            <Text style={s.meta}>
              {c.last_visit ? `Terakhir: ${longDate(c.last_visit)} · ${c.last_package}` : `Booking mendatang: ${c.next_booking ? longDate(c.next_booking) : "-"}`}
            </Text>
            <Text style={s.spent}>Total belanja {rp(c.total_spent)}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  controls: { backgroundColor: c.surface, padding: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: space.md, height: 48 },
  searchInput: { flex: 1, fontSize: 15, color: c.onSurface },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  name: { fontSize: 16, fontWeight: "800", color: c.onSurface, flex: 1 },
  meta: { fontSize: 13, color: c.muted },
  spent: { fontSize: 13, fontWeight: "700", color: c.brandPrimary, marginTop: 2 },
}));
