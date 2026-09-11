import { useEffect, useState } from "react";
import { Touchable } from "@/components/ui/Touchable";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldError, FieldLabel, TextField } from "./formPrimitives";
import { MapPointPicker } from "./MapPointPicker";
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
  // A GPS fix carries an altitude; the avalanche entries use it to
  // pre-fill elevation rather than making the user guess.
  onAltitudeFt?: (ft: number | null) => void;
  error?: string;
  // Label overrides — the default copy is observation-specific; the
  // trip composer reuses the field for the trailhead pin.
  label?: string;
  hint?: string;
  required?: boolean;
}

export function LocationField({
  value,
  onChange,
  onAltitudeFt,
  error,
  label = "Location",
  hint = "Where did the observation happen?",
  required = true,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
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
      onAltitudeFt?.(
        typeof pos.coords.altitude === "number" && Number.isFinite(pos.coords.altitude)
          ? Math.round(pos.coords.altitude * 3.28084)
          : null,
      );
    } catch {
      setPermError("Couldn't read GPS. Type the coordinates manually below.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <FieldLabel label={label} required={required} hint={hint} />

      <Touchable
        onPress={() => setMapOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Pick the location on a map"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 46,
          borderRadius: 10,
          borderWidth: 0.5,
          borderColor: palette.ink[500] + "88",
          backgroundColor: pressed ? palette.ink[900] : "transparent",
          marginBottom: 10,
        })}
      >
        <Ionicons name="map-outline" size={16} color={palette.ink[300]} />
        <Text variant="mono" weight="medium" allowFontScaling={false} style={{ fontSize: 11, letterSpacing: 1.2, color: palette.ink[200] }}>
          PICK ON A MAP
        </Text>
      </Touchable>

      <MapPointPicker
        visible={mapOpen}
        initial={hasFix ? { lat: value.lat, lng: value.lng } : null}
        onCancel={() => setMapOpen(false)}
        onPick={(p) => {
          setMapOpen(false);
          onChange({ lat: round5(p.lat), lng: round5(p.lng) });
          // A map pin carries no altitude — clear any stale GPS elevation
          // so nothing silently attaches the wrong number to it.
          onAltitudeFt?.(null);
        }}
      />

      {/* GPS button + current value display */}
      <Touchable
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
      </Touchable>

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
