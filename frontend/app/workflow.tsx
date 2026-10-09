import React, { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { longDate, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import Ionicons from "@react-native-vector-icons/ionicons";
import { STAGES } from "@/src/workflow";
import { makeStyles, useTheme, space } from "@/src/theme";
import { Badge, Card, Chip, ChipRow, Empty, ErrorText, Header, Loading } from "@/src/ui";

export default function Workflow() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, reload, error } = useFetch<any>("/workflow?include_completed=true");
  const [filter, setFilter] = useState("active");
  const { isSuper } = useAuth();
  const items = (data?.items || []).filter((i: any) =>
    filter === "active" ? i.stage !== "completed" : filter === "overdue" ? i.overdue : i.stage === filter);
  const count = (k: string) => data?.stages?.find((x: any) => x.key === k)?.count ?? 0;

  return (
    <View style={s.root}>
      <Header back title="Workflow Order" subtitle={data ? `${data.items.filter((i: any) => i.stage !== "completed").length} order aktif · ${data.overdue} terlambat` : undefined}
        right={isSuper ? (
          <Pressable testID="workflow-edit-labels-button" onPress={() => router.push("/workflow-labels")} hitSlop={8} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="create-outline" size={22} color={colors.brandPrimary} />
          </Pressable>
        ) : undefined} />
      <View style={s.chips}>
        <ChipRow>
          <View style={{ width: space.lg - space.sm }} />
          <Chip testID="workflow-filter-active" label="Semua Aktif" active={filter === "active"} onPress={() => setFilter("active")} />
          <Chip testID="workflow-filter-overdue" label={`Terlambat (${data?.overdue ?? 0})`} active={filter === "overdue"} onPress={() => setFilter("overdue")} />
          {STAGES.map((st) => (
            <Chip key={st.key} testID={`workflow-filter-${st.key}`} label={`${(data?.stages?.find((x: any) => x.key === st.key)?.label || st.label).replace(" - ", "").replace("{nama}", "")} (${count(st.key)})`} active={filter === st.key} onPress={() => setFilter(st.key)} />
          ))}
          <View style={{ width: space.lg - space.sm }} />
        </ChipRow>
      </View>
      {!data ? (error ? <ErrorText text={error} /> : <Loading />) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: insets.bottom + space.xl }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty icon="git-branch-outline" text="Tidak ada order di tahap ini" />}
          renderItem={({ item: b }) => (
            <Card testID={`workflow-item-${b.id}`} onPress={() => router.push(`/booking/${b.id}`)} style={[{ gap: space.xs }, b.overdue && { borderColor: colors.error }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Text style={s.client} numberOfLines={1}>{b.client_name}</Text>
                {b.overdue && <Badge label="Terlambat" tone="error" />}
              </View>
              <Text style={s.meta}>{longDate(b.date)} · {b.start_time} · {b.package_name}</Text>
              <Badge label={b.stage_label} tone={b.stage === "completed" ? "success" : "brand"} />
            </Card>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  chips: { height: 56, justifyContent: "center", backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  client: { fontSize: 15, fontWeight: "700", color: c.onSurface, flex: 1 },
  meta: { fontSize: 13, color: c.muted },
}));
