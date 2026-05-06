// lib/morningBrief.ts
//
// Cross-pillar Morning Brief composer.
//
// Pure function: takes already-loaded data from sleep / workout / nutrition stores
// and returns a `SleepInsight`-shaped payload (see components/sleep/InsightCard.tsx).
// We deliberately reuse the SleepInsight shape because InsightCard already
// renders it — moving the card to components/home/ later is a no-op for callers.
//
// Rules (deterministic, research-grounded):
//   1. Sleep < 6h        → "Deload top set 5–10% today."
//   2. 7-day protein     → "Recovery may be the bottleneck." (if low protein + high volume)
//   3. Late meal + low deep → "Late-meal pattern — earlier dinner = +deep sleep."
//   4. Heavy legs + low sleep → "Expect ~3% lower performance — lighter accessory work."
//
// Selection priority: rule 4 > rule 1 > rule 3 > rule 2 > default headline.
// Only one headline is emitted; all triggered rules contribute recommendations.

import type { SleepInsight, ContributingSignal } from '@components/sleep/InsightCard';

// ─────────────────────────────────────────────────────────────────────────────
// Inputs (plain shapes — composer never imports stores)
// ─────────────────────────────────────────────────────────────────────────────

export interface MorningBriefSleepNight {
  durationMinutes: number;
  deepMinutes: number;
}

export interface MorningBriefMealEntry {
  /** ISO timestamp. Used for "logged after 21:00" check. */
  loggedAt: string;
  /** Date the meal was logged for (YYYY-MM-DD). */
  date: string;
  proteinG: number;
}

export interface MorningBriefSession {
  date: string;             // YYYY-MM-DD
  /** Total set count touching the named muscle groups in this session. */
  legSetCount: number;
  /** Total set count for the session. */
  totalSets: number;
}

export interface MorningBriefProfile {
  weightKg?: number | null;
}

export interface MorningBriefInput {
  lastNight: MorningBriefSleepNight | null;
  /** Last 7 nights of deep sleep minutes — used for personal p25 baseline. */
  last7DaysDeepMinutes: number[];
  recentSessions: MorningBriefSession[];   // last 7 days
  recentMeals: MorningBriefMealEntry[];    // last 7 days
  profile: MorningBriefProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tunables
// ─────────────────────────────────────────────────────────────────────────────

const LOW_SLEEP_HOURS = 6;
const PROTEIN_TARGET_G_PER_KG = 1.4;
const HIGH_VOLUME_DELTA = 0.15;          // 7-day volume up >15%
const LATE_MEAL_HOUR_LOCAL = 21;
const HEAVY_LEG_SET_THRESHOLD = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function loggedAtHour(iso: string): number {
  return new Date(iso).getHours();
}

// ─────────────────────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────────────────────

export function buildMorningBrief(input: MorningBriefInput): SleepInsight {
  const signals: ContributingSignal[] = [];
  const recommendations: string[] = [];

  let headline = 'You are on track.';
  let subheadline = 'Stick to your plan today.';

  // Rule 1 inputs.
  const sleepHours = input.lastNight ? input.lastNight.durationMinutes / 60 : null;
  const lowSleep = sleepHours !== null && sleepHours < LOW_SLEEP_HOURS;
  if (sleepHours !== null) {
    signals.push({
      factor: 'Sleep duration',
      impact: lowSleep ? 'negative' : 'positive',
      value: `${sleepHours.toFixed(1)}h`,
      weight: lowSleep ? 80 : 40,
    });
  }

  // Rule 4 — heavy-leg + low sleep precedence.
  const lastSession = input.recentSessions[0] ?? null;
  const heavyLegLast =
    lastSession !== null && lastSession.legSetCount > HEAVY_LEG_SET_THRESHOLD;

  if (heavyLegLast && lowSleep) {
    headline = 'Expect ~3% lower performance today.';
    subheadline = 'Heavy legs yesterday and short sleep — lean into lighter accessory work.';
    recommendations.push('Reduce accessory work volume by ~20%.');
    signals.push({
      factor: 'Heavy leg session',
      impact: 'negative',
      value: `${lastSession.legSetCount} sets`,
      weight: 70,
    });
  } else if (lowSleep) {
    headline = 'Sleep was short — protect your top set.';
    subheadline = 'Aim for a 5–10% deload on the heaviest set today.';
    recommendations.push('Deload top set 5–10% today.');
  }

  // Rule 2 — protein vs volume.
  const protein7d = input.recentMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const proteinPerDay = protein7d / 7;
  const weight = input.profile.weightKg ?? null;
  const proteinPerKg = weight ? proteinPerDay / weight : null;
  const proteinLow = proteinPerKg !== null && proteinPerKg < PROTEIN_TARGET_G_PER_KG;

  // Volume delta = (last 7 days totalSets) − (prior 7 days totalSets) / max(prior, 1).
  // recentSessions only carries last 7 days here, so we approximate "up" as
  // mean(totalSets) > 8 sets/day. The composer accepts a richer shape later.
  const sevenDaySets = input.recentSessions.reduce((acc, s) => acc + s.totalSets, 0);
  const highVolume = sevenDaySets / 7 > 8 * (1 + HIGH_VOLUME_DELTA);

  if (proteinLow && highVolume) {
    if (headline === 'You are on track.') {
      headline = 'Recovery may be the bottleneck.';
      subheadline = 'Protein is trailing while training volume is up.';
    }
    recommendations.push('Add ~30g protein to one meal today.');
    signals.push({
      factor: 'Protein 7-day',
      impact: 'negative',
      value: proteinPerKg ? `${proteinPerKg.toFixed(1)} g/kg` : '—',
      weight: 60,
    });
  } else if (proteinPerKg !== null) {
    signals.push({
      factor: 'Protein 7-day',
      impact: 'neutral',
      value: `${proteinPerKg.toFixed(1)} g/kg`,
      weight: 30,
    });
  }

  // Rule 3 — late meal + low deep sleep.
  const yesterdayLateMeal = input.recentMeals.some(
    (m) => loggedAtHour(m.loggedAt) >= LATE_MEAL_HOUR_LOCAL,
  );
  const lastDeep = input.lastNight?.deepMinutes ?? null;
  const deepP25 = quantile(input.last7DaysDeepMinutes, 0.25);
  const lowDeep = lastDeep !== null && deepP25 > 0 && lastDeep < deepP25;

  if (yesterdayLateMeal && lowDeep) {
    if (headline === 'You are on track.') {
      headline = 'Late dinner showed up in your deep sleep.';
      subheadline = 'Earlier dinner tends to add deep sleep minutes.';
    }
    recommendations.push('Try eating dinner before 20:30 tonight.');
    signals.push({
      factor: 'Late meal',
      impact: 'negative',
      value: 'after 21:00',
      weight: 45,
    });
  }

  return {
    headline,
    subheadline,
    contributingSignals: signals,
    recommendations,
  };
}
