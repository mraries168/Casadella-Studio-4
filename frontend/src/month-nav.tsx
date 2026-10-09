import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { MONTHS, parseYmd, ymd } from "@/src/api";
import { makeStyles, useTheme, radius } from "@/src/theme";

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const d = parseYmd(month);
  const go = (n: number) => onChange(ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  return (
    <View style={s.nav}>
      <Pressable testID="month-prev" onPress={() => go(-1)} style={s.navBtn}><Ionicons name="chevron-back" size={20} color={colors.brandPrimary} /></Pressable>
      <Text style={s.navLabel} testID="month-label">{MONTHS[d.getMonth()]} {d.getFullYear()}</Text>
      <Pressable testID="month-next" onPress={() => go(1)} style={s.navBtn}><Ionicons name="chevron-forward" size={20} color={colors.brandPrimary} /></Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: c.brandTertiary },
  navLabel: { fontSize: 15, fontWeight: "700", color: c.onSurface },
}));
