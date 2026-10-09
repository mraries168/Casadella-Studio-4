import React, { useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { api, CATEGORY_LABEL, METHOD_LABEL, rp, today, uploadImage } from "@/src/api";
import { useAuth } from "@/src/auth";
import { makeStyles, radius, space } from "@/src/theme";
import { Button, Chip, ChipRow, DayStrip, ErrorText, Field, Header, Segmented, SectionTitle } from "@/src/ui";

const CATS = { income: ["penjualan", "lainnya"], expense: ["operasional", "sewa"] } as const;

export default function NewTransaction() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { can: canPerm } = useAuth();
  const initType = params.type === "expense" || !canPerm("booking") ? "expense" : "income";
  const [type, setType] = useState<"income" | "expense">(initType);
  const [category, setCategory] = useState<string>(CATS[initType][0]);
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { can } = useAuth();
  const [receipt, setReceipt] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [perm, setPerm] = useState<null | "explain" | "blocked">(null);

  const setAsset = (a: ImagePicker.ImagePickerAsset) =>
    setReceipt({ uri: a.uri, name: a.fileName || `struk-${Date.now()}.jpg`, type: a.mimeType || "image/jpeg" });
  const pickGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled) setAsset(r.assets[0]);
  };
  const shoot = async () => {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled) setAsset(r.assets[0]);
  };
  const openCamera = async () => {
    const p = await ImagePicker.getCameraPermissionsAsync();
    if (p.granted) return shoot();
    setPerm(p.canAskAgain ? "explain" : "blocked");
  };
  const askCamera = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (p.granted) {
      setPerm(null);
      shoot();
    } else setPerm(p.canAskAgain ? "explain" : "blocked");
  };

  const save = async () => {
    if (!Number(amount)) return setErr("Nominal wajib diisi");
    setBusy(true);
    try {
      const receipt_path = type === "expense" && receipt ? await uploadImage(receipt.uri, receipt.name, receipt.type) : null;
      await api("/transactions", { method: "POST", body: { type, category, method, amount: Number(amount), description, date, receipt_path } });
      router.back();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <Header back title="Transaksi Baru" subtitle="Catat pemasukan atau pengeluaran" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: space.lg, gap: space.lg }}>
        <View style={s.pad}>
          {can("booking") && can("expense") && (
            <Segmented testID="tx-type" value={type} onChange={(k) => { setType(k as any); setCategory(CATS[k as "income" | "expense"][0]); }} options={[{ key: "income", label: "Pemasukan" }, { key: "expense", label: "Pengeluaran" }]} />
          )}
          <SectionTitle>Kategori</SectionTitle>
          <ChipRow>
            {CATS[type].map((c) => <Chip key={c} testID={`tx-category-${c}`} label={CATEGORY_LABEL[c]} active={category === c} onPress={() => setCategory(c)} />)}
          </ChipRow>
          <Field testID="tx-amount-input" label="Nominal (Rp)" keyboardType="number-pad" value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, ""))} placeholder="0" />
          <Field testID="tx-description-input" label="Keterangan" value={description} onChangeText={setDescription} placeholder={type === "income" ? "cth. Cetak foto 10R" : "cth. Listrik / Sewa gedung"} />
          <SectionTitle>Metode</SectionTitle>
          <ChipRow>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <Chip key={k} testID={`tx-method-${k}`} label={v} active={method === k} onPress={() => setMethod(k)} />)}
          </ChipRow>
          {type === "expense" && (
            <View style={{ gap: space.sm }}>
              <SectionTitle>Bukti Struk</SectionTitle>
              {receipt ? (
                <View style={s.receiptWrap}>
                  <Image testID="tx-receipt-preview" source={{ uri: receipt.uri }} style={s.receiptImg} contentFit="cover" />
                  <Button testID="tx-receipt-remove" title="Hapus Foto" icon="trash-outline" variant="ghost" onPress={() => setReceipt(null)} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  {Platform.OS !== "web" && <Button testID="tx-receipt-camera" title="Kamera" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={openCamera} />}
                  <Button testID="tx-receipt-gallery" title="Galeri" icon="image-outline" variant="secondary" style={{ flex: 1 }} onPress={pickGallery} />
                </View>
              )}
              {perm === "explain" && (
                <View style={s.permBox} testID="tx-camera-explain">
                  <Text style={s.permText}>Izinkan kamera agar Anda bisa memotret struk langsung sebagai bukti pengeluaran.</Text>
                  <Button testID="tx-camera-allow" title="Izinkan Kamera" onPress={askCamera} />
                </View>
              )}
              {perm === "blocked" && (
                <View style={s.permBox} testID="tx-camera-blocked">
                  <Text style={s.permText}>Akses kamera ditolak. Aktifkan di Pengaturan, atau pilih foto dari Galeri.</Text>
                  <Button testID="tx-camera-settings" title="Buka Pengaturan" variant="secondary" onPress={() => Linking.openSettings()} />
                </View>
              )}
            </View>
          )}
          <SectionTitle>Tanggal</SectionTitle>
        </View>
        <DayStrip value={date} onChange={setDate} />
      </KeyboardAwareScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.md }]}>
        <ErrorText text={err} />
        {type === "expense" && <Text style={s.hint} testID="tx-report-hint">Pengeluaran otomatis masuk ke laporan harian tanggal yang dipilih.</Text>}
        <Button testID="tx-save-button" title={`Simpan ${rp(Number(amount || 0))}`} loading={busy} onPress={save} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  pad: { paddingHorizontal: space.lg, gap: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: c.border },
  hint: { fontSize: 12, color: c.muted },
  receiptWrap: { gap: space.sm },
  receiptImg: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  permBox: { backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: space.md, gap: space.sm },
  permText: { fontSize: 13, color: c.onBrandTertiary },
}));
