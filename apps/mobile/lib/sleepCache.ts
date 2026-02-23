// lib/sleepCache.ts
// Persistent cache layer for sleep data using AsyncStorage
// Supports offline-first with provenance tracking and score breakdown

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ConfidenceLevel,
  DataSource,
  ScreenTimeSummary,
  SleepEditRecord,
} from './sleepCalculations';
import type { ScoreBreakdown } from '@shared';

// ============================================================================
// CACHE KEYS
// ============================================================================

const CACHE_KEYS = {
    SLEEP_DATA: "@sleep_cache:data",
    PENDING_SYNC: "@sleep_cache:pending_sync",
    LAST_SYNC: "@sleep_cache:last_sync",
    LAST_FETCH: "@sleep_cache:last_fetch",
    USER_PATTERNS: "@sleep_cache:user_patterns",
    UPLOAD_CONSENT: "@sleep_cache:upload_consent",
} as const;

// ============================================================================
// COOLDOWNS AND RETENTION
// ============================================================================

// Sync cooldown (30 seconds for testing - change to 5 * 60 * 1000 for production)
const SYNC_COOLDOWN_MS = 30 * 1000;
// Fetch cooldown (30 seconds for testing - change to 2 * 60 * 1000 for production)
const FETCH_COOLDOWN_MS = 30 * 1000;
// Cache expiry (24 hours) - when to consider cache stale
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
// Raw data retention (90 days default)
const RAW_DATA_RETENTION_DAYS = 90;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Extended cached sleep record with full provenance
 */
export interface CachedSleepRecord {
    // Identifiers
    id?: string;
    session_id?: string;
    user_id: string;
    date: string;

    // Core sleep data
    start_time: string;
    end_time: string;
    duration_minutes: number;
    quality_score: number;

    // Sleep stages
    deep_sleep_minutes: number;
    rem_sleep_minutes: number;
    light_sleep_minutes: number;
    awake_minutes: number;

    // NEW: Deterministic scoring
    sleep_score?: number;
    score_breakdown?: SleepScoreBreakdown;

    // NEW: Provenance tracking
    source: DataSource;
    confidence: ConfidenceLevel;

    // NEW: Estimation data
    estimated_bedtime?: string;
    estimated_wakeup?: string;
    screen_time_summary?: ScreenTimeSummary;

    // NEW: Edit history
    edits?: SleepEditRecord[];

    // Legacy fields (kept for compatibility)
    data_source: string;
    synced_at?: string;

    // Cache metadata
    cached_at: string;
    needs_sync: boolean;
}

interface CacheMetadata {
    lastSync: number;
    lastFetch: number;
    recordCount: number;
}

// ============================================================================
// UPLOAD CONSENT
// ============================================================================

/**
 * Check if user has consented to cloud sync
 */
export async function hasUploadConsent(): Promise<boolean> {
    try {
        const consent = await AsyncStorage.getItem(CACHE_KEYS.UPLOAD_CONSENT);
        return consent === "true";
    } catch (error) {
        return false;
    }
}

/**
 * Set user's upload consent preference
 */
