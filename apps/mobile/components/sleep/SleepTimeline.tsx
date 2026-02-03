// components/sleep/SleepTimeline.tsx
// Hypnogram implementation: Step chart with connected blocks

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOut, FadeIn } from 'react-native-reanimated';
import Svg, { Line, Rect, G, Text as SvgText, Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIMELINE_PADDING = 20;
const TIMELINE_HEIGHT = 160; // Increased height for hypnogram
const CHART_HEIGHT = 100;
const CHART_TOP_PADDING = 30;

// Theme colors matching the design
const STAGE_COLORS = {
  awake: '#F87171',
  rem: '#818CF8', // Purple/Blue
  light: '#60A5FA', // Blue
  deep: '#34D399', // Green
  unknown: '#4B5563',
} as const;

// Y-Positions for stages (0 is top)
const STAGE_Y = {
  awake: 0,
  rem: 33,
  light: 66,
  deep: 100,
  unknown: 100,
};

export interface SleepStage {
  startTime: string;
  endTime: string;
  stage: 'awake' | 'light' | 'deep' | 'rem' | 'unknown';
  durationMinutes: number;
}

export interface TimelineData {
  stages: SleepStage[];
  startTime: string;
  endTime: string;
  totalDurationMinutes: number;
}

interface SleepTimelineProps {
  data: TimelineData;
}

/**
 * Format time from ISO string
 */
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

export function SleepTimeline({ data }: SleepTimelineProps) {
  const [selectedStage, setSelectedStage] = useState<SleepStage | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Calculate layout
  const { blocks, connectors, labels } = useMemo(() => {
    if (!data.stages || data.stages.length === 0) return { blocks: [], connectors: [], labels: [] };

    const startMs = new Date(data.startTime).getTime();
    const endMs = new Date(data.endTime).getTime();
    const totalMs = endMs - startMs;
    const width = SCREEN_WIDTH - TIMELINE_PADDING * 2;

    if (totalMs <= 0) return { blocks: [], connectors: [], labels: [] };

    const msToX = (ms: number) => {
      const offset = ms - startMs;
      return (offset / totalMs) * width;
    };

    const _blocks: any[] = [];
    const _connectors: any[] = [];

    // Process stages to create blocks
    data.stages.forEach((stage, index) => {
      const sStart = new Date(stage.startTime).getTime();
      const sEnd = new Date(stage.endTime).getTime();

      const x = msToX(sStart);
      const w = msToX(sEnd) - x;
      const yPercent = STAGE_Y[stage.stage] || STAGE_Y.unknown;
      const y = (yPercent / 100) * CHART_HEIGHT + CHART_TOP_PADDING;

      // Fixed height for the block itself? Or just a line?
      // Hypnograms usually show a horizontal line at the level.
      // User said "blocks connected via thin edges".
      // Let's draw a Rectangle with some height, or a thick line.
      // "blocks" implies thickness.
      const blockHeight = 16;

      _blocks.push({
        x,
        y: y - blockHeight / 2,
        width: Math.max(w, 2), // Min width visibility
        height: blockHeight,
        color: STAGE_COLORS[stage.stage] || STAGE_COLORS.unknown,
        stage: stage,
        centerY: y,
      });

      // Connector to next stage
      if (index < data.stages.length - 1) {
        const nextStage = data.stages[index + 1];
        const nextYPercent = STAGE_Y[nextStage.stage] || STAGE_Y.unknown;
        const nextY = (nextYPercent / 100) * CHART_HEIGHT + CHART_TOP_PADDING;

        // Line from end of this block to start of next block
        // X is the same (end of this = start of next usually)
        _connectors.push({
          x: x + w,
          y1: y,
          y2: nextY,
          color: 'rgba(255,255,255,0.2)', // Thin edge color
        });
      }
    });

    // Time Labels (Start, Middle, End)
    const _labels = [
      { text: formatTime(data.startTime), x: 0, anchor: 'start' },
      { text: formatTime(data.endTime), x: width, anchor: 'end' },
    ];

    return { blocks: _blocks, connectors: _connectors, labels: _labels };
  }, [data]);

  const handlePress = (block: any) => {
    setSelectedStage(block.stage);
    // Simple center positioning or based on block x
    setTooltipPos({ x: block.x + 20, y: block.y });
  };

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Structure</Text>
        <View style={styles.legend}>
          {Object.entries(STAGE_COLORS).map(([key, color]) => {
            if (key === 'unknown') return null;
            return (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.chartContainer}>
        {/* Y-Axis Labels */}
        <View style={styles.yAxis}>
          {Object.entries(STAGE_Y).map(([key, val]) => {
            if (key === 'unknown') return null;
            const top = (val / 100) * CHART_HEIGHT + CHART_TOP_PADDING;
            return (
              <Text key={key} style={[styles.yLabel, { top: top - 6 }]}>
                {key.toUpperCase()}
              </Text>
            );
          })}
        </View>

        <Svg
          width={SCREEN_WIDTH - TIMELINE_PADDING * 2}
          height={TIMELINE_HEIGHT}
          style={styles.svg}>
          {/* Grid Lines */}
          {Object.values(STAGE_Y).map((val, i) => {
            if (i > 3) return null; // dedupe
            const y = (val / 100) * CHART_HEIGHT + CHART_TOP_PADDING;
            return (
              <Line
                key={'grid' + i}
                x1="0"
                y1={y}
                x2="100%"
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            );
          })}

          {/* Connectors (Vertical Lines) */}
          {connectors.map((c, i) => (
            <Line
              key={`c-${i}`}
              x1={c.x}
              y1={c.y1}
              x2={c.x}
              y2={c.y2}
              stroke={c.color}
              strokeWidth="1"
            />
          ))}

          {/* Blocks */}
          {blocks.map((b, i) => (
            <Pressable
              key={`b-${i}`}
              onPress={() => handlePress(b)}
              style={{ position: 'absolute' }} // Wrapper functionality handled by SVG elements via onPress in newer RN-SVG or parent overlay.
              // React Native SVG direct onPress support can be flaky.
              // Better to use G or Rect with onPress if supported, or overlay.
              // We will treat these as visual only for now and assume the user can tap roughly area.
              // To make it interactive, we can use Rect onPress.
            >
              <Rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill={b.color}
                rx={4}
                onPress={() => handlePress(b)}
              />
            </Pressable>
          ))}

          {/* X-Axis Labels */}
          {labels.map((l, i) => (
            <SvgText
              key={'l-' + i}
              x={l.x}
              y={TIMELINE_HEIGHT - 10}
              fill="rgba(255,255,255,0.4)"
              fontSize="10"
              textAnchor={l.anchor as any}>
              {l.text}
            </SvgText>
          ))}
        </Svg>
      </View>

      {/* Tooltip */}
      {selectedStage && (
        <Modal
          transparent
          visible={!!selectedStage}
          animationType="fade"
          onRequestClose={() => setSelectedStage(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedStage(null)}>
            <View style={[styles.tooltip, { top: TIMELINE_HEIGHT / 2 + 100 }]}>
              <Text style={styles.tooltipTitle}>{selectedStage.stage.toUpperCase()}</Text>
              <Text style={styles.tooltipTime}>
                {formatTime(selectedStage.startTime)} - {formatTime(selectedStage.endTime)}
              </Text>
              <Text style={styles.tooltipDuration}>
                {formatDuration(selectedStage.durationMinutes)}
              </Text>
            </View>
          </Pressable>
        </Modal>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E24', // Use a card background
    borderRadius: 24,
    padding: TIMELINE_PADDING,
    marginVertical: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  chartContainer: {
    height: TIMELINE_HEIGHT,
    flexDirection: 'row',
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    zIndex: 10,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    fontWeight: '600',
  },
  svg: {
    marginLeft: 35, // Space for Y labels
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tooltip: {
    backgroundColor: '#2A2A35',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tooltipTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tooltipTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  tooltipDuration: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
  },
});
