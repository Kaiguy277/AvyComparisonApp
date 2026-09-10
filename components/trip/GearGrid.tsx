// Tap-to-own gear grid. Tiles toggle; owned tiles that carry a detail
// (sat device, radio…) reveal a one-line field beneath the grid.

import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { TextField } from "@/components/observation/formPrimitives";
import { GEAR_ITEMS, hasItem, toggleItem } from "@/lib/tripPlan/gear";
import type { GearProfile } from "@/lib/tripPlan/schema";

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
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {GEAR_ITEMS.map((item) => {
          const on = hasItem(value, item.key);
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(toggleItem(value, item.key))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.label}
              style={({ pressed }) => ({
                width: "31%",
                minHeight: 78,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 6,
                borderRadius: 12,
                borderWidth: on ? 1.5 : 0.5,
                borderColor: on ? palette.frost[400] : palette.ink[500] + "66",
                backgroundColor: on ? palette.frost[400] + "22" : pressed ? palette.ink[900] : "transparent",
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
                style={{ fontSize: 10, letterSpacing: 0.8, color: on ? palette.frost[500] : palette.ink[300], textAlign: "center" }}
                numberOfLines={1}
              >
                {item.label.toUpperCase()}
              </Text>
            </Pressable>
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
