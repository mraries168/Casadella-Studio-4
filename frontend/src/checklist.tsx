import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, longDate } from "@/src/api";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Badge, Button, ErrorText, SectionTitle } from "@/src/ui";

// Daily tasks + photo/edit jobs for the logged-in worker. Used on Home dashboard and /checklist.
export function DailyTasks({ data, setData, reload }: { data: any; setData: (d: any) => void; reload: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (key: string, path: string, body?: any) => {
    setErr(null);
    setBusy(key);
    try {
      const r = await api(path, { method: "POST", body });
      if (r?.tasks) setData(r);
      else reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const pct = data?.total ? Math.round((data.completed / data.total) * 100) : 0;
  if (!data?.total) return null;

  return (
    <View style={{ gap: space.sm }} testID="daily-tasks">
      <View style={s.progress} testID="checklist-progress">
        <Text style={s.progTitle}>Tugas Hari Ini · {data.completed}/{data.total}</Text>
        <View style={s.bar}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
        <Text style={s.progSub} testID="checklist-progress-note">
          {data.completed === data.total ? "Great job! Semua tugas selesai." : `${data.total - data.completed} tugas belum selesai`}
        </Text>
      </View>
      <ErrorText text={err} />

      {(data.tasks || []).length > 0 && <SectionTitle>Checklist Harian</SectionTitle>}
      {(data.tasks || []).map((t: any) => (
        <View key={t.template_id} style={[s.row, t.done && s.rowDone]} testID={`task-${t.template_id}`}>
          <Ionicons name={t.done ? "checkmark-circle" : "ellipse-outline"} size={26} color={t.done ? colors.success : colors.borderStrong} />
          <View style={{ flex: 1 }}>
            <Text style={[s.title, t.done && s.titleDone]}>{t.title}</Text>
            <Text style={s.meta} testID={`task-count-${t.template_id}`}>
              {t.done ? `${t.count} tercatat · target min. ${t.target} tercapai` : `${t.count}/${t.target} · minimal ${t.target}, boleh lebih`}
            </Text>
            {t.auto === "booking" && <Text style={s.auto} testID={`task-auto-${t.template_id}`}>Otomatis +1 setiap booking baru dibuat</Text>}
          </View>
          {!t.auto && <Button testID={`task-increment-${t.template_id}`} title="+1" variant={t.done ? "secondary" : "primary"} style={s.smallBtn} loading={busy === t.template_id} disabled={!!busy} onPress={() => run(t.template_id, `/checklist/${t.template_id}/increment`)} />}
        </View>
      ))}

      {(data.jobs || []).length > 0 && <SectionTitle>Pekerjaan {data.jobs[0].kind === "photo" ? "Foto" : "Edit"}</SectionTitle>}
      {(data.jobs || []).map((j: any) => {
        const action = j.kind === "photo"
          ? (j.stage === "client_arrived" ? { a: "start_session", t: "Mulai Sesi" } : j.stage === "photo_session" ? { a: "finish_session", t: "Selesai" } : null)
          : (j.stage === "editing" ? { a: "finish_editing", t: "Selesai" } : null);
        return (
          <Pressable key={j.booking_id} testID={`job-${j.booking_id}`} onPress={() => router.push(`/booking/${j.booking_id}`)} style={[s.job, j.done && s.rowDone, j.overdue && { borderColor: colors.error }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Text style={[s.title, { flex: 1 }]}>{j.client_name}</Text>
              {j.done ? <Badge label="Selesai" tone="success" /> : j.overdue ? <Badge label="Lewat deadline" tone="error" /> : <Badge label={j.stage_label} tone="warning" />}
            </View>
            <Text style={s.meta}>{j.package_name} · {j.kind === "photo" ? `${longDate(j.date)} ${j.start_time}` : `Diterima ${j.received ? longDate(j.received) : "-"}`}</Text>
            {j.kind === "edit" && j.due && <Text style={[s.meta, j.overdue && { color: colors.error }]}>Deadline: {longDate(j.due)} (maks. 3 hari kerja)</Text>}
            <Text style={s.meta}>Ditugaskan: {j.assignee_name}{j.done_by ? ` · diselesaikan ${j.done_by}` : ""}</Text>
            {!j.done && action && (
              <Button testID={`job-action-${j.booking_id}`} title={action.t} icon="checkmark-done-outline" loading={busy === j.booking_id} disabled={!!busy}
                onPress={() => run(j.booking_id, `/bookings/${j.booking_id}/stage`, { action: action.a })} />
            )}
            {!j.done && !action && j.kind === "photo" && <Text style={s.hint}>Menunggu admin menandai klien datang</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  progress: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: space.lg, gap: space.sm },
  progTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  progSub: { fontSize: 13, color: c.muted },
  bar: { height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: c.success },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: space.md },
  rowDone: { opacity: 0.75 },
  title: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  titleDone: { textDecorationLine: "line-through", color: c.muted },
  meta: { fontSize: 12, color: c.muted, marginTop: 2 },
  hint: { fontSize: 12, color: c.warning, fontWeight: "600" },
  auto: { fontSize: 12, color: c.brandSecondary, fontWeight: "700", marginTop: 2 },
  smallBtn: { minHeight: 40, paddingHorizontal: space.md },
  job: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: space.md, gap: space.xs },
}));
