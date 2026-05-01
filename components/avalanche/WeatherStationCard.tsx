import { Alert, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { TempSparkline } from "./TempSparkline";
import { WindCompass } from "./WindCompass";
import { palette } from "@/constants/design";
import type { WeatherObservation } from "@/lib/api/avalanche";

interface Props {
  observations: WeatherObservation[];
  note?: string;
}

export function WeatherStationCard({ observations, note }: Props) {
  if (!observations || observations.length === 0) return null;
  return (
    <View>
      {note ? (
        <Text
          className="text-ink-400 italic mb-3"
          style={{ fontSize: 12, lineHeight: 17 }}
        >
          {note}
        </Text>
      ) : null}
      <View style={{ gap: 16 }}>
        {observations.map((obs, i) => (
          <Station key={i} obs={obs} divider={i > 0} />
        ))}
      </View>
    </View>
  );
}

function Station({ obs, divider }: { obs: WeatherObservation; divider: boolean }) {
  const lastUpdated = obs.timestamp ? new Date(obs.timestamp).toLocaleString() : null;
  const stationUrl = `https://mesowest.utah.edu/cgi-bin/droman/meso_base_dyn.cgi?stn=${obs.stationTriplet}`;

  return (
    <View
      style={{
        paddingTop: divider ? 16 : 0,
        borderTopWidth: divider ? 0.5 : 0,
        borderColor: palette.ink[700],
      }}
    >
      {/* Station header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <Pressable
          onPress={() =>
            Alert.alert(
              obs.stationName,
              [
                `ID · ${obs.stationTriplet}`,
                `Elevation · ${obs.elevation.toLocaleString()}'`,
                `Quality · ${obs.dataQuality}`,
                lastUpdated ? `Updated · ${lastUpdated}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
              [
                { text: "View station", onPress: () => Linking.openURL(stationUrl) },
                { text: "Close", style: "cancel" },
              ],
            )
          }
          hitSlop={6}
          style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: 6 }}
        >
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 17, lineHeight: 21 }}
            numberOfLines={1}
          >
            {obs.stationName}
          </Text>
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={palette.ink[400]}
          />
        </Pressable>
        <Text
          variant="mono"
          weight="medium"
          className="text-ink-300"
          style={{ fontSize: 12 }}
        >
          {obs.elevation.toLocaleString()}′
        </Text>
      </View>

      <TempBlock obs={obs} />
      <Divider />
      <SnowBlock obs={obs} />
      {obs.wind ? (
        <>
          <Divider />
          <WindBlock obs={obs} />
        </>
      ) : null}
    </View>
  );
}

function Divider() {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: palette.ink[700],
        marginVertical: 18,
      }}
    />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      variant="mono"
      weight="medium"
      className="text-ink-300"
      style={{ fontSize: 11, letterSpacing: 1.8, marginBottom: 12 }}
    >
      {children}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPERATURE
// Big current value + trend + 72h sparkline + 24/72h H/L readouts
// ─────────────────────────────────────────────────────────────────────────
function TempBlock({ obs }: { obs: WeatherObservation }) {
  const t = obs.temperature;
  const has72hChart = t.hourly72hr && t.hourly72hr.length >= 2;
  const trendCfg = trendStyle(t.trend, t.current);

  return (
    <View>
      <SectionLabel>TEMP</SectionLabel>

      {/* Current + trend */}
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 14 }}>
        <Text
          variant="mono"
          weight="bold"
          style={{
            color: palette.ink[50],
            fontSize: 56,
            letterSpacing: -1.5,
            lineHeight: 58,
          }}
        >
          {t.current !== null ? `${t.current}°` : "—"}
        </Text>
        {trendCfg ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              borderWidth: 0.5,
              borderColor: trendCfg.border,
              backgroundColor: trendCfg.bg,
            }}
          >
            <Ionicons name={trendCfg.icon} size={12} color={trendCfg.fg} />
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 10,
                letterSpacing: 1.4,
                color: trendCfg.fg,
              }}
            >
              {trendCfg.label}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 72h sparkline */}
      {has72hChart ? (
        <View style={{ marginTop: 12 }}>
          <TempSparkline
            data={t.hourly72hr!}
            high={t.high72hr}
            low={t.low72hr}
            hours={72}
            height={88}
            expand
          />
        </View>
      ) : null}

      {/* H/L readouts */}
      <View
        style={{
          flexDirection: "row",
          gap: 16,
          marginTop: 12,
        }}
      >
        <RangeStat label="24H" high={t.high24hr} low={t.low24hr} />
        <RangeStat label="72H" high={t.high72hr} low={t.low72hr} />
      </View>
    </View>
  );
}

