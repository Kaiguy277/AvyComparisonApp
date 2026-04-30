import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  REGION_STRUCTURE,
  type AvalancheCenter,
  type Region,
} from "@/lib/zones";

interface Props {
  selectedZoneIds: string[];
  onSelectionChange: (zoneIds: string[]) => void;
}

export function HierarchicalZoneSelector({ selectedZoneIds, onSelectionChange }: Props) {
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedCenters, setExpandedCenters] = useState<Set<string>>(
    new Set(
      REGION_STRUCTURE.flatMap((r) => r.centers.map((c) => `${r.id}-${c.id}`)),
    ),
  );

  const toggleSet = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const getRegionZones = (region: Region) =>
    region.centers.flatMap((center) => center.zones.map((z) => z.id));
  const getCenterZones = (center: AvalancheCenter) => center.zones.map((z) => z.id);

  const isRegionSelected = (region: Region): boolean | "indeterminate" => {
    const zoneIds = getRegionZones(region);
    const count = zoneIds.filter((id) => selectedZoneIds.includes(id)).length;
    if (count === 0) return false;
    if (count === zoneIds.length) return true;
    return "indeterminate";
  };

  const isCenterSelected = (center: AvalancheCenter): boolean | "indeterminate" => {
    const zoneIds = getCenterZones(center);
    const count = zoneIds.filter((id) => selectedZoneIds.includes(id)).length;
    if (count === 0) return false;
    if (count === zoneIds.length) return true;
    return "indeterminate";
  };

  const handleRegionToggle = (region: Region) => {
    const zoneIds = getRegionZones(region);
    const state = isRegionSelected(region);
    if (state === true) {
      onSelectionChange(selectedZoneIds.filter((id) => !zoneIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedZoneIds, ...zoneIds])]);
    }
  };

  const handleCenterToggle = (center: AvalancheCenter) => {
    const zoneIds = getCenterZones(center);
    const state = isCenterSelected(center);
    if (state === true) {
      onSelectionChange(selectedZoneIds.filter((id) => !zoneIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedZoneIds, ...zoneIds])]);
    }
  };

  const handleZoneToggle = (zoneId: string) => {
    if (selectedZoneIds.includes(zoneId)) {
      onSelectionChange(selectedZoneIds.filter((id) => id !== zoneId));
    } else {
      onSelectionChange([...selectedZoneIds, zoneId]);
    }
  };

  return (
    <View className="gap-3">
      {REGION_STRUCTURE.map((region) => {
        const isExpanded = expandedRegions.has(region.id);
        const regionState = isRegionSelected(region);
        const regionZones = getRegionZones(region);
        const regionSelected = regionZones.filter((id) =>
          selectedZoneIds.includes(id),
        ).length;
        return (
          <View
            key={region.id}
            className="border border-border rounded-lg overflow-hidden"
          >
            <View className="bg-muted/50 p-3 flex-row items-center gap-2">
              <Pressable
                onPress={() =>
                  setExpandedRegions((prev) => toggleSet(prev, region.id))
                }
                hitSlop={8}
                className="p-1"
              >
                <Ionicons
                  name={isExpanded ? "chevron-down" : "chevron-forward"}
                  size={16}
                  color="#6b7280"
                />
              </Pressable>
              <Checkbox checked={regionState} onChange={() => handleRegionToggle(region)} />
              <Pressable className="flex-1" onPress={() => handleRegionToggle(region)}>
                <Text className="text-sm font-medium text-foreground">{region.name}</Text>
              </Pressable>
              <Badge variant="outline">
                {regionSelected} / {regionZones.length}
              </Badge>
            </View>

            {isExpanded ? (
              <View className="p-3 gap-2">
                {region.centers.map((center) => {
                  const centerKey = `${region.id}-${center.id}`;
                  const isCenterExpanded = expandedCenters.has(centerKey);
                  const centerState = isCenterSelected(center);
                  const centerZones = getCenterZones(center);
                  const centerSelected = centerZones.filter((id) =>
                    selectedZoneIds.includes(id),
                  ).length;
                  return (
                    <View
                      key={center.id}
                      className="border border-border rounded-md overflow-hidden"
                    >
                      <View className="p-2 flex-row items-center gap-2 bg-card">
                        <Pressable
                          onPress={() =>
                            setExpandedCenters((prev) => toggleSet(prev, centerKey))
                          }
                          hitSlop={8}
                          className="p-1"
                        >
                          <Ionicons
                            name={isCenterExpanded ? "chevron-down" : "chevron-forward"}
                            size={14}
                            color="#6b7280"
                          />
                        </Pressable>
                        <Checkbox
                          checked={centerState}
                          onChange={() => handleCenterToggle(center)}
                          size="sm"
                        />
                        <Pressable
                          className="flex-1"
                          onPress={() => handleCenterToggle(center)}
                        >
                          <Text className="text-sm font-medium text-foreground">
                            {center.name}
                          </Text>
                        </Pressable>
                        <Badge variant="secondary">
                          {centerSelected} / {center.zones.length}
                        </Badge>
                      </View>

                      {isCenterExpanded ? (
                        <View className="p-2 pl-10 bg-muted/20 gap-1.5">
                          {center.zones.map((zone) => (
                            <Pressable
                              key={zone.id}
                              onPress={() => handleZoneToggle(zone.id)}
                              className="flex-row items-center gap-2 py-1"
                            >
                              <Checkbox
                                checked={selectedZoneIds.includes(zone.id)}
                                onChange={() => handleZoneToggle(zone.id)}
                                size="sm"
                              />
                              <Text className="text-sm text-foreground flex-1">
                                {zone.name}
                              </Text>
                            </Pressable>
                          ))}
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
