import Svg, { Line, Polygon, Text as SvgText } from "react-native-svg";
import { palette } from "@/constants/design";
import type { TempDataPoint } from "@/lib/api/avalanche";

// A horizontal strip of small arrow glyphs showing how wind direction
// changed across the period. Sits directly above the speed/gust chart and
// shares the same x-axis so the user reads all three wind dimensions in
// one composed view.
//
// Each arrow rotates to the bearing reading. Meteorological convention:
// direction is the FROM bearing (a "W wind" blows out of the west). We
// render the arrow pointing DOWNWIND (the direction the wind is blowing
// to) — that's the more intuitive read for a graph: arrows show where the
// air is heading. So a 0° (FROM N) reading draws an arrow pointing south.

const VB_W = 400;
// These match MetricChart's leftPad / rightPad so the sampled x-positions
// line up with the chart's data points underneath.
const LEFT_PAD = 38;
const RIGHT_PAD = 18;

interface Props {
  data: TempDataPoint[]; // value = degrees 0–360 (FROM bearing)
  height?: number;
  // Number of samples to render. 12 reads cleanly at both 24h (every 2h)
  // and 72h (every 6h) without crowding.
  samples?: number;
  fillColor?: string;
}

export function WindDirectionRow({
  data,
  height = 22,
  samples = 12,
  fillColor,
}: Props) {
  if (!data || data.length < 2) return null;

  const stamps = data.map((d) => new Date(d.timestamp).getTime());
  const tMin = Math.min(...stamps);
  const tMax = Math.max(...stamps);
  const span = tMax - tMin || 1;
  const usableW = VB_W - LEFT_PAD - RIGHT_PAD;

  const points: { x: number; deg: number }[] = [];
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
    points.push({ x, deg: best.value });
  }

  const fill = fillColor || palette.ink[200];
  const cy = Math.round(height / 2);
  // Arrow geometry: a slim chevron pointing up (north) at rotate(0).
  // Tip at y=cy-arrowH/2, base at y=cy+arrowH/2, with a notch in the base
  // so it reads as a directional arrow rather than a triangle.
  const arrowH = 11;
  const arrowW = 6;
  const tipY = cy - arrowH / 2;
  const baseY = cy + arrowH / 2;
  const arrowPoints = [
    `0,${tipY}`,
    `${arrowW / 2},${baseY}`,
    `0,${baseY - 3}`,
    `${-arrowW / 2},${baseY}`,
  ].join(" ");

  return (
    <Svg
      style={{ width: "100%", height }}
      viewBox={`0 0 ${VB_W} ${height}`}
      preserveAspectRatio="none"
    >
      <SvgText
        x={LEFT_PAD - 5}
        y={cy + 3}
        fontSize={9}
        fill={palette.ink[400]}
        textAnchor="end"
      >
        DIR
      </SvgText>
      <Line
        x1={LEFT_PAD}
        y1={height - 1}
        x2={VB_W - RIGHT_PAD}
        y2={height - 1}
        stroke={palette.ink[700]}
        strokeWidth={0.5}
      />
      {points.map((p, i) => (
        <Polygon
          key={i}
          points={arrowPoints}
          fill={fill}
          fillOpacity={0.85}
          // Rotate around the arrow's anchor (its own 0,cy origin) by deg+180
          // so a FROM-N (0°) reading points south (downwind).
          transform={`translate(${p.x} 0) rotate(${(p.deg + 180) % 360} 0 ${cy})`}
        />
      ))}
    </Svg>
  );
}
