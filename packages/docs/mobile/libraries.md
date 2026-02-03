# Mobile App Libraries & Utils

This document covers the core libraries and utility modules that power the mobile application's logic.

## Networking

### `api`

- **File**: `lib/api.ts`
- **Description**: A wrapper around the native `fetch` API.
- **Key Features**:
  - **Automatic Base URL**: Switches between `localhost` (emulator) and a configurable `EXPO_PUBLIC_API_URL` (physical devices).
  - **Authorization Header**: Automatically injects the Supabase `access_token` into every request.
  - **Timeout Handling**: Includes a 10-second request timeout using `AbortController`.
  - **Error Mapping**: Standardizes error responses from the backend.

---

## Authentication

### `Passkey`

- **File**: `lib/passkey.ts`
- **Description**: Helpers for WebAuthn/Passkey registration and authentication.
- **Key Features**:
  - `isPasskeySupported()`: Checks if the device has Credential Manager capabilities (Android only).
  - `createPasskeyAccount(email)`: Orchestrates registration via the backend and the native `CredentialAuth` module.
  - `signInWithPasskey()`: Handles the login flow by requesting options from the server and prompting the user for biometric/PIN verification.

---

## Sleep Intelligence

### `SleepCache`

- **File**: `lib/sleepCache.ts`
- **Description**: A persistent caching layer using `AsyncStorage` to enable offline support and reduce API bandwidth.
- **Key Features**:
  - **Cooldowns**: 30-second cooldowns for fetching (Health Connect) and syncing (Supabase).
  - **Auto-Sync**: Tracks whether a record `needs_sync` and handles batched updates.
  - **Data Cleanup**: Automatically purges records older than 30 days to save device storage.

### `SleepCalculations`

- **File**: `lib/sleepCalculations.ts`
- **Description**: Scientific algorithms for estimating sleep stages and calculating quality scores.
- **Key Features**:
  - **Personalized Estimation**: Uses user profile data (age, sex, BMI, activity level) to estimate sleep phases when high-resolution data is missing.
  - **Quality Scoring**: A weighted algorithm that considers duration, deep sleep percentage, REM percentage, and consistency.
  - **Baseline Analysis**: Learns user's typical patterns from historical data to provide better insights.

---

## Hardware Integration

### `HealthConnect`

- **File**: `modules/health-connect/index.ts`
- **Description**: The bridge between the Expo app and the Android Health Connect API.
- **Key Features**:
  - `getSleepSessions()`: Retrieves sleep records from other apps (e.g., Oura, Samsung Health).
  - `requestPermissions()`: Handles the complex permission flow required by Android 14+.
  - `calculateSleepQuality()`: A module-specific quality scorer used for initial data validation.
