import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { ROLE_LABEL } from "@/src/api";
import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Button, Header, IconName, SectionTitle } from "@/src/ui";

export default function More() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const router = useRouter();
  const { user, isSuper, isAdmin, can, logout } = useAuth();
  const access = isSuper
    ? "Akses penuh: hak akses, pengaturan & hapus transaksi"
    : [can("booking") && "Booking & pembayaran", can("expense") && "Catat pengeluaran", can("reports") && "Lihat laporan"].filter(Boolean).join(" · ") || "Akses hanya-lihat";

  return (
    <View style={s.root}>
      <Header title="Lainnya" />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: bottomChrome + space.xl }}>
        <View style={s.profile} testID="profile-card">
          <View style={s.avatar}><Text style={s.avatarText}>{user?.name?.[0]}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name}</Text>
            <Text style={s.role}>{ROLE_LABEL[user?.sub_role || ""]}</Text>
            <Text style={s.access}>{access}</Text>
          </View>
        </View>
        <SectionTitle>Studio</SectionTitle>
        <View style={s.group}>
          <Item icon="images-outline" label="Paket Foto" testID="menu-packages" onPress={() => router.push("/packages")} />
          {(can("booking") || can("reports")) && <Item icon="people-circle-outline" label="Database Klien" testID="menu-clients" onPress={() => router.push("/clients")} />}
          <Item icon="checkbox-outline" label="Checklist Harian" testID="menu-checklist" onPress={() => router.push("/checklist")} />
          {isAdmin && <Item icon="git-branch-outline" label="Workflow Order" testID="menu-workflow" onPress={() => router.push("/workflow")} />}
          {isAdmin && <Item icon="bar-chart-outline" label="Laporan Checklist" testID="menu-checklist-report" onPress={() => router.push("/checklist-report")} />}
          <Item icon="time-outline" label="Absensi Staff" testID="menu-attendance" onPress={() => router.push("/attendance")} />
          {can("booking") && <Item icon="link-outline" label="Link Booking Online" testID="menu-online-booking" onPress={() => router.push("/online-booking")} />}
        </View>
        {isSuper && (
          <>
            <SectionTitle>Super Admin</SectionTitle>
            <View style={s.group}>
              <Item icon="people-outline" label="Staff & PIN" testID="menu-users" onPress={() => router.push("/users")} />
              <Item icon="key-outline" label="Hak Akses" testID="menu-access" onPress={() => router.push("/access")} />
              <Item icon="list-outline" label="Kelola Tugas Harian" testID="menu-task-templates" onPress={() => router.push("/task-templates")} />
              <Item icon="text-outline" label="Teks Workflow" testID="menu-workflow-labels" onPress={() => router.push("/workflow-labels")} />
              <Item icon="wallet-outline" label="Penggajian" testID="menu-payroll" onPress={() => router.push("/payroll")} />
              <Item icon="document-text-outline" label="Riwayat Perubahan" testID="menu-audit" onPress={() => router.push("/audit")} />
              <Item icon="settings-outline" label="Pengaturan Sistem" testID="menu-settings" onPress={() => router.push("/settings")} />
            </View>
          </>
        )}
        <Button testID="logout-button" title="Keluar" icon="log-out-outline" variant="danger" onPress={logout} />
      </ScrollView>
    </View>
  );
}

function Item({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.surfaceSecondary }]}>
      <View style={s.itemIcon}><Ionicons name={icon} size={20} color={colors.brandPrimary} /></View>
      <Text style={s.itemLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  profile: { flexDirection: "row", gap: space.md, alignItems: "center", backgroundColor: c.surface, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: c.onBrandPrimary, fontSize: 22, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "800", color: c.onSurface },
  role: { fontSize: 13, color: c.brandSecondary, fontWeight: "700", marginTop: 2 },
  access: { fontSize: 12, color: c.muted, marginTop: 2 },
  group: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 56 },
  itemIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: c.onSurface },
}));