function RangeStat({
  label,
  high,
  low,
}: {
  label: string;
  high: number | null;
  low: number | null;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        variant="mono"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.4 }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 10 }}
          >
            H
          </Text>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-100"
            style={{ fontSize: 14 }}
          >
            {high !== null ? `${high}°` : "—"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 10 }}
          >
            L
          </Text>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-100"
            style={{ fontSize: 14 }}
          >
            {low !== null ? `${low}°` : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function trendStyle(
  trend: "warming" | "cooling" | "stable" | null,
  current: number | null,
):
  | {
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      fg: string;
      bg: string;
      border: string;
    }
  | null {
  if (!trend) return null;
  if (trend === "warming") {
    // Warming above freezing is a meaningful avy signal — tint aspen/orange.
    const hot = current !== null && current > 32;
    return {
      icon: "trending-up",
      label: "WARMING",
      fg: hot ? palette.aspen[400] : palette.ink[100],
      bg: hot ? palette.aspen[500] + "20" : palette.ink[700] + "80",
      border: hot ? palette.aspen[500] + "60" : palette.ink[600],
    };
  }
  if (trend === "cooling") {
    return {
      icon: "trending-down",
      label: "COOLING",
      fg: palette.frost[400],
      bg: palette.frost[400] + "1A",
      border: palette.frost[600],
    };
  }
  return {
    icon: "remove-outline",
    label: "STABLE",
    fg: palette.ink[300],
    bg: palette.ink[700] + "80",
    border: palette.ink[600],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SNOW
// Two horizontal bars (24h, 72h). Each shows new-snow inches, SWE,
// and storm density when both numbers are available.
// ─────────────────────────────────────────────────────────────────────────
function SnowBlock({ obs }: { obs: WeatherObservation }) {
  const s = obs.snow;
  return (
    <View>
      <SectionLabel>NEW SNOW</SectionLabel>
      <View style={{ gap: 14 }}>
        <SnowBar
          label="24H"
          newSnow={s.depth24hrChange}
          swe={s.precip24hr}
        />
        <SnowBar
          label="72H"
          newSnow={s.depth72hrChange}
          swe={s.precip72hr}
        />
      </View>
      {s.depth !== null ? (
        <View
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 10, letterSpacing: 1.4 }}
          >
            BASE DEPTH
          </Text>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-100"
            style={{ fontSize: 14 }}
          >
            {s.depth}″
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const SNOW_BAR_FULL_INCHES = 18;

function SnowBar({
  label,
  newSnow,
  swe,
}: {
  label: string;
  newSnow: number | null;
  swe: number | null;
}) {
  const inches = newSnow ?? 0;
  const pct = Math.max(0, Math.min(1, inches / SNOW_BAR_FULL_INCHES));
  const sweOK = swe !== null && swe > 0;
  const density =
    newSnow !== null && newSnow > 0 && sweOK
      ? Math.round((swe! / newSnow!) * 100)
      : null;

  const isAccum = newSnow !== null && newSnow > 0;
  const color = isAccum ? palette.frost[400] : palette.ink[600];

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text
            variant="mono"
            weight="medium"
            className="text-ink-300"
            style={{ fontSize: 11, letterSpacing: 1.4 }}
          >
            {label}
          </Text>
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 22,
              color: isAccum ? palette.frost[400] : palette.ink[200],
              letterSpacing: -0.5,
            }}
          >
            {newSnow !== null ? (newSnow > 0 ? `+${newSnow}″` : `${newSnow}″`) : "—"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          {sweOK ? (
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 11 }}
            >
              {swe!.toFixed(1)}″ SWE
            </Text>
          ) : null}
          {density !== null ? (
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 11 }}
            >
              {density}%
            </Text>
          ) : null}
        </View>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: palette.ink[800],
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            backgroundColor: color,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// WIND
// Compass + current speed/direction, then 24h and 72h breakdowns.
// ─────────────────────────────────────────────────────────────────────────
function WindBlock({ obs }: { obs: WeatherObservation }) {
  const w = obs.wind!;
  return (
    <View>
      <SectionLabel>WIND</SectionLabel>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <WindCompass direction={w.direction} size={64} active={!!w.direction} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text
              variant="mono"
              weight="bold"
              className="text-ink-50"
              style={{ fontSize: 28, letterSpacing: -0.5, lineHeight: 30 }}
            >
              {w.speedCurrent !== null ? `${w.speedCurrent}` : "—"}
            </Text>
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 14, letterSpacing: 1 }}
            >
              MPH
            </Text>
            {w.direction ? (
              <Text
                variant="mono"
                weight="medium"
                className="text-frost-400"
                style={{ fontSize: 14, letterSpacing: 1.4, marginLeft: 8 }}
              >
                {w.direction}
              </Text>
            ) : null}
          </View>
          {w.speedMax24hr !== null ? (
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 12, marginTop: 2 }}
            >
              gusts to{" "}
              <Text
                variant="mono"
                weight="bold"
                className="text-ink-50"
                style={{ fontSize: 14 }}
              >
                {w.speedMax24hr}
              </Text>
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 14, gap: 8 }}>
        <WindRow
          label="24H"
          avg={w.speedAvg24hr}
          max={w.speedMax24hr}
          dir={w.direction24hr}
        />
        <WindRow
          label="72H"
          avg={w.speedAvg72hr}
          max={w.speedMax72hr}
          dir={w.direction72hr}
        />
      </View>
    </View>
  );
}

function WindRow({
  label,
  avg,
  max,
  dir,
}: {
  label: string;
  avg: number | null;
  max: number | null;
  dir: string | null;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
      }}
    >
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.4, width: 36 }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <NumStat label="avg" value={avg !== null ? `${avg}` : "—"} />
        <NumStat label="max" value={max !== null ? `${max}` : "—"} />
        <Text
          variant="mono"
          weight="medium"
          style={{
            fontSize: 13,
            color: dir ? palette.frost[400] : palette.ink[400],
            letterSpacing: 1.4,
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {dir || "—"}
        </Text>
      </View>
    </View>
  );
}

function NumStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
      <Text
        variant="mono"
        className="text-ink-400"
        style={{ fontSize: 10 }}
      >
        {label}
      </Text>
      <Text
        variant="mono"
        weight="medium"
        className="text-ink-100"
        style={{ fontSize: 14 }}
      >
        {value}
      </Text>
    </View>
  );
}
