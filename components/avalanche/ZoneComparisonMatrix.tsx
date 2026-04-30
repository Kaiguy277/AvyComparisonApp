import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { ElevationPyramid } from "./ElevationPyramid";
import { dangerColors } from "./dangerColors";
import type { AvalancheZone, DangerRating } from "@/lib/api/avalanche";

interface Props {
  zones: AvalancheZone[];
}

export function ZoneComparisonMatrix({ zones }: Props) {
  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <Ionicons name="warning-outline" size={20} color="#0d9488" />
          <CardTitle>Quick Comparison</CardTitle>
        </View>
        <CardDescription>Side-by-side danger ratings with elevation pyramids</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View className="flex-row border-b border-border">
              <View className="w-24 py-2" />
              {zones.map((z) => (
                <View
                  key={z.id}
                  style={{ width: 120 }}
                  className="py-2 px-1 items-center"
                >
                  <Text
                    className="text-sm font-semibold text-foreground text-center"
                    numberOfLines={2}
                  >
                    {z.name}
                  </Text>
                  {z.forecastUrl ? (
                    <Pressable
                      onPress={() => Linking.openURL(z.forecastUrl)}
                      className="flex-row items-center gap-0.5 mt-0.5"
                    >
                      <Text className="text-[10px] text-primary">Forecast</Text>
                      <Ionicons name="open-outline" size={10} color="#0d9488" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Issued */}
            <Row label="Issued" labelIcon="time-outline">
              {zones.map((z) => (
                <Cell key={z.id}>
                  <Text className="text-xs text-foreground">
                    {z.freshness.issueDate || "N/A"}
                  </Text>
                </Cell>
              ))}
            </Row>

            <Row label="Expires">
              {zones.map((z) => {
                const expired = z.freshness.status === "expired";
                const expiring = z.freshness.status === "expiring";
                return (
                  <Cell key={z.id}>
                    <Text
                      className={`text-xs ${
                        expired
                          ? "text-red-600 font-medium"
                          : expiring
                            ? "text-orange-600 font-medium"
                            : "text-foreground"
                      }`}
                    >
                      {z.freshness.expiresDate || "N/A"}
                    </Text>
                  </Cell>
                );
              })}
            </Row>

            <SectionHeader title="Today" colSpan={zones.length + 1} />
            <Row label="Danger">
              {zones.map((z) => (
                <Cell key={z.id}>
                  <ElevationPyramid
                    size="small"
                    danger={
                      z.forecast?.[0]?.danger || {
                        alpine: "NO_RATING",
                        treeline: "NO_RATING",
                        belowTreeline: "NO_RATING",
                      }
                    }
                  />
                </Cell>
              ))}
            </Row>

            <SectionHeader title="Tomorrow" colSpan={zones.length + 1} />
            <Row label="Danger">
              {zones.map((z) => (
                <Cell key={z.id}>
                  <ElevationPyramid
                    size="small"
                    danger={
                      z.forecast?.[1]?.danger || {
                        alpine: "NO_RATING",
                        treeline: "NO_RATING",
                        belowTreeline: "NO_RATING",
                      }
                    }
                  />
                </Cell>
              ))}
            </Row>
          </View>
        </ScrollView>

        <Legend />
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  labelIcon,
  children,
}: {
  label: string;
  labelIcon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row border-b border-border min-h-[44px]">
      <View className="w-24 py-2 px-2 justify-center">
        <View className="flex-row items-center gap-1">
          {labelIcon ? <Ionicons name={labelIcon} size={12} color="#6b7280" /> : null}
          <Text className="text-xs text-muted-foreground">{label}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{ width: 120 }}
      className="py-2 px-1 items-center justify-center"
    >
      {children}
    </View>
  );
}

function SectionHeader({ title }: { title: string; colSpan: number }) {
  return (
    <View className="flex-row border-b border-border bg-muted/30">
      <View className="px-2 py-1">
        <Text className="text-xs font-semibold text-muted-foreground">{title}</Text>
      </View>
    </View>
  );
}

function Legend() {
  return (
    <View className="mt-4 pt-4 border-t border-border">
      <Text className="text-xs text-muted-foreground mb-2">Danger Rating Legend:</Text>
      <View className="flex-row flex-wrap gap-2">
        {(["LOW", "MODERATE", "CONSIDERABLE", "HIGH", "EXTREME"] as DangerRating[]).map(
          (rating) => (
            <View key={rating} className="flex-row items-center gap-1">
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: dangerColors[rating].hex,
                }}
              />
              <Text className="text-xs text-muted-foreground">{rating}</Text>
            </View>
          ),
        )}
      </View>
      <Text className="text-xs text-muted-foreground mt-2">
        <Text className="font-semibold">A</Text> = Alpine (above treeline) ·{" "}
        <Text className="font-semibold">TL</Text> = Treeline ·{" "}
        <Text className="font-semibold">BTL</Text> = Below Treeline
      </Text>
    </View>
  );
}
