# Mobile App State Management

The application uses **Zustand** for state management, providing a lightweight and high-performance solution for managing global state across the mobile app.

## Stores

### `useAuthStore`

- **File**: `store/authStore.ts`
- **Purpose**: Manages user authentication state, session initialization, and identity provider integrations.
- **Key State**:
  - `user`: The current Supabase user object.
  - `session`: The current active session.
  - `initialized`: Boolean flag indicating if the auth state has been loaded from storage/API.
  - `passkeySupported`: Whether the device supports WebAuthn/Passkeys.
- **Primary Actions**:
  - `initialize()`: Sets up the auth listener and hydrates state from the API.
  - `signIn(email, password)`: Standard email login via backend API.
  - `signInWithPasskey()`: Initiates the WebAuthn login flow.
  - `signOut()`: Clears local session and calls the logout API.

### `useProfileStore`

- **File**: `store/profileStore.ts`
- **Purpose**: Handles user profile data and the multi-step onboarding process.
- **Key State**:
  - `profile`: The current user's profile information (age, height, weight, etc.).
  - `formData`: Temporary storage for onboarding inputs.
  - `currentStep`: Tracks progress through the 9-step onboarding flow.
- **Primary Actions**:
  - `fetchProfile(userId)`: Retrieves user data from the `/api/profile` endpoint.
  - `saveProfile(userId)`: Persists onboarding or edit-modal changes.
  - `uploadAvatar(userId, uri)`: Converts local images to base64 and uploads to the server.
  - `canChangeUsername()`: Logic to enforce a 7-day cooldown on username updates.

### `useSleepStore`

- **File**: `store/sleepStore.ts`
- **Purpose**: Orchestrates sleep data fetching from Health Connect and synchronization with the backend.
- **Key State**:
  - `isConnected`: Status of Health Connect permissions.
  - `weeklyHistory`: Array of sleep records for the dashboard charts.
  - `lastNightSleep`: Summary of the most recent sleep session.
- **Primary Actions**:
  - `fetchSleepData(userId)`: Reads sleep sessions from Health Connect (Android only).
  - `syncPendingRecords(userId)`: Batches local cached sleep data and pushes it to the API.
  - `forceSaveManualSleep(...)`: Bypasses health sync to save a manual entry immediately.
- **Optimization**: Uses a cooldown mechanism (via `sleepCache`) to prevent redundant API calls and Health Connect queries.
