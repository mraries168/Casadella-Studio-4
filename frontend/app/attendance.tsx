import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hhmm, ROLE_LABEL, today, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, space } from "@/src/theme";
import { Badge, Card, DayStrip, Empty, Header, Loading, Segmented } from "@/src/ui";
import { MonthNav } from "@/src/month-nav";

function duration(a?: string, b?: string | null) {
  if (!a || !b) return null;
  const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  return `${Math.floor(m / 60)} j ${m % 60} m`;
}

export default function Attendance() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState<"daily" | "monthly">("daily");
  const [month, setMonth] = useState(today().slice(0, 8) + "01");
  const { data, loading } = useFetch<any[]>(`/attendance?date=${date}`);
  const recap = useFetch<any[]>(isAdmin && mode === "monthly" ? `/attendance/monthly?month=${month.slice(0, 7)}` : null);

  return (
    <View style={s.root}>
      <Header back title="Absensi Staff" subtitle={isAdmin ? "Semua staff" : "Riwayat absensi Anda"} />
      {isAdmin && (
        <View style={s.controls}>
          <Segmented testID="attendance-mode" value={mode} onChange={(k) => setMode(k as any)} options={[{ key: "daily", label: "Harian" }, { key: "monthly", label: "Rekap Bulanan" }]} />
          {mode === "monthly" && <MonthNav month={month} onChange={setMonth} />}
        </View>
      )}
      {mode === "monthly" ? (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
          {recap.loading && !recap.data && <Loading />}
          {(recap.data || []).map((r) => (
            <Card key={r.user_id} testID={`recap-${r.user_id}`} style={{ gap: space.sm }}>
              <View style={s.between}>
                <Text style={s.name}>{r.name}</Text>
                <Badge label={ROLE_LABEL[r.sub_role]} />
              </View>
              <View style={s.stats}>
                <Stat label="Hari Kerja" value={String(r.days_worked)} />
                <Stat label="Terlambat" value={`${r.late_count}x · ${r.late_minutes} mnt`} warn={r.late_count > 0} />
                <Stat label="Lembur" value={`${Math.floor(r.overtime_minutes / 60)} j ${r.overtime_minutes % 60} m`} />
              </View>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <>
          <DayStrip value={date} onChange={setDate} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
        {loading && !data && <Loading />}
        {data && data.length === 0 && <Empty icon="time-outline" text="Belum ada absensi pada tanggal ini" />}
        {(data || []).map((a) => (
          <Card key={a.id} testID={`attendance-${a.id}`} style={{ gap: space.sm }}>
            <View style={s.between}>
              <Text style={s.name}>{a.name}</Text>
              <Badge label={ROLE_LABEL[a.sub_role]} />
            </View>
            <View style={s.between}>
              <Text style={s.meta}>Masuk <Text style={s.time}>{hhmm(a.clock_in)}</Text></Text>
              <Text style={s.meta}>Pulang <Text style={s.time}>{hhmm(a.clock_out)}</Text></Text>
              <Text style={s.meta}>{duration(a.clock_in, a.clock_out) || "Sedang bekerja"}</Text>
            </View>
            {a.clock_in_distance_m != null && (
              <Text style={s.meta} testID={`attendance-distance-${a.id}`}>
                Jarak dari studio: masuk {a.clock_in_distance_m} m{a.clock_out_distance_m != null ? ` · pulang ${a.clock_out_distance_m} m` : ""}
              </Text>
            )}
          </Card>
        ))}
      </ScrollView>
        </>
      )}
    </View>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const s = useStyles();
  return (
    <View style={s.stat}>
      <Text style={s.meta}>{label}</Text>
      <Text style={[s.statValue, warn && s.warn]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  controls: { backgroundColor: c.surface, padding: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  stats: { flexDirection: "row", gap: space.sm },
  stat: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: 8, padding: space.sm, gap: 2 },
  statValue: { fontSize: 13, fontWeight: "800", color: c.onSurface },
  warn: { color: c.error },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  meta: { fontSize: 13, color: c.muted },
  time: { fontWeight: "800", color: c.brandPrimary },
}));
