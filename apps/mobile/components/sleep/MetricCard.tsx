import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type MetricStatus = 'up' | 'down' | 'neutral';

const STATUS_META: Record<
  MetricStatus,
  { label: string; color: string; icon: 'arrow-up' | 'arrow-down' | 'remove' }
> = {
  up: { label: 'ABOVE', color: '#22C55E', icon: 'arrow-up' },
  down: { label: 'BELOW', color: '#FF6B6B', icon: 'arrow-down' },
  neutral: { label: 'AS USUAL', color: '#9AA0A6', icon: 'remove' },
};

const { width: SCREEN_W } = Dimensions.get('window');
const H_GUTTER = 20;
const GAP = 16;
const CARD_WIDTH = Math.floor((SCREEN_W - H_GUTTER * 2 - GAP) / 2);
const CARD_RADIUS = 28;

// Sparkline dimensions
const SPARKLINE_W = CARD_WIDTH - 28; // Full width minus padding
const SPARKLINE_H = 32;

export type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  status?: MetricStatus;
  sparkline?: number[];
  onPress?: () => void;
};

/**
 * Generate a smooth cubic bezier path from points
 */
function generateSmoothPath(
  points: { x: number; y: number }[],
  width: number,
  height: number
): { linePath: string; areaPath: string } {
  if (points.length < 2) return { linePath: '', areaPath: '' };

  const tension = 0.3; // Controls curve smoothness
  let linePath = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Calculate control points
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  // Create area path (closed shape for gradient fill)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return { linePath, areaPath };
}

export default function MetricCard({
  label,
  value,
  unit,
  status = 'neutral',
  sparkline,
  onPress,
}: MetricCardProps) {
  const meta = STATUS_META[status];

  // Entrance animation
  const mounted = useSharedValue(0);
  const pulse = useSharedValue(1);
  const sparklineProgress = useSharedValue(0);

  useEffect(() => {
    mounted.value = withDelay(
      60,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
    // Animate sparkline drawing
    sparklineProgress.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })
    );
  }, []);

  useEffect(() => {
    pulse.value = withTiming(1.06, { duration: 130 }, () => {
      pulse.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
    });
  }, [value, unit]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: mounted.value,
    transform: [{ translateY: interpolate(mounted.value, [0, 1], [8, 0]) }, { scale: pulse.value }],
  }));

  const valueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // Calculate sparkline paths
  const sparklinePaths = useMemo(() => {
    if (!sparkline || sparkline.length < 2) return null;

    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max === min ? 1 : max - min;
    const padding = 2; // Vertical padding

    const points = sparkline.map((v, i) => ({
      x: (i / (sparkline.length - 1)) * SPARKLINE_W,
      y: padding + (1 - (v - min) / range) * (SPARKLINE_H - padding * 2),
    }));

    return generateSmoothPath(points, SPARKLINE_W, SPARKLINE_H);
  }, [sparkline]);

  // Animated props for the sparkline stroke
  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sparklineProgress.value, [0, 1], [200, 0]),
  }));

  const animatedAreaProps = useAnimatedProps(() => ({
    opacity: interpolate(sparklineProgress.value, [0, 0.5, 1], [0, 0.1, 0.25]),
  }));

  const renderSparkline = () => {
    if (!sparklinePaths) return null;

    const gradientId = `gradient-${label.replace(/\s/g, '')}`;

    // Calculate end dot position
    const lastValue = sparkline![sparkline!.length - 1];
    const minVal = Math.min(...sparkline!);
    const maxVal = Math.max(...sparkline!);
    const range = maxVal - minVal || 1;
    const dotX = SPARKLINE_W;
    const dotY = 2 + (1 - (lastValue - minVal) / range) * (SPARKLINE_H - 4);

    return (
      <View style={styles.sparklineContainer}>
        <Svg
          width={SPARKLINE_W + 10}
          height={SPARKLINE_H}
          viewBox={`0 0 ${SPARKLINE_W + 10} ${SPARKLINE_H}`}>
          <Defs>
            <SvgGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={meta.color} stopOpacity="0.35" />
              <Stop offset="1" stopColor={meta.color} stopOpacity="0" />
            </SvgGradient>
          </Defs>

          {/* Gradient fill area */}
          <AnimatedPath
            d={sparklinePaths.areaPath}
            fill={`url(#${gradientId})`}
            animatedProps={animatedAreaProps}
          />

          {/* Smooth line */}
          <AnimatedPath
            d={sparklinePaths.linePath}
            fill="none"
            stroke={meta.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={200}
            animatedProps={animatedLineProps}
          />

          {/* End dot with glow */}
          <Circle cx={dotX} cy={dotY} r={5} fill={meta.color} opacity={0.25} />
          <Circle cx={dotX} cy={dotY} r={3} fill={meta.color} />
        </Svg>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.wrapper, containerStyle]}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { width: CARD_WIDTH },
          pressed && { opacity: 0.92, transform: [{ scale: 0.997 }] },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.04)', borderless: false }}
        onPress={onPress}>
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.baseGlow}
        />

        {/* Subtle top gradient accent */}
        <LinearGradient
          colors={[meta.color + '18', 'transparent']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.topAccent}
        />

        <View style={styles.rowTop}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>

          {status !== 'neutral' && (
            <View style={[styles.statusPill, { backgroundColor: meta.color + '15' }]}>
              <Ionicons name={meta.icon as any} size={10} color={meta.color} />
            </View>
          )}
        </View>

        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']}
          start={[0, 0]}
          end={[1, 0]}
          style={styles.divider}
        />

        <Animated.View style={[styles.valueRow, valueStyle]}>
          <Text style={styles.valueText} selectable>
            {value}
          </Text>
          {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
        </Animated.View>

        {/* Sparkline or placeholder */}
        <View style={styles.rowBottom}>
          {sparklinePaths ? renderSparkline() : <Text style={styles.subText}>Last 7 days</Text>}
          <View style={styles.weekBadge}>
            <Text style={styles.weekBadgeText}>Week view</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(14,14,16,0.7)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // soft elevation
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { height: 6, width: 0 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  baseGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
  },
  topAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 38,
    top: 0,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 2,
    borderRadius: 999,
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: CARD_WIDTH * 0.6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  valueText: {
    color: 'white',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  unitText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    marginLeft: 6,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekBadge: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  weekBadgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sparklineContainer: {
    flex: 1,
    marginTop: 4,
  },
  sparkline: {
    marginTop: 2,
  },
  subText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
});
