// Profile photo for the packet page. Picked from the library or camera,
// resized hard and stored as a small JPEG data URI so it travels inside
// the packet JSON (no bucket, no upload, dies with the plan at purge).

import { useState } from "react";
import { Touchable } from "@/components/ui/Touchable";
import { ActivityIndicator, Alert, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldLabel } from "@/components/observation/formPrimitives";
import { TRIP_LIMITS } from "@/lib/tripPlan/schema";

// Tried in order until one fits the cap. A close-up selfie off a modern
// phone is ~3000px; the first pass alone takes it under 50 KB of base64.
// The earlier single 480px/0.45 pass produced ~40–80 KB, which blew the
// old 28 KB cap and rejected perfectly good photos.
const STEPS: { edge: number; quality: number }[] = [
  { edge: 400, quality: 0.5 },
  { edge: 320, quality: 0.45 },
  { edge: 256, quality: 0.4 },
  { edge: 200, quality: 0.35 },
];

export function PhotoField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (dataUri: string | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);

  const shrink = async (uri: string, width: number, height: number, edge: number, quality: number) => {
    const portrait = height >= width;
    const longSide = portrait ? height : width;
    const ctx = ImageManipulator.manipulate(uri);
    if (longSide > edge) {
      ctx.resize({
        width: portrait ? undefined : edge,
        height: portrait ? edge : undefined,
      });
    }
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: quality });
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : undefined;
  };

  const fit = async (uri: string, width: number, height: number) => {
    let last: string | undefined;
    for (const step of STEPS) {
      last = await shrink(uri, width, height, step.edge, step.quality);
      if (last && last.length <= TRIP_LIMITS.maxPhotoChars) return last;
    }
    return undefined;
  };

  const pick = async (fromCamera: boolean) => {
    setBusy(true);
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          fromCamera ? "Camera permission needed" : "Photos permission needed",
          "Open Settings → Avy Comparison to allow access.",
        );
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const a = result.assets[0];
      const dataUri = await fit(a.uri, a.width, a.height);
      if (!dataUri) {
        Alert.alert(
          "Couldn't use that photo",
          "Even shrunk right down it wouldn't fit. Try a different photo.",
        );
        return;
      }
      onChange(dataUri);
    } catch {
      Alert.alert("Couldn't use that photo", "Try a different one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <FieldLabel
        label="Photo of you"
        hint="A recent head-and-shoulders shot. Shown to whoever is looking for you."
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 12,
            backgroundColor: palette.ink[900],
            borderWidth: 0.5,
            borderColor: palette.ink[500] + "66",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {busy ? (
            <ActivityIndicator color={palette.ink[300]} />
          ) : value ? (
            <Image source={{ uri: value }} style={{ width: 84, height: 84 }} contentFit="cover" />
          ) : (
            <Ionicons name="person-outline" size={30} color={palette.ink[400]} />
          )}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SmallButton icon="images-outline" label="Choose" onPress={() => pick(false)} disabled={busy} />
            <SmallButton icon="camera-outline" label="Camera" onPress={() => pick(true)} disabled={busy} />
          </View>
          {value ? (
            <Touchable onPress={() => onChange(undefined)} hitSlop={8}>
              <Text variant="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: palette.ink[400] }}>
                REMOVE
              </Text>
            </Touchable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SmallButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 40,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: 10,
        borderWidth: 0.5,
        borderColor: palette.ink[500] + "88",
        backgroundColor: pressed ? palette.ink[900] : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color={palette.ink[300]} />
      <Text variant="mono" weight="medium" style={{ fontSize: 11, letterSpacing: 1, color: palette.ink[200] }}>
        {label.toUpperCase()}
      </Text>
    </Touchable>
  );
}
