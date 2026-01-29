// lib/sleepCache.ts
// Persistent cache layer for sleep data using AsyncStorage
// Reduces Supabase calls and enables offline support

import AsyncStorage from "@react-native-async-storage/async-storage";

// Cache keys
const CACHE_KEYS = {
    SLEEP_DATA: "@sleep_cache:data",
    PENDING_SYNC: "@sleep_cache:pending_sync",
    LAST_SYNC: "@sleep_cache:last_sync",
    LAST_FETCH: "@sleep_cache:last_fetch",
    USER_PATTERNS: "@sleep_cache:user_patterns",
} as const;

// Sync cooldown (30 seconds for testing - change back to 5 * 60 * 1000 for production)
const SYNC_COOLDOWN_MS = 30 * 1000;
// Fetch cooldown (30 seconds for testing - change back to 2 * 60 * 1000 for production)
const FETCH_COOLDOWN_MS = 30 * 1000;
// Cache expiry (24 hours) - when to consider cache stale
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface CachedSleepRecord {
    id?: string;
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
    synced_at?: string;
    cached_at: string;
    needs_sync: boolean;
}

interface CacheMetadata {
    lastSync: number;
    lastFetch: number;
    recordCount: number;
}

/**
 * Load all cached sleep data
 */
export async function loadFromCache(): Promise<CachedSleepRecord[]> {
    try {
        const json = await AsyncStorage.getItem(CACHE_KEYS.SLEEP_DATA);
        if (!json) return [];
        const data = JSON.parse(json) as CachedSleepRecord[];
        console.log(`[SleepCache] Loaded ${data.length} records from cache`);
        return data;
    } catch (error) {
        console.error("[SleepCache] Error loading from cache:", error);
        return [];
    }
}

/**
 * Save sleep data to cache
 */
export async function saveToCache(records: CachedSleepRecord[]): Promise<void> {
    try {
        await AsyncStorage.setItem(
            CACHE_KEYS.SLEEP_DATA,
            JSON.stringify(records),
        );
        console.log(`[SleepCache] Saved ${records.length} records to cache`);
    } catch (error) {
        console.error("[SleepCache] Error saving to cache:", error);
    }
}

/**
 * Add or update a single record in cache
 * Marks it as needing sync if not already synced
 */
export async function upsertCacheRecord(
    record: Omit<CachedSleepRecord, "cached_at" | "needs_sync">,
    needsSync: boolean = true,
): Promise<void> {
    try {
        const existing = await loadFromCache();
        const index = existing.findIndex((r) =>
            r.user_id === record.user_id && r.date === record.date
        );

        const newRecord: CachedSleepRecord = {
            ...record,
            cached_at: new Date().toISOString(),
            needs_sync: needsSync,
        };

        if (index >= 0) {
            // Only update if data changed
            const old = existing[index];
            if (
                old.duration_minutes !== record.duration_minutes ||
                old.quality_score !== record.quality_score
            ) {
                existing[index] = newRecord;
                console.log(`[SleepCache] Updated record for ${record.date}`);
            }
        } else {
            existing.unshift(newRecord);
            console.log(`[SleepCache] Added new record for ${record.date}`);
        }

        // Keep only last 30 days of data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const filtered = existing.filter((r) =>
            new Date(r.date) >= thirtyDaysAgo
        );

        await saveToCache(filtered);
    } catch (error) {
        console.error("[SleepCache] Error upserting record:", error);
    }
}

/**
 * Get records that need to be synced to Supabase
 */
export async function getPendingSyncRecords(): Promise<CachedSleepRecord[]> {
    try {
        const all = await loadFromCache();
        return all.filter((r) => r.needs_sync);
    } catch (error) {
        console.error(
            "[SleepCache] Error getting pending sync records:",
            error,
        );
        return [];
    }
}

/**
 * Mark records as synced (after successful Supabase upload)
 */
export async function markRecordsSynced(dates: string[]): Promise<void> {
    try {
        const all = await loadFromCache();
        const updated = all.map((r) =>
            dates.includes(r.date)
                ? {
                    ...r,
                    needs_sync: false,
                    synced_at: new Date().toISOString(),
                }
                : r
        );
        await saveToCache(updated);
        await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
        console.log(`[SleepCache] Marked ${dates.length} records as synced`);
    } catch (error) {
        console.error("[SleepCache] Error marking records synced:", error);
    }
}

