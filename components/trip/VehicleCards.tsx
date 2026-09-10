// Saved vehicles as tappable cards. In the composer a tap selects
// ("that's the one I'm taking"); in the profile a tap expands the editor.

import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import type { VehicleProfile, VehicleType } from "@/lib/tripPlan/schema";

const ICONS: Record<VehicleType, string> = {
  car: "car",
  truck: "truck",
  snowmachine: "snowmobile",
  trailer: "truck-trailer",
  airplane: "airplane",
  boat: "sail-boat",
  dropped_off: "walk",
  other: "car-side",
};

export function vehicleLine(v: VehicleProfile): string {
  if (v.type === "dropped_off") return "Dropped off · no vehicle";
  const desc = [v.year, v.color, v.make, v.model].filter(Boolean).join(" ");
  return desc || v.label || "Vehicle";
}

export function VehicleCard({
  vehicle,
  selected,
  onPress,
  trailing,
}: {
  vehicle: VehicleProfile;
  selected?: boolean;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        minHeight: 64,
        borderRadius: 12,
        borderWidth: selected ? 1.5 : 0.5,
        borderColor: selected ? palette.frost[400] : palette.ink[500] + "66",
        backgroundColor: selected ? palette.frost[400] + "18" : pressed ? palette.ink[900] : "transparent",
      })}
    >
      <MaterialCommunityIcons
        name={ICONS[vehicle.type] as never}
        size={28}
        color={selected ? palette.frost[500] : palette.ink[300]}
      />
      <View style={{ flex: 1 }}>
        <Text className="text-ink-100" weight="semibold" style={{ fontSize: 15 }} numberOfLines={1}>
          {vehicleLine(vehicle)}
        </Text>
        <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1, color: palette.ink[400], marginTop: 2 }} numberOfLines={1}>
          {vehicle.type === "dropped_off"
            ? "Someone is dropping you off"
            : [vehicle.plate ? `${vehicle.plate}${vehicle.plateState ? ` ${vehicle.plateState}` : ""}` : null, vehicle.registration, vehicle.label].filter(Boolean).join(" · ") || "no plate yet"}
        </Text>
      </View>
      {trailing ?? (selected ? <MaterialCommunityIcons name="check-circle" size={22} color={palette.frost[500]} /> : null)}
    </Pressable>
  );
}