export async function setUploadConsent(consent: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(
            CACHE_KEYS.UPLOAD_CONSENT,
            consent ? "true" : "false",
        );
        console.log(`[SleepCache] Upload consent set to: ${consent}`);
    } catch (error) {
        console.error("[SleepCache] Error setting upload consent:", error);
    }
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

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
                old.quality_score !== record.quality_score ||
                old.sleep_score !== record.sleep_score
            ) {
                existing[index] = newRecord;
                console.log(`[SleepCache] Updated record for ${record.date}`);
            }
        } else {
            existing.unshift(newRecord);
            console.log(`[SleepCache] Added new record for ${record.date}`);
        }

        // Apply retention policy
        const retentionDate = new Date();
        retentionDate.setDate(
            retentionDate.getDate() - RAW_DATA_RETENTION_DAYS,
        );
        const filtered = existing.filter((r) =>
            new Date(r.date) >= retentionDate
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
        // Check consent first
        const hasConsent = await hasUploadConsent();
        if (!hasConsent) {
            console.log("[SleepCache] No upload consent - skipping sync");
            return [];
        }

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
 * Update a record with edit information
 */
export async function updateRecordWithEdit(
    date: string,
    userId: string,
    editReason: string,
    updates: Partial<CachedSleepRecord>,
): Promise<boolean> {
    try {
        const all = await loadFromCache();
        const index = all.findIndex((r) =>
            r.date === date && r.user_id === userId
        );

        if (index < 0) {
            console.warn(`[SleepCache] Record not found for edit: ${date}`);
            return false;
        }

        const oldRecord = all[index];
        const editRecord: SleepEditRecord = {
            edited_at: new Date().toISOString(),
            edited_by: userId,
            edit_reason: editReason,
            prev_record: {
                start_time: oldRecord.start_time,
                end_time: oldRecord.end_time,
                duration_minutes: oldRecord.duration_minutes,
                sleep_score: oldRecord.sleep_score,
            },
        };

        const existingEdits = oldRecord.edits || [];
        // Keep only last 10 edits to prevent bloat
        const edits = [...existingEdits, editRecord].slice(-10);

        all[index] = {
            ...oldRecord,
            ...updates,
            edits,
            cached_at: new Date().toISOString(),
            needs_sync: true,
        };

        await saveToCache(all);
        console.log(`[SleepCache] Updated record with edit for ${date}`);
        return true;
    } catch (error) {
        console.error("[SleepCache] Error updating record with edit:", error);
        return false;
    }
}

// ============================================================================
// COOLDOWN CHECKS
// ============================================================================

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
        return true;
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
 * Reset all cooldowns (for force refresh)
 */
export async function resetCooldowns(): Promise<void> {
    try {
        await Promise.all([
            AsyncStorage.removeItem(CACHE_KEYS.LAST_FETCH),
            AsyncStorage.removeItem(CACHE_KEYS.LAST_SYNC),
        ]);
        console.log("[SleepCache] Cooldowns reset");
    } catch (error) {
        console.error("[SleepCache] Error resetting cooldowns:", error);
    }
}

// ============================================================================
// CACHE METADATA AND MAINTENANCE
// ============================================================================

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
            // Note: We don't clear upload consent on cache clear
        ]);
        console.log("[SleepCache] Cache cleared");
    } catch (error) {
        console.error("[SleepCache] Error clearing cache:", error);
    }
}

/**
 * Purge all user data (for account deletion)
 */
export async function purgeAllUserData(): Promise<void> {
    try {
        await Promise.all([
            AsyncStorage.removeItem(CACHE_KEYS.SLEEP_DATA),
            AsyncStorage.removeItem(CACHE_KEYS.PENDING_SYNC),
            AsyncStorage.removeItem(CACHE_KEYS.LAST_SYNC),
            AsyncStorage.removeItem(CACHE_KEYS.LAST_FETCH),
            AsyncStorage.removeItem(CACHE_KEYS.USER_PATTERNS),
            AsyncStorage.removeItem(CACHE_KEYS.UPLOAD_CONSENT),
        ]);
        console.log("[SleepCache] All user data purged");
    } catch (error) {
        console.error("[SleepCache] Error purging user data:", error);
    }
}

// ============================================================================
// DATA MERGING
// ============================================================================

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
        sleep_score?: number;
        score_breakdown?: SleepScoreBreakdown;
        source?: string;
        confidence?: string;
        estimated_bedtime?: string;
        estimated_wakeup?: string;
        screen_time_summary?: ScreenTimeSummary;
        edits?: SleepEditRecord[];
        data_source: string;
        synced_at: string;
    }>,
): Promise<CachedSleepRecord[]> {
    try {
        const cached = await loadFromCache();
        const merged: Map<string, CachedSleepRecord> = new Map();

        // Add all Supabase records (source of truth for synced data)
        for (const record of supabaseRecords) {
            merged.set(record.date, {
                ...record,
                source: (record.source as DataSource) || "health_connect",
                confidence: (record.confidence as ConfidenceLevel) || "medium",
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
            source: (r.source as DataSource) || "health_connect",
            confidence: (r.confidence as ConfidenceLevel) || "medium",
            cached_at: new Date().toISOString(),
            needs_sync: false,
        }));
    }
}

/**
 * CONFLICT PRIORITY:
 * 1. Manual entries (data_source="manual_entry" or source="manual")
 * 2. Health Connect high confidence (source="health_connect" + confidence="high")
 * 3. Cloud/Supabase records
 * 4. Estimated/low confidence records
 */
function getRecordPriority(record: Partial<CachedSleepRecord>): number {
    // Manual entries have highest priority
    if (
        record.data_source === "manual_entry" ||
        record.source === "manual"
    ) {
        return 100;
    }
    // HC with high confidence
    if (
        (record.data_source === "health_connect" ||
            record.source === "health_connect") &&
        record.confidence === "high"
    ) {
        return 80;
    }
    // HC with medium confidence
    if (
        (record.data_source === "health_connect" ||
            record.source === "health_connect") &&
        record.confidence === "medium"
    ) {
        return 60;
    }
    // Cloud records (synced)
    if (record.synced_at && !record.needs_sync) {
        return 50;
    }
    // Low confidence / estimated
    if (record.confidence === "low") {
        return 20;
    }
    // Default
    return 40;
}

