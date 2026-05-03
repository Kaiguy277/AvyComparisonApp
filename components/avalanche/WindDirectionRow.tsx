import Svg, { Line, Text as SvgText } from "react-native-svg";
import { palette } from "@/constants/design";
import type { TempDataPoint } from "@/lib/api/avalanche";

// A horizontal strip of compass-letter labels showing wind direction over
// time. Designed to sit directly above the speed/gust chart so it shares
// the same time axis — the labels read top-down with the chart's x-axis,
// giving the user all three wind dimensions in one composed view.
//
// Letter labels (N, NE, E, …) are language-agnostic and stay readable at
// both 24h and 72h ranges. Arrow indicators were tried first but get noisy
// at small sizes and don't differentiate well at a glance.
//
// Direction follows meteorological convention: a "W" wind blows from the
// west, so the label reflects the FROM direction.

const VB_W = 400;
// These match MetricChart's leftPad / rightPad so the sampled x-positions
// line up with the chart's data points underneath.
const LEFT_PAD = 38;
const RIGHT_PAD = 18;

interface Props {
  data: TempDataPoint[]; // value = degrees 0–360
  height?: number;
  // Number of samples to render. 8 reads cleanly at both 24h (every 3h)
  // and 72h (every 9h) without crowding.
  samples?: number;
  fillColor?: string;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function degToCompass(deg: number): string {
  // 8-way bucket. 22.5° per bucket, offset so 0° centers on N.
  const idx = Math.round(((deg % 360) + 360) / 45) % 8;
  return COMPASS[idx];
}

export function WindDirectionRow({
  data,
  height = 18,
  samples = 8,
  fillColor,
}: Props) {
  if (!data || data.length < 2) return null;

  const stamps = data.map((d) => new Date(d.timestamp).getTime());
  const tMin = Math.min(...stamps);
  const tMax = Math.max(...stamps);
  const span = tMax - tMin || 1;
  const usableW = VB_W - LEFT_PAD - RIGHT_PAD;

  const points: { x: number; label: string }[] = [];
  for (let i = 0; i < samples; i++) {
    const targetT = tMin + (i / (samples - 1)) * span;
    let best = data[0];
    let bestDist = Infinity;
    for (const d of data) {
      const t = new Date(d.timestamp).getTime();
      const dist = Math.abs(t - targetT);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    if (best.value === null || best.value === undefined) continue;
    const x = LEFT_PAD + (i / (samples - 1)) * usableW;
    points.push({ x, label: degToCompass(best.value) });
  }

  const fill = fillColor || palette.ink[200];
  const cy = height - 4;

  return (
    <Svg
      style={{ width: "100%", height }}
      viewBox={`0 0 ${VB_W} ${height}`}
      preserveAspectRatio="none"
    >
      {/* Eyebrow label sits in the same gutter MetricChart uses for its
          y-axis labels — keeps the strip visually anchored to the chart. */}
      <SvgText
        x={LEFT_PAD - 5}
        y={cy}
        fontSize={9}
        fill={palette.ink[400]}
        textAnchor="end"
      >
        DIR
      </SvgText>
      {/* Faint baseline so the strip reads as part of the chart's frame. */}
      <Line
        x1={LEFT_PAD}
        y1={height - 1}
        x2={VB_W - RIGHT_PAD}
        y2={height - 1}
        stroke={palette.ink[700]}
        strokeWidth={0.5}
      />
      {points.map((p, i) => (
        <SvgText
          key={i}
          x={p.x}
          y={cy}
          fontSize={9}
          fill={fill}
          fillOpacity={0.85}
          textAnchor={
            i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
          }
          fontWeight="500"
        >
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}
