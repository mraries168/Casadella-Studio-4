import React, { useState } from "react";
import { Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { api, longDate, rp, useFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, useTheme, radius, space } from "@/src/theme";
import { Button, ErrorText, Field, SectionTitle, Sheet } from "@/src/ui";

export const STAGES: { key: string; label: string }[] = [
  { key: "order_received", label: "Order Received!" },
  { key: "payment_received", label: "Payment Received!" },
  { key: "check_schedule", label: "Check Schedule" },
  { key: "client_arrived", label: "Klien Tiba di Studio" },
  { key: "photo_session", label: "Photo Session" },
  { key: "editing", label: "Editing in Progress" },
  { key: "awaiting_final", label: "Menunggu Pelunasan" },
  { key: "addon", label: "Add-on Order Received!" },
  { key: "completed", label: "{nama} - Paid in Full" },
];
export const stageIndex = (k: string) => STAGES.findIndex((s) => s.key === k);

// Live stage texts (editable by Super Admin); falls back to defaults while loading.
export function useStageLabels() {
  const { data } = useFetch<{ key: string; label: string }[]>("/workflow/labels");
  const map: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
  (data || []).forEach((x) => (map[x.key] = x.label));
  return map;
}

type Action = { action: string; title: string; icon: any };

function actionsFor(b: any, user: any, canBook: boolean): Action[] {
  const st = b.stage;
  const photog = canBook || (user?.sub_role === "photographer" && (!b.photographer_id || b.photographer_id === user?.id));
  const editor = canBook || (user?.sub_role === "editor" && (!b.editor_id || b.editor_id === user?.id));
  const out: Action[] = [];
  if (canBook && ["order_received", "payment_received"].includes(st)) out.push({ action: "check_schedule", title: "Jadwal Dicek", icon: "calendar-outline" });
  if (canBook && ["order_received", "payment_received", "check_schedule"].includes(st)) out.push({ action: "client_arrived", title: "Klien Datang", icon: "walk-outline" });
  if (photog && st === "client_arrived") out.push({ action: "start_session", title: "Mulai Sesi Foto", icon: "camera-outline" });
  if (photog && st === "photo_session") out.push({ action: "finish_session", title: "Selesai Foto", icon: "checkmark-done-outline" });
  if (editor && st === "editing") out.push({ action: "finish_editing", title: "Selesai Edit", icon: "color-wand-outline" });
  if (canBook && ["awaiting_final", "addon"].includes(st)) out.push({ action: "complete_order", title: "Order Complete", icon: "trophy-outline" });
  return out;
}

export function WorkflowCard({ b, onChange }: { b: any; onChange: (nb: any) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { user, can } = useAuth();
  const canBook = can("booking");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [addon, setAddon] = useState<{ open: boolean; name: string; price: string }>({ open: false, name: "", price: "" });
  const labels = useStageLabels();
  const cur = stageIndex(b.stage);
  const actions = actionsFor(b, user, canBook);
  const canAddon = canBook && ["awaiting_final", "addon"].includes(b.stage);

  const act = async (action: string) => {
    setErr(null);
    setBusy(action);
    try {
      onChange(await api(`/bookings/${b.id}/stage`, { method: "POST", body: { action } }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };
  const saveAddon = async () => {
    setErr(null);
    setBusy("addon");
    try {
      onChange(await api(`/bookings/${b.id}/addons`, { method: "POST", body: { name: addon.name, price: Number(addon.price) } }));
      setAddon({ open: false, name: "", price: "" });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={s.card} testID="workflow-card">
      <View style={s.head}>
        <Text style={s.title}>Workflow Order</Text>
        <Text style={[s.current, b.overdue && { color: colors.error }]} testID="workflow-stage-label">
          {b.stage_label}{b.overdue ? " · Terlambat" : ""}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        {STAGES.map((st, i) => {
          if (st.key === "addon" && !(b.addons || []).length) return null;
          const done = i < cur || b.stage === "completed";
          const now = i === cur && b.stage !== "completed";
          return (
            <View key={st.key} style={s.step} testID={`workflow-step-${st.key}`}>
              <View style={[s.dot, done && { backgroundColor: colors.success, borderColor: colors.success }, now && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
                {done && <Ionicons name="checkmark" size={12} color={colors.onSuccess} />}
              </View>
              <Text style={[s.stepText, done && s.stepDone, now && s.stepNow]}>
                {labels[st.key].replace("{nama}", b.client_name)}
              </Text>
            </View>
          );
        })}
      </View>
      {b.edit_deadline && <Text style={s.meta} testID="workflow-edit-deadline">Deadline edit: {longDate(b.edit_deadline)}{b.edit_done_by ? ` · selesai oleh ${b.edit_done_by}` : ""}</Text>}
      {b.photo_done_by && <Text style={s.meta}>Sesi foto selesai oleh {b.photo_done_by}</Text>}
      {(b.addons || []).length > 0 && (
        <View style={{ gap: space.xs }}>
          <SectionTitle>Add-on</SectionTitle>
          {b.addons.map((a: any, i: number) => (
            <View key={i} style={s.addonRow} testID={`addon-row-${i}`}>
              <Text style={s.addonName}>{a.name}</Text>
              <Text style={s.addonPrice}>{rp(a.price)}</Text>
            </View>
          ))}
        </View>
      )}
      {actions.map((a) => (
        <Button key={a.action} testID={`workflow-action-${a.action}`} title={a.title} icon={a.icon}
          variant={a.action === "complete_order" ? "primary" : "secondary"} loading={busy === a.action} disabled={!!busy} onPress={() => act(a.action)} />
      ))}
      {canAddon && <Button testID="workflow-add-addon-button" title="Tambah Add-on" icon="add-circle-outline" variant="ghost" onPress={() => setAddon({ ...addon, open: true })} />}
      {!addon.open && <ErrorText text={err} />}

      <Sheet testID="addon-sheet" visible={addon.open} onClose={() => setAddon({ ...addon, open: false })} title="Tambah Add-on">
        <Text style={s.meta}>Harga add-on ditambahkan ke total tagihan klien.</Text>
        <Field testID="addon-name-input" label="Nama Add-on" value={addon.name} onChangeText={(v) => setAddon({ ...addon, name: v })} placeholder="mis. Cetak 10R + Frame" />
        <Field testID="addon-price-input" label="Harga (Rp)" keyboardType="number-pad" value={addon.price} onChangeText={(v) => setAddon({ ...addon, price: v.replace(/\D/g, "") })} placeholder="0" />
        <ErrorText text={err} />
        <Button testID="addon-save-button" title="Simpan Add-on" loading={busy === "addon"} disabled={!addon.name.trim() || !Number(addon.price)} onPress={saveAddon} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: space.lg, gap: space.md },
  head: { gap: 2 },
  title: { fontSize: 13, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  current: { fontSize: 18, fontWeight: "800", color: c.brandPrimary },
  step: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 26 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 13, color: c.muted },
  stepDone: { color: c.onSurfaceSecondary },
  stepNow: { color: c.brandPrimary, fontWeight: "800" },
  meta: { fontSize: 12, color: c.muted },
  addonRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  addonName: { fontSize: 14, color: c.onSurface, flex: 1 },
  addonPrice: { fontSize: 14, fontWeight: "700", color: c.onSurface },
}));
