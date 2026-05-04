import { useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Text";
import { MetricChart } from "./MetricChart";
import { WindCompass } from "./WindCompass";
import { WindDirectionRow } from "./WindDirectionRow";
import { palette } from "@/constants/design";
import type { TempDataPoint, WeatherObservation } from "@/lib/api/avalanche";

type Period = 24 | 72;

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
  const [period, setPeriod] = useState<Period>(24);
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
      {/* Station header + period toggle */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          gap: 12,
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
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "baseline",
            gap: 6,
            minWidth: 0,
          }}
        >
          <Text
            variant="display"
            className="text-ink-50"
            style={{ fontSize: 17, lineHeight: 21, flexShrink: 1 }}
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
        <PeriodToggle period={period} onChange={setPeriod} />
      </View>

      <Text
        variant="mono"
        weight="medium"
        className="text-ink-300"
        style={{ fontSize: 11, marginBottom: 14 }}
      >
        {obs.elevation.toLocaleString()}′ ELEV
      </Text>

      <TempBlock obs={obs} period={period} />
      <Divider />
      <WindBlock obs={obs} period={period} />
      <Divider />
      <PrecipBlock obs={obs} period={period} />
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

function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 2,
        borderRadius: 999,
        backgroundColor: palette.ink[800],
        borderWidth: 0.5,
        borderColor: palette.ink[700],
      }}
    >
      {([24, 72] as Period[]).map((p) => {
        const active = period === p;
        return (
          <Pressable
            key={p}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(p);
            }}
            hitSlop={4}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: active ? palette.ink[50] : "transparent",
            }}
          >
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                color: active ? palette.ink[950] : palette.ink[300],
              }}
            >
              {p}H
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPERATURE
// ─────────────────────────────────────────────────────────────────────────
function TempBlock({ obs, period }: { obs: WeatherObservation; period: Period }) {
  const t = obs.temperature;
  const series = period === 24 ? t.hourly24hr : t.hourly72hr;
  const high = period === 24 ? t.high24hr : t.high72hr;
  const low = period === 24 ? t.low24hr : t.low72hr;

  return (
    <View>
      <SectionLabel>TEMP</SectionLabel>

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

      {series && series.length >= 2 ? (
        <View style={{ marginTop: 14 }}>
          <MetricChart
            hours={period}
            height={104}
            unit="°"
            refValue={32}
            refLabel="32°"
            series={[
              { data: series, stroke: palette.ink[100], fill: palette.ink[100] },
            ]}
          />
        </View>
      ) : (
        <DataNote>Not enough hourly data for this period.</DataNote>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
        <RangeStat label={`${period}H HIGH`} value={high} unit="°" />
        <RangeStat label={`${period}H LOW`} value={low} unit="°" />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// WIND
// ─────────────────────────────────────────────────────────────────────────
function WindBlock({ obs, period }: { obs: WeatherObservation; period: Period }) {
  const w = obs.wind;
  if (!w) {
    return (
      <View>
        <SectionLabel>WIND</SectionLabel>
        <DataNote>This station doesn&apos;t have wind sensors.</DataNote>
      </View>
    );
  }

  const speedSeries = period === 24 ? w.hourlySpeed24hr : w.hourlySpeed72hr;
  const gustSeries = period === 24 ? w.hourlyGust24hr : w.hourlyGust72hr;
  const dirSeries = period === 24 ? w.hourlyDirection24hr : w.hourlyDirection72hr;
  const avg = period === 24 ? w.speedAvg24hr : w.speedAvg72hr;
  const max = period === 24 ? w.speedMax24hr : w.speedMax72hr;
  const dir = period === 24 ? w.direction24hr : w.direction72hr;

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
          {max !== null ? (
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 12, marginTop: 2 }}
            >
              {period}H gusts to{" "}
              <Text
                variant="mono"
                weight="bold"
                className="text-ink-50"
                style={{ fontSize: 14 }}
              >
                {max}
              </Text>
            </Text>
          ) : null}
        </View>
      </View>

      {speedSeries && speedSeries.length >= 2 ? (
        <View style={{ marginTop: 14 }}>
          {/* Direction sits above the speed/gust chart and shares the same
              x-axis so the user reads all three wind dimensions in one
              vertical glance. */}
          {dirSeries && dirSeries.length >= 2 ? (
            <WindDirectionRow data={dirSeries} />
          ) : null}
          <MetricChart
            hours={period}
            height={104}
            unit=""
            yMin={0}
            series={[
              ...(gustSeries && gustSeries.length >= 2
                ? [
                    {
                      data: gustSeries,
                      stroke: palette.aspen[400],
                      fill: palette.aspen[400],
                      background: true,
                    },
                  ]
                : []),
              { data: speedSeries, stroke: palette.ink[100] },
            ]}
          />
          <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
            <LegendDot color={palette.ink[100]} label="hourly avg" />
            {gustSeries && gustSeries.length >= 2 ? (
              <LegendDot color={palette.aspen[400]} label="hourly max gust" />
            ) : null}
          </View>
        </View>
      ) : (
        <DataNote>Not enough hourly wind data for this period.</DataNote>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
        <RangeStat label={`${period}H AVG`} value={avg} unit=" mph" />
        <RangeStat label={`${period}H MAX`} value={max} unit=" mph" />
        <RangeStat label={`${period}H DIR`} value={dir} mono />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PRECIP
// ─────────────────────────────────────────────────────────────────────────
function PrecipBlock({ obs, period }: { obs: WeatherObservation; period: Period }) {
  const s = obs.snow;
  const series = period === 24 ? s.hourlyPrecip24hr : s.hourlyPrecip72hr;
  // Derive the period total from the bars so the headline number always
  // matches what's plotted. The upstream `precip24hr` field is
  // current_cumulative − value_24hr_ago, which can disagree with the bars
  // when the cumulative gauge has any negative-diff hours (sensor resets,
  // calibration corrections) — those get clamped to 0 in hourlyIncrements.
  // Sum-of-positive-increments matches users' intuition for "precip in this
  // window" anyway.
  const seriesSum = series && series.length > 0
    ? Math.round(series.reduce((acc, p) => acc + (p.value || 0), 0) * 100) / 100
    : null;
  const upstreamTotal = period === 24 ? s.precip24hr : s.precip72hr;
  const total = seriesSum !== null ? seriesSum : upstreamTotal;
  const newSnow = period === 24 ? s.depth24hrChange : s.depth72hrChange;
  const density =
    newSnow !== null && newSnow > 0 && total !== null && total > 0
      ? Math.round((total / newSnow) * 100)
      : null;

  return (
    <View>
      <SectionLabel>PRECIP</SectionLabel>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 16 }}>
        <View>
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 10, letterSpacing: 1.4 }}
          >
            {period}H NEW SNOW
          </Text>
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 36,
              color: newSnow !== null && newSnow > 0
                ? palette.frost[400]
                : palette.ink[200],
              letterSpacing: -0.5,
              lineHeight: 38,
            }}
          >
            {newSnow !== null
              ? newSnow > 0
                ? `+${newSnow}″`
                : `${newSnow}″`
              : "—"}
          </Text>
        </View>
        <View>
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 10, letterSpacing: 1.4 }}
          >
            {period}H SWE
          </Text>
          <Text
            variant="mono"
            weight="bold"
            className="text-ink-50"
            style={{ fontSize: 22, letterSpacing: -0.3, lineHeight: 26 }}
          >
            {total !== null ? `${total.toFixed(1)}″` : "—"}
          </Text>
          {density !== null ? (
            <Text
              variant="mono"
              className="text-ink-400"
              style={{ fontSize: 11 }}
            >
              {density}% density
            </Text>
          ) : null}
        </View>
      </View>

      {series && series.length >= 2 ? (
        <View style={{ marginTop: 14 }}>
          <MetricChart
            hours={period}
            height={88}
            unit=""
            yMin={0}
            mode="bar"
            series={[
              {
                data: series,
                stroke: palette.frost[400],
                fill: palette.frost[400],
              },
            ]}
          />
          <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
            <LegendDot color={palette.frost[400]} label="hourly SWE (in)" />
          </View>
        </View>
      ) : (
        <DataNote>Not enough hourly precip data for this period.</DataNote>
      )}

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

// ─────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────
function RangeStat({
  label,
  value,
  unit,
  mono,
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  mono?: boolean;
}) {
  const display =
    value === null || value === undefined
      ? "—"
      : typeof value === "number"
        ? `${value}${unit ?? ""}`
        : value;
  return (
    <View>
      <Text
        variant="mono"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.4 }}
      >
        {label}
      </Text>
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 16,
          color: mono ? palette.frost[400] : palette.ink[100],
          marginTop: 2,
        }}
      >
        {display}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
      <Text
        variant="mono"
        className="text-ink-400"
        style={{ fontSize: 10, letterSpacing: 1.2 }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function DataNote({ children }: { children: string }) {
  return (
    <Text
      variant="mono"
      className="text-ink-400 italic"
      style={{ fontSize: 11, letterSpacing: 0.6, marginTop: 8 }}
    >
      {children}
    </Text>
  );
}

// Suppress unused-var: TempDataPoint kept for type clarity above
type _TempDataPoint = TempDataPoint;
