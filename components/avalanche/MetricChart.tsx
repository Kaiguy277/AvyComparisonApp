import { Fragment, useMemo } from "react";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { TempDataPoint } from "@/lib/api/avalanche";

const VB_W = 400;

type ChartMode = "line" | "bar" | "stacked";

interface SeriesSpec {
  data: TempDataPoint[];
  stroke: string;
  fill?: string;
  // For stacked bar charts (e.g. wind avg + gust overlay) the second series
  // renders behind the first as a translucent fill.
  background?: boolean;
}

interface Props {
  // Either a single series or multiple (e.g. wind avg + gust)
  series: SeriesSpec[];
  mode?: ChartMode;
  hours: number; // only used to label x-axis "-Nh"
  height?: number;
  unit?: string;
  // Reference line (like 32° freezing). Optional.
  refValue?: number;
  refLabel?: string;
  refColor?: string;
  // Y-axis labels: forced range; defaults to series min/max.
  yMin?: number;
  yMax?: number;
}

export function MetricChart({
  series,
  mode = "line",
  hours,
  height = 96,
  unit,
  refValue,
  refLabel,
  refColor,
  yMin,
  yMax,
}: Props) {
  const layout = useMemo(() => {
    const all = series.flatMap((s) => s.data);
    if (all.length < 1) return null;

    const values = all.map((d) => d.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const min = yMin !== undefined ? Math.min(yMin, dataMin) : dataMin;
    const rawMax = yMax !== undefined ? Math.max(yMax, dataMax) : dataMax;
    // Avoid a flat-line look when all values are 0
    const max = rawMax === min ? min + 1 : rawMax;
    const range = max - min;

    const leftPad = 38;
    const rightPad = 18;
    const topPad = 10;
    const bottomPad = 18;
    const usableW = VB_W - leftPad - rightPad;
    const usableH = height - topPad - bottomPad;

    const project = (s: SeriesSpec) => {
      // Distribute points across the full width based on their relative
      // timestamp position; if all timestamps are equal fall back to index.
      const stamps = s.data.map((d) => new Date(d.timestamp).getTime());
      const tMin = Math.min(...stamps);
      const tMax = Math.max(...stamps);
      const span = tMax - tMin || 1;
      return s.data.map((d, i) => {
        const t = new Date(d.timestamp).getTime();
        const tx = span > 1 ? (t - tMin) / span : i / Math.max(1, s.data.length - 1);
        const x = leftPad + tx * usableW;
        const y = topPad + (1 - (d.value - min) / range) * usableH;
        return { x, y, value: d.value, timestamp: d.timestamp };
      });
    };

    const projected = series.map((s) => ({ ...s, points: project(s) }));

    return {
      projected,
      leftPad,
      rightPad,
      topPad,
      bottomPad,
      usableW,
      usableH,
      min,
      max,
      range,
    };
  }, [series, height, yMin, yMax]);

  if (!layout) return null;

  const labelColor = "#8794AE";
  const axisColor = "#3B4A6B";

  const refY =
    refValue !== undefined && refValue >= layout.min && refValue <= layout.max
      ? layout.topPad +
        (1 - (refValue - layout.min) / layout.range) * layout.usableH
      : null;

  return (
    <Svg
      style={{ width: "100%", height }}
      viewBox={`0 0 ${VB_W} ${height}`}
      preserveAspectRatio="none"
    >
      {/* Y-axis */}
      <Line
        x1={layout.leftPad}
        y1={layout.topPad - 2}
        x2={layout.leftPad}
        y2={height - layout.bottomPad + 2}
        stroke={axisColor}
        strokeWidth={0.5}
      />
      {/* X-axis */}
      <Line
        x1={layout.leftPad}
        y1={height - layout.bottomPad}
        x2={VB_W - layout.rightPad + 2}
        y2={height - layout.bottomPad}
        stroke={axisColor}
        strokeWidth={0.5}
      />

      {/* Reference line (e.g. freezing) */}
      {refY !== null ? (
        <>
          <Line
            x1={layout.leftPad}
            y1={refY}
            x2={VB_W - layout.rightPad}
            y2={refY}
            stroke={refColor || "#67D5F0"}
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          {refLabel ? (
            <SvgText
              x={VB_W - layout.rightPad - 2}
              y={refY - 3}
              fontSize={9}
              fill={refColor || "#67D5F0"}
              opacity={0.6}
              textAnchor="end"
            >
              {refLabel}
            </SvgText>
          ) : null}
        </>
      ) : null}

      {/* Y-axis labels */}
      <SvgText
        x={layout.leftPad - 5}
        y={layout.topPad + 9}
        fontSize={10}
        fill={labelColor}
        textAnchor="end"
      >
        {`${formatNum(layout.max)}${unit || ""}`}
      </SvgText>
      <SvgText
        x={layout.leftPad - 5}
        y={height - layout.bottomPad + 1}
        fontSize={10}
        fill={labelColor}
        textAnchor="end"
      >
        {`${formatNum(layout.min)}${unit || ""}`}
      </SvgText>

      {/* X-axis time-of-day ticks. Four evenly spaced labels showing actual
          local times across the period. Derived from the first/last data
          timestamps so the labels track the real data window. */}
      {(() => {
        const all = series.flatMap((s) => s.data);
        if (all.length < 2) return null;
        const stamps = all.map((d) => new Date(d.timestamp).getTime());
        const tMin = Math.min(...stamps);
        const tMax = Math.max(...stamps);
        const ticks = 4;
        const elements = [];
        for (let i = 0; i < ticks; i++) {
          const frac = i / (ticks - 1);
          const t = tMin + frac * (tMax - tMin);
          const x = layout.leftPad + frac * layout.usableW;
          const label = formatTickTime(new Date(t), tMax - tMin);
          elements.push(
            <SvgText
              key={`tick-${i}`}
              x={x}
              y={height - 4}
              fontSize={9}
              fill={labelColor}
              textAnchor={i === 0 ? "start" : i === ticks - 1 ? "end" : "middle"}
            >
              {label}
            </SvgText>,
          );
        }
        return elements;
      })()}

      {/* Series rendering */}
      {layout.projected.map((s, idx) => {
        if (mode === "bar") {
          // Bar widths sized so adjacent bars don't overlap
          const barW =
            s.points.length > 1
              ? Math.max(2, layout.usableW / s.points.length - 1)
              : 6;
          return (
            <Fragment key={idx}>
              {s.points.map((p, i) => (
                <Rect
                  key={i}
                  x={p.x - barW / 2}
                  y={p.y}
                  width={barW}
                  height={Math.max(0, height - layout.bottomPad - p.y)}
                  fill={s.fill || s.stroke}
                  fillOpacity={p.value > 0 ? 0.85 : 0.2}
                  rx={1}
                />
              ))}
            </Fragment>
          );
        }

        // Line mode (default + stacked)
        const path = s.points
          .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
          .join(" ");

        // Optional fill: close the path to the baseline
        const fillPath =
          s.fill && s.points.length > 1
            ? `${path} L ${s.points[s.points.length - 1].x} ${height - layout.bottomPad} L ${s.points[0].x} ${height - layout.bottomPad} Z`
            : null;

        return (
          <Fragment key={idx}>
            {fillPath ? (
              <Path
                d={fillPath}
                fill={s.fill}
                fillOpacity={s.background ? 0.18 : 0.25}
                stroke="none"
              />
            ) : null}
            <Path
              d={path}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.background ? 1 : 1.8}
              strokeOpacity={s.background ? 0.55 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {!s.background && s.points.length > 0 ? (
              <>
                <Circle
                  cx={s.points[0].x}
                  cy={s.points[0].y}
                  r={2.5}
                  fill={s.stroke}
                  opacity={0.6}
                />
                <Circle
                  cx={s.points[s.points.length - 1].x}
                  cy={s.points[s.points.length - 1].y}
                  r={4}
                  fill="#67D5F0"
                />
              </>
            ) : null}
          </Fragment>
        );
      })}
    </Svg>
  );
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return Math.round(n).toString();
  if (Math.abs(n) >= 1) return n.toFixed(1);
  return n.toFixed(2);
}

// Compact time-of-day label. Adapts format based on how wide the window
// is — short windows show hour-only ("6P"), longer windows show
// day+hour ("Tue 6P") so the user knows which day a tick refers to.
function formatTickTime(d: Date, rangeMs: number): string {
  const hour = d.getHours();
  const ampm = hour >= 12 ? "P" : "A";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const hourLabel = `${h12}${ampm}`;
  if (rangeMs > 36 * 60 * 60 * 1000) {
    // Long window — include day-of-week prefix
    const day = d.toLocaleDateString("en-US", { weekday: "short" });
    return `${day} ${hourLabel}`;
  }
  return hourLabel;
}

