import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  calculateSleepQuality,
  checkPermissions,
  getSleepSessions,
  isAvailable,
  requestPermissions,
  SleepSession,
} from '../modules/health-connect';
import {
  CachedSleepRecord,
  getPendingSyncRecords,
  loadFromCache,
  markFetchCompleted,
  markRecordsSynced,
  mergeAllSources,
  resetCooldowns,
  shouldFetchFromHealthConnect,
  shouldSync,
  upsertCacheRecord,
} from '../lib/sleepCache';
import { calculateQualityFromDuration, estimateSleepStages } from '../lib/sleepCalculations';
import { useProfileStore, UserProfile } from './profileStore';
import { api } from '@lib/api';
import { calculateSleepScore as calculateDynamicSleepScore } from '@lib/sleepAnalysis';
import type { ScoreBreakdown, SleepRecord, UserProfile as SleepEngineUserProfile } from '@shared';

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
  sleep_score?: number;
  score_breakdown?: ScoreBreakdown;
  source?: string;
  confidence?: string;
  data_source: string;
  synced_at: string;
}

interface SleepState {
  isAvailable: boolean;
  isConnected: boolean;
  checkingStatus: boolean;
  lastNightSleep: SleepSession | null;
  recentHistory: SleepData[];
  monthlyData: Partial<Record<string, SleepData[]>>; // CACHE: "YYYY-MM" -> Records
  loading: boolean;
  lastSyncTime: number;
  lastCloudFetchTime: number;

  checkHealthConnectStatus: () => Promise<void>;
  requestHealthPermissions: () => Promise<{ granted: boolean; openedSettings?: boolean }>;
  fetchSleepData: (userId: string, forceRefresh?: boolean) => Promise<void>;
  fetchMonthHistory: (userId: string, year: number, month: number) => Promise<void>;
  fetchSleepDataRange: (userId: string, startDate: Date, endDate: Date) => Promise<void>;
  syncToSupabase: (
    userId: string,
    session: SleepSession,
    profile: UserProfile | null
  ) => Promise<void>;
  refreshData: (userId: string, forceRefresh?: boolean) => Promise<void>;
  loadCachedData: () => Promise<void>;
  syncPendingRecords: (userId: string) => Promise<void>;
  // NEW: Force save a manual sleep entry directly to database
  forceSaveManualSleep: (userId: string, startTime: string, endTime: string) => Promise<boolean>;
}

const inFlightRanges = new Set<string>();
const MAX_CACHED_MONTHS = 4;

function evictOldMonths(
  data: Partial<Record<string, SleepData[]>>
): Partial<Record<string, SleepData[]>> {
  const keys = Object.keys(data).sort().reverse();
  if (keys.length <= MAX_CACHED_MONTHS) return data;
  const evicted = { ...data };
  keys.slice(MAX_CACHED_MONTHS).forEach((k) => delete evicted[k]);
  return evicted;
}

function toSleepEngineProfile(profile: UserProfile | null): SleepEngineUserProfile {
  if (!profile) return { sleepGoalMinutes: 480 };

  let age: number | undefined;
  const dob = profile.date_of_birth || profile.birth_date;
  if (dob) {
    const dobDate = new Date(dob);
    if (!Number.isNaN(dobDate.getTime())) {
      const now = new Date();
      age = now.getFullYear() - dobDate.getFullYear();
      const monthDiff = now.getMonth() - dobDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dobDate.getDate())) {
        age -= 1;
      }
    }
  }

  const chronotypeMap: Record<string, SleepEngineUserProfile['chronotype']> = {
    sedentary: 'evening',
    light: 'intermediate',
    moderate: 'intermediate',
    active: 'morning',
    very_active: 'morning',
  };

  const profileWithGoal = profile as UserProfile & { sleep_goal_minutes?: number };

  return {
    age,
    chronotype: chronotypeMap[profile.activity_level ?? 'moderate'] ?? 'intermediate',
    sleepGoalMinutes: profileWithGoal.sleep_goal_minutes ?? 480,
  };
}

