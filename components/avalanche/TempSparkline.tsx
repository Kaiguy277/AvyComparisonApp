import { useMemo } from "react";
import Svg, { Line, Path, Circle, Text as SvgText } from "react-native-svg";
import type { TempDataPoint } from "@/lib/api/avalanche";

interface TempSparklineProps {
  data: TempDataPoint[];
  high: number | null;
  low: number | null;
  hours: number;
  // Either give a fixed pixel width (legacy inline use) or pass `expand`
  // to let the SVG scale with its parent via viewBox.
  width?: number;
  height?: number;
  expand?: boolean;
}

const VB_W = 400;

export function TempSparkline({
  data,
  hours,
  high,
  low,
  width = 100,
  height = 48,
  expand,
}: TempSparklineProps) {
  // Internal layout always works in a fixed viewBox space (VB_W × height)
  // and scales to the rendered size via SVG's intrinsic scaling.
  const pathData = useMemo(() => {
    if (!data || data.length < 2) return null;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const leftPadding = expand ? 30 : 18;
    const rightPadding = expand ? 18 : 12;
    const topPadding = expand ? 8 : 4;
    const bottomPadding = expand ? 16 : 10;

    const usableWidth = VB_W - leftPadding - rightPadding;
    const usableHeight = height - topPadding - bottomPadding;

    const points = data.map((d, i) => {
      const x = leftPadding + (i / (data.length - 1)) * usableWidth;
      const y = topPadding + (1 - (d.value - min) / range) * usableHeight;
      return { x, y, value: d.value };
    });

    const path = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");

    return {
      path,
      points,
      min,
      max,
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      usableWidth,
      usableHeight,
    };
  }, [data, height, expand]);

  if (!pathData || !data || data.length < 2) return null;

  const strokeColor = expand ? "#E1E7F0" : "#E1E7F0";
  const axisColor = "#3B4A6B";
  const freezingLineColor = "rgba(103, 213, 240, 0.55)";
  const labelColor = "#8794AE";
  const labelSize = expand ? 11 : 7;

  const freezingTemp = 32;
  const showFreezingLine = pathData.min < freezingTemp && pathData.max > freezingTemp;
  const freezingY = showFreezingLine
    ? pathData.topPadding +
      (1 - (freezingTemp - pathData.min) / (pathData.max - pathData.min)) *
        pathData.usableHeight
    : null;

  const containerStyle = expand
    ? { width: "100%" as const, height }
    : { width, height };

  return (
    <Svg
      style={containerStyle}
      viewBox={`0 0 ${VB_W} ${height}`}
      preserveAspectRatio="none"
    >
      <Line
        x1={pathData.leftPadding}
        y1={pathData.topPadding - 2}
        x2={pathData.leftPadding}
        y2={height - pathData.bottomPadding + 2}
        stroke={axisColor}
        strokeWidth={0.5}
      />
      <Line
        x1={pathData.leftPadding}
        y1={height - pathData.bottomPadding}
        x2={VB_W - pathData.rightPadding + 2}
        y2={height - pathData.bottomPadding}
        stroke={axisColor}
        strokeWidth={0.5}
      />
      {showFreezingLine && freezingY !== null ? (
        <>
          <Line
            x1={pathData.leftPadding}
            y1={freezingY}
            x2={VB_W - pathData.rightPadding}
            y2={freezingY}
            stroke={freezingLineColor}
            strokeWidth={expand ? 1 : 0.75}
            strokeDasharray={expand ? "4,4" : "2,2"}
          />
          {expand ? (
            <SvgText
              x={VB_W - pathData.rightPadding - 2}
              y={freezingY - 3}
              fontSize={9}
              fill={freezingLineColor}
              textAnchor="end"
            >
              32°
            </SvgText>
          ) : null}
        </>
      ) : null}
      <SvgText
        x={pathData.leftPadding - 4}
        y={pathData.topPadding + labelSize - 1}
        fontSize={labelSize}
        fill={labelColor}
        textAnchor="end"
      >
        {`${high ?? pathData.max}°`}
      </SvgText>
      <SvgText
        x={pathData.leftPadding - 4}
        y={height - pathData.bottomPadding + 1}
        fontSize={labelSize}
        fill={labelColor}
        textAnchor="end"
      >
        {`${low ?? pathData.min}°`}
      </SvgText>
      <SvgText
        x={pathData.leftPadding}
        y={height - 2}
        fontSize={labelSize}
        fill={labelColor}
        textAnchor="start"
      >
        {`-${hours}H`}
      </SvgText>
      <SvgText
        x={VB_W - 4}
        y={height - 2}
        fontSize={labelSize}
        fill={labelColor}
        textAnchor="end"
      >
        NOW
      </SvgText>
      <Path
        d={pathData.path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={expand ? 1.8 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={pathData.points[0].x}
        cy={pathData.points[0].y}
        r={expand ? 3 : 2}
        fill={strokeColor}
        opacity={0.6}
      />
      <Circle
        cx={pathData.points[pathData.points.length - 1].x}
        cy={pathData.points[pathData.points.length - 1].y}
        r={expand ? 4 : 2}
        fill="#67D5F0"
      />
    </Svg>
  );
}
