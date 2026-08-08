import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldError, FieldLabel, TextField } from "./formPrimitives";
import type { LocationPoint } from "@/lib/observation/schema";

// Two-mode location field: tap "Use current location" for a one-shot
// GPS read (foreground only — we don't request background here), or
// type lat/lng manually. The backing form value is a single
// LocationPoint object; both inputs write to it.
//
// Acceptance: lat in [-90, 90], lng in [-180, 180]. Empty fields show
// 0,0 visually but the schema validation in the screen catches the
// "you didn't pick a location" case.

interface Props {
  value: LocationPoint;
  onChange: (next: LocationPoint) => void;
  error?: string;
}

export function LocationField({ value, onChange, error }: Props) {
  const [busy, setBusy] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  // Raw text is the source of truth for the manual fields — a controlled
  // `String(value.lat)` round-trip ate decimal points ("47." → 47 → "47")
  // and made the fields impossible to type into. We reconcile FROM `value`
  // only when it changes externally (e.g. a GPS read), detected by the
  // parsed text no longer matching — so typing never clobbers itself.
  const hasFix = !(value.lat === 0 && value.lng === 0);
  const [latText, setLatText] = useState(hasFix ? String(value.lat) : "");
  const [lngText, setLngText] = useState(hasFix ? String(value.lng) : "");

  useEffect(() => {
    if (parseFloat(latText) !== value.lat) {
      setLatText(hasFix ? String(value.lat) : "");
    }
    if (parseFloat(lngText) !== value.lng) {
      setLngText(hasFix ? String(value.lng) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.lat, value.lng]);

  const onLatText = (t: string) => {
    setLatText(t);
    const n = parseFloat(t);
    onChange({ ...value, lat: Number.isFinite(n) ? n : 0 });
  };
  const onLngText = (t: string) => {
    setLngText(t);
    const n = parseFloat(t);
    onChange({ ...value, lng: Number.isFinite(n) ? n : 0 });
  };

  const useCurrentLocation = async () => {
    setPermError(null);
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setPermError(
          "Location permission denied. Open Settings to allow location access, or type the coordinates manually below.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onChange({
        lat: round5(pos.coords.latitude),
        lng: round5(pos.coords.longitude),
      });
    } catch {
      setPermError("Couldn't read GPS. Type the coordinates manually below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <FieldLabel
        label="Location"
        required
        hint="Where did the observation happen?"
      />

      {/* GPS button + current value display */}
      <Pressable
        onPress={useCurrentLocation}
        disabled={busy}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 8,
          borderWidth: 0.5,
          borderColor: hasFix
            ? palette.frost[400]
            : palette.ink[500] + "66",
          backgroundColor: pressed
            ? palette.frost[400] + "1A"
            : palette.ink[900],
        })}
      >
        {busy ? (
          <ActivityIndicator size="small" color={palette.frost[400]} />
        ) : (
          <Ionicons
            name="locate"
            size={16}
            color={hasFix ? palette.frost[400] : palette.ink[300]}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text
            variant="mono"
            weight="medium"
            style={{
              fontSize: 11,
              letterSpacing: 1.2,
              color: hasFix ? palette.frost[400] : palette.ink[300],
            }}
          >
            {busy
              ? "GETTING LOCATION…"
              : hasFix
                ? "USE A DIFFERENT LOCATION"
                : "USE MY CURRENT LOCATION"}
          </Text>
          {hasFix ? (
            <Text
              variant="mono"
              style={{
                fontSize: 11,
                color: palette.ink[300],
                marginTop: 2,
              }}
            >
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {permError ? <FieldError message={permError} /> : null}

      {/* Manual entry */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Latitude"
            value={latText}
            onChangeText={onLatText}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="47.6062"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Longitude"
            value={lngText}
            onChangeText={onLngText}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="-122.3321"
          />
        </View>
      </View>

      <FieldError message={error} />
    </View>
  );
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
