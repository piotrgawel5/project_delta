import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FluidSleepChartProps {
  // We can take summary minutes to simulate a curve
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
  startTime?: string | null;
  endTime?: string | null;
  height?: number;
}

// Simple Catmull-Rom to Cubic Bezier conversion for smooth curves
// Points: [x, y]
const getPathFromPoints = (points: number[][], tension = 0.3) => {
  if (points.length < 2) return '';

  let path = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2; // Double last point

    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;

    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`;
  }

  return path;
};

export function FluidSleepChart({
  deepMin,
  lightMin,
  remMin,
  awakeMin,
  height = 120,
}: FluidSleepChartProps) {
  const chartWidth = SCREEN_WIDTH - 40; // Approx padding

  // Generate curve points
  const pathData = useMemo(() => {
    // Total duration weight
    const total = Math.max(deepMin + lightMin + remMin + awakeMin, 1);

    // Y-levels (0 is top, height is bottom)
    // We want deep sleep at bottom, awake at top
    // Awake: 10% height
    // REM: 30% height
    // Light: 60% height
    // Deep: 90% height

    const Y_AWAKE = height * 0.1;
    const Y_REM = height * 0.3;
    const Y_LIGHT = height * 0.6;
    const Y_DEEP = height * 0.9;

    // Create fictional cycles (approx 90 mins each)
    // If total sleep is 8h (480m), that's ~5 cycles.
    const cycleCount = Math.max(Math.round(total / 90), 3);
    const points: number[][] = [];

    // Start Awake
    points.push([0, Y_AWAKE]);

    const stepX = chartWidth / (cycleCount * 4 + 2); // Steps per cycle phases
    let currentX = 0;

    for (let i = 0; i < cycleCount; i++) {
      // Cycle pattern: Light -> Deep -> Light -> REM
      // This is a naive simulation for visual flair when real hypnogram data is missing

      // Descent to Light
      currentX += stepX;
      points.push([currentX, Y_LIGHT]);

      // Deep (longer in first cycles)
      currentX += stepX;
      points.push([currentX, Y_DEEP]);

      // Rise to Light
      currentX += stepX;
      points.push([currentX, Y_LIGHT]);

      // REM (longer in later cycles) or Awake brief
      currentX += stepX;
      // Last cycle usually ends with awake, others REM
      if (i === cycleCount - 1) {
        points.push([currentX, Y_AWAKE]);
      } else {
        points.push([currentX, Y_REM]);
      }
    }

    // Ensure we end at width
    points.push([chartWidth, Y_AWAKE]);

    // Generate curved line
    const linePath = getPathFromPoints(points, 0.25);

    // Close the path for filling gradient
    const areaPath = `${linePath} L ${chartWidth} ${height} L 0 ${height} Z`;

    return { line: linePath, area: areaPath };
  }, [deepMin, lightMin, remMin, awakeMin, height, chartWidth]);

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#818CF8" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#34D399" stopOpacity="0.1" />
          </LinearGradient>
          <LinearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#F87171" stopOpacity="0.8" />
            <Stop offset="0.5" stopColor="#818CF8" stopOpacity="1" />
            <Stop offset="1" stopColor="#34D399" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Fill Area */}
        <Path d={pathData.area} fill="url(#chartFill)" />

        {/* Stroke Line */}
        <Path
          d={pathData.line}
          stroke="url(#lineStroke)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Optional: Add glowing dots at peaks/valleys? */}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
