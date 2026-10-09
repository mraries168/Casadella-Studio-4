import React, { useRef, useState } from "react";
import { Linking, Text } from "react-native";
import * as Location from "expo-location";
import { makeStyles } from "@/src/theme";
import { Button, Sheet } from "@/src/ui";

type Coords = { lat: number; lng: number; accuracy: number | null };
type Mode = "ask" | "settings" | null;

// Location permission flow for geofenced attendance: explain -> request -> (ask again once) -> Open Settings.
export function useAttendanceLocation() {
  const s = useStyles();
  const [mode, setMode] = useState<Mode>(null);
  const resolver = useRef<((c: Coords | null) => void) | null>(null);

  const read = async (): Promise<Coords> => {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null };
  };

  const finish = (c: Coords | null) => {
    setMode(null);
    resolver.current?.(c);
    resolver.current = null;
  };

  const getCoords = async (): Promise<Coords | null> => {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) return read();
    return new Promise((resolve) => {
      resolver.current = resolve;
      setMode(perm.status === "undetermined" || perm.canAskAgain ? "ask" : "settings");
    });
  };

  const allow = async () => {
    const r = await Location.requestForegroundPermissionsAsync();
    if (r.granted) {
      try {
        finish(await read());
      } catch {
        finish(null);
      }
    } else if (!r.canAskAgain) setMode("settings");
    else finish(null);
  };

  const sheet = (
    <Sheet testID="location-permission-sheet" visible={!!mode} onClose={() => finish(null)} title="Izinkan Akses Lokasi">
      <Text style={s.text}>
        {mode === "settings"
          ? "Akses lokasi diblokir. Buka Pengaturan dan izinkan lokasi agar Anda dapat absen di studio."
          : "Absensi hanya bisa dilakukan saat Anda berada di studio. Lokasi hanya dicek saat menekan tombol absen."}
      </Text>
      {mode === "settings" ? (
        <Button testID="location-open-settings-button" title="Buka Pengaturan" icon="settings-outline" onPress={() => { Linking.openSettings(); finish(null); }} />
      ) : (
        <Button testID="location-allow-button" title="Izinkan Lokasi" icon="location-outline" onPress={allow} />
      )}
      <Button testID="location-later-button" title="Nanti saja" variant="ghost" onPress={() => finish(null)} />
    </Sheet>
  );

  return { getCoords, sheet };
}

const useStyles = makeStyles((c) => ({ text: { fontSize: 14, color: c.onSurfaceSecondary, lineHeight: 20 } }));
