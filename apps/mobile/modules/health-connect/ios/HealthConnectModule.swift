import ExpoModulesCore

public class HealthConnectModule: Module {
    public func definition() -> ModuleDefinition {
        Name("HealthConnect")

        // Check if Health Connect is available (always false on iOS)
        AsyncFunction("isAvailable") { () -> [String: Any] in
            return [
                "available": false,
                "reason": "NOT_SUPPORTED"
            ]
        }

        // Request permissions - not implemented on iOS
        AsyncFunction("requestPermissions") { () -> [[String: Any]] in
            throw NSError(
                domain: "HealthConnect",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Health Connect is not available on iOS. Use Apple HealthKit instead."]
            )
        }

        // Check permissions - always returns not granted on iOS
        AsyncFunction("checkPermissions") { () -> [[String: Any]] in
            return [["permission": "READ_SLEEP", "granted": false]]
        }

        // Open settings - not implemented on iOS
        AsyncFunction("openHealthConnectSettings") { () in
            throw NSError(
                domain: "HealthConnect",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Health Connect is not available on iOS."]
            )
        }

        // Get sleep sessions - not implemented on iOS
        AsyncFunction("getSleepSessions") { (startTime: String, endTime: String) -> [[String: Any]] in
            throw NSError(
                domain: "HealthConnect",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Health Connect is not available on iOS. Use Apple HealthKit instead."]
            )
        }

        // Get sleep metrics - not implemented on iOS
        AsyncFunction("getSleepMetrics") { (startTime: String, endTime: String) -> [String: Any] in
            throw NSError(
                domain: "HealthConnect",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Health Connect is not available on iOS. Use Apple HealthKit instead."]
            )
        }
    }
}
