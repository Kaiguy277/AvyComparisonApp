import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { DateStrip } from "./DateStrip";
import {
  ChipPicker,
  FieldError,
  FieldLabel,
  TextField,
} from "./formPrimitives";
import { PhotoPicker } from "./PhotoPicker";
import {
  ASPECT_OPTIONS,
  AVALANCHE_TRIGGER_ADVANCED,
  AVALANCHE_TRIGGER_COMMON,
  AVALANCHE_TYPE_OPTIONS,
  BED_SURFACE_OPTIONS,
  D_SIZE_OPTIONS,
  HELP_COPY,
  type AvalancheTriggerValue,
} from "@/lib/observation/constants";
import type { AvalancheEntryForm } from "@/lib/observation/schema";

// One avalanche record. The user adds one of these per slide they saw
// (or skips this section entirely if they only saw signs of instability
// without any actual slides).

interface Props {
  index: number;
  total: number;
  value: AvalancheEntryForm;
  onChange: (next: AvalancheEntryForm) => void;
  onRemove: () => void;
  // Field-level errors keyed by `avalanches.<index>.<field>`. The screen
  // builds this map from the zod result.
  errors?: Record<string, string>;
}

export function AvalancheEntryCard({
  index,
  total,
  value,
  onChange,
  onRemove,
  errors,
}: Props) {
  const [showAdvancedTriggers, setShowAdvancedTriggers] = useState(
    isAdvancedTrigger(value.trigger),
  );

  const update = <K extends keyof AvalancheEntryForm>(
    key: K,
    next: AvalancheEntryForm[K],
  ) => onChange({ ...value, [key]: next });

  const err = (field: keyof AvalancheEntryForm) =>
    errors?.[`avalanches.${index}.${String(field)}`];

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 10,
        backgroundColor: palette.ink[900],
        borderWidth: 0.5,
        borderColor: palette.ink[500] + "55",
        gap: 14,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          variant="mono"
          weight="medium"
          style={{
            fontSize: 10,
            letterSpacing: 1.4,
            color: palette.ink[300],
          }}
        >
          AVALANCHE {index + 1} OF {total}
        </Text>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove avalanche ${index + 1}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Ionicons
            name="trash-outline"
            size={13}
            color={palette.aspen[400]}
          />
          <Text
            variant="mono"
            weight="medium"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: palette.aspen[400],
            }}
          >
            REMOVE
          </Text>
        </Pressable>
      </View>

      {/* When did this slide happen? Defaults to obs date. */}
      <View>
        <FieldLabel
          label="Date of avalanche"
          required
          hint="Often the same as the observation date."
        />
        <DateStrip value={value.date} onChange={(d) => update("date", d)} />
      </View>

      {/* Where on the mountain */}
      <TextField
        label="Where on the slope"
        required
        hint="Path or feature name. e.g. 'Common Bowl headwall' or 'NE Tincan starting zone'."
        value={value.location}
        onChangeText={(t) => update("location", t)}
        placeholder="Path or feature"
        autoCapitalize="words"
        error={err("location")}
      />

      {/* Number of avalanches */}
      <TextField
        label="Number of avalanches in this group"
        required
        hint="If you saw a single slide, leave at 1."
        value={value.number}
        onChangeText={(t) => update("number", t.replace(/\D/g, ""))}
        keyboardType="number-pad"
        placeholder="1"
        error={err("number")}
      />

      {/* Trigger */}
      <View>
        <FieldLabel
          label="Trigger"
          required
          hint="What set this slide off?"
          help={{ title: "Trigger", body: HELP_COPY.trigger }}
        />
        <ChipPicker
          options={AVALANCHE_TRIGGER_COMMON}
          selected={value.trigger}
          onSelect={(v) => update("trigger", v as AvalancheTriggerValue)}
          size="sm"
        />
        {showAdvancedTriggers ? (
          <View style={{ marginTop: 8 }}>
            <ChipPicker
              options={AVALANCHE_TRIGGER_ADVANCED}
              selected={value.trigger}
              onSelect={(v) => update("trigger", v as AvalancheTriggerValue)}
              size="sm"
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setShowAdvancedTriggers(true)}
            hitSlop={6}
            style={{ marginTop: 6, alignSelf: "flex-start", padding: 4 }}
          >
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                color: palette.frost[400],
              }}
            >
              + MORE TRIGGER OPTIONS
            </Text>
          </Pressable>
        )}
      </View>

      {/* Avalanche type */}
      <View>
        <FieldLabel label="Avalanche type" hint="Optional." />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ChipPicker
              options={AVALANCHE_TYPE_OPTIONS}
              selected={value.avalanche_type}
              onSelect={(v) => update("avalanche_type", v)}
              size="sm"
            />
          </View>
        </ScrollView>
      </View>

      {/* Aspect */}
      <View>
        <FieldLabel label="Aspect" required />
        <ChipPicker
          options={ASPECT_OPTIONS}
          selected={value.aspect}
          onSelect={(v) => update("aspect", v)}
          size="sm"
        />
        <FieldError message={err("aspect")} />
      </View>

      {/* D-size */}
      <View>
        <FieldLabel
          label="Destructive size"
          required
          hint="How big was the slide?"
          help={{ title: "Destructive size (D-scale)", body: HELP_COPY.d_size }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ChipPicker
              options={D_SIZE_OPTIONS}
              selected={value.d_size}
              onSelect={(v) => update("d_size", v)}
              size="sm"
            />
          </View>
        </ScrollView>
        <FieldError message={err("d_size")} />
      </View>

      {/* Bed surface */}
      <View>
        <FieldLabel
          label="Bed surface"
          hint="Optional — what layer the slide ran on."
        />
        <ChipPicker
          options={BED_SURFACE_OPTIONS}
          selected={value.bed_sfc}
          onSelect={(v) => update("bed_sfc", v)}
          size="sm"
        />
      </View>

      {/* Elevation */}
      <TextField
        label="Elevation (feet)"
        required
        hint="Crown elevation. Whole feet."
        value={value.elevation}
        onChangeText={(t) => update("elevation", t.replace(/\D/g, ""))}
        keyboardType="number-pad"
        placeholder="3500"
        error={err("elevation")}
      />

      {/* Free text */}
      <TextField
        label="Comments"
        hint="Optional. Crown depth, weak layer, runout — whatever you noticed."
        value={value.comments ?? ""}
        onChangeText={(t) => update("comments", t)}
        multiline
        rows={3}
      />

      {/* Photos for this avalanche */}
      <PhotoPicker
        value={value.images}
        onChange={(imgs) => update("images", imgs)}
        maxCount={6}
        label="Avalanche photos"
        hint="Crown shot, debris pile, profile pit — whatever you got."
      />
    </View>
  );
}

function isAdvancedTrigger(t: string): boolean {
  return AVALANCHE_TRIGGER_ADVANCED.some((o) => o.value === t);
}