function toSleepRecord(record: SleepData): SleepRecord {
  return {
    id: record.id,
    date: record.date,
    startTime: record.start_time || null,
    endTime: record.end_time || null,
    durationMinutes: record.duration_minutes ?? null,
    deepSleepMinutes: record.deep_sleep_minutes ?? null,
    remSleepMinutes: record.rem_sleep_minutes ?? null,
    lightSleepMinutes: record.light_sleep_minutes ?? null,
    awakeSleepMinutes: record.awake_minutes ?? null,
    source:
      (record.source as SleepRecord['source']) ||
      (record.data_source as SleepRecord['source']) ||
      'manual',
    confidence: (record.confidence as SleepRecord['confidence']) || 'medium',
    estimatedBedtime: null,
    estimatedWakeup: null,
    screenTimeSummary: null,
  };
}

async function scoreAndPersistRecords(
  records: SleepData[],
  profile: UserProfile | null
): Promise<SleepData[]> {
  const sleepProfile = toSleepEngineProfile(profile);
  const scored = records.map((record, index) => {
    const history = records.slice(index + 1).map(toSleepRecord);
    const result = calculateDynamicSleepScore({
      current: toSleepRecord(record),
      history,
      userProfile: sleepProfile,
    });

    return {
      ...record,
      sleep_score: result.sleepScore,
      score_breakdown: result.scoreBreakdown,
    };
  });

  const persistable = scored.filter((record) => {
    return (
      Boolean(record.id) && !record.id.startsWith('local-') && !record.id.startsWith('manual-')
    );
  });

  const updates = persistable.map((record) => ({
    id: record.id,
    sleep_score: record.sleep_score,
    score_breakdown: record.score_breakdown,
  }));

  if (updates.length > 0) {
    try {
      const { error } = await supabase.from('sleep_data').upsert(updates, { onConflict: 'id' });
      if (error) {
        console.warn(`[SleepStore] Batch score persist failed: ${error.message}`);
      }
    } catch (error) {
      console.warn('[SleepStore] Error batch persisting scores', error);
    }
  }

  return scored;
}

