// components/sleep/InsightCard.tsx
// Explainable AI insight card with top contributing signals and confidence

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const ACCENT_PURPLE = '#7C3AED';
const ACCENT_GREEN = '#34D399';
const ACCENT_YELLOW = '#FBBF24';
const ACCENT_PINK = '#F472B6';
const ACCENT_BLUE = '#38BDF8';
const ACCENT_ORANGE = '#F97316';

const CARD_PADDING = 18;
const CARD_INNER_RADIUS = 8;
const CARD_RADIUS = CARD_INNER_RADIUS + CARD_PADDING;
const BADGE_PADDING_Y = 5;
const BADGE_INNER_RADIUS = 6;
const BADGE_RADIUS = BADGE_INNER_RADIUS + BADGE_PADDING_Y;
const SIGNAL_PADDING = 12;
const SIGNAL_INNER_RADIUS = 6;
const SIGNAL_RADIUS = SIGNAL_INNER_RADIUS + SIGNAL_PADDING;
const RANK_BADGE_SIZE = 24;
const RANK_BADGE_RADIUS = RANK_BADGE_SIZE / 2;
const WEIGHT_BAR_HEIGHT = 4;
const WEIGHT_BAR_RADIUS = WEIGHT_BAR_HEIGHT / 2;
const PREDICTION_PADDING = 14;
const PREDICTION_INNER_RADIUS = 6;
const PREDICTION_RADIUS = PREDICTION_INNER_RADIUS + PREDICTION_PADDING;
const PREDICTION_ICON_SIZE = 40;
const PREDICTION_ICON_RADIUS = Math.round(PREDICTION_ICON_SIZE * 0.3);
const CONFIDENCE_PADDING_Y = 3;
const CONFIDENCE_INNER_RADIUS = 5;
const CONFIDENCE_RADIUS = CONFIDENCE_INNER_RADIUS + CONFIDENCE_PADDING_Y;

export interface ContributingSignal {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  value: string | number;
  weight: number; // 0-100, how much this factor contributed
  description?: string;
}

export interface SleepInsight {
  headline: string;
  subheadline: string;
  contributingSignals: ContributingSignal[];
  predictedDelta?: {
    direction: 'up' | 'down' | 'stable';
    value: number; // Expected change in next score
    confidence: 'high' | 'medium' | 'low';
  };
  recommendations?: string[];
}

interface InsightCardProps {
  insight: SleepInsight;
  showContributors?: boolean;
  showPrediction?: boolean;
  delay?: number;
}

function getSignalIcon(factor: string): string {
  const factorLower = factor.toLowerCase();
  if (factorLower.includes('duration') || factorLower.includes('time')) return 'time-outline';
  if (factorLower.includes('deep')) return 'moon-outline';
  if (factorLower.includes('rem') || factorLower.includes('dream')) return 'eye-outline';
  if (factorLower.includes('consistency')) return 'calendar-outline';
  if (factorLower.includes('efficiency')) return 'flash-outline';
  if (factorLower.includes('screen')) return 'phone-portrait-outline';
  if (factorLower.includes('heart') || factorLower.includes('hr')) return 'heart-outline';
  if (factorLower.includes('wake') || factorLower.includes('interrupt'))
    return 'alert-circle-outline';
  return 'analytics-outline';
}

function getImpactColor(impact: 'positive' | 'negative' | 'neutral'): string {
  switch (impact) {
    case 'positive':
      return ACCENT_GREEN;
    case 'negative':
      return ACCENT_ORANGE;
    case 'neutral':
      return '#64748B';
  }
}

function getImpactArrow(impact: 'positive' | 'negative' | 'neutral'): string {
  switch (impact) {
    case 'positive':
      return 'arrow-up';
    case 'negative':
      return 'arrow-down';
    case 'neutral':
      return 'remove';
  }
}

/**
 * Explainable AI Insight Card Component
 */
