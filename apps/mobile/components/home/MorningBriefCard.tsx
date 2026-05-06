// components/home/MorningBriefCard.tsx
//
// SCAFFOLDING — wraps the existing InsightCard to render a cross-pillar brief.
// The InsightCard accepts a SleepInsight shape; the morningBrief composer
// returns the same shape, so this is a one-line passthrough today.
//
// Production direction: this file becomes the home for the cross-pillar surface
// (custom hero, day-greeting, recommendations stacked with one-tap actions).
// Until then, the wrapper exists so the import surface — `MorningBriefCard` —
// is stable for callers in the workout / sleep / nutrition tabs.

import React from 'react';
import { InsightCard } from '../sleep/InsightCard';
import type { SleepInsight } from '../sleep/InsightCard';

interface MorningBriefCardProps {
  insight: SleepInsight;
  delay?: number;
}

export function MorningBriefCard({ insight, delay = 0 }: MorningBriefCardProps) {
  return <InsightCard insight={insight} delay={delay} showContributors showPrediction={false} />;
}
