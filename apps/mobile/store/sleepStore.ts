// store/sleepStore.ts
import { create } from "zustand";
import { supabase } from "apps/mobile/lib/supabase";
import { AppState, AppStateStatus, Platform } from "react-native";
import {
    calculateSleepQuality,
    checkPermissions,
    getSleepSessions,
    isAvailable,
    requestPermissions,
    SleepSession,
} from "../modules/health-connect";
import {
    CachedSleepRecord,
    getPendingSyncRecords,
    loadFromCache,
    markFetchCompleted,
    markRecordsSynced,
    mergeWithSupabaseData,
    shouldFetchFromHealthConnect,
    shouldSync,
    upsertCacheRecord,
} from "apps/mobile/lib/sleepCache";
import {
    calculateQualityFromDuration,
    estimateSleepStages,
} from "apps/mobile/lib/sleepCalculations";
import { useProfileStore, UserProfile } from "./profileStore";
import { api } from "@lib/api";

interface SleepData {
    id: string;
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    quality_score: number;
    deep_sleep_minutes: number;
    rem_sleep_minutes: number;
    light_sleep_minutes: number;
    awake_minutes: number;
    data_source: string;
    synced_at: string;
}

interface SleepState {
    isAvailable: boolean;
    isConnected: boolean;
    checkingStatus: boolean;
    lastNightSleep: SleepSession | null;
    weeklyHistory: SleepData[];
    loading: boolean;
    lastSyncTime: number;

    checkHealthConnectStatus: () => Promise<void>;
    requestHealthPermissions: () => Promise<
        { granted: boolean; openedSettings?: boolean }
    >;
    fetchSleepData: (userId: string) => Promise<void>;
    syncToSupabase: (
        userId: string,
        session: SleepSession,
        profile: UserProfile | null,
    ) => Promise<void>;
    refreshData: (userId: string) => Promise<void>;
    loadCachedData: () => Promise<void>;
    syncPendingRecords: (userId: string) => Promise<void>;
}