export function InsightCard({
  insight,
  showContributors = true,
  showPrediction = true,
  delay = 0,
}: InsightCardProps) {
  const topSignals = insight.contributingSignals.sort((a, b) => b.weight - a.weight).slice(0, 3);

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.container}>
      {/* Gradient background */}
      <LinearGradient
        colors={['rgba(124, 58, 237, 0.1)', 'rgba(124, 58, 237, 0.02)', 'transparent']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header with AI badge */}
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={ACCENT_PURPLE} strokeWidth="1.5" />
            <Path
              d="M8 12h8M12 8v8"
              stroke={ACCENT_PURPLE}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.aiBadgeText}>AI Insight</Text>
        </View>
      </View>

      {/* Main insight */}
      <View style={styles.insightContent}>
        <Text style={styles.headline}>{insight.headline}</Text>
        <Text style={styles.subheadline}>{insight.subheadline}</Text>
      </View>

      {/* Top 3 Contributing Signals */}
      {showContributors && topSignals.length > 0 && (
        <View style={styles.signalsSection}>
          <Text style={styles.sectionLabel}>Top Contributing Factors</Text>
          <View style={styles.signalsContainer}>
            {topSignals.map((signal, index) => {
              const color = getImpactColor(signal.impact);
              const icon = getSignalIcon(signal.factor);
              const arrow = getImpactArrow(signal.impact);

              return (
                <View key={index} style={styles.signalRow}>
                  {/* Rank indicator */}
                  <View style={[styles.rankBadge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.rankText, { color }]}>{index + 1}</Text>
                  </View>

                  {/* Signal info */}
                  <View style={styles.signalInfo}>
                    <View style={styles.signalHeader}>
                      <Ionicons name={icon as any} size={14} color={color} />
                      <Text style={styles.signalFactor}>{signal.factor}</Text>
                    </View>
                    <View style={styles.signalValueRow}>
                      <Text style={[styles.signalValue, { color }]}>{signal.value}</Text>
                      <Ionicons name={arrow as any} size={12} color={color} />
                    </View>
                  </View>

                  {/* Weight bar */}
                  <View style={styles.weightBarContainer}>
                    <View style={styles.weightBarBg}>
                      <View
                        style={[
                          styles.weightBar,
                          { width: `${signal.weight}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                    <Text style={styles.weightPercent}>{signal.weight}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Predicted Delta */}
      {showPrediction && insight.predictedDelta && (
        <View style={styles.predictionSection}>
          <View style={styles.predictionCard}>
            <View style={styles.predictionIcon}>
              <Ionicons
                name={
                  insight.predictedDelta.direction === 'up'
                    ? 'trending-up'
                    : insight.predictedDelta.direction === 'down'
                      ? 'trending-down'
                      : 'remove'
                }
                size={20}
                color={
                  insight.predictedDelta.direction === 'up'
                    ? ACCENT_GREEN
                    : insight.predictedDelta.direction === 'down'
                      ? ACCENT_ORANGE
                      : '#64748B'
                }
              />
            </View>
            <View style={styles.predictionContent}>
              <Text style={styles.predictionLabel}>Tomorrow's Forecast</Text>
              <View style={styles.predictionValueRow}>
                <Text
                  style={[
                    styles.predictionValue,
                    {
                      color:
                        insight.predictedDelta.direction === 'up'
                          ? ACCENT_GREEN
                          : insight.predictedDelta.direction === 'down'
                            ? ACCENT_ORANGE
                            : '#fff',
                    },
                  ]}>
                  {insight.predictedDelta.direction === 'up' ? '+' : ''}
                  {insight.predictedDelta.value} points
                </Text>
                <View
                  style={[
                    styles.confidenceBadge,
                    {
                      backgroundColor:
                        insight.predictedDelta.confidence === 'high'
                          ? ACCENT_GREEN + '30'
                          : insight.predictedDelta.confidence === 'medium'
                            ? ACCENT_YELLOW + '30'
                            : ACCENT_ORANGE + '30',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.confidenceText,
                      {
                        color:
                          insight.predictedDelta.confidence === 'high'
                            ? ACCENT_GREEN
                            : insight.predictedDelta.confidence === 'medium'
                              ? ACCENT_YELLOW
                              : ACCENT_ORANGE,
                      },
                    ]}>
                    {insight.predictedDelta.confidence} confidence
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Recommendations */}
      {insight.recommendations && insight.recommendations.length > 0 && (
        <View style={styles.recommendationsSection}>
          <Text style={styles.sectionLabel}>Quick Tips</Text>
          {insight.recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationRow}>
              <Ionicons name="bulb-outline" size={14} color={ACCENT_YELLOW} />
              <Text style={styles.recommendationText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.15)',
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: BADGE_PADDING_Y,
    borderRadius: BADGE_RADIUS,
    gap: 6,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT_PURPLE,
    letterSpacing: 0.3,
  },
  insightContent: {
    marginBottom: 16,
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    lineHeight: 24,
  },
  subheadline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  signalsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  signalsContainer: {
    gap: 10,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: SIGNAL_RADIUS,
    padding: SIGNAL_PADDING,
    gap: 10,
  },
  rankBadge: {
    width: RANK_BADGE_SIZE,
    height: RANK_BADGE_SIZE,
    borderRadius: RANK_BADGE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
  },
  signalInfo: {
    flex: 1,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  signalFactor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  signalValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signalValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  weightBarContainer: {
    width: 70,
    alignItems: 'flex-end',
  },
  weightBarBg: {
    width: '100%',
    height: WEIGHT_BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: WEIGHT_BAR_RADIUS,
    overflow: 'hidden',
    marginBottom: 4,
  },
  weightBar: {
    height: '100%',
    borderRadius: WEIGHT_BAR_RADIUS,
  },
  weightPercent: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  predictionSection: {
    marginBottom: 12,
  },
  predictionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: PREDICTION_RADIUS,
    padding: PREDICTION_PADDING,
    gap: 12,
  },
  predictionIcon: {
    width: PREDICTION_ICON_SIZE,
    height: PREDICTION_ICON_SIZE,
    borderRadius: PREDICTION_ICON_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionContent: {
    flex: 1,
  },
  predictionLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  predictionValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  predictionValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: CONFIDENCE_PADDING_Y,
    borderRadius: CONFIDENCE_RADIUS,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  recommendationsSection: {
    gap: 8,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },
});

export default InsightCard;
