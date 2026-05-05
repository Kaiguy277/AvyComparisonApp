import { View } from "react-native";
import Svg, { Circle, Path, Text as SvgText, Line } from "react-native-svg";
import { palette } from "@/constants/design";
import type { AspectElevation } from "@/lib/api/avalanche";

// Standard avalanche rose: 8 aspect octants × 3 elevation rings = 24 cells.
// Filled cells = problem exists in that aspect/elevation combination.
//
// Convention (matches Utah Avalanche Center / UAC):
// - Inner ring  → above treeline / alpine
// - Middle ring → near treeline
// - Outer ring  → below treeline
// - Octants run clockwise from north: N, NE, E, SE, S, SW, W, NW

const ASPECTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

const ASPECT_BASE_ANGLE: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function elevationToRingIndex(elev: string): number {
  const e = elev.toLowerCase();
  if (e.includes("alpine") || e.includes("above")) return 0; // inner
  if (e.includes("below")) return 2; // outer
  return 1; // treeline / middle
}

interface Props {
  aspects: AspectElevation[];
  size?: number;
  // Color used for active (problem-present) segments. Defaults to aspen.
  fillColor?: string;
}

export function ProblemRose({ aspects, size = 96, fillColor }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 10; // leave room for the cardinal letter labels
  const fill = fillColor || palette.aspen[400];

  // Three concentric ring boundaries: 0 → r1 (alpine center), r1 → r2
  // (treeline), r2 → R (below treeline outer). Inner alpine band is the
  // largest so its octants stay readable — that matches how UAC draws it.
  const r1 = R * 0.5;
  const r2 = R * 0.78;

  // Build a quick lookup of which ring/aspect cells are active.
  const active = new Set<string>();
  for (const ae of aspects) {
    const ring = elevationToRingIndex(ae.elevation);
    for (const a of ae.aspects) {
      active.add(`${ring}|${a.toUpperCase()}`);
    }
  }

  // Geometry for one cell — a "donut wedge" between two radii spanning
  // 45° centered on the aspect's base angle. Special-cases r0 = 0 (the
  // innermost ring is a pie slice from center).
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180; // 0° = north (top)
  function wedge(rIn: number, rOut: number, startA: number, endA: number) {
    const xOuterStart = cx + rOut * Math.cos(rad(startA));
    const yOuterStart = cy + rOut * Math.sin(rad(startA));
    const xOuterEnd = cx + rOut * Math.cos(rad(endA));
    const yOuterEnd = cy + rOut * Math.sin(rad(endA));
    if (rIn <= 0) {
      return [
        `M ${cx} ${cy}`,
        `L ${xOuterStart} ${yOuterStart}`,
        `A ${rOut} ${rOut} 0 0 1 ${xOuterEnd} ${yOuterEnd}`,
        "Z",
      ].join(" ");
    }
    const xInnerStart = cx + rIn * Math.cos(rad(startA));
    const yInnerStart = cy + rIn * Math.sin(rad(startA));
    const xInnerEnd = cx + rIn * Math.cos(rad(endA));
    const yInnerEnd = cy + rIn * Math.sin(rad(endA));
    return [
      `M ${xInnerStart} ${yInnerStart}`,
      `L ${xOuterStart} ${yOuterStart}`,
      `A ${rOut} ${rOut} 0 0 1 ${xOuterEnd} ${yOuterEnd}`,
      `L ${xInnerEnd} ${yInnerEnd}`,
      `A ${rIn} ${rIn} 0 0 0 ${xInnerStart} ${yInnerStart}`,
      "Z",
    ].join(" ");
  }

  // Render order: each ring × each aspect.
  const cells: { d: string; key: string; on: boolean }[] = [];
  for (let ring = 0; ring < 3; ring++) {
    const rIn = ring === 0 ? 0 : ring === 1 ? r1 : r2;
    const rOut = ring === 0 ? r1 : ring === 1 ? r2 : R;
    for (const aspect of ASPECTS) {
      const base = ASPECT_BASE_ANGLE[aspect];
      const startA = base - 22.5;
      const endA = base + 22.5;
      cells.push({
        d: wedge(rIn, rOut, startA, endA),
        key: `${ring}|${aspect}`,
        on: active.has(`${ring}|${aspect}`),
      });
    }
  }

  // Cardinal labels (N E S W) sitting just outside the outer ring.
  const labelR = R + 6;
  const labels: { x: number; y: number; text: string }[] = [
    { x: cx + 0, y: cy - labelR, text: "N" },
    { x: cx + labelR, y: cy + 0, text: "E" },
    { x: cx + 0, y: cy + labelR, text: "S" },
    { x: cx - labelR, y: cy + 0, text: "W" },
  ];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Filled cells first so strokes draw on top */}
        {cells
          .filter((c) => c.on)
          .map((c) => (
            <Path
              key={`fill-${c.key}`}
              d={c.d}
              fill={fill}
              fillOpacity={0.85}
            />
          ))}
        {/* Inactive cell strokes — gives the empty rose its skeleton */}
        {cells.map((c) => (
          <Path
            key={`stroke-${c.key}`}
            d={c.d}
            fill="none"
            stroke={c.on ? palette.ink[100] : palette.ink[600]}
            strokeOpacity={c.on ? 1 : 0.55}
            strokeWidth={0.6}
          />
        ))}
        {/* Outer ring outline for crispness */}
        <Circle
          cx={cx}
          cy={cy}
          r={R}
          stroke={palette.ink[500]}
          strokeWidth={0.75}
          fill="none"
        />
        {/* Cardinal cross — subtle, helps read aspect at a glance */}
        {[
          [cx, cy - R, cx, cy + R],
          [cx - R, cy, cx + R, cy],
        ].map(([x1, y1, x2, y2], i) => (
          <Line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={palette.ink[500]}
            strokeOpacity={0.35}
            strokeWidth={0.5}
          />
        ))}
        {/* Cardinal letter labels */}
        {labels.map((l, i) => (
          <SvgText
            key={i}
            x={l.x}
            y={l.y + 3}
            fontSize={8.5}
            fontWeight="bold"
            fill={palette.ink[300]}
            textAnchor="middle"
          >
            {l.text}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
