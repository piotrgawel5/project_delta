import { HealthCategory } from './health';

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type NutritionEntry = {
  id: string;
  category: HealthCategory; // always "nutrition"
  name: string;
  macros: Macros;
  timestamp: number;
};
