import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldLabel, TextField } from "./formPrimitives";
import type { LocalImageWithCaption } from "@/lib/observation/schema";

// Photo grid for the form. Tapping "Add" opens the OS picker; selected
// images become thumbnails with an optional caption and a remove (×)
// affordance. Caps at `maxCount` (default 8 to match Avy).
//
// We keep the picked images in form state as `LocalImageWithCaption[]`
// — they're not uploaded until the user submits. This matches Avy's
// pattern and avoids "phantom" media on the server when the user
// abandons the form.

interface Props {
  value: LocalImageWithCaption[];
  onChange: (next: LocalImageWithCaption[]) => void;
  maxCount?: number;
  // Form section eyebrow uses "PHOTOS"; pass a different label to
  // re-use this picker on the per-avalanche sub-form.
  label?: string;
  hint?: string;
}

export function PhotoPicker({
  value,
  onChange,
  maxCount = 8,
  label = "Photos",
  hint = "Up to 8 photos. Optional captions help the forecaster.",
}: Props) {
  const [busy, setBusy] = useState(false);

  const remaining = Math.max(0, maxCount - value.length);

  const pickImages = useCallback(async () => {
    if (remaining === 0) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          "Photos permission needed",
          "Open Settings → Avy Comparison and allow Photos access to attach images to your observation.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        exif: true,
        quality: 1,
      });
      if (result.canceled) return;
      const next: LocalImageWithCaption[] = result.assets.map((a) => ({
        image: {
          uri: a.uri,
          width: a.width,
          height: a.height,
          // expo-image-picker returns EXIF as a record; we only use
          // DateTimeOriginal + Orientation downstream.
          exif: a.exif
            ? {
                DateTimeOriginal:
                  typeof a.exif.DateTimeOriginal === "string"
                    ? a.exif.DateTimeOriginal
                    : undefined,
                Orientation:
                  typeof a.exif.Orientation === "string" ||
                  typeof a.exif.Orientation === "number"
                    ? a.exif.Orientation
                    : undefined,
              }
            : null,
        },
        caption: "",
      }));
      onChange([...value, ...next].slice(0, maxCount));
    } finally {
      setBusy(false);
    }
  }, [onChange, remaining, value, maxCount]);

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const updateCaption = (idx: number, caption: string) => {
    onChange(value.map((v, i) => (i === idx ? { ...v, caption } : v)));
  };

  return (
    <View>
      <FieldLabel
        label={`${label} · ${value.length}/${maxCount}`}
        hint={hint}
      />

      {value.length === 0 ? (
        <AddPhotoButton onPress={pickImages} busy={busy} large />
      ) : (
        <View style={{ gap: 12 }}>
          {value.map((item, idx) => (
            <View
              key={`${item.image.uri}-${idx}`}
              style={{
                flexDirection: "row",
                gap: 10,
                padding: 8,
                borderRadius: 10,
                backgroundColor: palette.ink[900],
                borderWidth: 0.5,
                borderColor: palette.ink[500] + "55",
              }}
            >
              <View style={{ position: "relative" }}>
                <Image
                  source={{ uri: item.image.uri }}
                  contentFit="cover"
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 6,
                    backgroundColor: palette.ink[700],
                  }}
                />
                <Pressable
                  onPress={() => remove(idx)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${idx + 1}`}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: palette.aspen[400],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={14} color="#FFF" />
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <CaptionInput
                  value={item.caption ?? ""}
                  onChange={(t) => updateCaption(idx, t)}
                />
              </View>
            </View>
          ))}
          {remaining > 0 ? (
            <AddPhotoButton onPress={pickImages} busy={busy} large={false} />
          ) : null}
        </View>
      )}
    </View>
  );
}

function AddPhotoButton({
  onPress,
  busy,
  large,
}: {
  onPress: () => void;
  busy: boolean;
  large: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        paddingVertical: large ? 28 : 14,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: palette.ink[500] + "AA",
        backgroundColor: pressed ? palette.ink[900] : "transparent",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      })}
    >
      <Ionicons
        name={busy ? "hourglass-outline" : "image-outline"}
        size={large ? 22 : 16}
        color={palette.ink[300]}
      />
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 11,
          letterSpacing: 1.4,
          color: palette.ink[300],
        }}
      >
        {busy ? "OPENING…" : "ADD PHOTOS"}
      </Text>
    </Pressable>
  );
}

function CaptionInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <TextField
      label="Caption"
      hint="Optional — what's in the photo"
      value={value}
      onChangeText={onChange}
      placeholder="e.g. Crown 3' deep, NE-facing 35°"
      multiline
      rows={2}
    />
  );
}
