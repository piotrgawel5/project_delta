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

export const formatHours = (totalMinutes: number, decimals = 1): string => {
    if (!totalMinutes) return "0.0";
    return (totalMinutes / 60).toFixed(decimals);
};

export const formatTimeParts = (iso?: string): { time: string; meridiem?: string } => {
    const raw = formatTime(iso);
    if (raw === "--:--") return { time: raw };
    const match = raw.match(/(AM|PM)$/);
    const meridiem = match ? match[1] : undefined;
    const time = meridiem ? raw.replace(meridiem, "") : raw;
    return { time, meridiem };
};

export const formatTimeWithMeridiem = (iso?: string): string => {
    const { time, meridiem } = formatTimeParts(iso);
    return meridiem ? `${time} ${meridiem}` : time;
};

export const formatMinutesToTimeLabel = (minutes?: number | null): string => {
    if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "--";
    let mins = minutes % (24 * 60);
    if (mins < 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export const getSleepDescription = (score: number, durationMinutes: number): string => {
    if ((!score || Number.isNaN(score)) && durationMinutes > 0) {
        return "Sleep recorded. Score will appear once scoring is complete.";
    }
    if (score >= 85) {
        return "Excellent night — your sleep hit all targets for duration and recovery.";
    }
    if (score >= 70) {
        return "Good night overall. A little more deep sleep would push this higher.";
    }
    if (score >= 55) {
        return "Decent sleep, but you fell short of your duration goal.";
    }
    if (score > 0) {
        return "Tough night. Short sleep or frequent waking dragged the score down.";
    }
    return "Sleep recorded. Score will appear once scoring is complete.";
};
