import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SleepTimeline, TimelineData } from '../SleepTimeline';

// Color constants for simulated generation
const PHASE_COLORS = {
  awake: '#F87171',
  rem: '#818CF8',
  light: '#60A5FA',
  deep: '#34D399',
};

interface DailyHypnogramCardProps {
  date: string;
  startTime?: string;
  endTime?: string;
  stages?: any[]; // Allow raw stages
  // Summary for simulation
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
}

export const DailyHypnogramCard = ({
  startTime,
  endTime,
  stages,
  deepMin,
  lightMin,
  remMin,
  awakeMin,
}: DailyHypnogramCardProps) => {
  // Prepare or Simulate Data
  const timelineData: TimelineData = useMemo(() => {
    // 1. If we have real stages, use them
    if (stages && stages.length > 0) {
      return {
        startTime: startTime || new Date().toISOString(),
        endTime: endTime || new Date().toISOString(),
        stages: stages,
        totalDurationMinutes: 0, // Calculated elsewhere if needed
      };
    }

    // 2. Otherwise, SIMULATE a Hypnogram based on summary
    // Goal: Create ~90 min cycles that distribute the summary duration reasonably.
    const startD = startTime ? new Date(startTime) : new Date();
    const endD = endTime ? new Date(endTime) : new Date();
    if (!startTime) startD.setHours(startD.getHours() - 7); // Default 7h ago

    const totalDuration = (endD.getTime() - startD.getTime()) / 60000;
    if (totalDuration <= 0)
      return { stages: [], startTime: '', endTime: '', totalDurationMinutes: 0 };

    const _stages: any[] = [];
    let currentTime = startD.getTime();

    // Remaining buckets
    let rDeep = deepMin;
    let rRem = remMin;
    let rLight = lightMin;
    let rAwake = awakeMin;

    // Simulation logic involves creating chunks
    // We loop until we cover the duration
    // A typical cycle: Light -> Deep -> Light -> REM

    while (currentTime < endD.getTime()) {
      // Create a cycle (approx 90 mins, or remaining)
      const cycleLength = Math.min(90, (endD.getTime() - currentTime) / 60000);
      if (cycleLength <= 10) break;

      // Distribute this cycle
      // 1. Light (Transition)
      const lDur = Math.min(rLight > 0 ? 30 : 0, cycleLength * 0.4);
      if (lDur > 0) {
        _stages.push({
          startTime: new Date(currentTime).toISOString(),
          endTime: new Date(currentTime + lDur * 60000).toISOString(),
          stage: 'light',
          durationMinutes: lDur,
        });
        currentTime += lDur * 60000;
        rLight -= lDur;
      }

      // 2. Deep (Early cycles have more deep)
      const dDur = Math.min(rDeep > 0 ? 40 : 0, cycleLength * 0.3);
      if (dDur > 0 && currentTime < endD.getTime()) {
        _stages.push({
          startTime: new Date(currentTime).toISOString(),
          endTime: new Date(currentTime + dDur * 60000).toISOString(),
          stage: 'deep',
          durationMinutes: dDur,
        });
        currentTime += dDur * 60000;
        rDeep -= dDur;
      }

      // 3. REM (Late cycles have more REM)
      const remDur = Math.min(rRem > 0 ? 30 : 0, cycleLength * 0.3);
      if (remDur > 0 && currentTime < endD.getTime()) {
        _stages.push({
          startTime: new Date(currentTime).toISOString(),
          endTime: new Date(currentTime + remDur * 60000).toISOString(),
          stage: 'rem',
          durationMinutes: remDur,
        });
        currentTime += remDur * 60000;
        rRem -= remDur;
      }

      // 4. Awake (Briefs)
      if (rAwake > 0 && Math.random() > 0.7 && currentTime < endD.getTime()) {
        const aDur = Math.min(rAwake, 5);
        _stages.push({
          startTime: new Date(currentTime).toISOString(),
          endTime: new Date(currentTime + aDur * 60000).toISOString(),
          stage: 'awake',
          durationMinutes: aDur,
        });
        currentTime += aDur * 60000;
        rAwake -= aDur;
      }

      // Safety break to fill remaining time as Light if gaps
      if (lDur + dDur + remDur === 0) {
        const fill = (endD.getTime() - currentTime) / 60000;
        _stages.push({
          startTime: new Date(currentTime).toISOString(),
          endTime: new Date(currentTime + fill * 60000).toISOString(),
          stage: 'light',
          durationMinutes: fill,
        });
        currentTime += fill * 60000;
      }
    }

    return {
      startTime: startD.toISOString(),
      endTime: endD.toISOString(),
      stages: _stages,
      totalDurationMinutes: totalDuration,
    };
  }, [startTime, endTime, stages, deepMin, lightMin, remMin, awakeMin]);

  return (
    <View style={styles.container}>
      {/* <Text style={styles.title}>Sleep Structure</Text>  (Already in SleepTimeline logic mostly, or we hide it) */}
      {/* Actually SleepTimeline has a header. Let's see if we should suppress it or use it. */}
      {/* We will let SleepTimeline render its header "Sleep Structure". */}

      <SleepTimeline data={timelineData} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // marginHorizontal: 20, // SleepTimeline has margins/padding inside usually?
    // SleepTimeline has marginVertical 10 and padding 20.
    // We might want to constrain it or wrapper it.
    // Let's keep it simple for now.
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
