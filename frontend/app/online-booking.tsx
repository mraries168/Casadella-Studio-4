import React, { useState } from "react";
import { ScrollView, Share, Text, View, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFetch } from "@/src/api";
import { makeStyles, radius, space } from "@/src/theme";
import { Badge, Button, Card, Empty, Header, SectionTitle } from "@/src/ui";

const LINK = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/book`;

export default function OnlineBooking() {
  const s = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useFetch<any>("/settings");
  const pending = useFetch<any[]>("/bookings?status=pending");
  const [msg, setMsg] = useState<string | null>(null);
  const studio = settings.data?.studio_name || "Casadella Photo Studio";
  const text = `Booking sesi foto di ${studio} sekarang bisa online! Pilih paket & jam yang Anda mau di sini:\n${LINK}`;

  const share = async () => {
    setMsg(null);
    if (Platform.OS === "web") {
      await (globalThis as any).navigator?.clipboard?.writeText(LINK).catch(() => {});
      setMsg("Link disalin");
      return;
    }
    await Share.share({ message: text });
  };

  return (
    <View style={s.root}>
      <Header back title="Link Booking Online" subtitle="Klien memilih paket & jam sendiri" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: insets.bottom + space.xl }}>
        <View style={s.hero} testID="online-booking-link-card">
          <Text style={s.heroLabel}>Link booking studio</Text>
          <Text style={s.link} selectable testID="online-booking-link">{LINK}</Text>
          <Text style={s.heroHint}>Bagikan di WhatsApp, Instagram bio, atau Google Maps. Booking masuk sebagai &ldquo;Menunggu Konfirmasi&rdquo; dan slot langsung terkunci.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button testID="online-booking-share-button" title={Platform.OS === "web" ? "Salin Link" : "Bagikan"} icon="share-social-outline" style={{ flex: 1 }} onPress={share} />
          <Button testID="online-booking-open-button" title="Buka" icon="open-outline" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(LINK)} />
        </View>
        <Button testID="online-booking-wa-button" title="Kirim via WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`)} />
        {!!msg && <Text style={s.ok} testID="online-booking-message">{msg}</Text>}

        <SectionTitle>Menunggu Konfirmasi ({(pending.data || []).length})</SectionTitle>
        {!pending.loading && (pending.data || []).length === 0 && <Empty icon="checkmark-done-outline" text="Tidak ada booking online yang menunggu" />}
        {(pending.data || []).map((b) => (
          <Card key={b.id} testID={`online-pending-${b.id}`} onPress={() => router.push(`/booking/${b.id}`)} style={{ gap: space.xs }}>
            <View style={s.between}>
              <Text style={s.name}>{b.client_name}</Text>
              <Badge label="Menunggu" tone="warning" />
            </View>
            <Text style={s.meta}>{b.date} · {b.start_time}–{b.end_time} · {b.package_name}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  hero: { backgroundColor: c.brandPrimary, borderRadius: radius.lg, padding: space.xl, gap: space.sm },
  heroLabel: { color: c.brandTertiary, fontSize: 13, fontWeight: "700" },
  link: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  heroHint: { color: c.brandTertiary, fontSize: 12, lineHeight: 17 },
  ok: { color: c.success, fontWeight: "700", fontSize: 13 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface, flex: 1 },
  meta: { fontSize: 13, color: c.muted },
}));
