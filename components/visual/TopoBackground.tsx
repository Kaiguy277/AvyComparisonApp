import { Dimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { palette } from "@/constants/design";

const { width } = Dimensions.get("window");

// Hand-drawn topographic contour lines — irregular like real terrain.
// Reads as "elevation map" in peripheral vision without ever competing
// with foreground content.
const CONTOURS = [
  "M -40 80 C 60 60, 120 110, 200 80 S 360 70, 460 100",
  "M -40 130 C 70 110, 150 160, 230 130 S 380 120, 460 150",
  "M -40 180 C 80 160, 160 210, 250 180 S 380 170, 460 200",
  "M -40 230 C 90 210, 170 260, 270 230 S 390 220, 460 250",
  "M -40 290 C 100 270, 180 320, 280 290 S 400 280, 460 310",
  "M -40 360 C 110 340, 200 390, 290 360 S 410 350, 460 380",
  "M -40 440 C 120 420, 220 470, 310 440 S 420 430, 460 460",
  "M -40 520 C 130 500, 240 550, 330 520 S 430 510, 460 540",
];

const PEAKS = [
  // Subtle "summit" mark — concentric rings tightening to a point
  "M 60 70 L 80 50 L 100 70",
  "M 280 95 L 305 70 L 330 95",
];

interface Props {
  height?: number;
  intensity?: "low" | "medium";
}

export function TopoBackground({ height = 600, intensity = "low" }: Props) {
  const lineOpacity = intensity === "low" ? 0.06 : 0.1;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height,
      }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="topoFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.frost[400]} stopOpacity={lineOpacity} />
            <Stop offset="0.6" stopColor={palette.frost[400]} stopOpacity={lineOpacity * 0.5} />
            <Stop offset="1" stopColor={palette.frost[400]} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="topoSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.ink[800]} stopOpacity={0.6} />
            <Stop offset="1" stopColor={palette.ink[950]} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#topoSky)" />
        {CONTOURS.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke="url(#topoFade)"
            strokeWidth={i % 3 === 0 ? 0.8 : 0.5}
            fill="none"
            transform={`scale(${width / 420}, 1)`}
          />
        ))}
        {PEAKS.map((d, i) => (
          <Path
            key={`p-${i}`}
            d={d}
            stroke={palette.frost[400]}
            strokeOpacity={lineOpacity * 1.4}
            strokeWidth={0.6}
            fill="none"
            transform={`scale(${width / 420}, 1)`}
          />
        ))}
      </Svg>
    </View>
  );
}
