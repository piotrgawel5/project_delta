// app/sleep-analysis.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Line,
  Defs,
  RadialGradient,
  Stop,
  G,
  Path,
  LinearGradient as SvgLinearGradient,
  Text as SvgText,
} from 'react-native-svg';
import { useAuthStore } from '@store/authStore';
import { useSleepStore } from '@store/sleepStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Theme
const ACCENT_PURPLE = '#6366F1';
const ACCENT_YELLOW = '#FBBF24';
const ACCENT_GREEN = '#34D399';
const ACCENT_PINK = '#F472B6';
const ACCENT_BLUE = '#38BDF8';
const BADGE_COLOR = '#5B5FC7';

export default function SleepAnalysisScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { user } = useAuthStore();
  const { weeklyHistory, loading, fetchSleepData, checkHealthConnectStatus } = useSleepStore();

  // Date selection state
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Animations
  const efficiencyAnim = useSharedValue(0);
  const debtAnim = useSharedValue(0);
  const deepAnim = useSharedValue(0);
  const remAnim = useSharedValue(0);
  const scoreRingAnim = useSharedValue(0);
  const aiGlow = useSharedValue(0.3);

  useEffect(() => {
    const init = async () => {
      await checkHealthConnectStatus();
      if (user?.id) await fetchSleepData(user.id);
    };
    if (weeklyHistory.length === 0) init();
  }, [user?.id]);

  // Get available dates from history
  const availableDates = useMemo(() => {
    if (!weeklyHistory.length) return [];
    return weeklyHistory.map((h, i) => ({
      date: h.date,
      label:
        i === 0
          ? 'Today'
          : new Date(h.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
      index: i,
    }));
  }, [weeklyHistory]);

  const sleepData = useMemo(() => {
    if (weeklyHistory.length === 0) return null;
    return weeklyHistory[selectedDateIndex] || weeklyHistory[0];
  }, [weeklyHistory, selectedDateIndex]);

  const formatTime = (date: string | undefined) => {
    if (!date) return '--:--';
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const durationHours = sleepData ? Math.floor(sleepData.duration_minutes / 60) : 0;
  const durationMins = sleepData ? sleepData.duration_minutes % 60 : 0;

  // Calculated Metrics with fallbacks
  const sleepEfficiency = sleepData?.duration_minutes
    ? Math.min(100, Math.round((sleepData.duration_minutes / 480) * 100))
    : 0;
  const sleepDebt = sleepData?.duration_minutes ? Math.max(0, 480 - sleepData.duration_minutes) : 0;
  const debtHours = Math.floor(sleepDebt / 60);
  const debtMins = sleepDebt % 60;

  // Use actual data or reasonable defaults
  const deepPercent =
    sleepData?.deep_sleep_minutes && sleepData?.duration_minutes
      ? Math.round((sleepData.deep_sleep_minutes / sleepData.duration_minutes) * 100)
      : 18;
  const remPercent =
    sleepData?.rem_sleep_minutes && sleepData?.duration_minutes
      ? Math.round((sleepData.rem_sleep_minutes / sleepData.duration_minutes) * 100)
      : 22;
  const lightPercent =
    sleepData?.light_sleep_minutes && sleepData?.duration_minutes
      ? Math.round((sleepData.light_sleep_minutes / sleepData.duration_minutes) * 100)
      : 55;
  const awakePercent =
    sleepData?.awake_minutes && sleepData?.duration_minutes
      ? Math.round((sleepData.awake_minutes / sleepData.duration_minutes) * 100)
      : 5;

  // Sleep Score calculation
  const sleepScore = useMemo(() => {
    if (!sleepData) return 0;
    const durationScore = Math.min(100, (sleepData.duration_minutes / 480) * 100) * 0.35;
    const deepScore = Math.min(100, (deepPercent / 20) * 100) * 0.25;
    const remScore = Math.min(100, (remPercent / 25) * 100) * 0.25;
    const consistencyScore = sleepData.quality_score ? sleepData.quality_score * 0.15 : 70 * 0.15;
    return Math.round(durationScore + deepScore + remScore + consistencyScore);
  }, [sleepData, deepPercent, remPercent]);

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Work';
  };

  // Animate on data change
  useEffect(() => {
    if (sleepData) {
      efficiencyAnim.value = withDelay(
        200,
        withTiming(sleepEfficiency / 100, { duration: 600, easing: Easing.out(Easing.cubic) })
      );
      debtAnim.value = withDelay(
        300,
        withTiming(Math.min(1, sleepDebt / 120), {
          duration: 600,
          easing: Easing.out(Easing.cubic),
        })
      );
      deepAnim.value = withDelay(
        400,
        withTiming(deepPercent / 100, { duration: 600, easing: Easing.out(Easing.cubic) })
      );
      remAnim.value = withDelay(
        500,
        withTiming(remPercent / 100, { duration: 600, easing: Easing.out(Easing.cubic) })
      );
      scoreRingAnim.value = withDelay(
        100,
        withTiming(sleepScore / 100, { duration: 800, easing: Easing.out(Easing.cubic) })
      );
      aiGlow.value = withRepeat(
        withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [sleepData, selectedDateIndex]);

  const efficiencyBarStyle = useAnimatedStyle(() => ({ width: `${efficiencyAnim.value * 100}%` }));
  const debtBarStyle = useAnimatedStyle(() => ({ width: `${debtAnim.value * 100}%` }));
  const deepBarStyle = useAnimatedStyle(() => ({ width: `${deepAnim.value * 100}%` }));
  const remBarStyle = useAnimatedStyle(() => ({ width: `${remAnim.value * 100}%` }));
  const aiGlowStyle = useAnimatedStyle(() => ({ opacity: aiGlow.value }));

  // Chart Rendering (UNTOUCHED)
  const renderChart = () => {
    const chartSize = SCREEN_WIDTH - 20;
    const cy = chartSize / 2;
    const rDeep = chartSize * 0.45;
    const rLight = chartSize * 0.35;
    const rRem = chartSize * 0.25;
    const rAwake = chartSize * 0.15;
    const cxDeep = chartSize * 0.55;
    const cxLight = chartSize * 0.48;
    const cxRem = chartSize * 0.41;
    const cxAwake = chartSize * 0.34;
    const xAwake = cxAwake;
    const xRem = cxRem + rRem * 0.65;
    const xLight = cxLight + rLight * 0.7;
    const xDeep = cxDeep + rDeep * 0.75;

    const phases = [
      {
        value: sleepData?.awake_minutes || 20,
        label: 'Awake',
        x: xAwake,
        isMinutes: true,
        textColor: '#000',
      },
      {
        value: sleepData?.rem_sleep_minutes ? Math.round(sleepData.rem_sleep_minutes / 60) : 2,
        label: 'Rem',
        x: xRem,
        isMinutes: false,
        textColor: '#000',
      },
      {
        value: sleepData?.light_sleep_minutes ? Math.round(sleepData.light_sleep_minutes / 60) : 4,
        label: 'Light',
        x: xLight,
        isMinutes: false,
        textColor: '#000',
      },
      {
        value: sleepData?.deep_sleep_minutes ? Math.round(sleepData.deep_sleep_minutes / 60) : 2,
        label: 'Deep',
        x: xDeep,
        isMinutes: false,
        textColor: '#000',
      },
    ];

    return (
      <Animated.View entering={FadeIn.duration(500)} style={styles.chartSection}>
        <View style={styles.badge}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Defs>
              <SvgLinearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.6" />
              </SvgLinearGradient>
            </Defs>
            <Path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" fill="url(#moonGrad)" />
          </Svg>
          <Text style={styles.badgeHours}>
            {durationHours}
            <Text style={styles.badgeHoursSub}>hr</Text>
          </Text>
          <Text style={styles.badgeLabel}>Sleep</Text>
        </View>

        <View style={styles.chartWrapper}>
          <Svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
            <Defs>
              <RadialGradient id="gradPink" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FDA4AF" />
                <Stop offset="70%" stopColor="#F472B6" />
                <Stop offset="100%" stopColor="#DB2777" />
              </RadialGradient>
              <RadialGradient id="gradOrange" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FDE68A" />
                <Stop offset="60%" stopColor="#FBBF24" />
                <Stop offset="100%" stopColor="#D97706" />
              </RadialGradient>
              <RadialGradient id="gradYellow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FEF9C3" />
                <Stop offset="50%" stopColor="#FDE047" />
                <Stop offset="100%" stopColor="#FACC15" />
              </RadialGradient>
              <RadialGradient id="gradWhite" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" />
                <Stop offset="100%" stopColor="#F0F0FF" />
              </RadialGradient>
            </Defs>
            <Circle cx={cxDeep} cy={cy} r={rDeep} fill="url(#gradPink)" />
            <Circle cx={cxLight + 3} cy={cy + 5} r={rLight} fill="#000" opacity="0.12" />
            <Circle cx={cxLight} cy={cy} r={rLight} fill="url(#gradOrange)" />
            <Circle cx={cxRem + 3} cy={cy + 5} r={rRem} fill="#000" opacity="0.12" />
            <Circle cx={cxRem} cy={cy} r={rRem} fill="url(#gradYellow)" />
            <Circle cx={cxAwake + 3} cy={cy + 5} r={rAwake} fill="#000" opacity="0.12" />
            <Circle cx={cxAwake} cy={cy} r={rAwake} fill="url(#gradWhite)" />
            <Line x1={0} y1={cy} x2={xAwake - 8} y2={cy} stroke="#000" strokeWidth="2" />
            {phases.slice(0, -1).map((p, i) => (
              <Line
                key={'line-' + i}
                x1={p.x + 8}
                y1={cy}
                x2={phases[i + 1].x - 8}
                y2={cy}
                stroke="#000"
                strokeWidth="2"
              />
            ))}
            {phases.map((p, i) => (
              <G key={i}>
                <Circle
                  cx={p.x}
                  cy={cy}
                  r={6}
                  fill="transparent"
                  stroke={p.textColor}
                  strokeWidth="2"
                />
              </G>
            ))}
          </Svg>
          <View style={styles.overlayContainer}>
            {phases.map((p, i) => (
              <View key={'val-' + i} style={[styles.labelGroup, { left: p.x - 25, top: cy - 35 }]}>
                <Text style={[styles.labelValue, { color: p.textColor }]}>
                  {p.value}
                  {p.isMinutes ? 'min' : 'hr'}
                </Text>
              </View>
            ))}
            {phases.map((p, i) => (
              <View key={'name-' + i} style={[styles.labelGroup, { left: p.x - 25, top: cy + 12 }]}>
                <Text
                  style={[
                    styles.labelName,
                    { color: p.textColor === '#000' ? '#000' : 'rgba(255,255,255,0.8)' },
                  ]}>
                  {p.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    );
  };

  // Sleep Score Ring (inline)
  const renderScoreRing = () => {
    const size = 140;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 55;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(sleepScore / 100) * circumference} ${circumference}`;

    return (
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.scoreSection}>
        <View style={styles.scoreCard}>
          <LinearGradient
            colors={[`${ACCENT_PURPLE}15`, 'transparent']}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Defs>
              <SvgLinearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={ACCENT_PURPLE} />
                <Stop offset="100%" stopColor="#818CF8" />
              </SvgLinearGradient>
            </Defs>
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="10"
              fill="transparent"
            />
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke="url(#scoreGrad)"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <SvgText
              x={cx}
              y={cy - 5}
              fill="#fff"
              fontSize="32"
              fontWeight="700"
              textAnchor="middle">
              {sleepScore}
            </SvgText>
            <SvgText
              x={cx}
              y={cy + 18}
              fill="rgba(255,255,255,0.6)"
              fontSize="12"
              textAnchor="middle">
              {getScoreLabel(sleepScore)}
            </SvgText>
          </Svg>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreTitle}>Sleep Score</Text>
            <Text style={styles.scoreDesc}>
              Based on duration, deep sleep, REM, and consistency
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Redesigned Timeline
  const renderTimeline = () => {
    const totalWidth = SCREEN_WIDTH - 80;
    const segments = [
      { percent: awakePercent, color: '#64748B', label: 'Awake' },
      { percent: lightPercent, color: ACCENT_YELLOW, label: 'Light' },
      { percent: deepPercent, color: ACCENT_PINK, label: 'Deep' },
      { percent: remPercent, color: ACCENT_PURPLE, label: 'REM' },
    ];

    return (
      <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.timelineSection}>
        <LinearGradient
          colors={['rgba(99,102,241,0.08)', 'transparent']}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.timelineHeader}>
          <View style={styles.timelineHeaderLeft}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <Path
                d="M12 6v6l4 2"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.timelineTitle}>Sleep Phases</Text>
          </View>
          <View style={styles.timeRange}>
            <Text style={styles.timeRangeText}>{formatTime(sleepData?.start_time)}</Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.timeRangeText}>{formatTime(sleepData?.end_time)}</Text>
          </View>
        </View>

        <View style={styles.timelineTrack}>
          {segments.map((seg, i) => (
            <View
              key={i}
              style={[
                styles.timelineSegment,
                { width: `${seg.percent}%`, backgroundColor: seg.color },
              ]}>
              {seg.percent > 12 && <Text style={styles.segmentLabel}>{seg.percent}%</Text>}
            </View>
          ))}
        </View>

        <View style={styles.timelineLegend}>
          {segments.map((seg, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendText}>{seg.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  // Premium SVG Icon Renderer
  const renderIcon = (
    type:
      | 'efficiency'
      | 'bed'
      | 'debt'
      | 'wake'
      | 'deep'
      | 'rem'
      | 'chart'
      | 'lightbulb'
      | 'clock'
      | 'star'
  ) => {
    const size = 20;
    const icons: Record<string, React.ReactNode> = {
      efficiency: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={ACCENT_PURPLE} strokeWidth="2" />
          <Path d="M12 6v6l4 2" stroke={ACCENT_PURPLE} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      ),
      bed: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 21V7a2 2 0 012-2h14a2 2 0 012 2v14"
            stroke={ACCENT_YELLOW}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path d="M3 14h18" stroke={ACCENT_YELLOW} strokeWidth="2" />
          <Circle cx="7" cy="10" r="2" stroke={ACCENT_YELLOW} strokeWidth="1.5" />
        </Svg>
      ),
      debt: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={ACCENT_PINK} strokeWidth="2" />
          <Path d="M12 8v4l2 2" stroke={ACCENT_PINK} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      ),
      wake: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="4" stroke={ACCENT_GREEN} strokeWidth="2" />
          <Path
            d="M12 2v2M12 20v2M2 12h2M20 12h2"
            stroke={ACCENT_GREEN}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      ),
      deep: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"
            stroke={ACCENT_BLUE}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      ),
      rem: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"
            stroke={ACCENT_PURPLE}
            strokeWidth="2"
          />
          <Circle cx="12" cy="12" r="3" stroke={ACCENT_PURPLE} strokeWidth="2" />
        </Svg>
      ),
      chart: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 3v18h18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <Path d="M7 16l4-4 4 4 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      ),
      lightbulb: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 18h6M10 21h4M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z"
            stroke={ACCENT_YELLOW}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      ),
      clock: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={ACCENT_PINK} strokeWidth="2" />
          <Path d="M12 6v6l4 2" stroke={ACCENT_PINK} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      ),
      star: (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
            stroke={ACCENT_GREEN}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ),
    };
    return icons[type] || null;
  };

  const renderMetricCard = (
    label: string,
    value: string | number,
    subLabel: string,
    iconType: string,
    accentColor: string,
    animStyle?: any
  ) => (
    <View style={styles.metricCard}>
      <LinearGradient
        colors={[`${accentColor}12`, 'transparent']}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.metricHeader}>
        <View style={styles.metricInfo}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricDesc}>{subLabel}</Text>
        </View>
        <View style={[styles.iconWrapper, { backgroundColor: `${accentColor}20` }]}>
          {renderIcon(iconType as any)}
        </View>
      </View>
      <Text style={[styles.metricValue, { color: accentColor }]}>{value}</Text>
      {animStyle && (
        <View style={styles.metricBarBg}>
          <Animated.View
            style={[styles.metricBarFill, { backgroundColor: accentColor }, animStyle]}
          />
        </View>
      )}
    </View>
  );

  const renderStats = () => (
    <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.statsSection}>
      <Text style={styles.sectionTitle}>Sleep Metrics</Text>
      <View style={styles.statsGrid}>
        {renderMetricCard(
          'Sleep Efficiency',
          `${sleepEfficiency}%`,
          'Goal: 100%',
          'efficiency',
          ACCENT_PURPLE,
          efficiencyBarStyle
        )}
        {renderMetricCard(
          'Went to Bed',
          formatTime(sleepData?.start_time),
          'Bedtime',
          'bed',
          ACCENT_YELLOW
        )}
        {renderMetricCard(
          'Sleep Debt',
          `${debtHours}h ${debtMins}m`,
          'vs 8hr goal',
          'debt',
          ACCENT_PINK,
          debtBarStyle
        )}
        {renderMetricCard(
          'Wake Up',
          formatTime(sleepData?.end_time),
          'Rise time',
          'wake',
          ACCENT_GREEN
        )}
      </View>
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Sleep Stages</Text>
      <View style={styles.stagesRow}>
        {renderMetricCard(
          'Deep Sleep',
          `${deepPercent}%`,
          'Restorative',
          'deep',
          ACCENT_BLUE,
          deepBarStyle
        )}
        {renderMetricCard(
          'REM Sleep',
          `${remPercent}%`,
          'Dream phase',
          'rem',
          ACCENT_PURPLE,
          remBarStyle
        )}
      </View>
    </Animated.View>
  );

  const renderInsights = () => (
    <Animated.View entering={FadeInDown.delay(550).duration(400)} style={styles.insightCard}>
      <LinearGradient
        colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)', 'transparent']}
        style={styles.insightGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.insightHeaderRow}>
        <View style={styles.insightIconWrap}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9.663 17h4.674M10 21h4M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z"
              stroke="#FBBF24"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <View style={styles.insightTitleWrap}>
          <Text style={styles.insightTitle}>Sleep Insights</Text>
          <Text style={styles.insightSubtitle}>Powered by AI analysis</Text>
        </View>
        {/*  <Animated.View style={[styles.aiGlowNew, aiGlowStyle]} /> */}
        <View style={styles.aiBadgeNew}>
          <LinearGradient
            colors={[ACCENT_PURPLE, '#818CF8']}
            style={styles.aiBadgeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.aiTextNew}>AI</Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.insightDivider} />

      <View style={styles.insightBodyNew}>
        <View style={styles.insightItem}>
          <View style={[styles.insightDot, { backgroundColor: ACCENT_PURPLE }]} />
          <Text style={styles.insightTextNew}>
            Your sleep efficiency of{' '}
            <Text style={styles.insightHighlightNew}>{sleepEfficiency}%</Text> is{' '}
            {sleepEfficiency >= 85 ? 'excellent' : sleepEfficiency >= 70 ? 'good' : 'fair'}.
          </Text>
        </View>
        {sleepDebt > 30 && (
          <View style={styles.insightItem}>
            <View style={[styles.insightDot, { backgroundColor: ACCENT_PINK }]} />
            <Text style={styles.insightTextNew}>
              You accumulated{' '}
              <Text style={styles.insightHighlightNew}>
                {debtHours}h {debtMins}m
              </Text>{' '}
              of sleep debt.
            </Text>
          </View>
        )}
        {deepPercent < 15 && (
          <View style={styles.insightItem}>
            <View style={[styles.insightDot, { backgroundColor: ACCENT_BLUE }]} />
            <Text style={styles.insightTextNew}>
              <Text style={{ color: ACCENT_YELLOW }}>Tip:</Text> Avoid screens 1hr before bed for
              better deep sleep.
            </Text>
          </View>
        )}
        {sleepDebt <= 30 && deepPercent >= 15 && (
          <View style={styles.insightItem}>
            <View style={[styles.insightDot, { backgroundColor: ACCENT_GREEN }]} />
            <Text style={styles.insightTextNew}>
              Great job maintaining a healthy sleep schedule!
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  // Premium Date Picker Modal
  const renderDatePicker = () => (
    <Modal
      visible={showDatePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDatePicker(false)}>
      <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
        <View style={styles.datePickerContainer}>
          <LinearGradient
            colors={['rgba(99,102,241,0.15)', 'rgba(30,30,50,0.95)']}
            style={styles.datePickerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.datePickerHandle} />
          <Text style={styles.datePickerTitle}>Select Date</Text>
          <Text style={styles.datePickerSubtitle}>View sleep data for different days</Text>

          <View style={styles.dateOptionsContainer}>
            {availableDates.map((d, i) => (
              <Pressable
                key={d.index}
                style={({ pressed }) => [
                  styles.dateOptionNew,
                  selectedDateIndex === d.index && styles.dateOptionActiveNew,
                  pressed && styles.dateOptionPressed,
                ]}
                onPress={() => {
                  setSelectedDateIndex(d.index);
                  setShowDatePicker(false);
                }}>
                <View style={styles.dateOptionLeft}>
                  <View
                    style={[
                      styles.dateIndicator,
                      selectedDateIndex === d.index && styles.dateIndicatorActive,
                    ]}
                  />
                  <View>
                    <Text
                      style={[
                        styles.dateOptionLabel,
                        selectedDateIndex === d.index && styles.dateOptionLabelActive,
                      ]}>
                      {i === 0
                        ? 'Today'
                        : new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.dateOptionDate}>
                      {new Date(d.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>
                {selectedDateIndex === d.index && (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 6L9 17l-5-5"
                      stroke={ACCENT_PURPLE}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* OLED Edge Gradients */}
      <LinearGradient
        colors={['#1e1b4b', 'transparent']}
        style={styles.gradientTopLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['#0c4a6e', 'transparent']}
        style={styles.gradientBottomRight}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
      />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>Sleep Analysis</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Your Sleep</Text>
            <Text style={styles.subtitle}>
              {sleepData
                ? new Date(sleepData.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })
                : '--'}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.dateSelector, pressed && styles.dateSelectorPressed]}
            onPress={() => setShowDatePicker(true)}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.dateSelectorText}>
              {availableDates[selectedDateIndex]?.label || 'Today'}
            </Text>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 9l6 6 6-6"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : !sleepData ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyTitle}>No Sleep Data</Text>
            <Text style={styles.emptyText}>Pull to refresh on sleep page</Text>
          </View>
        ) : (
          <>
            {renderChart()}
            {renderScoreRing()}
            {renderTimeline()}
            {renderStats()}
            {renderInsights()}
          </>
        )}
        <View style={{ height: 50 }} />
      </ScrollView>

      {renderDatePicker()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // OLED Edge Gradients
  gradientTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    opacity: 0.4,
  },
  gradientBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    opacity: 0.3,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
  headerSpacer: { width: 44 },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 16 },

  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dateSelectorPressed: { backgroundColor: 'rgba(99, 102, 241, 0.3)', borderColor: ACCENT_PURPLE },
  dateSelectorText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  centerBox: { alignItems: 'center', paddingTop: 80 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },

  chartSection: { alignItems: 'center', marginBottom: 20, position: 'relative', marginTop: 10 },
  badge: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -55,
    zIndex: 10,
    backgroundColor: BADGE_COLOR,
    borderRadius: 22,
    width: 85,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeHours: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 4 },
  badgeHoursSub: { fontSize: 14, fontWeight: '500' },
  badgeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  chartWrapper: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  labelGroup: { position: 'absolute', width: 50, alignItems: 'center' },
  labelValue: { fontSize: 12, fontWeight: '600', color: '#fff' },
  labelName: { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },

  // Score Section
  scoreSection: { marginBottom: 20 },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  scoreInfo: { flex: 1, marginLeft: 20 },
  scoreTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  scoreDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },

  // Timeline
  timelineSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  timeRange: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeRangeText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  timelineTrack: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  timelineSegment: { height: '100%', justifyContent: 'center', alignItems: 'center' },
  segmentLabel: { fontSize: 9, color: '#000', fontWeight: '700' },
  timelineLegend: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  statsSection: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stagesRow: { flexDirection: 'row', gap: 12 },

  metricCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22 },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricInfo: { flex: 1, marginRight: 8 },
  metricLabel: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 3 },
  metricDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: { fontSize: 26, fontWeight: '700', marginBottom: 10 },
  metricBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  metricBarFill: { height: '100%', borderRadius: 3 },

  insightCard: {
    backgroundColor: 'rgba(15,15,25,0.9)',
    borderRadius: 28,
    padding: 24,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  insightGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    borderRadius: 28,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  insightTitleWrap: { flex: 1 },
  insightTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  insightSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  aiGlowNew: {
    position: 'absolute',
    right: -20,
    top: -10,
    width: 80,
    height: 80,
    backgroundColor: ACCENT_PURPLE,
    borderRadius: 40,
    opacity: 0.2,
  },
  aiBadgeNew: { borderRadius: 14, overflow: 'hidden' },
  aiBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  aiTextNew: { fontSize: 11, fontWeight: '700', color: '#fff' },
  insightDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  insightBodyNew: { gap: 16 },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  insightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  insightTextNew: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  insightHighlightNew: { color: '#fff', fontWeight: '700' },

  // Premium Date Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: 'rgba(20,20,35,0.98)',
    borderRadius: 32,
    padding: 28,
    paddingTop: 16,
    width: SCREEN_WIDTH - 48,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    overflow: 'hidden',
    position: 'relative',
  },
  datePickerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
  },
  datePickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  datePickerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  dateOptionsContainer: { gap: 10 },
  dateOptionNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dateOptionActiveNew: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: 'rgba(99,102,241,0.4)',
  },
  dateOptionPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dateOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dateIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateIndicatorActive: {
    backgroundColor: ACCENT_PURPLE,
    borderColor: 'rgba(99,102,241,0.5)',
  },
  dateOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  dateOptionLabelActive: { color: '#fff' },
  dateOptionDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
});
