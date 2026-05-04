import { View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { dangerColors, palette } from "@/constants/design";
import type { ElevationDanger } from "@/lib/api/avalanche";

// Single mountain silhouette, divided horizontally into three bands —
// alpine on top, near-treeline in the middle, below-treeline at the
// base — each filled with the NAC danger color for that elevation.
// Each band carries its label inside (A / TL / BTL) so the glyph is
// self-explanatory; A on alpine fits the narrow apex.
//
// EXTREME's official rendering is black with a red border; that's
// preserved by stroking the affected band's interior cut with the
// danger red.

interface Props {
  danger: ElevationDanger;
  size?: number; // viewport width in px (height scales 0.8x)
  showLabels?: boolean;
}

const Y_PEAK = 6;
const Y_BASE = 74;
const Y_ALP_TL = 30;
const Y_TL_BTL = 54;

function leftAt(y: number): number {
  return 8 + ((Y_BASE - y) * (50 - 8)) / (Y_BASE - Y_PEAK);
}
function rightAt(y: number): number {
  return 92 - ((Y_BASE - y) * (92 - 50)) / (Y_BASE - Y_PEAK);
}

const PATHS = (() => {
  const lAlpTl = leftAt(Y_ALP_TL).toFixed(2);
  const rAlpTl = rightAt(Y_ALP_TL).toFixed(2);
  const lTlBtl = leftAt(Y_TL_BTL).toFixed(2);
  const rTlBtl = rightAt(Y_TL_BTL).toFixed(2);
  return {
    alpine: `M 50 ${Y_PEAK} L ${rAlpTl} ${Y_ALP_TL} L ${lAlpTl} ${Y_ALP_TL} Z`,
    treeline: `M ${lAlpTl} ${Y_ALP_TL} L ${rAlpTl} ${Y_ALP_TL} L ${rTlBtl} ${Y_TL_BTL} L ${lTlBtl} ${Y_TL_BTL} Z`,
    below: `M ${lTlBtl} ${Y_TL_BTL} L ${rTlBtl} ${Y_TL_BTL} L 92 ${Y_BASE} L 8 ${Y_BASE} Z`,
    outline: `M 8 ${Y_BASE} L 50 ${Y_PEAK} L 92 ${Y_BASE} Z`,
    bandLines: [
      `M ${lAlpTl} ${Y_ALP_TL} L ${rAlpTl} ${Y_ALP_TL}`,
      `M ${lTlBtl} ${Y_TL_BTL} L ${rTlBtl} ${Y_TL_BTL}`,
    ],
  };
})();

// Label centroids — vertically positioned for visual centering inside
// each band. Triangle band centroid is 1/3 from the wide base; the two
// trapezoid bands center on the midline. Y values include a small
// fontSize-derived offset since SVG text anchors on the baseline.
const ALPINE_LABEL_Y = 24;
const TREELINE_LABEL_Y = 45;
const BELOW_LABEL_Y = 67;

export function MountainDanger({
  danger,
  size = 56,
  showLabels = true,
}: Props) {
  const aFill = dangerColors[danger.alpine].fill;
  const tFill = dangerColors[danger.treeline].fill;
  const bFill = dangerColors[danger.belowTreeline].fill;
  const stroke = palette.ink[700];

  // Per-band ink colors come from the NAC contrast value so labels
  // stay readable across the full danger scale (white on red, black
  // on yellow, red on the EXTREME black, etc.).
  const aInk = dangerColors[danger.alpine].ink;
  const tInk = dangerColors[danger.treeline].ink;
  const bInk = dangerColors[danger.belowTreeline].ink;

  return (
    <View style={{ width: size, height: (size * 80) / 100 }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 80">
        <Path d={PATHS.below} fill={bFill} />
        <Path d={PATHS.treeline} fill={tFill} />
        <Path d={PATHS.alpine} fill={aFill} />
        {PATHS.bandLines.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={stroke}
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        <Path
          d={PATHS.outline}
          stroke={stroke}
          strokeWidth={1.25}
          fill="none"
          strokeLinejoin="round"
        />
        {showLabels ? (
          <>
            <SvgText
              x={50}
              y={ALPINE_LABEL_Y}
              fontSize={9}
              fontWeight="bold"
              fill={aInk}
              textAnchor="middle"
            >
              A
            </SvgText>
            <SvgText
              x={50}
              y={TREELINE_LABEL_Y}
              fontSize={9}
              fontWeight="bold"
              fill={tInk}
              textAnchor="middle"
            >
              TL
            </SvgText>
            <SvgText
              x={50}
              y={BELOW_LABEL_Y}
              fontSize={9}
              fontWeight="bold"
              fill={bInk}
              textAnchor="middle"
            >
              BTL
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}
