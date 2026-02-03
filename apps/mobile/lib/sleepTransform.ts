// lib/sleepTransform.ts
// Utility functions for transforming aggregate sleep data into hypnogram-compatible format

/**
 * Sleep stage type for hypnogram visualization
 */
export interface HypnogramStage {
    stage: "awake" | "rem" | "light" | "deep";
    startTime: string;
    endTime: string;
    durationMin: number;
}

/**
 * Input sleep data with aggregate stage minutes
 */
export interface AggregateSleepData {
    start_time: string;
    end_time: string;
    duration_minutes: number;
    deep_sleep_minutes: number;
    rem_sleep_minutes: number;
    light_sleep_minutes: number;
    awake_minutes: number;
}

/**
 * Transform aggregate sleep data into hypnogram-compatible stage segments.
 *
 * Uses a realistic sleep cycle pattern:
 * - Light → Deep occurs early in the night
 * - REM periods get longer toward morning
 * - Brief awake moments distributed throughout
 *
 * @param data Aggregate sleep data from cache/database
 * @returns Array of stage segments suitable for HypnogramChart
 */
export function transformToHypnogramStages(
    data: AggregateSleepData | null | undefined,
): HypnogramStage[] {
    if (
        !data || !data.start_time || !data.end_time ||
        data.duration_minutes <= 0
    ) {
        return [];
    }

    const stages: HypnogramStage[] = [];
    const startMs = new Date(data.start_time).getTime();
    const totalDuration = data.duration_minutes;

    // Distribute stage minutes (use actual values or fallback estimates)
    const deepMins = data.deep_sleep_minutes ||
        Math.round(totalDuration * 0.18);
    const remMins = data.rem_sleep_minutes || Math.round(totalDuration * 0.22);
    const lightMins = data.light_sleep_minutes ||
        Math.round(totalDuration * 0.55);
    const awakeMins = data.awake_minutes || Math.round(totalDuration * 0.05);

    let currentTime = startMs;

    // Helper to add a stage
    const addStage = (stage: HypnogramStage["stage"], durationMins: number) => {
        if (durationMins <= 0) return;
        const endTime = currentTime + durationMins * 60 * 1000;
        stages.push({
            stage,
            startTime: new Date(currentTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            durationMin: durationMins,
        });
        currentTime = endTime;
    };

    // Build a realistic sleep pattern:
    // Cycle 1: Light (40%) → Deep (60%) → REM (25%)
    // Cycle 2: Light (30%) → Deep (40%) → REM (35%)
    // Cycle 3: Light (30%) → Awake brief → REM (40%)

    // Distribute across ~3 sleep cycles with awake moments
    const light1 = Math.round(lightMins * 0.35);
    const deep1 = Math.round(deepMins * 0.55);
    const rem1 = Math.round(remMins * 0.25);

    const light2 = Math.round(lightMins * 0.3);
    const deep2 = Math.round(deepMins * 0.35);
    const rem2 = Math.round(remMins * 0.35);
    const awake1 = Math.round(awakeMins * 0.4);

    const light3 = lightMins - light1 - light2;
    const deep3 = deepMins - deep1 - deep2;
    const rem3 = remMins - rem1 - rem2;
    const awake2 = awakeMins - awake1;

    // Cycle 1: Light → Deep → REM
    addStage("light", light1);
    addStage("deep", deep1);
    addStage("rem", rem1);

    // Cycle 2: Light → Deep → brief awake → REM
    addStage("light", light2);
    addStage("deep", deep2);
    if (awake1 > 0) addStage("awake", awake1);
    addStage("rem", rem2);

    // Cycle 3: Light → remaining deep → Light → REM → awake
    addStage("light", Math.round(light3 * 0.5));
    if (deep3 > 0) addStage("deep", deep3);
    addStage("light", light3 - Math.round(light3 * 0.5));
    addStage("rem", rem3);
    if (awake2 > 0) addStage("awake", awake2);

    return stages;
}