export const useSleepStore = create<SleepState>((set, get) => ({
  isAvailable: false,
  isConnected: false,
  checkingStatus: true,
  lastNightSleep: null,
  recentHistory: [],
  monthlyData: {},
  loading: false,
  lastSyncTime: 0,
  lastCloudFetchTime: 0,

  checkHealthConnectStatus: async () => {
    if (Platform.OS !== 'android') {
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
        const sleepPermission = permissions.find((p) => p.permission === 'READ_SLEEP');
        set({ isConnected: sleepPermission?.granted ?? false });
      }
    } catch (error) {
      console.error('Error checking Health Connect status:', error);
      set({ isAvailable: false, isConnected: false });
    } finally {
      set({ checkingStatus: false });
    }
  },

  requestHealthPermissions: async () => {
    if (Platform.OS !== 'android') return { granted: false };

    try {
      const permissions = await requestPermissions();
      const sleepPermission = permissions.find((p) => p.permission === 'READ_SLEEP');
      const granted = sleepPermission?.granted ?? false;
      const openedSettings = (sleepPermission as any)?.openedSettings ?? false;

      set({ isConnected: granted });
      return { granted, openedSettings };
    } catch (error) {
      console.error('Error requesting permissions:', error);
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
        const recentHistory: SleepData[] = cached.slice(0, 7).map((r: CachedSleepRecord) => ({
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
          sleep_score: r.sleep_score,
          score_breakdown: r.score_breakdown as ScoreBreakdown,
          source: r.source,
          confidence: r.confidence,
          data_source: r.data_source,
          synced_at: r.synced_at || '',
        }));
        set({ recentHistory });
        console.log(`[SleepStore] Loaded ${recentHistory.length} records from cache`);
      }
    } catch (error) {
      console.error('[SleepStore] Error loading cached data:', error);
    }
  },

  fetchSleepData: async (userId: string, forceRefresh = false) => {
    inFlightRanges.clear();

    // Check if we should fetch (cooldown) - non-Android continues to cloud fetch
    const shouldFetchHC = Platform.OS === 'android' && get().isConnected;
    const shouldFetch = shouldFetchHC ? await shouldFetchFromHealthConnect() : true;

    if (!shouldFetch && shouldFetchHC) {
      console.log('[SleepStore] Skipping HC fetch - cooldown active');
      await get().loadCachedData();
      return;
    }

    set({ loading: true });

    try {
      const CLOUD_COOLDOWN_MS = 2 * 60 * 1000;
      const nowTs = Date.now();
      const lastCloud = get().lastCloudFetchTime;
      const shouldFetchCloud = nowTs - lastCloud > CLOUD_COOLDOWN_MS;
      if (!shouldFetchCloud && !forceRefresh) {
        console.log('[SleepStore] Skipping cloud fetch - cooldown active');
        await get().loadCachedData();
        set({ loading: false });
        return;
      }

      const profile = useProfileStore.getState().profile;
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 8);
      startDate.setHours(0, 0, 0, 0);

      // ============================================================
      // 3-WAY MERGE: Fetch from all sources in parallel
      // ============================================================

      // 1. Fetch Cloud history
      let cloudRecords: SleepData[] = [];
      try {
        const historyResponse = await api.get(`/api/sleep/${userId}/history?limit=30`, {
          params: {
            start_date: startDate.toISOString().split('T')[0],
            end_date: now.toISOString().split('T')[0],
            limit: 30,
          },
        });
        cloudRecords = historyResponse?.data || historyResponse || [];
        console.log(`[SleepStore] Fetched ${cloudRecords.length} records from Cloud`);
        set({ lastCloudFetchTime: Date.now() });
      } catch (cloudError) {
        console.warn('[SleepStore] Cloud fetch failed, continuing with local data', cloudError);
      }

      // 2. Fetch Health Connect (Android only)
      let hcRecords: CachedSleepRecord[] = [];
      if (shouldFetchHC) {
        const sessions = await getSleepSessions(startDate.toISOString(), now.toISOString());
        console.log(`[SleepStore] Fetched ${sessions.length} sessions from Health Connect`);
        await markFetchCompleted();

        // Convert HC sessions to CachedSleepRecord format
        for (const session of sessions) {
          const endDate = new Date(session.endTime);
          const date = endDate.toISOString().split('T')[0];
          const durationMs = endDate.getTime() - new Date(session.startTime).getTime();
          const durationMinutes = Math.round(durationMs / 60000);

          let deepMinutes = 0,
            remMinutes = 0,
            lightMinutes = 0,
            awakeMinutes = 0;
          const hasStages = session.stages && session.stages.length > 0;

          if (hasStages) {
            for (const stage of session.stages) {
              const stageDuration = Math.round(
                (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / 60000
              );
              switch (stage.stage) {
                case 5:
                  deepMinutes += stageDuration;
                  break;
                case 6:
                  remMinutes += stageDuration;
                  break;
                case 4:
                case 2:
                  lightMinutes += stageDuration;
                  break;
                case 1:
                  awakeMinutes += stageDuration;
                  break;
                default:
                  lightMinutes += stageDuration;
                  break;
              }
            }
          } else if (durationMinutes > 0) {
            const estimated = estimateSleepStages(durationMinutes, profile);
            deepMinutes = estimated.deep;
            remMinutes = estimated.rem;
            lightMinutes = estimated.light;
            awakeMinutes = estimated.awake;
          }

          const qualityScore = hasStages
            ? calculateSleepQuality(session)
            : calculateQualityFromDuration(durationMinutes, profile);

          hcRecords.push({
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
            data_source: session.metadata?.dataOrigin || 'health_connect',
            source: 'health_connect' as any,
            confidence: hasStages ? 'high' : 'medium',
            cached_at: new Date().toISOString(),
            needs_sync: true,
          });
        }

        // Set most recent session
        if (sessions.length > 0) {
          const sorted = [...sessions].sort(
            (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
          );
          set({ lastNightSleep: sorted[0] });
        }
      }

      // 3. Load local cache
      const cachedRecords = await loadFromCache();
      console.log(`[SleepStore] Loaded ${cachedRecords.length} records from Cache`);

      // 4. Merge all sources with conflict resolution
      const merged = await mergeAllSources(cloudRecords, hcRecords, cachedRecords);
      console.log(`[SleepStore] Merged result: ${merged.length} unique records`);

      // 5. Update UI immediately
      const recentHistory: SleepData[] = merged.slice(0, 30).map((r) => ({
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
        sleep_score: r.sleep_score,
        score_breakdown: r.score_breakdown as ScoreBreakdown,
        source: r.source,
        confidence: r.confidence,
        data_source: r.data_source,
        synced_at: r.synced_at || '',
      }));
      const scoredRecentHistory = await scoreAndPersistRecords(recentHistory, profile);
      const map: Partial<Record<string, SleepData[]>> = {};
      // Populate monthly data from weekly fetch as well
      scoredRecentHistory.forEach((r) => {
        const monthKey = r.date.substring(0, 7); // YYYY-MM
        if (!map[monthKey]) map[monthKey] = [];
        map[monthKey].push(r);
      });

      set({
        recentHistory: scoredRecentHistory,
        monthlyData: evictOldMonths({ ...get().monthlyData, ...map }),
      });

      // 6. Sync HC-only records to cloud
      await get().syncPendingRecords(userId);
    } catch (error) {
      console.error('Error fetching sleep data:', error);
      // Fallback to cache on error
      await get().loadCachedData();
    } finally {
      set({ loading: false });
    }
  },

  fetchMonthHistory: async (userId: string, year: number, month: number) => {
    // month is 0-indexed (0 = Jan)
    const key = `${year}-${(month + 1).toString().padStart(2, '0')}`;

    // If we already have data for this month and it's not the current month, maybe skip?
    // But user might want fresh info. Let's fetch.

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    try {
      console.log(`[SleepStore] Fetching month history for ${key}`);
      const profile = useProfileStore.getState().profile;
      const response = await api.get(`/api/sleep/${userId}/history`, {
        params: {
          start_date: startStr,
          end_date: endStr,
          limit: 35, // Max days in month + buffer
        },
      });

      const records: SleepData[] = response?.data || response || [];
      if (records.length > 0) {
        const scoredRecords = await scoreAndPersistRecords(records, profile);
        set((state) => ({
          monthlyData: evictOldMonths({
            ...state.monthlyData,
            [key]: scoredRecords,
          }),
        }));
      }
    } catch (error) {
      console.error(`[SleepStore] Failed to fetch month history for ${key}`, error);
    }
  },

  fetchSleepDataRange: async (userId: string, startDate: Date, endDate: Date) => {
    if (!userId) return;

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const key = `${startStr}|${endStr}`;

    if (inFlightRanges.has(key)) return;
    inFlightRanges.add(key);

    try {
      const profile = useProfileStore.getState().profile;
      const response = await api.get(`/api/sleep/${userId}/history`, {
        params: {
          start_date: startStr,
          end_date: endStr,
          limit: 35,
        },
      });

      const records: SleepData[] = response?.data || response || [];
      if (records.length === 0) return;
      const scoredRecords = await scoreAndPersistRecords(records, profile);

      const monthMap: Partial<Record<string, SleepData[]>> = {};
      scoredRecords.forEach((r) => {
        const monthKey = r.date.substring(0, 7);
        if (!monthMap[monthKey]) monthMap[monthKey] = [];
        monthMap[monthKey].push(r);
      });

      set((state) => {
        const mergedMonthly = { ...state.monthlyData };
        Object.keys(monthMap).forEach((monthKey) => {
          const existing = mergedMonthly[monthKey] || [];
          const monthRecords = monthMap[monthKey] || [];
          const merged = new Map<string, SleepData>();
          existing.forEach((r) => merged.set(r.date, r));
          monthRecords.forEach((r) => merged.set(r.date, r));
          mergedMonthly[monthKey] = Array.from(merged.values());
        });

        const weeklyMap = new Map<string, SleepData>();
        state.recentHistory.forEach((r) => weeklyMap.set(r.date, r));
        scoredRecords.forEach((r) => weeklyMap.set(r.date, r));
        const recentHistory = Array.from(weeklyMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return {
          monthlyData: evictOldMonths(mergedMonthly),
          recentHistory: recentHistory.slice(0, 30),
        };
      });
    } catch (error) {
      console.error('[SleepStore] Failed to fetch range history', error);
    } finally {
      inFlightRanges.delete(key);
    }
  },

  /**
   * Process a sleep session and cache it
   * Uses personalized calculations based on user profile
   */
  syncToSupabase: async (userId: string, session: SleepSession, profile: UserProfile | null) => {
    if (!userId || !session) return;

    try {
      const startDate = new Date(session.startTime);
      const endDate = new Date(session.endTime);
      const date = endDate.toISOString().split('T')[0];
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
          const stageDuration = Math.round((stageEnd - stageStart) / 60000);

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
      if (deepMinutes + remMinutes + lightMinutes + awakeMinutes === 0 && durationMinutes > 0) {
        const estimated = estimateSleepStages(durationMinutes, profile);
        deepMinutes = estimated.deep;
        remMinutes = estimated.rem;
        lightMinutes = estimated.light;
        awakeMinutes = estimated.awake;
        console.log(
          `[SleepStore] Personalized stages for ${date}: deep=${deepMinutes}, rem=${remMinutes}, light=${lightMinutes}, awake=${awakeMinutes}`
        );
      }

      // Calculate quality score
      let qualityScore = 0;
      if (session.stages && session.stages.length > 0) {
        qualityScore = calculateSleepQuality(session);
      } else {
        qualityScore = calculateQualityFromDuration(durationMinutes, profile);
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
        data_source: session.metadata?.dataOrigin || 'health_connect',
        source: 'health_connect',
        confidence: session.stages && session.stages.length > 0 ? 'high' : 'medium',
      });
    } catch (error) {
      console.error('Error processing sleep data:', error);
    }
  },

  /**
   * Sync pending records to Supabase (batched)
   * Respects cooldown to avoid excessive calls
   */
  syncPendingRecords: async (userId: string) => {
    const canSync = await shouldSync();
    if (!canSync) {
      console.log('[SleepStore] Skipping Supabase sync - cooldown active');
      return;
    }

    try {
      const pending = await getPendingSyncRecords();
      if (pending.length === 0) {
        console.log('[SleepStore] No pending records to sync');
        return;
      }

      console.log(`[SleepStore] Syncing ${pending.length} records to Supabase via batch`);

      // Prepare batch upsert data (max 30 per batch)
      const records = pending.slice(0, 30).map((r: CachedSleepRecord) => ({
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
      }));

      // Use batch sync API for efficiency
      const result = await api.post('/api/sleep/sync-batch', {
        user_id: userId,
        records,
      });

      const synced = result?.data?.synced || records.length;
      console.log(`[SleepStore] Batch sync complete: ${synced} synced`);

      // Mark synced records
      await markRecordsSynced(records.map((r) => r.date));
      set({ lastSyncTime: Date.now() });

      // If there are more pending records, schedule another sync
      if (pending.length > 30) {
        console.log(
          `[SleepStore] ${pending.length - 30} records remaining, will sync on next cycle`
        );
      }
    } catch (error) {
      console.error('[SleepStore] Error syncing pending records:', error);
      // Fallback to individual sync on batch failure
      try {
        const pending = await getPendingSyncRecords();
        for (const record of pending.slice(0, 10)) {
          await api.post('/api/sleep/log', {
            user_id: record.user_id,
            date: record.date,
            start_time: record.start_time,
            end_time: record.end_time,
            duration_minutes: record.duration_minutes,
            quality_score: record.quality_score,
            deep_sleep_minutes: record.deep_sleep_minutes,
            rem_sleep_minutes: record.rem_sleep_minutes,
            light_sleep_minutes: record.light_sleep_minutes,
            awake_minutes: record.awake_minutes,
            data_source: record.data_source,
          });
          await markRecordsSynced([record.date]);
        }
        console.log('[SleepStore] Fallback individual sync completed');
      } catch (fallbackError) {
        console.error('[SleepStore] Fallback sync also failed:', fallbackError);
      }
    }
  },

  refreshData: async (userId: string, forceRefresh = false) => {
    // Reset cooldowns if force refresh requested (e.g., pull-to-refresh)
    if (forceRefresh) {
      console.log('[SleepStore] Force refresh - bypassing cooldowns');
      await resetCooldowns();
    }

    await get().checkHealthConnectStatus();
    await get().fetchSleepData(userId, forceRefresh);
  },

  /**
   * Force save a manual sleep entry directly to database
   * Bypasses all cooldowns for immediate sync
   */
  forceSaveManualSleep: async (
    userId: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> => {
    if (!userId) return false;
    const previousRecentHistory = get().recentHistory;
    const previousMonthlyData = get().monthlyData;

    try {
      const profile = useProfileStore.getState().profile;
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const date = endDate.toISOString().split('T')[0];
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      const estimated = estimateSleepStages(durationMinutes, profile);
      const qualityScore = calculateQualityFromDuration(durationMinutes, profile);

      const dynamicScoreResult = calculateDynamicSleepScore({
        current: {
          id: `manual-${date}`,
          date,
          startTime,
          endTime,
          durationMinutes,
          deepSleepMinutes: estimated.deep,
          remSleepMinutes: estimated.rem,
          lightSleepMinutes: estimated.light,
          awakeSleepMinutes: estimated.awake,
          source: 'manual',
          confidence: 'low',
          estimatedBedtime: startTime,
          estimatedWakeup: endTime,
          screenTimeSummary: null,
        },
        history: [],
        userProfile: toSleepEngineProfile(profile),
      });

      const sleepRecord: SleepData = {
        id: `manual-${date}-${Date.now()}`,
        user_id: userId,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        quality_score: qualityScore,
        deep_sleep_minutes: estimated.deep,
        rem_sleep_minutes: estimated.rem,
        light_sleep_minutes: estimated.light,
        awake_minutes: estimated.awake,
        sleep_score: dynamicScoreResult.sleepScore,
        score_breakdown: dynamicScoreResult.scoreBreakdown,
        source: 'manual',
        confidence: 'low',
        data_source: 'manual',
        synced_at: new Date().toISOString(),
      };

      console.log('[SleepStore] Force saving manual sleep:', sleepRecord);

      // 1. OPTIMISTIC UI UPDATE - show immediately
      set((state) => {
        const existingIndex = state.recentHistory.findIndex((r) => r.date === date);
        const updated = [...state.recentHistory];
        if (existingIndex >= 0) {
          updated[existingIndex] = sleepRecord;
        } else {
          updated.unshift(sleepRecord);
          updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        const monthKey = date.substring(0, 7);
        const monthExisting = state.monthlyData[monthKey] || [];
        const monthMap = new Map<string, SleepData>();
        monthExisting.forEach((r) => monthMap.set(r.date, r));
        monthMap.set(date, sleepRecord);

        return {
          recentHistory: updated.slice(0, 30),
          monthlyData: evictOldMonths({
            ...state.monthlyData,
            [monthKey]: Array.from(monthMap.values()),
          }),
        };
      });

      // 2. Save to API - use 'source' field for validation schema
      // Exclude 'id' and 'synced_at' as Supabase auto-generates these
      const { id: _id, synced_at: _synced, ...apiPayload } = sleepRecord;
      await api.post('/api/sleep/log', {
        ...apiPayload,
        source: 'manual', // Backend validation expects this enum value
        confidence: 'low',
      });

      // 3. Update cache (already synced)
      await upsertCacheRecord(
        {
          ...sleepRecord,
          source: 'manual' as any,
          confidence: 'low',
        },
        false
      );
      await markRecordsSynced([date]);

      console.log('[SleepStore] Manual sleep saved successfully');
      return true;
    } catch (error) {
      console.error('[SleepStore] Error force saving manual sleep:', error);
      set({
        recentHistory: previousRecentHistory,
        monthlyData: previousMonthlyData,
      });
      return false;
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
    'change',
    async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && userId) {
        console.log('[SleepStore] App resumed - checking for pending syncs');
        const store = useSleepStore.getState();
        await store.loadCachedData();
        await store.syncPendingRecords(userId);
      }
    }
  );
}

export function cleanupSleepStoreListeners() {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}
