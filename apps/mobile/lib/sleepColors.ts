/**
 * Sleep score color grading utilities
 */

export type SleepScoreType = {
  score: number;
  grade: string;
  color: string;
};

/**
 * Get sleep score grade, label, and color based on score value
 * @param score - Sleep score from 0-100
 * @returns Object with score, grade label, and hex color
 */
export const getSleepScoreGrade = (score: number): SleepScoreType => {
  if (score < 0 || score > 100) {
    return { score: score, grade: 'N/A', color: '#000000' };
  }
  if (score >= 90) {
    return { score: score, grade: 'Excellent', color: '#581C87' };
  }
  if (score >= 80) return { score: score, grade: 'Great', color: '#22c55e' };
  if (score >= 70) return { score: score, grade: 'Good', color: '#84CC16' };
  if (score >= 60) return { score: score, grade: 'Fair', color: '#eab308' };
  if (score >= 50) return { score: score, grade: 'Poor', color: '#EF4444' };
  if (score >= 40) return { score: score, grade: 'Bad', color: '#DC2626' };
  if (score >= 30) return { score: score, grade: 'Awful', color: '#B91C1C' };
  if (score >= 0) {
    return { score: score, grade: 'Terrible', color: '#7F1D1D' };
  }

  return { score: score, grade: 'N/A', color: '#000000' };
};

/**
 * Brighten a hex color by adding to each RGB channel
 * @param hex - Hex color string (with or without #)
 * @param amount - Amount to brighten (0-255), default 100
 * @returns Brightened hex color
 */
export const brightenColor = (hex: string, amount: number = 100): string => {
  // Remove # if present
  const color = hex.replace('#', '');

  // Parse RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Brighten by adding to each channel (capped at 255)
  const newR = Math.min(255, r + amount);
  const newG = Math.min(255, g + amount);
  const newB = Math.min(255, b + amount);

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG
    .toString(16)
    .padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};
