/**
 * Gets an array of dates spanning the previous 14 days (2 weeks), ordered from oldest to newest.
 * @returns {Date[]} An array of 14 Date objects representing the previous 2 weeks, starting from 13 days ago and ending today.
 * @example
 * const weekDates = getPreviousWeekDates();
 * // Returns array of dates from 13 days ago to today
 */

export const getPreviousWeekDates = () => {
  const today = new Date();

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d;
  });

  return dates.reverse();
};

export const formatDate = (date: Date) => {
  const day = date.getDate();
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  return { day, weekday };
};
