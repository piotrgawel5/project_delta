// app/sleep-score.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  G,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RECOVERY = '#3E42A9';
const RECOVERY_LIGHT = '#5B5FC7';
const ACCENT = '#30D158';

const SCORE_FACTORS = [
  {
    id: 'duration',
    name: 'Duration',
    description: 'Time spent sleeping vs 7-9h optimal',
    color: '#38BDF8',
  },
  {
    id: 'quality',
    name: 'Quality',
    description: 'Deep + REM sleep percentage',
    color: RECOVERY_LIGHT,
  },
  {
    id: 'recovery',
    name: 'Recovery',
    description: 'Physical restoration from deep sleep',
    color: '#F472B6',
  },
  {
    id: 'consistency',
    name: 'Consistency',
    description: 'Regularity of sleep schedule',
    color: '#FB923C',
  },
];

export default function SleepScoreScreen() {
  const params = useLocalSearchParams<{
    total: string;
    duration: string;
    quality: string;
    recovery: string;
    consistency: string;
  }>();

  const scores = {
    total: parseInt(params.total || '0'),
    duration: parseInt(params.duration || '0'),
    quality: parseInt(params.quality || '0'),
    recovery: parseInt(params.recovery || '0'),
    consistency: parseInt(params.consistency || '0'),
  };

  const ringProgress = useSharedValue(0);
  const barAnimations = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  useEffect(() => {
    ringProgress.value = withTiming(scores.total / 100, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });

    barAnimations.forEach((anim, index) => {
      const scoreKey = SCORE_FACTORS[index].id as keyof typeof scores;
      anim.value = withDelay(
        200 + index * 80,
        withTiming(scores[scoreKey] / 100, { duration: 500 })
      );
    });
  }, []);

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Work';
  };

  const renderScoreRing = () => {
    const size = 180;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(scores.total / 100) * circumference} ${circumference}`;

    return (
      <View style={styles.ringContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={RECOVERY} />
              <Stop offset="100%" stopColor={RECOVERY_LIGHT} />
            </SvgLinearGradient>
          </Defs>

          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
            fill="transparent"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="url(#scoreGrad)"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />

          <SvgText x={cx} y={cy - 5} fill="#fff" fontSize="42" fontWeight="700" textAnchor="middle">
            {scores.total}
          </SvgText>
          <SvgText
            x={cx}
            y={cy + 20}
            fill="rgba(255,255,255,0.5)"
            fontSize="13"
            textAnchor="middle">
            {getScoreLabel(scores.total)}
          </SvgText>
        </Svg>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0C0C1E', '#1A1A3E', '#0C0C1E']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Sleep Score</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Score Ring */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.scoreSection}>
          {renderScoreRing()}
          <Text style={styles.scoreDesc}>
            Your sleep score is calculated from multiple factors that contribute to restorative
            rest.
          </Text>
        </Animated.View>

        {/* Factor Cards */}
        <Text style={styles.sectionTitle}>Score Breakdown</Text>

        {SCORE_FACTORS.map((factor, index) => {
          const scoreKey = factor.id as keyof typeof scores;
          const score = scores[scoreKey];

          return (
            <Animated.View
              key={factor.id}
              entering={FadeInDown.delay(100 + index * 80).duration(400)}>
              <View style={styles.factorCard}>
                <View style={styles.factorHeader}>
                  <View style={styles.factorInfo}>
                    <Text style={styles.factorName}>{factor.name}</Text>
                    <Text style={styles.factorDesc}>{factor.description}</Text>
                  </View>
                  <Text style={[styles.factorScore, { color: factor.color }]}>{score}</Text>
                </View>

                <View style={styles.factorBarBg}>
                  <View
                    style={[
                      styles.factorBarFill,
                      { width: `${score}%`, backgroundColor: factor.color },
                    ]}
                  />
                </View>
              </View>
            </Animated.View>
          );
        })}

        {/* Insight Card */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Tonight&apos;s Goal</Text>
            <Text style={styles.insightText}>
              Try to get to bed by 10:30 PM to improve your consistency score. Aim for at least 7
              hours of sleep.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0C1E' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: { fontSize: 26, color: '#fff', marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff', fontFamily: 'Inter-SemiBold' },
  headerSpacer: { width: 40 },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  scoreSection: { alignItems: 'center', paddingVertical: 32 },
  ringContainer: { marginBottom: 20 },
  scoreDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    fontFamily: 'Poppins-Bold',
  },

  factorCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  factorInfo: { flex: 1, marginRight: 12 },
  factorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  factorDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 16 },
  factorScore: { fontSize: 24, fontWeight: '700', fontFamily: 'Poppins-Bold' },

  factorBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  factorBarFill: { height: '100%', borderRadius: 3 },

  insightCard: {
    backgroundColor: 'rgba(62, 66, 169, 0.2)',
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(62, 66, 169, 0.3)',
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  insightText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19 },
});
