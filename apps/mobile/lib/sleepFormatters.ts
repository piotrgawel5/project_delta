/**
 * Sleep data formatting utilities
 */

/**
 * Format minutes into hours and minutes
 * @param totalMinutes - Total minutes
 * @returns Object with hours and minutes
 */
export const formatDuration = (
    totalMinutes: number,
): { h: number; m: number } => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return { h, m };
};

/**
 * Format ISO timestamp to HH:MM AM/PM
 * @param iso - ISO timestamp string
 * @returns Formatted time string or '--:--' if invalid
 */
export const formatTime = (iso?: string): string => {
    if (!iso) return "--:--";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        .replace(" ", "");
};
