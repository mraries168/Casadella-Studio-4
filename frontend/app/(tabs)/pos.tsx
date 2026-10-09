import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { addDays, api, CATEGORY_LABEL, downloadAndShare, fileUrl, longDate, METHOD_LABEL, MONTHS, parseYmd, rp, today, useFetch, ymd } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Button, Empty, ErrorText, Fab, Header, Segmented, SectionTitle, Sheet } from "@/src/ui";

type Period = "daily" | "monthly" | "yearly";

function range(period: Period, date: string) {
  const d = parseYmd(date);
  if (period === "daily") return { start: date, end: date, label: longDate(date) };
  if (period === "monthly") {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), end: ymd(last), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  }
  return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `Tahun ${d.getFullYear()}` };
}

function shift(period: Period, date: string, dir: number) {
  if (period === "daily") return addDays(date, dir);
  const d = parseYmd(date);
  if (period === "monthly") return ymd(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  return ymd(new Date(d.getFullYear() + dir, 0, 1));
}

export default function Pos() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { can, isSuper } = useAuth();
  const isAdmin = can("reports");
  const [period, setPeriod] = useState<Period>("daily");
  const [date, setDate] = useState(today());
  const [pendingDel, setPendingDel] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const r = range(period, date);
  const rep = useFetch<any>(isAdmin ? `/reports?period=${period}&date=${date}` : null);
  const tx = useFetch<any[]>(isAdmin ? `/transactions?start=${r.start}&end=${r.end}` : null);
  const pk = useFetch<any[]>(isAdmin ? `/reports/packages?period=${period}&date=${date}` : null);
  const refresh = () => { rep.reload(); tx.reload(); pk.reload(); };
  const R = rep.data;
  const del = async (id: string) => {
    try {
      await api(`/transactions/${id}`, { method: "DELETE" });
      setPendingDel(null);
      refresh();
    } catch {
      setPendingDel(null);
    }
  };
  const doExport = async (format: "pdf" | "xlsx") => {
    setExporting(format);
    setExportErr(null);
    try {
      const key = R?.key || date;
      await downloadAndShare(
        `/reports/export?period=${period}&date=${date}&format=${format}`,
        `laporan-${period}-${key}.${format}`,
        format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch (e: any) {
      setExportErr(e.message);
    } finally {
      setExporting(null);
    }
  };

  if (!isAdmin)
    return (
      <View style={s.root}>
        <Header title="Kasir & Laporan" />
        <Empty icon="lock-closed-outline" text="Anda tidak memiliki akses melihat laporan kasir" />
      </View>
    );

  return (
    <View style={s.root}>
      <Header title="Kasir & Laporan" subtitle="Pemasukan, pengeluaran & omzet" />
      <View style={s.controls}>
        <Segmented
          testID="report-period"
          value={period}
          onChange={(k) => setPeriod(k as Period)}
          options={[{ key: "daily", label: "Harian" }, { key: "monthly", label: "Bulanan" }, { key: "yearly", label: "Tahunan" }]}
        />
        <View style={s.nav}>
          <Pressable testID="report-prev" onPress={() => setDate(shift(period, date, -1))} style={s.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.brandPrimary} />
          </Pressable>
          <Text style={s.navLabel} testID="report-period-label">{r.label}</Text>
          <Pressable testID="report-next" onPress={() => setDate(shift(period, date, 1))} style={s.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: bottomChrome + 96 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.brandPrimary} />}
      >
        <ErrorText text={rep.error || tx.error} />
        {R && (
          <>
            <View style={s.net} testID="report-net-card">
              <Text style={s.netLabel}>Laba Bersih</Text>
              <Text style={s.netValue} testID="report-net-income" numberOfLines={1} adjustsFontSizeToFit>{rp(R.net_profit)}</Text>
              <Text style={s.netHint}>Pemasukan − Pengeluaran · {R.booking_count} booking · {R.transaction_count} transaksi</Text>
            </View>
            <View style={s.grid}>
              <View style={s.box}>
                <Ionicons name="stats-chart" size={18} color={colors.brandSecondary} />
                <Text style={s.boxLabel}>Total Omzet</Text>
                <Text style={s.boxValue} testID="report-turnover" numberOfLines={1} adjustsFontSizeToFit>{rp(R.turnover)}</Text>
              </View>
              <View style={s.box}>
                <Ionicons name="trending-up" size={18} color={colors.success} />
                <Text style={s.boxLabel}>Total Pemasukan</Text>
                <Text style={s.boxValue} testID="report-revenue" numberOfLines={1} adjustsFontSizeToFit>{rp(R.income)}</Text>
              </View>
            </View>
            <View style={s.split}>
              <Row label="DP (Uang Muka)" value={rp(R.dp_total)} testID="report-dp" />
              <View style={s.divider} />
              <Row label="Pelunasan" value={rp(R.pelunasan_total)} testID="report-pelunasan" />
              <View style={s.divider} />
              <Row label="Pemasukan Lain" value={rp(R.other_income)} testID="report-other-income" />
            </View>
            <View style={s.split}>
              <Row label="Biaya Operasional" value={rp(R.operational)} testID="report-operational" />
              <View style={s.divider} />
              <Row label="Biaya Sewa" value={rp(R.rental)} testID="report-rental" />
              <View style={s.divider} />
              <Row label="Total Pengeluaran" value={rp(R.expenses)} testID="report-expenses" />
            </View>
            {can("expense") && <Button testID="pos-add-expense-button" title="Catat Pengeluaran" icon="remove-circle-outline" variant="secondary" onPress={() => router.push("/transaction?type=expense")} />}
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button testID="export-pdf-button" title="Unduh PDF" icon="document-text-outline" variant="ghost" style={{ flex: 1 }} loading={exporting === "pdf"} onPress={() => doExport("pdf")} />
              <Button testID="export-xlsx-button" title="Unduh Excel" icon="grid-outline" variant="ghost" style={{ flex: 1 }} loading={exporting === "xlsx"} onPress={() => doExport("xlsx")} />
            </View>
            <ErrorText text={exportErr} />
            {!!pk.data?.length && (
              <View style={{ gap: space.sm }} testID="package-popularity">
                <SectionTitle>Paket Terlaris</SectionTitle>
                <View style={s.split}>
                  {pk.data.map((p, i) => (
                    <View key={p.package_name} style={[s.pkRow, i > 0 && s.pkBorder]} testID={`popular-package-${i}`}>
                      <View style={[s.rank, i === 0 && { backgroundColor: colors.brandPrimary }]}>
                        <Text style={[s.rankText, i === 0 && { color: colors.onBrandPrimary }]}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={s.row0}>
                          <Text style={s.pkName} numberOfLines={1}>{p.package_name}</Text>
                          <Text style={s.pkCount}>{p.count}x · {rp(p.revenue)}</Text>
                        </View>
                        <View style={s.bar}><View style={[s.barFill, { width: `${Math.max(p.share, 4)}%` }]} /></View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        <SectionTitle>Transaksi</SectionTitle>
        {tx.data && tx.data.length === 0 && <Empty icon="receipt-outline" text="Belum ada transaksi pada periode ini" />}
        {(tx.data || []).map((t) => {
          const inc = t.type === "income";
          return (
            <View key={t.id} style={s.tx} testID={`tx-${t.id}`}>
              <View style={[s.txIcon, { backgroundColor: inc ? colors.brandTertiary : colors.surfaceSecondary }]}>
                <Ionicons name={inc ? "arrow-down" : "arrow-up"} size={18} color={inc ? colors.success : colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.txTitle} numberOfLines={1}>{t.description || CATEGORY_LABEL[t.category]}</Text>
                <Text style={s.txMeta}>{t.payment_type ? (t.payment_type === "dp" ? "DP" : "Pelunasan") : CATEGORY_LABEL[t.category]} · {METHOD_LABEL[t.method] || "-"} · {t.date}</Text>
              </View>
              {!!t.receipt_path && (
                <Pressable testID={`tx-receipt-${t.id}`} onPress={() => setReceipt(t.receipt_path)} hitSlop={10}>
                  <Ionicons name="image-outline" size={20} color={colors.brandSecondary} />
                </Pressable>
              )}
              <Text style={[s.txAmt, { color: inc ? colors.success : colors.error }]}>{inc ? "+" : "−"}{rp(t.amount)}</Text>
              {isSuper && (pendingDel === t.id ? (
                <Pressable testID={`tx-delete-confirm-${t.id}`} onPress={() => del(t.id)} style={s.delConfirm}>
                  <Text style={s.delText}>Hapus?</Text>
                </Pressable>
              ) : (
                <Pressable testID={`tx-delete-${t.id}`} onPress={() => setPendingDel(t.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
      {(can("booking") || can("expense")) && <Fab testID="pos-add-transaction-fab" label="Transaksi" bottom={bottomChrome + space.lg} onPress={() => router.push(can("booking") ? "/transaction" : "/transaction?type=expense")} />}
      <Sheet testID="receipt-sheet" visible={!!receipt} onClose={() => setReceipt(null)} title="Bukti Struk">
        {!!receipt && <Image testID="receipt-image" source={{ uri: fileUrl(receipt) }} style={s.receiptImg} contentFit="contain" />}
      </Sheet>
    </View>
  );
}

function Row({ label, value, testID }: { label: string; value: string; testID: string }) {
  const s = useStyles();
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} testID={testID}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  controls: { backgroundColor: c.surface, padding: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: c.brandTertiary },
  navLabel: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  net: { backgroundColor: c.brandPrimary, borderRadius: radius.lg, padding: space.xl, gap: space.xs },
  netLabel: { color: c.brandTertiary, fontSize: 13, fontWeight: "700" },
  netValue: { color: c.onBrandPrimary, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  netHint: { color: c.brandTertiary, fontSize: 12 },
  grid: { flexDirection: "row", gap: space.md },
  box: { flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg, gap: space.xs, borderWidth: 1, borderColor: c.border },
  boxLabel: { fontSize: 12, color: c.muted, fontWeight: "600" },
  boxValue: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  split: { backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: space.lg, borderWidth: 1, borderColor: c.border },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: space.md },
  rowLabel: { fontSize: 14, color: c.onSurfaceSecondary },
  rowValue: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  divider: { height: 1, backgroundColor: c.border },
  tx: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: c.surface, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txTitle: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  txMeta: { fontSize: 12, color: c.muted, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: "800" },
  delConfirm: { backgroundColor: c.error, paddingHorizontal: space.sm, height: 32, borderRadius: radius.sm, justifyContent: "center" },
  delText: { color: c.onError, fontSize: 12, fontWeight: "700" },
  receiptImg: { width: "100%", height: 420, borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  pkRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  pkBorder: { borderTopWidth: 1, borderTopColor: c.border },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 13, fontWeight: "800", color: c.brandPrimary },
  row0: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  pkName: { flex: 1, fontSize: 14, fontWeight: "700", color: c.onSurface },
  pkCount: { fontSize: 12, fontWeight: "700", color: c.muted },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.surfaceSecondary, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: c.brandSecondary },
}));
