// components/sleep/SleepTimelineSection.tsx
//
// Premium-gated wrapper around `SleepTimeline`. Pulls timeline phases via
// `fetchSleepTimeline` with a per-component date→data cache so day-pager
// swipes don't refetch.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { fetchSleepTimeline, type SleepTimelineResponse } from '@lib/api';
import { isPaidPlan } from '@lib/planUtils';
import { SleepTimeline, type TimelineData, type SleepStage } from './SleepTimeline';

interface Props {
  userId: string | null;
  date: string;          // YYYY-MM-DD
  plan: string | null | undefined;
  startTimeIso: string | null;
  endTimeIso: string | null;
  totalDurationMinutes: number | null;
}

function adapt(resp: SleepTimelineResponse): SleepStage[] {
  return resp.phases.map((p) => ({
    startTime: p.start_time,
    endTime: p.end_time,
    stage: p.stage,
    durationMinutes: p.duration_minutes,
  }));
}

export default function SleepTimelineSection({
  userId,
  date,
  plan,
  startTimeIso,
  endTimeIso,
  totalDurationMinutes,
}: Props) {
  const cache = useRef(new Map<string, SleepTimelineResponse | null>());
  const [resp, setResp] = useState<SleepTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isPaid = isPaidPlan(plan ?? null);

  useEffect(() => {
    if (!isPaid || !userId) return;
    const cached = cache.current.get(date);
    if (cached !== undefined) {
      setResp(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSleepTimeline(userId, date)
      .then((data) => {
        if (cancelled) return;
        cache.current.set(date, data);
        setResp(data);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isPaid, userId, date]);

  const data = useMemo<TimelineData | null>(() => {
    if (!resp || resp.phases.length === 0) return null;
    if (!startTimeIso || !endTimeIso || totalDurationMinutes == null) return null;
    return {
      stages: adapt(resp),
      startTime: startTimeIso,
      endTime: endTimeIso,
      totalDurationMinutes,
    };
  }, [resp, startTimeIso, endTimeIso, totalDurationMinutes]);

  if (!isPaid) {
    return (
      <View style={styles.lockedCard}>
        <Text style={styles.title}>SLEEP STAGES</Text>
        <Text style={styles.lockedHint}>Premium — full hypnogram with stage breakdown.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <Text style={styles.title}>SLEEP STAGES</Text>
        <ActivityIndicator color={SLEEP_THEME.textSecondary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.lockedCard}>
        <Text style={styles.title}>SLEEP STAGES</Text>
        <Text style={styles.lockedHint}>No phase data available for this night.</Text>
      </View>
    );
  }

  return <SleepTimeline data={data} />;
}

const styles = StyleSheet.create({
  lockedCard: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    minHeight: 140,
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: SLEEP_THEME.textMuted1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  lockedHint: {
    color: SLEEP_THEME.textSecondary,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
  },
});