export const useSleepStore = create<SleepState>((set, get) => ({
    isAvailable: false,
    isConnected: false,
    checkingStatus: true,
    lastNightSleep: null,
    weeklyHistory: [],
    loading: false,
    lastSyncTime: 0,

    checkHealthConnectStatus: async () => {
        if (Platform.OS !== "android") {
            set({
                isAvailable: false,
                isConnected: false,
                checkingStatus: false,
            });
            return;
        }

        set({ checkingStatus: true });

        try {
            const availability = await isAvailable();
            set({ isAvailable: availability.available });

            if (availability.available) {
                const permissions = await checkPermissions();
                const sleepPermission = permissions.find((p) =>
                    p.permission === "READ_SLEEP"
                );
                set({ isConnected: sleepPermission?.granted ?? false });
            }
        } catch (error) {
            console.error("Error checking Health Connect status:", error);
            set({ isAvailable: false, isConnected: false });
        } finally {
            set({ checkingStatus: false });
        }
    },

    requestHealthPermissions: async () => {
        if (Platform.OS !== "android") return { granted: false };

        try {
            const permissions = await requestPermissions();
            const sleepPermission = permissions.find((p) =>
                p.permission === "READ_SLEEP"
            );
            const granted = sleepPermission?.granted ?? false;
            const openedSettings = (sleepPermission as any)?.openedSettings ??
                false;

            set({ isConnected: granted });
            return { granted, openedSettings };
        } catch (error) {
            console.error("Error requesting permissions:", error);
            return { granted: false };
        }
    },

    /**
     * Load cached data immediately for instant UI updates
     */
    loadCachedData: async () => {
        try {
            const cached = await loadFromCache();
            if (cached.length > 0) {
                // Convert cached records to SleepData format
                const weeklyHistory: SleepData[] = cached.slice(0, 7).map((
                    r,
                ) => ({
                    id: r.id || `local-${r.date}`,
                    user_id: r.user_id,
                    date: r.date,
                    start_time: r.start_time,
                    end_time: r.end_time,
                    duration_minutes: r.duration_minutes,
                    quality_score: r.quality_score,
                    deep_sleep_minutes: r.deep_sleep_minutes,
                    rem_sleep_minutes: r.rem_sleep_minutes,
                    light_sleep_minutes: r.light_sleep_minutes,
                    awake_minutes: r.awake_minutes,
                    data_source: r.data_source,
                    synced_at: r.synced_at || "",
                }));
                set({ weeklyHistory });
                console.log(
                    `[SleepStore] Loaded ${weeklyHistory.length} records from cache`,
                );
            }
        } catch (error) {
            console.error("[SleepStore] Error loading cached data:", error);
        }
    },

    fetchSleepData: async (userId: string) => {
        if (Platform.OS !== "android" || !get().isConnected) return;

        // Check if we should fetch (cooldown)
        const shouldFetch = await shouldFetchFromHealthConnect();
        if (!shouldFetch) {
            console.log("[SleepStore] Skipping fetch - cooldown active");
            // Still load from cache
            await get().loadCachedData();
            return;
        }

        set({ loading: true });

        try {
            // Get user profile for personalized calculations
            const profile = useProfileStore.getState().profile;

            // Fetch last 8 days from Health Connect
            const now = new Date();
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 8);
            startDate.setHours(0, 0, 0, 0);

            const sessions = await getSleepSessions(
                startDate.toISOString(),
                now.toISOString(),
            );
            console.log(
                `[SleepStore] Fetched ${sessions.length} sessions from Health Connect`,
            );

            // Mark fetch completed
            await markFetchCompleted();

            // Process and cache each session (WITHOUT immediately syncing to Supabase)
            for (const session of sessions) {
                await get().syncToSupabase(userId, session, profile);
            }

            // Set the most recent session
            if (sessions.length > 0) {
                const sorted = [...sessions].sort(
                    (a, b) =>
                        new Date(b.endTime).getTime() -
                        new Date(a.endTime).getTime(),
                );
                set({ lastNightSleep: sorted[0] });
            }

            // Sync to Supabase if cooldown allows
            await get().syncPendingRecords(userId);

            // Load fresh data from cache
            await get().loadCachedData();
        } catch (error) {
            console.error("Error fetching sleep data:", error);
        } finally {
            set({ loading: false });
        }
    },

    /**
     * Process a sleep session and cache it
     * Uses personalized calculations based on user profile
     */
    syncToSupabase: async (
        userId: string,
        session: SleepSession,
        profile: UserProfile | null,
    ) => {
        if (!userId || !session) return;

        try {
            const startDate = new Date(session.startTime);
            const endDate = new Date(session.endTime);
            const date = endDate.toISOString().split("T")[0];
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationMinutes = Math.round(durationMs / 60000);

            // Calculate stage durations from session if available
            let deepMinutes = 0,
                remMinutes = 0,
                lightMinutes = 0,
                awakeMinutes = 0;

            if (session.stages && session.stages.length > 0) {
                for (const stage of session.stages) {
                    const stageStart = new Date(stage.startTime).getTime();
                    const stageEnd = new Date(stage.endTime).getTime();
                    const stageDuration = Math.round(
                        (stageEnd - stageStart) / 60000,
                    );

                    switch (stage.stage) {
                        case 5:
                            deepMinutes += stageDuration;
                            break;
                        case 6:
                            remMinutes += stageDuration;
                            break;
                        case 4:
                            lightMinutes += stageDuration;
                            break;
                        case 1:
                            awakeMinutes += stageDuration;
                            break;
                        case 2:
                            lightMinutes += stageDuration;
                            break;
                        default:
                            lightMinutes += stageDuration;
                            break;
                    }
                }
            }

            // If no stage data, use PERSONALIZED ESTIMATION based on profile
            if (
                deepMinutes + remMinutes + lightMinutes + awakeMinutes === 0 &&
                durationMinutes > 0
            ) {
                const estimated = estimateSleepStages(durationMinutes, profile);
                deepMinutes = estimated.deep;
                remMinutes = estimated.rem;
                lightMinutes = estimated.light;
                awakeMinutes = estimated.awake;
                console.log(
                    `[SleepStore] Personalized stages for ${date}: deep=${deepMinutes}, rem=${remMinutes}, light=${lightMinutes}, awake=${awakeMinutes}`,
                );
            }

            // Calculate quality score
            let qualityScore = 0;
            if (session.stages && session.stages.length > 0) {
                qualityScore = calculateSleepQuality(session);
            } else {
                qualityScore = calculateQualityFromDuration(
                    durationMinutes,
                    profile,
                );
            }

            // Cache the record (will be synced later)
            await upsertCacheRecord({
                user_id: userId,
                date,
                start_time: session.startTime,
                end_time: session.endTime,
                duration_minutes: durationMinutes,
                quality_score: qualityScore,
                deep_sleep_minutes: deepMinutes,
                rem_sleep_minutes: remMinutes,
                light_sleep_minutes: lightMinutes,
                awake_minutes: awakeMinutes,
                data_source: session.metadata?.dataOrigin || "health_connect",
            });
        } catch (error) {
            console.error("Error processing sleep data:", error);
        }
    },

    /**
     * Sync pending records to Supabase (batched)
     * Respects cooldown to avoid excessive calls
     */
    syncPendingRecords: async (userId: string) => {
        const canSync = await shouldSync();
        if (!canSync) {
            console.log(
                "[SleepStore] Skipping Supabase sync - cooldown active",
            );
            return;
        }

        try {
            const pending = await getPendingSyncRecords();
            if (pending.length === 0) {
                console.log("[SleepStore] No pending records to sync");
                return;
            }

            console.log(
                `[SleepStore] Syncing ${pending.length} records to Supabase`,
            );

            // Prepare batch upsert data
            const records = pending.map((r) => ({
                user_id: r.user_id,
                date: r.date,
                start_time: r.start_time,
                end_time: r.end_time,
                duration_minutes: r.duration_minutes,
                quality_score: r.quality_score,
                deep_sleep_minutes: r.deep_sleep_minutes,
                rem_sleep_minutes: r.rem_sleep_minutes,
                light_sleep_minutes: r.light_sleep_minutes,
                awake_minutes: r.awake_minutes,
                data_source: r.data_source,
                synced_at: new Date().toISOString(),
            }));

            // Sync via API (one by one or batch if API supported)
            // Phase 5 API currently supports singular saveLog.
            // For efficiency with existing API, we loop.
            // Ideal: Update API to support batch.
            // For now, loop.

            for (const record of records) {
                await api.post("/api/sleep/log", record);
            }

            // Mark all as synced
            await markRecordsSynced(pending.map((r) => r.date));
            set({ lastSyncTime: Date.now() });
            console.log(
                `[SleepStore] Successfully synced ${pending.length} records via API`,
            );

            // Fetch fresh data from API
            const history = await api.get(`/api/sleep/${userId}/history`);

            if (history) {
                await mergeWithSupabaseData(history);
                set({ weeklyHistory: history });
            }
        } catch (error) {
            console.error("[SleepStore] Error syncing pending records:", error);
        }
    },

    refreshData: async (userId: string) => {
        await get().checkHealthConnectStatus();
        if (get().isConnected) {
            await get().fetchSleepData(userId);
        }
    },
}));

// App state listener for syncing on resume
let appStateSubscription: any = null;

export function initSleepStoreListeners(userId: string | undefined) {
    if (appStateSubscription) {
        appStateSubscription.remove();
    }

    appStateSubscription = AppState.addEventListener(
        "change",
        async (nextAppState: AppStateStatus) => {
            if (nextAppState === "active" && userId) {
                console.log(
                    "[SleepStore] App resumed - checking for pending syncs",
                );
                const store = useSleepStore.getState();
                await store.loadCachedData();
                await store.syncPendingRecords(userId);
            }
        },
    );
}

export function cleanupSleepStoreListeners() {
    if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
    }
}
