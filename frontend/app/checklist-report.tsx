import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { ROLE_LABEL, today, useFetch } from "@/src/api";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { DayStrip, Empty, ErrorText, Header, Loading } from "@/src/ui";

export default function ChecklistReport() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(today());
  const { data, error } = useFetch<any>(`/reports/checklist?date=${date}`);

  return (
    <View style={s.root}>
      <Header back title="Laporan Checklist" subtitle="Tugas selesai vs belum per staff" />
      <DayStrip value={date} onChange={setDate} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}>
        {!data && (error ? <ErrorText text={error} /> : <Loading />)}
        {data && (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={[s.metric, { borderLeftColor: colors.success }]}>
              <Text style={s.mLabel}>Selesai</Text>
              <Text style={s.mValue} testID="report-completed">{data.completed}</Text>
            </View>
            <View style={[s.metric, { borderLeftColor: colors.error }]}>
              <Text style={s.mLabel}>Belum Selesai</Text>
              <Text style={s.mValue} testID="report-pending">{data.pending}</Text>
            </View>
          </View>
        )}
        {data && data.staff.length === 0 && <Empty icon="people-outline" text="Belum ada staff" />}
        {(data?.staff || []).map((x: any) => (
          <View key={x.user_id} style={s.card} testID={`report-staff-${x.user_id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{x.name}</Text>
                <Text style={s.meta}>{ROLE_LABEL[x.sub_role]} · {x.completed} selesai · {x.pending} belum</Text>
              </View>
            </View>
            <View style={[s.note, x.status === "great" ? { backgroundColor: colors.success } : x.status === "lazy" ? { backgroundColor: colors.error } : { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[s.noteText, { color: x.status === "great" ? colors.onSuccess : x.status === "lazy" ? colors.onError : colors.onSurfaceTertiary }]} testID={`report-note-${x.user_id}`}>{x.note}</Text>
            </View>
            {x.items.map((i: any, k: number) => (
              <View key={k} style={s.item}>
                <Ionicons name={i.done ? "checkmark-circle" : "close-circle"} size={18} color={i.done ? colors.success : colors.error} />
                <Text style={[s.itemText, i.done && { color: colors.muted }]}>{i.title}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  metric: { flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg, borderLeftWidth: 4, borderWidth: 1, borderColor: c.border },
  mLabel: { fontSize: 12, color: c.muted, fontWeight: "600" },
  mValue: { fontSize: 24, fontWeight: "800", color: c.onSurface, marginTop: 4 },
  card: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: space.lg, gap: space.sm },
  name: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  meta: { fontSize: 12, color: c.muted, marginTop: 2 },
  note: { borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  noteText: { fontSize: 13, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", gap: space.sm },
  itemText: { fontSize: 13, color: c.onSurface, flex: 1 },
}));
