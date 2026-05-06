# Mobile App State Management

The application uses **Zustand v5** for state management.

> **Critical Zustand v5 rule:** Selectors must return stable references when the underlying state hasn't changed. Returning a fresh `[]`, `{}`, or computed object on every call breaks `useSyncExternalStore` `Object.is` equality and triggers an infinite re-render loop. Cache fallbacks at module scope (`const EMPTY: T[] = []`) and derive computed objects via `useMemo` in the component, not in the selector.

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
- **Purpose**: User profile and onboarding form state.
- **Key State**:
  - `profile`: User profile (age, height, weight, `plan: 'free' | 'pro' | 'premium'`, etc.).
  - `formData`, `currentStep`: Onboarding scratch state.
- **Primary Actions**: `fetchProfile`, `saveProfile`, `uploadAvatar`, `canChangeUsername`.

### `useSleepStore`

- **File**: `store/sleepStore.ts`
- **Purpose**: Sleep data + offline batch sync.
- **Key State**: `recentHistory`, `isConnected`, `lastNightSleep`, sync queue.
- **Primary Actions**: `fetchSleepData`, `syncPendingRecords`, `forceSaveManualSleep`.

### `useWorkoutStore`

- **File**: `store/workoutStore.ts`
- **Purpose**: Workout sessions, sets, sync queue, logging mode preference.
- **Key State**:
  - `sessions: WorkoutSession[]`
  - `activeSession`
  - `loggingMode: 'quick' | 'detailed'` — persisted, drives `app/workout/active.tsx` layout
  - `availableEquipment: Equipment[]` — persisted, drives picker chip filter
  - `syncQueue`, `syncStatus`
- **Primary Actions**: `startWorkout`, `logSet`, `finishWorkout`, `setLoggingMode`, `setAvailableEquipment`, `drainSyncQueue`.

### `useNutritionStore`

- **File**: `store/nutritionStore.ts`
- **Purpose**: Nutrition logs by date, foods catalog cache, offline write queue.
- **Key State**: `logsByDate`, `isLoaded`, `loadedForUserId`, `syncQueue`, `syncStatus`.
- **Primary Actions**: `fetchLogs`, `logFood`, `removeLog`, `searchFoods`, `lookupBarcode`, `drainSyncQueue`.
- **Selectors**:
  - `selectLogsForDate(date)` — returns the logs array; uses a module-scope `EMPTY_LOGS` fallback to keep references stable.
  - `computeMacrosForLogs(logs)` — **pure helper, NOT a selector**. Call inside `useMemo` over the logs array.

### Removed: `useHealthStore`

Health Connect data now flows directly through the sleep engine (`lib/sleep*.ts`); the empty `healthStore` was removed.
