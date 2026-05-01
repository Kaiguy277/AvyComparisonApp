import { Linking, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { ElevationPyramid } from "./ElevationPyramid";
import { dangerColors, palette } from "@/constants/design";
import type { AvalancheZone, DangerRating } from "@/lib/api/avalanche";

const COL_W = 132;
const ROW_LABEL_W = 92;

interface Props {
  zones: AvalancheZone[];
}

export function ZoneComparisonMatrix({ zones }: Props) {
  return (
    <View>
      <View className="flex-row items-baseline justify-between px-1 mb-3">
        <Text
          variant="mono"
          weight="medium"
          className="text-ink-300"
          style={{ fontSize: 11, letterSpacing: 1.6 }}
        >
          MATRIX · {zones.length} ZONE{zones.length !== 1 ? "S" : ""}
        </Text>
        <Text
          variant="mono"
          className="text-ink-400"
          style={{ fontSize: 10, letterSpacing: 1.2 }}
        >
          SCROLL →
        </Text>
      </View>

      <View
        className="rounded-2xl bg-ink-900 overflow-hidden"
        style={{ borderWidth: 0.5, borderColor: palette.ink[700] }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View
              style={{
                flexDirection: "row",
                borderBottomWidth: 0.5,
                borderColor: palette.ink[700],
                backgroundColor: palette.ink[800],
              }}
            >
              <View style={{ width: ROW_LABEL_W, padding: 12 }}>
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-400"
                  style={{ fontSize: 10, letterSpacing: 1.4 }}
                >
                  ZONE
                </Text>
              </View>
              {zones.map((z) => (
                <View
                  key={z.id}
                  style={{
                    width: COL_W,
                    padding: 12,
                    borderLeftWidth: 0.5,
                    borderColor: palette.ink[700],
                  }}
                >
                  <Text
                    variant="display"
                    className="text-ink-50"
                    style={{ fontSize: 16, lineHeight: 18 }}
                    numberOfLines={2}
                  >
                    {z.name}
                  </Text>
                  {z.forecastUrl ? (
                    <Pressable
                      onPress={() => Linking.openURL(z.forecastUrl)}
                      className="flex-row items-center gap-1 mt-1"
                    >
                      <Text
                        variant="mono"
                        className="text-frost-400"
                        style={{ fontSize: 9, letterSpacing: 1.2 }}
                      >
                        OFFICIAL
                      </Text>
                      <Ionicons
                        name="arrow-up-outline"
                        size={9}
                        color={palette.frost[400]}
                        style={{ transform: [{ rotate: "45deg" }] }}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Issued */}
            <Row label="Issued">
              {zones.map((z) => (
                <Cell key={z.id}>
                  <Text
                    variant="mono"
                    className="text-ink-200"
                    style={{ fontSize: 11 }}
                  >
                    {z.freshness.issueDate || "—"}
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
                      variant="mono"
                      className={
                        expired
                          ? "text-[#FCA5A5]"
                          : expiring
                            ? "text-aspen-400"
                            : "text-ink-200"
                      }
                      style={{ fontSize: 11 }}
                    >
                      {z.freshness.expiresDate || "—"}
                    </Text>
                  </Cell>
                );
              })}
            </Row>

            {/* Today header */}
            <SectionRow label="TODAY" />
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

            <SectionRow label="TOMORROW" />
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
      </View>
    </View>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderColor: palette.ink[700],
        minHeight: 52,
      }}
    >
      <View
        style={{
          width: ROW_LABEL_W,
          paddingHorizontal: 12,
          paddingVertical: 12,
          justifyContent: "center",
          backgroundColor: palette.ink[900],
        }}
      >
        <Text
          variant="mono"
          weight="medium"
          className="text-ink-400"
          style={{ fontSize: 10, letterSpacing: 1.2 }}
        >
          {label.toUpperCase()}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        width: COL_W,
        paddingHorizontal: 12,
        paddingVertical: 10,
        alignItems: "center",
        justifyContent: "center",
        borderLeftWidth: 0.5,
        borderColor: palette.ink[700],
      }}
    >
      {children}
    </View>
  );
}

function SectionRow({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: palette.ink[800],
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderColor: palette.ink[700],
      }}
    >
      <Text
        variant="mono"
        weight="bold"
        className="text-frost-400"
        style={{ fontSize: 10, letterSpacing: 1.8 }}
      >
        {label}
      </Text>
    </View>
  );
}

function Legend() {
  return (
    <View
      style={{
        padding: 14,
        borderTopWidth: 0.5,
        borderColor: palette.ink[700],
      }}
    >
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-400"
        style={{ fontSize: 9, letterSpacing: 1.4, marginBottom: 8 }}
      >
        DANGER · D-SCALE
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
        {(["LOW", "MODERATE", "CONSIDERABLE", "HIGH", "EXTREME"] as DangerRating[]).map(
          (r) => {
            const c = dangerColors[r];
            return (
              <View
                key={r}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  borderWidth: 0.5,
                  borderColor: palette.ink[600],
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: c.fill,
                  }}
                />
                <Text
                  variant="mono"
                  weight="medium"
                  className="text-ink-200"
                  style={{ fontSize: 9, letterSpacing: 0.8 }}
                >
                  {c.level} · {r}
                </Text>
              </View>
            );
          },
        )}
      </View>
      <Text
        className="text-ink-400 mt-3"
        style={{ fontSize: 11, lineHeight: 15 }}
      >
        <Text variant="mono" weight="bold" className="text-ink-200">A</Text> Alpine ·{" "}
        <Text variant="mono" weight="bold" className="text-ink-200">TL</Text> Treeline ·{" "}
        <Text variant="mono" weight="bold" className="text-ink-200">B</Text> Below treeline
      </Text>
    </View>
  );
}