/**
 * Merge all sources (Cloud + Health Connect + Cache) with conflict resolution
 * Returns a unified list sorted by date descending
 */
export async function mergeAllSources(
    cloudRecords: Array<{
        id?: string;
        user_id: string;
        date: string;
        start_time?: string;
        end_time?: string;
        duration_minutes?: number;
        quality_score?: number;
        deep_sleep_minutes?: number;
        rem_sleep_minutes?: number;
        light_sleep_minutes?: number;
        awake_minutes?: number;
        data_source?: string;
        synced_at?: string;
        source?: string;
        confidence?: string;
    }>,
    hcRecords: CachedSleepRecord[],
    cachedRecords: CachedSleepRecord[],
): Promise<CachedSleepRecord[]> {
    try {
        const merged: Map<string, CachedSleepRecord> = new Map();

        // Helper to upsert with conflict resolution
        const upsert = (
            record: Partial<CachedSleepRecord> & {
                date: string;
                user_id: string;
            },
        ) => {
            const existing = merged.get(record.date);
            if (!existing) {
                merged.set(record.date, {
                    ...record,
                    source: (record.source as DataSource) || "health_connect",
                    confidence: (record.confidence as ConfidenceLevel) ||
                        "medium",
                    cached_at: record.cached_at || new Date().toISOString(),
                    needs_sync: record.needs_sync ?? false,
                } as CachedSleepRecord);
                return;
            }

            // Compare priorities - higher priority wins
            const existingPriority = getRecordPriority(existing);
            const newPriority = getRecordPriority(record);

            if (newPriority > existingPriority) {
                merged.set(record.date, {
                    ...record,
                    id: existing.id || record.id,
                    source: (record.source as DataSource) || "health_connect",
                    confidence: (record.confidence as ConfidenceLevel) ||
                        "medium",
                    cached_at: record.cached_at || new Date().toISOString(),
                    needs_sync: record.needs_sync ?? false,
                } as CachedSleepRecord);
            }
        };

        // 1. Add cloud records (lower priority base)
        for (const record of cloudRecords) {
            upsert({
                ...record,
                source: (record.source as DataSource) || "health_connect",
                confidence: (record.confidence as ConfidenceLevel) || "medium",
                data_source: record.data_source || "health_connect",
                needs_sync: false, // Already in cloud
            } as CachedSleepRecord);
        }

        // 2. Add Health Connect records (may override cloud if higher priority)
        for (const record of hcRecords) {
            upsert(record);
        }

        // 3. Add cached records that need sync (local-only)
        for (const record of cachedRecords) {
            if (record.needs_sync) {
                upsert(record);
            }
        }

        // Sort by date descending
        const result = Array.from(merged.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        // Persist merged cache
        await saveToCache(result);

        console.log(
            `[SleepCache] Merged ${result.length} records (Cloud: ${cloudRecords.length}, HC: ${hcRecords.length}, Cache: ${cachedRecords.length})`,
        );
        return result;
    } catch (error) {
        console.error("[SleepCache] Error in mergeAllSources:", error);
        // Fallback to cached records
        return cachedRecords;
    }
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migrate existing cached records to new schema
 * Call this on app startup to ensure all records have new fields
 */
export async function migrateCache(): Promise<void> {
    try {
        const records = await loadFromCache();
        let migrated = false;

        const updated = records.map((record) => {
            // Add missing source field
            if (!record.source) {
                migrated = true;
                record.source = (record.data_source as DataSource) ||
                    "health_connect";
            }

            // Add missing confidence field
            if (!record.confidence) {
                migrated = true;
                // Default to medium for existing health connect data
                record.confidence = record.data_source === "manual_entry"
                    ? "low"
                    : "medium";
            }

            return record;
        });

        if (migrated) {
            await saveToCache(updated);
            console.log("[SleepCache] Migrated records to new schema");
        }
    } catch (error) {
        console.error("[SleepCache] Error migrating cache:", error);
    }
}

/**
 * Get historical durations for consistency calculation
 */
export async function getHistoricalDurations(
    userId: string,
    days: number = 7,
): Promise<number[]> {
    try {
        const records = await loadFromCache();
        return records
            .filter((r) => r.user_id === userId)
            .slice(0, days)
            .map((r) => r.duration_minutes);
    } catch (error) {
        console.error(
            "[SleepCache] Error getting historical durations:",
            error,
        );
        return [];
    }
}
