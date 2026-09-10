// Profile photo for the packet page. Picked from the library or camera,
// resized hard and stored as a small JPEG data URI so it travels inside
// the packet JSON (no bucket, no upload, dies with the plan at purge).

import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldLabel } from "@/components/observation/formPrimitives";
import { TRIP_LIMITS } from "@/lib/tripPlan/schema";

const LONG_EDGE = 480;
const QUALITY = 0.45;

export function PhotoField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (dataUri: string | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);

  const shrink = async (uri: string, width: number, height: number) => {
    const portrait = height >= width;
    const longSide = portrait ? height : width;
    const ctx = ImageManipulator.manipulate(uri);
    if (longSide > LONG_EDGE) {
      ctx.resize({
        width: portrait ? undefined : LONG_EDGE,
        height: portrait ? LONG_EDGE : undefined,
      });
    }
    const rendered = await ctx.renderAsync();
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: QUALITY });
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : undefined;
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
      const dataUri = await shrink(a.uri, a.width, a.height);
      if (!dataUri) {
        Alert.alert("Couldn't use that photo", "Try a different one.");
        return;
      }
      if (dataUri.length > TRIP_LIMITS.maxPhotoChars) {
        Alert.alert(
          "That photo is too large",
          "Pick one with a simpler background, or crop it tighter to your face.",
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
            <Pressable onPress={() => onChange(undefined)} hitSlop={8}>
              <Text variant="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: palette.ink[400] }}>
                REMOVE
              </Text>
            </Pressable>
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
    <Pressable
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
    </Pressable>
  );
}
