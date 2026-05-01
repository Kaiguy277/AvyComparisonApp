import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  Dimensions,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  CENTER_COORDS,
  REGION_STRUCTURE,
  type AvalancheCenter,
} from "@/lib/zones";

// Lat/lon bounds covering the contiguous US + the Alaska tile we render
// as an inset (Alaska is too far north to plot natively without distortion).
const MAIN_BOUNDS = {
  minLat: 24,
  maxLat: 51,
  minLon: -126,
  maxLon: -66,
};

// Alaska zones are treated separately and rendered in a small inset frame.
const ALASKA_CENTER_IDS = new Set([
  "CNFAIC",
  "HPAC",
  "VAC",
  "CAC",
  "EARAC",
  "CAAC",
  "HAC",
]);

const ALASKA_BOUNDS = {
  minLat: 55,
  maxLat: 67,
  minLon: -158,
  maxLon: -130,
};

interface PinSpec {
  centerId: string;
  region: string;
  center: AvalancheCenter;
  x: number;
  y: number;
  inAlaska: boolean;
}

const screenW = Dimensions.get("window").width;
const MAP_W = screenW - 64; // matches CardContent padding (5+padding)
const MAP_H = 280;
const ALASKA_W = 96;
const ALASKA_H = 76;
const ALASKA_PAD = 8;

function project(
  lat: number,
  lon: number,
  bounds: typeof MAIN_BOUNDS,
  width: number,
  height: number,
): { x: number; y: number } {
  const x =
    ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
  const y =
    ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height;
  return { x, y };
}

// Stylized geography — broad-stroke contour bands that reference the western
// mountain spines without claiming cartographic accuracy. Decorative.
const TERRAIN_PATHS = [
  // Cascades + Sierra spine (rough)
  "M 200 50 C 220 80, 230 130, 250 170 S 280 240, 290 280",
  // Rockies
  "M 380 60 C 400 100, 410 160, 420 210 S 430 270, 440 280",
  // Appalachians
  "M 700 110 C 720 150, 740 190, 760 230",
];

interface Props {
  selectedZoneIds: string[];
  onSelectionChange: (zoneIds: string[]) => void;
}

