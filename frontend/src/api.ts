import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Linking, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "casadella_token";

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

let currentToken: string | null = null;
export const fileUrl = (path: string) => `${BASE}/files/${path}?token=${currentToken}`;

export async function uploadImage(uri: string, name: string, type: string): Promise<string> {
  const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as any);
  }
  const r = await fetch(`${BASE}/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Gagal mengunggah foto");
  return data.path;
}

export async function downloadAndShare(path: string, filename: string, mimeType: string) {
  const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
  const url = `${BASE}${path}`;
  if (Platform.OS === "web") {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Gagal mengunduh laporan");
    const href = URL.createObjectURL(await r.blob());
    const a = (globalThis as any).document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    return;
  }
  const res = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${filename}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status !== 200) throw new Error("Gagal mengunduh laporan");
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(res.uri, { mimeType, dialogTitle: filename });
}

export async function openWhatsApp(phone: string, text: string) {
  let p = (phone || "").replace(/\D/g, "");
  if (!p) throw new Error("Nomor WhatsApp klien belum diisi");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  await Linking.openURL(`https://wa.me/${p}?text=${encodeURIComponent(text)}`);
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
  currentToken = token;
  const r = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 && token) onUnauthorized?.();
    throw new Error(typeof data?.detail === "string" ? data.detail : "Terjadi kesalahan, coba lagi");
  }
  return data as T;
}

export function useFetch<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { data, loading, error, reload, setData };
}

// ---------- formatting ----------
export const rp = (n: number = 0) =>
  `Rp ${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Studio local time (WITA, UTC+8) regardless of device timezone
const studio = (t: number) => new Date(t + 8 * 3600000);
export const today = () => {
  const d = studio(Date.now());
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const longDate = (s: string) => {
  const d = parseYmd(s);
  return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const hhmm = (iso?: string | null) => {
  if (!iso) return "--:--";
  const d = studio(new Date(iso).getTime());
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
export const dmyhm = (iso: string) => {
  const d = studio(new Date(iso).getTime());
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin1: "Admin 1",
  admin2: "Admin 2",
  photographer: "Fotografer",
  editor: "Editor",
};
export const METHOD_LABEL: Record<string, string> = { cash: "Tunai", transfer: "Transfer", card: "Kartu", qris: "QRIS" };
export const PAY_STATUS: Record<string, string> = { belum_bayar: "Belum Bayar", dp: "DP", lunas: "Lunas" };
export const CATEGORY_LABEL: Record<string, string> = {
  booking: "Booking",
  penjualan: "Penjualan",
  lainnya: "Lainnya",
  operasional: "Operasional",
  sewa: "Sewa",
};
