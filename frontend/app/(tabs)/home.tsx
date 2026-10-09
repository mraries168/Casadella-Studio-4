import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { addDays, api, hhmm, longDate, openWhatsApp, PAY_STATUS, ROLE_LABEL, rp, today, useFetch } from "@/src/api";
import { reminderText } from "@/src/wa";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { useAttendanceLocation } from "@/src/location";
import { DailyTasks } from "@/src/checklist";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Badge, Button, Card, Empty, ErrorText, SectionTitle } from "@/src/ui";

export default function Home() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { user, can, isAdmin: isAdminRole } = useAuth();
  const isAdmin = can("reports");
  const checklist = useFetch<any>("/checklist/today");
  const wf = useFetch<any>(isAdminRole ? "/workflow" : null);
  const late = useFetch<any>(isAdminRole ? "/attendance/late-today" : null);
  const d = today();
  const att = useFetch<any>("/attendance/today");
  const bookings = useFetch<any[]>(`/bookings?date=${d}`);
  const rep = useFetch<any>(isAdmin ? `/reports?period=daily&date=${d}` : null);
  const tmr = useFetch<any[]>(can("booking") ? `/bookings?date=${addDays(d, 1)}` : null);
  const settings = useFetch<any>("/settings");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const tomorrow = (tmr.data || []).filter((b) => b.status !== "cancelled");
  const remind = async (b: any) => {
    setErr(null);
    try {
      await openWhatsApp(b.client_phone, reminderText(b, settings.data?.studio_name || "Casadella Photo Studio"));
      setSent({ ...sent, [b.id]: true });
    } catch (e: any) {
      setErr(`${b.client_name}: ${e.message}`);
    }
  };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loc = useAttendanceLocation();
  const pending = useFetch<any[]>(can("booking") ? "/bookings?status=pending" : null);

  const clock = async (kind: "in" | "out") => {
    setBusy(true);
    setErr(null);
    try {
      let body: any = undefined;
      if (settings.data?.geofence_enabled !== false) {
        const c = await loc.getCoords();
        if (!c) throw new Error("Izin lokasi diperlukan untuk absensi");
        body = c;
      }
      att.setData(await api(`/attendance/clock-${kind}`, { method: "POST", body }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => { att.reload(); bookings.reload(); rep.reload(); tmr.reload(); pending.reload(); checklist.reload(); wf.reload(); late.reload(); };
  const activeStages = (wf.data?.stages || []).filter((x: any) => x.count > 0 && x.key !== "completed");
  const active = (bookings.data || []).filter((b) => b.status !== "cancelled");
  const waiting = pending.data || [];

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + space.md }]}>
        <Image source={require("../../assets/images/logo.png")} style={s.logo} contentFit="contain" />
        <Badge label={ROLE_LABEL[user?.sub_role || ""] || ""} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: bottomChrome + space.xl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.brandPrimary} />}
      >
        <View>
          <Text style={s.hello} testID="home-greeting">Halo, {user?.name}</Text>
          <Text style={s.date}>{longDate(d)}</Text>
        </View>

        <Card testID="attendance-card" style={s.attCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={s.attIcon}><Ionicons name="finger-print" size={24} color={colors.onBrandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.attTitle}>Absensi Hari Ini</Text>
              <Text style={s.attSub} testID="attendance-status">
                Masuk {hhmm(att.data?.clock_in)} · Pulang {hhmm(att.data?.clock_out)}
              </Text>
              {settings.data?.geofence_enabled !== false && (
                <Text style={s.attSub} testID="attendance-geofence-hint">Wajib di studio · radius {settings.data?.attendance_radius_m ?? 100} m</Text>
              )}
            </View>
          </View>
          {!att.data?.clock_in ? (
            <Button testID="clock-in-button" title="Absen Masuk" icon="log-in-outline" variant="secondary" loading={busy} onPress={() => clock("in")} />
          ) : !att.data?.clock_out ? (
            <Button testID="clock-out-button" title="Absen Pulang" icon="log-out-outline" variant="secondary" loading={busy} onPress={() => clock("out")} />
          ) : (
            <Text style={s.attDone}>Terima kasih, absensi hari ini selesai.</Text>
          )}
          <ErrorText text={err} />
        </Card>

        <DailyTasks data={checklist.data} setData={checklist.setData} reload={checklist.reload} />

        {isAdminRole && wf.data && (
          <View style={{ gap: space.sm }}>
            <SectionTitle>Workflow Order</SectionTitle>
            <Card testID="home-workflow-card" onPress={() => router.push("/workflow")} style={{ gap: space.sm }}>
              <View style={s.between}>
                <Text style={s.client}>{wf.data.items.length} order aktif</Text>
                {wf.data.overdue > 0 ? <Badge label={`${wf.data.overdue} terlambat`} tone="error" /> : <Badge label="Semua on track" tone="success" />}
              </View>
              {activeStages.length === 0 && <Text style={s.meta}>Belum ada order berjalan</Text>}
              {activeStages.map((x: any) => (
                <View key={x.key} style={s.between} testID={`home-stage-${x.key}`}>
                  <Text style={s.meta}>{x.label}</Text>
                  <Text style={s.stageCount}>{x.count}</Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {isAdminRole && late.data && (
          <View style={{ gap: space.sm }}>
            <SectionTitle>Staff Terlambat Hari Ini ({late.data.items.length})</SectionTitle>
            {late.data.items.length === 0 ? (
              <Card testID="home-late-empty"><Text style={s.meta}>Semua staff tepat waktu (jam masuk {late.data.work_start}).</Text></Card>
            ) : late.data.items.map((x: any) => (
              <Card key={x.user_id} testID={`home-late-${x.user_id}`} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.client}>{x.name}</Text>
                  <Text style={s.meta}>{ROLE_LABEL[x.sub_role]} · {x.status === "late" ? `masuk ${hhmm(x.clock_in)}` : "belum absen"}</Text>
                </View>
                <Badge label={x.status === "late" ? `Telat ${x.late_minutes} mnt` : "Belum absen"} tone={x.status === "late" ? "warning" : "error"} />
              </Card>
            ))}
          </View>
        )}

        {isAdmin && rep.data && (
          <View style={{ gap: space.sm }}>
            <SectionTitle>Ringkasan Kasir Hari Ini</SectionTitle>
            <View style={s.grid}>
              <Metric label="Omzet" value={rp(rep.data.turnover)} tone={colors.brandSecondary} testID="home-revenue" />
              <Metric label="Pengeluaran" value={rp(rep.data.expenses)} tone={colors.error} testID="home-expenses" />
            </View>
            <Metric label="Laba Bersih" value={rp(rep.data.net_income)} tone={colors.success} testID="home-net" />
          </View>
        )}

        {(can("booking") || can("expense")) && (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {can("booking") && <Button testID="home-new-booking-button" title="Booking Baru" icon="add-circle-outline" style={{ flex: 1 }} onPress={() => router.push(`/booking/form?date=${d}`)} />}
            {can("expense") && <Button testID="home-add-expense-button" title="Pengeluaran" icon="remove-circle-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push("/transaction?type=expense")} />}
          </View>
        )}

        {can("booking") && waiting.length > 0 && (
          <View style={{ gap: space.sm }}>
            <SectionTitle>Booking Online Menunggu Konfirmasi ({waiting.length})</SectionTitle>
            {waiting.map((b) => (
              <Card key={b.id} testID={`pending-${b.id}`} onPress={() => router.push(`/booking/${b.id}`)} style={s.row}>
                <View style={s.time}>
                  <Text style={s.timeText}>{b.start_time}</Text>
                  <Text style={s.timeEnd}>{b.date.slice(8)}/{b.date.slice(5, 7)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.client}>{b.client_name}</Text>
                  <Text style={s.meta}>{b.package_name}</Text>
                </View>
                <Badge label="Menunggu" tone="warning" />
              </Card>
            ))}
          </View>
        )}

        {can("booking") && tomorrow.length > 0 && (
          <View style={{ gap: space.sm }}>
            <SectionTitle>Pengingat Sesi Besok ({tomorrow.length})</SectionTitle>
            {tomorrow.map((b) => (
              <Card key={b.id} testID={`reminder-${b.id}`} onPress={() => router.push(`/booking/${b.id}`)} style={s.row}>
                <View style={s.time}>
                  <Text style={s.timeText}>{b.start_time}</Text>
                  <Text style={s.timeEnd}>Besok</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.client}>{b.client_name}</Text>
                  <Text style={s.meta}>{b.package_name}</Text>
                </View>
                <Pressable testID={`reminder-wa-${b.id}`} onPress={() => remind(b)} style={[s.waBtn, sent[b.id] && { backgroundColor: colors.brandSecondary }]} hitSlop={6}>
                  <Ionicons name={sent[b.id] ? "checkmark" : "logo-whatsapp"} size={20} color={colors.onBrandPrimary} />
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        <SectionTitle>Jadwal Hari Ini ({active.length})</SectionTitle>
        {!bookings.loading && active.length === 0 && <Empty icon="calendar-outline" text="Belum ada jadwal hari ini" />}
        {active.map((b) => (
          <Card key={b.id} testID={`home-booking-${b.id}`} onPress={() => router.push(`/booking/${b.id}`)} style={s.row}>
            <View style={s.time}>
              <Text style={s.timeText}>{b.start_time}</Text>
              <Text style={s.timeEnd}>{b.end_time}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.client}>{b.client_name}</Text>
              <Text style={s.meta}>{b.package_name}</Text>
              {b.status === "confirmed" && <Text style={s.stageText} testID={`home-booking-stage-${b.id}`}>{b.stage_label}</Text>}
            </View>
            {b.status === "pending" ? <Badge label="Menunggu" tone="warning" /> : (
              <Badge label={PAY_STATUS[b.payment_status]} tone={b.payment_status === "lunas" ? "success" : b.payment_status === "dp" ? "warning" : "muted"} />
            )}
          </Card>
        ))}
      </ScrollView>
      {loc.sheet}
    </View>
  );
}

function Metric({ label, value, tone, testID }: { label: string; value: string; tone: string; testID: string }) {
  const s = useStyles();
  return (
    <View style={[s.metric, { borderLeftColor: tone }]}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue} testID={testID} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { backgroundColor: c.surface, paddingHorizontal: space.lg, paddingBottom: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: c.border },
  logo: { width: 150, height: 32 },
  hello: { fontSize: 24, fontWeight: "800", color: c.onSurface, letterSpacing: -0.4 },
  date: { fontSize: 14, color: c.muted, marginTop: 2 },
  attCard: { gap: space.md, backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  attIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  attTitle: { fontSize: 16, fontWeight: "800", color: c.onBrandPrimary },
  attSub: { fontSize: 13, color: c.brandTertiary, marginTop: 2 },
  attDone: { color: c.brandTertiary, fontSize: 13, fontWeight: "600" },
  grid: { flexDirection: "row", gap: space.sm },
  metric: { flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg, borderLeftWidth: 4, borderWidth: 1, borderColor: c.border },
  metricLabel: { fontSize: 12, color: c.muted, fontWeight: "600" },
  metricValue: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  time: { width: 56, alignItems: "center", paddingVertical: space.xs, borderRadius: radius.sm, backgroundColor: c.brandTertiary },
  timeText: { fontSize: 15, fontWeight: "800", color: c.brandPrimary },
  timeEnd: { fontSize: 11, color: c.onBrandTertiary },
  client: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  meta: { fontSize: 13, color: c.muted },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  stageCount: { fontSize: 15, fontWeight: "800", color: c.brandPrimary },
  stageText: { fontSize: 12, fontWeight: "700", color: c.brandSecondary },
  waBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.success, alignItems: "center", justifyContent: "center" },
}));