export function ZoneMapPicker({ selectedZoneIds, onSelectionChange }: Props) {
  const [activeCenterId, setActiveCenterId] = useState<string | null>(null);

  const pins: PinSpec[] = useMemo(() => {
    const result: PinSpec[] = [];
    for (const region of REGION_STRUCTURE) {
      for (const center of region.centers) {
        const coords = CENTER_COORDS[center.id];
        if (!coords) continue;
        const inAlaska = ALASKA_CENTER_IDS.has(center.id);
        const bounds = inAlaska ? ALASKA_BOUNDS : MAIN_BOUNDS;
        const w = inAlaska ? ALASKA_W : MAP_W;
        const h = inAlaska ? ALASKA_H : MAP_H;
        const { x, y } = project(coords.lat, coords.lon, bounds, w, h);
        result.push({
          centerId: center.id,
          region: region.name,
          center,
          x,
          y,
          inAlaska,
        });
      }
    }
    return result;
  }, []);

  const activePin = useMemo(
    () => pins.find((p) => p.centerId === activeCenterId) || null,
    [pins, activeCenterId],
  );

  const handlePinPress = (centerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveCenterId(centerId);
  };

  return (
    <View>
      <View
        style={{
          height: MAP_H,
          width: MAP_W,
          alignSelf: "center",
          borderRadius: 14,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: palette.ink[700],
          backgroundColor: palette.ink[900],
        }}
      >
        {/* Terrain backdrop */}
        <Svg
          width={MAP_W}
          height={MAP_H}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <Defs>
            <LinearGradient id="bgFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.ink[900]} />
              <Stop offset="1" stopColor={palette.ink[950]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#bgFade)" />
          {TERRAIN_PATHS.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={palette.frost[400]}
              strokeOpacity={0.08}
              strokeWidth={1}
              fill="none"
              transform={`scale(${MAP_W / 880}, ${MAP_H / 320})`}
            />
          ))}
          {/* Soft contour grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <Path
              key={`v-${t}`}
              d={`M ${MAP_W * t} 0 L ${MAP_W * t} ${MAP_H}`}
              stroke={palette.ink[700]}
              strokeOpacity={0.5}
              strokeWidth={0.5}
              strokeDasharray="2,4"
            />
          ))}
          {[0.33, 0.66].map((t) => (
            <Path
              key={`h-${t}`}
              d={`M 0 ${MAP_H * t} L ${MAP_W} ${MAP_H * t}`}
              stroke={palette.ink[700]}
              strokeOpacity={0.5}
              strokeWidth={0.5}
              strokeDasharray="2,4"
            />
          ))}
        </Svg>

        {/* Alaska inset frame */}
        <View
          style={{
            position: "absolute",
            top: ALASKA_PAD,
            left: ALASKA_PAD,
            width: ALASKA_W,
            height: ALASKA_H,
            backgroundColor: palette.ink[800],
            borderRadius: 6,
            borderWidth: 0.5,
            borderColor: palette.ink[700],
            overflow: "hidden",
          }}
        >
          <Svg width={ALASKA_W} height={ALASKA_H}>
            <Path
              d="M 4 14 C 18 8, 38 18, 60 14 S 90 22, 92 26"
              stroke={palette.frost[400]}
              strokeOpacity={0.12}
              strokeWidth={0.8}
              fill="none"
            />
            <Path
              d="M 4 30 C 22 24, 50 36, 80 30 S 92 38, 92 40"
              stroke={palette.frost[400]}
              strokeOpacity={0.08}
              strokeWidth={0.6}
              fill="none"
            />
          </Svg>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-400"
            style={{
              position: "absolute",
              top: 4,
              right: 6,
              fontSize: 8,
              letterSpacing: 1.2,
            }}
          >
            AK
          </Text>
        </View>

        {/* Pins for non-Alaska centers */}
        {pins
          .filter((p) => !p.inAlaska)
          .map((p) => (
            <PinMarker
              key={p.centerId}
              pin={p}
              selectedZoneIds={selectedZoneIds}
              onPress={() => handlePinPress(p.centerId)}
            />
          ))}

        {/* Pins inside Alaska inset */}
        {pins
          .filter((p) => p.inAlaska)
          .map((p) => (
            <PinMarker
              key={p.centerId}
              pin={p}
              selectedZoneIds={selectedZoneIds}
              onPress={() => handlePinPress(p.centerId)}
              offsetX={ALASKA_PAD}
              offsetY={ALASKA_PAD}
            />
          ))}

        {/* Legend */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: "rgba(7, 10, 20, 0.7)",
            borderRadius: 8,
            borderWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-300"
            style={{ fontSize: 9, letterSpacing: 1.4 }}
          >
            TAP A CENTER
          </Text>
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 9, letterSpacing: 1.4 }}
          >
            {selectedZoneIds.length} SEL.
          </Text>
        </View>
      </View>

      {/* Center sheet */}
      <Modal
        visible={!!activePin}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveCenterId(null)}
      >
        <Pressable
          onPress={() => setActiveCenterId(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(7,10,20,0.6)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: palette.ink[900],
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 0.5,
              borderColor: palette.ink[600],
              paddingTop: 12,
              paddingBottom: 36,
              maxHeight: "70%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: palette.ink[600],
                }}
              />
            </View>
            {activePin ? (
              <SheetContent
                center={activePin.center}
                region={activePin.region}
                selectedZoneIds={selectedZoneIds}
                onSelectionChange={onSelectionChange}
                onClose={() => setActiveCenterId(null)}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PinMarker({
  pin,
  selectedZoneIds,
  onPress,
  offsetX = 0,
  offsetY = 0,
}: {
  pin: PinSpec;
  selectedZoneIds: string[];
  onPress: () => void;
  offsetX?: number;
  offsetY?: number;
}) {
  const totalZones = pin.center.zones.length;
  const selectedCount = pin.center.zones.filter((z) =>
    selectedZoneIds.includes(z.id),
  ).length;
  const allSelected = selectedCount === totalZones;
  const someSelected = selectedCount > 0;

  const fill = allSelected
    ? palette.frost[400]
    : someSelected
      ? palette.aspen[500]
      : palette.ink[800];
  const ink = allSelected || someSelected ? palette.ink[950] : palette.ink[100];
  const border = allSelected
    ? palette.frost[400]
    : someSelected
      ? palette.aspen[500]
      : palette.ink[500];

  const fontSize = pin.inAlaska ? 7 : 9;
  const padH = pin.inAlaska ? 4 : 7;
  const padV = pin.inAlaska ? 1 : 3;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        position: "absolute",
        left: offsetX + pin.x,
        top: offsetY + pin.y,
        transform: [{ translateX: -22 }, { translateY: -10 }],
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingVertical: padV,
        paddingHorizontal: padH,
        borderRadius: 999,
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: border,
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      }}
    >
      <Text
        variant="mono"
        weight="bold"
        style={{
          color: ink,
          fontSize,
          letterSpacing: 0.4,
        }}
      >
        {pin.centerId}
      </Text>
      {someSelected && !pin.inAlaska ? (
        <Text
          variant="mono"
          weight="bold"
          style={{ color: ink, fontSize: 8, opacity: 0.75 }}
        >
          {selectedCount}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SheetContent({
  center,
  region,
  selectedZoneIds,
  onSelectionChange,
  onClose,
}: {
  center: AvalancheCenter;
  region: string;
  selectedZoneIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const zoneIds = center.zones.map((z) => z.id);
  const selectedInCenter = zoneIds.filter((id) => selectedZoneIds.includes(id));
  const allOn = selectedInCenter.length === zoneIds.length;
  const allOff = selectedInCenter.length === 0;

  const toggleAll = () => {
    Haptics.selectionAsync().catch(() => {});
    if (allOn) {
      onSelectionChange(selectedZoneIds.filter((id) => !zoneIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedZoneIds, ...zoneIds])]);
    }
  };

  const toggleOne = (zoneId: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (selectedZoneIds.includes(zoneId)) {
      onSelectionChange(selectedZoneIds.filter((id) => id !== zoneId));
    } else {
      onSelectionChange([...selectedZoneIds, zoneId]);
    }
  };

  return (
    <View>
      <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
        <Text
          variant="mono"
          weight="medium"
          className="text-frost-400"
          style={{ fontSize: 11, letterSpacing: 2 }}
        >
          {region.toUpperCase()} · {center.id}
        </Text>
        <Text
          variant="display"
          className="text-ink-50"
          style={{ fontSize: 26, lineHeight: 30, marginTop: 2 }}
        >
          {center.name}
        </Text>
      </View>

      <ScrollView
        style={{ maxHeight: 340 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
      >
        {center.zones.map((zone) => {
          const sel = selectedZoneIds.includes(zone.id);
          return (
            <Pressable
              key={zone.id}
              onPress={() => toggleOne(zone.id)}
              className="flex-row items-center"
              style={{
                paddingVertical: 14,
                borderBottomWidth: 0.5,
                borderColor: palette.ink[700],
              }}
            >
              <View style={{ marginRight: 14 }}>
                <Checkbox
                  checked={sel}
                  onChange={() => toggleOne(zone.id)}
                />
              </View>
              <Text
                weight={sel ? "medium" : "regular"}
                className={sel ? "text-ink-50" : "text-ink-200"}
                style={{ fontSize: 16 }}
              >
                {zone.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 24,
          paddingTop: 14,
        }}
      >
        <Button
          variant="outline"
          size="default"
          onPress={toggleAll}
          className="flex-1"
        >
          {allOn ? "Deselect all" : allOff ? "Select all" : "Select all"}
        </Button>
        <Button
          variant="primary"
          size="default"
          onPress={onClose}
          className="flex-1"
          leftIcon={
            <Ionicons name="checkmark" size={14} color={palette.ink[950]} />
          }
        >
          Done
        </Button>
      </View>
    </View>
  );
}
