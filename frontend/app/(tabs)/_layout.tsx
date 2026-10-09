import { Platform } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import Ionicons from "@react-native-vector-icons/ionicons";
import { usesNativeTabs } from "@/src/navigation";
import { useAuth } from "@/src/auth";
import { useTheme } from "@/src/theme";

const TABS = [
  { name: "home", label: "Beranda", icon: "home", sf: "house.fill" },
  { name: "schedule", label: "Jadwal", icon: "calendar", sf: "calendar" },
  { name: "pos", label: "Kasir", icon: "wallet", sf: "creditcard.fill" },
  { name: "more", label: "Lainnya", icon: "grid", sf: "square.grid.2x2.fill" },
] as const;

export default function TabsLayout() {
  const { user, ready, can } = useAuth();
  const isAdmin = can("reports");
  const { colors } = useTheme();
  if (ready && !user) return <Redirect href="/" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name} hidden={t.name === "pos" && !isAdmin}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.label,
            href: t.name === "pos" && !isAdmin ? null : undefined,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused }) => <Ionicons name={(focused ? t.icon : `${t.icon}-outline`) as any} size={22} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
