export type HealthCategory = 'body' | 'nutrition' | 'activity' | 'sleep' | 'mind';

export type HealthEntry = {
  id: string;
  category: HealthCategory;
  metric: string;
  value: number;
  unit?: string;
  timestamp: number;
};
