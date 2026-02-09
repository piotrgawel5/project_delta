import React, { useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, {
  Rect,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Path,
  Filter,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STAGE_CARD_PADDING = 12;
const STAGE_CARD_INNER_RADIUS = 6;
const STAGE_CARD_RADIUS = STAGE_CARD_INNER_RADIUS + STAGE_CARD_PADDING;
const ICON_SIZE = 24;
const ICON_RADIUS = ICON_SIZE / 2;

// Create animated SVG components
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedLine = Animated.createAnimatedComponent(Line);

interface HypnogramChartProps {
  stages: {
    stage: 'awake' | 'rem' | 'light' | 'deep';
    startTime: string;
    endTime: string;
    durationMin: number;
  }[];
  startTime: string;
  endTime: string;
  height?: number;
  showLegend?: boolean;
}

type StageName = 'awake' | 'rem' | 'light' | 'deep';

// Updated Color Palette based on Goal Image & Requirements
const STAGE_COLORS: Record<StageName, { primary: string; secondary: string }> = {
  awake: { primary: '#FF9F0A', secondary: '#FFD60A' }, // Vibrant Orange
  rem: { primary: '#BF5AF2', secondary: '#AF52DE' }, // Royal Purple
  light: { primary: '#64D2FF', secondary: '#66D4CF' }, // Mint/Cyan
  deep: { primary: '#007AFF', secondary: '#0A84FF' }, // Deep Blue
};

// Detailed descriptions and premium icons
const STAGE_INFO: Record<
  StageName,
  { label: string; description: string; instruction: string; icon: string }
> = {
  awake: {
    label: 'Awake',
    description: 'Brief interruptions are normal.',
    instruction: 'Keep bedroom dark and cool to minimize wake events.',
    icon: 'sunny',
  },
  rem: {
    label: 'REM Sleep',
    description: 'Mental restoration & dreaming.',
    instruction: 'Consistent sleep schedule aids healthy REM cycles.',
    icon: 'sparkles',
  },
  light: {
    label: 'Light Sleep',
    description: 'Transition & N2 sleep (~50%).',
    instruction: 'Avoid caffeine late in the day to improve depth.',
    icon: 'leaf',
  },
  deep: {
    label: 'Deep Sleep',
    description: 'Physical repair & immunity.',
    instruction: 'Regular exercise boosts deep restorative sleep.',
    icon: 'moon',
  },
};

// ----------------------------------------------------------------------
// Sub-components (Moved outside to prevent re-mount loops)
// ----------------------------------------------------------------------

interface BlockProps {
  stage: {
    stage: StageName;
    startTime: string;
    endTime: string;
    durationMin: number;
  };
  index: number;
  isFirst: boolean;
  isLast: boolean;
  getX: (iso: string) => number;
  getY: (stage: StageName) => number;
  barHeight: number;
  animProgress: ReturnType<typeof useSharedValue<number>>;
}

const HypnogramBlock = React.memo(
  ({ stage, index, isFirst, isLast, getX, getY, barHeight, animProgress }: BlockProps) => {
    const x = getX(stage.startTime);
    const endX = getX(stage.endTime);
    const w = Math.max(endX - x, 4);
    const y = getY(stage.stage);
    const glowPadding = 4;
    const glowWidth = w + glowPadding * 2;
    const glowHeight = barHeight + glowPadding * 2;
    const cornerRadius = 8;

    const animatedMainProps = useAnimatedProps(() => {
      const delay = index * 30;
      const progress = Math.max(0, Math.min(1, (animProgress.value * 1000 - delay) / 400));
      return { opacity: progress, width: w * progress };
    });

    const animatedGlowProps = useAnimatedProps(() => {
      const delay = index * 30;
      const progress = Math.max(0, Math.min(1, (animProgress.value * 1000 - delay) / 400));
      return { opacity: 0.35 * progress, width: glowWidth * progress };
    });

    return (
      <>
        <AnimatedRect
          x={x - glowPadding}
          y={y - glowPadding}
          height={glowHeight}
          fill={STAGE_COLORS[stage.stage].primary}
          rx={cornerRadius + 2}
          ry={cornerRadius + 2}
          filter="url(#glow)"
          animatedProps={animatedGlowProps}
        />
        <AnimatedRect
          x={x}
          y={y}
          height={barHeight}
          fill={`url(#grad-${stage.stage})`}
          stroke={`url(#grad-stroke-${stage.stage})`}
          strokeWidth={2}
          strokeOpacity={0.55}
          rx={cornerRadius}
          ry={cornerRadius}
          animatedProps={animatedMainProps}
        />
      </>
    );
  }
);

interface ConnectorProps {
  prev: { stage: StageName; startTime: string; endTime: string };
  current: { stage: StageName; startTime: string; endTime: string };
  index: number;
  getX: (iso: string) => number;
  getY: (stage: StageName) => number;
  barHeight: number;
  animProgress: ReturnType<typeof useSharedValue<number>>;
}

const HypnogramConnector = React.memo(
  ({ prev, current, index, getX, getY, barHeight, animProgress }: ConnectorProps) => {
    const transitionX = getX(current.startTime);
    const connectorWidth = 4;

    // Block visual properties
    const blockRadius = 8;
    const blockStroke = 2;

    const yPrev = getY(prev.stage);
    const yCurr = getY(current.stage);

    // Connector endpoints - extend exactly to block edges
    const isDown = yCurr > yPrev;

    let y1: number;
    let y2: number;

    if (isDown) {
      // Prev is ABOVE (smaller Y) - connect bottom of prev to top of current
      y1 = yPrev + barHeight;
      y2 = yCurr;
    } else {
      // Prev is BELOW (larger Y) - connect top of prev to bottom of current
      y1 = yPrev;
      y2 = yCurr + barHeight;
    }

    // Corner fill rectangles - fill the gap at rounded corners
    // These are placed at the junction and covered by the opaque block
    const cornerFillSize = blockRadius + blockStroke;
    const halfConnector = connectorWidth / 2;

    // Top corner fill (at the end closer to min Y)
    const topY = Math.min(y1, y2);
    // Bottom corner fill (at the end closer to max Y)
    const bottomY = Math.max(y1, y2);

    // Determine which stage's color to use for each corner
    const topStage = isDown ? prev.stage : current.stage;
    const bottomStage = isDown ? current.stage : prev.stage;

    const animatedProps = useAnimatedProps(() => {
      const delay = index * 30 + 20;
      const progress = Math.max(0, Math.min(1, (animProgress.value * 1000 - delay) / 300));
      return { opacity: progress };
    });

    return (
      <>
        {/* Top corner fill rectangle - placed at top junction */}
        <Rect
          x={transitionX - halfConnector}
          y={topY - cornerFillSize}
          width={connectorWidth}
          height={cornerFillSize}
          fill={STAGE_COLORS[topStage].primary}
          opacity={0.6}
        />

        {/* Bottom corner fill rectangle - placed at bottom junction */}
        <Rect
          x={transitionX - halfConnector}
          y={bottomY}
          width={connectorWidth}
          height={cornerFillSize}
          fill={STAGE_COLORS[bottomStage].primary}
          opacity={0.6}
        />

        {/* Main connector line */}
        <AnimatedLine
          x1={transitionX}
          y1={y1}
          x2={transitionX}
          y2={y2}
          stroke={STAGE_COLORS[isDown ? prev.stage : current.stage].primary}
          strokeWidth={connectorWidth}
          strokeLinecap="butt"
          opacity={0.6}
          animatedProps={animatedProps}
        />
      </>
    );
  }
);

const StageCard = React.memo(
  ({
    stageName,
    index,
    totalMinutes,
  }: {
    stageName: StageName;
    index: number;
    totalMinutes: number;
  }) => {
    const info = STAGE_INFO[stageName];
    const colors = STAGE_COLORS[stageName];
    const hours = Math.floor(Math.round(totalMinutes) / 60);
    const mins = Math.round(totalMinutes) % 60;

    return (
      <Animated.View
        entering={FadeInDown.delay(300 + index * 80).duration(400)}
        style={styles.stageCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: colors.secondary + '30' }]}>
            <Ionicons name={info.icon as any} size={14} color={colors.primary} />
          </View>
          <Text style={styles.cardTime}>{hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}</Text>
        </View>
        <Text style={styles.cardLabel}>{info.label}</Text>
        <Text style={styles.cardDesc}>{info.description}</Text>
        <Text style={styles.cardInstruction}>{info.instruction}</Text>
      </Animated.View>
    );
  }
);

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export const HypnogramChart: React.FC<HypnogramChartProps> = ({
  stages = [],
  startTime,
  endTime,
  height = 200,
  showLegend = true,
}) => {
  const startMs = useMemo(() => new Date(startTime).getTime(), [startTime]);
  const endMs = useMemo(() => new Date(endTime).getTime(), [endTime]);
  const totalDuration = endMs - startMs;
  const chartWidth = SCREEN_WIDTH - 40;

  const animProgress = useSharedValue(0);

  useEffect(() => {
    animProgress.value = 0;
    animProgress.value = withDelay(
      100,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
  }, [stages]);

  const getX = useCallback(
    (timeIso: string) => {
      const timeMs = new Date(timeIso).getTime();
      if (timeMs < startMs) return 0;
      if (timeMs > endMs) return chartWidth;
      return ((timeMs - startMs) / totalDuration) * chartWidth;
    },
    [startMs, endMs, totalDuration, chartWidth]
  );

  // Blocky aesthetics
  const barHeight = height * 0.16;

  const getY = useCallback(
    (stage: StageName) => {
      const availableHeight = height - barHeight;
      const spacing = availableHeight / 3;
      switch (stage) {
        case 'awake':
          return 0;
        case 'rem':
          return spacing * 1;
        case 'light':
          return spacing * 2;
        case 'deep':
          return spacing * 3;
        default:
          return 0;
      }
    },
    [height, barHeight]
  );

  const displayStages = useMemo(() => {
    if (stages.length > 0) return stages;

    // Fallback Mock Data
    const mockStages: typeof stages = [];
    let currentMs = startMs;
    const cycle: StageName[] = ['light', 'deep', 'light', 'rem'];
    let i = 0;
    // Safety check just in case
    if (endMs <= startMs) return [];

    while (currentMs < endMs) {
      const stageName: StageName = Math.random() > 0.9 ? 'awake' : cycle[i % 4];
      const durationMin = 30 + Math.random() * 60;
      const segmentEnd = Math.min(currentMs + durationMin * 60 * 1000, endMs);
      mockStages.push({
        stage: stageName,
        startTime: new Date(currentMs).toISOString(),
        endTime: new Date(segmentEnd).toISOString(),
        durationMin: (segmentEnd - currentMs) / 60000,
      });
      currentMs = segmentEnd;
      if (stageName !== 'awake') i++;
      // Circuit breaker
      if (mockStages.length > 50) break;
    }
    return mockStages;
  }, [stages, startMs, endMs]);

  const stageTotals = useMemo(() => {
    const totals: Record<StageName, number> = { awake: 0, rem: 0, light: 0, deep: 0 };
    displayStages.forEach((s) => {
      if (totals[s.stage] !== undefined) {
        totals[s.stage] += s.durationMin;
      }
    });
    return totals;
  }, [displayStages]);

  // Generate vertical grid lines (every 2 hours)
  const gridLines = useMemo(() => {
    const lines = [];
    const hourMs = 60 * 60 * 1000;
    let t = Math.ceil(startMs / hourMs) * hourMs;
    while (t < endMs) {
      lines.push(t);
      t += 2 * hourMs;
    }
    return lines;
  }, [startMs, endMs]);

  return (
    <View>
      <Animated.View style={[styles.container, { height }]} entering={FadeIn.duration(300)}>
        <Svg width={chartWidth} height={height}>
          <Defs>
            <Filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <FeGaussianBlur stdDeviation="4" result="coloredBlur" />
              <FeMerge>
                <FeMergeNode in="coloredBlur" />
                <FeMergeNode in="SourceGraphic" />
              </FeMerge>
            </Filter>
            {Object.keys(STAGE_COLORS).map((key) => {
              const s = key as StageName;
              return (
                <React.Fragment key={s}>
                  {/* Fill gradient - fully opaque to cover connectors */}
                  <LinearGradient id={`grad-${s}`} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={STAGE_COLORS[s].secondary} stopOpacity="1" />
                    <Stop offset="1" stopColor={STAGE_COLORS[s].primary} stopOpacity="1" />
                  </LinearGradient>
                  {/* Stroke gradient - slightly transparent */}
                  <LinearGradient id={`grad-stroke-${s}`} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={STAGE_COLORS[s].secondary} stopOpacity="0.6" />
                    <Stop offset="1" stopColor={STAGE_COLORS[s].primary} stopOpacity="0.6" />
                  </LinearGradient>
                </React.Fragment>
              );
            })}
          </Defs>

          {/* Grid Lines */}
          {gridLines.map((timeMs, i) => {
            const x = getX(new Date(timeMs).toISOString());
            return (
              <Line
                key={`grid-${i}`}
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1.5}
                strokeDasharray="4, 4"
              />
            );
          })}

          {/* Connectors (Behind) */}
          {displayStages.map((s, i) => {
            if (i === 0) return null;
            return (
              <HypnogramConnector
                key={`conn-${i}`}
                prev={displayStages[i - 1]}
                current={s}
                index={i}
                getX={getX}
                getY={getY}
                barHeight={barHeight}
                animProgress={animProgress}
              />
            );
          })}

          {/* Blocks */}
          {displayStages.map((s, i) => (
            <HypnogramBlock
              key={`block-${i}`}
              stage={s}
              index={i}
              isFirst={i === 0}
              isLast={i === displayStages.length - 1}
              getX={getX}
              getY={getY}
              barHeight={barHeight}
              animProgress={animProgress}
            />
          ))}
        </Svg>
      </Animated.View>

      {showLegend && (
        <View style={styles.legendContainer}>
          {(['deep', 'light', 'rem', 'awake'] as StageName[]).map((stage, i) => (
            <StageCard key={stage} stageName={stage} index={i} totalMinutes={stageTotals[stage]} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  stageCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: STAGE_CARD_RADIUS,
    padding: STAGE_CARD_PADDING,
    minWidth: '47%',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    zIndex: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTime: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  cardLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  cardDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 },
  cardInstruction: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontStyle: 'italic' },
});
