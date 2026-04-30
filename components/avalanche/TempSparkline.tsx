import { useMemo } from "react";
import Svg, { Line, Path, Circle, Text as SvgText } from "react-native-svg";
import type { TempDataPoint } from "@/lib/api/avalanche";

interface TempSparklineProps {
  data: TempDataPoint[];
  high: number | null;
  low: number | null;
  hours: number;
  width?: number;
  height?: number;
}

export function TempSparkline({
  data,
  hours,
  width = 100,
  height = 48,
}: TempSparklineProps) {
  const pathData = useMemo(() => {
    if (!data || data.length < 2) return null;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const leftPadding = 18;
    const rightPadding = 12;
    const topPadding = 4;
    const bottomPadding = 10;

    const usableWidth = width - leftPadding - rightPadding;
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
  }, [data, width, height]);

  if (!pathData || !data || data.length < 2) return null;

  const strokeColor = "#6b7280";
  const axisColor = "#d1d5db";
  const freezingLineColor = "rgba(56, 189, 248, 0.4)";

  const freezingTemp = 32;
  const showFreezingLine = pathData.min < freezingTemp && pathData.max > freezingTemp;
  const freezingY = showFreezingLine
    ? pathData.topPadding +
      (1 - (freezingTemp - pathData.min) / (pathData.max - pathData.min)) *
        pathData.usableHeight
    : null;

  return (
    <Svg width={width} height={height}>
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
        x2={width - pathData.rightPadding + 2}
        y2={height - pathData.bottomPadding}
        stroke={axisColor}
        strokeWidth={0.5}
      />
      {showFreezingLine && freezingY !== null ? (
        <Line
          x1={pathData.leftPadding}
          y1={freezingY}
          x2={width - pathData.rightPadding}
          y2={freezingY}
          stroke={freezingLineColor}
          strokeWidth={0.75}
          strokeDasharray="2,2"
        />
      ) : null}
      <Line
        x1={pathData.leftPadding - 2}
        y1={pathData.topPadding}
        x2={pathData.leftPadding}
        y2={pathData.topPadding}
        stroke={axisColor}
        strokeWidth={0.5}
      />
      <Line
        x1={pathData.leftPadding - 2}
        y1={height - pathData.bottomPadding}
        x2={pathData.leftPadding}
        y2={height - pathData.bottomPadding}
        stroke={axisColor}
        strokeWidth={0.5}
      />
      <SvgText
        x={pathData.leftPadding - 3}
        y={pathData.topPadding + 6}
        fontSize={7}
        fill="#6b7280"
        textAnchor="end"
      >
        {`${pathData.max}°`}
      </SvgText>
      <SvgText
        x={pathData.leftPadding - 3}
        y={height - pathData.bottomPadding + 4}
        fontSize={7}
        fill="#6b7280"
        textAnchor="end"
      >
        {`${pathData.min}°`}
      </SvgText>
      <SvgText
        x={pathData.leftPadding}
        y={height - 1}
        fontSize={7}
        fill="#6b7280"
        textAnchor="start"
      >
        {`-${hours}h`}
      </SvgText>
      <SvgText x={width - 2} y={height - 1} fontSize={7} fill="#6b7280" textAnchor="end">
        0h
      </SvgText>
      <Path
        d={pathData.path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={pathData.points[0].x}
        cy={pathData.points[0].y}
        r={2}
        fill={strokeColor}
      />
      <Circle
        cx={pathData.points[pathData.points.length - 1].x}
        cy={pathData.points[pathData.points.length - 1].y}
        r={2}
        fill={strokeColor}
      />
    </Svg>
  );
}