/**
 * Check if we should sync to Supabase (cooldown check)
 */
export async function shouldSync(): Promise<boolean> {
    try {
        const lastSyncStr = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
        if (!lastSyncStr) return true;

        const lastSync = parseInt(lastSyncStr, 10);
        const elapsed = Date.now() - lastSync;
        return elapsed >= SYNC_COOLDOWN_MS;
    } catch (error) {
        return true; // Sync if we can't determine
    }
}

/**
 * Check if we should fetch from Health Connect (cooldown check)
 */
export async function shouldFetchFromHealthConnect(): Promise<boolean> {
    try {
        const lastFetchStr = await AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH);
        if (!lastFetchStr) return true;

        const lastFetch = parseInt(lastFetchStr, 10);
        const elapsed = Date.now() - lastFetch;
        return elapsed >= FETCH_COOLDOWN_MS;
    } catch (error) {
        return true;
    }
}

/**
 * Mark that we just fetched from Health Connect
 */
export async function markFetchCompleted(): Promise<void> {
    try {
        await AsyncStorage.setItem(
            CACHE_KEYS.LAST_FETCH,
            Date.now().toString(),
        );
    } catch (error) {
        console.error("[SleepCache] Error marking fetch completed:", error);
    }
}

/**
 * Get cache metadata for debugging/monitoring
 */
export async function getCacheMetadata(): Promise<CacheMetadata> {
    try {
        const [lastSyncStr, lastFetchStr, data] = await Promise.all([
            AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC),
            AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH),
            loadFromCache(),
        ]);

        return {
            lastSync: lastSyncStr ? parseInt(lastSyncStr, 10) : 0,
            lastFetch: lastFetchStr ? parseInt(lastFetchStr, 10) : 0,
            recordCount: data.length,
        };
    } catch (error) {
        return { lastSync: 0, lastFetch: 0, recordCount: 0 };
    }
}

/**
 * Check if cache is stale (older than expiry time)
 */
export async function isCacheStale(): Promise<boolean> {
    try {
        const data = await loadFromCache();
        if (data.length === 0) return true;

        const mostRecent = data.reduce((latest, r) => {
            const cachedAt = new Date(r.cached_at).getTime();
            return cachedAt > latest ? cachedAt : latest;
        }, 0);

        return Date.now() - mostRecent > CACHE_EXPIRY_MS;
    } catch (error) {
        return true;
    }
}

/**
 * Clear all cache (for debugging or logout)
 */
export async function clearCache(): Promise<void> {
    try {
        await Promise.all([
            AsyncStorage.removeItem(CACHE_KEYS.SLEEP_DATA),
            AsyncStorage.removeItem(CACHE_KEYS.PENDING_SYNC),
            AsyncStorage.removeItem(CACHE_KEYS.LAST_SYNC),
            AsyncStorage.removeItem(CACHE_KEYS.LAST_FETCH),
            AsyncStorage.removeItem(CACHE_KEYS.USER_PATTERNS),
        ]);
        console.log("[SleepCache] Cache cleared");
    } catch (error) {
        console.error("[SleepCache] Error clearing cache:", error);
    }
}

/**
 * Merge cached data with fresh Supabase data
 * Prefers Supabase data for synced records, keeps local for unsynced
 */
export async function mergeWithSupabaseData(
    supabaseRecords: Array<{
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
    }>,
): Promise<CachedSleepRecord[]> {
    try {
        const cached = await loadFromCache();
        const merged: Map<string, CachedSleepRecord> = new Map();

        // Add all Supabase records (these are the source of truth for synced data)
        for (const record of supabaseRecords) {
            merged.set(record.date, {
                ...record,
                cached_at: new Date().toISOString(),
                needs_sync: false,
            });
        }

        // Add cached records that aren't in Supabase (pending sync)
        for (const record of cached) {
            if (record.needs_sync && !merged.has(record.date)) {
                merged.set(record.date, record);
            }
        }

        const result = Array.from(merged.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        await saveToCache(result);
        return result;
    } catch (error) {
        console.error("[SleepCache] Error merging with Supabase data:", error);
        return supabaseRecords.map((r) => ({
            ...r,
            cached_at: new Date().toISOString(),
            needs_sync: false,
        }));
    }
}
