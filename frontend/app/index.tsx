import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { api, ROLE_LABEL } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { ErrorText } from "@/src/ui";

const PIN_LEN = 6;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function Login() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, ready, login } = useAuth();
  const [users, setUsers] = useState<{ id: string; name: string; sub_role: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    api("/auth/users").then(setUsers).catch((e) => setError(e.message));
  }, []);

  const submit = async (p: string) => {
    if (!selected) {
      setError("Pilih nama Anda terlebih dahulu");
      setPin("");
      return;
    }
    setBusy(true);
    try {
      await login(selected, p);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
      setError("PIN Salah");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (k: string) => {
    if (busy || !k) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setError(null);
    if (k === "del") return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, PIN_LEN);
    setPin(next);
    if (next.length === PIN_LEN) submit(next);
  };

  if (!ready) return <View style={s.root}><ActivityIndicator style={{ flex: 1 }} color={colors.brandPrimary} /></View>;
  if (user) return <Redirect href="/(tabs)/home" />;

  return (
    <View style={[s.root, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
      <Image testID="login-logo" source={require("../assets/images/logo.png")} style={s.logo} contentFit="contain" />
      <Text style={s.tag}>Sistem Internal Studio</Text>

      <Text style={s.label}>Pilih nama Anda</Text>
      <View style={{ height: 64 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
          {users.map((u) => {
            const active = selected === u.id;
            return (
              <Pressable key={u.id} testID={`login-user-${u.id}`} onPress={() => { setSelected(u.id); setPin(""); setError(null); }} style={[s.user, active && s.userActive]}>
                <Text style={[s.userName, active && { color: colors.onBrandPrimary }]} numberOfLines={1}>{u.name}</Text>
                <Text style={[s.userRole, active && { color: colors.brandTertiary }]}>{ROLE_LABEL[u.sub_role]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Animated.View style={[s.dots, shakeStyle]} testID="login-pin-dots">
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
        ))}
      </Animated.View>
      <View style={{ height: 22, alignItems: "center" }}>
        {busy ? <ActivityIndicator color={colors.brandPrimary} /> : <ErrorText text={error} />}
      </View>
      <Text style={s.tag}>PIN diatur oleh Super Admin. Lupa PIN? Hubungi Super Admin.</Text>

      <View style={s.pad}>
        {KEYS.map((k, i) => (
          <Pressable
            key={i}
            testID={k ? `login-key-${k}` : undefined}
            disabled={!k}
            onPress={() => press(k)}
            style={({ pressed }) => [s.key, !k && { backgroundColor: "transparent" }, pressed && !!k && s.keyPressed]}
          >
            {k === "del" ? <Ionicons name="backspace-outline" size={26} color={colors.brandPrimary} /> : <Text style={s.keyText}>{k}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  logo: { width: "78%", aspectRatio: 1842 / 392, alignSelf: "center" },
  tag: { textAlign: "center", color: c.muted, fontSize: 13, marginTop: space.sm, marginBottom: space.xl, letterSpacing: 1 },
  label: { fontSize: 13, fontWeight: "700", color: c.onSurfaceSecondary, paddingHorizontal: space.lg, marginBottom: space.sm },
  user: { minWidth: 120, height: 60, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, justifyContent: "center", borderWidth: 1, borderColor: c.border },
  userActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  userName: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  userRole: { fontSize: 12, color: c.muted, marginTop: 2 },
  dots: { flexDirection: "row", justifyContent: "center", gap: space.md, marginTop: space.xl, marginBottom: space.sm },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.brandSecondary },
  dotFilled: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.md, paddingHorizontal: space.xl, marginTop: "auto" },
  key: { width: "29%", height: 64, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  keyPressed: { backgroundColor: c.brandSecondary },
  keyText: { fontSize: 26, fontWeight: "600", color: c.brandPrimary },
}));
