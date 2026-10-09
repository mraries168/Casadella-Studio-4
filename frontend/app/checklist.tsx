import React from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { longDate, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { DailyTasks } from "@/src/checklist";
import { useTheme, space } from "@/src/theme";
import { Button, Empty, ErrorText, Header, Loading } from "@/src/ui";

export default function Checklist() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAdmin, isSuper } = useAuth();
  const { data, setData, reload, loading, error } = useFetch<any>("/checklist/today");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header back title="Checklist Harian" subtitle={data ? longDate(data.date) : undefined} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.brandPrimary} />}
      >
        {!data && (error ? <ErrorText text={error} /> : <Loading />)}
        <DailyTasks data={data} setData={setData} reload={reload} />
        {data && data.total === 0 && !loading && <Empty icon="checkbox-outline" text={isSuper ? "Super Admin tidak memiliki checklist. Pantau tim lewat Laporan Checklist." : "Belum ada tugas hari ini"} />}
        {isAdmin && (
          <View style={{ gap: space.sm }}>
            <Button testID="checklist-report-button" title="Laporan Checklist Harian" icon="bar-chart-outline" variant="secondary" onPress={() => router.push("/checklist-report")} />
            {isSuper && <Button testID="checklist-templates-button" title="Kelola Tugas Harian" icon="list-outline" variant="ghost" onPress={() => router.push("/task-templates")} />}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
