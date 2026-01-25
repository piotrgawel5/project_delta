package expo.modules.healthconnect

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.runBlocking
import java.time.Instant

class HealthConnectModule : Module() {
    
    private val permissions = setOf(
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getWritePermission(SleepSessionRecord::class)
    )
    
    private var permissionPromise: Promise? = null
    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null
    
    private fun getHealthConnectClient(context: Context): HealthConnectClient? {
        return try {
            HealthConnectClient.getOrCreate(context)
        } catch (e: Exception) {
            null
        }
    }

    override fun definition() = ModuleDefinition {
        Name("HealthConnect")

        OnCreate {
            // Try to register the permission launcher when module is created
            try {
                val activity = appContext.activityProvider?.currentActivity
                if (activity is ComponentActivity) {
                    val contract = PermissionController.createRequestPermissionResultContract()
                    permissionLauncher = activity.registerForActivityResult(contract) { grantedPermissions ->
                        val promise = permissionPromise
                        permissionPromise = null
                        
                        val hasSleepPermission = grantedPermissions.contains(
                            HealthPermission.getReadPermission(SleepSessionRecord::class)
                        )
                        
                        promise?.resolve(listOf(
                            mapOf(
                                "permission" to "READ_SLEEP",
                                "granted" to hasSleepPermission
                            )
                        ))
                    }
                }
            } catch (e: Exception) {
                // Launcher registration failed, will use fallback
            }
        }

        // Check if Health Connect is available
        AsyncFunction("isAvailable") {
            val context = appContext.reactContext ?: return@AsyncFunction mapOf(
                "available" to false,
                "reason" to "NO_CONTEXT"
            )
            
            val status = HealthConnectClient.getSdkStatus(context)
            
            when (status) {
                HealthConnectClient.SDK_AVAILABLE -> mapOf(
                    "available" to true,
                    "reason" to "AVAILABLE",
                    "sdkStatus" to status
                )
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> mapOf(
                    "available" to false,
                    "reason" to "NOT_INSTALLED",
                    "sdkStatus" to status
                )
                else -> mapOf(
                    "available" to false,
                    "reason" to "NOT_SUPPORTED",
                    "sdkStatus" to status
                )
            }
        }

        // Request permissions using the native Health Connect UI
        AsyncFunction("requestPermissions") { promise: Promise ->
            val activity = appContext.activityProvider?.currentActivity
                ?: throw Exception("NO_ACTIVITY")
            
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            val client = getHealthConnectClient(context)
                ?: throw Exception("HEALTH_CONNECT_NOT_AVAILABLE")

            // First check if permissions are already granted
            runBlocking {
                val granted = client.permissionController.getGrantedPermissions()
                val hasSleepPermission = granted.contains(
                    HealthPermission.getReadPermission(SleepSessionRecord::class)
                )
                
                if (hasSleepPermission) {
                    promise.resolve(listOf(
                        mapOf(
                            "permission" to "READ_SLEEP",
                            "granted" to true
                        )
                    ))
                    return@runBlocking
                }
                
                // Try to use the launcher if available
                val launcher = permissionLauncher
                if (launcher != null && activity is ComponentActivity) {
                    try {
                        permissionPromise = promise
                        launcher.launch(permissions)
                        return@runBlocking
                    } catch (e: Exception) {
                        permissionPromise = null
                        // Fall through to fallback
                    }
                }
                
                // Fallback: Open Health Connect app permissions page
                try {
                    val packageName = context.packageName
                    val intent = Intent("androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS").apply {
                        putExtra(Intent.EXTRA_PACKAGE_NAME, packageName)
                    }
                    activity.startActivity(intent)
                    
                    // Return current status (user will grant permission in Health Connect)
                    promise.resolve(listOf(
                        mapOf(
                            "permission" to "READ_SLEEP",
                            "granted" to false,
                            "openedSettings" to true
                        )
                    ))
                } catch (e: Exception) {
                    // Final fallback: Open Health Connect main settings
                    try {
                        val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
                        activity.startActivity(intent)
                        promise.resolve(listOf(
                            mapOf(
                                "permission" to "READ_SLEEP",
                                "granted" to false,
                                "openedSettings" to true
                            )
                        ))
                    } catch (e2: Exception) {
                        promise.reject("PERMISSION_FAILED", "Could not open Health Connect", e2)
                    }
                }
            }
        }

        // Check current permissions
        AsyncFunction("checkPermissions") {
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            val client = getHealthConnectClient(context)
                ?: return@AsyncFunction listOf(
                    mapOf("permission" to "READ_SLEEP", "granted" to false)
                )

            runBlocking {
                val granted = client.permissionController.getGrantedPermissions()
                
                listOf(
                    mapOf(
                        "permission" to "READ_SLEEP",
                        "granted" to granted.contains(
                            HealthPermission.getReadPermission(SleepSessionRecord::class)
                        )
                    ),
                    mapOf(
                        "permission" to "WRITE_SLEEP",
                        "granted" to granted.contains(
                            HealthPermission.getWritePermission(SleepSessionRecord::class)
                        )
                    )
                )
            }
        }

        // Open Health Connect settings
        AsyncFunction("openHealthConnectSettings") {
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            val activity = appContext.activityProvider?.currentActivity
                ?: throw Exception("NO_ACTIVITY")

            try {
                val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
                activity.startActivity(intent)
            } catch (e: Exception) {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")
                }
                activity.startActivity(intent)
            }
        }

