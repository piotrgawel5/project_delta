export type UserPlan = 'free' | 'pro' | 'premium';

export function isPaidPlan(plan?: string | null): plan is 'pro' | 'premium' {
  return plan === 'pro' || plan === 'premium';
}

export function getPlanFeatures(plan?: string | null) {
  return {
    premiumSleepPrediction: isPaidPlan(plan),
    advancedInsights: isPaidPlan(plan),
    sleepTimeline: isPaidPlan(plan),   // flag for future UI gating
  };
}
