import { View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { palette } from "@/constants/design";

const DIRECTION_TO_DEG: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

interface Props {
  direction: string | null | undefined;
  size?: number;
  active?: boolean;
}

// Compact compass dial. Arrow points in the FROM direction
// (meteorological convention: a "W" wind blows from the west).
export function WindCompass({ direction, size = 56, active = true }: Props) {
  const deg = direction ? DIRECTION_TO_DEG[direction.toUpperCase()] : null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={palette.ink[600]}
          strokeWidth={0.75}
          fill="rgba(20, 28, 46, 0.6)"
        />
        {/* Cardinal tick marks */}
        {[0, 90, 180, 270].map((tick) => {
          const rad = ((tick - 90) * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * (r - 2);
          const y1 = cy + Math.sin(rad) * (r - 2);
          const x2 = cx + Math.cos(rad) * r;
          const y2 = cy + Math.sin(rad) * r;
          return (
            <Path
              key={tick}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={palette.ink[400]}
              strokeWidth={0.75}
            />
          );
        })}
        {/* N marker */}
        <SvgText
          x={cx}
          y={6}
          fontSize={7}
          fontWeight="bold"
          fill={palette.ink[300]}
          textAnchor="middle"
        >
          N
        </SvgText>
        {/* Direction arrow */}
        {deg !== null && active ? (
          <Path
            d={`M ${cx} ${cy - r + 5} L ${cx + 3.5} ${cy + r - 8} L ${cx} ${cy + r - 11} L ${cx - 3.5} ${cy + r - 8} Z`}
            fill={palette.frost[400]}
            transform={`rotate(${deg}, ${cx}, ${cy})`}
          />
        ) : (
          <Circle cx={cx} cy={cy} r={2} fill={palette.ink[500]} />
        )}
      </Svg>
    </View>
  );
}