        // Get sleep sessions within a time range
        AsyncFunction("getSleepSessions") { startTime: String, endTime: String ->
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            val client = getHealthConnectClient(context)
                ?: throw Exception("HEALTH_CONNECT_NOT_AVAILABLE")

            runBlocking {
                try {
                    val startInstant = Instant.parse(startTime)
                    val endInstant = Instant.parse(endTime)
                    
                    val request = ReadRecordsRequest(
                        recordType = SleepSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant)
                    )
                    
                    val response = client.readRecords(request)
                    
                    response.records.map { session ->
                        mapOf(
                            "id" to session.metadata.id,
                            "startTime" to session.startTime.toString(),
                            "endTime" to session.endTime.toString(),
                            "title" to session.title,
                            "notes" to session.notes,
                            "stages" to session.stages.map { stage ->
                                mapOf(
                                    "startTime" to stage.startTime.toString(),
                                    "endTime" to stage.endTime.toString(),
                                    "stage" to stage.stage
                                )
                            },
                            "metadata" to mapOf(
                                "dataOrigin" to session.metadata.dataOrigin.packageName,
                                "lastModifiedTime" to session.metadata.lastModifiedTime.toString()
                            )
                        )
                    }
                } catch (e: SecurityException) {
                    throw Exception("PERMISSION_DENIED")
                } catch (e: Exception) {
                    throw Exception("READ_FAILED: ${e.message}")
                }
            }
        }

        // Get aggregated sleep metrics
        AsyncFunction("getSleepMetrics") { startTime: String, endTime: String ->
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            val client = getHealthConnectClient(context)
                ?: throw Exception("HEALTH_CONNECT_NOT_AVAILABLE")

            runBlocking {
                try {
                    val startInstant = Instant.parse(startTime)
                    val endInstant = Instant.parse(endTime)
                    
                    val request = ReadRecordsRequest(
                        recordType = SleepSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant)
                    )
                    
                    val response = client.readRecords(request)
                    
                    var totalMinutes = 0L
                    var awakeMinutes = 0L
                    var lightMinutes = 0L
                    var deepMinutes = 0L
                    var remMinutes = 0L
                    
                    for (session in response.records) {
                        for (stage in session.stages) {
                            val durationMinutes = java.time.Duration.between(
                                stage.startTime, stage.endTime
                            ).toMinutes()
                            
                            when (stage.stage) {
                                SleepSessionRecord.STAGE_TYPE_AWAKE -> awakeMinutes += durationMinutes
                                SleepSessionRecord.STAGE_TYPE_LIGHT -> lightMinutes += durationMinutes
                                SleepSessionRecord.STAGE_TYPE_DEEP -> deepMinutes += durationMinutes
                                SleepSessionRecord.STAGE_TYPE_REM -> remMinutes += durationMinutes
                                else -> lightMinutes += durationMinutes
                            }
                        }
                        
                        if (session.stages.isEmpty()) {
                            totalMinutes += java.time.Duration.between(
                                session.startTime, session.endTime
                            ).toMinutes()
                        }
                    }
                    
                    val calculatedTotal = awakeMinutes + lightMinutes + deepMinutes + remMinutes
                    if (calculatedTotal > 0) {
                        totalMinutes = calculatedTotal
                    }
                    
                    val sleepTime = totalMinutes - awakeMinutes
                    val efficiency = if (totalMinutes > 0) {
                        (sleepTime.toDouble() / totalMinutes * 100).toInt()
                    } else 0
                    
                    mapOf(
                        "totalDurationMinutes" to totalMinutes,
                        "awakeDurationMinutes" to awakeMinutes,
                        "lightSleepMinutes" to lightMinutes,
                        "deepSleepMinutes" to deepMinutes,
                        "remSleepMinutes" to remMinutes,
                        "sleepEfficiency" to efficiency
                    )
                } catch (e: SecurityException) {
                    throw Exception("PERMISSION_DENIED")
                } catch (e: Exception) {
                    throw Exception("METRICS_FAILED: ${e.message}")
                }
            }
        }

        // Write a sleep session to Health Connect
        AsyncFunction("writeSleepSession") { startTime: String, endTime: String, title: String? ->
            val context = appContext.reactContext
                ?: throw Exception("NO_CONTEXT")
            
            val client = getHealthConnectClient(context)
                ?: throw Exception("HEALTH_CONNECT_NOT_AVAILABLE")

            runBlocking {
                try {
                    val startInstant = Instant.parse(startTime)
                    val endInstant = Instant.parse(endTime)
                    
                    val sleepSession = SleepSessionRecord(
                        startTime = startInstant,
                        endTime = endInstant,
                        title = title,
                        startZoneOffset = null,
                        endZoneOffset = null
                    )
                    
                    client.insertRecords(listOf(sleepSession))
                    
                    mapOf(
                        "success" to true,
                        "startTime" to startTime,
                        "endTime" to endTime
                    )
                } catch (e: SecurityException) {
                    throw Exception("PERMISSION_DENIED")
                } catch (e: Exception) {
                    throw Exception("WRITE_FAILED: ${e.message}")
                }
            }
        }
    }
}

