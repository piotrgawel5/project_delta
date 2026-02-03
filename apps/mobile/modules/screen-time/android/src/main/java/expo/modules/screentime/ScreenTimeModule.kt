package expo.modules.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * ScreenTimeModule provides access to Android UsageStats API for detecting
 * screen on/off events to estimate bedtime and wakeup times.
 * 
 * This module requires PACKAGE_USAGE_STATS permission which must be granted
 * manually by the user through Settings > Apps > Special Access > Usage Data Access.
 */
class ScreenTimeModule : Module() {

    // Minimum gap between screen events to consider as "sleep period" (in minutes)
    private val SLEEP_GAP_THRESHOLD_MINUTES = 60

    // Minimum sleep duration to consider valid (in minutes)
    private val MIN_SLEEP_DURATION_MINUTES = 180 // 3 hours

    // Maximum sleep duration to consider valid (in minutes)
    private val MAX_SLEEP_DURATION_MINUTES = 840 // 14 hours

    private fun hasUsageStatsPermission(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    override fun definition() = ModuleDefinition {
        Name("ScreenTime")

        /**
         * Check if usage stats permission is granted
         */
        AsyncFunction("hasPermission") {
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            hasUsageStatsPermission(context)
        }

        /**
         * Open the usage stats permission settings page
         */
        AsyncFunction("requestPermission") {
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            val activity = appContext.activityProvider?.currentActivity
                ?: throw Exception("NO_ACTIVITY")

            try {
                val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                activity.startActivity(intent)
                mapOf(
                    "success" to true,
                    "openedSettings" to true
                )
            } catch (e: Exception) {
                mapOf(
                    "success" to false,
                    "error" to e.message
                )
            }
        }

        /**
         * Get screen on/off events for a given time range.
         * Returns a list of events with timestamps and types.
         */
        AsyncFunction("getScreenEvents") { startTimeMs: Long, endTimeMs: Long ->
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")

            if (!hasUsageStatsPermission(context)) {
                throw Exception("PERMISSION_DENIED")
            }

            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) 
                as UsageStatsManager

            val events = mutableListOf<Map<String, Any>>()

            try {
                val usageEvents = usageStatsManager.queryEvents(startTimeMs, endTimeMs)
                val event = UsageEvents.Event()

                while (usageEvents.hasNextEvent()) {
                    usageEvents.getNextEvent(event)

                    // Filter for screen interactive state changes
                    when (event.eventType) {
                        UsageEvents.Event.SCREEN_INTERACTIVE -> {
                            events.add(mapOf(
                                "timestamp" to event.timeStamp,
                                "type" to "SCREEN_ON",
                                "packageName" to (event.packageName ?: "system")
                            ))
                        }
                        UsageEvents.Event.SCREEN_NON_INTERACTIVE -> {
                            events.add(mapOf(
                                "timestamp" to event.timeStamp,
                                "type" to "SCREEN_OFF",
                                "packageName" to (event.packageName ?: "system")
                            ))
                        }
                        UsageEvents.Event.USER_INTERACTION -> {
                            // Also track user interactions for more accuracy
                            events.add(mapOf(
                                "timestamp" to event.timeStamp,
                                "type" to "USER_INTERACTION",
                                "packageName" to (event.packageName ?: "unknown")
                            ))
                        }
                    }
                }
            } catch (e: Exception) {
                throw Exception("QUERY_FAILED: ${e.message}")
            }

            mapOf(
                "events" to events,
                "startTime" to startTimeMs,
                "endTime" to endTimeMs,
                "count" to events.size
            )
        }

        /**
         * Get aggregated usage stats for each app in the time range.
         */
        AsyncFunction("getAppUsageStats") { startTimeMs: Long, endTimeMs: Long ->
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")

            if (!hasUsageStatsPermission(context)) {
                throw Exception("PERMISSION_DENIED")
            }

            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) 
                as UsageStatsManager

            try {
                val usageStats = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY,
                    startTimeMs,
                    endTimeMs
                )

                val stats = usageStats
                    .filter { it.totalTimeInForeground > 0 }
                    .sortedByDescending { it.totalTimeInForeground }
                    .take(20)  // Top 20 apps
                    .map { stat ->
                        mapOf(
                            "packageName" to stat.packageName,
                            "totalTimeInForegroundMs" to stat.totalTimeInForeground,
                            "lastTimeUsed" to stat.lastTimeUsed,
                            "firstTimeStamp" to stat.firstTimeStamp,
                            "lastTimeStamp" to stat.lastTimeStamp
                        )
                    }

                mapOf(
                    "stats" to stats,
                    "startTime" to startTimeMs,
                    "endTime" to endTimeMs
                )
            } catch (e: Exception) {
                throw Exception("QUERY_FAILED: ${e.message}")
            }
        }

        /**
         * Estimate bedtime and wakeup time from screen events.
         * Looks for the longest gap between screen-off and screen-on events.
         */
        AsyncFunction("estimateSleepWindow") { startTimeMs: Long, endTimeMs: Long ->
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")

            if (!hasUsageStatsPermission(context)) {
                throw Exception("PERMISSION_DENIED")
            }

            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) 
                as UsageStatsManager

            try {
                val events = mutableListOf<Pair<Long, String>>()
                val usageEvents = usageStatsManager.queryEvents(startTimeMs, endTimeMs)
                val event = UsageEvents.Event()

                // Collect all screen on/off events
                while (usageEvents.hasNextEvent()) {
                    usageEvents.getNextEvent(event)
                    when (event.eventType) {
                        UsageEvents.Event.SCREEN_INTERACTIVE -> {
                            events.add(Pair(event.timeStamp, "ON"))
                        }
                        UsageEvents.Event.SCREEN_NON_INTERACTIVE -> {
                            events.add(Pair(event.timeStamp, "OFF"))
                        }
                    }
                }

                if (events.size < 2) {
                    return@AsyncFunction mapOf(
                        "success" to false,
                        "reason" to "INSUFFICIENT_DATA",
                        "eventCount" to events.size
                    )
                }

                // Sort by timestamp
                events.sortBy { it.first }

                // Find the longest gap between SCREEN_OFF and next SCREEN_ON
                var longestGapStart = 0L
                var longestGapEnd = 0L
                var longestGapMs = 0L

                for (i in 0 until events.size - 1) {
                    val current = events[i]
                    val next = events[i + 1]

                    // Look for gaps where screen goes off then on
                    if (current.second == "OFF" && next.second == "ON") {
                        val gapMs = next.first - current.first

                        // Check if this gap is within valid sleep duration range
                        val gapMinutes = TimeUnit.MILLISECONDS.toMinutes(gapMs)
                        if (gapMinutes >= MIN_SLEEP_DURATION_MINUTES && 
                            gapMinutes <= MAX_SLEEP_DURATION_MINUTES &&
                            gapMs > longestGapMs) {
                            longestGapStart = current.first
                            longestGapEnd = next.first
                            longestGapMs = gapMs
                        }
                    }
                }

                if (longestGapMs == 0L) {
                    // No valid sleep gap found, look for the longest gap regardless
                    for (i in 0 until events.size - 1) {
                        val gapMs = events[i + 1].first - events[i].first
                        if (gapMs > longestGapMs && 
                            TimeUnit.MILLISECONDS.toMinutes(gapMs) >= SLEEP_GAP_THRESHOLD_MINUTES) {
                            longestGapStart = events[i].first
                            longestGapEnd = events[i + 1].first
                            longestGapMs = gapMs
                        }
                    }
                }

                if (longestGapMs > 0) {
                    val durationMinutes = TimeUnit.MILLISECONDS.toMinutes(longestGapMs)
                    
                    // Determine confidence based on gap characteristics
                    val confidence = when {
                        durationMinutes >= 360 && durationMinutes <= 600 -> "high"  // 6-10 hours
                        durationMinutes >= 240 && durationMinutes <= 720 -> "medium" // 4-12 hours
                        else -> "low"
                    }

                    mapOf(
                        "success" to true,
                        "estimatedBedtime" to longestGapStart,
                        "estimatedWakeup" to longestGapEnd,
                        "durationMinutes" to durationMinutes,
                        "confidence" to confidence,
                        "source" to "usage_stats",
                        "totalEventsAnalyzed" to events.size
                    )
                } else {
                    mapOf(
                        "success" to false,
                        "reason" to "NO_SLEEP_GAP_FOUND",
                        "eventCount" to events.size
                    )
                }
            } catch (e: Exception) {
                throw Exception("ESTIMATE_FAILED: ${e.message}")
            }
        }

        /**
         * Get a summary of screen time for a time range.
         */
        AsyncFunction("getScreenTimeSummary") { startTimeMs: Long, endTimeMs: Long ->
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")

            if (!hasUsageStatsPermission(context)) {
                throw Exception("PERMISSION_DENIED")
            }

            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) 
                as UsageStatsManager

            try {
                val events = mutableListOf<Pair<Long, String>>()
                val usageEvents = usageStatsManager.queryEvents(startTimeMs, endTimeMs)
                val event = UsageEvents.Event()

                var lastScreenOnTime = 0L
                var totalScreenOnMs = 0L
                var screenOnCount = 0
                var screenOffCount = 0
                var firstEventTime = 0L
                var lastEventTime = 0L

                while (usageEvents.hasNextEvent()) {
                    usageEvents.getNextEvent(event)
                    
                    if (firstEventTime == 0L) {
                        firstEventTime = event.timeStamp
                    }
                    lastEventTime = event.timeStamp

                    when (event.eventType) {
                        UsageEvents.Event.SCREEN_INTERACTIVE -> {
                            lastScreenOnTime = event.timeStamp
                            screenOnCount++
                        }
                        UsageEvents.Event.SCREEN_NON_INTERACTIVE -> {
                            if (lastScreenOnTime > 0) {
                                totalScreenOnMs += (event.timeStamp - lastScreenOnTime)
                                lastScreenOnTime = 0L
                            }
                            screenOffCount++
                        }
                    }
                }

                // If screen is still on, count until end time
                if (lastScreenOnTime > 0) {
                    totalScreenOnMs += (endTimeMs - lastScreenOnTime)
                }

                mapOf(
                    "totalScreenOnMinutes" to TimeUnit.MILLISECONDS.toMinutes(totalScreenOnMs),
                    "screenOnCount" to screenOnCount,
                    "screenOffCount" to screenOffCount,
                    "firstEventTime" to firstEventTime,
                    "lastEventTime" to lastEventTime,
                    "periodMs" to (endTimeMs - startTimeMs)
                )
            } catch (e: Exception) {
                throw Exception("SUMMARY_FAILED: ${e.message}")
            }
        }
    }
}
