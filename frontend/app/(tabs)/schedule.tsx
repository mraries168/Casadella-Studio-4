import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { longDate, PAY_STATUS, rp, today, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Badge, Card, DayStrip, Empty, ErrorText, Fab, Header, Loading } from "@/src/ui";

export default function Schedule() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { can } = useAuth();
  const isAdmin = can("booking");
  const [date, setDate] = useState(today());
  const { data, loading, error, reload } = useFetch<any[]>(`/bookings?date=${date}`);
  const list = data || [];

  return (
    <View style={s.root}>
      <Header title="Jadwal" subtitle={longDate(date)} />
      <DayStrip value={date} onChange={setDate} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: bottomChrome + 96 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.brandPrimary} />}
      >
        <Text style={s.count} testID="schedule-count">{list.filter((b) => b.status !== "cancelled").length} booking · Studio buka 09:00–20:00</Text>
        <ErrorText text={error} />
        {loading && !data ? <Loading /> : list.length === 0 ? <Empty icon="calendar-clear-outline" text="Tidak ada booking pada tanggal ini" /> : null}
        {list.map((b) => {
          const cancelled = b.status === "cancelled";
          return (
            <Card key={b.id} testID={`booking-card-${b.id}`} onPress={() => router.push(`/booking/${b.id}`)} style={[s.card, cancelled && { opacity: 0.5 }]}>
              <View style={[s.bar, { height: Math.max(48, b.duration_min * 1.2) }]} />
              <View style={{ flex: 1, gap: space.xs }}>
                <View style={s.top}>
                  <Text style={s.time}>{b.start_time} – {b.end_time}</Text>
                  {cancelled ? <Badge label="Dibatalkan" tone="error" /> : b.status === "pending" ? <Badge label="Menunggu Konfirmasi" tone="warning" /> : (
                    <Badge label={PAY_STATUS[b.payment_status]} tone={b.payment_status === "lunas" ? "success" : b.payment_status === "dp" ? "warning" : "muted"} />
                  )}
                </View>
                <Text style={s.client}>{b.client_name}</Text>
                <Text style={s.meta}>{b.package_name} · {b.duration_min} menit · {rp(b.price)}</Text>
                <View style={s.crew}>
                  <Ionicons name="camera-outline" size={14} color={colors.muted} />
                  <Text style={s.meta}>{b.photographer_name || "-"}</Text>
                  <Ionicons name="color-palette-outline" size={14} color={colors.muted} style={{ marginLeft: space.sm }} />
                  <Text style={s.meta}>{b.editor_name || "-"}</Text>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
      {isAdmin && <Fab testID="schedule-new-booking-fab" label="Booking" bottom={bottomChrome + space.lg} onPress={() => router.push(`/booking/form?date=${date}`)} />}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  count: { fontSize: 13, color: c.muted, fontWeight: "600" },
  card: { flexDirection: "row", gap: space.md, padding: space.md },
  bar: { width: 4, borderRadius: radius.pill, backgroundColor: c.brandSecondary },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { fontSize: 15, fontWeight: "800", color: c.brandPrimary },
  client: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  meta: { fontSize: 13, color: c.muted },
  crew: { flexDirection: "row", alignItems: "center", gap: 4 },
}));
