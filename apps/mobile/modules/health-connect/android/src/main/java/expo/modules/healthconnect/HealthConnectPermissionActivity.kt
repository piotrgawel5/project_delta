package expo.modules.healthconnect

import android.os.Bundle
import androidx.activity.ComponentActivity

/**
 * Activity to show Health Connect permission rationale.
 * This is required by Health Connect to explain why the app needs health data access.
 */
class HealthConnectPermissionActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // This activity is just a placeholder for the permission rationale intent filter.
        // When Health Connect calls this, the user has already seen the permission dialog.
        // We just finish immediately to return to our app.
        finish()
    }
}
