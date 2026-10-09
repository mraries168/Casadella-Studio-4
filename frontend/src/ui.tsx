import React, { useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { addDays, DAYS, MONTHS, parseYmd, today } from "@/src/api";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Header({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
      {back && (
        <Pressable testID="header-back-button" onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.brandPrimary} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Button({
  title, onPress, variant = "primary", icon, loading, disabled, testID, style,
}: {
  title: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: IconName;
  loading?: boolean; disabled?: boolean; testID: string; style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const bg = { primary: colors.brandPrimary, secondary: colors.brandTertiary, ghost: "transparent", danger: colors.surface }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandTertiary, ghost: colors.brandPrimary, danger: colors.error }[variant];
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === "danger" && { borderWidth: 1, borderColor: colors.error },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[s.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string; testID: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={s.input} {...props} />
    </View>
  );
}

export function Chip({ label, active, onPress, testID, disabled }: { label: string; active?: boolean; onPress: () => void; testID: string; disabled?: boolean }) {
  const s = useStyles();
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress} style={[s.chip, active && s.chipActive, disabled && { opacity: 0.35 }]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, alignItems: "center" }}>
      {children}
    </ScrollView>
  );
}

export function Segmented({ options, value, onChange, testID }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void; testID: string }) {
  const s = useStyles();
  return (
    <View style={s.seg} testID={testID}>
      {options.map((o) => (
        <Pressable key={o.key} testID={`${testID}-${o.key}`} onPress={() => onChange(o.key)} style={[s.segItem, value === o.key && s.segActive]}>
          <Text style={[s.segText, value === o.key && s.segTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const s = useStyles();
  if (onPress)
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
        {children}
      </Pressable>
    );
  return <View testID={testID} style={[s.card, style]}>{children}</View>;
}

export function Badge({ label, tone = "brand" }: { label: string; tone?: "brand" | "success" | "warning" | "error" | "muted" }) {
  const { colors } = useTheme();
  const map = {
    brand: [colors.brandTertiary, colors.onBrandTertiary],
    success: [colors.success, colors.onSuccess],
    warning: [colors.warning, colors.onWarning],
    error: [colors.error, colors.onError],
    muted: [colors.surfaceTertiary, colors.onSurfaceTertiary],
  }[tone];
  return (
    <View style={{ backgroundColor: map[0], paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <Text style={{ color: map[1], fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function DayStrip({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const ref = useRef<ScrollView>(null);
  const start = addDays(value, -7);
  const days = Array.from({ length: 22 }, (_, i) => addDays(start, i));
  const d = parseYmd(value);
  useEffect(() => {
    ref.current?.scrollTo({ x: 7 * 60 - 120, animated: false });
  }, [value]);
  return (
    <View style={s.strip}>
      <View style={s.stripTop}>
        <Pressable testID="day-strip-prev-week" onPress={() => onChange(addDays(value, -7))} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.brandPrimary} />
        </Pressable>
        <Text style={s.stripMonth}>{MONTHS[d.getMonth()]} {d.getFullYear()}</Text>
        <Pressable testID="day-strip-today" onPress={() => onChange(today())} hitSlop={10}>
          <Text style={s.todayLink}>Hari ini</Text>
        </Pressable>
        <Pressable testID="day-strip-next-week" onPress={() => onChange(addDays(value, 7))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
        {days.map((day) => {
          const dd = parseYmd(day);
          const active = day === value;
          return (
            <Pressable key={day} testID={`day-${day}`} onPress={() => onChange(day)} style={[s.day, active && s.dayActive]}>
              <Text style={[s.dayName, active && { color: colors.onBrandPrimary }]}>{DAYS[dd.getDay()]}</Text>
              <Text style={[s.dayNum, active && { color: colors.onBrandPrimary }]}>{dd.getDate()}</Text>
              {day === today() && <View style={[s.dot, active && { backgroundColor: colors.onBrandPrimary }]} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; testID: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={s.scrim} onPress={onClose} />
        <View testID={testID} style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={s.grabber} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable testID={`${testID}-close`} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.lg, paddingBottom: space.sm }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.brandSecondary} />
      </View>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return <ActivityIndicator testID="loading-indicator" style={{ marginTop: space.xxl }} color={colors.brandPrimary} />;
}

export function ErrorText({ text }: { text?: string | null }) {
  const s = useStyles();
  if (!text) return null;
  return <Text testID="error-message" style={s.error}>{text}</Text>;
}

export function Fab({ onPress, label, bottom, testID }: { onPress: () => void; label: string; bottom: number; testID: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.fab, { bottom, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
      <Text style={s.fabText}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const s = useStyles();
  return <Text style={s.section}>{children}</Text>;
}

const useStyles = makeStyles((c) => ({
  header: { backgroundColor: c.surface, paddingHorizontal: space.lg, paddingBottom: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, borderBottomWidth: 1, borderBottomColor: c.border },
  backBtn: { width: 36, height: 44, justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: c.onSurface, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: c.muted, marginTop: 2 },
  btn: { minHeight: 50, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.lg },
  btnText: { fontSize: 15, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, paddingHorizontal: space.md, fontSize: 15, color: c.onSurface },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, justifyContent: "center" },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary },
  chipTextActive: { color: c.onBrandPrimary },
  seg: { flexDirection: "row", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: 3 },
  segItem: { flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.sm + 3 },
  segActive: { backgroundColor: c.surface, shadowColor: c.surfaceInverse, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 13, fontWeight: "600", color: c.muted },
  segTextActive: { color: c.brandPrimary },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: c.border, shadowColor: c.surfaceInverse, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  strip: { backgroundColor: c.surface, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  stripTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md },
  stripMonth: { flex: 1, fontSize: 15, fontWeight: "700", color: c.onSurface },
  todayLink: { fontSize: 13, fontWeight: "700", color: c.brandSecondary },
  day: { width: 52, height: 64, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary, gap: 2 },
  dayActive: { backgroundColor: c.brandPrimary },
  dayName: { fontSize: 11, fontWeight: "600", color: c.muted },
  dayNum: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.brandSecondary },
  scrim: { flex: 1, backgroundColor: c.scrim },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.lg, maxHeight: "88%" },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.surfaceTertiary, alignSelf: "center", marginTop: space.sm },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.md },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  empty: { alignItems: "center", paddingVertical: space.xxl, gap: space.md },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, color: c.muted, textAlign: "center" },
  error: { color: c.error, fontSize: 13, fontWeight: "600" },
  fab: { position: "absolute", right: space.lg, height: 52, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.brandPrimary, flexDirection: "row", alignItems: "center", gap: space.sm, shadowColor: c.brandPrimary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabText: { color: c.onBrandPrimary, fontWeight: "700", fontSize: 15 },
  section: { fontSize: 13, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 0.6 },
}));
