import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { longDate, openWhatsApp, PAY_STATUS, rp, useFetch } from "@/src/api";
import { invoiceText } from "@/src/wa";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Badge, Card, ErrorText, Header, Loading, SectionTitle } from "@/src/ui";

export default function ClientDetail() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { isAdmin } = useAuth();
  const { data: c, error } = useFetch<any>(`/clients/${encodeURIComponent(String(key))}`);
  const settings = useFetch<any>("/settings");
  const [err, setErr] = useState<string | null>(null);

  if (!c) return <View style={s.root}><Header back title="Riwayat Klien" />{error ? <ErrorText text={error} /> : <Loading />}</View>;
  const studio = settings.data?.studio_name || "Casadella Photo Studio";
  const sendInvoice = async (b: any) => {
    setErr(null);
    try {
      await openWhatsApp(b.client_phone || c.phone, invoiceText(b, studio));
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <View style={s.root}>
      <Header back title={c.name} subtitle={c.phone || "Tanpa nomor"} right={isAdmin ? (
        <Pressable testID="client-edit-button" onPress={() => router.push(`/client-form?key=${encodeURIComponent(c.key)}`)} style={s.editBtn} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={colors.brandPrimary} />
        </Pressable>
      ) : undefined} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}>
        <View style={s.hero} testID="client-summary">
          {c.total_bookings > 1 && <Badge label="Pelanggan Setia" tone="success" />}
          <Text style={s.heroLabel}>Total Belanja</Text>
          <Text style={s.heroValue} testID="client-total-spent">{rp(c.total_spent)}</Text>
          <Text style={s.heroHint}>{c.total_bookings} booking · Dibayar {rp(c.total_paid)}</Text>
          <Text style={s.heroHint}>Kunjungan terakhir: {c.last_visit ? `${longDate(c.last_visit)} (${c.last_package})` : "-"}</Text>
          {!!c.favorite_package && <Text style={s.heroHint}>Paket favorit: {c.favorite_package}</Text>}
        </View>
        {!!(c.instagram || c.address || c.notes) && (
          <Card testID="client-profile-card" style={{ gap: space.sm }}>
            {!!c.instagram && <Info label="Instagram" value={c.instagram} />}
            {!!c.address && <Info label="Alamat" value={c.address} />}
            {!!c.notes && <Info label="Catatan" value={c.notes} />}
          </Card>
        )}
        <ErrorText text={err} />
        <SectionTitle>Riwayat Booking</SectionTitle>
        {c.bookings.length === 0 && <Text style={s.meta} testID="client-no-bookings">Belum ada booking untuk klien ini.</Text>}
        {c.bookings.map((b: any) => (
          <Card key={b.id} testID={`client-booking-${b.id}`} onPress={() => router.push(`/booking/${b.id}`)} style={s.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.pkg}>{b.package_name}</Text>
              <Text style={s.meta}>{longDate(b.date)} · {b.start_time}</Text>
              <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
                <Text style={s.price}>{rp(b.price)}</Text>
                <Badge label={PAY_STATUS[b.payment_status]} tone={b.payment_status === "lunas" ? "success" : b.payment_status === "dp" ? "warning" : "muted"} />
              </View>
            </View>
            <Pressable testID={`client-invoice-wa-${b.id}`} onPress={() => sendInvoice(b)} style={s.waBtn} hitSlop={6}>
              <Ionicons name="logo-whatsapp" size={20} color={colors.onBrandPrimary} />
            </Pressable>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View>
      <Text style={s.meta}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  editBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.brandTertiary },
  infoValue: { fontSize: 15, fontWeight: "600", color: c.onSurface, marginTop: 2 },
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  hero: { backgroundColor: c.brandPrimary, borderRadius: radius.lg, padding: space.xl, gap: space.xs, alignItems: "flex-start" },
  heroLabel: { color: c.brandTertiary, fontSize: 13, fontWeight: "700" },
  heroValue: { color: c.onBrandPrimary, fontSize: 28, fontWeight: "800" },
  heroHint: { color: c.brandTertiary, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  pkg: { fontSize: 15, fontWeight: "800", color: c.onSurface },
  meta: { fontSize: 13, color: c.muted },
  price: { fontSize: 14, fontWeight: "700", color: c.brandPrimary },
  waBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.success, alignItems: "center", justifyContent: "center" },
}));
