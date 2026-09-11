// Tap-to-own gear grid. Tiles toggle; owned tiles that carry a detail
// (sat device, radio…) reveal a one-line field beneath the grid.

import { useState } from "react";
import { Touchable } from "@/components/ui/Touchable";
import { View, type LayoutChangeEvent } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { TextField } from "@/components/observation/formPrimitives";
import { GEAR_ITEMS, hasItem, toggleItem } from "@/lib/tripPlan/gear";
import type { GearProfile } from "@/lib/tripPlan/schema";

const COLS = 3;
const GAP = 8;

export function GearGrid({
  value,
  onChange,
  showDetails = true,
}: {
  value: GearProfile;
  onChange: (next: GearProfile) => void;
  showDetails?: boolean;
}) {
  const owned = GEAR_ITEMS.filter((i) => hasItem(value, i.key));
  // Percentage widths inside a wrapping flex row don't resolve reliably on
  // device (the tiles collapsed to content width and ran together). Measure
  // the container once and lay out fixed-width tiles instead.
  const [rowWidth, setRowWidth] = useState(0);
  const onRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - rowWidth) > 1) setRowWidth(w);
  };
  const tileWidth = rowWidth > 0 ? (rowWidth - GAP * (COLS - 1)) / COLS : undefined;

  return (
    <View style={{ gap: 14 }}>
      <View onLayout={onRowLayout} style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
        {GEAR_ITEMS.map((item) => {
          const on = hasItem(value, item.key);
          return (
            <Touchable
              key={item.key}
              onPress={() => onChange(toggleItem(value, item.key))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.label}
              style={({ pressed }) => ({
                width: tileWidth,
                minHeight: 84,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 4,
                borderRadius: 12,
                // Every tile keeps a visible edge — without one the icons
                // ran together into a single field of glyphs on device.
                borderWidth: on ? 2 : 1,
                borderColor: on ? palette.frost[400] : palette.ink[500],
                backgroundColor: on
                  ? palette.frost[400] + "26"
                  : pressed
                    ? palette.ink[950]
                    : palette.ink[900],
              })}
            >
              <MaterialCommunityIcons
                name={item.icon as never}
                size={26}
                color={on ? palette.frost[500] : palette.ink[400]}
              />
              <Text
                variant="mono"
                weight={on ? "bold" : "medium"}
                allowFontScaling={false}
                style={{
                  fontSize: 9,
                  letterSpacing: 0.4,
                  lineHeight: 12,
                  color: on ? palette.frost[500] : palette.ink[300],
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {item.label.toUpperCase()}
              </Text>
            </Touchable>
          );
        })}
      </View>
      {showDetails
        ? owned
            .filter((i) => i.detail)
            .map((i) => (
              <TextField
                key={i.key}
                label={`${i.label} · ${i.detailLabel ?? "details"}`}
                value={(value[i.detail!] as string | undefined) ?? ""}
                onChangeText={(t) => onChange({ ...value, [i.detail!]: t })}
                placeholder={i.detailPlaceholder}
              />
            ))
        : null}
      {showDetails && hasItem(value, "sat") ? (
        <>
          <TextField
            label="Sat device · share page URL"
            hint="Garmin MapShare or similar — lets your people and SAR see your track."
            value={value.satShareUrl ?? ""}
            onChangeText={(t) => onChange({ ...value, satShareUrl: t })}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextField
            label="Sat device · message address"
            value={value.satMessageAddress ?? ""}
            onChangeText={(t) => onChange({ ...value, satMessageAddress: t })}
            autoCapitalize="none"
            placeholder="name@inreach.garmin.com"
          />
        </>
      ) : null}
    </View>
  );
}
