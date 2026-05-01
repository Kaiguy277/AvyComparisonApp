import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, UIManager, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Checkbox } from "@/components/ui/Checkbox";
import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  REGION_STRUCTURE,
  type AvalancheCenter,
  type Region,
} from "@/lib/zones";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  selectedZoneIds: string[];
  onSelectionChange: (zoneIds: string[]) => void;
}

const animateNext = () =>
  LayoutAnimation.configureNext({
    duration: 200,
    create: { type: "easeInEaseOut", property: "opacity" },
    update: { type: "easeInEaseOut" },
  });

export function HierarchicalZoneSelector({
  selectedZoneIds,
  onSelectionChange,
}: Props) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedCenters, setExpandedCenters] = useState<Set<string>>(
    new Set(REGION_STRUCTURE.flatMap((r) => r.centers.map((c) => `${r.id}-${c.id}`))),
  );

  const toggleSet = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const getRegionZones = (region: Region) =>
    region.centers.flatMap((c) => c.zones.map((z) => z.id));
  const getCenterZones = (center: AvalancheCenter) => center.zones.map((z) => z.id);

  const isRegionSelected = (r: Region): boolean | "indeterminate" => {
    const ids = getRegionZones(r);
    const c = ids.filter((id) => selectedZoneIds.includes(id)).length;
    if (c === 0) return false;
    if (c === ids.length) return true;
    return "indeterminate";
  };

  const isCenterSelected = (c: AvalancheCenter): boolean | "indeterminate" => {
    const ids = getCenterZones(c);
    const n = ids.filter((id) => selectedZoneIds.includes(id)).length;
    if (n === 0) return false;
    if (n === ids.length) return true;
    return "indeterminate";
  };

  const handleRegionToggle = (region: Region) => {
    Haptics.selectionAsync().catch(() => {});
    const ids = getRegionZones(region);
    if (isRegionSelected(region) === true) {
      onSelectionChange(selectedZoneIds.filter((id) => !ids.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedZoneIds, ...ids])]);
    }
  };

  const handleCenterToggle = (center: AvalancheCenter) => {
    Haptics.selectionAsync().catch(() => {});
    const ids = getCenterZones(center);
    if (isCenterSelected(center) === true) {
      onSelectionChange(selectedZoneIds.filter((id) => !ids.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedZoneIds, ...ids])]);
    }
  };

  const handleZoneToggle = (zoneId: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (selectedZoneIds.includes(zoneId)) {
      onSelectionChange(selectedZoneIds.filter((id) => id !== zoneId));
    } else {
      onSelectionChange([...selectedZoneIds, zoneId]);
    }
  };

  return (
    <View>
      {REGION_STRUCTURE.map((region, regionIdx) => {
        const isExpanded = expandedRegions.has(region.id);
        const regionState = isRegionSelected(region);
        const regionZones = getRegionZones(region);
        const regionSelected = regionZones.filter((id) =>
          selectedZoneIds.includes(id),
        ).length;
        const isLastRegion = regionIdx === REGION_STRUCTURE.length - 1;
        return (
          <View
            key={region.id}
            style={{
              borderBottomWidth: isLastRegion ? 0 : 0.5,
              borderColor: palette.ink[700],
            }}
          >
            <Pressable
              onPress={() => {
                animateNext();
                setExpandedRegions((p) => toggleSet(p, region.id));
              }}
              className="flex-row items-center py-3 pl-1 pr-1"
            >
              <View style={{ width: 18, alignItems: "center" }}>
                <Ionicons
                  name={isExpanded ? "chevron-down" : "chevron-forward"}
                  size={12}
                  color={palette.ink[400]}
                />
              </View>
              <View style={{ marginRight: 12 }}>
                <Checkbox
                  checked={regionState}
                  onChange={() => handleRegionToggle(region)}
                  size="sm"
                />
              </View>
              <View className="flex-1">
                <Text
                  variant="display"
                  className="text-ink-50"
                  style={{ fontSize: 22, lineHeight: 26 }}
                >
                  {region.name}
                </Text>
              </View>
              <Text
                variant="mono"
                weight="medium"
                className="text-ink-300"
                style={{ fontSize: 13, letterSpacing: 1 }}
              >
                {regionSelected}/{regionZones.length}
              </Text>
            </Pressable>

            {isExpanded ? (
              <View style={{ paddingBottom: 12 }}>
                {region.centers.map((center) => {
                  const ckey = `${region.id}-${center.id}`;
                  const cExpanded = expandedCenters.has(ckey);
                  const cState = isCenterSelected(center);
                  const cZones = getCenterZones(center);
                  const cSelected = cZones.filter((id) =>
                    selectedZoneIds.includes(id),
                  ).length;
                  return (
                    <View
                      key={center.id}
                      style={{
                        marginLeft: 26,
                        paddingLeft: 14,
                        borderLeftWidth: 0.5,
                        borderColor: palette.ink[700],
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          animateNext();
                          setExpandedCenters((p) => toggleSet(p, ckey));
                        }}
                        className="flex-row items-center py-2"
                      >
                        <View style={{ width: 14, alignItems: "center" }}>
                          <Ionicons
                            name={cExpanded ? "chevron-down" : "chevron-forward"}
                            size={10}
                            color={palette.ink[400]}
                          />
                        </View>
                        <View style={{ marginRight: 10, marginLeft: 4 }}>
                          <Checkbox
                            checked={cState}
                            onChange={() => handleCenterToggle(center)}
                            size="sm"
                          />
                        </View>
                        <View className="flex-1 flex-row items-baseline gap-2">
                          <Text
                            variant="mono"
                            weight="medium"
                            className="text-frost-400"
                            style={{ fontSize: 11, letterSpacing: 1 }}
                          >
                            {center.id}
                          </Text>
                          <Text
                            className="text-ink-100 flex-1"
                            style={{ fontSize: 15 }}
                            numberOfLines={1}
                          >
                            {center.name}
                          </Text>
                        </View>
                        <Text
                          variant="mono"
                          className="text-ink-300"
                          style={{ fontSize: 12, letterSpacing: 1 }}
                        >
                          {cSelected}/{cZones.length}
                        </Text>
                      </Pressable>

                      {cExpanded ? (
                        <View
                          style={{
                            paddingLeft: 28,
                            paddingBottom: 6,
                          }}
                        >
                          {center.zones.map((zone) => {
                            const sel = selectedZoneIds.includes(zone.id);
                            return (
                              <Pressable
                                key={zone.id}
                                onPress={() => handleZoneToggle(zone.id)}
                                className="flex-row items-center"
                                style={{ paddingVertical: 10 }}
                              >
                                <View style={{ marginRight: 12 }}>
                                  <Checkbox
                                    checked={sel}
                                    onChange={() => handleZoneToggle(zone.id)}
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
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
